import { createContext, useContext, useState, useEffect } from 'react'
import { api } from '../services/api'
import toast from 'react-hot-toast'

const AuthContext = createContext()

function useAuth() {
  const context = useContext(AuthContext)
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider')
  }
  return context
}

function AuthProvider({ children }) {
  const [user, setUser] = useState(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    checkAuth()
  }, [])

  const checkAuth = async () => {
    try {
      const token = localStorage.getItem('token')
      if (token) {
        const response = await api.get('/auth/me')
        setUser(response.data.user)
      }
    } catch (error) {
      console.error('Auth check failed:', error)
      localStorage.removeItem('token')
    } finally {
      setLoading(false)
    }
  }

  const login = async (email, password) => {
    try {
      const response = await api.post('/auth/login', { email, password })
      const { token, user } = response.data
      
      localStorage.setItem('token', token)
      setUser(user)
      
      toast.success('Login successful!')
      return { success: true }
    } catch (error) {
      const message = error.response?.data?.message || 'Login failed'
      toast.error(message)
      return { success: false, error: message }
    }
  }

  const register = async (userData) => {
    try {
      const response = await api.post('/auth/register', userData)
      const { message, user } = response.data
      
      // Don't set token or user since approval is pending
      toast.success(message)
      return { success: true, message }
    } catch (error) {
      // Handle validation errors with more detail
      if (error.response?.data?.details) {
        const validationErrors = error.response.data.details
        validationErrors.forEach(err => {
          toast.error(`${err.path}: ${err.msg}`)
        })
        return { success: false, error: 'Validation failed' }
      }
      
      const message = error.response?.data?.message || 'Registration failed'
      toast.error(message)
      return { success: false, error: message }
    }
  }

  const logout = async () => {
    try {
      await api.post('/auth/logout')
    } catch (error) {
      console.error('Logout error:', error)
    } finally {
      localStorage.removeItem('token')
      setUser(null)
      toast.success('Logged out successfully')
    }
  }

  const updateProfile = async (userData) => {
    try {
      const response = await api.put(`/users/${user.id}`, userData)
      setUser(response.data.user)
      toast.success('Profile updated successfully!')
      return { success: true }
    } catch (error) {
      const message = error.response?.data?.message || 'Profile update failed'
      toast.error(message)
      return { success: false, error: message }
    }
  }

  const value = {
    user,
    loading,
    login,
    register,
    logout,
    updateProfile,
    isAdmin: user?.role === 'admin',
    isTrainer: user?.role === 'trainer' || user?.role === 'admin',
    isLearner: user?.role === 'learner' || user?.role === 'trainer' || user?.role === 'admin'
  }

  return (
    <AuthContext.Provider value={value}>
      {children}
    </AuthContext.Provider>
  )
}

export { useAuth, AuthProvider }
