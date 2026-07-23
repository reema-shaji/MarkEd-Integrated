// app/page.tsx
'use client'
import { initializeApi } from '@/src/api/config'
import {
  Card,
  CardHeader,
  CardTitle,
  CardDescription,
} from '@/components/ui/card'

initializeApi()

export default function Page() {
  return (
    <div className='container'>
      <div className='flex h-screen flex-col items-center justify-center gap-4'>
        <Card>
          <CardHeader>
            <CardTitle>Welcome to MarkEd</CardTitle>
            <CardDescription>
              MarkEd is a tool that helps you evaluate your students&apos;
              essays. <br />
              Select an assignment to get started.
            </CardDescription>
          </CardHeader>
        </Card>
      </div>
    </div>
  )
}
