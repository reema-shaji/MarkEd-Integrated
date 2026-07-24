'use client'

/**
 * Student assignment detail (prototype "Assignment Detail"): the assignment
 * brief, DEADLINE / YOUR GROUP / STATUS meta boxes, and the actions available
 * for this assignment, driven by its configuration and the student's own status.
 */

import React from 'react'
import { useParams, useRouter } from 'next/navigation'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Skeleton } from '@/components/ui/skeleton'
import { toast } from 'sonner'
import {
  AssignmentSchema,
  DefaultService,
  MyAssignmentStatusSchema,
} from '@/src/api'
import {
  CalendarClock,
  CheckCircle2,
  ClipboardCheck,
  FileText,
  FolderKanban,
  Upload,
  Users2,
} from 'lucide-react'

function formatDate(value?: string | null) {
  if (!value) return '—'
  return new Date(value).toLocaleString(undefined, {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  })
}

export default function AssignmentHomePage() {
  const params = useParams()
  const router = useRouter()
  const id = Number(params.id)
  const [assignment, setAssignment] = React.useState<AssignmentSchema | null>(null)
  const [status, setStatus] = React.useState<MyAssignmentStatusSchema | null>(null)

  React.useEffect(() => {
    if (!params.id) return
    const load = async () => {
      try {
        const [a, s] = await Promise.all([
          DefaultService.getAssignment(id),
          DefaultService.getMyAssignmentStatus(id).catch(() => null),
        ])
        setAssignment(a)
        setStatus(s)
      } catch {
        toast.error('Failed to load assignment')
      }
    }
    load()
  }, [params.id, id])

  if (!assignment) {
    return (
      <div className='mx-auto w-full max-w-2xl space-y-4 p-6'>
        <Skeleton className='h-8 w-64' />
        <div className='grid grid-cols-3 gap-3'>
          {[0, 1, 2].map((i) => (
            <Skeleton key={i} className='h-20 rounded-lg' />
          ))}
        </div>
        <Skeleton className='h-40 rounded-lg' />
      </div>
    )
  }

  const isGroup = assignment.assignment_type === 'GROUP'
  const go = (seg: string) => router.push(`/assignments/${id}/${seg}`)

  const statusLabel = !status?.submitted
    ? 'Not submitted'
    : status.is_late
      ? 'Submitted late'
      : 'Submitted'

  const actions: { label: string; icon: React.ReactNode; seg: string }[] = [
    { label: 'Submit Work', icon: <Upload className='h-4 w-4' />, seg: 'submit' },
    ...(isGroup
      ? [{ label: 'Group Workspace', icon: <FolderKanban className='h-4 w-4' />, seg: 'workspace' }]
      : []),
    ...(assignment.self_assessment_enabled
      ? [{ label: 'Self-Assessment', icon: <ClipboardCheck className='h-4 w-4' />, seg: 'self-assessment' }]
      : []),
    // Peer review reviews are per-allocation; the sidebar lists them, so there
    // is no single route to link to here.
    {
      label: 'Results',
      icon: <FileText className='h-4 w-4' />,
      seg: isGroup ? 'group-result' : 'results',
    },
  ]

  return (
    <div className='mx-auto w-full max-w-2xl space-y-4 p-6'>
      <div className='flex flex-wrap items-center gap-2'>
        <h1 className='text-2xl font-bold'>{assignment.assignmentTitle}</h1>
        <Badge variant='secondary'>{isGroup ? 'Group' : 'Individual'}</Badge>
        {assignment.peer_review_enabled && <Badge variant='outline'>Peer Review</Badge>}
        {assignment.self_assessment_enabled && <Badge variant='outline'>Self-Assessment</Badge>}
      </div>

      {/* Meta boxes */}
      <div className={`grid gap-3 ${isGroup ? 'sm:grid-cols-3' : 'sm:grid-cols-2'}`}>
        <Card>
          <CardContent className='p-4'>
            <div className='flex items-center gap-1.5 text-xs font-medium uppercase tracking-wide text-neutral-500'>
              <CalendarClock className='h-3.5 w-3.5' /> Deadline
            </div>
            <div className='mt-1 text-sm font-medium'>{formatDate(assignment.deadline)}</div>
          </CardContent>
        </Card>

        {isGroup && (
          <Card>
            <CardContent className='p-4'>
              <div className='flex items-center gap-1.5 text-xs font-medium uppercase tracking-wide text-neutral-500'>
                <Users2 className='h-3.5 w-3.5' /> Your Group
              </div>
              <div className='mt-1 text-sm font-medium'>
                {status?.group_name ?? 'Not assigned'}
              </div>
            </CardContent>
          </Card>
        )}

        <Card>
          <CardContent className='p-4'>
            <div className='flex items-center gap-1.5 text-xs font-medium uppercase tracking-wide text-neutral-500'>
              <CheckCircle2 className='h-3.5 w-3.5' /> Status
            </div>
            <div className='mt-1 text-sm font-medium'>{statusLabel}</div>
            {status?.submitted_at && (
              <div className='text-xs text-neutral-400'>{formatDate(status.submitted_at)}</div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Brief */}
      <Card>
        <CardHeader className='pb-2'>
          <CardTitle className='text-base font-semibold'>Assignment brief</CardTitle>
        </CardHeader>
        <CardContent>
          <p className='text-sm leading-relaxed text-neutral-600'>
            {assignment.assignmentDescription || 'No description provided.'}
          </p>
          {!!assignment.assignment_instructions?.length && (
            <p className='mt-3 text-xs text-neutral-400'>
              Instruction files are in the sidebar.
            </p>
          )}
        </CardContent>
      </Card>

      {/* Actions */}
      <Card>
        <CardHeader className='pb-2'>
          <CardTitle className='text-base font-semibold'>Actions</CardTitle>
        </CardHeader>
        <CardContent>
          <div className='grid grid-cols-2 gap-2 sm:grid-cols-3'>
            {actions.map((a) => (
              <Button
                key={a.seg}
                variant='outline'
                className='justify-start'
                onClick={() => go(a.seg)}
              >
                {a.icon}
                <span className='ml-1.5'>{a.label}</span>
              </Button>
            ))}
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
