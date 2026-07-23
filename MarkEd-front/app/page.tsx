// app/page.tsx
'use client'

/**
 * Root route. The unified navigation makes the Assignments page the landing
 * page after login (Design PRD §3.1), so this simply forwards there.
 */

import { useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { initializeApi } from '@/src/api/config'
import { Skeleton } from '@/components/ui/skeleton'

initializeApi()

export default function Page() {
  const router = useRouter()

  useEffect(() => {
    router.replace('/assignments')
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
