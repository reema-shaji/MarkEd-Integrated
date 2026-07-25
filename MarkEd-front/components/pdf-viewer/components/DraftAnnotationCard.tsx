import { useKeyboardShortcut } from '@/components/keyboard-shortcuts'
import { ShortcutKeys } from '@/components/keyboard-shortcuts'
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip'
import { Button } from '@/components/ui/button'

type DraftAnnotation = {
  selectedText: string
  marginTextTop: string
  marginTextBottom: string
  position: { pageNumber: number; boundingRect: DOMRect }
  feedback?: string
}

interface DraftAnnotationCardProps {
  draftAnnotation: DraftAnnotation
  onDraftChange: (draft: DraftAnnotation) => void
  onDraftCancel: () => void
  onDraftSubmit: () => void
}

export function DraftAnnotationCard({
  draftAnnotation,
  onDraftChange,
  onDraftCancel,
  onDraftSubmit,
}: DraftAnnotationCardProps) {
  useKeyboardShortcut({ key: 'Enter', cmd: true }, onDraftSubmit)
  useKeyboardShortcut({ key: 'Escape' }, onDraftCancel)

  const maxCharacterLimit = 600
  const warningThreshold = 0.9
  const currentLength = draftAnnotation.feedback?.length || 0
  const showLimit = currentLength >= maxCharacterLimit * warningThreshold

  return (
    <div className='mb-4 rounded-[12px] border-2 border-[#C9A24A] bg-[#FBF4E3] p-[14px] shadow-sm'>
      <blockquote className='mb-4 border-l-2 border-[#C9A24A] pl-2.5'>
        <p className='text-[12px] italic leading-[1.5] text-muted2'>
          {draftAnnotation.selectedText}
        </p>
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
              <Button variant='outline' size='sm' onClick={onDraftCancel}>
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
                onClick={onDraftSubmit}
                disabled={!draftAnnotation.feedback?.trim()}
              >
                Submit
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
