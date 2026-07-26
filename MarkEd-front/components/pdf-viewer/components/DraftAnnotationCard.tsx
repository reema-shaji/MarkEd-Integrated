import { useKeyboardShortcut } from '@/components/keyboard-shortcuts'

type DraftAnnotation = {
  selectedText: string
  marginTextTop: string
  marginTextBottom: string
  position: { pageNumber: number; boundingRect: DOMRect }
  feedback?: string
}

interface DraftAnnotationCardProps {
  draftAnnotation: DraftAnnotation
  onDraftChange: (draft: DraftAnnotation) => void
  onDraftCancel: () => void
  onDraftSubmit: () => void
}

export function DraftAnnotationCard({
  draftAnnotation,
  onDraftChange,
  onDraftCancel,
  onDraftSubmit,
}: DraftAnnotationCardProps) {
  useKeyboardShortcut({ key: 'Enter', cmd: true }, onDraftSubmit)
  useKeyboardShortcut({ key: 'Escape' }, onDraftCancel)

  const maxCharacterLimit = 600
  const currentLength = draftAnnotation.feedback?.length || 0
  const canSubmit = !!draftAnnotation.feedback?.trim()

  return (
    <div className='rounded-[12px] border-2 border-[#C9A24A] bg-[#FBF4E3] p-[14px]'>
      <div className='mb-2 text-[13px] font-semibold text-ink'>Add Comment</div>

      {draftAnnotation.selectedText && (
        <div className='mb-2 rounded-[4px] bg-[#F8EFDC] px-2 py-[5px] text-[11px] italic leading-[1.45] text-[#8A5D14]'>
          Anchored to: &ldquo;{draftAnnotation.selectedText}&rdquo;
        </div>
      )}

      <textarea
        autoFocus
        rows={3}
        value={draftAnnotation.feedback || ''}
        placeholder='Enter your feedback…'
        onChange={(e) => {
          const value = e.target.value
          if (value.length <= maxCharacterLimit) {
            onDraftChange({ ...draftAnnotation, feedback: value })
          }
        }}
        className='w-full resize-none rounded-[9px] border border-[#D3CDBF] bg-white p-2.5 text-[13px] leading-[1.5] text-ink placeholder:text-faint focus:border-royal focus:outline-none'
      />

      <div className='mt-2 flex items-center justify-between'>
        <span className='font-mono text-[11px] text-faint'>
          {currentLength}/{maxCharacterLimit}
        </span>
        <span className='flex gap-1.5'>
          <button
            type='button'
            onClick={onDraftCancel}
            title='Esc'
            className='rounded-[9px] border border-[#DED8CA] bg-white px-3 py-[5px] text-[11px] font-medium text-[#454C5C] hover:bg-warm-100'
          >
            Cancel
          </button>
          <button
            type='button'
            onClick={onDraftSubmit}
            disabled={!canSubmit}
            title='⌘ + Enter'
            className='rounded-[9px] bg-ink px-3 py-[5px] text-[11px] font-medium text-white hover:bg-ink-hover disabled:opacity-50'
          >
            Submit
          </button>
        </span>
      </div>
    </div>
  )
}
