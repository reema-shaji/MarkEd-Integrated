'use client'

/**
 * Create Assignment — the unified create form (Design PRD §6.1).
 *
 * Matches the prototype "Create Assignment" screen: Basic Information, then an
 * Assignment Type section where Individual/Group is a choice and peer review
 * and self-assessment are independent toggles (not separate types). Posts to
 * the unified /assignments/create/{course_id} endpoint.
 */

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { DefaultService, GroupSetSchema } from '@/src/api'
import { useCourse } from '@/src/contexts/course-context'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { Switch } from '@/components/ui/switch'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { Loader2 } from 'lucide-react'
import { toast } from 'sonner'

type AType = 'INDIVIDUAL' | 'GROUP'

export default function CreateAssignmentPage() {
  const router = useRouter()
  const { currentCourseId } = useCourse()

  const [title, setTitle] = useState('')
  const [description, setDescription] = useState('')
  const [deadline, setDeadline] = useState('')
  const [website, setWebsite] = useState('')

  const [type, setType] = useState<AType>('INDIVIDUAL')
  const [groupSets, setGroupSets] = useState<GroupSetSchema[]>([])
  const [groupSetId, setGroupSetId] = useState<string>('')
  const [minSize, setMinSize] = useState(2)
  const [maxSize, setMaxSize] = useState(4)

  const [peerEnabled, setPeerEnabled] = useState(false)
  const [reviewsPerStudent, setReviewsPerStudent] = useState(3)
  const [reviewDeadline, setReviewDeadline] = useState('')

  const [saEnabled, setSaEnabled] = useState(false)
  const [saDeadline, setSaDeadline] = useState('')

  const [submitting, setSubmitting] = useState(false)

  useEffect(() => {
    if (!currentCourseId) return
    DefaultService.listGroupSets(currentCourseId)
      .then((sets) => {
        setGroupSets(sets)
        if (sets[0]) setGroupSetId(String(sets[0].id))
      })
      .catch(() => {})
  }, [currentCourseId])

  const create = async () => {
    if (!currentCourseId) return toast.error('No course selected')
    if (!title.trim()) return toast.error('Give the assignment a title')
    if (!deadline) return toast.error('Set a submission deadline')
    if (type === 'GROUP' && !groupSetId) {
      return toast.error('Choose a group category for a group assignment')
    }
    setSubmitting(true)
    try {
      const response = await DefaultService.createAssignment(currentCourseId, {
        title: title.trim(),
        description: description.trim() || null,
        deadline: new Date(deadline).toISOString(),
        assignmentWebsite: website.trim() || null,
        assignment_type: type,
        group_set_id: type === 'GROUP' ? Number(groupSetId) : null,
        min_group_size: type === 'GROUP' ? minSize : null,
        max_group_size: type === 'GROUP' ? maxSize : null,
        peer_review_enabled: peerEnabled,
        reviews_per_student: peerEnabled ? reviewsPerStudent : null,
        review_deadline:
          peerEnabled && reviewDeadline
            ? new Date(reviewDeadline).toISOString()
            : null,
        self_assessment_enabled: saEnabled,
        self_assessment_deadline:
          saEnabled && saDeadline ? new Date(saDeadline).toISOString() : null,
      })
      if (!response.success) throw new Error(response.message)
      toast.success('Assignment created')
      router.push('/assignments')
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Could not create the assignment')
    } finally {
      setSubmitting(false)
    }
  }

  const typeOptions: { value: AType; title: string; desc: string }[] = [
    {
      value: 'INDIVIDUAL',
      title: 'Individual',
      desc: 'Each student submits their own work.',
    },
    {
      value: 'GROUP',
      title: 'Group',
      desc: 'One submission per group, from any member.',
    },
  ]

  return (
    <div className='mx-auto w-full max-w-2xl p-6'>
      {/* Breadcrumb */}
      <div className='mb-1.5 text-[13px] text-neutral-400'>
        <button onClick={() => router.push('/assignments')} className='hover:text-neutral-600'>
          Assignments
        </button>{' '}
        / New
      </div>
      <h1 className='mb-5 text-2xl font-bold'>Create Assignment</h1>

      {/* Basic Information */}
      <Card className='mb-4'>
        <CardContent className='pt-6'>
          <div className='mb-4 text-[15px] font-semibold'>Basic Information</div>
          <div className='grid gap-3.5'>
            <div className='grid gap-1'>
              <Label className='text-[13px] font-medium text-neutral-700'>Title *</Label>
              <Input value={title} onChange={(e) => setTitle(e.target.value)} placeholder='e.g. CW1: Design Report' />
            </div>
            <div className='grid gap-1'>
              <Label className='text-[13px] font-medium text-neutral-700'>Description</Label>
              <Textarea
                rows={3}
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                placeholder='What should students produce?'
              />
            </div>
            <div className='grid grid-cols-1 gap-3.5 sm:grid-cols-2'>
              <div className='grid gap-1'>
                <Label className='text-[13px] font-medium text-neutral-700'>Deadline *</Label>
                <Input type='datetime-local' value={deadline} onChange={(e) => setDeadline(e.target.value)} />
              </div>
              <div className='grid gap-1'>
                <Label className='text-[13px] font-medium text-neutral-700'>Assignment website (optional)</Label>
                <Input value={website} onChange={(e) => setWebsite(e.target.value)} placeholder='https://…' />
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Assignment Type + toggles */}
      <Card className='mb-4'>
        <CardContent className='pt-6'>
          <div className='text-[15px] font-semibold'>Assignment Type</div>
          <p className='mb-4 mt-1 text-[13px] text-neutral-500'>
            Individual or Group. Peer review and self-assessment are configuration
            toggles, not separate types.
          </p>

          <div className='grid grid-cols-2 gap-2.5'>
            {typeOptions.map((opt) => {
              const active = type === opt.value
              return (
                <button
                  key={opt.value}
                  type='button'
                  onClick={() => setType(opt.value)}
                  className={`rounded-lg border-[1.5px] p-3.5 text-left transition-colors ${
                    active ? 'border-neutral-900 bg-neutral-50' : 'border-neutral-200 hover:border-neutral-300'
                  }`}
                >
                  <span className='mb-[3px] block text-sm font-semibold'>{opt.title}</span>
                  <span className='block text-xs leading-[1.45] text-neutral-500'>{opt.desc}</span>
                </button>
              )
            })}
          </div>

          {/* Group fields */}
          {type === 'GROUP' && (
            <div className='mt-4 grid grid-cols-[2fr_1fr_1fr] gap-3 border-t border-neutral-100 pt-4'>
              <div className='grid gap-1'>
                <Label className='text-[13px] font-medium text-neutral-700'>Group Category</Label>
                <Select
                  value={groupSetId}
                  onValueChange={(v) =>
                    v === '__new__' ? router.push('/groupsets') : setGroupSetId(v)
                  }
                >
                  <SelectTrigger>
                    <SelectValue placeholder='Select a group category' />
                  </SelectTrigger>
                  <SelectContent>
                    {groupSets.map((gs) => (
                      <SelectItem key={gs.id} value={String(gs.id)}>
                        {gs.name} ({gs.groups_count} groups)
                      </SelectItem>
                    ))}
                    <SelectItem value='__new__'>
                      + Create new group category…
                    </SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className='grid gap-1'>
                <Label className='text-[13px] font-medium text-neutral-700'>Min size</Label>
                <Input type='number' min={1} value={minSize} onChange={(e) => setMinSize(Number(e.target.value))} />
              </div>
              <div className='grid gap-1'>
                <Label className='text-[13px] font-medium text-neutral-700'>Max size</Label>
                <Input type='number' min={1} value={maxSize} onChange={(e) => setMaxSize(Number(e.target.value))} />
              </div>
            </div>
          )}

          {/* Peer review toggle */}
          <div className='mt-4 border-t border-neutral-100 pt-4'>
            <label className='flex cursor-pointer items-center gap-2.5'>
              <input
                type='checkbox'
                checked={peerEnabled}
                onChange={(e) => setPeerEnabled(e.target.checked)}
                className='h-[15px] w-[15px] accent-neutral-900'
              />
              <span className='text-[13px] font-semibold text-neutral-700'>
                Enable Peer Review
                <span className='mt-px block text-xs font-normal text-neutral-400'>
                  Students review each other&apos;s submissions anonymously. Works with
                  both Individual and Group assignments.
                </span>
              </span>
            </label>
            {peerEnabled && (
              <>
                <div className='mt-3.5 grid grid-cols-2 gap-3'>
                  <div className='grid gap-1'>
                    <Label className='text-[13px] font-medium text-neutral-700'>Reviews per student</Label>
                    <Input
                      type='number'
                      min={1}
                      value={reviewsPerStudent}
                      onChange={(e) => setReviewsPerStudent(Number(e.target.value))}
                    />
                  </div>
                  <div className='grid gap-1'>
                    <Label className='text-[13px] font-medium text-neutral-700'>Review deadline</Label>
                    <Input type='datetime-local' value={reviewDeadline} onChange={(e) => setReviewDeadline(e.target.value)} />
                  </div>
                </div>
                <div className='mt-3 rounded-md border border-neutral-100 bg-neutral-50 px-3 py-2.5 text-xs leading-normal text-neutral-500'>
                  Reviewers are anonymised. For <b className='font-semibold'>Group</b>{' '}
                  assignments with peer review, reviewers are allocated exclusively
                  from students in other groups.
                </div>
              </>
            )}
          </div>
        </CardContent>
      </Card>

      {/* Self-Assessment */}
      <Card className='mb-5'>
        <CardContent className='pt-6'>
          <div className='flex items-center justify-between gap-4'>
            <span>
              <span className='block text-[15px] font-semibold'>Self-Assessment</span>
              <span className='mt-0.5 block text-[13px] text-neutral-500'>
                Checklist, rubric self-grading and guided reflection
              </span>
            </span>
            <Switch
              checked={saEnabled}
              onCheckedChange={setSaEnabled}
              aria-label='Enable Self-Assessment'
            />
          </div>
          {saEnabled && (
            <div className='mt-4 grid grid-cols-2 gap-3 border-t border-neutral-100 pt-4'>
              <div className='grid gap-1'>
                <Label className='text-[13px] font-medium text-neutral-700'>Self-Assessment Deadline</Label>
                <Input type='datetime-local' value={saDeadline} onChange={(e) => setSaDeadline(e.target.value)} />
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Footer */}
      <div className='flex justify-end gap-2 pb-8'>
        <Button variant='outline' onClick={() => router.push('/assignments')}>
          Cancel
        </Button>
        <Button onClick={create} disabled={submitting}>
          {submitting && <Loader2 className='mr-2 h-4 w-4 animate-spin' />}
          Create Assignment
        </Button>
      </div>
    </div>
  )
}
