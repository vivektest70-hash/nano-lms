import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '../contexts/AuthContext'
import { api } from '../services/api'
import toast from 'react-hot-toast'
import { 
  PlusIcon, 
  XMarkIcon, 
  DocumentIcon, 
  VideoCameraIcon,
  PhotoIcon 
} from '@heroicons/react/24/outline'
import VideoUrlInput from '../components/VideoUrlInput'

export default function CreateCourse() {
  const { isTrainer } = useAuth()
  const navigate = useNavigate()
  const [loading, setLoading] = useState(false)
  const [formData, setFormData] = useState({
    title: '',
    description: '',
    category: '',
    difficultyLevel: 'beginner',
    work_type: 'All',
    isPublished: false
  })
  const [uploadedFiles, setUploadedFiles] = useState({
    thumbnail: null,
    videos: [],
    documents: []
  })
  const [lessons, setLessons] = useState([
    {
      title: '',
      description: '',
      content: '',
      durationMinutes: 0,
      videoUrl: '',
      documentUrl: '',
      orderIndex: 1
    }
  ])

  if (!isTrainer) {
    return (
      <div className="text-center py-12">
        <h3 className="text-lg font-medium text-gray-900">Access Denied</h3>
        <p className="text-sm text-gray-500">You need trainer privileges to create courses.</p>
      </div>
    )
  }

  const handleInputChange = (e) => {
    const { name, value, type, checked } = e.target
    setFormData(prev => ({
      ...prev,
      [name]: type === 'checkbox' ? checked : value
    }))
  }

  const handleLessonChange = (index, field, value) => {
    const updatedLessons = [...lessons]
    updatedLessons[index] = {
      ...updatedLessons[index],
      [field]: value
    }
    setLessons(updatedLessons)
  }

  const addLesson = () => {
    setLessons([
      ...lessons,
      {
        title: '',
        description: '',
        content: '',
        durationMinutes: 0,
        videoUrl: '',
        documentUrl: '',
        orderIndex: lessons.length + 1
      }
    ])
  }

  const removeLesson = (index) => {
    if (lessons.length > 1) {
      const updatedLessons = lessons.filter((_, i) => i !== index)
      // Update order indices
      updatedLessons.forEach((lesson, i) => {
        lesson.orderIndex = i + 1
      })
      setLessons(updatedLessons)
    }
  }

  const handleFileUpload = async (file, type) => {
    try {
      const formData = new FormData()
      formData.append(type, file)

      const response = await api.post(`/upload/${type}`, formData, {
        headers: {
          'Content-Type': 'multipart/form-data'
        }
      })

      const uploadedFile = response.data.file
      
      setUploadedFiles(prev => ({
        ...prev,
        [type === 'image' ? 'thumbnail' : type === 'video' ? 'videos' : 'documents']: 
          type === 'image' ? uploadedFile : 
          type === 'video' ? [...prev.videos, uploadedFile] : 
          [...prev.documents, uploadedFile]
      }))

      toast.success(`${type.charAt(0).toUpperCase() + type.slice(1)} uploaded successfully!`)
      return uploadedFile
    } catch (error) {
      toast.error(`Failed to upload ${type}: ${error.response?.data?.message || error.message}`)
      return null
    }
  }

  const handleFileDrop = (e, type) => {
    e.preventDefault()
    const files = Array.from(e.dataTransfer.files)
    files.forEach(file => handleFileUpload(file, type))
  }

  const handleFileSelect = (e, type) => {
    const files = Array.from(e.target.files)
    files.forEach(file => handleFileUpload(file, type))
  }

  const removeFile = (file, type) => {
    setUploadedFiles(prev => ({
      ...prev,
      [type === 'video' ? 'videos' : 'documents']: 
        prev[type === 'video' ? 'videos' : 'documents'].filter(f => f.filename !== file.filename)
    }))
  }

  const assignFileToLesson = (lessonIndex, file, type) => {
    const updatedLessons = [...lessons]
    updatedLessons[lessonIndex] = {
      ...updatedLessons[lessonIndex],
      [type === 'video' ? 'videoUrl' : 'documentUrl']: file.url
    }
    setLessons(updatedLessons)
  }

  const handleSubmit = async (e) => {
    e.preventDefault()
    setLoading(true)

    try {
      // Create course first
      const courseData = {
        ...formData,
        thumbnailUrl: uploadedFiles.thumbnail?.url || null
      }

      const courseResponse = await api.post('/courses', courseData)
      const courseId = courseResponse.data.course.id

      // Create lessons for the course
      let lessonIndex = 1
      
      // Create explicit lessons
      for (let i = 0; i < lessons.length; i++) {
        const lesson = lessons[i]
        if (lesson.title.trim()) {
          await api.post('/lessons', {
            courseId: courseId,
            title: lesson.title,
            description: lesson.description,
            content: lesson.content,
            durationMinutes: lesson.durationMinutes,
            videoUrl: lesson.videoUrl,
            documentUrl: lesson.documentUrl,
            orderIndex: lesson.orderIndex,
            isPublished: formData.isPublished
          })
          lessonIndex = Math.max(lessonIndex, lesson.orderIndex + 1)
        }
      }
      
      // Create lessons for unassigned videos
      const unassignedVideos = uploadedFiles.videos.filter(video => 
        !lessons.some(lesson => lesson.videoUrl === video.url)
      )
      
      console.log('Unassigned videos:', unassignedVideos)
      console.log('Uploaded files:', uploadedFiles)
      
      for (const video of unassignedVideos) {
        console.log('Creating lesson for video:', video)
        await api.post('/lessons', {
          courseId: courseId,
          title: `Video Lesson ${lessonIndex}`,
          description: `Video content from ${video.originalname}`,
          content: '',
          durationMinutes: 30,
          videoUrl: video.url,
          documentUrl: null,
          orderIndex: lessonIndex,
          isPublished: formData.isPublished
        })
        lessonIndex++
      }
      
      // Create lessons for unassigned documents
      const unassignedDocuments = uploadedFiles.documents.filter(doc => 
        !lessons.some(lesson => lesson.documentUrl === doc.url)
      )
      
      for (const doc of unassignedDocuments) {
        await api.post('/lessons', {
          courseId: courseId,
          title: `Document Lesson ${lessonIndex}`,
          description: `Document content from ${doc.originalname}`,
          content: '',
          durationMinutes: 15,
          videoUrl: null,
          documentUrl: doc.url,
          orderIndex: lessonIndex,
          isPublished: formData.isPublished
        })
        lessonIndex++
      }
      
      const totalLessons = lessons.filter(l => l.title.trim()).length + unassignedVideos.length + unassignedDocuments.length
      toast.success(`Course created successfully with ${totalLessons} lesson${totalLessons !== 1 ? 's' : ''}!`)
      navigate(`/courses/${courseId}`)
    } catch (error) {
      toast.error(`Failed to create course: ${error.response?.data?.message || error.message}`)
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Create New Course</h1>
        <p className="mt-1 text-sm text-gray-500">
          Create a new course with lessons, videos, and documents.
        </p>
      </div>

      <form onSubmit={handleSubmit} className="space-y-6">
        {/* Course Information */}
        <div className="bg-white shadow rounded-lg p-6">
          <h3 className="text-lg font-medium text-gray-900 mb-4">Course Information</h3>
          
          <div className="grid grid-cols-1 gap-6 sm:grid-cols-2">
            <div>
              <label className="block text-sm font-medium text-gray-700">
                Course Title *
              </label>
              <input
                type="text"
                name="title"
                required
                className="input mt-1"
                value={formData.title}
                onChange={handleInputChange}
                placeholder="Enter course title"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700">
                Category
              </label>
              <input
                type="text"
                name="category"
                className="input mt-1"
                value={formData.category}
                onChange={handleInputChange}
                placeholder="e.g., Programming, Marketing, Design"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700">
                Difficulty Level
              </label>
              <select
                name="difficultyLevel"
                className="input mt-1"
                value={formData.difficultyLevel}
                onChange={handleInputChange}
              >
                <option value="beginner">Beginner</option>
                <option value="intermediate">Intermediate</option>
                <option value="advanced">Advanced</option>
              </select>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700">
                Work Type *
              </label>
              <select
                name="work_type"
                required
                className="input mt-1"
                value={formData.work_type}
                onChange={handleInputChange}
              >
                          <option value="All">All Work Types</option>
          <option value="Operations">Operations</option>
          <option value="Sales">Sales</option>
          <option value="Marketing">Marketing</option>
          <option value="Tech">Tech</option>
              </select>
            </div>


          </div>

          <div className="mt-6">
            <label className="block text-sm font-medium text-gray-700">
              Description
            </label>
            <textarea
              name="description"
              rows={4}
              className="input mt-1"
              value={formData.description}
              onChange={handleInputChange}
              placeholder="Describe your course..."
            />
          </div>

          <div className="mt-6">
            <label className="flex items-center">
              <input
                type="checkbox"
                name="isPublished"
                className="rounded border-gray-300 text-primary-600 focus:ring-primary-500"
                checked={formData.isPublished}
                onChange={handleInputChange}
              />
              <span className="ml-2 text-sm text-gray-700">Publish course immediately</span>
            </label>
          </div>
        </div>

        {/* Thumbnail Upload */}
        <div className="bg-white shadow rounded-lg p-6">
          <h3 className="text-lg font-medium text-gray-900 mb-4">Course Thumbnail</h3>
          
          <div className="flex items-center space-x-4">
            {uploadedFiles.thumbnail ? (
              <div className="relative">
                <img
                  src={uploadedFiles.thumbnail.url}
                  alt="Course thumbnail"
                  className="w-32 h-24 object-cover rounded-lg"
                />
                <button
                  type="button"
                  onClick={() => setUploadedFiles(prev => ({ ...prev, thumbnail: null }))}
                  className="absolute -top-2 -right-2 bg-red-500 text-white rounded-full p-1 hover:bg-red-600"
                >
                  <XMarkIcon className="h-4 w-4" />
                </button>
              </div>
            ) : (
              <div
                className="w-32 h-24 border-2 border-dashed border-gray-300 rounded-lg flex items-center justify-center cursor-pointer hover:border-gray-400"
                onClick={() => document.getElementById('thumbnail-upload').click()}
              >
                <PhotoIcon className="h-8 w-8 text-gray-400" />
              </div>
            )}
            
            <div>
              <button
                type="button"
                onClick={() => document.getElementById('thumbnail-upload').click()}
                className="btn btn-outline"
              >
                Upload Thumbnail
              </button>
              <input
                id="thumbnail-upload"
                type="file"
                accept="image/*"
                className="hidden"
                onChange={(e) => handleFileSelect(e, 'image')}
              />
            </div>
          </div>
        </div>

        {/* File Upload Section */}
        <div className="bg-white shadow rounded-lg p-6">
          <h3 className="text-lg font-medium text-gray-900 mb-4">Upload Training Materials</h3>
          
          {/* Video Upload */}
          <div className="mb-6">
            <h4 className="text-md font-medium text-gray-700 mb-3">Training Videos</h4>
            <div
              className="border-2 border-dashed border-gray-300 rounded-lg p-6 text-center hover:border-gray-400 cursor-pointer"
              onDrop={(e) => handleFileDrop(e, 'video')}
              onDragOver={(e) => e.preventDefault()}
              onClick={() => document.getElementById('video-upload').click()}
            >
              <VideoCameraIcon className="mx-auto h-12 w-12 text-gray-400" />
              <p className="mt-2 text-sm text-gray-600">
                Drop video files here or click to select
              </p>
              <p className="text-xs text-gray-500">
                Supported formats: MP4, WebM, OGG, AVI, MOV (max 100MB)
              </p>
            </div>
            
            <input
              id="video-upload"
              type="file"
              accept="video/*"
              multiple
              className="hidden"
              onChange={(e) => handleFileSelect(e, 'video')}
            />

            {uploadedFiles.videos.length > 0 && (
              <div className="mt-4 space-y-2">
                {uploadedFiles.videos.map((video, index) => (
                  <div key={index} className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
                    <div className="flex items-center space-x-3">
                      <VideoCameraIcon className="h-5 w-5 text-gray-400" />
                      <div>
                        <p className="text-sm font-medium text-gray-900">{video.originalname}</p>
                        <p className="text-xs text-gray-500">{(video.size / 1024 / 1024).toFixed(2)} MB</p>
                      </div>
                    </div>
                    <button
                      type="button"
                      onClick={() => removeFile(video, 'video')}
                      className="text-red-500 hover:text-red-700"
                    >
                      <XMarkIcon className="h-5 w-5" />
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Document Upload */}
          <div>
            <h4 className="text-md font-medium text-gray-700 mb-3">Training Documents</h4>
            <div
              className="border-2 border-dashed border-gray-300 rounded-lg p-6 text-center hover:border-gray-400 cursor-pointer"
              onDrop={(e) => handleFileDrop(e, 'document')}
              onDragOver={(e) => e.preventDefault()}
              onClick={() => document.getElementById('document-upload').click()}
            >
              <DocumentIcon className="mx-auto h-12 w-12 text-gray-400" />
              <p className="mt-2 text-sm text-gray-600">
                Drop document files here or click to select
              </p>
              <p className="text-xs text-gray-500">
                Supported formats: PDF, DOC, DOCX, TXT (max 100MB)
              </p>
            </div>
            
            <input
              id="document-upload"
              type="file"
              accept=".pdf,.doc,.docx,.txt"
              multiple
              className="hidden"
              onChange={(e) => handleFileSelect(e, 'document')}
            />

            {uploadedFiles.documents.length > 0 && (
              <div className="mt-4 space-y-2">
                {uploadedFiles.documents.map((doc, index) => (
                  <div key={index} className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
                    <div className="flex items-center space-x-3">
                      <DocumentIcon className="h-5 w-5 text-gray-400" />
                      <div>
                        <p className="text-sm font-medium text-gray-900">{doc.originalname}</p>
                        <p className="text-xs text-gray-500">{(doc.size / 1024 / 1024).toFixed(2)} MB</p>
                      </div>
                    </div>
                    <button
                      type="button"
                      onClick={() => removeFile(doc, 'document')}
                      className="text-red-500 hover:text-red-700"
                    >
                      <XMarkIcon className="h-5 w-5" />
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* Lessons Section */}
        <div className="bg-white shadow rounded-lg p-6">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-lg font-medium text-gray-900">Course Lessons</h3>
            <button
              type="button"
              onClick={addLesson}
              className="btn btn-outline btn-sm"
            >
              <PlusIcon className="h-4 w-4 mr-2" />
              Add Lesson
            </button>
          </div>
          
          <div className="space-y-6">
            {lessons.map((lesson, index) => (
              <div key={index} className="border border-gray-200 rounded-lg p-4">
                <div className="flex items-center justify-between mb-4">
                  <h4 className="text-md font-medium text-gray-900">Lesson {index + 1}</h4>
                  {lessons.length > 1 && (
                    <button
                      type="button"
                      onClick={() => removeLesson(index)}
                      className="text-red-500 hover:text-red-700"
                    >
                      <XMarkIcon className="h-5 w-5" />
                    </button>
                  )}
                </div>
                
                <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                  <div>
                    <label className="block text-sm font-medium text-gray-700">
                      Lesson Title *
                    </label>
                    <input
                      type="text"
                      className="input mt-1"
                      value={lesson.title}
                      onChange={(e) => handleLessonChange(index, 'title', e.target.value)}
                      placeholder="Enter lesson title"
                    />
                  </div>
                  
                  <div>
                    <label className="block text-sm font-medium text-gray-700">
                      Duration (minutes)
                    </label>
                    <input
                      type="number"
                      min="0"
                      className="input mt-1"
                      value={lesson.durationMinutes}
                      onChange={(e) => handleLessonChange(index, 'durationMinutes', parseInt(e.target.value) || 0)}
                      placeholder="0"
                    />
                  </div>
                </div>
                
                <div className="mt-4">
                  <label className="block text-sm font-medium text-gray-700">
                    Description
                  </label>
                  <textarea
                    rows={2}
                    className="input mt-1"
                    value={lesson.description}
                    onChange={(e) => handleLessonChange(index, 'description', e.target.value)}
                    placeholder="Brief description of this lesson"
                  />
                </div>
                
                <div className="mt-4">
                  <label className="block text-sm font-medium text-gray-700">
                    Content
                  </label>
                  <textarea
                    rows={4}
                    className="input mt-1"
                    value={lesson.content}
                    onChange={(e) => handleLessonChange(index, 'content', e.target.value)}
                    placeholder="Detailed lesson content..."
                  />
                </div>
                
                {/* Video URL Input */}
                <div className="mt-4">
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Video URL (YouTube, Animaker, or file)
                  </label>
                  <VideoUrlInput
                    value={lesson.videoUrl}
                    onChange={(value) => handleLessonChange(index, 'videoUrl', value)}
                    placeholder="https://youtube.com/watch?v=... or https://app.getshow.io/iframe/media/..."
                  />
                </div>

                {/* Assign Files to Lesson */}
                <div className="mt-4 space-y-3">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Assign Uploaded Video to this Lesson (Alternative)
                    </label>
                    <select
                      className="input"
                      value={lesson.videoUrl}
                      onChange={(e) => handleLessonChange(index, 'videoUrl', e.target.value)}
                    >
                      <option value="">No video</option>
                      {uploadedFiles.videos.map((video, vIndex) => (
                        <option key={vIndex} value={video.url}>
                          {video.originalname}
                        </option>
                      ))}
                    </select>
                  </div>
                  
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Assign Document to this Lesson
                    </label>
                    <select
                      className="input"
                      value={lesson.documentUrl}
                      onChange={(e) => handleLessonChange(index, 'documentUrl', e.target.value)}
                    >
                      <option value="">No document</option>
                      {uploadedFiles.documents.map((doc, dIndex) => (
                        <option key={dIndex} value={doc.url}>
                          {doc.originalname}
                        </option>
                      ))}
                    </select>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>

        <div className="flex justify-end space-x-3">
          <button
            type="button"
            onClick={() => navigate('/courses')}
            className="btn btn-outline"
          >
            Cancel
          </button>
          <button
            type="submit"
            disabled={loading}
            className="btn btn-primary"
          >
            {loading ? 'Creating...' : 'Create Course'}
          </button>
        </div>
      </form>
    </div>
  )
}
