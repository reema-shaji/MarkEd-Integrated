'use client'

import { useState, useEffect } from 'react'
import { FileUpload } from '@/components/file-upload'
import { Button } from '@/components/ui/button'
import { Checkbox } from '@/components/ui/checkbox'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { useParams } from 'next/navigation'
import { DefaultService } from '@/src/api'
import * as React from 'react'
import { toast } from 'sonner'
import { ExternalLink } from 'lucide-react'
import { useAssignment } from '@/src/contexts/assignment-context'
import { AlertTriangle } from 'lucide-react'
import { Check } from 'lucide-react'

interface PreviousSubmission {
  filename: string
  uploadedAt: Date
  fileSize: string
  fileUrl: string
  isLoadingUrl?: boolean
}

export default function SubmitAssignmentPage() {
  const unwrappedParams = useParams()
  const { currentAssignment, submissionStatus } = useAssignment()
  const [agreedToHonesty, setAgreedToHonesty] = useState(false)
  const [uploadedFiles, setUploadedFiles] = useState<string[]>([])
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [previousSubmission, setPreviousSubmission] =
    useState<PreviousSubmission | null>(null)
  const [confirmedAnonymous, setConfirmedAnonymous] = useState(false)

  const isLateSubmission = currentAssignment
    ? new Date() > new Date(currentAssignment.deadline)
    : false

  useEffect(() => {
    const fetchPreviousSubmission = async () => {
      try {
        const response = await DefaultService.getLastSubmission(
          Number(unwrappedParams.id)
        )
        setPreviousSubmission({
          filename: response.submissionFile,
          uploadedAt: new Date(response.submissionDateTime),
          fileSize: 'TODO',
          fileUrl: response.submissionFile,
        })
      } catch {
        setPreviousSubmission(null)
      }
    }

    fetchPreviousSubmission()
  }, [unwrappedParams.id])

  const handleSubmit = async () => {
    if (!agreedToHonesty || !confirmedAnonymous) {
      setError(
        'You must agree to both the honesty statement and anonymity confirmation'
      )
      return
    }

    if (uploadedFiles.length === 0) {
      setError('Please upload a file before submitting')
      return
    }

    setSubmitting(true)
    setError(null)

    try {
      const response = await DefaultService.createSubmission({
        assignment_id: Number(unwrappedParams.id),
        files: uploadedFiles,
      })

      if (!response.success) {
        throw new Error('Failed to submit assignment')
      }

      const lastSubmission = await DefaultService.getLastSubmission(
        Number(unwrappedParams.id)
      )
      setPreviousSubmission({
        filename: lastSubmission.submissionFile,
        uploadedAt: new Date(lastSubmission.submissionDateTime),
        fileSize: 'Just uploaded',
        fileUrl: lastSubmission.submissionFile,
      })

      setAgreedToHonesty(false)
      setConfirmedAnonymous(false)
      setUploadedFiles([])

      toast.success('Assignment submitted successfully')
    } catch (err) {
      setError(err instanceof Error ? err.message : 'An error occurred')
    } finally {
      setSubmitting(false)
    }
  }

  const handleViewSubmission = async () => {
    if (!previousSubmission) return

    setPreviousSubmission((prev) =>
      prev ? { ...prev, isLoadingUrl: true } : null
    )

    try {
      const response = await DefaultService.getSubmissionFileAccessUrl(
        Number(unwrappedParams.id),
        previousSubmission.filename
      )

      if (response.success && response.download_url) {
        window.open(response.download_url, '_blank')
      } else {
        toast.error('Failed to access submission file')
      }
    } catch (error) {
      console.error('Error accessing submission file', error)
      toast.error('Failed to access submission file')
    } finally {
      setPreviousSubmission((prev) =>
        prev ? { ...prev, isLoadingUrl: false } : null
      )
    }
  }

  return (
    <div className='container mx-auto max-w-3xl py-8'>
      <Card className='max-w-2xl'>
        {previousSubmission ? (
          <CardContent className='pt-6'>
            <div className='space-y-6 text-center'>
              <div className='mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-full bg-green-100 text-green-600'>
                <Check className='h-6 w-6' />
              </div>
              <div className='space-y-2'>
                <h3 className='text-lg font-semibold'>Assignment Submitted!</h3>
                <p className='text-sm text-muted-foreground'>
                  Submitted on {previousSubmission.uploadedAt.toLocaleString()}
                </p>
              </div>
              <div className='flex justify-center gap-3'>
                <Button
                  onClick={handleViewSubmission}
                  className='gap-2'
                  disabled={previousSubmission?.isLoadingUrl}
                >
                  {previousSubmission?.isLoadingUrl ? (
                    'Loading...'
                  ) : (
                    <>
                      View Submission
                      <ExternalLink className='h-4 w-4' />
                    </>
                  )}
                </Button>
                <Button
                  variant='outline'
                  onClick={() => setPreviousSubmission(null)}
                  className='gap-2'
                >
                  Submit Again
                </Button>
              </div>
            </div>
          </CardContent>
        ) : (
          <>
            <CardHeader>
              <CardTitle>Submit Assignment</CardTitle>
              <p className='text-sm text-muted-foreground'>
                {submissionStatus.message}
              </p>
            </CardHeader>
            <CardContent className='space-y-6'>
              <FileUpload
                onUploadComplete={(urls) => setUploadedFiles(urls)}
                acceptedFileTypes={['application/pdf']}
                maxSizeMB={5}
                type='submission'
                maxFiles={1}
              />

              <div className='space-y-4'>
                <div className='flex items-start space-x-2'>
                  <Checkbox
                    id='honesty'
                    checked={agreedToHonesty}
                    onCheckedChange={(checked) =>
                      setAgreedToHonesty(checked as boolean)
                    }
                    disabled={!submissionStatus.isOpen}
                  />
                  <label htmlFor='honesty' className='text-sm leading-none'>
                    I confirm that this is my own work and I have not
                    plagiarized or copied from any unauthorized sources.
                  </label>
                </div>

                <div className='flex items-start space-x-2'>
                  <Checkbox
                    id='anonymous'
                    checked={confirmedAnonymous}
                    onCheckedChange={(checked) =>
                      setConfirmedAnonymous(checked as boolean)
                    }
                    disabled={!submissionStatus.isOpen}
                  />
                  <label htmlFor='anonymous' className='text-sm leading-none'>
                    I confirm that my submission does not contain any personal
                    identifying information (such as name, email, or student
                    number).
                  </label>
                </div>
              </div>

              {isLateSubmission && (
                <Alert
                  variant='destructive'
                  className='border-red-200 bg-red-50 text-red-900 dark:border-red-800 dark:bg-red-900/10 dark:text-red-200'
                >
                  <AlertTriangle className='h-4 w-4' />
                  <AlertDescription className=''>
                    Late submissions not accepted.
                  </AlertDescription>
                </Alert>
              )}

              {error && (
                <Alert variant='destructive'>
                  <AlertDescription>{error}</AlertDescription>
                </Alert>
              )}

              <Button
                onClick={handleSubmit}
                disabled={
                  !submissionStatus.isOpen ||
                  !agreedToHonesty ||
                  !confirmedAnonymous ||
                  uploadedFiles.length === 0 ||
                  submitting
                }
                className='w-full'
              >
                {submitting ? 'Submitting...' : 'Submit Assignment'}
              </Button>
            </CardContent>
          </>
        )}
      </Card>
    </div>
  )
}
