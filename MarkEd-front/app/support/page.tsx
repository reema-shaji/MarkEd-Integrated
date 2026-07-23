'use client'

import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { toast } from 'sonner'
import { Copy, Check } from 'lucide-react'
import BackButton from '@/components/back-button'
import { useState } from 'react'

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
    <div className='container mx-auto max-w-screen-md py-10'>
      <BackButton />
      <Card>
        <CardHeader>
          <CardTitle>Support</CardTitle>
        </CardHeader>
        <CardContent className='space-y-6'>
          <div>
            <p className='text-muted-foreground'>
              MarkEd is currently in beta prototype, which means you might
              encounter some unexpected behavior or issues. We&apos;re working
              hard to improve the platform and appreciate your patience and
              feedback during this phase.
            </p>
          </div>

          <div>
            <h3 className='mb-2 text-lg font-semibold'>Need Help?</h3>
            <p className='mb-4 text-muted-foreground'>
              If you encounter any issues, have questions, or would like to
              provide feedback, please don&apos;t hesitate to reach out.
            </p>

            <div className='flex items-center gap-2'>
              <span className='rounded-lg bg-secondary px-3 py-2 text-secondary-foreground'>
                {supportEmail}
              </span>
              <Button variant='outline' size='icon' onClick={copyEmail}>
                {copied ? (
                  <Check className='h-4 w-4' />
                ) : (
                  <Copy className='h-4 w-4' />
                )}
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
