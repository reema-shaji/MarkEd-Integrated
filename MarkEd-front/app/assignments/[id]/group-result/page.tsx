'use client'

/**
 * Group result (student) — ported from Hao's group_results.html.
 *
 * His transparent score breakdown (base + adjustment = final) was the
 * most-praised part of his evaluation, so it is reproduced exactly: the student
 * sees the group's base score, their own personal adjustment with its reason,
 * and the resulting final score. Until the marker finalises the adjustment the
 * breakdown is shown as provisional.
 */

import { useEffect, useState } from 'react'
import { useParams } from 'next/navigation'
import { DefaultService, MyGroupResultSchema } from '@/src/api'
import { Skeleton } from '@/components/ui/skeleton'

export default function GroupResultPage() {
  const params = useParams()
  const assignmentId = Number(params.id)

  const [result, setResult] = useState<MyGroupResultSchema | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [message, setMessage] = useState<string | null>(null)

  useEffect(() => {
    DefaultService.getMyGroupResultByAssignment(assignmentId)
      .then(setResult)
      .catch((error) => {
        const status = (error as { status?: number })?.status
        setMessage(
          status === 404
            ? 'No group result is available yet.'
            : 'Could not load your group result.'
        )
      })
      .finally(() => setIsLoading(false))
  }, [assignmentId])

  if (isLoading) {
    return (
      <div className='mx-auto w-full max-w-[1200px] px-7 pb-12 pt-8'>
        <Skeleton className='h-8 w-40 rounded-[9px]' />
        <Skeleton className='mt-6 h-64 rounded-[14px]' />
      </div>
    )
  }


  if (message || !result || !result.released) {
    return (
      <div className='mx-auto w-full max-w-[1200px] px-7 pb-12 pt-8'>
        <div className='mb-1 text-[21px] font-semibold -tracking-[.45px] text-[#131A26]'>
          Results
        </div>
        <div className='mb-5 text-[14px] text-[#5A6070]'>
          Your group score and personal contribution adjustment.
        </div>
        <div className='rounded-[14px] border border-[#EAE5DB] bg-white p-7 text-center'>
          <div className='text-[14.5px] font-semibold text-[#2C3444]'>
            Marks not yet released
          </div>
          <div className='mt-1.5 text-[13px] leading-[1.6] text-[#8A9099]'>
            {message ||
              "Your group's mark, your personal contribution adjustment and marker feedback will appear here once marking is complete."}
          </div>
        </div>
      </div>
    )
  }

  const b = result.breakdown
  const adjustment = b.personal_adjustment
  const adjustmentLabel = `${adjustment >= 0 ? '+' : '−'}${Math.abs(adjustment)}`

  return (
    <div className='mx-auto w-full max-w-[1200px] px-7 pb-12 pt-8'>
      <div className='mb-1 text-[21px] font-semibold -tracking-[.45px] text-[#131A26]'>
        Results
      </div>
      <div className='mb-5 text-[14px] text-[#5A6070]'>
        {result.group_name} — group score and your contribution adjustment.
      </div>

      <div className='mb-3.5 rounded-[14px] border border-[#EAE5DB] bg-white p-6'>
        <div className='mb-3.5 text-[13px] text-[#5A6070]'>
          {result.finalised
            ? 'Your final score is the group’s base score adjusted for your personal contribution. The breakdown is fully transparent:'
            : 'Provisional — your marker has not finalised contribution adjustments yet. Your final score is the group’s base score adjusted for your personal contribution:'}
        </div>

        {/* base + adjustment = final, shown transparently. */}
        <div className='grid grid-cols-[1fr_auto_1fr_auto_1fr] items-center gap-2 text-center'>
          <div className='rounded-[10px] bg-[#FAF8F4] p-4'>
            <div className='text-[10px] font-semibold uppercase tracking-[.85px] text-[#A29A8C]'>
              Group base score
            </div>
            <div className='mt-1 text-[26px] font-semibold -tracking-[.6px] tabular-nums text-[#131A26]'>
              {b.group_score}
            </div>
          </div>
          <div className='text-lg text-[#A29A8C]'>+</div>
          <div className='rounded-[10px] bg-[#FAF8F4] p-4'>
            <div className='text-[10px] font-semibold uppercase tracking-[.85px] text-[#A29A8C]'>
              Your adjustment
            </div>
            <div
              className={`mt-1 text-[26px] font-semibold -tracking-[.6px] tabular-nums ${
                adjustment < 0
                  ? 'text-[#B4483C]'
                  : adjustment > 0
                    ? 'text-[#2F7D4F]'
                    : 'text-[#131A26]'
              }`}
            >
              {adjustmentLabel}
            </div>
          </div>
          <div className='text-lg text-[#A29A8C]'>=</div>
          <div className='rounded-[12px] bg-[#131A26] p-4'>
            <div className='text-[10px] font-semibold uppercase tracking-[.85px] text-white/60'>
              Your final score
            </div>
            <div className='mt-1 text-[26px] font-semibold -tracking-[.6px] tabular-nums text-white'>
              {b.final_score}
            </div>
          </div>
        </div>

        {/* Marker's reason for the personal adjustment. */}
        <div className='mt-3.5 rounded-[9px] bg-[#FAF8F4] px-[13px] py-[11px] text-[12.5px] leading-[1.55] text-[#5A6070]'>
          <b>Marker note:</b>{' '}
          {b.adjustment_reason || 'No contribution note recorded.'}
        </div>
      </div>
    </div>
  )
}
