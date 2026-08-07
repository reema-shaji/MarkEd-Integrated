'use client'

import * as React from 'react'
import dynamic from 'next/dynamic'
import { useParams } from 'next/navigation'
import {
  AllSubmissionSchema,
  DefaultService,
  PeerReviewCommentSchema,
} from '@/src/api'
import { FileText, Loader2, MessageSquare } from 'lucide-react'
import { useUser } from '@/src/contexts/user-context'

// pdf.js is client-only; load the viewer lazily like the other marking pages.
const MarkerPDFViewer = dynamic(
  () => import('@/components/pdf-viewer/MarkerPDFViewer'),
  {
    ssr: false,
    loading: () => (
      <div className='flex h-full items-center justify-center'>
        <Loader2 className='h-6 w-6 animate-spin text-[#8A9099]' />
      </div>
    ),
  }
)

export default function MarkerReviewPage() {
  const params = useParams()
  const { user } = useUser()
  const assignmentId = Number(params['id'])
  const submissionId = Number(params['submission-id'])

  const [comments, setComments] = React.useState<PeerReviewCommentSchema[]>([])
  const [submission, setSubmission] =
    React.useState<AllSubmissionSchema | null>(null)
  const [pdfUrl, setPdfUrl] = React.useState<string | null>(null)
  const [isLoading, setIsLoading] = React.useState(true)
  const isStudent = user?.isStudent ?? false

  React.useEffect(() => {
    if (!assignmentId || !submissionId || isStudent) {
      setIsLoading(false)
      return
    }
    const fetchData = async () => {
      setIsLoading(true)
      try {
        // Comments back the header counts; the viewer's sidebar fetches its own.
        const commentsData = await DefaultService.getPeerReviewComments(
          assignmentId,
          submissionId
        ).catch(() => [])
        setComments(commentsData)
        // Best-effort: resolve the submission owner's name for the title.
        try {
          const subs = await DefaultService.getAllSubmissions(assignmentId)
          setSubmission(subs.find((s) => s.id === submissionId) ?? null)
        } catch {
          // Non-critical — title falls back to a generic label.
        }
        // Resolve a viewable (presigned) PDF URL — try the individual
        // submission endpoint first, then fall back to a group submission.
        try {
          const marking = await DefaultService.getSubmissionForMarking(
            assignmentId,
            submissionId
          )
          if (marking?.pre_signed_file_url) {
            setPdfUrl(marking.pre_signed_file_url)
          } else {
            throw new Error('no-url')
          }
        } catch {
          try {
            const groups =
              await DefaultService.listGroupSubmissions(assignmentId)
            setPdfUrl(
              groups.find((g) => g.id === submissionId)?.pre_signed_file_url ??
                null
            )
          } catch {
            // Non-critical — the document pane shows a fallback.
          }
        }
      } finally {
        setIsLoading(false)
      }
    }
    fetchData()
  }, [assignmentId, submissionId, isStudent])

  const reviewerCount = React.useMemo(
    () => new Set(comments.map((c) => c.author.id)).size,
    [comments]
  )

  const studentLabel = submission
    ? `${submission.student_name} (${submission.student_number})`
    : `Submission #${submissionId}`

  // Role guard — the linking tab is already gated; this is defence in depth.
  if (isStudent) {
    return (
      <div className='mx-auto w-full max-w-[1200px] px-7 pb-12 pt-8'>
        <div className='rounded-[14px] border border-[#EAE5DB] bg-white px-5 py-12 text-center'>
          <div className='text-[15px] font-semibold text-[#131A26]'>
            Not available
          </div>
          <p className='mt-1 text-sm text-[#8A9099]'>
            Marker review is only available to teaching staff.
          </p>
        </div>
      </div>
    )
  }

  return (
    <div className='flex h-[calc(100vh-64px)] min-h-[560px] flex-col'>
      {/* Top bar */}
      <div className='flex h-14 flex-none items-center gap-3 border-b border-[#E3DFD5] bg-white px-4'>
        <span className='text-[14px] font-semibold text-[#131A26]'>
          Marker Review — {studentLabel}
        </span>
        <span className='h-5 w-px bg-[#E3DFD5]' />
        <span className='flex items-center gap-1.5 text-[13px] text-[#454C5C]'>
          <MessageSquare className='h-[15px] w-[15px]' />
          <span className='font-medium'>
            {comments.length}{' '}
            {comments.length === 1 ? 'annotation' : 'annotations'}
          </span>
        </span>
        <span className='text-[13px] text-[#454C5C]'>
          {reviewerCount} {reviewerCount === 1 ? 'reviewer' : 'reviewers'}
        </span>
      </div>

      {/* Document + peer annotations (highlights on the PDF stay in sync with
          the sidebar — same colours, click to select and navigate). */}
      <div className='min-h-0 flex-1 bg-[#F5F3EF]'>
        {isLoading ? (
          <div className='flex h-full items-center justify-center'>
            <Loader2 className='h-6 w-6 animate-spin text-[#8A9099]' />
          </div>
        ) : pdfUrl ? (
          <MarkerPDFViewer
            url={pdfUrl}
            assignmentId={assignmentId}
            submissionId={submissionId}
            isMarkerView
            readOnly
            heightClass='h-full'
          />
        ) : (
          <div className='flex h-full flex-col items-center justify-center gap-2 text-center'>
            <FileText className='h-8 w-8 text-[#B7AE9E]' />
            <div className='text-[13px] font-medium text-[#8A9099]'>
              No file is available for this submission.
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
