import { useState, useEffect } from 'react'
import { useParams, Link, useNavigate } from 'react-router-dom'
import { useAuth } from '../contexts/AuthContext'
import { api } from '../services/api'
import toast from 'react-hot-toast'
import PDFViewer from '../components/PDFViewer'
import VideoEmbed from '../components/VideoEmbed'
import { 
  PlayIcon, 
  PauseIcon,
  ArrowLeftIcon,
  ArrowRightIcon,
  CheckCircleIcon,
  ClockIcon,
  DocumentTextIcon,
  EyeIcon
} from '@heroicons/react/24/outline'

export default function LessonView() {
  const { id } = useParams()
  const { user } = useAuth()
  const navigate = useNavigate()
  const [lesson, setLesson] = useState(null)
  const [course, setCourse] = useState(null)
  const [loading, setLoading] = useState(true)
  const [videoProgress, setVideoProgress] = useState(0)
  const [isPlaying, setIsPlaying] = useState(false)
  const [isCompleted, setIsCompleted] = useState(false)
  const [savingProgress, setSavingProgress] = useState(false)
  const [videoError, setVideoError] = useState(false)
  const [videoLoading, setVideoLoading] = useState(true)
  const [documentError, setDocumentError] = useState(false)
  const [courseProgress, setCourseProgress] = useState(null)

  useEffect(() => {
    fetchLesson()
  }, [id])

  // Add timeout to prevent loading state from getting stuck
  useEffect(() => {
    if (videoLoading && lesson?.video_url && !videoError) {
      const timeout = setTimeout(() => {
        console.log('Video loading timeout - forcing loading state to false')
        setVideoLoading(false)
      }, 10000) // 10 second timeout
      
      return () => clearTimeout(timeout)
    }
  }, [videoLoading, lesson?.video_url, videoError])



  const checkVideoExists = async (videoUrl) => {
    if (!videoUrl) return false
    
    try {
      // Check if it's an external URL (not a local file)
      if (videoUrl.startsWith('http') && !videoUrl.includes('localhost')) {
        // For external URLs, we'll assume they exist and let the video player handle errors
        console.log('External video URL detected, skipping existence check')
        return true
      }
      
      // For local files, check if they exist on the server
      const filename = videoUrl.split('/').pop()
      const response = await api.get(`/upload/check/video/${filename}`)
      return response.data.exists
    } catch (error) {
      console.error('Error checking video:', error)
      // For external URLs, don't fail the check on network errors
      if (videoUrl.startsWith('http') && !videoUrl.includes('localhost')) {
        return true
      }
      return false
    }
  }

  const checkDocumentExists = async (documentUrl) => {
    if (!documentUrl) return false
    
    try {
      // Extract filename from URL
      const filename = documentUrl.split('/').pop()
      const response = await api.get(`/upload/check/document/${filename}`)
      return response.data.exists
    } catch (error) {
      console.error('Error checking document:', error)
      return false
    }
  }

  const fetchLesson = async () => {
    try {
      const response = await api.get(`/lessons/${id}`)

      setLesson(response.data.lesson)
      
      // Check if video exists if lesson has video_url
      if (response.data.lesson.video_url) {
        console.log('Checking video URL:', response.data.lesson.video_url)
        const videoExists = await checkVideoExists(response.data.lesson.video_url)
        console.log('Video exists check result:', videoExists)
        
        if (!videoExists) {
          setVideoError(true)
          setVideoLoading(false)
          toast.error('Video content is no longer available')
        } else {
          // Video exists, set loading to true and let video element handle it
          console.log('Video exists, setting loading to true for video element')
          setVideoError(false)
          setVideoLoading(true)
          
          // For external videos, set a shorter timeout since we can't control their loading
          if (response.data.lesson.video_url.startsWith('http') && !response.data.lesson.video_url.includes('localhost')) {
            setTimeout(() => {
              if (videoLoading) {
                console.log('External video loading timeout - setting loading to false')
                setVideoLoading(false)
              }
            }, 5000) // 5 second timeout for external videos
          }
        }
      } else {
        setVideoLoading(false)
      }

      // Check if document exists if lesson has document_url
      if (response.data.lesson.document_url) {
        const documentExists = await checkDocumentExists(response.data.lesson.document_url)
        setDocumentError(!documentExists)
        if (!documentExists) {
          toast.error('Document content is no longer available')
        }
      }
      
      // Fetch course details
      if (response.data.lesson.course_id) {
        const courseResponse = await api.get(`/courses/${response.data.lesson.course_id}`)
        setCourse(courseResponse.data.course)
        
        // Fetch course progress
        await fetchCourseProgress(response.data.lesson.course_id)
      }
      
      // Check if lesson is completed
      checkLessonCompletion()
    } catch (error) {
      console.error('Failed to fetch lesson:', error)
      toast.error('Failed to load lesson')
    } finally {
      setLoading(false)
    }
  }

  const checkLessonCompletion = async () => {
    try {
      const response = await api.get(`/user-progress/lesson/${id}`)
      setIsCompleted(response.data.completed)
      setVideoProgress(response.data.progress || 0)
    } catch (error) {
      console.log('No progress found for this lesson')
    }
  }

  const fetchCourseProgress = async (courseId) => {
    try {
      const response = await api.get(`/user-progress/course/${courseId}/comprehensive`)
      setCourseProgress(response.data)
    } catch (error) {
      console.log('No course progress found')
    }
  }

  const handleVideoProgress = (progress) => {
    setVideoProgress(progress)
    
    // Auto-save progress every 10%
    if (progress % 10 === 0 && progress > 0) {
      saveProgress(progress)
    }
  }

  const saveProgress = async (progress) => {
    if (!user || !lesson) return
    
    setSavingProgress(true)
    try {
      await api.post('/user-progress', {
        lesson_id: lesson.id,
        progress: progress,
        completed: progress >= 90 // Mark as completed if 90% or more watched
      })
      
      if (progress >= 90 && !isCompleted) {
        setIsCompleted(true)
        toast.success('Lesson completed!')
        
        // Refresh course progress when lesson is completed
        if (course && course.id) {
          await fetchCourseProgress(course.id)
        }
      }
    } catch (error) {
      console.error('Failed to save progress:', error)
    } finally {
      setSavingProgress(false)
    }
  }

  const markAsCompleted = async () => {
    if (!user || !lesson) return
    
    setSavingProgress(true)
    try {
      await api.post('/user-progress', {
        lesson_id: lesson.id,
        progress: 100,
        completed: true
      })
      
      setIsCompleted(true)
      toast.success('Lesson marked as completed!')
      
      // Refresh course progress when lesson is completed
      if (course && course.id) {
        await fetchCourseProgress(course.id)
      }
    } catch (error) {
      console.error('Failed to mark lesson as completed:', error)
      toast.error('Failed to mark lesson as completed')
    } finally {
      setSavingProgress(false)
    }
  }

  const getNextLesson = () => {
    if (!course || !course.lessons) return null
    
    const currentIndex = course.lessons.findIndex(l => l.id === parseInt(id))
    return currentIndex < course.lessons.length - 1 ? course.lessons[currentIndex + 1] : null
  }

  const getPreviousLesson = () => {
    if (!course || !course.lessons) return null
    
    const currentIndex = course.lessons.findIndex(l => l.id === parseInt(id))
    return currentIndex > 0 ? course.lessons[currentIndex - 1] : null
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
        <p className="text-sm text-gray-500">The lesson you're looking for doesn't exist.</p>
        <Link to="/courses" className="btn btn-primary mt-4">
          Back to Courses
        </Link>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      {/* Lesson Header */}
      <div className="bg-white shadow rounded-lg p-6">
        <div className="flex items-center justify-between mb-4">
          <div>
            <h1 className="text-2xl font-bold text-gray-900">{lesson.title}</h1>
            {course && (
              <div className="mt-2">
                <p className="text-sm text-gray-600">
                  Course: {course.title}
                </p>

              </div>
            )}
          </div>
          
          <div className="flex items-center space-x-2">
            {isCompleted && (
              <div className="flex items-center text-green-600">
                <CheckCircleIcon className="h-5 w-5 mr-2" />
                <span className="text-sm font-medium">Completed</span>
              </div>
            )}
            
            <div className="flex items-center text-gray-600">
              <ClockIcon className="h-4 w-4 mr-1" />
              <span className="text-sm">{lesson.duration_minutes} min</span>
            </div>
          </div>
        </div>
        
        <p className="text-gray-700">{lesson.description}</p>
      </div>

      {/* Video Player */}
      {lesson.video_url ? (
        <div className="bg-white shadow rounded-lg overflow-hidden">
          <div className="aspect-video bg-black relative">
            {/* Check if it's an external video (YouTube/Animaker/Show.io) */}
            {(lesson.video_url.includes('youtube.com') || 
              lesson.video_url.includes('youtu.be') || 
              lesson.video_url.includes('animaker.com') || 
              lesson.video_url.includes('animo.app') ||
              lesson.video_url.includes('getshow.io') ||
              lesson.video_url.includes('app.getshow.io') ||
              lesson.video_url.includes('show.io')) ? (
              <VideoEmbed
                videoUrl={lesson.video_url}
                onPlay={() => {
                  console.log('External video play event')
                  setIsPlaying(true)
                  setVideoLoading(false)
                }}
                onPause={() => setIsPlaying(false)}
                onProgress={handleVideoProgress}
                className="w-full h-full"
              />
            ) : (
              /* Regular video file handling */
              <>
                {videoLoading ? (
                  <div className="flex items-center justify-center h-full">
                    <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-white"></div>
                    <span className="ml-3 text-white">Loading video...</span>
                  </div>
                ) : videoError ? (
                  <div className="flex flex-col items-center justify-center h-full text-white">
                    <svg className="h-12 w-12 text-red-400 mb-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-1.964-.833-2.732 0L3.732 16.5c-.77.833.192 2.5 1.732 2.5z" />
                    </svg>
                    <h3 className="text-lg font-medium mb-2">Video Not Available</h3>
                    <p className="text-sm text-gray-300 text-center px-4">
                      This video has been removed or is no longer available. 
                      Please contact your instructor for assistance.
                    </p>
                    <div className="flex space-x-2 mt-4">
                      <button
                        onClick={() => {
                          setVideoLoading(true)
                          setVideoError(false)
                          // Force reload the video element
                          const videoElement = document.querySelector('video')
                          if (videoElement) {
                            videoElement.load()
                          }
                        }}
                        className="btn btn-outline btn-sm"
                      >
                        Retry
                      </button>
                    </div>
                  </div>
                ) : (
                  <video
                    key={`video-${lesson.id}`}
                    className="w-full h-full"
                    controls
                    preload="metadata"
                    onTimeUpdate={(e) => {
                      const progress = (e.target.currentTime / e.target.duration) * 100
                      handleVideoProgress(Math.round(progress))
                    }}
                    onPlay={() => {
                      console.log('Video play event')
                      setIsPlaying(true)
                      setVideoLoading(false)
                    }}
                    onPause={() => setIsPlaying(false)}
                    onError={(e) => {
                      console.error('Video error:', e)
                      setVideoError(true)
                      setVideoLoading(false)
                    }}
                    onCanPlay={() => {
                      console.log('Video can play')
                      setVideoLoading(false)
                    }}
                    onLoadedMetadata={() => {
                      console.log('Video metadata loaded')
                      setVideoLoading(false)
                    }}
                    onLoadedData={() => {
                      console.log('Video data loaded')
                      setVideoLoading(false)
                    }}
                  >
                    <source src={`http://localhost:6001${lesson.video_url}`} type="video/mp4" />
                    Your browser does not support the video tag.
                  </video>
                )}
              </>
            )}
            
            {savingProgress && (
              <div className="absolute top-4 right-4 bg-black bg-opacity-75 text-white px-2 py-1 rounded text-sm">
                Saving progress...
              </div>
            )}
          </div>
          
          {!videoError && (
            <div className="p-4 border-t border-gray-200">
              <div className="flex justify-end">
                <button
                  onClick={markAsCompleted}
                  disabled={savingProgress || isCompleted}
                  className="btn btn-outline btn-sm"
                >
                  {savingProgress ? 'Saving...' : isCompleted ? 'Completed' : 'Mark Complete'}
                </button>
              </div>
            </div>
          )}
        </div>
      ) : (
        <div className="bg-white shadow rounded-lg p-6">
          <p className="text-gray-600">No video content available for this lesson.</p>
        </div>
      )}

      {/* Document Viewer */}
      {lesson.document_url && !documentError ? (
        lesson.document_url.toLowerCase().endsWith('.pdf') ? (
          <PDFViewer 
            url={`http://localhost:6001${lesson.document_url}`}
            title={lesson.title}
          />
        ) : (
          <div className="bg-white shadow rounded-lg p-6">
            <div className="flex items-center mb-4">
              <DocumentTextIcon className="h-5 w-5 text-gray-400 mr-2" />
              <h2 className="text-lg font-semibold text-gray-900">Course Document</h2>
            </div>
            
            <div className="border border-gray-200 rounded-lg p-4">
              <div className="flex items-center justify-between">
                <div className="flex items-center space-x-3">
                  <DocumentTextIcon className="h-6 w-6 text-gray-400" />
                  <div>
                    <p className="text-sm font-medium text-gray-900">Document</p>
                    <p className="text-xs text-gray-500">Click to view or download</p>
                  </div>
                </div>
                <a
                  href={`http://localhost:6001${lesson.document_url}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="btn btn-outline btn-sm"
                >
                  <EyeIcon className="h-4 w-4 mr-2" />
                  View Document
                </a>
              </div>
            </div>
          </div>
        )
      ) : lesson.document_url && documentError ? (
        <div className="bg-white shadow rounded-lg p-6">
          <div className="flex items-center mb-4">
            <DocumentTextIcon className="h-5 w-5 text-red-400 mr-2" />
            <h2 className="text-lg font-semibold text-gray-900">Document Not Available</h2>
          </div>
          
          <div className="border border-red-200 rounded-lg p-4 bg-red-50">
            <div className="flex items-center justify-between w-full">
              <div className="flex items-center space-x-3">
                <svg className="h-6 w-6 text-red-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-1.964-.833-2.732 0L3.732 16.5c-.77.833.192 2.5 1.732 2.5z" />
                </svg>
                <div>
                  <p className="text-sm font-medium text-red-800">Document Removed</p>
                  <p className="text-xs text-red-600">This document has been removed or is no longer available.</p>
                </div>
              </div>
              <button
                onClick={() => {
                  checkDocumentExists(lesson.document_url).then(exists => {
                    setDocumentError(!exists)
                    if (exists) {
                      toast.success('Document is now available!')
                    }
                  })
                }}
                className="btn btn-outline btn-sm"
              >
                Retry
              </button>
            </div>
          </div>
        </div>
      ) : null}

      {/* Lesson Content */}
      {lesson.content && (
        <div className="bg-white shadow rounded-lg p-6">
          <div className="flex items-center mb-4">
            <DocumentTextIcon className="h-5 w-5 text-gray-400 mr-2" />
            <h2 className="text-lg font-semibold text-gray-900">Lesson Content</h2>
          </div>
          
          <div className="prose max-w-none">
            <div dangerouslySetInnerHTML={{ __html: lesson.content }} />
          </div>
        </div>
      )}

      {/* Navigation */}
      <div className="flex justify-between items-center">
        <div className="flex items-center space-x-4">
          {getPreviousLesson() && (
            <Link
              to={`/lessons/${getPreviousLesson().id}`}
              className="btn btn-outline"
            >
              <ArrowLeftIcon className="h-4 w-4 mr-2" />
              Previous Lesson
            </Link>
          )}
          
          {course && (
            <Link
              to={`/courses/${course.id}`}
              className="btn btn-outline"
            >
              Back to Course
            </Link>
          )}
        </div>
        
        <div className="flex items-center space-x-4">
          {getNextLesson() ? (
            <Link
              to={`/lessons/${getNextLesson().id}`}
              className="btn btn-primary"
            >
              Next Lesson
              <ArrowRightIcon className="h-4 w-4 ml-2" />
            </Link>
          ) : (
            <div className="text-center">
              <CheckCircleIcon className="h-8 w-8 text-green-600 mx-auto mb-2" />
              <p className="text-sm text-gray-600">All lessons completed!</p>
              <p className="text-xs text-gray-500 mt-1">Take the quiz to get your certificate</p>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
