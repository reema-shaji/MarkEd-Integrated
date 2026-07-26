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
  GroupMarkingSchema,
  GroupSubmissionSchema,
  PersonalAdjustmentSchema,
} from '@/src/api'
import { Input } from '@/components/ui/input'
import { Skeleton } from '@/components/ui/skeleton'
import { Check, Lock, Users2 } from 'lucide-react'
import { toast } from 'sonner'
import { useUser } from '@/src/contexts/user-context'

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
      <div className='mx-auto w-full max-w-[1200px] px-7 pb-12 pt-8'>
        <Skeleton className='h-9 w-64' />
        <Skeleton className='mt-6 h-40' />
      </div>
    )
  }

  // --- Group submission picker ---
  if (!selected) {
    return (
      <div className='mx-auto w-full max-w-[1200px] px-7 pb-12 pt-8'>
        <h1 className='text-[23px] font-semibold tracking-[-0.5px] text-ink'>
          Group Marking
        </h1>
        <p className='mt-1 text-sm text-muted2'>
          Pick a group to review its mark and set each member&apos;s
          contribution adjustment.
        </p>
        <div className='mt-5 flex flex-col gap-3'>
          {submissions.length === 0 ? (
            <div className='rounded-[14px] border border-line-card bg-white py-12 text-center text-sm text-muted2'>
              No group submissions yet.
            </div>
          ) : (
            submissions.map((submission) => (
              <div
                key={submission.id}
                role='button'
                tabIndex={0}
                onClick={() => openSubmission(submission)}
                onKeyDown={(e) =>
                  (e.key === 'Enter' || e.key === ' ') && openSubmission(submission)
                }
                className='flex cursor-pointer items-center justify-between gap-3 rounded-[14px] border border-line-card bg-white px-5 py-4 transition-colors hover:bg-warm-50'
              >
                <div className='flex items-center gap-2.5'>
                  <Users2 className='h-4 w-4 text-faint' />
                  <span className='font-semibold text-ink'>
                    {submission.group_name}
                  </span>
                  <span className='whitespace-nowrap rounded-[6px] bg-warm-100 px-2 py-px font-mono text-[11px] text-muted2'>
                    v{submission.submission_version}
                  </span>
                  <span className='whitespace-nowrap rounded-[6px] bg-[#EDEAF4] px-2.5 py-0.5 text-[11px] font-medium text-[#4C3A82]'>
                    Group Submission
                  </span>
                </div>
                <span className='text-xs text-muted2'>
                  Submitted by {submission.submitted_by_name}
                </span>
              </div>
            ))
          )}
        </div>
      </div>
    )
  }

  // --- Group marking + contribution adjustment for the chosen group ---
  const base = rows[0]?.group_score ?? 0
  const total = rows[0]?.group_total ?? 0

  const goBack = () => {
    setSelected(null)
    setRows([])
  }

  const scrollToAdjust = () => {
    document
      .getElementById('contribution-adjustment')
      ?.scrollIntoView({ behavior: 'smooth' })
  }

  return (
    <div className='w-full px-7 pb-24 pt-8'>
      {/* Header bar, per the "Group Marking" prototype. */}
      <div className='mb-4 flex flex-wrap items-center gap-3'>
        <button
          onClick={goBack}
          className='rounded-[9px] border border-line-input bg-white px-3 py-1.5 text-[12px] font-semibold text-[#2C3444] transition-colors hover:bg-warm-100'
        >
          ← Back
        </button>
        <span className='text-[15px] font-semibold tracking-[-0.1px] text-ink'>
          {selected.group_name}
        </span>
        <span className='text-[13px] text-muted2'>
          v{selected.submission_version} · {rows.length} member
          {rows.length === 1 ? '' : 's'}
        </span>
        <span className='whitespace-nowrap rounded-[6px] bg-[#EDEAF4] px-2.5 py-0.5 text-[11px] font-medium text-[#4C3A82]'>
          Group Submission
        </span>
        <div className='flex-1' />
        <button
          onClick={scrollToAdjust}
          className='rounded-[9px] border border-line-input bg-white px-3.5 py-1.5 text-[12px] font-medium text-[#2C3444] transition-colors hover:bg-warm-100'
        >
          Personal Contribution Adjustment →
        </button>
      </div>

      {/* Two columns: submission preview + rubric marking. */}
      <div className='grid items-start gap-4 lg:grid-cols-2'>
        <div className='rounded-[14px] border border-line-card bg-white p-5'>
          <div className='mb-3 text-sm font-semibold text-muted2'>
            Submission Preview
            {selected.filename ? ` — ${selected.filename}` : ''}
          </div>
          <div className='rounded-[10px] bg-warm-50 p-6'>
            <div className='mb-2 h-3.5 w-[70%] rounded-[2px] bg-[#d4d4d4]' />
            <div className='mb-5 h-2 w-[45%] rounded-[2px] bg-[#e5e5e5]' />
            <div className='mb-[7px] h-2 w-[95%] rounded-[2px] bg-[#e5e5e5]' />
            <div className='mb-[7px] h-2 w-[90%] rounded-[2px] bg-[#e5e5e5]' />
            <div className='mb-[7px] h-2 w-[96%] rounded-[2px] bg-[#e5e5e5]' />
            <div className='mb-[18px] h-2 w-[60%] rounded-[2px] bg-[#e5e5e5]' />
            <div className='mb-2 h-3 w-[35%] rounded-[2px] bg-[#d4d4d4]' />
            <div className='mb-[7px] h-2 w-[94%] rounded-[2px] bg-[#e5e5e5]' />
            <div className='mb-[7px] h-2 w-[88%] rounded-[2px] bg-[#e5e5e5]' />
            <div className='h-2 w-[40%] rounded-[2px] bg-[#e5e5e5]' />
          </div>
          <div className='mt-3 text-center text-[12px] text-faint'>
            {selected.filename ?? 'Group submission'}
          </div>
        </div>

        {/* Criteria marking (rubric scoring) */}
        <CriteriaMarkingSection
          groupSubmissionId={selected.id}
          onScored={() => openSubmission(selected)}
        />
      </div>

      {/* --- Personal contribution adjustment --- */}
      <div id='contribution-adjustment' className='mt-8 scroll-mt-24'>
        <h2 className='text-[21px] font-semibold tracking-[-0.45px] text-ink'>
          Personal Contribution Adjustment
        </h2>
        <p className='mt-1.5 text-sm text-muted2'>
          Adjust individual scores based on each student&apos;s contribution.{' '}
          <b className='text-ink'>Final = Base + Adjustment (points)</b> — the
          breakdown is shown to students.
        </p>

        {/* Summary info bar. */}
        <div className='mt-5 flex flex-wrap gap-x-6 gap-y-1 rounded-[14px] border border-line-card bg-white px-5 py-4 text-sm'>
          <span className='text-muted2'>
            Group: <b className='text-ink'>{selected.group_name}</b>
          </span>
          <span className='text-muted2'>
            Version:{' '}
            <b className='text-ink'>v{selected.submission_version}</b>
          </span>
          <span className='text-muted2'>
            Group Score:{' '}
            <b className='text-base text-ink'>
              {base} / {total}
            </b>
          </span>
        </div>

        <div className='mt-4 overflow-hidden rounded-[14px] border border-line-card bg-white'>
          {loadingRows ? (
            <div className='p-5'>
              <Skeleton className='h-40' />
            </div>
          ) : (
            <div className='overflow-x-auto'>
              <div className='min-w-[720px]'>
                {/* Column header. */}
                <div className='grid grid-cols-[1.4fr_.8fr_.8fr_.9fr_.8fr_1.8fr] gap-2 border-b border-line-card bg-white px-5 py-3 text-[10px] font-semibold uppercase tracking-[0.85px] text-kicker'>
                  <span>Student</span>
                  <span>ID</span>
                  <span>Score</span>
                  <span>Adj ±</span>
                  <span>Final</span>
                  <span>Reason</span>
                </div>
                {rows.map((row) => {
                  const final = row.group_score + (row.adjustment_score || 0)
                  return (
                    <div
                      key={row.student_id}
                      className='grid grid-cols-[1.4fr_.8fr_.8fr_.9fr_.8fr_1.8fr] items-center gap-2 border-b border-line-soft px-5 py-3 last:border-b-0'
                    >
                      <span className='text-[13px] font-semibold text-ink'>
                        {row.userName}
                      </span>
                      <span className='font-mono text-xs text-muted2'>
                        {row.userNumber}
                      </span>
                      <span className='text-[13px] tabular-nums text-muted2'>
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
                        className='h-8 w-[70px] rounded-[9px] border-line-input text-center'
                        aria-label={`Adjustment for ${row.userName}`}
                      />
                      <span className='justify-self-start rounded-[9px] bg-ink px-2.5 py-1 text-[15px] font-semibold tabular-nums text-white'>
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
                        className='h-8 rounded-[9px] border-line text-[12px] text-[#454C5C]'
                        aria-label={`Reason for ${row.userName}`}
                      />
                    </div>
                  )
                })}
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Sticky save bar — keeps draft/final distinction. */}
      <div className='fixed inset-x-0 bottom-0 z-40 border-t border-line-card bg-paper/95 backdrop-blur md:pl-64'>
        <div className='mx-auto flex max-w-[1100px] items-center justify-end gap-3 px-7 py-3'>
          {dirty ? (
            <span className='text-xs font-medium text-[#8A5D14]'>
              Unsaved changes
            </span>
          ) : (
            <span className='inline-flex items-center gap-1 text-xs font-medium text-[#2F7D4F]'>
              <Check className='h-3.5 w-3.5' /> Saved
            </span>
          )}
          <button
            onClick={() => save('draft')}
            disabled={saving}
            className='rounded-[9px] border border-line-input bg-white px-4 py-2 text-[13px] font-semibold text-[#2C3444] transition-colors hover:bg-warm-100 disabled:opacity-50'
          >
            Save draft
          </button>
          <button
            onClick={() => save('final')}
            disabled={saving}
            className='rounded-[9px] bg-ink px-4 py-2 text-[13px] font-semibold text-white transition-colors hover:bg-ink-hover disabled:opacity-50'
          >
            Save &amp; finalise
          </button>
        </div>
      </div>
    </div>
  )
}

/**
 * Criteria marking (prototype "Group Marking"): score the group against each
 * rubric criterion by picking a level; the level's marks become the score.
 * Saving updates the group base score used by the adjustment table above.
 */
function CriteriaMarkingSection({
  groupSubmissionId,
  onScored,
}: {
  groupSubmissionId: number
  onScored: () => void
}) {
  const { user } = useUser()
  const isAcademic = user?.isAcademic ?? false
  const [data, setData] = useState<GroupMarkingSchema | null>(null)
  const [picks, setPicks] = useState<Record<number, number>>({})
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    let cancelled = false
    DefaultService.getGroupMarking(groupSubmissionId)
      .then((d) => {
        if (cancelled) return
        setData(d)
        const initial: Record<number, number> = {}
        d.criteria.forEach((c) => {
          if (c.selected_element_id) initial[c.criteria_id] = c.selected_element_id
        })
        setPicks(initial)
      })
      .catch(() => toast.error('Could not load the rubric'))
    return () => {
      cancelled = true
    }
  }, [groupSubmissionId])

  const liveScore = useMemo(() => {
    if (!data) return 0
    return data.criteria.reduce((sum, c) => {
      const el = c.levels.find((l) => l.id === picks[c.criteria_id])
      return sum + (el?.marks ?? 0)
    }, 0)
  }, [data, picks])

  const save = async (finalise: boolean) => {
    if (!data) return
    // A marker can't re-save a finalised criterion; academics can override.
    const editable = new Set(
      data.criteria
        .filter((c) => isAcademic || !c.finalised)
        .map((c) => c.criteria_id)
    )
    const marks = Object.entries(picks)
      .filter(([cid]) => editable.has(Number(cid)))
      .map(([criteria_id, element_id]) => ({
        criteria_id: Number(criteria_id),
        element_id,
      }))
    if (marks.length === 0)
      return toast.error('Pick a level for at least one editable criterion')
    setSaving(true)
    try {
      const updated = await DefaultService.saveGroupMarking(groupSubmissionId, {
        marks,
        finalise,
      })
      setData(updated)
      toast.success(finalise ? 'Marks finalised' : 'Marks saved')
      onScored()
    } catch (error) {
      const msg = (error as { body?: { detail?: string } })?.body?.detail
      toast.error(msg || 'Could not save the marks')
    } finally {
      setSaving(false)
    }
  }

  if (!data) {
    return (
      <div className='rounded-[14px] border border-line-card bg-white p-5'>
        <Skeleton className='h-40' />
      </div>
    )
  }

  if (data.criteria.length === 0) {
    return (
      <div className='rounded-[14px] border border-line-card bg-white py-8 text-center text-sm text-faint'>
        This assignment has no rubric criteria to mark against.
      </div>
    )
  }

  return (
    <div className='rounded-[14px] border border-line-card bg-white p-5'>
      <div className='mb-1 text-sm font-semibold tracking-[-0.05px] text-ink'>
        Marking Criteria
      </div>
      <div className='mb-3.5 text-[12px] text-muted2'>
        Scores apply to the whole group. Set per-member adjustments afterwards.
      </div>

      <div className='flex flex-col gap-3'>
        {data.criteria.map((c) => {
          const locked = c.finalised && !isAcademic
          return (
            <div key={c.criteria_id} className={locked ? 'opacity-70' : ''}>
              <div className='mb-1.5 flex items-center justify-between gap-2'>
                <span className='flex items-center gap-2 text-[13px] font-semibold text-ink'>
                  {c.name}
                  {c.finalised && (
                    <span className='inline-flex items-center gap-1 rounded-[6px] bg-[#E9F1EA] px-2 py-0.5 text-[10px] font-semibold text-[#2F7D4F]'>
                      <Lock className='h-3 w-3' />
                      Finalised{isAcademic ? ' · you can override' : ''}
                    </span>
                  )}
                </span>
                <span className='shrink-0 text-xs text-faint'>{c.marks} marks</span>
              </div>
              <div className='grid gap-2 sm:grid-cols-2'>
                {c.levels.map((level) => {
                  const on = picks[c.criteria_id] === level.id
                  return (
                    <button
                      key={level.id}
                      type='button'
                      disabled={locked}
                      onClick={() =>
                        setPicks((p) => ({ ...p, [c.criteria_id]: level.id }))
                      }
                      className={`rounded-[9px] border p-3 text-left text-sm transition-colors ${
                        on
                          ? 'border-ink bg-warm-50'
                          : 'border-line-input hover:border-line'
                      } ${locked ? 'cursor-not-allowed' : ''}`}
                    >
                      <div className='flex items-center justify-between gap-2'>
                        <span className='font-medium text-ink'>{level.name}</span>
                        <span className='shrink-0 text-xs text-muted2'>
                          {level.marks} pts
                        </span>
                      </div>
                      {level.description && (
                        <p className='mt-1 text-xs text-muted2'>{level.description}</p>
                      )}
                    </button>
                  )
                })}
              </div>
            </div>
          )
        })}

        {/* Group base score box. */}
        <div className='flex items-center justify-between rounded-[10px] bg-warm-50 px-4 py-3'>
          <span className='text-[13px] font-semibold text-ink'>
            Group Base Score
          </span>
          <span className='text-[20px] font-bold tabular-nums text-ink'>
            {liveScore} / {data.group_total}
          </span>
        </div>

        <div className='flex flex-wrap items-center gap-2'>
          <button
            onClick={() => save(false)}
            disabled={saving}
            className='inline-flex items-center rounded-[9px] border border-line-input bg-white px-4 py-2 text-[13px] font-semibold text-[#2C3444] transition-colors hover:bg-warm-100 disabled:opacity-50'
          >
            <Check className='mr-1.5 h-4 w-4' />
            Save marks
          </button>
          <button
            onClick={() => save(true)}
            disabled={saving}
            className='inline-flex items-center rounded-[9px] bg-ink px-4 py-2 text-[13px] font-semibold text-white transition-colors hover:bg-ink-hover disabled:opacity-50'
          >
            <Lock className='mr-1.5 h-4 w-4' />
            Finalise marks
          </button>
          <span className='text-[11.5px] text-faint'>
            {isAcademic
              ? 'Finalised criteria lock out markers; you can still override them.'
              : 'Finalising locks a criterion — only a course organiser can change it after.'}
          </span>
        </div>
      </div>
    </div>
  )
}
