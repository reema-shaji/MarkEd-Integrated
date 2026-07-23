'use client'

import * as React from 'react'
import { useRouter, useParams } from 'next/navigation'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import {
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuSubButton,
  SidebarMenuItem,
  SidebarMenuSub,
  SidebarMenuSubItem,
} from '@/components/ui/sidebar'
import {
  File,
  Upload,
  Users,
  ChevronRight,
  Gauge,
  Home,
  FileText,
} from 'lucide-react'
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from '@/components/ui/collapsible'
import { useUser } from '@/src/contexts/user-context'
import { StatusDot } from '../status-dot'
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip'
import { useAssignment } from '@/src/contexts/assignment-context'

export function AssignmentMenu() {
  const router = useRouter()
  const params = useParams()
  const { user } = useUser()
  const {
    assignments,
    currentAssignment,
    peerReviews,
    submissionStatus,
    peerReviewStatus,
    isPeerReviewComplete,
    setCurrentAssignmentId,
    markerAllocations,
  } = useAssignment()

  React.useEffect(() => {
    if (params.id && !currentAssignment) {
      setCurrentAssignmentId(Number(params.id))
    }
  }, [params.id, currentAssignment, setCurrentAssignmentId])

  const handleAssignmentChange = (assignmentId: string) => {
    const selectedAssignment = assignments.find(
      (a) => a.id === Number(assignmentId)
    )
    setCurrentAssignmentId(Number(assignmentId))

    if (selectedAssignment?.assignment_instructions?.[0]) {
      const firstInstructionFile = selectedAssignment.assignment_instructions[0]
      router.push(
        `/assignments/${assignmentId}/instructions/${firstInstructionFile
          .split('/')
          .pop()}`
      )
    } else {
      router.push(`/assignments/${assignmentId}/home`)
    }
  }

  if (!assignments) return null

  return (
    <SidebarMenu>
      <div className='pb-6'>
        <Select
          onValueChange={handleAssignmentChange}
          value={params.id as string}
        >
          <SelectTrigger>
            <SelectValue placeholder='Select an assignment' />
          </SelectTrigger>
          <SelectContent>
            {assignments.map((assignment) => (
              <SelectItem key={assignment.id} value={String(assignment.id)}>
                {assignment.assignmentTitle}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {params.id && currentAssignment && (
        <SidebarMenu>
          {user?.isStaff && (
            <SidebarMenuSubItem>
              <SidebarMenuSubButton
                className='cursor-pointer'
                asChild
                onClick={() =>
                  router.push(`/assignments/${params.id}/dashboard`)
                }
              >
                <span>
                  <Gauge className='h-4 w-4' />
                  Dashboard
                </span>
              </SidebarMenuSubButton>
            </SidebarMenuSubItem>
          )}

          {user?.isStudent && (
            <SidebarMenuSubItem>
              <SidebarMenuSubButton
                className='cursor-pointer'
                asChild
                onClick={() => router.push(`/assignments/${params.id}/home`)}
              >
                <span>
                  <Home className='h-4 w-4' />
                  Home
                </span>
              </SidebarMenuSubButton>
            </SidebarMenuSubItem>
          )}

          <SidebarMenuItem>
            <SidebarMenuButton className='pointer-events-none'>
              <File className='h-4 w-4' />
              Instructions
            </SidebarMenuButton>
            <SidebarMenuSub>
              {assignments
                .find((a) => a.id === Number(params.id))
                ?.assignment_instructions?.map((instructionUrl, index) => (
                  <SidebarMenuSubItem key={index}>
                    <SidebarMenuSubButton
                      className='cursor-pointer'
                      asChild
                      onClick={() =>
                        router.push(
                          `/assignments/${
                            params.id
                          }/instructions/${instructionUrl.split('/').pop()}`
                        )
                      }
                      isActive={
                        params.filename === instructionUrl.split('/').pop()
                      }
                    >
                      <span>Instruction File {index + 1}</span>
                    </SidebarMenuSubButton>
                  </SidebarMenuSubItem>
                ))}
            </SidebarMenuSub>
          </SidebarMenuItem>

          {user?.isStudent && currentAssignment && (
            <>
              <TooltipProvider>
                <Tooltip>
                  <SidebarMenuSubItem>
                    <TooltipTrigger asChild>
                      <SidebarMenuSubButton
                        className={`cursor-pointer`}
                        asChild
                        onClick={() =>
                          router.push(`/assignments/${params.id}/submit`)
                        }
                      >
                        <span>
                          <Upload className='h-4 w-4' />
                          Submit Work
                        </span>
                      </SidebarMenuSubButton>
                    </TooltipTrigger>
                    {!submissionStatus.isOpen && (
                      <TooltipContent side='right'>
                        <p>{submissionStatus.message}</p>
                      </TooltipContent>
                    )}
                  </SidebarMenuSubItem>
                </Tooltip>
              </TooltipProvider>

              <TooltipProvider>
                <Tooltip>
                  <SidebarMenuItem>
                    <TooltipTrigger asChild>
                      <SidebarMenuButton
                        className={`pointer-events-none ${!peerReviewStatus.isOpen ? 'opacity-50' : ''} `}
                      >
                        <Users className='h-4 w-4' />
                        <span>Peer Review</span>
                      </SidebarMenuButton>
                    </TooltipTrigger>

                    {!peerReviewStatus.isOpen && (
                      <TooltipContent side='right'>
                        <p>{peerReviewStatus.message}</p>
                      </TooltipContent>
                    )}

                    <SidebarMenuSub>
                      {!peerReviewStatus.isOpen ? (
                        <SidebarMenuSubItem>
                          <SidebarMenuSubButton className='pointer-events-none cursor-default opacity-50'>
                            <span>Check back later</span>
                          </SidebarMenuSubButton>
                        </SidebarMenuSubItem>
                      ) : peerReviews?.length == 0 ? (
                        <SidebarMenuSubItem>
                          <SidebarMenuSubButton className='pointer-events-none cursor-default'>
                            <span>Check back later</span>
                          </SidebarMenuSubButton>
                        </SidebarMenuSubItem>
                      ) : (
                        peerReviews?.map((review) => (
                          <SidebarMenuSubItem key={review.id}>
                            <SidebarMenuSubButton
                              onClick={() =>
                                router.push(
                                  `/assignments/${params.id}/peer-review/${review.submission_id}`
                                )
                              }
                              isActive={
                                params['peer-review-id'] ===
                                review.submission_id.toString()
                              }
                              className='cursor-pointer overflow-visible'
                            >
                              <div className='flex items-center justify-between gap-2 overflow-visible'>
                                <StatusDot
                                  status={
                                    isPeerReviewComplete(review.submission_id)
                                      ? 'COMPLETED'
                                      : (review.status as
                                          | 'COMPLETED'
                                          | 'IN_PROGRESS'
                                          | 'PENDING')
                                  }
                                />
                                <span>{review.student_name}</span>
                              </div>
                            </SidebarMenuSubButton>
                          </SidebarMenuSubItem>
                        ))
                      )}
                    </SidebarMenuSub>
                  </SidebarMenuItem>
                </Tooltip>
              </TooltipProvider>

              <SidebarMenuSubItem>
                <SidebarMenuSubButton
                  className='cursor-pointer'
                  asChild
                  onClick={() =>
                    router.push(`/assignments/${params.id}/results`)
                  }
                >
                  <span>
                    <FileText className='h-4 w-4' />
                    Results
                  </span>
                </SidebarMenuSubButton>
              </SidebarMenuSubItem>
            </>
          )}

          {user?.isStaff &&
            currentAssignment?.assignment_type === 'PEER_REVIEW' && (
              <TooltipProvider>
                <Tooltip>
                  <Collapsible
                    asChild
                    defaultOpen
                    className='group/collapsible'
                  >
                    <SidebarMenuItem>
                      <CollapsibleTrigger asChild>
                        <TooltipTrigger asChild>
                          <SidebarMenuButton>
                            <Users className='h-4 w-4' />
                            <span>
                              My Marking Allocation (
                              <span className='font-mono text-xs text-muted-foreground'>
                                {markerAllocations?.length}
                              </span>
                              )
                            </span>
                            <ChevronRight className='ml-auto transition-transform duration-200 group-data-[state=open]/collapsible:rotate-90' />
                          </SidebarMenuButton>
                        </TooltipTrigger>
                      </CollapsibleTrigger>
                      <CollapsibleContent>
                        <SidebarMenuSub>
                          {markerAllocations?.map((review) => (
                            <SidebarMenuSubItem key={review.id}>
                              <SidebarMenuSubButton
                                onClick={() =>
                                  router.push(
                                    `/assignments/${params.id}/mark/${review.submission_id}`
                                  )
                                }
                                isActive={
                                  params['mark-id'] ===
                                  review.submission_id.toString()
                                }
                                className='cursor-pointer overflow-visible'
                              >
                                <div className='flex w-full items-center justify-between'>
                                  <span className='truncate'>
                                    {review.student_name.length > 17
                                      ? `${review.student_name.substring(0, 17)}...`
                                      : review.student_name}
                                  </span>
                                  <span className='font-mono text-xs text-muted-foreground'>
                                    {review.student_number}
                                  </span>
                                </div>
                              </SidebarMenuSubButton>
                            </SidebarMenuSubItem>
                          ))}
                        </SidebarMenuSub>
                      </CollapsibleContent>
                    </SidebarMenuItem>
                  </Collapsible>
                </Tooltip>
              </TooltipProvider>
            )}
        </SidebarMenu>
      )}
    </SidebarMenu>
  )
}
