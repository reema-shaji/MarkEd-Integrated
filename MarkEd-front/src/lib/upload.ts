/**
 * Shared file upload helper.
 *
 * The existing FileUpload component only surfaces the resulting S3 URLs, but
 * the group workspace and group submission (ported from Hao) also need the
 * original filename, size and type. This extracts the same two-step upload
 * FileUpload performs — get a presigned URL, then POST the file — and returns
 * that metadata alongside the permanent URL.
 */
import { DefaultService } from '@/src/api'

export interface UploadedFile {
  url: string
  file_name: string
  file_size: number
  file_type: string
}

export async function uploadFile(file: File): Promise<UploadedFile> {
  const urlData = await DefaultService.getUploadUrl(
    file.name,
    'submission',
    file.type
  )

  if (!urlData.success || !urlData.upload_url || !urlData.permanent_url) {
    throw new Error(urlData.message || 'Could not start the upload')
  }

  await new Promise<void>((resolve, reject) => {
    const formData = new FormData()
    Object.entries(urlData.upload_url?.fields || {}).forEach(([key, value]) => {
      formData.append(key, value as string)
    })
    formData.append('file', file)

    const xhr = new XMLHttpRequest()
    xhr.onload = () =>
      xhr.status === 204 || xhr.status === 200
        ? resolve()
        : reject(new Error('Upload failed'))
    xhr.onerror = () => reject(new Error('Upload failed'))
    xhr.open('POST', urlData.upload_url?.url || '')
    xhr.send(formData)
  })

  return {
    url: urlData.permanent_url,
    file_name: file.name,
    file_size: file.size,
    file_type: file.type || 'application/octet-stream',
  }
}
