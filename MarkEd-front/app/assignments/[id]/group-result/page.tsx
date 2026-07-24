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
import { Card, CardContent } from '@/components/ui/card'
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
      <div className='mx-auto w-full max-w-2xl p-6'>
        <Skeleton className='h-9 w-56' />
        <Skeleton className='mt-6 h-56' />
      </div>
    )
  }

  if (message || !result) {
    return (
      <div className='mx-auto w-full max-w-2xl p-6'>
        <Card>
          <CardContent className='py-14 text-center text-sm text-neutral-500'>
            {message}
          </CardContent>
        </Card>
      </div>
    )
  }

  const b = result.breakdown
  const adjustment = b.personal_adjustment
  const adjustmentLabel = `${adjustment >= 0 ? '+' : '−'}${Math.abs(adjustment)}`

  return (
    <div className='mx-auto w-full max-w-2xl p-6'>
      <div className='mb-1.5 text-[13px] text-neutral-400'>
        My groups / Results
      </div>
      <h1 className='mb-5 text-2xl font-bold'>{result.group_name} — Results</h1>

      <Card className='mb-4'>
        <CardContent className='p-6'>
          <p className='mb-4 text-[13px] text-neutral-500'>
            {result.finalised
              ? 'Your final score is the group’s base score adjusted for your personal contribution. The breakdown is fully transparent:'
              : 'Provisional — your marker has not finalised contribution adjustments yet. Your final score is the group’s base score adjusted for your personal contribution:'}
          </p>

          {/* base + adjustment = final, shown transparently. */}
          <div className='grid grid-cols-[1fr_auto_1fr_auto_1fr] items-center gap-2 text-center'>
            <div className='rounded-lg bg-neutral-50 p-4'>
              <div className='text-[11px] font-semibold text-neutral-400'>
                GROUP BASE SCORE
              </div>
              <div className='mt-1 text-2xl font-bold tabular-nums'>
                {b.group_score}
              </div>
              <div className='text-[11px] text-neutral-400'>
                / {b.group_total}
              </div>
            </div>
            <div className='text-lg text-neutral-400'>+</div>
            <div className='rounded-lg bg-neutral-50 p-4'>
              <div className='text-[11px] font-semibold text-neutral-400'>
                YOUR ADJUSTMENT
              </div>
              <div
                className={`mt-1 text-2xl font-bold tabular-nums ${
                  adjustment < 0
                    ? 'text-red-600'
                    : adjustment > 0
                      ? 'text-green-600'
                      : ''
                }`}
              >
                {adjustmentLabel}
              </div>
            </div>
            <div className='text-lg text-neutral-400'>=</div>
            <div className='rounded-lg bg-neutral-900 p-4'>
              <div className='text-[11px] font-semibold text-neutral-400'>
                YOUR FINAL SCORE
              </div>
              <div className='mt-1 text-2xl font-bold tabular-nums text-white'>
                {b.final_score}
              </div>
              <div className='text-[11px] text-neutral-400'>
                {b.final_percentage.toFixed(1)}%
              </div>
            </div>
          </div>

          {/* Marker's reason for the personal adjustment. */}
          <div className='mt-4 rounded-md bg-neutral-50 px-3 py-2.5 text-xs leading-relaxed text-neutral-500'>
            <b>Marker note:</b>{' '}
            {b.adjustment_reason || 'No contribution note recorded.'}
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
