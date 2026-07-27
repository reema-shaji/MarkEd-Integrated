'use client'

/**
 * Student assignment detail (prototype "Assignment Detail"): the assignment
 * brief, a 2-up grid of "facet" cards (deadline / your group / self-assessment)
 * and a results card, driven by the assignment configuration and the student's
 * own status.
 */

import React from 'react'
import { useParams, useRouter } from 'next/navigation'
import { Skeleton } from '@/components/ui/skeleton'
import { toast } from 'sonner'
import {
  AssignmentSchema,
  DefaultService,
  MyAssignmentStatusSchema,
} from '@/src/api'

import { formatDateTime, formatDate as formatDateOnly } from '@/lib/date'

const formatDate = (value?: string | null) => formatDateTime(value)
const formatDay = (value?: string | null) => formatDateOnly(value)

type ChipTone = 'success' | 'warning' | 'danger' | 'neutral'

const CHIP: Record<ChipTone, { bg: string; fg: string }> = {
  success: { bg: '#E9F1EA', fg: '#2F7D4F' },
  warning: { bg: '#F8EFDC', fg: '#8A5D14' },
  danger: { bg: '#F8E8E5', fg: '#A93226' },
  neutral: { bg: '#F2EEE6', fg: '#6D6455' },
}

type Facet = {
  key: string
  kicker: string
  chip?: { text: string; tone: ChipTone }
  headline: string
  detail: string
  bar?: number
  footLabel: string
  footValue: React.ReactNode
  btn?: { label: string; seg: string; primary?: boolean }
}

function Chip({ text, tone }: { text: string; tone: ChipTone }) {
  const c = CHIP[tone]
  return (
    <span
      className='inline-block whitespace-nowrap rounded-[6px] px-[9px] py-0.5 text-[11px] font-semibold'
      style={{ background: c.bg, color: c.fg }}
    >
      {text}
    </span>
  )
}

export default function AssignmentHomePage() {
  const params = useParams()
  const router = useRouter()
  const id = Number(params.id)
  const [assignment, setAssignment] = React.useState<AssignmentSchema | null>(null)
  const [status, setStatus] = React.useState<MyAssignmentStatusSchema | null>(null)

  React.useEffect(() => {
    if (!params.id) return
    let cancelled = false
    // Render as soon as the assignment loads; the status call (heavier — it
    // aggregates the student's mark) fills in the facet cards when ready, so a
    // slow status request no longer holds the whole page on a skeleton (B4).
    DefaultService.getAssignment(id)
      .then((a) => {
        if (!cancelled) setAssignment(a)
      })
      .catch(() => {
        if (!cancelled) toast.error('Failed to load assignment')
      })
    DefaultService.getMyAssignmentStatus(id)
      .then((s) => {
        if (!cancelled) setStatus(s)
      })
      .catch(() => {
        if (!cancelled) setStatus(null)
      })
    return () => {
      cancelled = true
    }
  }, [params.id, id])

  if (!assignment) {
    return (
      <div className='mx-auto w-full max-w-[1200px] px-7 pb-12 pt-8'>
        <Skeleton className='mb-7 h-16 w-full max-w-[62ch]' />
        <div className='grid grid-cols-1 gap-3.5 sm:grid-cols-2'>
          {[0, 1].map((i) => (
            <Skeleton key={i} className='h-44 rounded-[14px]' />
          ))}
        </div>
        <Skeleton className='mt-3.5 h-24 rounded-[14px]' />
      </div>
    )
  }

  const isGroup = assignment.assignment_type === 'GROUP'
  const go = (seg: string) => router.push(`/assignments/${id}/${seg}`)

  const now = new Date()
  const deadline = assignment.deadline ? new Date(assignment.deadline) : null
  const closed = deadline ? now > deadline : false
  const daysLeft = deadline
    ? Math.ceil((deadline.getTime() - now.getTime()) / 86_400_000)
    : null

  let deadlineDetail = 'No deadline set.'
  if (deadline) {
    deadlineDetail = closed
      ? 'The deadline has passed.'
      : daysLeft !== null && daysLeft <= 0
        ? 'Due today.'
        : `${daysLeft} day${daysLeft === 1 ? '' : 's'} remaining.`
  }

  const submitted = !!status?.submitted
  const submitChip: { text: string; tone: ChipTone } = submitted
    ? status?.is_late
      ? { text: 'Submitted late', tone: 'warning' }
      : { text: 'Submitted', tone: 'success' }
    : closed
      ? { text: 'Missed', tone: 'danger' }
      : { text: 'Submit now', tone: 'warning' }

  const facets: Facet[] = [
    {
      key: 'deadline',
      kicker: 'Deadline',
      chip: submitChip,
      headline: formatDay(assignment.deadline),
      detail: deadlineDetail,
      footLabel: 'Your submission',
      footValue: submitted ? (
        formatDate(status?.submitted_at)
      ) : (
        <span className='font-normal text-[#8A9099]'>Not yet submitted</span>
      ),
      // Group work is submitted from the shared workspace, not an individual
      // submit page — route there for group assignments.
      btn: {
        label: isGroup
          ? 'Open workspace'
          : submitted
            ? 'Resubmit'
            : 'Submit work',
        seg: isGroup ? 'workspace' : 'submit',
        primary: !submitted,
      },
    },
  ]

  if (isGroup) {
    const assigned = !!status?.group_name
    facets.push({
      key: 'group',
      kicker: 'Your group',
      chip: assigned
        ? { text: 'Assigned', tone: 'success' }
        : { text: 'Unassigned', tone: 'warning' },
      headline: status?.group_name ?? 'Not assigned',
      detail: assigned
        ? 'Collaborate with your teammates in the shared workspace.'
        : 'You have not been placed in a group yet.',
      footLabel: 'Workspace',
      footValue: assigned ? 'Files, tasks & discussion' : 'Available once assigned',
      btn: { label: 'Open workspace', seg: 'workspace' },
    })
  }

  if (assignment.self_assessment_enabled) {
    facets.push({
      key: 'self-assessment',
      kicker: 'Self-assessment',
      headline: 'Reflect on your work',
      detail: 'Grade your own submission against the rubric before results are released.',
      footLabel: 'Due',
      footValue: assignment.self_assessment_deadline
        ? formatDay(assignment.self_assessment_deadline)
        : 'See assignment',
      btn: { label: 'Open', seg: 'self-assessment' },
    })
  }

  const resultSeg = isGroup ? 'group-result' : 'results'

  return (
    <div className='mx-auto w-full max-w-[1200px] px-7 pb-12 pt-8'>
      {/* Brief */}
      <div className='mb-7 max-w-[62ch] text-[15.5px] leading-[1.72] text-[#454C5C]'>
        {assignment.assignmentDescription || 'No description provided.'}
      </div>

      {/* Facet cards */}
      <div className='mb-3.5 grid grid-cols-1 gap-3.5 sm:grid-cols-2'>
        {facets.map((f) => (
          <div
            key={f.key}
            className='flex flex-col rounded-[14px] border border-[#EAE5DB] bg-white px-[22px] py-5'
          >
            <div className='mb-3.5 flex items-center gap-2'>
              <span className='flex-1 text-[10px] font-semibold uppercase tracking-[.85px] text-[#A29A8C]'>
                {f.kicker}
              </span>
              {f.chip && <Chip text={f.chip.text} tone={f.chip.tone} />}
            </div>
            <div className='text-[18px] font-semibold -tracking-[.35px] text-[#131A26]'>
              {f.headline}
            </div>
            <div className='mt-1.5 text-[13px] leading-[1.6] text-[#5A6070]'>
              {f.detail}
            </div>
            {typeof f.bar === 'number' && (
              <div className='mt-3.5 h-1 overflow-hidden rounded-[99px] bg-[#F0ECE4]'>
                <div
                  className='h-full rounded-[99px] bg-[#1F4E79]'
                  style={{ width: `${Math.max(0, Math.min(100, f.bar))}%` }}
                />
              </div>
            )}
            <div className='min-h-[18px] flex-1' />
            <div className='flex items-center gap-2.5 border-t border-[#F0ECE4] pt-[15px]'>
              <span className='min-w-0 flex-1'>
                <span className='block text-[10px] font-semibold uppercase tracking-[.85px] text-[#A29A8C]'>
                  {f.footLabel}
                </span>
                <span className='mt-0.5 block text-[12.5px] font-semibold text-[#2C3444]'>
                  {f.footValue}
                </span>
              </span>
              {f.btn && (
                <button
                  onClick={() => go(f.btn!.seg)}
                  className={
                    f.btn.primary
                      ? 'flex-none cursor-pointer rounded-[9px] border-none bg-[#131A26] px-3.5 py-2 text-[12.5px] font-semibold text-white hover:bg-[#243247]'
                      : 'flex-none cursor-pointer rounded-[9px] border border-[#DED8CA] bg-white px-3.5 py-2 text-[12.5px] font-semibold text-[#2C3444] hover:bg-[#F2EFE8]'
                  }
                >
                  {f.btn.label}
                </button>
              )}
            </div>
          </div>
        ))}
      </div>

      {/* Results card */}
      <div className='flex items-center gap-[22px] rounded-[14px] border border-[#EAE5DB] bg-white px-[22px] py-5'>
        <span className='min-w-[104px] flex-none'>
          <span className='block text-[10px] font-semibold uppercase tracking-[.85px] text-[#A29A8C]'>
            Results
          </span>
          <span className='mt-1 block text-[24px] font-semibold -tracking-[.6px] text-[#131A26]'>
            {submitted ? 'View' : '—'}
          </span>
        </span>
        <span className='min-w-0 flex-1 border-l border-[#F0ECE4] pl-[22px]'>
          <span className='block text-[13px] leading-[1.6] text-[#5A6070]'>
            {submitted
              ? 'Your mark and marker feedback will appear here once marking is complete.'
              : 'Results become available after you submit and marking is complete.'}
          </span>
          <span className='mt-1 block text-[11.5px] text-[#8A9099]'>
            {isGroup ? 'Includes your group score and contribution adjustment.' : 'Individual feedback.'}
          </span>
        </span>
        <button
          onClick={() => go(resultSeg)}
          className='flex-none cursor-pointer rounded-[9px] border border-[#DED8CA] bg-white px-3.5 py-2 text-[12.5px] font-semibold text-[#2C3444] hover:bg-[#F2EFE8]'
        >
          View results
        </button>
      </div>
    </div>
  )
}
