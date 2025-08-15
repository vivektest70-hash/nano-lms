import { useState, useEffect } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { useAuth } from '../contexts/AuthContext'
import { api } from '../services/api'
import toast from 'react-hot-toast'
import { 
  PlusIcon, 
  TrashIcon, 
  ArrowLeftIcon,
  AcademicCapIcon
} from '@heroicons/react/24/outline'

export default function EditQuiz() {
  const { id: courseId } = useParams()
  const { user, isAdmin, isTrainer } = useAuth()
  const navigate = useNavigate()
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [course, setCourse] = useState(null)
  const [quiz, setQuiz] = useState(null)
  
  const [formData, setFormData] = useState({
    title: '',
    description: '',
    passing_percentage: 40,
    time_limit_minutes: 10,
    questions: [
      {
        question_text: '',
        question_type: 'multiple_choice',
        options: ['', '', '', ''],
        correct_answer: 0
      }
    ]
  })

  useEffect(() => {
    fetchCourseAndQuiz()
  }, [courseId])

  const fetchCourseAndQuiz = async () => {
    try {
      const [courseResponse, quizResponse] = await Promise.all([
        api.get(`/courses/${courseId}`),
        api.get(`/quizzes/courses/${courseId}`)
      ])
      
      setCourse(courseResponse.data.course)
      
      if (quizResponse.data.quiz) {
        setQuiz(quizResponse.data.quiz)
        setFormData({
          title: quizResponse.data.quiz.title,
          description: quizResponse.data.quiz.description || '',
          passing_percentage: quizResponse.data.quiz.passing_percentage,
          time_limit_minutes: quizResponse.data.quiz.time_limit_minutes,
          questions: (quizResponse.data.questions || quizResponse.data.quiz.questions || []).map(q => ({
            question_text: q.question_text,
            question_type: q.question_type,
            options: q.options,
            correct_answer: q.correct_answer
          }))
        })
      } else {
        toast.error('No quiz found for this course')
        navigate(`/courses/${courseId}`)
      }
    } catch (error) {
      console.error('Failed to fetch course and quiz:', error)
      toast.error('Failed to load quiz details')
      navigate(`/courses/${courseId}`)
    } finally {
      setLoading(false)
    }
  }

  const handleInputChange = (e) => {
    const { name, value } = e.target
    setFormData(prev => ({
      ...prev,
      [name]: value
    }))
  }

  const handleQuestionChange = (index, field, value) => {
    setFormData(prev => ({
      ...prev,
      questions: prev.questions.map((q, i) => 
        i === index ? { ...q, [field]: value } : q
      )
    }))
  }

  const handleOptionChange = (questionIndex, optionIndex, value) => {
    setFormData(prev => ({
      ...prev,
      questions: prev.questions.map((q, i) => 
        i === questionIndex 
          ? { 
              ...q, 
              options: q.options.map((opt, j) => 
                j === optionIndex ? value : opt
              )
            }
          : q
      )
    }))
  }

  const addQuestion = () => {
    setFormData(prev => ({
      ...prev,
      questions: [
        ...prev.questions,
        {
          question_text: '',
          question_type: 'multiple_choice',
          options: ['', '', '', ''],
          correct_answer: 0
        }
      ]
    }))
  }

  const removeQuestion = (index) => {
    if (formData.questions.length <= 1) {
      toast.error('Quiz must have at least one question')
      return
    }
    
    setFormData(prev => ({
      ...prev,
      questions: prev.questions.filter((_, i) => i !== index)
    }))
  }

  const addOption = (questionIndex) => {
    setFormData(prev => ({
      ...prev,
      questions: prev.questions.map((q, i) => 
        i === questionIndex 
          ? { ...q, options: [...q.options, ''] }
          : q
      )
    }))
  }

  const removeOption = (questionIndex, optionIndex) => {
    if (formData.questions[questionIndex].options.length <= 2) {
      toast.error('Question must have at least 2 options')
      return
    }
    
    setFormData(prev => ({
      ...prev,
      questions: prev.questions.map((q, i) => 
        i === questionIndex 
          ? { 
              ...q, 
              options: q.options.filter((_, j) => j !== optionIndex),
              correct_answer: Math.min(q.correct_answer, q.options.length - 2)
            }
          : q
      )
    }))
  }

  const handleSubmit = async (e) => {
    e.preventDefault()
    
    // Validation
    if (!formData.title.trim()) {
      toast.error('Quiz title is required')
      return
    }
    
    if (formData.questions.some(q => !q.question_text.trim())) {
      toast.error('All questions must have text')
      return
    }
    
    if (formData.questions.some(q => q.options.some(opt => !opt.trim()))) {
      toast.error('All options must have text')
      return
    }

    setSaving(true)
    try {
      await api.put(`/quizzes/${quiz.id}`, formData)
      
      toast.success('Quiz updated successfully!')
      navigate(`/courses/${courseId}`)
    } catch (error) {
      const message = error.response?.data?.message || 'Failed to update quiz'
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
            <h1 className="text-2xl font-bold text-gray-900">Edit Quiz</h1>
            <p className="text-sm text-gray-600">for {course.title}</p>
          </div>
        </div>
      </div>

      {/* Quiz Form */}
      <div className="bg-white shadow rounded-lg">
        <form onSubmit={handleSubmit} className="space-y-6 p-6">
          {/* Quiz Details */}
          <div className="space-y-4">
            <h2 className="text-lg font-semibold text-gray-900 flex items-center">
              <AcademicCapIcon className="h-5 w-5 mr-2" />
              Quiz Details
            </h2>
            
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Quiz Title *
                </label>
                <input
                  type="text"
                  name="title"
                  value={formData.title}
                  onChange={handleInputChange}
                  className="input w-full"
                  placeholder="Enter quiz title"
                  required
                />
              </div>
              
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Description
                </label>
                <input
                  type="text"
                  name="description"
                  value={formData.description}
                  onChange={handleInputChange}
                  className="input w-full"
                  placeholder="Enter quiz description"
                />
              </div>
              
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Passing Percentage *
                </label>
                <input
                  type="number"
                  name="passing_percentage"
                  value={formData.passing_percentage}
                  onChange={handleInputChange}
                  className="input w-full"
                  min="1"
                  max="100"
                  required
                />
              </div>
              
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Time Limit (minutes) *
                </label>
                <input
                  type="number"
                  name="time_limit_minutes"
                  value={formData.time_limit_minutes}
                  onChange={handleInputChange}
                  className="input w-full"
                  min="1"
                  max="120"
                  required
                />
              </div>
            </div>
          </div>

          {/* Questions */}
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <h2 className="text-lg font-semibold text-gray-900">Questions</h2>
              <button
                type="button"
                onClick={addQuestion}
                className="btn btn-primary btn-sm"
              >
                <PlusIcon className="h-4 w-4 mr-1" />
                Add Question
              </button>
            </div>
            
            {formData.questions.map((question, questionIndex) => (
              <div key={questionIndex} className="border border-gray-200 rounded-lg p-4 space-y-4">
                <div className="flex items-center justify-between">
                  <h3 className="text-md font-medium text-gray-900">
                    Question {questionIndex + 1}
                  </h3>
                  <button
                    type="button"
                    onClick={() => removeQuestion(questionIndex)}
                    className="btn btn-outline btn-danger btn-sm"
                  >
                    <TrashIcon className="h-4 w-4" />
                  </button>
                </div>
                
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Question Text *
                  </label>
                  <textarea
                    value={question.question_text}
                    onChange={(e) => handleQuestionChange(questionIndex, 'question_text', e.target.value)}
                    className="textarea w-full"
                    rows="2"
                    placeholder="Enter your question"
                    required
                  />
                </div>
                
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Question Type
                  </label>
                  <select
                    value={question.question_type}
                    onChange={(e) => handleQuestionChange(questionIndex, 'question_type', e.target.value)}
                    className="select w-full"
                  >
                    <option value="multiple_choice">Multiple Choice</option>
                    <option value="checkbox">Checkbox</option>
                  </select>
                </div>
                
                <div className="space-y-3">
                  <div className="flex items-center justify-between">
                    <label className="block text-sm font-medium text-gray-700">
                      Options *
                    </label>
                    <button
                      type="button"
                      onClick={() => addOption(questionIndex)}
                      className="btn btn-outline btn-sm"
                    >
                      <PlusIcon className="h-3 w-3 mr-1" />
                      Add Option
                    </button>
                  </div>
                  
                  {question.options.map((option, optionIndex) => (
                    <div key={optionIndex} className="flex items-center space-x-2">
                      <input
                        type="radio"
                        name={`correct_${questionIndex}`}
                        checked={question.correct_answer === optionIndex}
                        onChange={() => handleQuestionChange(questionIndex, 'correct_answer', optionIndex)}
                        className="radio"
                      />
                      <input
                        type="text"
                        value={option}
                        onChange={(e) => handleOptionChange(questionIndex, optionIndex, e.target.value)}
                        className="input flex-1"
                        placeholder={`Option ${optionIndex + 1}`}
                        required
                      />
                      <button
                        type="button"
                        onClick={() => removeOption(questionIndex, optionIndex)}
                        className="btn btn-outline btn-danger btn-sm"
                      >
                        <TrashIcon className="h-3 w-3" />
                      </button>
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </div>

          {/* Submit Button */}
          <div className="flex justify-end space-x-3 pt-6 border-t">
            <button
              type="button"
              onClick={() => navigate(`/courses/${courseId}`)}
              className="btn btn-outline"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={saving}
              className="btn btn-primary"
            >
              {saving ? 'Updating...' : 'Update Quiz'}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}
