import { useState, useEffect } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { useAuth } from '../contexts/AuthContext'
import { api } from '../services/api'
import toast from 'react-hot-toast'
import { 
  ArrowLeftIcon,
  ClockIcon,
  AcademicCapIcon,
  CheckCircleIcon,
  XCircleIcon
} from '@heroicons/react/24/outline'

export default function TakeQuiz() {
  const { id: courseId } = useParams()
  const { user } = useAuth()
  const navigate = useNavigate()
  const [loading, setLoading] = useState(true)
  const [submitting, setSubmitting] = useState(false)
  const [course, setCourse] = useState(null)
  const [quiz, setQuiz] = useState(null)
  const [questions, setQuestions] = useState([])
  const [answers, setAnswers] = useState({})
  const [timeLeft, setTimeLeft] = useState(0)
  const [results, setResults] = useState(null)

  useEffect(() => {
    fetchQuiz()
  }, [courseId])

  useEffect(() => {
    if (timeLeft > 0) {
      const timer = setTimeout(() => setTimeLeft(timeLeft - 1), 1000)
      return () => clearTimeout(timer)
    } else if (timeLeft === 0 && quiz && !results) {
      handleSubmit()
    }
  }, [timeLeft, quiz, results])

  const fetchQuiz = async () => {
    try {
      const [courseResponse, quizResponse] = await Promise.all([
        api.get(`/courses/${courseId}`),
        api.get(`/quizzes/courses/${courseId}?t=${Date.now()}`)
      ])
      
      setCourse(courseResponse.data.course)
      
      if (quizResponse.data.quiz) {
        setQuiz(quizResponse.data.quiz)
        setQuestions(quizResponse.data.questions || [])
        setTimeLeft(quizResponse.data.quiz.time_limit_minutes * 60)
      } else {
        toast.error('No quiz found for this course')
        navigate(`/courses/${courseId}`)
      }
    } catch (error) {
      console.error('Failed to fetch quiz:', error)
      toast.error('Failed to load quiz')
      navigate(`/courses/${courseId}`)
    } finally {
      setLoading(false)
    }
  }

  const handleAnswerChange = (questionId, answer) => {
    setAnswers(prev => ({
      ...prev,
      [questionId]: answer
    }))
  }

  const handleSubmit = async () => {
    if (Object.keys(answers).length === 0) {
      toast.error('Please answer at least one question')
      return
    }

    setSubmitting(true)
    try {
      const response = await api.post(`/quizzes/${quiz.id}/submit`, {
        answers,
        time_taken_seconds: (quiz.time_limit_minutes * 60) - timeLeft
      })
      
      setResults(response.data)
      toast.success('Quiz submitted successfully!')
    } catch (error) {
      const message = error.response?.data?.message || 'Failed to submit quiz'
      toast.error(message)
    } finally {
      setSubmitting(false)
    }
  }

  const formatTime = (seconds) => {
    const mins = Math.floor(seconds / 60)
    const secs = seconds % 60
    return `${mins}:${secs.toString().padStart(2, '0')}`
  }

  if (loading) {
    return (
      <div className="flex justify-center items-center py-12">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary-600"></div>
      </div>
    )
  }

  if (!quiz) {
    return (
      <div className="text-center py-12">
        <h3 className="text-lg font-medium text-gray-900">Quiz not found</h3>
        <p className="text-sm text-gray-500">The quiz for this course doesn't exist.</p>
        <button
          onClick={() => navigate(`/courses/${courseId}`)}
          className="btn btn-primary mt-4"
        >
          Back to Course
        </button>
      </div>
    )
  }

  if (results) {
    return (
      <div className="max-w-2xl mx-auto space-y-6">
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
            <p className="text-sm text-gray-600">{course?.title}</p>
          </div>
        </div>

        {/* Results */}
        <div className="bg-white shadow rounded-lg p-6 space-y-6">
          <div className="text-center">
            <div className={`w-16 h-16 rounded-full flex items-center justify-center mx-auto mb-4 ${
              results.passed ? 'bg-green-100' : 'bg-red-100'
            }`}>
              {results.passed ? (
                <CheckCircleIcon className="h-8 w-8 text-green-600" />
              ) : (
                <XCircleIcon className="h-8 w-8 text-red-600" />
              )}
            </div>
            
            <h2 className={`text-2xl font-bold mb-2 ${
              results.passed ? 'text-green-600' : 'text-red-600'
            }`}>
              {results.passed ? 'Congratulations!' : 'Try Again'}
            </h2>
            
            <p className="text-gray-600 mb-4">
              {results.passed 
                ? 'You passed the quiz and earned a certificate!' 
                : 'You need to score higher to pass this quiz.'
              }
            </p>
          </div>

          <div className="grid grid-cols-2 gap-4 text-center">
            <div className="bg-gray-50 rounded-lg p-4">
              <div className="text-2xl font-bold text-primary-600">
                {results.score}%
              </div>
              <div className="text-sm text-gray-600">Score</div>
            </div>
            
            <div className="bg-gray-50 rounded-lg p-4">
              <div className="text-2xl font-bold text-primary-600">
                {results.correct_answers}/{results.total_questions}
              </div>
              <div className="text-sm text-gray-600">Correct Answers</div>
            </div>
          </div>

          <div className="text-center space-y-2">
            <p className="text-sm text-gray-600">
              Time taken: {Math.floor(results.time_taken_seconds / 60)}m {results.time_taken_seconds % 60}s
            </p>
            <p className="text-sm text-gray-600">
              Passing score: {quiz.passing_percentage}%
            </p>
          </div>

          <div className="flex justify-center space-x-3">
            {results.passed && (
              <button
                onClick={() => navigate(`/courses/${courseId}/quiz-results`)}
                className="btn btn-primary"
              >
                View Certificate
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
      </div>
    )
  }

  return (
    <div className="max-w-4xl mx-auto space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center space-x-3">
          <button
            onClick={() => navigate(`/courses/${courseId}`)}
            className="btn btn-outline btn-sm"
          >
            <ArrowLeftIcon className="h-4 w-4 mr-1" />
            Back to Course
          </button>
          <div>
            <h1 className="text-2xl font-bold text-gray-900">{quiz.title}</h1>
            <p className="text-sm text-gray-600">{course?.title}</p>
          </div>
        </div>
        
        <div className="flex items-center space-x-4">
          <div className="flex items-center space-x-2 text-sm text-gray-600">
            <ClockIcon className="h-4 w-4" />
            <span className="font-mono">{formatTime(timeLeft)}</span>
          </div>
          
          <div className="text-sm text-gray-600">
            {questions.length} questions
          </div>
        </div>
      </div>

      {/* Quiz Instructions */}
      <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
        <h3 className="font-medium text-blue-900 mb-2">Instructions:</h3>
        <ul className="text-sm text-blue-800 space-y-1">
          <li>• Answer all questions to the best of your ability</li>
          <li>• You have {quiz.time_limit_minutes} minutes to complete the quiz</li>
          <li>• You need {quiz.passing_percentage}% to pass</li>
          <li>• You can retake the quiz if you don't pass</li>
        </ul>
      </div>

      {/* Questions */}
      <div className="space-y-6">
        {questions.map((question, index) => (
          <div key={question.id} className="bg-white shadow rounded-lg p-6">
            <div className="mb-4">
              <h3 className="text-lg font-medium text-gray-900 mb-2">
                Question {index + 1}
              </h3>
              <p className="text-gray-700">{question.question_text}</p>
            </div>
            
            <div className="space-y-2">
              {question.options.map((option, optionIndex) => (
                <label key={optionIndex} className="flex items-center space-x-3 cursor-pointer">
                  <input
                    type={question.question_type === 'checkbox' ? 'checkbox' : 'radio'}
                    name={`question_${question.id}`}
                    value={optionIndex}
                    checked={
                      question.question_type === 'checkbox'
                        ? answers[question.id]?.includes(optionIndex) || false
                        : answers[question.id] === optionIndex
                    }
                    onChange={(e) => {
                      if (question.question_type === 'checkbox') {
                        const currentAnswers = answers[question.id] || []
                        const newAnswers = e.target.checked
                          ? [...currentAnswers, optionIndex]
                          : currentAnswers.filter(a => a !== optionIndex)
                        handleAnswerChange(question.id, newAnswers)
                      } else {
                        handleAnswerChange(question.id, parseInt(e.target.value))
                      }
                    }}
                    className="radio"
                  />
                  <span className="text-gray-700">{option}</span>
                </label>
              ))}
            </div>
          </div>
        ))}
      </div>

      {/* Submit Button */}
      <div className="flex justify-end space-x-3 pt-6 border-t">
        <button
          onClick={() => navigate(`/courses/${courseId}`)}
          className="btn btn-outline"
        >
          Cancel
        </button>
        <button
          onClick={handleSubmit}
          disabled={submitting}
          className="btn btn-primary"
        >
          {submitting ? 'Submitting...' : 'Submit Quiz'}
        </button>
      </div>
    </div>
  )
}
