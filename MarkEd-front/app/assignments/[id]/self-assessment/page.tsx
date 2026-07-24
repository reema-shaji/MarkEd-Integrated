'use client'

/**
 * Student self-assessment form — ported from Mingyue's student/self_assessment.html.
 *
 * Her three sections in her order: checklist, rubric self-grading, Gibbs
 * reflection. Sections are collapsible and expanded by default, the iteration-2
 * change that improved cognitive load and helped earn SUS 93.75.
 *
 * Carries over the low-effort fixes her evaluation motivated (Unified PRD §9):
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
import { Checkbox } from '@/components/ui/checkbox'
import { Label } from '@/components/ui/label'
import { Badge } from '@/components/ui/badge'
import { Skeleton } from '@/components/ui/skeleton'
import { Textarea } from '@/components/ui/textarea'
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from '@/components/ui/collapsible'
import { CalendarClock, Check, ChevronDown, ClipboardCheck } from 'lucide-react'
import { toast } from 'sonner'

function Section({
  title,
  subtitle,
  children,
}: {
  title: string
  subtitle: string
  children: React.ReactNode
}) {
  return (
    <Collapsible defaultOpen className='group/section'>
      <Card>
        <CollapsibleTrigger className='w-full text-left'>
          <CardHeader className='pb-3'>
            <div className='flex items-start justify-between gap-3'>
              <div>
                <CardTitle className='text-base'>{title}</CardTitle>
                {/* Chevron signals the section is collapsible (b-5). */}
                <p className='mt-1 text-sm font-normal text-muted-foreground'>
                  {subtitle}
                </p>
              </div>
              <ChevronDown className='mt-1 h-4 w-4 shrink-0 text-muted-foreground transition-transform group-data-[state=closed]/section:-rotate-90' />
            </div>
          </CardHeader>
        </CollapsibleTrigger>
        <CollapsibleContent>
          <CardContent>{children}</CardContent>
        </CollapsibleContent>
      </Card>
    </Collapsible>
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

  return (
    <div className='mx-auto w-full max-w-3xl p-6'>
      <div className='mb-5'>
        <h1 className='flex items-center gap-2 text-2xl font-bold'>
          <ClipboardCheck className='h-6 w-6' />
          Self-assessment
        </h1>
        {/* b-8: students confused self-assessment with marker feedback. */}
        <p className='mt-1 text-sm text-muted-foreground'>
          This is your own reflection on your work. It is not your mark — your
          marker sees it alongside your submission.
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
      </div>

      <div className='grid gap-4'>
        {/* 1. Checklist */}
        {form.use_checklist && form.checklist_items.length > 0 && (
          <Section
            title='Checklist'
            /* b-6: says plainly how this differs from the rubric below. */
            subtitle={`Tick off what you have actually done. ${checkedCount} of ${form.checklist_items.length} ticked.`}
          >
            <div className='grid gap-3'>
              {form.checklist_items.map((item) => (
                <div key={item.id} className='flex items-start gap-3'>
                  <Checkbox
                    id={`check-${item.id}`}
                    checked={Boolean(checklist[String(item.id)])}
                    onCheckedChange={(value) =>
                      setChecklist({ ...checklist, [String(item.id)]: value === true })
                    }
                    className='mt-0.5'
                  />
                  <div>
                    <Label
                      htmlFor={`check-${item.id}`}
                      className='cursor-pointer font-normal'
                    >
                      {item.name}
                    </Label>
                    {item.description && (
                      <p className='mt-0.5 text-xs text-muted-foreground'>
                        {item.description}
                      </p>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </Section>
        )}

        {/* 2. Rubric self-grading */}
        {form.use_rubric && form.rubric_items.length > 0 && (
          <Section
            title='Rubric self-grading'
            /* b-15: her students did not know why they were grading themselves. */
            subtitle='Judge your own work against the same criteria your marker will use. Comparing your view with theirs is where most of the learning happens.'
          >
            <div className='grid gap-5'>
              {form.rubric_items.map((criterion) => (
                <div key={criterion.criteria_id}>
                  <div className='mb-2'>
                    <div className='text-sm font-medium'>{criterion.name}</div>
                    {criterion.full_path !== criterion.name && (
                      <div className='text-xs text-muted-foreground'>
                        {criterion.full_path}
                      </div>
                    )}
                  </div>
                  <div className='grid gap-2'>
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
                          className={`rounded-md border p-3 text-left text-sm transition-colors ${
                            selected
                              ? 'border-neutral-800 bg-neutral-50'
                              : 'hover:border-neutral-400'
                          }`}
                        >
                          <div className='flex items-center justify-between gap-3'>
                            <span className='font-medium'>{level.name}</span>
                            <span className='shrink-0 text-xs text-muted-foreground'>
                              {level.marks} marks
                            </span>
                          </div>
                          {level.description && (
                            <p className='mt-1 text-xs text-muted-foreground'>
                              {level.description}
                            </p>
                          )}
                        </button>
                      )
                    })}
                  </div>
                </div>
              ))}
            </div>
          </Section>
        )}

        {/* 3. Gibbs reflection */}
        {form.use_reflection && form.reflection_prompts.length > 0 && (
          <Section
            title='Reflection'
            /* b-12: an instruction line, since the purpose was unclear. */
            subtitle="These follow Gibbs' reflective cycle. Answer in a few sentences each — there are no right answers, and your marker reads them to understand how you worked."
          >
            <div className='grid gap-5'>
              {form.reflection_prompts.map((prompt) => (
                <div key={prompt.stage}>
                  <Label
                    htmlFor={`reflect-${prompt.stage}`}
                    className='text-sm font-medium'
                  >
                    {prompt.label}
                  </Label>
                  <p className='mb-1.5 mt-0.5 text-xs text-muted-foreground'>
                    {prompt.prompt_text}
                  </p>
                  <Textarea
                    id={`reflect-${prompt.stage}`}
                    rows={4}
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
          {form.submitted_at ? 'Submit again' : 'Submit self-assessment'}
        </Button>
      </div>
    </div>
  )
}
