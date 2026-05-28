/**
 * SSE client for the live stats stream from /sse/stats.
 *
 * Uses a plain fetch + ReadableStream approach (works in both web and RN)
 * rather than the EventSource API, which has spotty RN support.
 *
 * Provides auto-reconnect with exponential backoff.
 */
import {type StatsSnapshot} from './bsky-stats'
import {getBaseUrl} from './bsky-stats'

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface StatsSSECallbacks {
  onSnapshot: (data: StatsSnapshot) => void
  onUpdate: (data: StatsSnapshot) => void
  onError: (error: Error) => void
  onConnected?: () => void
  onDisconnected?: () => void
}

export interface StatsSSEConnection {
  /** Close the connection and stop reconnecting. */
  close: () => void
}

// ---------------------------------------------------------------------------
// SSE line parser (shared with tests)
// ---------------------------------------------------------------------------

export interface ParsedSSEEvent {
  event: string
  data: string
}

/**
 * Parse a chunk of SSE text into events.
 * Returns the parsed events and any remaining incomplete text.
 */
export function parseSSEChunk(buffer: string): {
  events: ParsedSSEEvent[]
  remainder: string
} {
  const events: ParsedSSEEvent[] = []
  const lines = buffer.split('\n')
  // Last element may be an incomplete line
  const remainder = lines.pop() ?? ''

  let currentEvent = ''
  let currentData = ''

  for (const rawLine of lines) {
    // Strip \r for servers that send \r\n line endings
    const line = rawLine.replace(/\r$/, '')
    if (line.startsWith('event: ')) {
      currentEvent = line.slice(7).trim()
    } else if (line.startsWith('data: ')) {
      currentData = line.slice(6)
    } else if (line === '' && currentEvent && currentData) {
      // Empty line = end of event
      events.push({event: currentEvent, data: currentData})
      currentEvent = ''
      currentData = ''
    }
  }

  // If we have a partial event in progress, put it back in the remainder
  let partialPrefix = ''
  if (currentEvent) {
    partialPrefix += `event: ${currentEvent}\n`
  }
  if (currentData) {
    partialPrefix += `data: ${currentData}\n`
  }

  return {events, remainder: partialPrefix + remainder}
}

// ---------------------------------------------------------------------------
// Connection
// ---------------------------------------------------------------------------

const INITIAL_BACKOFF_MS = 1_000
const MAX_BACKOFF_MS = 30_000

export function connectStatsSSE(
  apiKey: string,
  callbacks: StatsSSECallbacks,
): StatsSSEConnection {
  let closed = false
  let controller: AbortController | null = null
  let backoff = INITIAL_BACKOFF_MS
  let reconnectTimer: ReturnType<typeof setTimeout> | null = null

  function scheduleReconnect() {
    if (closed) return
    callbacks.onDisconnected?.()
    reconnectTimer = setTimeout(() => {
      reconnectTimer = null
      if (!closed) connect()
    }, backoff)
    backoff = Math.min(backoff * 2, MAX_BACKOFF_MS)
  }

  async function connect() {
    if (closed) {
      console.warn('[bsky-sse] connect() skipped — closed')
      return
    }

    const baseUrl = getBaseUrl()
    console.warn('[bsky-sse] connect()', baseUrl || 'NO-BASE-URL')
    if (!baseUrl) {
      callbacks.onError(new Error('BskyStats client not configured'))
      return
    }

    controller = new AbortController()
    const url = `${baseUrl}/sse/stats`

    try {
      console.warn(`[bsky-sse] fetching ${url}`)
      const res = await fetch(url, {
        headers: {'X-Api-Key': apiKey},
        signal: controller.signal,
        // React Native requires this option to expose res.body as a ReadableStream
        // @ts-expect-error - RN-specific fetch option, not in standard RequestInit
        reactNative: {textStreaming: true},
      })

      console.warn(
        `[bsky-sse] fetch response: ${res.status}, body=${!!res.body}`,
      )
      if (!res.ok) {
        throw new Error(`SSE connect failed: HTTP ${res.status}`)
      }

      const reader = res.body?.getReader()
      if (!reader) {
        throw new Error(
          `No response body for SSE stream (body type: ${typeof res.body})`,
        )
      }

      // Connected successfully — reset backoff
      backoff = INITIAL_BACKOFF_MS
      callbacks.onConnected?.()
      console.warn('[bsky-sse] connected, reading stream...')

      const decoder = new TextDecoder()
      let buffer = ''

      while (!closed) {
        const {done, value} = await reader.read()
        if (done) {
          console.warn('[bsky-sse] stream done (server closed)')
          break
        }

        buffer += decoder.decode(value, {stream: true})
        const {events, remainder} = parseSSEChunk(buffer)
        buffer = remainder

        for (const evt of events) {
          try {
            const parsed = JSON.parse(evt.data) as StatsSnapshot
            if (evt.event === 'snapshot') {
              callbacks.onSnapshot(parsed)
            } else if (evt.event === 'update') {
              callbacks.onUpdate(parsed)
            }
          } catch {
            // Malformed JSON — skip this event
          }
        }
      }
    } catch (err) {
      if (closed) {
        console.warn('[bsky-sse] error after close (expected)')
        return
      }
      if (err instanceof Error && err.name === 'AbortError') {
        console.warn('[bsky-sse] aborted')
        return
      }
      console.warn('[bsky-sse] ERROR:', err)
      callbacks.onError(err instanceof Error ? err : new Error(String(err)))
    }

    // Stream ended or errored — reconnect
    if (!closed) {
      scheduleReconnect()
    }
  }

  // Start first connection
  connect()

  return {
    close() {
      closed = true
      controller?.abort()
      if (reconnectTimer !== null) {
        clearTimeout(reconnectTimer)
        reconnectTimer = null
      }
    },
  }
}
