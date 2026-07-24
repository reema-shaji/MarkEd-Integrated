'use client'

import * as React from 'react'
import Image from 'next/image'
import { useRouter } from 'next/navigation'
import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarGroup,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuButton,
} from '@/components/ui/sidebar'
import { LifeBuoy } from 'lucide-react'
import { NavUser } from './nav-user'
import { AssignmentMenu } from './assignment-menu'

export function AppSidebar({ ...props }) {
  const router = useRouter()


  //   // Use the most recent submission for each student
  //   submissions.forEach((submission) => {
  //     if (
  //       !grouped.has(submission.student_id) ||
  //       new Date(submission.submissionDateTime) >
  //         new Date(grouped.get(submission.student_id)!.submissionDateTime)
  //     ) {
  //       grouped.set(submission.student_id, submission)
  //     }
  //   })

  //   return Array.from(grouped.values())
  // }, [submissions])

  return (
    <>
      <Sidebar variant='sidebar' {...props} className='z-50'>
        <SidebarHeader>
          <SidebarMenu>
            <SidebarMenuButton size='lg' asChild className='cursor-pointer'>
              <div>
                {/* Has to be an <a /> tag to avoid the base route of /p */}
                {/* eslint-disable-next-line @next/next/no-html-link-for-pages */}
                <a href='/' className='flex items-center gap-2'>
                  <div className='bg-sidebar-muted flex aspect-square size-8 items-center justify-center rounded-lg text-sidebar-primary-foreground'>
                    <Image
                      src={`${process.env.NEXT_PUBLIC_BASE_PATH || ''}/logo.png`}
                      alt='MarkEd'
                      width={32}
                      height={32}
                      className='h-full w-full object-contain'
                    />
                  </div>
                  <div className='flex flex-col gap-0.5 leading-none'>
                    <span className='font-semibold'>MarkEd</span>
                    <span className=''>v2.0.1</span>
                  </div>
                </a>
              </div>
            </SidebarMenuButton>
          </SidebarMenu>
        </SidebarHeader>

        <SidebarContent>
          <SidebarGroup>
            <AssignmentMenu />
          </SidebarGroup>

          {/* {!user?.isStudent && (
            <SidebarGroup>
              <SidebarMenu>
                <SidebarMenuItem>
                  <SidebarMenuButton className='pointer-events-none'>
                    <File className='h-4 w-4' />
                    Student Submissions
                  </SidebarMenuButton>
                  <SidebarMenuSub>
                    {groupedSubmissions.map((submission) => (
                      <TooltipProvider key={submission.id}>
                        <Tooltip>
                          <SidebarMenuSubItem>
                            <TooltipTrigger asChild>
                              <SidebarMenuSubButton
                                className='cursor-pointer'
                                asChild
                                onClick={() =>
                                  router.push(
                                    `/assignments/${params.id}/mark/${submission.id}`
                                  )
                                }
                              >
                                <span>{submission.student_name}</span>
                              </SidebarMenuSubButton>
                            </TooltipTrigger>
                            <TooltipContent side='top'>
                              <p>Student ID: {submission.student_number}</p>
                            </TooltipContent>
                          </SidebarMenuSubItem>
                        </Tooltip>
                      </TooltipProvider>
                    ))}
                  </SidebarMenuSub>
                </SidebarMenuItem>
              </SidebarMenu>
            </SidebarGroup>
          )} */}
        </SidebarContent>

        <SidebarFooter>
          <SidebarMenuButton
            asChild
            size='sm'
            className='cursor-pointer'
            onClick={() => router.push('/support')}
          >
            <span>
              <LifeBuoy />
              Support
            </span>
          </SidebarMenuButton>
          <NavUser />
        </SidebarFooter>
      </Sidebar>
    </>
  )
}
