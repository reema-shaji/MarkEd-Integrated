'use client'

/**
 * Peer Reviews tab — staff view of peer-review matching and allocations.
 *
 * Academic view: matching control + the full reviewer-to-reviewee match map
 * with status summary cards (relocated from the assignment dashboard so all
 * peer-review management lives under one tab).
 *
 * Marker view: the submissions allocated to this marker for moderation, with
 * status badges and Review / View buttons.
 */

import * as React from 'react'
import { useParams, useRouter } from 'next/navigation'
import {
  AssignmentSchema,
  DefaultService,
  PeerMatch,
  PeerReviewSchemaWithStudent,
} from '@/src/api'
import { ClipboardList, Users, CheckCircle2, Clock, Loader2 } from 'lucide-react'
import { toast } from 'sonner'
import { StatusDot } from '@/components/status-dot'
import { Skeleton } from '@/components/ui/skeleton'
import { useUser } from '@/src/contexts/user-context'

type ReviewerGroup = {
  reviewer: { name: string; userNumber: string; email: string }
  reviewing: {
    name: string
    userNumber: string
    email: string
    status: 'COMPLETED' | 'IN_PROGRESS' | 'PENDING'
  }[]
}

export default function PeerReviewsPage() {
  const params = useParams()
  const router = useRouter()
  const { user, isLoading: userLoading } = useUser()
  const isAcademic = user?.isAcademic ?? false

  const [allocations, setAllocations] = React.useState<
    PeerReviewSchemaWithStudent[] | null
  >(null)
  const [assignment, setAssignment] = React.useState<AssignmentSchema | null>(
    null
  )
  const [triggering, setTriggering] = React.useState(false)
  const [matches, setMatches] = React.useState<PeerMatch[]>([])
  const [peerStats, setPeerStats] = React.useState<Record<string, number>>({})

  React.useEffect(() => {
    if (!params.id) return
    const id = Number(params.id)
    DefaultService.getMarkerAllocations(id)
      .then(setAllocations)
      .catch((error) => {
        console.error('Failed to fetch marker allocations:', error)
        setAllocations([])
      })
    DefaultService.getAssignment(id)
      .then(setAssignment)
      .catch(() => {})
    // Load match data for academic view
    DefaultService.getMatchedPeers(id)
      .then(setMatches)
      .catch(() => {})
    DefaultService.getAssignmentStatistics(id)
      .then((s: any) => setPeerStats(s.peer_review_stats ?? {}))
      .catch(() => {})
  }, [params.id])

  const handleTriggerMatching = async () => {
    setTriggering(true)
    try {
      const res = await DefaultService.triggerPeerReviewMatching(
        Number(params.id)
      )
      if (res.success) {
        toast.success(res.message || 'Peer review matching complete')
        const [updatedAssignment, updatedMatches] = await Promise.all([
          DefaultService.getAssignment(Number(params.id)),
          DefaultService.getMatchedPeers(Number(params.id)),
        ])
        setAssignment(updatedAssignment)
        setMatches(updatedMatches)
        // Refresh stats
        DefaultService.getAssignmentStatistics(Number(params.id))
          .then((s: any) => setPeerStats(s.peer_review_stats ?? {}))
          .catch(() => {})
      } else {
        toast.error(
          /not enough|no .*submission/i.test(res.message || '')
            ? 'Not enough submissions to match yet — students need to submit first.'
            : res.message || 'Could not run matching'
        )
      }
    } catch {
      toast.error('Could not run matching')
    } finally {
      setTriggering(false)
    }
  }

  // Students never see this page (the tab is role-gated); defensive guard.
  if (!userLoading && user?.isStudent) {
    return (
      <div className='mx-auto w-full max-w-[1200px] px-7 pb-12 pt-8'>
        <div className='rounded-[14px] border border-[#EAE5DB] bg-white p-10 text-center'>
          <div className='text-[15px] font-semibold text-[#131A26]'>
            Not available
          </div>
          <p className='mt-1 text-sm text-[#8A9099]'>
            This page is only for staff.
          </p>
        </div>
      </div>
    )
  }

  // --- Academic view: matching control + full match listing -------------------
  if (isAcademic) {
    const matched = assignment?.is_peer_review_matching_complete
    return (
      <div className='mx-auto w-full max-w-[1200px] px-7 pb-12 pt-8'>
        <div className='mb-1 text-[21px] font-semibold tracking-[-.45px] text-[#131A26]'>
          Peer Review
        </div>
        <div className='mb-5 text-[14px] text-[#5A6070]'>
          Match students to the submissions they review, and moderate reviews.
        </div>

        {/* Matching control */}
        <div className='mb-5 rounded-[14px] border border-[#EAE5DB] bg-white p-5'>
          <div className='flex items-center justify-between gap-3'>
            <div>
              <div className='text-[14px] font-semibold text-[#131A26]'>
                Peer review matching
              </div>
              <div className='mt-1 text-[13px] leading-[1.6] text-[#5A6070]'>
                {matched
                  ? 'Matching is complete — students can now review their allocated submissions.'
                  : 'Allocate reviewers once submissions are in. Each student is matched to peers’ submissions to review.'}
              </div>
            </div>
            {!matched && (
              <button
                onClick={handleTriggerMatching}
                disabled={triggering || !assignment}
                className='shrink-0 rounded-[9px] bg-[#131A26] px-3.5 py-2 text-[13px] font-semibold text-white hover:bg-[#243247] disabled:opacity-50'
              >
                {triggering ? 'Matching…' : 'Trigger matching'}
              </button>
            )}
          </div>
          {matched && (
            <div className='mt-3 inline-block rounded-[6px] bg-[#E9F1EA] px-2.5 py-0.5 text-[11px] font-semibold text-[#2F7D4F]'>
              Matched
            </div>
          )}
        </div>

        {/* Peer review match listing — relocated from the assignment dashboard.
            Shows the full reviewer-to-reviewee map with status summary cards so
            all peer-review management is under one tab. */}
        {matches.length > 0 && (
          <div className='rounded-[14px] border border-[#EAE5DB] bg-white p-6'>
            <div className='text-[15px] font-semibold tracking-[-.1px] text-[#131A26]'>
              Peer Review Matches
            </div>

            {/* Status summary */}
            <div className='mt-4 grid grid-cols-1 gap-3 sm:grid-cols-3'>
              <div className='flex items-center gap-3 rounded-[12px] border border-[#CBE3D3] bg-[#EFF6F1] p-3'>
                <CheckCircle2 className='h-5 w-5 shrink-0 text-[#22c55e]' />
                <span>
                  <span className='block text-[13px] font-medium text-[#2A6B43]'>
                    Completed
                  </span>
                  <span className='block text-[20px] font-bold text-[#14532d]'>
                    {peerStats.COMPLETED || 0}
                  </span>
                </span>
              </div>
              <div className='flex items-center gap-3 rounded-[12px] border border-[#EBD9AE] bg-[#FBF4E3] p-3'>
                <Clock className='h-5 w-5 shrink-0 text-[#eab308]' />
                <span>
                  <span className='block text-[13px] font-medium text-[#8A5D14]'>
                    In Progress
                  </span>
                  <span className='block text-[20px] font-bold text-[#6E4A10]'>
                    {peerStats.IN_PROGRESS || 0}
                  </span>
                </span>
              </div>
              <div className='flex items-center gap-3 rounded-[12px] border border-[#E3DFD5] bg-[#F2EEE6] p-3'>
                <Clock className='h-5 w-5 shrink-0 text-[#8A9099]' />
                <span>
                  <span className='block text-[13px] font-medium text-[#454C5C]'>
                    Not Started
                  </span>
                  <span className='block text-[20px] font-bold text-[#131A26]'>
                    {peerStats.PENDING || 0}
                  </span>
                </span>
              </div>
            </div>

            {/* Reviewer cards */}
            <div className='mt-4 space-y-3'>
              {Array.from(
                matches.reduce((acc, match) => {
                  const key = `${match.reviewer_name}-${match.reviewer_userNumber}`
                  if (!acc.has(key)) {
                    acc.set(key, {
                      reviewer: {
                        name: match.reviewer_name,
                        userNumber: match.reviewer_userNumber,
                        email: match.reviewer_email,
                      },
                      reviewing: [],
                    })
                  }
                  acc.get(key)!.reviewing.push({
                    name: match.submission_owner_name,
                    userNumber: match.submission_owner_userNumber,
                    email: match.submission_owner_email,
                    status: match.status as
                      | 'COMPLETED'
                      | 'IN_PROGRESS'
                      | 'PENDING',
                  })
                  return acc
                }, new Map<string, ReviewerGroup>())
              ).map(([key, data]) => (
                <div
                  key={key}
                  className='rounded-[11px] border border-[#EAE5DB] bg-[#FAF8F4] p-4'
                >
                  <div className='flex items-start justify-between gap-4'>
                    <div className='w-1/3'>
                      <div className='text-[15px] font-semibold text-[#131A26]'>
                        {data.reviewer.name}
                        <span className='mt-px block font-mono text-xs text-[#8A9099]'>
                          {data.reviewer.userNumber}
                        </span>
                      </div>
                    </div>
                    <div className='w-2/3 space-y-2'>
                      <div className='mb-2 text-[12px] text-[#8A9099]'>
                        is reviewing:
                      </div>
                      {data.reviewing.map((reviewee, idx) => (
                        <div key={idx} className='flex items-center gap-3'>
                          <StatusDot status={reviewee.status} />
                          <div className='text-[13px] text-[#131A26]'>
                            {reviewee.name}
                            <span className='ml-2 font-mono text-xs text-[#8A9099]'>
                              {reviewee.userNumber}
                            </span>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Empty state when matching hasn't been run yet */}
        {matches.length === 0 && matched && (
          <div className='rounded-[14px] border border-[#EAE5DB] bg-white p-12 text-center'>
            <Users className='mx-auto h-10 w-10 text-[#8A9099]' />
            <div className='mt-3 text-[15px] font-semibold text-[#131A26]'>
              No matches found
            </div>
            <p className='mt-1 text-sm text-[#5A6070]'>
              Matching ran but no peer reviews were assigned — check that
              students have submitted.
            </p>
          </div>
        )}
      </div>
    )
  }

  // --- Marker view: their own review allocation ----------------------------
  if (allocations === null) {
    return (
      <div className='mx-auto w-full max-w-[1200px] px-7 pb-12 pt-8'>
        <Skeleton className='mb-1 h-6 w-40' />
        <Skeleton className='mb-5 h-4 w-72' />
        <div className='overflow-hidden rounded-[14px] border border-[#EAE5DB] bg-white'>
          {Array.from({ length: 3 }).map((_, i) => (
            <div
              key={i}
              className='flex items-center justify-between border-b border-[#F0ECE4] px-5 py-4 last:border-b-0'
            >
              <Skeleton className='h-5 w-48' />
              <Skeleton className='h-7 w-20' />
            </div>
          ))}
        </div>
      </div>
    )
  }

  return (
    <div className='mx-auto w-full max-w-[1200px] px-7 pb-12 pt-8'>
      <div className='text-[21px] font-semibold tracking-[-.45px] text-[#131A26]'>
        Peer Reviews
      </div>
      <div className='mb-5 text-[14px] text-[#5A6070]'>
        Submissions allocated to you to review for this assignment.
      </div>

      {allocations.length === 0 ? (
        <div className='rounded-[14px] border border-[#EAE5DB] bg-white p-12 text-center'>
          <ClipboardList className='mx-auto h-10 w-10 text-[#8A9099]' />
          <div className='mt-3 text-[15px] font-semibold text-[#131A26]'>
            Nothing allocated yet
          </div>
          <p className='mt-1 text-sm text-[#8A9099]'>
            Once matching runs, the submissions you review appear here.
          </p>
        </div>
      ) : (
        <div className='overflow-hidden rounded-[14px] border border-[#EAE5DB] bg-white'>
          {allocations.map((a) => {
            const status = a.status?.toUpperCase()
            const badge =
              status === 'COMPLETED'
                ? { label: 'Reviewed', cls: 'bg-[#E9F1EA] text-[#2F7D4F]' }
                : status === 'IN_PROGRESS'
                  ? {
                      label: 'In Progress',
                      cls: 'bg-[#F8EFDC] text-[#8A5D14]',
                    }
                  : {
                      label: 'Not started',
                      cls: 'bg-[#F2EEE6] text-[#6D6455]',
                    }
            return (
              <div
                key={a.id}
                className='flex items-center gap-3 border-b border-[#F0ECE4] px-5 py-[14px] last:border-b-0'
              >
                <span className='flex-1'>
                  <span className='block text-[13.5px] font-semibold text-[#131A26]'>
                    {a.student_name}
                  </span>
                  <span className='mt-px block font-mono text-[12px] text-[#5A6070]'>
                    {a.student_number}
                  </span>
                </span>
                <span
                  className={`inline-block whitespace-nowrap rounded-[6px] px-2.5 py-0.5 text-[11px] font-medium ${badge.cls}`}
                >
                  {badge.label}
                </span>
                <button
                  onClick={() =>
                    router.push(
                      `/assignments/${params.id}/marker-review/${a.submission_id}`
                    )
                  }
                  className='rounded-[9px] border border-[#DED8CA] bg-white px-[13px] py-1.5 text-[12px] font-semibold text-[#2C3444] hover:bg-[#F2EFE8]'
                >
                  {status === 'COMPLETED' ? 'View' : 'Review'}
                </button>
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}
