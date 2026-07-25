'use client'

import * as React from 'react'
import { useParams, useRouter } from 'next/navigation'
import { DefaultService, PeerReviewSchema } from '@/src/api'
import { ArrowLeft, Check, Users } from 'lucide-react'
import { toast } from 'sonner'
import { Skeleton } from '@/components/ui/skeleton'
import { useUser } from '@/src/contexts/user-context'

export default function PeerReviewListPage() {
  const params = useParams()
  const router = useRouter()
  const { user, isLoading: userLoading } = useUser()
  const [reviews, setReviews] = React.useState<PeerReviewSchema[] | null>(null)

  React.useEffect(() => {
    if (!params.id) return
    DefaultService.getPeerReviews(Number(params.id))
      .then((data) => setReviews(data))
      .catch((error) => {
        console.error('Failed to fetch peer reviews:', error)
        toast.error('Failed to load peer reviews')
        setReviews([])
      })
  }, [params.id])

  // Defensive role guard — the linking tab is already student-gated.
  if (!userLoading && user && !user.isStudent) {
    return (
      <div className='mx-auto w-full max-w-[1200px] px-7 pb-12 pt-8'>
        <div className='rounded-[14px] border border-[#EAE5DB] bg-white p-10 text-center'>
          <div className='text-[15px] font-semibold text-[#131A26]'>
            Not available
          </div>
          <p className='mt-1 text-sm text-[#8A9099]'>
            This page is only available to students.
          </p>
        </div>
      </div>
    )
  }

  if (reviews === null) {
    return (
      <div className='mx-auto w-full max-w-[1200px] px-7 pb-12 pt-8'>
        <Skeleton className='mb-3 h-4 w-32' />
        <Skeleton className='mb-1 h-6 w-40' />
        <Skeleton className='mb-5 h-4 w-80' />
        <div className='flex flex-col gap-3'>
          {Array.from({ length: 2 }).map((_, i) => (
            <Skeleton key={i} className='h-20 w-full rounded-[14px]' />
          ))}
        </div>
      </div>
    )
  }

  return (
    <div className='mx-auto w-full max-w-[1200px] px-7 pb-12 pt-8'>
      <button
        onClick={() => router.push(`/assignments/${params.id}/home`)}
        className='flex items-center gap-[7px] pb-3 text-[12.5px] font-medium text-[#5A6070] hover:text-[#131A26]'
      >
        <ArrowLeft className='h-[13px] w-[13px]' />
        Back to assignment
      </button>

      <div className='text-[21px] font-semibold tracking-[-.45px] text-[#131A26]'>
        Peer Review
      </div>
      <div className='mb-5 text-[14px] text-[#5A6070]'>
        Review the submissions allocated to you. Your feedback stays anonymous.
      </div>

      {reviews.length === 0 ? (
        <div className='rounded-[14px] border border-[#EAE5DB] bg-white p-12 text-center'>
          <Users className='mx-auto h-10 w-10 text-[#8A9099]' />
          <div className='mt-3 text-[15px] font-semibold text-[#131A26]'>
            No reviews allocated yet
          </div>
          <p className='mt-1 text-sm text-[#8A9099]'>
            Reviews will appear here once matching runs.
          </p>
        </div>
      ) : (
        <div className='flex flex-col gap-3'>
          {reviews.map((rv, idx) => {
            const done = rv.status?.toUpperCase() === 'COMPLETED'
            const badge = done
              ? { label: 'Completed', cls: 'bg-[#E9F1EA] text-[#2F7D4F]' }
              : { label: 'Pending', cls: 'bg-[#F8EFDC] text-[#8A5D14]' }
            return (
              <div
                key={rv.id}
                className={`flex items-center gap-3.5 rounded-[14px] border bg-white px-5 py-[19px] ${
                  done ? 'border-[#EAE5DB]' : 'border-[#E3DFD5]'
                }`}
              >
                <span
                  className={`flex h-5 w-5 flex-none items-center justify-center rounded-full border-2 ${
                    done
                      ? 'border-[#2F7D4F] bg-[#2F7D4F]'
                      : 'border-[#DED8CA] bg-white'
                  }`}
                >
                  {done && (
                    <Check className='h-[11px] w-[11px] text-white' strokeWidth={3.4} />
                  )}
                </span>
                <span className='min-w-0 flex-1'>
                  <span className='block text-[14px] font-semibold text-[#131A26]'>
                    Submission {idx + 1} (anon.)
                  </span>
                  <span className='mt-px block text-[12px] text-[#5A6070]'>
                    {done ? 'You have submitted your review' : 'Awaiting your review'}
                  </span>
                </span>
                <span
                  className={`flex-none whitespace-nowrap rounded-[6px] px-2.5 py-0.5 text-[11px] font-semibold ${badge.cls}`}
                >
                  {badge.label}
                </span>
                <button
                  onClick={() =>
                    router.push(
                      `/assignments/${params.id}/peer-review/${rv.submission_id}`
                    )
                  }
                  className={`flex-none rounded-[9px] px-[13px] py-[7px] text-[12px] font-semibold ${
                    done
                      ? 'border border-[#DED8CA] bg-white text-[#2C3444] hover:bg-[#F2EFE8]'
                      : 'bg-[#131A26] text-white hover:bg-[#243247]'
                  }`}
                >
                  {done ? 'View' : 'Review'}
                </button>
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}
