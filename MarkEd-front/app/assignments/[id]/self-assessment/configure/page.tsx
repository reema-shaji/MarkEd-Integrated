'use client'

/**
 * Teacher self-assessment configuration — ported from Mingyue's
 * self_assessment_configuration.html and restyled to the unified
 * "SA Configuration" prototype.
 *
 * A deadline card and a teacher-feedback card sit side by side, followed by
 * collapsible Checklist / Rubric / Reflection sections. Everything persists
 * through a single save (a-4) with dirty tracking and a saved indicator.
 *
 * Category-(b) fixes from her evaluation (Unified PRD §9):
 *   a-4  one save for the whole configuration, not several
 *   b-4  the deadline is labelled 'Self-Assessment Deadline' in full
 *   b-11 required fields are marked with an asterisk
 */

import { useCallback, useEffect, useMemo, useState } from 'react'
import { useParams } from 'next/navigation'
import {
  DefaultService,
  RubricTreeNode,
  SelfAssessmentSettingSchema,
} from '@/src/api'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Switch } from '@/components/ui/switch'
import { Checkbox } from '@/components/ui/checkbox'
import { Skeleton } from '@/components/ui/skeleton'
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from '@/components/ui/collapsible'
import { Check, ChevronDown, Plus, Trash2 } from 'lucide-react'
import { toast } from 'sonner'

interface ChecklistItem {
  id: number
  name: string
  description: string
}
interface ReflectionPrompt {
  stage: string
  label: string
  prompt_text: string
}

/** datetime-local wants "YYYY-MM-DDTHH:mm"; the API sends ISO. */
const toLocalInput = (iso?: string | null) => (iso ? iso.slice(0, 16) : '')

export default function SelfAssessmentConfigurePage() {
  const params = useParams()
  const assignmentId = Number(params.id)

  const [isLoading, setIsLoading] = useState(true)
  const [saving, setSaving] = useState(false)

  const [settings, setSettings] = useState<SelfAssessmentSettingSchema | null>(null)
  const [deadline, setDeadline] = useState('')
  const [checklist, setChecklist] = useState<ChecklistItem[]>([])
  const [prompts, setPrompts] = useState<ReflectionPrompt[]>([])
  const [tree, setTree] = useState<RubricTreeNode[]>([])
  const [selected, setSelected] = useState<Set<number>>(new Set())

  const [newItem, setNewItem] = useState('')
  const [addingItem, setAddingItem] = useState(false)
  const [baseline, setBaseline] = useState('')

  /** Snapshot of everything the single save persists, for dirty tracking. */
  const snapshot = useCallback(
    (
      s: SelfAssessmentSettingSchema | null,
      dl: string,
      pr: ReflectionPrompt[],
      sel: Set<number>
    ) =>
      JSON.stringify({
        enabled: s?.enabled,
        use_checklist: s?.use_checklist,
        use_rubric: s?.use_rubric,
        use_reflection: s?.use_reflection,
        needs_feedback: s?.needs_feedback,
        deadline: dl,
        prompts: pr.map((p) => [p.stage, p.prompt_text]),
        selected: [...sel].sort((a, b) => a - b),
      }),
    []
  )

  const load = useCallback(async () => {
    try {
      const [s, cl, rf, rt] = await Promise.all([
        DefaultService.getSelfAssessmentSettings(assignmentId),
        DefaultService.listChecklistItems(assignmentId),
        DefaultService.getReflectionPrompts(assignmentId),
        DefaultService.getRubricTree(assignmentId),
      ])
      const dl = toLocalInput(s.deadline)
      const sel = new Set<number>()
      const walk = (nodes: RubricTreeNode[]) =>
        nodes.forEach((n) => {
          if (n.selected) sel.add(n.id)
          if (n.children) walk(n.children)
        })
      walk(rt)

      setSettings(s)
      setDeadline(dl)
      setChecklist(cl as ChecklistItem[])
      setPrompts(rf as ReflectionPrompt[])
      setTree(rt)
      setSelected(sel)
      setBaseline(snapshot(s, dl, rf as ReflectionPrompt[], sel))
    } catch {
      toast.error('Could not load the self-assessment configuration')
    } finally {
      setIsLoading(false)
    }
  }, [assignmentId, snapshot])

  useEffect(() => {
    load()
  }, [load])

  const dirty = useMemo(
    () => Boolean(settings) && snapshot(settings, deadline, prompts, selected) !== baseline,
    [settings, deadline, prompts, selected, baseline, snapshot]
  )

  const patchSettings = (patch: Partial<SelfAssessmentSettingSchema>) =>
    setSettings((prev) => (prev ? { ...prev, ...patch } : prev))

  const toggleCriterion = (id: number) =>
    setSelected((prev) => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })

  // Checklist items are discrete list actions (add/remove immediately), exactly
  // as Mingyue handled them through her modals.
  const addChecklistItem = async () => {
    if (!newItem.trim()) return
    setAddingItem(true)
    try {
      const created = await DefaultService.addChecklistItem(assignmentId, {
        name: newItem.trim(),
      })
      setChecklist((prev) => [...prev, created as ChecklistItem])
      setNewItem('')
    } catch {
      toast.error('Could not add that checklist item')
    } finally {
      setAddingItem(false)
    }
  }

  const deleteChecklistItem = async (itemId: number) => {
    try {
      await DefaultService.deleteChecklistItem(itemId)
      setChecklist((prev) => prev.filter((i) => i.id !== itemId))
    } catch {
      toast.error('Could not remove that checklist item')
    }
  }

  const saveAll = async () => {
    if (!settings) return
    setSaving(true)
    try {
      // One save for the whole configuration (a-4): settings, reflection
      // prompts and rubric selection are persisted together.
      await Promise.all([
        DefaultService.updateSelfAssessmentSettings(assignmentId, {
          enabled: settings.enabled,
          use_checklist: settings.use_checklist,
          use_rubric: settings.use_rubric,
          use_reflection: settings.use_reflection,
          needs_feedback: settings.needs_feedback,
          deadline: deadline ? new Date(deadline).toISOString() : undefined,
        }),
        DefaultService.saveReflectionPrompts(assignmentId, {
          prompts: Object.fromEntries(prompts.map((p) => [p.stage, p.prompt_text])),
        }),
        DefaultService.saveRubricSelection(assignmentId, {
          criteria_ids: [...selected],
        }),
      ])
      setBaseline(snapshot(settings, deadline, prompts, selected))
      toast.success('Self-assessment configuration saved')
    } catch {
      toast.error('Could not save the configuration')
    } finally {
      setSaving(false)
    }
  }

  if (isLoading || !settings) {
    return (
      <div className='mx-auto w-full max-w-3xl p-6'>
        <Skeleton className='h-9 w-80' />
        <div className='mt-6 grid gap-4'>
          <Skeleton className='h-40' />
          <Skeleton className='h-40' />
        </div>
      </div>
    )
  }

  return (
    <div className='mx-auto w-full max-w-3xl p-6 pb-24'>
      <div className='mb-1 text-[13px] text-neutral-400'>
        Assignments / Self-Assessment
      </div>
      <h1 className='text-2xl font-bold'>Self-Assessment Settings</h1>
      <p className='mt-1.5 text-sm text-neutral-500'>
        Configure the self-assessment components for this assignment. Students
        complete these sections when submitting their self-assessment.
      </p>
      <p className='mt-2 text-xs leading-relaxed text-neutral-400'>
        <b>Self-assessment</b> = the student&apos;s own evaluation of their work.{' '}
        <b>Feedback</b> = your optional response to that self-assessment.
      </p>

      {/* Master enable toggle. */}
      <Card className='mt-6'>
        <CardContent className='flex items-center justify-between gap-4 py-4'>
          <div>
            <Label htmlFor='sa-enabled' className='font-medium'>
              Enable self-assessment for this assignment
            </Label>
            <p className='mt-0.5 text-xs text-neutral-500'>
              Students see this once you enable it.
            </p>
          </div>
          <Switch
            id='sa-enabled'
            checked={Boolean(settings.enabled)}
            onCheckedChange={(checked) => patchSettings({ enabled: checked })}
          />
        </CardContent>
      </Card>

      {/* Deadline + teacher-feedback, side by side per the prototype. */}
      <div className='mt-4 grid gap-4 md:grid-cols-2'>
        <Card className='overflow-hidden'>
          <div className='border-b border-neutral-100 bg-neutral-50 px-5 py-3 text-sm font-semibold'>
            Deadline
          </div>
          <CardContent className='pt-4'>
            {/* b-4: full label. b-11: required asterisk. */}
            <Label htmlFor='sa-deadline' className='mb-1 block'>
              Self-Assessment Deadline <span className='text-red-600'>*</span>
            </Label>
            <Input
              id='sa-deadline'
              type='datetime-local'
              value={deadline}
              onChange={(e) => setDeadline(e.target.value)}
            />
            <p className='mt-2 text-xs text-neutral-500'>
              Submissions after this are recorded as late.
            </p>
          </CardContent>
        </Card>

        <Card className='overflow-hidden'>
          <div className='border-b border-neutral-100 bg-neutral-50 px-5 py-3 text-sm font-semibold'>
            Teacher Feedback on Self-Assessment
          </div>
          <CardContent className='pt-4'>
            <label className='flex cursor-pointer items-center gap-2.5'>
              <Checkbox
                checked={Boolean(settings.needs_feedback)}
                onCheckedChange={(checked) =>
                  patchSettings({ needs_feedback: checked === true })
                }
              />
              <span className='text-[13px] text-neutral-700'>
                Enable feedback on self-assessment
              </span>
            </label>
            <p className='mt-2 text-xs text-neutral-500'>
              When on, you can respond to each student&apos;s self-assessment.
            </p>
          </CardContent>
        </Card>
      </div>

      <div className='mt-4 grid gap-4'>
        {/* Checklist */}
        <ConfigSection
          title='Checklist'
          enabled={Boolean(settings.use_checklist)}
          onToggle={(checked) => patchSettings({ use_checklist: checked })}
        >
          <div className='flex flex-col gap-2'>
            {checklist.length === 0 && (
              <p className='text-sm text-neutral-500'>
                No items yet. Add the things students should confirm they have done.
              </p>
            )}
            {checklist.map((item) => (
              <div
                key={item.id}
                className='overflow-hidden rounded-lg border border-neutral-100'
              >
                <div className='flex items-center justify-between gap-2 bg-white px-3.5 py-2.5'>
                  <span className='text-[13px] font-semibold'>{item.name}</span>
                  <button
                    type='button'
                    aria-label={`Remove ${item.name}`}
                    onClick={() => deleteChecklistItem(item.id)}
                    className='text-neutral-400 hover:text-red-600'
                  >
                    <Trash2 className='h-4 w-4' />
                  </button>
                </div>
                {item.description && (
                  <div className='border-t border-neutral-100 bg-neutral-50 px-3.5 py-2 text-xs text-neutral-500'>
                    {item.description}
                  </div>
                )}
              </div>
            ))}
          </div>
          <div className='mt-3 flex gap-2'>
            <Input
              value={newItem}
              onChange={(e) => setNewItem(e.target.value)}
              placeholder='New checklist item'
              onKeyDown={(e) => e.key === 'Enter' && addChecklistItem()}
            />
            <Button
              variant='outline'
              onClick={addChecklistItem}
              disabled={addingItem || !newItem.trim()}
            >
              <Plus className='h-4 w-4' />
            </Button>
          </div>
        </ConfigSection>

        {/* Rubric self-grading — the jsTree replacement */}
        <ConfigSection
          title='Rubric-Based Self-Grading'
          enabled={Boolean(settings.use_rubric)}
          onToggle={(checked) => patchSettings({ use_rubric: checked })}
        >
          <p className='mb-3 text-[13px] text-neutral-500'>
            Select which marking criteria students self-grade against. Levels are
            inherited from the assignment rubric.
          </p>
          {tree.length === 0 ? (
            <p className='text-sm text-neutral-500'>
              This assignment has no rubric criteria yet.
            </p>
          ) : (
            <RubricTree
              nodes={tree}
              selected={selected}
              onToggle={toggleCriterion}
            />
          )}
        </ConfigSection>

        {/* Gibbs reflection prompts */}
        <ConfigSection
          title='Guided Reflection'
          enabled={Boolean(settings.use_reflection)}
          onToggle={(checked) => patchSettings({ use_reflection: checked })}
        >
          <p className='mb-3 text-[13px] text-neutral-500'>
            Six stages of the Gibbs Reflective Cycle. Prompts are editable.
          </p>
          <div className='flex flex-col gap-3'>
            {prompts.map((prompt, index) => (
              <div key={prompt.stage} className='grid gap-1.5'>
                <Label className='text-[13px] font-medium text-neutral-700'>
                  {prompt.label}
                </Label>
                <Input
                  value={prompt.prompt_text}
                  onChange={(e) => {
                    const next = [...prompts]
                    next[index] = { ...prompt, prompt_text: e.target.value }
                    setPrompts(next)
                  }}
                />
              </div>
            ))}
          </div>
        </ConfigSection>
      </div>

      {/* Single sticky save bar with a saved indicator and dirty tracking. */}
      <div className='fixed inset-x-0 bottom-0 z-40 border-t bg-neutral-100/95 backdrop-blur md:pl-64'>
        <div className='mx-auto flex max-w-3xl items-center justify-end gap-3 px-6 py-3'>
          {dirty ? (
            <span className='text-xs font-medium text-amber-600'>Unsaved changes</span>
          ) : (
            <span className='inline-flex items-center gap-1 text-xs font-medium text-green-600'>
              <Check className='h-3.5 w-3.5' /> All changes saved
            </span>
          )}
          <Button onClick={saveAll} disabled={!dirty || saving}>
            Save configuration
          </Button>
        </div>
      </div>
    </div>
  )
}

/** Collapsible component card with an enable toggle in its grey header. */
function ConfigSection({
  title,
  enabled,
  onToggle,
  children,
}: {
  title: string
  enabled: boolean
  onToggle: (checked: boolean) => void
  children: React.ReactNode
}) {
  return (
    <Collapsible defaultOpen className='group/cfg'>
      <Card className='overflow-hidden'>
        <div className='flex items-center gap-3 border-b border-neutral-100 bg-neutral-50 px-5 py-3'>
          <CollapsibleTrigger className='flex flex-1 items-center gap-2 text-left text-sm font-semibold'>
            <ChevronDown className='h-4 w-4 text-neutral-400 transition-transform group-data-[state=closed]/cfg:-rotate-90' />
            {title}
          </CollapsibleTrigger>
          {/* Untick to hide this section from students. */}
          <Switch checked={enabled} onCheckedChange={onToggle} />
        </div>
        <CollapsibleContent>
          <CardContent className='pt-4'>{children}</CardContent>
        </CollapsibleContent>
      </Card>
    </Collapsible>
  )
}

/** Recursive checkbox tree — faithful to jsTree's hierarchy and selection. */
function RubricTree({
  nodes,
  selected,
  onToggle,
  depth = 0,
}: {
  nodes: RubricTreeNode[]
  selected: Set<number>
  onToggle: (id: number) => void
  depth?: number
}) {
  return (
    <div className='grid gap-2.5' style={{ marginLeft: depth ? 16 : 0 }}>
      {nodes.map((node) => (
        <div key={node.id} className='grid gap-2.5'>
          <div className='rounded-lg border border-neutral-100 px-3.5 py-3'>
            <label className='flex cursor-pointer items-center gap-2.5 text-[13px] font-semibold'>
              <Checkbox
                checked={selected.has(node.id)}
                onCheckedChange={() => onToggle(node.id)}
              />
              {node.name}
              <span className='ml-1 text-xs font-normal text-neutral-500'>
                {node.marks} marks
              </span>
            </label>
          </div>
          {node.children && node.children.length > 0 && (
            <RubricTree
              nodes={node.children}
              selected={selected}
              onToggle={onToggle}
              depth={depth + 1}
            />
          )}
        </div>
      ))}
    </div>
  )
}
