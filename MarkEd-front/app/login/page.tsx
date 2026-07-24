'use client'

/**
 * SPA login page.
 *
 * The source build authenticated through Django's server-rendered /login/ form
 * (session cookie). The unified build uses bearer tokens so the SPA can run on
 * a different origin from the API (Vercel + Render), matching the earlier
 * unified build's deployment. This page posts to /api/auth/login, stores the
 * returned token, and enters the app.
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

export default function LoginPage() {
  const router = useRouter()
  const [userNumber, setUserNumber] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [submitting, setSubmitting] = useState(false)

  const submit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError(null)
    setSubmitting(true)
    try {
      const response = await DefaultService.apiLogin({
        userNumber: userNumber.trim(),
        password,
      })
      setToken(response.token)
      // First login forces a password change (Tomas's must_change_password).
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

  return (
    <div className='flex min-h-screen items-center justify-center bg-neutral-100 p-6'>
      <Card className='w-full max-w-sm'>
        <CardHeader className='items-center text-center'>
          <Image
            src='/p/logo.png'
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
        </CardContent>
      </Card>
    </div>
  )
}
