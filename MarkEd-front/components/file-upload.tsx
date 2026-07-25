import { useState, useCallback } from 'react'
import { useDropzone } from 'react-dropzone'
import { UploadCloud, X, FileText, Loader2 } from 'lucide-react'
import { DefaultService } from '@/src/api'
import { toast } from 'sonner'

interface FileUploadProps {
  onUploadComplete?: (urls: string[]) => void
  acceptedFileTypes?: string[]
  maxSizeMB?: number
  className?: string
  type: 'submission' | 'instruction'
  maxFiles?: number
}

function formatBytes(bytes: number) {
  if (bytes < 1024) return `${bytes} B`
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(0)} KB`
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`
}

export function FileUpload({
  onUploadComplete,
  acceptedFileTypes = ['application/pdf'],
  maxSizeMB = 5,
  className,
  type,
  maxFiles = 1,
}: FileUploadProps) {
  const [uploading, setUploading] = useState(false)
  const [progress, setProgress] = useState(0)
  const [uploadingName, setUploadingName] = useState('')
  const [uploadedUrls, setUploadedUrls] = useState<string[]>([])
  const [uploadedFiles, setUploadedFiles] = useState<
    { name: string; url: string; size: number }[]
  >([])

  const atLimit = uploadedFiles.length >= maxFiles

  const removeFile = (index: number) => {
    const newFiles = uploadedFiles.filter((_, i) => i !== index)
    const newUrls = uploadedUrls.filter((_, i) => i !== index)
    setUploadedFiles(newFiles)
    setUploadedUrls(newUrls)
    onUploadComplete?.(newUrls)
  }

  const onDrop = useCallback(
    async (acceptedFiles: File[]) => {
      if (uploadedFiles.length + acceptedFiles.length > maxFiles) {
        toast.error(`Maximum ${maxFiles} file${maxFiles > 1 ? 's' : ''} allowed`)
        return
      }

      const uploadFile = async (file: File): Promise<string> => {
        if (file.size > maxSizeMB * 1024 * 1024) {
          throw new Error(`${file.name} exceeds the ${maxSizeMB}MB limit`)
        }
        if (!acceptedFileTypes.includes(file.type)) {
          throw new Error('Only PDF files are accepted')
        }

        setUploadingName(file.name)
        const urlData = await DefaultService.getUploadUrl(file.name, type, file.type)
        if (!urlData.success || !urlData.upload_url || !urlData.permanent_url) {
          throw new Error(urlData.message || 'Failed to get upload URL')
        }

        return new Promise((resolve, reject) => {
          const formData = new FormData()
          Object.entries(urlData.upload_url?.fields || {}).forEach(
            ([key, value]) => formData.append(key, value as string)
          )
          formData.append('file', file)

          const xhr = new XMLHttpRequest()
          xhr.upload.onprogress = (event) => {
            if (event.lengthComputable) {
              setProgress((event.loaded / event.total) * 100)
            }
          }
          xhr.onload = () =>
            xhr.status === 204 || xhr.status === 200
              ? resolve(urlData.permanent_url || '')
              : reject(new Error('Upload failed'))
          xhr.onerror = () => reject(new Error('Upload failed'))
          xhr.open('POST', urlData.upload_url?.url || '')
          xhr.send(formData)
        })
      }

      setUploading(true)
      setProgress(0)
      try {
        const urls: string[] = []
        const files: { name: string; url: string; size: number }[] = []
        for (const file of acceptedFiles) {
          const url = await uploadFile(file)
          urls.push(url)
          files.push({ name: file.name, url, size: file.size })
        }
        setUploadedUrls((prev) => [...prev, ...urls])
        setUploadedFiles((prev) => [...prev, ...files])
        toast.success('File uploaded')
        onUploadComplete?.([...uploadedUrls, ...urls])
      } catch (err: unknown) {
        toast.error(err instanceof Error ? err.message : 'An unknown error occurred')
      } finally {
        setUploading(false)
        setUploadingName('')
      }
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [maxSizeMB, onUploadComplete, uploadedFiles, maxFiles, acceptedFileTypes, type]
  )

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop,
    accept: acceptedFileTypes.reduce((acc, t) => ({ ...acc, [t]: [] }), {}),
    multiple: maxFiles > 1,
    maxFiles,
    disabled: uploading || atLimit,
  })

  return (
    <div className={className}>
      {/* Dropzone (hidden once at the file limit) */}
      {!atLimit && (
        <div
          {...getRootProps()}
          className={`relative flex flex-col items-center justify-center gap-3 rounded-[12px] border-2 border-dashed px-6 py-9 text-center transition-colors ${
            uploading
              ? 'cursor-default border-[#DED8CA] bg-warm-50'
              : isDragActive
                ? 'cursor-pointer border-royal bg-[#EDF2F8]'
                : 'cursor-pointer border-[#DED8CA] bg-warm-50 hover:border-[#C6BFB0] hover:bg-warm-100'
          }`}
        >
          <input {...getInputProps()} />

          {uploading ? (
            <div className='w-full max-w-[360px]'>
              <div className='mb-2 flex items-center gap-2.5 text-left'>
                <Loader2 className='h-4 w-4 flex-none animate-spin text-royal' />
                <span className='min-w-0 flex-1 truncate text-[13px] font-medium text-ink'>
                  {uploadingName || 'Uploading…'}
                </span>
                <span className='flex-none font-mono text-[12px] text-muted2'>
                  {Math.round(progress)}%
                </span>
              </div>
              <div className='h-2 overflow-hidden rounded-full bg-[#E7E1D4]'>
                <div
                  className='h-full rounded-full bg-royal transition-[width] duration-150 ease-out'
                  style={{ width: `${progress}%` }}
                />
              </div>
            </div>
          ) : (
            <>
              <span className='flex h-11 w-11 items-center justify-center rounded-full bg-warm-200'>
                <UploadCloud className='h-[22px] w-[22px] text-muted2' strokeWidth={1.8} />
              </span>
              <div>
                <div className='text-[13.5px] font-semibold text-ink'>
                  {isDragActive ? 'Drop your file to upload' : 'Drag & drop your PDF here'}
                </div>
                <div className='mt-0.5 text-[12px] text-faint'>
                  or <span className='font-medium text-royal'>browse</span> · PDF · up to {maxSizeMB}MB
                </div>
              </div>
            </>
          )}
        </div>
      )}

      {/* Uploaded files */}
      {uploadedFiles.length > 0 && (
        <div className='mt-3 flex flex-col gap-2'>
          {uploadedFiles.map((file, index) => (
            <div
              key={file.url}
              className='flex items-center gap-3 rounded-[11px] border border-line-card bg-white px-3.5 py-2.5'
            >
              <span className='flex h-9 w-9 flex-none items-center justify-center rounded-[9px] bg-[#FBEAE8]'>
                <FileText className='h-[18px] w-[18px] text-[#B4483C]' strokeWidth={1.8} />
              </span>
              <span className='min-w-0 flex-1'>
                <span className='block truncate text-[13px] font-semibold text-ink'>
                  {file.name}
                </span>
                <span className='block text-[11.5px] text-faint'>
                  {formatBytes(file.size)} · uploaded
                </span>
              </span>
              <button
                type='button'
                onClick={() => removeFile(index)}
                aria-label='Remove file'
                className='flex h-8 w-8 flex-none items-center justify-center rounded-[8px] text-faint hover:bg-warm-100 hover:text-[#B4483C]'
              >
                <X className='h-4 w-4' />
              </button>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
