const express = require('express');
const { body, validationResult } = require('express-validator');
const { query } = require('../database/connection');
const { requireTrainer, authenticateToken } = require('../middleware/auth');
const { getVideoDuration, isYouTubeUrl, isVideoFile, isAnimakerUrl, isShowIoUrl } = require('../utils/videoDuration');

// YouTube API key for duration extraction
const YOUTUBE_API_KEY = process.env.YOUTUBE_API_KEY;

const router = express.Router();

// Function to update course duration based on lessons and quiz
const updateCourseDuration = async (courseId) => {
  try {
    // Get total duration from lessons
    const lessonsResult = await query(
      'SELECT COALESCE(SUM(duration_minutes), 0) as total_duration FROM lessons WHERE course_id = $1',
      [courseId]
    );
    
    const totalLessonDuration = parseInt(lessonsResult.rows[0].total_duration) || 0;
    
    // Add quiz duration (10 minutes per quiz)
    const quizDuration = 10;
    
    const totalDuration = totalLessonDuration + quizDuration;
    
    // Update course duration
    await query(
      'UPDATE courses SET duration_minutes = $1 WHERE id = $2',
      [totalDuration, courseId]
    );
  } catch (error) {
    console.error('Error updating course duration:', error);
  }
};

// Validation middleware for creating lessons
const validateCreateLesson = [
  body('courseId').isInt({ min: 1 }).withMessage('Course ID must be a positive integer'),
  body('title').trim().isLength({ min: 3, max: 255 }).withMessage('Title must be between 3 and 255 characters'),
  body('description').optional().trim().isLength({ max: 500 }).withMessage('Description must be less than 500 characters'),
  body('content').optional().trim(),
  body('videoUrl').optional().trim(),
  body('documentUrl').optional().trim(),
  body('durationMinutes').optional().isInt({ min: 0 }).withMessage('Duration must be a positive integer'),
  body('orderIndex').isInt({ min: 1 }).withMessage('Order index must be a positive integer'),
  body('isPublished').optional().isBoolean().withMessage('isPublished must be a boolean')
];

// Validation middleware for updating lessons
const validateUpdateLesson = [
  body('title').trim().isLength({ min: 3, max: 255 }).withMessage('Title must be between 3 and 255 characters'),
  body('description').optional().trim().isLength({ max: 500 }).withMessage('Description must be less than 500 characters'),
  body('content').optional().trim(),
  body('videoUrl').optional().trim(),
  body('documentUrl').optional().trim(),
  body('durationMinutes').optional().isInt({ min: 0 }).withMessage('Duration must be a positive integer'),
  body('orderIndex').isInt({ min: 1 }).withMessage('Order index must be a positive integer'),
  body('isPublished').optional().isBoolean().withMessage('isPublished must be a boolean')
];

// @route   GET /api/lessons/:id
// @desc    Get lesson by ID
// @access  Private
router.get('/:id', authenticateToken, async (req, res) => {
  try {
    const { id } = req.params;

    const lessonResult = await query(
      `SELECT l.id, l.title, l.description, l.content, l.video_url, l.document_url,
              l.duration_minutes, l.order_index, l.is_published, l.created_at,
              c.title as course_title, c.id as course_id, c.instructor_id
       FROM lessons l
       JOIN courses c ON l.course_id = c.id
       WHERE l.id = $1`,
      [id]
    );

    if (lessonResult.rows.length === 0) {
      return res.status(404).json({
        error: 'Lesson not found',
        message: 'Lesson with this ID does not exist'
      });
    }

    res.json({
      lesson: lessonResult.rows[0]
    });

  } catch (error) {
    console.error('Get lesson error:', error);
    res.status(500).json({
      error: 'Failed to fetch lesson',
      message: 'An error occurred while fetching the lesson'
    });
  }
});

// @route   POST /api/lessons
// @desc    Create a new lesson (Admin can create for any course, Trainer can create for their own courses)
// @access  Private/Admin/Trainer
router.post('/', authenticateToken, validateCreateLesson, async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({
        error: 'Validation failed',
        message: 'Please check your input',
        details: errors.array()
      });
    }

    const { courseId, title, description, content, videoUrl, documentUrl, durationMinutes, orderIndex, isPublished } = req.body;

    // Verify course exists and user is instructor
    const courseResult = await query(
      'SELECT instructor_id FROM courses WHERE id = $1',
      [courseId]
    );

    if (courseResult.rows.length === 0) {
      return res.status(404).json({
        error: 'Course not found',
        message: 'Course with this ID does not exist'
      });
    }

    // Check permissions
    // Admin can create lessons for any course
    // Trainer can only create lessons for their own courses
    if (req.user.role === 'admin') {
      // Admin can create lessons for any course - no restrictions
    } else if (req.user.role === 'trainer') {
      if (courseResult.rows[0].instructor_id !== req.user.id) {
        return res.status(403).json({
          error: 'Access denied',
          message: 'You can only add lessons to courses you created'
        });
      }
    } else {
      return res.status(403).json({
        error: 'Access denied',
        message: 'You do not have permission to create lessons'
      });
    }

    // Calculate duration automatically based on video content
    let finalDurationMinutes = durationMinutes || 0;
    let videoDuration = 0;
    
    if (videoUrl) {
      try {
        // Try to extract duration from video
        const extractedVideoDuration = await getVideoDuration(videoUrl);
        if (extractedVideoDuration !== null) {
          videoDuration = extractedVideoDuration;
          console.log(`Auto-calculated video duration: ${videoDuration} minutes`);
        } else {
          // Check if it's an external platform that doesn't support duration extraction
          const isExternalPlatform = isAnimakerUrl(videoUrl) || isShowIoUrl(videoUrl);
          if (isExternalPlatform) {
            // For external platforms, require manual duration input
            videoDuration = null; // Indicate that manual input is required
            console.log(`External platform detected. Manual duration input required.`);
          } else {
            // For other cases (like YouTube without API key), use a default
            videoDuration = 30; // Default 30 minutes for video
            console.log(`Using default video duration: ${videoDuration} minutes`);
          }
        }
      } catch (error) {
        console.error('Error calculating video duration:', error);
        videoDuration = 30; // Default fallback
      }
    }
    
    const hasDocument = documentUrl && documentUrl.trim() !== '';
    const hasContent = content && content.trim() !== '';
    const hasSubstantialContent = hasContent && content.trim().length > 50;
    
    if (videoUrl && !hasDocument && !hasSubstantialContent) {
      // Video-only lesson (or video + minimal content) - use auto-calculated video duration
      // Check if it's an external platform that requires manual duration
      const isExternalPlatform = isAnimakerUrl(videoUrl) || isShowIoUrl(videoUrl);
      if (isExternalPlatform && videoDuration === null) {
        // External platform detected, require manual duration input
        if (!durationMinutes || durationMinutes <= 0) {
          return res.status(400).json({
            error: 'Duration required',
            message: 'Please provide duration for external video platforms (Show.io, Animaker, etc.)'
          });
        }
        finalDurationMinutes = durationMinutes;
        console.log(`External platform. Using manual duration: ${finalDurationMinutes} minutes`);
      } else if (!YOUTUBE_API_KEY && videoUrl.includes('youtube.com')) {
        // YouTube API not available, use manual duration if provided, otherwise use default
        finalDurationMinutes = durationMinutes > 0 ? durationMinutes : videoDuration;
        console.log(`YouTube API not available. Using ${finalDurationMinutes} minutes (${durationMinutes > 0 ? 'manual' : 'default'})`);
      } else {
        finalDurationMinutes = videoDuration;
      }
    } else if (videoUrl && hasDocument) {
      // Mixed lesson (video + document) - combine video duration with manual input
      if (!durationMinutes || durationMinutes <= 0) {
        return res.status(400).json({
          error: 'Duration required',
          message: 'Please provide duration for the document portion of this lesson'
        });
      }
      finalDurationMinutes = videoDuration + durationMinutes;
      console.log(`Combined duration: ${videoDuration} (video) + ${durationMinutes} (manual) = ${finalDurationMinutes} minutes`);
    } else if (videoUrl && hasSubstantialContent) {
      // Mixed lesson (video + substantial content) - combine video duration with manual input
      if (!durationMinutes || durationMinutes <= 0) {
        return res.status(400).json({
          error: 'Duration required',
          message: 'Please provide duration for the content portion of this lesson'
        });
      }
      finalDurationMinutes = videoDuration + durationMinutes;
      console.log(`Combined duration: ${videoDuration} (video) + ${durationMinutes} (manual) = ${finalDurationMinutes} minutes`);
    } else if (hasDocument || hasContent) {
      // Document/content-only lesson - require manual duration
      if (!durationMinutes || durationMinutes <= 0) {
        return res.status(400).json({
          error: 'Duration required',
          message: 'Please provide duration for document/content-based lessons'
        });
      }
      finalDurationMinutes = durationMinutes;
    } else {
      // No content at all - require manual duration
      if (!durationMinutes || durationMinutes <= 0) {
        return res.status(400).json({
          error: 'Duration required',
          message: 'Please provide duration for this lesson'
        });
      }
      finalDurationMinutes = durationMinutes;
    }

    const newLessonResult = await query(
      `INSERT INTO lessons (course_id, title, description, content, video_url, document_url, duration_minutes, order_index, is_published)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
       RETURNING id, title, description, content, video_url, document_url, duration_minutes, order_index, is_published, created_at`,
      [courseId, title, description, content, videoUrl, documentUrl, finalDurationMinutes, orderIndex, isPublished !== undefined ? isPublished : true]
    );

    const newLesson = newLessonResult.rows[0];

    // Update course duration after adding lesson
    await updateCourseDuration(courseId);

    res.status(201).json({
      message: 'Lesson created successfully',
      lesson: newLesson
    });

  } catch (error) {
    console.error('Create lesson error:', error);
    res.status(500).json({
      error: 'Failed to create lesson',
      message: 'An error occurred while creating the lesson'
    });
  }
});

// @route   PUT /api/lessons/:id
// @desc    Update lesson (Admin can edit any lesson, Trainer can edit lessons in their own courses)
// @access  Private/Admin/Trainer
router.put('/:id', authenticateToken, validateUpdateLesson, async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({
        error: 'Validation failed',
        message: 'Please check your input',
        details: errors.array()
      });
    }

    const { id } = req.params;
    const { title, description, content, videoUrl, durationMinutes, orderIndex, isPublished } = req.body;

    // Check if user is the instructor or admin
    const lessonResult = await query(
      `SELECT l.id, l.course_id, c.instructor_id 
       FROM lessons l
       JOIN courses c ON l.course_id = c.id
       WHERE l.id = $1`,
      [id]
    );

    if (lessonResult.rows.length === 0) {
      return res.status(404).json({
        error: 'Lesson not found',
        message: 'Lesson with this ID does not exist'
      });
    }

    // Check permissions
    // Admin can edit any lesson
    // Trainer can only edit lessons in their own courses
    if (req.user.role === 'admin') {
      // Admin can edit any lesson - no restrictions
    } else if (req.user.role === 'trainer') {
      if (lessonResult.rows[0].instructor_id !== req.user.id) {
        return res.status(403).json({
          error: 'Access denied',
          message: 'You can only update lessons in courses you created'
        });
      }
    } else {
      return res.status(403).json({
        error: 'Access denied',
        message: 'You do not have permission to edit lessons'
      });
    }

    // Calculate duration automatically based on video content
    let finalDurationMinutes = durationMinutes || 0;
    let videoDuration = 0;
    
    if (videoUrl) {
      try {
        // Try to extract duration from video
        const extractedVideoDuration = await getVideoDuration(videoUrl);
        if (extractedVideoDuration !== null) {
          videoDuration = extractedVideoDuration;
          console.log(`Auto-calculated video duration: ${videoDuration} minutes`);
        } else {
          // Check if it's an external platform that doesn't support duration extraction
          const isExternalPlatform = isAnimakerUrl(videoUrl) || isShowIoUrl(videoUrl);
          if (isExternalPlatform) {
            // For external platforms, require manual duration input
            videoDuration = null; // Indicate that manual input is required
            console.log(`External platform detected. Manual duration input required.`);
          } else {
            // For other cases (like YouTube without API key), use a default
            videoDuration = 30; // Default 30 minutes for video
            console.log(`Using default video duration: ${videoDuration} minutes`);
          }
        }
      } catch (error) {
        console.error('Error calculating video duration:', error);
        videoDuration = 30; // Default fallback
      }
    }
    
    const hasContent = content && content.trim() !== '';
    const hasSubstantialContent = hasContent && content.trim().length > 50;
    
    if (videoUrl && !hasSubstantialContent) {
      // Video-only lesson (or video + minimal content) - use auto-calculated video duration
      // Check if it's an external platform that requires manual duration
      const isExternalPlatform = isAnimakerUrl(videoUrl) || isShowIoUrl(videoUrl);
      if (isExternalPlatform && videoDuration === null) {
        // External platform detected, require manual duration input
        if (!durationMinutes || durationMinutes <= 0) {
          return res.status(400).json({
            error: 'Duration required',
            message: 'Please provide duration for external video platforms (Show.io, Animaker, etc.)'
          });
        }
        finalDurationMinutes = durationMinutes;
        console.log(`External platform. Using manual duration: ${finalDurationMinutes} minutes`);
      } else if (!YOUTUBE_API_KEY && videoUrl.includes('youtube.com')) {
        // YouTube API not available, use manual duration if provided, otherwise use default
        finalDurationMinutes = durationMinutes > 0 ? durationMinutes : videoDuration;
        console.log(`YouTube API not available. Using ${finalDurationMinutes} minutes (${durationMinutes > 0 ? 'manual' : 'default'})`);
      } else {
        finalDurationMinutes = videoDuration;
      }
    } else if (videoUrl && hasSubstantialContent) {
      // Mixed lesson (video + substantial content) - combine video duration with manual input
      if (!durationMinutes || durationMinutes <= 0) {
        return res.status(400).json({
          error: 'Duration required',
          message: 'Please provide duration for the content portion of this lesson'
        });
      }
      finalDurationMinutes = videoDuration + durationMinutes;
      console.log(`Combined duration: ${videoDuration} (video) + ${durationMinutes} (manual) = ${finalDurationMinutes} minutes`);
    } else if (hasContent) {
      // Content-only lesson - require manual duration
      if (!durationMinutes || durationMinutes <= 0) {
        return res.status(400).json({
          error: 'Duration required',
          message: 'Please provide duration for content-based lessons'
        });
      }
      finalDurationMinutes = durationMinutes;
    } else {
      // No content at all - require manual duration
      if (!durationMinutes || durationMinutes <= 0) {
        return res.status(400).json({
          error: 'Duration required',
          message: 'Please provide duration for this lesson'
        });
      }
      finalDurationMinutes = durationMinutes;
    }

    const updateResult = await query(
      `UPDATE lessons 
       SET title = $1, description = $2, content = $3, video_url = $4, 
           duration_minutes = $5, order_index = $6, is_published = $7, updated_at = CURRENT_TIMESTAMP
       WHERE id = $8
       RETURNING id, title, description, content, video_url, duration_minutes, order_index, is_published, updated_at`,
      [title, description, content, videoUrl, finalDurationMinutes, orderIndex, isPublished, id]
    );

    // Update course duration after lesson update
    await updateCourseDuration(lessonResult.rows[0].course_id);

    res.json({
      message: 'Lesson updated successfully',
      lesson: updateResult.rows[0]
    });

  } catch (error) {
    console.error('Update lesson error:', error);
    res.status(500).json({
      error: 'Failed to update lesson',
      message: 'An error occurred while updating the lesson'
    });
  }
});

// @route   DELETE /api/lessons/:id
// @desc    Delete lesson (Admin can delete any lesson, Trainer can delete lessons in their own courses)
// @access  Private/Admin/Trainer
router.delete('/:id', authenticateToken, async (req, res) => {
  try {
    const { id } = req.params;

    // Check if user is the instructor or admin
    const lessonResult = await query(
      `SELECT l.id, l.course_id, c.instructor_id 
       FROM lessons l
       JOIN courses c ON l.course_id = c.id
       WHERE l.id = $1`,
      [id]
    );

    if (lessonResult.rows.length === 0) {
      return res.status(404).json({
        error: 'Lesson not found',
        message: 'Lesson with this ID does not exist'
      });
    }

    // Check permissions
    // Admin can delete any lesson
    // Trainer can only delete lessons in their own courses
    if (req.user.role === 'admin') {
      // Admin can delete any lesson - no restrictions
    } else if (req.user.role === 'trainer') {
      if (lessonResult.rows[0].instructor_id !== req.user.id) {
        return res.status(403).json({
          error: 'Access denied',
          message: 'You can only delete lessons in courses you created'
        });
      }
    } else {
      return res.status(403).json({
        error: 'Access denied',
        message: 'You do not have permission to delete lessons'
      });
    }

    await query('DELETE FROM lessons WHERE id = $1', [id]);

    // Update course duration after lesson deletion
    await updateCourseDuration(lessonResult.rows[0].course_id);

    res.json({
      message: 'Lesson deleted successfully'
    });

  } catch (error) {
    console.error('Delete lesson error:', error);
    res.status(500).json({
      error: 'Failed to delete lesson',
      message: 'An error occurred while deleting the lesson'
    });
  }
});

module.exports = router;
