'use client'

/**
 * Assignment-scoped sidebar (updated prototype shell). Shown only inside an
 * assignment. Header: a back link to all assignments, the current assignment
 * title, and its type / peer-review / self-assessment badges. Below: the
 * assignment-scoped tools for the user's role, only ones that route to real
 * pages. The course switcher and user menu now live in the top header.
 */

import * as React from 'react'
import { useParams, usePathname, useRouter } from 'next/navigation'
import {
  ArrowLeft,
  ChevronRight,
  ClipboardCheck,
  FileText,
  FolderKanban,
  Gauge,
  Home,
  Upload,
  Users,
  Users2,
} from 'lucide-react'
import { useUser } from '@/src/contexts/user-context'
import { useAssignment } from '@/src/contexts/assignment-context'
import { StatusDot } from '@/components/status-dot'

export function AssignmentSidebar() {
  const params = useParams()
  const pathname = usePathname()
  const router = useRouter()
  const { user } = useUser()
  const {
    currentAssignment,
    peerReviews,
    isPeerReviewComplete,
    setCurrentAssignmentId,
  } = useAssignment()

  const assignmentId = params.id as string | undefined

  React.useEffect(() => {
    if (assignmentId && !currentAssignment) {
      setCurrentAssignmentId(Number(assignmentId))
    }
  }, [assignmentId, currentAssignment, setCurrentAssignmentId])

  if (!assignmentId || !currentAssignment) return null

  const isGroup = currentAssignment.assignment_type === 'GROUP'
  const hasPeer = Boolean(currentAssignment.peer_review_enabled)
  const hasSA = Boolean(currentAssignment.self_assessment_enabled)
  const go = (seg: string) => router.push(`/assignments/${assignmentId}/${seg}`)
  const active = (seg: string) =>
    pathname?.includes(`/assignments/${assignmentId}/${seg}`) ?? false

  const NavButton = ({
    label,
    icon,
    seg,
    onClick,
  }: {
    label: string
    icon: React.ReactNode
    seg?: string
    onClick?: () => void
  }) => (
    <button
      onClick={onClick ?? (() => seg && go(seg))}
      className={`flex w-full items-center gap-2.5 rounded-md px-3 py-2 text-left text-sm transition-colors ${
        seg && active(seg)
          ? 'bg-neutral-100 font-semibold text-neutral-900'
          : 'font-medium text-neutral-600 hover:bg-neutral-100 hover:text-neutral-900'
      }`}
    >
      {icon}
      <span className='flex-1'>{label}</span>
    </button>
  )

  return (
    <aside className='flex w-60 flex-none flex-col border-r border-neutral-200 bg-white'>
      {/* Header */}
      <div className='border-b border-neutral-100 px-3 pb-2.5 pt-3.5'>
        <button
          onClick={() => router.push('/assignments')}
          className='flex items-center gap-1.5 pb-2 text-xs text-neutral-400 hover:text-neutral-700'
        >
          <ArrowLeft className='h-3.5 w-3.5' />
          All assignments
        </button>
        <div
          className='text-sm font-semibold leading-snug text-neutral-900'
          title={currentAssignment.assignmentTitle}
        >
          {currentAssignment.assignmentTitle}
        </div>
        <div className='mt-1.5 flex flex-wrap gap-1'>
          <span className='rounded-full bg-neutral-100 px-2 py-0.5 text-[10px] font-medium text-neutral-600'>
            {isGroup ? 'Group' : 'Individual'}
          </span>
          {hasPeer && (
            <span className='rounded-full bg-blue-100 px-2 py-0.5 text-[10px] font-medium text-blue-800'>
              Peer Review
            </span>
          )}
          {hasSA && (
            <span className='rounded-full bg-cyan-100 px-2 py-0.5 text-[10px] font-medium text-cyan-800'>
              Self-Assessment
            </span>
          )}
        </div>
      </div>

      {/* Nav */}
      <nav className='flex flex-1 flex-col gap-0.5 overflow-y-auto p-2'>
        {user?.isStaff && (
          <>
            <NavButton label='Dashboard' icon={<Gauge className='h-4 w-4' />} seg='dashboard' />
            {isGroup && (
              <NavButton
                label='Group Marking'
                icon={<ClipboardCheck className='h-4 w-4' />}
                seg='group-marking'
              />
            )}
            {isGroup && currentAssignment.group_set_id && (
              <NavButton
                label='Group Management'
                icon={<Users2 className='h-4 w-4' />}
                onClick={() => router.push(`/groupsets/${currentAssignment.group_set_id}`)}
              />
            )}
            {hasSA && (
              <NavButton
                label='Self-Assessment'
                icon={<ClipboardCheck className='h-4 w-4' />}
                seg='self-assessment/configure'
              />
            )}
          </>
        )}

        {user?.isStudent && (
          <>
            <NavButton label='Home' icon={<Home className='h-4 w-4' />} seg='home' />
            <NavButton label='Submit Work' icon={<Upload className='h-4 w-4' />} seg='submit' />
            {isGroup && (
              <NavButton
                label='Group Workspace'
                icon={<FolderKanban className='h-4 w-4' />}
                seg='workspace'
              />
            )}
            {hasSA && (
              <NavButton
                label='Self-Assessment'
                icon={<ClipboardCheck className='h-4 w-4' />}
                seg='self-assessment'
              />
            )}
            {hasPeer && (
              <div>
                <div className='flex items-center gap-2.5 rounded-md px-3 py-2 text-sm font-medium text-neutral-600'>
                  <Users className='h-4 w-4' />
                  <span className='flex-1'>Peer Review</span>
                  <ChevronRight className='h-4 w-4 text-neutral-300' />
                </div>
                <div className='ml-6 flex flex-col gap-0.5 border-l border-neutral-200 pl-3'>
                  {!peerReviews?.length ? (
                    <span className='px-2 py-1.5 text-xs text-neutral-400'>
                      Check back later
                    </span>
                  ) : (
                    peerReviews.map((review) => (
                      <button
                        key={review.id}
                        onClick={() => go(`peer-review/${review.submission_id}`)}
                        className={`flex items-center gap-2 rounded-md px-2 py-1.5 text-left text-xs ${
                          params['peer-review-id'] === review.submission_id.toString()
                            ? 'bg-neutral-100 font-medium'
                            : 'text-neutral-600 hover:bg-neutral-100'
                        }`}
                      >
                        <StatusDot
                          status={
                            isPeerReviewComplete(review.submission_id)
                              ? 'COMPLETED'
                              : (review.status as 'COMPLETED' | 'IN_PROGRESS' | 'PENDING')
                          }
                        />
                        <span className='truncate'>{review.student_name}</span>
                      </button>
                    ))
                  )}
                </div>
              </div>
            )}
            <NavButton
              label='Results'
              icon={<FileText className='h-4 w-4' />}
              seg={isGroup ? 'group-result' : 'results'}
            />
          </>
        )}
      </nav>
    </aside>
  )
}
