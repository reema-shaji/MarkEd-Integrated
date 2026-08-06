'use client'

/**
 * Assignments — the "Assignments" tab (prototype "Course Home").
 *
 * A single card listing the selected course's assignments as compact rows:
 * title + deadline on the left; type / peer-review / self-assessment badges, a
 * per-user status badge, and an Open button on the right. Clicking a row (or
 * Open) enters that assignment's tools.
 */

import { useEffect, useMemo, useState } from 'react'
import { useRouter } from 'next/navigation'
import {
  AssignmentSchema,
  DefaultService,
  MyAssignmentStatusSchema,
} from '@/src/api'
import { useUser } from '@/src/contexts/user-context'
import { useCourse } from '@/src/contexts/course-context'
import { Skeleton } from '@/components/ui/skeleton'
import { toast } from 'sonner'
import { formatDateTime } from '@/lib/date'

const BADGE =
  'text-[11px] font-medium rounded-[6px] px-2.5 py-0.5 whitespace-nowrap inline-block'

function isClosed(a: AssignmentSchema) {
  const times = [a.deadline, a.review_deadline, a.self_assessment_deadline]
    .filter(Boolean)
    .map((d) => new Date(d as string).getTime())
  return times.length > 0 && Date.now() > Math.max(...times)
}

function deadlineText(a: AssignmentSchema) {
  if (isClosed(a)) return 'Closed'
  return `Due ${formatDateTime(a.deadline)}`
}

type Status = { txt: string; fg: string; bg: string }

export default function AssignmentsPage() {
  const router = useRouter()
  const { user } = useUser()
  const { currentCourseId, isLoading: coursesLoading } = useCourse()

  const [assignments, setAssignments] = useState<AssignmentSchema[]>([])
  const [statusMap, setStatusMap] = useState<
    Record<number, MyAssignmentStatusSchema>
  >({})
  const [isLoading, setIsLoading] = useState(true)

  useEffect(() => {
    if (!currentCourseId) return
    let cancelled = false
    setIsLoading(true)

    const load = async () => {
      try {
        const list = await DefaultService.getAssignments(currentCourseId)
        if (cancelled) return
        setAssignments(list)

        // A student's per-assignment status drives the status badge. Staff derive
        // status from the deadline instead, so this only runs for students.
        if (user?.isStudent) {
          const statuses = await Promise.all(
            list.map((a) =>
              DefaultService.getMyAssignmentStatus(a.id).catch(() => null)
            )
          )
          if (cancelled) return
          const map: Record<number, MyAssignmentStatusSchema> = {}
          list.forEach((a, i) => {
            const s = statuses[i]
            if (s) map[a.id] = s
          })
          setStatusMap(map)
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
  }, [currentCourseId, user?.isStudent])

  const sorted = useMemo(() => {
    const open = assignments.filter((a) => !isClosed(a))
    const closed = assignments.filter((a) => isClosed(a))

    if (user?.isStudent) {
      // Students: nearest deadline first
      open.sort(
        (a, b) => new Date(a.deadline).getTime() - new Date(b.deadline).getTime()
      )
    } else {
      // Staff: latest deadline first
      open.sort(
        (a, b) => new Date(b.deadline).getTime() - new Date(a.deadline).getTime()
      )
    }

    // Closed assignments always at end, most recently closed first
    closed.sort(
      (a, b) => new Date(b.deadline).getTime() - new Date(a.deadline).getTime()
    )

    return [...open, ...closed]
  }, [assignments, user])

  const statusFor = (a: AssignmentSchema): Status => {
    if (user?.isStudent) {
      const s = statusMap[a.id]
      if (s?.submitted)
        return {
          txt: s.is_late ? 'Submitted (late)' : 'Submitted',
          fg: '#2F7D4F',
          bg: '#E9F1EA',
        }
      if (isClosed(a)) return { txt: 'Missed', fg: '#A93226', bg: '#F8E8E5' }
      return { txt: 'Submit now', fg: '#8A5D14', bg: '#F8EFDC' }
    }
    return isClosed(a)
      ? { txt: 'Closed', fg: '#6D6455', bg: '#F2EEE6' }
      : { txt: 'Active', fg: '#1F4E79', bg: '#E8EFF6' }
  }

  if (coursesLoading || isLoading) {
    return (
      <div className='mx-auto w-full max-w-[1200px] px-7 pb-12 pt-8'>
        <div className='overflow-hidden rounded-[14px] border border-[#EAE5DB] bg-white'>
          <Skeleton className='h-[52px] rounded-none' />
          {[0, 1, 2, 3].map((i) => (
            <div
              key={i}
              className='flex items-center gap-3 border-b border-[#F0ECE4] px-5 py-4 last:border-b-0'
            >
              <div className='flex-1'>
                <Skeleton className='mb-2 h-4 w-48' />
                <Skeleton className='h-3 w-32' />
              </div>
              <Skeleton className='h-5 w-16 rounded-md' />
              <Skeleton className='h-8 w-16 rounded-[9px]' />
            </div>
          ))}
        </div>
      </div>
    )
  }

  const open = (a: AssignmentSchema) =>
    router.push(`/assignments/${a.id}/${user?.isStaff ? 'dashboard' : 'home'}`)

  return (
    <div className='mx-auto w-full max-w-[1200px] px-7 pb-12 pt-8'>
      <div className='overflow-hidden rounded-[14px] border border-[#EAE5DB] bg-white'>
        <div className='flex items-center justify-between gap-3 border-b border-[#F0ECE4] px-5 py-4'>
          <span className='text-[12.5px] font-semibold tracking-[.1px] text-[#5A6070]'>
            {sorted.length} assignment{sorted.length === 1 ? '' : 's'}
          </span>
          {user?.isAcademic && (
            <button
              onClick={() => router.push('/create-assignment')}
              className='rounded-[9px] bg-[#131A26] px-3 py-1.5 text-[12px] font-semibold text-white hover:bg-[#243247]'
            >
              + Create Assignment
            </button>
          )}
        </div>

        {sorted.length === 0 ? (
          <div className='px-5 py-14 text-center text-[13px] text-[#8A9099]'>
            No assignments in this course yet.
          </div>
        ) : (
          sorted.map((a) => {
            const isGroup = a.assignment_type === 'GROUP'
            const status = statusFor(a)
            return (
              <div
                key={a.id}
                onClick={() => open(a)}
                className='flex cursor-pointer items-center gap-3 border-b border-[#F0ECE4] px-5 py-3.5 last:border-b-0 hover:bg-[#FAF8F4]'
              >
                <span className='min-w-0 flex-1'>
                  <span className='block truncate text-[13.5px] font-semibold text-[#131A26]'>
                    {a.assignmentTitle}
                  </span>
                  <span className='mt-0.5 block text-[12px] text-[#5A6070]'>
                    {deadlineText(a)}
                  </span>
                </span>
                <span
                  className={BADGE}
                  style={
                    isGroup
                      ? { color: '#4C3A82', background: '#EDEAF4' }
                      : { color: '#6D6455', background: '#F2EEE6' }
                  }
                >
                  {isGroup ? 'Group' : 'Individual'}
                </span>
                {a.peer_review_enabled && (
                  <span className={BADGE} style={{ color: '#1F4E79', background: '#E8EFF6' }}>
                    Peer Review
                  </span>
                )}
                {a.self_assessment_enabled && (
                  <span className={BADGE} style={{ color: '#256B5D', background: '#E5F0ED' }}>
                    Self-Assessment
                  </span>
                )}
                <span className={BADGE} style={{ color: status.fg, background: status.bg }}>
                  {status.txt}
                </span>
                <button
                  onClick={(e) => {
                    e.stopPropagation()
                    open(a)
                  }}
                  className='rounded-[9px] border border-[#DED8CA] bg-white px-3.5 py-1.5 text-[12px] font-semibold text-[#2C3444] hover:bg-[#F2EFE8]'
                >
                  Open
                </button>
              </div>
            )
          })
        )}
      </div>
    </div>
  )
}
