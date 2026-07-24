'use client'

/**
 * Change-password page. Reached on first login (Tomas's must_change_password,
 * PF-12) or from account settings. A password change revokes all tokens
 * server-side, so afterwards the user is sent back to log in.
 */

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { DefaultService } from '@/src/api'
import { clearToken, initializeApi } from '@/src/api/config'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card'
import { Loader2 } from 'lucide-react'
import { toast } from 'sonner'

initializeApi()

export default function ChangePasswordPage() {
  const router = useRouter()
  const [current, setCurrent] = useState('')
  const [next, setNext] = useState('')
  const [confirm, setConfirm] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [submitting, setSubmitting] = useState(false)

  const submit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError(null)
    if (next.length < 8) return setError('New password must be at least 8 characters.')
    if (next !== confirm) return setError('The new passwords do not match.')

    setSubmitting(true)
    try {
      await DefaultService.apiChangePassword({
        current_password: current,
        new_password: next,
      })
      // The change revoked every token, so send the user back to log in.
      clearToken()
      toast.success('Password updated. Please log in again.')
      router.replace('/login')
    } catch (err) {
      const status = (err as { status?: number })?.status
      setError(
        status === 400
          ? 'Your current password is incorrect.'
          : 'Could not update your password. Please try again.'
      )
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <div className='flex min-h-screen items-center justify-center bg-neutral-100 p-6'>
      <Card className='w-full max-w-md'>
        <CardHeader>
          <CardTitle className='text-xl font-bold'>Change your password</CardTitle>
          <CardDescription>
            This is your first login. You must set a new password before
            continuing.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={submit} className='grid gap-4'>
            <div className='grid gap-1.5'>
              <Label htmlFor='current'>Current password</Label>
              <Input
                id='current'
                type='password'
                value={current}
                onChange={(e) => setCurrent(e.target.value)}
                autoComplete='current-password'
                required
              />
            </div>
            <div className='grid gap-1.5'>
              <Label htmlFor='next'>New password</Label>
              <Input
                id='next'
                type='password'
                value={next}
                onChange={(e) => setNext(e.target.value)}
                autoComplete='new-password'
                required
              />
              <p className='text-xs text-neutral-400'>
                At least 8 characters. Avoid common or previously breached
                passwords.
              </p>
            </div>
            <div className='grid gap-1.5'>
              <Label htmlFor='confirm'>Confirm new password</Label>
              <Input
                id='confirm'
                type='password'
                value={confirm}
                onChange={(e) => setConfirm(e.target.value)}
                autoComplete='new-password'
                required
              />
            </div>
            {error && <p className='text-sm text-red-600'>{error}</p>}
            <Button type='submit' disabled={submitting}>
              {submitting && <Loader2 className='mr-2 h-4 w-4 animate-spin' />}
              Change Password & Continue
            </Button>
          </form>
        </CardContent>
      </Card>
    </div>
  )
}
