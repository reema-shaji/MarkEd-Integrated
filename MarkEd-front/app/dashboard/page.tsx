'use client'

/**
 * Course-level Dashboard (prototype "Student / Academic / Marker Dashboard").
 *
 * A role-aware overview of the currently selected course, built from the
 * assignments the user can see. Per-assignment detail (marking, statistics)
 * lives on each assignment's own Dashboard tab; this is the course roll-up.
 */

import { useEffect, useMemo, useState } from 'react'
import { useRouter } from 'next/navigation'
import { AssignmentSchema, DefaultService } from '@/src/api'
import { useUser } from '@/src/contexts/user-context'
import { useCourse } from '@/src/contexts/course-context'
import { Skeleton } from '@/components/ui/skeleton'
import { toast } from 'sonner'

function typeBadge(a: AssignmentSchema) {
  return a.assignment_type === 'GROUP'
    ? { txt: 'Group', bg: '#EDEAF4', fg: '#4C3A82' }
    : { txt: 'Individual', bg: '#F2EEE6', fg: '#6D6455' }
}

function fmtDate(iso?: string | null) {
  if (!iso) return '—'
  return new Date(iso).toLocaleString(undefined, {
    day: 'numeric',
    month: 'short',
    hour: '2-digit',
    minute: '2-digit',
  })
}

function countdown(iso?: string | null) {
  if (!iso) return null
  const ms = new Date(iso).getTime() - Date.now()
  if (ms <= 0) return null
  const d = Math.floor(ms / 86400000)
  const h = Math.floor((ms % 86400000) / 3600000)
  const m = Math.floor((ms % 3600000) / 60000)
  return `${d}d ${h}h ${m}m`
}

export default function CourseDashboardPage() {
  const router = useRouter()
  const { user } = useUser()
  const { currentCourse, currentCourseId } = useCourse()
  const [assignments, setAssignments] = useState<AssignmentSchema[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    let cancelled = false
    setLoading(true)
    DefaultService.getAssignments(currentCourseId ?? undefined)
      .then((res) => {
        if (!cancelled) setAssignments(res)
      })
      .catch(() => {
        if (!cancelled) toast.error('Could not load the dashboard')
      })
      .finally(() => {
        if (!cancelled) setLoading(false)
      })
    return () => {
      cancelled = true
    }
  }, [currentCourseId])

  const nextSubmission = useMemo(() => {
    const upcoming = assignments
      .filter((a) => countdown(a.deadline))
      .sort((a, b) => +new Date(a.deadline) - +new Date(b.deadline))
    return upcoming[0]
  }, [assignments])

  const nextReview = useMemo(() => {
    const upcoming = assignments
      .filter((a) => a.peer_review_enabled && countdown(a.review_deadline))
      .sort((a, b) => +new Date(a.review_deadline!) - +new Date(b.review_deadline!))
    return upcoming[0]
  }, [assignments])

  const saAssignments = assignments.filter((a) => a.self_assessment_enabled)

  if (loading) {
    return (
      <div className='mx-auto w-full max-w-[1200px] px-7 pb-12 pt-8'>
        <Skeleton className='mb-5 h-24 rounded-[14px]' />
        <div className='mb-5 grid grid-cols-1 gap-4 sm:grid-cols-2'>
          <Skeleton className='h-32 rounded-[14px]' />
          <Skeleton className='h-32 rounded-[14px]' />
        </div>
        <div className='overflow-hidden rounded-[14px] border border-line-card bg-white'>
          <Skeleton className='h-12 rounded-none' />
          {[0, 1, 2, 3].map((i) => (
            <div key={i} className='flex items-center gap-3 border-b border-line-soft px-5 py-3.5 last:border-b-0'>
              <div className='flex-1'>
                <Skeleton className='mb-2 h-4 w-48' />
                <Skeleton className='h-3 w-32' />
              </div>
              <Skeleton className='h-5 w-16 rounded-md' />
            </div>
          ))}
        </div>
      </div>
    )
  }

  const open = (a: AssignmentSchema) =>
    router.push(
      user?.isStudent
        ? `/assignments/${a.id}/home`
        : `/assignments/${a.id}/dashboard`
    )

  return (
    <div className='mx-auto w-full max-w-[1200px] px-7 pb-12 pt-8'>
      <div className='mb-5 rounded-[14px] border border-line-card bg-white p-6'>
        <div className='text-[23px] font-semibold tracking-[-.5px] text-ink'>
          {currentCourse ? `${currentCourse.courseCode} — ${currentCourse.courseName}` : 'Dashboard'}
        </div>
        <div className='mt-1.5 text-sm leading-relaxed text-muted2'>
          {user?.isStudent
            ? 'Your assignments, group work, peer reviews and self-assessments for this course.'
            : 'Overview of assignments and assessment activity for this course.'}
        </div>
      </div>

      {/* Student: next-deadline cards */}
      {user?.isStudent && (
        <div className='mb-5 grid grid-cols-1 gap-4 sm:grid-cols-2'>
          <DeadlineCard
            title='Next Submission Deadline'
            assignment={nextSubmission}
            deadlineIso={nextSubmission?.deadline}
            barColor='#1F4E79'
          />
          <DeadlineCard
            title='Next Review Deadline'
            assignment={nextReview}
            deadlineIso={nextReview?.review_deadline}
            barColor='#C9862A'
            reviewMeta
          />
        </div>
      )}

      {/* Staff: quick stat strip */}
      {user?.isStaff && (
        <div className='mb-5 grid grid-cols-2 overflow-hidden rounded-[14px] border border-line-card bg-white sm:grid-cols-4'>
          <Stat label='Assignments' value={assignments.length} />
          <Stat
            label='Group'
            value={assignments.filter((a) => a.assignment_type === 'GROUP').length}
          />
          <Stat
            label='Peer review'
            value={assignments.filter((a) => a.peer_review_enabled).length}
          />
          <Stat
            label='Self-assessment'
            value={assignments.filter((a) => a.self_assessment_enabled).length}
            last
          />
        </div>
      )}

      {/* Assignments list */}
      <div className='mb-5 overflow-hidden rounded-[14px] border border-line-card bg-white'>
        <div className='flex items-center justify-between border-b border-line-soft px-5 py-4'>
          <span className='text-[15px] font-semibold tracking-[-.1px] text-ink'>
            {user?.isStudent ? 'My Assignments' : 'Assignments'}
          </span>
          {user?.isAcademic && (
            <button
              onClick={() => router.push('/create-assignment')}
              className='rounded-[9px] bg-ink px-3 py-1.5 text-[13px] font-semibold text-white hover:bg-ink-hover'
            >
              + Create Assignment
            </button>
          )}
        </div>
        {assignments.length === 0 ? (
          <div className='px-5 py-8 text-center text-[13px] text-faint'>
            No assignments in this course yet.
          </div>
        ) : (
          assignments.map((a) => {
            const b = typeBadge(a)
            return (
              <button
                key={a.id}
                onClick={() => open(a)}
                className='flex w-full items-center gap-3 border-b border-line-soft px-5 py-3.5 text-left last:border-b-0 hover:bg-warm-50'
              >
                <span className='flex-1'>
                  <span className='block text-[13.5px] font-semibold text-ink'>
                    {a.assignmentTitle}
                  </span>
                  <span className='mt-0.5 block text-xs text-muted2'>
                    Due {fmtDate(a.deadline)}
                  </span>
                </span>
                <Chip bg={b.bg} fg={b.fg}>{b.txt}</Chip>
                {a.peer_review_enabled && <Chip bg='#E8EFF6' fg='#1F4E79'>Peer Review</Chip>}
                {a.self_assessment_enabled && <Chip bg='#E5F0ED' fg='#256B5D'>Self-Assessment</Chip>}
              </button>
            )
          })
        )}
      </div>

      {/* Student: self-assessment list */}
      {user?.isStudent && saAssignments.length > 0 && (
        <div className='overflow-hidden rounded-[14px] border border-line-card bg-white'>
          <div className='border-b border-line-soft px-5 py-4 text-[15px] font-semibold tracking-[-.1px] text-ink'>
            Self-Assessment
          </div>
          {saAssignments.map((a) => (
            <div
              key={a.id}
              className='flex items-center gap-3 border-b border-line-soft px-5 py-3.5 last:border-b-0'
            >
              <span className='flex-1'>
                <span className='block text-[13.5px] font-semibold text-ink'>
                  {a.assignmentTitle} — Self-Assessment
                </span>
                <span className='mt-0.5 block text-xs text-muted2'>
                  Deadline {fmtDate(a.self_assessment_deadline ?? a.deadline)}
                </span>
              </span>
              <button
                onClick={() => router.push(`/assignments/${a.id}/self-assessment`)}
                className='rounded-[9px] border border-line-input bg-white px-3 py-1.5 text-xs font-semibold text-[#2C3444] hover:bg-warm-100'
              >
                Open form
              </button>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

function DeadlineCard({
  title,
  assignment,
  deadlineIso,
  barColor,
  reviewMeta,
}: {
  title: string
  assignment?: AssignmentSchema
  deadlineIso?: string | null
  barColor: string
  reviewMeta?: boolean
}) {
  const cd = countdown(deadlineIso)
  return (
    <div className='rounded-[14px] border border-line-card bg-white p-5'>
      <div className='rounded-[10px] bg-warm-50 p-4'>
        <div className='flex items-center justify-between gap-2.5'>
          <span className='whitespace-nowrap text-base font-medium text-ink'>{title}</span>
          {assignment && (
            <span
              className='inline-block max-w-[45%] truncate rounded-md px-2.5 py-0.5 text-[11px] font-medium'
              style={{ background: '#E8EFF6', color: '#1F4E79' }}
              title={assignment.assignmentTitle}
            >
              {assignment.assignmentTitle}
            </span>
          )}
        </div>
        <div className='mt-1.5 text-xl font-bold text-ink'>{cd ?? 'None upcoming'}</div>
        <div className='mt-3 h-2 overflow-hidden rounded-full bg-[#F0ECE4]'>
          <div className='h-full rounded-full' style={{ width: cd ? '55%' : '0%', background: barColor }} />
        </div>
        <div className='mt-2 text-xs text-faint'>
          {deadlineIso
            ? `Due: ${fmtDate(deadlineIso)}${reviewMeta ? ' · peer reviews' : ''}`
            : reviewMeta
              ? 'No peer reviews due'
              : 'Nothing due right now'}
        </div>
      </div>
    </div>
  )
}

function Stat({ label, value, last }: { label: string; value: number; last?: boolean }) {
  return (
    <div className={`px-5 py-[18px] ${last ? '' : 'border-r border-line-soft'}`}>
      <div className='text-[10px] font-semibold uppercase tracking-[.85px] text-kicker'>
        {label}
      </div>
      <div className='mt-1.5 text-[26px] font-semibold tracking-[-.7px] text-ink'>{value}</div>
    </div>
  )
}

function Chip({ bg, fg, children }: { bg: string; fg: string; children: React.ReactNode }) {
  return (
    <span
      className='inline-block whitespace-nowrap rounded-md px-2.5 py-0.5 text-[11px] font-medium'
      style={{ background: bg, color: fg }}
    >
      {children}
    </span>
  )
}
