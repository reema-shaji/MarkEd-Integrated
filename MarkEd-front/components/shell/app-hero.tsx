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
  // trailingSlash:true means usePathname() can return e.g. "/assignments/".
  // Normalise the trailing slash off so exact-match active checks (===) work.
  const pathname = (usePathname() || '').replace(/\/+$/, '') || '/'
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
        label: 'Dashboard',
        seg: 'course-dashboard',
        href: '/dashboard',
        active: pathname === '/dashboard',
      },
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
    if (user?.isStudent) {
      t.push({
        label: 'My Groups',
        seg: 'my-groups',
        href: '/my-groups',
        active: pathname.startsWith('/my-groups'),
      })
    }
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
      // One marking path per type: group work is marked per group submission;
      // individual work is marked from the submissions list. Showing both (plus
      // a generic "Marking") for every assignment was the confusing part.
      if (isGroup) {
        t.push(mk('Group Marking', 'group-marking', ['group-marking', 'mark']))
      } else {
        t.push(mk('Submissions', 'submissions', ['submissions', 'mark']))
      }
      // Peer-review moderation only exists when peer review is enabled.
      if (hasPeer) {
        t.push(mk('Peer Reviews', 'marking-queue', ['marking-queue', 'marker-review']))
      }
      t.push(mk('Structure', 'structure'))
      if (user?.isAcademic || user?.isTA) t.push(mk('Jobs', 'jobs'))
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
      // Individual submission only for individual assignments; a group submits
      // through its shared workspace, so there's no per-student submit there.
      if (isGroup) t.push(mk('Group Workspace', 'workspace'))
      else t.push(mk('Submit Work', 'submit'))
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

  return (
    <div className='flex-none bg-[linear-gradient(160deg,#131A26_0%,#1E2B3E_100%)]'>
      {/* Title zone */}
      {inAssignment ? (
        <div className='mx-auto w-full max-w-[1200px] px-7 pb-5 pt-7'>
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
        <div className='mx-auto w-full max-w-[1200px] px-7 pb-5 pt-7'>
          <div className='font-mono text-[11.5px] tracking-[.4px] text-white/60'>
            {courseCode || ' '}
          </div>
          <div className='mt-1 text-[23px] font-semibold tracking-[-.35px] text-white'>
            {courseName || 'MarkEd'}
          </div>
        </div>
      )}

      {/* Tabs (animated sliding underline) */}
      {tabs.length > 0 ? (
        <TabBar
          variant='hero'
          items={tabs.map((tab) => ({
            key: tab.seg,
            label: tab.label,
            active: tab.active,
            onClick: () => router.push(tab.href),
          }))}
        />
      ) : (
        <div className='h-3.5' />
      )}

      {/* Student peer-review sub-tabs */}
      {showSubTabs && (
        <div className='flex-none border-b border-[#EAE5DB] bg-white'>
          {!peerReviews?.length ? (
            <div className='mx-auto w-full max-w-[1200px] px-7'>
              <span className='block px-3 py-2.5 text-[13px] text-faint'>
                Reviews will appear here once matching runs.
              </span>
            </div>
          ) : (
            <TabBar
              variant='sub'
              items={peerReviews.map((review) => ({
                key: String(review.id),
                leading: (
                  <StatusDot
                    status={
                      isPeerReviewComplete(review.submission_id)
                        ? 'COMPLETED'
                        : (review.status as 'COMPLETED' | 'IN_PROGRESS' | 'PENDING')
                    }
                  />
                ),
                label: <span className='truncate'>{review.student_name}</span>,
                active: params['peer-review-id'] === String(review.submission_id),
                onClick: () =>
                  router.push(
                    `/assignments/${assignmentId}/peer-review/${review.submission_id}`
                  ),
              }))}
            />
          )}
        </div>
      )}
    </div>
  )
}

// --- Animated tab bar --------------------------------------------------------
// A horizontal tab strip with a highlight underline that slides + resizes to
// the active tab whenever it changes (or the window resizes). Used for both the
// dark hero tabs ('hero') and the white peer-review sub-tabs ('sub').
type BarItem = {
  key: string
  label: React.ReactNode
  leading?: React.ReactNode
  active: boolean
  onClick: () => void
}

function TabBar({ items, variant }: { items: BarItem[]; variant: 'hero' | 'sub' }) {
  const barRef = React.useRef<HTMLDivElement>(null)
  const btnRefs = React.useRef<Record<string, HTMLButtonElement | null>>({})
  const [ind, setInd] = React.useState({ left: 0, width: 0, visible: false })
  const activeKey = items.find((i) => i.active)?.key
  const hero = variant === 'hero'

  React.useLayoutEffect(() => {
    const measure = () => {
      const bar = barRef.current
      const btn = activeKey ? btnRefs.current[activeKey] : null
      if (!bar || !btn) {
        setInd((p) => (p.visible ? { ...p, visible: false } : p))
        return
      }
      const b = bar.getBoundingClientRect()
      const e = btn.getBoundingClientRect()
      setInd({ left: e.left - b.left + bar.scrollLeft, width: e.width, visible: true })
    }
    measure()
    window.addEventListener('resize', measure)
    // Re-measure once fonts settle so the underline lines up with final widths.
    const t = setTimeout(measure, 120)
    return () => {
      window.removeEventListener('resize', measure)
      clearTimeout(t)
    }
  }, [activeKey, items.length])

  return (
    <div className='mx-auto w-full max-w-[1200px] px-7'>
      <div ref={barRef} className='relative flex gap-0.5 overflow-x-auto [scrollbar-width:none]'>
        {items.map((item) => (
          <button
            key={item.key}
            ref={(el) => {
              btnRefs.current[item.key] = el
            }}
            onClick={item.onClick}
            className={`flex items-center gap-1.5 whitespace-nowrap px-3.5 transition-colors ${
              hero ? 'py-[11px] text-[13.5px]' : 'py-2.5 text-[13px]'
            } ${
              item.active
                ? hero
                  ? 'font-semibold text-white'
                  : 'font-semibold text-ink'
                : hero
                  ? 'font-normal text-white/70 hover:text-white'
                  : 'font-normal text-muted2 hover:text-ink'
            }`}
          >
            {item.leading}
            {item.label}
          </button>
        ))}
        <span
          aria-hidden
          className={`pointer-events-none absolute bottom-0 left-0 rounded-full transition-[transform,width,opacity] duration-300 ease-out ${
            hero ? 'h-[3px] bg-white' : 'h-[2px] bg-ink'
          }`}
          style={{
            width: ind.width,
            transform: `translateX(${ind.left}px)`,
            opacity: ind.visible ? 1 : 0,
          }}
        />
      </div>
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
