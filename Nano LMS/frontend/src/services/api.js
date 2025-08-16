import axios from 'axios'

const api = axios.create({
  baseURL: process.env.NODE_ENV === 'production' 
    ? 'https://zbuhxdonhlibopcgzmig.supabase.co/functions/v1/api'
    : 'http://localhost:6001/api',
  headers: {
    'Content-Type': 'application/json',
    'apikey': 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InpidWh4ZG9uaGxpYm9wY2d6bWlnIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTUyNzg2NjYsImV4cCI6MjA3MDg1NDY2Nn0.oAda1T4sY-DX97UEyYHYx3YQF-N4eQb9IWVi3i1THg4',
  },
})

// Request interceptor to add auth token
api.interceptors.request.use(
  (config) => {
    const token = localStorage.getItem('token')
    if (token) {
      config.headers.Authorization = `Bearer ${token}`
    }
    return config
  },
  (error) => {
    return Promise.reject(error)
  }
)

// Response interceptor to handle auth errors
api.interceptors.response.use(
  (response) => response,
  (error) => {
    // Only redirect to login for specific 401 errors that indicate authentication issues
    if (error.response?.status === 401) {
      const errorMessage = error.response?.data?.error || ''
      
      // Only redirect for authentication-related errors, not permission errors
      if (errorMessage.includes('Invalid token') || 
          errorMessage.includes('Token expired') ||
          errorMessage.includes('authentication') || 
          errorMessage.includes('session')) {
        localStorage.removeItem('token')
        // Only redirect if we're not already on the login page
        if (window.location.pathname !== '/login') {
          window.location.href = '/login'
        }
      }
    }
    return Promise.reject(error)
  }
)

export { api }
