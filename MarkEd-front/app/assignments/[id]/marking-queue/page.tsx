'use client'

import * as React from 'react'
import { useParams, useRouter } from 'next/navigation'
import {
  AssignmentSchema,
  DefaultService,
  PeerReviewSchemaWithStudent,
} from '@/src/api'
import { ClipboardList } from 'lucide-react'
import { toast } from 'sonner'
import { Skeleton } from '@/components/ui/skeleton'
import { useUser } from '@/src/contexts/user-context'

export default function PeerReviewsPage() {
  const params = useParams()
  const router = useRouter()
  const { user, isLoading: userLoading } = useUser()
  const isAcademic = user?.isAcademic ?? false

  const [allocations, setAllocations] = React.useState<
    PeerReviewSchemaWithStudent[] | null
  >(null)
  const [assignment, setAssignment] = React.useState<AssignmentSchema | null>(null)
  const [triggering, setTriggering] = React.useState(false)

  React.useEffect(() => {
    if (!params.id) return
    DefaultService.getMarkerAllocations(Number(params.id))
      .then(setAllocations)
      .catch((error) => {
        console.error('Failed to fetch marker allocations:', error)
        setAllocations([])
      })
    DefaultService.getAssignment(Number(params.id))
      .then(setAssignment)
      .catch(() => {})
  }, [params.id])

  const handleTriggerMatching = async () => {
    setTriggering(true)
    try {
      const res = await DefaultService.triggerPeerReviewMatching(Number(params.id))
      if (res.success) {
        toast.success(res.message || 'Peer review matching complete')
        setAssignment(await DefaultService.getAssignment(Number(params.id)))
      } else {
        // The common case before students submit — say so plainly.
        toast.error(
          /not enough|no .*submission/i.test(res.message || '')
            ? 'Not enough submissions to match yet — students need to submit first.'
            : res.message || 'Could not run matching'
        )
      }
    } catch {
      toast.error('Could not run matching')
    } finally {
      setTriggering(false)
    }
  }

  // Students never see this page (the tab is role-gated); defensive guard.
  if (!userLoading && user?.isStudent) {
    return (
      <div className='mx-auto w-full max-w-[1200px] px-7 pb-12 pt-8'>
        <div className='rounded-[14px] border border-[#EAE5DB] bg-white p-10 text-center'>
          <div className='text-[15px] font-semibold text-[#131A26]'>Not available</div>
          <p className='mt-1 text-sm text-[#8A9099]'>This page is only for staff.</p>
        </div>
      </div>
    )
  }

  // --- Academic view: peer-review matching control -------------------------
  if (isAcademic) {
    const matched = assignment?.is_peer_review_matching_complete
    return (
      <div className='mx-auto w-full max-w-[1200px] px-7 pb-12 pt-8'>
        <div className='mb-1 text-[21px] font-semibold tracking-[-.45px] text-[#131A26]'>
          Peer Review
        </div>
        <div className='mb-5 text-[14px] text-[#5A6070]'>
          Match students to the submissions they review, and moderate reviews.
        </div>
        <div className='rounded-[14px] border border-[#EAE5DB] bg-white p-5'>
          <div className='flex items-center justify-between gap-3'>
            <div>
              <div className='text-[14px] font-semibold text-[#131A26]'>
                Peer review matching
              </div>
              <div className='mt-1 text-[13px] leading-[1.6] text-[#5A6070]'>
                {matched
                  ? 'Matching is complete — students can now review their allocated submissions.'
                  : 'Allocate reviewers once submissions are in. Each student is matched to peers’ submissions to review.'}
              </div>
            </div>
            {!matched && (
              <button
                onClick={handleTriggerMatching}
                disabled={triggering || !assignment}
                className='shrink-0 rounded-[9px] bg-[#131A26] px-3.5 py-2 text-[13px] font-semibold text-white hover:bg-[#243247] disabled:opacity-50'
              >
                {triggering ? 'Matching…' : 'Trigger matching'}
              </button>
            )}
          </div>
          {matched && (
            <div className='mt-3 inline-block rounded-[6px] bg-[#E9F1EA] px-2.5 py-0.5 text-[11px] font-semibold text-[#2F7D4F]'>
              Matched
            </div>
          )}
        </div>
      </div>
    )
  }

  // --- Marker view: their own review allocation ----------------------------
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
        Submissions allocated to you to review for this assignment.
      </div>

      {allocations.length === 0 ? (
        <div className='rounded-[14px] border border-[#EAE5DB] bg-white p-12 text-center'>
          <ClipboardList className='mx-auto h-10 w-10 text-[#8A9099]' />
          <div className='mt-3 text-[15px] font-semibold text-[#131A26]'>
            Nothing allocated yet
          </div>
          <p className='mt-1 text-sm text-[#8A9099]'>
            Once matching runs, the submissions you review appear here.
          </p>
        </div>
      ) : (
        <div className='overflow-hidden rounded-[14px] border border-[#EAE5DB] bg-white'>
          {allocations.map((a) => {
            const status = a.status?.toUpperCase()
            const badge =
              status === 'COMPLETED'
                ? { label: 'Reviewed', cls: 'bg-[#E9F1EA] text-[#2F7D4F]' }
                : status === 'IN_PROGRESS'
                  ? { label: 'In Progress', cls: 'bg-[#F8EFDC] text-[#8A5D14]' }
                  : { label: 'Not started', cls: 'bg-[#F2EEE6] text-[#6D6455]' }
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
                      `/assignments/${params.id}/marker-review/${a.submission_id}`
                    )
                  }
                  className='rounded-[9px] border border-[#DED8CA] bg-white px-[13px] py-1.5 text-[12px] font-semibold text-[#2C3444] hover:bg-[#F2EFE8]'
                >
                  {status === 'COMPLETED' ? 'View' : 'Review'}
                </button>
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}
