const jwt = require('jsonwebtoken');
const { query } = require('../database/connection');

const authenticateToken = async (req, res, next) => {
  try {
    const authHeader = req.headers['authorization'];
    const token = authHeader && authHeader.split(' ')[1]; // Bearer TOKEN

    if (!token) {
      return res.status(401).json({ 
        error: 'Access token required',
        message: 'Please provide a valid authentication token' 
      });
    }

    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    
    // Get user from database to ensure they still exist and are active
    const userResult = await query(
      'SELECT id, email, first_name, last_name, role, work_type, is_active FROM users WHERE id = $1',
      [decoded.userId]
    );

    if (userResult.rows.length === 0) {
      return res.status(401).json({ 
        error: 'Invalid token',
        message: 'User not found' 
      });
    }

    const user = userResult.rows[0];

    if (!user.is_active) {
      return res.status(401).json({ 
        error: 'Account deactivated',
        message: 'Your account has been deactivated' 
      });
    }

    req.user = user;
    next();
  } catch (error) {
    if (error.name === 'JsonWebTokenError') {
      return res.status(401).json({ 
        error: 'Invalid token',
        message: 'The provided token is invalid' 
      });
    }
    if (error.name === 'TokenExpiredError') {
      return res.status(401).json({ 
        error: 'Token expired',
        message: 'Your session has expired. Please log in again.' 
      });
    }
    
    console.error('Authentication error:', error);
    return res.status(500).json({ 
      error: 'Authentication failed',
      message: 'An error occurred during authentication' 
    });
  }
};

const requireRole = (roles) => {
  return (req, res, next) => {
    if (!req.user) {
      return res.status(401).json({ 
        error: 'Authentication required',
        message: 'Please log in to access this resource' 
      });
    }

    if (!roles.includes(req.user.role)) {
      return res.status(403).json({ 
        error: 'Insufficient permissions',
        message: 'You do not have permission to access this resource' 
      });
    }

    next();
  };
};

const requireAdmin = requireRole(['admin']);
const requireTrainer = requireRole(['admin', 'trainer']);
const requireLearner = requireRole(['admin', 'trainer', 'learner']);

module.exports = {
  authenticateToken,
  requireRole,
  requireAdmin,
  requireTrainer,
  requireLearner
};
