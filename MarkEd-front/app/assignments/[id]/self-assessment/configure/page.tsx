'use client'

/**
 * Teacher self-assessment configuration — ported from Mingyue's
 * self_assessment_configuration.html and checklist_modals.html.
 *
 * Her three configurable sections in her order: checklist, Gibbs reflection
 * prompts, rubric self-grading, plus the enable toggle and the separate
 * deadline. Her jsTree criteria picker becomes a plain checkbox tree (the
 * target architecture is React); the selection semantics are unchanged.
 *
 * Category-(b) fixes from her evaluation (Unified PRD §9):
 *   a-4  one save for the whole configuration, not several
 *   b-4  the deadline is labelled 'Self-Assessment Deadline' in full
 *   b-11 required fields are marked with an asterisk
 * Dirty tracking disables the save button until something changes and shows a
 * saved indicator afterwards.
 */

import { useCallback, useEffect, useMemo, useState } from 'react'
import { useParams } from 'next/navigation'
import {
  DefaultService,
  RubricTreeNode,
  SelfAssessmentSettingSchema,
} from '@/src/api'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Switch } from '@/components/ui/switch'
import { Checkbox } from '@/components/ui/checkbox'
import { Skeleton } from '@/components/ui/skeleton'
import { Check, Plus, Trash2 } from 'lucide-react'
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
      <h1 className='text-2xl font-bold'>Self-assessment configuration</h1>
      <p className='mt-1 text-sm text-muted-foreground'>
        Choose what students reflect on, then save. Students see this once you
        enable it.
      </p>

      <div className='mt-6 grid gap-4'>
        {/* General settings */}
        <Card>
          <CardHeader className='pb-3'>
            <CardTitle className='text-base'>General</CardTitle>
          </CardHeader>
          <CardContent className='grid gap-4'>
            {[
              ['enabled', 'Enable self-assessment for this assignment'],
              ['use_checklist', 'Include a checklist'],
              ['use_reflection', 'Include a Gibbs reflection'],
              ['use_rubric', 'Include rubric self-grading'],
            ].map(([key, label]) => (
              <div key={key} className='flex items-center justify-between gap-4'>
                <Label htmlFor={`sa-${key}`} className='font-normal'>
                  {label}
                </Label>
                <Switch
                  id={`sa-${key}`}
                  checked={Boolean(settings[key as keyof SelfAssessmentSettingSchema])}
                  onCheckedChange={(checked) =>
                    patchSettings({ [key]: checked } as Partial<SelfAssessmentSettingSchema>)
                  }
                />
              </div>
            ))}
            <div className='grid gap-1.5'>
              {/* b-4: full label. */}
              <Label htmlFor='sa-deadline'>
                Self-Assessment Deadline <span className='text-red-600'>*</span>
              </Label>
              <Input
                id='sa-deadline'
                type='datetime-local'
                value={deadline}
                onChange={(e) => setDeadline(e.target.value)}
              />
              <p className='text-xs text-muted-foreground'>
                Submissions after this are recorded as late.
              </p>
            </div>
          </CardContent>
        </Card>

        {/* Checklist */}
        {settings.use_checklist && (
          <Card>
            <CardHeader className='pb-3'>
              <CardTitle className='text-base'>Checklist items</CardTitle>
            </CardHeader>
            <CardContent>
              <div className='grid gap-2'>
                {checklist.length === 0 && (
                  <p className='text-sm text-muted-foreground'>
                    No items yet. Add the things students should confirm they have done.
                  </p>
                )}
                {checklist.map((item) => (
                  <div
                    key={item.id}
                    className='flex items-center justify-between gap-2 rounded-md border px-3 py-2 text-sm'
                  >
                    <span>{item.name}</span>
                    <button
                      type='button'
                      aria-label={`Remove ${item.name}`}
                      onClick={() => deleteChecklistItem(item.id)}
                      className='text-muted-foreground hover:text-red-600'
                    >
                      <Trash2 className='h-4 w-4' />
                    </button>
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
            </CardContent>
          </Card>
        )}

        {/* Gibbs reflection prompts */}
        {settings.use_reflection && (
          <Card>
            <CardHeader className='pb-3'>
              <CardTitle className='text-base'>Gibbs reflection prompts</CardTitle>
            </CardHeader>
            <CardContent className='grid gap-3'>
              {prompts.map((prompt, index) => (
                <div key={prompt.stage} className='grid gap-1.5'>
                  <Label className='text-sm font-medium'>{prompt.label}</Label>
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
            </CardContent>
          </Card>
        )}

        {/* Rubric self-grading — the jsTree replacement */}
        {settings.use_rubric && (
          <Card>
            <CardHeader className='pb-1'>
              <CardTitle className='text-base'>Rubric self-grading</CardTitle>
            </CardHeader>
            <CardContent>
              <p className='mb-3 text-xs text-muted-foreground'>
                Choose which criteria students grade themselves against.
              </p>
              {tree.length === 0 ? (
                <p className='text-sm text-muted-foreground'>
                  This assignment has no rubric criteria yet.
                </p>
              ) : (
                <RubricTree
                  nodes={tree}
                  selected={selected}
                  onToggle={toggleCriterion}
                />
              )}
            </CardContent>
          </Card>
        )}
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
    <div className='grid gap-2' style={{ marginLeft: depth ? 16 : 0 }}>
      {nodes.map((node) => (
        <div key={node.id} className='grid gap-2'>
          <label className='flex items-center gap-2.5 rounded-md border px-3 py-2 text-sm'>
            <Checkbox
              checked={selected.has(node.id)}
              onCheckedChange={() => onToggle(node.id)}
            />
            <span className='flex-1'>
              <span className='font-medium'>{node.name}</span>
              <span className='ml-2 text-xs text-muted-foreground'>
                {node.marks} marks
              </span>
            </span>
          </label>
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
