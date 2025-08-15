import { useState, useEffect } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { useAuth } from '../contexts/AuthContext'
import { api } from '../services/api'
import toast from 'react-hot-toast'
import { ArrowLeftIcon } from '@heroicons/react/24/outline'

export default function EditCourse() {
  const { id } = useParams()
  const { user, isAdmin, isTrainer } = useAuth()
  const navigate = useNavigate()
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [course, setCourse] = useState(null)
  const [formData, setFormData] = useState({
    title: '',
    description: '',
    category: '',
    difficultyLevel: 'beginner',
    durationMinutes: 0,
    isPublished: false,
    work_type: 'All'
  })

  useEffect(() => {
    fetchCourse()
  }, [id])

  const fetchCourse = async () => {
    try {
      const response = await api.get(`/courses/${id}`)
      const courseData = response.data.course
      setCourse(courseData)
      
      // Check permissions
      if (!canManageCourse(courseData)) {
        toast.error('You do not have permission to edit this course')
        navigate('/courses')
        return
      }

      setFormData({
        title: courseData.title || '',
        description: courseData.description || '',
        category: courseData.category || '',
        difficultyLevel: courseData.difficulty_level || 'beginner',
        durationMinutes: courseData.duration_minutes || 0,
        isPublished: courseData.is_published || false,
        work_type: courseData.work_type || 'All'
      })
    } catch (error) {
      console.error('Failed to fetch course:', error)
      toast.error('Failed to load course details')
      navigate('/courses')
    } finally {
      setLoading(false)
    }
  }

  const canManageCourse = (courseData) => {
    if (isAdmin) return true
    if (isTrainer && courseData.instructor_id === user?.id && !courseData.is_published) return true
    return false
  }

  const handleInputChange = (e) => {
    const { name, value, type, checked } = e.target
    setFormData(prev => ({
      ...prev,
      [name]: type === 'checkbox' ? checked : value
    }))
  }

  const handleSubmit = async (e) => {
    e.preventDefault()
    
    if (!formData.title.trim()) {
      toast.error('Course title is required')
      return
    }

    setSaving(true)
    try {
      await api.put(`/courses/${id}`, formData)
      toast.success('Course updated successfully!')
      navigate(`/courses/${id}`)
    } catch (error) {
      const message = error.response?.data?.message || 'Failed to update course'
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

  if (!course) {
    return (
      <div className="text-center py-12">
        <h3 className="text-lg font-medium text-gray-900">Course not found</h3>
        <p className="text-sm text-gray-500">The course you're trying to edit doesn't exist.</p>
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
            onClick={() => navigate(`/courses/${id}`)}
            className="btn btn-outline"
          >
            <ArrowLeftIcon className="h-4 w-4 mr-2" />
            Back to Course
          </button>
          <div>
            <h1 className="text-2xl font-bold text-gray-900">Edit Course</h1>
            <p className="text-sm text-gray-500">Update course information and settings</p>
          </div>
        </div>
      </div>

      <div className="bg-white shadow rounded-lg p-6">
        <form onSubmit={handleSubmit} className="space-y-6">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Course Title *
            </label>
            <input
              type="text"
              name="title"
              required
              className="input w-full"
              value={formData.title}
              onChange={handleInputChange}
              placeholder="Enter course title"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Description
            </label>
            <textarea
              name="description"
              rows={4}
              className="input w-full"
              value={formData.description}
              onChange={handleInputChange}
              placeholder="Enter course description"
            />
          </div>

          <div className="grid grid-cols-1 gap-6 sm:grid-cols-3">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Category
              </label>
              <input
                type="text"
                name="category"
                className="input w-full"
                value={formData.category}
                onChange={handleInputChange}
                placeholder="e.g., Programming, Marketing"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Difficulty Level
              </label>
              <select
                name="difficultyLevel"
                className="input w-full"
                value={formData.difficultyLevel}
                onChange={handleInputChange}
              >
                <option value="beginner">Beginner</option>
                <option value="intermediate">Intermediate</option>
                <option value="advanced">Advanced</option>
              </select>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Duration (minutes)
              </label>
              <input
                type="number"
                name="durationMinutes"
                min="0"
                className="input w-full"
                value={formData.durationMinutes}
                onChange={handleInputChange}
                placeholder="60"
              />
            </div>
          </div>

          {/* Work Type field - only show to admins or trainers who created the course */}
          {(isAdmin || (isTrainer && course.instructor_id === user?.id)) && (
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Work Type
              </label>
              <select
                name="work_type"
                className="input w-full"
                value={formData.work_type}
                onChange={handleInputChange}
              >
                <option value="All">All Work Types</option>
                <option value="Operations">Operations</option>
                <option value="Sales">Sales</option>
                <option value="Marketing">Marketing</option>
                <option value="Tech">Tech</option>
              </select>
              <p className="text-xs text-gray-500 mt-1">
                Select which work types can access this course
              </p>
            </div>
          )}

          {isAdmin && (
            <div className="flex items-center">
              <input
                type="checkbox"
                name="isPublished"
                id="isPublished"
                className="h-4 w-4 text-primary-600 focus:ring-primary-500 border-gray-300 rounded"
                checked={formData.isPublished}
                onChange={handleInputChange}
              />
              <label htmlFor="isPublished" className="ml-2 block text-sm text-gray-900">
                Publish course (make it available to learners)
              </label>
            </div>
          )}

          <div className="flex justify-end space-x-3 pt-6">
            <button
              type="button"
              onClick={() => navigate(`/courses/${id}`)}
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


