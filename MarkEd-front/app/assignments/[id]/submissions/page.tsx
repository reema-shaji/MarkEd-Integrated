'use client'

import * as React from 'react'
import { useParams, useRouter } from 'next/navigation'
import { AllSubmissionSchema, DefaultService } from '@/src/api'
import { FileText } from 'lucide-react'
import { toast } from 'sonner'
import { Skeleton } from '@/components/ui/skeleton'
import { useUser } from '@/src/contexts/user-context'
import { formatDateTime } from '@/lib/date'

const formatWhen = (iso: string) => formatDateTime(iso)

export default function SubmissionsPage() {
  const params = useParams()
  const router = useRouter()
  const { user, isLoading: userLoading } = useUser()
  const [submissions, setSubmissions] = React.useState<
    AllSubmissionSchema[] | null
  >(null)
  const [statusFilter, setStatusFilter] = React.useState('All statuses')

  const STATUS_STYLES: Record<string, { bg: string; fg: string }> = {
    Unmarked: { bg: '#F5F3EF', fg: '#8A6D3B' },
    'In progress': { bg: '#FBF4E3', fg: '#8A5D14' },
    Marked: { bg: '#E9F1EA', fg: '#2F7D4F' },
  }

  React.useEffect(() => {
    if (!params.id) return
    DefaultService.getAllSubmissions(Number(params.id))
      .then((data) => setSubmissions(data))
      .catch((error) => {
        console.error('Failed to fetch submissions:', error)
        toast.error('Failed to load submissions')
        setSubmissions([])
      })
  }, [params.id])

  // Defensive role guard — the linking tab is already staff-gated.
  if (!userLoading && user && !user.isStaff) {
    return (
      <div className='mx-auto w-full max-w-[1200px] px-7 pb-12 pt-8'>
        <div className='rounded-[14px] border border-[#EAE5DB] bg-white p-10 text-center'>
          <div className='text-[15px] font-semibold text-[#131A26]'>
            Not available
          </div>
          <p className='mt-1 text-sm text-[#8A9099]'>
            This page is only available to staff.
          </p>
        </div>
      </div>
    )
  }

  if (submissions === null) {
    return (
      <div className='mx-auto w-full max-w-[1200px] px-7 pb-12 pt-8'>
        <Skeleton className='mb-1 h-7 w-40' />
        <Skeleton className='mb-5 h-4 w-28' />
        <div className='overflow-hidden rounded-[14px] border border-[#EAE5DB] bg-white'>
          {Array.from({ length: 4 }).map((_, i) => (
            <div
              key={i}
              className='flex items-center justify-between border-b border-[#F0ECE4] px-5 py-[15px] last:border-b-0'
            >
              <Skeleton className='h-5 w-56' />
              <Skeleton className='h-7 w-20' />
            </div>
          ))}
        </div>
      </div>
    )
  }

  const visible =
    statusFilter === 'All statuses'
      ? submissions
      : submissions.filter((s) => s.marking_status === statusFilter)

  const countLabel = `${visible.length} submission${
    visible.length === 1 ? '' : 's'
  }`

  return (
    <div className='mx-auto w-full max-w-[1200px] px-7 pb-12 pt-8'>
      <div className='mb-5 flex flex-wrap items-end justify-between gap-4'>
        <div>
          <div className='text-[23px] font-semibold tracking-[-.5px] text-[#131A26]'>
            Submissions
          </div>
          <div className='mt-0.5 text-[13px] font-medium text-[#8A9099]'>
            {countLabel}
          </div>
        </div>
        <div className='flex gap-2'>
          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            className='rounded-[9px] border border-[#DED8CA] bg-white px-[11px] py-2 text-[13px] text-[#2C3444]'
          >
            <option>All statuses</option>
            <option>Unmarked</option>
            <option>In progress</option>
            <option>Marked</option>
          </select>
        </div>
      </div>

      {submissions.length === 0 ? (
        <div className='rounded-[14px] border border-[#EAE5DB] bg-white p-12 text-center'>
          <FileText className='mx-auto h-10 w-10 text-[#8A9099]' />
          <div className='mt-3 text-[15px] font-semibold text-[#131A26]'>
            No submissions yet
          </div>
          <p className='mt-1 text-sm text-[#8A9099]'>
            Submissions will appear here once students hand in their work.
          </p>
        </div>
      ) : (
        <div className='overflow-hidden rounded-[14px] border border-[#EAE5DB] bg-white'>
          <div className='grid grid-cols-[1.9fr_1.1fr_.9fr_.8fr_.9fr] border-b border-[#EAE5DB] px-5 py-3 text-[10px] font-semibold uppercase tracking-[.85px] text-[#A29A8C]'>
            <span>Student</span>
            <span>Submitted</span>
            <span>Version</span>
            <span>Status</span>
            <span className='text-right'>Score</span>
          </div>
          {visible.length === 0 ? (
            <div className='px-5 py-8 text-center text-[13px] text-[#8A9099]'>
              No submissions match this filter.
            </div>
          ) : (
            visible.map((s) => {
              const st =
                STATUS_STYLES[s.marking_status ?? 'Unmarked'] ??
                STATUS_STYLES.Unmarked
              return (
                <div
                  key={s.id}
                  className='grid grid-cols-[1.9fr_1.1fr_.9fr_.8fr_.9fr] items-center border-b border-[#F0ECE4] px-5 py-[13px] last:border-b-0 hover:bg-[#FAF8F4]'
                >
                  <span className='text-[13px] font-semibold text-[#131A26]'>
                    {s.student_name}{' '}
                    <span className='ml-1 font-mono text-[12px] font-normal text-[#8A9099]'>
                      {s.student_number}
                    </span>
                  </span>
                  <span className='text-[12px] text-[#5A6070]'>
                    {formatWhen(s.submissionDateTime)}
                  </span>
                  <span className='font-mono text-[12px] text-[#5A6070]'>—</span>
                  <span>
                    <span
                      className='inline-block whitespace-nowrap rounded-[6px] px-2 py-0.5 text-[11px] font-semibold'
                      style={{ backgroundColor: st.bg, color: st.fg }}
                    >
                      {s.marking_status ?? 'Unmarked'}
                    </span>
                  </span>
                  <span className='flex items-center justify-end gap-2.5'>
                    <span className='font-mono text-[13px] font-semibold text-[#131A26]'>
                      {s.score != null ? `${s.score}/${s.total}` : '—'}
                    </span>
                    <button
                      onClick={() =>
                        router.push(`/assignments/${params.id}/mark/${s.id}`)
                      }
                      className='rounded-[9px] border border-[#DED8CA] bg-white px-[13px] py-1.5 text-[12px] font-semibold text-[#2C3444] hover:bg-[#F2EFE8]'
                    >
                      Mark
                    </button>
                  </span>
                </div>
              )
            })
          )}
        </div>
      )}
    </div>
  )
}
