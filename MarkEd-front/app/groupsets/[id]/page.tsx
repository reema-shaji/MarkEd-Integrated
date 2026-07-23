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
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Badge } from '@/components/ui/badge'
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
import { ArrowLeft, Plus, Shuffle, Trash2, UserPlus, X } from 'lucide-react'
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
      <div className='mx-auto w-full max-w-6xl p-6'>
        <Skeleton className='h-9 w-72' />
        <div className='mt-6 grid grid-cols-[280px_1fr] gap-5'>
          <Skeleton className='h-96' />
          <Skeleton className='h-96' />
        </div>
      </div>
    )
  }

  const maxSize = groupSet?.max_group_size ?? 0

  return (
    <div className='mx-auto w-full max-w-6xl p-6'>
      <Button
        variant='ghost'
        size='sm'
        className='mb-3 -ml-2'
        onClick={() => router.push('/groupsets')}
      >
        <ArrowLeft className='mr-1 h-4 w-4' />
        Group categories
      </Button>

      <div className='mb-5 flex flex-wrap items-start justify-between gap-3'>
        <div>
          <h1 className='text-2xl font-bold'>{groupSet?.name}</h1>
          <p className='mt-1 text-sm text-muted-foreground'>
            {groups.length} groups · {ungrouped.length} unassigned · size{' '}
            {groupSet?.min_group_size}–{groupSet?.max_group_size}
          </p>
        </div>
        <div className='flex flex-wrap gap-2'>
          <Button variant='outline' onClick={() => setCreateOpen(true)} disabled={busy}>
            <Plus className='mr-1 h-4 w-4' />
            Create group
          </Button>
          <Button variant='outline' onClick={() => setRandomOpen(true)} disabled={busy}>
            <Shuffle className='mr-1 h-4 w-4' />
            Random assign
          </Button>
          <Button variant='outline' onClick={runAutoAssign} disabled={busy}>
            <UserPlus className='mr-1 h-4 w-4' />
            Auto-assign unassigned
          </Button>
        </div>
      </div>

      <div className='grid gap-5 lg:grid-cols-[280px_1fr]'>
        {/* Unassigned students — the drag source, and a drop target for
            returning someone to the pool. */}
        <Card
          onDragOver={(e) => {
            e.preventDefault()
            setDragOver(UNGROUPED)
          }}
          onDragLeave={() => setDragOver(null)}
          onDrop={(e) => onDrop(e, UNGROUPED)}
          className={dragOver === UNGROUPED ? 'border-neutral-800' : undefined}
        >
          <CardHeader className='pb-3'>
            <CardTitle className='text-sm'>
              Unassigned students ({ungrouped.length})
            </CardTitle>
          </CardHeader>
          <CardContent>
            <Input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder='Search students…'
              className='mb-3'
            />
            <div className='flex max-h-[28rem] flex-col gap-1.5 overflow-y-auto'>
              {filteredUngrouped.length === 0 ? (
                <p className='py-6 text-center text-xs text-muted-foreground'>
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
                    className='flex cursor-grab items-center justify-between gap-2 rounded-md border bg-white px-2.5 py-2 text-sm active:cursor-grabbing'
                  >
                    <span className='truncate'>{student.userName}</span>
                    <span className='shrink-0 font-mono text-[11px] text-muted-foreground'>
                      {student.userNumber}
                    </span>
                  </div>
                ))
              )}
            </div>
          </CardContent>
        </Card>

        {/* Group cards — drop targets. */}
        <div className='grid gap-4 sm:grid-cols-2 xl:grid-cols-3'>
          {groups.length === 0 && (
            <Card className='sm:col-span-2 xl:col-span-3'>
              <CardContent className='py-12 text-center text-sm text-muted-foreground'>
                No groups yet. Create one, or use random assign to build them all
                at once.
              </CardContent>
            </Card>
          )}

          {groups.map((group) => {
            const full = group.members.length >= maxSize
            return (
              <Card
                key={group.id}
                onDragOver={(e) => {
                  e.preventDefault()
                  setDragOver(String(group.id))
                }}
                onDragLeave={() => setDragOver(null)}
                onDrop={(e) => onDrop(e, String(group.id))}
                className={
                  dragOver === String(group.id) ? 'border-neutral-800' : undefined
                }
              >
                <CardHeader className='pb-2'>
                  <div className='flex items-start justify-between gap-2'>
                    <CardTitle className='text-sm'>{group.name}</CardTitle>
                    <div className='flex items-center gap-1'>
                      <Badge variant={full ? 'secondary' : 'outline'} className='text-[10px]'>
                        {group.members.length}/{maxSize}
                      </Badge>
                      <Button
                        variant='ghost'
                        size='icon'
                        className='h-6 w-6'
                        aria-label={`Delete ${group.name}`}
                        onClick={() => deleteGroup(group)}
                        disabled={busy}
                      >
                        <Trash2 className='h-3.5 w-3.5' />
                      </Button>
                    </div>
                  </div>
                </CardHeader>
                <CardContent>
                  <div className='flex min-h-[4rem] flex-col gap-1.5'>
                    {group.members.length === 0 ? (
                      <p className='py-3 text-center text-xs text-muted-foreground'>
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
                          className='group/member flex cursor-grab items-center justify-between gap-2 rounded-md border bg-white px-2.5 py-1.5 text-sm active:cursor-grabbing'
                        >
                          <span className='truncate'>{member.userName}</span>
                          <button
                            type='button'
                            aria-label={`Remove ${member.userName} from ${group.name}`}
                            onClick={() => move(member.student_id, null)}
                            disabled={busy}
                            className='shrink-0 text-muted-foreground opacity-0 transition-opacity hover:text-red-600 group-hover/member:opacity-100 focus:opacity-100'
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
                        className='mt-3 h-8 text-xs'
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
                </CardContent>
              </Card>
            )
          })}
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
