'use client'

/**
 * App shell. Auth pages (login, forced password change) render bare — no
 * sidebar and none of the auth-scoped providers, which would otherwise fire
 * authenticated API calls and 401 on a page whose whole purpose is to sign in.
 * Every other route gets the full sidebar shell.
 */

import { usePathname } from 'next/navigation'
import { AppSidebar } from '@/components/sidebar/app-sidebar'
import { SidebarProvider } from '@/components/ui/sidebar'
import { Toaster } from '@/components/ui/sonner'
import { UserProvider } from '@/src/contexts/user-context'
import { CourseProvider } from '@/src/contexts/course-context'
import { AssignmentProvider } from '@/src/contexts/assignment-context'
import WarningBanner from '@/components/warning-banner'

const BARE_ROUTES = ['/login', '/change-password']

export function AppShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname()
  const isBare = BARE_ROUTES.some((route) => pathname?.startsWith(route))

  if (isBare) {
    return (
      <>
        {children}
        <Toaster />
      </>
    )
  }

  return (
    <UserProvider>
      <CourseProvider>
        <AssignmentProvider>
          <SidebarProvider className='invisible md:visible'>
            <AppSidebar />
            <WarningBanner />
            <div className='m-auto w-full'>{children}</div>
            <Toaster />
          </SidebarProvider>
        </AssignmentProvider>
      </CourseProvider>
    </UserProvider>
  )
}
