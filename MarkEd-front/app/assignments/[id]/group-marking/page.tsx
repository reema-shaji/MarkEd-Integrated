'use client'

/**
 * Group marking and personal contribution adjustment — ported from Hao's
 * personal_contribution_form.html and restyled to the unified "Group Marking"
 * and "Contribution Adjustment" prototypes.
 *
 * His contribution adjustment was the most-praised part of his evaluation
 * because the breakdown was transparent: base + adjustment = final, shown per
 * member. That is reproduced faithfully — the formula is additive and visible,
 * and every member's final score updates live as the marker types.
 *
 * A marker picks a group submission, then sets each member's adjustment and
 * reason; one save writes them all at once, as his form did.
 */

import { useCallback, useEffect, useMemo, useState } from 'react'
import { useParams } from 'next/navigation'
import {
  DefaultService,
  GroupSubmissionSchema,
  PersonalAdjustmentSchema,
} from '@/src/api'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Badge } from '@/components/ui/badge'
import { Skeleton } from '@/components/ui/skeleton'
import { Check, Users2 } from 'lucide-react'
import { toast } from 'sonner'

type Row = PersonalAdjustmentSchema

export default function GroupMarkingPage() {
  const params = useParams()
  const assignmentId = Number(params.id)

  const [submissions, setSubmissions] = useState<GroupSubmissionSchema[]>([])
  const [selected, setSelected] = useState<GroupSubmissionSchema | null>(null)
  const [rows, setRows] = useState<Row[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [loadingRows, setLoadingRows] = useState(false)
  const [saving, setSaving] = useState(false)
  const [baseline, setBaseline] = useState('')

  useEffect(() => {
    DefaultService.listGroupSubmissions(assignmentId)
      .then(setSubmissions)
      .catch(() => toast.error('Could not load group submissions'))
      .finally(() => setIsLoading(false))
  }, [assignmentId])

  const snapshot = useCallback(
    (r: Row[]) =>
      JSON.stringify(
        r.map((x) => [x.student_id, x.adjustment_score, x.adjustment_reason ?? ''])
      ),
    []
  )

  const openSubmission = async (submission: GroupSubmissionSchema) => {
    setSelected(submission)
    setLoadingRows(true)
    try {
      const data = await DefaultService.getPersonalAdjustments(submission.id)
      setRows(data)
      setBaseline(snapshot(data))
    } catch {
      toast.error('Could not load the contribution breakdown')
    } finally {
      setLoadingRows(false)
    }
  }

  const dirty = useMemo(
    () => rows.length > 0 && snapshot(rows) !== baseline,
    [rows, baseline, snapshot]
  )

  const patchRow = (studentId: number, patch: Partial<Row>) =>
    setRows((prev) =>
      prev.map((r) => (r.student_id === studentId ? { ...r, ...patch } : r))
    )

  const save = async (status: 'draft' | 'final') => {
    if (!selected) return
    setSaving(true)
    try {
      await DefaultService.savePersonalAdjustments(selected.id, {
        status,
        adjustments: rows.map((r) => ({
          student_id: r.student_id,
          adjustment_score: r.adjustment_score,
          adjustment_reason: r.adjustment_reason ?? '',
        })),
      })
      setBaseline(snapshot(rows))
      toast.success(
        status === 'final'
          ? 'Contribution adjustments saved'
          : 'Saved as draft'
      )
    } catch {
      toast.error('Could not save the adjustments')
    } finally {
      setSaving(false)
    }
  }

  if (isLoading) {
    return (
      <div className='mx-auto w-full max-w-4xl p-6'>
        <Skeleton className='h-9 w-64' />
        <Skeleton className='mt-6 h-40' />
      </div>
    )
  }

  // --- Group submission picker ---
  if (!selected) {
    return (
      <div className='mx-auto w-full max-w-4xl p-6'>
        <h1 className='text-2xl font-bold'>Group Marking</h1>
        <p className='mt-1 text-sm text-neutral-500'>
          Pick a group to review its mark and set each member&apos;s
          contribution adjustment.
        </p>
        <div className='mt-6 grid gap-3'>
          {submissions.length === 0 ? (
            <Card>
              <CardContent className='py-12 text-center text-sm text-neutral-500'>
                No group submissions yet.
              </CardContent>
            </Card>
          ) : (
            submissions.map((submission) => (
              <Card
                key={submission.id}
                role='button'
                tabIndex={0}
                onClick={() => openSubmission(submission)}
                onKeyDown={(e) =>
                  (e.key === 'Enter' || e.key === ' ') && openSubmission(submission)
                }
                className='cursor-pointer transition-colors hover:border-neutral-400'
              >
                <CardContent className='flex items-center justify-between py-4'>
                  <div className='flex items-center gap-2.5'>
                    <Users2 className='h-4 w-4 text-neutral-400' />
                    <span className='font-semibold'>{submission.group_name}</span>
                    <Badge variant='outline' className='text-[10px]'>
                      v{submission.submission_version}
                    </Badge>
                    <Badge
                      variant='secondary'
                      className='bg-violet-100 text-[10px] font-medium text-violet-800'
                    >
                      Group Submission
                    </Badge>
                  </div>
                  <span className='text-xs text-neutral-500'>
                    Submitted by {submission.submitted_by_name}
                  </span>
                </CardContent>
              </Card>
            ))
          )}
        </div>
      </div>
    )
  }

  // --- Contribution adjustment table for the chosen group ---
  const base = rows[0]?.group_score ?? 0
  const total = rows[0]?.group_total ?? 0

  const goBack = () => {
    setSelected(null)
    setRows([])
  }

  return (
    <div className='mx-auto w-full max-w-[900px] p-6 pb-24'>
      {/* Breadcrumb, per the prototype header. */}
      <div className='mb-1.5 text-[13px] text-neutral-400'>
        <button
          type='button'
          onClick={goBack}
          className='text-neutral-400 hover:text-neutral-600'
        >
          Submissions
        </button>{' '}
        /{' '}
        <button
          type='button'
          onClick={goBack}
          className='text-neutral-400 hover:text-neutral-600'
        >
          Group Marking
        </button>{' '}
        / Adjustment
      </div>

      <h1 className='text-2xl font-bold'>Personal Contribution Adjustment</h1>
      <p className='mt-1.5 text-sm text-neutral-500'>
        Adjust individual scores based on each student&apos;s contribution.{' '}
        <b>Final = Base + Adjustment (points)</b> — the breakdown is shown to
        students.
      </p>

      {/* Summary info bar. */}
      <div className='mt-5 flex flex-wrap gap-x-6 gap-y-1 rounded-lg border border-neutral-200 bg-white px-5 py-4 text-sm shadow-sm'>
        <span className='text-neutral-500'>
          Group: <b className='text-neutral-900'>{selected.group_name}</b>
        </span>
        <span className='text-neutral-500'>
          Version:{' '}
          <b className='text-neutral-900'>v{selected.submission_version}</b>
        </span>
        <span className='text-neutral-500'>
          Group Score:{' '}
          <b className='text-base text-neutral-900'>
            {base} / {total}
          </b>
        </span>
      </div>

      <Card className='mt-4 overflow-hidden'>
        {loadingRows ? (
          <CardContent className='py-6'>
            <Skeleton className='h-40' />
          </CardContent>
        ) : (
          <div className='overflow-x-auto'>
            <div className='min-w-[720px]'>
              {/* Column header. */}
              <div className='grid grid-cols-[1.4fr_.8fr_.8fr_.9fr_.8fr_1.8fr] gap-2 border-b border-neutral-100 bg-neutral-50 px-5 py-2.5 text-[11px] font-semibold tracking-wide text-neutral-400'>
                <span>STUDENT</span>
                <span>ID</span>
                <span>SCORE</span>
                <span>ADJ ±</span>
                <span>FINAL</span>
                <span>REASON</span>
              </div>
              {rows.map((row) => {
                const final = row.group_score + (row.adjustment_score || 0)
                return (
                  <div
                    key={row.student_id}
                    className='grid grid-cols-[1.4fr_.8fr_.8fr_.9fr_.8fr_1.8fr] items-center gap-2 border-b border-neutral-100 px-5 py-3 last:border-b-0'
                  >
                    <span className='text-[13px] font-semibold'>
                      {row.userName}
                    </span>
                    <span className='font-mono text-xs text-neutral-500'>
                      {row.userNumber}
                    </span>
                    <span className='text-[13px] tabular-nums text-neutral-500'>
                      {row.group_score}
                    </span>
                    <Input
                      type='number'
                      step='1'
                      min='-20'
                      max='20'
                      value={row.adjustment_score}
                      onChange={(e) =>
                        patchRow(row.student_id, {
                          adjustment_score: Number(e.target.value),
                        })
                      }
                      className='h-8 w-[70px] text-center'
                      aria-label={`Adjustment for ${row.userName}`}
                    />
                    <span className='justify-self-start rounded-md bg-neutral-900 px-2.5 py-1 text-sm font-bold tabular-nums text-white'>
                      {final}
                    </span>
                    <Input
                      value={row.adjustment_reason ?? ''}
                      onChange={(e) =>
                        patchRow(row.student_id, {
                          adjustment_reason: e.target.value,
                        })
                      }
                      placeholder='Optional reason…'
                      className='h-8'
                      aria-label={`Reason for ${row.userName}`}
                    />
                  </div>
                )
              })}
            </div>
          </div>
        )}
      </Card>

      <div className='fixed inset-x-0 bottom-0 z-40 border-t bg-neutral-100/95 backdrop-blur md:pl-64'>
        <div className='mx-auto flex max-w-[900px] items-center justify-end gap-3 px-6 py-3'>
          {dirty ? (
            <span className='text-xs font-medium text-amber-600'>Unsaved changes</span>
          ) : (
            <span className='inline-flex items-center gap-1 text-xs font-medium text-green-600'>
              <Check className='h-3.5 w-3.5' /> Saved
            </span>
          )}
          <Button variant='outline' onClick={() => save('draft')} disabled={saving}>
            Save draft
          </Button>
          <Button onClick={() => save('final')} disabled={saving}>
            Save &amp; finalise
          </Button>
        </div>
      </div>
    </div>
  )
}
