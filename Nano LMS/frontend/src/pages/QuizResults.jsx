import { useState, useEffect } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { useAuth } from '../contexts/AuthContext'
import { api } from '../services/api'
import toast from 'react-hot-toast'
import { 
  ArrowLeftIcon,
  AcademicCapIcon,
  ArrowDownTrayIcon,
  CheckCircleIcon
} from '@heroicons/react/24/outline'

export default function QuizResults() {
  const { id: courseId } = useParams()
  const { user } = useAuth()
  const navigate = useNavigate()
  const [loading, setLoading] = useState(true)
  const [course, setCourse] = useState(null)
  const [quiz, setQuiz] = useState(null)
  const [latestAttempt, setLatestAttempt] = useState(null)
  const [certificate, setCertificate] = useState(null)

  useEffect(() => {
    fetchData()
  }, [courseId])

  const fetchData = async () => {
    try {
      const [courseResponse, quizResponse] = await Promise.all([
        api.get(`/courses/${courseId}`),
        api.get(`/quizzes/courses/${courseId}`)
      ])
      
      setCourse(courseResponse.data.course)
      setQuiz(quizResponse.data.quiz)
      
      if (quizResponse.data.quiz) {
        // Get latest attempt
        const attemptsResponse = await api.get(`/quizzes/${quizResponse.data.quiz.id}/attempts`)
        if (attemptsResponse.data.attempts.length > 0) {
          const latest = attemptsResponse.data.attempts[0]
          setLatestAttempt(latest)
          
          // Get certificate if passed
          if (latest.is_passed) {
            try {
              const certResponse = await api.get(`/certificates/user/${user.id}`)
              console.log('Certificates response:', certResponse.data);
              const userCert = certResponse.data.certificates.find(
                cert => cert.quiz_id === quizResponse.data.quiz.id
              )
              console.log('Found certificate:', userCert);
              setCertificate(userCert)
            } catch (error) {
              console.log('No certificate found:', error)
            }
          }
        }
      }
    } catch (error) {
      console.error('Failed to fetch data:', error)
      toast.error('Failed to load quiz results')
    } finally {
      setLoading(false)
    }
  }

  const handleDownloadCertificate = async () => {
    if (!certificate) {
      console.log('No certificate found');
      return;
    }
    
    console.log('Starting download for certificate:', certificate.id);
    try {
      const timestamp = Date.now()
      console.log('Making download request to:', `/certificates/${certificate.id}/download?t=${timestamp}`);
      const response = await api.get(
        `/certificates/${certificate.id}/download?t=${timestamp}`,
        { 
          responseType: 'blob',
          headers: {
            'Cache-Control': 'no-cache',
            'Pragma': 'no-cache'
          }
        }
      )
      
      console.log('Download response received:', response);
      const url = window.URL.createObjectURL(new Blob([response.data]))
      const link = document.createElement('a')
      link.href = url
      link.setAttribute('download', `certificate-${course.title}.pdf`)
      document.body.appendChild(link)
      link.click()
      link.remove()
      window.URL.revokeObjectURL(url)
      
      console.log('Download completed successfully');
      toast.success('Certificate downloaded successfully!')
    } catch (error) {
      console.error('Failed to download certificate:', error)
      console.log('Error details:', error.response?.status, error.response?.data);
      toast.error('Failed to download certificate')
    }
  }

  if (loading) {
    return (
      <div className="flex justify-center items-center py-12">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary-600"></div>
      </div>
    )
  }

  if (!course || !quiz || !latestAttempt) {
    return (
      <div className="text-center py-12">
        <h3 className="text-lg font-medium text-gray-900">No results found</h3>
        <p className="text-sm text-gray-500">You need to take the quiz first.</p>
        <button
          onClick={() => navigate(`/courses/${courseId}`)}
          className="btn btn-primary mt-4"
        >
          Back to Course
        </button>
      </div>
    )
  }

  return (
    <div className="max-w-4xl mx-auto space-y-6">
      {/* Header */}
      <div className="flex items-center space-x-3">
        <button
          onClick={() => navigate(`/courses/${courseId}`)}
          className="btn btn-outline btn-sm"
        >
          <ArrowLeftIcon className="h-4 w-4 mr-1" />
          Back to Course
        </button>
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Quiz Results</h1>
          <p className="text-sm text-gray-600">{course.title}</p>
        </div>
      </div>

      {/* Results Summary */}
      <div className="bg-white shadow rounded-lg p-6">
        <div className="text-center mb-6">
          <div className={`w-16 h-16 rounded-full flex items-center justify-center mx-auto mb-4 ${
            latestAttempt.is_passed ? 'bg-green-100' : 'bg-red-100'
          }`}>
            {latestAttempt.is_passed ? (
              <CheckCircleIcon className="h-8 w-8 text-green-600" />
            ) : (
              <AcademicCapIcon className="h-8 w-8 text-red-600" />
            )}
          </div>
          
          <h2 className={`text-2xl font-bold mb-2 ${
            latestAttempt.is_passed ? 'text-green-600' : 'text-red-600'
          }`}>
            {latestAttempt.is_passed ? 'Quiz Passed!' : 'Quiz Failed'}
          </h2>
          
          <p className="text-gray-600">
            {latestAttempt.is_passed 
              ? 'Congratulations! You have successfully completed this quiz.' 
              : 'Keep practicing and try again to improve your score.'
            }
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
          <div className="bg-gray-50 rounded-lg p-4 text-center">
            <div className="text-2xl font-bold text-primary-600">
              {latestAttempt.score}%
            </div>
            <div className="text-sm text-gray-600">Score</div>
          </div>
          
          <div className="bg-gray-50 rounded-lg p-4 text-center">
            <div className="text-2xl font-bold text-primary-600">
              {latestAttempt.correct_answers}/{latestAttempt.total_questions}
            </div>
            <div className="text-sm text-gray-600">Correct Answers</div>
          </div>
          
          <div className="bg-gray-50 rounded-lg p-4 text-center">
            <div className="text-2xl font-bold text-primary-600">
              {Math.floor(latestAttempt.time_taken_seconds / 60)}m {latestAttempt.time_taken_seconds % 60}s
            </div>
            <div className="text-sm text-gray-600">Time Taken</div>
          </div>
        </div>

        <div className="text-center space-y-2 text-sm text-gray-600">
          <p>Passing score: {quiz.passing_percentage}%</p>
          <p>Attempt date: {new Date(latestAttempt.completed_at).toLocaleDateString()}</p>
        </div>
      </div>

      {/* Certificate Section */}
      {latestAttempt.is_passed && (
        <div className="bg-white shadow rounded-lg p-6">
          <div className="flex items-center justify-between">
            <div>
              <h3 className="text-lg font-semibold text-gray-900 flex items-center">
                <AcademicCapIcon className="h-5 w-5 mr-2" />
                Certificate
              </h3>
              <p className="text-sm text-gray-600 mt-1">
                Download your certificate of completion
              </p>
            </div>
            
            <button
              onClick={handleDownloadCertificate}
              className="btn btn-primary"
            >
              <ArrowDownTrayIcon className="h-4 w-4 mr-1" />
              Download Certificate
            </button>
          </div>
        </div>
      )}

      {/* Action Buttons */}
      <div className="flex justify-center space-x-3">
        {!latestAttempt.is_passed && (
          <button
            onClick={() => navigate(`/courses/${courseId}/quiz`)}
            className="btn btn-primary"
          >
            Retake Quiz
          </button>
        )}
        <button
          onClick={() => navigate(`/courses/${courseId}`)}
          className="btn btn-outline"
        >
          Back to Course
        </button>
      </div>
    </div>
  )
}
