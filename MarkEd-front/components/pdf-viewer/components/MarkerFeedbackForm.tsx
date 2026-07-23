import { useState, useEffect, useRef } from 'react'
import { Button } from '@/components/ui/button'
import { MessageSquare } from 'lucide-react'
import { useKeyboardShortcut } from '@/components/keyboard-shortcuts'
import { ShortcutKeys } from '@/components/keyboard-shortcuts'
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip'

interface MarkerFeedbackFormProps {
  initialFeedback: string
  onSubmit: (feedback: string) => void
  onCancel: () => void
}

export function MarkerFeedbackForm({
  initialFeedback,
  onSubmit,
  onCancel,
}: MarkerFeedbackFormProps) {
  const [feedback, setFeedback] = useState(initialFeedback || '')
  const textareaRef = useRef<HTMLTextAreaElement>(null)

  useEffect(() => {
    if (textareaRef.current) {
      textareaRef.current.focus()
      textareaRef.current.style.height = 'auto'
      textareaRef.current.style.height = `${textareaRef.current.scrollHeight}px`
    }
  }, [])

  useKeyboardShortcut({ key: 'Enter', cmd: true }, () => {
    if (feedback.trim()) {
      onSubmit(feedback)
    }
  })

  useKeyboardShortcut({ key: 'Escape' }, onCancel)

  const handleTextareaChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    setFeedback(e.target.value)
    e.target.style.height = 'auto'
    e.target.style.height = `${e.target.scrollHeight}px`
  }

  return (
    <div className='rounded-md border border-border bg-card p-3 shadow-sm'>
      <div className='mb-2 flex items-center gap-2 text-sm font-medium'>
        <MessageSquare className='h-4 w-4' />
        <span>Marker Feedback</span>
      </div>

      <textarea
        ref={textareaRef}
        value={feedback}
        onChange={handleTextareaChange}
        placeholder='Add your feedback to this peer review comment...'
        className='mb-3 min-h-[80px] w-full resize-none rounded-md border border-input bg-background p-2 text-sm'
      />

      <div className='flex justify-end gap-2'>
        <TooltipProvider>
          <Tooltip>
            <TooltipTrigger asChild>
              <Button variant='outline' size='sm' onClick={onCancel}>
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
              <Button
                size='sm'
                onClick={() => onSubmit(feedback)}
                disabled={!feedback.trim()}
              >
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
  )
}
