import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuLabel,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { Button } from '@/components/ui/button'
import { Textarea } from '@/components/ui/textarea'
import { useState } from 'react'
import {
  Check,
  ThumbsDown,
  CircleSlash,
  MessageSquareX,
  CheckCheck,
} from 'lucide-react'
import {
  TooltipProvider,
  Tooltip,
  TooltipTrigger,
  TooltipContent,
} from '@/components/ui/tooltip'
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'

const DISMISS_REASONS = [
  {
    value: 'IMPLEMENTED',
    label: "I've incorporated these changes",
    icon: CheckCheck,
    description: 'Suggestions have been applied to my feedback',
  },
  {
    value: 'CORRECT',
    label: 'Valid suggestions, but not incorporating',
    icon: Check,
    description: 'Keeping my original feedback as is',
  },
  {
    value: 'INCORRECT',
    label: "Suggestions don't fit my feedback",
    icon: CircleSlash,
    description: 'Not relevant or suitable for this context',
  },
  {
    value: 'DISAGREE',
    label: 'Taking a different approach',
    icon: ThumbsDown,
    description: 'Choosing to maintain my original perspective',
  },
  {
    value: 'OTHER',
    label: 'Other reason',
    icon: MessageSquareX,
    description: 'Provide a custom explanation',
  },
]

interface DismissLLMDropdownProps {
  onDismiss: (reason: string, feedback?: string) => void
}

export function DismissLLMDropdown({ onDismiss }: DismissLLMDropdownProps) {
  const [showDialog, setShowDialog] = useState(false)
  const [feedback, setFeedback] = useState('')
  const [isOpen, setIsOpen] = useState(false)

  const handleSelect = (reason: string) => {
    if (reason === 'OTHER') {
      setShowDialog(true)
      setIsOpen(false)
    } else {
      onDismiss(reason)
      setIsOpen(false)
      setFeedback('')
    }
  }

  const handleSubmitOther = () => {
    onDismiss('OTHER', feedback)
    setShowDialog(false)
    setFeedback('')
  }

  return (
    <>
      <DropdownMenu open={isOpen} onOpenChange={setIsOpen}>
        <TooltipProvider>
          <Tooltip>
            <TooltipTrigger asChild>
              <DropdownMenuTrigger asChild>
                <Button variant='ghost' size='icon' className='h-6 w-6'>
                  <Check className='h-4 w-4' />
                </Button>
              </DropdownMenuTrigger>
            </TooltipTrigger>
            <TooltipContent side='left'>
              <p>Mark as resolved</p>
            </TooltipContent>
          </Tooltip>
        </TooltipProvider>
        <DropdownMenuContent align='end' className='w-[280px]'>
          <DropdownMenuLabel>Why are you resolving this?</DropdownMenuLabel>
          <DropdownMenuSeparator />
          <DropdownMenuGroup>
            {DISMISS_REASONS.map((reason) => (
              <DropdownMenuItem
                key={reason.value}
                onClick={() => handleSelect(reason.value)}
                className='flex items-center gap-2 px-3 py-2 cursor-pointer'
              >
                <reason.icon className='h-4 w-4 text-muted-foreground' />
                <div className='flex flex-col'>
                  <span className='text-sm font-medium'>{reason.label}</span>
                  <span className='text-xs text-muted-foreground'>
                    {reason.description}
                  </span>
                </div>
              </DropdownMenuItem>
            ))}
          </DropdownMenuGroup>
        </DropdownMenuContent>
      </DropdownMenu>

      <Dialog open={showDialog} onOpenChange={setShowDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Provide Feedback</DialogTitle>
          </DialogHeader>
          <Textarea
            placeholder='Please provide more details...'
            value={feedback}
            onChange={(e) => setFeedback(e.target.value)}
            className='min-h-[100px]'
          />
          <DialogFooter>
            <Button
              variant='outline'
              onClick={() => {
                setShowDialog(false)
                setFeedback('')
              }}
            >
              Cancel
            </Button>
            <Button onClick={handleSubmitOther} disabled={!feedback.trim()}>
              Submit
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  )
}
