const { query } = require('./connection');
const bcrypt = require('bcryptjs');
const { v4: uuidv4 } = require('uuid');

const seedDatabase = async () => {
  try {
    console.log('🌱 Starting database seeding...');

    // Create admin user
    const adminPassword = await bcrypt.hash('admin123', 12);
    const adminResult = await query(`
      INSERT INTO users (email, password_hash, first_name, last_name, role)
      VALUES ($1, $2, $3, $4, $5)
      ON CONFLICT (email) DO NOTHING
      RETURNING id
    `, ['admin@nanolms.com', adminPassword, 'Admin', 'User', 'admin']);

    // Create trainer user
    const trainerPassword = await bcrypt.hash('trainer123', 12);
    const trainerResult = await query(`
      INSERT INTO users (email, password_hash, first_name, last_name, role)
      VALUES ($1, $2, $3, $4, $5)
      ON CONFLICT (email) DO NOTHING
      RETURNING id
    `, ['trainer@nanolms.com', trainerPassword, 'John', 'Trainer', 'trainer']);

    // Create sample learner
    const learnerPassword = await bcrypt.hash('learner123', 12);
    const learnerResult = await query(`
      INSERT INTO users (email, password_hash, first_name, last_name, role)
      VALUES ($1, $2, $3, $4, $5)
      ON CONFLICT (email) DO NOTHING
      RETURNING id
    `, ['learner@nanolms.com', learnerPassword, 'Jane', 'Learner', 'learner']);

    // Get trainer ID for course creation
    const trainerId = trainerResult.rows[0]?.id || 2;

    // Create sample courses
    const course1Result = await query(`
      INSERT INTO courses (title, description, instructor_id, category, difficulty_level, duration_minutes, is_published)
      VALUES ($1, $2, $3, $4, $5, $6, $7)
      RETURNING id
    `, [
      'Introduction to Web Development',
      'Learn the fundamentals of web development including HTML, CSS, and JavaScript. Perfect for beginners who want to start their journey in web development.',
      trainerId,
      'Programming',
      'beginner',
      180,
      true
    ]);

    const course2Result = await query(`
      INSERT INTO courses (title, description, instructor_id, category, difficulty_level, duration_minutes, is_published)
      VALUES ($1, $2, $3, $4, $5, $6, $7)
      RETURNING id
    `, [
      'Advanced React Development',
      'Master React with hooks, context, and advanced patterns. Build real-world applications with modern React practices.',
      trainerId,
      'Programming',
      'intermediate',
      240,
      true
    ]);

    const course3Result = await query(`
      INSERT INTO courses (title, description, instructor_id, category, difficulty_level, duration_minutes, is_published)
      VALUES ($1, $2, $3, $4, $5, $6, $7)
      RETURNING id
    `, [
      'Digital Marketing Fundamentals',
      'Learn the basics of digital marketing including SEO, social media marketing, and content strategy.',
      trainerId,
      'Marketing',
      'beginner',
      120,
      true
    ]);

    // Create lessons for the first course
    const course1Id = course1Result.rows[0]?.id || 1;
    
    await query(`
      INSERT INTO lessons (course_id, title, description, content, duration_minutes, order_index, is_published)
      VALUES ($1, $2, $3, $4, $5, $6, $7)
    `, [
      course1Id,
      'HTML Basics',
      'Learn the fundamentals of HTML markup',
      'HTML (HyperText Markup Language) is the standard markup language for creating web pages. In this lesson, you will learn about HTML elements, tags, and basic structure.',
      30,
      1,
      true
    ]);

    await query(`
      INSERT INTO lessons (course_id, title, description, content, duration_minutes, order_index, is_published)
      VALUES ($1, $2, $3, $4, $5, $6, $7)
    `, [
      course1Id,
      'CSS Styling',
      'Style your HTML with CSS',
      'CSS (Cascading Style Sheets) is used to style and layout web pages. Learn about selectors, properties, and the box model.',
      45,
      2,
      true
    ]);

    await query(`
      INSERT INTO lessons (course_id, title, description, content, duration_minutes, order_index, is_published)
      VALUES ($1, $2, $3, $4, $5, $6, $7)
    `, [
      course1Id,
      'JavaScript Fundamentals',
      'Add interactivity with JavaScript',
      'JavaScript is a programming language that adds interactivity to web pages. Learn about variables, functions, and DOM manipulation.',
      60,
      3,
      true
    ]);

    // Create lessons for the second course
    const course2Id = course2Result.rows[0]?.id || 2;
    
    await query(`
      INSERT INTO lessons (course_id, title, description, content, duration_minutes, order_index, is_published)
      VALUES ($1, $2, $3, $4, $5, $6, $7)
    `, [
      course2Id,
      'React Hooks Deep Dive',
      'Master React hooks for state management',
      'React hooks revolutionized how we write React components. Learn about useState, useEffect, useContext, and custom hooks.',
      90,
      1,
      true
    ]);

    await query(`
      INSERT INTO lessons (course_id, title, description, content, duration_minutes, order_index, is_published)
      VALUES ($1, $2, $3, $4, $5, $6, $7)
    `, [
      course2Id,
      'Advanced State Management',
      'Manage complex state with Context and Reducers',
      'Learn advanced state management patterns including Context API, useReducer, and state machines.',
      90,
      2,
      true
    ]);

    // Create a sample quiz for the first lesson
    const lesson1Result = await query(`
      SELECT id FROM lessons WHERE course_id = $1 AND order_index = 1 LIMIT 1
    `, [course1Id]);

    if (lesson1Result.rows.length > 0) {
      const lesson1Id = lesson1Result.rows[0].id;
      
      const quizResult = await query(`
        INSERT INTO quizzes (lesson_id, title, description, time_limit_minutes, passing_score)
        VALUES ($1, $2, $3, $4, $5)
        RETURNING id
      `, [lesson1Id, 'HTML Basics Quiz', 'Test your knowledge of HTML fundamentals', 15, 70]);

      const quizId = quizResult.rows[0].id;

      // Add quiz questions
      await query(`
        INSERT INTO quiz_questions (quiz_id, question, question_type, options, correct_answer, points, order_index)
        VALUES ($1, $2, $3, $4, $5, $6, $7)
      `, [
        quizId,
        'What does HTML stand for?',
        'multiple_choice',
        JSON.stringify(['HyperText Markup Language', 'High Tech Modern Language', 'Home Tool Markup Language', 'Hyperlink and Text Markup Language']),
        'HyperText Markup Language',
        1,
        1
      ]);

      await query(`
        INSERT INTO quiz_questions (quiz_id, question, question_type, options, correct_answer, points, order_index)
        VALUES ($1, $2, $3, $4, $5, $6, $7)
      `, [
        quizId,
        'Which HTML tag is used to define a paragraph?',
        'multiple_choice',
        JSON.stringify(['<p>', '<paragraph>', '<text>', '<para>']),
        '<p>',
        1,
        2
      ]);

      await query(`
        INSERT INTO quiz_questions (quiz_id, question, question_type, options, correct_answer, points, order_index)
        VALUES ($1, $2, $3, $4, $5, $6, $7)
      `, [
        quizId,
        'What is the correct HTML element for inserting a line break?',
        'multiple_choice',
        JSON.stringify(['<break>', '<lb>', '<br>', '<linebreak>']),
        '<br>',
        1,
        3
      ]);
    }

    console.log('✅ Database seeding completed successfully!');
    console.log('👤 Default users created:');
    console.log('   - Admin: admin@nanolms.com / admin123');
    console.log('   - Trainer: trainer@nanolms.com / trainer123');
    console.log('   - Learner: learner@nanolms.com / learner123');
    console.log('📚 Sample courses and lessons created');

  } catch (error) {
    console.error('❌ Database seeding failed:', error);
    throw error;
  }
};

// Run seeding if this file is executed directly
if (require.main === module) {
  seedDatabase()
    .then(() => {
      console.log('🎉 Database seeding complete!');
      process.exit(0);
    })
    .catch((error) => {
      console.error('💥 Database seeding failed:', error);
      process.exit(1);
    });
}

module.exports = { seedDatabase };
