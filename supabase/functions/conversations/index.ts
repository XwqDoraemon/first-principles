import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.39.0'

const adminSupabase = createClient(
  Deno.env.get('SUPABASE_URL') ?? '',
  Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
)

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

function extractAccessToken(req: Request) {
  const authHeader = req.headers.get('Authorization')
  if (!authHeader) return null

  const [scheme, token] = authHeader.split(' ')
  if (scheme !== 'Bearer' || !token) return null

  return token
}

function normalizeMessages(value: unknown) {
  if (!Array.isArray(value)) return []

  return value
    .filter((item) => item && typeof item === 'object')
    .map((item) => {
      const message = item as Record<string, unknown>
      return {
        role: String(message.role || 'assistant'),
        content: String(message.content || ''),
      }
    })
    .filter((item) => item.content.trim())
}

function buildConversationPreview(messages: Array<{ role: string; content: string }>) {
  const assistantMessage = [...messages].reverse().find((message) => message.role === 'assistant')
  const userMessage = [...messages].reverse().find((message) => message.role === 'user')
  const source = assistantMessage?.content || userMessage?.content || ''
  const collapsed = source.replace(/\s+/g, ' ').trim()

  if (!collapsed) return ''
  return collapsed.length > 120 ? `${collapsed.slice(0, 120).trim()}...` : collapsed
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  if (req.method !== 'GET') {
    return new Response(
      JSON.stringify({ success: false, error: 'Method not allowed' }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 405,
      }
    )
  }

  try {
    const accessToken = extractAccessToken(req)
    if (!accessToken) {
      return new Response(
        JSON.stringify({ success: false, error: 'Authorization required' }),
        {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          status: 401,
        }
      )
    }

    const { data: { user }, error: userError } = await adminSupabase.auth.getUser(accessToken)
    if (userError || !user) {
      return new Response(
        JSON.stringify({ success: false, error: 'Invalid user session' }),
        {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          status: 401,
        }
      )
    }

    const url = new URL(req.url)
    const conversationId = url.searchParams.get('conversationId')

    if (conversationId) {
      const { data, error } = await adminSupabase
        .from('conversations')
        .select('id, title, messages, current_phase, is_completed, created_at, updated_at')
        .eq('id', conversationId)
        .eq('user_id', user.id)
        .maybeSingle()

      if (error) {
        throw new Error(`Failed to load conversation: ${error.message}`)
      }

      if (!data) {
        return new Response(
          JSON.stringify({ success: false, error: 'Conversation not found' }),
          {
            headers: { ...corsHeaders, 'Content-Type': 'application/json' },
            status: 404,
          }
        )
      }

      const messages = normalizeMessages(data.messages)
      return new Response(
        JSON.stringify({
          success: true,
          conversation: {
            id: data.id,
            title: data.title || 'New Thinking Session',
            messages,
            currentPhase: Number(data.current_phase || 1),
            isCompleted: Boolean(data.is_completed),
            createdAt: data.created_at,
            updatedAt: data.updated_at,
          },
        }),
        {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          status: 200,
        }
      )
    }

    const { data, error } = await adminSupabase
      .from('conversations')
      .select('id, title, messages, current_phase, is_completed, created_at, updated_at')
      .eq('user_id', user.id)
      .order('updated_at', { ascending: false })

    if (error) {
      throw new Error(`Failed to load conversations: ${error.message}`)
    }

    const conversations = (data || []).map((item) => {
      const messages = normalizeMessages(item.messages)
      return {
        id: item.id,
        title: item.title || 'New Thinking Session',
        currentPhase: Number(item.current_phase || 1),
        isCompleted: Boolean(item.is_completed),
        createdAt: item.created_at,
        updatedAt: item.updated_at,
        messageCount: messages.length,
        preview: buildConversationPreview(messages),
      }
    })

    return new Response(
      JSON.stringify({ success: true, conversations }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 200,
      }
    )
  } catch (error) {
    console.error('Conversations function error:', error)
    return new Response(
      JSON.stringify({
        success: false,
        error: error instanceof Error ? error.message : 'Internal server error',
      }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 500,
      }
    )
  }
})
