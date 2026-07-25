'use client'
import { useParams } from 'next/navigation'
import { DefaultService, PeersLastSubmissionResponse } from '@/src/api'
import { useState, useEffect } from 'react'
import dynamic from 'next/dynamic'
// Load the PDF viewer client-side only: it evaluates pdfjs at module scope,
// which throws during server-side rendering ("Object.defineProperty on
// non-object"). ssr:false keeps it off the server.
const ResultsPDFViewer = dynamic(
  () => import('@/components/pdf-viewer/ResultsPDFViewer'),
  { ssr: false }
)
import Link from 'next/link'
import { Telescope, FileText } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Skeleton } from '@/components/ui/skeleton'
import { toast } from 'sonner'

const ResultsPage = () => {
  const params = useParams()
  const [submission, setSubmission] =
    useState<PeersLastSubmissionResponse | null>(null)
  const [submissionId, setSubmissionId] = useState<number | null>(null)
  const [isLoading, setIsLoading] = useState(true)

  useEffect(() => {
    const fetchSubmission = async () => {
      setIsLoading(true)
      try {
        // Get the student's own submission
        const response = await DefaultService.getLastSubmission(
          Number(params['id'])
        )

        console.log('Last submission response:', response)

        if (response?.id) {
          // Store the correct submission ID
          console.log('Setting submission ID:', response.id)
          setSubmissionId(response.id)

          // Get the pre-signed URL for the submission file
          const fileResponse = await DefaultService.getPeersLastSubmission(
            Number(params['id']),
            response.id
          )

          console.log('File response:', fileResponse)

          setSubmission(fileResponse)
        } else {
          console.error('No submission ID found in response:', response)
        }
      } catch (error) {
        console.error('Error fetching submission:', error)
        toast.error('Failed to load your results')
      } finally {
        setIsLoading(false)
      }
    }

    fetchSubmission()
  }, [params])

  // Log the current state values
  useEffect(() => {
    console.log('Current state:', {
      submissionId,
      hasSubmission: !!submission?.pre_signed_file_url,
    })
  }, [submissionId, submission])

  if (isLoading) {
    return (
      <div className='mx-auto w-full max-w-[1200px] space-y-5 px-7 pb-12 pt-8'>
        <Skeleton className='h-8 w-40 rounded-[9px]' />
        <Skeleton className='h-4 w-full max-w-md' />
        <Skeleton className='h-[70vh] w-full rounded-[14px]' />
      </div>
    )
  }

  return (
    <>
      {!submission?.pre_signed_file_url || !submissionId ? (
        <div className='mx-auto w-full max-w-[1200px] px-7 pb-12 pt-8 duration-1000 animate-in fade-in'>
          <div className='mb-1 text-[21px] font-semibold -tracking-[.45px] text-[#131A26]'>
            Results
          </div>
          <div className='mb-5 text-[14px] text-[#5A6070]'>
            Your mark and feedback for this assignment.
          </div>
          <div className='flex flex-col items-center gap-2 rounded-[14px] border border-[#EAE5DB] bg-white px-7 py-14 text-center'>
            <Telescope className='mb-1 h-9 w-9 text-[#A29A8C]' />
            <div className='text-[14.5px] font-semibold text-[#2C3444]'>
              Nothing to see here
            </div>
            <p className='max-w-sm text-[13px] leading-[1.6] text-[#8A9099]'>
              No submission found. You need to submit your work before you can
              see feedback.
            </p>
            <Button
              asChild
              className='mt-3 rounded-[9px] bg-[#131A26] px-4 py-2.5 text-[13px] font-semibold text-white hover:bg-[#243247]'
            >
              <Link href={`/assignments/${params['id']}/submit`}>
                <FileText className='mr-2 h-4 w-4' />
                Go to submit page
              </Link>
            </Button>
          </div>
        </div>
      ) : (
        <ResultsPDFViewer
          url={submission.pre_signed_file_url}
          assignmentId={Number(params['id'])}
          submissionId={submissionId}
        />
      )}
    </>
  )
}

export default ResultsPage
