const express = require('express');
const { query } = require('../database/connection');
const { authenticateToken } = require('../middleware/auth');
const { v4: uuidv4 } = require('uuid');
const PDFDocument = require('pdfkit');
const fs = require('fs');
const path = require('path');

const router = express.Router();

// @route   GET /api/certificates
// @desc    Get all certificates (Admin only)
// @access  Private/Admin
router.get('/', authenticateToken, async (req, res) => {
  try {
    // Only admins can view all certificates
    if (req.user.role !== 'admin') {
      return res.status(403).json({
        error: 'Access denied',
        message: 'Only administrators can view all certificates'
      });
    }

    const certificatesResult = await query(
      `SELECT c.id, c.certificate_number, c.issued_at, c.pdf_url,
              co.title as course_title, co.category as course_category,
              u.first_name, u.last_name, u.email
       FROM certificates c
       JOIN courses co ON c.course_id = co.id
       JOIN users u ON c.user_id = u.id
       ORDER BY c.issued_at DESC`
    );

    res.json({
      certificates: certificatesResult.rows,
      totalCertificates: certificatesResult.rows.length
    });

  } catch (error) {
    console.error('Get all certificates error:', error);
    res.status(500).json({
      error: 'Failed to fetch certificates',
      message: 'An error occurred while fetching certificates'
    });
  }
});

// @route   GET /api/certificates/user/:userId
// @desc    Get user's certificates
// @access  Private
router.get('/user/:userId', authenticateToken, async (req, res) => {
  try {
    const { userId } = req.params;

    // Users can only view their own certificates unless they're admin
    if (req.user.role !== 'admin' && req.user.id !== parseInt(userId)) {
      return res.status(403).json({
        error: 'Access denied',
        message: 'You can only view your own certificates'
      });
    }

    const certificatesResult = await query(
      `SELECT c.id, c.certificate_number, c.issued_at, c.pdf_url, c.quiz_id,
              co.title as course_title, co.category as course_category,
              u.first_name, u.last_name
       FROM certificates c
       JOIN courses co ON c.course_id = co.id
       JOIN users u ON c.user_id = u.id
       WHERE c.user_id = $1
       ORDER BY c.issued_at DESC`,
      [userId]
    );

    res.json({
      certificates: certificatesResult.rows
    });

  } catch (error) {
    console.error('Get certificates error:', error);
    res.status(500).json({
      error: 'Failed to fetch certificates',
      message: 'An error occurred while fetching certificates'
    });
  }
});

// @route   POST /api/certificates/generate-all
// @desc    Generate certificates for all completed courses
// @access  Private
router.post('/generate-all', authenticateToken, async (req, res) => {
  try {
    // Get all courses where user has completed all lessons
    const completedCoursesResult = await query(
      `SELECT DISTINCT c.id, c.title, c.category
       FROM courses c
       JOIN lessons l ON c.id = l.course_id
       WHERE l.is_published = true
       AND c.id NOT IN (
         SELECT DISTINCT cert.course_id 
         FROM certificates cert 
         WHERE cert.user_id = $1
       )
       AND c.id IN (
         SELECT ce.course_id 
         FROM course_enrollments ce 
         WHERE ce.user_id = $1
       )
       AND (
         SELECT COUNT(*) 
         FROM lessons l2 
         WHERE l2.course_id = c.id AND l2.is_published = true
       ) = (
         SELECT COUNT(*) 
         FROM user_progress up
         JOIN lessons l3 ON up.lesson_id = l3.id
         WHERE up.user_id = $1 AND l3.course_id = c.id AND up.is_completed = true
       )`,
      [req.user.id]
    );

    const generatedCertificates = [];

    for (const course of completedCoursesResult.rows) {
      try {
        // Get user details
        const userResult = await query(
          'SELECT first_name, last_name FROM users WHERE id = $1',
          [req.user.id]
        );

        if (userResult.rows.length > 0) {
          const user = userResult.rows[0];
          const certificateNumber = `CERT-${req.user.id}-${course.id}-${Date.now()}`;

          // Generate PDF certificate
          const pdfPath = await generateCertificatePDF(certificateNumber, user, course);

          // Save certificate to database
          const certificateResult = await query(
            `INSERT INTO certificates (user_id, course_id, certificate_number, pdf_url, issued_at)
             VALUES ($1, $2, $3, $4, CURRENT_TIMESTAMP)
             RETURNING id, certificate_number, issued_at, pdf_url`,
            [req.user.id, course.id, certificateNumber, pdfPath]
          );

          generatedCertificates.push(certificateResult.rows[0]);
        }
      } catch (error) {
        console.error(`Error generating certificate for course ${course.id}:`, error);
      }
    }

    res.status(200).json({
      message: `Generated ${generatedCertificates.length} certificates`,
      certificates: generatedCertificates
    });

  } catch (error) {
    console.error('Generate all certificates error:', error);
    res.status(500).json({
      error: 'Failed to generate certificates',
      message: 'An error occurred while generating certificates'
    });
  }
});

// @route   POST /api/certificates/generate
// @desc    Generate certificate for course completion
// @access  Private
router.post('/generate', authenticateToken, async (req, res) => {
  try {
    const { courseId } = req.body;

    // Check if user has completed the course
    const completionResult = await query(
      `SELECT COUNT(*) as total_lessons,
              COUNT(CASE WHEN up.is_completed = true THEN 1 END) as completed_lessons
       FROM lessons l
       LEFT JOIN user_progress up ON l.id = up.lesson_id AND up.user_id = $1
       WHERE l.course_id = $2 AND l.is_published = true`,
      [req.user.id, courseId]
    );

    if (completionResult.rows.length === 0) {
      return res.status(404).json({
        error: 'Course not found',
        message: 'Course with this ID does not exist'
      });
    }

    const { total_lessons, completed_lessons } = completionResult.rows[0];

    if (completed_lessons < total_lessons) {
      return res.status(400).json({
        error: 'Course not completed',
        message: 'You must complete all lessons before generating a certificate'
      });
    }

    // Check if certificate already exists
    const existingCertificate = await query(
      'SELECT id FROM certificates WHERE user_id = $1 AND course_id = $2',
      [req.user.id, courseId]
    );

    if (existingCertificate.rows.length > 0) {
      return res.status(409).json({
        error: 'Certificate already exists',
        message: 'A certificate for this course already exists'
      });
    }

    // Get course and user details
    const courseResult = await query(
      'SELECT title, category FROM courses WHERE id = $1',
      [courseId]
    );

    const userResult = await query(
      'SELECT first_name, last_name FROM users WHERE id = $1',
      [req.user.id]
    );

    if (courseResult.rows.length === 0 || userResult.rows.length === 0) {
      return res.status(404).json({
        error: 'Course or user not found',
        message: 'Course or user with this ID does not exist'
      });
    }

    const course = courseResult.rows[0];
    const user = userResult.rows[0];

    // Generate certificate number
    const certificateNumber = `CERT-${uuidv4().substring(0, 8).toUpperCase()}`;

    // Create PDF certificate
    const pdfPath = await generateCertificatePDF(certificateNumber, user, course);

    // Save certificate to database
    const certificateResult = await query(
      `INSERT INTO certificates (user_id, course_id, certificate_number, pdf_url)
       VALUES ($1, $2, $3, $4)
       RETURNING id, certificate_number, issued_at, pdf_url`,
      [req.user.id, courseId, certificateNumber, pdfPath]
    );

    const certificate = certificateResult.rows[0];

    res.status(201).json({
      message: 'Certificate generated successfully',
      certificate
    });

  } catch (error) {
    console.error('Generate certificate error:', error);
    res.status(500).json({
      error: 'Failed to generate certificate',
      message: 'An error occurred while generating the certificate'
    });
  }
});

// @route   GET /api/certificates/:id/download
// @desc    Download certificate PDF
// @access  Private
router.get('/:id/download', authenticateToken, async (req, res) => {
  try {
    const { id } = req.params;

    // Get certificate details
    const certificateResult = await query(
      `SELECT c.pdf_url, c.user_id, u.first_name, u.last_name
       FROM certificates c
       JOIN users u ON c.user_id = u.id
       WHERE c.id = $1`,
      [id]
    );

    if (certificateResult.rows.length === 0) {
      return res.status(404).json({
        error: 'Certificate not found',
        message: 'Certificate with this ID does not exist'
      });
    }

    const certificate = certificateResult.rows[0];

    // Users can only download their own certificates unless they're admin
    if (req.user.role !== 'admin' && req.user.id !== certificate.user_id) {
      return res.status(403).json({
        error: 'Access denied',
        message: 'You can only download your own certificates'
      });
    }

    const pdfPath = path.join(__dirname, '..', '..', certificate.pdf_url);

    if (!fs.existsSync(pdfPath)) {
      return res.status(404).json({
        error: 'PDF not found',
        message: 'Certificate PDF file not found'
      });
    }

    // Set proper headers for blob download
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `attachment; filename="certificate-${certificate.first_name}-${certificate.last_name}.pdf"`);
    res.setHeader('Access-Control-Expose-Headers', 'Content-Disposition');
    
    // Read and send the file as a stream
    const fileStream = fs.createReadStream(pdfPath);
    fileStream.pipe(res);

  } catch (error) {
    console.error('Download certificate error:', error);
    res.status(500).json({
      error: 'Failed to download certificate',
      message: 'An error occurred while downloading the certificate'
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

module.exports = { router, generateCertificatePDF };
