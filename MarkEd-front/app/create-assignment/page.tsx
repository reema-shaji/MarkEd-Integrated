'use client'

/**
 * Create Assignment — the unified create form (Design PRD §6.1).
 *
 * Matches the prototype "Create Assignment" screen: Basic information, then a
 * Submission type section where Individual/Group is a choice and peer review
 * and self-assessment are independent toggles (not separate types). Posts to
 * the unified /assignments/create/{course_id} endpoint.
 */

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { DefaultService, GroupSetSchema } from '@/src/api'
import { useCourse } from '@/src/contexts/course-context'
import { Loader2 } from 'lucide-react'
import { toast } from 'sonner'

type AType = 'INDIVIDUAL' | 'GROUP'

const INPUT_CLS =
  'w-full rounded-[9px] border border-[#DED8CA] bg-white px-[13px] py-2.5 text-sm text-[#131A26] outline-none focus:border-[#B8B0A0]'
const FIELD_LABEL_CLS =
  'mb-[5px] block text-[12.5px] font-semibold tracking-[.1px] text-[#2C3444]'

function RequiredTag() {
  return (
    <span className='ml-1.5 rounded-[4px] bg-[#F8EFDC] px-1.5 py-px align-[1px] text-[10px] font-bold tracking-[.5px] text-[#8A5D14]'>
      REQUIRED
    </span>
  )
}

export default function CreateAssignmentPage() {
  const router = useRouter()
  const { currentCourseId } = useCourse()

  const [title, setTitle] = useState('')
  const [description, setDescription] = useState('')
  const [deadline, setDeadline] = useState('')
  const [website, setWebsite] = useState('')

  const [type, setType] = useState<AType>('INDIVIDUAL')
  const [groupSets, setGroupSets] = useState<GroupSetSchema[]>([])
  const [groupSetId, setGroupSetId] = useState<string>('')
  const [minSize, setMinSize] = useState(2)
  const [maxSize, setMaxSize] = useState(4)

  const [peerEnabled, setPeerEnabled] = useState(false)
  const [reviewsPerStudent, setReviewsPerStudent] = useState(3)
  const [reviewDeadline, setReviewDeadline] = useState('')

  const [saEnabled, setSaEnabled] = useState(false)
  const [saDeadline, setSaDeadline] = useState('')

  const [submitting, setSubmitting] = useState(false)

  useEffect(() => {
    if (!currentCourseId) return
    DefaultService.listGroupSets(currentCourseId)
      .then((sets) => {
        setGroupSets(sets)
        if (sets[0]) setGroupSetId(String(sets[0].id))
      })
      .catch(() => {})
  }, [currentCourseId])

  const create = async () => {
    if (!currentCourseId) return toast.error('No course selected')
    if (!title.trim()) return toast.error('Give the assignment a title')
    if (!deadline) return toast.error('Set a submission deadline')
    if (type === 'GROUP' && !groupSetId) {
      return toast.error('Choose a group category for a group assignment')
    }
    setSubmitting(true)
    try {
      const response = await DefaultService.createAssignment(currentCourseId, {
        title: title.trim(),
        description: description.trim() || null,
        deadline: new Date(deadline).toISOString(),
        assignmentWebsite: website.trim() || null,
        assignment_type: type,
        group_set_id: type === 'GROUP' ? Number(groupSetId) : null,
        min_group_size: type === 'GROUP' ? minSize : null,
        max_group_size: type === 'GROUP' ? maxSize : null,
        peer_review_enabled: peerEnabled,
        reviews_per_student: peerEnabled ? reviewsPerStudent : null,
        review_deadline:
          peerEnabled && reviewDeadline
            ? new Date(reviewDeadline).toISOString()
            : null,
        self_assessment_enabled: saEnabled,
        self_assessment_deadline:
          saEnabled && saDeadline ? new Date(saDeadline).toISOString() : null,
      })
      if (!response.success) throw new Error(response.message)
      toast.success('Assignment created')
      router.push('/assignments')
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Could not create the assignment')
    } finally {
      setSubmitting(false)
    }
  }

  const typeOptions: { value: AType; title: string; desc: string }[] = [
    {
      value: 'INDIVIDUAL',
      title: 'Individual',
      desc: 'Each student submits their own work.',
    },
    {
      value: 'GROUP',
      title: 'Group',
      desc: 'One submission per group, from any member.',
    },
  ]

  return (
    <div className='mx-auto flex min-h-full w-full flex-col'>
      <div className='mx-auto w-full max-w-[880px] px-7 pt-8'>
        {/* Breadcrumb */}
        <div className='mb-[5px] text-[12.5px] text-[#8A9099]'>
          <button
            onClick={() => router.push('/assignments')}
            className='text-[#8A9099] hover:text-[#5A6070]'
          >
            Assignments
          </button>{' '}
          <span className='text-[#C6BFB0]'>/</span> New
        </div>
        <div className='mb-[22px]'>
          <div className='text-[23px] font-semibold tracking-[-0.5px] text-[#131A26]'>
            Create Assignment
          </div>
          <div className='mt-[3px] text-[13.5px] text-[#5A6070]'>
            Peer review and self-assessment are optional and can be changed later.
          </div>
        </div>

        {/* Basic information */}
        <section className='mb-3.5 overflow-hidden rounded-[14px] border border-[#EAE5DB] bg-white'>
          <div className='border-b border-[#F0ECE4] px-6 pb-[15px] pt-[18px]'>
            <span className='block text-[14px] font-semibold tracking-[-0.05px] text-[#131A26]'>
              Basic information
            </span>
            <span className='mt-0.5 block text-[12.5px] leading-[1.5] text-[#5A6070]'>
              What the assignment is called and when it is due.
            </span>
          </div>
          <div className='px-6 pb-[22px] pt-5'>
            <div className='flex flex-col gap-4'>
              <div>
                <div className={FIELD_LABEL_CLS}>
                  Title
                  <RequiredTag />
                </div>
                <input
                  type='text'
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  placeholder='e.g. Design Report'
                  className={`${INPUT_CLS} max-w-[460px]`}
                />
              </div>
              <div>
                <div className={FIELD_LABEL_CLS}>Description</div>
                <textarea
                  rows={3}
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  placeholder='What should students produce?'
                  className={`${INPUT_CLS} max-w-[620px] resize-y leading-[1.6]`}
                />
                <div className='mt-[5px] text-[11.5px] leading-[1.5] text-[#8A9099]'>
                  Shown to students on the assignment page as the brief.
                </div>
              </div>
              <div className='grid max-w-[620px] grid-cols-1 gap-4 sm:grid-cols-2'>
                <div>
                  <div className={FIELD_LABEL_CLS}>
                    Submission deadline
                    <RequiredTag />
                  </div>
                  <input
                    type='datetime-local'
                    value={deadline}
                    onChange={(e) => setDeadline(e.target.value)}
                    className={INPUT_CLS}
                  />
                </div>
                <div>
                  <div className={FIELD_LABEL_CLS}>
                    Assignment website{' '}
                    <span className='font-normal text-[#8A9099]'>optional</span>
                  </div>
                  <input
                    type='text'
                    value={website}
                    onChange={(e) => setWebsite(e.target.value)}
                    placeholder='https://'
                    className={INPUT_CLS}
                  />
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* Submission type */}
        <section className='mb-3.5 overflow-hidden rounded-[14px] border border-[#EAE5DB] bg-white'>
          <div className='border-b border-[#F0ECE4] px-6 pb-[15px] pt-[18px]'>
            <span className='block text-[14px] font-semibold tracking-[-0.05px] text-[#131A26]'>
              Submission type
            </span>
            <span className='mt-0.5 block text-[12.5px] leading-[1.5] text-[#5A6070]'>
              Individual or group submission. This cannot be changed after creation.
            </span>
          </div>
          <div className='px-6 pb-[22px] pt-5'>
            <div className='grid grid-cols-1 gap-3 sm:grid-cols-2'>
              {typeOptions.map((opt) => {
                const active = type === opt.value
                return (
                  <button
                    key={opt.value}
                    type='button'
                    onClick={() => setType(opt.value)}
                    className={`flex items-start gap-[11px] rounded-[11px] border-[1.5px] p-[15px] text-left transition-colors ${
                      active
                        ? 'border-[#131A26] bg-[#FAF8F4]'
                        : 'border-[#DED8CA] bg-white hover:border-[#B8B0A0]'
                    }`}
                  >
                    <span
                      className={`mt-px block h-4 w-4 flex-none rounded-full bg-white ${
                        active
                          ? 'border-[5px] border-[#131A26]'
                          : 'border-2 border-[#C6BFB0]'
                      }`}
                    />
                    <span>
                      <span className='mb-[3px] block text-[14px] font-semibold text-[#131A26]'>
                        {opt.title}
                      </span>
                      <span className='block text-[12px] leading-[1.5] text-[#5A6070]'>
                        {opt.desc}
                      </span>
                    </span>
                  </button>
                )
              })}
            </div>

            {/* Group settings */}
            {type === 'GROUP' && (
              <div className='mt-[18px] rounded-[12px] bg-[#FAF8F4] p-4'>
                <div className='mb-3 text-[10px] font-semibold uppercase tracking-[.85px] text-[#A29A8C]'>
                  Group settings
                </div>
                <div className='grid grid-cols-1 gap-3 sm:grid-cols-[2fr_1fr_1fr]'>
                  <div>
                    <div className={FIELD_LABEL_CLS}>Group category</div>
                    <div className='flex gap-2'>
                      <select
                        value={groupSetId}
                        onChange={(e) => setGroupSetId(e.target.value)}
                        className={`${INPUT_CLS} min-w-0 flex-1`}
                      >
                        {groupSets.map((gs) => (
                          <option key={gs.id} value={String(gs.id)}>
                            {gs.name} ({gs.groups_count} groups)
                          </option>
                        ))}
                      </select>
                      <button
                        type='button'
                        onClick={() => router.push('/groupsets')}
                        className='whitespace-nowrap rounded-[9px] border border-[#DED8CA] bg-white px-[13px] py-2.5 text-[12.5px] font-semibold text-[#2C3444] hover:bg-[#F2EFE8]'
                      >
                        New
                      </button>
                    </div>
                  </div>
                  <div>
                    <div className={FIELD_LABEL_CLS}>Min size</div>
                    <input
                      type='number'
                      min={1}
                      value={minSize}
                      onChange={(e) => setMinSize(Number(e.target.value))}
                      className={INPUT_CLS}
                    />
                  </div>
                  <div>
                    <div className={FIELD_LABEL_CLS}>Max size</div>
                    <input
                      type='number'
                      min={1}
                      value={maxSize}
                      onChange={(e) => setMaxSize(Number(e.target.value))}
                      className={INPUT_CLS}
                    />
                  </div>
                </div>
                <div className='mt-[5px] text-[11.5px] leading-[1.5] text-[#8A9099]'>
                  The group leader submits on behalf of the group from the shared
                  workspace.
                </div>
              </div>
            )}
          </div>
        </section>

        {/* Assessment options */}
        <section className='mb-3.5 overflow-hidden rounded-[14px] border border-[#EAE5DB] bg-white'>
          <div className='border-b border-[#F0ECE4] px-6 pb-[15px] pt-[18px]'>
            <span className='block text-[14px] font-semibold tracking-[-0.05px] text-[#131A26]'>
              Assessment options
            </span>
            <span className='mt-0.5 block text-[12.5px] leading-[1.5] text-[#5A6070]'>
              Both are optional and can be turned on later.
            </span>
          </div>
          <div className='px-6 pb-5 pt-1.5'>
            {/* Peer review toggle */}
            <div className='flex items-center gap-3.5 border-b border-[#F0ECE4] py-4'>
              <button
                type='button'
                onClick={() => setPeerEnabled((v) => !v)}
                aria-pressed={peerEnabled}
                className={`flex h-6 w-[42px] flex-none items-center rounded-[99px] p-0.5 ${
                  peerEnabled ? 'justify-end bg-[#131A26]' : 'justify-start bg-[#D8D2C6]'
                }`}
              >
                <span className='block h-5 w-5 rounded-full bg-white shadow-[0_1px_2px_rgba(19,26,38,.2)]' />
              </button>
              <span className='min-w-0 flex-1'>
                <span className='block text-[13.5px] font-semibold text-[#2C3444]'>
                  Peer review
                </span>
                <span className='mt-0.5 block text-[12px] leading-[1.5] text-[#5A6070]'>
                  Students review each other anonymously. On group assignments,
                  reviewers come only from other groups.
                </span>
              </span>
            </div>

            {peerEnabled && (
              <div className='my-3.5 rounded-[12px] bg-[#FAF8F4] p-4'>
                <div className='mb-3 text-[10px] font-semibold uppercase tracking-[.85px] text-[#A29A8C]'>
                  Review settings
                </div>
                <div className='grid grid-cols-1 gap-3 sm:grid-cols-2'>
                  <div>
                    <div className={FIELD_LABEL_CLS}>Reviews per student</div>
                    <input
                      type='number'
                      min={1}
                      value={reviewsPerStudent}
                      onChange={(e) =>
                        setReviewsPerStudent(Number(e.target.value))
                      }
                      className={INPUT_CLS}
                    />
                    <div className='mt-[5px] text-[11.5px] leading-[1.5] text-[#8A9099]'>
                      How many submissions each student must review.
                    </div>
                  </div>
                  <div>
                    <div className={FIELD_LABEL_CLS}>Review deadline</div>
                    <input
                      type='datetime-local'
                      value={reviewDeadline}
                      onChange={(e) => setReviewDeadline(e.target.value)}
                      className={INPUT_CLS}
                    />
                    <div className='mt-[5px] text-[11.5px] leading-[1.5] text-[#8A9099]'>
                      Must be after the submission deadline.
                    </div>
                  </div>
                </div>
              </div>
            )}

            {/* Self-assessment toggle */}
            <div className='flex items-center gap-3.5 pb-1 pt-4'>
              <button
                type='button'
                onClick={() => setSaEnabled((v) => !v)}
                aria-pressed={saEnabled}
                className={`flex h-6 w-[42px] flex-none items-center rounded-[99px] p-0.5 ${
                  saEnabled ? 'justify-end bg-[#131A26]' : 'justify-start bg-[#D8D2C6]'
                }`}
              >
                <span className='block h-5 w-5 rounded-full bg-white shadow-[0_1px_2px_rgba(19,26,38,.2)]' />
              </button>
              <span className='min-w-0 flex-1'>
                <span className='block text-[13.5px] font-semibold text-[#2C3444]'>
                  Self-assessment
                </span>
                <span className='mt-0.5 block text-[12px] leading-[1.5] text-[#5A6070]'>
                  Checklist, rubric self-grading and guided reflection, completed
                  after submitting.
                </span>
              </span>
            </div>

            {saEnabled && (
              <div className='my-3.5 rounded-[12px] bg-[#FAF8F4] p-4'>
                <div className='mb-3 text-[10px] font-semibold uppercase tracking-[.85px] text-[#A29A8C]'>
                  Self-assessment settings
                </div>
                <div className='grid grid-cols-1 gap-3 sm:grid-cols-2'>
                  <div>
                    <div className={FIELD_LABEL_CLS}>Self-assessment deadline</div>
                    <input
                      type='datetime-local'
                      value={saDeadline}
                      onChange={(e) => setSaDeadline(e.target.value)}
                      className={INPUT_CLS}
                    />
                  </div>
                </div>
              </div>
            )}
          </div>
        </section>
      </div>

      {/* Sticky footer */}
      <div className='sticky bottom-0 z-20 mt-auto border-t border-[#EAE5DB] bg-[#F5F3EF]'>
        <div className='mx-auto flex w-full max-w-[880px] items-center gap-3 px-7 py-3.5'>
          <span className='flex-1 text-[12.5px] text-[#8A9099]'>
            Fields marked required must be completed.
          </span>
          <button
            type='button'
            onClick={() => router.push('/assignments')}
            className='rounded-[9px] border border-[#DED8CA] bg-white px-[17px] py-[9px] text-[13px] font-semibold text-[#2C3444] hover:bg-[#F2EFE8]'
          >
            Cancel
          </button>
          <button
            type='button'
            onClick={create}
            disabled={submitting}
            className='flex items-center rounded-[9px] bg-[#131A26] px-5 py-2.5 text-[13px] font-semibold text-white hover:bg-[#243247] disabled:opacity-60'
          >
            {submitting && <Loader2 className='mr-2 h-4 w-4 animate-spin' />}
            Create assignment
          </button>
        </div>
      </div>
    </div>
  )
}
