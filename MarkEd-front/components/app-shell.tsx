'use client'

/**
 * App shell (updated prototype layout): a full-width top header, and below it a
 * row of the assignment-scoped sidebar (shown only inside an assignment) and
 * the main content. Auth pages render bare — no header/sidebar or auth-scoped
 * providers, which would otherwise fire authenticated calls on a page whose
 * whole purpose is to sign in.
 */

import { usePathname } from 'next/navigation'
import { Toaster } from '@/components/ui/sonner'
import { UserProvider } from '@/src/contexts/user-context'
import { CourseProvider } from '@/src/contexts/course-context'
import { AssignmentProvider } from '@/src/contexts/assignment-context'
import WarningBanner from '@/components/warning-banner'
import { TopHeader } from '@/components/shell/top-header'
import { AssignmentSidebar } from '@/components/shell/assignment-sidebar'

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
          <div className='flex h-screen flex-col overflow-hidden'>
            <TopHeader />
            <div className='flex flex-1 overflow-hidden'>
              {/* Returns null when not inside an assignment, so main is full width. */}
              <AssignmentSidebar />
              <main className='flex-1 overflow-y-auto bg-neutral-100'>
                <WarningBanner />
                {children}
              </main>
            </div>
          </div>
          <Toaster />
        </AssignmentProvider>
      </CourseProvider>
    </UserProvider>
  )
}
