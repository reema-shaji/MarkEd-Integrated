'use client'
import { useParams } from 'next/navigation'
import {
  DefaultService,
  PeersLastSubmissionResponse,
  SubmissionMarkingSchema,
} from '@/src/api'
import { useState, useEffect, useMemo } from 'react'
import dynamic from 'next/dynamic'
// PDF viewer is client-only (pdfjs evaluates at module scope and
// throws during SSR); ssr:false keeps it off the server.
const MarkerPDFViewer = dynamic(
  () => import('@/components/pdf-viewer/MarkerPDFViewer'),
  { ssr: false }
)
import Link from 'next/link'
import { Loader2, Lock, Telescope } from 'lucide-react'
import { toast } from 'sonner'
import { Skeleton } from '@/components/ui/skeleton'
import { useUser } from '@/src/contexts/user-context'

// Per-criterion scoring panel for an individual submission — restores the
// scoring form from the original mark.html that the unified build dropped
// (individual marking had become annotations-only). Direct numeric entry per
// criterion, with Hao's marker-lock: a finalised criterion is read-only to
// markers and only a course organiser can override it.
function IndividualMarkingPanel({
  assignmentId,
  submissionId,
}: {
  assignmentId: number
  submissionId: number
}) {
  const { user } = useUser()
  const isAcademic = user?.isAcademic ?? false
  const [data, setData] = useState<SubmissionMarkingSchema | null>(null)
  const [scores, setScores] = useState<Record<number, string>>({})
  const [feedback, setFeedback] = useState<Record<number, string>>({})
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    let cancelled = false
    DefaultService.getSubmissionMarking(assignmentId, submissionId)
      .then((d) => {
        if (cancelled) return
        setData(d)
        const s: Record<number, string> = {}
        const f: Record<number, string> = {}
        d.criteria.forEach((c) => {
          s[c.criteria_id] = c.score != null ? String(c.score) : ''
          f[c.criteria_id] = c.feedback || ''
        })
        setScores(s)
        setFeedback(f)
      })
      .catch(() => toast.error('Could not load the rubric'))
    return () => {
      cancelled = true
    }
  }, [assignmentId, submissionId])

  const liveTotal = useMemo(() => {
    if (!data) return 0
    return data.criteria.reduce((sum, c) => {
      const v = parseFloat(scores[c.criteria_id])
      return sum + (isNaN(v) ? 0 : v)
    }, 0)
  }, [data, scores])

  const save = async (finalise: boolean) => {
    if (!data) return
    // A marker can't re-save a finalised criterion; academics can override.
    const editable = data.criteria.filter((c) => isAcademic || !c.finalised)
    const marks: { criteria_id: number; score: number; feedback?: string }[] = []
    for (const c of editable) {
      const raw = scores[c.criteria_id]
      if (raw === '' || raw == null) continue
      const v = parseFloat(raw)
      if (isNaN(v) || v < 0 || v > c.marks) {
        toast.error(`Score for “${c.name}” must be between 0 and ${c.marks}`)
        return
      }
      marks.push({
        criteria_id: c.criteria_id,
        score: v,
        feedback: feedback[c.criteria_id] || '',
      })
    }
    if (marks.length === 0) {
      toast.error('Enter a score for at least one editable criterion')
      return
    }
    setSaving(true)
    try {
      const updated = await DefaultService.saveSubmissionMarking(
        assignmentId,
        submissionId,
        { marks, finalise }
      )
      setData(updated)
      toast.success(finalise ? 'Marks finalised' : 'Marks saved')
    } catch (error) {
      const msg = (error as { body?: { detail?: string } })?.body?.detail
      toast.error(msg || 'Could not save the marks')
    } finally {
      setSaving(false)
    }
  }

  if (!data) {
    return (
      <div className='rounded-[14px] border border-[#EAE5DB] bg-white p-5'>
        <Skeleton className='h-40' />
      </div>
    )
  }

  if (data.criteria.length === 0) {
    return (
      <div className='rounded-[14px] border border-[#EAE5DB] bg-white py-8 text-center text-sm text-[#8A9099]'>
        This assignment has no rubric criteria to mark against — add them in the
        Structure tab.
      </div>
    )
  }

  const allFinalised = data.finalised

  return (
    <div className='rounded-[14px] border border-[#EAE5DB] bg-white p-5'>
      <div className='mb-1 flex items-center justify-between gap-2'>
        <div className='text-sm font-semibold tracking-[-0.05px] text-[#131A26]'>
          Marking Criteria — {data.student_name}
        </div>
        {allFinalised && (
          <span className='inline-flex items-center gap-1 rounded-[6px] bg-[#E9F1EA] px-2 py-0.5 text-[10px] font-semibold text-[#2F7D4F]'>
            <Lock className='h-3 w-3' /> Finalised
          </span>
        )}
      </div>
      <div className='mb-3.5 text-[12px] text-[#8A9099]'>
        Enter a score for each criterion. Finalising releases the mark to the
        student and locks it to markers.
      </div>

      <div className='flex flex-col gap-3'>
        {data.criteria.map((c) => {
          const locked = c.finalised && !isAcademic
          return (
            <div
              key={c.criteria_id}
              className={`rounded-[10px] border border-[#F0EBE1] p-3 ${locked ? 'opacity-70' : ''}`}
            >
              <div className='mb-1.5 flex items-center justify-between gap-2'>
                <span className='flex items-center gap-2 text-[13px] font-semibold text-[#2C3444]'>
                  {c.name}
                  {c.finalised && (
                    <span className='inline-flex items-center gap-1 rounded-[6px] bg-[#E9F1EA] px-2 py-0.5 text-[10px] font-semibold text-[#2F7D4F]'>
                      <Lock className='h-3 w-3' />
                      Finalised{isAcademic ? ' · you can override' : ''}
                    </span>
                  )}
                </span>
                <span className='flex shrink-0 items-center gap-1 text-xs text-[#8A9099]'>
                  <input
                    type='number'
                    min={0}
                    max={c.marks}
                    step='0.5'
                    disabled={locked}
                    value={scores[c.criteria_id] ?? ''}
                    onChange={(e) =>
                      setScores((prev) => ({
                        ...prev,
                        [c.criteria_id]: e.target.value,
                      }))
                    }
                    className='w-[68px] rounded-[8px] border border-[#D3CDBF] bg-white px-2 py-1 text-right text-[13px] tabular-nums text-[#131A26] outline-none focus:border-[#8A9099] disabled:bg-[#F5F3EF]'
                  />
                  <span className='tabular-nums'>/ {c.marks}</span>
                </span>
              </div>
              <textarea
                rows={2}
                disabled={locked}
                value={feedback[c.criteria_id] ?? ''}
                onChange={(e) =>
                  setFeedback((prev) => ({
                    ...prev,
                    [c.criteria_id]: e.target.value,
                  }))
                }
                placeholder='Feedback for this criterion (optional)…'
                className='w-full resize-y rounded-[8px] border border-[#DED8CA] bg-white px-2.5 py-1.5 text-[12.5px] leading-[1.5] text-[#2C3444] outline-none focus:border-[#8A9099] disabled:bg-[#F5F3EF]'
              />
            </div>
          )
        })}
      </div>

      <div className='mt-4 flex items-center justify-between gap-3 border-t border-[#F0EBE1] pt-3.5'>
        <div className='text-[13px] text-[#5A6070]'>
          Total{' '}
          <span className='font-semibold tabular-nums text-[#131A26]'>
            {liveTotal}
          </span>{' '}
          / {data.total}
        </div>
        <div className='flex gap-2'>
          <button
            onClick={() => save(false)}
            disabled={saving}
            className='inline-flex items-center rounded-[9px] border border-[#DED8CA] bg-white px-3.5 py-2 text-[13px] font-semibold text-[#2C3444] hover:bg-[#F2EFE8] disabled:opacity-50'
          >
            {saving && <Loader2 className='mr-2 h-4 w-4 animate-spin' />}
            Save marks
          </button>
          <button
            onClick={() => save(true)}
            disabled={saving}
            className='inline-flex items-center rounded-[9px] bg-[#131A26] px-3.5 py-2 text-[13px] font-semibold text-white hover:bg-[#243247] disabled:opacity-50'
          >
            Finalise marks
          </button>
        </div>
      </div>
    </div>
  )
}

const MarkingPage = () => {
  const params = useParams()
  const assignmentId = Number(params['id'])
  const submissionId = Number(params['mark-id'])
  const [submission, setSubmission] =
    useState<PeersLastSubmissionResponse | null>(null)
  const [isLoading, setIsLoading] = useState(true)

  useEffect(() => {
    const fetchSubmission = async () => {
      setIsLoading(true)
      try {
        const response = await DefaultService.getSubmissionForMarking(
          assignmentId,
          submissionId
        )
        setSubmission(response)
      } catch (error) {
        console.error('Error fetching submission:', error)
      } finally {
        setIsLoading(false)
      }
    }
    fetchSubmission()
  }, [assignmentId, submissionId])

  if (isLoading) {
    return (
      <div className='flex h-screen items-center justify-center bg-paper'>
        <div className='h-32 w-32 animate-spin rounded-full border-b-2 border-t-2 border-ink'></div>
      </div>
    )
  }

  if (!submission?.pre_signed_file_url) {
    return (
      <div className='flex h-screen flex-col items-center justify-center gap-2 bg-paper'>
        <Telescope className='h-10 w-10 text-faint' />
        <h1 className='text-2xl font-semibold text-ink'>Nothing to see here</h1>
        <p className='text-sm text-muted2'>
          No submission found. Please reach out to{' '}
          <Link
            href='/support'
            className='text-royal underline hover:text-royal-hover'
          >
            support
          </Link>
        </p>
      </div>
    )
  }

  return (
    <div className='bg-paper pb-12'>
      {/* Rubric scoring panel (restored individual marking) */}
      <div className='mx-auto w-full max-w-[1200px] px-7 pt-6'>
        <IndividualMarkingPanel
          assignmentId={assignmentId}
          submissionId={submissionId}
        />
      </div>
      {/* Annotation viewer for qualitative marker feedback on the PDF */}
      <div className='mt-6'>
        <div className='mx-auto mb-1 w-full max-w-[1200px] px-7 text-[13px] font-semibold text-[#2C3444]'>
          Annotate the submission
        </div>
        <MarkerPDFViewer
          url={submission.pre_signed_file_url}
          assignmentId={assignmentId}
          submissionId={submissionId}
          isMarkerView={true}
        />
      </div>
    </div>
  )
}

export default MarkingPage
