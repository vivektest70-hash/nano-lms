import { useState, useEffect } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { useAuth } from '../contexts/AuthContext'
import { api } from '../services/api'
import toast from 'react-hot-toast'
import { PlusIcon, MagnifyingGlassIcon, PencilIcon, TrashIcon } from '@heroicons/react/24/outline'

export default function Courses() {
  const { user, isTrainer, isAdmin } = useAuth()
  const navigate = useNavigate()
  const [courses, setCourses] = useState([])
  const [loading, setLoading] = useState(true)
  const [searchTerm, setSearchTerm] = useState('')
  const [selectedCategory, setSelectedCategory] = useState('')
  const [selectedDifficulty, setSelectedDifficulty] = useState('')
  const [selectedStatus, setSelectedStatus] = useState('')
  const [categories, setCategories] = useState([])
  const [difficulties] = useState(['beginner', 'intermediate', 'advanced'])
  const [statusOptions] = useState([
    { value: '', label: 'All Status' },
    { value: 'published', label: 'Published' },
    { value: 'unpublished', label: 'Draft' }
  ])
  const [courseProgress, setCourseProgress] = useState({})
  


  useEffect(() => {
    fetchCourses()
  }, [])

  const fetchCourses = async () => {
    try {
      setLoading(true)
      const response = await api.get('/courses')
      const coursesData = response.data.courses || []
      setCourses(coursesData)
      
      // Extract unique categories from all courses
      const uniqueCategories = [...new Set(coursesData.map(c => c.category).filter(Boolean))]
      setCategories(uniqueCategories)
      
      // Fetch course progress for all courses
      await fetchCourseProgress(coursesData)
    } catch (error) {
      console.error('Failed to fetch courses:', error)
      setCourses([])
    } finally {
      setLoading(false)
    }
  }

  const fetchCourseProgress = async (coursesData) => {
    if (!user) {
      return
    }
    

    
    try {
      // Use the new endpoint to get progress for all courses at once
      const timestamp = Date.now();
      const response = await api.get(`/user-progress/courses/all?t=${timestamp}&nocache=true`, {
        headers: {
          'Cache-Control': 'no-cache',
          'Pragma': 'no-cache'
        }
      })
      setCourseProgress(response.data)
    } catch (error) {
      console.error('Failed to fetch course progress:', error)
      // Fallback to individual course progress if the new endpoint fails
      try {
        const progressPromises = coursesData.map(async (course) => {
          try {
            const response = await api.get(`/user-progress/course/${course.id}/comprehensive`)
            return { courseId: course.id, progress: response.data }
          } catch (error) {

            return { courseId: course.id, progress: null }
          }
        })
        
        const progressResults = await Promise.all(progressPromises)
        const progressMap = {}
        
        progressResults.forEach(result => {
          if (result.progress) {
            progressMap[result.courseId] = result.progress
          }
        })
        

        setCourseProgress(progressMap)
      } catch (fallbackError) {
        console.error('Failed to fetch course progress (fallback):', fallbackError)
      }
    }
  }

  const filteredCourses = courses.filter(course => {
    const matchesSearch = course.title.toLowerCase().includes(searchTerm.toLowerCase()) ||
                          course.description.toLowerCase().includes(searchTerm.toLowerCase())
    const matchesCategory = selectedCategory === '' || course.category === selectedCategory
    const matchesDifficulty = selectedDifficulty === '' || course.difficulty_level === selectedDifficulty
    const matchesStatus = selectedStatus === '' || 
                         (selectedStatus === 'published' && course.is_published) ||
                         (selectedStatus === 'unpublished' && !course.is_published)
    return matchesSearch && matchesCategory && matchesDifficulty && matchesStatus
  })

  // Check if user can edit/delete a course
  const canManageCourse = (course) => {
    if (isAdmin) return true // Admin can manage any course
    if (isTrainer && course.instructor_id === user?.id && !course.is_published) return true // Trainer can manage their own unpublished courses
    return false
  }

  const handleDeleteCourse = async (courseId, courseTitle) => {
    if (!confirm(`Are you sure you want to delete "${courseTitle}"? This action cannot be undone.`)) {
      return
    }

    try {
      await api.delete(`/courses/${courseId}`)
      toast.success('Course deleted successfully!')
      fetchCourses() // Refresh the course list
    } catch (error) {
      const message = error.response?.data?.message || 'Failed to delete course'
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

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Courses</h1>
          <p className="mt-1 text-sm text-gray-500">
            Browse and enroll in available courses
          </p>
        </div>
        {isTrainer && (
          <Link
            to="/courses/create"
            className="btn btn-primary"
          >
            <PlusIcon className="h-4 w-4 mr-2" />
            Create Course
          </Link>
        )}
      </div>

      {/* Filters */}
      <div className="bg-white shadow rounded-lg p-4">
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-5">
          <div className="relative">
            <MagnifyingGlassIcon className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-400" />
            <input
              type="text"
              placeholder="Search courses..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="input pl-10"
            />
          </div>
          
          <select
            value={selectedCategory}
            onChange={(e) => setSelectedCategory(e.target.value)}
            className="input"
          >
            <option value="">All Categories</option>
            {categories.map(category => (
              <option key={category} value={category}>{category}</option>
            ))}
          </select>
          
          <select
            value={selectedDifficulty}
            onChange={(e) => setSelectedDifficulty(e.target.value)}
            className="input"
          >
            <option value="">All Difficulties</option>
            {difficulties.map(difficulty => (
              <option key={difficulty} value={difficulty}>
                {difficulty.charAt(0).toUpperCase() + difficulty.slice(1)}
              </option>
            ))}
          </select>

          {/* Status Filter - Only show for Admin and Trainer */}
          {(isAdmin || isTrainer) && (
            <select
              value={selectedStatus}
              onChange={(e) => setSelectedStatus(e.target.value)}
              className="input"
            >
              {statusOptions.map(option => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </select>
          )}
          
          <button
            onClick={() => {
              setSearchTerm('')
              setSelectedCategory('')
              setSelectedDifficulty('')
              setSelectedStatus('')
            }}
            className="btn btn-outline"
          >
            Clear Filters
          </button>
        </div>
      </div>

      {/* Course Grid */}
      {filteredCourses.length === 0 ? (
        <div className="text-center py-12">
          <h3 className="text-lg font-medium text-gray-900">No courses found</h3>
          <p className="text-sm text-gray-500">
            {searchTerm || selectedCategory || selectedDifficulty 
              ? 'Try adjusting your filters' 
              : 'No courses are available at the moment'}
          </p>
          {isTrainer && (
            <div className="mt-6">
              <Link
                to="/courses/create"
                className="btn btn-primary"
              >
                <PlusIcon className="h-4 w-4 mr-2" />
                Create First Course
              </Link>
            </div>
          )}
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-3">
          {filteredCourses.map((course) => (
            <div key={course.id} className="card hover:shadow-lg transition-shadow">
              {course.thumbnail_url && (
                <img
                  src={course.thumbnail_url}
                  alt={course.title}
                  className="w-full h-48 object-cover rounded-t-lg"
                />
              )}
              <div className="p-6">
                <div className="flex items-center justify-between mb-2">
                  <div className="flex items-center space-x-2">
                    <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-primary-100 text-primary-800">
                      {course.category || 'General'}
                    </span>
                    {user && courseProgress[course.id] && courseProgress[course.id].overallProgress === 100 && (
                      <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-green-100 text-green-800">
                        ✓ Complete
                      </span>
                    )}
                  </div>
                  <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${
                    course.difficulty_level === 'beginner' ? 'bg-green-100 text-green-800' :
                    course.difficulty_level === 'intermediate' ? 'bg-yellow-100 text-yellow-800' :
                    'bg-red-100 text-red-800'
                  }`}>
                    {course.difficulty_level?.charAt(0).toUpperCase() + course.difficulty_level?.slice(1)}
                  </span>
                </div>
                
                <h3 className="text-lg font-semibold text-gray-900 mb-2">
                  {course.title}
                </h3>
                
                {/* Course Progress Bar */}
                {(() => {

                  
                  // Show progress bar if user is logged in and has progress data
                  if (user && courseProgress[course.id]) {
                    const progress = courseProgress[course.id];
                    return (
                      <div className="mb-3">
                        <div className="flex items-center justify-between mb-1">
                          <span className="text-xs text-gray-600">Progress</span>
                          <span className="text-xs font-bold text-primary-600">
                            {progress.overallProgress}%
                          </span>
                        </div>
                        <div className="w-full bg-gray-200 rounded-full h-2">
                          <div 
                            className="bg-primary-600 h-2 rounded-full transition-all duration-300"
                            style={{ width: `${progress.overallProgress}%` }}
                          ></div>
                        </div>
                        <div className="flex items-center justify-between mt-1 text-xs text-gray-500">
                          <span>
                            {progress.completedComponents} of {progress.totalComponents} completed
                          </span>
                          {progress.overallProgress === 100 && (
                            <span className="text-green-600 font-medium">✓ Complete</span>
                          )}
                        </div>
                      </div>
                    )
                  }
                  
                  // Show progress based on course structure (fallback)
                  if (user) {
                    const totalLessons = parseInt(course.lesson_count) || 0;
                    const hasQuiz = parseInt(course.quiz_count) > 0;
                    let totalComponents = totalLessons + (hasQuiz ? 1 : 0);
                    
                    // Use real progress data if available, otherwise show no progress
                    let completedComponents = 0;
                    let overallProgress = 0;
                    
                    if (courseProgress[course.id]) {
                      // Use real progress data from backend
                      const progress = courseProgress[course.id];
                      completedComponents = progress.completedComponents;
                      overallProgress = progress.overallProgress;
                      totalComponents = progress.totalComponents || totalComponents; // Use real total from backend
                    } else {
                      // No progress data available
                      completedComponents = 0;
                      overallProgress = 0;
                    }
                    
                    return (
                      <div className="mb-3">
                        <div className="flex items-center justify-between mb-1">
                          <span className="text-xs text-gray-600">Progress</span>
                          <span className="text-xs font-bold text-primary-600">
                            {overallProgress}%
                          </span>
                        </div>
                        <div className="w-full bg-gray-200 rounded-full h-2">
                          <div 
                            className="bg-primary-600 h-2 rounded-full transition-all duration-300"
                            style={{ width: `${overallProgress}%` }}
                          ></div>
                        </div>
                        <div className="flex items-center justify-between mt-1 text-xs text-gray-500">
                          <span>
                            {completedComponents} of {totalComponents} completed
                          </span>
                          {overallProgress === 100 && (
                            <span className="text-green-600 font-medium">✓ Complete</span>
                          )}
                        </div>
                      </div>
                    )
                  }
                  

                  

                  
                  return null
                })()}
                
                <p className="text-sm text-gray-600 mb-4 line-clamp-2">
                  {course.description}
                </p>
                
                <div className="flex items-center justify-between text-sm text-gray-500 mb-4">
                  <span>Duration: {course.duration_minutes || 0} min</span>
                  <span>By {course.instructor_first_name} {course.instructor_last_name}</span>
                </div>



                {/* Course Status Badge */}
                {!course.is_published && (
                  <div className="mb-3">
                    <span className="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium bg-yellow-100 text-yellow-800">
                      Draft
                    </span>
                  </div>
                )}
                
                <div className="space-y-2">
                  <Link
                    to={`/courses/${course.id}`}
                    className="btn btn-primary w-full"
                  >
                    View Course
                  </Link>
                  
                  {/* Management Buttons */}
                  {canManageCourse(course) && (
                    <div className="flex space-x-2">
                      <button
                        onClick={() => navigate(`/courses/${course.id}/edit`)}
                        className="btn btn-outline flex-1 flex items-center justify-center"
                      >
                        <PencilIcon className="h-4 w-4 mr-1" />
                        Edit
                      </button>
                      <button
                        onClick={() => handleDeleteCourse(course.id, course.title)}
                        className="btn btn-outline btn-danger flex-1 flex items-center justify-center"
                      >
                        <TrashIcon className="h-4 w-4 mr-1" />
                        Delete
                      </button>
                    </div>
                  )}
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
