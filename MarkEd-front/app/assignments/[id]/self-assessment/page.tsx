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
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Label } from '@/components/ui/label'
import { Badge } from '@/components/ui/badge'
import { Skeleton } from '@/components/ui/skeleton'
import { Textarea } from '@/components/ui/textarea'
import { CalendarClock, Check } from 'lucide-react'
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
    <Card>
      <CardHeader className='pb-3'>
        <CardTitle className='text-base'>
          {index} · {title}
        </CardTitle>
        <p className='text-[13px] font-normal leading-relaxed text-neutral-500'>
          {subtitle}
        </p>
      </CardHeader>
      <CardContent>{children}</CardContent>
    </Card>
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
      <div className='mx-auto w-full max-w-3xl p-6'>
        <Skeleton className='h-9 w-72' />
        <div className='mt-6 grid gap-4'>
          <Skeleton className='h-48' />
          <Skeleton className='h-48' />
        </div>
      </div>
    )
  }

  if (unavailable || !form) {
    return (
      <div className='mx-auto w-full max-w-3xl p-6'>
        <Card>
          <CardContent className='py-14 text-center text-sm text-muted-foreground'>
            {unavailable}
          </CardContent>
        </Card>
      </div>
    )
  }

  const checkedCount = Object.values(checklist).filter(Boolean).length

  // Section numbers stay contiguous even when some sections are disabled.
  let sectionIndex = 0

  return (
    <div className='mx-auto w-full max-w-3xl p-6'>
      {/* Breadcrumb + title, per the prototype header. */}
      <div className='mb-1 text-[13px] text-neutral-400'>Self-Assessment</div>
      <h1 className='text-2xl font-bold'>Self-Assessment</h1>
      {/* b-8: students confused self-assessment with marker feedback. */}
      <p className='mt-1.5 text-[13px] leading-relaxed text-neutral-500'>
        Your <b>self-assessment</b> is your own evaluation of your work. It is
        not your mark — your marker sees it alongside your submission and may
        respond with <b>feedback</b> on what you wrote.
      </p>

      <div className='mt-3 flex flex-wrap items-center gap-3 text-xs text-muted-foreground'>
        {form.deadline && (
          <span className='flex items-center gap-1'>
            <CalendarClock className='h-3.5 w-3.5' />
            {/* b-4: labelled in full. */}
            Self-Assessment Deadline:{' '}
            {new Date(form.deadline).toLocaleString(undefined, {
              day: 'numeric',
              month: 'short',
              year: 'numeric',
              hour: '2-digit',
              minute: '2-digit',
            })}
          </span>
        )}
        {form.is_late && <Badge variant='secondary'>Deadline passed</Badge>}
        {form.submitted_at && (
          <Badge variant='outline'>
            <Check className='mr-1 h-3 w-3' />
            Last submitted{' '}
            {new Date(form.submitted_at).toLocaleDateString(undefined, {
              day: 'numeric',
              month: 'short',
            })}
          </Badge>
        )}
      </div>

      <div className='mt-5 grid gap-4'>
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
                completed. <span className='text-neutral-400'>({checkedCount} of {form.checklist_items.length} ticked)</span>
              </>
            }
          >
            <div className='flex flex-col gap-2.5'>
              {form.checklist_items.map((item) => {
                const on = Boolean(checklist[String(item.id)])
                return (
                  <label
                    key={item.id}
                    className='flex cursor-pointer items-start gap-2.5 rounded-lg border border-neutral-100 px-3 py-2.5 transition-colors hover:border-neutral-200 hover:bg-neutral-50'
                  >
                    <input
                      type='checkbox'
                      checked={on}
                      onChange={(e) =>
                        setChecklist({ ...checklist, [String(item.id)]: e.target.checked })
                      }
                      className='mt-0.5 h-[15px] w-[15px] shrink-0 accent-neutral-900'
                    />
                    <span>
                      <span className='block text-[13px] font-semibold'>
                        {item.name}
                      </span>
                      {item.description && (
                        <span className='mt-0.5 block text-xs leading-relaxed text-neutral-500'>
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
                <b>What &amp; why:</b> grade yourself against the same rubric
                your marker uses — comparing your view with theirs is where most
                of the learning happens. <b>How:</b> select the level that best
                describes your work.
              </>
            }
          >
            <div className='flex flex-col gap-4'>
              {form.rubric_items.map((criterion) => (
                <div key={criterion.criteria_id}>
                  <div className='mb-2'>
                    <div className='text-sm font-semibold'>{criterion.name}</div>
                    {criterion.full_path !== criterion.name && (
                      <div className='text-xs text-neutral-500'>
                        {criterion.full_path}
                      </div>
                    )}
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
                          className={`flex items-start gap-2.5 rounded-lg border p-3 text-left transition-colors ${
                            selected
                              ? 'border-[1.5px] border-neutral-900 bg-neutral-50'
                              : 'border-neutral-200 hover:border-neutral-400'
                          }`}
                        >
                          {/* Radio indicator, matching the prototype's filled dot. */}
                          <span
                            className={`mt-0.5 h-3.5 w-3.5 shrink-0 rounded-full bg-white ${
                              selected
                                ? 'border-[4.5px] border-neutral-900'
                                : 'border-[1.5px] border-neutral-300'
                            }`}
                          />
                          <span>
                            <span className='block text-[13px] font-semibold'>
                              {level.name}{' '}
                              <span className='font-normal text-neutral-500'>
                                ({level.marks} marks)
                              </span>
                            </span>
                            {level.description && (
                              <span className='mt-0.5 block text-xs leading-relaxed text-neutral-500'>
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
                Reflective Cycle — there are no right answers. <b>How:</b> write
                a short response for each stage.
              </>
            }
          >
            <div className='flex flex-col gap-3.5'>
              {form.reflection_prompts.map((prompt) => (
                <div key={prompt.stage}>
                  <Label
                    htmlFor={`reflect-${prompt.stage}`}
                    className='mb-1.5 block text-[13px] font-normal'
                  >
                    <b>{prompt.label}:</b>{' '}
                    <span className='text-neutral-500'>{prompt.prompt_text}</span>
                  </Label>
                  <Textarea
                    id={`reflect-${prompt.stage}`}
                    rows={3}
                    value={reflection[prompt.stage] ?? ''}
                    onChange={(e) =>
                      setReflection({ ...reflection, [prompt.stage]: e.target.value })
                    }
                  />
                </div>
              ))}
            </div>
          </Section>
        )}
      </div>

      <div className='sticky bottom-0 mt-4 flex items-center justify-end gap-3 border-t bg-neutral-100/95 py-3 backdrop-blur'>
        {form.is_late && (
          <span className='text-xs text-muted-foreground'>
            The deadline has passed — this will be recorded as late.
          </span>
        )}
        <Button onClick={submit} disabled={saving}>
          {form.submitted_at ? 'Submit again' : 'Submit Self-Assessment'}
        </Button>
      </div>
    </div>
  )
}
