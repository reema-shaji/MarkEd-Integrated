'use client'

import { useState } from 'react'
import { Card, CardContent } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { toast } from 'sonner'
import { Copy, Check } from 'lucide-react'

const FAQS = [
  {
    question: 'Who reviews my work?',
    answer:
      'Peer reviewers are allocated automatically and anonymously. For group assignments, reviewers always come from other groups.',
  },
  {
    question: 'What are the AI suggestions?',
    answer:
      'After you save a comment, an AI reviews it and may suggest improvements. You must resolve each suggestion — by incorporating it or dismissing it with a reason — before completing your review.',
  },
  {
    question: 'What is the difference between uploading and submitting?',
    answer:
      'Uploading a file to the group workspace shares it with your group. Only when the group leader confirms a submission is it recorded as a submission version.',
  },
]

export default function SupportPage() {
  const supportEmail = process.env.NEXT_PUBLIC_SUPPORT_EMAIL
  const [copied, setCopied] = useState(false)

  const copyEmail = () => {
    if (supportEmail) {
      navigator.clipboard.writeText(supportEmail)
      setCopied(true)
      toast.success('Email copied to clipboard', {
        description: 'You can now paste the support email address',
      })
      setTimeout(() => setCopied(false), 2000)
    } else {
      toast.error('Support email not found')
    }
  }

  return (
    <div className='mx-auto w-full max-w-2xl p-6'>
      <h1 className='mb-5 text-2xl font-bold text-neutral-900'>Support</h1>
      <Card>
        <CardContent className='flex flex-col gap-4 p-6'>
          {FAQS.map((faq) => (
            <div key={faq.question}>
              <div className='mb-1 text-sm font-semibold text-neutral-900'>
                {faq.question}
              </div>
              <div className='text-[13px] leading-[1.55] text-neutral-500'>
                {faq.answer}
              </div>
            </div>
          ))}

          <div>
            <div className='mb-1 text-sm font-semibold text-neutral-900'>
              Contact
            </div>
            <div className='flex items-center gap-2 text-[13px] leading-[1.55] text-neutral-500'>
              <span>
                Email the course team:{' '}
                {supportEmail ? (
                  <a
                    href={`mailto:${supportEmail}`}
                    className='font-medium text-neutral-900 underline underline-offset-2 hover:text-neutral-700'
                  >
                    {supportEmail}
                  </a>
                ) : (
                  <span className='italic'>not configured</span>
                )}
              </span>
              {supportEmail && (
                <Button
                  variant='outline'
                  size='icon'
                  className='h-7 w-7 shrink-0'
                  onClick={copyEmail}
                  aria-label='Copy support email'
                >
                  {copied ? (
                    <Check className='h-3.5 w-3.5' />
                  ) : (
                    <Copy className='h-3.5 w-3.5' />
                  )}
                </Button>
              )}
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
