'use client'

/**
 * Top header bar (updated prototype shell). Holds what used to live in the
 * sidebar: the MarkEd logo, the course switcher, notifications, support, and
 * the user menu with logout. The sidebar is now assignment-scoped only.
 */

import { useRouter } from 'next/navigation'
import Image from 'next/image'
import { Bell, LifeBuoy, LogOut } from 'lucide-react'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { toast } from 'sonner'
import { useUser } from '@/src/contexts/user-context'
import { useCourse } from '@/src/contexts/course-context'
import { DefaultService } from '@/src/api'
import { clearToken } from '@/src/api/config'

const basePath = process.env.NEXT_PUBLIC_BASE_PATH || ''

function initials(name?: string) {
  if (!name) return '?'
  return name
    .split(' ')
    .map((p) => p[0])
    .slice(0, 2)
    .join('')
    .toUpperCase()
}

export function TopHeader() {
  const router = useRouter()
  const { user } = useUser()
  const { courses, currentCourseId, setCurrentCourseId } = useCourse()

  const logout = async () => {
    try {
      await DefaultService.apiLogout()
    } catch {
      // clear locally regardless
    }
    clearToken()
    window.location.href = `${basePath}/login`
  }

  return (
    <header className='relative z-50 flex h-14 flex-none items-center gap-4 border-b border-neutral-200 bg-white px-5'>
      {/* Logo */}
      <button
        onClick={() => router.push('/assignments')}
        className='flex flex-none items-center gap-2'
      >
        <span className='flex h-[30px] w-[30px] items-center justify-center rounded-lg bg-neutral-200'>
          <Image src={`${basePath}/logo.png`} alt='MarkEd' width={18} height={18} />
        </span>
        <span className='text-sm font-semibold'>MarkEd</span>
      </button>

      {/* Course switcher */}
      {courses.length > 0 && (
        <Select
          value={currentCourseId ? String(currentCourseId) : undefined}
          onValueChange={(value) => {
            setCurrentCourseId(Number(value))
            router.push('/assignments')
          }}
        >
          <SelectTrigger className='h-9 max-w-[280px] text-[13px]' aria-label='Select course'>
            <SelectValue placeholder='Select a course' />
          </SelectTrigger>
          <SelectContent>
            {courses.map((c) => (
              <SelectItem key={c.id} value={String(c.id)}>
                {c.courseCode} — {c.courseName}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      )}

      <div className='flex-1' />

      {/* Notifications (no backing data yet — inert placeholder) */}
      <button
        title='Notifications'
        onClick={() => toast('No new notifications')}
        className='flex h-[34px] w-[34px] items-center justify-center rounded-md text-neutral-500 hover:bg-neutral-100 hover:text-neutral-900'
      >
        <Bell className='h-[18px] w-[18px]' />
      </button>

      {/* Support */}
      <button
        title='Support'
        onClick={() => router.push('/support')}
        className='flex h-[34px] w-[34px] items-center justify-center rounded-md text-neutral-500 hover:bg-neutral-100 hover:text-neutral-900'
      >
        <LifeBuoy className='h-[18px] w-[18px]' />
      </button>

      {/* User menu */}
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <button className='flex h-[38px] items-center gap-2 rounded-full py-0 pl-1 pr-2 hover:bg-neutral-100'>
            <span className='flex h-7 w-7 items-center justify-center rounded-full bg-neutral-200 text-[11px] font-medium text-neutral-600'>
              {initials(user?.userName)}
            </span>
            <span className='text-left'>
              <span className='block text-[13px] font-medium leading-tight'>
                {user?.userName ?? '…'}
              </span>
              <span className='block text-[11px] leading-tight text-neutral-400'>
                {user?.isAcademic
                  ? 'Academic'
                  : user?.isMarker
                    ? 'Marker'
                    : user?.isTA
                      ? 'TA'
                      : 'Student'}
              </span>
            </span>
          </button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align='end' className='w-52'>
          <DropdownMenuLabel className='text-xs font-normal text-neutral-400'>
            {user?.userNumber}
          </DropdownMenuLabel>
          <DropdownMenuSeparator />
          <DropdownMenuItem onClick={logout} className='cursor-pointer text-red-600'>
            <LogOut className='mr-2 h-4 w-4' />
            Log out
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
    </header>
  )
}
