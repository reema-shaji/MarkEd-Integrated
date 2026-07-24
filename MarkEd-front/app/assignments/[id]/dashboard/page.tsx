'use client'

import * as React from 'react'
import { useParams } from 'next/navigation'
import { Button } from '@/components/ui/button'
import { AssignmentSchema, DefaultService, PeerMatch } from '@/src/api'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Loader2, Users, CheckCircle2, Clock } from 'lucide-react'
import { toast } from 'sonner'
import { StatusDot } from '@/components/status-dot'
import { CountdownCard, calculateTimeLeft } from '@/components/countdown-card'
import { Progress } from '@/components/ui/progress'
import { Skeleton } from '@/components/ui/skeleton'

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
}

export default function DashboardPage() {
  const [assignment, setAssignment] = React.useState<AssignmentSchema | null>(
    null
  )
  const [isMatching, setIsMatching] = React.useState(false)
  const [matches, setMatches] = React.useState<PeerMatch[]>([])
  const [stats, setStats] = React.useState<AssignmentStatistics | null>(null)
  const params = useParams()

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
      <div className='mx-auto w-full max-w-4xl space-y-5 p-6'>
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

  return (
    <div className='mx-auto w-full max-w-4xl space-y-5 p-6'>
      <h1 className='text-2xl font-bold'>Staff Dashboard</h1>

      {/* Statistics Cards */}
      <div className='grid grid-cols-2 gap-4 md:grid-cols-4'>
        <Card>
          <CardContent className='p-4'>
            <div className='text-xs font-medium text-neutral-500'>
              Total Submissions
            </div>
            <div className='mt-1 text-2xl font-bold'>
              {stats.unique_submitters}
            </div>
            <p className='mt-1 text-xs text-neutral-400'>
              {stats.total_submissions} total uploads
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardContent className='p-4'>
            <div className='text-xs font-medium text-neutral-500'>
              Active Users
            </div>
            <div className='mt-1 text-2xl font-bold'>
              {stats.active_users_24h}
            </div>
            <p className='mt-1 text-xs text-neutral-400'>in the last 24 hours</p>
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
            <p className='mt-2 text-xs text-neutral-400'>
              {stats.peer_review_stats.COMPLETED || 0} of{' '}
              {stats.total_peer_reviews} completed
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardContent className='p-4'>
            <div className='text-xs font-medium text-neutral-500'>
              Reviews Per Student
            </div>
            <div className='mt-1 text-2xl font-bold'>
              {stats.average_reviews_per_student}
            </div>
            <p className='mt-1 text-xs text-neutral-400'>
              average reviews assigned
            </p>
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
        <CardHeader className='flex flex-row items-center justify-between'>
          <CardTitle className='text-base font-semibold'>
            Peer Review Matches
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
              <div className='grid grid-cols-3 gap-4'>
                <div className='rounded-lg border p-4 shadow-sm transition-colors hover:bg-accent/50'>
                  <div className='flex flex-col items-center space-y-2'>
                    <CheckCircle2 className='h-8 w-8 text-green-500' />
                    <span className='text-sm font-medium'>Completed</span>
                    <span className='text-2xl font-bold'>
                      {stats.peer_review_stats.COMPLETED || 0}
                    </span>
                  </div>
                </div>
                <div className='rounded-lg border p-4 shadow-sm transition-colors hover:bg-accent/50'>
                  <div className='flex flex-col items-center space-y-2'>
                    <Clock className='h-8 w-8 text-yellow-500' />
                    <span className='text-sm font-medium'>In Progress</span>
                    <span className='text-2xl font-bold'>
                      {stats.peer_review_stats.IN_PROGRESS || 0}
                    </span>
                  </div>
                </div>
                <div className='rounded-lg border p-4 shadow-sm transition-colors hover:bg-accent/50'>
                  <div className='flex flex-col items-center space-y-2'>
                    <Clock className='h-8 w-8 text-gray-400' />
                    <span className='text-sm font-medium'>Not Started</span>
                    <span className='text-2xl font-bold'>
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
