'use client'

/**
 * Edit Assignment — the same form as Create Assignment, but pre-filled with
 * existing data and using update APIs. Replaces the old Structure tab's edit
 * dialog with a full-page form that includes criteria and SA configuration.
 */

import { useCallback, useEffect, useState } from 'react'
import { useParams, useRouter } from 'next/navigation'
import { DefaultService, GroupSetSchema } from '@/src/api'
import { useCourse } from '@/src/contexts/course-context'
import { useUser } from '@/src/contexts/user-context'
import { Loader2 } from 'lucide-react'
import { toast } from 'sonner'
import { Skeleton } from '@/components/ui/skeleton'

type CriterionRow = { id: number | null; name: string; marks: string }

const INPUT_CLS =
  'w-full rounded-[9px] border border-[#DED8CA] bg-white px-[13px] py-2.5 text-sm text-[#131A26] outline-none focus:border-[#B8B0A0]'
const FIELD_LABEL_CLS =
  'mb-[5px] block text-[12.5px] font-semibold tracking-[.1px] text-[#2C3444]'

const DEFAULT_REFLECTIONS = [
  { stage: 'description', label: 'Description', prompt_text: 'What happened? Who was involved? What was the outcome?' },
  { stage: 'feelings', label: 'Feelings', prompt_text: 'What were you thinking and feeling before, during, and after the experience?' },
  { stage: 'evaluation', label: 'Evaluation', prompt_text: "What went well and what didn't? Why?" },
  { stage: 'analysis', label: 'Analysis', prompt_text: 'Why did things happen the way they did? What can you learn from this?' },
  { stage: 'conclusion', label: 'Conclusion', prompt_text: 'What did you learn? What could you have done differently?' },
  { stage: 'action_plan', label: 'Action Plan', prompt_text: 'If a similar situation arises, what would you do? How will you prepare?' },
]

/** datetime-local wants "YYYY-MM-DDTHH:mm"; the API sends full ISO. */
const toLocalInput = (iso?: string | null) => (iso ? iso.slice(0, 16) : '')

function RequiredTag() {
  return (
    <span className='ml-1.5 rounded-[4px] bg-[#F8EFDC] px-1.5 py-px align-[1px] text-[10px] font-bold tracking-[.5px] text-[#8A5D14]'>
      REQUIRED
    </span>
  )
}

export default function EditAssignmentPage() {
  const params = useParams()
  const router = useRouter()
  const { user } = useUser()
  const { currentCourseId } = useCourse()
  const assignmentId = Number(params.id)

  const [isLoading, setIsLoading] = useState(true)

  const [title, setTitle] = useState('')
  const [description, setDescription] = useState('')
  const [deadline, setDeadline] = useState('')
  const [website, setWebsite] = useState('')

  const [assignmentType, setAssignmentType] = useState<string>('INDIVIDUAL')
  const [groupSets, setGroupSets] = useState<GroupSetSchema[]>([])
  const [groupSetId, setGroupSetId] = useState<string>('')

  const [criteria, setCriteria] = useState<CriterionRow[]>([])

  const [peerEnabled, setPeerEnabled] = useState(false)
  const [reviewsPerStudent, setReviewsPerStudent] = useState(3)
  const [reviewDeadline, setReviewDeadline] = useState('')

  const [saEnabled, setSaEnabled] = useState(false)
  const [saDeadline, setSaDeadline] = useState('')
  const [saChecklist, setSaChecklist] = useState(false)
  const [saRubric, setSaRubric] = useState(false)
  const [saReflection, setSaReflection] = useState(false)
  const [saFeedback, setSaFeedback] = useState(false)
  const [checklistItems, setChecklistItems] = useState<{ id: number | null; name: string; description: string }[]>([])
  const [rubricSelected, setRubricSelected] = useState<Set<number>>(new Set())
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const [rubricTree, setRubricTree] = useState<{ id: number; name: string; marks: number; selected: boolean; children?: any[] }[]>([])
  const [reflectionPrompts, setReflectionPrompts] = useState<{ stage: string; label: string; prompt_text: string }[]>(DEFAULT_REFLECTIONS)

  const [submitting, setSubmitting] = useState(false)

  const load = useCallback(async () => {
    try {
      const [assignment, structure] = await Promise.all([
        DefaultService.getAssignment(assignmentId),
        DefaultService.getAssignmentStructure(assignmentId),
      ])

      // Basic info
      setTitle(assignment.assignmentTitle ?? '')
      setDescription(assignment.assignmentDescription ?? '')
      setDeadline(toLocalInput(assignment.deadline))
      setWebsite(assignment.assignmentWebsite ?? '')
      setAssignmentType(assignment.assignment_type ?? 'INDIVIDUAL')
      if (assignment.group_set_id) setGroupSetId(String(assignment.group_set_id))

      // Peer review
      setPeerEnabled(Boolean(assignment.peer_review_enabled))
      setReviewsPerStudent(assignment.reviews_per_student ?? 3)
      setReviewDeadline(toLocalInput(assignment.review_deadline))

      // Self-assessment
      setSaEnabled(Boolean(assignment.self_assessment_enabled))
      setSaDeadline(toLocalInput(assignment.self_assessment_deadline))

      // Criteria
      const existingCriteria = (structure.criteria ?? []).map(
        (c: { id: number; name: string; marks: number }) => ({
          id: c.id,
          name: c.name,
          marks: String(c.marks),
        })
      )
      setCriteria(existingCriteria)

      // SA settings (best-effort)
      try {
        const saSettings = await DefaultService.getSelfAssessmentSettings(assignmentId)
        setSaChecklist(Boolean(saSettings.use_checklist))
        setSaRubric(Boolean(saSettings.use_rubric))
        setSaReflection(Boolean(saSettings.use_reflection))
        setSaFeedback(Boolean(saSettings.needs_feedback))
      } catch {
        // SA settings may not exist yet
      }

      // Load checklist items, rubric tree, reflection prompts
      try {
        const [cl, rt, rf] = await Promise.all([
          DefaultService.listChecklistItems(assignmentId),
          DefaultService.getRubricTree(assignmentId),
          DefaultService.getReflectionPrompts(assignmentId),
        ])
        /* eslint-disable @typescript-eslint/no-explicit-any */
        setChecklistItems((cl as any[]).map((i: any) => ({ id: i.id, name: i.name, description: i.description ?? '' })))
        setRubricTree(rt as any[])
        const sel = new Set<number>()
        const walk = (nodes: any[]) => nodes.forEach((n: any) => { if (n.selected) sel.add(n.id); if (n.children) walk(n.children) })
        walk(rt as any[])
        setRubricSelected(sel)
        if ((rf as any[]).length > 0) setReflectionPrompts(rf as any[])
        /* eslint-enable @typescript-eslint/no-explicit-any */
      } catch { /* SA data may not exist yet */ }

      // Group sets for the selector
      if (currentCourseId) {
        DefaultService.listGroupSets(currentCourseId)
          .then(setGroupSets)
          .catch(() => {})
      }
    } catch {
      toast.error('Could not load assignment')
    } finally {
      setIsLoading(false)
    }
  }, [assignmentId, currentCourseId])

  useEffect(() => {
    load()
  }, [load])

  const save = async () => {
    if (!title.trim()) return toast.error('Give the assignment a title')
    if (!deadline) return toast.error('Set a submission deadline')

    // Deadline validation
    const deadlineMs = new Date(deadline).getTime()
    if (peerEnabled && reviewDeadline && new Date(reviewDeadline).getTime() <= deadlineMs) {
      return toast.error('Peer review deadline must be after the submission deadline')
    }
    if (saEnabled && saDeadline && new Date(saDeadline).getTime() <= deadlineMs) {
      return toast.error('Self-assessment deadline must be after the submission deadline')
    }

    // Validate criteria
    const validCriteria = criteria.filter((c) => c.name.trim())
    for (const c of validCriteria) {
      const m = Number(c.marks)
      if (!Number.isFinite(m) || m < 0) {
        return toast.error(`Enter a valid max mark for criterion "${c.name}"`)
      }
    }

    setSubmitting(true)
    try {
      // 1. Update assignment basics
      // Update core assignment fields
      await DefaultService.updateAssignment(assignmentId, {
        assignmentTitle: title.trim(),
        assignmentDescription: description.trim() || null,
        assignmentWebsite: website.trim() || null,
        deadline: new Date(deadline).toISOString(),
      })

      // 2. Manage criteria: update existing, create new
      await Promise.all(
        validCriteria.map((c) => {
          if (c.id) {
            return DefaultService.updateAssignmentCriterion(assignmentId, c.id, {
              name: c.name.trim(),
              marks: Number(c.marks),
            }).catch(() => {})
          }
          return DefaultService.createAssignmentCriterion(assignmentId, {
            name: c.name.trim(),
            marks: Number(c.marks),
          }).catch(() => {})
        })
      )

      // 3. Update SA settings
      if (saEnabled) {
        await DefaultService.updateSelfAssessmentSettings(assignmentId, {
          enabled: true,
          use_checklist: saChecklist,
          use_rubric: saRubric,
          use_reflection: saReflection,
          needs_feedback: saFeedback,
          deadline: saDeadline ? new Date(saDeadline).toISOString() : undefined,
        }).catch(() => {})

        // Save checklist items (add new, update existing)
        if (saChecklist) {
          for (const item of checklistItems) {
            if (item.name.trim()) {
              if (item.id) {
                await DefaultService.editChecklistItem(item.id, { name: item.name.trim(), description: item.description.trim() || undefined }).catch(() => {})
              } else {
                await DefaultService.addChecklistItem(assignmentId, { name: item.name.trim(), description: item.description.trim() || undefined }).catch(() => {})
              }
            }
          }
        }
        // Save rubric selection
        if (saRubric) {
          await DefaultService.saveRubricSelection(assignmentId, { criteria_ids: [...rubricSelected] }).catch(() => {})
        }
        // Save reflection prompts
        if (saReflection) {
          await DefaultService.saveReflectionPrompts(assignmentId, {
            prompts: Object.fromEntries(reflectionPrompts.map(p => [p.stage, p.prompt_text])),
          }).catch(() => {})
        }
      }

      toast.success('Assignment updated')
      router.push(`/assignments/${assignmentId}/submissions`)
    } catch (err) {
      toast.error(
        err instanceof Error ? err.message : 'Could not update the assignment'
      )
    } finally {
      setSubmitting(false)
    }
  }

  /** Toggle a criterion ID in the rubricSelected set */
  const toggleRubricCriterion = (id: number) => {
    setRubricSelected(prev => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }

  /** Render rubric tree checkboxes recursively */
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const renderRubricNode = (node: any, depth = 0): React.ReactNode => (
    <div key={node.id} style={{ paddingLeft: depth * 20 }}>
      <label className='flex cursor-pointer items-center gap-2.5 py-1'>
        <input
          type='checkbox'
          checked={rubricSelected.has(node.id)}
          onChange={() => toggleRubricCriterion(node.id)}
          className='h-[15px] w-[15px] accent-[#131A26]'
        />
        <span className='text-[13px] text-[#2C3444]'>
          {node.name}
          <span className='ml-1.5 text-[12px] text-[#8A9099]'>({node.marks} marks)</span>
        </span>
      </label>
      {/* eslint-disable-next-line @typescript-eslint/no-explicit-any */}
      {node.children?.map((child: any) => renderRubricNode(child, depth + 1))}
    </div>
  )

  // Guard: only academics / TAs can edit
  if (user && !user.isAcademic && !user.isTA) {
    return (
      <div className='mx-auto w-full max-w-[1200px] px-7 pb-12 pt-8'>
        <div className='rounded-[14px] border border-[#EAE5DB] bg-white px-5 py-12 text-center text-sm text-[#8A9099]'>
          This page is not available for your role.
        </div>
      </div>
    )
  }

  if (isLoading) {
    return (
      <div className='mx-auto w-full max-w-[1200px] px-7 pb-12 pt-8'>
        <Skeleton className='mb-2 h-6 w-60' />
        <Skeleton className='mb-6 h-4 w-96' />
        <Skeleton className='mb-4 h-52 w-full rounded-[14px]' />
        <Skeleton className='mb-4 h-40 w-full rounded-[14px]' />
        <Skeleton className='h-32 w-full rounded-[14px]' />
      </div>
    )
  }

  const isGroup = assignmentType === 'GROUP'

  return (
    <div className='mx-auto flex min-h-full w-full flex-col'>
      <div className='mx-auto w-full max-w-[1200px] px-7 pt-8'>
        <div className='mb-[22px]'>
          <div className='text-[23px] font-semibold tracking-[-0.5px] text-[#131A26]'>
            Edit Assignment
          </div>
          <div className='mt-[3px] text-[13.5px] text-[#5A6070]'>
            Update assignment details, criteria, and assessment settings.
          </div>
        </div>

        {/* Basic information */}
        <section className='mb-3.5 overflow-hidden rounded-[14px] border border-[#EAE5DB] bg-white'>
          <div className='border-b border-[#F0ECE4] px-6 pb-[15px] pt-[18px]'>
            <span className='block text-[14px] font-semibold tracking-[-0.05px] text-[#131A26]'>
              Basic information
            </span>
          </div>
          <div className='px-6 pb-[22px] pt-5'>
            <div className='flex flex-col gap-4'>
              <div>
                <div className={FIELD_LABEL_CLS}>
                  Title
                  <RequiredTag />
                </div>
                <input
                  type='text'
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  className={`${INPUT_CLS} max-w-[460px]`}
                />
              </div>
              <div>
                <div className={FIELD_LABEL_CLS}>Description</div>
                <textarea
                  rows={3}
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  className={`${INPUT_CLS} max-w-[620px] resize-y leading-[1.6]`}
                />
              </div>
              <div className='grid max-w-[620px] grid-cols-1 gap-4 sm:grid-cols-2'>
                <div>
                  <div className={FIELD_LABEL_CLS}>
                    Submission deadline
                    <RequiredTag />
                  </div>
                  <input
                    type='datetime-local'
                    value={deadline}
                    onChange={(e) => setDeadline(e.target.value)}
                    className={INPUT_CLS}
                  />
                </div>
                <div>
                  <div className={FIELD_LABEL_CLS}>
                    Assignment website{' '}
                    <span className='font-normal text-[#8A9099]'>optional</span>
                  </div>
                  <input
                    type='text'
                    value={website}
                    onChange={(e) => setWebsite(e.target.value)}
                    placeholder='https://'
                    className={INPUT_CLS}
                  />
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* Submission type — read-only after creation */}
        <section className='mb-3.5 overflow-hidden rounded-[14px] border border-[#EAE5DB] bg-white'>
          <div className='border-b border-[#F0ECE4] px-6 pb-[15px] pt-[18px]'>
            <span className='block text-[14px] font-semibold tracking-[-0.05px] text-[#131A26]'>
              Submission type
            </span>
            <span className='mt-0.5 block text-[12.5px] leading-[1.5] text-[#5A6070]'>
              This cannot be changed after creation.
            </span>
          </div>
          <div className='px-6 pb-[22px] pt-5'>
            <div className='flex items-center gap-3 rounded-[11px] border-[1.5px] border-[#131A26] bg-[#FAF8F4] p-[15px]'>
              <span className='block h-4 w-4 flex-none rounded-full border-[5px] border-[#131A26] bg-white' />
              <span className='text-[14px] font-semibold text-[#131A26]'>
                {isGroup ? 'Group' : 'Individual'}
              </span>
            </div>
            {isGroup && groupSets.length > 0 && (
              <div className='mt-3 text-[13px] text-[#5A6070]'>
                Group category:{' '}
                <span className='font-semibold text-[#131A26]'>
                  {groupSets.find((gs) => String(gs.id) === groupSetId)?.name ?? groupSetId}
                </span>
              </div>
            )}
          </div>
        </section>

        {/* Marking criteria */}
        <section className='mb-3.5 overflow-hidden rounded-[14px] border border-[#EAE5DB] bg-white'>
          <div className='flex items-center justify-between border-b border-[#F0ECE4] px-6 pb-[15px] pt-[18px]'>
            <span>
              <span className='block text-[14px] font-semibold tracking-[-0.05px] text-[#131A26]'>
                Marking criteria
              </span>
              <span className='mt-0.5 block text-[12.5px] leading-[1.5] text-[#5A6070]'>
                Define how this assignment is graded.
              </span>
            </span>
            <button
              type='button'
              onClick={() =>
                setCriteria((prev) => [...prev, { id: null, name: '', marks: '' }])
              }
              className='shrink-0 rounded-[9px] border border-[#DED8CA] bg-white px-3.5 py-1.5 text-[12px] font-semibold text-[#2C3444] hover:bg-[#F2EFE8]'
            >
              + Add Criterion
            </button>
          </div>
          <div className='px-6 pb-[22px] pt-5'>
            {criteria.length === 0 ? (
              <p className='text-center text-[13px] text-[#8A9099]'>
                No criteria yet. Click &ldquo;+ Add Criterion&rdquo; to define
                grading rubric items.
              </p>
            ) : (
              <div className='flex flex-col gap-3'>
                {criteria.map((c, i) => (
                  <div key={c.id ?? `new-${i}`} className='flex items-center gap-2'>
                    <input
                      type='text'
                      value={c.name}
                      onChange={(e) => {
                        const next = [...criteria]
                        next[i] = { ...c, name: e.target.value }
                        setCriteria(next)
                      }}
                      placeholder='Criterion name'
                      className={`${INPUT_CLS} min-w-0 flex-1`}
                    />
                    <div className='flex items-center gap-1.5'>
                      <span className='text-[12px] text-[#5A6070]'>0–</span>
                      <input
                        type='number'
                        min={0}
                        value={c.marks}
                        onChange={(e) => {
                          const next = [...criteria]
                          next[i] = { ...c, marks: e.target.value }
                          setCriteria(next)
                        }}
                        placeholder='Max'
                        className={`${INPUT_CLS} w-20`}
                      />
                      <span className='text-[12px] text-[#5A6070]'>marks</span>
                    </div>
                    <button
                      type='button'
                      onClick={() =>
                        setCriteria((prev) => prev.filter((_, j) => j !== i))
                      }
                      className='rounded-[9px] border border-[#DED8CA] bg-white px-2.5 py-2 text-[12px] font-semibold text-[#8A9099] hover:bg-[#F8E8E5] hover:text-[#A93226]'
                    >
                      Remove
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>
        </section>

        {/* Assessment options */}
        <section className='mb-3.5 overflow-hidden rounded-[14px] border border-[#EAE5DB] bg-white'>
          <div className='border-b border-[#F0ECE4] px-6 pb-[15px] pt-[18px]'>
            <span className='block text-[14px] font-semibold tracking-[-0.05px] text-[#131A26]'>
              Assessment options
            </span>
          </div>
          <div className='px-6 pb-5 pt-1.5'>
            {/* Peer review toggle */}
            <div className='flex items-center gap-3.5 border-b border-[#F0ECE4] py-4'>
              <button
                type='button'
                onClick={() => setPeerEnabled((v) => !v)}
                aria-pressed={peerEnabled}
                className={`flex h-6 w-[42px] flex-none items-center rounded-[99px] p-0.5 ${
                  peerEnabled
                    ? 'justify-end bg-[#131A26]'
                    : 'justify-start bg-[#D8D2C6]'
                }`}
              >
                <span className='block h-5 w-5 rounded-full bg-white shadow-[0_1px_2px_rgba(19,26,38,.2)]' />
              </button>
              <span className='min-w-0 flex-1'>
                <span className='block text-[13.5px] font-semibold text-[#2C3444]'>
                  Peer review
                </span>
                <span className='mt-0.5 block text-[12px] leading-[1.5] text-[#5A6070]'>
                  Students review each other anonymously.
                </span>
              </span>
            </div>

            {peerEnabled && (
              <div className='my-3.5 rounded-[12px] bg-[#FAF8F4] p-4'>
                <div className='mb-3 text-[10px] font-semibold uppercase tracking-[.85px] text-[#A29A8C]'>
                  Review settings
                </div>
                <div className='grid grid-cols-1 gap-3 sm:grid-cols-2'>
                  <div>
                    <div className={FIELD_LABEL_CLS}>Reviews per student</div>
                    <input
                      type='number'
                      min={1}
                      value={reviewsPerStudent}
                      onChange={(e) =>
                        setReviewsPerStudent(Number(e.target.value))
                      }
                      className={INPUT_CLS}
                    />
                  </div>
                  <div>
                    <div className={FIELD_LABEL_CLS}>Review deadline</div>
                    <input
                      type='datetime-local'
                      value={reviewDeadline}
                      onChange={(e) => setReviewDeadline(e.target.value)}
                      className={INPUT_CLS}
                    />
                    <div className='mt-[5px] text-[11.5px] leading-[1.5] text-[#8A9099]'>
                      Must be after the submission deadline.
                    </div>
                  </div>
                </div>
              </div>
            )}

            {/* Self-assessment toggle */}
            <div className='flex items-center gap-3.5 pb-1 pt-4'>
              <button
                type='button'
                onClick={() => setSaEnabled((v) => !v)}
                aria-pressed={saEnabled}
                className={`flex h-6 w-[42px] flex-none items-center rounded-[99px] p-0.5 ${
                  saEnabled
                    ? 'justify-end bg-[#131A26]'
                    : 'justify-start bg-[#D8D2C6]'
                }`}
              >
                <span className='block h-5 w-5 rounded-full bg-white shadow-[0_1px_2px_rgba(19,26,38,.2)]' />
              </button>
              <span className='min-w-0 flex-1'>
                <span className='block text-[13.5px] font-semibold text-[#2C3444]'>
                  Self-assessment
                </span>
                <span className='mt-0.5 block text-[12px] leading-[1.5] text-[#5A6070]'>
                  Checklist, rubric self-grading and guided reflection.
                </span>
              </span>
            </div>

            {saEnabled && (
              <div className='my-3.5 rounded-[12px] bg-[#FAF8F4] p-4'>
                <div className='mb-3 text-[10px] font-semibold uppercase tracking-[.85px] text-[#A29A8C]'>
                  Self-assessment settings
                </div>

                {/* Deadline */}
                <div className='grid grid-cols-1 gap-3 sm:grid-cols-2'>
                  <div>
                    <div className={FIELD_LABEL_CLS}>Self-assessment deadline</div>
                    <input
                      type='datetime-local'
                      value={saDeadline}
                      onChange={(e) => setSaDeadline(e.target.value)}
                      className={INPUT_CLS}
                    />
                    <div className='mt-[5px] text-[11.5px] leading-[1.5] text-[#8A9099]'>
                      Must be after the submission deadline.
                    </div>
                  </div>
                </div>

                {/* Teacher feedback toggle */}
                <div className='mt-4 rounded-[10px] border border-[#E8E3D8] bg-white'>
                  <div className='flex items-center justify-between px-4 py-2.5 border-b border-[#F0ECE4]'>
                    <span className='text-[13px] font-semibold text-[#131A26]'>Teacher feedback on self-assessment</span>
                    <button
                      type='button'
                      onClick={() => setSaFeedback(v => !v)}
                      aria-pressed={saFeedback}
                      className={`flex h-5 w-9 flex-none items-center rounded-[99px] p-0.5 ${
                        saFeedback ? 'justify-end bg-[#131A26]' : 'justify-start bg-[#D8D2C6]'
                      }`}
                    >
                      <span className='block h-4 w-4 rounded-full bg-white shadow-[0_1px_2px_rgba(19,26,38,.2)]' />
                    </button>
                  </div>
                </div>

                {/* Checklist sub-section */}
                <div className='mt-4 rounded-[10px] border border-[#E8E3D8] bg-white'>
                  <div className='flex items-center justify-between px-4 py-2.5 border-b border-[#F0ECE4]'>
                    <span className='text-[13px] font-semibold text-[#131A26]'>Checklist</span>
                    <button
                      type='button'
                      onClick={() => setSaChecklist(v => !v)}
                      aria-pressed={saChecklist}
                      className={`flex h-5 w-9 flex-none items-center rounded-[99px] p-0.5 ${
                        saChecklist ? 'justify-end bg-[#131A26]' : 'justify-start bg-[#D8D2C6]'
                      }`}
                    >
                      <span className='block h-4 w-4 rounded-full bg-white shadow-[0_1px_2px_rgba(19,26,38,.2)]' />
                    </button>
                  </div>
                  {saChecklist && (
                    <div className='px-4 py-3'>
                      {checklistItems.length === 0 ? (
                        <p className='text-center text-[12.5px] text-[#8A9099]'>No checklist items yet.</p>
                      ) : (
                        <div className='flex flex-col gap-2.5'>
                          {checklistItems.map((item, i) => (
                            <div key={item.id ?? `cl-new-${i}`} className='flex items-start gap-2'>
                              <div className='min-w-0 flex-1'>
                                <input
                                  type='text'
                                  value={item.name}
                                  onChange={(e) => {
                                    const next = [...checklistItems]
                                    next[i] = { ...item, name: e.target.value }
                                    setChecklistItems(next)
                                  }}
                                  placeholder='Item name'
                                  className={`${INPUT_CLS} mb-1.5`}
                                />
                                <input
                                  type='text'
                                  value={item.description}
                                  onChange={(e) => {
                                    const next = [...checklistItems]
                                    next[i] = { ...item, description: e.target.value }
                                    setChecklistItems(next)
                                  }}
                                  placeholder='Description (optional)'
                                  className={INPUT_CLS}
                                />
                              </div>
                              <button
                                type='button'
                                onClick={() => setChecklistItems(prev => prev.filter((_, j) => j !== i))}
                                className='mt-1 shrink-0 rounded-[9px] border border-[#DED8CA] bg-white px-2.5 py-2 text-[12px] font-semibold text-[#8A9099] hover:bg-[#F8E8E5] hover:text-[#A93226]'
                              >
                                Remove
                              </button>
                            </div>
                          ))}
                        </div>
                      )}
                      <button
                        type='button'
                        onClick={() => setChecklistItems(prev => [...prev, { id: null, name: '', description: '' }])}
                        className='mt-3 rounded-[9px] border border-[#DED8CA] bg-white px-3.5 py-1.5 text-[12px] font-semibold text-[#2C3444] hover:bg-[#F2EFE8]'
                      >
                        + Add Item
                      </button>
                    </div>
                  )}
                </div>

                {/* Rubric Self-Grading sub-section */}
                <div className='mt-4 rounded-[10px] border border-[#E8E3D8] bg-white'>
                  <div className='flex items-center justify-between px-4 py-2.5 border-b border-[#F0ECE4]'>
                    <span className='text-[13px] font-semibold text-[#131A26]'>Rubric Self-Grading</span>
                    <button
                      type='button'
                      onClick={() => setSaRubric(v => !v)}
                      aria-pressed={saRubric}
                      className={`flex h-5 w-9 flex-none items-center rounded-[99px] p-0.5 ${
                        saRubric ? 'justify-end bg-[#131A26]' : 'justify-start bg-[#D8D2C6]'
                      }`}
                    >
                      <span className='block h-4 w-4 rounded-full bg-white shadow-[0_1px_2px_rgba(19,26,38,.2)]' />
                    </button>
                  </div>
                  {saRubric && (
                    <div className='px-4 py-3'>
                      <p className='mb-2.5 text-[12.5px] text-[#5A6070]'>
                        Select which marking criteria students self-grade against.
                      </p>
                      {rubricTree.length === 0 ? (
                        <p className='text-center text-[12.5px] text-[#8A9099]'>No rubric criteria yet.</p>
                      ) : (
                        <div className='flex flex-col gap-0.5'>
                          {rubricTree.map(node => renderRubricNode(node))}
                        </div>
                      )}
                    </div>
                  )}
                </div>

                {/* Guided Reflection sub-section */}
                <div className='mt-4 rounded-[10px] border border-[#E8E3D8] bg-white'>
                  <div className='flex items-center justify-between px-4 py-2.5 border-b border-[#F0ECE4]'>
                    <span className='text-[13px] font-semibold text-[#131A26]'>Guided Reflection</span>
                    <button
                      type='button'
                      onClick={() => setSaReflection(v => !v)}
                      aria-pressed={saReflection}
                      className={`flex h-5 w-9 flex-none items-center rounded-[99px] p-0.5 ${
                        saReflection ? 'justify-end bg-[#131A26]' : 'justify-start bg-[#D8D2C6]'
                      }`}
                    >
                      <span className='block h-4 w-4 rounded-full bg-white shadow-[0_1px_2px_rgba(19,26,38,.2)]' />
                    </button>
                  </div>
                  {saReflection && (
                    <div className='px-4 py-3'>
                      <p className='mb-3 text-[12.5px] text-[#5A6070]'>
                        Six stages of the Gibbs Reflective Cycle. Prompts are editable.
                      </p>
                      <div className='flex flex-col gap-3'>
                        {reflectionPrompts.map((p, i) => (
                          <div key={p.stage}>
                            <div className={FIELD_LABEL_CLS}>{p.label}</div>
                            <input
                              type='text'
                              value={p.prompt_text}
                              onChange={(e) => {
                                const next = [...reflectionPrompts]
                                next[i] = { ...p, prompt_text: e.target.value }
                                setReflectionPrompts(next)
                              }}
                              className={INPUT_CLS}
                            />
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              </div>
            )}
          </div>
        </section>
      </div>

      {/* Sticky footer */}
      <div className='sticky bottom-0 z-20 mt-auto border-t border-[#EAE5DB] bg-[#F5F3EF]'>
        <div className='mx-auto flex w-full max-w-[1200px] items-center gap-3 px-7 py-3.5'>
          <span className='flex-1 text-[12.5px] text-[#8A9099]'>
            Changes are saved when you click &ldquo;Save changes&rdquo;.
          </span>
          <button
            type='button'
            onClick={() =>
              router.push(`/assignments/${assignmentId}/submissions`)
            }
            className='rounded-[9px] border border-[#DED8CA] bg-white px-[17px] py-[9px] text-[13px] font-semibold text-[#2C3444] hover:bg-[#F2EFE8]'
          >
            Cancel
          </button>
          <button
            type='button'
            onClick={save}
            disabled={submitting}
            className='flex items-center rounded-[9px] bg-[#131A26] px-5 py-2.5 text-[13px] font-semibold text-white hover:bg-[#243247] disabled:opacity-60'
          >
            {submitting && <Loader2 className='mr-2 h-4 w-4 animate-spin' />}
            Save changes
          </button>
        </div>
      </div>
    </div>
  )
}
