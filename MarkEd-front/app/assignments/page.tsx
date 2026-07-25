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
import { Skeleton } from '@/components/ui/skeleton'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
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

const BADGE_BASE =
  'text-[11px] font-medium rounded-[6px] px-2.5 py-0.5 whitespace-nowrap inline-block'

export default function AssignmentsPage() {
  const router = useRouter()
  const { user } = useUser()
  const { currentCourseId, isLoading: coursesLoading } = useCourse()

  const [assignments, setAssignments] = useState<AssignmentSchema[]>([])
  const [groupSets, setGroupSets] = useState<GroupSetSchema[]>([])
  const [isLoading, setIsLoading] = useState(true)

  const [typeFilter, setTypeFilter] = useState<
    'all' | 'individual' | 'group' | 'peer' | 'group_peer'
  >('all')
  const [statusFilter, setStatusFilter] = useState<'all' | 'active' | 'closed'>(
    'all'
  )

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

  const visible = useMemo(() => {
    const isClosed = (a: AssignmentSchema) => {
      const times = [a.deadline, a.review_deadline, a.self_assessment_deadline]
        .filter(Boolean)
        .map((d) => new Date(d as string).getTime())
      return Date.now() > Math.max(...times)
    }
    return sorted.filter((a) => {
      const isGroup = a.assignment_type === 'GROUP'
      const hasPeer = !!a.peer_review_enabled
      const typeOk =
        typeFilter === 'all' ||
        (typeFilter === 'individual' && !isGroup && !hasPeer) ||
        (typeFilter === 'group' && isGroup) ||
        (typeFilter === 'peer' && hasPeer) ||
        (typeFilter === 'group_peer' && isGroup && hasPeer)
      const statusOk =
        statusFilter === 'all' ||
        (statusFilter === 'active' && !isClosed(a)) ||
        (statusFilter === 'closed' && isClosed(a))
      return typeOk && statusOk
    })
  }, [sorted, typeFilter, statusFilter])

  if (coursesLoading || isLoading) {
    return (
      <div className='mx-auto w-full max-w-[880px] px-7 pb-12 pt-8'>
        <Skeleton className='h-9 w-64' />
        <div className='mt-6 flex flex-col gap-3'>
          {[0, 1, 2].map((i) => (
            <Skeleton key={i} className='h-32 w-full rounded-[14px]' />
          ))}
        </div>
      </div>
    )
  }

  return (
    <div className='mx-auto w-full max-w-[880px] px-7 pb-12 pt-8'>
      {/* Header row */}
      <div className='mb-5 flex items-center justify-between gap-4'>
        <div className='text-[23px] font-semibold tracking-[-0.5px] text-[#131A26]'>
          Assignments
        </div>
        {user?.isAcademic && (
          <button
            onClick={() => router.push('/create-assignment')}
            className='shrink-0 rounded-[9px] bg-[#131A26] px-3.5 py-[7px] text-[13px] font-semibold text-white hover:bg-[#243247]'
          >
            + Create Assignment
          </button>
        )}
      </div>

      {/* Group categories — Hao's course-level entry point. "Group Category"
          rather than "GroupSet", which his evaluation found confusing (b-1). */}
      {user?.isStaff && (
        <div className='mb-4 rounded-[14px] border border-[#EAE5DB] bg-white p-5'>
          <div className='mb-3 text-[10px] font-semibold uppercase tracking-[.85px] text-[#A29A8C]'>
            Group categories
          </div>
          <div className='flex flex-wrap items-center gap-2'>
            {groupSets.length === 0 ? (
              <p className='text-[13px] text-[#5A6070]'>
                No group categories yet. Create one to organise students into teams.
              </p>
            ) : (
              groupSets.map((gs) => (
                <button
                  key={gs.id}
                  onClick={() => router.push(`/groupsets/${gs.id}`)}
                  className='rounded-[9px] border border-[#DED8CA] bg-white px-3 py-1.5 text-[12.5px] font-semibold text-[#2C3444] hover:bg-[#F2EFE8]'
                >
                  {gs.name}
                  <span className='ml-2 font-normal text-[#8A9099]'>
                    {gs.groups_count} groups · {gs.students_count} students
                  </span>
                </button>
              ))
            )}
            <button
              onClick={() => router.push('/groupsets')}
              className='rounded-[9px] px-3 py-1.5 text-[12.5px] font-semibold text-[#1F4E79] hover:text-[#123A5C]'
            >
              Manage
            </button>
          </div>
        </div>
      )}

      {/* Filters — mirror the prototype's type/status selects, applied
          client-side to the assignments already loaded above. */}
      {sorted.length > 0 && (
        <div className='mb-4 flex flex-wrap gap-2'>
          <Select
            value={typeFilter}
            onValueChange={(v) => setTypeFilter(v as typeof typeFilter)}
          >
            <SelectTrigger className='h-auto w-auto min-w-[9rem] rounded-[9px] border-[#DED8CA] bg-white px-[11px] py-2 text-[13px] text-[#2C3444]'>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value='all'>All types</SelectItem>
              <SelectItem value='individual'>Individual</SelectItem>
              <SelectItem value='group'>Group</SelectItem>
              <SelectItem value='peer'>Peer Review</SelectItem>
              <SelectItem value='group_peer'>Group + Peer Review</SelectItem>
            </SelectContent>
          </Select>
          <Select
            value={statusFilter}
            onValueChange={(v) => setStatusFilter(v as typeof statusFilter)}
          >
            <SelectTrigger className='h-auto w-auto min-w-[9rem] rounded-[9px] border-[#DED8CA] bg-white px-[11px] py-2 text-[13px] text-[#2C3444]'>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value='all'>All statuses</SelectItem>
              <SelectItem value='active'>Active</SelectItem>
              <SelectItem value='closed'>Closed</SelectItem>
            </SelectContent>
          </Select>
        </div>
      )}

      {sorted.length === 0 ? (
        <div className='rounded-[14px] border border-[#EAE5DB] bg-white py-14 text-center text-[13px] text-[#8A9099]'>
          No assignments in this course yet.
        </div>
      ) : visible.length === 0 ? (
        <div className='rounded-[14px] border border-[#EAE5DB] bg-white py-14 text-center text-[13px] text-[#8A9099]'>
          No assignments match these filters.
        </div>
      ) : (
        <div className='flex flex-col gap-3'>
          {visible.map((a) => {
            const phase = peerReviewPhase(a)
            const due = deadlineLabel(a.deadline)
            const landing = user?.isStaff ? 'dashboard' : 'home'
            const isGroup = a.assignment_type === 'GROUP'
            return (
              <div
                key={a.id}
                className='rounded-[14px] border border-[#EAE5DB] bg-white p-5'
              >
                <div className='mb-1.5 flex flex-wrap items-center gap-2.5'>
                  <span className='text-[15px] font-semibold tracking-[-0.1px] text-[#131A26]'>
                    {a.assignmentTitle}
                  </span>
                  <span
                    className={BADGE_BASE}
                    style={
                      isGroup
                        ? { color: '#4C3A82', background: '#EDEAF4' }
                        : { color: '#6D6455', background: '#F2EEE6' }
                    }
                  >
                    {isGroup ? 'Group' : 'Individual'}
                  </span>
                  {a.peer_review_enabled && (
                    <span
                      className={BADGE_BASE}
                      style={{ color: '#1F4E79', background: '#E8EFF6' }}
                    >
                      Peer Review
                    </span>
                  )}
                  {a.self_assessment_enabled && (
                    <span
                      className={BADGE_BASE}
                      style={{ color: '#256B5D', background: '#E5F0ED' }}
                    >
                      Self-Assessment
                    </span>
                  )}
                </div>
                {a.assignmentDescription && (
                  <p className='mb-2 line-clamp-2 text-[13px] text-[#5A6070]'>
                    {a.assignmentDescription}
                  </p>
                )}
                <div className='mb-3 flex flex-wrap items-center gap-x-1.5 gap-y-1 text-[13px] text-[#5A6070]'>
                  <span>{due.text}</span>
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
                <div className='flex flex-wrap gap-2'>
                  <button
                    onClick={() =>
                      router.push(`/assignments/${a.id}/${landing}`)
                    }
                    className='rounded-[9px] bg-[#131A26] px-3 py-1.5 text-[12px] font-semibold text-white hover:bg-[#243247]'
                  >
                    {user?.isStaff ? 'Open dashboard' : 'View assignment'}
                  </button>
                </div>
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}
