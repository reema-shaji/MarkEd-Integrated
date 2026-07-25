'use client'

import * as React from 'react'
import { useRouter } from 'next/navigation'
import {
  AssignmentSchema,
  DefaultService,
  GroupSchema,
} from '@/src/api'
import { Users } from 'lucide-react'
import { toast } from 'sonner'
import { Skeleton } from '@/components/ui/skeleton'
import { useUser } from '@/src/contexts/user-context'

function initials(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean)
  if (parts.length === 0) return '?'
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase()
  return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase()
}

export default function MyGroupsPage() {
  const router = useRouter()
  const { user, isLoading: isUserLoading } = useUser()
  const [groups, setGroups] = React.useState<GroupSchema[] | null>(null)
  const [assignments, setAssignments] = React.useState<AssignmentSchema[]>([])

  const isStudent = user?.isStudent ?? false

  React.useEffect(() => {
    if (isUserLoading || !isStudent) return
    Promise.all([
      DefaultService.listMyGroups(),
      DefaultService.getAssignments(),
    ])
      .then(([groupData, assignmentData]) => {
        setGroups(groupData)
        setAssignments(assignmentData)
      })
      .catch((error) => {
        console.error('Failed to load groups:', error)
        toast.error('Failed to load your groups')
        setGroups([])
      })
  }, [isUserLoading, isStudent])

  // Role guard — the linking tab is already gated, this is just defense.
  if (!isUserLoading && !isStudent) {
    return (
      <div className='mx-auto w-full max-w-[1200px] px-7 pb-12 pt-8'>
        <div className='rounded-[14px] border border-[#EAE5DB] bg-white px-6 py-12 text-center'>
          <p className='text-sm text-[#8A9099]'>
            My Groups is only available to students.
          </p>
        </div>
      </div>
    )
  }

  return (
    <div className='mx-auto w-full max-w-[1200px] px-7 pb-12 pt-8'>
      <div className='mb-5 text-[23px] font-semibold tracking-[-.5px] text-[#131A26]'>
        My Groups
      </div>

      {groups === null ? (
        Array.from({ length: 2 }).map((_, i) => (
          <Skeleton
            key={i}
            className='mb-3.5 h-56 w-full rounded-[14px]'
          />
        ))
      ) : groups.length === 0 ? (
        <div className='flex flex-col items-center justify-center gap-4 rounded-[14px] border border-[#EAE5DB] bg-white px-6 py-14 text-center'>
          <Users className='h-11 w-11 text-[#8A9099]' />
          <p className='text-sm text-[#5A6070]'>
            You are not in any groups yet.
          </p>
        </div>
      ) : (
        groups.map((group) => {
          const usingAssignments = assignments.filter(
            (a) =>
              group.group_set_id != null &&
              a.group_set_id === group.group_set_id
          )
          const usedByLabel = usingAssignments
            .map((a) => a.assignmentTitle)
            .join(' & ')
          const primaryAssignment = usingAssignments[0]
          const groupSetName = group.description || 'Project Teams'

          return (
            <div
              key={group.id}
              className='mb-3.5 rounded-[14px] border border-[#EAE5DB] bg-white p-5'
            >
              <div className='mb-1 flex items-center gap-2.5'>
                <span className='text-[15px] font-semibold tracking-[-.1px] text-[#131A26]'>
                  {group.name}
                </span>
              </div>
              <div className='mb-3.5 text-[13px] text-[#5A6070]'>
                {groupSetName}
                {usedByLabel ? ` · used by ${usedByLabel}` : ''}
              </div>

              <div className='mb-4 flex flex-col gap-2'>
                {group.members.map((member) => (
                  <div
                    key={member.id}
                    className='flex items-center gap-2.5 rounded-[10px] bg-[#FAF8F4] px-3 py-2'
                  >
                    <span className='flex h-[30px] w-[30px] items-center justify-center rounded-full bg-[#EFEBE2] text-[11px] font-semibold text-[#525252]'>
                      {initials(member.userName)}
                    </span>
                    <span className='flex-1'>
                      <span className='block text-[13px] font-semibold text-[#131A26]'>
                        {member.userName}
                      </span>
                      <span className='block font-mono text-[11px] text-[#8A9099]'>
                        {member.userNumber}
                      </span>
                    </span>
                  </div>
                ))}
              </div>

              <div className='flex gap-2'>
                <button
                  onClick={() =>
                    primaryAssignment &&
                    router.push(
                      `/assignments/${primaryAssignment.id}/workspace`
                    )
                  }
                  disabled={!primaryAssignment}
                  className='rounded-[9px] bg-[#131A26] px-3.5 py-[7px] text-[13px] font-semibold text-white hover:bg-[#243247] disabled:cursor-not-allowed disabled:opacity-50'
                >
                  Open Workspace
                </button>
                <button
                  onClick={() =>
                    primaryAssignment &&
                    router.push(
                      `/assignments/${primaryAssignment.id}/group-result`
                    )
                  }
                  disabled={!primaryAssignment}
                  className='rounded-[9px] border border-[#DED8CA] bg-white px-[15px] py-2 text-[13px] font-semibold text-[#2C3444] hover:bg-[#F2EFE8] disabled:cursor-not-allowed disabled:opacity-50'
                >
                  View Results
                </button>
              </div>
            </div>
          )
        })
      )}

      {groups !== null && groups.length > 0 && (
        <div className='text-xs leading-[1.5] text-[#8A9099]'>
          Self-enrolment for group sets is closed. Contact your course organiser
          to change groups.
        </div>
      )}
    </div>
  )
}
