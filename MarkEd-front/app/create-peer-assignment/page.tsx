'use client'

import React, { useEffect, useState, Suspense } from 'react'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import {
  Form,
  FormControl,
  FormDescription,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from '@/components/ui/form'
import { Switch } from '@/components/ui/switch'
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert'
import { Calendar as Check, Info, Loader2 } from 'lucide-react'
import Link from 'next/link'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import * as z from 'zod'
import { DefaultService } from '@/src/api'
import { FileUpload } from '@/components/file-upload'
import { useSearchParams } from 'next/navigation'
import Help from '@/components/help'
import { DateTimePicker } from '@/components/date-time-picker'
import { toast } from 'sonner'

interface Course {
  id: number
  courseName: string
}

interface StatsDisplayProps {
  numStudents: number
  reviewsPerStudent: number
  maxSubmissions: number
}

const formSchema = z.object({
  title: z.string().min(2, { message: 'Title must be at least 2 characters.' }),
  description: z
    .string()
    .min(10, { message: 'Description must be at least 10 characters.' }),
  releaseDate: z.date({ required_error: 'A release date is required.' }),
  dueDate: z.date({ required_error: 'A due date is required.' }),
  reviewDeadline: z.date({ required_error: 'A review deadline is required.' }),
  reviewsPerStudent: z.number().min(1).max(10),
  maxSubmissionsPerStudent: z.number().min(1).max(5),
  allowLateSubmissions: z.boolean().default(false),
  studentsCanSeeReviews: z.boolean().default(true),
  markersCanSeeReviews: z.boolean().default(true),
  isAnonymous: z.boolean().default(true),
  markersPerSubmission: z.number().min(0).max(5),
  instructions: z.array(z.string()).optional(),
})

type FormValues = z.infer<typeof formSchema>

/** Shared section shell matching the Create Assignment prototype. */
function Section({
  title,
  subtitle,
  children,
}: {
  title: string
  subtitle?: string
  children: React.ReactNode
}): React.ReactElement {
  return (
    <section className='mb-3.5 overflow-hidden rounded-[14px] border border-[#EAE5DB] bg-white'>
      <div className='border-b border-[#F0ECE4] px-6 pb-[15px] pt-[18px]'>
        <span className='block text-[14px] font-semibold tracking-[-0.05px] text-[#131A26]'>
          {title}
        </span>
        {subtitle && (
          <span className='mt-0.5 block text-[12.5px] leading-[1.5] text-[#5A6070]'>
            {subtitle}
          </span>
        )}
      </div>
      <div className='px-6 pb-[22px] pt-5'>{children}</div>
    </section>
  )
}

const StatsDisplay: React.FC<StatsDisplayProps> = ({
  numStudents,
  reviewsPerStudent,
  maxSubmissions,
}: StatsDisplayProps) => {
  const totalSubmissions = numStudents * maxSubmissions
  const totalReviewsNeeded = totalSubmissions * reviewsPerStudent
  const reviewsPerStudentCalc = totalReviewsNeeded / numStudents

  return (
    <div className='my-4 space-y-2 rounded-[12px] bg-[#FAF8F4] p-4'>
      <h3 className='text-[10px] font-semibold uppercase tracking-[.85px] text-[#A29A8C]'>
        Review distribution
      </h3>
      <div className='grid grid-cols-2 gap-4 text-sm'>
        <div>
          <p className='text-[#5A6070]'>Total Enrolled Students</p>
          <p className='font-medium text-[#131A26]'>{numStudents}</p>
        </div>
        <div>
          <p className='text-[#5A6070]'>Max Possible Submissions</p>
          <p className='font-medium text-[#131A26]'>{totalSubmissions}</p>
        </div>
        <div>
          <p className='text-[#5A6070]'>Total Reviews Needed</p>
          <p className='font-medium text-[#131A26]'>{totalReviewsNeeded}</p>
        </div>
        <div>
          <p className='text-[#5A6070]'>Reviews Per Student</p>
          <p className='font-medium text-[#131A26]'>
            {reviewsPerStudentCalc.toFixed(1)}
          </p>
        </div>
      </div>
      {reviewsPerStudentCalc % 1 !== 0 && (
        <Alert className='mt-2'>
          <Info className='h-4 w-4' />
          <AlertTitle>Note</AlertTitle>
          <AlertDescription>
            The current settings will result in an uneven distribution of
            reviews. Some students may need to do{' '}
            {Math.ceil(reviewsPerStudentCalc)} reviews while others do{' '}
            {Math.floor(reviewsPerStudentCalc)}.
          </AlertDescription>
        </Alert>
      )}
    </div>
  )
}

function PeerAssignmentForm(): React.ReactElement {
  const searchParams = useSearchParams()
  const courseId = searchParams.get('course')
  const [course, setCourse] = useState<Course | null>(null)
  const [numStudents, setNumStudents] = useState<number>(0)
  const [isSubmitting, setIsSubmitting] = useState<boolean>(false)
  const [isSuccess, setIsSuccess] = useState<boolean>(false)
  const [assignmentId, setAssignmentId] = useState<number | null>(null)

  useEffect(() => {
    const fetchCourse = async (): Promise<void> => {
      try {
        const course = await DefaultService.getCourse(Number(courseId))
        setCourse(course)
        setNumStudents(course.numberOfEnrolledStudents)
      } catch (error) {
        console.error('Failed to fetch course:', error)
      }
    }
    if (courseId) {
      void fetchCourse()
    }
  }, [courseId])

  const form = useForm<FormValues>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      title: '',
      description: '',
      reviewsPerStudent: 3,
      maxSubmissionsPerStudent: 1,
      allowLateSubmissions: false,
      studentsCanSeeReviews: true,
      markersCanSeeReviews: true,
      isAnonymous: true,
      markersPerSubmission: 1,
    },
  })

  const onSubmit = async (values: FormValues): Promise<void> => {
    setIsSubmitting(true)
    try {
      if (!courseId) throw new Error('No course ID provided')

      const response = await DefaultService.createPeerAssignment(
        Number(courseId),
        {
          course_id: courseId,
          title: values.title,
          description: values.description,
          reviews_per_student: values.reviewsPerStudent,
          release_date: values.releaseDate.toISOString(),
          submission_deadline: values.dueDate.toISOString(),
          review_deadline: values.reviewDeadline.toISOString(),
          instructions: values.instructions || [],
          max_submissions_per_student: values.maxSubmissionsPerStudent,
          allow_late_submissions: values.allowLateSubmissions,
          students_can_see_reviews: values.studentsCanSeeReviews,
          markers_can_see_reviews: values.markersCanSeeReviews,
          is_anonymous: values.isAnonymous,
          markers_per_submission: values.markersPerSubmission,
        }
      )

      if (response.success) {
        setIsSuccess(true)
        setAssignmentId(response.assignment_id ?? null)
        toast.success('Assignment created')
      } else {
        throw new Error(response.message)
      }
    } catch (error) {
      console.error('Failed to create peer review assignment:', error)
      toast.error('Could not create assignment')
    } finally {
      setIsSubmitting(false)
    }
  }

  if (isSuccess) {
    return (
      <div className='mx-auto w-full max-w-[1200px] px-7 pb-12 pt-8'>
        <div className='rounded-[14px] border border-[#EAE5DB] bg-white p-8'>
          <div className='space-y-4 text-center'>
            <div className='mx-auto mb-2 flex h-12 w-12 items-center justify-center rounded-full bg-[#E9F1EA] text-[#2F7D4F]'>
              <Check className='h-6 w-6' />
            </div>
            <h3 className='text-[17px] font-semibold text-[#131A26]'>
              Assignment created
            </h3>
            <p className='text-[13.5px] text-[#5A6070]'>
              Your peer review assignment has been created and is ready for
              students.
            </p>
            <div>
              <Link
                href={`/assignments/${assignmentId}/dashboard`}
                className='inline-block rounded-[9px] bg-[#131A26] px-5 py-2.5 text-[13px] font-semibold text-white hover:bg-[#243247]'
              >
                Go to Assignment Dashboard
              </Link>
            </div>
          </div>
        </div>
      </div>
    )
  }

  return (
    <Form {...form}>
      <form
        onSubmit={form.handleSubmit(onSubmit)}
        className='mx-auto flex min-h-full w-full flex-col'
      >
        <div className='mx-auto w-full max-w-[1200px] px-7 pt-8'>
          {/* Breadcrumb */}
          <div className='mb-[5px] text-[12.5px] text-[#8A9099]'>
            <Link href='/assignments' className='text-[#8A9099] hover:text-[#5A6070]'>
              Assignments
            </Link>{' '}
            <span className='text-[#C6BFB0]'>/</span> New
          </div>
          <div className='mb-[22px]'>
            <div className='text-[23px] font-semibold tracking-[-0.5px] text-[#131A26]'>
              Create Assignment
            </div>
            <div className='mt-[3px] text-[13.5px] text-[#5A6070]'>
              Peer review settings for {course?.courseName || '…'}.
            </div>
          </div>

          {/* Basic information */}
          <Section
            title='Basic information'
            subtitle='What the assignment is called and what students should produce.'
          >
            <div className='space-y-4'>
              <FormField
                control={form.control}
                name='title'
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Assignment Title</FormLabel>
                    <FormControl>
                      <Input placeholder='Enter assignment title' {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name='description'
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Description</FormLabel>
                    <FormControl>
                      <Textarea
                        placeholder='Enter assignment description'
                        {...field}
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name='instructions'
                render={({ field: { onChange } }) => (
                  <FormItem>
                    <FormLabel>Instructions PDF</FormLabel>
                    <FormControl>
                      <FileUpload
                        type='instruction'
                        acceptedFileTypes={['application/pdf']}
                        maxSizeMB={10}
                        onUploadComplete={(urls: string[]) => onChange(urls)}
                        maxFiles={12}
                      />
                    </FormControl>
                    <FormDescription>
                      Upload one or more PDF files with assignment instructions
                    </FormDescription>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>
          </Section>

          {/* Deadlines */}
          <Section
            title='Deadlines'
            subtitle='When the assignment opens, submissions close, and reviews are due.'
          >
            <div className='grid grid-cols-1 gap-6 md:grid-cols-3'>
              <FormField
                control={form.control}
                name='releaseDate'
                render={({ field }) => (
                  <FormItem className='flex flex-col'>
                    <FormLabel>Release Date</FormLabel>
                    <DateTimePicker
                      date={field.value}
                      setDate={(date) => field.onChange(date)}
                    />
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name='dueDate'
                render={({ field }) => (
                  <FormItem className='flex flex-col'>
                    <FormLabel>Submission Due Date</FormLabel>
                    <DateTimePicker
                      date={field.value}
                      setDate={(date) => field.onChange(date)}
                      disabled={(date) =>
                        date < new Date() ||
                        (form.getValues('releaseDate') &&
                          date < form.getValues('releaseDate'))
                      }
                    />
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name='reviewDeadline'
                render={({ field }) => (
                  <FormItem className='flex flex-col'>
                    <FormLabel>Review Deadline</FormLabel>
                    <DateTimePicker
                      date={field.value}
                      setDate={(date) => field.onChange(date)}
                      disabled={(date) =>
                        date < new Date() ||
                        (form.getValues('dueDate') &&
                          date < form.getValues('dueDate'))
                      }
                    />
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>
          </Section>

          {/* Review settings */}
          <Section
            title='Review settings'
            subtitle='How many submissions each student must review.'
          >
            <div className='grid grid-cols-1 gap-6 md:grid-cols-2'>
              <FormField
                control={form.control}
                name='reviewsPerStudent'
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Peer Reviews Per Student</FormLabel>
                    <FormControl>
                      <Input
                        type='number'
                        min={1}
                        max={10}
                        {...field}
                        onChange={(e) =>
                          field.onChange(parseInt(e.target.value))
                        }
                      />
                    </FormControl>
                    <FormDescription>
                      Number of student submissions that each student must
                      review (1-10)
                    </FormDescription>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>

            <StatsDisplay
              numStudents={numStudents}
              reviewsPerStudent={form.watch('reviewsPerStudent')}
              maxSubmissions={form.watch('maxSubmissionsPerStudent')}
            />
          </Section>

          {/* Visibility & permissions */}
          <Section
            title='Visibility & permissions'
            subtitle='Fixed defaults for peer review assignments.'
          >
            <div className='grid grid-cols-1 gap-3 md:grid-cols-2'>
              <FormField
                control={form.control}
                name='allowLateSubmissions'
                render={({ field }) => (
                  <FormItem className='flex flex-row items-center justify-between rounded-[11px] border border-[#EAE5DB] bg-[#FAF8F4] p-4'>
                    <div className='space-y-0.5'>
                      <FormLabel className='text-[13.5px] font-semibold text-[#2C3444]'>
                        Allow Late Submissions
                      </FormLabel>
                      <FormDescription>
                        Students can submit after the deadline
                      </FormDescription>
                    </div>
                    <FormControl>
                      <Switch
                        checked={field.value}
                        onCheckedChange={field.onChange}
                        disabled={true}
                      />
                    </FormControl>
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name='isAnonymous'
                render={({ field }) => (
                  <FormItem className='flex flex-row items-center justify-between rounded-[11px] border border-[#EAE5DB] bg-[#FAF8F4] p-4'>
                    <div className='space-y-0.5'>
                      <FormLabel className='text-[13.5px] font-semibold text-[#2C3444]'>
                        Anonymous Reviews
                      </FormLabel>
                      <FormDescription>
                        Hide reviewer identities from students
                      </FormDescription>
                    </div>
                    <FormControl>
                      <Switch
                        disabled={true}
                        checked={field.value}
                        onCheckedChange={field.onChange}
                      />
                    </FormControl>
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name='studentsCanSeeReviews'
                render={({ field }) => (
                  <FormItem className='flex flex-row items-center justify-between rounded-[11px] border border-[#EAE5DB] bg-[#FAF8F4] p-4'>
                    <div className='space-y-0.5'>
                      <FormLabel className='text-[13.5px] font-semibold text-[#2C3444]'>
                        Students Can See Reviews
                      </FormLabel>
                      <FormDescription>
                        Students will receive peer reviews of their work by
                        other students
                      </FormDescription>
                    </div>
                    <FormControl>
                      <Switch
                        disabled={true}
                        checked={field.value}
                        onCheckedChange={field.onChange}
                      />
                    </FormControl>
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name='markersCanSeeReviews'
                render={({ field }) => (
                  <FormItem className='flex flex-row items-center justify-between rounded-[11px] border border-[#EAE5DB] bg-[#FAF8F4] p-4'>
                    <div className='space-y-0.5'>
                      <FormLabel className='text-[13.5px] font-semibold text-[#2C3444]'>
                        Markers Can See Peer Reviews{' '}
                        <Help>
                          This could influence the feedback process of the
                          marker.
                        </Help>
                      </FormLabel>
                      <FormDescription>
                        Markers can see peer reviews when marking.
                      </FormDescription>
                    </div>
                    <FormControl>
                      <Switch
                        disabled={true}
                        checked={field.value}
                        onCheckedChange={field.onChange}
                      />
                    </FormControl>
                  </FormItem>
                )}
              />
            </div>
          </Section>
        </div>

        {/* Sticky footer */}
        <div className='sticky bottom-0 z-20 mt-auto border-t border-[#EAE5DB] bg-[#F5F3EF]'>
          <div className='mx-auto flex w-full max-w-[1200px] items-center gap-3 px-7 py-3.5'>
            <span className='flex-1 text-[12.5px] text-[#8A9099]'>
              Fields marked required must be completed.
            </span>
            <Link
              href='/assignments'
              className='rounded-[9px] border border-[#DED8CA] bg-white px-[17px] py-[9px] text-[13px] font-semibold text-[#2C3444] hover:bg-[#F2EFE8]'
            >
              Cancel
            </Link>
            <button
              type='submit'
              disabled={isSubmitting}
              className='flex items-center rounded-[9px] bg-[#131A26] px-5 py-2.5 text-[13px] font-semibold text-white hover:bg-[#243247] disabled:opacity-60'
            >
              {isSubmitting && <Loader2 className='mr-2 h-4 w-4 animate-spin' />}
              Create assignment
            </button>
          </div>
        </div>
      </form>
    </Form>
  )
}

export default function CreatePeerAssignment(): React.ReactElement {
  return (
    <Suspense fallback={<div>Loading...</div>}>
      <PeerAssignmentForm />
    </Suspense>
  )
}
