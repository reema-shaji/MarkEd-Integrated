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

import {
  forwardRef,
  useCallback,
  useEffect,
  useImperativeHandle,
  useMemo,
  useRef,
  useState,
} from 'react'
import dynamic from 'next/dynamic'
import { useParams } from 'next/navigation'
import {
  DefaultService,
  GroupMarkingSchema,
  GroupSchema,
  GroupSubmissionSchema,
  PersonalAdjustmentSchema,
} from '@/src/api'
import { Input } from '@/components/ui/input'
import { Skeleton } from '@/components/ui/skeleton'
import { Check, FileText, Lock, Users2 } from 'lucide-react'
import { toast } from 'sonner'
import { useUser } from '@/src/contexts/user-context'

// The marker PDF viewer pulls in pdf.js, so keep it client-only like the
// individual mark page does.
const MarkerPDFViewer = dynamic(
  () => import('@/components/pdf-viewer/MarkerPDFViewer'),
  { ssr: false, loading: () => <Skeleton className='h-[520px] w-full' /> }
)

type Row = PersonalAdjustmentSchema

export default function GroupMarkingPage() {
  const params = useParams()
  const assignmentId = Number(params.id)

  const [submissions, setSubmissions] = useState<GroupSubmissionSchema[]>([])
  const [groups, setGroups] = useState<GroupSchema[]>([])
  const [selected, setSelected] = useState<GroupSubmissionSchema | null>(null)
  const [rows, setRows] = useState<Row[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [loadingRows, setLoadingRows] = useState(false)
  const [saving, setSaving] = useState(false)
  const [baseline, setBaseline] = useState('')
  // The rubric marking lives in a child; the single footer save drives it too.
  const criteriaRef = useRef<CriteriaMarkingHandle>(null)
  const [criteriaDirty, setCriteriaDirty] = useState(false)

  useEffect(() => {
    let cancelled = false
    const load = async () => {
      setIsLoading(true)
      const subs = await DefaultService.listGroupSubmissions(assignmentId).catch(
        () => {
          toast.error('Could not load group submissions')
          return [] as GroupSubmissionSchema[]
        }
      )
      // The whole group roster (so groups that haven't submitted still show).
      let grps: GroupSchema[] = []
      try {
        const a = await DefaultService.getAssignment(assignmentId)
        if (a.group_set_id) grps = await DefaultService.listGroups(a.group_set_id)
      } catch {
        // Non-critical — fall back to just the submitted groups.
      }
      if (cancelled) return
      setSubmissions(subs)
      setGroups(grps)
      setIsLoading(false)
    }
    load()
    return () => {
      cancelled = true
    }
  }, [assignmentId])

  // One row per group: the submission if the group has submitted, else null so
  // the roster still shows the group with a "no submission yet" state.
  const roster = useMemo(() => {
    const byGroup = new Map(submissions.map((s) => [s.group_id, s]))
    if (groups.length === 0) {
      // Groups couldn't be resolved — show whatever has submitted.
      return submissions.map((s) => ({
        id: s.group_id,
        name: s.group_name,
        memberCount: undefined as number | undefined,
        submission: s as GroupSubmissionSchema | null,
      }))
    }
    return groups.map((g) => ({
      id: g.id,
      name: g.name,
      memberCount: g.members?.length ?? 0,
      submission: byGroup.get(g.id) ?? null,
    }))
  }, [groups, submissions])

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
    () => (rows.length > 0 && snapshot(rows) !== baseline) || criteriaDirty,
    [rows, baseline, snapshot, criteriaDirty]
  )

  const patchRow = (studentId: number, patch: Partial<Row>) =>
    setRows((prev) =>
      prev.map((r) => (r.student_id === studentId ? { ...r, ...patch } : r))
    )

  // A single save for the whole page: the rubric marks (via the criteria
  // child) and the personal contribution adjustments, together.
  const save = async (status: 'draft' | 'final') => {
    if (!selected) return
    setSaving(true)
    try {
      // 1) Rubric criteria — no-ops cleanly if nothing is editable.
      await criteriaRef.current?.save(status === 'final')
      // 2) Personal contribution adjustments.
      await DefaultService.savePersonalAdjustments(selected.id, {
        status,
        adjustments: rows.map((r) => ({
          student_id: r.student_id,
          adjustment_score: r.adjustment_score,
          adjustment_reason: r.adjustment_reason ?? '',
        })),
      })
      setBaseline(snapshot(rows))
      // Reload so the adjustment table reflects the new group base score.
      await openSubmission(selected)
      toast.success(
        status === 'final' ? 'Marks saved & finalised' : 'Saved as draft'
      )
    } catch {
      toast.error('Could not save the marks')
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
          Groups that have submitted can be marked. Set up groups under{' '}
          <b className='text-ink'>Group Categories</b>.
        </p>
        <div className='mt-5 flex flex-col gap-3'>
          {roster.length === 0 ? (
            <div className='rounded-[14px] border border-line-card bg-white py-12 text-center text-sm text-muted2'>
              No groups yet. Create groups under Group Categories first.
            </div>
          ) : (
            roster.map((r) => {
              const sub = r.submission
              const clickable = Boolean(sub)
              return (
                <div
                  key={r.id}
                  role={clickable ? 'button' : undefined}
                  tabIndex={clickable ? 0 : undefined}
                  onClick={() => sub && openSubmission(sub)}
                  onKeyDown={(e) =>
                    sub &&
                    (e.key === 'Enter' || e.key === ' ') &&
                    openSubmission(sub)
                  }
                  className={`flex items-center justify-between gap-3 rounded-[14px] border border-line-card px-5 py-4 transition-colors ${
                    clickable
                      ? 'cursor-pointer bg-white hover:bg-warm-50'
                      : 'bg-warm-50/40'
                  }`}
                >
                  <div className='flex min-w-0 items-center gap-2.5'>
                    <Users2 className='h-4 w-4 shrink-0 text-faint' />
                    <span className='truncate font-semibold text-ink'>
                      {r.name}
                    </span>
                    {r.memberCount !== undefined && (
                      <span className='whitespace-nowrap text-[11px] text-faint'>
                        {r.memberCount} member{r.memberCount === 1 ? '' : 's'}
                      </span>
                    )}
                    {sub && (
                      <span className='whitespace-nowrap rounded-[6px] bg-warm-100 px-2 py-px font-mono text-[11px] text-muted2'>
                        v{sub.submission_version}
                      </span>
                    )}
                  </div>
                  {sub ? (
                    <span className='flex items-center gap-2.5'>
                      <span className='hidden text-xs text-muted2 sm:inline'>
                        Submitted by {sub.submitted_by_name}
                      </span>
                      <span className='whitespace-nowrap rounded-[6px] bg-[#E9F1EA] px-2.5 py-0.5 text-[11px] font-semibold text-[#2F7D4F]'>
                        Submitted
                      </span>
                    </span>
                  ) : (
                    <span className='whitespace-nowrap rounded-[6px] bg-[#F2EEE6] px-2.5 py-0.5 text-[11px] font-medium text-[#8A7F6B]'>
                      No submission yet
                    </span>
                  )}
                </div>
              )
            })
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
      </div>

      {/* Submission PDF on top, rubric marking below. */}
      <div className='space-y-4'>
        <div className='rounded-[14px] border border-line-card bg-white p-5'>
          <div className='mb-3 text-sm font-semibold text-muted2'>
            Submission Preview
            {selected.filename ? ` — ${selected.filename}` : ''}
          </div>
          {selected.pre_signed_file_url ? (
            <div className='overflow-hidden rounded-[10px] border border-line-card'>
              <MarkerPDFViewer
                url={selected.pre_signed_file_url}
                previewOnly
                peerReviewEnabled={false}
                heightClass='h-[70vh]'
              />
            </div>
          ) : (
            <div className='flex flex-col items-center justify-center gap-2 rounded-[10px] bg-warm-50 py-16 text-center'>
              <FileText className='h-8 w-8 text-faint' />
              <div className='text-[13px] font-medium text-muted2'>
                No file was submitted for this group.
              </div>
            </div>
          )}
          {selected.filename && (
            <div className='mt-3 text-center text-[12px] text-faint'>
              {selected.filename}
            </div>
          )}
        </div>

        {/* Criteria marking (rubric scoring) — saved by the footer, not on its
            own, so the page has a single save. */}
        <CriteriaMarkingSection
          ref={criteriaRef}
          groupSubmissionId={selected.id}
          onDirtyChange={setCriteriaDirty}
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

/** Imperative handle so the page's single footer save can persist the rubric
 *  marks alongside the contribution adjustments. */
export interface CriteriaMarkingHandle {
  save: (finalise: boolean) => Promise<void>
}

/**
 * Criteria marking (prototype "Group Marking"): score the group against each
 * rubric criterion by picking a level; the level's marks become the score.
 * Saving updates the group base score used by the adjustment table above.
 * It has no save button of its own — the page's footer drives the save.
 */
const CriteriaMarkingSection = forwardRef<
  CriteriaMarkingHandle,
  {
    groupSubmissionId: number
    onDirtyChange: (dirty: boolean) => void
  }
>(function CriteriaMarkingSection({ groupSubmissionId, onDirtyChange }, ref) {
  const { user } = useUser()
  const isAcademic = user?.isAcademic ?? false
  const [data, setData] = useState<GroupMarkingSchema | null>(null)
  const [picks, setPicks] = useState<Record<number, number>>({})

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

  // Report unsaved level changes up so the footer's dirty indicator is honest.
  useEffect(() => {
    if (!data) return
    const changed = data.criteria.some(
      (c) =>
        picks[c.criteria_id] !== undefined &&
        picks[c.criteria_id] !== c.selected_element_id
    )
    onDirtyChange(changed)
  }, [data, picks, onDirtyChange])

  useImperativeHandle(
    ref,
    () => ({
      save: async (finalise: boolean) => {
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
        // Nothing editable (e.g. all finalised) — skip silently so the footer
        // save can still persist the contribution adjustments.
        if (marks.length === 0) return
        const updated = await DefaultService.saveGroupMarking(
          groupSubmissionId,
          { marks, finalise }
        )
        setData(updated)
        onDirtyChange(false)
      },
    }),
    [data, picks, isAcademic, groupSubmissionId, onDirtyChange]
  )

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

  const allFinalised = data.finalised ?? data.criteria.every((c) => c.finalised)

  return (
    <div className='rounded-[14px] border border-line-card bg-white p-5'>
      <div className='mb-1 text-sm font-semibold tracking-[-0.05px] text-ink'>
        Marking Criteria
      </div>
      <div className='mb-3.5 text-[12px] text-muted2'>
        {allFinalised && !isAcademic
          ? 'These marks are finalised — shown for reference.'
          : 'Scores apply to the whole group. Set per-member adjustments afterwards.'}
      </div>

      {/* Once finalised (and not an academic who can override) there is nothing
          to edit — show a compact read-only summary instead of the full level
          picker. */}
      {allFinalised && !isAcademic ? (
        <div className='flex flex-col gap-2'>
          {data.criteria.map((c) => {
            const selected = c.levels.find((l) => l.id === picks[c.criteria_id])
            return (
              <div
                key={c.criteria_id}
                className='flex items-center justify-between gap-3 rounded-[10px] border border-line-card px-4 py-2.5'
              >
                <div className='min-w-0'>
                  <div className='text-[13px] font-semibold text-ink'>
                    {c.name}
                  </div>
                  <div className='truncate text-[12px] text-muted2'>
                    {selected ? selected.name : 'Not marked'}
                  </div>
                </div>
                <div className='shrink-0 text-[13px] font-semibold tabular-nums text-ink'>
                  {selected?.marks ?? 0} / {c.marks}
                </div>
              </div>
            )
          })}

          <div className='flex items-center justify-between rounded-[10px] bg-warm-50 px-4 py-3'>
            <span className='text-[13px] font-semibold text-ink'>
              Group Base Score
            </span>
            <span className='text-[20px] font-bold tabular-nums text-ink'>
              {liveScore} / {data.group_total}
            </span>
          </div>

          <span className='inline-flex w-fit items-center gap-1.5 rounded-[9px] bg-[#E9F1EA] px-3 py-2 text-[12.5px] font-semibold text-[#2F7D4F]'>
            <Lock className='h-3.5 w-3.5' /> Marks finalised
          </span>
        </div>
      ) : (
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
                  <span className='shrink-0 text-xs text-faint'>
                    {c.marks} marks
                  </span>
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
                          <span className='font-medium text-ink'>
                            {level.name}
                          </span>
                          <span className='shrink-0 text-xs text-muted2'>
                            {level.marks} pts
                          </span>
                        </div>
                        {level.description && (
                          <p className='mt-1 text-xs text-muted2'>
                            {level.description}
                          </p>
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

          {/* No save button here — the page's footer saves the rubric and the
              contribution adjustments together. */}
          {allFinalised ? (
            <span className='inline-flex w-fit items-center gap-1.5 rounded-[9px] bg-[#E9F1EA] px-3 py-2 text-[12.5px] font-semibold text-[#2F7D4F]'>
              <Lock className='h-3.5 w-3.5' />
              Marks finalised{isAcademic ? ' · you can override' : ''}
            </span>
          ) : (
            <span className='text-[11.5px] text-faint'>
              Use “Save &amp; finalise” below to lock these marks — only a course
              organiser can change a criterion after that.
            </span>
          )}
        </div>
      )}
    </div>
  )
})
