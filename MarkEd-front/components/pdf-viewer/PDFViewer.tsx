'use client'
import { Document, Page as PDFPage, pdfjs } from 'react-pdf'
import 'react-pdf/dist/Page/TextLayer.css'
import 'react-pdf/dist/Page/AnnotationLayer.css'
import { useEffect, useState, useRef, useMemo } from 'react'
import Controls from './components/Controls'
import { useAnnotations } from './hooks/useAnnotations'
import { useTextSelection } from './hooks/useTextSelection'
import type { Annotation, PDFViewerProps } from './types'
import { DefaultService, UserSchema } from '@/src/api'
import { toast } from 'sonner'
import { useUser } from '@/src/contexts/user-context'
import { AnnotationsSidebar } from './components/AnnotationsSidebar'
import { getWebSocketURL } from '@/src/config/websocket'
import { debounce } from 'lodash'

// Serve the worker same-origin from /public (pinned to react-pdf's own pdfjs
// build) — a cross-origin CDN module worker fails in the browser.
pdfjs.GlobalWorkerOptions.workerSrc = `${process.env.NEXT_PUBLIC_BASE_PATH || ''}/pdf.worker.min.mjs`

const MAX_ANNOTATION_TEXT_LENGTH = 500

const LoadingPlaceholder = () => (
  <div className='flex w-[760px] flex-col gap-8 duration-300 animate-in fade-in'>
    <div className='h-[1000px] animate-pulse rounded-lg border border-border bg-muted-foreground/5' />
    <div className='h-[1000px] animate-pulse rounded-lg border border-border bg-muted-foreground/5' />
  </div>
)

export default function PDFViewer({
  url,
  enableAnnotations = false,
  assignmentId,
  submissionId,
  otherControls,
  isCompleted,
  onToggleComplete,
  isMarkerView = false,
}: PDFViewerProps) {
  const [numPages, setNumPages] = useState<number>(0)
  const [initialAnnotations, setInitialAnnotations] = useState<Annotation[]>([])
  const [annotations, setAnnotations] = useState<Annotation[]>([])
  const { user } = useUser()

  const [draftAnnotation, setDraftAnnotation] = useState<{
    selectedText: string
    marginTextTop: string
    marginTextBottom: string
    position: { pageNumber: number; boundingRect: DOMRect }
    feedback?: string
  } | null>(null)

  const onAnnotationDelete = async (annotationId: string) => {
    if (!assignmentId || !submissionId) {
      toast.error(
        'Assignment ID and submission ID are required for annotations'
      )
      return
    }
    await DefaultService.deletePeerReviewComment(
      assignmentId,
      submissionId,
      Number(annotationId)
    )
    setAnnotations((prev) => prev.filter((a) => a.id !== annotationId))
    toast.success('Annotation deleted')
  }

  const {
    renderAnnotations,
    selectedAnnotation,
    setSelectedAnnotation,
    handleAnnotationDelete,
    highlightedAnnotation,
    setHighlightedAnnotation,
  } = useAnnotations(
    annotations,
    draftAnnotation,
    setDraftAnnotation,
    onAnnotationDelete
  )

  const onDismissLLM = async (
    annotationId: string,
    reason: string,
    feedback?: string
  ) => {
    if (!assignmentId || !submissionId) {
      toast.error(
        'Assignment ID and submission ID are required for annotations'
      )
      return
    }
    try {
      // I have no clue why the auto-geernated name is not just DismissLlmFeedback() ????
      const response = await DefaultService.dismissLlmFeedback(
        assignmentId,
        submissionId,
        Number(annotationId),
        {
          dismiss_reason: reason,
          user_feedback: feedback,
        }
      )
      if (response.success) {
        setAnnotations((prev) =>
          prev.map((a) =>
            a.id === annotationId
              ? { ...a, llmFeedback: undefined, llmFeedbackDismissed: true }
              : a
          )
        )
        toast.success('LLM feedback dismissed')
      } else {
        toast.error(response.message)
      }
    } catch (error) {
      toast.error('Failed to dismiss LLM feedback')
      console.error(error)
    }
  }

  const onAnnotationEdit = async (
    annotationId: string,
    newFeedback: string,
    isMarkerComment = false
  ) => {
    if (!assignmentId || !submissionId) {
      toast.error(
        'Assignment ID and submission ID are required for annotations'
      )
      return
    }
    try {
      if (isMarkerComment) {
        await DefaultService.updateMarkerComment(
          assignmentId,
          submissionId,
          Number(annotationId),
          { marker_feedback: newFeedback }
        )
      } else {
        await DefaultService.updatePeerReviewComment(
          assignmentId,
          submissionId,
          Number(annotationId),
          {
            selected_text:
              annotations.find((a) => a.id === annotationId)?.selectedText ||
              '',
            feedback: newFeedback,
            margin_text_top: '',
            margin_text_bottom: '',
            position_data: {},
          }
        )
      }

      setAnnotations((prev) =>
        prev.map((a) =>
          a.id === annotationId
            ? {
                ...a,
                feedback: isMarkerComment ? a.feedback : newFeedback,
                markerFeedback: isMarkerComment
                  ? newFeedback
                  : a.markerFeedback,
                llmFeedback: isMarkerComment ? a.llmFeedback : undefined,
                llmFeedbackDismissed: isMarkerComment
                  ? a.llmFeedbackDismissed
                  : false,
              }
            : a
        )
      )
      toast.success('Comment updated!')
    } catch (error) {
      toast.error('Failed to update comment')
      console.error(error)
    }
  }

  useEffect(() => {
    if (!enableAnnotations || !assignmentId || !submissionId) return

    const fetchComments = async () => {
      const comments = await DefaultService.getPeerReviewComments(
        assignmentId,
        submissionId
      )
      setInitialAnnotations(
        comments.map((comment) => ({
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
          markerFeedback: comment.marker_feedback,
          llmFeedback: comment.llm_feedback,
          llmFeedbackDismissed: comment.llm_feedback_dismissed,
        }))
      )
    }

    fetchComments()

    const wsUrl = getWebSocketURL(assignmentId, submissionId)
    const socket = new WebSocket(wsUrl)

    socket.onopen = () => {
      console.log('WebSocket connection established')
    }

    socket.onmessage = (event) => {
      try {
        const data = JSON.parse(event.data)
        if (data.type === 'llm_feedback_update') {
          const { comment_id, llm_feedback } = data
          setAnnotations((prevAnnotations) =>
            prevAnnotations.map((a) =>
              a.id === comment_id.toString()
                ? {
                    ...a,
                    llmFeedback: llm_feedback,
                    llmFeedbackDismissed: false,
                  }
                : a
            )
          )
          toast.success('LLM feedback updated')
        }
      } catch (error) {
        console.error('Error parsing WebSocket message:', error)
      }
    }

    socket.onerror = (error) => {
      console.error('WebSocket error:', error)
    }

    socket.onclose = () => {
      console.log('WebSocket connection closed')
    }

    // Clean up on unmount or when dependencies change
    return () => {
      socket.close()
    }
  }, [enableAnnotations, assignmentId, submissionId])

  useEffect(() => {
    setAnnotations(initialAnnotations)
  }, [initialAnnotations])

  const {
    selectedText,
    marginTextTop,
    marginTextBottom,
    currentPageNumber,
    currentBoundingRect,
    handleTextSelection,
    setCurrentPageNumber,
  } = useTextSelection()

  useEffect(() => {
    if (selectedText && currentBoundingRect && currentPageNumber) {
      if (selectedText.length > MAX_ANNOTATION_TEXT_LENGTH) {
        toast.error(`Select less than ${MAX_ANNOTATION_TEXT_LENGTH} characters`)
        return
      }
      setSelectedAnnotation(null)
      setDraftAnnotation({
        selectedText,
        marginTextTop,
        marginTextBottom,
        position: {
          pageNumber: currentPageNumber,
          boundingRect: currentBoundingRect,
        },
      })
    }
  }, [
    selectedText,
    marginTextTop,
    marginTextBottom,
    currentPageNumber,
    currentBoundingRect,
    setSelectedAnnotation,
  ])

  function onDocumentLoadSuccess({ numPages }: { numPages: number }) {
    setNumPages(numPages)
    // The following line is to force re-render the annotations when the document is loaded. They are not re-rendered otherwise.
    setInitialAnnotations((prevAnnotations) => [...prevAnnotations])
  }

  // Add ref for the sidebar
  const sidebarRef = useRef<HTMLDivElement>(null)

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

  const onDraftSubmit = async () => {
    if (draftAnnotation?.feedback) {
      const newAnnotation = {
        ...draftAnnotation,
        feedback: draftAnnotation.feedback,
        author: user as UserSchema,
      }

      try {
        const createdAnnotation = await DefaultService.createPeerReviewComment(
          Number(assignmentId),
          Number(submissionId),
          {
            selected_text: newAnnotation.selectedText,
            margin_text_top: newAnnotation.marginTextTop,
            margin_text_bottom: newAnnotation.marginTextBottom,
            position_data: newAnnotation.position,
            feedback: newAnnotation.feedback || '',
          }
        )

        const completeAnnotation = {
          ...newAnnotation,
          id: createdAnnotation.id.toString(),
          timestamp: createdAnnotation.created_at,
          author: createdAnnotation.author,
          llmFeedback: createdAnnotation.llm_feedback,
          llmFeedbackDismissed: createdAnnotation.llm_feedback_dismissed,
        }

        setAnnotations((prev) => [...prev, completeAnnotation])
        setSelectedAnnotation(completeAnnotation)
        setDraftAnnotation(null)
        toast.success('Annotation created')
      } catch (error) {
        toast.error('Failed to create annotation')
        console.error(error)
      }
    }
  }

  const debouncedHandleTextSelection = useMemo(
    () =>
      debounce(() => {
        handleTextSelection()
      }, 100),
    [handleTextSelection]
  )

  return (
    <div className='min-h-screen-5xl bg-paper'>
      <Controls
        url={url}
        annotations={annotations}
        isCompleted={isCompleted}
        onToggleComplete={onToggleComplete}
      >
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
                onMouseUp={
                  enableAnnotations
                    ? () => {
                        setCurrentPageNumber(index + 1)
                        debouncedHandleTextSelection()
                      }
                    : undefined
                }
                // eslint-disable-next-line react/no-children-prop
                children={
                  <div>{enableAnnotations && renderAnnotations(index + 1)}</div>
                }
              />
            </div>
          ))}
        </Document>

        {enableAnnotations && (
          <AnnotationsSidebar
            ref={sidebarRef as React.RefObject<HTMLDivElement>}
            annotations={annotations}
            draftAnnotation={draftAnnotation}
            selectedAnnotation={selectedAnnotation}
            highlightedAnnotation={highlightedAnnotation}
            onDraftChange={setDraftAnnotation}
            onDraftCancel={() => setDraftAnnotation(null)}
            onDraftSubmit={onDraftSubmit}
            onAnnotationSelect={setSelectedAnnotation}
            onAnnotationHighlight={setHighlightedAnnotation}
            onAnnotationDelete={handleAnnotationDelete}
            onDismissLLM={onDismissLLM}
            onEdit={onAnnotationEdit}
            isMarkerView={isMarkerView}
            className={
              numPages > 0
                ? 'delay-500 duration-300 animate-in fade-in'
                : 'opacity-0'
            }
            onMarkerFeedback={() => {}}
          />
        )}
      </div>
    </div>
  )
}
