export const getWebSocketURL = (assignmentId: number, submissionId: number) => {
  const protocol = window.location.protocol === 'https:' ? 'wss' : 'ws'
  return `${protocol}://${window.location.host}/ws/peer-reviews/${assignmentId}/${submissionId}/`
}
