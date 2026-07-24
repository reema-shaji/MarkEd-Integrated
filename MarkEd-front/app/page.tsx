// app/page.tsx
'use client'

/**
 * Root route. Routes by auth state: a signed-in user lands on the Assignments
 * page (the post-login landing page, Design PRD §3.1); anyone without a token
 * goes to login. This avoids bouncing an unauthenticated visitor through
 * /assignments and a 401 before reaching /login.
 */

import { useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { getToken, initializeApi } from '@/src/api/config'
import { Skeleton } from '@/components/ui/skeleton'

initializeApi()

export default function Page() {
  const router = useRouter()

  useEffect(() => {
    router.replace(getToken() ? '/assignments' : '/login')
  }, [router])

  return (
    <div className='mx-auto w-full max-w-4xl p-6'>
      <Skeleton className='h-9 w-72' />
      <div className='mt-6 grid gap-4'>
        {[0, 1, 2].map((i) => (
          <Skeleton key={i} className='h-36 w-full' />
        ))}
      </div>
    </div>
  )
}
