'use client'

/**
 * Assignment subtree guard (report B13).
 *
 * Every page under /assignments/[id] fetches by id and, on a non-existent id,
 * used to sit on a broken skeleton with an error toast. This layout does one
 * lightweight existence check and, if the assignment 404s (or the id isn't a
 * number), replaces the whole subtree with a clean "not found" card instead.
 *
 * The check is optimistic: while it resolves, children render as normal so
 * valid assignments are not slowed down; only a genuine 404 swaps in the card.
 */

import { useEffect, useState } from 'react'
import { useParams } from 'next/navigation'
import Link from 'next/link'
import { Telescope } from 'lucide-react'
import { DefaultService } from '@/src/api'

export default function AssignmentLayout({
  children,
}: {
  children: React.ReactNode
}) {
  const params = useParams()
  const id = Number(params?.id)
  const [notFound, setNotFound] = useState(false)

  useEffect(() => {
    let cancelled = false
    if (!id || Number.isNaN(id)) {
      setNotFound(true)
      return
    }
    setNotFound(false)
    DefaultService.getAssignment(id).catch((e: unknown) => {
      const status = (e as { status?: number })?.status
      // Only a 404 is "not found"; other errors are left for the child pages to
      // surface with their own (often transient) handling.
      if (!cancelled && status === 404) setNotFound(true)
    })
    return () => {
      cancelled = true
    }
  }, [id])

  if (notFound) {
    return (
      <div className='mx-auto w-full max-w-[1200px] px-7 pb-12 pt-8 duration-500 animate-in fade-in'>
        <div className='flex flex-col items-center gap-2 rounded-[14px] border border-[#EAE5DB] bg-white px-7 py-16 text-center'>
          <Telescope className='mb-1 h-9 w-9 text-[#A29A8C]' />
          <div className='text-[15px] font-semibold text-[#131A26]'>
            Assignment not found
          </div>
          <p className='max-w-sm text-[13px] leading-[1.6] text-[#8A9099]'>
            This assignment doesn&apos;t exist, or you don&apos;t have access to
            it.
          </p>
          <Link
            href='/assignments'
            className='mt-3 rounded-[9px] bg-[#131A26] px-4 py-2.5 text-[13px] font-semibold text-white hover:bg-[#243247]'
          >
            Back to assignments
          </Link>
        </div>
      </div>
    )
  }

  return <>{children}</>
}
