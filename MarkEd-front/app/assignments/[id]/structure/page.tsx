'use client'

import * as React from 'react'
import { useParams, useRouter } from 'next/navigation'
import {
  AssignmentStructureSchema,
  DefaultService,
  StructureCriterionSchema,
} from '@/src/api'
import { Loader2 } from 'lucide-react'
import { toast } from 'sonner'
import { Skeleton } from '@/components/ui/skeleton'
import { useUser } from '@/src/contexts/user-context'

export default function AssignmentStructurePage() {
  const params = useParams()
  const router = useRouter()
  const { user } = useUser()
  const assignmentId = Number(params.id)

  const [structure, setStructure] =
    React.useState<AssignmentStructureSchema | null>(null)
  const [loadFailed, setLoadFailed] = React.useState(false)

  // Inline edit state: id of the criterion being edited (or 'new').
  const [editingId, setEditingId] = React.useState<number | 'new' | null>(null)
  const [draftName, setDraftName] = React.useState('')
  const [draftMarks, setDraftMarks] = React.useState('')
  const [saving, setSaving] = React.useState(false)

  const fetchStructure = React.useCallback(async () => {
    try {
      const data = await DefaultService.getAssignmentStructure(assignmentId)
      setStructure(data)
    } catch (error) {
      console.error('Failed to load assignment structure:', error)
      setLoadFailed(true)
      toast.error('Failed to load assignment structure')
    }
  }, [assignmentId])

  React.useEffect(() => {
    if (params.id) {
      fetchStructure()
    }
  }, [params.id, fetchStructure])

  const beginAdd = () => {
    setEditingId('new')
    setDraftName('')
    setDraftMarks('')
  }

  const beginEdit = (cr: StructureCriterionSchema) => {
    setEditingId(cr.id)
    setDraftName(cr.name)
    setDraftMarks(String(cr.marks))
  }

  const cancelEdit = () => {
    setEditingId(null)
    setDraftName('')
    setDraftMarks('')
  }

  const saveEdit = async () => {
    const name = draftName.trim()
    const marks = Number(draftMarks)
    if (!name) {
      toast.error('Criterion name is required')
      return
    }
    if (!Number.isFinite(marks) || marks < 0) {
      toast.error('Enter a valid maximum mark')
      return
    }
    setSaving(true)
    try {
      if (editingId === 'new') {
        await DefaultService.createAssignmentCriterion(assignmentId, {
          name,
          marks,
        })
        toast.success('Criterion added')
      } else if (typeof editingId === 'number') {
        await DefaultService.updateAssignmentCriterion(
          assignmentId,
          editingId,
          { name, marks }
        )
        toast.success('Criterion updated')
      }
      cancelEdit()
      await fetchStructure()
    } catch (error) {
      console.error('Failed to save criterion:', error)
      toast.error('Failed to save criterion')
    } finally {
      setSaving(false)
    }
  }

  // Defence-in-depth role guard: this tab is already staff-gated.
  if (user && !user.isStaff) {
    return (
      <div className='mx-auto w-full max-w-[880px] px-7 pb-12 pt-8'>
        <div className='rounded-[14px] border border-[#EAE5DB] bg-white px-5 py-12 text-center text-sm text-[#8A9099]'>
          This page is not available for your role.
        </div>
      </div>
    )
  }

  if (loadFailed) {
    return (
      <div className='mx-auto w-full max-w-[880px] px-7 pb-12 pt-8'>
        <div className='rounded-[14px] border border-[#EAE5DB] bg-white px-5 py-12 text-center text-sm text-[#8A9099]'>
          We couldn&apos;t load the assignment structure. Please try again later.
        </div>
      </div>
    )
  }

  if (!structure) {
    return (
      <div className='mx-auto w-full max-w-[880px] px-7 pb-12 pt-8'>
        <Skeleton className='mb-[18px] h-6 w-56' />
        <Skeleton className='mb-4 h-48 w-full rounded-[14px]' />
        <Skeleton className='h-20 w-full rounded-[14px]' />
      </div>
    )
  }

  const criteria = structure.criteria ?? []

  const inputCls =
    'rounded-[9px] border border-[#DED8CA] bg-white px-3 py-1.5 text-[13px] focus:outline-none focus:ring-2 focus:ring-[#DED8CA]'

  const renderEditRow = () => (
    <div className='flex flex-wrap items-center gap-2 border-b border-[#F0ECE4] bg-[#FAF8F4] px-5 py-3 last:border-b-0'>
      <input
        type='text'
        value={draftName}
        onChange={(e) => setDraftName(e.target.value)}
        placeholder='Criterion name'
        autoFocus
        className={`${inputCls} min-w-0 flex-1`}
      />
      <div className='flex items-center gap-1.5'>
        <span className='text-[12px] text-[#5A6070]'>0–</span>
        <input
          type='number'
          min={0}
          value={draftMarks}
          onChange={(e) => setDraftMarks(e.target.value)}
          placeholder='Max'
          className={`${inputCls} w-20`}
        />
        <span className='text-[12px] text-[#5A6070]'>pts</span>
      </div>
      <button
        onClick={saveEdit}
        disabled={saving}
        className='inline-flex items-center rounded-[9px] bg-[#131A26] px-3 py-1.5 text-[12px] font-semibold text-white hover:bg-[#243247] disabled:cursor-not-allowed disabled:opacity-50'
      >
        {saving && <Loader2 className='mr-1.5 h-3.5 w-3.5 animate-spin' />}
        Save
      </button>
      <button
        onClick={cancelEdit}
        disabled={saving}
        className='rounded-[9px] border border-[#DED8CA] bg-white px-3 py-1.5 text-[12px] font-semibold text-[#2C3444] hover:bg-[#F2EFE8] disabled:opacity-50'
      >
        Cancel
      </button>
    </div>
  )

  return (
    <div className='mx-auto w-full max-w-[880px] px-7 pb-12 pt-8'>
      <div className='mb-[18px] text-[21px] font-semibold tracking-[-.45px] text-[#131A26]'>
        Assignment Structure
      </div>

      {/* Marking Criteria */}
      <div className='mb-4 overflow-hidden rounded-[14px] border border-[#EAE5DB] bg-white'>
        <div className='flex items-center justify-between border-b border-[#F0ECE4] px-5 py-[15px]'>
          <span className='text-[14px] font-semibold tracking-[-.05px] text-[#131A26]'>
            Marking Criteria
          </span>
          <button
            onClick={beginAdd}
            disabled={editingId !== null}
            className='rounded-[9px] border border-[#DED8CA] bg-white px-3.5 py-1.5 text-[12px] font-semibold text-[#2C3444] hover:bg-[#F2EFE8] disabled:cursor-not-allowed disabled:opacity-50'
          >
            + Add Criterion
          </button>
        </div>

        {criteria.length === 0 && editingId !== 'new' ? (
          <p className='px-5 py-10 text-center text-sm text-[#8A9099]'>
            No marking criteria yet. Use &apos;+ Add Criterion&apos; to define
            how this assignment is graded.
          </p>
        ) : (
          criteria.map((cr) =>
            editingId === cr.id ? (
              <React.Fragment key={cr.id}>{renderEditRow()}</React.Fragment>
            ) : (
              <div
                key={cr.id}
                className='flex items-center justify-between border-b border-[#F0ECE4] px-5 py-[13px] last:border-b-0'
              >
                <span className='text-[14px] font-medium text-[#131A26]'>
                  {cr.name}
                </span>
                <span className='flex items-center gap-2.5'>
                  <span className='text-[12px] text-[#5A6070]'>
                    0–{cr.marks} pts
                  </span>
                  <button
                    onClick={() => beginEdit(cr)}
                    disabled={editingId !== null}
                    className='rounded-[9px] border border-[#DED8CA] bg-white px-2.5 py-1 text-[11px] font-medium text-[#2C3444] hover:bg-[#F2EFE8] disabled:cursor-not-allowed disabled:opacity-50'
                  >
                    Edit
                  </button>
                </span>
              </div>
            )
          )
        )}

        {editingId === 'new' && renderEditRow()}
      </div>

      {/* Self-Assessment */}
      <div className='flex items-center justify-between rounded-[14px] border border-[#EAE5DB] bg-white px-5 py-5'>
        <span>
          <span className='block text-[14px] font-semibold tracking-[-.05px] text-[#131A26]'>
            Self-Assessment
          </span>
          <span className='mt-0.5 block text-[13px] text-[#5A6070]'>
            {structure.self_assessment_enabled
              ? 'Enabled — checklist, rubric self-grading and guided reflection'
              : 'Not enabled for this assignment'}
          </span>
        </span>
        {structure.self_assessment_enabled && (
          <button
            onClick={() =>
              router.push(
                `/assignments/${assignmentId}/self-assessment/configure`
              )
            }
            className='rounded-[9px] bg-[#131A26] px-3.5 py-1.5 text-[12px] font-semibold text-white hover:bg-[#243247]'
          >
            Configure
          </button>
        )}
      </div>
    </div>
  )
}
