'use client'

/**
 * Group marking and personal contribution adjustment — ported from Hao's
 * personal_contribution_form.html and his get_personal_final_score() logic.
 *
 * His contribution adjustment was the most-praised part of his evaluation
 * because the score breakdown was transparent: base + adjustment = final, shown
 * per member. That is reproduced faithfully — the formula is additive and
 * visible, and every member's final score updates live as the marker types.
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
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Badge } from '@/components/ui/badge'
import { Skeleton } from '@/components/ui/skeleton'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import { ArrowLeft, Check, Users2 } from 'lucide-react'
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
        <h1 className='text-2xl font-bold'>Group marking</h1>
        <p className='mt-1 text-sm text-muted-foreground'>
          Pick a group to review its mark and set each member&apos;s
          contribution adjustment.
        </p>
        <div className='mt-6 grid gap-3'>
          {submissions.length === 0 ? (
            <Card>
              <CardContent className='py-12 text-center text-sm text-muted-foreground'>
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
                  <div className='flex items-center gap-2'>
                    <Users2 className='h-4 w-4 text-muted-foreground' />
                    <span className='font-medium'>{submission.group_name}</span>
                    <Badge variant='outline' className='text-[10px]'>
                      v{submission.submission_version}
                    </Badge>
                  </div>
                  <span className='text-xs text-muted-foreground'>
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

  return (
    <div className='mx-auto w-full max-w-4xl p-6 pb-24'>
      <Button
        variant='ghost'
        size='sm'
        className='mb-3 -ml-2'
        onClick={() => {
          setSelected(null)
          setRows([])
        }}
      >
        <ArrowLeft className='mr-1 h-4 w-4' />
        All groups
      </Button>

      <div className='mb-1 flex items-center gap-2'>
        <h1 className='text-2xl font-bold'>{selected.group_name}</h1>
        <Badge variant='outline'>v{selected.submission_version}</Badge>
      </div>
      <p className='text-sm text-muted-foreground'>
        Group base score <b>{base}</b> / {total}. Each member&apos;s final score
        is the base plus their individual adjustment.
      </p>

      <Card className='mt-5'>
        <CardHeader className='pb-2'>
          <CardTitle className='text-base'>Personal contribution</CardTitle>
        </CardHeader>
        <CardContent>
          {loadingRows ? (
            <Skeleton className='h-40' />
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Student</TableHead>
                  <TableHead className='w-24 text-right'>Base</TableHead>
                  <TableHead className='w-32'>Adjustment</TableHead>
                  <TableHead>Reason</TableHead>
                  <TableHead className='w-24 text-right'>Final</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {rows.map((row) => {
                  const final = row.group_score + (row.adjustment_score || 0)
                  return (
                    <TableRow key={row.student_id}>
                      <TableCell>
                        <div className='font-medium'>{row.userName}</div>
                        <div className='font-mono text-xs text-muted-foreground'>
                          {row.userNumber}
                        </div>
                      </TableCell>
                      <TableCell className='text-right tabular-nums text-muted-foreground'>
                        {row.group_score}
                      </TableCell>
                      <TableCell>
                        <Input
                          type='number'
                          step='0.5'
                          value={row.adjustment_score}
                          onChange={(e) =>
                            patchRow(row.student_id, {
                              adjustment_score: Number(e.target.value),
                            })
                          }
                          className='h-8'
                          aria-label={`Adjustment for ${row.userName}`}
                        />
                      </TableCell>
                      <TableCell>
                        <Input
                          value={row.adjustment_reason ?? ''}
                          onChange={(e) =>
                            patchRow(row.student_id, {
                              adjustment_reason: e.target.value,
                            })
                          }
                          placeholder='Optional reason'
                          className='h-8'
                          aria-label={`Reason for ${row.userName}`}
                        />
                      </TableCell>
                      <TableCell className='text-right font-medium tabular-nums'>
                        {final}
                      </TableCell>
                    </TableRow>
                  )
                })}
              </TableBody>
            </Table>
          )}
          <p className='mt-3 text-xs text-muted-foreground'>
            Final = base + adjustment. Adjustments can be positive or negative.
          </p>
        </CardContent>
      </Card>

      <div className='fixed inset-x-0 bottom-0 z-40 border-t bg-neutral-100/95 backdrop-blur md:pl-64'>
        <div className='mx-auto flex max-w-4xl items-center justify-end gap-3 px-6 py-3'>
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
