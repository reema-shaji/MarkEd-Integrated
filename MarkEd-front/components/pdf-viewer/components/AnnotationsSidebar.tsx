import { UserAvatar } from '@/components/user-avatar'
import { SquarePen, Trash2, Bot, MessageCircle, Pencil } from 'lucide-react'
import { Button } from '@/components/ui/button'
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from '@/components/ui/alert-dialog'
import type { Annotation } from '../types'
import { cn } from '@/lib/utils'
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip'
import { useState, useRef, useEffect, memo, useCallback, useMemo } from 'react'
import { useUser } from '@/src/contexts/user-context'
import { useKeyboardShortcut } from '@/components/keyboard-shortcuts'
import { ShortcutKeys } from '@/components/keyboard-shortcuts'
import AboutAIFeedback from '@/components/about-ai-feedback'
import { DismissLLMDropdown } from './DismissLLMDialog'
import { throttle } from 'lodash'
import { MarkerControls } from './MarkerControls'
import { UserSchema } from '@/src/api'
import { MarkerFeedbackForm } from './MarkerFeedbackForm'

type DraftAnnotation = {
  selectedText: string
  marginTextTop: string
  marginTextBottom: string
  position: { pageNumber: number; boundingRect: DOMRect }
  feedback?: string
} | null

interface AnnotationsSidebarProps {
  annotations: Annotation[]
  draftAnnotation: DraftAnnotation
  selectedAnnotation: Annotation | null
  highlightedAnnotation: string | null
  onDraftChange: (draft: NonNullable<DraftAnnotation>) => void
  onDraftSubmit: () => void
  onDraftCancel: () => void
  onAnnotationSelect: (annotation: Annotation) => void
  onAnnotationHighlight: (id: string | null) => void
  onAnnotationDelete: (id: string) => void
  onDismissLLM: (id: string, reason: string, feedback?: string) => void
  onEdit: (id: string, newFeedback: string) => void
  onMarkerFeedback: (id: string, feedback: string) => void
  ref?: React.RefObject<HTMLDivElement>
  isMarkerView: boolean
  isReadOnly?: boolean
  className?: string
}
function DraftAnnotationCard({
  draftAnnotation,
  onDraftChange,
  onDraftCancel,
  onDraftSubmit,
}: {
  draftAnnotation: NonNullable<DraftAnnotation>
  onDraftChange: (draft: NonNullable<DraftAnnotation>) => void
  onDraftCancel: () => void
  onDraftSubmit: () => void
}) {
  useKeyboardShortcut({ key: 'Enter', cmd: true }, onDraftSubmit)
  useKeyboardShortcut({ key: 'Escape' }, onDraftCancel)

  const maxCharacterLimit = 600
  const warningThreshold = 0.9
  const currentLength = draftAnnotation.feedback?.length || 0
  const showLimit = currentLength >= maxCharacterLimit * warningThreshold

  return (
    <div className='rounded-lg border border-yellow-500 bg-yellow-50 p-4 shadow-sm'>
      <blockquote className='mb-4 border-l-2 border-muted-foreground/30 pl-2'>
        <p className='text-sm italic'>{draftAnnotation.selectedText}</p>
      </blockquote>
      <div className='relative'>
        <textarea
          className='mb-2 min-h-[100px] w-full rounded-md border border-border bg-background p-2 text-foreground'
          placeholder='Enter your feedback...'
          onChange={(e) => {
            const value = e.target.value
            if (value.length <= maxCharacterLimit) {
              onDraftChange({ ...draftAnnotation, feedback: value })
            }
          }}
          value={draftAnnotation.feedback || ''}
          autoFocus
          style={{ height: 'auto', minHeight: '100px' }}
          onInput={(e) => {
            const target = e.target as HTMLTextAreaElement
            target.style.height = 'auto'
            target.style.height = `${target.scrollHeight}px`
          }}
        />
        {showLimit && (
          <div className='absolute bottom-4 right-2 text-xs text-muted-foreground'>
            {currentLength}/{maxCharacterLimit}
          </div>
        )}
      </div>
      <div className='flex justify-end gap-2'>
        <TooltipProvider>
          <Tooltip>
            <TooltipTrigger asChild>
              <button
                className='rounded-md border border-border bg-background px-2 py-1 text-foreground'
                onClick={onDraftCancel}
              >
                Cancel
              </button>
            </TooltipTrigger>
            <TooltipContent>
              <div className='flex items-center gap-1'>
                <p>Press</p>
                <ShortcutKeys shortcut={{ key: 'Escape' }} />
              </div>
            </TooltipContent>
          </Tooltip>
        </TooltipProvider>

        <TooltipProvider>
          <Tooltip>
            <TooltipTrigger asChild>
              <button
                className='rounded-md bg-primary px-2 py-1 text-primary-foreground'
                onClick={onDraftSubmit}
              >
                Submit
              </button>
            </TooltipTrigger>
            <TooltipContent>
              <div className='flex items-center gap-1'>
                <p>Press</p>
                <ShortcutKeys shortcut={{ key: 'Enter', cmd: true }} />
              </div>
            </TooltipContent>
          </Tooltip>
        </TooltipProvider>
      </div>
    </div>
  )
}

function DeleteAnnotationDialog({ onDelete }: { onDelete: () => void }) {
  return (
    <AlertDialog>
      <AlertDialogTrigger asChild>
        <Button
          variant='ghost'
          size='icon'
          className='h-8 w-8 text-muted-foreground hover:text-destructive'
        >
          <Trash2 className='h-4 w-4' />
        </Button>
      </AlertDialogTrigger>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>Delete Annotation</AlertDialogTitle>
          <AlertDialogDescription>
            Are you sure you want to delete this annotation? This action cannot
            be undone.
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel>Cancel</AlertDialogCancel>
          <AlertDialogAction onClick={onDelete}>Delete</AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  )
}

function FeedbackSection({
  title,
  content,
  icon,
  variant = 'default',
  onDismiss,
  onEdit,
  canEdit = false,
  showEditButton = false,
  onStartEditing,
  onFinishEditing,
}: {
  title: string
  content: string
  icon: React.ReactNode
  variant?: 'default' | 'ai'
  onDismiss?: (reason: string, feedback?: string) => void
  onEdit?: (newContent: string) => void
  canEdit?: boolean
  showEditButton?: boolean
  onStartEditing: () => void
  onFinishEditing: () => void
}) {
  const [isEditing, setIsEditing] = useState(false)
  const [editedContent, setEditedContent] = useState(content)
  const textareaRef = useRef<HTMLTextAreaElement>(null)

  useEffect(() => {
    if (isEditing && textareaRef.current) {
      textareaRef.current.focus()
      textareaRef.current.style.height = 'auto'
      textareaRef.current.style.height = `${textareaRef.current.scrollHeight}px`
    }
  }, [isEditing])

  const handleEdit = () => {
    setIsEditing(true)
    onStartEditing()
  }

  const handleSave = () => {
    onEdit?.(editedContent)
    setIsEditing(false)
    onFinishEditing()
  }

  const handleCancel = () => {
    setEditedContent(content)
    setIsEditing(false)
    onFinishEditing()
  }

  useKeyboardShortcut({ key: 'Enter', cmd: true }, handleSave, isEditing)
  useKeyboardShortcut({ key: 'Escape' }, handleCancel, isEditing)

  return (
    <div
      className={cn(
        variant === 'default' && title.includes('feedback')
          ? ''
          : 'rounded-md px-3 py-2',
        variant === 'default' ? 'bg-muted/50' : 'bg-primary/10',
        title.includes('feedback') && 'bg-transparent',
        'mt-2'
      )}
    >
      <div
        className={cn(
          'mb-1 flex items-center justify-between',
          title.includes('feedback') && 'hidden'
        )}
      >
        <div className='flex items-center gap-2'>
          {icon}
          <p className='text-sm font-medium'>{title}</p>
          {variant === 'ai' && <AboutAIFeedback />}
        </div>
        <div className='flex items-center gap-1'>
          {canEdit && showEditButton && !isEditing && (
            <TooltipProvider>
              <Tooltip>
                <TooltipTrigger asChild>
                  <Button
                    variant='ghost'
                    size='icon'
                    className='h-4 w-4 flex-shrink-0'
                    onClick={handleEdit}
                  >
                    <Pencil className='h-3 w-3 text-muted-foreground hover:text-foreground' />
                  </Button>
                </TooltipTrigger>
                <TooltipContent side='left'>
                  <p>Edit feedback</p>
                </TooltipContent>
              </Tooltip>
            </TooltipProvider>
          )}
          {onDismiss && (
            <DismissLLMDropdown
              onDismiss={(reason, feedback) => {
                onDismiss(reason, feedback)
              }}
            />
          )}
        </div>
      </div>
      {isEditing ? (
        <div className='space-y-2'>
          <textarea
            ref={textareaRef}
            className='w-full resize-none rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring'
            value={editedContent}
            onChange={(e) => {
              setEditedContent(e.target.value)
              e.target.style.height = 'auto'
              e.target.style.height = `${e.target.scrollHeight}px`
            }}
          />
          <div className='flex justify-end gap-2'>
            <TooltipProvider>
              <Tooltip>
                <TooltipTrigger asChild>
                  <Button variant='ghost' size='sm' onClick={handleCancel}>
                    Cancel
                  </Button>
                </TooltipTrigger>
                <TooltipContent>
                  <div className='flex items-center gap-1'>
                    <p>Press</p>
                    <ShortcutKeys shortcut={{ key: 'Escape' }} />
                  </div>
                </TooltipContent>
              </Tooltip>
            </TooltipProvider>

            <TooltipProvider>
              <Tooltip>
                <TooltipTrigger asChild>
                  <Button size='sm' onClick={handleSave}>
                    Save
                  </Button>
                </TooltipTrigger>
                <TooltipContent>
                  <div className='flex items-center gap-1'>
                    <p>Press</p>
                    <ShortcutKeys shortcut={{ key: 'Enter', cmd: true }} />
                  </div>
                </TooltipContent>
              </Tooltip>
            </TooltipProvider>
          </div>
        </div>
      ) : (
        <div className='flex items-start justify-between gap-2'>
          <p className='whitespace-pre-line text-sm'>{content}</p>
        </div>
      )}
    </div>
  )
}

function FeedbackCount({
  annotation,
  shouldPulseAI,
  isMarkerView = false,
}: {
  annotation: Annotation
  shouldPulseAI: boolean
  isMarkerView?: boolean
}) {
  const feedbackCount = [
    ...(isMarkerView ? [] : [annotation.llmFeedback]),
    annotation.markerFeedback,
  ].filter(Boolean).length

  if (feedbackCount === 0) return null

  return (
    <div className='relative'>
      <div
        className={`absolute inline-flex h-5 w-5 animate-ping rounded-full bg-primary opacity-75 ${
          shouldPulseAI &&
          annotation.llmFeedback &&
          !annotation.llmFeedbackDismissed &&
          !isMarkerView
            ? ''
            : 'hidden'
        }`}
      />
      <div
        className={`relative flex h-5 w-5 items-center justify-center rounded-full bg-primary text-xs font-medium text-primary-foreground duration-300 animate-in fade-in zoom-in ${
          shouldPulseAI &&
          annotation.llmFeedback &&
          !annotation.llmFeedbackDismissed &&
          !isMarkerView
            ? 'border-red-300 shadow-md'
            : ''
        }`}
      >
        {feedbackCount}
      </div>
    </div>
  )
}
function AnnotationCard({
  annotation,
  isSelected,
  isHighlighted,
  onHighlight,
  onSelect,
  onDelete,
  onDismissLLM,
  onEdit,
  onMarkerFeedback,
  setIsEditing,
  shouldPulseAI = false,
  isMarkerView = false,
  isReadOnly = false,
}: {
  annotation: Annotation
  isSelected: boolean
  isHighlighted: boolean
  onHighlight: (id: string | null) => void
  onSelect: (annotation: Annotation) => void
  onDelete: (id: string) => void
  onDismissLLM: (id: string, reason: string, feedback?: string) => void
  onEdit: (id: string, newFeedback: string) => void
  onMarkerFeedback: (id: string, feedback: string) => void
  setIsEditing: (isEditing: boolean) => void
  shouldPulseAI?: boolean
  isMarkerView?: boolean
  isReadOnly?: boolean
}) {
  const { user } = useUser()
  const [isAddingMarkerFeedback, setIsAddingMarkerFeedback] = useState(false)

  const throttledHighlight = useCallback(
    throttle((id: string | null) => {
      onHighlight(id)
    }, 100),
    [onHighlight]
  )

  const getReviewerColor = (userName: string) => {
    const colors = [
      'border-red-300 bg-red-50',
      'border-blue-300 bg-blue-50',
      'border-green-300 bg-green-50',
      'border-yellow-300 bg-yellow-50',
      'border-purple-300 bg-purple-50',
      'border-pink-300 bg-pink-50',
      'border-indigo-300 bg-indigo-50',
      'border-orange-300 bg-orange-50',
    ]

    // Simple hash function to get a consistent index
    const hash = userName.split('').reduce((acc, char) => {
      return acc + char.charCodeAt(0)
    }, 0)

    const borderColor = colors[hash % colors.length].split(' ')[0]
    const bgColor = colors[hash % colors.length].split(' ')[1]

    return { borderColor, bgColor }
  }

  const { borderColor, bgColor } = getReviewerColor(
    annotation.author.userName || ''
  )

  // Check if this is a marker's own comment
  const isMarkerComment =
    annotation.author.role === 'M' ||
    annotation.author.role === 'T' ||
    annotation.author.role === 'A'
  return (
    <div
      key={annotation.id}
      data-annotation-id={annotation.id}
      className={cn(
        'group relative mb-3 overflow-hidden rounded-lg border transition-all duration-200',
        isSelected
          ? 'border-primary bg-primary/5 shadow-sm'
          : 'border-border bg-card',
        isHighlighted && !isSelected && 'ring-2 ring-primary ring-offset-2',
        !isSelected && 'opacity-80',
        `${borderColor} ${bgColor}`
      )}
      style={{
        transform: isSelected ? 'scale(1.01) translate(-6px, 3px)' : undefined,
      }}
      onClick={() => !isSelected && onSelect(annotation)}
      onMouseEnter={() => throttledHighlight(annotation.id)}
      onMouseLeave={() => throttledHighlight(null)}
    >
      <div
        className={cn(
          'p-4 transition-all duration-300',
          !isSelected && 'cursor-pointer'
        )}
      >
        <div className='mb-4 flex items-center justify-between'>
          <UserAvatar user={annotation.author} />

          <div className='flex items-center gap-2'>
            {isSelected && isMarkerComment && !isReadOnly && (
              <DeleteAnnotationDialog
                onDelete={() => onDelete(annotation.id)}
              />
            )}
            <FeedbackCount
              annotation={annotation}
              shouldPulseAI={shouldPulseAI}
              isMarkerView={isMarkerView}
            />
          </div>
        </div>

        <div>
          <blockquote className='border-l-2 border-muted-foreground/30 pl-2'>
            <p className='text-sm italic text-muted-foreground'>
              {annotation.selectedText}
            </p>
          </blockquote>
          {annotation.feedback && (
            <div className='mt-2'>
              <FeedbackSection
                title={`${annotation.author.userName}'s feedback`}
                content={annotation.feedback}
                icon={<MessageCircle className='h-4 w-4' />}
                canEdit={user?.id === annotation.author.id && !isMarkerView}
                showEditButton={isSelected}
                onEdit={(newContent) => onEdit(annotation.id, newContent)}
                onStartEditing={() => setIsEditing(true)}
                onFinishEditing={() => setIsEditing(false)}
              />
            </div>
          )}

          <div
            className={cn(
              'space-y-3 overflow-hidden transition-all duration-300',
              isSelected ? 'max-h-[500px] opacity-100' : 'max-h-0 opacity-0'
            )}
          >
            {annotation.llmFeedback && !isMarkerView && (
              <FeedbackSection
                title='AI Suggestions'
                content={annotation.llmFeedback}
                icon={<Bot className='h-4 w-4' />}
                variant='ai'
                onDismiss={(reason, feedback) =>
                  onDismissLLM(annotation.id, reason, feedback)
                }
                onStartEditing={() => setIsEditing(true)}
                onFinishEditing={() => setIsEditing(false)}
              />
            )}

            {annotation.markerFeedback && (
              <FeedbackSection
                title='Marker Feedback'
                content={annotation.markerFeedback}
                icon={<MessageCircle className='h-4 w-4' />}
                canEdit={isMarkerView}
                showEditButton={isSelected && isMarkerView}
                onEdit={(newContent) => onEdit(annotation.id, newContent)}
                onStartEditing={() => setIsEditing(true)}
                onFinishEditing={() => setIsEditing(false)}
              />
            )}

            {isMarkerView &&
              isSelected &&
              !annotation.markerFeedback &&
              !isMarkerComment && (
                <div className='mt-3'>
                  {isAddingMarkerFeedback ? (
                    <MarkerFeedbackForm
                      initialFeedback=''
                      onSubmit={(feedback) => {
                        onMarkerFeedback(annotation.id, feedback)
                        setIsAddingMarkerFeedback(false)
                      }}
                      onCancel={() => setIsAddingMarkerFeedback(false)}
                    />
                  ) : (
                    <div className='flex justify-end'>
                      <Button
                        variant='outline'
                        size='sm'
                        className='gap-1'
                        onClick={(e) => {
                          e.stopPropagation()
                          setIsAddingMarkerFeedback(true)
                        }}
                      >
                        <MessageCircle className='h-4 w-4' />
                        Add Marker Feedback
                      </Button>
                    </div>
                  )}
                </div>
              )}
          </div>
        </div>
      </div>
    </div>
  )
}
const MemoizedAnnotationCard = memo(AnnotationCard)

export function AnnotationsSidebar({
  annotations,
  draftAnnotation,
  selectedAnnotation,
  highlightedAnnotation,
  onDraftChange,
  onDraftSubmit,
  onDraftCancel,
  onAnnotationSelect,
  onAnnotationHighlight,
  onAnnotationDelete,
  onDismissLLM,
  onEdit,
  onMarkerFeedback,
  ref,
  isMarkerView,
  isReadOnly = false,
  className,
}: AnnotationsSidebarProps) {
  const [isEditing, setIsEditing] = useState(false)
  const [pulseAI, setPulseAI] = useState(false)
  const [visibleReviewers, setVisibleReviewers] = useState<Set<string>>(
    new Set()
  )

  // Extract unique reviewers from annotations
  const uniqueReviewers = useMemo(() => {
    const reviewers: UserSchema[] = []
    const reviewerIds = new Set<string>()

    annotations.forEach((annotation) => {
      if (!reviewerIds.has(annotation.author.userNumber)) {
        reviewerIds.add(annotation.author.userNumber)
        reviewers.push(annotation.author)
      }
    })

    return reviewers
  }, [annotations])

  // Initialize visible reviewers with all reviewers
  useEffect(() => {
    if (uniqueReviewers.length > 0) {
      setVisibleReviewers(new Set(uniqueReviewers.map((r) => r.userNumber)))
    }
  }, [uniqueReviewers])

  const handleToggleReviewer = (reviewerId: string) => {
    setVisibleReviewers((prev) => {
      const newSet = new Set(prev)
      if (newSet.has(reviewerId)) {
        newSet.delete(reviewerId)
      } else {
        newSet.add(reviewerId)
      }
      return newSet
    })
  }

  const isAnnotationVisible = (annotation: Annotation) => {
    return visibleReviewers.has(annotation.author.userNumber)
  }

  // Filter visible annotations
  const visibleAnnotations = annotations.filter(isAnnotationVisible)

  const sortedAnnotations = visibleAnnotations.sort((a, b) => {
    if (a.position.pageNumber !== b.position.pageNumber) {
      return a.position.pageNumber - b.position.pageNumber
    }
    return a.position.boundingRect.y - b.position.boundingRect.y
  })

  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      if (draftAnnotation || isEditing) return

      const currentIndex = selectedAnnotation
        ? sortedAnnotations.findIndex((a) => a.id === selectedAnnotation.id)
        : -1

      if (event.key === 'ArrowDown' || event.key === 'ArrowRight') {
        event.preventDefault()
        if (currentIndex === -1 && sortedAnnotations.length > 0) {
          // If no annotation is selected, select the first one
          onAnnotationSelect(sortedAnnotations[0])
        } else if (currentIndex < sortedAnnotations.length - 1) {
          // Select next annotation
          onAnnotationSelect(sortedAnnotations[currentIndex + 1])
        }
      } else if (event.key === 'ArrowUp' || event.key === 'ArrowLeft') {
        event.preventDefault()
        if (currentIndex === -1 && sortedAnnotations.length > 0) {
          // If no annotation is selected, select the last one
          onAnnotationSelect(sortedAnnotations[sortedAnnotations.length - 1])
        } else if (currentIndex > 0) {
          // Select previous annotation
          onAnnotationSelect(sortedAnnotations[currentIndex - 1])
        }
      }
    }

    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [
    sortedAnnotations,
    selectedAnnotation,
    draftAnnotation,
    isEditing,
    onAnnotationSelect,
  ])

  useEffect(() => {
    const handleHighlightUnread = () => {
      setPulseAI(true)
      setTimeout(() => setPulseAI(false), 2000)
    }

    window.addEventListener('highlightUnreadAI', handleHighlightUnread)
    return () =>
      window.removeEventListener('highlightUnreadAI', handleHighlightUnread)
  }, [])

  return (
    <div
      ref={ref}
      className={cn(
        'sticky top-20 h-[calc(100vh-5rem)] w-96 min-w-80 space-y-4 overflow-y-auto px-4 pb-6',
        className
      )}
      onClick={(event) => {
        if (event.target === event.currentTarget) {
          onAnnotationSelect(null as unknown as Annotation)
        }
      }}
    >
      {isMarkerView && uniqueReviewers.length > 0 && (
        <MarkerControls
          reviewers={uniqueReviewers}
          visibleReviewers={visibleReviewers}
          onToggleReviewer={handleToggleReviewer}
        />
      )}

      {draftAnnotation && (
        <DraftAnnotationCard
          draftAnnotation={draftAnnotation}
          onDraftChange={onDraftChange}
          onDraftCancel={onDraftCancel}
          onDraftSubmit={onDraftSubmit}
        />
      )}

      {sortedAnnotations.map((annotation) => (
        <MemoizedAnnotationCard
          key={annotation.id}
          annotation={annotation}
          isSelected={selectedAnnotation?.id === annotation.id}
          isHighlighted={highlightedAnnotation === annotation.id}
          onHighlight={onAnnotationHighlight}
          onSelect={onAnnotationSelect}
          onDelete={onAnnotationDelete}
          onDismissLLM={onDismissLLM}
          onEdit={onEdit}
          onMarkerFeedback={onMarkerFeedback}
          setIsEditing={setIsEditing}
          shouldPulseAI={pulseAI}
          isMarkerView={isMarkerView}
          isReadOnly={isReadOnly}
        />
      ))}

      {sortedAnnotations.length === 0 && draftAnnotation === null && (
        <div className='bg-foreground/2 flex h-full flex-col items-center justify-center rounded-lg p-4 text-center'>
          <SquarePen className='mb-2 h-8 w-8' />
          <h1 className='text-lg font-semibold'>
            {isMarkerView && visibleReviewers.size === 0
              ? 'No reviewers selected'
              : isReadOnly
                ? 'No feedback found'
                : 'Select text to add a comment'}
          </h1>
          <p className='px-8 text-sm text-muted-foreground'>
            {isMarkerView && visibleReviewers.size === 0
              ? 'Use the filter controls above to select reviewers'
              : isReadOnly
                ? 'There are no comments available for this submission yet.'
                : 'If you are not able to select any text, reach out to support.'}
          </p>
        </div>
      )}
    </div>
  )
}
