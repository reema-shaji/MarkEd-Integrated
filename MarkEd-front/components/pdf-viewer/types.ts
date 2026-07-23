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
