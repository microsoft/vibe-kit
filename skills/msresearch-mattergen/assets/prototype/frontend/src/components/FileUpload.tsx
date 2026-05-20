import { useCallback, useState } from 'react'
import type { Structure } from '../api/types'
import { parseUploadedFiles } from '../api/client'

interface FileUploadProps {
  onFilesUploaded: (structures: Structure[]) => void
}

export function FileUpload({ onFilesUploaded }: FileUploadProps) {
  const [isDragging, setIsDragging] = useState(false)
  const [isProcessing, setIsProcessing] = useState(false)

  const handleFiles = useCallback(
    async (files: FileList | null) => {
      if (!files || files.length === 0) return

      const validFiles = Array.from(files).filter(
        (f) =>
          f.name.endsWith('.cif') ||
          f.name.endsWith('.extxyz') ||
          f.name.endsWith('.xyz')
      )

      if (validFiles.length === 0) {
        alert('No valid files. Please upload .cif, .extxyz, or .xyz files.')
        return
      }

      setIsProcessing(true)
      try {
        // This is a stub - parses files into mock structures
        const structures = await parseUploadedFiles(validFiles)
        onFilesUploaded(structures)
      } catch (err) {
        console.error('Failed to parse files:', err)
        alert('Failed to parse files')
      } finally {
        setIsProcessing(false)
      }
    },
    [onFilesUploaded]
  )

  const handleDrop = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault()
      setIsDragging(false)
      handleFiles(e.dataTransfer.files)
    },
    [handleFiles]
  )

  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault()
    setIsDragging(true)
  }, [])

  const handleDragLeave = useCallback((e: React.DragEvent) => {
    e.preventDefault()
    setIsDragging(false)
  }, [])

  const handleInputChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      handleFiles(e.target.files)
      e.target.value = '' // Reset to allow re-uploading same file
    },
    [handleFiles]
  )

  return (
    <div
      onDrop={handleDrop}
      onDragOver={handleDragOver}
      onDragLeave={handleDragLeave}
      data-tour="file-upload"
      className={`
        relative rounded-lg border-2 border-dashed p-6 text-center transition-colors
        ${
          isDragging
            ? 'border-accent bg-accent/10'
            : 'border-border hover:border-border-bright'
        }
        ${isProcessing ? 'pointer-events-none opacity-50' : ''}
      `}
    >
      <input
        type="file"
        multiple
        accept=".cif,.extxyz,.xyz"
        onChange={handleInputChange}
        className="absolute inset-0 cursor-pointer opacity-0"
        disabled={isProcessing}
      />

      <div className="pointer-events-none">
        <div className="text-2xl">📁</div>
        <p className="mt-2 text-sm text-text-muted">
          {isProcessing ? 'Processing...' : 'Upload files'}
        </p>
        <p className="mt-1 text-xs text-text-dim">or drag & drop</p>
        <p className="mt-2 text-xs text-text-dim">.cif, .extxyz, .xyz</p>
      </div>
    </div>
  )
}
