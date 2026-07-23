/**
 * v0 by Vercel.
 * @see https://v0.dev/t/VcXvHuj2Ece
 * Documentation: https://v0.dev/docs#integrating-generated-code-into-your-nextjs-app
 */
import {
  TooltipProvider,
  Tooltip,
  TooltipTrigger,
  TooltipContent,
} from '@/components/ui/tooltip'
import { Button } from '@/components/ui/button'

export default function Help({ children }: { children: React.ReactNode }) {
  return (
    <div className='relative inline-block'>
      <TooltipProvider>
        <Tooltip>
          <TooltipTrigger asChild>
            <Button
              variant='ghost'
              size='icon'
              className='h-5 w-5 translate-y-[0.5px] rounded-full'
            >
              <InfoIcon className='h-5 w-5' />
              <span className='sr-only'>Help</span>
            </Button>
          </TooltipTrigger>
          <TooltipContent className='max-w-xs'>{children}</TooltipContent>
        </Tooltip>
      </TooltipProvider>
    </div>
  )
}

function InfoIcon(props: React.SVGProps<SVGSVGElement>) {
  return (
    <svg
      {...props}
      xmlns='http://www.w3.org/2000/svg'
      width='24'
      height='24'
      viewBox='0 0 24 24'
      fill='none'
      stroke='currentColor'
      strokeWidth='2'
      strokeLinecap='round'
      strokeLinejoin='round'
    >
      <circle cx='12' cy='12' r='10' />
      <path d='M12 16v-4' />
      <path d='M12 8h.01' />
    </svg>
  )
}
