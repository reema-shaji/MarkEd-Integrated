import { Eye, EyeOff } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { UserSchema } from '@/src/api'
import { cn } from '@/lib/utils'

interface MarkerControlsProps {
  reviewers: UserSchema[]
  visibleReviewers: Set<string>
  onToggleReviewer: (reviewerId: string) => void
}

export function MarkerControls({
  reviewers,
  visibleReviewers,
  onToggleReviewer,
}: MarkerControlsProps) {
  return (
    <div className='flex flex-wrap items-center gap-1.5'>
      {reviewers.map((reviewer) => {
        const isVisible = visibleReviewers.has(reviewer.userNumber)
        return (
          <Button
            key={reviewer.userNumber}
            variant={isVisible ? 'default' : 'outline'}
            size='sm'
            className={cn(
              'h-7 rounded-full px-2.5 py-0 text-xs transition-all',
              isVisible ? '' : 'text-muted-foreground'
            )}
            onClick={() => onToggleReviewer(reviewer.userNumber)}
          >
            {isVisible ? (
              <Eye className='mr-1 h-3 w-3' />
            ) : (
              <EyeOff className='mr-1 h-3 w-3' />
            )}
            <span>{reviewer.userName}</span>
          </Button>
        )
      })}
    </div>
  )
}
