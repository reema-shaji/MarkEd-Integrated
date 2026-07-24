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

import { useCallback, useEffect, useState } from 'react'
import { useParams } from 'next/navigation'
import { useDropzone } from 'react-dropzone'
import {
  DefaultService,
  GroupSchema,
  GroupSubmissionSchema,
  WorkspaceFileSchema,
} from '@/src/api'
import { uploadFile } from '@/src/lib/upload'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
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
  CheckCircle2,
  FileText,
  Loader2,
  MessageSquare,
  Send,
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
        DefaultService.listGroupSubmissions(assignmentId).catch(() => []),
      ])
      setFiles(wf)
      const mySubs = subs
        .filter((s) => s.group_id === mine.id)
        .sort((a, b) => b.submission_version - a.submission_version)
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

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop,
    accept: { 'application/pdf': ['.pdf'] },
    multiple: false,
    disabled: uploading || !group,
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

  if (isLoading) {
    return (
      <div className='mx-auto w-full max-w-4xl p-6'>
        <Skeleton className='h-9 w-64' />
        <Skeleton className='mt-6 h-40' />
      </div>
    )
  }

  if (noGroup || !group) {
    return (
      <div className='mx-auto w-full max-w-4xl p-6'>
        <Card>
          <CardContent className='py-14 text-center text-sm text-muted-foreground'>
            You are not in a group for this assignment yet. Once your tutor
            assigns you to a team, your shared workspace appears here.
          </CardContent>
        </Card>
      </div>
    )
  }

  return (
    <div className='mx-auto w-full max-w-[900px] p-6'>
      <div className='mb-1.5 text-[13px] text-neutral-400'>
        My Groups / {group.name} Workspace
      </div>
      <h1 className='text-2xl font-bold'>
        {assignmentTitle} — Group Workspace
      </h1>
      <p className='mt-1.5 mb-3 text-sm text-neutral-500'>
        {group.members.map((m) => m.userName).join(', ')}
      </p>

      {/* Submission status banner — reinforces that uploading is not submitting. */}
      <div className='mb-5 flex items-start gap-2.5 rounded-lg border border-green-200 bg-green-50 px-4 py-3'>
        <CheckCircle2 className='mt-0.5 h-4 w-4 shrink-0 text-green-700' />
        <p className='text-[13px] text-green-800'>
          {latestSubmission ? (
            <>
              <b>Status:</b> Submitted v{latestSubmission.submission_version} on{' '}
              {new Date(latestSubmission.submissionDateTime).toLocaleDateString(
                undefined,
                { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' }
              )}
              . Uploading to the workspace does <b>not</b> submit — confirm a
              submission from a file below.
            </>
          ) : (
            <>
              <b>Status:</b> Not submitted yet. Uploading to the workspace does{' '}
              <b>not</b> submit — confirm a submission from a file below.
            </>
          )}
        </p>
      </div>

      <div className='grid gap-4 md:grid-cols-[1.4fr_1fr] md:items-start'>
        {/* Left column — workspace files, upload and per-file discussion. */}
        <div className='grid gap-4'>
          <Card>
            <CardHeader className='pb-2'>
              <CardTitle className='text-base'>Workspace Files</CardTitle>
              <p className='text-sm text-muted-foreground'>
                Upload drafts here for your group to review. This is <b>not</b>{' '}
                your submission — you confirm that from a file below.
              </p>
            </CardHeader>
            <CardContent>
              {/* Upload area — a shared drafting space, kept distinct from the
                  submission (Hao's known confusion). */}
              <div
                {...getRootProps()}
                className={`flex cursor-pointer flex-col items-center justify-center rounded-lg border-2 border-dashed p-8 text-center transition-colors ${
                  isDragActive
                    ? 'border-neutral-800 bg-neutral-50'
                    : 'border-neutral-300'
                }`}
              >
                <input {...getInputProps()} />
                {uploading ? (
                  <Loader2 className='h-6 w-6 animate-spin text-muted-foreground' />
                ) : (
                  <UploadCloud className='h-6 w-6 text-muted-foreground' />
                )}
                <p className='mt-2 text-sm text-muted-foreground'>
                  {uploading
                    ? 'Uploading…'
                    : 'Drag a PDF here, or click to choose one'}
                </p>
              </div>

              {/* File list with a per-file comment thread. */}
              <div className='mt-4 grid gap-3'>
                {files.length === 0 ? (
                  <p className='py-8 text-center text-sm text-muted-foreground'>
                    No files yet. Upload a draft to get started.
                  </p>
                ) : (
                  files.map((file) => (
                    <div
                      key={file.id}
                      className='rounded-lg border border-neutral-200 p-3.5'
                    >
                      <div className='flex items-start justify-between gap-3'>
                        <div className='flex min-w-0 items-start gap-2'>
                          <FileText className='mt-0.5 h-4 w-4 shrink-0 text-muted-foreground' />
                          <div className='min-w-0'>
                            <div className='truncate text-sm font-medium'>
                              {file.file_name}
                            </div>
                            <div className='text-xs text-muted-foreground'>
                              {file.uploaded_by_name} ·{' '}
                              {new Date(file.upload_time).toLocaleDateString(
                                undefined,
                                {
                                  day: 'numeric',
                                  month: 'short',
                                  hour: '2-digit',
                                  minute: '2-digit',
                                }
                              )}
                            </div>
                          </div>
                        </div>
                        <div className='flex shrink-0 items-center gap-1'>
                          <Button
                            size='sm'
                            variant='outline'
                            onClick={() => setConfirmFile(file)}
                          >
                            <Send className='mr-1 h-3.5 w-3.5' />
                            Submit this
                          </Button>
                          <Button
                            size='icon'
                            variant='ghost'
                            className='h-8 w-8'
                            aria-label={`Remove ${file.file_name}`}
                            onClick={() => deleteFile(file.id)}
                          >
                            <Trash2 className='h-3.5 w-3.5' />
                          </Button>
                        </div>
                      </div>

                      {/* Comment thread */}
                      <div className='mt-3 border-t pt-3'>
                        {file.comments.length > 0 && (
                          <div className='mb-3 grid gap-2'>
                            {file.comments.map((comment) => (
                              <div key={comment.id} className='text-sm'>
                                <span className='font-medium'>
                                  {comment.author_name}
                                </span>{' '}
                                <span className='text-xs text-muted-foreground'>
                                  {new Date(comment.created_at).toLocaleDateString(
                                    undefined,
                                    { day: 'numeric', month: 'short' }
                                  )}
                                </span>
                                <p className='text-muted-foreground'>
                                  {comment.content}
                                </p>
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
                            onKeyDown={(e) =>
                              e.key === 'Enter' && addComment(file)
                            }
                            className='h-9'
                          />
                          <Button
                            size='sm'
                            variant='outline'
                            onClick={() => addComment(file)}
                            disabled={!commentDraft[file.id]?.trim()}
                          >
                            <MessageSquare className='h-4 w-4' />
                          </Button>
                        </div>
                      </div>
                    </div>
                  ))
                )}
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Right column — how submission works, and the version history. */}
        <div className='grid gap-4'>
          <Card>
            <CardHeader className='pb-2'>
              <CardTitle className='text-base'>Submit Assignment</CardTitle>
            </CardHeader>
            <CardContent>
              <p className='text-sm text-muted-foreground'>
                Submitting records a new immutable version from a workspace file.
                Use <b>Submit this</b> on any file to submit it as the group&apos;s
                work — every submission is kept.
              </p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className='pb-2'>
              <CardTitle className='text-base'>Submission History</CardTitle>
            </CardHeader>
            <CardContent>
              {submissions.length === 0 ? (
                <p className='text-sm text-muted-foreground'>
                  No submissions yet.
                </p>
              ) : (
                <div className='grid gap-2.5'>
                  {submissions.map((submission, index) => (
                    <div
                      key={submission.id}
                      className={`rounded-lg border p-3 ${
                        index === 0
                          ? 'border-neutral-200 bg-neutral-50'
                          : 'border-neutral-100'
                      }`}
                    >
                      <div className='flex items-center justify-between gap-2'>
                        <span className='text-[13px] font-semibold'>
                          Submission #{submission.submission_version}
                        </span>
                        {index === 0 && (
                          <span className='shrink-0 rounded-full bg-green-100 px-2 py-0.5 text-[11px] font-medium text-green-700'>
                            Latest
                          </span>
                        )}
                      </div>
                      <div className='mt-1 text-[11px] text-neutral-500'>
                        {new Date(
                          submission.submissionDateTime
                        ).toLocaleDateString(undefined, {
                          day: 'numeric',
                          month: 'short',
                          hour: '2-digit',
                          minute: '2-digit',
                        })}{' '}
                        · by {submission.submitted_by_name}
                        {submission.filename ? ` · ${submission.filename}` : ''}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
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
