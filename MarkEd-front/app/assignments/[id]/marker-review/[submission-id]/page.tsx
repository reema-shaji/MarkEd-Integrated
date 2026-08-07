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
import { toast } from 'sonner'
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

// Colours cycle per reviewer (red / blue / green) to match the prototype.
const REVIEWER_COLORS = [
  {
    bg: 'rgba(239,68,68,.06)',
    bd: 'rgba(239,68,68,.30)',
    chip: 'rgba(239,68,68,.14)',
    txt: '#B4483C',
  },
  {
    bg: 'rgba(59,130,246,.06)',
    bd: 'rgba(59,130,246,.30)',
    chip: 'rgba(59,130,246,.14)',
    txt: '#1F4E79',
  },
  {
    bg: 'rgba(34,197,94,.07)',
    bd: 'rgba(34,197,94,.32)',
    chip: 'rgba(34,197,94,.16)',
    txt: '#2F7D4F',
  },
]

function initials(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean)
  if (parts.length === 0) return '?'
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase()
  return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase()
}

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
  const [hasError, setHasError] = React.useState(false)
  const [hiddenReviewers, setHiddenReviewers] = React.useState<Set<number>>(
    new Set()
  )
  const isStudent = user?.isStudent ?? false

  React.useEffect(() => {
    if (!assignmentId || !submissionId || isStudent) {
      setIsLoading(false)
      return
    }
    const fetchData = async () => {
      setIsLoading(true)
      setHasError(false)
      try {
        const commentsData = await DefaultService.getPeerReviewComments(
          assignmentId,
          submissionId
        )
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
      } catch (error) {
        console.error('Failed to load peer review comments:', error)
        toast.error('Failed to load peer review comments')
        setHasError(true)
      } finally {
        setIsLoading(false)
      }
    }
    fetchData()
  }, [assignmentId, submissionId, isStudent])

  // Map each distinct reviewer to a stable colour index.
  const reviewers = React.useMemo(() => {
    const map = new Map<
      number,
      { id: number; name: string; number: string; colorIdx: number }
    >()
    comments.forEach((c) => {
      if (!map.has(c.author.id)) {
        map.set(c.author.id, {
          id: c.author.id,
          name: c.author.userName,
          number: c.author.userNumber,
          colorIdx: map.size % REVIEWER_COLORS.length,
        })
      }
    })
    return Array.from(map.values())
  }, [comments])

  const colorFor = React.useCallback(
    (authorId: number) => {
      const r = reviewers.find((x) => x.id === authorId)
      return REVIEWER_COLORS[r ? r.colorIdx : 0]
    },
    [reviewers]
  )

  const toggleReviewer = (id: number) => {
    setHiddenReviewers((prev) => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }

  const visibleComments = comments.filter(
    (c) => !hiddenReviewers.has(c.author.id)
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
      <div className='flex h-14 flex-none items-center justify-between border-b border-[#E3DFD5] bg-white px-4'>
        <div className='flex items-center gap-3'>
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
            {reviewers.length}{' '}
            {reviewers.length === 1 ? 'reviewer' : 'reviewers'}
          </span>
        </div>
      </div>

      {/* Split body */}
      <div className='flex flex-1 overflow-hidden'>
        {/* Left — the submission document */}
        <div className='flex min-h-0 flex-1 flex-col bg-[#F5F3EF]'>
          {isLoading ? (
            <div className='flex flex-1 items-center justify-center'>
              <Loader2 className='h-6 w-6 animate-spin text-[#8A9099]' />
            </div>
          ) : pdfUrl ? (
            <MarkerPDFViewer
              url={pdfUrl}
              previewOnly
              peerReviewEnabled={false}
              heightClass='h-full'
            />
          ) : (
            <div className='flex flex-1 flex-col items-center justify-center gap-2 text-center'>
              <FileText className='h-8 w-8 text-[#B7AE9E]' />
              <div className='text-[13px] font-medium text-[#8A9099]'>
                No file is available for this submission.
              </div>
            </div>
          )}
        </div>

        {/* Right — reviewer filters + comment cards */}
        <div className='flex w-[384px] flex-none flex-col gap-3.5 overflow-y-auto border-l border-[#E3DFD5] bg-white p-4'>
          {isLoading ? (
            <div className='flex flex-col gap-3.5'>
              {[0, 1, 2].map((i) => (
                <div key={i} className='animate-pulse rounded-[12px] border border-[#EAE5DB] bg-white p-3.5'>
                  <div className='mb-2.5 flex items-center gap-2.5'>
                    <div className='h-[30px] w-[30px] rounded-[12px] bg-[#EFEBE2]' />
                    <div className='flex-1'>
                      <div className='mb-1.5 h-3 w-24 rounded bg-[#EFEBE2]' />
                      <div className='h-2.5 w-16 rounded bg-[#F0ECE4]' />
                    </div>
                  </div>
                  <div className='mb-1.5 h-3 w-full rounded bg-[#F0ECE4]' />
                  <div className='h-3 w-4/5 rounded bg-[#F0ECE4]' />
                </div>
              ))}
            </div>
          ) : hasError ? (
            <div className='rounded-[12px] border border-[#EAE5DB] bg-[#FAF8F4] px-4 py-10 text-center'>
              <div className='text-[14px] font-semibold text-[#2C3444]'>
                Couldn&apos;t load comments
              </div>
              <div className='mt-1 text-[13px] text-[#8A9099]'>
                Please refresh to try again.
              </div>
            </div>
          ) : comments.length === 0 ? (
            <div className='rounded-[12px] border border-[#EAE5DB] bg-[#FAF8F4] px-4 py-10 text-center'>
              <div className='text-[14px] font-semibold text-[#2C3444]'>
                No peer review comments yet
              </div>
              <div className='mt-1 text-[13px] text-[#8A9099]'>
                Reviewer feedback will appear here once peers submit their
                reviews.
              </div>
            </div>
          ) : (
            <>
              <div>
                <div className='mb-2 text-[10px] font-semibold uppercase tracking-[.85px] text-[#A29A8C]'>
                  Reviewer Filters{' '}
                  <span className='font-normal'>· click to toggle</span>
                </div>
                <div className='flex flex-wrap gap-1.5'>
                  {reviewers.map((r) => {
                    const c = REVIEWER_COLORS[r.colorIdx]
                    const active = !hiddenReviewers.has(r.id)
                    return (
                      <button
                        key={r.id}
                        onClick={() => toggleReviewer(r.id)}
                        style={
                          active
                            ? { background: c.bg, color: c.txt, borderColor: c.bd }
                            : undefined
                        }
                        className={
                          active
                            ? 'inline-flex h-7 items-center gap-1.5 rounded-[99px] border px-2.5 text-[12px] font-medium'
                            : 'inline-flex h-7 items-center gap-1.5 rounded-[99px] border border-[#E3DFD5] bg-white px-2.5 text-[12px] font-medium text-[#8A9099] line-through'
                        }
                      >
                        {r.name}
                      </button>
                    )
                  })}
                </div>
              </div>

              <div className='h-px bg-[#F0ECE4]' />

              {visibleComments.length === 0 ? (
                <p className='px-1 py-6 text-center text-[13px] text-[#8A9099]'>
                  All reviewers hidden. Toggle a filter to show comments.
                </p>
              ) : (
                visibleComments.map((c) => {
                  const color = colorFor(c.author.id)
                  return (
                    <div
                      key={c.id}
                      style={{ background: color.bg, borderColor: color.bd }}
                      className='rounded-[12px] border p-3.5'
                    >
                      <div className='mb-2.5 flex items-start gap-2.5'>
                        <span
                          style={{ background: color.chip, color: color.txt }}
                          className='flex h-[30px] w-[30px] flex-none items-center justify-center rounded-[12px] text-[11px] font-semibold'
                        >
                          {initials(c.author.userName)}
                        </span>
                        <span>
                          <span className='block text-[13px] font-semibold text-[#131A26]'>
                            {c.author.userName}
                          </span>
                          <span className='block text-[11px] text-[#5A6070]'>
                            Reviewer · {c.author.userNumber}
                          </span>
                        </span>
                      </div>
                      {c.selected_text && (
                        <blockquote
                          style={{ borderColor: color.bd }}
                          className='mb-2 border-l-2 pl-2.5 text-[12px] italic leading-[1.5] text-[#5A6070]'
                        >
                          &ldquo;{c.selected_text}&rdquo;
                        </blockquote>
                      )}
                      <div className='text-[13px] leading-[1.55] text-[#2C3444]'>
                        {c.feedback}
                      </div>
                    </div>
                  )
                })
              )}
            </>
          )}
        </div>
      </div>
    </div>
  )
}
