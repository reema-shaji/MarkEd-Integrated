'use client'

import React from 'react'
import { useParams } from 'next/navigation'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Skeleton } from '@/components/ui/skeleton'
import { toast } from 'sonner'
import { AssignmentSchema, DefaultService } from '@/src/api'
import { CountdownCard } from '@/components/countdown-card'

function calculateTimeLeft(targetDate: Date) {
  const now = new Date()
  const difference = targetDate.getTime() - now.getTime()

  if (difference <= 0) return null

  const days = Math.floor(difference / (1000 * 60 * 60 * 24))
  const hours = Math.floor(
    (difference % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60)
  )
  const minutes = Math.floor((difference % (1000 * 60 * 60)) / (1000 * 60))
  const seconds = Math.floor((difference % (1000 * 60)) / 1000)

  return { days, hours, minutes, seconds }
}

export default function AssignmentHomePage() {
  const [assignment, setAssignment] = React.useState<AssignmentSchema | null>(
    null
  )
  const params = useParams()

  React.useEffect(() => {
    const fetchData = async () => {
      try {
        const assignmentData = await DefaultService.getAssignment(
          Number(params.id)
        )
        setAssignment(assignmentData)
      } catch (error) {
        console.error('Error fetching data:', error)
        toast.error('Failed to load assignment')
      }
    }

    if (params.id) {
      fetchData()
    }
  }, [params.id])

  if (!assignment) {
    return (
      <div className='mx-auto w-full max-w-2xl space-y-4 p-6'>
        <Card>
          <CardHeader>
            <Skeleton className='h-7 w-64' />
          </CardHeader>
          <CardContent className='space-y-6'>
            <Skeleton className='h-4 w-full' />
            <Skeleton className='h-4 w-3/4' />
            <div className='grid grid-cols-1 gap-6 md:grid-cols-2'>
              <Skeleton className='h-28 w-full rounded-lg' />
              <Skeleton className='h-28 w-full rounded-lg' />
            </div>
          </CardContent>
        </Card>
      </div>
    )
  }

  return (
    <div className='mx-auto w-full max-w-2xl space-y-4 p-6'>
      <Card>
        <CardHeader>
          <div className='flex flex-wrap items-center gap-2'>
            <CardTitle className='text-2xl font-bold'>
              {assignment.assignmentTitle}
            </CardTitle>
            {assignment.peer_review_enabled && (
              <Badge variant='secondary'>Peer Review</Badge>
            )}
          </div>
        </CardHeader>
        <CardContent className='space-y-6'>
          <p className='text-sm text-neutral-500'>
            {assignment.assignmentDescription}
          </p>

          <div className='grid grid-cols-1 gap-6 md:grid-cols-2'>
            <CountdownCard
              title='Submission Deadline'
              deadline={new Date(assignment.deadline)}
              startDate={assignment.release_date ? new Date(assignment.release_date) : undefined}
            />

            {assignment.peer_review_enabled &&
              assignment.review_deadline && (
                <CountdownCard
                  title='Peer Reviewing Period'
                  deadline={new Date(assignment.review_deadline)}
                  startDate={new Date(assignment.deadline)}
                  isActive={
                    !calculateTimeLeft(new Date(assignment.deadline)) &&
                    assignment.is_peer_review_matching_complete
                  }
                />
              )}
          </div>

          {assignment.assignment_instructions && (
            <p className='text-center text-sm text-neutral-400'>
              Check the sidebar for instruction files
            </p>
          )}
        </CardContent>
      </Card>
    </div>
  )
}
