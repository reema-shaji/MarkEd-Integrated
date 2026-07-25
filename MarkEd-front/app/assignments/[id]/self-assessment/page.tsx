'use client'

/**
 * Student self-assessment form — ported from Mingyue's student/self_assessment.html
 * and restyled to the unified "SA Form" prototype.
 *
 * Three numbered sections in her order: checklist, rubric self-grading, Gibbs
 * reflection. Each carries a "What & why / How" instruction line, matching the
 * prototype and the low-effort fixes her evaluation motivated (Unified PRD §9):
 *   b-6  a subtitle distinguishing the checklist from the rubric
 *   b-12 an instruction line above the reflection prompts
 *   b-14 a confirmation after submitting
 *   b-15 an explanation of why students grade themselves
 *   b-4  the deadline is labelled "Self-Assessment Deadline" in full
 */

import { useCallback, useEffect, useState } from 'react'
import { useParams } from 'next/navigation'
import { DefaultService, SelfAssessmentFormSchema } from '@/src/api'
import { Skeleton } from '@/components/ui/skeleton'
import { toast } from 'sonner'

/** A plain numbered section card, faithful to the prototype's "1 · Checklist" heads. */
function Section({
  index,
  title,
  subtitle,
  children,
}: {
  index: number
  title: string
  subtitle: React.ReactNode
  children: React.ReactNode
}) {
  return (
    <div className='mb-4 rounded-[14px] border border-[#EAE5DB] bg-white p-6'>
      <div className='text-[15px] font-semibold tracking-[-.1px] text-[#131A26]'>
        {index} · {title}
      </div>
      <div className='mb-3.5 mt-1 text-[13px] leading-relaxed text-[#5A6070]'>
        {subtitle}
      </div>
      {children}
    </div>
  )
}

export default function SelfAssessmentPage() {
  const params = useParams()
  const assignmentId = Number(params.id)

  const [form, setForm] = useState<SelfAssessmentFormSchema | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [unavailable, setUnavailable] = useState<string | null>(null)

  const [checklist, setChecklist] = useState<Record<string, boolean>>({})
  const [rubric, setRubric] = useState<Record<string, number>>({})
  const [reflection, setReflection] = useState<Record<string, string>>({})

  const load = useCallback(async () => {
    try {
      const data = await DefaultService.getSelfAssessmentForm(assignmentId)
      setForm(data)
      setChecklist(data.checklist_answers ?? {})
      setRubric(data.rubric_answers ?? {})
      setReflection(data.reflection_answers ?? {})
    } catch (error) {
      const status = (error as { status?: number })?.status
      setUnavailable(
        status === 404
          ? 'Self-assessment is not enabled for this assignment.'
          : 'Could not load the self-assessment form.'
      )
    } finally {
      setIsLoading(false)
    }
  }, [assignmentId])

  useEffect(() => {
    load()
  }, [load])

  const submit = async () => {
    setSaving(true)
    try {
      const response = await DefaultService.submitSelfAssessment(assignmentId, {
        checklist,
        rubric,
        reflection,
      })
      // b-14: her students asked for confirmation that it had gone through.
      toast.success(response.message || 'Self-assessment submitted')
      await load()
    } catch {
      toast.error('Could not submit your self-assessment')
    } finally {
      setSaving(false)
    }
  }

  if (isLoading) {
    return (
      <div className='mx-auto w-full max-w-[880px] px-7 pb-12 pt-8'>
        <Skeleton className='h-8 w-72' />
        <div className='mt-6 grid gap-4'>
          <Skeleton className='h-48 rounded-[14px]' />
          <Skeleton className='h-48 rounded-[14px]' />
        </div>
      </div>
    )
  }

  if (unavailable || !form) {
    return (
      <div className='mx-auto w-full max-w-[880px] px-7 pb-12 pt-8'>
        <div className='rounded-[14px] border border-[#EAE5DB] bg-white py-14 text-center text-sm text-[#5A6070]'>
          {unavailable}
        </div>
      </div>
    )
  }

  // Section numbers stay contiguous even when some sections are disabled.
  let sectionIndex = 0

  return (
    <div className='mx-auto w-full max-w-[880px] px-7 pb-12 pt-8'>
      <div className='text-[21px] font-semibold tracking-[-.45px] text-[#131A26]'>
        Self-Assessment
      </div>
      {/* b-4: deadline labelled in full and shown on the header line. */}
      {form.deadline && (
        <div className='mb-2 mt-1 text-sm text-[#5A6070]'>
          Self-Assessment Deadline:{' '}
          {new Date(form.deadline).toLocaleString(undefined, {
            day: 'numeric',
            month: 'short',
            year: 'numeric',
            hour: '2-digit',
            minute: '2-digit',
          })}
          {form.is_late && (
            <span className='text-[#8A5D14]'>
              {' '}
              · past deadline, submissions recorded as late
            </span>
          )}
        </div>
      )}
      {/* b-8: students confused self-assessment with marker feedback. */}
      <div className='mb-4 text-xs leading-relaxed text-[#8A9099]'>
        Your <b>self-assessment</b> is your own evaluation of your work. After
        you submit it, your instructor may leave <b>feedback</b> — their
        comments on your self-assessment, shown at the top of this page.
      </div>

      {/* b-14 / feedback: the instructor's response, when they have left one. */}
      {form.feedback_text && (
        <div className='mb-5 rounded-[12px] border border-[#C9DCEA] bg-[#EDF3F8] px-[18px] py-3.5'>
          <div className='mb-1 text-[13px] font-semibold text-[#1F4E79]'>
            Instructor feedback on your self-assessment
          </div>
          <div className='text-[13px] leading-relaxed text-[#20456B]'>
            {form.feedback_text}
          </div>
        </div>
      )}

      {/* Submitted indicator, styled to the prototype's status panel. */}
      {form.submitted_at && (
        <div className='mb-5 flex items-center gap-3 rounded-[12px] border border-[#EAE5DB] bg-[#FAF8F4] px-[18px] py-3.5'>
          <span className='flex-1'>
            <span className='block text-[13px] font-semibold text-[#2C3444]'>
              Self-assessment submitted
            </span>
            <span className='mt-0.5 block text-[12.5px] leading-relaxed text-[#5A6070]'>
              You submitted on{' '}
              {new Date(form.submitted_at).toLocaleString(undefined, {
                day: 'numeric',
                month: 'short',
                year: 'numeric',
                hour: '2-digit',
                minute: '2-digit',
              })}
              . You can still update your answers and resubmit.
            </span>
          </span>
        </div>
      )}

      {/* 1. Checklist */}
      {form.use_checklist && form.checklist_items.length > 0 && (
        <Section
          index={++sectionIndex}
          title='Checklist'
          /* b-6: says plainly how this differs from the rubric below. */
          subtitle={
            <>
              <b>What &amp; why:</b> confirm you have addressed the key
              requirements. <b>How:</b> tick each item you believe you have
              completed.
            </>
          }
        >
          <div className='flex flex-col gap-2.5'>
            {form.checklist_items.map((item) => {
              const on = Boolean(checklist[String(item.id)])
              return (
                <label
                  key={item.id}
                  className='flex cursor-pointer items-start gap-2.5 rounded-[12px] border border-[#EBE7DD] px-3 py-2.5 transition-colors hover:border-[#E3DFD5] hover:bg-[#FAF8F4]'
                >
                  <input
                    type='checkbox'
                    checked={on}
                    onChange={(e) =>
                      setChecklist({ ...checklist, [String(item.id)]: e.target.checked })
                    }
                    className='mt-0.5 h-[15px] w-[15px] shrink-0 accent-[#1F4E79]'
                  />
                  <span>
                    <span className='block text-[13px] font-semibold text-[#131A26]'>
                      {item.name}
                    </span>
                    {item.description && (
                      <span className='mt-0.5 block text-xs leading-[1.45] text-[#5A6070]'>
                        {item.description}
                      </span>
                    )}
                  </span>
                </label>
              )
            })}
          </div>
        </Section>
      )}

      {/* 2. Rubric self-grading */}
      {form.use_rubric && form.rubric_items.length > 0 && (
        <Section
          index={++sectionIndex}
          title='Rubric-Based Self-Grading'
          /* b-15: her students did not know why they were grading themselves. */
          subtitle={
            <>
              <b>What &amp; why:</b> grade yourself against the same rubric your
              marker uses. <b>How:</b> select the level that best describes your
              work.
            </>
          }
        >
          <div className='flex flex-col gap-4'>
            {form.rubric_items.map((criterion) => (
              <div key={criterion.criteria_id}>
                <div className='mb-2 text-sm font-semibold text-[#131A26]'>
                  {criterion.name}
                </div>
                <div className='flex flex-col gap-[7px]'>
                  {criterion.levels.map((level) => {
                    const selected = rubric[String(criterion.criteria_id)] === level.id
                    return (
                      <button
                        key={level.id}
                        type='button'
                        onClick={() =>
                          setRubric({
                            ...rubric,
                            [String(criterion.criteria_id)]: level.id,
                          })
                        }
                        className={`flex items-start gap-2.5 border-[1.5px] p-3 text-left transition-colors ${
                          selected
                            ? 'rounded-[10px] border-[#131A26] bg-[#FAF6EE]'
                            : 'rounded-[12px] border-[#EAE5DB] bg-white hover:border-[#C6BFB0]'
                        }`}
                      >
                        {/* Radio indicator, matching the prototype's filled dot. */}
                        <span
                          className={`mt-0.5 h-[15px] w-[15px] shrink-0 rounded-full bg-white ${
                            selected
                              ? 'border-[4.5px] border-[#1F4E79]'
                              : 'border-[1.5px] border-[#C6BFB0]'
                          }`}
                        />
                        <span>
                          <span className='block text-[13px] font-semibold text-[#131A26]'>
                            {level.name}{' '}
                            <span className='font-normal text-[#5A6070]'>
                              ({level.marks} pts)
                            </span>
                          </span>
                          {level.description && (
                            <span className='mt-0.5 block text-xs leading-[1.45] text-[#5A6070]'>
                              {level.description}
                            </span>
                          )}
                        </span>
                      </button>
                    )
                  })}
                </div>
              </div>
            ))}
          </div>
        </Section>
      )}

      {/* 3. Guided reflection */}
      {form.use_reflection && form.reflection_prompts.length > 0 && (
        <Section
          index={++sectionIndex}
          title='Guided Reflection'
          /* b-12: an instruction line, since the purpose was unclear. */
          subtitle={
            <>
              <b>What &amp; why:</b> reflect on your learning using the Gibbs
              Reflective Cycle. <b>How:</b> write a short response for each stage.
            </>
          }
        >
          <div className='flex flex-col gap-3.5'>
            {form.reflection_prompts.map((prompt) => (
              <div key={prompt.stage}>
                <label
                  htmlFor={`reflect-${prompt.stage}`}
                  className='mb-[5px] block text-[13px] text-[#131A26]'
                >
                  <b>{prompt.label}:</b>{' '}
                  <span className='text-[#5A6070]'>{prompt.prompt_text}</span>
                </label>
                <textarea
                  id={`reflect-${prompt.stage}`}
                  rows={2}
                  value={reflection[prompt.stage] ?? ''}
                  onChange={(e) =>
                    setReflection({ ...reflection, [prompt.stage]: e.target.value })
                  }
                  className='w-full resize-y rounded-[9px] border border-[#DED8CA] bg-white px-3 py-2 text-[13px] leading-[1.55] text-[#131A26] outline-none focus:border-[#1F4E79]'
                />
              </div>
            ))}
          </div>
        </Section>
      )}

      <div className='flex items-center justify-end gap-2 pb-8'>
        <button
          type='button'
          onClick={submit}
          disabled={saving}
          className='rounded-[9px] bg-[#131A26] px-[18px] py-2.5 text-[13px] font-semibold text-white transition-colors hover:bg-[#243247] disabled:opacity-60'
        >
          Submit Self-Assessment
        </button>
      </div>
    </div>
  )
}
