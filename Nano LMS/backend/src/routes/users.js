const express = require('express');
const bcrypt = require('bcryptjs');
const { body, validationResult, query } = require('express-validator');
const { query: dbQuery } = require('../database/connection');
const { requireAdmin, requireTrainer } = require('../middleware/auth');

const router = express.Router();

// Validation middleware
const validateCreateUser = [
  body('email').isEmail().normalizeEmail().withMessage('Please provide a valid email'),
  body('password').isLength({ min: 6 }).withMessage('Password must be at least 6 characters long'),
  body('first_name').trim().isLength({ min: 2 }).withMessage('First name must be at least 2 characters long'),
  body('last_name').trim().isLength({ min: 2 }).withMessage('Last name must be at least 2 characters long'),
  body('role').isIn(['admin', 'trainer', 'learner']).withMessage('Role must be admin, trainer, or learner'),
  body('work_type').isIn(['Operations', 'Sales', 'Marketing', 'Tech']).withMessage('Work type must be Operations, Sales, Marketing, or Tech')
];

const validateUpdateUser = [
  body('email').optional().isEmail().normalizeEmail().withMessage('Please provide a valid email'),
  body('first_name').optional().trim().isLength({ min: 2 }).withMessage('First name must be at least 2 characters long'),
  body('last_name').optional().trim().isLength({ min: 2 }).withMessage('Last name must be at least 2 characters long'),
  body('role').optional().isIn(['admin', 'trainer', 'learner']).withMessage('Role must be admin, trainer, or learner'),
  body('isActive').optional().isBoolean().withMessage('isActive must be a boolean'),
  body('is_active').optional().isBoolean().withMessage('is_active must be a boolean'),
  body('approval_status').optional().isIn(['pending', 'approved', 'rejected']).withMessage('Approval status must be pending, approved, or rejected')
];

// @route   GET /api/users/pending-approval
// @desc    Get users pending approval (Admin only)
// @access  Private/Admin
router.get('/pending-approval', requireAdmin, async (req, res) => {
  try {
    const pendingUsersResult = await dbQuery(
      `SELECT id, email, first_name, last_name, role, avatar_url, approval_status, created_at
       FROM users 
       WHERE approval_status = 'pending'
       ORDER BY created_at ASC`
    );

    res.json({
      pendingUsers: pendingUsersResult.rows,
      count: pendingUsersResult.rows.length
    });

  } catch (error) {
    console.error('Get pending users error:', error);
    res.status(500).json({
      error: 'Failed to fetch pending users',
      message: 'An error occurred while fetching pending approval requests'
    });
  }
});

// @route   GET /api/users
// @desc    Get all users (Admin only)
// @access  Private/Admin
router.get('/', requireAdmin, async (req, res) => {
  try {
    const { page = 1, limit = 10, search = '', role = '' } = req.query;
    const offset = (page - 1) * limit;

    let whereClause = '';
    let params = [];
    let paramCount = 0;

    if (search) {
      paramCount++;
      whereClause += `WHERE (first_name ILIKE $${paramCount} OR last_name ILIKE $${paramCount} OR email ILIKE $${paramCount})`;
      params.push(`%${search}%`);
    }

    if (role) {
      paramCount++;
      const roleCondition = search ? 'AND' : 'WHERE';
      whereClause += ` ${roleCondition} role = $${paramCount}`;
      params.push(role);
    }

    // Get total count
    const countResult = await dbQuery(
      `SELECT COUNT(*) FROM users ${whereClause}`,
      params
    );
    const totalUsers = parseInt(countResult.rows[0].count);

    // Get users with pagination
    paramCount++;
    const usersResult = await dbQuery(
      `SELECT id, email, first_name, last_name, role, avatar_url, is_active, approval_status, created_at, updated_at
       FROM users ${whereClause}
       ORDER BY created_at DESC
       LIMIT $${paramCount} OFFSET $${paramCount + 1}`,
      [...params, limit, offset]
    );

    const totalPages = Math.ceil(totalUsers / limit);

    res.json({
      users: usersResult.rows,
      pagination: {
        currentPage: parseInt(page),
        totalPages,
        totalUsers,
        hasNextPage: page < totalPages,
        hasPrevPage: page > 1
      }
    });

  } catch (error) {
    console.error('Get users error:', error);
    res.status(500).json({
      error: 'Failed to fetch users',
      message: 'An error occurred while fetching users'
    });
  }
});

// @route   POST /api/users
// @desc    Create a new user (Admin only)
// @access  Private/Admin
router.post('/', requireAdmin, validateCreateUser, async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({
        error: 'Validation failed',
        message: 'Please check your input',
        details: errors.array()
      });
    }

    const { email, password, first_name, last_name, role, work_type = 'Operations' } = req.body;

    // Check if user already exists
    const existingUser = await dbQuery(
      'SELECT id FROM users WHERE email = $1',
      [email]
    );

    if (existingUser.rows.length > 0) {
      return res.status(409).json({
        error: 'User already exists',
        message: 'A user with this email already exists'
      });
    }

    // Hash password
    const saltRounds = 12;
    const passwordHash = await bcrypt.hash(password, saltRounds);

    // Create user
    const newUserResult = await dbQuery(
      `INSERT INTO users (email, password_hash, first_name, last_name, role, work_type)
       VALUES ($1, $2, $3, $4, $5, $6)
       RETURNING id, email, first_name, last_name, role, work_type, is_active, created_at`,
      [email, passwordHash, first_name, last_name, role, work_type]
    );

    const newUser = newUserResult.rows[0];

    res.status(201).json({
      message: 'User created successfully',
      user: newUser
    });

  } catch (error) {
    console.error('Create user error:', error);
    res.status(500).json({
      error: 'Failed to create user',
      message: 'An error occurred while creating the user'
    });
  }
});

// @route   GET /api/users/leaderboard
// @desc    Get leaderboard data (Admin/Trainer only)
// @access  Private/Admin/Trainer
router.get('/leaderboard', async (req, res) => {
  try {
    // Check if user is admin or trainer
    if (req.user.role !== 'admin' && req.user.role !== 'trainer') {
      return res.status(403).json({
        error: 'Access denied',
        message: 'Only admins and trainers can view the leaderboard'
      });
    }

    const leaderboardQuery = `
      SELECT 
        u.id,
        u.first_name,
        u.last_name,
        u.role,
        COUNT(DISTINCT ce.course_id) as enrolled_courses,
        COUNT(DISTINCT cert.id) as completed_courses,
        COUNT(DISTINCT cert.id) as certificates,
        CASE 
          WHEN COUNT(DISTINCT ce.course_id) > 0 
          THEN ROUND(((COUNT(DISTINCT cert.id)::numeric / COUNT(DISTINCT ce.course_id)::numeric) * 100)::numeric, 1)
          ELSE 0 
        END as progress_percentage
      FROM users u
      LEFT JOIN course_enrollments ce ON u.id = ce.user_id
      LEFT JOIN certificates cert ON u.id = cert.user_id
      WHERE u.role = 'learner'
      GROUP BY u.id, u.first_name, u.last_name, u.role
      ORDER BY progress_percentage DESC, completed_courses DESC, certificates DESC
      LIMIT 10
    `;

    const result = await dbQuery(leaderboardQuery);
    
    const leaderboard = result.rows.map(user => ({
      id: user.id,
      first_name: user.first_name,
      last_name: user.last_name,
      role: user.role,
      enrolledCourses: parseInt(user.enrolled_courses),
      completedCourses: parseInt(user.completed_courses),
      certificates: parseInt(user.certificates),
      progressPercentage: parseFloat(user.progress_percentage)
    }));

    res.json({ leaderboard });
  } catch (error) {
    console.error('Get leaderboard error:', error);
    res.status(500).json({
      error: 'Failed to fetch leaderboard',
      message: 'An error occurred while fetching leaderboard data'
    });
  }
});

// @route   GET /api/users/:id
// @desc    Get user by ID
// @access  Private
router.get('/:id', async (req, res) => {
  try {
    const { id } = req.params;

    // Users can only view their own profile unless they're admin
    if (req.user.role !== 'admin' && req.user.id !== parseInt(id)) {
      return res.status(403).json({
        error: 'Access denied',
        message: 'You can only view your own profile'
      });
    }

    const userResult = await dbQuery(
      'SELECT id, email, first_name, last_name, role, avatar_url, is_active, approval_status, created_at, updated_at FROM users WHERE id = $1',
      [id]
    );

    if (userResult.rows.length === 0) {
      return res.status(404).json({
        error: 'User not found',
        message: 'User with this ID does not exist'
      });
    }

    res.json({
      user: userResult.rows[0]
    });

  } catch (error) {
    console.error('Get user error:', error);
    res.status(500).json({
      error: 'Failed to fetch user',
      message: 'An error occurred while fetching the user'
    });
  }
});

// @route   PUT /api/users/:id
// @desc    Update user
// @access  Private
router.put('/:id', requireAdmin, validateUpdateUser, async (req, res) => {
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
    const { email, first_name, last_name, role, isActive, is_active, approval_status } = req.body;
    
    // Handle both camelCase and snake_case for isActive
    const isActiveValue = isActive !== undefined ? isActive : is_active;

    // Users can only update their own profile unless they're admin
    if (req.user.role !== 'admin' && req.user.id !== parseInt(id)) {
      return res.status(403).json({
        error: 'Access denied',
        message: 'You can only update your own profile'
      });
    }

    // Only admins can change roles and active status
    if ((role !== undefined || isActiveValue !== undefined) && req.user.role !== 'admin') {
      return res.status(403).json({
        error: 'Access denied',
        message: 'Only administrators can change user roles and status'
      });
    }

    // Check for email uniqueness if email is being updated
    if (email !== undefined) {
      const existingUser = await dbQuery(
        'SELECT id FROM users WHERE email = $1 AND id != $2',
        [email, id]
      );

      if (existingUser.rows.length > 0) {
        return res.status(409).json({
          error: 'Email already exists',
          message: 'A user with this email already exists'
        });
      }
    }

    // Build update query dynamically
    const updateFields = [];
    const values = [];
    let paramCount = 0;

    if (email !== undefined) {
      paramCount++;
      updateFields.push(`email = $${paramCount}`);
      values.push(email);
    }

    if (first_name !== undefined) {
      paramCount++;
      updateFields.push(`first_name = $${paramCount}`);
      values.push(first_name);
    }

    if (last_name !== undefined) {
      paramCount++;
      updateFields.push(`last_name = $${paramCount}`);
      values.push(last_name);
    }

    if (role !== undefined && req.user.role === 'admin') {
      paramCount++;
      updateFields.push(`role = $${paramCount}`);
      values.push(role);
    }

    if (isActiveValue !== undefined && req.user.role === 'admin') {
      paramCount++;
      updateFields.push(`is_active = $${paramCount}`);
      values.push(isActiveValue);
    }

    if (approval_status !== undefined && req.user.role === 'admin') {
      paramCount++;
      updateFields.push(`approval_status = $${paramCount}`);
      values.push(approval_status);
    }

    if (updateFields.length === 0) {
      return res.status(400).json({
        error: 'No updates provided',
        message: 'Please provide fields to update'
      });
    }

    paramCount++;
    updateFields.push(`updated_at = CURRENT_TIMESTAMP`);
    values.push(id);

    const updateResult = await dbQuery(
      `UPDATE users SET ${updateFields.join(', ')} WHERE id = $${paramCount}
       RETURNING id, email, first_name, last_name, role, avatar_url, is_active, approval_status, created_at, updated_at`,
      values
    );

    if (updateResult.rows.length === 0) {
      return res.status(404).json({
        error: 'User not found',
        message: 'User with this ID does not exist'
      });
    }

    res.json({
      message: 'User updated successfully',
      user: updateResult.rows[0]
    });

  } catch (error) {
    console.error('Update user error:', error);
    res.status(500).json({
      error: 'Failed to update user',
      message: 'An error occurred while updating the user'
    });
  }
});

// @route   DELETE /api/users/:id
// @desc    Delete user (Admin only)
// @access  Private/Admin
router.delete('/:id', requireAdmin, async (req, res) => {
  try {
    const { id } = req.params;

    // Prevent admin from deleting themselves
    if (req.user.id === parseInt(id)) {
      return res.status(400).json({
        error: 'Cannot delete own account',
        message: 'You cannot delete your own account'
      });
    }

    const deleteResult = await dbQuery(
      'DELETE FROM users WHERE id = $1 RETURNING id',
      [id]
    );

    if (deleteResult.rows.length === 0) {
      return res.status(404).json({
        error: 'User not found',
        message: 'User with this ID does not exist'
      });
    }

    res.json({
      message: 'User deleted successfully'
    });

  } catch (error) {
    console.error('Delete user error:', error);
    res.status(500).json({
      error: 'Failed to delete user',
      message: 'An error occurred while deleting the user'
    });
  }
});

module.exports = router;
