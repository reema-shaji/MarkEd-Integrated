'use client'

import * as React from 'react'
import { useParams } from 'next/navigation'
import { AssignmentSchema, DefaultService } from '@/src/api'
import { Loader2 } from 'lucide-react'
import { toast } from 'sonner'
import { Skeleton } from '@/components/ui/skeleton'
import { useUser } from '@/src/contexts/user-context'

/** Convert an ISO string to a value suitable for <input type="datetime-local">
 *  (local time, "YYYY-MM-DDTHH:mm"). Returns '' for missing/invalid input. */
function isoToLocalInput(iso?: string | null): string {
  if (!iso) return ''
  const d = new Date(iso)
  if (Number.isNaN(d.getTime())) return ''
  const pad = (n: number) => String(n).padStart(2, '0')
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(
    d.getHours()
  )}:${pad(d.getMinutes())}`
}

/** Convert a datetime-local input value (local time) back to an ISO string. */
function localInputToIso(value: string): string | null {
  if (!value) return null
  const d = new Date(value)
  if (Number.isNaN(d.getTime())) return null
  return d.toISOString()
}

const TYPE_BADGE: Record<string, { label: string; bg: string; fg: string }> = {
  GROUP: { label: 'Group', bg: '#EDEAF4', fg: '#4C3A82' },
  INDIVIDUAL: { label: 'Individual', bg: '#F2EEE6', fg: '#6D6455' },
}

export default function CustomizationPage() {
  const params = useParams()
  const { user } = useUser()
  const assignmentId = Number(params.id)

  const [assignment, setAssignment] = React.useState<AssignmentSchema | null>(
    null
  )
  const [loadFailed, setLoadFailed] = React.useState(false)
  const [saving, setSaving] = React.useState(false)

  const [title, setTitle] = React.useState('')
  const [deadline, setDeadline] = React.useState('')
  const [website, setWebsite] = React.useState('')

  React.useEffect(() => {
    if (!params.id) return
    const fetchData = async () => {
      try {
        const data = await DefaultService.getAssignment(assignmentId)
        setAssignment(data)
        setTitle(data.assignmentTitle ?? '')
        setDeadline(isoToLocalInput(data.deadline))
        // AssignmentSchema does not expose an existing website value, so this
        // field starts empty and is only sent when the user fills it in.
      } catch (error) {
        console.error('Failed to load assignment:', error)
        setLoadFailed(true)
        toast.error('Failed to load assignment')
      }
    }
    fetchData()
  }, [params.id, assignmentId])

  const handleSave = async () => {
    if (!title.trim()) {
      toast.error('Title is required')
      return
    }
    const deadlineIso = localInputToIso(deadline)
    if (deadline && !deadlineIso) {
      toast.error('Enter a valid deadline')
      return
    }
    setSaving(true)
    try {
      const updated = await DefaultService.updateAssignment(assignmentId, {
        assignmentTitle: title.trim(),
        deadline: deadlineIso,
        assignmentWebsite: website.trim() || null,
      })
      setAssignment(updated)
      setTitle(updated.assignmentTitle ?? '')
      setDeadline(isoToLocalInput(updated.deadline))
      toast.success('Changes saved')
    } catch (error) {
      console.error('Failed to save assignment:', error)
      toast.error('Failed to save changes')
    } finally {
      setSaving(false)
    }
  }

  // Defence-in-depth role guard: this tab is already staff-gated.
  if (user && !user.isStaff) {
    return (
      <div className='mx-auto w-full max-w-[1200px] px-7 pb-12 pt-8'>
        <div className='rounded-[14px] border border-[#EAE5DB] bg-white px-5 py-12 text-center text-sm text-[#8A9099]'>
          This page is not available for your role.
        </div>
      </div>
    )
  }

  if (loadFailed) {
    return (
      <div className='mx-auto w-full max-w-[1200px] px-7 pb-12 pt-8'>
        <div className='rounded-[14px] border border-[#EAE5DB] bg-white px-5 py-12 text-center text-sm text-[#8A9099]'>
          We couldn&apos;t load this assignment. Please try again later.
        </div>
      </div>
    )
  }

  if (!assignment) {
    return (
      <div className='mx-auto w-full max-w-[1200px] px-7 pb-12 pt-8'>
        <Skeleton className='mb-[18px] h-6 w-48' />
        <Skeleton className='h-80 w-full rounded-[14px]' />
      </div>
    )
  }

  const badge = TYPE_BADGE[assignment.assignment_type] ?? {
    label: assignment.assignment_type,
    bg: '#F2EEE6',
    fg: '#6D6455',
  }

  const labelCls =
    'mb-1.5 text-[12.5px] font-semibold tracking-[.1px] text-[#5A6070]'
  const inputCls =
    'w-full rounded-[9px] border border-[#DED8CA] bg-white px-3.5 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-[#DED8CA]'

  return (
    <div className='mx-auto w-full max-w-[1200px] px-7 pb-12 pt-8'>
      <div className='mb-[18px] text-[21px] font-semibold tracking-[-.45px] text-[#131A26]'>
        Customization
      </div>

      <div className='rounded-[14px] border border-[#EAE5DB] bg-white p-6'>
        <div className='flex max-w-[520px] flex-col gap-3.5'>
          <div>
            <div className={labelCls}>Title</div>
            <input
              type='text'
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              className={inputCls}
            />
          </div>

          <div className='grid grid-cols-1 gap-3.5 sm:grid-cols-2'>
            <div>
              <div className={labelCls}>Deadline</div>
              <input
                type='datetime-local'
                value={deadline}
                onChange={(e) => setDeadline(e.target.value)}
                className={inputCls}
              />
            </div>
            <div>
              <div className={labelCls}>Assignment website</div>
              <input
                type='text'
                value={website}
                onChange={(e) => setWebsite(e.target.value)}
                placeholder='https://…'
                className={inputCls}
              />
            </div>
          </div>

          <div className='flex items-center justify-between rounded-[10px] bg-[#FAF8F4] px-3.5 py-3'>
            <span className='text-[13px] text-[#2C3444]'>Assignment type</span>
            <span
              className='inline-block whitespace-nowrap rounded-[6px] px-2.5 py-0.5 text-[11px] font-medium'
              style={{ background: badge.bg, color: badge.fg }}
            >
              {badge.label}
            </span>
          </div>

          <div className='text-[12px] leading-[1.5] text-[#8A9099]'>
            The assignment type cannot be changed after creation — it determines
            submission and review behaviour.
          </div>

          <div className='flex justify-end'>
            <button
              onClick={handleSave}
              disabled={saving}
              className='inline-flex items-center rounded-[9px] bg-[#131A26] px-4 py-2 text-[13px] font-semibold text-white hover:bg-[#243247] disabled:cursor-not-allowed disabled:opacity-50'
            >
              {saving && <Loader2 className='mr-2 h-4 w-4 animate-spin' />}
              Save Changes
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}
