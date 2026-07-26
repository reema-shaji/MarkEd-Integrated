import { Document, Page as PDFPage, pdfjs } from 'react-pdf'
import 'react-pdf/dist/Page/TextLayer.css'
import 'react-pdf/dist/Page/AnnotationLayer.css'
import { useEffect, useState, useRef, useMemo } from 'react'
import Controls from './components/Controls'
import { useAnnotations } from './hooks/useAnnotations'
import { useTextSelection } from './hooks/useTextSelection'
import type { Annotation } from './types'
import { DefaultService } from '@/src/api'
import { toast } from 'sonner'
import { useUser } from '@/src/contexts/user-context'
import { AnnotationsSidebar } from './components/AnnotationsSidebar'
import { getWebSocketURL } from '@/src/config/websocket'
import { debounce } from 'lodash'

// Serve the worker same-origin from /public (pinned to react-pdf's own pdfjs
// build) — a cross-origin CDN module worker fails in the browser.
pdfjs.GlobalWorkerOptions.workerSrc = `${process.env.NEXT_PUBLIC_BASE_PATH || ''}/pdf.worker.min.mjs`

const LoadingPlaceholder = () => (
  <div className='flex w-[760px] flex-col gap-8 duration-300 animate-in fade-in'>
    <div className='h-[1000px] animate-pulse rounded-lg border border-border bg-muted-foreground/5' />
    <div className='h-[1000px] animate-pulse rounded-lg border border-border bg-muted-foreground/5' />
  </div>
)

interface MarkerPDFViewerProps {
  url: string
  assignmentId?: number
  submissionId?: number
  otherControls?: React.ReactNode
  isMarkerView?: boolean
}

export default function MarkerPDFViewer({
  url,
  assignmentId,
  submissionId,
  otherControls,
  isMarkerView = true,
}: MarkerPDFViewerProps) {
  const [numPages, setNumPages] = useState<number>(0)
  const [initialAnnotations, setInitialAnnotations] = useState<Annotation[]>([])
  const [annotations, setAnnotations] = useState<Annotation[]>([])
  const { user } = useUser()
  const sidebarRef = useRef<HTMLDivElement>(null)

  const {
    selectedText,
    marginTextTop,
    marginTextBottom,
    currentPageNumber: selectionPageNumber,
    currentBoundingRect,
    handleTextSelection,
    setCurrentPageNumber,
  } = useTextSelection()

  const [draftAnnotation, setDraftAnnotation] = useState<{
    selectedText: string
    marginTextTop: string
    marginTextBottom: string
    position: { pageNumber: number; boundingRect: DOMRect }
    feedback?: string
  } | null>(null)

  const handleAnnotationDelete = async (annotationId: string) => {
    if (!assignmentId || !submissionId) return

    try {
      await DefaultService.deletePeerReviewComment(
        assignmentId,
        submissionId,
        Number(annotationId)
      )

      setAnnotations((prev) => prev.filter((a) => a.id !== annotationId))
      toast.success('Comment deleted successfully!')
    } catch (error) {
      toast.error('Failed to delete comment')
      console.error(error)
    }
  }

  const onAnnotationEdit = async (
    annotationId: string,
    newFeedback: string
  ) => {
    if (!assignmentId || !submissionId) return

    try {
      // Update marker comment
      await DefaultService.updateMarkerComment(
        assignmentId,
        submissionId,
        Number(annotationId),
        {
          marker_feedback: newFeedback,
        }
      )

      setAnnotations((prev) =>
        prev.map((a) =>
          a.id === annotationId
            ? {
                ...a,
                markerFeedback: newFeedback,
              }
            : a
        )
      )
      toast.success('Marker feedback updated!')
    } catch (error) {
      toast.error('Failed to update marker feedback')
      console.error(error)
    }
  }

  const onMarkerFeedback = async (annotationId: string, feedback: string) => {
    if (!assignmentId || !submissionId) return

    try {
      // Update marker comment
      await DefaultService.updateMarkerComment(
        assignmentId,
        submissionId,
        Number(annotationId),
        {
          marker_feedback: feedback,
        }
      )

      setAnnotations((prev) =>
        prev.map((a) =>
          a.id === annotationId
            ? {
                ...a,
                markerFeedback: feedback,
              }
            : a
        )
      )
      toast.success('Marker feedback added!')
    } catch (error) {
      toast.error('Failed to add marker feedback')
      console.error(error)
    }
  }

  const handleDraftSubmit = async () => {
    if (!draftAnnotation || !assignmentId || !submissionId || !user) return

    try {
      // Create a new annotation without AI processing
      const response = await DefaultService.createPeerReviewComment(
        assignmentId,
        submissionId,
        {
          selected_text: draftAnnotation.selectedText,
          margin_text_top: draftAnnotation.marginTextTop,
          margin_text_bottom: draftAnnotation.marginTextBottom,
          position_data: {
            pageNumber: draftAnnotation.position.pageNumber,
            boundingRect: {
              x: draftAnnotation.position.boundingRect.x,
              y: draftAnnotation.position.boundingRect.y,
              width: draftAnnotation.position.boundingRect.width,
              height: draftAnnotation.position.boundingRect.height,
            },
          },
          feedback: draftAnnotation.feedback || '',
        }
      )

      // Add the new annotation to the state
      const newAnnotation: Annotation = {
        id: response.id.toString(),
        selectedText: response.selected_text,
        marginTextTop: response.margin_text_top,
        marginTextBottom: response.margin_text_bottom,
        position: draftAnnotation.position,
        feedback: response.feedback,
        markerFeedback: '', // Markers can't add marker feedback to their own comments
        author: response.author,
        timestamp: response.created_at,
        llmFeedback: undefined, // No AI suggestions for marker comments
        llmFeedbackDismissed: true, // Mark as dismissed since we don't show AI suggestions
      }

      setAnnotations((prev) => [...prev, newAnnotation])
      setDraftAnnotation(null)
      toast.success('Marker comment created successfully!')
    } catch (error) {
      toast.error('Failed to create marker comment')
      console.error(error)
    }
  }

  useEffect(() => {
    if (!assignmentId || !submissionId) return

    const fetchComments = async () => {
      try {
        const comments = await DefaultService.getPeerReviewComments(
          assignmentId,
          submissionId
        )

        // Map comments and ensure marker feedback is visible
        const mappedComments = comments.map((comment) => ({
          id: comment.id.toString(),
          selectedText: comment.selected_text,
          feedback: comment.feedback,
          position: {
            pageNumber: comment.position_data['pageNumber'],
            boundingRect: comment.position_data['boundingRect'],
          },
          timestamp: comment.created_at,
          author: comment.author,
          marginTextTop: comment.margin_text_top,
          marginTextBottom: comment.margin_text_bottom,
          markerFeedback: comment.marker_feedback || '', // Ensure marker feedback is always a string
          llmFeedback: isMarkerView ? undefined : comment.llm_feedback, // Hide LLM feedback for markers
          llmFeedbackDismissed: isMarkerView
            ? true
            : comment.llm_feedback_dismissed, // Mark as dismissed for markers
        }))

        setInitialAnnotations(mappedComments)
      } catch (error) {
        toast.error('Failed to load peer review comments')
        console.error('Error fetching comments:', error)
      }
    }

    fetchComments()

    // Set up WebSocket for real-time updates
    const wsUrl = getWebSocketURL(assignmentId, submissionId)
    const socket = new WebSocket(wsUrl)

    socket.onopen = () => {
      console.log('WebSocket connection established')
    }

    socket.onmessage = (event) => {
      try {
        const data = JSON.parse(event.data)
        if (data.type === 'new_comment') {
          // Refresh comments when a new one is added
          fetchComments()
        }
      } catch (error) {
        console.error('Error handling WebSocket message:', error)
      }
    }

    socket.onerror = (error) => {
      console.error('WebSocket error:', error)
    }

    socket.onclose = () => {
      console.log('WebSocket connection closed')
    }

    return () => {
      socket.close()
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [assignmentId, submissionId])

  // Set annotations from initialAnnotations when they change
  useEffect(() => {
    setAnnotations(initialAnnotations)
  }, [initialAnnotations])

  const {
    renderAnnotations,
    selectedAnnotation,
    setSelectedAnnotation,
    highlightedAnnotation,
    setHighlightedAnnotation,
  } = useAnnotations(annotations, draftAnnotation, setDraftAnnotation)

  const onDocumentLoadSuccess = ({ numPages }: { numPages: number }) => {
    setNumPages(numPages)
  }

  useEffect(() => {
    if (selectedAnnotation && sidebarRef.current) {
      const element = sidebarRef.current.querySelector(
        `[data-annotation-id="${selectedAnnotation.id}"]`
      )
      if (element) {
        const container = sidebarRef.current
        const elementTop = (element as HTMLElement).offsetTop
        const containerHeight = container.clientHeight

        // Calculate the scroll position to center the element
        const targetScroll =
          elementTop - containerHeight / 2 + element.clientHeight / 2

        // Smooth scroll the sidebar
        container.scrollTo({
          top: targetScroll,
          behavior: 'smooth',
        })
      }
    }
  }, [selectedAnnotation])

  useEffect(() => {
    const handleEscKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        setSelectedAnnotation(null)
        setHighlightedAnnotation(null)
      }
    }

    document.addEventListener('keydown', handleEscKey)
    return () => {
      document.removeEventListener('keydown', handleEscKey)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  // const onDraftSubmit = async () => {
  //   if (
  //     draftAnnotation?.feedback &&
  //     assignmentId !== undefined &&
  //     submissionId !== undefined
  //   ) {
  //     const newAnnotation = {
  //       ...draftAnnotation,
  //       feedback: draftAnnotation.feedback,
  //       author: user as UserSchema,
  //     }

  //     try {
  //       const createdAnnotation = await DefaultService.createPeerReviewComment(
  //         assignmentId,
  //         submissionId,
  //         {
  //           selected_text: newAnnotation.selectedText,
  //           margin_text_top: newAnnotation.marginTextTop,
  //           margin_text_bottom: newAnnotation.marginTextBottom,
  //           position_data: newAnnotation.position,
  //           feedback: newAnnotation.feedback || '',
  //         }
  //       )

  //       const completeAnnotation = {
  //         ...newAnnotation,
  //         id: createdAnnotation.id.toString(),
  //         timestamp: createdAnnotation.created_at,
  //         author: createdAnnotation.author,
  //         llmFeedback: createdAnnotation.llm_feedback,
  //         llmFeedbackDismissed: createdAnnotation.llm_feedback_dismissed,
  //       }

  //       setAnnotations((prev) => [...prev, completeAnnotation])
  //       setSelectedAnnotation(completeAnnotation)
  //       setDraftAnnotation(null)
  //       toast.success('Marker comment created')
  //     } catch (error) {
  //       toast.error('Failed to create marker comment')
  //       console.error(error)
  //     }
  //   }
  // }

  // When text is selected, create a draft annotation
  useEffect(() => {
    if (selectedText && selectionPageNumber && currentBoundingRect) {
      setDraftAnnotation({
        selectedText,
        marginTextTop,
        marginTextBottom,
        position: {
          pageNumber: selectionPageNumber,
          boundingRect: currentBoundingRect,
        },
      })
    }
  }, [
    selectedText,
    selectionPageNumber,
    marginTextTop,
    marginTextBottom,
    currentBoundingRect,
  ])

  const debouncedHandleTextSelection = useMemo(
    () =>
      debounce(() => {
        handleTextSelection()
      }, 100),
    [handleTextSelection]
  )

  return (
    <div className='min-h-screen-5xl bg-paper'>
      <Controls url={url} annotations={annotations} isMarkerView={isMarkerView}>
        {otherControls}
      </Controls>

      <div
        className='relative flex justify-center pl-4'
        onClick={(event) => {
          if (event.target === event.currentTarget) {
            setSelectedAnnotation(null)
          }
        }}
      >
        <Document
          file={url}
          onLoadSuccess={onDocumentLoadSuccess}
          loading={<LoadingPlaceholder />}
          className={`flex w-min flex-col gap-8 rounded-md ${
            numPages > 0
              ? 'delay-500 duration-300 animate-in fade-in'
              : 'opacity-0'
          }`}
        >
          {Array.from({ length: numPages }, (_, index) => (
            <div key={`page_${index + 1}`} className='relative'>
              <PDFPage
                pageNumber={index + 1}
                width={760}
                className='overflow-hidden rounded-lg border border-border'
                onMouseUp={() => {
                  setCurrentPageNumber(index + 1)
                  debouncedHandleTextSelection()
                }}
                // eslint-disable-next-line react/no-children-prop
                children={<div>{renderAnnotations(index + 1)}</div>}
              />
            </div>
          ))}
        </Document>

        <AnnotationsSidebar
          ref={sidebarRef as React.RefObject<HTMLDivElement>}
          annotations={annotations}
          draftAnnotation={draftAnnotation}
          selectedAnnotation={selectedAnnotation}
          highlightedAnnotation={highlightedAnnotation}
          onDraftChange={setDraftAnnotation}
          onDraftCancel={() => setDraftAnnotation(null)}
          onDraftSubmit={handleDraftSubmit}
          onAnnotationSelect={setSelectedAnnotation}
          onAnnotationHighlight={setHighlightedAnnotation}
          onAnnotationDelete={handleAnnotationDelete}
          onEdit={onAnnotationEdit}
          isMarkerView={isMarkerView}
          className={
            numPages > 0
              ? 'delay-500 duration-300 animate-in fade-in'
              : 'opacity-0'
          }
          onDismissLLM={function (): void {
            throw new Error('Function not implemented.')
          }}
          onMarkerFeedback={onMarkerFeedback}
        />
      </div>
    </div>
  )
}
