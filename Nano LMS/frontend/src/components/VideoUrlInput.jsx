import { useState, useEffect } from 'react'
import { 
  PlayIcon, 
  ExclamationTriangleIcon,
  CheckCircleIcon,
  LinkIcon
} from '@heroicons/react/24/outline'

export default function VideoUrlInput({ 
  value = '', 
  onChange, 
  placeholder = "Enter video URL...",
  className = "",
  showPreview = true 
}) {
  const [videoType, setVideoType] = useState(null)
  const [isValid, setIsValid] = useState(false)
  const [error, setError] = useState('')

  useEffect(() => {
    if (!value) {
      setVideoType(null)
      setIsValid(false)
      setError('')
      return
    }

    validateVideoUrl(value)
  }, [value])

  const validateVideoUrl = (url) => {
    try {
      // Check if it's a valid URL
      new URL(url)
      
      if (isYouTubeUrl(url)) {
        setVideoType('youtube')
        setIsValid(true)
        setError('')
      } else if (isAnimakerUrl(url)) {
        setVideoType('animaker')
        setIsValid(true)
        setError('')
      } else if (isShowIoUrl(url)) {
        setVideoType('showio')
        setIsValid(true)
        setError('')
      } else if (isVideoFile(url)) {
        setVideoType('file')
        setIsValid(true)
        setError('')
      } else {
        setVideoType('unknown')
        setIsValid(false)
        setError('Please enter a valid YouTube, Animaker, Show.io, or video file URL')
      }
    } catch (e) {
      setVideoType('invalid')
      setIsValid(false)
      setError('Please enter a valid URL')
    }
  }

  const isYouTubeUrl = (url) => {
    const youtubePatterns = [
      /youtube\.com\/watch\?v=/,
      /youtu\.be\//,
      /youtube\.com\/embed\//,
      /youtube\.com\/v\//
    ]
    return youtubePatterns.some(pattern => pattern.test(url))
  }

  const isAnimakerUrl = (url) => {
    const animakerPatterns = [
      /animaker\.com/,
      /animo\.app/,
      /animaker\.com\/embed/,
      /animo\.app\/embed/
    ]
    return animakerPatterns.some(pattern => pattern.test(url))
  }

  const isShowIoUrl = (url) => {
    const showIoPatterns = [
      /app\.getshow\.io/,
      /getshow\.io/,
      /show\.io/
    ]
    return showIoPatterns.some(pattern => pattern.test(url))
  }

  const isVideoFile = (url) => {
    const videoExtensions = ['.mp4', '.webm', '.ogg', '.mov', '.avi']
    return videoExtensions.some(ext => url.toLowerCase().includes(ext))
  }

  const getVideoTypeLabel = () => {
    switch (videoType) {
      case 'youtube':
        return 'YouTube Video'
      case 'animaker':
        return 'Animaker Video'
      case 'showio':
        return 'Show.io Video'
      case 'file':
        return 'Video File'
      default:
        return 'Unknown'
    }
  }

  const getVideoTypeColor = () => {
    switch (videoType) {
      case 'youtube':
        return 'text-red-600'
      case 'animaker':
        return 'text-blue-600'
      case 'showio':
        return 'text-purple-600'
      case 'file':
        return 'text-green-600'
      default:
        return 'text-gray-600'
    }
  }

  const getVideoTypeIcon = () => {
    switch (videoType) {
      case 'youtube':
        return (
          <svg className="w-5 h-5 text-red-600" viewBox="0 0 24 24" fill="currentColor">
            <path d="M23.498 6.186a3.016 3.016 0 0 0-2.122-2.136C19.505 3.545 12 3.545 12 3.545s-7.505 0-9.377.505A3.017 3.017 0 0 0 .502 6.186C0 8.07 0 12 0 12s0 3.93.502 5.814a3.016 3.016 0 0 0 2.122 2.136c1.871.505 9.376.505 9.376.505s7.505 0 9.377-.505a3.015 3.015 0 0 0 2.122-2.136C24 15.93 24 12 24 12s0-3.93-.502-5.814zM9.545 15.568V8.432L15.818 12l-6.273 3.568z"/>
          </svg>
        )
      case 'animaker':
        return (
          <svg className="w-5 h-5 text-blue-600" fill="currentColor" viewBox="0 0 24 24">
            <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm-2 15l-5-5 1.41-1.41L10 14.17l7.59-7.59L19 8l-9 9z"/>
          </svg>
        )
      case 'showio':
        return (
          <svg className="w-5 h-5 text-purple-600" fill="currentColor" viewBox="0 0 24 24">
            <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm-2 15l-5-5 1.41-1.41L10 14.17l7.59-7.59L19 8l-9 9z"/>
          </svg>
        )
      case 'file':
        return <PlayIcon className="w-5 h-5 text-green-600" />
      default:
        return <LinkIcon className="w-5 h-5 text-gray-600" />
    }
  }

  return (
    <div className={`space-y-2 ${className}`}>
      <div className="relative">
        <input
          type="url"
          value={value}
          onChange={(e) => onChange(e.target.value)}
          placeholder={placeholder}
          className={`input w-full pr-10 ${error ? 'border-red-500' : isValid ? 'border-green-500' : ''}`}
        />
        <div className="absolute inset-y-0 right-0 flex items-center pr-3">
          {isValid ? (
            <CheckCircleIcon className="h-5 w-5 text-green-500" />
          ) : error ? (
            <ExclamationTriangleIcon className="h-5 w-5 text-red-500" />
          ) : (
            <LinkIcon className="h-5 w-5 text-gray-400" />
          )}
        </div>
      </div>

      {error && (
        <p className="text-sm text-red-600 flex items-center">
          <ExclamationTriangleIcon className="h-4 w-4 mr-1" />
          {error}
        </p>
      )}

      {isValid && showPreview && (
        <div className="flex items-center space-x-2 p-2 bg-gray-50 rounded-md">
          {getVideoTypeIcon()}
          <span className={`text-sm font-medium ${getVideoTypeColor()}`}>
            {getVideoTypeLabel()}
          </span>
          {videoType === 'youtube' && (
            <span className="text-xs text-gray-500">
              Duration will be auto-calculated
            </span>
          )}
          {videoType === 'animaker' && (
            <span className="text-xs text-gray-500">
              Duration will be auto-calculated
            </span>
          )}
          {videoType === 'showio' && (
            <span className="text-xs text-gray-500">
              Duration will be auto-calculated
            </span>
          )}
          {videoType === 'file' && (
            <span className="text-xs text-gray-500">
              Duration will be auto-calculated
            </span>
          )}
        </div>
      )}

      {!value && (
        <div className="text-xs text-gray-500 space-y-1">
          <p>Supported formats:</p>
          <ul className="list-disc list-inside space-y-1 ml-2">
            <li>YouTube URLs (youtube.com, youtu.be)</li>
            <li>Animaker URLs (animaker.com, animo.app)</li>
            <li>Show.io URLs (app.getshow.io, getshow.io)</li>
            <li>Video files (.mp4, .webm, .ogg, .mov, .avi)</li>
          </ul>
        </div>
      )}
    </div>
  )
}
