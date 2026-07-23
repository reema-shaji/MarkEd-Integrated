import { HelpCircle } from 'lucide-react'
import Link from 'next/link'
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from './ui/tooltip'

const AboutAIFeedback = () => {
  return (
    <TooltipProvider>
      <Tooltip>
        <TooltipTrigger asChild>
          <Link
            href='/ai-feedback'
            className='inline-flex h-6 w-6 items-center justify-center rounded-full hover:bg-muted'
          >
            <HelpCircle className='h-3 w-3 text-muted-foreground hover:text-foreground' />
          </Link>
        </TooltipTrigger>
        <TooltipContent side='top'>
          <p>Learn more about AI Suggestions</p>
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  )
}

export default AboutAIFeedback
