'use client'

import { Document, Page as PDFPage, pdfjs } from 'react-pdf'
import 'react-pdf/dist/Page/TextLayer.css'
import 'react-pdf/dist/Page/AnnotationLayer.css'
import { useEffect, useState, useRef } from 'react'
import Controls from './components/Controls'
import { useAnnotations } from './hooks/useAnnotations'
import { useTextSelection } from './hooks/useTextSelection'
import type { Annotation } from './types'
import { DefaultService } from '@/src/api'
import { toast } from 'sonner'
import { AnnotationsSidebar } from './components/AnnotationsSidebar'
import { getWebSocketURL } from '@/src/config/websocket'

pdfjs.GlobalWorkerOptions.workerSrc = `//unpkg.com/pdfjs-dist@${pdfjs.version}/build/pdf.worker.min.mjs`

const LoadingPlaceholder = () => (
  <div className='flex w-[760px] flex-col gap-8 duration-300 animate-in fade-in'>
    <div className='h-[1000px] animate-pulse rounded-lg border border-border bg-muted-foreground/5' />
    <div className='h-[1000px] animate-pulse rounded-lg border border-border bg-muted-foreground/5' />
  </div>
)

interface ResultsPDFViewerProps {
  url: string
  assignmentId?: number
  submissionId?: number
  otherControls?: React.ReactNode
}

export default function ResultsPDFViewer({
  url,
  assignmentId,
  submissionId,
  otherControls,
}: ResultsPDFViewerProps) {
  const [numPages, setNumPages] = useState<number>(0)
  const [initialAnnotations, setInitialAnnotations] = useState<Annotation[]>([])
  const [annotations, setAnnotations] = useState<Annotation[]>([])
  const sidebarRef = useRef<HTMLDivElement>(null)

  const { setCurrentPageNumber } = useTextSelection()

  // No draft annotation needed for results view
  const draftAnnotation = null
  const setDraftAnnotation = () => {}

  useEffect(() => {
    if (!assignmentId || !submissionId) {
      console.log('Missing required IDs:', { assignmentId, submissionId })
      return
    }

    const fetchComments = async () => {
      try {
        console.log(
          `Fetching comments for assignment ${assignmentId}, submission ${submissionId}`
        )
        const comments = await DefaultService.getPeerReviewComments(
          assignmentId,
          submissionId
        )

        console.log(
          'API returned comments:',
          comments.length ? comments : 'No comments found'
        )

        // Map comments and ensure marker feedback is visible
        // Also anonymize peer reviewer userNumber
        const mappedComments = comments.map((comment) => ({
          id: comment.id.toString(),
          selectedText: comment.selected_text,
          feedback: comment.feedback,
          position: {
            pageNumber: comment.position_data['pageNumber'],
            boundingRect: comment.position_data['boundingRect'],
          },
          timestamp: comment.created_at,
          author: {
            ...comment.author,
            // Anonymize the userNumber for privacy
            userNumber: '',
            // Change name to just "Marker" if it's a marker
            userName:
              comment.author.role === 'M' ||
              comment.author.role === 'T' ||
              comment.author.role === 'A'
                ? 'Marker'
                : comment.author.userName,
          },
          marginTextTop: comment.margin_text_top,
          marginTextBottom: comment.margin_text_bottom,
          markerFeedback: comment.marker_feedback || '', // Ensure marker feedback is always a string
          llmFeedback: undefined, // Hide LLM feedback for students
          llmFeedbackDismissed: true, // Mark as dismissed since we don't show AI suggestions
        }))

        console.log('Mapped comments:', mappedComments.length, mappedComments)
        setInitialAnnotations(mappedComments)
      } catch (error) {
        console.error('Error fetching comments:', error)
        toast.error('Failed to load feedback comments')
      }
    }

    fetchComments()

    // Set up WebSocket for real-time updates
    const wsUrl = getWebSocketURL(assignmentId, submissionId)
    console.log('Connecting to WebSocket:', wsUrl)

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
    console.log(`PDF loaded with ${numPages} pages`)
  }

  // Debugging log for annotations
  useEffect(() => {
    console.log('Current annotations in state:', annotations.length)
  }, [annotations])

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
  }, [])

  // Placeholder functions for required props but which do nothing in results view
  const handleAnnotationDelete = () => {}
  const onAnnotationEdit = () => {}
  const onDismissLLM = () => {}
  const onMarkerFeedback = () => {}
  const handleDraftSubmit = () => {}

  return (
    <div className='min-h-screen-5xl bg-muted'>
      <Controls
        url={url}
        annotations={annotations}
        isMarkerView={false}
        isReadOnly={true}
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
                onMouseUp={() => {
                  setCurrentPageNumber(index + 1)
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
          onDraftCancel={() => {}}
          onDraftSubmit={handleDraftSubmit}
          onAnnotationSelect={setSelectedAnnotation}
          onAnnotationHighlight={setHighlightedAnnotation}
          onAnnotationDelete={handleAnnotationDelete}
          onEdit={onAnnotationEdit}
          isMarkerView={false}
          isReadOnly={true}
          className={
            numPages > 0
              ? 'delay-500 duration-300 animate-in fade-in'
              : 'opacity-0'
          }
          onDismissLLM={onDismissLLM}
          onMarkerFeedback={onMarkerFeedback}
        />
      </div>
    </div>
  )
}
