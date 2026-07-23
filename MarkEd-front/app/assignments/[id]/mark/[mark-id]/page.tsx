'use client'
import { useParams } from 'next/navigation'
import { DefaultService, PeersLastSubmissionResponse } from '@/src/api'
import { useState, useEffect } from 'react'
import MarkerPDFViewer from '@/components/pdf-viewer/MarkerPDFViewer'
import Link from 'next/link'
import { Telescope } from 'lucide-react'

const MarkingPage = () => {
  const params = useParams()
  const [submission, setSubmission] =
    useState<PeersLastSubmissionResponse | null>(null)
  const [isLoading, setIsLoading] = useState(true)

  useEffect(() => {
    const fetchSubmission = async () => {
      setIsLoading(true)
      try {
        const response = await DefaultService.getSubmissionForMarking(
          Number(params['id']),
          Number(params['mark-id'])
        )
        setSubmission(response)
      } catch (error) {
        console.error('Error fetching submission:', error)
      } finally {
        setIsLoading(false)
      }
    }
    fetchSubmission()
  }, [params])

  if (isLoading) {
    return (
      <div className='flex h-screen items-center justify-center'>
        <div className='h-32 w-32 animate-spin rounded-full border-b-2 border-t-2 border-primary'></div>
      </div>
    )
  }

  return (
    <>
      {!submission?.pre_signed_file_url ? (
        <div className='flex h-screen flex-col items-center justify-center gap-2'>
          <Telescope className='h-10 w-10' />
          <h1 className='text-2xl font-semibold'>Nothing to see here</h1>
          <p className='text-sm text-gray-500'>
            No submission found. Please reach out to{' '}
            <Link href='/support' className='underline'>
              support
            </Link>
          </p>
        </div>
      ) : (
        <MarkerPDFViewer
          url={submission.pre_signed_file_url}
          assignmentId={Number(params['id'])}
          submissionId={Number(params['mark-id'])}
          isMarkerView={true}
        />
      )}
    </>
  )
}

export default MarkingPage
