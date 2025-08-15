const express = require('express');
const multer = require('multer');
const path = require('path');
const fs = require('fs');
const { authenticateToken, requireTrainer } = require('../middleware/auth');
const { query } = require('../database/connection');

const router = express.Router();

// Create uploads directory if it doesn't exist
const uploadsDir = path.join(__dirname, '..', '..', 'uploads');
const videosDir = path.join(uploadsDir, 'videos');
const documentsDir = path.join(uploadsDir, 'documents');
const imagesDir = path.join(uploadsDir, 'images');

[uploadsDir, videosDir, documentsDir, imagesDir].forEach(dir => {
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }
});

// Configure multer for different file types
const storage = multer.diskStorage({
  destination: function (req, file, cb) {
    let uploadPath = uploadsDir;
    
    if (file.fieldname === 'video') {
      uploadPath = videosDir;
    } else if (file.fieldname === 'document') {
      uploadPath = documentsDir;
    } else if (file.fieldname === 'image') {
      uploadPath = imagesDir;
    }
    
    cb(null, uploadPath);
  },
  filename: function (req, file, cb) {
    // Generate unique filename with timestamp
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
    const ext = path.extname(file.originalname);
    const name = path.basename(file.originalname, ext);
    
    // Clean the filename to avoid encoding issues
    const cleanName = name.replace(/[^a-zA-Z0-9\s\-_]/g, '').replace(/\s+/g, '_');
    
    cb(null, `${cleanName}-${uniqueSuffix}${ext}`);
  }
});

// File filter function
const fileFilter = (req, file, cb) => {
  const allowedVideoTypes = ['video/mp4', 'video/webm', 'video/ogg', 'video/avi', 'video/mov'];
  const allowedDocumentTypes = ['application/pdf', 'application/msword', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document', 'text/plain'];
  const allowedImageTypes = ['image/jpeg', 'image/png', 'image/gif', 'image/webp'];

  if (file.fieldname === 'video' && allowedVideoTypes.includes(file.mimetype)) {
    cb(null, true);
  } else if (file.fieldname === 'document' && allowedDocumentTypes.includes(file.mimetype)) {
    cb(null, true);
  } else if (file.fieldname === 'image' && allowedImageTypes.includes(file.mimetype)) {
    cb(null, true);
  } else {
    cb(new Error('Invalid file type'), false);
  }
};

// Configure multer
const upload = multer({
  storage: storage,
  fileFilter: fileFilter,
  limits: {
    fileSize: 100 * 1024 * 1024, // 100MB limit
  }
});

// Configure multer for lesson media (screen recordings)
const lessonMediaStorage = multer.diskStorage({
  destination: function (req, file, cb) {
    cb(null, videosDir);
  },
  filename: function (req, file, cb) {
    const courseId = req.body.courseId || 'unknown';
    const lessonId = req.body.lessonId || 'new';
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19);
    const ext = path.extname(file.originalname) || '.webm';
    
    cb(null, `course-${courseId}_lesson-${lessonId}_recording_${timestamp}${ext}`);
  }
});

const lessonMediaUpload = multer({
  storage: lessonMediaStorage,
  fileFilter: (req, file, cb) => {
    // More flexible MIME type checking for screen recordings
    const allowedTypes = ['video/webm', 'video/mp4', 'video/ogg'];
    const fileExtension = path.extname(file.originalname).toLowerCase();
    const allowedExtensions = ['.webm', '.mp4', '.ogg'];
    
    // Check both MIME type and file extension
    const isValidMimeType = allowedTypes.some(type => file.mimetype.includes(type.split('/')[1]));
    const isValidExtension = allowedExtensions.includes(fileExtension);
    
    if (isValidMimeType || isValidExtension) {
      cb(null, true);
    } else {
      console.log('Rejected file:', { mimetype: file.mimetype, originalname: file.originalname });
      cb(new Error('Invalid video format. Supported: WebM, MP4, OGG'), false);
    }
  },
  limits: {
    fileSize: 1500 * 1024 * 1024, // 1.5GB limit
  }
});

// @route   POST /api/upload/video
// @desc    Upload video file
// @access  Private/Admin/Trainer
router.post('/video', authenticateToken, (req, res) => {
  // Check if user is admin or trainer
  if (req.user.role !== 'admin' && req.user.role !== 'trainer') {
    return res.status(403).json({
      error: 'Access denied',
      message: 'Only admins and trainers can upload files'
    });
  }
  
  upload.single('video')(req, res, (err) => {
    if (err) {
      return res.status(400).json({
        error: 'Upload failed',
        message: err.message
      });
    }
    
    try {
      if (!req.file) {
        return res.status(400).json({
          error: 'No file uploaded',
          message: 'Please select a video file to upload'
        });
      }

      const fileUrl = `/uploads/videos/${req.file.filename}`;
      
      res.json({
        message: 'Video uploaded successfully',
        file: {
          filename: req.file.filename,
          originalname: req.file.originalname,
          mimetype: req.file.mimetype,
          size: req.file.size,
          url: fileUrl
        }
      });

    } catch (error) {
      console.error('Video upload error:', error);
      res.status(500).json({
        error: 'Upload failed',
        message: 'An error occurred while uploading the video'
      });
    }
  });
});

// @route   POST /api/upload/document
// @desc    Upload document file
// @access  Private/Admin/Trainer
router.post('/document', authenticateToken, (req, res) => {
  // Check if user is admin or trainer
  if (req.user.role !== 'admin' && req.user.role !== 'trainer') {
    return res.status(403).json({
      error: 'Access denied',
      message: 'Only admins and trainers can upload files'
    });
  }
  
  upload.single('document')(req, res, (err) => {
    if (err) {
      return res.status(400).json({
        error: 'Upload failed',
        message: err.message
      });
    }
      try {
      if (!req.file) {
        return res.status(400).json({
          error: 'No file uploaded',
          message: 'Please select a document file to upload'
        });
      }

      const fileUrl = `/uploads/documents/${req.file.filename}`;
      
      res.json({
        message: 'Document uploaded successfully',
        file: {
          filename: req.file.filename,
          originalname: req.file.originalname,
          mimetype: req.file.mimetype,
          size: req.file.size,
          url: fileUrl
        }
      });

    } catch (error) {
      console.error('Document upload error:', error);
      res.status(500).json({
        error: 'Upload failed',
        message: 'An error occurred while uploading the document'
      });
    }
  });
});

// @route   POST /api/upload/image
// @desc    Upload image file
// @access  Private/Admin/Trainer
router.post('/image', authenticateToken, (req, res) => {
  // Check if user is admin or trainer
  if (req.user.role !== 'admin' && req.user.role !== 'trainer') {
    return res.status(403).json({
      error: 'Access denied',
      message: 'Only admins and trainers can upload files'
    });
  }
  
  upload.single('image')(req, res, (err) => {
    if (err) {
      return res.status(400).json({
        error: 'Upload failed',
        message: err.message
      });
    }
      try {
      if (!req.file) {
        return res.status(400).json({
          error: 'No file uploaded',
          message: 'Please select an image file to upload'
        });
      }

      const fileUrl = `/uploads/images/${req.file.filename}`;
      
      res.json({
        message: 'Image uploaded successfully',
        file: {
          filename: req.file.filename,
          originalname: req.file.originalname,
          mimetype: req.file.mimetype,
          size: req.file.size,
          url: fileUrl
        }
      });

    } catch (error) {
      console.error('Image upload error:', error);
      res.status(500).json({
        error: 'Upload failed',
        message: 'An error occurred while uploading the image'
      });
    }
  });
});

// @route   POST /api/upload/lesson-media
// @desc    Upload lesson media (screen recordings)
// @access  Private/Admin/Trainer
router.post('/lesson-media', authenticateToken, (req, res) => {
  // Check if user is admin or trainer
  if (req.user.role !== 'admin' && req.user.role !== 'trainer') {
    return res.status(403).json({
      error: 'Access denied',
      message: 'Only admins and trainers can upload lesson media'
    });
  }

  lessonMediaUpload.single('file')(req, res, async (err) => {
    if (err) {
      return res.status(400).json({
        error: 'Upload failed',
        message: err.message
      });
    }

    try {
      if (!req.file) {
        return res.status(400).json({
          error: 'No file uploaded',
          message: 'Please select a video file to upload'
        });
      }

      const { courseId, lessonId, title, durationSec, width, height, mimeType } = req.body;

      // Debug logging
      console.log('Upload request:', {
        user: req.user,
        body: req.body,
        file: req.file ? {
          filename: req.file.filename,
          size: req.file.size,
          mimetype: req.file.mimetype
        } : null
      });

      const fileUrl = `/uploads/videos/${req.file.filename}`;
      
      // Store media metadata in database
      const mediaResult = await query(
        `INSERT INTO lesson_media (course_id, lesson_id, title, filename, url, size_bytes, mime_type, duration_sec, width, height, uploaded_by, created_at)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, CURRENT_TIMESTAMP)
         RETURNING id`,
        [
          courseId,
          lessonId || null,
          title || req.file.originalname,
          req.file.filename,
          fileUrl,
          req.file.size,
          mimeType || req.file.mimetype,
          durationSec || null,
          width || null,
          height || null,
          req.user.id
        ]
      );

      const mediaId = mediaResult.rows[0].id;

      res.json({
        message: 'Lesson media uploaded successfully',
        media: {
          id: mediaId,
          filename: req.file.filename,
          originalname: req.file.originalname,
          mimetype: req.file.mimetype,
          size: req.file.size,
          url: fileUrl,
          durationSec: durationSec ? parseInt(durationSec) : null,
          width: width ? parseInt(width) : null,
          height: height ? parseInt(height) : null
        }
      });

    } catch (error) {
      console.error('Lesson media upload error:', error);
      res.status(500).json({
        error: 'Upload failed',
        message: 'An error occurred while uploading the lesson media'
      });
    }
  });
});

// @route   GET /api/upload/check/:type/:filename
// @desc    Check if file exists
// @access  Private
router.get('/check/:type/:filename', authenticateToken, (req, res) => {
  try {
    const { type, filename } = req.params;
    
    let filePath;
    switch (type) {
      case 'video':
        filePath = path.join(videosDir, filename);
        break;
      case 'document':
        filePath = path.join(documentsDir, filename);
        break;
      case 'image':
        filePath = path.join(imagesDir, filename);
        break;
      default:
        return res.status(400).json({
          error: 'Invalid file type',
          message: 'File type must be video, document, or image'
        });
    }

    const exists = fs.existsSync(filePath);
    
    res.json({
      exists,
      message: exists ? 'File exists' : 'File not found'
    });

  } catch (error) {
    console.error('File check error:', error);
    res.status(500).json({
      error: 'Failed to check file',
      message: 'An error occurred while checking the file'
    });
  }
});

// @route   DELETE /api/upload/:type/:filename
// @desc    Delete uploaded file
// @access  Private/Admin/Trainer
router.delete('/:type/:filename', authenticateToken, async (req, res) => {
  // Check if user is admin or trainer
  if (req.user.role !== 'admin' && req.user.role !== 'trainer') {
    return res.status(403).json({
      error: 'Access denied',
      message: 'Only admins and trainers can delete files'
    });
  }
  try {
    const { type, filename } = req.params;
    
    let filePath;
    switch (type) {
      case 'video':
        filePath = path.join(videosDir, filename);
        break;
      case 'document':
        filePath = path.join(documentsDir, filename);
        break;
      case 'image':
        filePath = path.join(imagesDir, filename);
        break;
      default:
        return res.status(400).json({
          error: 'Invalid file type',
          message: 'File type must be video, document, or image'
        });
    }

    if (fs.existsSync(filePath)) {
      fs.unlinkSync(filePath);
      
      // Update lessons that reference this file
      const fileUrl = `/uploads/${type}s/${filename}`;
      let updateQuery;
      
      if (type === 'video') {
        updateQuery = 'UPDATE lessons SET video_url = NULL WHERE video_url = $1';
      } else if (type === 'document') {
        updateQuery = 'UPDATE lessons SET document_url = NULL WHERE document_url = $1';
      }
      
      if (updateQuery) {
        try {
          await query(updateQuery, [fileUrl]);
          console.log(`Updated lessons to remove reference to deleted ${type}: ${filename}`);
        } catch (dbError) {
          console.error('Database update error:', dbError);
          // Don't fail the deletion if database update fails
        }
      }
      
      res.json({
        message: 'File deleted successfully and lesson references updated'
      });
    } else {
      res.status(404).json({
        error: 'File not found',
        message: 'The specified file does not exist'
      });
    }

  } catch (error) {
    console.error('File deletion error:', error);
    res.status(500).json({
      error: 'Deletion failed',
      message: 'An error occurred while deleting the file'
    });
  }
});

module.exports = router;
