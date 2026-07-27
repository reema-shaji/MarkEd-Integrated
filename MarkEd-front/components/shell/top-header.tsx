'use client'

/**
 * Top header bar (updated prototype shell). Holds the MarkEd wordmark, the
 * course switcher (accent chip + code + name), notifications, support, and the
 * user menu with logout. Assignment/course navigation lives in the dark hero
 * below (see app-hero.tsx).
 */

import { usePathname, useRouter } from 'next/navigation'
import { Bell, Check, ChevronDown, HelpCircle, LogOut, Sparkles } from 'lucide-react'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { toast } from 'sonner'
import { useUser } from '@/src/contexts/user-context'
import { useCourse } from '@/src/contexts/course-context'
import { DefaultService, CourseSchema } from '@/src/api'
import { clearToken } from '@/src/api/config'

const basePath = process.env.NEXT_PUBLIC_BASE_PATH || ''

// Warm accent chips for courses, keyed by a stable index.
const ACCENTS = ['#E9B872', '#9FC6B4', '#C6A2C4', '#8FB3D9', '#E0A98F']

function initials(text?: string) {
  if (!text) return '?'
  const words = text.replace(/[^a-zA-Z ]/g, ' ').trim().split(/\s+/)
  if (words.length >= 2) return (words[0][0] + words[1][0]).toUpperCase()
  return text.replace(/[^a-zA-Z]/g, '').slice(0, 2).toUpperCase() || '?'
}

function roleName(
  user?: { isAcademic?: boolean; isMarker?: boolean; isTA?: boolean } | null
) {
  if (user?.isAcademic) return 'Academic'
  if (user?.isMarker) return 'Marker'
  if (user?.isTA) return 'TA'
  return 'Student'
}

export function TopHeader() {
  const router = useRouter()
  const pathname = usePathname() || ''
  const { user } = useUser()
  const { courses, currentCourse, currentCourseId, setCurrentCourseId } = useCourse()

  const logout = async () => {
    try {
      await DefaultService.apiLogout()
    } catch {
      // clear locally regardless
    }
    clearToken()
    window.location.href = `${basePath}/login`
  }

  const accentFor = (c: CourseSchema) =>
    ACCENTS[Math.max(0, courses.findIndex((x) => x.id === c.id)) % ACCENTS.length]

  const isNotifs = pathname.startsWith('/notifications')
  const isSupport = pathname.startsWith('/support')

  return (
    <header className='relative z-50 flex h-[54px] flex-none items-center gap-3.5 border-b border-line bg-white pl-5 pr-[18px]'>
      {/* Wordmark */}
      <button
        onClick={() => router.push('/assignments')}
        className='flex flex-none items-baseline gap-px'
      >
        <span className='text-[19px] font-bold tracking-[-.5px] text-ink'>Mark</span>
        <span className='text-[19px] font-bold tracking-[-.5px] text-gold'>Ed</span>
      </button>

      <div className='h-[22px] w-px flex-none bg-line' />

      {/* Course switcher */}
      {currentCourse && (
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <button className='flex flex-none items-center gap-2.5 rounded-[9px] border border-line bg-warm-50 px-2.5 py-1.5 text-left hover:border-[#C6BFB0] hover:bg-warm-100'>
              <span
                className='flex h-6 w-6 flex-none items-center justify-center rounded-[7px] text-[9px] font-bold text-ink'
                style={{ background: accentFor(currentCourse) }}
              >
                {initials(currentCourse.courseName)}
              </span>
              <span className='min-w-0'>
                <span className='block font-mono text-[9.5px] leading-tight text-faint'>
                  {currentCourse.courseCode}
                </span>
                <span className='block max-w-[190px] truncate text-[12.5px] font-semibold leading-tight text-ink'>
                  {currentCourse.courseName}
                </span>
              </span>
              <ChevronDown className='h-3 w-3 flex-none text-faint' />
            </button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align='start' className='w-80 rounded-[13px] p-1.5'>
            <div className='px-2.5 pb-1.5 pt-2 text-[9.5px] font-bold tracking-[.8px] text-faint'>
              SWITCH COURSE
            </div>
            {courses.map((c) => (
              <button
                key={c.id}
                onClick={() => {
                  setCurrentCourseId(c.id)
                  router.push('/assignments')
                }}
                className={`flex w-full items-center gap-2.5 rounded-[10px] px-2.5 py-2.5 text-left hover:bg-paper ${
                  c.id === currentCourseId ? 'bg-paper' : ''
                }`}
              >
                <span
                  className='flex h-7 w-7 flex-none items-center justify-center rounded-[8px] text-[10px] font-bold text-ink'
                  style={{ background: accentFor(c) }}
                >
                  {initials(c.courseName)}
                </span>
                <span className='min-w-0 flex-1'>
                  <span className='block font-mono text-[10px] text-faint'>{c.courseCode}</span>
                  <span
                    className={`block text-[13px] text-ink ${
                      c.id === currentCourseId ? 'font-semibold' : 'font-medium'
                    }`}
                  >
                    {c.courseName}
                  </span>
                </span>
                {c.id === currentCourseId && (
                  <Check className='h-[15px] w-[15px] flex-none text-royal' strokeWidth={2.5} />
                )}
              </button>
            ))}
          </DropdownMenuContent>
        </DropdownMenu>
      )}

      <div className='flex-1' />

      {/* Notifications (no backing data yet — inert placeholder) */}
      <button
        title='Notifications'
        onClick={() => toast('No new notifications')}
        className={`relative flex h-[34px] w-[34px] flex-none items-center justify-center rounded-[9px] hover:bg-warm-100 ${
          isNotifs ? 'bg-warm-200 text-ink' : 'text-muted2'
        }`}
      >
        <Bell className='h-[18px] w-[18px]' strokeWidth={1.8} />
      </button>

      {/* Help */}
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <button
            title='Help'
            className={`flex h-[34px] w-[34px] flex-none items-center justify-center rounded-[9px] hover:bg-warm-100 ${
              isSupport ? 'bg-warm-200 text-ink' : 'text-muted2'
            }`}
          >
            <HelpCircle className='h-[18px] w-[18px]' strokeWidth={1.8} />
          </button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align='end' className='w-56 rounded-[13px] p-1.5'>
          <div className='px-2.5 pb-1.5 pt-2 text-[9.5px] font-bold tracking-[.8px] text-faint'>
            HELP
          </div>
          <DropdownMenuItem
            onClick={() => router.push('/support')}
            className='cursor-pointer rounded-[9px] px-2.5 py-2.5 text-[13px] font-medium text-[#2C3444] focus:bg-paper'
          >
            <HelpCircle className='mr-2.5 h-4 w-4' />
            Support
          </DropdownMenuItem>
          <DropdownMenuItem
            onClick={() => router.push('/ai-feedback')}
            className='cursor-pointer rounded-[9px] px-2.5 py-2.5 text-[13px] font-medium text-[#2C3444] focus:bg-paper'
          >
            <Sparkles className='mr-2.5 h-4 w-4' />
            About AI suggestions
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>

      <div className='h-[22px] w-px flex-none bg-line' />

      {/* User menu */}
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <button className='flex flex-none items-center gap-2.5 rounded-[9px] py-1.5 pl-[5px] pr-[7px] hover:bg-warm-100'>
            <span className='flex h-[30px] w-[30px] flex-none items-center justify-center rounded-full bg-warm-200 text-[11px] font-bold text-muted2'>
              {initials(user?.userName)}
            </span>
            <span className='min-w-0'>
              <span className='block max-w-[150px] truncate text-[12.5px] font-semibold leading-tight text-ink'>
                {user?.userName ?? '…'}
              </span>
              <span className='block text-[11px] leading-tight text-faint'>
                {roleName(user)}
              </span>
            </span>
            <ChevronDown className='h-3 w-3 flex-none text-faint' />
          </button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align='end' className='w-[262px] rounded-[13px] p-1.5'>
          <div className='mb-1 flex items-center gap-2.5 border-b border-line-soft px-2.5 pb-3 pt-2.5'>
            <span className='flex h-[34px] w-[34px] flex-none items-center justify-center rounded-full bg-warm-200 text-[12px] font-bold text-muted2'>
              {initials(user?.userName)}
            </span>
            <span className='min-w-0'>
              <span className='block text-[13.5px] font-semibold text-ink'>
                {user?.userName ?? '…'}
              </span>
              <span className='block font-mono text-[11.5px] text-faint'>
                {user?.userNumber}
              </span>
            </span>
          </div>
          <DropdownMenuItem
            onClick={logout}
            className='cursor-pointer rounded-[9px] px-2.5 py-2.5 text-[13px] font-medium text-[#2C3444] focus:bg-paper'
          >
            <LogOut className='mr-2.5 h-4 w-4' />
            Sign out
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
    </header>
  )
}
