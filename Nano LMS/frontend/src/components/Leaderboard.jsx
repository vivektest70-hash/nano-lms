import { useState, useEffect } from 'react'
import { api } from '../services/api'
import { TrophyIcon, StarIcon, AcademicCapIcon } from '@heroicons/react/24/outline'

export default function Leaderboard() {
  const [leaderboard, setLeaderboard] = useState([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    fetchLeaderboard()
  }, [])

  const fetchLeaderboard = async () => {
    try {
      setLoading(true)
      const response = await api.get('/users/leaderboard')
      setLeaderboard(response.data.leaderboard || [])
    } catch (error) {
      console.error('Failed to fetch leaderboard:', error)
    } finally {
      setLoading(false)
    }
  }

  const getRankIcon = (rank) => {
    if (rank === 1) {
      return <TrophyIcon className="h-6 w-6 text-yellow-500" />
    } else if (rank === 2) {
      return <StarIcon className="h-6 w-6 text-gray-400" />
    } else if (rank === 3) {
      return <AcademicCapIcon className="h-6 w-6 text-orange-500" />
    }
    return <span className="text-lg font-bold text-gray-600">{rank}</span>
  }

  const getRankColor = (rank) => {
    if (rank === 1) return 'bg-yellow-50 border-yellow-200'
    if (rank === 2) return 'bg-gray-50 border-gray-200'
    if (rank === 3) return 'bg-orange-50 border-orange-200'
    return 'bg-white border-gray-200'
  }

  if (loading) {
    return (
      <div className="bg-white shadow rounded-lg p-6">
        <div className="flex items-center justify-center h-32">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary-600"></div>
        </div>
      </div>
    )
  }

  return (
    <div className="bg-white shadow rounded-lg p-6">
      <div className="flex items-center justify-between mb-6">
        <h2 className="text-xl font-bold text-gray-900">Leaderboard</h2>
        <TrophyIcon className="h-6 w-6 text-yellow-500" />
      </div>

      {leaderboard.length === 0 ? (
        <div className="text-center py-8">
          <TrophyIcon className="h-12 w-12 text-gray-400 mx-auto mb-4" />
          <h3 className="text-lg font-medium text-gray-900 mb-2">No Data Available</h3>
          <p className="text-sm text-gray-500">
            Course completion data will appear here once users start completing courses.
          </p>
        </div>
      ) : (
        <div className="space-y-3">
          {leaderboard.map((user, index) => (
            <div
              key={user.id}
              className={`flex items-center justify-between p-4 rounded-lg border ${getRankColor(index + 1)}`}
            >
              <div className="flex items-center space-x-4">
                <div className="flex items-center justify-center w-8 h-8">
                  {getRankIcon(index + 1)}
                </div>
                <div>
                  <h3 className="font-semibold text-gray-900">
                    {user.first_name} {user.last_name}
                  </h3>
                  <p className="text-sm text-gray-500 capitalize">{user.role}</p>
                </div>
              </div>
              
              <div className="text-right">
                <div className="flex items-center space-x-4">
                  <div>
                    <p className="text-sm text-gray-500">Enrolled</p>
                    <p className="text-lg font-bold text-gray-900">{user.enrolledCourses}</p>
                  </div>
                  <div>
                    <p className="text-sm text-gray-500">Completed</p>
                    <p className="text-lg font-bold text-blue-600">{user.completedCourses}</p>
                  </div>
                  <div>
                    <p className="text-sm text-gray-500">Progress</p>
                    <p className="text-lg font-bold text-primary-600">{user.progressPercentage}%</p>
                  </div>
                  <div>
                    <p className="text-sm text-gray-500">Certificates</p>
                    <p className="text-lg font-bold text-green-600">{user.certificates}</p>
                  </div>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
