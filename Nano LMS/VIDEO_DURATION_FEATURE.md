# Video Duration Feature

## Overview

The Nano LMS now automatically calculates course and lesson durations based on video content, while requiring manual input for document/content-based lessons.

## How It Works

### Automatic Duration Calculation

1. **YouTube Videos**: Duration is extracted using the YouTube Data API
2. **Video Files**: Duration is extracted using ffprobe (FFmpeg)
3. **External Platforms**: For Animaker, Show.io, etc., duration extraction is not supported. These platforms require manual duration input from users.

### Manual Duration Input

- **Document-only lessons**: Require manual duration input
- **Content-only lessons**: Require manual duration input
- **Mixed lessons**: Video duration is auto-calculated, but manual input is required for document/substantial content portion
- **Video-only lessons**: Duration is automatically calculated from video
- **Video + minimal content** (≤50 characters): Duration is automatically calculated from video
- **External platform videos** (Show.io, Animaker, etc.): Require manual duration input

## Backend Implementation

### Video Duration Utility (`backend/src/utils/videoDuration.js`)

- `getVideoDuration(url, type)`: Main function to extract duration
- `getYouTubeDuration(url)`: Extract duration from YouTube URLs
- `getVideoFileDuration(filePath)`: Extract duration from video files
- URL validation functions for different video platforms

### Lesson Creation/Update (`backend/src/routes/lessons.js`)

- Automatically calculates duration when video URL is provided
- Validates that manual duration is provided for document/content lessons
- Updates course duration after lesson changes

## Frontend Implementation

### Add/Edit Lesson Forms

- Duration field is conditionally required based on lesson type
- Visual indicators show when duration will be auto-calculated
- Validation prevents submission without required duration

### Video URL Input Component

- Shows duration extraction status for different video types
- Provides feedback about auto-calculation capabilities

## Configuration

### YouTube API Key

To enable YouTube duration extraction, set the environment variable:

```bash
YOUTUBE_API_KEY=your_youtube_api_key_here
```

### FFmpeg/FFprobe

For video file duration extraction, ensure FFmpeg is installed on the server.

## Usage Examples

### Video Lesson (Auto-calculated)
```
Video URL: https://www.youtube.com/watch?v=example
Duration: Automatically calculated from video (9 minutes 36 seconds)
```

### Video + Minimal Content (Auto-calculated)
```
Video URL: https://www.youtube.com/watch?v=example
Content: "test"
Duration: Automatically calculated from video (content ≤50 characters ignored)
```

### Document Lesson (Manual required)
```
Content: "Read this document and complete the quiz"
Duration: User must input (e.g., 45 minutes)
```

### Mixed Content (Auto + Manual)
```
Video URL: https://youtube.com/watch?v=example
Content: "Watch the video and read the additional materials. This content is substantial and requires manual duration input."
Duration: Video auto-calculated + User input for content (e.g., 30 + 20 = 50 minutes)
```

### External Platform Video (Manual required)
```
Video URL: https://app.getshow.io/iframe/media/example
Duration: User must input (e.g., 20 minutes)
```

## Error Handling

- Graceful fallback to manual duration if extraction fails
- Clear error messages for missing required duration
- Logging for debugging duration extraction issues

## Course Duration Calculation

Course duration is automatically updated as the sum of:
- All lesson durations
- Quiz duration (10 minutes per quiz)

This ensures accurate course completion time estimates for learners.
