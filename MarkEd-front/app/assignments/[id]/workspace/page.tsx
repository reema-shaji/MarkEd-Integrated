'use client'

/**
 * Group workspace — ported from Hao's group_workspace.html and his two-step
 * submission flow (group_submit_confirm.html).
 *
 * His evaluation praised the workspace as a collaboration space and the version
 * history as a "safety net". Preserved here: a shared file list with a comment
 * thread, and a separate, explicit "submit as the group's work" step. His
 * evaluation also found students confused uploading with submitting, so the two
 * actions are visually and textually separated, and the confirm dialog spells
 * out the difference.
 */

import { useCallback, useEffect, useMemo, useState } from 'react'
import { useParams } from 'next/navigation'
import { useDropzone } from 'react-dropzone'
import {
  DefaultService,
  GroupSchema,
  GroupSubmissionSchema,
  WorkspaceFileSchema,
} from '@/src/api'
import { uploadFile } from '@/src/lib/upload'
import { Input } from '@/components/ui/input'
import { Skeleton } from '@/components/ui/skeleton'
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog'
import {
  Download,
  FileText,
  Loader2,
  MessageSquare,
  Trash2,
  UploadCloud,
} from 'lucide-react'
import { toast } from 'sonner'

export default function GroupWorkspacePage() {
  const params = useParams()
  const assignmentId = Number(params.id)

  const [group, setGroup] = useState<GroupSchema | null>(null)
  const [assignmentTitle, setAssignmentTitle] = useState('')
  const [files, setFiles] = useState<WorkspaceFileSchema[]>([])
  const [submissions, setSubmissions] = useState<GroupSubmissionSchema[]>([])
  const [latestSubmission, setLatestSubmission] =
    useState<GroupSubmissionSchema | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [uploading, setUploading] = useState(false)
  const [commentDraft, setCommentDraft] = useState<Record<number, string>>({})
  const [confirmFile, setConfirmFile] = useState<WorkspaceFileSchema | null>(null)
  const [submitting, setSubmitting] = useState(false)
  const [noGroup, setNoGroup] = useState(false)

  const load = useCallback(async () => {
    try {
      // Find this student's group for the assignment's group category.
      const myGroups = await DefaultService.listMyGroups()
      const assignment = await DefaultService.getAssignment(assignmentId)
      const mine =
        myGroups.find((g) => g.group_set_id === assignment.group_set_id) ?? null

      if (!mine) {
        setNoGroup(true)
        return
      }
      setGroup(mine)
      setAssignmentTitle(assignment.assignmentTitle)

      const [wf, subs] = await Promise.all([
        DefaultService.listWorkspaceFiles(mine.id, assignmentId),
        // Student-scoped: the group's own submissions. listGroupSubmissions is
        // staff-only and would 403 here, leaving the state stuck on "not
        // submitted" even right after submitting.
        DefaultService.getMyGroupSubmissions(assignmentId).catch(() => []),
      ])
      setFiles(wf)
      const mySubs = [...subs].sort(
        (a, b) => b.submission_version - a.submission_version
      )
      setSubmissions(mySubs)
      setLatestSubmission(mySubs[0] ?? null)
    } catch {
      toast.error('Could not load the group workspace')
    } finally {
      setIsLoading(false)
    }
  }, [assignmentId])

  useEffect(() => {
    load()
  }, [load])

  const onDrop = useCallback(
    async (accepted: File[]) => {
      if (!group || accepted.length === 0) return
      setUploading(true)
      try {
        for (const file of accepted) {
          const uploaded = await uploadFile(file)
          await DefaultService.uploadWorkspaceFile(group.id, {
            assignment_id: assignmentId,
            file: uploaded.url,
            file_name: uploaded.file_name,
            file_size: uploaded.file_size,
            file_type: uploaded.file_type,
          })
        }
        await load()
        toast.success('Added to the workspace')
      } catch {
        toast.error('Could not upload that file')
      } finally {
        setUploading(false)
      }
    },
    [group, assignmentId, load]
  )

  const { getRootProps, getInputProps, isDragActive, open } = useDropzone({
    onDrop,
    accept: { 'application/pdf': ['.pdf'] },
    multiple: false,
    disabled: uploading || !group,
    noClick: true,
    noKeyboard: true,
  })

  const deleteFile = async (fileId: number) => {
    try {
      await DefaultService.deleteWorkspaceFile(fileId)
      setFiles((prev) => prev.filter((f) => f.id !== fileId))
    } catch {
      toast.error('Could not remove that file')
    }
  }

  const addComment = async (file: WorkspaceFileSchema) => {
    const content = commentDraft[file.id]?.trim()
    if (!content) return
    try {
      await DefaultService.addWorkspaceComment(file.id, { content })
      setCommentDraft((prev) => ({ ...prev, [file.id]: '' }))
      await load()
    } catch {
      toast.error('Could not post that comment')
    }
  }

  const confirmSubmission = async () => {
    if (!group || !confirmFile) return
    setSubmitting(true)
    try {
      await DefaultService.submitGroupAssignment(group.id, {
        assignment_id: assignmentId,
        file: confirmFile.file ?? '',
      })
      setConfirmFile(null)
      await load()
      toast.success("Submitted as your group's work")
    } catch (error) {
      const message =
        (error as { body?: { detail?: string } })?.body?.detail ??
        'Could not submit'
      toast.error(message)
    } finally {
      setSubmitting(false)
    }
  }

  // The most recently uploaded workspace file — the candidate for submission.
  const latestFile = useMemo(() => {
    if (files.length === 0) return null
    return [...files].sort(
      (a, b) =>
        new Date(b.upload_time).getTime() - new Date(a.upload_time).getTime()
    )[0]
  }, [files])

  if (isLoading) {
    return (
      <div className='mx-auto w-full max-w-[1200px] px-7 pb-12 pt-8'>
        <Skeleton className='h-9 w-64' />
        <Skeleton className='mt-6 h-40' />
      </div>
    )
  }

  if (noGroup || !group) {
    return (
      <div className='mx-auto w-full max-w-[1200px] px-7 pb-12 pt-8'>
        <div className='rounded-[14px] border border-line-card bg-white py-14 text-center text-sm text-muted2'>
          You are not in a group for this assignment yet. Once your tutor
          assigns you to a team, your shared workspace appears here.
        </div>
      </div>
    )
  }

  const submitted = !!latestSubmission

  return (
    <div className='mx-auto w-full max-w-[1200px] px-7 pb-12 pt-8'>
      <div className='mb-1.5 flex items-center gap-2.5'>
        <span className='text-[21px] font-semibold tracking-[-0.45px] text-ink'>
          Group Workspace
        </span>
      </div>
      <p className='mb-1 text-[13px] text-muted2'>
        {assignmentTitle} · {group.name}
      </p>
      <p className='mb-1 text-[13px] text-faint'>
        {group.members.map((m) => m.userName).join(', ')}
      </p>

      {/* Submission status banner — reinforces that uploading is not submitting. */}
      <div
        className={`my-3 flex items-center gap-2.5 rounded-[12px] border px-4 py-3 ${
          submitted
            ? 'border-[#CDE3D2] bg-[#E9F1EA]'
            : 'border-[#EBD9B4] bg-[#F8EFDC]'
        }`}
      >
        <span
          className={`h-2 w-2 shrink-0 rounded-full ${
            submitted ? 'bg-[#2F7D4F]' : 'bg-[#C9862A]'
          }`}
        />
        <p
          className={`text-[13px] leading-[1.55] ${
            submitted ? 'text-[#2F7D4F]' : 'text-[#8A5D14]'
          }`}
        >
          {submitted ? (
            <>
              <b>Submitted v{latestSubmission!.submission_version}</b> on{' '}
              {new Date(latestSubmission!.submissionDateTime).toLocaleDateString(
                undefined,
                { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' }
              )}
              . Uploading to the workspace does not submit — confirm a new
              submission on the right.
            </>
          ) : (
            <>
              <b>Not submitted yet.</b> Uploading to the workspace does not submit
              — confirm a submission on the right.
            </>
          )}
        </p>
      </div>

      <div className='grid gap-4 md:grid-cols-[1.4fr_1fr] md:items-start'>
        {/* Left column — workspace files, upload and per-file discussion. */}
        <div className='flex flex-col gap-4'>
          <div className='overflow-hidden rounded-[14px] border border-line-card bg-white'>
            <div className='flex items-center justify-between border-b border-line-soft px-[18px] py-3.5'>
              <span className='text-sm font-semibold tracking-[-0.05px] text-ink'>
                Workspace Files
              </span>
              <button
                onClick={open}
                disabled={uploading || !group}
                className='rounded-[9px] bg-ink px-3 py-[5px] text-[12px] font-semibold text-white transition-colors hover:bg-ink-hover disabled:opacity-50'
              >
                {uploading ? 'Uploading…' : '↑ Upload File'}
              </button>
            </div>

            {/* Upload area — a shared drafting space, kept distinct from the
                submission (Hao's known confusion). */}
            <div
              {...getRootProps()}
              className={`m-[18px] flex cursor-pointer flex-col items-center justify-center rounded-[10px] border-2 border-dashed p-6 text-center transition-colors ${
                isDragActive ? 'border-ink bg-warm-50' : 'border-line-input'
              }`}
              onClick={open}
            >
              <input {...getInputProps()} />
              {uploading ? (
                <Loader2 className='h-6 w-6 animate-spin text-faint' />
              ) : (
                <UploadCloud className='h-6 w-6 text-faint' />
              )}
              <p className='mt-2 text-[12.5px] text-faint'>
                {uploading
                  ? 'Uploading…'
                  : 'Drag a PDF here, or click to choose one'}
              </p>
              <p className='mt-1 text-[11.5px] text-kicker'>PDF only.</p>
            </div>

            {files.length === 0 ? (
              <div className='px-[18px] pb-6 text-center'>
                <div className='text-[13px] font-semibold text-[#2C3444]'>
                  No files yet
                </div>
                <div className='mt-1 text-[12.5px] leading-[1.6] text-faint'>
                  Upload files to share them with your group. Uploading does not
                  submit your work.
                </div>
              </div>
            ) : (
              <>
                <div className='grid grid-cols-[1.8fr_1fr_.9fr_auto] items-center gap-2 border-b border-line-card px-[18px] py-3 text-[10px] font-semibold uppercase tracking-[0.85px] text-kicker'>
                  <span className='pl-6'>File name</span>
                  <span>Uploaded by</span>
                  <span>Date</span>
                  <span />
                </div>
                {files.map((file) => (
                  <div
                    key={file.id}
                    className='border-b border-line-soft px-[18px] py-2.5 last:border-b-0'
                  >
                    <div className='grid grid-cols-[1.8fr_1fr_.9fr_auto] items-center gap-2'>
                      <span className='flex min-w-0 items-center gap-2 text-[13px] font-medium text-ink'>
                        <FileText className='h-4 w-4 shrink-0 text-faint' />
                        <span className='truncate'>{file.file_name}</span>
                      </span>
                      <span className='truncate text-[12px] text-muted2'>
                        {file.uploaded_by_name}
                      </span>
                      <span className='text-[12px] text-muted2'>
                        {new Date(file.upload_time).toLocaleDateString(undefined, {
                          day: 'numeric',
                          month: 'short',
                        })}
                      </span>
                      <span className='flex justify-end gap-1'>
                        {file.file && (
                          <a
                            href={file.file}
                            target='_blank'
                            rel='noreferrer'
                            title='Download'
                            className='flex h-[26px] w-[26px] items-center justify-center rounded-[9px] border border-line bg-white text-muted2 transition-colors hover:bg-warm-100'
                          >
                            <Download className='h-3.5 w-3.5' />
                          </a>
                        )}
                        <button
                          title='Delete'
                          aria-label={`Remove ${file.file_name}`}
                          onClick={() => deleteFile(file.id)}
                          className='flex h-[26px] w-[26px] items-center justify-center rounded-[9px] border border-line bg-white text-faint transition-colors hover:border-red-200 hover:text-red-600'
                        >
                          <Trash2 className='h-3.5 w-3.5' />
                        </button>
                      </span>
                    </div>

                    {/* Per-file discussion thread. */}
                    <div className='mt-2.5 border-t border-line-soft pt-2.5'>
                      {file.comments.length > 0 && (
                        <div className='mb-2.5 flex flex-col gap-2'>
                          {file.comments.map((comment) => (
                            <div key={comment.id} className='text-[13px]'>
                              <span className='font-medium text-ink'>
                                {comment.author_name}
                              </span>{' '}
                              <span className='text-[11px] text-kicker'>
                                {new Date(comment.created_at).toLocaleDateString(
                                  undefined,
                                  { day: 'numeric', month: 'short' }
                                )}
                              </span>
                              <p className='text-muted2'>{comment.content}</p>
                            </div>
                          ))}
                        </div>
                      )}
                      <div className='flex gap-2'>
                        <Input
                          value={commentDraft[file.id] ?? ''}
                          onChange={(e) =>
                            setCommentDraft((prev) => ({
                              ...prev,
                              [file.id]: e.target.value,
                            }))
                          }
                          placeholder='Write a comment…'
                          onKeyDown={(e) => e.key === 'Enter' && addComment(file)}
                          className='h-9 rounded-[9px] border-line-input text-[13px]'
                        />
                        <button
                          onClick={() => addComment(file)}
                          disabled={!commentDraft[file.id]?.trim()}
                          className='flex items-center rounded-[9px] border border-line-input bg-white px-3 text-[12px] font-medium text-[#2C3444] transition-colors hover:bg-warm-100 disabled:opacity-50'
                        >
                          <MessageSquare className='h-4 w-4' />
                        </button>
                      </div>
                    </div>
                  </div>
                ))}
              </>
            )}
          </div>
        </div>

        {/* Right column — how submission works, and the version history. */}
        <div className='flex flex-col gap-4'>
          <div className='rounded-[14px] border border-line-card bg-white p-5'>
            <div className='mb-3 text-sm font-semibold tracking-[-0.05px] text-ink'>
              Submit for the group
            </div>
            <p className='mb-2.5 text-[12.5px] leading-[1.6] text-muted2'>
              Submitting records a new immutable version from the current
              workspace files. Every submission is kept.
            </p>
            <p className='mb-3 text-[11.5px] leading-[1.5] text-kicker'>
              PDF only · latest workspace file is submitted.
            </p>
            <button
              onClick={() => latestFile && setConfirmFile(latestFile)}
              disabled={!latestFile}
              className='w-full rounded-[9px] bg-ink py-2.5 text-[13px] font-semibold text-white transition-colors hover:bg-ink-hover disabled:opacity-50'
            >
              Submit as Group Submission
            </button>
          </div>

          <div className='rounded-[14px] border border-line-card bg-white p-5'>
            <div className='mb-3 text-sm font-semibold tracking-[-0.05px] text-ink'>
              Submission history
            </div>
            {submissions.length === 0 ? (
              <p className='text-[12.5px] leading-[1.6] text-faint'>
                No submissions yet. When a submission is confirmed it is recorded
                here as an immutable version.
              </p>
            ) : (
              <div className='flex flex-col gap-2.5'>
                {submissions.map((submission, index) => (
                  <div
                    key={submission.id}
                    className={`rounded-[12px] border border-line-soft p-3 ${
                      index === 0 ? 'bg-warm-50' : 'bg-white'
                    }`}
                  >
                    <div className='flex items-center justify-between gap-2'>
                      <span className='text-[13px] font-semibold text-ink'>
                        Submission #{submission.submission_version}
                      </span>
                      {index === 0 && (
                        <span className='shrink-0 whitespace-nowrap rounded-[6px] bg-[#E9F1EA] px-2 py-px text-[11px] font-semibold text-[#2F7D4F]'>
                          Latest
                        </span>
                      )}
                    </div>
                    <div className='mt-1 text-[11.5px] text-muted2'>
                      {new Date(submission.submissionDateTime).toLocaleDateString(
                        undefined,
                        {
                          day: 'numeric',
                          month: 'short',
                          hour: '2-digit',
                          minute: '2-digit',
                        }
                      )}{' '}
                      · by {submission.submitted_by_name}
                      {submission.filename ? ` · ${submission.filename}` : ''}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Explicit two-step confirm, spelling out that this IS the submission. */}
      <AlertDialog open={!!confirmFile} onOpenChange={(open) => !open && setConfirmFile(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Submit as your group&apos;s work?</AlertDialogTitle>
            <AlertDialogDescription>
              This submits <b>{confirmFile?.file_name}</b> as the whole
              group&apos;s submission for this assignment. Anyone in the group
              can do this, and you can replace it later by submitting a newer
              file — each submission is kept.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={confirmSubmission} disabled={submitting}>
              {submitting ? 'Submitting…' : 'Submit'}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  )
}
