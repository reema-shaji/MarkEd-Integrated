'use client'

import * as React from 'react'
import { useParams } from 'next/navigation'
import { DefaultService, MarkerJobSchema } from '@/src/api'
import { Loader2 } from 'lucide-react'
import { toast } from 'sonner'
import { Skeleton } from '@/components/ui/skeleton'
import { useUser } from '@/src/contexts/user-context'

type JobBadge = { label: string; cls: string }

function statusBadge(status: string): JobBadge {
  const s = (status || '').toUpperCase()
  if (s.includes('PROGRESS')) {
    return { label: 'In Progress', cls: 'bg-[#F8EFDC] text-[#8A5D14]' }
  }
  if (s.includes('COMPLETE')) {
    return { label: 'Complete', cls: 'bg-[#E9F1EA] text-[#2F7D4F]' }
  }
  return { label: 'Not Started', cls: 'bg-[#F2EEE6] text-[#6D6455]' }
}

export default function JobsPage() {
  const params = useParams()
  const { user, isLoading: isUserLoading } = useUser()
  const [jobs, setJobs] = React.useState<MarkerJobSchema[] | null>(null)
  const [isAllocating, setIsAllocating] = React.useState(false)

  const isAcademic = user?.isAcademic ?? false

  React.useEffect(() => {
    if (!params.id || isUserLoading || !isAcademic) return
    DefaultService.getMarkerJobs(Number(params.id))
      .then((data) => setJobs(data))
      .catch((error) => {
        console.error('Failed to load marking jobs:', error)
        toast.error('Failed to load marking jobs')
        setJobs([])
      })
  }, [params.id, isUserLoading, isAcademic])

  const handleAllocateJobs = async () => {
    setIsAllocating(true)
    try {
      const assignment = await DefaultService.getAssignment(Number(params.id))
      if (assignment.peer_review_enabled) {
        const response = await DefaultService.triggerPeerReviewMatching(
          Number(params.id)
        )
        if (response.success) {
          toast.success(response.message || 'Jobs allocated successfully')
          const refreshed = await DefaultService.getMarkerJobs(
            Number(params.id)
          )
          setJobs(refreshed)
        } else {
          throw new Error(response.message)
        }
      } else {
        toast.info('Marking is an open pool for this assignment.')
      }
    } catch (error: unknown) {
      const message =
        error instanceof Error ? error.message : 'Unknown error occurred'
      toast.error('Failed to allocate jobs: ' + message)
    } finally {
      setIsAllocating(false)
    }
  }

  // Role guard — the linking tab is already gated, this is just defense.
  if (!isUserLoading && !isAcademic) {
    return (
      <div className='mx-auto w-full max-w-[1200px] px-7 pb-12 pt-8'>
        <div className='rounded-[14px] border border-[#EAE5DB] bg-white px-6 py-12 text-center'>
          <p className='text-sm text-[#8A9099]'>
            Marking Jobs is not available for your role.
          </p>
        </div>
      </div>
    )
  }

  return (
    <div className='mx-auto w-full max-w-[1200px] px-7 pb-12 pt-8'>
      <div className='mb-5 flex items-center justify-between'>
        <div className='text-[21px] font-semibold tracking-[-.45px] text-[#131A26]'>
          Marking Jobs
        </div>
        <button
          onClick={handleAllocateJobs}
          disabled={isAllocating}
          className='inline-flex items-center rounded-[9px] bg-[#131A26] px-3.5 py-[7px] text-[13px] font-semibold text-white hover:bg-[#243247] disabled:cursor-not-allowed disabled:opacity-50'
        >
          {isAllocating ? (
            <>
              <Loader2 className='mr-2 h-4 w-4 animate-spin' />
              Allocating...
            </>
          ) : (
            'Allocate Jobs'
          )}
        </button>
      </div>

      <div className='overflow-hidden rounded-[14px] border border-[#EAE5DB] bg-white'>
        <div className='grid grid-cols-[1.6fr_1fr_1fr_1fr] border-b border-[#EAE5DB] px-5 py-3 text-[10px] font-semibold uppercase tracking-[.85px] text-[#A29A8C]'>
          <span>Marker</span>
          <span>Allocated</span>
          <span>Completed</span>
          <span>Status</span>
        </div>

        {jobs === null ? (
          Array.from({ length: 3 }).map((_, i) => (
            <div
              key={i}
              className='grid grid-cols-[1.6fr_1fr_1fr_1fr] items-center border-b border-[#F0ECE4] px-5 py-[13px] last:border-b-0'
            >
              <Skeleton className='h-4 w-32' />
              <Skeleton className='h-4 w-6' />
              <Skeleton className='h-4 w-6' />
              <Skeleton className='h-5 w-20 rounded-[6px]' />
            </div>
          ))
        ) : jobs.length === 0 ? (
          <p className='px-5 py-10 text-center text-sm text-[#8A9099]'>
            No markers have been assigned to this assignment yet.
          </p>
        ) : (
          jobs.map((job) => {
            const badge = statusBadge(job.status)
            return (
              <div
                key={job.marker_id}
                className='grid grid-cols-[1.6fr_1fr_1fr_1fr] items-center border-b border-[#F0ECE4] px-5 py-[13px] last:border-b-0'
              >
                <span className='text-[13px] font-medium text-[#131A26]'>
                  {job.marker_name}
                </span>
                <span className='text-[13px] text-[#5A6070]'>
                  {job.allocated}
                </span>
                <span className='text-[13px] text-[#5A6070]'>
                  {job.completed}
                </span>
                <span>
                  <span
                    className={`inline-block whitespace-nowrap rounded-[6px] px-2 py-0.5 text-[11px] font-medium ${badge.cls}`}
                  >
                    {badge.label}
                  </span>
                </span>
              </div>
            )
          })
        )}
      </div>

      <div className='mt-3 text-xs leading-[1.5] text-[#8A9099]'>
        Jobs allocate submissions to markers. Each marker sees only their
        allocation under Marking.
      </div>
    </div>
  )
}
