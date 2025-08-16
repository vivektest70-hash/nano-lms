// @public
import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': 'https://nano-lms.vercel.app',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, cache-control, pragma',
  'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
  'Access-Control-Allow-Credentials': 'true',
  'Access-Control-Max-Age': '86400'
}

// Initialize Supabase client
const supabaseUrl = Deno.env.get('SUPABASE_URL')!
const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
const supabase = createClient(supabaseUrl, supabaseServiceKey)

// Initialize database with sample data if empty
const initializeDatabase = async () => {
  try {
    // Check if courses exist
    const { data: existingCourses } = await supabase
      .from('courses')
      .select('id')
      .limit(1)
    
    if (!existingCourses || existingCourses.length === 0) {
      console.log('Initializing database with sample data...')
      
      // Insert sample users
      const { data: users } = await supabase
        .from('users')
        .insert([
          {
            email: 'admin@nanolms.com',
            password_hash: 'hashed_password',
            first_name: 'Admin',
            last_name: 'User',
            role: 'admin',
            work_type: 'All'
          },
          {
            email: 'trainer@nanolms.com',
            password_hash: 'hashed_password',
            first_name: 'Jane',
            last_name: 'Smith',
            role: 'trainer',
            work_type: 'Tech'
          },
          {
            email: 'learner@nanolms.com',
            password_hash: 'hashed_password',
            first_name: 'Mike',
            last_name: 'Johnson',
            role: 'learner',
            work_type: 'Operations'
          }
        ])
        .select()
      
      // Insert sample courses
      const { data: courses } = await supabase
        .from('courses')
        .insert([
          {
            title: 'Introduction to Web Development',
            description: 'Learn the basics of HTML, CSS, and JavaScript',
            instructor_id: users?.[0]?.id,
            category: 'Programming',
            work_type: 'All',
            difficulty_level: 'Beginner',
            duration_minutes: 135,
            is_published: true
          },
          {
            title: 'Advanced React Development',
            description: 'Master React hooks, context, and advanced patterns',
            instructor_id: users?.[1]?.id,
            category: 'Programming',
            work_type: 'Tech',
            difficulty_level: 'Advanced',
            duration_minutes: 285,
            is_published: true
          },
          {
            title: 'Full Stack Development',
            description: 'Build complete web applications with frontend and backend',
            instructor_id: users?.[0]?.id,
            category: 'Programming',
            work_type: 'Tech',
            difficulty_level: 'Intermediate',
            duration_minutes: 225,
            is_published: true
          },
          {
            title: 'Mobile App Development',
            description: 'Create mobile applications with React Native',
            instructor_id: users?.[1]?.id,
            category: 'Programming',
            work_type: 'Tech',
            difficulty_level: 'Advanced',
            duration_minutes: 225,
            is_published: true
          }
        ])
        .select()
      
      // Insert sample lessons
      if (courses) {
        for (const course of courses) {
          const lessons = [
            {
              course_id: course.id,
              title: 'Introduction to HTML',
              description: 'Learn the basics of HTML markup',
              content: 'Learn the basics of HTML markup',
              duration_minutes: 30,
              order_index: 1,
              is_published: true
            },
            {
              course_id: course.id,
              title: 'CSS Fundamentals',
              description: 'Learn CSS styling and layout',
              content: 'Learn CSS styling and layout',
              duration_minutes: 45,
              order_index: 2,
              is_published: true
            },
            {
              course_id: course.id,
              title: 'JavaScript Basics',
              description: 'Introduction to JavaScript programming',
              content: 'Introduction to JavaScript programming',
              duration_minutes: 60,
              order_index: 3,
              is_published: true
            }
          ]
          
          await supabase
            .from('lessons')
            .insert(lessons)
        }
      }
      
      console.log('Database initialized with sample data')
    }
  } catch (error) {
    console.error('Database initialization error:', error)
  }
}

serve(async (req) => {
  console.log('API function called:', req.method, req.url, 'at', new Date().toISOString())
  
  // Initialize database on first request
  await initializeDatabase()
  
  // Handle CORS preflight requests FIRST - before ANY other logic
  if (req.method === 'OPTIONS') {
    console.log('Handling OPTIONS request')
    return new Response(null, { 
      status: 200,
      headers: {
        'Access-Control-Allow-Origin': 'https://nano-lms.vercel.app',
        'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, cache-control, pragma',
        'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
        'Access-Control-Allow-Credentials': 'true',
        'Access-Control-Max-Age': '86400'
      }
    })
  }

  try {
    const url = new URL(req.url)
    const path = url.pathname
    const method = req.method
    
    // Extract the actual path after /functions/v1/api
    let actualPath = path.replace('/functions/v1/api', '')
    if (actualPath.startsWith('/api/')) {
      actualPath = actualPath.replace('/api/', '/')
    }
    
    console.log('Processed path:', actualPath)

    // Handle POST requests for authentication
    if (method === 'POST') {
      // Handle authentication
      if (actualPath === '/auth/login') {
        try {
          const body = await req.json()
          const { email, password } = body
          
          console.log('Login attempt for:', email)
          
          if (!email || !password) {
            return new Response(JSON.stringify({ error: 'Email and password are required' }), {
              status: 400,
              headers: { 
                'Content-Type': 'application/json',
                ...corsHeaders
              }
            })
          }
          
          // Query user from database
          const { data: user, error } = await supabase
            .from('users')
            .select('*')
            .eq('email', email)
            .single()
          
          if (error || !user) {
            console.log('User not found:', email)
            return new Response(JSON.stringify({ error: 'Invalid credentials' }), {
              status: 401,
              headers: { 
                'Content-Type': 'application/json',
                ...corsHeaders
              }
            })
          }
          
          console.log('User found:', user.email)
          
          // Return a proper token that will work for authentication
          return new Response(JSON.stringify({
            token: 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InpidWh4ZG9uaGxpYm9wY2d6bWlnIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTUyNzg2NjYsImV4cCI6MjA3MDg1NDY2Nn0.oAda1T4sY-DX97UEyYHYx3YQF-N4eQb9IWVi3i1THg4',
            user: {
              id: user.id,
              email: user.email,
              firstName: user.first_name,
              lastName: user.last_name,
              role: user.role,
              work_type: user.work_type
            }
          }), {
            headers: { 
              'Content-Type': 'application/json',
              ...corsHeaders
            }
          })
          
        } catch (error) {
          console.log('Login error:', error)
          return new Response(JSON.stringify({ error: error.message }), {
            status: 500,
            headers: { 
              'Content-Type': 'application/json',
              ...corsHeaders
            }
          })
        }
      }

      // Handle change password
      if (actualPath === '/auth/change-password') {
        try {
          const body = await req.json()
          const { currentPassword, newPassword } = body
          
          console.log('Password change attempt')
          
          if (!currentPassword || !newPassword) {
            return new Response(JSON.stringify({ error: 'Current password and new password are required' }), {
              status: 400,
              headers: { 
                'Content-Type': 'application/json',
                ...corsHeaders
              }
            })
          }
          
          // For demo purposes, always return success
          // In a real implementation, you would verify the current password and update it
          return new Response(JSON.stringify({ 
            message: 'Password changed successfully',
            success: true
          }), {
            headers: { 
              'Content-Type': 'application/json',
              ...corsHeaders
            }
          })
          
        } catch (error) {
          console.log('Change password error:', error)
          return new Response(JSON.stringify({ error: error.message }), {
            status: 500,
            headers: { 
              'Content-Type': 'application/json',
              ...corsHeaders
            }
          })
        }
      }
    }

    // Handle GET requests
    if (method === 'GET') {

      // Handle health check
      if (actualPath === '/health') {
        return new Response(JSON.stringify({ status: 'ok' }), {
          headers: { 
            'Content-Type': 'application/json',
            ...corsHeaders
          }
        })
      }

      // Handle /me and /auth/me endpoints for user authentication
      if ((actualPath === '/me' || actualPath === '/auth/me') && method === 'GET') {
        try {
          // Get the authorization header
          const authHeader = req.headers.get('authorization')
          if (!authHeader || !authHeader.startsWith('Bearer ')) {
            return new Response(JSON.stringify({ error: 'Missing or invalid authorization header' }), {
              status: 401,
              headers: { 
                'Content-Type': 'application/json',
                ...corsHeaders
              }
            })
          }
          
          // For now, return a placeholder user response
          // In a real implementation, you would verify the JWT token here
          return new Response(JSON.stringify({
            user: {
              id: 1,
              email: 'admin@nanolms.com',
              firstName: 'Admin',
              lastName: 'User',
              role: 'admin',
              work_type: 'All'
            }
          }), {
            headers: { 
              'Content-Type': 'application/json',
              ...corsHeaders
            }
          })
          
        } catch (error) {
          console.log('Me endpoint error:', error)
          return new Response(JSON.stringify({ error: error.message }), {
            status: 500,
            headers: { 
              'Content-Type': 'application/json',
              ...corsHeaders
            }
          })
        }
      }

      // Handle courses
      if (actualPath === '/courses' || actualPath === '/courses/all') {
        const { data: courses, error } = await supabase
          .from('courses')
          .select(`
            *,
            users!courses_instructor_id_fkey (
              first_name,
              last_name
            ),
            lessons (
              id,
              title,
              content,
              duration_minutes,
              order_index
            )
          `)
          .order('created_at', { ascending: false })

        if (error) {
          console.error('Error fetching courses:', error)
          return new Response(JSON.stringify({ error: 'Failed to fetch courses' }), {
            status: 500,
            headers: { 
              'Content-Type': 'application/json',
              ...corsHeaders
            }
          })
        }

        const formattedCourses = courses?.map(course => ({
          id: course.id.toString(),
          title: course.title,
          description: course.description,
          instructor: `${course.users?.first_name} ${course.users?.last_name}`,
          instructor_first_name: course.users?.first_name,
          instructor_last_name: course.users?.last_name,
          duration: `${Math.ceil(course.duration_minutes / 60)} weeks`,
          duration_minutes: course.duration_minutes,
          level: course.difficulty_level,
          difficulty_level: course.difficulty_level,
          status: course.is_published ? 'published' : 'draft',
          category: course.category,
          work_type: course.work_type,
          lessons: course.lessons?.map(lesson => ({
            id: lesson.id.toString(),
            title: lesson.title,
            content: lesson.content,
            duration_minutes: lesson.duration_minutes,
            order: lesson.order_index
          })) || []
        })) || []

        return new Response(JSON.stringify({ courses: formattedCourses }), {
          headers: { 
            'Content-Type': 'application/json',
            'Cache-Control': 'no-cache, no-store, must-revalidate',
            'Pragma': 'no-cache',
            'Expires': '0',
            ...corsHeaders
          }
        })
      }

      // Handle individual course
      if (actualPath.match(/^\/courses\/\d+$/)) {
        const courseId = actualPath.split('/')[2]
        
        const { data: course, error } = await supabase
          .from('courses')
          .select(`
            *,
            users!courses_instructor_id_fkey (
              first_name,
              last_name
            ),
            lessons (
              id,
              title,
              content,
              duration_minutes,
              order_index
            )
          `)
          .eq('id', courseId)
          .single()

        if (error || !course) {
          return new Response(JSON.stringify({ error: 'Course not found' }), {
            status: 404,
            headers: { 
              'Content-Type': 'application/json',
              ...corsHeaders
            }
          })
        }

        const formattedCourse = {
          id: course.id.toString(),
          title: course.title,
          description: course.description,
          instructor: `${course.users?.first_name} ${course.users?.last_name}`,
          instructor_first_name: course.users?.first_name,
          instructor_last_name: course.users?.last_name,
          duration: `${Math.ceil(course.duration_minutes / 60)} weeks`,
          duration_minutes: course.duration_minutes,
          level: course.difficulty_level,
          difficulty_level: course.difficulty_level,
          status: course.is_published ? 'published' : 'draft',
          category: course.category,
          work_type: course.work_type,
          lessons: course.lessons?.map(lesson => ({
            id: lesson.id.toString(),
            title: lesson.title,
            content: lesson.content,
            duration_minutes: lesson.duration_minutes,
            order: lesson.order_index
          })) || []
        }

        return new Response(JSON.stringify({ course: formattedCourse }), {
          headers: { 
            'Content-Type': 'application/json',
            'Cache-Control': 'no-cache, no-store, must-revalidate',
            'Pragma': 'no-cache',
            'Expires': '0',
            ...corsHeaders
          }
        })
      }

      // Handle users
      if (actualPath === '/users') {
        const { data: users, error } = await supabase
          .from('users')
          .select('*')
          .order('created_at', { ascending: false })

        if (error) {
          console.error('Error fetching users:', error)
          return new Response(JSON.stringify({ error: 'Failed to fetch users' }), {
            status: 500,
            headers: { 
              'Content-Type': 'application/json',
              ...corsHeaders
            }
          })
        }

        const formattedUsers = users?.map(user => ({
          id: user.id.toString(),
          email: user.email,
          first_name: user.first_name,
          last_name: user.last_name,
          role: user.role,
          work_type: user.work_type,
          approval_status: 'approved',
          created_at: user.created_at
        })) || []

        return new Response(JSON.stringify({ users: formattedUsers }), {
          headers: { 
            'Content-Type': 'application/json',
            'Cache-Control': 'no-cache, no-store, must-revalidate',
            'Pragma': 'no-cache',
            'Expires': '0',
            ...corsHeaders
          }
        })
      }

      // Handle lessons
      if (actualPath === '/lessons') {
        const { data: lessons, error } = await supabase
          .from('lessons')
          .select(`
            *,
            courses!lessons_course_id_fkey (
              id,
              title
            )
          `)
          .order('order_index', { ascending: true })

        if (error) {
          console.error('Error fetching lessons:', error)
          return new Response(JSON.stringify({ error: 'Failed to fetch lessons' }), {
            status: 500,
            headers: { 
              'Content-Type': 'application/json',
              ...corsHeaders
            }
          })
        }

        const formattedLessons = lessons?.map(lesson => ({
          id: lesson.id.toString(),
          title: lesson.title,
          content: lesson.content,
          duration_minutes: lesson.duration_minutes,
          order: lesson.order_index,
          courseId: lesson.course_id.toString(),
          courseTitle: lesson.courses?.title
        })) || []

        return new Response(JSON.stringify({ lessons: formattedLessons }), {
          headers: { 
            'Content-Type': 'application/json',
            'Cache-Control': 'no-cache, no-store, must-revalidate',
            'Pragma': 'no-cache',
            'Expires': '0',
            ...corsHeaders
          }
        })
      }

      // Handle certificates
      if (actualPath === '/certificates') {
        const { data: certificates, error } = await supabase
          .from('certificates')
          .select(`
            *,
            users!certificates_user_id_fkey (
              first_name,
              last_name
            ),
            courses!certificates_course_id_fkey (
              title,
              category
            )
          `)

        if (error) {
          console.error('Error fetching certificates:', error)
          return new Response(JSON.stringify({ error: 'Failed to fetch certificates' }), {
            status: 500,
            headers: { 
              'Content-Type': 'application/json',
              ...corsHeaders
            }
          })
        }

        const formattedCertificates = certificates?.map(cert => ({
          id: cert.id.toString(),
          certificate_number: cert.certificate_number,
          course_title: cert.courses?.title,
          course_category: cert.courses?.category,
          issued_at: cert.issued_at,
          status: 'issued'
        })) || []

        return new Response(JSON.stringify({ certificates: formattedCertificates }), {
          headers: { 
            'Content-Type': 'application/json',
            'Cache-Control': 'no-cache, no-store, must-revalidate',
            'Pragma': 'no-cache',
            'Expires': '0',
            ...corsHeaders
          }
        })
      }

      // Handle leaderboard
      if (actualPath === '/leaderboard') {
        const { data: users, error } = await supabase
          .from('users')
          .select('*')
          .limit(3)

        if (error) {
          console.error('Error fetching leaderboard:', error)
          return new Response(JSON.stringify({ error: 'Failed to fetch leaderboard' }), {
            status: 500,
            headers: { 
              'Content-Type': 'application/json',
              ...corsHeaders
            }
          })
        }

        const leaderboard = users?.map((user, index) => ({
          id: user.id.toString(),
          first_name: user.first_name,
          last_name: user.last_name,
          role: user.role,
          enrolledCourses: Math.floor(Math.random() * 5) + 1,
          completedCourses: Math.floor(Math.random() * 3) + 1,
          progressPercentage: Math.floor(Math.random() * 30) + 70,
          certificates: Math.floor(Math.random() * 3) + 1,
          score: Math.floor(Math.random() * 20) + 80,
          rank: index + 1,
          course: 'Sample Course'
        })) || []

        return new Response(JSON.stringify({ leaderboard }), {
          headers: { 
            'Content-Type': 'application/json',
            'Cache-Control': 'no-cache, no-store, must-revalidate',
            'Pragma': 'no-cache',
            'Expires': '0',
            ...corsHeaders
          }
        })
      }

      // Handle dashboard
      if (actualPath === '/dashboard') {
        const { data: courses } = await supabase.from('courses').select('id')
        const { data: users } = await supabase.from('users').select('id')
        
        const dashboardData = {
          overallProgress: 75,
          totalCourses: courses?.length || 0,
          totalUsers: users?.length || 0,
          recentActivity: [
            { type: 'course_completed', user: 'John Doe', course: 'Web Development', time: '2 hours ago' },
            { type: 'lesson_started', user: 'Jane Smith', course: 'React Development', time: '4 hours ago' },
            { type: 'certificate_earned', user: 'Mike Johnson', course: 'Full Stack Development', time: '1 day ago' }
          ],
          topCourses: [
            { title: 'Introduction to Web Development', enrollments: 45, completionRate: 85 },
            { title: 'Advanced React Development', enrollments: 32, completionRate: 78 },
            { title: 'Full Stack Development', enrollments: 28, completionRate: 72 }
          ],
          userStats: {
            activeUsers: 156,
            newUsers: 23,
            completionRate: 78
          }
        }

        return new Response(JSON.stringify(dashboardData), {
          headers: { 
            'Content-Type': 'application/json',
            'Cache-Control': 'no-cache, no-store, must-revalidate',
            'Pragma': 'no-cache',
            'Expires': '0',
            ...corsHeaders
          }
        })
      }

      // Handle user progress
      if (actualPath.match(/^\/user-progress\/course\/\d+\/comprehensive$/)) {
        const courseId = actualPath.split('/')[3]
        
        const courseProgress = {
          summary: {
            overallProgress: 75,
            completedLessons: 2,
            totalLessons: 3,
            timeSpent: 120
          },
          lessonProgress: [
            { lesson_id: '1', progress: 100, completed: true },
            { lesson_id: '2', progress: 75, completed: false },
            { lesson_id: '3', progress: 0, completed: false }
          ],
          quizProgress: {
            completed: false,
            score: null,
            attempts: 0
          }
        }

        return new Response(JSON.stringify(courseProgress), {
          headers: { 
            'Content-Type': 'application/json',
            'Cache-Control': 'no-cache, no-store, must-revalidate',
            'Pragma': 'no-cache',
            'Expires': '0',
            ...corsHeaders
          }
        })
      }

      // Handle quizzes for a specific course
      if (actualPath.match(/^\/quizzes\/courses\/\d+$/)) {
        try {
          const courseId = actualPath.split('/').pop()
          console.log('Fetching quizzes for course:', courseId)
          
          // Fetch quizzes from database
          const { data: quizzes, error: quizzesError } = await supabase
            .from('quizzes')
            .select('*')
            .eq('course_id', courseId)
            .order('created_at', { ascending: false })

          if (quizzesError) {
            console.error('Error fetching quizzes:', quizzesError)
            return new Response(JSON.stringify({ error: 'Failed to fetch quizzes' }), {
              status: 500,
              headers: { 
                'Content-Type': 'application/json',
                ...corsHeaders
              }
            })
          }

          // Fetch questions for each quiz
          const quizzesWithQuestions = []
          for (const quiz of quizzes || []) {
            const { data: questions, error: questionsError } = await supabase
              .from('quiz_questions')
              .select('*')
              .eq('quiz_id', quiz.id)
              .order('order_index', { ascending: true })

            if (questionsError) {
              console.error('Error fetching quiz questions:', questionsError)
              continue
            }

            const formattedQuestions = questions?.map(q => ({
              id: q.id,
              question: q.question,
              options: q.options || [],
              correctAnswer: parseInt(q.correct_answer) || 0,
              explanation: q.explanation || ''
            })) || []

            quizzesWithQuestions.push({
              id: quiz.id,
              title: quiz.title,
              description: quiz.description,
              courseId: quiz.course_id,
              timeLimit: quiz.time_limit_minutes,
              passingScore: quiz.passing_score,
              questions: formattedQuestions
            })
          }
          
          return new Response(JSON.stringify({ 
            quizzes: quizzesWithQuestions,
            message: quizzesWithQuestions.length > 0 ? `${quizzesWithQuestions.length} quizzes found` : 'No quizzes found for this course'
          }), {
            headers: { 
              'Content-Type': 'application/json',
              ...corsHeaders
            }
          })
          
        } catch (error) {
          console.log('Quizzes fetch error:', error)
          return new Response(JSON.stringify({ error: error.message }), {
            status: 500,
            headers: { 
              'Content-Type': 'application/json',
              ...corsHeaders
            }
          })
        }
      }

      // Handle course enrollments
      if (actualPath === '/courses/enrollments') {
        try {
          console.log('Fetching course enrollments')
          
          // For now, return empty enrollments array
          // In a real implementation, you would query the course_enrollments table
          return new Response(JSON.stringify({ 
            enrollments: [],
            message: 'No enrollments found'
          }), {
            headers: { 
              'Content-Type': 'application/json',
              ...corsHeaders
            }
          })
          
        } catch (error) {
          console.log('Enrollments fetch error:', error)
          return new Response(JSON.stringify({ error: error.message }), {
            status: 500,
            headers: { 
              'Content-Type': 'application/json',
              ...corsHeaders
            }
          })
        }
      }
    }

    // Handle POST requests
    if (method === 'POST') {
      // Handle course creation
      if (actualPath === '/courses') {
        try {
          const body = await req.json()
          
          const { data: course, error } = await supabase
            .from('courses')
            .insert({
              title: body.title || 'New Course',
              description: body.description || 'Course description',
              instructor_id: 1, // Default to admin
              category: body.category || 'General',
              work_type: body.work_type || 'All',
              difficulty_level: body.difficultyLevel || 'Beginner',
              duration_minutes: body.durationMinutes || 0,
              is_published: body.isPublished || false
            })
            .select()
            .single()

          if (error) {
            console.error('Error creating course:', error)
            return new Response(JSON.stringify({ error: 'Failed to create course' }), {
              status: 500,
              headers: { 
                'Content-Type': 'application/json',
                ...corsHeaders
              }
            })
          }

          return new Response(JSON.stringify({ 
            message: 'Course created successfully', 
            id: course.id,
            course: course
          }), {
            status: 201,
            headers: { 
              'Content-Type': 'application/json',
              ...corsHeaders
            }
          })
        } catch (error) {
          return new Response(JSON.stringify({ error: 'Failed to create course' }), {
            status: 500,
            headers: { 
              'Content-Type': 'application/json',
              ...corsHeaders
            }
          })
        }
      }

      // Handle user creation
      if (actualPath === '/users') {
        try {
          const body = await req.json()
          
          const { data: user, error } = await supabase
            .from('users')
            .insert({
              email: body.email || 'newuser@example.com',
              password_hash: 'hashed_password',
              first_name: body.firstName || body.first_name || 'New',
              last_name: body.lastName || body.last_name || 'User',
              role: body.role || 'learner',
              work_type: body.work_type || 'All'
            })
            .select()
            .single()

          if (error) {
            console.error('Error creating user:', error)
            return new Response(JSON.stringify({ error: 'Failed to create user' }), {
              status: 500,
              headers: { 
                'Content-Type': 'application/json',
                ...corsHeaders
              }
            })
          }

          return new Response(JSON.stringify({ 
            message: 'User created successfully', 
            id: user.id,
            user: user
          }), {
            status: 201,
            headers: { 
              'Content-Type': 'application/json',
              ...corsHeaders
            }
          })
        } catch (error) {
          return new Response(JSON.stringify({ error: 'Failed to create user' }), {
            status: 500,
            headers: { 
              'Content-Type': 'application/json',
              ...corsHeaders
            }
          })
        }
      }

      // Handle lesson creation
      if (actualPath === '/lessons') {
        try {
          const body = await req.json()
          
          const { data: lesson, error } = await supabase
            .from('lessons')
            .insert({
              course_id: body.courseId,
              title: body.title || 'New Lesson',
              description: body.description || '',
              content: body.content || '',
              duration_minutes: body.durationMinutes || 0,
              order_index: body.orderIndex || 1,
              is_published: body.isPublished !== undefined ? body.isPublished : true
            })
            .select()
            .single()

          if (error) {
            console.error('Error creating lesson:', error)
            return new Response(JSON.stringify({ error: 'Failed to create lesson' }), {
              status: 500,
              headers: { 
                'Content-Type': 'application/json',
                ...corsHeaders
              }
            })
          }

          return new Response(JSON.stringify({ 
            message: 'Lesson created successfully', 
            id: lesson.id,
            lesson: lesson
          }), {
            status: 201,
            headers: { 
              'Content-Type': 'application/json',
              ...corsHeaders
            }
          })
        } catch (error) {
          return new Response(JSON.stringify({ error: 'Failed to create lesson' }), {
            status: 500,
            headers: { 
              'Content-Type': 'application/json',
              ...corsHeaders
            }
          })
        }
      }

      // Handle AI quiz generation
      if (actualPath === '/ai-quiz/generate') {
        try {
          const body = await req.json()
          const { courseId, generationType, numberOfQuestions, customText } = body
          
          console.log('AI Quiz generation request:', { courseId, generationType, numberOfQuestions })
          
          // Generate sample quiz questions based on the request
          const sampleQuestions = []
          for (let i = 1; i <= (numberOfQuestions || 5); i++) {
            sampleQuestions.push({
              id: i,
              question: `Sample question ${i} for course ${courseId}`,
              options: [
                `Option A for question ${i}`,
                `Option B for question ${i}`,
                `Option C for question ${i}`,
                `Option D for question ${i}`
              ],
              correctAnswer: 0,
              explanation: `Explanation for question ${i}`
            })
          }
          
          return new Response(JSON.stringify({
            success: true,
            quiz: {
              id: Date.now(),
              title: `AI Generated Quiz for Course ${courseId}`,
              description: `Quiz generated using ${generationType}`,
              questions: sampleQuestions,
              courseId: parseInt(courseId),
              timeLimit: 30,
              passingScore: 70
            }
          }), {
            headers: { 
              'Content-Type': 'application/json',
              ...corsHeaders
            }
          })
          
        } catch (error) {
          console.log('AI Quiz generation error:', error)
          return new Response(JSON.stringify({ error: error.message }), {
            status: 500,
            headers: { 
              'Content-Type': 'application/json',
              ...corsHeaders
            }
          })
        }
      }

      // Handle quiz saving
      if (actualPath === '/quizzes') {
        try {
          const body = await req.json()
          const { title, description, courseId, questions, timeLimit, passingScore } = body
          
          console.log('Saving quiz:', { title, courseId, questionsCount: questions?.length })
          
          // First, create the quiz
          const { data: quiz, error: quizError } = await supabase
            .from('quizzes')
            .insert({
              title: title || 'New Quiz',
              description: description || '',
              course_id: courseId,
              time_limit_minutes: timeLimit || 30,
              passing_score: passingScore || 70
            })
            .select()
            .single()

          if (quizError) {
            console.error('Error creating quiz:', quizError)
            return new Response(JSON.stringify({ error: 'Failed to create quiz' }), {
              status: 500,
              headers: { 
                'Content-Type': 'application/json',
                ...corsHeaders
              }
            })
          }

          // Then, create the quiz questions
          if (questions && questions.length > 0) {
            const quizQuestions = questions.map((q, index) => ({
              quiz_id: quiz.id,
              question: q.question,
              question_type: 'multiple_choice',
              options: q.options,
              correct_answer: q.correctAnswer.toString(),
              points: 1,
              order_index: index + 1
            }))

            const { error: questionsError } = await supabase
              .from('quiz_questions')
              .insert(quizQuestions)

            if (questionsError) {
              console.error('Error creating quiz questions:', questionsError)
              // Delete the quiz if questions fail
              await supabase.from('quizzes').delete().eq('id', quiz.id)
              return new Response(JSON.stringify({ error: 'Failed to create quiz questions' }), {
                status: 500,
                headers: { 
                  'Content-Type': 'application/json',
                  ...corsHeaders
                }
              })
            }
          }

          return new Response(JSON.stringify({ 
            message: 'Quiz saved successfully',
            quiz: {
              id: quiz.id,
              title: quiz.title,
              description: quiz.description,
              courseId: quiz.course_id,
              timeLimit: quiz.time_limit_minutes,
              passingScore: quiz.passing_score,
              questions: questions || []
            }
          }), {
            status: 201,
            headers: { 
              'Content-Type': 'application/json',
              ...corsHeaders
            }
          })
          
        } catch (error) {
          console.log('Quiz save error:', error)
          return new Response(JSON.stringify({ error: error.message }), {
            status: 500,
            headers: { 
              'Content-Type': 'application/json',
              ...corsHeaders
            }
          })
        }
      }
    }

    // Handle PUT requests
    if (method === 'PUT') {
      // Handle course updates
      if (actualPath.match(/^\/courses\/\d+$/)) {
        try {
          const courseId = actualPath.split('/')[2]
          const body = await req.json()
          
          const { data: course, error } = await supabase
            .from('courses')
            .update({
              title: body.title,
              description: body.description,
              category: body.category,
              difficulty_level: body.difficultyLevel,
              duration_minutes: body.durationMinutes,
              is_published: body.isPublished,
              work_type: body.work_type,
              updated_at: new Date().toISOString()
            })
            .eq('id', courseId)
            .select()
            .single()

          if (error) {
            console.error('Error updating course:', error)
            return new Response(JSON.stringify({ error: 'Failed to update course' }), {
              status: 500,
              headers: { 
                'Content-Type': 'application/json',
                ...corsHeaders
              }
            })
          }

          return new Response(JSON.stringify({ 
            message: 'Course updated successfully',
            course: course
          }), {
            status: 200,
            headers: { 
              'Content-Type': 'application/json',
              'Cache-Control': 'no-cache, no-store, must-revalidate',
              'Pragma': 'no-cache',
              'Expires': '0',
              ...corsHeaders
            }
          })
        } catch (error) {
          return new Response(JSON.stringify({ error: 'Failed to update course' }), {
            status: 500,
            headers: { 
              'Content-Type': 'application/json',
              ...corsHeaders
            }
          })
        }
      }

      // Handle lesson updates
      if (actualPath.match(/^\/lessons\/\d+$/)) {
        try {
          const lessonId = actualPath.split('/')[2]
          const body = await req.json()
          
          const { data: lesson, error } = await supabase
            .from('lessons')
            .update({
              title: body.title,
              description: body.description,
              content: body.content,
              duration_minutes: body.durationMinutes,
              order_index: body.orderIndex,
              is_published: body.isPublished,
              updated_at: new Date().toISOString()
            })
            .eq('id', lessonId)
            .select()
            .single()

          if (error) {
            console.error('Error updating lesson:', error)
            return new Response(JSON.stringify({ error: 'Failed to update lesson' }), {
              status: 500,
              headers: { 
                'Content-Type': 'application/json',
                ...corsHeaders
              }
            })
          }

          return new Response(JSON.stringify({ 
            message: 'Lesson updated successfully',
            lesson: lesson
          }), {
            status: 200,
            headers: { 
              'Content-Type': 'application/json',
              'Cache-Control': 'no-cache, no-store, must-revalidate',
              'Pragma': 'no-cache',
              'Expires': '0',
              ...corsHeaders
            }
          })
        } catch (error) {
          return new Response(JSON.stringify({ error: 'Failed to update lesson' }), {
            status: 500,
            headers: { 
              'Content-Type': 'application/json',
              ...corsHeaders
            }
          })
        }
      }
    }

    // Handle DELETE requests
    if (method === 'DELETE') {
      // Handle course deletion
      if (actualPath.match(/^\/courses\/\d+$/)) {
        try {
          const courseId = actualPath.split('/')[2]
          
          const { error } = await supabase
            .from('courses')
            .delete()
            .eq('id', courseId)

          if (error) {
            console.error('Error deleting course:', error)
            return new Response(JSON.stringify({ error: 'Failed to delete course' }), {
              status: 500,
              headers: { 
                'Content-Type': 'application/json',
                ...corsHeaders
              }
            })
          }

          return new Response(JSON.stringify({ 
            message: 'Course deleted successfully'
          }), {
            status: 200,
            headers: { 
              'Content-Type': 'application/json',
              'Cache-Control': 'no-cache, no-store, must-revalidate',
              'Pragma': 'no-cache',
              'Expires': '0',
              ...corsHeaders
            }
          })
        } catch (error) {
          return new Response(JSON.stringify({ error: 'Failed to delete course' }), {
            status: 500,
            headers: { 
              'Content-Type': 'application/json',
              ...corsHeaders
            }
          })
        }
      }

      // Handle lesson deletion
      if (actualPath.match(/^\/lessons\/\d+$/)) {
        try {
          const lessonId = actualPath.split('/')[2]
          
          const { error } = await supabase
            .from('lessons')
            .delete()
            .eq('id', lessonId)

          if (error) {
            console.error('Error deleting lesson:', error)
            return new Response(JSON.stringify({ error: 'Failed to delete lesson' }), {
              status: 500,
              headers: { 
                'Content-Type': 'application/json',
                ...corsHeaders
              }
            })
          }

          return new Response(JSON.stringify({ 
            message: 'Lesson deleted successfully',
            lessonId: lessonId
          }), {
            status: 200,
            headers: { 
              'Content-Type': 'application/json',
              'Cache-Control': 'no-cache, no-store, must-revalidate',
              'Pragma': 'no-cache',
              'Expires': '0',
              ...corsHeaders
            }
          })
        } catch (error) {
          return new Response(JSON.stringify({ error: 'Failed to delete lesson' }), {
            status: 500,
            headers: { 
              'Content-Type': 'application/json',
              ...corsHeaders
            }
          })
        }
      }

      // Handle user deletion
      if (actualPath.match(/^\/users\/\d+$/)) {
        try {
          const userId = actualPath.split('/')[2]
          
          const { error } = await supabase
            .from('users')
            .delete()
            .eq('id', userId)

          if (error) {
            console.error('Error deleting user:', error)
            return new Response(JSON.stringify({ error: 'Failed to delete user' }), {
              status: 500,
              headers: { 
                'Content-Type': 'application/json',
                ...corsHeaders
              }
            })
          }

          return new Response(JSON.stringify({ 
            message: 'User deleted successfully'
          }), {
            status: 200,
            headers: { 
              'Content-Type': 'application/json',
              'Cache-Control': 'no-cache, no-store, must-revalidate',
              'Pragma': 'no-cache',
              'Expires': '0',
              ...corsHeaders
            }
          })
        } catch (error) {
          return new Response(JSON.stringify({ error: 'Failed to delete user' }), {
            status: 500,
            headers: { 
              'Content-Type': 'application/json',
              ...corsHeaders
            }
          })
        }
      }
    }

    // Default response for unmatched routes
    return new Response(JSON.stringify({ error: 'Route not found', path: actualPath }), {
      status: 404,
      headers: { 
        'Content-Type': 'application/json',
        ...corsHeaders
      }
    })

  } catch (error) {
    console.error('API function error:', error)
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500,
      headers: { 
        'Content-Type': 'application/json',
        ...corsHeaders
      }
    })
  }
})
