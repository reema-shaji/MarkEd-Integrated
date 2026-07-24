'use client'

/**
 * SPA login page.
 *
 * Auth is bearer-token, so the SPA can run on a different origin from the API
 * (Vercel + Render). This page posts to /api/auth/login, stores the returned
 * token, and enters the app.
 *
 * Demo quick-access: optional buttons that sign in as a seeded demo account.
 * They are NOT a shortcut — each runs the exact same token login as the form
 * (a real POST to /api/auth/login with the demo credentials). They are gated
 * behind NEXT_PUBLIC_SHOW_DEMO_LOGINS so a production deployment can hide them.
 */

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import Image from 'next/image'
import { DefaultService } from '@/src/api'
import { initializeApi, setToken } from '@/src/api/config'
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

initializeApi()

const basePath = process.env.NEXT_PUBLIC_BASE_PATH || ''

// Demo quick-access is shown unless explicitly disabled. The password comes
// from NEXT_PUBLIC_DEMO_PASSWORD (defaults to the local seed password); on a
// deployment with a private SEED_DEMO_PASSWORD, set this to match or disable
// the demo buttons entirely.
const SHOW_DEMO = process.env.NEXT_PUBLIC_SHOW_DEMO_LOGINS !== 'false'
const DEMO_PASSWORD = process.env.NEXT_PUBLIC_DEMO_PASSWORD || 'Test1234!'
const DEMO_ACCOUNTS = [
  { role: 'Academic', name: 'Dr Patel', userNumber: 'acad001' },
  { role: 'Marker', name: 'Dr Roberts', userNumber: 'mark001' },
  { role: 'Student', name: 'James Chen', userNumber: 'stud001' },
]

export default function LoginPage() {
  const router = useRouter()
  const [userNumber, setUserNumber] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [submitting, setSubmitting] = useState(false)

  /** The single login path — used by the form and by the demo buttons. */
  const doLogin = async (userNumberValue: string, passwordValue: string) => {
    setError(null)
    setSubmitting(true)
    try {
      const response = await DefaultService.apiLogin({
        userNumber: userNumberValue.trim(),
        password: passwordValue,
      })
      setToken(response.token)
      router.replace(
        response.must_change_password ? '/change-password' : '/assignments'
      )
    } catch (err) {
      const status = (err as { status?: number })?.status
      setError(
        status === 401
          ? 'Incorrect user number or password.'
          : status === 403
            ? 'This account is not active. Please contact your tutor.'
            : 'Could not sign in. Please try again.'
      )
    } finally {
      setSubmitting(false)
    }
  }

  const submit = (e: React.FormEvent) => {
    e.preventDefault()
    doLogin(userNumber, password)
  }

  return (
    <div className='flex min-h-screen items-center justify-center bg-neutral-100 p-6'>
      <Card className='w-full max-w-sm'>
        <CardHeader className='items-center text-center'>
          <Image
            src={`${basePath}/logo.png`}
            alt='MarkEd'
            width={40}
            height={40}
            className='mb-2'
          />
          <CardTitle className='text-xl'>Welcome to MarkEd</CardTitle>
          <CardDescription>Sign in to access your assignments</CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={submit} className='grid gap-4'>
            <div className='grid gap-1.5'>
              <Label htmlFor='userNumber'>User number</Label>
              <Input
                id='userNumber'
                value={userNumber}
                onChange={(e) => setUserNumber(e.target.value)}
                placeholder='e.g. acad001'
                autoComplete='username'
                required
              />
            </div>
            <div className='grid gap-1.5'>
              <Label htmlFor='password'>Password</Label>
              <Input
                id='password'
                type='password'
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                autoComplete='current-password'
                required
              />
            </div>
            {error && <p className='text-sm text-red-600'>{error}</p>}
            <Button type='submit' disabled={submitting || !userNumber || !password}>
              {submitting && <Loader2 className='mr-2 h-4 w-4 animate-spin' />}
              Log in
            </Button>
          </form>

          {SHOW_DEMO && (
            <div className='mt-6'>
              <div className='mb-3 flex items-center gap-3'>
                <div className='h-px flex-1 bg-neutral-200' />
                <span className='text-[11px] font-semibold uppercase tracking-wide text-neutral-400'>
                  Demo quick access
                </span>
                <div className='h-px flex-1 bg-neutral-200' />
              </div>
              <div className='grid gap-2'>
                {DEMO_ACCOUNTS.map((account) => (
                  <Button
                    key={account.userNumber}
                    type='button'
                    variant='outline'
                    disabled={submitting}
                    onClick={() => doLogin(account.userNumber, DEMO_PASSWORD)}
                    className='justify-start'
                  >
                    <span className='font-medium'>{account.role}</span>
                    <span className='ml-2 text-xs text-muted-foreground'>
                      {account.name}
                    </span>
                  </Button>
                ))}
              </div>
              <p className='mt-2 text-center text-[11px] text-neutral-400'>
                These sign in through the normal authenticated flow.
              </p>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  )
}
