'use client'

/**
 * Group Categories list — ported from Hao's groupset_list.html / groupset_form.html.
 *
 * Called "Group Category" throughout the UI: his summative evaluation found
 * "GroupSet" confusing (Unified PRD §9, b-1). The model name is unchanged.
 */

import { useCallback, useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { DefaultService, GroupSetSchema } from '@/src/api'
import { useCourse } from '@/src/contexts/course-context'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Switch } from '@/components/ui/switch'
import { Skeleton } from '@/components/ui/skeleton'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Plus, Users2 } from 'lucide-react'
import { toast } from 'sonner'

const BLANK = {
  name: '',
  description: '',
  min_group_size: 2,
  max_group_size: 5,
  allow_student_self_assignment: false,
}

export default function GroupSetsPage() {
  const router = useRouter()
  const { currentCourseId, currentCourse } = useCourse()
  const [sets, setSets] = useState<GroupSetSchema[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [open, setOpen] = useState(false)
  const [editingId, setEditingId] = useState<number | null>(null)
  const [sizesLocked, setSizesLocked] = useState(false)
  const [form, setForm] = useState(BLANK)
  const [saving, setSaving] = useState(false)

  const load = useCallback(async () => {
    if (!currentCourseId) return
    try {
      setSets(await DefaultService.listGroupSets(currentCourseId))
    } catch {
      toast.error('Could not load group categories')
    } finally {
      setIsLoading(false)
    }
  }, [currentCourseId])

  useEffect(() => {
    load()
  }, [load])

  const openCreate = () => {
    setEditingId(null)
    setSizesLocked(false)
    setForm(BLANK)
    setOpen(true)
  }

  const openEdit = (gs: GroupSetSchema) => {
    setEditingId(gs.id)
    // Hao locked the sizes once teams had members, so existing groups can't be
    // invalidated retroactively.
    setSizesLocked(gs.students_count > 0)
    setForm({
      name: gs.name,
      description: gs.description ?? '',
      min_group_size: gs.min_group_size,
      max_group_size: gs.max_group_size,
      allow_student_self_assignment: gs.allow_student_self_assignment,
    })
    setOpen(true)
  }

  const save = async () => {
    if (!currentCourseId) return
    if (!form.name.trim()) return toast.error('Give the group category a name')
    if (form.max_group_size < form.min_group_size) {
      return toast.error('Maximum size must be at least the minimum size')
    }
    setSaving(true)
    try {
      if (editingId) {
        const payload = sizesLocked
          ? {
              name: form.name,
              description: form.description,
              allow_student_self_assignment: form.allow_student_self_assignment,
            }
          : form
        await DefaultService.updateGroupSet(editingId, payload)
        toast.success('Group category updated')
      } else {
        await DefaultService.createGroupSet(currentCourseId, form)
        toast.success('Group category created')
      }
      setOpen(false)
      await load()
    } catch {
      toast.error('Could not save the group category')
    } finally {
      setSaving(false)
    }
  }

  if (isLoading) {
    return (
      <div className='mx-auto w-full max-w-4xl p-6'>
        <Skeleton className='h-9 w-64' />
        <Skeleton className='mt-6 h-52' />
      </div>
    )
  }

  return (
    <div className='mx-auto w-full max-w-4xl p-6'>
      <div className='mb-5 flex items-center justify-between gap-4'>
        <h1 className='text-2xl font-bold'>Group categories</h1>
        <Button onClick={openCreate}>
          <Plus className='mr-1 h-4 w-4' />
          Create group category
        </Button>
      </div>

      {sets.length === 0 ? (
        <Card>
          <CardContent className='py-14 text-center'>
            <Users2 className='mx-auto mb-3 h-10 w-10 text-neutral-400' />
            <p className='text-sm text-neutral-500'>
              No group categories yet. Create one to start forming teams.
            </p>
          </CardContent>
        </Card>
      ) : (
        <div className='overflow-x-auto rounded-lg border border-neutral-200 bg-white shadow-sm'>
          <div className='min-w-[640px]'>
            <div className='grid grid-cols-[1.6fr_0.8fr_1.4fr_1fr_1.4fr] gap-4 bg-neutral-50 px-5 py-2.5 text-[11px] font-semibold uppercase tracking-wide text-neutral-400'>
              <span>Name</span>
              <span>Size</span>
              <span>Students</span>
              <span>Self-enrol</span>
              <span />
            </div>
            {sets.map((gs) => (
              <div
                key={gs.id}
                className='grid grid-cols-[1.6fr_0.8fr_1.4fr_1fr_1.4fr] items-center gap-4 border-t border-neutral-100 px-5 py-3.5 hover:bg-neutral-50'
              >
                <div className='min-w-0'>
                  <div className='truncate text-sm font-medium'>{gs.name}</div>
                  {gs.description && (
                    <div className='truncate text-xs text-neutral-500'>
                      {gs.description}
                    </div>
                  )}
                </div>
                <span className='text-[13px] text-neutral-500'>
                  {gs.min_group_size}–{gs.max_group_size}
                </span>
                <span className='text-[13px] text-neutral-500'>
                  {gs.students_count} students · {gs.groups_count} groups
                </span>
                <span>
                  <span className='inline-block rounded-full bg-neutral-100 px-2 py-0.5 text-[11px] font-medium text-neutral-600'>
                    {gs.allow_student_self_assignment ? 'Enabled' : 'Disabled'}
                  </span>
                </span>
                <span className='flex justify-end gap-1.5'>
                  <Button
                    size='sm'
                    onClick={() => router.push(`/groupsets/${gs.id}`)}
                  >
                    Manage groups
                  </Button>
                  <Button
                    size='sm'
                    variant='outline'
                    aria-label={`Edit ${gs.name}`}
                    onClick={() => openEdit(gs)}
                  >
                    Edit
                  </Button>
                </span>
              </div>
            ))}
          </div>
        </div>
      )}

      <p className='mt-3 text-xs leading-relaxed text-neutral-400'>
        {currentCourse
          ? `A group category defines the group structure for ${currentCourse.courseCode} assignments. `
          : 'A group category defines the group structure for one or more assignments. '}
        Assignments of type Group or Group + Peer Review must reference a group
        category.
      </p>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>
              {editingId ? 'Edit group category' : 'New group category'}
            </DialogTitle>
            <DialogDescription>
              A group category holds one set of teams, for example
              &ldquo;Project Groups&rdquo;.
            </DialogDescription>
          </DialogHeader>

          <div className='grid gap-4'>
            <div className='grid gap-1.5'>
              <Label htmlFor='gs-name'>
                Name <span className='text-red-600'>*</span>
              </Label>
              <Input
                id='gs-name'
                value={form.name}
                onChange={(e) => setForm({ ...form, name: e.target.value })}
                placeholder='e.g. Project Groups'
              />
            </div>

            <div className='grid gap-1.5'>
              <Label htmlFor='gs-desc'>Description</Label>
              <Input
                id='gs-desc'
                value={form.description}
                onChange={(e) => setForm({ ...form, description: e.target.value })}
              />
            </div>

            <div className='grid grid-cols-2 gap-3'>
              <div className='grid gap-1.5'>
                <Label htmlFor='gs-min'>Minimum group size</Label>
                <Input
                  id='gs-min'
                  type='number'
                  min={1}
                  disabled={sizesLocked}
                  value={form.min_group_size}
                  onChange={(e) =>
                    setForm({ ...form, min_group_size: Number(e.target.value) })
                  }
                />
              </div>
              <div className='grid gap-1.5'>
                <Label htmlFor='gs-max'>Maximum group size</Label>
                <Input
                  id='gs-max'
                  type='number'
                  min={1}
                  disabled={sizesLocked}
                  value={form.max_group_size}
                  onChange={(e) =>
                    setForm({ ...form, max_group_size: Number(e.target.value) })
                  }
                />
              </div>
            </div>
            {sizesLocked && (
              <p className='-mt-2 text-xs text-muted-foreground'>
                Group sizes are locked because teams already have members.
              </p>
            )}

            <div className='flex items-start justify-between gap-4 rounded-md border p-3'>
              <div>
                <Label htmlFor='gs-self'>Let students join groups themselves</Label>
                {/* Help text added because his evaluation found this toggle hard
                    to discover (Unified PRD §9, b-3). */}
                <p className='mt-1 text-xs text-muted-foreground'>
                  When on, students pick their own team instead of being assigned.
                  You can still move anyone between teams.
                </p>
              </div>
              <Switch
                id='gs-self'
                checked={form.allow_student_self_assignment}
                onCheckedChange={(checked) =>
                  setForm({ ...form, allow_student_self_assignment: checked })
                }
              />
            </div>
          </div>

          <DialogFooter>
            <Button variant='outline' onClick={() => setOpen(false)}>
              Cancel
            </Button>
            <Button onClick={save} disabled={saving || !form.name.trim()}>
              {editingId ? 'Save' : 'Create'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
