import { useState } from 'react'
import { DocumentTextIcon, EyeIcon, ArrowDownTrayIcon } from '@heroicons/react/24/outline'

export default function PDFViewer({ url, title }) {
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)

  const handleIframeLoad = () => {
    setLoading(false)
  }

  const handleIframeError = () => {
    setError('Failed to load PDF document')
    setLoading(false)
  }

  if (error) {
    return (
      <div className="bg-white shadow rounded-lg p-6">
        <div className="text-center">
          <div className="text-red-500 mb-4">
            <svg className="h-12 w-12 mx-auto" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-1.964-.833-2.732 0L3.732 16.5c-.77.833.192 2.5 1.732 2.5z" />
            </svg>
          </div>
          <h3 className="text-lg font-medium text-gray-900 mb-2">Error Loading PDF</h3>
          <p className="text-sm text-gray-600 mb-4">{error}</p>
          <div className="space-x-4">
            <a
              href={url}
              target="_blank"
              rel="noopener noreferrer"
              className="btn btn-primary"
            >
              <EyeIcon className="h-4 w-4 mr-2" />
              Open PDF in New Tab
            </a>
            <a
              href={url}
              download
              className="btn btn-outline"
            >
              <ArrowDownTrayIcon className="h-4 w-4 mr-2" />
              Download PDF
            </a>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="bg-white shadow rounded-lg overflow-hidden">
      {/* PDF Header */}
      <div className="bg-gray-50 px-6 py-4 border-b border-gray-200">
        <div className="flex items-center justify-between">
          <h2 className="text-lg font-semibold text-gray-900">{title || 'PDF Document'}</h2>
          
          <div className="flex items-center space-x-2">
            <a
              href={url}
              target="_blank"
              rel="noopener noreferrer"
              className="btn btn-outline btn-sm"
            >
              <EyeIcon className="h-4 w-4 mr-2" />
              Open in New Tab
            </a>
            <a
              href={url}
              download
              className="btn btn-outline btn-sm"
            >
              <ArrowDownTrayIcon className="h-4 w-4 mr-2" />
              Download
            </a>
          </div>
        </div>
      </div>

      {/* PDF Content */}
      <div className="relative">
        {loading && (
          <div className="absolute inset-0 flex items-center justify-center bg-white z-10">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary-600"></div>
          </div>
        )}
        
        <iframe
          src={`${url}#toolbar=1&navpanes=1&scrollbar=1`}
          className="w-full h-96 border-0"
          onLoad={handleIframeLoad}
          onError={handleIframeError}
          title={title || 'PDF Document'}
        />
      </div>
    </div>
  )
}
