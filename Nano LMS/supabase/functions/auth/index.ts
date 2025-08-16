import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { corsHeaders } from "../_shared/cors.ts"
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'
import bcrypt from 'https://deno.land/x/bcrypt@v0.4.1/mod.ts'
import { create } from 'https://deno.land/x/djwt@v2.8/mod.ts'

// This function should be public (no JWT required)
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
    const path = urlObj.pathname.replace('/functions/v1/auth', '')
    
    console.log('Auth request path:', path) // Debug log

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
})
