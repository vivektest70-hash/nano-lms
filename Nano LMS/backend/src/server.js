const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const morgan = require('morgan');
const path = require('path');
require('dotenv').config();

const authRoutes = require('./routes/auth');
const userRoutes = require('./routes/users');
const courseRoutes = require('./routes/courses');
const lessonRoutes = require('./routes/lessons');
const quizRoutes = require('./routes/quizzes');
const { router: certificateRoutes } = require('./routes/certificates');
const uploadRoutes = require('./routes/upload');
const userProgressRoutes = require('./routes/userProgress');
const aiQuizRoutes = require('./routes/aiQuiz');

const { errorHandler } = require('./middleware/errorHandler');
const { authenticateToken } = require('./middleware/auth');

const app = express();
const PORT = process.env.PORT || 6001;

// Middleware
app.use(helmet({
  contentSecurityPolicy: {
    directives: {
      defaultSrc: ["'self'"],
      styleSrc: ["'self'", "'unsafe-inline'"],
      scriptSrc: ["'self'"],
      mediaSrc: ["'self'", "data:", "blob:"],
      imgSrc: ["'self'", "data:", "blob:"],
      connectSrc: ["'self'"],
      fontSrc: ["'self'", "https:", "data:"],
      objectSrc: ["'none'"],
      frameSrc: ["'self'", "http://localhost:5173", "http://localhost:5178"],
      frameAncestors: ["'self'", "http://localhost:5173", "http://localhost:5178"],
      upgradeInsecureRequests: []
    }
  }
}));
app.use(cors({
  origin: true, // Allow all origins in development
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization', 'Range', 'Origin', 'X-Requested-With', 'Cache-Control', 'Pragma'],
  exposedHeaders: ['Content-Length', 'Content-Range', 'Accept-Ranges', 'Content-Disposition']
}));
app.use(morgan('combined'));
app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ extended: true, limit: '50mb' }));

// Serve static files from uploads directory with CORS headers for videos and PDFs
app.use('/uploads', (req, res, next) => {
  // Add CORS headers for all files
  res.header('Access-Control-Allow-Origin', '*');
  res.header('Access-Control-Allow-Methods', 'GET, HEAD, OPTIONS');
  res.header('Access-Control-Allow-Headers', 'Range, Content-Type, Accept, Origin, X-Requested-With');
  res.header('Access-Control-Expose-Headers', 'Content-Length, Content-Range, Accept-Ranges');
  res.header('Cross-Origin-Resource-Policy', 'cross-origin');
  res.header('Cross-Origin-Embedder-Policy', 'unsafe-none');
  
  // Disable caching for video files to prevent CORS issues with cached responses
  if (req.path.toLowerCase().endsWith('.mp4') || req.path.toLowerCase().endsWith('.webm') || req.path.toLowerCase().endsWith('.ogg')) {
    res.header('Cache-Control', 'no-cache, no-store, must-revalidate');
    res.header('Pragma', 'no-cache');
    res.header('Expires', '0');
  }
  
  // Allow iframe embedding for PDFs
  if (req.path.toLowerCase().endsWith('.pdf')) {
    res.header('X-Frame-Options', 'ALLOWALL');
  }
  
  // Handle preflight requests
  if (req.method === 'OPTIONS') {
    res.sendStatus(200);
    return;
  }
  
  next();
}, express.static(path.join(__dirname, '../uploads')));

// Health check endpoint
app.get('/api/health', (req, res) => {
  res.json({ 
    status: 'OK', 
    timestamp: new Date().toISOString(),
    environment: process.env.NODE_ENV 
  });
});

// API Routes
app.use('/api/auth', authRoutes);
app.use('/api/users', authenticateToken, userRoutes);
app.use('/api/courses', courseRoutes);
app.use('/api/lessons', authenticateToken, lessonRoutes);
app.use('/api/quizzes', authenticateToken, quizRoutes);
app.use('/api/certificates', authenticateToken, certificateRoutes);
app.use('/api/upload', uploadRoutes);
app.use('/api/user-progress', userProgressRoutes);
app.use('/api/ai-quiz', aiQuizRoutes);

// Error handling middleware
app.use(errorHandler);

// 404 handler
app.use('*', (req, res) => {
  res.status(404).json({ 
    error: 'Route not found',
    path: req.originalUrl 
  });
});

// Start server
app.listen(PORT, () => {
  console.log(`🚀 Nano LMS Backend running on port ${PORT}`);
  console.log(`📊 Environment: ${process.env.NODE_ENV}`);
  console.log(`🔗 Health check: http://localhost:${PORT}/api/health`);
});

module.exports = app;
