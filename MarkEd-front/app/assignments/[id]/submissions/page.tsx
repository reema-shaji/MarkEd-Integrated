'use client'

/**
 * Marking tab — the primary staff view for an individual assignment.
 *
 * For academics this page now combines what used to be spread across the
 * assignment-level dashboard:
 *   - Release Marks toggle (was dashboard-only)
 *   - Submission statistics + grade distribution
 *   - The full submissions list with status filter
 *
 * For markers / TAs it shows the personal marking queue — the submissions
 * allocated to them — with a summary strip (to-mark count + peer-review count).
 *
 * Group assignments redirect to the group-marking page (report B16).
 *
 * Reasoning for relocation: the dashboard was a separate tab that duplicated
 * navigation and added a click to reach the only actionable control (Release
 * Marks). Placing stats and the release toggle directly above the submissions
 * list keeps everything in a single, linear flow — see submissions, review
 * stats, release marks — without an extra tab.
 */

import * as React from 'react'
import { useParams, useRouter } from 'next/navigation'
import {
  AllSubmissionSchema,
  AssignmentSchema,
  DefaultService,
  PeerReviewSchemaWithStudent,
} from '@/src/api'
import { FileText, Loader2 } from 'lucide-react'
import { toast } from 'sonner'
import { Skeleton } from '@/components/ui/skeleton'
import { Dialog, DialogContent } from '@/components/ui/dialog'
import { useUser } from '@/src/contexts/user-context'
import { formatDateTime } from '@/lib/date'

const formatWhen = (iso: string) => formatDateTime(iso)

type AssignmentStatistics = {
  total_submissions: number
  unique_submitters: number
  active_users_24h: number
  total_peer_reviews: number
  peer_review_stats: Record<string, number>
  average_reviews_per_student: number
  completion_rate: number
  enrolled_students: number
  expected_submissions: number
  submission_on_time: number
  submission_late: number
  submission_missing: number
  self_assessment_enabled: boolean
  self_assessment_submitted: number
  grade_distribution: Record<string, number>
}

export default function SubmissionsPage() {
  const params = useParams()
  const router = useRouter()
  const { user, isLoading: userLoading } = useUser()
  const isAcademic = user?.isAcademic ?? false

  const [submissions, setSubmissions] = React.useState<
    AllSubmissionSchema[] | null
  >(null)
  const [statusFilter, setStatusFilter] = React.useState('All statuses')
  const [assignment, setAssignment] = React.useState<AssignmentSchema | null>(
    null
  )
  const [stats, setStats] = React.useState<AssignmentStatistics | null>(null)
  const [releasing, setReleasing] = React.useState(false)

  // Edit assignment dialog state
  const [editOpen, setEditOpen] = React.useState(false)
  const [editTitle, setEditTitle] = React.useState('')
  const [editDescription, setEditDescription] = React.useState('')
  const [editWebsite, setEditWebsite] = React.useState('')
  const [editDeadline, setEditDeadline] = React.useState('')
  const [savingAssignment, setSavingAssignment] = React.useState(false)

  const toLocalInput = (iso?: string | null) => (iso ? iso.slice(0, 16) : '')

  const openEdit = () => {
    if (!assignment) return
    setEditTitle(assignment.assignmentTitle ?? '')
    setEditDescription(assignment.assignmentDescription ?? '')
    setEditWebsite(assignment.assignmentWebsite ?? '')
    setEditDeadline(toLocalInput(assignment.deadline))
    setEditOpen(true)
  }

  const saveAssignment = async () => {
    const t = editTitle.trim()
    if (!t) { toast.error('Assignment title is required'); return }
    if (!editDeadline) { toast.error('Set a submission deadline'); return }
    setSavingAssignment(true)
    try {
      const updated = await DefaultService.updateAssignment(Number(params.id), {
        assignmentTitle: t,
        assignmentDescription: editDescription.trim() || null,
        assignmentWebsite: editWebsite.trim() || null,
        deadline: new Date(editDeadline).toISOString(),
      })
      setAssignment(updated as AssignmentSchema)
      toast.success('Assignment updated')
      setEditOpen(false)
    } catch {
      toast.error('Failed to update assignment')
    } finally {
      setSavingAssignment(false)
    }
  }

  // Marker / TA state
  const [markQueue, setMarkQueue] = React.useState<
    { key: string; title: string; meta: string; href: string }[]
  >([])
  const [allocations, setAllocations] = React.useState<
    PeerReviewSchemaWithStudent[]
  >([])

  const STATUS_STYLES: Record<string, { bg: string; fg: string }> = {
    Unmarked: { bg: '#F5F3EF', fg: '#8A6D3B' },
    'In progress': { bg: '#FBF4E3', fg: '#8A5D14' },
    Marked: { bg: '#E9F1EA', fg: '#2F7D4F' },
  }

  React.useEffect(() => {
    if (!params.id) return
    const id = Number(params.id)

    DefaultService.getAssignment(id)
      .then((a) => {
        setAssignment(a as AssignmentSchema)
        // Group assignments redirect — their submissions live in a different
        // model, so this individual queue would show 0 (report B16).
        if (a.assignment_type === 'GROUP') {
          router.replace(`/assignments/${id}/group-marking`)
          return
        }
        return DefaultService.getAllSubmissions(id).then((data) =>
          setSubmissions(data)
        )
      })
      .catch((error) => {
        console.error('Failed to fetch submissions:', error)
        toast.error('Failed to load submissions')
        setSubmissions([])
      })

    // Stats for academic header
    DefaultService.getAssignmentStatistics(id)
      .then((s) => setStats(s as AssignmentStatistics))
      .catch(() => {})

    // Marker allocations (for peer-review-to-moderate count)
    DefaultService.getMarkerAllocations(id)
      .then(setAllocations)
      .catch(() => {})
  }, [params.id, router])

  // Marker / TA marking queue
  React.useEffect(() => {
    if (!assignment || !user || user.isAcademic) return
    const id = Number(params.id)
    const load = async () => {
      if (assignment.assignment_type === 'GROUP') {
        const subs = await DefaultService.listGroupSubmissions(id).catch(
          () => []
        )
        setMarkQueue(
          subs.map((s) => ({
            key: `g${s.id}`,
            title: s.group_name,
            meta: `Submission v${s.submission_version} · by ${s.submitted_by_name}`,
            href: `/assignments/${id}/group-marking`,
          }))
        )
      } else {
        const subs = await DefaultService.getAllSubmissions(id).catch(() => [])
        setMarkQueue(
          subs.map((s) => ({
            key: `s${s.id}`,
            title: s.student_name,
            meta: s.student_number,
            href: `/assignments/${id}/mark/${s.id}`,
          }))
        )
      }
    }
    load()
  }, [assignment, user, params.id])

  const handleToggleRelease = async () => {
    if (!assignment) return
    const next = !assignment.results_released
    setReleasing(true)
    try {
      const updated = await DefaultService.setResultsReleased(
        Number(params.id),
        { released: next }
      )
      setAssignment(updated as AssignmentSchema)
      toast.success(
        next ? 'Marks released to students' : 'Marks hidden from students'
      )
    } catch {
      toast.error('Could not update mark release')
    } finally {
      setReleasing(false)
    }
  }

  // Defensive role guard — the linking tab is already staff-gated.
  if (!userLoading && user && !user.isStaff) {
    return (
      <div className='mx-auto w-full max-w-[1200px] px-7 pb-12 pt-8'>
        <div className='rounded-[14px] border border-[#EAE5DB] bg-white p-10 text-center'>
          <div className='text-[15px] font-semibold text-[#131A26]'>
            Not available
          </div>
          <p className='mt-1 text-sm text-[#8A9099]'>
            This page is only available to staff.
          </p>
        </div>
      </div>
    )
  }

  // --- Marker / TA view: personal marking queue ------------------------------
  if (!userLoading && user && !user.isAcademic) {
    return (
      <div className='mx-auto w-full max-w-[1200px] px-7 pb-12 pt-8'>
        <div className='mb-5 grid grid-cols-2 divide-x divide-[#F0ECE4] overflow-hidden rounded-[14px] border border-[#EAE5DB] bg-white'>
          <div className='px-5 py-[18px]'>
            <div className='text-[10px] font-semibold uppercase tracking-[.85px] text-[#A29A8C]'>
              To mark
            </div>
            <div className='mt-[5px] text-[26px] font-semibold tracking-[-.7px] text-[#131A26]'>
              {markQueue.length}
            </div>
          </div>
          <div className='px-5 py-[18px]'>
            <div className='text-[10px] font-semibold uppercase tracking-[.85px] text-[#A29A8C]'>
              Peer reviews to moderate
            </div>
            <div className='mt-[5px] text-[26px] font-semibold tracking-[-.7px] text-[#131A26]'>
              {allocations.length}
            </div>
          </div>
        </div>

        <div className='overflow-hidden rounded-[14px] border border-[#EAE5DB] bg-white'>
          <div className='border-b border-[#F0ECE4] px-5 py-4 text-[15px] font-semibold tracking-[-.1px] text-[#131A26]'>
            My Marking Queue
          </div>
          {markQueue.length === 0 ? (
            <p className='px-5 py-10 text-center text-sm text-[#8A9099]'>
              Nothing to mark yet. Submissions appear here as students submit.
            </p>
          ) : (
            markQueue.map((q) => (
              <div
                key={q.key}
                className='flex items-center gap-3 border-b border-[#F0ECE4] px-5 py-[13px] last:border-b-0'
              >
                <span className='flex-1'>
                  <span className='block text-[13.5px] font-semibold text-[#131A26]'>
                    {q.title}
                  </span>
                  <span className='mt-px block font-mono text-xs text-[#5A6070]'>
                    {q.meta}
                  </span>
                </span>
                <button
                  onClick={() => router.push(q.href)}
                  className='rounded-[9px] bg-[#131A26] px-3 py-1.5 text-[12px] font-semibold text-white hover:bg-[#243247]'
                >
                  Mark
                </button>
              </div>
            ))
          )}
        </div>
      </div>
    )
  }

  // Loading
  if (submissions === null) {
    return (
      <div className='mx-auto w-full max-w-[1200px] px-7 pb-12 pt-8'>
        <Skeleton className='mb-5 h-16 w-full rounded-[14px]' />
        <Skeleton className='mb-5 h-40 w-full rounded-[14px]' />
        <Skeleton className='mb-1 h-7 w-40' />
        <Skeleton className='mb-5 h-4 w-28' />
        <div className='overflow-hidden rounded-[14px] border border-[#EAE5DB] bg-white'>
          {Array.from({ length: 4 }).map((_, i) => (
            <div
              key={i}
              className='flex items-center justify-between border-b border-[#F0ECE4] px-5 py-[15px] last:border-b-0'
            >
              <Skeleton className='h-5 w-56' />
              <Skeleton className='h-7 w-20' />
            </div>
          ))}
        </div>
      </div>
    )
  }

  // --- Academic view ---------------------------------------------------------
  const visible =
    statusFilter === 'All statuses'
      ? submissions
      : submissions.filter((s) => s.marking_status === statusFilter)

  const countLabel = `${visible.length} submission${
    visible.length === 1 ? '' : 's'
  }`

  // Submission statistics data
  const submissionRows = stats
    ? [
        { label: 'On time', value: stats.submission_on_time, color: '#2F7D4F' },
        { label: 'Late', value: stats.submission_late, color: '#C9862A' },
        {
          label: 'Missing',
          value: stats.submission_missing,
          color: '#B4483C',
        },
      ]
    : []
  const submissionTotal = stats?.expected_submissions || 1

  // Grade distribution data
  const gradeBands = ['0-39', '40-49', '50-59', '60-69', '70+']
  const gradeCounts = gradeBands.map(
    (b) => stats?.grade_distribution?.[b] ?? 0
  )
  const gradeMax = Math.max(1, ...gradeCounts)
  const graded = gradeCounts.reduce((a, b) => a + b, 0)

  return (
    <div className='mx-auto w-full max-w-[1200px] px-7 pb-12 pt-8'>
      {/* Release marks control — the course organiser decides when finalised
          marks become visible to students (separate from finalising marking).
          Relocated from the assignment dashboard to sit directly above the
          submissions list for a single-tab marking workflow. */}
      {assignment && isAcademic && (
        <div className='mb-5 flex flex-wrap items-center justify-between gap-3 rounded-[14px] border border-[#EAE5DB] bg-white px-5 py-4'>
          <div>
            <div className='flex items-center gap-2 text-[14px] font-semibold text-[#131A26]'>
              Marks{' '}
              {assignment.results_released ? (
                <span className='inline-flex items-center gap-1 rounded-[6px] bg-[#E9F1EA] px-2 py-0.5 text-[11px] font-semibold text-[#2F7D4F]'>
                  Released
                </span>
              ) : (
                <span className='inline-flex items-center gap-1 rounded-[6px] bg-[#F5F3EF] px-2 py-0.5 text-[11px] font-semibold text-[#8A6D3B]'>
                  Not released
                </span>
              )}
            </div>
            <div className='mt-0.5 text-[12.5px] text-[#8A9099]'>
              {assignment.results_released
                ? 'Students can see their finalised marks and feedback.'
                : 'Finalised marks stay hidden from students until you release them.'}
            </div>
          </div>
          <button
            onClick={handleToggleRelease}
            disabled={releasing}
            className={
              assignment.results_released
                ? 'inline-flex items-center rounded-[9px] border border-[#DED8CA] bg-white px-4 py-2 text-[13px] font-semibold text-[#2C3444] hover:bg-[#F2EFE8] disabled:opacity-50'
                : 'inline-flex items-center rounded-[9px] bg-[#131A26] px-4 py-2 text-[13px] font-semibold text-white hover:bg-[#243247] disabled:opacity-50'
            }
          >
            {releasing && <Loader2 className='mr-2 h-4 w-4 animate-spin' />}
            {assignment.results_released ? 'Hide marks' : 'Release marks'}
          </button>
        </div>
      )}

      {/* Submission statistics + grade distribution — relocated from the
          assignment dashboard so academics see them alongside the submissions
          list instead of on a separate tab. */}
      {stats && isAcademic && (
        <div className='mb-5 grid grid-cols-1 gap-4 md:grid-cols-2'>
          <div className='rounded-[14px] border border-[#EAE5DB] bg-white p-5'>
            <div className='text-sm font-semibold tracking-[-.05px] text-[#131A26]'>
              Submission Statistics
            </div>
            <div className='mb-3.5 mt-0.5 text-xs text-[#8A9099]'>
              Out of {stats.expected_submissions}{' '}
              {assignment?.assignment_type === 'GROUP' ? 'groups' : 'students'}
            </div>
            <div className='flex flex-col gap-2.5'>
              {submissionRows.map((r) => (
                <div key={r.label}>
                  <div className='mb-1 flex justify-between text-xs'>
                    <span className='text-[#454C5C]'>{r.label}</span>
                    <span className='font-semibold tabular-nums text-[#131A26]'>
                      {r.value}
                    </span>
                  </div>
                  <div className='h-2 overflow-hidden rounded-full bg-[#F0ECE4]'>
                    <div
                      className='h-full rounded-full'
                      style={{
                        width: `${(r.value / submissionTotal) * 100}%`,
                        background: r.color,
                      }}
                    />
                  </div>
                </div>
              ))}
            </div>
          </div>

          <div className='rounded-[14px] border border-[#EAE5DB] bg-white p-5'>
            <div className='text-sm font-semibold tracking-[-.05px] text-[#131A26]'>
              Grade Distribution
            </div>
            <div className='mb-3.5 mt-0.5 text-xs text-[#8A9099]'>
              Marked submissions
            </div>
            {graded === 0 ? (
              <p className='py-8 text-center text-sm text-[#8A9099]'>
                No marks yet — the histogram fills in as work is graded.
              </p>
            ) : (
              <div className='flex h-[110px] items-end gap-2'>
                {gradeBands.map((b, i) => (
                  <div
                    key={b}
                    className='flex h-full flex-1 flex-col items-center justify-end gap-1'
                  >
                    <span className='text-[10px] text-[#8A9099]'>
                      {gradeCounts[i]}
                    </span>
                    <div
                      className='w-full rounded-t-[3px] bg-[#131A26]'
                      style={{
                        height: `${(gradeCounts[i] / gradeMax) * 100}%`,
                        minHeight: gradeCounts[i] ? 4 : 0,
                      }}
                    />
                    <span className='text-[10px] text-[#8A9099]'>{b}</span>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      )}

      {/* Submissions list */}
      <div className='mb-5 flex flex-wrap items-end justify-between gap-4'>
        <div>
          <div className='text-[23px] font-semibold tracking-[-.5px] text-[#131A26]'>
            Submissions
          </div>
          <div className='mt-0.5 text-[13px] font-medium text-[#8A9099]'>
            {countLabel}
          </div>
        </div>
        <div className='flex gap-2'>
          {assignment && isAcademic && (
            <button
              onClick={openEdit}
              className='rounded-[9px] bg-[#131A26] px-3.5 py-2 text-[13px] font-semibold text-white hover:bg-[#243247]'
            >
              Edit assignment
            </button>
          )}
          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            className='rounded-[9px] border border-[#DED8CA] bg-white px-[11px] py-2 text-[13px] text-[#2C3444]'
          >
            <option>All statuses</option>
            <option>Unmarked</option>
            <option>In progress</option>
            <option>Marked</option>
          </select>
        </div>
      </div>

      {submissions.length === 0 ? (
        <div className='rounded-[14px] border border-[#EAE5DB] bg-white p-12 text-center'>
          <FileText className='mx-auto h-10 w-10 text-[#8A9099]' />
          <div className='mt-3 text-[15px] font-semibold text-[#131A26]'>
            No submissions yet
          </div>
          <p className='mt-1 text-sm text-[#8A9099]'>
            Submissions will appear here once students hand in their work.
          </p>
        </div>
      ) : (
        <div className='overflow-hidden rounded-[14px] border border-[#EAE5DB] bg-white'>
          <div className='grid grid-cols-[1.9fr_1.1fr_.9fr_.8fr_.9fr] border-b border-[#EAE5DB] px-5 py-3 text-[10px] font-semibold uppercase tracking-[.85px] text-[#A29A8C]'>
            <span>Student</span>
            <span>Submitted</span>
            <span>Version</span>
            <span>Status</span>
            <span className='text-right'>Score</span>
          </div>
          {visible.length === 0 ? (
            <div className='px-5 py-8 text-center text-[13px] text-[#8A9099]'>
              No submissions match this filter.
            </div>
          ) : (
            visible.map((s) => {
              const st =
                STATUS_STYLES[s.marking_status ?? 'Unmarked'] ??
                STATUS_STYLES.Unmarked
              return (
                <div
                  key={s.id}
                  className='grid grid-cols-[1.9fr_1.1fr_.9fr_.8fr_.9fr] items-center border-b border-[#F0ECE4] px-5 py-[13px] last:border-b-0 hover:bg-[#FAF8F4]'
                >
                  <span className='text-[13px] font-semibold text-[#131A26]'>
                    {s.student_name}{' '}
                    <span className='ml-1 font-mono text-[12px] font-normal text-[#8A9099]'>
                      {s.student_number}
                    </span>
                  </span>
                  <span className='text-[12px] text-[#5A6070]'>
                    {formatWhen(s.submissionDateTime)}
                  </span>
                  <span className='font-mono text-[12px] text-[#5A6070]'>—</span>
                  <span>
                    <span
                      className='inline-block whitespace-nowrap rounded-[6px] px-2 py-0.5 text-[11px] font-semibold'
                      style={{ backgroundColor: st.bg, color: st.fg }}
                    >
                      {s.marking_status ?? 'Unmarked'}
                    </span>
                  </span>
                  <span className='flex items-center justify-end gap-2.5'>
                    <span className='font-mono text-[13px] font-semibold text-[#131A26]'>
                      {s.score != null ? `${s.score}/${s.total}` : '—'}
                    </span>
                    <button
                      onClick={() =>
                        router.push(`/assignments/${params.id}/mark/${s.id}`)
                      }
                      className='rounded-[9px] border border-[#DED8CA] bg-white px-[13px] py-1.5 text-[12px] font-semibold text-[#2C3444] hover:bg-[#F2EFE8]'
                    >
                      Mark
                    </button>
                  </span>
                </div>
              )
            })
          )}
        </div>
      )}

      {/* Edit assignment dialog */}
      <Dialog open={editOpen} onOpenChange={setEditOpen}>
        <DialogContent className='max-w-md gap-0 rounded-[14px] border-[#EAE5DB] bg-[#F5F3EF] p-0'>
          <div className='border-b border-[#EAE5DB] px-5 py-4 text-[15px] font-semibold tracking-[-.1px] text-[#131A26]'>
            Edit assignment
          </div>
          <div className='space-y-4 px-5 py-5'>
            <div>
              <label className='mb-1.5 block text-[13px] font-medium text-[#2C3444]'>
                Title
              </label>
              <input
                type='text'
                value={editTitle}
                onChange={(e) => setEditTitle(e.target.value)}
                className='w-full rounded-[9px] border border-[#DED8CA] bg-white px-3 py-1.5 text-[13px] focus:outline-none focus:ring-2 focus:ring-[#DED8CA]'
              />
            </div>
            <div>
              <label className='mb-1.5 block text-[13px] font-medium text-[#2C3444]'>
                Description
              </label>
              <textarea
                value={editDescription}
                onChange={(e) => setEditDescription(e.target.value)}
                rows={4}
                className='w-full resize-y rounded-[9px] border border-[#DED8CA] bg-white px-3 py-1.5 text-[13px] focus:outline-none focus:ring-2 focus:ring-[#DED8CA]'
              />
            </div>
            <div>
              <label className='mb-1.5 block text-[13px] font-medium text-[#2C3444]'>
                Website{' '}
                <span className='font-normal text-[#8A9099]'>(optional)</span>
              </label>
              <input
                type='url'
                value={editWebsite}
                onChange={(e) => setEditWebsite(e.target.value)}
                placeholder='https://…'
                className='w-full rounded-[9px] border border-[#DED8CA] bg-white px-3 py-1.5 text-[13px] focus:outline-none focus:ring-2 focus:ring-[#DED8CA]'
              />
            </div>
            <div>
              <label className='mb-1.5 block text-[13px] font-medium text-[#2C3444]'>
                Submission deadline
              </label>
              <input
                type='datetime-local'
                value={editDeadline}
                onChange={(e) => setEditDeadline(e.target.value)}
                className='w-full rounded-[9px] border border-[#DED8CA] bg-white px-3 py-1.5 text-[13px] focus:outline-none focus:ring-2 focus:ring-[#DED8CA]'
              />
            </div>
          </div>
          <div className='flex justify-end gap-2 border-t border-[#EAE5DB] px-5 py-4'>
            <button
              onClick={() => setEditOpen(false)}
              disabled={savingAssignment}
              className='rounded-[9px] border border-[#DED8CA] bg-white px-3.5 py-2 text-[13px] font-semibold text-[#2C3444] hover:bg-[#F2EFE8] disabled:opacity-50'
            >
              Cancel
            </button>
            <button
              onClick={saveAssignment}
              disabled={savingAssignment}
              className='inline-flex items-center rounded-[9px] bg-[#131A26] px-3.5 py-2 text-[13px] font-semibold text-white hover:bg-[#243247] disabled:cursor-not-allowed disabled:opacity-50'
            >
              {savingAssignment && (
                <Loader2 className='mr-1.5 h-3.5 w-3.5 animate-spin' />
              )}
              Save changes
            </button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  )
}
