const express = require('express');
const { body, validationResult } = require('express-validator');
const { query } = require('../database/connection');
const { authenticateToken } = require('../middleware/auth');
const { v4: uuidv4 } = require('uuid');
const PDFDocument = require('pdfkit');
const fs = require('fs');
const path = require('path');

const router = express.Router();

// Validation middleware
const validateProgress = [
  body('lesson_id').isInt().withMessage('Lesson ID must be a valid integer'),
  body('progress').isInt({ min: 0, max: 100 }).withMessage('Progress must be between 0 and 100'),
  body('completed').isBoolean().withMessage('Completed must be a boolean')
];

// @route   GET /api/user-progress/lesson/:lessonId
// @desc    Get user progress for a specific lesson
// @access  Private
router.get('/lesson/:lessonId', authenticateToken, async (req, res) => {
  try {
    const { lessonId } = req.params;
    const userId = req.user.id;

    const result = await query(
      'SELECT * FROM user_progress WHERE user_id = $1 AND lesson_id = $2',
      [userId, lessonId]
    );

    if (result.rows.length === 0) {
      return res.json({
        completed: false,
        progress: 0,
        last_updated: null
      });
    }

    const progress = result.rows[0];
    res.json({
      completed: progress.is_completed,
      progress: progress.progress || 0,
      last_updated: progress.updated_at
    });

  } catch (error) {
    console.error('Get progress error:', error);
    res.status(500).json({
      error: 'Failed to fetch progress',
      message: 'An error occurred while fetching your progress'
    });
  }
});

// @route   GET /api/user-progress/course/:courseId
// @desc    Get user progress for all lessons in a course
// @access  Private
router.get('/course/:courseId', authenticateToken, async (req, res) => {
  try {
    const { courseId } = req.params;
    const userId = req.user.id;

    const result = await query(
      `SELECT up.*, l.title as lesson_title, l.order_index
       FROM user_progress up
       JOIN lessons l ON up.lesson_id = l.id
       WHERE up.user_id = $1 AND l.course_id = $2
       ORDER BY l.order_index`,
      [userId, courseId]
    );

    // Get total lessons in course
    const totalLessonsResult = await query(
      'SELECT COUNT(*) FROM lessons WHERE course_id = $1 AND is_published = true',
      [courseId]
    );

    const totalLessons = parseInt(totalLessonsResult.rows[0].count);
    const completedLessons = result.rows.filter(p => p.is_completed).length;
    const totalProgress = result.rows.reduce((sum, p) => sum + p.progress, 0);
    const averageProgress = totalLessons > 0 ? Math.round(totalProgress / totalLessons) : 0;

    res.json({
      progress: result.rows,
      summary: {
        totalLessons,
        completedLessons,
        averageProgress,
        courseCompleted: completedLessons === totalLessons && totalLessons > 0
      }
    });

  } catch (error) {
    console.error('Get course progress error:', error);
    res.status(500).json({
      error: 'Failed to fetch course progress',
      message: 'An error occurred while fetching your course progress'
    });
  }
});

// @route   GET /api/user-progress/courses/all
// @desc    Get comprehensive progress for all courses
// @access  Private
router.get('/courses/all', authenticateToken, async (req, res) => {
  try {
    const userId = req.user.id;

    // Get all courses with lesson and quiz counts
    const coursesResult = await query(
      `SELECT c.id, c.title,
              COALESCE(lesson_counts.lesson_count, 0) as lesson_count,
              COALESCE(quiz_counts.quiz_count, 0) as quiz_count
       FROM courses c
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
       WHERE c.is_published = true
       ORDER BY c.id`,
      []
    );

    const progressMap = {};

    for (const course of coursesResult.rows) {
      const courseId = course.id;
      const totalLessons = parseInt(course.lesson_count);
      const hasQuiz = parseInt(course.quiz_count) > 0;
      const totalComponents = totalLessons + (hasQuiz ? 1 : 0);

      // Get completed lessons for this course
      const completedLessonsResult = await query(
        `SELECT COUNT(*) as completed_count
         FROM user_progress up
         JOIN lessons l ON up.lesson_id = l.id
         WHERE up.user_id = $1 AND l.course_id = $2 AND up.is_completed = true`,
        [userId, courseId]
      );

      const completedLessons = parseInt(completedLessonsResult.rows[0].completed_count);

      // Get quiz completion status
      let quizPassed = false;
      if (hasQuiz) {
        const quizResult = await query(
          `SELECT COUNT(*) as passed_count
           FROM quiz_attempts qa
           JOIN quizzes q ON qa.quiz_id = q.id
           WHERE qa.user_id = $1 AND q.course_id = $2 AND qa.is_passed = true`,
          [userId, courseId]
        );
        quizPassed = parseInt(quizResult.rows[0].passed_count) > 0;

      }

      const completedComponents = completedLessons + (quizPassed ? 1 : 0);
      const overallProgress = totalComponents > 0 ? Math.round((completedComponents / totalComponents) * 100) : 0;

      progressMap[courseId] = {
        totalLessons,
        completedLessons,
        hasQuiz,
        quizPassed,
        totalComponents,
        completedComponents,
        overallProgress,
        courseCompleted: completedComponents === totalComponents && totalComponents > 0
      };
      

    }

    res.json(progressMap);

  } catch (error) {
    console.error('Get all courses progress error:', error);
    res.status(500).json({
      error: 'Failed to fetch all courses progress',
      message: 'An error occurred while fetching your progress'
    });
  }
});

// @route   GET /api/user-progress/course/:courseId/comprehensive
// @desc    Get comprehensive course progress including lessons and quiz
// @access  Private
router.get('/course/:courseId/comprehensive', authenticateToken, async (req, res) => {
  try {
    const { courseId } = req.params;
    const userId = req.user.id;

    // Get lesson progress
    const lessonProgressResult = await query(
      `SELECT up.*, l.title as lesson_title, l.order_index
       FROM user_progress up
       JOIN lessons l ON up.lesson_id = l.id
       WHERE up.user_id = $1 AND l.course_id = $2
       ORDER BY l.order_index`,
      [userId, courseId]
    );

    // Get total lessons in course
    const totalLessonsResult = await query(
      'SELECT COUNT(*) FROM lessons WHERE course_id = $1 AND is_published = true',
      [courseId]
    );

    const totalLessons = parseInt(totalLessonsResult.rows[0].count);
    const completedLessons = lessonProgressResult.rows.filter(p => p.is_completed).length;

    // Get quiz progress
    const quizResult = await query(
      `SELECT q.id, q.title, q.passing_percentage,
              (SELECT COUNT(*) FROM quiz_questions WHERE quiz_id = q.id) as total_questions,
              (SELECT COUNT(*) FROM quiz_attempts WHERE quiz_id = q.id AND user_id = $1 AND is_passed = true) as passed_attempts
       FROM quizzes q
       WHERE q.course_id = $2`,
      [userId, courseId]
    );

    const hasQuiz = quizResult.rows.length > 0;
    const quizPassed = hasQuiz ? quizResult.rows[0].passed_attempts > 0 : false;
    const totalComponents = totalLessons + (hasQuiz ? 1 : 0);
    const completedComponents = completedLessons + (quizPassed ? 1 : 0);

    // Calculate overall course progress
    let overallProgress = 0;
    if (totalComponents > 0) {
      // Each lesson contributes equally, quiz contributes equally
      const lessonProgress = (completedLessons / totalLessons) * (totalLessons / totalComponents) * 100;
      const quizProgress = hasQuiz ? (quizPassed ? (1 / totalComponents) * 100 : 0) : 0;
      overallProgress = Math.round(lessonProgress + quizProgress);
    }

    res.json({
      lessonProgress: lessonProgressResult.rows,
      quizProgress: hasQuiz ? {
        id: quizResult.rows[0].id,
        title: quizResult.rows[0].title,
        passed: quizPassed,
        totalQuestions: quizResult.rows[0].total_questions,
        passingPercentage: quizResult.rows[0].passing_percentage
      } : null,
      summary: {
        totalLessons,
        completedLessons,
        hasQuiz,
        quizPassed,
        totalComponents,
        completedComponents,
        overallProgress,
        courseCompleted: completedComponents === totalComponents && totalComponents > 0
      }
    });

  } catch (error) {
    console.error('Get comprehensive course progress error:', error);
    res.status(500).json({
      error: 'Failed to fetch comprehensive course progress',
      message: 'An error occurred while fetching your course progress'
    });
  }
});

// @route   POST /api/user-progress
// @desc    Save or update user progress for a lesson
// @access  Private
router.post('/', authenticateToken, validateProgress, async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({
        error: 'Validation failed',
        message: 'Please check your input',
        details: errors.array()
      });
    }

    const { lesson_id, progress, completed } = req.body;
    const userId = req.user.id;

    // Check if progress record exists
    const existingResult = await query(
      'SELECT id FROM user_progress WHERE user_id = $1 AND lesson_id = $2',
      [userId, lesson_id]
    );

    let result;
    if (existingResult.rows.length > 0) {
      // Update existing progress
      result = await query(
        `UPDATE user_progress 
         SET progress = $1, is_completed = $2, updated_at = CURRENT_TIMESTAMP
         WHERE user_id = $3 AND lesson_id = $4
         RETURNING *`,
        [progress, completed, userId, lesson_id]
      );
    } else {
      // Create new progress record
      result = await query(
        `INSERT INTO user_progress (user_id, lesson_id, progress, is_completed)
         VALUES ($1, $2, $3, $4)
         RETURNING *`,
        [userId, lesson_id, progress, completed]
      );
    }

    const savedProgress = result.rows[0];

    // Check if course is completed
    if (completed) {
      await checkCourseCompletion(userId, lesson_id);
    }

    res.json({
      message: 'Progress saved successfully',
      progress: savedProgress
    });

  } catch (error) {
    console.error('Save progress error:', error);
    res.status(500).json({
      error: 'Failed to save progress',
      message: 'An error occurred while saving your progress'
    });
  }
});

// @route   GET /api/user-progress/overview
// @desc    Get overview of user's learning progress
// @access  Private
router.get('/overview', authenticateToken, async (req, res) => {
  try {
    const userId = req.user.id;

    // Get total progress across all enrolled courses
    const result = await query(
      `SELECT 
         COUNT(DISTINCT up.lesson_id) as total_lessons_attempted,
         COUNT(DISTINCT CASE WHEN up.is_completed = true THEN up.lesson_id END) as completed_lessons,
         COUNT(DISTINCT ce.course_id) as enrolled_courses,
         AVG(up.progress) as average_progress
       FROM user_progress up
       LEFT JOIN course_enrollments ce ON up.user_id = ce.user_id
       WHERE up.user_id = $1`,
      [userId]
    );

    const stats = result.rows[0];

    // Get recent activity
    const recentActivityResult = await query(
      `SELECT up.*, l.title as lesson_title, c.title as course_title
       FROM user_progress up
       JOIN lessons l ON up.lesson_id = l.id
       JOIN courses c ON l.course_id = c.id
       WHERE up.user_id = $1
       ORDER BY up.updated_at DESC
       LIMIT 5`,
      [userId]
    );

    res.json({
      stats: {
        totalLessonsAttempted: parseInt(stats.total_lessons_attempted) || 0,
        completedLessons: parseInt(stats.completed_lessons) || 0,
        averageProgress: Math.round(parseFloat(stats.average_progress) || 0),
        enrolledCourses: parseInt(stats.enrolled_courses) || 0
      },
      recentActivity: recentActivityResult.rows
    });

  } catch (error) {
    console.error('Get overview error:', error);
    res.status(500).json({
      error: 'Failed to fetch overview',
      message: 'An error occurred while fetching your learning overview'
    });
  }
});

// Helper function to generate PDF certificate
async function generateCertificatePDF(certificateNumber, user, course) {
  return new Promise((resolve, reject) => {
    try {
      const doc = new PDFDocument({
        size: 'A4',
        layout: 'landscape'
      });

      // Create uploads directory if it doesn't exist
      const uploadsDir = path.join(__dirname, '..', '..', 'uploads', 'certificates');
      if (!fs.existsSync(uploadsDir)) {
        fs.mkdirSync(uploadsDir, { recursive: true });
      }

      const filename = `certificate-${certificateNumber}.pdf`;
      const filepath = path.join(uploadsDir, filename);
      const writeStream = fs.createWriteStream(filepath);

      doc.pipe(writeStream);

      // Add certificate content
      doc.fontSize(40)
         .font('Helvetica-Bold')
         .text('Certificate of Completion', 0, 100, { align: 'center' });

      doc.fontSize(16)
         .font('Helvetica')
         .text('This is to certify that', 0, 180, { align: 'center' });

      doc.fontSize(24)
         .font('Helvetica-Bold')
         .text(`${user.first_name} ${user.last_name}`, 0, 220, { align: 'center' });

      doc.fontSize(16)
         .font('Helvetica')
         .text('has successfully completed the course', 0, 260, { align: 'center' });

      doc.fontSize(20)
         .font('Helvetica-Bold')
         .text(course.title, 0, 300, { align: 'center' });

      doc.fontSize(14)
         .font('Helvetica')
         .text(`Category: ${course.category}`, 0, 350, { align: 'center' });

      doc.fontSize(12)
         .font('Helvetica')
         .text(`Certificate Number: ${certificateNumber}`, 0, 380, { align: 'center' });

      doc.fontSize(10)
         .font('Helvetica')
         .text(`Issued on: ${new Date().toLocaleDateString()}`, 0, 410, { align: 'center' });

      // Add decorative border
      doc.rect(20, 20, doc.page.width - 40, doc.page.height - 40)
         .lineWidth(3)
         .stroke();

      doc.end();

      writeStream.on('finish', () => {
        resolve(`uploads/certificates/${filename}`);
      });

      writeStream.on('error', reject);

    } catch (error) {
      reject(error);
    }
  });
}

// Helper function to check if a course is completed
const checkCourseCompletion = async (userId, lessonId) => {
  try {
    // Get course ID from lesson
    const lessonResult = await query(
      'SELECT course_id FROM lessons WHERE id = $1',
      [lessonId]
    );

    if (lessonResult.rows.length === 0) return;

    const courseId = lessonResult.rows[0].course_id;

    // Get all lessons in the course
    const lessonsResult = await query(
      'SELECT id FROM lessons WHERE course_id = $1 AND is_published = true',
      [courseId]
    );

    const totalLessons = lessonsResult.rows.length;

    // Get completed lessons for this user in this course
    const completedResult = await query(
      `SELECT COUNT(*) FROM user_progress up
       JOIN lessons l ON up.lesson_id = l.id
       WHERE up.user_id = $1 AND l.course_id = $2 AND up.is_completed = true`,
      [userId, courseId]
    );

    const completedLessons = parseInt(completedResult.rows[0].count);

    // If all lessons are completed, generate certificate
    if (completedLessons === totalLessons && totalLessons > 0) {
      // Check if certificate already exists
      const existingCertResult = await query(
        'SELECT id FROM certificates WHERE user_id = $1 AND course_id = $2',
        [userId, courseId]
      );

      if (existingCertResult.rows.length === 0) {
        // Get course and user details for PDF generation
        const courseResult = await query(
          'SELECT title, category FROM courses WHERE id = $1',
          [courseId]
        );

        const userResult = await query(
          'SELECT first_name, last_name FROM users WHERE id = $1',
          [userId]
        );

        if (courseResult.rows.length > 0 && userResult.rows.length > 0) {
          const course = courseResult.rows[0];
          const user = userResult.rows[0];
          const certificateNumber = `CERT-${userId}-${courseId}-${Date.now()}`;

          // Generate PDF certificate
          const pdfPath = await generateCertificatePDF(certificateNumber, user, course);

          // Save certificate to database with PDF path
          await query(
            `INSERT INTO certificates (user_id, course_id, certificate_number, pdf_url, issued_at)
             VALUES ($1, $2, $3, $4, CURRENT_TIMESTAMP)`,
            [userId, courseId, certificateNumber, pdfPath]
          );
        }
      }
    }
  } catch (error) {
    console.error('Course completion check error:', error);
  }
};

module.exports = router;
