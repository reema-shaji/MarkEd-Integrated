import { Tooltip } from './ui/tooltip'
import { TooltipTrigger } from './ui/tooltip'
import { TooltipContent } from './ui/tooltip'
import { CheckCircle2, Circle, Clock } from 'lucide-react'

export const StatusDot = ({
  status,
}: {
  status: 'COMPLETED' | 'IN_PROGRESS' | 'PENDING'
}) => {
  return (
    <Tooltip>
      {/* asChild: render the span as the trigger, not a nested <button> — the
          status dot is often placed inside another button (e.g. a tab). */}
      <TooltipTrigger asChild>
        <span
          className={`flex items-center ${
            status === 'COMPLETED'
              ? 'text-green-700'
              : status === 'IN_PROGRESS'
                ? 'text-yellow-700'
                : 'text-gray-700'
          }`}
        >
          {status === 'COMPLETED' ? (
            <CheckCircle2 size={16} />
          ) : status === 'IN_PROGRESS' ? (
            <Clock size={16} />
          ) : (
            <Circle size={16} />
          )}
        </span>
      </TooltipTrigger>
      <TooltipContent>
        {status.replace('_', ' ').toLowerCase().charAt(0).toUpperCase() +
          status.replace('_', ' ').toLowerCase().slice(1)}
      </TooltipContent>
    </Tooltip>
  )
}
