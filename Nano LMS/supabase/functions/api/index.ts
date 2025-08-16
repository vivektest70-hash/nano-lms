import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { corsHeaders } from "../_shared/cors.ts"
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'
import bcrypt from 'https://deno.land/x/bcrypt@v0.4.1/mod.ts'
import { create, verify } from 'https://deno.land/x/djwt@v2.8/mod.ts'

serve(async (req) => {
  // Handle CORS preflight requests properly
  if (req.method === 'OPTIONS') {
    return new Response(null, { 
      status: 200,
      headers: {
        ...corsHeaders,
        'Access-Control-Max-Age': '86400'
      }
    })
  }

  try {
    // Create Supabase client
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    
    const supabase = createClient(supabaseUrl, supabaseServiceKey)

    // Parse the request
    const { method, url } = req
    const urlObj = new URL(url)
    const path = urlObj.pathname.replace('/functions/v1/api', '')
    
    console.log('Request path:', path) // Debug log
    
    // Handle different API routes
    if (path.startsWith('/auth')) {
      return handleAuth(req, supabase)
    } else if (path.startsWith('/courses')) {
      return handleCourses(req, supabase)
    } else if (path.startsWith('/users')) {
      return handleUsers(req, supabase)
    } else if (path.startsWith('/lessons')) {
      return handleLessons(req, supabase)
    } else if (path.startsWith('/quizzes')) {
      return handleQuizzes(req, supabase)
    } else if (path.startsWith('/certificates')) {
      return handleCertificates(req, supabase)
    } else if (path.startsWith('/user-progress')) {
      return handleUserProgress(req, supabase)
    } else if (path.startsWith('/upload')) {
      return handleUpload(req, supabase)
    } else if (path.startsWith('/ai-quiz')) {
      return handleAIQuiz(req, supabase)
    } else if (path === '/health') {
      return new Response(JSON.stringify({ status: 'ok' }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      })
    }

    return new Response(JSON.stringify({ error: 'Route not found', path }), {
      status: 404,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    })

  } catch (error) {
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    })
  }
})

// JWT secret key
const JWT_SECRET = Deno.env.get('JWT_SECRET') || 'your-secret-key'

// Authentication handler
async function handleAuth(req: Request, supabase: any) {
  try {
    const { method } = req
    const url = new URL(req.url)
    const path = url.pathname.replace('/functions/v1/api/auth', '')
    
    console.log('Auth path:', path) // Debug log

    if (method === 'POST' && path === '/login') {
      const body = await req.json()
      const { email, password } = body

      console.log('Login attempt for:', email) // Debug log

      if (!email || !password) {
        return new Response(JSON.stringify({ error: 'Email and password are required' }), {
          status: 400,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        })
      }

      // Query user from database
      const { data: users, error } = await supabase
        .from('users')
        .select('*')
        .eq('email', email)
        .single()

      if (error || !users) {
        console.log('User not found:', email) // Debug log
        return new Response(JSON.stringify({ error: 'Invalid credentials' }), {
          status: 401,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        })
      }

      console.log('User found:', users.email) // Debug log

      // Verify password
      const isValidPassword = await bcrypt.compare(password, users.password_hash)
      if (!isValidPassword) {
        console.log('Invalid password for:', email) // Debug log
        return new Response(JSON.stringify({ error: 'Invalid credentials' }), {
          status: 401,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        })
      }

      console.log('Password verified for:', email) // Debug log

      // Create JWT token
      const payload = {
        userId: users.id,
        email: users.email,
        role: users.role,
        work_type: users.work_type
      }

      const token = await create(
        { alg: "HS256", typ: "JWT" },
        payload,
        JWT_SECRET
      )

      console.log('Token created for:', email) // Debug log

      return new Response(JSON.stringify({
        token,
        user: {
          id: users.id,
          email: users.email,
          firstName: users.first_name,
          lastName: users.last_name,
          role: users.role,
          work_type: users.work_type
        }
      }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      })
    }

    return new Response(JSON.stringify({ error: 'Method not allowed', path }), {
      status: 405,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    })

  } catch (error) {
    console.log('Auth error:', error) // Debug log
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    })
  }
}

// Placeholder handlers for other endpoints
async function handleCourses(req: Request, supabase: any) {
  return new Response(JSON.stringify({ message: 'Courses endpoint' }), {
    headers: { ...corsHeaders, 'Content-Type': 'application/json' }
  })
}

async function handleUsers(req: Request, supabase: any) {
  return new Response(JSON.stringify({ message: 'Users endpoint' }), {
    headers: { ...corsHeaders, 'Content-Type': 'application/json' }
  })
}

async function handleLessons(req: Request, supabase: any) {
  return new Response(JSON.stringify({ message: 'Lessons endpoint' }), {
    headers: { ...corsHeaders, 'Content-Type': 'application/json' }
  })
}

async function handleQuizzes(req: Request, supabase: any) {
  return new Response(JSON.stringify({ message: 'Quizzes endpoint' }), {
    headers: { ...corsHeaders, 'Content-Type': 'application/json' }
  })
}

async function handleCertificates(req: Request, supabase: any) {
  return new Response(JSON.stringify({ message: 'Certificates endpoint' }), {
    headers: { ...corsHeaders, 'Content-Type': 'application/json' }
  })
}

async function handleUserProgress(req: Request, supabase: any) {
  return new Response(JSON.stringify({ message: 'User Progress endpoint' }), {
    headers: { ...corsHeaders, 'Content-Type': 'application/json' }
  })
}

async function handleUpload(req: Request, supabase: any) {
  return new Response(JSON.stringify({ message: 'Upload endpoint' }), {
    headers: { ...corsHeaders, 'Content-Type': 'application/json' }
  })
}

async function handleAIQuiz(req: Request, supabase: any) {
  return new Response(JSON.stringify({ message: 'AI Quiz endpoint' }), {
    headers: { ...corsHeaders, 'Content-Type': 'application/json' }
  })
}
