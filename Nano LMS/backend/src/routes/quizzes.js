const express = require('express');
const { body, validationResult } = require('express-validator');
const { query } = require('../database/connection');
const { requireTrainer } = require('../middleware/auth');

const router = express.Router();

// Validation middleware for creating quizzes
const validateQuiz = [
  body('title').trim().isLength({ min: 3, max: 255 }).withMessage('Title must be between 3 and 255 characters'),
  body('description').optional().trim().isLength({ max: 500 }).withMessage('Description must be less than 500 characters'),
  body('time_limit_minutes').optional().isInt({ min: 1, max: 180 }).withMessage('Time limit must be between 1 and 180 minutes'),
  body('passing_percentage').optional().isInt({ min: 0, max: 100 }).withMessage('Passing percentage must be between 0 and 100'),
  body('course_id').isInt({ min: 1 }).withMessage('Course ID is required'),
  body('questions').isArray({ min: 1 }).withMessage('At least one question is required')
];

// Validation middleware for updating quizzes
const validateQuizUpdate = [
  body('title').trim().isLength({ min: 3, max: 255 }).withMessage('Title must be between 3 and 255 characters'),
  body('description').optional().trim().isLength({ max: 500 }).withMessage('Description must be less than 500 characters'),
  body('time_limit_minutes').optional().isInt({ min: 1, max: 180 }).withMessage('Time limit must be between 1 and 180 minutes'),
  body('passing_percentage').optional().isInt({ min: 0, max: 100 }).withMessage('Passing percentage must be between 0 and 100'),
  body('questions').isArray({ min: 1 }).withMessage('At least one question is required')
];

// @route   GET /api/quizzes/lesson/:lessonId
// @desc    Get quiz for a lesson
// @access  Private
router.get('/lesson/:lessonId', async (req, res) => {
  try {
    const { lessonId } = req.params;

    const quizResult = await query(
      `SELECT q.id, q.title, q.description, q.time_limit_minutes, q.passing_score, q.created_at
       FROM quizzes q
       WHERE q.lesson_id = $1`,
      [lessonId]
    );

    if (quizResult.rows.length === 0) {
      return res.status(404).json({
        error: 'Quiz not found',
        message: 'No quiz found for this lesson'
      });
    }

    const quiz = quizResult.rows[0];

    // Get questions for this quiz
    const questionsResult = await query(
      `SELECT id, question, question_type, options, points, order_index
       FROM quiz_questions
       WHERE quiz_id = $1
       ORDER BY order_index`,
      [quiz.id]
    );

    quiz.questions = questionsResult.rows;

    res.json({
      quiz
    });

  } catch (error) {
    console.error('Get quiz error:', error);
    res.status(500).json({
      error: 'Failed to fetch quiz',
      message: 'An error occurred while fetching the quiz'
    });
  }
});

// @route   GET /api/quizzes/courses/:courseId
// @desc    Get quiz for a course
// @access  Private
router.get('/courses/:courseId', async (req, res) => {
  try {
    const { courseId } = req.params;

    const quizResult = await query(
      `SELECT q.id, q.title, q.description, q.time_limit_minutes, q.passing_percentage, q.created_at
       FROM quizzes q
       WHERE q.course_id = $1`,
      [courseId]
    );

    if (quizResult.rows.length === 0) {
      return res.status(404).json({
        error: 'Quiz not found',
        message: 'No quiz found for this course'
      });
    }

    const quiz = quizResult.rows[0];

    // Get questions for this quiz
    const questionsResult = await query(
      `SELECT id, question_text, question_type, options, correct_answer, points
       FROM quiz_questions
       WHERE quiz_id = $1
       ORDER BY id`,
      [quiz.id]
    );

    quiz.questions = questionsResult.rows;

    res.json({
      quiz,
      questions: questionsResult.rows
    });

  } catch (error) {
    console.error('Get course quiz error:', error);
    res.status(500).json({
      error: 'Failed to fetch quiz',
      message: 'An error occurred while fetching the quiz'
    });
  }
});

// @route   POST /api/quizzes
// @desc    Create a new quiz (Trainer/Admin only)
// @access  Private/Trainer
router.post('/', requireTrainer, validateQuiz, async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({
        error: 'Validation failed',
        message: 'Please check your input',
        details: errors.array()
      });
    }

    const { course_id, title, description, time_limit_minutes, passing_percentage, questions } = req.body;

    // Verify course exists and user is instructor
    const courseResult = await query(
      `SELECT id, instructor_id 
       FROM courses
       WHERE id = $1`,
      [course_id]
    );

    if (courseResult.rows.length === 0) {
      return res.status(404).json({
        error: 'Course not found',
        message: 'Course with this ID does not exist'
      });
    }

    if (req.user.role !== 'admin' && courseResult.rows[0].instructor_id !== req.user.id) {
      return res.status(403).json({
        error: 'Access denied',
        message: 'You can only add quizzes to courses you created'
      });
    }

    // Check if quiz already exists for this course
    const existingQuizResult = await query(
      `SELECT id FROM quizzes WHERE course_id = $1`,
      [course_id]
    );

    if (existingQuizResult.rows.length > 0) {
      return res.status(400).json({
        error: 'Quiz already exists',
        message: 'A quiz already exists for this course'
      });
    }

    // Create quiz
    const newQuizResult = await query(
      `INSERT INTO quizzes (course_id, title, description, time_limit_minutes, passing_percentage)
       VALUES ($1, $2, $3, $4, $5)
       RETURNING id, title, description, time_limit_minutes, passing_percentage, created_at`,
      [course_id, title, description, time_limit_minutes, passing_percentage]
    );

    const newQuiz = newQuizResult.rows[0];

    // Add questions if provided
    if (questions && Array.isArray(questions)) {
      for (let i = 0; i < questions.length; i++) {
        const question = questions[i];
        await query(
          `INSERT INTO quiz_questions (quiz_id, question_text, question_type, options, correct_answer, points)
           VALUES ($1, $2, $3, $4, $5, $6)`,
          [
            newQuiz.id,
            question.question_text,
            question.question_type,
            JSON.stringify(question.options),
            question.correct_answer,
            1 // Default points per question
          ]
        );
      }
    }

    res.status(201).json({
      message: 'Quiz created successfully',
      quiz: newQuiz
    });

  } catch (error) {
    console.error('Create quiz error:', error);
    res.status(500).json({
      error: 'Failed to create quiz',
      message: 'An error occurred while creating the quiz'
    });
  }
});

// @route   POST /api/quizzes/:id/attempt
// @desc    Submit quiz attempt
// @access  Private
router.post('/:id/attempt', async (req, res) => {
  try {
    const { id } = req.params;
    const { answers, timeTakenSeconds } = req.body;

    // Get quiz details
    const quizResult = await query(
      'SELECT id, passing_percentage FROM quizzes WHERE id = $1',
      [id]
    );

    if (quizResult.rows.length === 0) {
      return res.status(404).json({
        error: 'Quiz not found',
        message: 'Quiz with this ID does not exist'
      });
    }

    const quiz = quizResult.rows[0];

    // Get questions and correct answers
    const questionsResult = await query(
      'SELECT id, correct_answer, points FROM quiz_questions WHERE quiz_id = $1',
      [id]
    );

    const questions = questionsResult.rows;
    let totalPoints = 0;
    let earnedPoints = 0;
    let correctAnswers = 0;

    // Calculate score
    for (const question of questions) {
      totalPoints += question.points;
      const userAnswer = answers[question.id];
      
      if (userAnswer && userAnswer === question.correct_answer) {
        earnedPoints += question.points;
        correctAnswers++;
      }
    }

    const score = totalPoints > 0 ? Math.round((earnedPoints / totalPoints) * 100) : 0;
    const isPassed = score >= quiz.passing_percentage;

    // Save attempt
    const attemptResult = await query(
      `INSERT INTO quiz_attempts (user_id, quiz_id, score, total_questions, correct_answers, 
                                 time_taken_seconds, is_passed, answers)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
       RETURNING id, score, is_passed, completed_at`,
      [req.user.id, id, score, questions.length, correctAnswers, timeTakenSeconds, isPassed, JSON.stringify(answers)]
    );

    const attempt = attemptResult.rows[0];

    res.json({
      message: 'Quiz attempt submitted successfully',
      attempt: {
        id: attempt.id,
        score,
        totalQuestions: questions.length,
        correctAnswers,
        isPassed,
        completedAt: attempt.completed_at
      }
    });

  } catch (error) {
    console.error('Submit quiz attempt error:', error);
    res.status(500).json({
      error: 'Failed to submit quiz attempt',
      message: 'An error occurred while submitting the quiz attempt'
    });
  }
});

// @route   GET /api/quizzes/:id/attempts
// @desc    Get user's quiz attempts
// @access  Private
router.get('/:id/attempts', async (req, res) => {
  try {
    const { id } = req.params;

    const attemptsResult = await query(
      `SELECT id, score, total_questions, correct_answers, time_taken_seconds, 
              is_passed, started_at, completed_at
       FROM quiz_attempts
       WHERE user_id = $1 AND quiz_id = $2
       ORDER BY started_at DESC`,
      [req.user.id, id]
    );

    res.json({
      attempts: attemptsResult.rows
    });

  } catch (error) {
    console.error('Get quiz attempts error:', error);
    res.status(500).json({
      error: 'Failed to fetch quiz attempts',
      message: 'An error occurred while fetching quiz attempts'
    });
  }
});

// @route   POST /api/quizzes/:quizId/submit
// @desc    Submit quiz attempt (alternative endpoint)
// @access  Private
router.post('/:quizId/submit', async (req, res) => {
  try {
    const { quizId } = req.params;
    const { answers, time_taken_seconds } = req.body;

    // Get quiz details
    const quizResult = await query(
      'SELECT id, passing_percentage FROM quizzes WHERE id = $1',
      [quizId]
    );

    if (quizResult.rows.length === 0) {
      return res.status(404).json({
        error: 'Quiz not found',
        message: 'Quiz with this ID does not exist'
      });
    }

    const quiz = quizResult.rows[0];

    // Get questions and correct answers
    const questionsResult = await query(
      'SELECT id, correct_answer, points FROM quiz_questions WHERE quiz_id = $1',
      [quizId]
    );

    const questions = questionsResult.rows;
    let totalPoints = 0;
    let earnedPoints = 0;
    let correctAnswers = 0;

    // Calculate score
    for (const question of questions) {
      totalPoints += question.points;
      const userAnswer = answers[question.id];
      
      if (userAnswer !== undefined && userAnswer !== null && Number(userAnswer) === Number(question.correct_answer)) {
        earnedPoints += question.points;
        correctAnswers++;
      }
    }

    const score = totalPoints > 0 ? Math.round((earnedPoints / totalPoints) * 100) : 0;
    const passed = score >= quiz.passing_percentage;

    // Save attempt
    const attemptResult = await query(
      `INSERT INTO quiz_attempts (user_id, quiz_id, score, total_questions, correct_answers, 
                                 time_taken_seconds, is_passed, answers, completed_at)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, NOW())
       RETURNING id, score, is_passed, completed_at`,
      [req.user.id, quizId, score, questions.length, correctAnswers, time_taken_seconds, passed, JSON.stringify(answers)]
    );

    const attempt = attemptResult.rows[0];

    // Generate certificate if passed
    let certificate = null;
    if (passed) {
      try {
        // Get course ID for this quiz
        const courseResult = await query('SELECT course_id FROM quizzes WHERE id = $1', [quizId]);
        if (courseResult.rows.length === 0) {
          throw new Error('Course not found for quiz');
        }
        
        const courseId = courseResult.rows[0].course_id;
        
        // Check if certificate already exists for this user and course
        const existingCertificate = await query(
          'SELECT id FROM certificates WHERE user_id = $1 AND course_id = $2',
          [req.user.id, courseId]
        );
        
        if (existingCertificate.rows.length > 0) {
          // Certificate already exists, don't create a new one
          certificate = existingCertificate.rows[0];
        } else {
          // Get user and course details for certificate
          const userResult = await query('SELECT first_name, last_name FROM users WHERE id = $1', [req.user.id]);
          const courseDetailsResult = await query('SELECT title, category FROM courses WHERE id = $1', [courseId]);
          
          if (userResult.rows.length > 0 && courseDetailsResult.rows.length > 0) {
            const user = userResult.rows[0];
            const course = courseDetailsResult.rows[0];
            const certificateNumber = `CERT-${Date.now()}-${req.user.id}`;
            
            // Generate PDF certificate
            const { generateCertificatePDF } = require('./certificates');
            const pdfUrl = await generateCertificatePDF(certificateNumber, user, course);
            
            // Insert certificate with PDF URL
            const certificateResult = await query(
              `INSERT INTO certificates (user_id, course_id, quiz_id, score, certificate_number, pdf_url, issued_at)
               VALUES ($1, $2, $3, $4, $5, $6, NOW())
               RETURNING id`,
              [req.user.id, courseId, quizId, score, certificateNumber, pdfUrl]
            );
            certificate = certificateResult.rows[0];
          }
        }
      } catch (certError) {
        console.error('Certificate generation error:', certError);
        // Continue without certificate if there's an error
      }
    }

    res.json({
      message: 'Quiz submitted successfully!',
      score,
      total_questions: questions.length,
      correct_answers: correctAnswers,
      passed,
      time_taken_seconds,
      certificate_id: certificate ? certificate.id : null
    });

  } catch (error) {
    console.error('Submit quiz error:', error);
    res.status(500).json({
      error: 'Failed to submit quiz',
      message: 'An error occurred while submitting the quiz'
    });
  }
});

// @route   PUT /api/quizzes/:id
// @desc    Update a quiz (Trainer/Admin only)
// @access  Private/Trainer
router.put('/:id', requireTrainer, validateQuizUpdate, async (req, res) => {
  try {
    const { id } = req.params;
    const { title, description, time_limit_minutes, passing_percentage, questions } = req.body;

    // Verify quiz exists and user is instructor
    const quizResult = await query(
      `SELECT q.id, q.course_id, c.instructor_id 
       FROM quizzes q
       JOIN courses c ON q.course_id = c.id
       WHERE q.id = $1`,
      [id]
    );

    if (quizResult.rows.length === 0) {
      return res.status(404).json({
        error: 'Quiz not found',
        message: 'Quiz with this ID does not exist'
      });
    }

    if (req.user.role !== 'admin' && quizResult.rows[0].instructor_id !== req.user.id) {
      return res.status(403).json({
        error: 'Access denied',
        message: 'You can only edit quizzes in courses you created'
      });
    }

    // Update quiz
    await query(
      `UPDATE quizzes 
       SET title = $1, description = $2, time_limit_minutes = $3, passing_percentage = $4, updated_at = NOW()
       WHERE id = $5`,
      [title, description, time_limit_minutes, passing_percentage, id]
    );

    // Delete existing questions
    await query('DELETE FROM quiz_questions WHERE quiz_id = $1', [id]);

    // Add new questions if provided
    if (questions && Array.isArray(questions)) {
      for (let i = 0; i < questions.length; i++) {
        const question = questions[i];
        await query(
          `INSERT INTO quiz_questions (quiz_id, question_text, question_type, options, correct_answer, points)
           VALUES ($1, $2, $3, $4, $5, $6)`,
          [
            id,
            question.question_text,
            question.question_type,
            JSON.stringify(question.options),
            parseInt(question.correct_answer), // Convert to integer
            1 // Default points per question
          ]
        );
      }
    }

    res.json({
      message: 'Quiz updated successfully'
    });

  } catch (error) {
    console.error('Update quiz error:', error);
    res.status(500).json({
      error: 'Failed to update quiz',
      message: 'An error occurred while updating the quiz'
    });
  }
});

// @route   DELETE /api/quizzes/:id
// @desc    Delete a quiz (Trainer/Admin only)
// @access  Private/Trainer
router.delete('/:id', requireTrainer, async (req, res) => {
  try {
    const { id } = req.params;

    // Verify quiz exists and user is instructor
    const quizResult = await query(
      `SELECT q.id, q.course_id, c.instructor_id 
       FROM quizzes q
       JOIN courses c ON q.course_id = c.id
       WHERE q.id = $1`,
      [id]
    );

    if (quizResult.rows.length === 0) {
      return res.status(404).json({
        error: 'Quiz not found',
        message: 'Quiz with this ID does not exist'
      });
    }

    if (req.user.role !== 'admin' && quizResult.rows[0].instructor_id !== req.user.id) {
      return res.status(403).json({
        error: 'Access denied',
        message: 'You can only delete quizzes in courses you created'
      });
    }

    // Delete quiz (cascade will delete questions and attempts)
    await query('DELETE FROM quizzes WHERE id = $1', [id]);

    res.json({
      message: 'Quiz deleted successfully'
    });

  } catch (error) {
    console.error('Delete quiz error:', error);
    res.status(500).json({
      error: 'Failed to delete quiz',
      message: 'An error occurred while deleting the quiz'
    });
  }
});

module.exports = router;
