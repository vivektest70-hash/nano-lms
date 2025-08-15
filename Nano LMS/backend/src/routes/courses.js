const express = require('express');
const { body, validationResult } = require('express-validator');
const { query } = require('../database/connection');
const { requireTrainer, authenticateToken } = require('../middleware/auth');

const router = express.Router();

// Validation middleware
const validateCourse = [
  body('title').trim().isLength({ min: 3, max: 255 }).withMessage('Title must be between 3 and 255 characters'),
  body('description').optional().trim().isLength({ max: 1000 }).withMessage('Description must be less than 1000 characters'),
  body('category').optional().trim().isLength({ max: 100 }).withMessage('Category must be less than 100 characters'),
  body('difficultyLevel').optional().isIn(['beginner', 'intermediate', 'advanced']).withMessage('Difficulty level must be beginner, intermediate, or advanced'),
     body('work_type').optional().isIn(['All', 'Operations', 'Sales', 'Marketing', 'Tech']).withMessage('Work type must be All, Operations, Sales, Marketing, or Tech')
];

// @route   GET /api/courses
// @desc    Get courses (published for all, all courses for admin, own unpublished for trainer)
// @access  Public/Private (depending on user role)
router.get('/', authenticateToken, async (req, res) => {
  try {
    const { page = 1, limit = 10, category = '', difficulty = '', search = '' } = req.query;
    const offset = (page - 1) * limit;

    let whereClause = '';
    let params = [];
    let paramCount = 0;

    // Build where clause based on user role
    if (req.user.role === 'admin') {
      // Admin can see all courses (published and unpublished)
      whereClause = 'WHERE 1=1';
    } else if (req.user.role === 'trainer') {
      // Trainer can see published courses OR their own unpublished courses
      paramCount++;
      whereClause = `WHERE (is_published = true OR (is_published = false AND instructor_id = $${paramCount}))`;
      params.push(req.user.id);
    } else {
      // Learners and public users can only see published courses
      whereClause = 'WHERE c.is_published = true';
      
      // Add work type filtering for learners
      if (req.user.work_type) {
        whereClause += ` AND (c.work_type = 'All' OR c.work_type = '${req.user.work_type}')`;
      }
    }

    if (category) {
      paramCount++;
      whereClause += ` AND c.category ILIKE $${paramCount}`;
      params.push(`%${category}%`);
    }

    if (difficulty) {
      paramCount++;
      whereClause += ` AND c.difficulty_level = $${paramCount}`;
      params.push(difficulty);
    }

    if (search) {
      paramCount++;
      whereClause += ` AND (c.title ILIKE $${paramCount} OR c.description ILIKE $${paramCount})`;
      params.push(`%${search}%`);
    }

    // Get total count
    const countResult = await query(
      `SELECT COUNT(*) FROM courses c ${whereClause}`,
      params
    );
    const totalCourses = parseInt(countResult.rows[0].count);

    // Get courses with instructor info and lesson/quiz counts
    paramCount++;
    const coursesResult = await query(
      `SELECT c.id, c.title, c.description, c.thumbnail_url, c.category, 
              c.difficulty_level, c.duration_minutes, c.is_published, c.created_at,
              c.instructor_id, c.work_type,
              u.first_name as instructor_first_name, u.last_name as instructor_last_name,
              COALESCE(lesson_counts.lesson_count, 0) as lesson_count,
              COALESCE(quiz_counts.quiz_count, 0) as quiz_count
       FROM courses c
       LEFT JOIN users u ON c.instructor_id = u.id
       LEFT JOIN (
         SELECT course_id, COUNT(*) as lesson_count 
         FROM lessons 
         WHERE is_published = true 
         GROUP BY course_id
       ) lesson_counts ON c.id = lesson_counts.course_id
       LEFT JOIN (
         SELECT course_id, COUNT(*) as quiz_count 
         FROM quizzes q 
         WHERE q.course_id IS NOT NULL
         GROUP BY course_id
       ) quiz_counts ON c.id = quiz_counts.course_id
       ${whereClause}
       ORDER BY c.created_at DESC
       LIMIT $${paramCount} OFFSET $${paramCount + 1}`,
      [...params, limit, offset]
    );

    const totalPages = Math.ceil(totalCourses / limit);

    res.json({
      courses: coursesResult.rows,
      pagination: {
        currentPage: parseInt(page),
        totalPages,
        totalCourses,
        hasNextPage: page < totalPages,
        hasPrevPage: page > 1
      }
    });

  } catch (error) {
    console.error('Get courses error:', error);
    console.error('Error details:', error.message);
    console.error('Error stack:', error.stack);
    res.status(500).json({
      error: 'Failed to fetch courses',
      message: 'An error occurred while fetching courses'
    });
  }
});

// @route   GET /api/courses/enrollments
// @desc    Get user's course enrollments
// @access  Private
router.get('/enrollments', authenticateToken, async (req, res) => {
  try {
    const enrollmentsResult = await query(
      `SELECT ce.*, c.title as course_title, c.description, c.thumbnail_url,
              u.first_name as instructor_first_name, u.last_name as instructor_last_name
       FROM course_enrollments ce
       JOIN courses c ON ce.course_id = c.id
       JOIN users u ON c.instructor_id = u.id
       WHERE ce.user_id = $1
       ORDER BY ce.enrolled_at DESC`,
      [req.user.id]
    );

    res.json({
      enrollments: enrollmentsResult.rows
    });

  } catch (error) {
    console.error('Get enrollments error:', error);
    res.status(500).json({
      error: 'Failed to fetch enrollments',
      message: 'An error occurred while fetching enrollments'
    });
  }
});

// @route   POST /api/courses/:id/enroll
// @desc    Enroll in a course
// @access  Private
router.post('/:id/enroll', authenticateToken, async (req, res) => {
  try {
    const { id } = req.params;

    // Check if course exists and is published
    const courseResult = await query(
      'SELECT id, title FROM courses WHERE id = $1 AND is_published = true',
      [id]
    );

    if (courseResult.rows.length === 0) {
      return res.status(404).json({
        error: 'Course not found',
        message: 'Course not found or not published'
      });
    }

    // Check if already enrolled
    const existingEnrollment = await query(
      'SELECT id FROM course_enrollments WHERE user_id = $1 AND course_id = $2',
      [req.user.id, id]
    );

    if (existingEnrollment.rows.length > 0) {
      return res.status(409).json({
        error: 'Already enrolled',
        message: 'You are already enrolled in this course'
      });
    }

    // Create enrollment
    await query(
      'INSERT INTO course_enrollments (user_id, course_id) VALUES ($1, $2)',
      [req.user.id, id]
    );

    res.status(201).json({
      message: 'Successfully enrolled in course',
      course: courseResult.rows[0]
    });

  } catch (error) {
    console.error('Enroll error:', error);
    res.status(500).json({
      error: 'Failed to enroll',
      message: 'An error occurred while enrolling in the course'
    });
  }
});

// @route   GET /api/courses/:id
// @desc    Get course by ID with lessons
// @access  Public/Private (depending on course status and user role)
router.get('/:id', authenticateToken, async (req, res) => {
  try {
    const { id } = req.params;

    // Get course details
    const courseResult = await query(
      `SELECT c.id, c.title, c.description, c.thumbnail_url, c.category, 
              c.difficulty_level, c.duration_minutes, c.is_published, c.created_at,
              c.instructor_id, c.work_type,
              u.first_name as instructor_first_name, u.last_name as instructor_last_name
       FROM courses c
       LEFT JOIN users u ON c.instructor_id = u.id
       WHERE c.id = $1`,
      [id]
    );

    if (courseResult.rows.length === 0) {
      return res.status(404).json({
        error: 'Course not found',
        message: 'Course with this ID does not exist'
      });
    }

    const course = courseResult.rows[0];

    // Check access permissions
    // Admin can view any course
    // Trainer can view published courses OR their own unpublished courses
    // Learners can only view published courses
    if (!course.is_published) {
      if (req.user.role === 'admin') {
        // Admin can view any course
      } else if (req.user.role === 'trainer' && course.instructor_id === req.user.id) {
        // Trainer can view their own unpublished courses
      } else {
        return res.status(403).json({
          error: 'Access denied',
          message: 'This course is not published and you do not have permission to view it'
        });
      }
    }

    // Get lessons for this course
    // Show unpublished lessons to admins and course instructors
    let lessonsQuery = `
      SELECT id, title, description, content, video_url, document_url, duration_minutes, 
             order_index, is_published, created_at
      FROM lessons 
      WHERE course_id = $1
    `;
    
    let lessonsParams = [id];
    
    if (req.user.role === 'admin') {
      // Admin can see all lessons (published and unpublished)
      lessonsQuery += ' ORDER BY order_index';
    } else if (req.user.role === 'trainer' && course.instructor_id === req.user.id) {
      // Trainer can see all lessons in their own courses
      lessonsQuery += ' ORDER BY order_index';
    } else {
      // Learners and other users can only see published lessons
      lessonsQuery += ' AND is_published = true ORDER BY order_index';
    }
    
    const lessonsResult = await query(lessonsQuery, lessonsParams);

    course.lessons = lessonsResult.rows;

    // Get quiz for this course
    const quizResult = await query(
      `SELECT id, title, description, passing_percentage, time_limit_minutes, 
              (SELECT COUNT(*) FROM quiz_questions WHERE quiz_id = q.id) as total_questions
       FROM quizzes q
       WHERE q.course_id = $1`,
      [id]
    );

    course.quiz = quizResult.rows.length > 0 ? quizResult.rows[0] : null;

    // Calculate total duration from lessons
    const totalLessonDuration = course.lessons.reduce((total, lesson) => {
      return total + (lesson.duration_minutes || 0);
    }, 0);

    // Add quiz duration (10 minutes per quiz if quiz exists)
    const quizDuration = course.quiz ? 10 : 0; // 10 minutes for quiz completion

    // Update course duration
    const totalDuration = totalLessonDuration + quizDuration;
    
    // Update the course duration in the database if it's different
    if (totalDuration !== course.duration_minutes) {
      await query(
        'UPDATE courses SET duration_minutes = $1 WHERE id = $2',
        [totalDuration, id]
      );
      course.duration_minutes = totalDuration;
    }

    res.json({
      course
    });

  } catch (error) {
    console.error('Get course error:', error);
    res.status(500).json({
      error: 'Failed to fetch course',
      message: 'An error occurred while fetching the course'
    });
  }
});

// @route   POST /api/courses
// @desc    Create a new course (Trainer/Admin only)
// @access  Private/Trainer
router.post('/', authenticateToken, requireTrainer, validateCourse, async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({
        error: 'Validation failed',
        message: 'Please check your input',
        details: errors.array()
      });
    }

    const { title, description, category, difficultyLevel, work_type = 'All' } = req.body;

    const newCourseResult = await query(
      `INSERT INTO courses (title, description, category, difficulty_level, duration_minutes, instructor_id, is_published, work_type)
       VALUES ($1, $2, $3, $4, 0, $5, true, $6)
       RETURNING id, title, description, category, difficulty_level, duration_minutes, is_published, work_type, created_at`,
      [title, description, category, difficultyLevel, req.user.id, work_type]
    );

    const newCourse = newCourseResult.rows[0];

    res.status(201).json({
      message: 'Course created successfully',
      course: newCourse
    });

  } catch (error) {
    console.error('Create course error:', error);
    res.status(500).json({
      error: 'Failed to create course',
      message: 'An error occurred while creating the course'
    });
  }
});

// @route   PUT /api/courses/:id
// @desc    Update course (Admin can edit any course, Trainer can edit their unpublished courses)
// @access  Private/Admin/Trainer
router.put('/:id', authenticateToken, validateCourse, async (req, res) => {
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
    const { title, description, category, difficultyLevel, durationMinutes, isPublished, work_type } = req.body;

    // Check if course exists and get instructor info
    const courseResult = await query(
      'SELECT instructor_id, is_published FROM courses WHERE id = $1',
      [id]
    );

    if (courseResult.rows.length === 0) {
      return res.status(404).json({
        error: 'Course not found',
        message: 'Course with this ID does not exist'
      });
    }

    const course = courseResult.rows[0];

    // Check permissions
    // Admin can edit any course
    // Trainer can only edit their own unpublished courses
    if (req.user.role === 'admin') {
      // Admin can edit any course - no restrictions
    } else if (req.user.role === 'trainer') {
      if (course.instructor_id !== req.user.id) {
        return res.status(403).json({
          error: 'Access denied',
          message: 'You can only edit courses you created'
        });
      }
      if (course.is_published) {
        return res.status(403).json({
          error: 'Access denied',
          message: 'You can only edit unpublished courses'
        });
      }
    } else {
      return res.status(403).json({
        error: 'Access denied',
        message: 'You do not have permission to edit courses'
      });
    }

    const updateResult = await query(
      `UPDATE courses 
       SET title = $1, description = $2, category = $3, difficulty_level = $4, 
           duration_minutes = $5, is_published = $6, work_type = $7, updated_at = CURRENT_TIMESTAMP
       WHERE id = $8
       RETURNING id, title, description, category, difficulty_level, duration_minutes, is_published, work_type, updated_at`,
      [title, description, category, difficultyLevel, durationMinutes, isPublished, work_type, id]
    );

    res.json({
      message: 'Course updated successfully',
      course: updateResult.rows[0]
    });

  } catch (error) {
    console.error('Update course error:', error);
    res.status(500).json({
      error: 'Failed to update course',
      message: 'An error occurred while updating the course'
    });
  }
});

// @route   DELETE /api/courses/:id
// @desc    Delete course (Admin can delete any course, Trainer can delete their unpublished courses)
// @access  Private/Admin/Trainer
router.delete('/:id', authenticateToken, async (req, res) => {
  try {
    const { id } = req.params;

    // Check if course exists and get instructor info
    const courseResult = await query(
      'SELECT instructor_id, is_published FROM courses WHERE id = $1',
      [id]
    );

    if (courseResult.rows.length === 0) {
      return res.status(404).json({
        error: 'Course not found',
        message: 'Course with this ID does not exist'
      });
    }

    const course = courseResult.rows[0];

    // Check permissions
    // Admin can delete any course
    // Trainer can only delete their own unpublished courses
    if (req.user.role === 'admin') {
      // Admin can delete any course - no restrictions
    } else if (req.user.role === 'trainer') {
      if (course.instructor_id !== req.user.id) {
        return res.status(403).json({
          error: 'Access denied',
          message: 'You can only delete courses you created'
        });
      }
      if (course.is_published) {
        return res.status(403).json({
          error: 'Access denied',
          message: 'You can only delete unpublished courses'
        });
      }
    } else {
      return res.status(403).json({
        error: 'Access denied',
        message: 'You do not have permission to delete courses'
      });
    }

    await query('DELETE FROM courses WHERE id = $1', [id]);

    res.json({
      message: 'Course deleted successfully'
    });

  } catch (error) {
    console.error('Delete course error:', error);
    res.status(500).json({
      error: 'Failed to delete course',
      message: 'An error occurred while deleting the course'
    });
  }
});

module.exports = router;
