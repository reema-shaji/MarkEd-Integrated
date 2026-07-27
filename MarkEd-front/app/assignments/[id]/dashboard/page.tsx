'use client'

import * as React from 'react'
import { useParams, useRouter } from 'next/navigation'
import {
  AssignmentSchema,
  DefaultService,
  PeerMatch,
  PeerReviewSchemaWithStudent,
} from '@/src/api'
import { Loader2, Users, CheckCircle2, Clock } from 'lucide-react'
import { toast } from 'sonner'
import { StatusDot } from '@/components/status-dot'
import { CountdownCard, calculateTimeLeft } from '@/components/countdown-card'
import { Skeleton } from '@/components/ui/skeleton'
import { useUser } from '@/src/contexts/user-context'

type ReviewerGroup = {
  reviewer: {
    name: string
    userNumber: string
    email: string
  }
  reviewing: {
    name: string
    userNumber: string
    email: string
    status: 'COMPLETED' | 'IN_PROGRESS' | 'PENDING'
  }[]
}

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

export default function DashboardPage() {
  const [assignment, setAssignment] = React.useState<AssignmentSchema | null>(
    null
  )
  const [isMatching, setIsMatching] = React.useState(false)
  const [matches, setMatches] = React.useState<PeerMatch[]>([])
  const [stats, setStats] = React.useState<AssignmentStatistics | null>(null)
  const [allocations, setAllocations] = React.useState<
    PeerReviewSchemaWithStudent[]
  >([])
  const [markQueue, setMarkQueue] = React.useState<
    { key: string; title: string; meta: string; href: string }[]
  >([])
  const params = useParams()
  const router = useRouter()
  const { user } = useUser()
  const isAcademic = user?.isAcademic ?? true

  React.useEffect(() => {
    const fetchData = async () => {
      try {
        const [assignmentData, statsData] = await Promise.all([
          DefaultService.getAssignment(Number(params.id)),
          DefaultService.getAssignmentStatistics(Number(params.id)),
        ])
        setAssignment(assignmentData as AssignmentSchema)
        setStats(statsData as AssignmentStatistics)
      } catch (error) {
        console.error('Failed to fetch data:', error)
        toast.error('Failed to load dashboard data')
      }
    }

    if (params.id) {
      fetchData()
      DefaultService.getMatchedPeers(Number(params.id)).then(setMatches)
      // Markers/TAs see their own marking allocation, not the academic view.
      DefaultService.getMarkerAllocations(Number(params.id))
        .then(setAllocations)
        .catch(() => {})
    }
  }, [params.id])

  // Marker/TA marking queue: the actual submissions to mark for this
  // assignment (group submissions for a group assignment, individual otherwise)
  // — not peer-review allocations, which are empty for non-peer marking.
  React.useEffect(() => {
    if (!assignment || !user || user.isAcademic) return
    const id = Number(params.id)
    const load = async () => {
      if (assignment.assignment_type === 'GROUP') {
        const subs = await DefaultService.listGroupSubmissions(id).catch(() => [])
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

  const handleMatchPeers = async () => {
    setIsMatching(true)
    try {
      const response = await DefaultService.triggerPeerReviewMatching(
        Number(params.id)
      )
      if (response.success) {
        toast.success('Peer matching completed successfully')
        setMatches(response.matches || [])
        const updatedAssignment = await DefaultService.getAssignment(
          Number(params.id)
        )
        setAssignment(updatedAssignment as AssignmentSchema)
      } else {
        throw new Error(response.message)
      }
    } catch (error: unknown) {
      const errorMessage =
        error instanceof Error ? error.message : 'Unknown error occurred'
      toast.error('Failed to match peers: ' + errorMessage)
    } finally {
      setIsMatching(false)
    }
  }

  if (!assignment || !stats) {
    return (
      <div className='mx-auto w-full max-w-[1200px] px-7 pb-12 pt-8'>
        <Skeleton className='mb-5 h-7 w-48' />
        <div className='mb-5 grid grid-cols-2 gap-4 md:grid-cols-4'>
          {Array.from({ length: 4 }).map((_, i) => (
            <div
              key={i}
              className='rounded-[14px] border border-[#EAE5DB] bg-white p-5'
            >
              <Skeleton className='h-3 w-24' />
              <Skeleton className='mt-3 h-7 w-16' />
            </div>
          ))}
        </div>
        <Skeleton className='mb-5 h-40 w-full rounded-[14px]' />
        <Skeleton className='h-64 w-full rounded-[14px]' />
      </div>
    )
  }

  // --- Marker / TA dashboard: the real marking queue for this assignment ---
  if (!isAcademic) {
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

  // --- Academic dashboard --------------------------------------------------
  const submissionRows = [
    { label: 'On time', value: stats.submission_on_time, color: '#2F7D4F' },
    { label: 'Late', value: stats.submission_late, color: '#C9862A' },
    { label: 'Missing', value: stats.submission_missing, color: '#B4483C' },
  ]
  const submissionTotal = stats.expected_submissions || 1
  const gradeBands = ['0-39', '40-49', '50-59', '60-69', '70+']
  const gradeCounts = gradeBands.map((b) => stats.grade_distribution?.[b] ?? 0)
  const gradeMax = Math.max(1, ...gradeCounts)
  const graded = gradeCounts.reduce((a, b) => a + b, 0)

  // Accurate submission summary for the Overview section. Uses the same
  // on-time/late/expected numbers the Submission Statistics card is built
  // from, so the sentence never contradicts the stat cards.
  const submittedCount = stats.submission_on_time + stats.submission_late
  const submitterNoun =
    assignment.assignment_type === 'GROUP' ? 'groups' : 'students'
  const submissionSummary =
    stats.expected_submissions <= 0
      ? `${submittedCount} ${submitterNoun} submitted`
      : submittedCount >= stats.expected_submissions
        ? `All ${submitterNoun} submitted (${submittedCount} of ${stats.expected_submissions})`
        : `${submittedCount} of ${stats.expected_submissions} ${submitterNoun} submitted`

  // The stat strip only shows the peer-review card when PR is enabled, and the
  // fourth card only when SA or PR is enabled — so the grid width must adapt.
  const statCardCount =
    2 +
    (assignment.peer_review_enabled ? 1 : 0) +
    (stats.self_assessment_enabled || assignment.peer_review_enabled ? 1 : 0)
  const statGridColsClass =
    statCardCount >= 4
      ? 'md:grid-cols-4'
      : statCardCount === 3
        ? 'md:grid-cols-3'
        : 'md:grid-cols-2'

  return (
    <div className='mx-auto w-full max-w-[1200px] px-7 pb-12 pt-8'>
      {/* 4-up stat strip */}
      <div
        className={`mb-5 grid grid-cols-2 divide-x divide-y divide-[#F0ECE4] overflow-hidden rounded-[14px] border border-[#EAE5DB] bg-white md:divide-y-0 ${statGridColsClass}`}
      >
        <div className='px-5 py-[18px]'>
          <div className='text-[10px] font-semibold uppercase tracking-[.85px] text-[#A29A8C]'>
            Submissions
          </div>
          <div className='mt-[5px] text-[26px] font-semibold tracking-[-.7px] text-[#131A26]'>
            {stats.total_submissions}
            <span className='text-[15px] font-medium text-[#A29A8C]'>
              {' '}
              · {stats.unique_submitters} students
            </span>
          </div>
        </div>

        <div className='px-5 py-[18px]'>
          <div className='text-[10px] font-semibold uppercase tracking-[.85px] text-[#A29A8C]'>
            Active Users
          </div>
          <div className='mt-[5px] text-[26px] font-semibold tracking-[-.7px] text-[#131A26]'>
            {stats.active_users_24h}
          </div>
          <div className='mt-0.5 text-[11.5px] text-[#8A9099]'>last 24h</div>
        </div>

        {assignment.peer_review_enabled && (
          <div className='px-5 py-[18px]'>
            <div className='text-[10px] font-semibold uppercase tracking-[.85px] text-[#A29A8C]'>
              Review progress
            </div>
            <div className='mt-[5px] text-[26px] font-semibold tracking-[-.7px] text-[#131A26]'>
              {stats.completion_rate}%
            </div>
            <div className='mt-[9px] h-1 overflow-hidden rounded-full bg-[#F0ECE4]'>
              <div
                className='h-full rounded-full bg-[#2F7D4F]'
                style={{ width: `${stats.completion_rate}%` }}
              />
            </div>
          </div>
        )}

        {(stats.self_assessment_enabled || assignment.peer_review_enabled) && (
          <div className='px-5 py-[18px]'>
            {stats.self_assessment_enabled ? (
            <>
              <div className='text-[10px] font-semibold uppercase tracking-[.85px] text-[#A29A8C]'>
                Self-assessments
              </div>
              <div className='mt-[5px] text-[26px] font-semibold tracking-[-.7px] text-[#131A26]'>
                {stats.self_assessment_submitted}
                <span className='text-[15px] font-medium text-[#A29A8C]'>
                  {' '}
                  / {stats.enrolled_students}
                </span>
              </div>
            </>
          ) : (
            <>
              <div className='text-[10px] font-semibold uppercase tracking-[.85px] text-[#A29A8C]'>
                Reviews / student
              </div>
              <div className='mt-[5px] text-[26px] font-semibold tracking-[-.7px] text-[#131A26]'>
                {stats.average_reviews_per_student}
                <span className='text-[15px] font-medium text-[#A29A8C]'>
                  {' '}
                  avg
                </span>
              </div>
            </>
            )}
          </div>
        )}
      </div>

      {/* Overview */}
      <div className='mb-5 rounded-[14px] border border-[#EAE5DB] bg-white p-6'>
        <div className='mb-2 text-[15px] font-semibold tracking-[-.1px] text-[#131A26]'>
          Overview
        </div>
        <p className='mb-2 text-sm text-[#5A6070]'>
          {assignment.assignmentDescription}
        </p>
        <p className='mb-4 text-sm font-medium text-[#131A26]'>
          {submissionSummary}
        </p>
        <div className='grid grid-cols-1 gap-6 md:grid-cols-2'>
          <CountdownCard
            title='Submission Deadline'
            deadline={new Date(assignment.deadline)}
            startDate={
              assignment.release_date
                ? new Date(assignment.release_date)
                : undefined
            }
            showTimeZone={false}
          />

          {assignment.peer_review_enabled && assignment.review_deadline && (
            <CountdownCard
              title='Peer Reviewing Period'
              deadline={new Date(assignment.review_deadline)}
              startDate={new Date(assignment.deadline)}
              showTimeZone={false}
              isActive={
                !calculateTimeLeft(new Date(assignment.deadline)) &&
                assignment.is_peer_review_matching_complete
              }
            />
          )}
        </div>
      </div>

      {/* Submission statistics + grade distribution */}
      <div className='mb-5 grid grid-cols-1 gap-4 md:grid-cols-2'>
        <div className='rounded-[14px] border border-[#EAE5DB] bg-white p-5'>
          <div className='text-sm font-semibold tracking-[-.05px] text-[#131A26]'>
            Submission Statistics
          </div>
          <div className='mb-3.5 mt-0.5 text-xs text-[#8A9099]'>
            Out of {stats.expected_submissions}{' '}
            {assignment.assignment_type === 'GROUP' ? 'groups' : 'students'}
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

      {/* Peer Review Matches — only relevant when peer review is enabled */}
      {assignment.peer_review_enabled && (
      <div className='rounded-[14px] border border-[#EAE5DB] bg-white p-6'>
        <div className='flex flex-wrap items-center justify-between gap-3'>
          <div className='text-[15px] font-semibold tracking-[-.1px] text-[#131A26]'>
            Peer Review Matches — {assignment.assignmentTitle}
          </div>
          <button
            onClick={handleMatchPeers}
            disabled={isMatching || assignment.is_peer_review_matching_complete}
            className='inline-flex items-center rounded-[9px] bg-[#131A26] px-4 py-2.5 text-[13px] font-semibold text-white hover:bg-[#243247] disabled:cursor-not-allowed disabled:opacity-50'
          >
            {isMatching ? (
              <>
                <Loader2 className='mr-2 h-4 w-4 animate-spin' />
                Matching Peers...
              </>
            ) : assignment.is_peer_review_matching_complete ? (
              'Peer Matching Complete'
            ) : (
              'Match Peers'
            )}
          </button>
        </div>

        {matches.length > 0 ? (
          <div className='mt-4 space-y-4'>
            <div className='grid grid-cols-1 gap-3 sm:grid-cols-3'>
              <div className='flex items-center gap-3 rounded-[12px] border border-[#CBE3D3] bg-[#EFF6F1] p-3'>
                <CheckCircle2 className='h-5 w-5 shrink-0 text-[#22c55e]' />
                <span>
                  <span className='block text-[13px] font-medium text-[#2A6B43]'>
                    Completed
                  </span>
                  <span className='block text-[20px] font-bold text-[#14532d]'>
                    {stats.peer_review_stats.COMPLETED || 0}
                  </span>
                </span>
              </div>
              <div className='flex items-center gap-3 rounded-[12px] border border-[#EBD9AE] bg-[#FBF4E3] p-3'>
                <Clock className='h-5 w-5 shrink-0 text-[#eab308]' />
                <span>
                  <span className='block text-[13px] font-medium text-[#8A5D14]'>
                    In Progress
                  </span>
                  <span className='block text-[20px] font-bold text-[#6E4A10]'>
                    {stats.peer_review_stats.IN_PROGRESS || 0}
                  </span>
                </span>
              </div>
              <div className='flex items-center gap-3 rounded-[12px] border border-[#E3DFD5] bg-[#F2EEE6] p-3'>
                <Clock className='h-5 w-5 shrink-0 text-[#8A9099]' />
                <span>
                  <span className='block text-[13px] font-medium text-[#454C5C]'>
                    Not Started
                  </span>
                  <span className='block text-[20px] font-bold text-[#131A26]'>
                    {stats.peer_review_stats.PENDING || 0}
                  </span>
                </span>
              </div>
            </div>
            {Array.from(
              matches.reduce((acc, match) => {
                const key = `${match.reviewer_name}-${match.reviewer_userNumber}`
                if (!acc.has(key)) {
                  acc.set(key, {
                    reviewer: {
                      name: match.reviewer_name,
                      userNumber: match.reviewer_userNumber,
                      email: match.reviewer_email,
                    },
                    reviewing: [],
                  })
                }
                acc.get(key)!.reviewing.push({
                  name: match.submission_owner_name,
                  userNumber: match.submission_owner_userNumber,
                  email: match.submission_owner_email,
                  status: match.status as
                    | 'COMPLETED'
                    | 'IN_PROGRESS'
                    | 'PENDING',
                })
                return acc
              }, new Map<string, ReviewerGroup>())
            ).map(([key, data]) => (
              <div
                key={key}
                className='rounded-[11px] border border-[#EAE5DB] bg-[#FAF8F4] p-4'
              >
                <div className='flex items-start justify-between gap-4'>
                  <div className='w-1/3'>
                    <div className='text-[15px] font-semibold text-[#131A26]'>
                      {data.reviewer.name}
                      <span className='mt-px block font-mono text-xs text-[#8A9099]'>
                        {data.reviewer.userNumber}
                      </span>
                    </div>
                  </div>
                  <div className='w-2/3 space-y-2'>
                    <div className='mb-2 text-[12px] text-[#8A9099]'>
                      is reviewing:
                    </div>
                    {data.reviewing.map((reviewee, idx) => (
                      <div key={idx} className='flex items-center gap-3'>
                        <StatusDot status={reviewee.status} />
                        <div className='text-[13px] text-[#131A26]'>
                          {reviewee.name}
                          <span className='ml-2 font-mono text-xs text-[#8A9099]'>
                            {reviewee.userNumber}
                          </span>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            ))}
          </div>
        ) : (
          <div className='flex flex-col items-center justify-center gap-4 py-12 text-center'>
            <Users className='h-12 w-12 text-[#8A9099]' />
            <div className='max-w-md'>
              <h3 className='text-[15px] font-semibold text-[#131A26]'>
                No Peer Matches Yet
              </h3>
              <p className='mt-1 text-sm text-[#5A6070]'>
                Use the &apos;Match Peers&apos; button above to automatically
                assign peer reviews to students who have submitted their work.
              </p>
            </div>
          </div>
        )}
      </div>
      )}
    </div>
  )
}
