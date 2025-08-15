const axios = require('axios');
const { exec } = require('child_process');
const { promisify } = require('util');
const fs = require('fs');
const path = require('path');

const execAsync = promisify(exec);

// YouTube API key - you'll need to set this in your environment variables
const YOUTUBE_API_KEY = process.env.YOUTUBE_API_KEY;

/**
 * Extract video duration from YouTube URL
 * @param {string} url - YouTube URL
 * @returns {Promise<number>} - Duration in minutes
 */
async function getYouTubeDuration(url) {
  try {
    if (!YOUTUBE_API_KEY) {
      console.warn('YouTube API key not configured. Cannot extract duration from YouTube videos.');
      return null;
    }

    // Extract video ID from various YouTube URL formats
    const videoId = extractYouTubeVideoId(url);
    if (!videoId) {
      throw new Error('Invalid YouTube URL');
    }

    const response = await axios.get(
      `https://www.googleapis.com/youtube/v3/videos?id=${videoId}&part=contentDetails&key=${YOUTUBE_API_KEY}`
    );

    if (response.data.items && response.data.items.length > 0) {
      const duration = response.data.items[0].contentDetails.duration;
      return parseYouTubeDuration(duration);
    }

    throw new Error('Video not found or not accessible');
  } catch (error) {
    console.error('Error getting YouTube duration:', error.message);
    return null;
  }
}

/**
 * Extract video ID from YouTube URL
 * @param {string} url - YouTube URL
 * @returns {string|null} - Video ID or null
 */
function extractYouTubeVideoId(url) {
  const patterns = [
    /(?:youtube\.com\/watch\?v=|youtu\.be\/|youtube\.com\/embed\/|youtube\.com\/v\/)([^&\n?#]+)/,
    /youtube\.com\/watch\?.*v=([^&\n?#]+)/
  ];

  for (const pattern of patterns) {
    const match = url.match(pattern);
    if (match) {
      return match[1];
    }
  }

  return null;
}

/**
 * Parse YouTube duration format (PT1H2M3S) to minutes
 * @param {string} duration - YouTube duration string
 * @returns {number} - Duration in minutes
 */
function parseYouTubeDuration(duration) {
  const match = duration.match(/PT(?:(\d+)H)?(?:(\d+)M)?(?:(\d+)S)?/);
  if (!match) return 0;

  const hours = parseInt(match[1] || 0);
  const minutes = parseInt(match[2] || 0);
  const seconds = parseInt(match[3] || 0);

  return hours * 60 + minutes + Math.ceil(seconds / 60);
}

/**
 * Get video duration from uploaded video file using ffprobe
 * @param {string} filePath - Path to video file
 * @returns {Promise<number>} - Duration in minutes
 */
async function getVideoFileDuration(filePath) {
  try {
    // Check if ffprobe is available
    try {
      await execAsync('ffprobe -version');
    } catch (error) {
      console.warn('ffprobe not available. Cannot extract duration from video files.');
      return null;
    }

    const { stdout } = await execAsync(
      `ffprobe -v quiet -show_entries format=duration -of csv=p=0 "${filePath}"`
    );

    const durationInSeconds = parseFloat(stdout.trim());
    if (isNaN(durationInSeconds)) {
      throw new Error('Invalid duration output');
    }

    return Math.ceil(durationInSeconds / 60); // Convert to minutes
  } catch (error) {
    console.error('Error getting video file duration:', error.message);
    return null;
  }
}

/**
 * Get video duration from video file URL (for uploaded files)
 * @param {string} videoUrl - Video file URL
 * @returns {Promise<number>} - Duration in minutes
 */
async function getVideoFileDurationFromUrl(videoUrl) {
  try {
    // Extract file path from URL (assuming local file storage)
    const urlPath = new URL(videoUrl).pathname;
    const filePath = path.join(process.cwd(), 'uploads', urlPath.replace('/uploads/', ''));
    
    if (fs.existsSync(filePath)) {
      return await getVideoFileDuration(filePath);
    }
    
    return null;
  } catch (error) {
    console.error('Error getting video duration from URL:', error.message);
    return null;
  }
}

/**
 * Main function to get video duration from any video source
 * @param {string} videoUrl - Video URL or file path
 * @param {string} videoType - Type of video (youtube, file, animaker, showio, etc.)
 * @returns {Promise<number|null>} - Duration in minutes or null if not available
 */
async function getVideoDuration(videoUrl, videoType = null) {
  if (!videoUrl) return null;

  try {
    // Auto-detect video type if not provided
    if (!videoType) {
      if (isYouTubeUrl(videoUrl)) {
        videoType = 'youtube';
      } else if (isVideoFile(videoUrl)) {
        videoType = 'file';
      } else if (isAnimakerUrl(videoUrl) || isShowIoUrl(videoUrl)) {
        videoType = 'external';
      }
    }

    switch (videoType) {
      case 'youtube':
        return await getYouTubeDuration(videoUrl);
      
      case 'file':
        return await getVideoFileDurationFromUrl(videoUrl);
      
      case 'external':
        // For external platforms like Animaker, Show.io, etc.
        // We can't easily extract duration, so return null
        console.log('Duration extraction not supported for external video platforms');
        return null;
      
      default:
        // Try to detect and extract
        if (isYouTubeUrl(videoUrl)) {
          return await getYouTubeDuration(videoUrl);
        } else if (isVideoFile(videoUrl)) {
          return await getVideoFileDurationFromUrl(videoUrl);
        }
        return null;
    }
  } catch (error) {
    console.error('Error getting video duration:', error.message);
    return null;
  }
}

/**
 * Check if URL is a YouTube URL
 * @param {string} url - URL to check
 * @returns {boolean}
 */
function isYouTubeUrl(url) {
  const youtubePatterns = [
    /youtube\.com\/watch\?v=/,
    /youtu\.be\//,
    /youtube\.com\/embed\//,
    /youtube\.com\/v\//
  ];
  return youtubePatterns.some(pattern => pattern.test(url));
}

/**
 * Check if URL is a video file
 * @param {string} url - URL to check
 * @returns {boolean}
 */
function isVideoFile(url) {
  const videoExtensions = ['.mp4', '.webm', '.ogg', '.mov', '.avi', '.mkv'];
  return videoExtensions.some(ext => url.toLowerCase().includes(ext));
}

/**
 * Check if URL is an Animaker URL
 * @param {string} url - URL to check
 * @returns {boolean}
 */
function isAnimakerUrl(url) {
  const animakerPatterns = [
    /animaker\.com/,
    /animo\.app/,
    /animaker\.com\/embed/,
    /animo\.app\/embed/
  ];
  return animakerPatterns.some(pattern => pattern.test(url));
}

/**
 * Check if URL is a Show.io URL
 * @param {string} url - URL to check
 * @returns {boolean}
 */
function isShowIoUrl(url) {
  const showIoPatterns = [
    /app\.getshow\.io/,
    /getshow\.io/,
    /show\.io/
  ];
  return showIoPatterns.some(pattern => pattern.test(url));
}

module.exports = {
  getVideoDuration,
  getYouTubeDuration,
  getVideoFileDuration,
  getVideoFileDurationFromUrl,
  isYouTubeUrl,
  isVideoFile,
  isAnimakerUrl,
  isShowIoUrl,
  extractYouTubeVideoId,
  parseYouTubeDuration
};
