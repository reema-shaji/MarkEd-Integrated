'use client'

/**
 * Assignments page — the landing page after login (Design PRD §3.1, §6.1).
 *
 * This is Hao and Mingyue's home-page pattern: browse the selected course's
 * assignments as cards and click one to enter its tools. Each card carries the
 * contextual indicators their dashboards showed (§5.1/§5.2) rather than raw
 * type labels — group info from Hao, peer review phase from Tomas, and
 * self-assessment status from Mingyue.
 */

import { useEffect, useMemo, useState } from 'react'
import { useRouter } from 'next/navigation'
import { AssignmentSchema, DefaultService, GroupSetSchema } from '@/src/api'
import { useUser } from '@/src/contexts/user-context'
import { useCourse } from '@/src/contexts/course-context'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Skeleton } from '@/components/ui/skeleton'
import {
  CalendarClock,
  ClipboardCheck,
  Plus,
  Users,
  Users2,
} from 'lucide-react'
import { toast } from 'sonner'

/** Which stage of the peer review lifecycle an assignment is in (Tomas). */
function peerReviewPhase(a: AssignmentSchema): string | null {
  if (!a.peer_review_enabled) return null
  const now = Date.now()
  if (now < new Date(a.deadline).getTime()) return 'Submission open'
  if (!a.is_peer_review_matching_complete) return 'Awaiting matching'
  if (a.review_deadline && now < new Date(a.review_deadline).getTime())
    return 'Review open'
  return 'Reviews closed'
}

function formatDate(value: string) {
  return new Date(value).toLocaleDateString(undefined, {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  })
}

function deadlineLabel(deadline: string) {
  const diff = new Date(deadline).getTime() - Date.now()
  if (diff < 0) return { text: `Closed ${formatDate(deadline)}`, overdue: true }
  const days = Math.ceil(diff / 86_400_000)
  return {
    text: `Due ${formatDate(deadline)}${days <= 7 ? ` · ${days}d left` : ''}`,
    overdue: false,
  }
}

export default function AssignmentsPage() {
  const router = useRouter()
  const { user } = useUser()
  const { currentCourse, currentCourseId, isLoading: coursesLoading } = useCourse()

  const [assignments, setAssignments] = useState<AssignmentSchema[]>([])
  const [groupSets, setGroupSets] = useState<GroupSetSchema[]>([])
  const [isLoading, setIsLoading] = useState(true)

  useEffect(() => {
    if (!currentCourseId) return
    let cancelled = false
    setIsLoading(true)

    const load = async () => {
      try {
        const list = await DefaultService.getAssignments(currentCourseId)
        if (!cancelled) setAssignments(list)

        // Group categories are course-level, not assignment-scoped — Hao
        // surfaced them from the course card, so they live here too.
        if (user?.isStaff) {
          const sets = await DefaultService.listGroupSets(currentCourseId)
          if (!cancelled) setGroupSets(sets)
        }
      } catch {
        if (!cancelled) toast.error('Could not load assignments')
      } finally {
        if (!cancelled) setIsLoading(false)
      }
    }

    load()
    return () => {
      cancelled = true
    }
  }, [currentCourseId, user?.isStaff])

  const sorted = useMemo(
    () =>
      [...assignments].sort(
        (a, b) => new Date(a.deadline).getTime() - new Date(b.deadline).getTime()
      ),
    [assignments]
  )

  if (coursesLoading || isLoading) {
    return (
      <div className='mx-auto w-full max-w-4xl p-6'>
        <Skeleton className='h-9 w-72' />
        <div className='mt-6 grid gap-4'>
          {[0, 1, 2].map((i) => (
            <Skeleton key={i} className='h-36 w-full' />
          ))}
        </div>
      </div>
    )
  }

  return (
    <div className='mx-auto w-full max-w-4xl p-6'>
      <div className='mb-5 flex items-start justify-between gap-4'>
        <div>
          <h1 className='text-2xl font-bold'>
            {currentCourse
              ? `${currentCourse.courseCode} — ${currentCourse.courseName}`
              : 'Assignments'}
          </h1>
          <p className='mt-1 text-sm text-neutral-500'>
            {user?.isStaff
              ? 'Select an assignment to manage submissions, marking and configuration.'
              : 'Your assignments, group work, peer reviews and self-assessments.'}
          </p>
        </div>
        {user?.isAcademic && (
          <Button
            className='shrink-0'
            onClick={() => router.push('/create-peer-assignment')}
          >
            <Plus className='mr-1 h-4 w-4' />
            Create Assignment
          </Button>
        )}
      </div>

      {/* Group categories — Hao's course-level entry point. "Group Category"
          rather than "GroupSet", which his evaluation found confusing (b-1). */}
      {user?.isStaff && (
        <Card className='mb-6'>
          <CardHeader className='pb-3'>
            <CardTitle className='flex items-center gap-2 text-base'>
              <Users2 className='h-4 w-4' />
              Group categories
            </CardTitle>
          </CardHeader>
          <CardContent className='flex flex-wrap items-center gap-2'>
            {groupSets.length === 0 ? (
              <p className='text-sm text-neutral-500'>
                No group categories yet. Create one to organise students into teams.
              </p>
            ) : (
              groupSets.map((gs) => (
                <Button
                  key={gs.id}
                  variant='outline'
                  size='sm'
                  onClick={() => router.push(`/groupsets/${gs.id}`)}
                >
                  {gs.name}
                  <span className='ml-2 text-xs text-neutral-500'>
                    {gs.groups_count} groups · {gs.students_count} students
                  </span>
                </Button>
              ))
            )}
            <Button
              variant='ghost'
              size='sm'
              onClick={() => router.push('/groupsets')}
            >
              Manage
            </Button>
          </CardContent>
        </Card>
      )}

      {sorted.length === 0 ? (
        <Card>
          <CardContent className='py-14 text-center text-sm text-neutral-500'>
            No assignments in this course yet.
          </CardContent>
        </Card>
      ) : (
        <div className='flex flex-col gap-3'>
          {sorted.map((a) => {
            const phase = peerReviewPhase(a)
            const due = deadlineLabel(a.deadline)
            const landing = user?.isStaff ? 'dashboard' : 'home'
            return (
              <Card
                key={a.id}
                role='button'
                tabIndex={0}
                onClick={() => router.push(`/assignments/${a.id}/${landing}`)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' || e.key === ' ') {
                    e.preventDefault()
                    router.push(`/assignments/${a.id}/${landing}`)
                  }
                }}
                className='cursor-pointer p-5 transition-colors hover:border-neutral-400'
              >
                <div className='mb-1.5 flex flex-wrap items-center gap-2.5'>
                  <span className='text-base font-semibold'>
                    {a.assignmentTitle}
                  </span>
                  <Badge variant='secondary' className='rounded-full'>
                    {a.assignment_type === 'GROUP' ? (
                      <>
                        <Users2 className='mr-1 h-3 w-3' />
                        Group
                      </>
                    ) : (
                      'Individual'
                    )}
                  </Badge>
                  {a.peer_review_enabled && (
                    <Badge variant='outline' className='rounded-full'>
                      <Users className='mr-1 h-3 w-3' />
                      Peer Review
                    </Badge>
                  )}
                  {a.self_assessment_enabled && (
                    <Badge variant='outline' className='rounded-full'>
                      <ClipboardCheck className='mr-1 h-3 w-3' />
                      Self-Assessment
                    </Badge>
                  )}
                </div>
                {a.assignmentDescription && (
                  <p className='mb-2 line-clamp-2 text-sm text-neutral-500'>
                    {a.assignmentDescription}
                  </p>
                )}
                <div className='flex flex-wrap items-center gap-x-2 gap-y-1 text-[13px] text-neutral-500'>
                  <span className='flex items-center gap-1'>
                    <CalendarClock className='h-3.5 w-3.5' />
                    {due.text}
                  </span>
                  {phase && (
                    <>
                      <span aria-hidden>·</span>
                      <span>Peer review: {phase}</span>
                    </>
                  )}
                  {a.self_assessment_enabled && a.self_assessment_deadline && (
                    <>
                      <span aria-hidden>·</span>
                      <span>
                        Self-assessment due{' '}
                        {formatDate(a.self_assessment_deadline)}
                      </span>
                    </>
                  )}
                </div>
              </Card>
            )
          })}
        </div>
      )}
    </div>
  )
}
