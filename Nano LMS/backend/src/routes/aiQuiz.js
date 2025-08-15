const express = require('express');
const { body, validationResult } = require('express-validator');
const { query } = require('../database/connection');
const { requireTrainer, authenticateToken } = require('../middleware/auth');
const axios = require('axios');
const fs = require('fs').promises;
const path = require('path');

const router = express.Router();

// OpenRouter configuration
const OPENROUTER_API_KEY = process.env.OPENROUTER_API_KEY || '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';
const OPENROUTER_BASE_URL = 'https://openrouter.ai/api/v1';

// Validation middleware for AI quiz generation
const validateAIQuizRequest = [
  body('course_id').optional().isInt({ min: 1 }).withMessage('Course ID must be a positive integer'),
  body('content').optional().isString().withMessage('Content must be a string'),
  body('numQuestions').isInt({ min: 1, max: 20 }).withMessage('Number of questions must be between 1 and 20'),
  body('generationType').isIn(['text', 'course']).withMessage('Generation type must be either "text" or "course"')
];

// Function to generate quiz questions using OpenRouter
async function generateQuizQuestions(content, numQuestions) {
  try {
    const prompt = `Generate ${numQuestions} high-quality multiple choice quiz questions based on the following content. 
    
    Content: ${content}
    
    IMPORTANT GUIDELINES:
    1. Focus on testing CONCEPTUAL UNDERSTANDING and KNOWLEDGE, not technical details
    2. DO NOT create questions about URLs, file names, or technical metadata
    3. DO NOT ask "which lesson contains X URL" or similar technical questions
    4. Focus on the actual educational content, concepts, and learning objectives
    5. Questions should test comprehension, application, and critical thinking
    6. Avoid questions that require external lookups or reference to specific URLs/files
    7. Make questions engaging and relevant to the learning material
    
    For each question, provide:
    1. A clear, concept-focused question
    2. 4 plausible answer options (A, B, C, D)
    3. The correct answer (A, B, C, or D)
    4. A brief explanation of why the answer is correct
    
    Format the response as a JSON array with this structure:
    [
      {
        "question": "Question text here?",
        "options": {
          "A": "Option A",
          "B": "Option B", 
          "C": "Option C",
          "D": "Option D"
        },
        "correctAnswer": "A",
        "explanation": "Explanation of why this answer is correct"
      }
    ]
    
    Focus on creating questions that test understanding of key concepts, principles, and practical applications from the content.`;

    const response = await axios.post(`${OPENROUTER_BASE_URL}/chat/completions`, {
      model: 'openai/gpt-3.5-turbo', // Using GPT-3.5-turbo as it's more reliable for structured output
      messages: [
        {
          role: 'system',
          content: 'You are an expert educational quiz generator. Your job is to create meaningful, concept-focused questions that test understanding of educational content. NEVER create questions about URLs, file names, technical metadata, or external references. Focus on testing knowledge, comprehension, and application of concepts. Always respond with valid JSON.'
        },
        {
          role: 'user',
          content: prompt
        }
      ],
      temperature: 0.7,
      max_tokens: 2000
    }, {
      headers: {
        'Authorization': `Bearer ${OPENROUTER_API_KEY}`,
        'Content-Type': 'application/json',
        'HTTP-Referer': 'http://localhost:6001',
        'X-Title': 'Nano LMS AI Quiz Generator'
      }
    });

    const generatedContent = response.data.choices[0].message.content;
    
    // Try to parse the JSON response
    try {
      const questions = JSON.parse(generatedContent);
      return questions;
    } catch (parseError) {
      console.error('Failed to parse AI response as JSON:', parseError);
      console.log('Raw AI response:', generatedContent);
      
      // Fallback: try to extract JSON from the response
      const jsonMatch = generatedContent.match(/\[[\s\S]*\]/);
      if (jsonMatch) {
        try {
          return JSON.parse(jsonMatch[0]);
        } catch (e) {
          throw new Error('Failed to parse AI response');
        }
      }
      
      throw new Error('AI response is not in valid JSON format');
    }
  } catch (error) {
    console.error('Error generating quiz questions:', error);
    throw new Error(`Failed to generate quiz questions: ${error.message}`);
  }
}

// Function to extract content from course materials
async function extractCourseContent(courseId) {
  try {
    // Get course details
    const courseResult = await query(
      `SELECT title, description FROM courses WHERE id = $1`,
      [courseId]
    );

    if (courseResult.rows.length === 0) {
      throw new Error('Course not found');
    }

    const course = courseResult.rows[0];
    let content = `Course Title: ${course.title}\nCourse Description: ${course.description}\n\n`;

    // Get lessons content
    const lessonsResult = await query(
      `SELECT title, content, video_url, document_url FROM lessons WHERE course_id = $1 AND is_published = true ORDER BY order_index`,
      [courseId]
    );

    for (const lesson of lessonsResult.rows) {
      content += `Lesson: ${lesson.title}\n`;
      if (lesson.content) {
        // Clean the content by removing URLs and focusing on educational content
        let cleanContent = lesson.content;
        // Remove URLs from content
        cleanContent = cleanContent.replace(/https?:\/\/[^\s]+/g, '');
        // Remove file extensions and technical references
        cleanContent = cleanContent.replace(/\.[a-zA-Z0-9]{2,4}/g, '');
        content += `Content: ${cleanContent}\n`;
      }
      // Only include video/document info if there's meaningful content, not just URLs
      if (lesson.video_url && lesson.content && lesson.content.length > 50) {
        content += `(This lesson includes video content)\n`;
      }
      if (lesson.document_url && lesson.content && lesson.content.length > 50) {
        content += `(This lesson includes document content)\n`;
      }
      content += '\n';
    }

    return content;
  } catch (error) {
    console.error('Error extracting course content:', error);
    throw new Error(`Failed to extract course content: ${error.message}`);
  }
}

// POST /api/ai-quiz/generate - Generate quiz questions
router.post('/generate', authenticateToken, requireTrainer, validateAIQuizRequest, async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({
        error: 'Validation failed',
        details: errors.array()
      });
    }

    const { course_id, content, numQuestions, generationType } = req.body;

    let quizContent = '';

    if (generationType === 'text') {
      if (!content || content.trim().length === 0) {
        return res.status(400).json({
          error: 'Content is required for text-based quiz generation'
        });
      }
      quizContent = content;
    } else if (generationType === 'course') {
      if (!course_id) {
        return res.status(400).json({
          error: 'Course ID is required for course-based quiz generation'
        });
      }
      quizContent = await extractCourseContent(course_id);
    }

    if (quizContent.trim().length === 0) {
      return res.status(400).json({
        error: 'No content available for quiz generation'
      });
    }

    // Generate quiz questions
    const questions = await generateQuizQuestions(quizContent, numQuestions);

    res.json({
      success: true,
      questions,
      contentLength: quizContent.length,
      generationType
    });

  } catch (error) {
    console.error('AI Quiz generation error:', error);
    res.status(500).json({
      error: 'Failed to generate quiz questions',
      message: error.message
    });
  }
});

// GET /api/ai-quiz/course/:courseId/content - Get course content for preview
router.get('/course/:courseId/content', authenticateToken, requireTrainer, async (req, res) => {
  try {
    const { courseId } = req.params;

    const content = await extractCourseContent(courseId);

    res.json({
      success: true,
      content,
      contentLength: content.length
    });

  } catch (error) {
    console.error('Error getting course content:', error);
    res.status(500).json({
      error: 'Failed to get course content',
      message: error.message
    });
  }
});

module.exports = router;
