import { useState, useEffect } from 'react'
import { useAuth } from '../contexts/AuthContext'
import { api } from '../services/api'
import { DocumentTextIcon, PlusIcon } from '@heroicons/react/24/outline'
import toast from 'react-hot-toast'

export default function Certificates() {
  const { user } = useAuth()
  const [certificates, setCertificates] = useState([])
  const [loading, setLoading] = useState(true)
  const [generating, setGenerating] = useState(false)

  useEffect(() => {
    fetchCertificates()
  }, [])

  const fetchCertificates = async () => {
    try {
      setLoading(true)
      const response = await api.get(`/certificates/user/${user.id}`)
      setCertificates(response.data.certificates)
    } catch (error) {
      console.error('Failed to fetch certificates:', error)
    } finally {
      setLoading(false)
    }
  }

  const generateMissingCertificates = async () => {
    try {
      setGenerating(true)
      const response = await api.post('/certificates/generate-all')
      toast.success(response.data.message)
      await fetchCertificates() // Refresh the list
    } catch (error) {
      console.error('Failed to generate certificates:', error)
      toast.error('Failed to generate certificates')
    } finally {
      setGenerating(false)
    }
  }

  const downloadCertificate = async (certificateId) => {
    try {
      const response = await api.get(`/certificates/${certificateId}/download`, {
        responseType: 'blob'
      })
      
      // Create a blob URL and trigger download
      const blob = new Blob([response.data], { type: 'application/pdf' })
      const url = window.URL.createObjectURL(blob)
      const link = document.createElement('a')
      link.href = url
      link.download = `certificate-${certificateId}.pdf`
      document.body.appendChild(link)
      link.click()
      document.body.removeChild(link)
      window.URL.revokeObjectURL(url)
      
      toast.success('Certificate downloaded successfully!')
    } catch (error) {
      console.error('Failed to download certificate:', error)
      toast.error('Failed to download certificate')
    }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary-600"></div>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-start">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">My Certificates</h1>
          <p className="mt-1 text-sm text-gray-500">
            View and download your course completion certificates.
          </p>
        </div>
        <button
          onClick={generateMissingCertificates}
          disabled={generating}
          className="btn btn-primary flex items-center space-x-2"
        >
          <PlusIcon className="h-4 w-4" />
          <span>{generating ? 'Generating...' : 'Generate Missing Certificates'}</span>
        </button>
      </div>

      {certificates.length === 0 ? (
        <div className="text-center py-12">
          <DocumentTextIcon className="mx-auto h-12 w-12 text-gray-400" />
          <h3 className="mt-2 text-sm font-medium text-gray-900">No certificates yet</h3>
          <p className="mt-1 text-sm text-gray-500">
            Complete courses to earn certificates.
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-3">
          {certificates.map((certificate) => (
            <div key={certificate.id} className="bg-white rounded-lg shadow overflow-hidden">
              <div className="p-6">
                <div className="flex items-center justify-between mb-4">
                  <DocumentTextIcon className="h-8 w-8 text-primary-600" />
                  <span className="text-xs text-gray-500">
                    {certificate.certificate_number}
                  </span>
                </div>
                
                <h3 className="text-lg font-semibold text-gray-900 mb-2">
                  {certificate.course_title}
                </h3>
                
                <p className="text-sm text-gray-600 mb-4">
                  Category: {certificate.course_category}
                </p>
                
                <div className="text-sm text-gray-500 mb-4">
                  Issued: {new Date(certificate.issued_at).toLocaleDateString()}
                </div>
                
                <button
                  onClick={() => downloadCertificate(certificate.id)}
                  className="w-full btn btn-primary"
                >
                  Download Certificate
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
