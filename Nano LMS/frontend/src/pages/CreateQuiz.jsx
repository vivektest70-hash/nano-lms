import { useState, useEffect } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { useAuth } from '../contexts/AuthContext'
import { api } from '../services/api'
import toast from 'react-hot-toast'
import { 
  PlusIcon, 
  TrashIcon, 
  ArrowLeftIcon,
  AcademicCapIcon,
  SparklesIcon,
  DocumentTextIcon
} from '@heroicons/react/24/outline'

export default function CreateQuiz() {
  const { id: courseId } = useParams()
  const { user, isAdmin, isTrainer } = useAuth()
  const navigate = useNavigate()
  const [loading, setLoading] = useState(false)
  const [course, setCourse] = useState(null)
  const [existingQuiz, setExistingQuiz] = useState(null)
  const [quizCreationMode, setQuizCreationMode] = useState('manual') // 'manual' or 'ai'
  const [aiGenerationType, setAiGenerationType] = useState('course') // 'course' or 'text'
  const [aiContent, setAiContent] = useState('')
  const [aiNumQuestions, setAiNumQuestions] = useState(5)
  const [aiLoading, setAiLoading] = useState(false)
  const [aiGeneratedQuestions, setAiGeneratedQuestions] = useState(null)
  const [aiError, setAiError] = useState('')
  const [showAiPreview, setShowAiPreview] = useState(false)
  
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
    fetchCourse()
    checkExistingQuiz()
    loadAIGeneratedQuiz()
  }, [courseId])

  const loadAIGeneratedQuiz = () => {
    const aiQuizData = localStorage.getItem('aiGeneratedQuiz')
    console.log('Checking for AI generated quiz data:', aiQuizData ? 'Found' : 'Not found');
    
    if (aiQuizData) {
      try {
        const quizData = JSON.parse(aiQuizData)
        console.log('Parsed quiz data:', quizData);
        
        setFormData(prev => ({
          ...prev,
          title: quizData.title || prev.title,
          description: quizData.description || prev.description,
          questions: quizData.questions?.map(q => ({
            question_text: q.question,
            question_type: 'multiple_choice',
            options: q.options.map(opt => opt.text),
            correct_answer: q.options.findIndex(opt => opt.isCorrect),
            explanation: q.explanation
          })) || prev.questions
        }))
        
        // Clear the stored data
        localStorage.removeItem('aiGeneratedQuiz')
        
        // Show success message
        toast.success('AI generated quiz questions loaded successfully!')
      } catch (error) {
        console.error('Error loading AI generated quiz:', error)
        localStorage.removeItem('aiGeneratedQuiz')
      }
    }
  }

  const handleGenerateAIQuiz = async () => {
    if (aiLoading) return;

    setAiLoading(true);
    setAiError('');

    try {
      const payload = {
        generationType: aiGenerationType,
        numQuestions: aiNumQuestions,
        course_id: parseInt(courseId)
      };

      if (aiGenerationType === 'text') {
        if (!aiContent.trim()) {
          setAiError('Please enter content for text-based generation');
          setAiLoading(false);
          return;
        }
        payload.content = aiContent;
      }

      const response = await api.post('/ai-quiz/generate', payload);
      
      if (response.data.success) {
        setAiGeneratedQuestions(response.data.questions);
        setShowAiPreview(true);
        toast.success('Quiz questions generated successfully!');
      }
    } catch (error) {
      console.error('Error generating AI quiz:', error);
      setAiError(error.response?.data?.message || 'Failed to generate quiz questions');
      toast.error('Failed to generate quiz questions');
    } finally {
      setAiLoading(false);
    }
  };

  const handleImportAIQuestions = () => {
    if (!aiGeneratedQuestions) return;

    const quizData = {
      title: `AI Generated Quiz - ${course?.title || 'Course Quiz'}`,
      description: `Quiz generated from ${aiGenerationType === 'course' ? 'course content' : 'text input'}`,
      questions: aiGeneratedQuestions.map((q, index) => ({
        question: q.question,
        options: [
          { text: q.options.A, isCorrect: q.correctAnswer === 'A' },
          { text: q.options.B, isCorrect: q.correctAnswer === 'B' },
          { text: q.options.C, isCorrect: q.correctAnswer === 'C' },
          { text: q.options.D, isCorrect: q.correctAnswer === 'D' }
        ],
        explanation: q.explanation
      }))
    };

    setFormData(prev => ({
      ...prev,
      title: quizData.title,
      description: quizData.description,
      questions: quizData.questions.map(q => ({
        question_text: q.question,
        question_type: 'multiple_choice',
        options: q.options.map(opt => opt.text),
        correct_answer: q.options.findIndex(opt => opt.isCorrect),
        explanation: q.explanation
      }))
    }));

    setQuizCreationMode('manual');
    setShowAiPreview(false);
    setAiGeneratedQuestions(null);
    toast.success('AI generated questions imported successfully!');
  };

  const fetchCourse = async () => {
    try {
      const response = await api.get(`/courses/${courseId}`)
      setCourse(response.data.course)
    } catch (error) {
      console.error('Failed to fetch course:', error)
      toast.error('Failed to load course details')
    }
  }

  const checkExistingQuiz = async () => {
    try {
      const response = await api.get(`/quizzes/courses/${courseId}`)
      if (response.data.quiz) {
        setExistingQuiz(response.data.quiz)
        toast.error('A quiz already exists for this course')
        navigate(`/courses/${courseId}`)
      }
    } catch (error) {
      // No existing quiz found, which is what we want
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

    setLoading(true)
    try {
      await api.post(`/quizzes`, {
        course_id: parseInt(courseId),
        ...formData
      })
      
      toast.success('Quiz created successfully!')
      navigate(`/courses/${courseId}`)
    } catch (error) {
      const message = error.response?.data?.message || 'Failed to create quiz'
      toast.error(message)
    } finally {
      setLoading(false)
    }
  }

  if (!course) {
    return (
      <div className="flex justify-center items-center py-12">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary-600"></div>
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
            <h1 className="text-2xl font-bold text-gray-900">Create Quiz</h1>
            <p className="text-sm text-gray-600">for {course.title}</p>
          </div>
        </div>
      </div>

      {/* Quiz Creation Mode Selection */}
      <div className="bg-white shadow rounded-lg p-6">
        <h2 className="text-lg font-semibold text-gray-900 mb-4">Choose Quiz Creation Method</h2>
        
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-6">
          <button
            type="button"
            onClick={() => setQuizCreationMode('manual')}
            className={`p-6 rounded-lg border-2 transition-all text-left ${
              quizCreationMode === 'manual'
                ? 'border-blue-500 bg-blue-50 text-blue-700'
                : 'border-gray-200 hover:border-gray-300'
            }`}
          >
            <DocumentTextIcon className="h-8 w-8 mb-3" />
            <h3 className="font-semibold text-lg mb-2">Manual Creation</h3>
            <p className="text-sm text-gray-600">
              Create quiz questions manually with full control over content and format.
            </p>
          </button>
          
          <button
            type="button"
            onClick={() => setQuizCreationMode('ai')}
            className={`p-6 rounded-lg border-2 transition-all text-left ${
              quizCreationMode === 'ai'
                ? 'border-purple-500 bg-purple-50 text-purple-700'
                : 'border-gray-200 hover:border-gray-300'
            }`}
          >
            <SparklesIcon className="h-8 w-8 mb-3" />
            <h3 className="font-semibold text-lg mb-2">AI Generation</h3>
            <p className="text-sm text-gray-600">
              Generate quiz questions automatically using AI based on course content or custom text.
            </p>
          </button>
        </div>

        {/* Content Area */}
        <div className="space-y-6">
          {/* AI Generation Interface */}
          {quizCreationMode === 'ai' && (
            <div className="border-t pt-6">
              <h3 className="text-lg font-semibold text-gray-900 mb-4 flex items-center">
                <SparklesIcon className="h-5 w-5 mr-2" />
                AI Quiz Generation
              </h3>
              
              {/* Generation Type Selection */}
              <div className="mb-6">
                <label className="block text-sm font-medium text-gray-700 mb-3">
                  Generation Type
                </label>
                <div className="grid grid-cols-2 gap-3">
                  <button
                    type="button"
                    onClick={() => setAiGenerationType('course')}
                    className={`p-4 rounded-lg border-2 transition-all ${
                      aiGenerationType === 'course'
                        ? 'border-purple-500 bg-purple-50 text-purple-700'
                        : 'border-gray-200 hover:border-gray-300'
                    }`}
                  >
                    <AcademicCapIcon className="h-6 w-6 mx-auto mb-2" />
                    <span className="font-medium">Course Content</span>
                    <p className="text-xs text-gray-500 mt-1">Use existing course materials</p>
                  </button>
                  <button
                    type="button"
                    onClick={() => setAiGenerationType('text')}
                    className={`p-4 rounded-lg border-2 transition-all ${
                      aiGenerationType === 'text'
                        ? 'border-purple-500 bg-purple-50 text-purple-700'
                        : 'border-gray-200 hover:border-gray-300'
                    }`}
                  >
                    <DocumentTextIcon className="h-6 w-6 mx-auto mb-2" />
                    <span className="font-medium">Text Input</span>
                    <p className="text-xs text-gray-500 mt-1">Enter custom content</p>
                  </button>
                </div>
              </div>

              {/* Text Input (for text-based generation) */}
              {aiGenerationType === 'text' && (
                <div className="mb-6">
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Content for Quiz Generation
                  </label>
                  <textarea
                    value={aiContent}
                    onChange={(e) => setAiContent(e.target.value)}
                    className="w-full p-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent"
                    rows={6}
                    placeholder="Enter the content you want to generate quiz questions from..."
                  />
                </div>
              )}

              {/* Number of Questions */}
              <div className="mb-6">
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Number of Questions
                </label>
                <input
                  type="number"
                  value={aiNumQuestions}
                  onChange={(e) => setAiNumQuestions(parseInt(e.target.value) || 5)}
                  className="w-full p-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent"
                  min="1"
                  max="20"
                />
              </div>

              {/* Generate Button */}
              <button
                type="button"
                onClick={handleGenerateAIQuiz}
                disabled={aiLoading || (aiGenerationType === 'text' && !aiContent.trim())}
                className="w-full bg-purple-600 text-white py-3 px-4 rounded-lg font-medium hover:bg-purple-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors flex items-center justify-center"
              >
                {aiLoading ? (
                  <>
                    <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-white mr-2"></div>
                    Generating Questions...
                  </>
                ) : (
                  <>
                    <SparklesIcon className="h-5 w-5 mr-2" />
                    Generate Quiz Questions
                  </>
                )}
              </button>

              {/* Error Message */}
              {aiError && (
                <div className="mt-4 p-3 bg-red-50 border border-red-200 rounded-lg">
                  <p className="text-red-700 text-sm">{aiError}</p>
                </div>
              )}

              {/* AI Generated Questions Preview */}
              {showAiPreview && aiGeneratedQuestions && (
                <div className="mt-6 border-t pt-6">
                  <div className="flex items-center justify-between mb-4">
                    <h4 className="text-lg font-semibold text-gray-900">
                      Generated Questions Preview
                    </h4>
                    <button
                      type="button"
                      onClick={handleImportAIQuestions}
                      className="bg-green-600 text-white px-4 py-2 rounded-lg hover:bg-green-700 transition-colors"
                    >
                      Import to Quiz
                    </button>
                  </div>
                  
                  <div className="space-y-4">
                    {aiGeneratedQuestions.map((question, index) => (
                      <div key={index} className="border border-gray-200 rounded-lg p-4">
                        <h5 className="font-medium text-gray-900 mb-3">
                          Question {index + 1}: {question.question}
                        </h5>
                        <div className="space-y-2">
                          {Object.entries(question.options).map(([key, value]) => (
                            <div
                              key={key}
                              className={`p-2 rounded ${
                                question.correctAnswer === key
                                  ? 'bg-green-50 border border-green-200'
                                  : 'bg-gray-50'
                              }`}
                            >
                              <span className="font-medium mr-2">{key}.</span>
                              {value}
                              {question.correctAnswer === key && (
                                <span className="ml-2 text-green-600 text-sm">✓ Correct</span>
                              )}
                            </div>
                          ))}
                        </div>
                        {question.explanation && (
                          <div className="mt-3 p-2 bg-blue-50 rounded text-sm text-blue-700">
                            <strong>Explanation:</strong> {question.explanation}
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}

          {/* Manual Quiz Form */}
          {quizCreationMode === 'manual' && (
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
                        <h3 className="font-medium text-gray-900">Question {questionIndex + 1}</h3>
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
                    disabled={loading}
                    className="btn btn-primary"
                  >
                    {loading ? 'Creating...' : 'Create Quiz'}
                  </button>
                </div>
              </form>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}


