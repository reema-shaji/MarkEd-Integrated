import {
  MessageCircle,
  Bot,
  CheckCircle2,
  XCircle,
  ExternalLinkIcon,
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Separator } from '@/components/ui/separator'
import AboutAIFeedback from '@/components/about-ai-feedback'
import { Annotation } from '../types'
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip'
import { toast } from 'sonner'

interface ControlsProps {
  url: string
  annotations?: Annotation[]
  isCompleted?: boolean
  onToggleComplete?: () => void
  children?: React.ReactNode
  isMarkerView?: boolean
  isReadOnly?: boolean
}

export default function Controls({
  url,
  annotations,
  isCompleted,
  onToggleComplete,
  children,
  isMarkerView = false,
  isReadOnly = false,
}: ControlsProps) {
  const totalAnnotations = annotations?.length || 0
  const llmFeedbackCount = isMarkerView
    ? 0
    : annotations?.filter((a) => a.llmFeedback).length || 0
  const unreadLLMFeedbackCount = isMarkerView
    ? 0
    : annotations?.filter((a) => a.llmFeedback && !a.llmFeedbackDismissed)
        .length || 0

  const handleComplete = () => {
    if (unreadLLMFeedbackCount > 0) {
      toast.error('Resolve all AI Suggestions before marking as complete')
      const event = new CustomEvent('highlightUnreadAI')
      window.dispatchEvent(event)
      return
    }
    onToggleComplete?.()
  }

  return (
    <div className='sticky top-0 z-10 mb-4 w-full border-b border-line bg-white'>
      <div className='flex h-14 items-center justify-between px-4'>
        <div className='flex items-center gap-6'>
          {/* Statistics */}
          <div className='flex items-center gap-4'>
            {totalAnnotations > 0 && (
              <>
                <div className='flex items-center gap-2'>
                  <MessageCircle className='h-4 w-4 text-faint' />
                  <span className='text-[13px] font-medium text-[#454C5C]'>
                    {totalAnnotations} annotation
                    {totalAnnotations !== 1 ? 's' : ''}
                  </span>
                </div>

                {!isMarkerView && !isReadOnly && llmFeedbackCount > 0 && (
                  <>
                    <Separator orientation='vertical' className='h-4 bg-line' />

                    <div className='flex items-center gap-2'>
                      <Bot className='h-4 w-4 text-faint' />
                      <span className='text-[13px] font-medium text-[#454C5C]'>
                        AI Suggestions
                        {unreadLLMFeedbackCount > 0 && (
                          <span className='ml-1 inline-flex h-5 w-5 items-center justify-center rounded-full bg-primary text-xs font-medium text-primary-foreground'>
                            {unreadLLMFeedbackCount}
                          </span>
                        )}
                      </span>
                      <AboutAIFeedback />
                    </div>
                  </>
                )}
              </>
            )}
          </div>
        </div>

        <div className='flex items-center gap-2'>
          {children}

          <Button variant='outline' size='sm' className='gap-2' asChild>
            <a href={url} target='_blank' rel='noopener noreferrer'>
              <ExternalLinkIcon className='h-4 w-4' />
              Open Original
            </a>
          </Button>

          {!isReadOnly &&
            onToggleComplete &&
            (isCompleted ? (
              <Button
                variant='outline'
                size='sm'
                className='gap-2'
                onClick={onToggleComplete}
              >
                <XCircle className='h-4 w-4' />
                Mark as Incomplete
              </Button>
            ) : (
              <TooltipProvider>
                <Tooltip>
                  <TooltipTrigger asChild>
                    <Button
                      variant='default'
                      size='sm'
                      className={`${unreadLLMFeedbackCount > 0 ? 'opacity-50' : ''} gap-2`}
                      onClick={handleComplete}
                    >
                      <CheckCircle2 className='h-4 w-4' />
                      Mark as Complete
                    </Button>
                  </TooltipTrigger>
                  {unreadLLMFeedbackCount > 0 && (
                    <TooltipContent>
                      <div className='flex items-center gap-2'>
                        Resolve all{' '}
                        <Bot className='h-4 w-4 text-muted-foreground' />
                        <span className='text-sm text-muted-foreground'>
                          AI Suggestions
                          {unreadLLMFeedbackCount > 0 && (
                            <span className='ml-1 inline-flex h-5 w-5 items-center justify-center rounded-full bg-primary text-xs font-medium text-primary-foreground'>
                              {unreadLLMFeedbackCount}
                            </span>
                          )}
                        </span>
                      </div>
                    </TooltipContent>
                  )}
                </Tooltip>
              </TooltipProvider>
            ))}
        </div>
      </div>
    </div>
  )
}
