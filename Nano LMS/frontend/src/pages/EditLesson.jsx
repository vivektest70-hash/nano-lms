import { useState, useEffect } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { useAuth } from '../contexts/AuthContext'
import { api } from '../services/api'
import toast from 'react-hot-toast'
import { ArrowLeftIcon } from '@heroicons/react/24/outline'
import FileUpload from '../components/FileUpload'
import VideoUrlInput from '../components/VideoUrlInput'


export default function EditLesson() {
  const { id } = useParams()
  const { user, isAdmin, isTrainer } = useAuth()
  const navigate = useNavigate()
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [lesson, setLesson] = useState(null)
  const [formData, setFormData] = useState({
    title: '',
    description: '',
    content: '',
    videoUrl: '',
    documentUrl: '',
    durationMinutes: 0,
    orderIndex: 1,
    isPublished: true
  })
  const [uploadedVideo, setUploadedVideo] = useState(null)
  const [uploadedDocument, setUploadedDocument] = useState(null)

  const [durationInfo, setDurationInfo] = useState({ type: '', message: '' })

  useEffect(() => {
    fetchLesson()
  }, [id])

  const fetchLesson = async () => {
    try {
      const response = await api.get(`/lessons/${id}`)
      const lessonData = response.data.lesson
      setLesson(lessonData)
      
      // Check permissions
      if (!canManageLesson(lessonData)) {
        toast.error('You do not have permission to edit this lesson')
        navigate(`/courses/${lessonData.course_id}`)
        return
      }

      setFormData({
        title: lessonData.title || '',
        description: lessonData.description || '',
        content: lessonData.content || '',
        videoUrl: lessonData.video_url || '',
        documentUrl: lessonData.document_url || '',
        durationMinutes: lessonData.duration_minutes || 0,
        orderIndex: lessonData.order_index || 1,
        isPublished: lessonData.is_published !== undefined ? lessonData.is_published : true
      })
      setUploadedVideo(lessonData.video_url || null)
      setUploadedDocument(lessonData.document_url || null)
    } catch (error) {
      console.error('Failed to fetch lesson:', error)
      toast.error('Failed to load lesson details')
      navigate('/courses')
    } finally {
      setLoading(false)
    }
  }

  const canManageLesson = (lessonData) => {
    if (isAdmin) return true
    if (isTrainer && lessonData.instructor_id === user?.id) return true
    return false
  }

  const handleInputChange = (e) => {
    const { name, value, type, checked } = e.target
    setFormData(prev => ({
      ...prev,
      [name]: type === 'checkbox' ? checked : value
    }))
  }

  const handleVideoUpload = (url, filename) => {
    setFormData(prev => ({ ...prev, videoUrl: url }))
    setUploadedVideo(url)
  }

  const handleVideoRemove = () => {
    setFormData(prev => ({ ...prev, videoUrl: '' }))
    setUploadedVideo(null)
  }

  const handleDocumentUpload = (url, filename) => {
    setFormData(prev => ({ ...prev, documentUrl: url }))
    setUploadedDocument(url)
  }

  const handleDocumentRemove = () => {
    setFormData(prev => ({ ...prev, documentUrl: '' }))
    setUploadedDocument(null)
  }





  const isExternalPlatform = (url) => {
    if (!url) return false
    const externalPatterns = [
      /app\.getshow\.io/,
      /getshow\.io/,
      /show\.io/,
      /animaker\.com/,
      /animo\.app/
    ]
    return externalPatterns.some(pattern => pattern.test(url))
  }

  const isDurationRequired = () => {
    const hasVideo = formData.videoUrl && formData.videoUrl.trim() !== ''
    const hasDocument = formData.documentUrl && formData.documentUrl.trim() !== ''
    const hasContent = formData.content && formData.content.trim() !== ''
    const hasSubstantialContent = hasContent && formData.content.trim().length > 50 // Only consider substantial content
    const isExternalVideo = hasVideo && isExternalPlatform(formData.videoUrl)
    
    // Duration is required for:
    // 1. Document-only lessons (no video)
    // 2. Content-only lessons (no video, no document)
    // 3. Mixed lessons (video + document, or video + substantial content)
    // 4. External platform videos (Show.io, Animaker, etc.)
    // Duration is NOT required for video-only lessons or video + minimal content (except external platforms)
    return hasDocument || (hasContent && !hasVideo) || (hasVideo && hasDocument) || (hasVideo && hasSubstantialContent) || isExternalVideo || (!hasVideo && !hasDocument && !hasContent)
  }

  const getDurationMessage = () => {
    const hasVideo = formData.videoUrl && formData.videoUrl.trim() !== ''
    const hasDocument = formData.documentUrl && formData.documentUrl.trim() !== ''
    const hasContent = formData.content && formData.content.trim() !== ''
    const hasSubstantialContent = hasContent && formData.content.trim().length > 50
    const isExternalVideo = hasVideo && isExternalPlatform(formData.videoUrl)
    
    if (isExternalVideo && !hasDocument && !hasSubstantialContent) {
      // External platform video-only lesson
      return {
        type: 'warning',
        message: 'Duration is required for external video platforms (Show.io, Animaker, etc.)'
      }
    } else if (hasVideo && !hasDocument && !hasSubstantialContent) {
      // Video-only lesson (or video + minimal content)
      return {
        type: 'info',
        message: 'Duration will be automatically calculated from the video'
      }
    } else if (hasVideo && hasDocument) {
      // Mixed lesson (video + document)
      return {
        type: 'warning',
        message: 'Video duration will be auto-calculated. Please add duration for document portion.'
      }
    } else if (hasVideo && hasSubstantialContent) {
      // Mixed lesson (video + substantial content)
      return {
        type: 'warning',
        message: 'Video duration will be auto-calculated. Please add duration for content portion.'
      }
    } else if (hasDocument && !hasVideo) {
      // Document-only lesson
      return {
        type: 'warning',
        message: 'Duration is required for document-based lessons'
      }
    } else if (hasContent && !hasVideo && !hasDocument) {
      // Content-only lesson
      return {
        type: 'warning',
        message: 'Duration is required for content-based lessons'
      }
    } else {
      // No content at all
      return {
        type: 'info',
        message: 'Please provide duration for this lesson'
      }
    }
  }

  const handleSubmit = async (e) => {
    e.preventDefault()
    
    if (!formData.title.trim()) {
      toast.error('Lesson title is required')
      return
    }

    // Check if duration is required but not provided
    if (isDurationRequired() && (!formData.durationMinutes || formData.durationMinutes <= 0)) {
      toast.error('Duration is required for this lesson type')
      return
    }

    setSaving(true)
    try {
      await api.put(`/lessons/${id}`, formData)
      toast.success('Lesson updated successfully!')
      navigate(`/courses/${lesson.course_id}`)
    } catch (error) {
      const message = error.response?.data?.message || 'Failed to update lesson'
      toast.error(message)
    } finally {
      setSaving(false)
    }
  }

  if (loading) {
    return (
      <div className="flex justify-center items-center py-12">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary-600"></div>
      </div>
    )
  }

  if (!lesson) {
    return (
      <div className="text-center py-12">
        <h3 className="text-lg font-medium text-gray-900">Lesson not found</h3>
        <p className="text-sm text-gray-500">The lesson you're trying to edit doesn't exist.</p>
        <button onClick={() => navigate('/courses')} className="btn btn-primary mt-4">
          Back to Courses
        </button>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div className="flex items-center space-x-3">
          <button
            onClick={() => navigate(`/courses/${lesson.course_id}`)}
            className="btn btn-outline"
          >
            <ArrowLeftIcon className="h-4 w-4 mr-2" />
            Back to Course
          </button>
          <div>
            <h1 className="text-2xl font-bold text-gray-900">Edit Lesson</h1>
            <p className="text-sm text-gray-500">
              Update lesson information for "{lesson.course_title}"
            </p>
          </div>
        </div>
      </div>

      <div className="bg-white shadow rounded-lg p-6">
        <form onSubmit={handleSubmit} className="space-y-6">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Lesson Title *
            </label>
            <input
              type="text"
              name="title"
              required
              className="input w-full"
              value={formData.title}
              onChange={handleInputChange}
              placeholder="Enter lesson title"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Description
            </label>
            <textarea
              name="description"
              rows={3}
              className="input w-full"
              value={formData.description}
              onChange={handleInputChange}
              placeholder="Enter lesson description"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Content
            </label>
            <textarea
              name="content"
              rows={6}
              className="input w-full"
              value={formData.content}
              onChange={handleInputChange}
              placeholder="Enter lesson content (text, instructions, etc.)"
            />
          </div>

          <div className="grid grid-cols-1 gap-6 sm:grid-cols-2">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Video URL (YouTube, Animaker, or file)
              </label>
              <VideoUrlInput
                value={formData.videoUrl}
                onChange={(value) => setFormData(prev => ({ ...prev, videoUrl: value }))}
                placeholder="https://youtube.com/watch?v=... or https://app.getshow.io/iframe/media/..."
              />
            </div>
            
            <FileUpload
              type="document"
              onUpload={handleDocumentUpload}
              onRemove={handleDocumentRemove}
              currentFile={uploadedDocument}
            />
          </div>

          <div className="grid grid-cols-1 gap-6 sm:grid-cols-2">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Upload Video File (Alternative)
              </label>
              <FileUpload
                type="video"
                onUpload={handleVideoUpload}
                onRemove={handleVideoRemove}
                currentFile={uploadedVideo}
              />
            </div>
            
            <div className="flex items-end">
              <p className="text-xs text-gray-500">
                You can either enter a video URL (YouTube/Animaker) or upload a video file. 
                URL takes precedence if both are provided.
              </p>
            </div>
          </div>



          <div className="grid grid-cols-1 gap-6 sm:grid-cols-3">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Duration (minutes) {isDurationRequired() && <span className="text-red-500">*</span>}
              </label>
              <input
                type="number"
                name="durationMinutes"
                min="0"
                className="input w-full"
                value={formData.durationMinutes}
                onChange={handleInputChange}
                placeholder="30"
                required={isDurationRequired()}
                                  disabled={!isDurationRequired() && formData.videoUrl && !formData.documentUrl && (!formData.content || formData.content.trim().length <= 50) && !isExternalPlatform(formData.videoUrl)}
              />
              {getDurationMessage().message && (
                <p className={`mt-1 text-xs ${
                  getDurationMessage().type === 'warning' 
                    ? 'text-orange-600' 
                    : 'text-blue-600'
                }`}>
                  {getDurationMessage().message}
                </p>
              )}
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Order Index
              </label>
              <input
                type="number"
                name="orderIndex"
                min="1"
                className="input w-full"
                value={formData.orderIndex}
                onChange={handleInputChange}
                placeholder="1"
              />
            </div>

            <div className="flex items-center pt-6">
              <input
                type="checkbox"
                name="isPublished"
                id="isPublished"
                className="h-4 w-4 text-primary-600 focus:ring-primary-500 border-gray-300 rounded"
                checked={formData.isPublished}
                onChange={handleInputChange}
              />
              <label htmlFor="isPublished" className="ml-2 block text-sm text-gray-900">
                Publish lesson
              </label>
            </div>
          </div>

          <div className="flex justify-end space-x-3 pt-6">
            <button
              type="button"
              onClick={() => navigate(`/courses/${lesson.course_id}`)}
              className="btn btn-outline"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={saving}
              className="btn btn-primary"
            >
              {saving ? 'Saving...' : 'Save Changes'}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}
