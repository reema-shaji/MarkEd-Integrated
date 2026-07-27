'use client'

import * as React from 'react'
import { DefaultService, FeedbackBankSchema } from '@/src/api'
import { Dialog, DialogContent } from '@/components/ui/dialog'
import {
  CornerDownLeft,
  Loader2,
  Plus,
  Star,
  ThumbsDown,
  ThumbsUp,
  Trash2,
  X,
} from 'lucide-react'
import { toast } from 'sonner'

type FeedbackBankDialogProps = {
  open: boolean
  onOpenChange: (open: boolean) => void
  // Scopes the shared bank to the assignment's course and attaches new entries
  // to it. Optional so the dialog still works without a marking context.
  assignmentId?: number
}

type SortKey = 'recent' | 'likes' | 'used'

// Track the last text field the marker was editing *outside* the dialog, so
// "Apply" can drop a snippet straight into it — the original bank's insert-into
// -the-element behaviour, adapted to the unified per-comment feedback fields.
let lastField: HTMLTextAreaElement | HTMLInputElement | null = null
if (typeof document !== 'undefined') {
  document.addEventListener('focusin', (e) => {
    const t = e.target as HTMLElement
    const editable =
      t instanceof HTMLTextAreaElement ||
      (t instanceof HTMLInputElement && (t.type === 'text' || t.type === ''))
    if (editable && !t.closest('[role="dialog"]')) {
      lastField = t as HTMLTextAreaElement | HTMLInputElement
    }
  })
}

function insertIntoLastField(text: string): boolean {
  const el = lastField
  if (!el || !document.contains(el)) return false
  const start = el.selectionStart ?? el.value.length
  const end = el.selectionEnd ?? el.value.length
  const sep = start > 0 && !/\s$/.test(el.value.slice(0, start)) ? ' ' : ''
  const next = el.value.slice(0, start) + sep + text + el.value.slice(end)
  // Use the native setter so React's controlled onChange picks the value up.
  const proto =
    el instanceof HTMLTextAreaElement
      ? HTMLTextAreaElement.prototype
      : HTMLInputElement.prototype
  const setter = Object.getOwnPropertyDescriptor(proto, 'value')?.set
  setter?.call(el, next)
  el.dispatchEvent(new Event('input', { bubbles: true }))
  const caret = start + sep.length + text.length
  el.focus()
  el.setSelectionRange?.(caret, caret)
  return true
}

export function FeedbackBankDialog({
  open,
  onOpenChange,
  assignmentId,
}: FeedbackBankDialogProps) {
  const [entries, setEntries] = React.useState<FeedbackBankSchema[]>([])
  const [isLoading, setIsLoading] = React.useState(true)
  const [search, setSearch] = React.useState('')
  const [activeCategory, setActiveCategory] = React.useState<string>('All')
  const [sort, setSort] = React.useState<SortKey>('recent')
  const [favouritesOnly, setFavouritesOnly] = React.useState(false)

  const [showForm, setShowForm] = React.useState(false)
  const [newText, setNewText] = React.useState('')
  const [newCategory, setNewCategory] = React.useState('')
  const [isSaving, setIsSaving] = React.useState(false)

  const loadEntries = React.useCallback(async () => {
    setIsLoading(true)
    try {
      const data = await DefaultService.listFeedbackBank(
        assignmentId ?? null,
        null,
        null,
        sort,
        favouritesOnly
      )
      setEntries(data)
    } catch (error) {
      console.error('Failed to load feedback bank:', error)
      toast.error('Failed to load feedback bank')
    } finally {
      setIsLoading(false)
    }
  }, [assignmentId, sort, favouritesOnly])

  React.useEffect(() => {
    if (open) loadEntries()
  }, [open, loadEntries])

  const replaceEntry = (updated: FeedbackBankSchema) =>
    setEntries((prev) => prev.map((e) => (e.id === updated.id ? updated : e)))

  const categories = React.useMemo(() => {
    const set = new Set<string>()
    entries.forEach((e) => {
      if (e.category) set.add(e.category)
    })
    return Array.from(set)
  }, [entries])

  const filtered = React.useMemo(() => {
    const q = search.trim().toLowerCase()
    return entries.filter((e) => {
      const matchesCategory =
        activeCategory === 'All' || e.category === activeCategory
      const matchesSearch = !q || e.text.toLowerCase().includes(q)
      return matchesCategory && matchesSearch
    })
  }, [entries, search, activeCategory])

  const handleApply = async (entry: FeedbackBankSchema) => {
    const inserted = insertIntoLastField(entry.text)
    try {
      const updated = await DefaultService.markFeedbackBankUsed(entry.id)
      replaceEntry(updated)
    } catch {
      /* usage count is best-effort */
    }
    if (inserted) {
      toast.success('Inserted into your feedback')
      onOpenChange(false)
    } else {
      try {
        await navigator.clipboard.writeText(entry.text)
        toast.success('Copied — click a feedback field first to insert directly')
      } catch {
        toast.error('Nothing to insert into')
      }
    }
  }

  const handleCopy = async (entry: FeedbackBankSchema) => {
    try {
      await navigator.clipboard.writeText(entry.text)
      const updated = await DefaultService.markFeedbackBankUsed(entry.id)
      replaceEntry(updated)
      toast.success('Copied to clipboard')
    } catch (error) {
      console.error('Failed to copy feedback:', error)
      toast.error('Failed to copy feedback')
    }
  }

  const handleReact = async (
    entry: FeedbackBankSchema,
    reaction: 'like' | 'dislike'
  ) => {
    try {
      const updated = await DefaultService.reactFeedbackBankEntry(
        entry.id,
        reaction
      )
      replaceEntry(updated)
    } catch (error) {
      console.error('Failed to react:', error)
      toast.error('Failed to record reaction')
    }
  }

  const handleFavourite = async (entry: FeedbackBankSchema) => {
    try {
      const updated = await DefaultService.toggleFeedbackBankFavourite(entry.id)
      replaceEntry(updated)
    } catch (error) {
      console.error('Failed to favourite:', error)
      toast.error('Failed to update favourite')
    }
  }

  const handleDelete = async (entry: FeedbackBankSchema) => {
    try {
      await DefaultService.deleteFeedbackBankEntry(entry.id)
      setEntries((prev) => prev.filter((e) => e.id !== entry.id))
      toast.success('Feedback deleted')
    } catch (error) {
      console.error('Failed to delete feedback:', error)
      toast.error('Failed to delete feedback')
    }
  }

  const handleSave = async () => {
    if (!newText.trim()) {
      toast.error('Feedback text is required')
      return
    }
    setIsSaving(true)
    try {
      const created = await DefaultService.createFeedbackBankEntry({
        text: newText.trim(),
        category: newCategory.trim() || null,
        assignment_id: assignmentId ?? null,
      })
      setEntries((prev) => [created, ...prev])
      setNewText('')
      setNewCategory('')
      setShowForm(false)
      toast.success('Feedback saved to the bank')
    } catch (error) {
      console.error('Failed to save feedback:', error)
      toast.error('Failed to save feedback')
    } finally {
      setIsSaving(false)
    }
  }

  const pill = (active: boolean) =>
    active
      ? 'inline-flex items-center gap-1 rounded-[99px] bg-[#131A26] px-3 py-1 text-[12px] font-medium text-white'
      : 'inline-flex items-center gap-1 rounded-[99px] border border-[#E3DFD5] bg-white px-3 py-1 text-[12px] font-medium text-[#454C5C] hover:bg-[#F2EFE8]'

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className='w-[720px] max-w-[95vw] gap-0 rounded-[10px] border border-[#EAE5DB] bg-white p-6 max-h-[80vh] overflow-y-auto [&>button]:hidden'>
        <div className='mb-1 flex items-center justify-between'>
          <div className='text-[20px] font-bold text-[#131A26]'>
            Feedback Bank
          </div>
          <span className='flex gap-2'>
            <button
              onClick={() => setShowForm((v) => !v)}
              className='inline-flex items-center gap-1 rounded-[9px] bg-[#131A26] px-3.5 py-[7px] text-[13px] font-semibold text-white hover:bg-[#243247]'
            >
              <Plus className='h-3.5 w-3.5' />
              Save Feedback
            </button>
            <button
              onClick={() => onOpenChange(false)}
              className='flex w-[34px] items-center justify-center rounded-[9px] border border-[#DED8CA] bg-white text-[#5A6070] hover:bg-[#F2EFE8]'
              aria-label='Close'
            >
              <X className='h-4 w-4' />
            </button>
          </span>
        </div>
        <div className='mb-4 text-[12.5px] text-[#8A9099]'>
          Shared with the markers on this course. Apply a snippet into the field
          you&apos;re editing, or rate the ones that work well.
        </div>

        {showForm && (
          <div className='mb-4 rounded-[14px] border border-[#EAE5DB] bg-[#FAF8F4] p-4'>
            <label className='mb-1.5 block text-[12.5px] font-semibold text-[#2C3444]'>
              Feedback text
            </label>
            <textarea
              value={newText}
              onChange={(e) => setNewText(e.target.value)}
              rows={3}
              placeholder='Write a reusable feedback snippet…'
              className='mb-3 w-full resize-y rounded-[9px] border border-[#DED8CA] bg-white px-3 py-2.5 text-sm text-[#2C3444] outline-none focus:border-[#8A9099]'
            />
            <label className='mb-1.5 block text-[12.5px] font-semibold text-[#2C3444]'>
              Category (optional)
            </label>
            <input
              type='text'
              value={newCategory}
              onChange={(e) => setNewCategory(e.target.value)}
              placeholder='e.g. Code Quality'
              className='mb-3 w-full max-w-[300px] rounded-[9px] border border-[#DED8CA] bg-white px-3 py-2 text-sm text-[#2C3444] outline-none focus:border-[#8A9099]'
            />
            <div className='flex gap-2'>
              <button
                onClick={handleSave}
                disabled={isSaving}
                className='inline-flex items-center rounded-[9px] bg-[#131A26] px-4 py-2 text-[13px] font-semibold text-white hover:bg-[#243247] disabled:opacity-50'
              >
                {isSaving && <Loader2 className='mr-2 h-4 w-4 animate-spin' />}
                Save
              </button>
              <button
                onClick={() => {
                  setShowForm(false)
                  setNewText('')
                  setNewCategory('')
                }}
                className='rounded-[9px] border border-[#DED8CA] bg-white px-4 py-2 text-[13px] font-semibold text-[#2C3444] hover:bg-[#F2EFE8]'
              >
                Cancel
              </button>
            </div>
          </div>
        )}

        <div className='mb-3 flex flex-wrap items-center gap-2'>
          <input
            type='text'
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder='Search saved feedback…'
            className='max-w-[260px] flex-1 rounded-[9px] border border-[#D3CDBF] bg-white px-3.5 py-2 text-[13px] text-[#2C3444] outline-none focus:border-[#8A9099]'
          />
          <button
            onClick={() => setFavouritesOnly((v) => !v)}
            className={pill(favouritesOnly)}
          >
            <Star
              className='h-3.5 w-3.5'
              fill={favouritesOnly ? 'currentColor' : 'none'}
            />
            Favourites
          </button>
          <select
            value={sort}
            onChange={(e) => setSort(e.target.value as SortKey)}
            className='rounded-[9px] border border-[#E3DFD5] bg-white px-2.5 py-1.5 text-[12px] font-medium text-[#454C5C] outline-none'
          >
            <option value='recent'>Newest</option>
            <option value='likes'>Most liked</option>
            <option value='used'>Most used</option>
          </select>
        </div>

        <div className='mb-4 flex flex-wrap items-center gap-2'>
          <button onClick={() => setActiveCategory('All')} className={pill(activeCategory === 'All')}>
            All
          </button>
          {categories.map((cat) => (
            <button
              key={cat}
              onClick={() => setActiveCategory(cat)}
              className={pill(activeCategory === cat)}
            >
              {cat}
            </button>
          ))}
        </div>

        {isLoading ? (
          <div className='flex items-center justify-center py-12 text-[#8A9099]'>
            <Loader2 className='h-6 w-6 animate-spin' />
          </div>
        ) : filtered.length === 0 ? (
          <div className='rounded-[14px] border border-[#EAE5DB] bg-[#FAF8F4] px-5 py-10 text-center'>
            <div className='text-[14px] font-semibold text-[#2C3444]'>
              No saved feedback
            </div>
            <div className='mt-1 text-[13px] text-[#8A9099]'>
              {search || activeCategory !== 'All' || favouritesOnly
                ? 'No snippets match your filters.'
                : 'Use “Save Feedback” to add reusable snippets for the course.'}
            </div>
          </div>
        ) : (
          <div className='flex flex-col gap-2.5'>
            {filtered.map((entry) => (
              <div
                key={entry.id}
                className='rounded-[14px] border border-[#EAE5DB] bg-white p-[18px]'
              >
                <div className='mb-2.5 text-[13px] leading-[1.6] text-[#2C3444]'>
                  {entry.text}
                </div>
                <div className='flex flex-wrap items-center gap-2'>
                  {entry.category && (
                    <span className='inline-block whitespace-nowrap rounded-[6px] bg-[#F5F3EF] px-2 py-0.5 text-[11px] font-medium text-[#454C5C]'>
                      {entry.category}
                    </span>
                  )}
                  <span className='whitespace-nowrap text-[12px] text-[#8A9099]'>
                    Used {entry.used_count ?? 0}×
                  </span>

                  {/* per-user reactions */}
                  <button
                    onClick={() => handleReact(entry, 'like')}
                    className={`inline-flex items-center gap-1 rounded-[7px] border px-1.5 py-0.5 text-[12px] ${
                      entry.my_reaction === 'like'
                        ? 'border-[#2F7D4F] bg-[#E9F1EA] text-[#2F7D4F]'
                        : 'border-[#E3DFD5] bg-white text-[#5A6070] hover:bg-[#F2EFE8]'
                    }`}
                    aria-label='Like'
                  >
                    <ThumbsUp className='h-3.5 w-3.5' /> {entry.up_count ?? 0}
                  </button>
                  <button
                    onClick={() => handleReact(entry, 'dislike')}
                    className={`inline-flex items-center gap-1 rounded-[7px] border px-1.5 py-0.5 text-[12px] ${
                      entry.my_reaction === 'dislike'
                        ? 'border-[#B4483C] bg-[#F8E8E5] text-[#B4483C]'
                        : 'border-[#E3DFD5] bg-white text-[#5A6070] hover:bg-[#F2EFE8]'
                    }`}
                    aria-label='Dislike'
                  >
                    <ThumbsDown className='h-3.5 w-3.5' /> {entry.down_count ?? 0}
                  </button>

                  <button
                    onClick={() => handleFavourite(entry)}
                    className={`inline-flex items-center rounded-[7px] border px-1.5 py-1 ${
                      entry.is_favourite
                        ? 'border-[#C9A24A] bg-[#FBF4E3] text-[#8A5D14]'
                        : 'border-[#E3DFD5] bg-white text-[#8A9099] hover:bg-[#F2EFE8]'
                    }`}
                    aria-label={entry.is_favourite ? 'Unfavourite' : 'Favourite'}
                  >
                    <Star
                      className='h-3.5 w-3.5'
                      fill={entry.is_favourite ? 'currentColor' : 'none'}
                    />
                  </button>

                  <span className='flex-1' />

                  {entry.can_delete && (
                    <button
                      onClick={() => handleDelete(entry)}
                      className='inline-flex items-center rounded-[9px] border border-[#DED8CA] bg-white px-2 py-1 text-[#8A9099] hover:bg-[#F8E8E5] hover:text-[#A93226]'
                      aria-label='Delete feedback'
                    >
                      <Trash2 className='h-3.5 w-3.5' />
                    </button>
                  )}
                  <button
                    onClick={() => handleCopy(entry)}
                    className='rounded-[9px] border border-[#DED8CA] bg-white px-2.5 py-1 text-[11px] font-medium text-[#2C3444] hover:bg-[#F2EFE8]'
                  >
                    Copy
                  </button>
                  <button
                    onClick={() => handleApply(entry)}
                    className='inline-flex items-center gap-1 rounded-[9px] bg-[#131A26] px-2.5 py-1 text-[11px] font-medium text-white hover:bg-[#243247]'
                  >
                    <CornerDownLeft className='h-3.5 w-3.5' />
                    Apply
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </DialogContent>
    </Dialog>
  )
}
