/**
 * SSE client for the live stats stream from /sse/stats.
 *
 * Uses XMLHttpRequest with incremental `onprogress` parsing rather than
 * the Fetch/ReadableStream API.  RN 0.81's native fetch does not resolve
 * the promise for streaming responses (SSE), so the fetch call hangs
 * forever.  XHR's `onprogress` fires as chunks arrive on both web and
 * native, making it the reliable cross-platform choice.
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

/**
 * Reconnect after this many bytes to prevent unbounded responseText growth.
 * XHR accumulates the full response in memory — this caps it.
 */
const MAX_RESPONSE_BYTES = 2 * 1024 * 1024 // 2 MB

export function connectStatsSSE(
  apiKey: string,
  callbacks: StatsSSECallbacks,
): StatsSSEConnection {
  let closed = false
  let xhr: XMLHttpRequest | null = null
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

  function connect() {
    if (closed) return

    const baseUrl = getBaseUrl()
    if (!baseUrl) {
      callbacks.onError(new Error('BskyStats client not configured'))
      return
    }

    const url = `${baseUrl}/sse/stats`
    console.warn(`[bsky-sse] connecting ${url}`)

    const req = new XMLHttpRequest()
    xhr = req

    // Track how much of responseText we've already parsed
    let seenIndex = 0
    let sseBuffer = ''
    let connected = false

    req.open('GET', url)
    req.setRequestHeader('X-Api-Key', apiKey)

    req.onprogress = () => {
      if (closed) return

      if (!connected) {
        connected = true
        backoff = INITIAL_BACKOFF_MS
        callbacks.onConnected?.()
        console.warn('[bsky-sse] connected, receiving events')
      }

      // Extract only the new text since our last read
      const newText = req.responseText.slice(seenIndex)
      seenIndex = req.responseText.length

      // Parse SSE events from the new chunk
      sseBuffer += newText
      const {events, remainder} = parseSSEChunk(sseBuffer)
      sseBuffer = remainder

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

      // Reconnect if responseText has grown too large (prevents memory leak)
      if (req.responseText.length > MAX_RESPONSE_BYTES) {
        console.warn('[bsky-sse] buffer cap reached, reconnecting')
        req.abort()
        // onloadend will fire and trigger reconnect
      }
    }

    req.onerror = () => {
      if (closed) return
      console.warn('[bsky-sse] XHR error')
      callbacks.onError(new Error('SSE connection error'))
    }

    req.onloadend = () => {
      if (closed) return
      console.warn(`[bsky-sse] ended (status=${req.status}), reconnecting`)
      if (req.status !== 0 && req.status !== 200) {
        callbacks.onError(new Error(`SSE connect failed: HTTP ${req.status}`))
      }
      scheduleReconnect()
    }

    req.send()
  }

  // Start first connection
  connect()

  return {
    close() {
      closed = true
      xhr?.abort()
      xhr = null
      if (reconnectTimer !== null) {
        clearTimeout(reconnectTimer)
        reconnectTimer = null
      }
    },
  }
}
