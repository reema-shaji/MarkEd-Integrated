'use client'

import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import BackButton from '@/components/back-button'
import { Bot, MessageCircle, Zap } from 'lucide-react'
import Link from 'next/link'

export default function AIFeedbackPage() {
  return (
    <div className='container mx-auto max-w-screen-md py-10'>
      <BackButton />
      <Card>
        <CardHeader>
          <CardTitle className='flex items-center gap-2'>
            <Bot className='h-5 w-5' />
            AI Suggestions
          </CardTitle>
        </CardHeader>
        <CardContent className='space-y-8'>
          <div>
            <p className='text-muted-foreground'>
              At MarkEd, we are exploring the use of{' '}
              <Link
                href='https://en.wikipedia.org/wiki/Large_language_model'
                className='underline'
              >
                Large Language Models (LLMs)
              </Link>{' '}
              to help you provide more effective feedback to your peers while
              enhancing your own feedback skills.
            </p>
          </div>

          <div>
            <h3 className='mb-2 text-lg font-semibold'>How It Works</h3>
            <p className='text-muted-foreground'>
              When you submit a peer review comment, your feedback is
              automatically evaluated for its effectiveness across several
              dimensions:
            </p>
            <ul className='my-4 ml-4 list-inside list-disc space-y-1 text-muted-foreground'>
              <li>Structure and clarity of the feedback</li>
              <li>Specificity and actionability of suggestions</li>
              <li>Professional and constructive tone</li>
              <li>Overall helpfulness</li>
              <li>... and many more key factors</li>
            </ul>
            <p className='text-muted-foreground'>
              Your feedback will not be assessed for its correctness.
            </p>
          </div>

          <div className='grid gap-6 md:grid-cols-2'>
            <Card>
              <CardContent className='pt-6'>
                <div className='mb-4 flex items-center gap-2'>
                  <MessageCircle className='h-5 w-5 text-primary' />
                  <h4 className='font-semibold'>Actionable Tips</h4>
                </div>
                <p className='text-sm text-muted-foreground'>
                  You&apos;ll receive specific suggestions to refine your
                  feedback and maximise its impact on learning outcomes.
                </p>
              </CardContent>
            </Card>

            <Card>
              <CardContent className='pt-6'>
                <div className='mb-4 flex items-center gap-2'>
                  <Zap className='h-5 w-5 text-primary' />
                  <h4 className='font-semibold'>Real-time Analysis</h4>
                </div>
                <p className='text-sm text-muted-foreground'>
                  AI Suggestions may appear in an semi-asynchronous manner. You
                  can dismiss these suggestions at any time.
                </p>
              </CardContent>
            </Card>
          </div>
          <div className='mt-6'>
            <div className='mb-4'>
              <h3 className='text-lg font-semibold'>Privacy & Usage</h3>
              <p className='mt-2 text-muted-foreground'>
                AI Suggestions analyse only the structure and effectiveness of
                your feedback, not its specific content or correctness. You can
                dismiss AI Suggestions at any time, and they are visible only to
                you. Consider that AI Suggestions could be wrong.
              </p>
            </div>

            <div>
              <p className='text-muted-foreground'>
                AI Suggestions are powered by The University of Edinburgh&apos;s{' '}
                <a
                  href='https://information-services.ed.ac.uk/computing/comms-and-collab/elm'
                  className='underline'
                >
                  ELM
                </a>
                , ensuring that no data is retained for training other models.
                MarkEd stores your interactions with AI Suggestions solely to
                improve the user experience and to allow you to revisit your
                suggestions after logging out.
              </p>
            </div>
          </div>

          <div className='text-muted-foreground text-center'>
            Any other questions? Reach out to{' '}
            <Link href='/support' className='underline'>
              support
            </Link>
            .
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
