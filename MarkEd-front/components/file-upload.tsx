import { useState, useCallback } from 'react'
import { useDropzone } from 'react-dropzone'
import { Progress } from '@/components/ui/progress'
import { Upload, X, FileIcon } from 'lucide-react'
import { DefaultService } from '@/src/api'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { Card } from '@/components/ui/card'

interface FileUploadProps {
  onUploadComplete?: (urls: string[]) => void
  acceptedFileTypes?: string[]
  maxSizeMB?: number
  className?: string
  type: 'submission' | 'instruction'
  maxFiles?: number
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
  const [uploadedUrls, setUploadedUrls] = useState<string[]>([])
  const [uploadedFiles, setUploadedFiles] = useState<
    { name: string; url: string }[]
  >([])

  const removeFile = (index: number) => {
    const newFiles = [...uploadedFiles]
    newFiles.splice(index, 1)
    setUploadedFiles(newFiles)

    const newUrls = [...uploadedUrls]
    newUrls.splice(index, 1)
    setUploadedUrls(newUrls)

    if (onUploadComplete) {
      onUploadComplete(newUrls)
    }
  }

  const onDrop = useCallback(
    async (acceptedFiles: File[]) => {
      if (uploadedFiles.length + acceptedFiles.length > maxFiles) {
        toast.error(`Maximum ${maxFiles} files allowed`)
        return
      }

      const uploadFile = async (file: File): Promise<string> => {
        if (file.size > maxSizeMB * 1024 * 1024) {
          throw new Error(`File ${file.name} exceeds ${maxSizeMB}MB limit`)
        }

        if (!acceptedFileTypes.includes(file.type)) {
          throw new Error('Invalid file type')
        }

        const urlData = await DefaultService.getUploadUrl(
          file.name,
          type,
          file.type
        )

        if (!urlData.success || !urlData.upload_url || !urlData.permanent_url) {
          throw new Error(urlData.message || 'Failed to get upload URL')
        }

        return new Promise((resolve, reject) => {
          const formData = new FormData()
          Object.entries(urlData.upload_url?.fields || {}).forEach(
            ([key, value]) => {
              formData.append(key, value as string)
            }
          )
          formData.append('file', file)

          const xhr = new XMLHttpRequest()
          xhr.upload.onprogress = (event) => {
            if (event.lengthComputable) {
              const percentComplete = (event.loaded / event.total) * 100
              setProgress(percentComplete)
            }
          }

          xhr.onload = () => {
            if (xhr.status === 204 || xhr.status === 200) {
              resolve(urlData.permanent_url || '')
            } else {
              reject(new Error('Upload failed'))
            }
          }

          xhr.onerror = () => reject(new Error('Upload failed'))
          xhr.open('POST', urlData.upload_url?.url || '')
          xhr.send(formData)
        })
      }

      setUploading(true)
      setProgress(0)

      try {
        const urls: string[] = []
        const files: { name: string; url: string }[] = []

        for (const file of acceptedFiles) {
          const url = await uploadFile(file)
          urls.push(url)
          files.push({ name: file.name, url })
        }

        setUploadedUrls((prev) => [...prev, ...urls])
        setUploadedFiles((prev) => [...prev, ...files])
        toast.success('File uploaded successfully')
        if (onUploadComplete) {
          onUploadComplete([...uploadedUrls, ...urls])
        }
      } catch (err: unknown) {
        if (err instanceof Error) {
          toast.error(err.message)
        } else {
          toast.error('An unknown error occurred')
        }
      } finally {
        setUploading(false)
      }
    },
    [
      maxSizeMB,
      onUploadComplete,
      uploadedFiles,
      maxFiles,
      acceptedFileTypes,
      type,
    ]
  )

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop,
    accept: acceptedFileTypes.reduce(
      (acc, type) => ({ ...acc, [type]: [] }),
      {}
    ),
    multiple: maxFiles > 1,
    maxFiles,
  })

  return (
    <div className={className}>
      <div
        {...getRootProps()}
        className={`relative rounded-lg border-2 border-dashed p-6 transition-colors ${
          isDragActive
            ? 'border-primary bg-primary/5'
            : uploadedFiles.length >= maxFiles
              ? 'cursor-not-allowed border-muted-foreground/25 opacity-50'
              : 'border-muted-foreground/25 hover:border-muted-foreground/50'
        }`}
      >
        <input
          {...getInputProps()}
          disabled={uploadedFiles.length >= maxFiles}
        />
        <div className='flex flex-col items-center gap-2'>
          <Upload
            className={`h-8 w-8 ${uploadedFiles.length >= maxFiles ? 'text-muted-foreground/50' : 'text-muted-foreground'}`}
          />
          <div className='text-center text-sm'>
            {isDragActive ? (
              <p className='font-medium text-primary'>Drop the files here</p>
            ) : uploadedFiles.length >= maxFiles ? (
              <p className='text-muted-foreground'>
                Maximum number of files reached
              </p>
            ) : (
              <p className='text-muted-foreground'>
                Drag & drop files here, or click to select
                <br />
                <span className='text-xs'>
                  Accepted types: {acceptedFileTypes.join(', ')} (Max{' '}
                  {maxSizeMB}MB per file, {maxFiles} file
                  {maxFiles > 1 ? 's' : ''} max)
                </span>
              </p>
            )}
          </div>
        </div>
      </div>

      {uploadedFiles.length > 0 && (
        <div className='mt-4 space-y-2'>
          <p className='text-sm font-medium'>
            Uploaded files: {uploadedFiles.length}/{maxFiles}
          </p>
          <div className='space-y-2'>
            {uploadedFiles.map((file, index) => (
              <Card
                key={file.url}
                className='flex items-center justify-between p-2'
              >
                <div className='flex items-center gap-2'>
                  <FileIcon className='h-4 w-4 text-muted-foreground' />
                  <span className='max-w-[200px] truncate text-sm'>
                    {file.name}
                  </span>
                </div>
                <Button
                  onClick={() => removeFile(index)}
                  variant='ghost'
                  size='icon'
                  className='h-8 w-8 text-muted-foreground hover:text-destructive'
                  aria-label='Remove file'
                >
                  <X className='h-4 w-4' />
                </Button>
              </Card>
            ))}
          </div>
        </div>
      )}

      {uploading && (
        <div className='mt-4'>
          <Progress value={progress} />
          <p className='text-center text-sm text-muted-foreground'>
            Uploading... {Math.round(progress)}%
          </p>
        </div>
      )}
    </div>
  )
}
