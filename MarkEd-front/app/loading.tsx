/**
 * Route-level loading fallback. Next.js renders this instantly during every
 * navigation (before the target page mounts or fetches), so the content area
 * shows a structured skeleton on the paper background instead of flashing
 * blank. Individual pages still render their own layout-matched skeletons once
 * mounted; this bridges the navigation gap.
 *
 * Server component — plain markup only, no hooks.
 */
export default function Loading() {
  return (
    <div className='mx-auto w-full max-w-[1200px] animate-pulse px-7 pb-12 pt-8'>
      {/* Header card */}
      <div className='mb-5 h-24 rounded-[14px] border border-line-card bg-white' />

      {/* Stat / summary row */}
      <div className='mb-5 grid grid-cols-1 gap-4 sm:grid-cols-2'>
        <div className='h-28 rounded-[14px] border border-line-card bg-white' />
        <div className='h-28 rounded-[14px] border border-line-card bg-white' />
      </div>

      {/* List card */}
      <div className='overflow-hidden rounded-[14px] border border-line-card bg-white'>
        <div className='border-b border-line-soft px-5 py-4'>
          <div className='h-4 w-40 rounded bg-[#EFEBE2]' />
        </div>
        {[0, 1, 2, 3].map((i) => (
          <div
            key={i}
            className='flex items-center gap-3 border-b border-line-soft px-5 py-4 last:border-b-0'
          >
            <div className='flex-1'>
              <div className='mb-2 h-4 w-52 rounded bg-[#EFEBE2]' />
              <div className='h-3 w-36 rounded bg-[#F0ECE4]' />
            </div>
            <div className='h-5 w-16 rounded-md bg-[#F0ECE4]' />
            <div className='h-8 w-20 rounded-[9px] bg-[#EFEBE2]' />
          </div>
        ))}
      </div>
    </div>
  )
}
