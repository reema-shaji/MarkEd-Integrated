// app/page.tsx
'use client'

/**
 * Root route. Routes by auth state — signed in to the Assignments landing page,
 * otherwise to login. Shows only a small spinner while deciding, so neither the
 * assignments page nor the shell flashes before the redirect.
 */

import { useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { Loader2 } from 'lucide-react'
import { getToken, initializeApi } from '@/src/api/config'

initializeApi()

export default function Page() {
  const router = useRouter()

  useEffect(() => {
    router.replace(getToken() ? '/assignments' : '/login')
  }, [router])

  return (
    <div className='flex h-[60vh] items-center justify-center'>
      <Loader2 className='h-5 w-5 animate-spin text-neutral-400' />
    </div>
  )
}
