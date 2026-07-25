'use client'

import { useState, useEffect } from 'react'
import { FileUpload } from '@/components/file-upload'
import { useParams } from 'next/navigation'
import { DefaultService } from '@/src/api'
import { toast } from 'sonner'
import { AlertTriangle } from 'lucide-react'
import { useAssignment } from '@/src/contexts/assignment-context'

interface PreviousSubmission {
  filename: string
  uploadedAt: Date
  fileSize: string
  fileUrl: string
  isLoadingUrl?: boolean
}

/** Storage keys look like "submission/<uuid>/Original Name.pdf" — show just the
 *  original filename (the last path segment). */
function displayName(key: string) {
  return key?.split('/').pop() || key
}

export default function SubmitAssignmentPage() {
  const unwrappedParams = useParams()
  const { currentAssignment, submissionStatus } = useAssignment()
  const [agreedToHonesty, setAgreedToHonesty] = useState(false)
  const [uploadedFiles, setUploadedFiles] = useState<string[]>([])
  const [uploadKey, setUploadKey] = useState(0)
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
      // Remount FileUpload so its staged-file chip clears — the file now lives
      // in the "Current submission" block above.
      setUploadKey((k) => k + 1)

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

  const isOpen = submissionStatus.isOpen

  return (
    <div className='mx-auto w-full max-w-[1200px] px-7 pb-12 pt-8'>

      <div className='rounded-[14px] border border-[#EAE5DB] bg-white p-6'>
        <div className='mb-1 text-[21px] font-semibold -tracking-[.45px] text-[#131A26]'>
          Your submission
        </div>
        <div className='mb-5 text-[13px] text-[#5A6070]'>
          {submissionStatus.message}
        </div>

        {/* Current submission */}
        {previousSubmission && (
          <div className='mb-[18px] overflow-hidden rounded-[12px] border border-[#EAE5DB]'>
            <div className='flex items-center gap-2 border-b border-[#F0ECE4] px-4 py-[11px]'>
              <span className='flex-1 text-[10px] font-semibold uppercase tracking-[.85px] text-[#A29A8C]'>
                Current submission
              </span>
              <span className='rounded-[6px] bg-[#E9F1EA] px-[9px] py-0.5 text-[11px] font-semibold text-[#2F7D4F]'>
                Submitted
              </span>
            </div>
            <div className='flex items-center gap-3 px-4 py-3.5'>
              <span className='text-[19px]'>📕</span>
              <span className='min-w-0 flex-1'>
                <span className='block truncate text-[13.5px] font-semibold text-[#131A26]'>
                  {displayName(previousSubmission.filename)}
                </span>
                <span className='mt-px block text-[12px] text-[#A29A8C]'>
                  {previousSubmission.uploadedAt.toLocaleString()}
                </span>
              </span>
              <button
                onClick={handleViewSubmission}
                disabled={previousSubmission.isLoadingUrl}
                className='flex-none cursor-pointer rounded-[9px] border border-[#DED8CA] bg-white px-[13px] py-[7px] text-[12px] font-semibold text-[#2C3444] hover:bg-[#F2EFE8] disabled:opacity-60'
              >
                {previousSubmission.isLoadingUrl ? 'Loading…' : 'Download'}
              </button>
            </div>
          </div>
        )}

        {isOpen ? (
          <>
            <div className='mb-5'>
              <FileUpload
                key={uploadKey}
                onUploadComplete={(urls) => setUploadedFiles(urls)}
                acceptedFileTypes={['application/pdf']}
                maxSizeMB={5}
                type='submission'
                maxFiles={1}
              />
            </div>

            <div className='mb-5 flex flex-col gap-3'>
              <label className='flex cursor-pointer items-start gap-2.5'>
                <input
                  type='checkbox'
                  checked={agreedToHonesty}
                  onChange={(e) => setAgreedToHonesty(e.target.checked)}
                  className='mt-0.5 h-[15px] w-[15px] flex-none'
                  style={{ accentColor: '#1F4E79' }}
                />
                <span className='text-[13px] leading-[1.5] text-[#2C3444]'>
                  I declare that this submission is my own work and that I have
                  not plagiarised or colluded with others.
                </span>
              </label>
              <label className='flex cursor-pointer items-start gap-2.5'>
                <input
                  type='checkbox'
                  checked={confirmedAnonymous}
                  onChange={(e) => setConfirmedAnonymous(e.target.checked)}
                  className='mt-0.5 h-[15px] w-[15px] flex-none'
                  style={{ accentColor: '#1F4E79' }}
                />
                <span className='text-[13px] leading-[1.5] text-[#2C3444]'>
                  I understand my submission may be anonymised and shared with
                  peers for review, where the assignment requires it.
                </span>
              </label>
            </div>

            {isLateSubmission && (
              <div className='mb-5 flex gap-2.5 rounded-[9px] border border-[#EFCFC9] bg-[#FBEEEC] p-3.5'>
                <AlertTriangle className='mt-px h-4 w-4 flex-none text-[#B4483C]' />
                <span>
                  <span className='block text-[13px] font-medium text-[#8E2A20]'>
                    Late Submission Warning
                  </span>
                  <span className='mt-0.5 block text-[12px] text-[#A93226]'>
                    Submissions after the deadline will incur a penalty as per
                    university policy.
                  </span>
                </span>
              </div>
            )}

            {error && (
              <div className='mb-5 rounded-[9px] border border-[#EFCFC9] bg-[#FBEEEC] p-3.5 text-[13px] text-[#A93226]'>
                {error}
              </div>
            )}

            <button
              onClick={handleSubmit}
              disabled={
                !agreedToHonesty ||
                !confirmedAnonymous ||
                uploadedFiles.length === 0 ||
                submitting
              }
              className='w-full cursor-pointer rounded-[9px] border-none bg-[#131A26] py-[11px] text-[14px] font-semibold text-white hover:bg-[#243247] disabled:cursor-not-allowed disabled:opacity-50'
            >
              {submitting ? 'Submitting…' : 'Submit assignment'}
            </button>
          </>
        ) : (
          <div className='rounded-[10px] bg-[#FAF8F4] px-4 py-3.5 text-[12.5px] leading-[1.6] text-[#5A6070]'>
            {submissionStatus.message} Your submission is final and can no longer
            be replaced.
          </div>
        )}
      </div>
    </div>
  )
}
