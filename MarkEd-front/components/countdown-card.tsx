import React from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Progress } from '@/components/ui/progress'

interface TimeLeft {
  days: number
  hours: number
  minutes: number
  seconds: number
}

interface CountdownCardProps {
  title: string
  deadline: Date
  startDate?: Date
  showTimeZone?: boolean
  isActive?: boolean
}

export function formatTimeLeft(timeLeft: TimeLeft | null) {
  if (!timeLeft) return 'Deadline passed'
  return `${timeLeft.days}d ${timeLeft.hours}h ${timeLeft.minutes}m ${timeLeft.seconds}s`
}

export function calculateTimeLeft(targetDate: Date) {
  const now = new Date()
  const difference = targetDate.getTime() - now.getTime()

  if (difference <= 0) return null

  const days = Math.floor(difference / (1000 * 60 * 60 * 24))
  const hours = Math.floor(
    (difference % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60)
  )
  const minutes = Math.floor((difference % (1000 * 60 * 60)) / (1000 * 60))
  const seconds = Math.floor((difference % (1000 * 60)) / 1000)

  return { days, hours, minutes, seconds }
}

export function calculateProgress(startDate: Date, endDate: Date) {
  const now = new Date()
  const total = endDate.getTime() - startDate.getTime()
  const elapsed = now.getTime() - startDate.getTime()

  return Math.min(Math.max(Math.floor((elapsed / total) * 100), 0), 100)
}

export function CountdownCard({
  title,
  deadline,
  startDate,
  showTimeZone = true,
  isActive = true,
}: CountdownCardProps) {
  const [timeLeft, setTimeLeft] = React.useState(() =>
    calculateTimeLeft(deadline)
  )
  const [progress, setProgress] = React.useState(() =>
    startDate ? calculateProgress(startDate, deadline) : 0
  )

  React.useEffect(() => {
    const timer = setInterval(() => {
      setTimeLeft(calculateTimeLeft(deadline))
      if (startDate) {
        setProgress(calculateProgress(startDate, deadline))
      }
    }, 1000)

    return () => clearInterval(timer)
  }, [deadline, startDate])

  return (
    <Card className="bg-muted/10">
      <CardHeader className="pb-2">
        <CardTitle className="text-lg font-medium">{title}</CardTitle>
        {showTimeZone && (
          <p className="text-xs text-muted-foreground">
            All times shown in your local timezone (
            {Intl.DateTimeFormat().resolvedOptions().timeZone})
          </p>
        )}
      </CardHeader>
      <CardContent>
        <div
          className={`space-y-2 ${!timeLeft || !isActive ? 'opacity-75' : ''}`}>
          <p className="text-xl font-bold text-foreground">
            {isActive ? formatTimeLeft(timeLeft) : 'Not open'}
          </p>
          <Progress
            value={!timeLeft ? 100 : !isActive ? 0 : progress}
            className="h-2"
          />
          <p className="text-xs text-muted-foreground">
            Due: {deadline.toLocaleString()}
          </p>
        </div>
      </CardContent>
    </Card>
  )
}
