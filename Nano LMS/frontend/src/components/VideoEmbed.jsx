import { useState, useEffect } from 'react'

export default function VideoEmbed({ videoUrl, onProgress, onPlay, onPause, className = "" }) {
  const [videoType, setVideoType] = useState(null)
  const [embedUrl, setEmbedUrl] = useState('')
  const [error, setError] = useState(false)

  useEffect(() => {
    if (!videoUrl) {
      setVideoType(null)
      setEmbedUrl('')
      return
    }

    console.log('VideoEmbed - Processing video URL:', videoUrl)

    // Determine video type and create embed URL
    if (isYouTubeUrl(videoUrl)) {
      console.log('VideoEmbed - Detected YouTube URL')
      setVideoType('youtube')
      setEmbedUrl(createYouTubeEmbedUrl(videoUrl))
    } else if (isAnimakerUrl(videoUrl)) {
      console.log('VideoEmbed - Detected Animaker URL')
      setVideoType('animaker')
      setEmbedUrl(createAnimakerEmbedUrl(videoUrl))
    } else if (isShowIoUrl(videoUrl)) {
      console.log('VideoEmbed - Detected Show.io URL')
      setVideoType('showio')
      setEmbedUrl(createShowIoEmbedUrl(videoUrl))
    } else {
      console.log('VideoEmbed - Detected file URL')
      setVideoType('file')
      setEmbedUrl(videoUrl)
    }
    setError(false)
  }, [videoUrl])

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
    const isShowIo = showIoPatterns.some(pattern => pattern.test(url))
    console.log('VideoEmbed - Show.io URL check:', url, 'Result:', isShowIo)
    return isShowIo
  }

  const createYouTubeEmbedUrl = (url) => {
    let videoId = ''
    
    if (url.includes('youtube.com/watch')) {
      const urlParams = new URLSearchParams(url.split('?')[1])
      videoId = urlParams.get('v')
    } else if (url.includes('youtu.be/')) {
      videoId = url.split('youtu.be/')[1]
    }
    
    if (videoId) {
      return `https://www.youtube.com/embed/${videoId}?rel=0&modestbranding=1`
    }
    
    setError(true)
    return ''
  }

  const createAnimakerEmbedUrl = (url) => {
    // For Animaker, we'll use the original URL as it should already be embeddable
    // If it's not in embed format, we'll try to convert it
    if (url.includes('/embed/')) {
      return url
    }
    
    // Try to convert to embed format if possible
    const embedUrl = url.replace('/watch/', '/embed/')
    return embedUrl
  }

  const createShowIoEmbedUrl = (url) => {
    // Show.io URLs are already in iframe format, so we can use them directly
    // The URL you provided: https://app.getshow.io/iframe/media/AlVN3X0BvU3iKUXXP6i9
    // is already an iframe embed URL
    return url
  }

  const handleIframeLoad = () => {
    // For embedded videos, we can't track progress easily
    // So we'll just mark as started when loaded
    console.log('Iframe loaded successfully')
    if (onPlay) onPlay()
  }

  const handleIframeError = () => {
    console.error('Iframe failed to load')
    setError(true)
  }

  if (!videoUrl) {
    return (
      <div className={`flex items-center justify-center bg-gray-100 ${className}`}>
        <p className="text-gray-500">No video available</p>
      </div>
    )
  }

  if (error) {
    return (
      <div className={`flex flex-col items-center justify-center bg-gray-100 ${className}`}>
        <svg className="h-12 w-12 text-red-400 mb-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-1.964-.833-2.732 0L3.732 16.5c-.77.833.192 2.5 1.732 2.5z" />
        </svg>
        <h3 className="text-lg font-medium mb-2">Video Not Available</h3>
        <p className="text-sm text-gray-500 text-center px-4">
          Unable to load this video. Please check the URL and try again.
        </p>
      </div>
    )
  }

  if (videoType === 'youtube' || videoType === 'animaker' || videoType === 'showio') {
    return (
      <div className={`relative ${className}`}>
        <iframe
          src={embedUrl}
          className="w-full h-full"
          frameBorder="0"
          allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
          allowFullScreen
          onLoad={handleIframeLoad}
          onError={handleIframeError}
        />
      </div>
    )
  }

  // For regular video files, return null so parent can handle with video element
  return null
}
