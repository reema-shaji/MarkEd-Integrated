'use client'

/**
 * Unified sidebar navigation (Design PRD §3.1).
 *
 * The three source codebases navigated differently: Hao and Mingyue used a top
 * navbar plus a home page of course cards, entering an assignment to reveal a
 * left sidebar of assignment-scoped tools; Tomas used a persistent sidebar
 * whose assignment dropdown *was* the navigation.
 *
 * The unified design keeps Tomas's persistent sidebar but adopts Hao and
 * Mingyue's separation of browsing from working — their two-level approach
 * scored higher (SUS 87.5–93.75 against 70–85). So:
 *   - the course dropdown is a context *filter*, never a navigation selector;
 *   - "Assignments" is always present and leads to the browsing page;
 *   - assignment-scoped tools appear as a group only once inside an assignment,
 *     and tools that do not apply to that assignment are hidden rather than
 *     disabled, so the visible set stays stable between similar assignments.
 */

import * as React from 'react'
import { useParams, usePathname, useRouter } from 'next/navigation'
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
  SidebarMenuItem,
  SidebarMenuSub,
  SidebarMenuSubButton,
  SidebarMenuSubItem,
} from '@/components/ui/sidebar'
import {
  ChevronRight,
  ClipboardCheck,
  ClipboardList,
  File,
  FileText,
  FolderKanban,
  Gauge,
  Home,
  Layers,
  ListChecks,
  Settings2,
  Upload,
  Users,
  Users2,
} from 'lucide-react'
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from '@/components/ui/collapsible'
import { Badge } from '@/components/ui/badge'
import { useUser } from '@/src/contexts/user-context'
import { useCourse } from '@/src/contexts/course-context'
import { useAssignment } from '@/src/contexts/assignment-context'
import { StatusDot } from '../status-dot'
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip'

export function AssignmentMenu() {
  const router = useRouter()
  const params = useParams()
  const pathname = usePathname()
  const { user } = useUser()
  const { courses, currentCourseId, setCurrentCourseId } = useCourse()
  const {
    currentAssignment,
    peerReviews,
    submissionStatus,
    peerReviewStatus,
    isPeerReviewComplete,
    setCurrentAssignmentId,
    markerAllocations,
  } = useAssignment()

  const assignmentId = params.id as string | undefined

  React.useEffect(() => {
    if (assignmentId && !currentAssignment) {
      setCurrentAssignmentId(Number(assignmentId))
    }
  }, [assignmentId, currentAssignment, setCurrentAssignmentId])

  const inAssignment = Boolean(assignmentId && currentAssignment)
  const isGroup = currentAssignment?.assignment_type === 'GROUP'
  const hasPeerReview = Boolean(currentAssignment?.peer_review_enabled)
  const hasSelfAssessment = Boolean(currentAssignment?.self_assessment_enabled)

  const go = (path: string) => router.push(path)
  const isActive = (segment: string) =>
    pathname?.includes(`/assignments/${assignmentId}/${segment}`) ?? false

  const item = (
    key: string,
    label: string,
    icon: React.ReactNode,
    segment: string
  ) => (
    <SidebarMenuSubItem key={key}>
      <SidebarMenuSubButton
        className='cursor-pointer'
        asChild
        isActive={isActive(segment)}
        onClick={() => go(`/assignments/${assignmentId}/${segment}`)}
      >
        <span>
          {icon}
          {label}
        </span>
      </SidebarMenuSubButton>
    </SidebarMenuSubItem>
  )

  return (
    <SidebarMenu>
      {/* Course switcher — a context filter, not a navigation selector. */}
      <div className='pb-3'>
        <Select
          value={currentCourseId ? String(currentCourseId) : undefined}
          onValueChange={(value) => {
            setCurrentCourseId(Number(value))
            // Leaving the assignment context: switching course must not strand
            // the user inside an assignment belonging to the previous course.
            router.push('/assignments')
          }}
        >
          <SelectTrigger aria-label='Select course'>
            <SelectValue placeholder='Select a course' />
          </SelectTrigger>
          <SelectContent>
            {courses.map((course) => (
              <SelectItem key={course.id} value={String(course.id)}>
                {course.courseCode} — {course.courseName}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {/* Always-present top-level link. */}
      <SidebarMenuItem>
        <SidebarMenuButton
          className='cursor-pointer'
          isActive={pathname === '/assignments'}
          onClick={() => go('/assignments')}
        >
          <Layers className='h-4 w-4' />
          <span>Assignments</span>
        </SidebarMenuButton>
      </SidebarMenuItem>

      {inAssignment && (
        <>
          <div className='mt-4 px-2'>
            <div className='text-[10px] font-semibold uppercase tracking-wide text-muted-foreground'>
              Current assignment
            </div>
            <div
              className='mt-1 truncate text-sm font-medium'
              title={currentAssignment?.assignmentTitle}
            >
              {currentAssignment?.assignmentTitle}
            </div>
            <div className='mt-1.5 flex flex-wrap gap-1'>
              <Badge variant='secondary' className='text-[10px]'>
                {isGroup ? 'Group' : 'Individual'}
              </Badge>
              {hasPeerReview && (
                <Badge variant='outline' className='text-[10px]'>
                  Peer Review
                </Badge>
              )}
              {hasSelfAssessment && (
                <Badge variant='outline' className='text-[10px]'>
                  Self-Assessment
                </Badge>
              )}
            </div>
          </div>

          <SidebarMenuSub className='mt-2'>
            {/* ---------------- Staff tools ---------------- */}
            {user?.isStaff && (
              <>
                {item('dashboard', 'Dashboard', <Gauge className='h-4 w-4' />, 'dashboard')}
                {item('submissions', 'Submissions', <FileText className='h-4 w-4' />, 'submissions')}
                {item('marking', 'Marking', <ClipboardCheck className='h-4 w-4' />, 'marking')}
                {isGroup &&
                  item(
                    'groups',
                    'Group Management',
                    <Users2 className='h-4 w-4' />,
                    'groups'
                  )}
                {item('structure', 'Assignment Structure', <ListChecks className='h-4 w-4' />, 'structure')}
                {item('customization', 'Customization', <Settings2 className='h-4 w-4' />, 'customization')}
                {item('jobs', 'Jobs', <ClipboardList className='h-4 w-4' />, 'jobs')}
              </>
            )}

            {/* ---------------- Student tools ---------------- */}
            {user?.isStudent && (
              <>
                {item('home', 'Home', <Home className='h-4 w-4' />, 'home')}

                <TooltipProvider>
                  <Tooltip>
                    <SidebarMenuSubItem>
                      <TooltipTrigger asChild>
                        <SidebarMenuSubButton
                          className='cursor-pointer'
                          asChild
                          isActive={isActive('submit')}
                          onClick={() => go(`/assignments/${assignmentId}/submit`)}
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

                {/* Hidden for individual assignments (Hao GM-8). */}
                {isGroup &&
                  item(
                    'workspace',
                    'Group Workspace',
                    <FolderKanban className='h-4 w-4' />,
                    'workspace'
                  )}

                {/* Hidden unless the teacher enabled it (Mingyue SA-1). */}
                {hasSelfAssessment &&
                  item(
                    'self-assessment',
                    'Self-Assessment',
                    <ClipboardCheck className='h-4 w-4' />,
                    'self-assessment'
                  )}

                {/* Tomas's collapsible list of allocated reviews with status dots. */}
                {hasPeerReview && (
                  <TooltipProvider>
                    <Tooltip>
                      <Collapsible asChild defaultOpen className='group/collapsible'>
                        <SidebarMenuItem>
                          <CollapsibleTrigger asChild>
                            <TooltipTrigger asChild>
                              <SidebarMenuButton
                                className={!peerReviewStatus.isOpen ? 'opacity-50' : ''}
                              >
                                <Users className='h-4 w-4' />
                                <span>Peer Review</span>
                                <ChevronRight className='ml-auto transition-transform duration-200 group-data-[state=open]/collapsible:rotate-90' />
                              </SidebarMenuButton>
                            </TooltipTrigger>
                          </CollapsibleTrigger>
                          {!peerReviewStatus.isOpen && (
                            <TooltipContent side='right'>
                              <p>{peerReviewStatus.message}</p>
                            </TooltipContent>
                          )}
                          <CollapsibleContent>
                            <SidebarMenuSub>
                              {!peerReviewStatus.isOpen || !peerReviews?.length ? (
                                <SidebarMenuSubItem>
                                  <SidebarMenuSubButton className='pointer-events-none cursor-default opacity-50'>
                                    <span>Check back later</span>
                                  </SidebarMenuSubButton>
                                </SidebarMenuSubItem>
                              ) : (
                                peerReviews.map((review) => (
                                  <SidebarMenuSubItem key={review.id}>
                                    <SidebarMenuSubButton
                                      onClick={() =>
                                        go(
                                          `/assignments/${assignmentId}/peer-review/${review.submission_id}`
                                        )
                                      }
                                      isActive={
                                        params['peer-review-id'] ===
                                        review.submission_id.toString()
                                      }
                                      className='cursor-pointer overflow-visible'
                                    >
                                      <div className='flex items-center gap-2 overflow-visible'>
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
                                        {/* Group peer review anonymises the
                                            submission as a group, per §8.4. */}
                                        <span>{review.student_name}</span>
                                      </div>
                                    </SidebarMenuSubButton>
                                  </SidebarMenuSubItem>
                                ))
                              )}
                            </SidebarMenuSub>
                          </CollapsibleContent>
                        </SidebarMenuItem>
                      </Collapsible>
                    </Tooltip>
                  </TooltipProvider>
                )}

                {item('results', 'Results', <FileText className='h-4 w-4' />, 'results')}
              </>
            )}

            {/* Instruction files, from Tomas — shown to everyone when present. */}
            {!!currentAssignment?.assignment_instructions?.length && (
              <Collapsible asChild defaultOpen className='group/collapsible'>
                <SidebarMenuItem>
                  <CollapsibleTrigger asChild>
                    <SidebarMenuButton>
                      <File className='h-4 w-4' />
                      <span>Instructions</span>
                      <ChevronRight className='ml-auto transition-transform duration-200 group-data-[state=open]/collapsible:rotate-90' />
                    </SidebarMenuButton>
                  </CollapsibleTrigger>
                  <CollapsibleContent>
                    <SidebarMenuSub>
                      {currentAssignment.assignment_instructions.map((url, index) => (
                        <SidebarMenuSubItem key={index}>
                          <SidebarMenuSubButton
                            className='cursor-pointer'
                            asChild
                            isActive={params.filename === url.split('/').pop()}
                            onClick={() =>
                              go(
                                `/assignments/${assignmentId}/instructions/${url
                                  .split('/')
                                  .pop()}`
                              )
                            }
                          >
                            <span>Instruction File {index + 1}</span>
                          </SidebarMenuSubButton>
                        </SidebarMenuSubItem>
                      ))}
                    </SidebarMenuSub>
                  </CollapsibleContent>
                </SidebarMenuItem>
              </Collapsible>
            )}

            {/* Tomas's marking allocation list, now gated on the peer review
                toggle rather than the removed PEER_REVIEW assignment type. */}
            {user?.isStaff && hasPeerReview && (
              <Collapsible asChild defaultOpen className='group/collapsible'>
                <SidebarMenuItem>
                  <CollapsibleTrigger asChild>
                    <SidebarMenuButton>
                      <Users className='h-4 w-4' />
                      <span>
                        My Marking Allocation (
                        <span className='font-mono text-xs text-muted-foreground'>
                          {markerAllocations?.length ?? 0}
                        </span>
                        )
                      </span>
                      <ChevronRight className='ml-auto transition-transform duration-200 group-data-[state=open]/collapsible:rotate-90' />
                    </SidebarMenuButton>
                  </CollapsibleTrigger>
                  <CollapsibleContent>
                    <SidebarMenuSub>
                      {markerAllocations?.map((review) => (
                        <SidebarMenuSubItem key={review.id}>
                          <SidebarMenuSubButton
                            onClick={() =>
                              go(
                                `/assignments/${assignmentId}/mark/${review.submission_id}`
                              )
                            }
                            isActive={
                              params['mark-id'] === review.submission_id.toString()
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
            )}
          </SidebarMenuSub>
        </>
      )}
    </SidebarMenu>
  )
}
