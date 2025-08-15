import { Routes, Route, Navigate } from 'react-router-dom'
import { useAuth } from './contexts/AuthContext'
import Layout from './components/Layout'
import Login from './pages/Login'
import Register from './pages/Register'
import Dashboard from './pages/Dashboard'
import Courses from './pages/Courses'
import CreateCourse from './pages/CreateCourse'
import CourseDetail from './pages/CourseDetail'
import EditCourse from './pages/EditCourse'
import EditLesson from './pages/EditLesson'
import AddLesson from './pages/AddLesson'
import LessonView from './pages/LessonView'
import UserManagement from './pages/UserManagement'
import AccountSettings from './pages/AccountSettings'
import Certificates from './pages/Certificates'
import CreateQuiz from './pages/CreateQuiz'
import EditQuiz from './pages/EditQuiz'
import TakeQuiz from './pages/TakeQuiz'
import QuizResults from './pages/QuizResults'

function App() {
  const { user, loading } = useAuth()

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <div className="text-center">
          <div className="animate-spin rounded-full h-32 w-32 border-b-2 border-primary-600 mx-auto mb-4"></div>
          <p className="text-gray-600">Loading Nano LMS...</p>
        </div>
      </div>
    )
  }

  return (
    <Routes>
      {/* Public routes */}
      <Route path="/login" element={!user ? <Login /> : <Navigate to="/dashboard" replace />} />
      <Route path="/register" element={!user ? <Register /> : <Navigate to="/dashboard" replace />} />
      
      {/* Protected routes */}
      <Route path="/" element={user ? <Layout /> : <Navigate to="/login" replace />}>
        <Route index element={<Navigate to="/dashboard" replace />} />
        <Route path="dashboard" element={<Dashboard />} />
        <Route path="courses" element={<Courses />} />
        <Route path="courses/create" element={<CreateCourse />} />
        <Route path="courses/:id" element={<CourseDetail />} />
        <Route path="courses/:id/edit" element={<EditCourse />} />
        <Route path="courses/:id/lessons/create" element={<AddLesson />} />
        <Route path="courses/:id/quiz/create" element={<CreateQuiz />} />
        <Route path="courses/:id/quiz/edit" element={<EditQuiz />} />
        <Route path="courses/:id/quiz" element={<TakeQuiz />} />
        <Route path="courses/:id/quiz-results" element={<QuizResults />} />
        <Route path="lessons/:id" element={<LessonView />} />
        <Route path="lessons/:id/edit" element={<EditLesson />} />
        <Route path="users" element={<UserManagement />} />
        <Route path="account-settings" element={<AccountSettings />} />
        <Route path="certificates" element={<Certificates />} />
      </Route>
      
      {/* Catch all */}
      <Route path="*" element={user ? <Navigate to="/dashboard" replace /> : <Navigate to="/login" replace />} />
    </Routes>
  )
}

export default App
