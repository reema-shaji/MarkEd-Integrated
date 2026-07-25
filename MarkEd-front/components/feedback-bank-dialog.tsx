'use client'

import * as React from 'react'
import { DefaultService, FeedbackBankSchema } from '@/src/api'
import { Dialog, DialogContent } from '@/components/ui/dialog'
import { Loader2, Plus, Trash2, X } from 'lucide-react'
import { toast } from 'sonner'

type FeedbackBankDialogProps = {
  open: boolean
  onOpenChange: (open: boolean) => void
}

export function FeedbackBankDialog({
  open,
  onOpenChange,
}: FeedbackBankDialogProps) {
  const [entries, setEntries] = React.useState<FeedbackBankSchema[]>([])
  const [isLoading, setIsLoading] = React.useState(true)
  const [search, setSearch] = React.useState('')
  const [activeCategory, setActiveCategory] = React.useState<string>('All')

  const [showForm, setShowForm] = React.useState(false)
  const [newText, setNewText] = React.useState('')
  const [newCategory, setNewCategory] = React.useState('')
  const [isSaving, setIsSaving] = React.useState(false)

  const loadEntries = React.useCallback(async () => {
    setIsLoading(true)
    try {
      const data = await DefaultService.listFeedbackBank()
      setEntries(data)
    } catch (error) {
      console.error('Failed to load feedback bank:', error)
      toast.error('Failed to load feedback bank')
    } finally {
      setIsLoading(false)
    }
  }, [])

  React.useEffect(() => {
    if (open) {
      loadEntries()
    }
  }, [open, loadEntries])

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

  const handleCopy = async (entry: FeedbackBankSchema) => {
    try {
      await navigator.clipboard.writeText(entry.text)
      const updated = await DefaultService.markFeedbackBankUsed(entry.id)
      setEntries((prev) => prev.map((e) => (e.id === entry.id ? updated : e)))
      toast.success('Copied to clipboard')
    } catch (error) {
      console.error('Failed to copy feedback:', error)
      toast.error('Failed to copy feedback')
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
      })
      setEntries((prev) => [created, ...prev])
      setNewText('')
      setNewCategory('')
      setShowForm(false)
      toast.success('Feedback saved')
    } catch (error) {
      console.error('Failed to save feedback:', error)
      toast.error('Failed to save feedback')
    } finally {
      setIsSaving(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className='w-[720px] max-w-[95vw] gap-0 rounded-[10px] border border-[#EAE5DB] bg-white p-6 max-h-[80vh] overflow-y-auto [&>button]:hidden'>
        <div className='mb-5 flex items-center justify-between'>
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

        <div className='mb-4 flex flex-wrap items-center gap-2'>
          <input
            type='text'
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder='Search saved feedback…'
            className='max-w-[300px] flex-1 rounded-[9px] border border-[#D3CDBF] bg-white px-3.5 py-2 text-[13px] text-[#2C3444] outline-none focus:border-[#8A9099]'
          />
          <button
            onClick={() => setActiveCategory('All')}
            className={
              activeCategory === 'All'
                ? 'inline-flex items-center rounded-[99px] bg-[#131A26] px-3 py-1 text-[12px] font-medium text-white'
                : 'inline-flex items-center rounded-[99px] border border-[#E3DFD5] bg-white px-3 py-1 text-[12px] font-medium text-[#454C5C] hover:bg-[#F2EFE8]'
            }
          >
            All
          </button>
          {categories.map((cat) => (
            <button
              key={cat}
              onClick={() => setActiveCategory(cat)}
              className={
                activeCategory === cat
                  ? 'inline-flex items-center rounded-[99px] bg-[#131A26] px-3 py-1 text-[12px] font-medium text-white'
                  : 'inline-flex items-center rounded-[99px] border border-[#E3DFD5] bg-white px-3 py-1 text-[12px] font-medium text-[#454C5C] hover:bg-[#F2EFE8]'
              }
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
              {search || activeCategory !== 'All'
                ? 'No snippets match your filters.'
                : 'Use “Save Feedback” to add reusable snippets.'}
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
                <div className='flex items-center gap-2.5'>
                  {entry.category && (
                    <span className='inline-block whitespace-nowrap rounded-[6px] bg-[#F5F3EF] px-2 py-0.5 text-[11px] font-medium text-[#454C5C]'>
                      {entry.category}
                    </span>
                  )}
                  <span className='whitespace-nowrap text-[12px] text-[#8A9099]'>
                    Used {entry.used_count ?? 0}× · 👍 {entry.up_count ?? 0} · 👎{' '}
                    {entry.down_count ?? 0}
                  </span>
                  <span className='flex-1' />
                  <button
                    onClick={() => handleDelete(entry)}
                    className='inline-flex items-center rounded-[9px] border border-[#DED8CA] bg-white px-2 py-1 text-[#8A9099] hover:bg-[#F8E8E5] hover:text-[#A93226]'
                    aria-label='Delete feedback'
                  >
                    <Trash2 className='h-3.5 w-3.5' />
                  </button>
                  <button
                    onClick={() => handleCopy(entry)}
                    className='rounded-[9px] border border-[#DED8CA] bg-white px-2.5 py-1 text-[11px] font-medium text-[#2C3444] hover:bg-[#F2EFE8]'
                  >
                    Copy
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
