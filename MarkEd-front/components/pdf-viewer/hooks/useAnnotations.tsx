import { useState, useCallback, useEffect, memo, useRef } from 'react'
import type { Annotation } from '../types'
import { ReactElement } from 'react'
import { useUser } from '@/src/contexts/user-context'
import { UserSchema } from '@/src/api'
import { cn } from '@/lib/utils'

// Function to generate a consistent color based on the reviewer's userNumber
const getReviewerColor = (userNumber: string) => {
  const colors = [
    { borderColor: 'border-red-500', bgColor: 'bg-red-200' },
    { borderColor: 'border-blue-500', bgColor: 'bg-blue-200' },
    { borderColor: 'border-green-500', bgColor: 'bg-green-200' },
    { borderColor: 'border-yellow-500', bgColor: 'bg-yellow-200' },
    { borderColor: 'border-purple-500', bgColor: 'bg-purple-200' },
    { borderColor: 'border-pink-500', bgColor: 'bg-pink-200' },
    { borderColor: 'border-indigo-500', bgColor: 'bg-indigo-200' },
    { borderColor: 'border-orange-500', bgColor: 'bg-orange-200' },
  ]

  // Simple hash function to get a consistent index
  const hash = userNumber.split('').reduce((acc, char) => {
    return acc + char.charCodeAt(0)
  }, 0)

  return colors[hash % colors.length]
}

export function useAnnotations(
  currentAnnotations: Annotation[],
  draftAnnotation: {
    selectedText: string
    marginTextTop: string
    marginTextBottom: string
    position: { pageNumber: number; boundingRect: DOMRect }
    feedback?: string
  } | null,
  setDraftAnnotation: React.Dispatch<
    React.SetStateAction<{
      selectedText: string
      marginTextTop: string
      marginTextBottom: string
      position: { pageNumber: number; boundingRect: DOMRect }
      feedback?: string
    } | null>
  >,
  onAnnotationDelete?: (annotationId: string) => void
) {
  const [annotations, setAnnotations] =
    useState<Annotation[]>(currentAnnotations)
  const annotationsRef = useRef(currentAnnotations)

  // Keep annotations in sync with parent
  useEffect(() => {
    if (
      JSON.stringify(annotationsRef.current) !==
      JSON.stringify(currentAnnotations)
    ) {
      annotationsRef.current = currentAnnotations
      setAnnotations(currentAnnotations)
    }
  }, [currentAnnotations])

  const { user } = useUser()
  const [selectedAnnotation, setSelectedAnnotation] =
    useState<Annotation | null>(null)
  const [highlightedAnnotation, setHighlightedAnnotation] = useState<
    string | null
  >(null)

  const setSelectedAnnotationById = useCallback(
    (annotationId: string) => {
      setSelectedAnnotation(
        annotations.find((a) => a.id === annotationId) || null
      )
    },
    [annotations]
  )

  const handleAnnotationSubmit = useCallback(
    (annotation: Omit<Annotation, 'timestamp' | 'userId'>) => {
      const newAnnotation: Annotation = {
        ...annotation,
        timestamp: new Date().toISOString(),
        author: user as UserSchema,
      }

      setAnnotations((prev) => [...prev, newAnnotation]) // Add the new annotation to local state
    },
    [user]
  )

  const handleAnnotationClick = useCallback((annotation: Annotation) => {
    setSelectedAnnotation(annotation)
  }, [])

  const handleAnnotationDelete = useCallback(
    (annotationId: string) => {
      setAnnotations((prev) => prev.filter((a) => a.id !== annotationId))
      setSelectedAnnotation(null)
      onAnnotationDelete?.(annotationId)
    },
    [onAnnotationDelete]
  )

  const renderAnnotations = useCallback(
    (pageNumber: number): (ReactElement | null)[] => {
      const pageElement = document.querySelector(
        `[data-page-number="${pageNumber}"]`
      ) as HTMLElement
      const pageRect = pageElement?.getBoundingClientRect()

      if (!pageElement || !pageRect) return []

      const existingAnnotations = annotations
        .filter((annotation) => annotation.position.pageNumber === pageNumber)
        .map((annotation) => {
          const isHighlighted =
            highlightedAnnotation === annotation.id ||
            selectedAnnotation?.id === annotation.id

          const highlightStyles = {
            left: `${annotation.position.boundingRect.left}px`,
            top: `${annotation.position.boundingRect.top}px`,
            width: `${annotation.position.boundingRect.width}px`,
            height: `${annotation.position.boundingRect.height}px`,
          }

          return (
            <AnnotationHighlight
              key={`highlight-${annotation.id}`}
              annotation={annotation}
              isHighlighted={isHighlighted}
              style={highlightStyles}
              onAnnotationClick={handleAnnotationClick}
              onHighlight={setHighlightedAnnotation}
            />
          )
        })

      const draftHighlight = (
        draftAnnotation: {
          selectedText: string
          marginTextTop: string
          marginTextBottom: string
          position: { pageNumber: number; boundingRect: DOMRect }
          feedback?: string
        } | null
      ) => {
        if (
          !draftAnnotation ||
          draftAnnotation.position.pageNumber !== pageNumber
        ) {
          return null
        }

        const pageElement = document.querySelector(
          `[data-page-number="${pageNumber}"]`
        ) as HTMLElement
        const pageRect = pageElement?.getBoundingClientRect()

        if (!pageElement || !pageRect) return null

        return (
          <div
            key='draft-highlight'
            className='z-8 pointer-events-none absolute animate-pulse-strong rounded-sm border-2 border-yellow-500 bg-yellow-200 mix-blend-multiply'
            style={{
              left: `${draftAnnotation.position.boundingRect.left}px`,
              top: `${draftAnnotation.position.boundingRect.top}px`,
              width: `${draftAnnotation.position.boundingRect.width}px`,
              height: `${draftAnnotation.position.boundingRect.height}px`,
            }}
          />
        )
      }

      return [...existingAnnotations, draftHighlight(draftAnnotation)]
    },
    [
      annotations,
      highlightedAnnotation,
      selectedAnnotation,
      draftAnnotation,
      handleAnnotationClick,
    ]
  )

  const updateAnnotation = useCallback(
    (annotationId: string, updates: Partial<Annotation>) => {
      setAnnotations((prev) =>
        prev.map((a) => (a.id === annotationId ? { ...a, ...updates } : a))
      )
    },
    []
  )

  return {
    annotations,
    handleAnnotationSubmit,
    renderAnnotations,
    selectedAnnotation,
    setSelectedAnnotation,
    setSelectedAnnotationById,
    handleAnnotationDelete,
    highlightedAnnotation,
    setHighlightedAnnotation,
    draftAnnotation,
    setDraftAnnotation,
    updateAnnotation,
  } as const
}

const AnnotationHighlight = memo(
  ({
    annotation,
    isHighlighted,
    style,
    onAnnotationClick,
    onHighlight,
  }: {
    annotation: Annotation
    isHighlighted: boolean
    style: React.CSSProperties
    onAnnotationClick: (annotation: Annotation) => void
    onHighlight: (id: string | null) => void
    isMarkerView?: boolean
  }) => {
    const { borderColor, bgColor } = getReviewerColor(
      annotation.author.userName
    )

    return (
      <div
        className={cn(
          'z-8 pointer-events-none absolute rounded-sm border-2 mix-blend-multiply transition-all duration-200 hover:pointer-events-auto',
          isHighlighted ? 'opacity-75' : 'opacity-30',
          borderColor,
          bgColor
        )}
        style={style}
        onClick={() => onAnnotationClick(annotation)}
        onMouseEnter={() => onHighlight(annotation.id)}
        onMouseLeave={() => onHighlight(null)}
      />
    )
  }
)

AnnotationHighlight.displayName = 'AnnotationHighlight'
