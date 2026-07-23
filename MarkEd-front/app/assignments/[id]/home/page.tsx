'use client'

import React from 'react'
import { useParams } from 'next/navigation'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Loader2 } from 'lucide-react'
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
      }
    }

    if (params.id) {
      fetchData()
    }
  }, [params.id])

  if (!assignment) {
    return (
      <div className='flex min-h-screen items-center justify-center'>
        <Loader2 className='h-8 w-8 animate-spin' />
      </div>
    )
  }

  return (
    <div className='container mx-auto space-y-6 py-6'>
      <Card className='mx-auto max-w-3xl'>
        <CardHeader>
          <CardTitle className='text-2xl'>
            {assignment.assignmentTitle}
          </CardTitle>
        </CardHeader>
        <CardContent className='space-y-6'>
          <p className='text-muted-foreground'>
            {assignment.assignmentDescription}
          </p>

          <div className='grid grid-cols-1 gap-6 md:grid-cols-2'>
            <CountdownCard
              title='Submission Deadline'
              deadline={new Date(assignment.deadline)}
              startDate={new Date(assignment.release_date)}
            />

            {assignment.assignment_type === 'PEER_REVIEW' &&
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
            <p className='text-center text-sm text-muted-foreground'>
              Check the sidebar for instruction files
            </p>
          )}
        </CardContent>
      </Card>
    </div>
  )
}
