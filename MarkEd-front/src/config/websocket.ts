import { getToken } from '@/src/api/config'

export const getWebSocketURL = (assignmentId: number, submissionId: number) => {
  const protocol = window.location.protocol === 'https:' ? 'wss' : 'ws'
  const base = `${protocol}://${window.location.host}/ws/peer-reviews/${assignmentId}/${submissionId}/`
  // The SPA is bearer-token authenticated, but the browser WebSocket API can't
  // set an Authorization header, so the token rides in the query string and is
  // resolved by WebSocketAuthMiddleware on the handshake.
  const token = getToken()
  return token ? `${base}?token=${encodeURIComponent(token)}` : base
}
