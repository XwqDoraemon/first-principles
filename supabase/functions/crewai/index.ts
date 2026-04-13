// CrewAI 集成 Edge Function
// 处理与本地 CrewAI 服务的通信

import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.39.0'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

interface CrewAIRequest {
  action: 'start' | 'status' | 'cancel' | 'list'
  sessionId?: string
  userInput?: string
  conversationId?: string
  userId: string
  phase?: 'anchor' | 'assumptions' | 'root_cause' | 'solution' | 'mindmap'
}

interface CrewAIResponse {
  success: boolean
  message?: string
  error?: string
  data?: any
  sessionId?: string
  currentPhase?: string
  progress?: number
}

serve(async (req) => {
  // 处理 CORS 预检请求
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    const supabaseClient = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_ANON_KEY') ?? '',
      {
        global: {
          headers: { Authorization: req.headers.get('Authorization')! },
        },
      }
    )

    // 验证用户
    const {
      data: { user },
      error: userError,
    } = await supabaseClient.auth.getUser()

    if (userError || !user) {
      return new Response(
        JSON.stringify({
          success: false,
          error: 'Unauthorized access',
        }),
        {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          status: 401,
        }
      )
    }

    const requestData: CrewAIRequest = await req.json()
    const { action, sessionId, userInput, conversationId, userId, phase } = requestData

    // 验证请求
    if (!action) {
      return new Response(
        JSON.stringify({
          success: false,
          error: 'Missing action parameter',
        }),
        {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          status: 400,
        }
      )
    }

    let response: CrewAIResponse

    switch (action) {
      case 'start':
        if (!userInput) {
          return new Response(
            JSON.stringify({
              success: false,
              error: 'User input is required to start thinking',
            }),
            {
              headers: { ...corsHeaders, 'Content-Type': 'application/json' },
              status: 400,
            }
          )
        }
        response = await startThinkingSession({
          userInput,
          conversationId,
          userId,
          phase,
        })
        break

      case 'status':
        if (!sessionId) {
          return new Response(
            JSON.stringify({
              success: false,
              error: 'sessionId is required to check status',
            }),
            {
              headers: { ...corsHeaders, 'Content-Type': 'application/json' },
              status: 400,
            }
          )
        }
        response = await getSessionStatus(sessionId)
        break

      case 'cancel':
        if (!sessionId) {
          return new Response(
            JSON.stringify({
              success: false,
              error: 'sessionId is required to cancel a session',
            }),
            {
              headers: { ...corsHeaders, 'Content-Type': 'application/json' },
              status: 400,
            }
          )
        }
        response = await cancelSession(sessionId)
        break

      case 'list':
        response = await listUserSessions(userId)
        break

      default:
        return new Response(
          JSON.stringify({
            success: false,
            error: `Unsupported action: ${action}`,
          }),
          {
            headers: { ...corsHeaders, 'Content-Type': 'application/json' },
            status: 400,
          }
        )
    }

    // 如果是开始新会话，保存到数据库
    if (action === 'start' && response.success && response.sessionId) {
      await supabaseClient
        .from('thinking_sessions')
        .insert({
          user_id: userId,
          conversation_id: conversationId,
          status: 'pending',
          user_input: userInput,
          phase: phase || 'anchor',
          crewai_session_id: response.sessionId,
          started_at: new Date().toISOString(),
        })
        .select('id')
        .single()
    }

    // 如果是状态更新，更新数据库
    if (action === 'status' && response.success && sessionId) {
      const updateData: any = {
        updated_at: new Date().toISOString(),
      }

      if (response.currentPhase) {
        updateData.phase = response.currentPhase
      }

      if (response.progress !== undefined) {
        updateData.phase_progress = response.progress
      }

      if (response.data?.status === 'completed') {
        updateData.status = 'completed'
        updateData.completed_at = new Date().toISOString()
        updateData.duration_seconds = response.data.duration_seconds
        
        // 保存分析结果
        if (response.data.result) {
          const result = response.data.result
          updateData.problem_statement = result.problem_statement
          updateData.assumption_analysis = result.assumption_analysis
          updateData.root_cause_analysis = result.root_cause_analysis
          updateData.solution_design = result.solution_design
          updateData.mind_map_data = result.mind_map_data
        }
      } else if (response.data?.status === 'failed') {
        updateData.status = 'failed'
        updateData.error_message = response.data.error
        updateData.completed_at = new Date().toISOString()
      }

      await supabaseClient
        .from('thinking_sessions')
        .update(updateData)
        .eq('crewai_session_id', sessionId)
    }

    return new Response(
      JSON.stringify(response),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 200,
      }
    )

  } catch (error) {
    console.error('CrewAI function error:', error)

    return new Response(
      JSON.stringify({
        success: false,
        error: error.message || 'Internal server error',
      }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 500,
      }
    )
  }
})

// 调用本地 CrewAI 服务
async function callLocalCrewAI(endpoint: string, data: any): Promise<any> {
  const crewaiBaseUrl = Deno.env.get('CREWAI_LOCAL_URL') || 'http://localhost:8000'
  
  const response = await fetch(`${crewaiBaseUrl}${endpoint}`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(data),
  })

  if (!response.ok) {
    throw new Error(`CrewAI service error: ${response.status}`)
  }

  return await response.json()
}

// 开始思考会话
async function startThinkingSession(params: {
  userInput: string
  conversationId?: string
  userId: string
  phase?: string
}): Promise<CrewAIResponse> {
  try {
    const response = await callLocalCrewAI('/api/crewai/chat', {
      message: params.userInput,
      conversation_id: params.conversationId,
      user_id: params.userId,
      phase: params.phase,
    })

    return {
      success: response.success,
      message: response.message,
      error: response.error,
      data: response.data,
      sessionId: response.session_id,
      currentPhase: response.current_phase,
      progress: response.progress,
    }

  } catch (error) {
    console.error('Failed to start thinking session:', error)
    
    return {
      success: false,
      error: 'Unable to connect to the thinking service',
      data: {
        fallback: true,
        error: error.message,
      },
    }
  }
}

// 获取会话状态
async function getSessionStatus(sessionId: string): Promise<CrewAIResponse> {
  try {
    const response = await callLocalCrewAI('/api/crewai/status', {
      session_id: sessionId,
    })

    return {
      success: response.success,
      message: response.message,
      error: response.error,
      data: response.data,
      sessionId: sessionId,
      currentPhase: response.current_phase,
      progress: response.progress,
    }

  } catch (error) {
    console.error('Failed to get session status:', error)
    
    return {
      success: false,
      error: 'Unable to get session status',
      data: {
        session_id: sessionId,
        error: error.message,
      },
    }
  }
}

// 取消会话
async function cancelSession(sessionId: string): Promise<CrewAIResponse> {
  try {
    const response = await callLocalCrewAI('/api/crewai/cancel', {
      session_id: sessionId,
    })

    return {
      success: response.success,
      message: response.message,
      error: response.error,
      data: response.data,
      sessionId: sessionId,
    }

  } catch (error) {
    console.error('Failed to cancel session:', error)
    
    return {
      success: false,
      error: 'Unable to cancel session',
      data: {
        session_id: sessionId,
        error: error.message,
      },
    }
  }
}

// 列出用户会话
async function listUserSessions(userId: string): Promise<CrewAIResponse> {
  try {
    const response = await callLocalCrewAI('/api/crewai/sessions', {
      user_id: userId,
      limit: 20,
    })

    return {
      success: response.success,
      message: response.message,
      error: response.error,
      data: response.data,
    }

  } catch (error) {
    console.error('Failed to list sessions:', error)
    
    return {
      success: false,
      error: 'Unable to list sessions',
      data: {
        user_id: userId,
        error: error.message,
      },
    }
  }
}
