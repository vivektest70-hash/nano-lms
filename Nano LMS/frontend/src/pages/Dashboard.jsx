import { useState, useEffect } from 'react'
import { Link } from 'react-router-dom'
import { useAuth } from '../contexts/AuthContext'
import { api } from '../services/api'
import Leaderboard from '../components/Leaderboard'
import {
  AcademicCapIcon,
  ClockIcon,
  CheckCircleIcon,
  DocumentTextIcon,
  UserGroupIcon,
  ChartBarIcon,
  PlayIcon,
  ArrowTrendingUpIcon,
} from '@heroicons/react/24/outline'

export default function Dashboard() {
  const { user, isAdmin } = useAuth()
  const [stats, setStats] = useState({
    totalCourses: 0,
    enrolledCourses: 0,
    completedCourses: 0,
    totalUsers: 0,
    totalCertificates: 0,
    totalLessonsAttempted: 0,
    completedLessons: 0,
    averageProgress: 0,
  })
  const [recentCourses, setRecentCourses] = useState([])
  const [enrolledCourses, setEnrolledCourses] = useState([])
  const [recentActivity, setRecentActivity] = useState([])
  const [courseProgress, setCourseProgress] = useState({})
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    fetchDashboardData()
  }, [])

  const fetchDashboardData = async () => {
    try {
      setLoading(true)
      
      // Fetch courses
      const coursesResponse = await api.get('/courses?limit=5')
      const coursesData = coursesResponse.data.courses || []
      setRecentCourses(coursesData)
      
      // Get total courses count
      const allCoursesResponse = await api.get('/courses')
      setStats(prev => ({
        ...prev,
        totalCourses: allCoursesResponse.data.courses?.length || 0,
      }))

      // Fetch course progress for recent courses
      await fetchCourseProgress(coursesData)

      // Fetch user-specific data
      if (!isAdmin) {
        // Get enrollments
        try {
          const enrollmentsResponse = await api.get('/courses/enrollments')
          const enrollments = enrollmentsResponse.data.enrollments || []
          setEnrolledCourses(enrollments)
          setStats(prev => ({
            ...prev,
            enrolledCourses: enrollments.length,
          }))
        } catch (error) {
          console.log('No enrollments found')
        }

        // Get certificates
        try {
          const certificatesResponse = await api.get(`/certificates/user/${user.id}`)
          setStats(prev => ({
            ...prev,
            completedCourses: certificatesResponse.data.certificates?.length || 0,
          }))
        } catch (error) {
          console.log('No certificates found')
        }

        // Get learning progress overview
        try {
          const progressResponse = await api.get('/user-progress/overview')
          const progressData = progressResponse.data
          setStats(prev => ({
            ...prev,
            totalLessonsAttempted: progressData.stats.totalLessonsAttempted,
            completedLessons: progressData.stats.completedLessons,
            averageProgress: progressData.stats.averageProgress,
          }))
          setRecentActivity(progressData.recentActivity || [])
        } catch (error) {
          console.log('No progress data found')
        }
      } else {
        // Admin stats
        try {
          const usersResponse = await api.get('/users?limit=1')
          setStats(prev => ({
            ...prev,
            totalUsers: usersResponse.data.pagination?.totalUsers || 0,
          }))
        } catch (error) {
          console.log('Error fetching users')
        }

        try {
          const certificatesResponse = await api.get('/certificates')
          setStats(prev => ({
            ...prev,
            totalCertificates: certificatesResponse.data.certificates?.length || 0,
          }))
        } catch (error) {
          console.log('Error fetching certificates')
        }
      }
    } catch (error) {
      console.error('Failed to fetch dashboard data:', error)
    } finally {
      setLoading(false)
    }
  }

  const fetchCourseProgress = async (coursesData) => {
    if (!user) return
    
    try {
      const progressPromises = coursesData.map(async (course) => {
        try {
          const response = await api.get(`/user-progress/course/${course.id}/comprehensive`)
          return { courseId: course.id, progress: response.data }
        } catch (error) {
          // If no progress found, return null
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
    } catch (error) {
      console.error('Failed to fetch course progress:', error)
    }
  }

  const StatCard = ({ title, value, icon: Icon, colorClass = 'text-primary-600', subtitle = '' }) => (
    <div className="bg-white overflow-hidden shadow rounded-lg">
      <div className="p-5">
        <div className="flex items-center">
          <div className="flex-shrink-0">
            <Icon className={`h-6 w-6 ${colorClass}`} />
          </div>
          <div className="ml-5 w-0 flex-1">
            <dl>
              <dt className="text-sm font-medium text-gray-500 truncate">{title}</dt>
              <dd className="text-lg font-medium text-gray-900">{value}</dd>
              {subtitle && (
                <dd className="text-sm text-gray-500">{subtitle}</dd>
              )}
            </dl>
          </div>
        </div>
      </div>
    </div>
  )

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary-600"></div>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Dashboard</h1>
        <p className="mt-1 text-sm text-gray-500">
          Welcome back, {user?.first_name}! Here's what's happening with your learning.
        </p>
      </div>

      {/* Stats Grid */}
      <div className="grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard
          title="Available Courses"
          value={Math.max(0, stats.totalCourses - stats.enrolledCourses)}
          icon={AcademicCapIcon}
          colorClass="text-primary-600"
          subtitle={`${stats.totalCourses} total courses`}
        />
        {isAdmin ? (
          <>
            <StatCard
              title="Total Users"
              value={stats.totalUsers}
              icon={UserGroupIcon}
              colorClass="text-green-600"
            />
            <StatCard
              title="Certificates Issued"
              value={stats.totalCertificates}
              icon={DocumentTextIcon}
              colorClass="text-purple-600"
            />
            <StatCard
              title="System Status"
              value="Active"
              icon={CheckCircleIcon}
              colorClass="text-green-600"
              subtitle="All systems operational"
            />
          </>
        ) : (
          <>
            <StatCard
              title="Enrolled Courses"
              value={stats.enrolledCourses}
              icon={ClockIcon}
              colorClass="text-yellow-600"
            />
            <StatCard
              title="Completed Lessons"
              value={stats.completedLessons}
              icon={CheckCircleIcon}
              colorClass="text-green-600"
              subtitle={`${stats.totalLessonsAttempted} attempted`}
            />
            <StatCard
              title="Average Progress"
              value={`${stats.averageProgress}%`}
              icon={ArrowTrendingUpIcon}
              colorClass="text-blue-600"
              subtitle="Across all courses"
            />
          </>
        )}
      </div>

      {/* Enrolled Courses (for learners) */}
      {!isAdmin && enrolledCourses.length > 0 && (
        <div className="bg-white shadow rounded-lg">
          <div className="px-4 py-5 sm:p-6">
            <h3 className="text-lg leading-6 font-medium text-gray-900 mb-4">
              My Enrolled Courses
            </h3>
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {enrolledCourses.map((enrollment) => (
                <div
                  key={enrollment.course_id}
                  className="border border-gray-200 rounded-lg p-4 hover:shadow-md transition-shadow"
                >
                  <div className="flex items-center justify-between mb-2">
                    <h4 className="text-sm font-medium text-gray-900 truncate">
                      {enrollment.course_title}
                    </h4>
                    <span className="text-xs text-gray-500">
                      {new Date(enrollment.enrolled_at).toLocaleDateString()}
                    </span>
                  </div>
                  <p className="text-xs text-gray-500 mb-3">
                    by {enrollment.instructor_first_name} {enrollment.instructor_last_name}
                  </p>
                  <Link
                    to={`/courses/${enrollment.course_id}`}
                    className="text-sm text-primary-600 hover:text-primary-500 font-medium"
                  >
                    Continue Learning →
                  </Link>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* Recent Activity (for learners) */}
      {!isAdmin && recentActivity.length > 0 && (
        <div className="bg-white shadow rounded-lg">
          <div className="px-4 py-5 sm:p-6">
            <h3 className="text-lg leading-6 font-medium text-gray-900 mb-4">
              Recent Activity
            </h3>
            <div className="space-y-3">
              {recentActivity.map((activity, index) => (
                <div key={index} className="flex items-center space-x-3 p-3 bg-gray-50 rounded-lg">
                  <div className="flex-shrink-0">
                    {activity.completed ? (
                      <CheckCircleIcon className="h-5 w-5 text-green-600" />
                    ) : (
                      <PlayIcon className="h-5 w-5 text-blue-600" />
                    )}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-gray-900 truncate">
                      {activity.lesson_title}
                    </p>
                    <p className="text-xs text-gray-500">
                      {activity.course_title} • {activity.progress}% complete
                    </p>
                  </div>
                  <div className="text-xs text-gray-500">
                    {new Date(activity.updated_at).toLocaleDateString()}
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* Recent Courses */}
      <div className="bg-white shadow rounded-lg">
        <div className="px-4 py-5 sm:p-6">
          <h3 className="text-lg leading-6 font-medium text-gray-900 mb-4">
            {isAdmin ? 'All Courses' : 'Available Courses'}
          </h3>
          {recentCourses.length === 0 ? (
            <div className="text-center py-8">
              <AcademicCapIcon className="mx-auto h-12 w-12 text-gray-400" />
              <h3 className="mt-2 text-sm font-medium text-gray-900">No courses available</h3>
              <p className="mt-1 text-sm text-gray-500">
                Get started by browsing our course catalog.
              </p>
              <div className="mt-6">
                <Link
                  to="/courses"
                  className="btn btn-primary"
                >
                  Browse Courses
                </Link>
              </div>
            </div>
          ) : (
            <>
              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
                {recentCourses.map((course) => (
                  <div
                    key={course.id}
                    className="border border-gray-200 rounded-lg p-4 hover:shadow-md transition-shadow"
                  >
                    <div className="flex items-center justify-between mb-2">
                      <div className="flex-1">
                        <h4 className="text-sm font-medium text-gray-900 truncate">
                          {course.title}
                        </h4>
                        <p className="text-xs text-gray-500 mt-1">
                          by {course.instructor_first_name} {course.instructor_last_name}
                        </p>
                        <div className="flex items-center mt-2">
                          <div className="flex items-center space-x-2">
                            <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-primary-100 text-primary-800">
                              {course.difficulty_level}
                            </span>
                            {user && courseProgress[course.id] && courseProgress[course.id].summary.overallProgress === 100 && (
                              <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-green-100 text-green-800">
                                ✓ Complete
                              </span>
                            )}
                          </div>
                          <span className="ml-2 text-xs text-gray-500">
                            {course.duration_minutes} min
                          </span>
                        </div>

                        {/* Course Progress Bar */}
                        {user && courseProgress[course.id] && (
                          <div className="mt-3">
                            <div className="flex items-center justify-between mb-1">
                              <span className="text-xs text-gray-600">Progress</span>
                              <span className="text-xs font-bold text-primary-600">
                                {courseProgress[course.id].summary.overallProgress}%
                              </span>
                            </div>
                            <div className="w-full bg-gray-200 rounded-full h-1.5">
                              <div 
                                className="bg-primary-600 h-1.5 rounded-full transition-all duration-300"
                                style={{ width: `${courseProgress[course.id].summary.overallProgress}%` }}
                              ></div>
                            </div>
                            <div className="flex items-center justify-between mt-1 text-xs text-gray-500">
                              <span>
                                {courseProgress[course.id].summary.completedComponents} of {courseProgress[course.id].summary.totalComponents} completed
                              </span>
                              {courseProgress[course.id].summary.overallProgress === 100 && (
                                <span className="text-green-600 font-medium">✓ Complete</span>
                              )}
                            </div>
                          </div>
                        )}

                      </div>
                    </div>
                    <div className="mt-3">
                      <Link
                        to={`/courses/${course.id}`}
                        className="text-sm text-primary-600 hover:text-primary-500 font-medium"
                      >
                        {isAdmin ? 'Manage Course' : 'View Course'} →
                      </Link>
                    </div>
                  </div>
                ))}
              </div>
              <div className="mt-6">
                <Link
                  to="/courses"
                  className="text-sm text-primary-600 hover:text-primary-500 font-medium"
                >
                  View all courses →
                </Link>
              </div>
            </>
          )}
        </div>
      </div>

      {/* Quick Actions */}
      <div className="bg-white shadow rounded-lg">
        <div className="px-4 py-5 sm:p-6">
          <h3 className="text-lg leading-6 font-medium text-gray-900 mb-4">
            Quick Actions
          </h3>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
            <Link
              to="/courses"
              className="flex items-center p-3 border border-gray-200 rounded-lg hover:bg-gray-50 transition-colors"
            >
              <AcademicCapIcon className="h-5 w-5 text-primary-600 mr-3" />
              <span className="text-sm font-medium text-gray-900">
                {isAdmin ? 'Manage Courses' : 'Browse Courses'}
              </span>
            </Link>
            <Link
              to="/certificates"
              className="flex items-center p-3 border border-gray-200 rounded-lg hover:bg-gray-50 transition-colors"
            >
              <DocumentTextIcon className="h-5 w-5 text-green-600 mr-3" />
              <span className="text-sm font-medium text-gray-900">My Certificates</span>
            </Link>
            {isAdmin && (
              <Link
                to="/users"
                className="flex items-center p-3 border border-gray-200 rounded-lg hover:bg-gray-50 transition-colors"
              >
                <UserGroupIcon className="h-5 w-5 text-purple-600 mr-3" />
                <span className="text-sm font-medium text-gray-900">Manage Users</span>
              </Link>
            )}
            <Link
              to="/profile"
              className="flex items-center p-3 border border-gray-200 rounded-lg hover:bg-gray-50 transition-colors"
            >
              <ChartBarIcon className="h-5 w-5 text-yellow-600 mr-3" />
              <span className="text-sm font-medium text-gray-900">View Profile</span>
            </Link>
          </div>
        </div>
      </div>

      {/* Leaderboard - Admin and Trainer Only */}
      {(isAdmin || user.role === 'trainer') && (
        <div className="mt-6">
          <Leaderboard />
        </div>
      )}
    </div>
  )
}
