'use client'

import * as React from 'react'
import { useParams, useRouter } from 'next/navigation'
import { DefaultService, PeerReviewSchemaWithStudent } from '@/src/api'
import { ClipboardList } from 'lucide-react'
import { toast } from 'sonner'
import { Skeleton } from '@/components/ui/skeleton'
import { useUser } from '@/src/contexts/user-context'

export default function MarkingQueuePage() {
  const params = useParams()
  const router = useRouter()
  const { user, isLoading: userLoading } = useUser()
  const [allocations, setAllocations] = React.useState<
    PeerReviewSchemaWithStudent[] | null
  >(null)

  React.useEffect(() => {
    if (!params.id) return
    DefaultService.getMarkerAllocations(Number(params.id))
      .then((data) => setAllocations(data))
      .catch((error) => {
        console.error('Failed to fetch marker allocations:', error)
        toast.error('Failed to load your allocation')
        setAllocations([])
      })
  }, [params.id])

  // Defensive role guard — the linking tab is already role-gated to markers.
  if (!userLoading && user && user.isStudent) {
    return (
      <div className='mx-auto w-full max-w-[1200px] px-7 pb-12 pt-8'>
        <div className='rounded-[14px] border border-[#EAE5DB] bg-white p-10 text-center'>
          <div className='text-[15px] font-semibold text-[#131A26]'>
            Not available
          </div>
          <p className='mt-1 text-sm text-[#8A9099]'>
            This page is only available to markers.
          </p>
        </div>
      </div>
    )
  }

  if (allocations === null) {
    return (
      <div className='mx-auto w-full max-w-[1200px] px-7 pb-12 pt-8'>
        <Skeleton className='mb-1 h-6 w-40' />
        <Skeleton className='mb-5 h-4 w-72' />
        <div className='overflow-hidden rounded-[14px] border border-[#EAE5DB] bg-white'>
          {Array.from({ length: 3 }).map((_, i) => (
            <div
              key={i}
              className='flex items-center justify-between border-b border-[#F0ECE4] px-5 py-4 last:border-b-0'
            >
              <Skeleton className='h-5 w-48' />
              <Skeleton className='h-7 w-20' />
            </div>
          ))}
        </div>
      </div>
    )
  }

  return (
    <div className='mx-auto w-full max-w-[1200px] px-7 pb-12 pt-8'>
      <div className='text-[21px] font-semibold tracking-[-.45px] text-[#131A26]'>
        My Allocation
      </div>
      <div className='mb-5 text-[14px] text-[#5A6070]'>
        Submissions allocated to you for this assignment.
      </div>

      {allocations.length === 0 ? (
        <div className='rounded-[14px] border border-[#EAE5DB] bg-white p-12 text-center'>
          <ClipboardList className='mx-auto h-10 w-10 text-[#8A9099]' />
          <div className='mt-3 text-[15px] font-semibold text-[#131A26]'>
            Nothing allocated yet
          </div>
          <p className='mt-1 text-sm text-[#8A9099]'>
            Once submissions are allocated to you, they appear here.
          </p>
        </div>
      ) : (
        <div className='overflow-hidden rounded-[14px] border border-[#EAE5DB] bg-white'>
          {allocations.map((a) => {
            const status = a.status?.toUpperCase()
            const badge =
              status === 'COMPLETED'
                ? { label: 'Marked', cls: 'bg-[#E9F1EA] text-[#2F7D4F]' }
                : status === 'IN_PROGRESS'
                  ? { label: 'In Progress', cls: 'bg-[#F8EFDC] text-[#8A5D14]' }
                  : { label: 'Unmarked', cls: 'bg-[#F2EEE6] text-[#6D6455]' }
            const btnLabel = status === 'COMPLETED' ? 'Review' : 'Mark'
            return (
              <div
                key={a.id}
                className='flex items-center gap-3 border-b border-[#F0ECE4] px-5 py-[14px] last:border-b-0'
              >
                <span className='flex-1'>
                  <span className='block text-[13.5px] font-semibold text-[#131A26]'>
                    {a.student_name}
                  </span>
                  <span className='mt-px block font-mono text-[12px] text-[#5A6070]'>
                    {a.student_number}
                  </span>
                </span>
                <span
                  className={`inline-block whitespace-nowrap rounded-[6px] px-2.5 py-0.5 text-[11px] font-medium ${badge.cls}`}
                >
                  {badge.label}
                </span>
                <button
                  onClick={() =>
                    router.push(
                      `/assignments/${params.id}/mark/${a.submission_id}`
                    )
                  }
                  className='rounded-[9px] border border-[#DED8CA] bg-white px-[13px] py-1.5 text-[12px] font-semibold text-[#2C3444] hover:bg-[#F2EFE8]'
                >
                  {btnLabel}
                </button>
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}
