import { useState, useEffect } from 'react'
import { useParams, Link, useNavigate } from 'react-router-dom'
import { useAuth } from '../contexts/AuthContext'
import { api } from '../services/api'
import toast from 'react-hot-toast'
import { 
  PlayIcon, 
  ClockIcon, 
  UserIcon, 
  AcademicCapIcon,
  CheckCircleIcon,
  ArrowRightIcon,
  PencilIcon,
  TrashIcon,
  PlusIcon
} from '@heroicons/react/24/outline'

export default function CourseDetail() {
  const { id } = useParams()
  const { user, isLearner, isAdmin, isTrainer } = useAuth()
  const navigate = useNavigate()
  const [course, setCourse] = useState(null)
  const [loading, setLoading] = useState(true)
  const [enrolling, setEnrolling] = useState(false)
  const [isEnrolled, setIsEnrolled] = useState(false)
  const [courseProgress, setCourseProgress] = useState(null)

  useEffect(() => {
    fetchCourse()
    checkEnrollment()
    if (user) {
      fetchCourseProgress()
    }
  }, [id, user])

  const fetchCourse = async () => {
    try {
      console.log('Fetching course with ID:', id)
      const response = await api.get(`/courses/${id}`)
      console.log('Course response:', response.data)
      setCourse(response.data.course)
    } catch (error) {
      console.error('Failed to fetch course:', error)
      toast.error('Failed to load course details')
    } finally {
      setLoading(false)
    }
  }

  const checkEnrollment = async () => {
    if (!user) return
    
    try {
      const response = await api.get('/courses/enrollments')
      const enrollments = response.data.enrollments || []
      setIsEnrolled(enrollments.some(enrollment => enrollment.course_id === parseInt(id)))
    } catch (error) {
      console.log('No enrollments found')
    }
  }

  const fetchCourseProgress = async () => {
    if (!user) return
    
    try {
      const response = await api.get(`/user-progress/course/${id}/comprehensive`)
      setCourseProgress(response.data)
    } catch (error) {
      console.log('No course progress found')
    }
  }

  const handleEnroll = async () => {
    if (!user) {
      toast.error('Please log in to enroll in courses')
      navigate('/login')
      return
    }

    setEnrolling(true)
    try {
      await api.post(`/courses/${id}/enroll`)
      setIsEnrolled(true)
      toast.success('Successfully enrolled in course!')
    } catch (error) {
      const message = error.response?.data?.message || 'Failed to enroll in course'
      toast.error(message)
    } finally {
      setEnrolling(false)
    }
  }

  const handleLessonClick = (lesson) => {
    if (!isEnrolled) {
      toast.error('Please enroll in this course to access lessons')
      return
    }
    navigate(`/lessons/${lesson.id}`)
  }

  // Check if user can edit/delete this course
  const canManageCourse = () => {
    if (!course) return false
    if (isAdmin) return true // Admin can manage any course
    if (isTrainer && course.instructor_id === user?.id && !course.is_published) return true // Trainer can manage their own unpublished courses
    return false
  }

  const handleDeleteCourse = async () => {
    if (!confirm(`Are you sure you want to delete "${course.title}"? This action cannot be undone.`)) {
      return
    }

    try {
      await api.delete(`/courses/${id}`)
      toast.success('Course deleted successfully!')
      navigate('/courses')
    } catch (error) {
      const message = error.response?.data?.message || 'Failed to delete course'
      toast.error(message)
    }
  }

  // Check if user can manage lessons in this course
  const canManageLessons = () => {
    if (!course) return false
    if (isAdmin) return true // Admin can manage any lesson
    if (isTrainer && course.instructor_id === user?.id) return true // Trainer can manage lessons in their own courses
    return false
  }

  const handleDeleteLesson = async (lessonId, lessonTitle) => {
    if (!confirm(`Are you sure you want to delete "${lessonTitle}"? This action cannot be undone.`)) {
      return
    }

    try {
      await api.delete(`/lessons/${lessonId}`)
      toast.success('Lesson deleted successfully!')
      fetchCourse() // Refresh the course data
    } catch (error) {
      const message = error.response?.data?.message || 'Failed to delete lesson'
      toast.error(message)
    }
  }

  const handleDeleteQuiz = async () => {
    if (!confirm('Are you sure you want to delete this quiz? This action cannot be undone.')) {
      return
    }

    try {
      await api.delete(`/quizzes/${course.quiz.id}`)
      toast.success('Quiz deleted successfully!')
      fetchCourse() // Refresh the course data
    } catch (error) {
      const message = error.response?.data?.message || 'Failed to delete quiz'
      toast.error(message)
    }
  }

  if (loading) {
    return (
      <div className="flex justify-center items-center py-12">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary-600"></div>
      </div>
    )
  }

  if (!course) {
    return (
      <div className="text-center py-12">
        <h3 className="text-lg font-medium text-gray-900">Course not found</h3>
        <p className="text-sm text-gray-500">The course you're looking for doesn't exist.</p>
        <Link to="/courses" className="btn btn-primary mt-4">
          Back to Courses
        </Link>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      {/* Course Header */}
      <div className="bg-white shadow rounded-lg overflow-hidden">
        {course.thumbnail_url && (
          <div className="h-64 bg-gray-200">
            <img
              src={course.thumbnail_url}
              alt={course.title}
              className="w-full h-full object-cover"
            />
          </div>
        )}
        
        <div className="p-6">
          <div className="flex items-center justify-between mb-4">
            <div>
              <h1 className="text-3xl font-bold text-gray-900">{course.title}</h1>
              <p className="text-lg text-gray-600 mt-2">{course.description}</p>
            </div>
            
            <div className="flex items-center space-x-3">
              {/* Course Status Badge */}
              {!course.is_published && (
                <span className="inline-flex items-center px-3 py-1 rounded-full text-sm font-medium bg-yellow-100 text-yellow-800">
                  Draft
                </span>
              )}
              
              {/* Management Buttons */}
              {canManageCourse() && (
                <div className="flex space-x-2">
                  <button
                    onClick={() => navigate(`/courses/${id}/edit`)}
                    className="btn btn-outline flex items-center"
                  >
                    <PencilIcon className="h-4 w-4 mr-1" />
                    Edit
                  </button>
                  <button
                    onClick={handleDeleteCourse}
                    className="btn btn-outline btn-danger flex items-center"
                  >
                    <TrashIcon className="h-4 w-4 mr-1" />
                    Delete
                  </button>
                </div>
              )}
              
              {/* Enrollment Button */}
              {isLearner && !isEnrolled && (
                <button
                  onClick={handleEnroll}
                  disabled={enrolling}
                  className="btn btn-primary"
                >
                  {enrolling ? 'Enrolling...' : 'Enroll Now'}
                </button>
              )}
              
              {isEnrolled && (
                <div className="flex items-center text-green-600">
                  <CheckCircleIcon className="h-5 w-5 mr-2" />
                  <span className="font-medium">Enrolled</span>
                </div>
              )}
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
            <div className="flex items-center text-gray-600">
              <UserIcon className="h-5 w-5 mr-2" />
              <span>By {course.instructor_first_name} {course.instructor_last_name}</span>
            </div>
            
            <div className="flex items-center text-gray-600">
              <ClockIcon className="h-5 w-5 mr-2" />
              <span>{course.duration_minutes} minutes</span>
            </div>
            
            <div className="flex items-center">
              <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${
                course.difficulty_level === 'beginner' ? 'bg-green-100 text-green-800' :
                course.difficulty_level === 'intermediate' ? 'bg-yellow-100 text-yellow-800' :
                'bg-red-100 text-red-800'
              }`}>
                {course.difficulty_level?.charAt(0).toUpperCase() + course.difficulty_level?.slice(1)}
              </span>
            </div>
          </div>

          {/* Course Progress for enrolled users */}
          {isEnrolled && courseProgress && (
            <div className="mb-6 p-4 bg-gray-50 rounded-lg">
              <div className="flex items-center justify-between mb-3">
                <h3 className="text-lg font-medium text-gray-900">Your Progress</h3>
                <span className="text-lg font-bold text-primary-600">
                  {courseProgress.summary.overallProgress}%
                </span>
              </div>
              <div className="w-full bg-gray-200 rounded-full h-3 mb-3">
                <div 
                  className="bg-primary-600 h-3 rounded-full transition-all duration-300"
                  style={{ width: `${courseProgress.summary.overallProgress}%` }}
                ></div>
              </div>
              <div className="flex items-center justify-between text-sm text-gray-600">
                <span>
                  {courseProgress.summary.completedComponents} of {courseProgress.summary.totalComponents} completed
                </span>
                <span>
                  {courseProgress.summary.completedLessons} lessons, {courseProgress.summary.hasQuiz ? (courseProgress.summary.quizPassed ? '1 quiz' : '0 quizzes') : 'no quiz'}
                </span>
              </div>
            </div>
          )}

          {course.category && (
            <div className="mb-6">
              <span className="inline-flex items-center px-3 py-1 rounded-full text-sm font-medium bg-primary-100 text-primary-800">
                {course.category}
              </span>
            </div>
          )}
        </div>
      </div>

      {/* Lessons Section */}
      <div className="bg-white shadow rounded-lg">
        <div className="px-6 py-4 border-b border-gray-200">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-xl font-semibold text-gray-900">Course Content</h2>
              <p className="text-sm text-gray-600 mt-1">
                {course.lessons?.length || 0} lessons • {course.duration_minutes} minutes total
                {console.log('Course lessons:', course.lessons)}
              </p>
            </div>
            {canManageLessons() && (
              <button
                onClick={() => navigate(`/courses/${id}/lessons/create`)}
                className="btn btn-primary btn-sm"
              >
                <PlusIcon className="h-4 w-4 mr-1" />
                Add Lesson
              </button>
            )}
          </div>
        </div>
        
        <div className="divide-y divide-gray-200">
          {course.lessons && course.lessons.length > 0 ? (
            course.lessons.map((lesson, index) => (
              <div key={lesson.id} className="p-6 hover:bg-gray-50 transition-colors">
                <div className="flex items-center justify-between">
                  <div className="flex items-center space-x-4">
                    <div className="flex-shrink-0">
                      <div className="w-8 h-8 bg-primary-100 rounded-full flex items-center justify-center">
                        <span className="text-sm font-medium text-primary-600">{index + 1}</span>
                      </div>
                    </div>
                    
                    <div className="flex-1">
                      <div className="flex items-center space-x-2">
                        <h3 className="text-lg font-medium text-gray-900">{lesson.title}</h3>
                        {isEnrolled && courseProgress && (
                          (() => {
                            const lessonProgress = courseProgress.lessonProgress.find(p => p.lesson_id === lesson.id);
                            return lessonProgress?.is_completed ? (
                              <CheckCircleIcon className="h-5 w-5 text-green-600" title="Completed" />
                            ) : lessonProgress?.progress > 0 ? (
                              <div className="w-4 h-4 border-2 border-primary-600 border-t-transparent rounded-full animate-spin" title={`${lessonProgress.progress}% completed`}></div>
                            ) : null;
                          })()
                        )}
                      </div>
                      <p className="text-sm text-gray-600 mt-1">{lesson.description}</p>
                      <div className="flex items-center mt-2 space-x-4 text-sm text-gray-500">
                        <span className="flex items-center">
                          <ClockIcon className="h-4 w-4 mr-1" />
                          {lesson.duration_minutes} min
                        </span>
                        {lesson.video_url && (
                          <span className="flex items-center">
                            <PlayIcon className="h-4 w-4 mr-1" />
                            Video
                          </span>
                        )}
                        {isEnrolled && courseProgress && (
                          (() => {
                            const lessonProgress = courseProgress.lessonProgress.find(p => p.lesson_id === lesson.id);
                            return lessonProgress?.progress > 0 ? (
                              <span className="text-primary-600 font-medium">
                                {lessonProgress.progress}% complete
                              </span>
                            ) : null;
                          })()
                        )}
                      </div>
                    </div>
                  </div>
                  
                  <div className="flex items-center space-x-2">
                    {canManageLessons() && (
                      <div className="flex space-x-1">
                        <button
                          onClick={() => navigate(`/lessons/${lesson.id}/edit`)}
                          className="btn btn-outline btn-sm"
                        >
                          <PencilIcon className="h-3 w-3" />
                        </button>
                        <button
                          onClick={() => handleDeleteLesson(lesson.id, lesson.title)}
                          className="btn btn-outline btn-danger btn-sm"
                        >
                          <TrashIcon className="h-3 w-3" />
                        </button>
                      </div>
                    )}
                    {isEnrolled ? (
                      <button
                        onClick={() => handleLessonClick(lesson)}
                        className="btn btn-primary btn-sm"
                      >
                        Start Lesson
                        <ArrowRightIcon className="h-4 w-4 ml-1" />
                      </button>
                    ) : (
                      <span className="text-sm text-gray-500">Enroll to access</span>
                    )}
                  </div>
                </div>
              </div>
            ))
          ) : (
            <div className="p-6 text-center">
              <AcademicCapIcon className="mx-auto h-12 w-12 text-gray-400" />
              <h3 className="mt-2 text-sm font-medium text-gray-900">No lessons available</h3>
              <p className="mt-1 text-sm text-gray-500">
                This course doesn't have any lessons yet.
              </p>
            </div>
          )}
        </div>
      </div>

      {/* Quiz Section */}
      <div className="bg-white shadow rounded-lg">
        <div className="px-6 py-4 border-b border-gray-200">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-xl font-semibold text-gray-900">Course Quiz</h2>
              <p className="text-sm text-gray-600 mt-1">
                Test your knowledge after completing the lessons
              </p>
            </div>
            {canManageCourse() && (
              <button
                onClick={() => navigate(`/courses/${id}/quiz/create`)}
                className="btn btn-primary btn-sm"
              >
                <PlusIcon className="h-4 w-4 mr-1" />
                Create Quiz
              </button>
            )}
          </div>
        </div>
        
        <div className="p-6">
          {course.quiz ? (
            <div className="flex items-center justify-between">
              <div className="flex items-center space-x-4">
                <div className="flex-shrink-0">
                  <div className="w-8 h-8 bg-yellow-100 rounded-full flex items-center justify-center">
                    <AcademicCapIcon className="h-4 w-4 text-yellow-600" />
                  </div>
                </div>
                
                <div className="flex-1">
                  <div className="flex items-center space-x-2">
                    <h3 className="text-lg font-medium text-gray-900">Course Quiz</h3>
                    {isEnrolled && courseProgress && courseProgress.quizProgress && (
                      courseProgress.quizProgress.passed ? (
                        <CheckCircleIcon className="h-5 w-5 text-green-600" title="Quiz Passed" />
                      ) : null
                    )}
                  </div>
                  <p className="text-sm text-gray-600 mt-1">
                    {course.quiz.total_questions} questions • Pass rate: {course.quiz.passing_percentage}%
                  </p>
                  <div className="flex items-center mt-2 space-x-4 text-sm text-gray-500">
                    <span className="flex items-center">
                      <ClockIcon className="h-4 w-4 mr-1" />
                      10 min
                    </span>
                    <span className="flex items-center">
                      <CheckCircleIcon className="h-4 w-4 mr-1" />
                      Certificate available
                    </span>
                    {isEnrolled && courseProgress && courseProgress.quizProgress && (
                      <span className={`flex items-center ${courseProgress.quizProgress.passed ? 'text-green-600' : 'text-gray-500'}`}>
                        {courseProgress.quizProgress.passed ? 'Passed' : 'Not attempted'}
                      </span>
                    )}
                  </div>
                </div>
              </div>
              
              <div className="flex items-center space-x-2">
                {canManageCourse() && (
                  <div className="flex space-x-1">
                    <button
                      onClick={() => navigate(`/courses/${id}/quiz/edit`)}
                      className="btn btn-outline btn-sm"
                    >
                      <PencilIcon className="h-3 w-3" />
                    </button>
                    <button
                      onClick={() => handleDeleteQuiz()}
                      className="btn btn-outline btn-danger btn-sm"
                    >
                      <TrashIcon className="h-3 w-3" />
                    </button>
                  </div>
                )}
                {isEnrolled ? (
                  courseProgress && courseProgress.quizProgress && courseProgress.quizProgress.passed ? (
                    <button
                      onClick={() => navigate(`/courses/${id}/quiz-results`)}
                      className="btn btn-success btn-sm"
                    >
                      View Results
                      <ArrowRightIcon className="h-4 w-4 ml-1" />
                    </button>
                  ) : (
                    <button
                      onClick={() => navigate(`/courses/${id}/quiz`)}
                      className="btn btn-primary btn-sm"
                    >
                      {courseProgress && courseProgress.quizProgress && !courseProgress.quizProgress.passed ? 'Retake Quiz' : 'Take Quiz'}
                      <ArrowRightIcon className="h-4 w-4 ml-1" />
                    </button>
                  )
                ) : (
                  <span className="text-sm text-gray-500">Enroll to access</span>
                )}
              </div>
            </div>
          ) : (
            <div className="text-center">
              <AcademicCapIcon className="mx-auto h-12 w-12 text-gray-400" />
              <h3 className="mt-2 text-sm font-medium text-gray-900">No quiz available</h3>
              <p className="mt-1 text-sm text-gray-500">
                {canManageCourse() ? 'Create a quiz to test your students\' knowledge.' : 'This course doesn\'t have a quiz yet.'}
              </p>
            </div>
          )}
        </div>
      </div>

      {/* Course Actions */}
      <div className="flex justify-between items-center">
        <Link
          to="/courses"
          className="btn btn-outline"
        >
          ← Back to Courses
        </Link>
        
        {isEnrolled && (
          <div className="flex items-center space-x-2">
            <span className="text-sm text-gray-600">Ready to start learning?</span>
            <button
              onClick={() => course.lessons?.[0] && handleLessonClick(course.lessons[0])}
              className="btn btn-primary"
            >
              Start Course
              <ArrowRightIcon className="h-4 w-4 ml-1" />
            </button>
          </div>
        )}
      </div>
    </div>
  )
}
