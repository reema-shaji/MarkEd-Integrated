'use client'

import React, { useEffect, useState, Suspense } from 'react'
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Button } from '@/components/ui/button'
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
import { Separator } from '@/components/ui/separator'
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

const StatsDisplay: React.FC<StatsDisplayProps> = ({
  numStudents,
  reviewsPerStudent,
  maxSubmissions,
}: StatsDisplayProps) => {
  const totalSubmissions = numStudents * maxSubmissions
  const totalReviewsNeeded = totalSubmissions * reviewsPerStudent
  const reviewsPerStudentCalc = totalReviewsNeeded / numStudents

  return (
    <div className='my-4 space-y-2 rounded-lg bg-neutral-50 p-4'>
      <h3 className='text-sm font-semibold text-neutral-900'>
        Review Distribution Stats
      </h3>
      <div className='grid grid-cols-2 gap-4 text-sm'>
        <div>
          <p className='text-neutral-600'>Total Enrolled Students</p>
          <p className='font-medium'>{numStudents}</p>
        </div>
        <div>
          <p className='text-neutral-600'>Max Possible Submissions</p>
          <p className='font-medium'>{totalSubmissions}</p>
        </div>
        <div>
          <p className='text-neutral-600'>Total Reviews Needed</p>
          <p className='font-medium'>{totalReviewsNeeded}</p>
        </div>
        <div>
          <p className='text-neutral-600'>Reviews Per Student</p>
          <p className='font-medium'>{reviewsPerStudentCalc.toFixed(1)}</p>
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
      } else {
        throw new Error(response.message)
      }
    } catch (error) {
      console.error('Failed to create peer review assignment:', error)
    } finally {
      setIsSubmitting(false)
    }
  }

  return (
    <div className='container mx-auto max-w-screen-md py-10'>
      <Card>
        {isSuccess ? (
          <CardContent className='pt-6'>
            <div className='space-y-4 text-center'>
              <div className='mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-full bg-green-100 text-green-600'>
                <Check className='h-6 w-6' />
              </div>
              <h3 className='text-lg font-semibold'>
                Assignment Created Successfully!
              </h3>
              <p className='text-gray-500'>
                Your peer review assignment has been created and is ready for
                students.
              </p>
              <div className='space-y-2'>
                <Button asChild>
                  <Link href={`/assignments/${assignmentId}/dashboard`}>
                    Go to Assignment Dashboard
                  </Link>
                </Button>
              </div>
            </div>
          </CardContent>
        ) : (
          <>
            <CardHeader>
              <CardTitle>
                New Peer Review Assignment for {course?.courseName || '...'}
              </CardTitle>
              <CardDescription>
                Set up a new peer review assignment for your students
              </CardDescription>
            </CardHeader>
            <CardContent>
              <Form {...form}>
                <form
                  onSubmit={form.handleSubmit(onSubmit)}
                  className='space-y-8'
                >
                  {/* Basic Info Section */}
                  <div className='space-y-4'>
                    <h3 className='text-lg font-semibold'>Basic Information</h3>
                    <FormField
                      control={form.control}
                      name='title'
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Assignment Title</FormLabel>
                          <FormControl>
                            <Input
                              placeholder='Enter assignment title'
                              {...field}
                            />
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
                              onUploadComplete={(urls: string[]) =>
                                onChange(urls)
                              }
                              maxFiles={12}
                            />
                          </FormControl>
                          <FormDescription>
                            Upload one or more PDF files with assignment
                            instructions
                          </FormDescription>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                  </div>

                  <Separator />

                  {/* Dates Section */}
                  <div className='space-y-4'>
                    <h3 className='text-lg font-semibold'>Deadlines</h3>
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
                  </div>

                  <Separator />

                  {/* Review Settings Section */}
                  <div className='space-y-4'>
                    <h3 className='text-lg font-semibold'>Review Settings</h3>

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
                              Number of student submissions that each student
                              must review (1-10)
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
                  </div>

                  <Separator />

                  {/* Visibility & Permissions Section */}
                  <div className='space-y-4'>
                    <h3 className='text-lg font-semibold'>
                      Visibility & Permissions
                    </h3>

                    <div className='grid grid-cols-1 gap-6 md:grid-cols-2'>
                      <FormField
                        control={form.control}
                        name='allowLateSubmissions'
                        render={({ field }) => (
                          <FormItem className='flex flex-row items-center justify-between rounded-lg border p-4'>
                            <div className='space-y-0.5'>
                              <FormLabel className='text-base'>
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
                          <FormItem className='flex flex-row items-center justify-between rounded-lg border p-4'>
                            <div className='space-y-0.5'>
                              <FormLabel className='text-base'>
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
                          <FormItem className='flex flex-row items-center justify-between rounded-lg border p-4'>
                            <div className='space-y-0.5'>
                              <FormLabel className='text-base'>
                                Students Can See Reviews
                              </FormLabel>
                              <FormDescription>
                                Students will receive peer reviews of their work
                                by other students
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
                          <FormItem className='flex flex-row items-center justify-between rounded-lg border p-4'>
                            <div className='space-y-0.5'>
                              <FormLabel className='text-base'>
                                Markers Can See Peer Reviews{' '}
                                <Help>
                                  This could influence the feedback process of
                                  the marker.
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
                  </div>

                  <Button
                    type='submit'
                    disabled={isSubmitting}
                    className='w-full'
                  >
                    {isSubmitting ? (
                      <>
                        <Loader2 className='mr-2 h-4 w-4 animate-spin' />
                        Creating Assignment...
                      </>
                    ) : (
                      'Create Assignment'
                    )}
                  </Button>
                </form>
              </Form>
            </CardContent>
          </>
        )}
      </Card>
    </div>
  )
}

export default function CreatePeerAssignment(): React.ReactElement {
  return (
    <Suspense fallback={<div>Loading...</div>}>
      <PeerAssignmentForm />
    </Suspense>
  )
}
