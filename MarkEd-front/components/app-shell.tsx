'use client'

/**
 * App shell (updated prototype layout): a full-width top header, and below it a
 * scrollable main area whose first child is the dark hero + tab bar (the
 * navigation that replaced the old left sidebar), followed by page content on
 * the warm "paper" background. Auth pages render bare — no header/hero or
 * auth-scoped providers, which would otherwise fire authenticated calls on a
 * page whose whole purpose is to sign in.
 */

import { useEffect, useState } from 'react'
import { usePathname, useRouter } from 'next/navigation'
import { Loader2 } from 'lucide-react'
import { Toaster } from '@/components/ui/sonner'
import { UserProvider } from '@/src/contexts/user-context'
import { CourseProvider } from '@/src/contexts/course-context'
import { AssignmentProvider } from '@/src/contexts/assignment-context'
import { TopHeader } from '@/components/shell/top-header'
import { AppHero } from '@/components/shell/app-hero'
import { getToken } from '@/src/api/config'

const BARE_ROUTES = ['/login', '/change-password']

export function AppShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname()
  const router = useRouter()
  const isBare = BARE_ROUTES.some((route) => pathname?.startsWith(route))

  // Auth gate: a logged-out user on a protected route goes straight to login.
  // Gating the shell on a token means the header/sidebar/assignments never
  // flash before the redirect.
  const [ready, setReady] = useState(false)
  useEffect(() => {
    if (isBare) {
      setReady(true)
      return
    }
    if (!getToken()) {
      router.replace('/login')
      setReady(false)
    } else {
      setReady(true)
    }
  }, [isBare, pathname, router])

  if (isBare) {
    return (
      <>
        {children}
        <Toaster />
      </>
    )
  }

  if (!ready) {
    return (
      <div className='flex h-screen items-center justify-center bg-paper'>
        <Loader2 className='h-5 w-5 animate-spin text-faint' />
      </div>
    )
  }

  return (
    <UserProvider>
      <CourseProvider>
        <AssignmentProvider>
          <div className='flex h-screen flex-col overflow-hidden'>
            <TopHeader />
            {/* scrollbar-gutter:stable reserves the (custom 8px) scrollbar space
                on every page, so the centered content never shifts sideways
                when navigating between short (no scrollbar) and long (scrollbar)
                pages. */}
            <main className='flex flex-1 flex-col overflow-y-auto bg-paper [scrollbar-gutter:stable]'>
              <AppHero />
              {children}
            </main>
          </div>
          <Toaster />
        </AssignmentProvider>
      </CourseProvider>
    </UserProvider>
  )
}
