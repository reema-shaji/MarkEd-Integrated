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
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Skeleton } from '@/components/ui/skeleton'
import { Minus, Plus, Users2 } from 'lucide-react'

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
          <CardContent className='py-14 text-center text-sm text-muted-foreground'>
            {message}
          </CardContent>
        </Card>
      </div>
    )
  }

  const b = result.breakdown
  const adjustment = b.personal_adjustment
  const AdjIcon = adjustment < 0 ? Minus : Plus

  return (
    <div className='mx-auto w-full max-w-2xl p-6'>
      <div className='mb-1 flex items-center gap-2'>
        <Users2 className='h-5 w-5 text-muted-foreground' />
        <h1 className='text-2xl font-bold'>{result.group_name} result</h1>
      </div>
      <p className='mb-5 text-sm text-muted-foreground'>
        {result.finalised
          ? 'Your final mark for this group assignment.'
          : 'Provisional — your marker has not finalised contribution adjustments yet.'}
      </p>

      <Card>
        <CardHeader className='pb-2'>
          <CardTitle className='text-base'>Score breakdown</CardTitle>
        </CardHeader>
        <CardContent>
          {/* base + adjustment = final, shown transparently. */}
          <div className='grid gap-3'>
            <Row
              label='Group base score'
              hint='The mark awarded to the whole group'
              value={`${b.group_score} / ${b.group_total}`}
            />
            <Row
              label='Your contribution adjustment'
              hint={b.adjustment_reason || 'No reason recorded'}
              value={
                <span
                  className={`inline-flex items-center gap-1 ${
                    adjustment < 0
                      ? 'text-red-600'
                      : adjustment > 0
                        ? 'text-green-600'
                        : ''
                  }`}
                >
                  <AdjIcon className='h-3.5 w-3.5' />
                  {Math.abs(adjustment)}
                </span>
              }
            />
            <div className='mt-1 flex items-center justify-between border-t pt-3'>
              <div>
                <div className='text-sm font-semibold'>Your final score</div>
                <div className='text-xs text-muted-foreground'>
                  base {adjustment < 0 ? '−' : '+'} adjustment
                </div>
              </div>
              <div className='text-right'>
                <div className='text-2xl font-bold tabular-nums'>
                  {b.final_score}
                  <span className='text-base font-normal text-muted-foreground'>
                    {' '}
                    / {b.group_total}
                  </span>
                </div>
                <Badge variant='secondary' className='mt-1'>
                  {b.final_percentage.toFixed(1)}%
                </Badge>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}

function Row({
  label,
  hint,
  value,
}: {
  label: string
  hint: string
  value: React.ReactNode
}) {
  return (
    <div className='flex items-start justify-between gap-4'>
      <div>
        <div className='text-sm font-medium'>{label}</div>
        <div className='text-xs text-muted-foreground'>{hint}</div>
      </div>
      <div className='shrink-0 text-sm font-medium tabular-nums'>{value}</div>
    </div>
  )
}
