// @public
import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'
import bcrypt from 'https://deno.land/x/bcrypt@v0.4.1/mod.ts'
import { create } from 'https://deno.land/x/djwt@v2.8/mod.ts'

serve(async (req) => {
  console.log('API function called:', req.method, req.url)
  
  // Handle CORS preflight requests FIRST - before any other logic
  if (req.method === 'OPTIONS') {
    console.log('Handling OPTIONS request')
    return new Response(null, { 
      status: 200,
      headers: {
        'Access-Control-Allow-Origin': 'https://nano-lms.vercel.app',
        'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
        'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
        'Access-Control-Allow-Credentials': 'true',
        'Access-Control-Max-Age': '86400'
      }
    })
  }

  // Common CORS headers for all responses
  const corsHeaders = {
    'Access-Control-Allow-Origin': 'https://nano-lms.vercel.app',
    'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
    'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
    'Access-Control-Allow-Credentials': 'true'
  }

  try {
    const { method, url } = req
    const urlObj = new URL(url)
    const fullPath = urlObj.pathname
    // The pathname is /functions/v1/api/auth/login, so we need to remove /functions/v1/api
    const path = fullPath.replace('/functions/v1/api', '')
    
    console.log('Full URL pathname:', fullPath)
    console.log('Extracted path:', path)
    console.log('Method:', method)
    
    // Debug: check if path still has /api prefix and remove it
    let actualPath = path
    if (path.startsWith('/api/')) {
      actualPath = path.replace('/api/', '/')
      console.log('Fixed path:', actualPath)
    } else {
      actualPath = path
    }
    
    // Handle health check
    if (actualPath === '/health') {
      return new Response(JSON.stringify({ status: 'ok' }), {
        headers: { 
          'Content-Type': 'application/json',
          ...corsHeaders
        }
      })
    }
    
    // Handle auth login
    if (actualPath === '/auth/login' && method === 'POST') {
      console.log('Login endpoint matched!')
      
      try {
        // Create Supabase client
        const supabaseUrl = Deno.env.get('SUPABASE_URL')!
        const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
        const supabase = createClient(supabaseUrl, supabaseServiceKey)
        
        // Parse request body
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
        const { data: users, error } = await supabase
          .from('users')
          .select('*')
          .eq('email', email)
          .single()
        
        if (error || !users) {
          console.log('User not found:', email)
          return new Response(JSON.stringify({ error: 'Invalid credentials' }), {
            status: 401,
            headers: { 
              'Content-Type': 'application/json',
              ...corsHeaders
            }
          })
        }
        
        console.log('User found:', users.email)
        
        // Verify password
        const isValidPassword = await bcrypt.compare(password, users.password_hash)
        if (!isValidPassword) {
          console.log('Invalid password for:', email)
          return new Response(JSON.stringify({ error: 'Invalid credentials' }), {
            status: 401,
            headers: { 
              'Content-Type': 'application/json',
              ...corsHeaders
            }
          })
        }
        
        console.log('Password verified for:', email)
        
        // Create JWT token
        const JWT_SECRET = Deno.env.get('JWT_SECRET') || 'your-secret-key'
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
        
        console.log('Token created for:', email)
        
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

    return new Response(JSON.stringify({ error: 'Route not found', path: actualPath, originalPath: path }), {
      status: 404,
      headers: { 
        'Content-Type': 'application/json',
        ...corsHeaders
      }
    })

  } catch (error) {
    console.log('API function error:', error)
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500,
      headers: { 
        'Content-Type': 'application/json',
        'Access-Control-Allow-Origin': 'https://nano-lms.vercel.app',
        'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
        'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
        'Access-Control-Allow-Credentials': 'true'
      }
    })
  }
})
