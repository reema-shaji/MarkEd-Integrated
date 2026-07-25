'use client'

/**
 * Dark hero banner + horizontal tab bar (updated prototype shell).
 *
 * This replaces the old left assignment-sidebar. It is global chrome rendered
 * by the AppShell at the top of the scroll area, in two modes:
 *
 *  - Course level (e.g. /assignments, /groupsets): shows the course code + name
 *    and the course-scoped tabs for the user's role.
 *  - Assignment level (/assignments/[id]/...): shows a back breadcrumb, the
 *    assignment title with its type / peer-review / self-assessment badges, and
 *    the assignment-scoped tabs for the user's role. When a student is inside
 *    the peer-review flow, a white sub-tab bar lists their allocated reviews.
 *
 * Navigation targets are the real Next.js routes — this is a presentation
 * change from sidebar to top tabs, not a routing change.
 */

import * as React from 'react'
import { useParams, usePathname, useRouter } from 'next/navigation'
import { ArrowLeft } from 'lucide-react'
import { useUser } from '@/src/contexts/user-context'
import { useCourse } from '@/src/contexts/course-context'
import { useAssignment } from '@/src/contexts/assignment-context'
import { StatusDot } from '@/components/status-dot'

type Tab = { label: string; seg: string; href: string; active: boolean }

export function AppHero() {
  const pathname = usePathname() || ''
  const router = useRouter()
  const params = useParams()
  const { user } = useUser()
  const { currentCourse } = useCourse()
  const {
    currentAssignment,
    peerReviews,
    isPeerReviewComplete,
    setCurrentAssignmentId,
  } = useAssignment()

  // Assignment level when the path is /assignments/<numeric id>/...
  const assignMatch = pathname.match(/^\/assignments\/(\d+)(?:\/|$)/)
  const assignmentId = assignMatch ? assignMatch[1] : undefined
  const inAssignment = Boolean(assignmentId)

  // Segment right after the assignment id ('' at the assignment root).
  const seg = React.useMemo(() => {
    if (!assignmentId) return ''
    const rest = pathname.replace(`/assignments/${assignmentId}`, '').replace(/^\//, '')
    return rest.split('/')[0] ?? ''
  }, [pathname, assignmentId])

  React.useEffect(() => {
    if (assignmentId && currentAssignment?.id !== Number(assignmentId)) {
      setCurrentAssignmentId(Number(assignmentId))
    }
  }, [assignmentId, currentAssignment, setCurrentAssignmentId])

  const courseCode = currentCourse?.courseCode ?? ''
  const courseName = currentCourse?.courseName ?? ''

  // ---- Tabs ---------------------------------------------------------------
  const courseTabs: Tab[] = React.useMemo(() => {
    const t: Tab[] = [
      {
        label: 'Assignments',
        seg: 'assignments',
        href: '/assignments',
        active:
          pathname === '/assignments' ||
          pathname.startsWith('/create-assignment') ||
          pathname.startsWith('/create-peer-assignment'),
      },
    ]
    if (user?.isAcademic) {
      t.push({
        label: 'Group Categories',
        seg: 'groupsets',
        href: '/groupsets',
        active: pathname.startsWith('/groupsets'),
      })
    }
    return t
  }, [pathname, user])

  const assignmentTabs: Tab[] = React.useMemo(() => {
    if (!assignmentId || !currentAssignment) return []
    const isGroup = currentAssignment.assignment_type === 'GROUP'
    const hasPeer = Boolean(currentAssignment.peer_review_enabled)
    const hasSA = Boolean(currentAssignment.self_assessment_enabled)
    const base = `/assignments/${assignmentId}`
    const mk = (label: string, s: string, activeOn: string[] = [s]): Tab => ({
      label,
      seg: s,
      href: `${base}/${s}`,
      active: activeOn.includes(seg),
    })
    const t: Tab[] = []
    if (user?.isStaff) {
      t.push(mk('Dashboard', 'dashboard', ['dashboard', '']))
      if (isGroup) t.push(mk('Group Marking', 'group-marking', ['group-marking', 'mark']))
      if (isGroup && currentAssignment.group_set_id) {
        t.push({
          label: 'Group Management',
          seg: 'group-management',
          href: `/groupsets/${currentAssignment.group_set_id}`,
          active: false,
        })
      }
      if (hasSA) {
        t.push({
          label: 'Self-Assessment',
          seg: 'self-assessment',
          href: `${base}/self-assessment/configure`,
          active: seg === 'self-assessment',
        })
      }
    } else if (user?.isStudent) {
      t.push(mk('Assignment', 'home', ['home', '']))
      t.push(mk('Submit Work', 'submit'))
      if (isGroup) t.push(mk('Group Workspace', 'workspace'))
      if (hasSA) t.push(mk('Self-Assessment', 'self-assessment'))
      if (hasPeer) t.push(mk('Peer Review', 'peer-review'))
      t.push(
        isGroup
          ? mk('Results', 'group-result')
          : mk('Results', 'results')
      )
    }
    return t
  }, [assignmentId, currentAssignment, user, seg])

  const tabs = inAssignment ? assignmentTabs : courseTabs

  // Student peer-review sub-tabs (white bar under the hero).
  const showSubTabs =
    inAssignment && Boolean(user?.isStudent) && seg === 'peer-review'

  const goPeerTab = () => {
    if (peerReviews?.length) {
      router.push(
        `/assignments/${assignmentId}/peer-review/${peerReviews[0].submission_id}`
      )
    }
  }

  return (
    <div className='flex-none bg-[linear-gradient(160deg,#131A26_0%,#1E2B3E_100%)]'>
      {/* Title zone */}
      {inAssignment ? (
        <div className='mx-auto w-full max-w-[880px] px-7 pb-5 pt-7'>
          <button
            onClick={() => router.push('/assignments')}
            className='flex items-center gap-1.5 pb-3 text-xs font-medium text-white/60 hover:text-white'
          >
            <ArrowLeft className='h-3 w-3' />
            <span className='font-mono text-[11px] tracking-[.3px]'>{courseCode}</span>
            <span className='text-white/35'>/</span>
            All assignments
          </button>
          <div className='flex flex-wrap items-end gap-3'>
            <span className='text-[23px] font-semibold tracking-[-.35px] text-white'>
              {currentAssignment?.assignmentTitle ?? '…'}
            </span>
            {currentAssignment && (
              <span className='flex gap-1.5 pb-[5px]'>
                <HeroBadge>
                  {currentAssignment.assignment_type === 'GROUP' ? 'Group' : 'Individual'}
                </HeroBadge>
                {currentAssignment.peer_review_enabled && <HeroBadge>Peer Review</HeroBadge>}
                {currentAssignment.self_assessment_enabled && (
                  <HeroBadge>Self-Assessment</HeroBadge>
                )}
              </span>
            )}
          </div>
        </div>
      ) : (
        <div className='mx-auto w-full max-w-[880px] px-7 pb-5 pt-7'>
          <div className='font-mono text-[11.5px] tracking-[.4px] text-white/60'>
            {courseCode || ' '}
          </div>
          <div className='mt-1 text-[23px] font-semibold tracking-[-.35px] text-white'>
            {courseName || 'MarkEd'}
          </div>
        </div>
      )}

      {/* Tabs */}
      {tabs.length > 0 ? (
        <div className='mx-auto flex w-full max-w-[880px] gap-0.5 overflow-x-auto px-7 [scrollbar-width:none]'>
          {tabs.map((tab) => (
            <button
              key={tab.seg}
              onClick={() => (tab.seg === 'peer-review' ? goPeerTab() : router.push(tab.href))}
              className={`flex items-center gap-1.5 whitespace-nowrap border-b-[3px] px-3.5 py-[11px] text-[13.5px] transition-colors ${
                tab.active
                  ? 'border-white font-semibold text-white'
                  : 'border-transparent font-normal text-white/70 hover:text-white'
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>
      ) : (
        <div className='h-3.5' />
      )}

      {/* Student peer-review sub-tabs */}
      {showSubTabs && (
        <div className='flex-none border-b border-[#EAE5DB] bg-white'>
          <div className='mx-auto flex w-full max-w-[880px] gap-0.5 overflow-x-auto px-7'>
            {!peerReviews?.length ? (
              <span className='px-3 py-2.5 text-[13px] text-faint'>
                Reviews will appear here once matching runs.
              </span>
            ) : (
              peerReviews.map((review) => {
                const active =
                  params['peer-review-id'] === String(review.submission_id)
                return (
                  <button
                    key={review.id}
                    onClick={() =>
                      router.push(
                        `/assignments/${assignmentId}/peer-review/${review.submission_id}`
                      )
                    }
                    className={`flex items-center gap-1.5 whitespace-nowrap border-b-2 px-3 py-2.5 text-[13px] transition-colors ${
                      active
                        ? 'border-ink font-semibold text-ink'
                        : 'border-transparent font-normal text-muted2 hover:text-ink'
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
                )
              })
            )}
          </div>
        </div>
      )}
    </div>
  )
}

function HeroBadge({ children }: { children: React.ReactNode }) {
  return (
    <span className='inline-block whitespace-nowrap rounded-md bg-white/[.18] px-2.5 py-0.5 text-[11px] font-semibold text-white'>
      {children}
    </span>
  )
}
