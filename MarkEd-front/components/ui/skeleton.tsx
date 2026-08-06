import { cn } from '@/lib/utils'

function Skeleton({
  className,
  ...props
}: React.HTMLAttributes<HTMLDivElement>) {
  return (
    <div
      className={cn(
        // Moving-gradient shimmer (warm paper palette) rather than a pulse.
        'animate-shimmer rounded-md bg-[length:200%_100%] bg-[linear-gradient(90deg,#ECE8DF_25%,#F7F5F0_50%,#ECE8DF_75%)]',
        className
      )}
      {...props}
    />
  )
}

export { Skeleton }
