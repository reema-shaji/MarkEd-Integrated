'use client'

import * as React from 'react'
import { useParams, useRouter } from 'next/navigation'
import { Button } from '@/components/ui/button'
import {
  AssignmentSchema,
  DefaultService,
  PeerMatch,
  PeerReviewSchemaWithStudent,
} from '@/src/api'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Loader2, Users, CheckCircle2, Clock } from 'lucide-react'
import { toast } from 'sonner'
import { StatusDot } from '@/components/status-dot'
import { CountdownCard, calculateTimeLeft } from '@/components/countdown-card'
import { Progress } from '@/components/ui/progress'
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
      <div className='mx-auto w-full max-w-3xl space-y-5 p-6'>
        <Skeleton className='h-8 w-56' />
        <div className='grid grid-cols-2 gap-4 md:grid-cols-4'>
          {Array.from({ length: 4 }).map((_, i) => (
            <Card key={i}>
              <CardContent className='p-4'>
                <Skeleton className='h-3 w-24' />
                <Skeleton className='mt-3 h-7 w-16' />
                <Skeleton className='mt-3 h-3 w-28' />
              </CardContent>
            </Card>
          ))}
        </div>
        <Skeleton className='h-40 w-full rounded-lg' />
        <Skeleton className='h-64 w-full rounded-lg' />
      </div>
    )
  }

  // --- Marker / TA dashboard: their own marking allocation and queue -------
  if (!isAcademic) {
    const marked = allocations.filter((a) => a.status === 'COMPLETED').length
    const pending = allocations.length - marked
    return (
      <div className='mx-auto w-full max-w-3xl space-y-5 p-6'>
        <h1 className='text-2xl font-bold'>Marker Dashboard</h1>
        <p className='-mt-3 text-sm text-neutral-500'>{assignment.assignmentTitle}</p>

        <div className='grid grid-cols-2 gap-4 md:grid-cols-3'>
          <Card>
            <CardContent className='p-4'>
              <div className='text-xs font-medium text-neutral-500'>My Marking Allocation</div>
              <div className='mt-1 text-2xl font-bold'>{allocations.length}</div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className='p-4'>
              <div className='text-xs font-medium text-neutral-500'>Marked</div>
              <div className='mt-1 text-2xl font-bold'>
                {marked}
                <span className='ml-1 text-sm font-medium text-neutral-400'>
                  /{allocations.length}
                </span>
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className='p-4'>
              <div className='text-xs font-medium text-neutral-500'>Pending</div>
              <div className='mt-1 text-2xl font-bold'>{pending}</div>
            </CardContent>
          </Card>
        </div>

        <Card>
          <CardHeader className='pb-2'>
            <CardTitle className='text-base font-semibold'>Marking Queue</CardTitle>
          </CardHeader>
          <CardContent>
            {allocations.length === 0 ? (
              <p className='py-8 text-center text-sm text-neutral-400'>
                Nothing allocated to you yet. Once submissions are matched to
                markers, they appear here.
              </p>
            ) : (
              <div className='divide-y divide-neutral-100'>
                {allocations.map((a) => (
                  <div key={a.id} className='flex items-center justify-between py-2.5'>
                    <div className='flex items-center gap-2.5'>
                      <StatusDot
                        status={
                          a.status as 'COMPLETED' | 'IN_PROGRESS' | 'PENDING'
                        }
                      />
                      <span className='text-sm font-medium'>{a.student_name}</span>
                      <span className='font-mono text-xs text-neutral-400'>
                        {a.student_number}
                      </span>
                    </div>
                    <Button
                      size='sm'
                      variant='outline'
                      onClick={() =>
                        router.push(
                          `/assignments/${params.id}/mark/${a.submission_id}`
                        )
                      }
                    >
                      {a.status === 'COMPLETED' ? 'Review' : 'Mark'}
                    </Button>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    )
  }

  return (
    <div className='mx-auto w-full max-w-3xl space-y-5 p-6'>
      <h1 className='text-2xl font-bold'>Staff Dashboard</h1>

      {/* Statistics Cards */}
      <div className='grid grid-cols-2 gap-4 md:grid-cols-4'>
        <Card>
          <CardContent className='p-4'>
            <div className='text-xs font-medium text-neutral-500'>
              Total Submissions
            </div>
            <div className='mt-1 text-2xl font-bold'>
              {stats.total_submissions}
              <span className='ml-1 text-sm font-medium text-neutral-400'>
                · {stats.unique_submitters} students
              </span>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className='p-4'>
            <div className='text-xs font-medium text-neutral-500'>
              Active Users
            </div>
            <div className='mt-1 text-2xl font-bold'>
              {stats.active_users_24h}
              <span className='ml-1 text-sm font-medium text-neutral-400'>
                · last 24h
              </span>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className='p-4'>
            <div className='text-xs font-medium text-neutral-500'>
              Review Progress
            </div>
            <div className='mt-1 text-2xl font-bold'>
              {stats.completion_rate}%
            </div>
            <Progress value={stats.completion_rate} className='mt-2 h-2' />
          </CardContent>
        </Card>

        <Card>
          <CardContent className='p-4'>
            {stats.self_assessment_enabled ? (
              <>
                <div className='text-xs font-medium text-neutral-500'>
                  SA Submitted
                </div>
                <div className='mt-1 text-2xl font-bold'>
                  {stats.self_assessment_submitted}
                  <span className='ml-1 text-sm font-medium text-neutral-400'>
                    /{stats.enrolled_students}
                  </span>
                </div>
              </>
            ) : (
              <>
                <div className='text-xs font-medium text-neutral-500'>
                  Reviews Per Student
                </div>
                <div className='mt-1 text-2xl font-bold'>
                  {stats.average_reviews_per_student}
                  <span className='ml-1 text-sm font-medium text-neutral-400'>
                    · avg
                  </span>
                </div>
              </>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Submission statistics + grade distribution (prototype Academic Dashboard) */}
      <div className='grid grid-cols-1 gap-4 md:grid-cols-2'>
        <Card>
          <CardHeader className='pb-2'>
            <CardTitle className='text-base font-semibold'>
              Submission Statistics
            </CardTitle>
          </CardHeader>
          <CardContent>
            {(() => {
              const total = stats.expected_submissions || 1
              const rows = [
                { label: 'On time', value: stats.submission_on_time, cls: 'bg-green-500' },
                { label: 'Late', value: stats.submission_late, cls: 'bg-amber-500' },
                { label: 'Missing', value: stats.submission_missing, cls: 'bg-neutral-300' },
              ]
              return (
                <div className='space-y-3'>
                  {rows.map((r) => (
                    <div key={r.label}>
                      <div className='mb-1 flex items-center justify-between text-sm'>
                        <span className='text-neutral-600'>{r.label}</span>
                        <span className='font-medium tabular-nums'>{r.value}</span>
                      </div>
                      <div className='h-2 overflow-hidden rounded-full bg-neutral-100'>
                        <div
                          className={`h-full ${r.cls}`}
                          style={{ width: `${(r.value / total) * 100}%` }}
                        />
                      </div>
                    </div>
                  ))}
                  <p className='pt-1 text-xs text-neutral-400'>
                    Out of {stats.expected_submissions}{' '}
                    {assignment.assignment_type === 'GROUP' ? 'groups' : 'students'}.
                  </p>
                </div>
              )
            })()}
          </CardContent>
        </Card>

        <Card>
          <CardHeader className='pb-2'>
            <CardTitle className='text-base font-semibold'>
              Grade Distribution
            </CardTitle>
          </CardHeader>
          <CardContent>
            {(() => {
              const bands = ['0-39', '40-49', '50-59', '60-69', '70+']
              const counts = bands.map((b) => stats.grade_distribution?.[b] ?? 0)
              const max = Math.max(1, ...counts)
              const graded = counts.reduce((a, b) => a + b, 0)
              return graded === 0 ? (
                <p className='py-8 text-center text-sm text-neutral-400'>
                  No marks yet — the histogram fills in as work is graded.
                </p>
              ) : (
                <div className='flex h-40 items-end justify-between gap-2'>
                  {bands.map((b, i) => (
                    <div key={b} className='flex flex-1 flex-col items-center gap-1'>
                      <div className='text-xs font-medium tabular-nums'>{counts[i]}</div>
                      <div
                        className='w-full rounded-t bg-neutral-800'
                        style={{ height: `${(counts[i] / max) * 100}%`, minHeight: counts[i] ? 4 : 0 }}
                      />
                      <div className='text-[11px] text-neutral-500'>{b}</div>
                    </div>
                  ))}
                </div>
              )
            })()}
          </CardContent>
        </Card>
      </div>

      {/* Assignment overview */}
      <Card className='w-full'>
        <CardHeader>
          <CardTitle className='text-base font-semibold'>
            {assignment.assignmentTitle}
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className='space-y-4'>
            <p className='text-sm text-neutral-500'>
              {assignment.assignmentDescription}
            </p>

            <div className='grid grid-cols-1 gap-6 md:grid-cols-2'>
              <CountdownCard
                title='Submission Deadline'
                deadline={new Date(assignment.deadline)}
                startDate={assignment.release_date ? new Date(assignment.release_date) : undefined}
                showTimeZone={false}
              />

              {assignment.peer_review_enabled &&
                assignment.review_deadline && (
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
        </CardContent>
      </Card>

      <Card>
        <CardHeader className='flex flex-row items-center justify-between gap-4'>
          <CardTitle className='text-base font-semibold'>
            Peer Review Matches — {assignment.assignmentTitle}
          </CardTitle>
          <Button
            onClick={handleMatchPeers}
            disabled={isMatching || assignment.is_peer_review_matching_complete}
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
          </Button>
        </CardHeader>
        <CardContent>
          {matches.length > 0 ? (
            <div className='space-y-4'>
              <div className='grid grid-cols-1 gap-3 sm:grid-cols-3'>
                <div className='flex items-center gap-3 rounded-lg border border-green-200 bg-green-50 p-3'>
                  <CheckCircle2 className='h-5 w-5 shrink-0 text-green-600' />
                  <div>
                    <span className='block text-xs font-medium text-green-800'>
                      Completed
                    </span>
                    <span className='block text-xl font-bold text-green-900'>
                      {stats.peer_review_stats.COMPLETED || 0}
                    </span>
                  </div>
                </div>
                <div className='flex items-center gap-3 rounded-lg border border-yellow-200 bg-yellow-50 p-3'>
                  <Clock className='h-5 w-5 shrink-0 text-yellow-600' />
                  <div>
                    <span className='block text-xs font-medium text-yellow-800'>
                      In Progress
                    </span>
                    <span className='block text-xl font-bold text-yellow-900'>
                      {stats.peer_review_stats.IN_PROGRESS || 0}
                    </span>
                  </div>
                </div>
                <div className='flex items-center gap-3 rounded-lg border border-neutral-200 bg-neutral-50 p-3'>
                  <Clock className='h-5 w-5 shrink-0 text-neutral-400' />
                  <div>
                    <span className='block text-xs font-medium text-neutral-600'>
                      Not Started
                    </span>
                    <span className='block text-xl font-bold text-neutral-800'>
                      {stats.peer_review_stats.PENDING || 0}
                    </span>
                  </div>
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
                <Card key={key} className='border shadow-sm'>
                  <CardContent className='p-4'>
                    <div className='flex items-start justify-between'>
                      <div className='w-1/3'>
                        <div className='text-lg font-medium'>
                          {data.reviewer.name}
                          <span className='block text-sm text-muted-foreground'>
                            {data.reviewer.userNumber}
                          </span>
                        </div>
                      </div>
                      <div className='w-2/3 space-y-2'>
                        <div className='mb-2 text-sm text-muted-foreground'>
                          is reviewing:
                        </div>
                        {data.reviewing.map((reviewee, idx) => (
                          <div
                            key={idx}
                            className='flex items-center space-x-3'
                          >
                            <StatusDot status={reviewee.status} />
                            <div>
                              {reviewee.name}
                              <span className='ml-2 text-sm text-muted-foreground'>
                                {reviewee.userNumber}
                              </span>
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          ) : (
            <div className='flex flex-col items-center justify-center space-y-4 py-12 text-center'>
              <Users className='h-12 w-12 text-muted-foreground' />
              <div className='max-w-md'>
                <h3 className='text-lg font-semibold'>No Peer Matches Yet</h3>
                <p className='text-sm text-muted-foreground'>
                  Use the &apos;Match Peers&apos; button above to automatically
                  assign peer reviews to students who have submitted their work.
                </p>
              </div>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  )
}
