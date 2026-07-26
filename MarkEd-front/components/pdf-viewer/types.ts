import { UserSchema } from '@/src/api'

export interface PopupPosition {
  x: number
  y: number
}

export interface Annotation {
  id: string
  selectedText: string
  feedback?: string
  llmFeedback?: string
  markerFeedback?: string
  llmFeedbackDismissed?: boolean
  // True from the moment a student comment is created until its AI suggestion
  // arrives (live via WebSocket, or on the next fetch). Drives the
  // "Generating AI suggestion…" pending indicator.
  awaitingLLM?: boolean
  position: {
    pageNumber: number
    boundingRect: DOMRect
  }
  timestamp: string
  author: UserSchema
  marginTextTop: string
  marginTextBottom: string
}

export interface PDFViewerProps {
  url: string
  enableAnnotations?: boolean
  assignmentId?: number
  submissionId?: number
  otherControls?: React.ReactNode
  isCompleted?: boolean
  onToggleComplete?: () => void
  isMarkerView?: boolean
}
