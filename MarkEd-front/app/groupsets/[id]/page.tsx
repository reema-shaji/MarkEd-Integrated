'use client'

/**
 * Group management — ported from Hao's group_management.html.
 *
 * This is the centrepiece of his branch and the part his evaluation singled
 * out: drag-and-drop replaced dropdowns in iteration 2 and was praised, as was
 * "one-click" random assignment. The layout is his: unassigned students on the
 * left, group cards on the right, drag between them.
 *
 * His implementation used jQuery UI Sortable. This uses the browser's native
 * HTML5 drag-and-drop rather than pulling in a React DnD dependency (Unified
 * PRD risk R4); the interaction is the same, and every drag has a keyboard and
 * click-driven equivalent so the page is not drag-only.
 */

import { useCallback, useEffect, useMemo, useState } from 'react'
import { useParams, useRouter } from 'next/navigation'
import {
  DefaultService,
  GroupSchema,
  GroupSetSchema,
  UngroupedStudentSchema,
} from '@/src/api'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Skeleton } from '@/components/ui/skeleton'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog'
import { GripVertical, Shuffle, UserPlus, X } from 'lucide-react'
import { toast } from 'sonner'

const UNGROUPED = 'ungrouped'

export default function GroupManagementPage() {
  const params = useParams()
  const router = useRouter()
  const groupSetId = Number(params.id)

  const [groupSet, setGroupSet] = useState<GroupSetSchema | null>(null)
  const [groups, setGroups] = useState<GroupSchema[]>([])
  const [ungrouped, setUngrouped] = useState<UngroupedStudentSchema[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [busy, setBusy] = useState(false)
  const [search, setSearch] = useState('')
  const [dragOver, setDragOver] = useState<string | null>(null)

  const [createOpen, setCreateOpen] = useState(false)
  const [newName, setNewName] = useState('')
  const [randomOpen, setRandomOpen] = useState(false)
  const [randomMethod, setRandomMethod] = useState<'size' | 'groups'>('size')
  const [randomValue, setRandomValue] = useState(4)
  const [confirmRandom, setConfirmRandom] = useState(false)

  const load = useCallback(async () => {
    try {
      const [gs, gl, ug] = await Promise.all([
        DefaultService.getGroupSet(groupSetId),
        DefaultService.listGroups(groupSetId),
        DefaultService.listUngroupedStudents(groupSetId),
      ])
      setGroupSet(gs)
      setGroups(gl)
      setUngrouped(ug)
    } catch {
      toast.error('Could not load this group category')
    } finally {
      setIsLoading(false)
    }
  }, [groupSetId])

  useEffect(() => {
    load()
  }, [load])

  // Native HTML5 drag-and-drop does not auto-scroll the app shell's inner
  // scroll container (<main>), so a student can't be dragged to a group below
  // the fold. While a drag is in progress, scroll <main> when the pointer nears
  // the top/bottom edge of the viewport.
  useEffect(() => {
    const EDGE = 90 // px from an edge that triggers scrolling
    const SPEED = 16 // px per frame
    let dir = 0
    let raf = 0
    const scroller = () =>
      document.querySelector('main') as HTMLElement | null
    const tick = () => {
      if (dir !== 0) {
        scroller()?.scrollBy(0, dir * SPEED)
        raf = requestAnimationFrame(tick)
      } else {
        raf = 0
      }
    }
    const onDragOver = (e: DragEvent) => {
      const h = window.innerHeight
      dir = e.clientY < EDGE ? -1 : e.clientY > h - EDGE ? 1 : 0
      if (dir !== 0 && !raf) raf = requestAnimationFrame(tick)
    }
    const stop = () => {
      dir = 0
      if (raf) cancelAnimationFrame(raf)
      raf = 0
    }
    window.addEventListener('dragover', onDragOver)
    window.addEventListener('drop', stop)
    window.addEventListener('dragend', stop)
    return () => {
      window.removeEventListener('dragover', onDragOver)
      window.removeEventListener('drop', stop)
      window.removeEventListener('dragend', stop)
      if (raf) cancelAnimationFrame(raf)
    }
  }, [])

  const filteredUngrouped = useMemo(() => {
    const q = search.trim().toLowerCase()
    if (!q) return ungrouped
    return ungrouped.filter(
      (s) =>
        s.userName.toLowerCase().includes(q) ||
        s.userNumber.toLowerCase().includes(q)
    )
  }, [ungrouped, search])

  /** The single move primitive behind dragging, the picker and the remove button. */
  const move = async (studentId: number, targetGroupId: number | null) => {
    setBusy(true)
    try {
      await DefaultService.moveGroupMember(groupSetId, {
        student_id: studentId,
        target_group_id: targetGroupId,
      })
      await load()
    } catch (error) {
      const message =
        (error as { body?: { detail?: string } })?.body?.detail ??
        'Could not move that student'
      toast.error(message)
    } finally {
      setBusy(false)
    }
  }

  const onDrop = (event: React.DragEvent, target: string) => {
    event.preventDefault()
    setDragOver(null)
    const studentId = Number(event.dataTransfer.getData('text/plain'))
    if (!studentId) return
    move(studentId, target === UNGROUPED ? null : Number(target))
  }

  const createGroup = async () => {
    if (!newName.trim()) return toast.error('Give the group a name')
    setBusy(true)
    try {
      await DefaultService.createGroup(groupSetId, { name: newName.trim() })
      setNewName('')
      setCreateOpen(false)
      await load()
      toast.success('Group created')
    } catch {
      toast.error('Could not create the group')
    } finally {
      setBusy(false)
    }
  }

  const deleteGroup = async (group: GroupSchema) => {
    setBusy(true)
    try {
      await DefaultService.deleteGroup(group.id)
      await load()
      toast.success(`${group.name} deleted`)
    } catch {
      toast.error('Could not delete the group')
    } finally {
      setBusy(false)
    }
  }

  const runRandomAssign = async () => {
    if (!groupSet) return
    setConfirmRandom(false)
    setBusy(true)
    try {
      const response = await DefaultService.randomAssignStudents(groupSet.course_id, {
        group_set_id: groupSetId,
        method: randomMethod,
        group_size: randomMethod === 'size' ? randomValue : null,
        num_groups: randomMethod === 'groups' ? randomValue : null,
        group_name_prefix: 'Team',
      })
      setRandomOpen(false)
      await load()
      toast.success(response.message)
    } catch (error) {
      const message =
        (error as { body?: { detail?: string } })?.body?.detail ??
        'Could not assign students'
      toast.error(message)
    } finally {
      setBusy(false)
    }
  }

  const runAutoAssign = async () => {
    if (!groupSet) return
    setBusy(true)
    try {
      const response = await DefaultService.autoAssignUngrouped(groupSet.course_id, {
        group_set_id: groupSetId,
      })
      await load()
      toast.success(response.message)
    } catch (error) {
      const message =
        (error as { body?: { detail?: string } })?.body?.detail ??
        'Could not auto-assign students'
      toast.error(message)
    } finally {
      setBusy(false)
    }
  }

  if (isLoading) {
    return (
      <div className='w-full px-7 pb-11 pt-8'>
        <Skeleton className='h-9 w-72' />
        <div className='mt-6 flex flex-col gap-4 lg:flex-row'>
          <Skeleton className='h-96 lg:flex-[2]' />
          <Skeleton className='h-96 lg:flex-1 lg:min-w-[250px]' />
        </div>
      </div>
    )
  }

  const maxSize = groupSet?.max_group_size ?? 0

  return (
    <div className='flex w-full flex-col px-7 pb-11 pt-8'>
      <div className='mb-4 flex flex-none flex-wrap items-center justify-between gap-4'>
        <div>
          <div className='text-[13px] text-faint'>
            <button
              type='button'
              onClick={() => router.push('/groupsets')}
              className='text-faint hover:text-muted2'
            >
              Group Categories
            </button>{' '}
            / {groupSet?.name}
          </div>
          <h1 className='text-[21px] font-semibold tracking-[-0.45px] text-ink'>
            Group Management
          </h1>
        </div>
        <div className='flex flex-wrap gap-2'>
          <button
            onClick={() => setRandomOpen(true)}
            disabled={busy}
            className='inline-flex items-center gap-1.5 rounded-[9px] border border-line-input bg-white px-3.5 py-2 text-[13px] font-semibold text-[#2C3444] transition-colors hover:bg-warm-100 disabled:opacity-50'
          >
            <Shuffle className='h-4 w-4' />
            Random Assign
          </button>
          <button
            onClick={runAutoAssign}
            disabled={busy}
            className='inline-flex items-center gap-1.5 rounded-[9px] border border-line-input bg-white px-3.5 py-2 text-[13px] font-semibold text-[#2C3444] transition-colors hover:bg-warm-100 disabled:opacity-50'
          >
            <UserPlus className='h-4 w-4' />
            Auto-assign Ungrouped
          </button>
          <button
            onClick={() => setCreateOpen(true)}
            disabled={busy}
            className='rounded-[9px] bg-ink px-3.5 py-[7px] text-[13px] font-semibold text-white transition-colors hover:bg-ink-hover disabled:opacity-50'
          >
            + Create Group
          </button>
        </div>
      </div>

      <p className='mb-3.5 flex-none text-xs text-faint'>
        Drag students between groups, or into the Unassigned panel. Changes save
        automatically.
      </p>

      <div className='flex flex-col gap-4 lg:flex-row'>
        {/* Group cards — drop targets. */}
        <div className='grid content-start gap-3.5 sm:grid-cols-2 lg:flex-[2] lg:grid-cols-[repeat(auto-fill,minmax(230px,1fr))]'>
          {groups.length === 0 && (
            <div className='rounded-[14px] border border-line-card bg-white py-12 text-center text-sm text-muted2 sm:col-span-2'>
              No groups yet. Create one, or use random assign to build them all
              at once.
            </div>
          )}

          {groups.map((group) => {
            const full = group.members.length >= maxSize
            return (
              <div
                key={group.id}
                onDragOver={(e) => {
                  e.preventDefault()
                  setDragOver(String(group.id))
                }}
                onDragLeave={() => setDragOver(null)}
                onDrop={(e) => onDrop(e, String(group.id))}
                className={`overflow-hidden rounded-[14px] border bg-white ${
                  dragOver === String(group.id)
                    ? 'border-ink'
                    : 'border-line-card'
                }`}
              >
                <div className='flex items-center justify-between gap-2 border-b border-line-soft px-3.5 py-3'>
                  <span className='flex min-w-0 items-baseline gap-2'>
                    <span className='truncate text-sm font-semibold text-ink'>
                      {group.name}
                    </span>
                    <span
                      className={`shrink-0 whitespace-nowrap text-[11px] ${
                        full ? 'font-semibold text-[#8A5D14]' : 'text-faint'
                      }`}
                    >
                      {group.members.length}/{maxSize}
                    </span>
                  </span>
                  <button
                    type='button'
                    aria-label={`Delete ${group.name}`}
                    onClick={() => deleteGroup(group)}
                    disabled={busy}
                    className='shrink-0 rounded-[4px] px-1.5 py-1 text-xs text-faint transition-colors hover:bg-[#FBEEEC] hover:text-red-600 disabled:opacity-50'
                  >
                    Delete
                  </button>
                </div>

                <div className='p-2.5'>
                  <div className='flex min-h-[100px] flex-col gap-1.5'>
                    {group.members.length === 0 ? (
                      <p className='py-6 text-center text-xs text-faint'>
                        Drag students here
                      </p>
                    ) : (
                      group.members.map((member) => (
                        <div
                          key={member.student_id}
                          draggable
                          onDragStart={(e) =>
                            e.dataTransfer.setData(
                              'text/plain',
                              String(member.student_id)
                            )
                          }
                          className='group/member flex cursor-grab items-center gap-2.5 rounded-[9px] border-[1.5px] border-line bg-white px-3 py-2 transition-shadow hover:border-neutral-400 hover:shadow-[0_2px_8px_rgba(0,0,0,0.06)] active:cursor-grabbing'
                        >
                          <GripVertical className='h-3.5 w-3.5 shrink-0 text-[#CBC4B4]' />
                          <span className='min-w-0 flex-1'>
                            <span className='block truncate text-[13px] font-semibold text-[#2C3444]'>
                              {member.userName}
                            </span>
                            <span className='block truncate font-mono text-[10.5px] text-faint'>
                              {member.userNumber}
                            </span>
                          </span>
                          <button
                            type='button'
                            aria-label={`Remove ${member.userName} from ${group.name}`}
                            onClick={() => move(member.student_id, null)}
                            disabled={busy}
                            className='shrink-0 text-faint opacity-0 transition-opacity hover:text-red-600 group-hover/member:opacity-100 focus:opacity-100'
                          >
                            <X className='h-3.5 w-3.5' />
                          </button>
                        </div>
                      ))
                    )}
                  </div>

                  {/* Click-driven equivalent of dragging, so the page works
                      without drag-and-drop. */}
                  {ungrouped.length > 0 && !full && (
                    <Select
                      value=''
                      onValueChange={(value) => move(Number(value), group.id)}
                    >
                      <SelectTrigger
                        className='mt-2.5 h-8 rounded-[9px] border-line-input text-xs'
                        aria-label={`Add a student to ${group.name}`}
                      >
                        <SelectValue placeholder='+ Add student' />
                      </SelectTrigger>
                      <SelectContent>
                        {ungrouped.map((student) => (
                          <SelectItem
                            key={student.student_id}
                            value={String(student.student_id)}
                          >
                            {student.userName}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  )}
                </div>
              </div>
            )
          })}
        </div>

        {/* Unassigned students — the drag source, and a drop target for
            returning someone to the pool. */}
        <div
          onDragOver={(e) => {
            e.preventDefault()
            setDragOver(UNGROUPED)
          }}
          onDragLeave={() => setDragOver(null)}
          onDrop={(e) => onDrop(e, UNGROUPED)}
          className={`flex max-h-[36rem] flex-col overflow-hidden rounded-[12px] border-2 border-dashed bg-white lg:flex-1 lg:min-w-[250px] ${
            dragOver === UNGROUPED ? 'border-ink' : 'border-[#CDC6B6]'
          }`}
        >
          <div className='flex items-center justify-between gap-2 border-b border-line-soft px-3.5 py-3'>
            <span className='text-sm font-semibold text-ink'>
              Unassigned Students
            </span>
            <span className='shrink-0 whitespace-nowrap rounded-[99px] border border-line bg-[#F2EEE6] px-2 py-px text-[11px] text-[#6D6455]'>
              {ungrouped.length}
            </span>
          </div>
          <div className='p-2.5'>
            <Input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder='Search students…'
              className='h-8 rounded-[9px] border-line-input text-xs'
            />
          </div>
          <div className='flex flex-1 flex-col gap-1.5 overflow-y-auto px-2.5 pb-2.5'>
            {filteredUngrouped.length === 0 ? (
              <p className='py-6 text-center text-xs text-faint'>
                {ungrouped.length === 0
                  ? 'Everyone has a group.'
                  : 'No students match that search.'}
              </p>
            ) : (
              filteredUngrouped.map((student) => (
                <div
                  key={student.student_id}
                  draggable
                  onDragStart={(e) =>
                    e.dataTransfer.setData('text/plain', String(student.student_id))
                  }
                  className='flex cursor-grab items-center gap-2.5 rounded-[9px] border-[1.5px] border-line bg-white px-3 py-2 transition-shadow hover:border-neutral-400 hover:shadow-[0_2px_8px_rgba(0,0,0,0.06)] active:cursor-grabbing'
                >
                  <GripVertical className='h-3.5 w-3.5 shrink-0 text-[#CBC4B4]' />
                  <span className='min-w-0 flex-1'>
                    <span className='block truncate text-[13px] font-semibold text-[#2C3444]'>
                      {student.userName}
                    </span>
                    <span className='block truncate font-mono text-[10.5px] text-faint'>
                      {student.userNumber}
                    </span>
                  </span>
                </div>
              ))
            )}
          </div>
        </div>
      </div>

      {/* Create group */}
      <Dialog open={createOpen} onOpenChange={setCreateOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Create group</DialogTitle>
          </DialogHeader>
          <div className='grid gap-1.5'>
            <Label htmlFor='group-name'>
              Name <span className='text-red-600'>*</span>
            </Label>
            <Input
              id='group-name'
              value={newName}
              onChange={(e) => setNewName(e.target.value)}
              placeholder='e.g. Team 5'
              onKeyDown={(e) => e.key === 'Enter' && createGroup()}
            />
          </div>
          <DialogFooter>
            <Button variant='outline' onClick={() => setCreateOpen(false)}>
              Cancel
            </Button>
            <Button onClick={createGroup} disabled={busy || !newName.trim()}>
              Create
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Random assign — his one-click bulk action, with a confirmation because
          it creates groups in bulk. */}
      <Dialog open={randomOpen} onOpenChange={setRandomOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Random assign</DialogTitle>
            <DialogDescription>
              Shuffles the {ungrouped.length} unassigned student
              {ungrouped.length === 1 ? '' : 's'} into new groups. Students who
              already have a group are not moved.
            </DialogDescription>
          </DialogHeader>
          <div className='grid gap-4'>
            <div className='grid gap-1.5'>
              <Label>Split by</Label>
              <Select
                value={randomMethod}
                onValueChange={(value) => setRandomMethod(value as 'size' | 'groups')}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value='size'>Students per group</SelectItem>
                  <SelectItem value='groups'>Number of groups</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className='grid gap-1.5'>
              <Label htmlFor='random-value'>
                {randomMethod === 'size' ? 'Students per group' : 'Number of groups'}
              </Label>
              <Input
                id='random-value'
                type='number'
                min={randomMethod === 'size' ? 2 : 1}
                max={randomMethod === 'size' ? maxSize : undefined}
                value={randomValue}
                onChange={(e) => setRandomValue(Number(e.target.value))}
              />
              {randomMethod === 'size' && (
                <p className='text-xs text-muted-foreground'>
                  Maximum for this category is {maxSize}.
                </p>
              )}
            </div>
          </div>
          <DialogFooter>
            <Button variant='outline' onClick={() => setRandomOpen(false)}>
              Cancel
            </Button>
            <Button
              onClick={() => setConfirmRandom(true)}
              disabled={busy || ungrouped.length === 0}
            >
              Assign
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <AlertDialog open={confirmRandom} onOpenChange={setConfirmRandom}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Create groups and assign students?</AlertDialogTitle>
            <AlertDialogDescription>
              This creates new groups and places all {ungrouped.length} unassigned
              students into them. You can still move anyone afterwards.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={runRandomAssign}>Assign</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  )
}
