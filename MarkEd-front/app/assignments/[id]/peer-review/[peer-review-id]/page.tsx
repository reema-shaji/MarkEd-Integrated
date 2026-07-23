'use client'
import { useParams } from 'next/navigation'
import { DefaultService, PeersLastSubmissionResponse } from '@/src/api'
import { useState, useEffect } from 'react'
import PDFViewer from '@/components/pdf-viewer/PDFViewer'
import Link from 'next/link'
import { Telescope, Users } from 'lucide-react'
import { useAssignment } from '@/src/contexts/assignment-context'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'

const PeerReviewPage = () => {
  const params = useParams()
  const { togglePeerReviewComplete, isPeerReviewComplete } = useAssignment()
  const [peerReviewSubmission, setPeerReviewSubmission] =
    useState<PeersLastSubmissionResponse | null>(null)
  const [showFirstTimeDialog, setShowFirstTimeDialog] = useState(false)

  useEffect(() => {
    const fetchPeerReviewSubmission = async () => {
      const response = await DefaultService.getPeersLastSubmission(
        Number(params['id']),
        Number(params['peer-review-id'])
      )
      setPeerReviewSubmission(response)
    }
    fetchPeerReviewSubmission()
  }, [])

  useEffect(() => {
    const hasSeenPeerReviewIntro = localStorage.getItem(
      'hasSeenPeerReviewIntro'
    )
    if (!hasSeenPeerReviewIntro) {
      setShowFirstTimeDialog(true)
    }
  }, [])

  const handleToggleCompleted = async () => {
    await togglePeerReviewComplete(
      Number(params['id']),
      Number(params['peer-review-id'])
    )
  }

  const isCompleted = isPeerReviewComplete(Number(params['peer-review-id']))

  const handleCloseDialog = () => {
    setShowFirstTimeDialog(false)
    localStorage.setItem('hasSeenPeerReviewIntro', 'true')
  }

  return (
    <>
      <Dialog open={showFirstTimeDialog} onOpenChange={() => {}}>
        <DialogContent onPointerDownOutside={(e) => e.preventDefault()}>
          <DialogHeader>
            <DialogTitle className='mb-2 flex items-center gap-2'>
              <Users className='h-5 w-5' />
              Welcome to Peer Review
            </DialogTitle>

            <DialogDescription className='space-y-4'>
              <p>
                To review your peer, add comments to their submissions by
                selecting text and providing feedback on how to improve their
                work.
              </p>
              <p>
                AI Suggestions may appear while you are adding comments to help
                you improve your feedback. Please note that they won&apos;t
                provide suggestions on the correctness of your feedback.
              </p>
              <div className='flex flex-col gap-2 rounded-md bg-muted p-3'>
                <p>
                  AI Suggestions are generated using The University of
                  Edinburgh&apos;s ELM, a gateway access to safe usage of LLMs.
                  No data from your reviews (comments, feedback, original author&apos;s text etc.) is stored or used to train AI models.
                </p>

                <p>
                  Find more on our{' '}
                  <Link href='/ai-feedback' className='underline'>
                    AI Suggestions page
                  </Link>
                  .
                </p>
              </div>
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button onClick={handleCloseDialog}>I understand</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {!peerReviewSubmission?.pre_signed_file_url ? (
        <div className='flex h-screen flex-col items-center justify-center gap-2 duration-1000 animate-in fade-in'>
          <Telescope className='h-10 w-10' />
          <h1 className='text-2xl font-semibold'>No thing to see here</h1>
          <p className='text-sm text-gray-500'>
            No submission found. Please reach out to{' '}
            <Link href='/support' className='underline'>
              support
            </Link>
          </p>
        </div>
      ) : (
        <PDFViewer
          url={peerReviewSubmission.pre_signed_file_url}
          enableAnnotations
          assignmentId={Number(params['id'])}
          submissionId={Number(params['peer-review-id'])}
          isCompleted={isCompleted}
          onToggleComplete={handleToggleCompleted}
          otherControls={
            <Button
              variant='outline'
              size='sm'
              onClick={() => setShowFirstTimeDialog(true)}
            >
              <Users className='h-4 w-4' />
              About Peer Review
            </Button>
          }
        />
      )}
    </>
  )
}

export default PeerReviewPage
