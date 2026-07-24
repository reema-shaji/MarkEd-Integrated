'use client'
import { useParams } from 'next/navigation'
import { DefaultService, PeersLastSubmissionResponse } from '@/src/api'
import { useState, useEffect } from 'react'
import ResultsPDFViewer from '@/components/pdf-viewer/ResultsPDFViewer'
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
      <div className='mx-auto w-full max-w-3xl space-y-5 p-6'>
        <Skeleton className='h-8 w-72' />
        <Skeleton className='h-4 w-full max-w-md' />
        <Skeleton className='h-[70vh] w-full rounded-lg' />
      </div>
    )
  }

  return (
    <>
      {!submission?.pre_signed_file_url || !submissionId ? (
        <div className='flex h-screen flex-col items-center justify-center gap-2 duration-1000 animate-in fade-in'>
          <Telescope className='h-10 w-10 text-neutral-400' />
          <h1 className='text-2xl font-bold'>Nothing to see here</h1>
          <p className='text-sm text-neutral-500'>
            No submission found. You need to submit your work before you can see
            feedback.
          </p>
          <Button variant='default' asChild>
            <Link href={`/assignments/${params['id']}/submit`}>
              <FileText className='mr-2 h-4 w-4' />
              Go to Submit Page
            </Link>
          </Button>
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
