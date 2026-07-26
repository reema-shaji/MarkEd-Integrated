'use client'

import * as React from 'react'
import { ExternalLink, CheckCircle, Copy } from 'lucide-react'
import ConfettiBoom from 'react-confetti-boom'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Separator } from '@/components/ui/separator'
import { toast } from 'sonner'
import { PeerReviewSchema } from '@/src/api'
import { useUser } from '@/src/contexts/user-context'

type PeerReview = {
  id: number
  submission_id: number
  status: PeerReviewSchema['status']
  student_name: string
}

interface SurveyDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  peerReviews: PeerReview[]
  prefersReducedMotion: boolean
}

export function SurveyDialog({
  open,
  onOpenChange,
  peerReviews,
  prefersReducedMotion,
}: SurveyDialogProps) {
  const { user } = useUser()
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        {open && !prefersReducedMotion && (
          <div className='absolute -left-24 -top-24'>
            <ConfettiBoom effectInterval={50} x={0.2} y={0.2} />
          </div>
        )}

        <DialogHeader>
          <DialogTitle className='flex items-center gap-2 text-xl'>
            🎉 Congratulations!
          </DialogTitle>
          <DialogDescription asChild>
            <div className='space-y-4 text-sm text-muted-foreground'>
            <p className='text-lg font-medium'>
              You&apos;ve completed your assignment! Well done!
            </p>
            <div className='space-y-2 rounded-lg bg-muted p-4'>
              <p className='flex items-center gap-2'>
                <CheckCircle className='h-4 w-4 text-green-500' /> Submitted
                work
              </p>
              {peerReviews.map((review) => (
                <p key={review.id} className='flex items-center gap-2'>
                  <CheckCircle className='h-4 w-4 text-green-500' /> Peer
                  Reviewed work by {review.student_name}
                </p>
              ))}
            </div>
            <p>
              Soon you will receive feedback from other peers and markers on
              your work.
            </p>
            <Separator />
            <p>
              In the meantime, we would love to hear about your experience with
              MarkEd to improve the experience for future students. You will
              receive a bonus point for completing the survey.
            </p>
            <p>
              Your MarkEd username is:{' '}
              <span
                className='inline-flex cursor-pointer items-center gap-1 rounded-md bg-muted px-1 py-0.5 font-mono text-muted-foreground transition-transform duration-100 active:scale-95'
                onClick={() => {
                  navigator.clipboard.writeText(user?.userNumber || '')
                  toast.success(
                    `Copied username '${user?.userNumber}' to clipboard`
                  )
                }}
              >
                {user?.userNumber}
                <Copy className='h-3 w-3 align-middle' />
              </span>
            </p>
            </div>
          </DialogDescription>
        </DialogHeader>

        <DialogFooter className='mt-2 flex gap-2'>
          <Button variant='outline' onClick={() => onOpenChange(false)}>
            Maybe later
          </Button>
          <Button
            onClick={() => {
              window.open(
                process.env.NEXT_PUBLIC_PEER_REVIEW_SURVEY_URL,
                '_blank'
              )
              onOpenChange(false)
            }}
            className='relative'
          >
            <ExternalLink className='h-4 w-4' />
            Fill out questionnaire
            <div className='absolute -right-3 -top-3 flex items-center gap-2 rounded-full bg-[#4A4C82] px-1.5 py-[0.2rem] text-xs'>
              +1% BONUS MARK
            </div>
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
