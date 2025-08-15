import { useState, useRef } from 'react'
import { api } from '../services/api'
import toast from 'react-hot-toast'
import { CloudArrowUpIcon, XMarkIcon } from '@heroicons/react/24/outline'

export default function FileUpload({ 
  type = 'document', // 'video' or 'document'
  onUpload, 
  onRemove, 
  currentFile = null,
  className = ''
}) {
  const [uploading, setUploading] = useState(false)
  const [dragActive, setDragActive] = useState(false)
  const fileInputRef = useRef(null)

  const handleUpload = async (file) => {
    if (!file) return

    setUploading(true)
    const formData = new FormData()
    formData.append(type, file)

    try {
      const response = await api.post(`/upload/${type}`, formData, {
        headers: {
          'Content-Type': 'multipart/form-data',
        },
      })

      const uploadedFile = response.data.file
      onUpload(uploadedFile.url, uploadedFile.filename)
      toast.success(`${type.charAt(0).toUpperCase() + type.slice(1)} uploaded successfully!`)
    } catch (error) {
      console.error('Upload error:', error)
      const message = error.response?.data?.message || `Failed to upload ${type}`
      toast.error(message)
    } finally {
      setUploading(false)
    }
  }

  const handleFileSelect = (e) => {
    const file = e.target.files[0]
    if (file) {
      handleUpload(file)
    }
  }

  const handleDrag = (e) => {
    e.preventDefault()
    e.stopPropagation()
    if (e.type === 'dragenter' || e.type === 'dragover') {
      setDragActive(true)
    } else if (e.type === 'dragleave') {
      setDragActive(false)
    }
  }

  const handleDrop = (e) => {
    e.preventDefault()
    e.stopPropagation()
    setDragActive(false)

    const file = e.dataTransfer.files[0]
    if (file) {
      handleUpload(file)
    }
  }

  const handleRemove = () => {
    onRemove()
    if (fileInputRef.current) {
      fileInputRef.current.value = ''
    }
  }

  const getAcceptedTypes = () => {
    if (type === 'video') {
      return '.mp4,.webm,.ogg,.avi,.mov'
    }
    return '.pdf,.doc,.docx,.txt'
  }

  const getFileTypeLabel = () => {
    if (type === 'video') {
      return 'Video file (MP4, WebM, OGG, AVI, MOV)'
    }
    return 'Document file (PDF, DOC, DOCX, TXT)'
  }

  return (
    <div className={`space-y-3 ${className}`}>
      <label className="block text-sm font-medium text-gray-700">
        Upload {type.charAt(0).toUpperCase() + type.slice(1)}
      </label>
      
      {currentFile ? (
        <div className="flex items-center justify-between p-3 bg-green-50 border border-green-200 rounded-lg">
          <div className="flex items-center space-x-3">
            <CloudArrowUpIcon className="h-5 w-5 text-green-600" />
            <div>
              <p className="text-sm font-medium text-green-800">
                {currentFile.split('/').pop()}
              </p>
              <p className="text-xs text-green-600">File uploaded successfully</p>
            </div>
          </div>
          <button
            type="button"
            onClick={handleRemove}
            className="text-red-600 hover:text-red-800"
          >
            <XMarkIcon className="h-4 w-4" />
          </button>
        </div>
      ) : (
        <div
          className={`relative border-2 border-dashed rounded-lg p-6 text-center transition-colors ${
            dragActive 
              ? 'border-primary-500 bg-primary-50' 
              : 'border-gray-300 hover:border-gray-400'
          }`}
          onDragEnter={handleDrag}
          onDragLeave={handleDrag}
          onDragOver={handleDrag}
          onDrop={handleDrop}
        >
          <input
            ref={fileInputRef}
            type="file"
            accept={getAcceptedTypes()}
            onChange={handleFileSelect}
            className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
            disabled={uploading}
          />
          
          <div className="space-y-2">
            <CloudArrowUpIcon className="mx-auto h-8 w-8 text-gray-400" />
            <div>
              <p className="text-sm font-medium text-gray-900">
                {uploading ? 'Uploading...' : `Click to upload ${type}`}
              </p>
              <p className="text-xs text-gray-500">
                {getFileTypeLabel()}
              </p>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}


