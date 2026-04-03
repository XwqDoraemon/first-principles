// First Principles Chat Edge Function
// 部署: supabase functions deploy chat

import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.39.0'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

interface ChatRequest {
  messages: Array<{
    role: 'user' | 'assistant' | 'system'
    content: string
  }>
  conversationId?: string
  userId: string
}

interface ChatResponse {
  success: boolean
  message?: string
  error?: string
  data?: any
  conversationId?: string
  messageId?: string
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
          error: '未授权访问',
        }),
        {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          status: 401,
        }
      )
    }

    const requestData: ChatRequest = await req.json()
    const { messages, conversationId, userId } = requestData

    // 验证请求数据
    if (!messages || !Array.isArray(messages) || messages.length === 0) {
      return new Response(
        JSON.stringify({
          success: false,
          error: '消息不能为空',
        }),
        {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          status: 400,
        }
      )
    }

    const lastMessage = messages[messages.length - 1]
    if (lastMessage.role !== 'user') {
      return new Response(
        JSON.stringify({
          success: false,
          error: '最后一条消息必须是用户消息',
        }),
        {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          status: 400,
        }
      )
    }

    let conversation = conversationId

    // 如果没有 conversationId，创建新对话
    if (!conversation) {
      const { data: newConversation, error: convError } = await supabaseClient
        .from('conversations')
        .insert({
          user_id: userId,
          title: lastMessage.content.substring(0, 50) + (lastMessage.content.length > 50 ? '...' : ''),
          status: 'active',
          current_phase: 'anchor',
          phase_progress: 0,
        })
        .select('id')
        .single()

      if (convError) {
        throw new Error(`创建对话失败: ${convError.message}`)
      }

      conversation = newConversation.id
    }

    // 保存用户消息
    const { data: savedMessage, error: msgError } = await supabaseClient
      .from('messages')
      .insert({
        conversation_id: conversation,
        role: 'user',
        content: lastMessage.content,
        created_at: new Date().toISOString(),
      })
      .select('id')
      .single()

    if (msgError) {
      throw new Error(`保存消息失败: ${msgError.message}`)
    }

    // 调用 CrewAI 服务（本地部署）
    const crewaiResponse = await callCrewAIService({
      userInput: lastMessage.content,
      conversationId: conversation,
      userId: userId,
    })

    // 保存 AI 回复
    if (crewaiResponse.success && crewaiResponse.message) {
      await supabaseClient
        .from('messages')
        .insert({
          conversation_id: conversation,
          role: 'assistant',
          content: crewaiResponse.message,
          analysis_result: crewaiResponse.data,
          created_at: new Date().toISOString(),
        })
    }

    // 更新对话进度
    if (crewaiResponse.data?.current_phase) {
      await supabaseClient
        .from('conversations')
        .update({
          current_phase: crewaiResponse.data.current_phase,
          phase_progress: crewaiResponse.data.progress || 0,
          updated_at: new Date().toISOString(),
        })
        .eq('id', conversation)
    }

    const response: ChatResponse = {
      success: true,
      message: crewaiResponse.message || '消息已接收，正在思考中...',
      data: crewaiResponse.data,
      conversationId: conversation,
      messageId: savedMessage.id,
    }

    return new Response(
      JSON.stringify(response),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 200,
      }
    )

  } catch (error) {
    console.error('Chat function error:', error)

    return new Response(
      JSON.stringify({
        success: false,
        error: error.message || '服务器内部错误',
      }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 500,
      }
    )
  }
})

// 调用本地 CrewAI 服务
async function callCrewAIService(params: {
  userInput: string
  conversationId: string
  userId: string
}): Promise<ChatResponse> {
  try {
    // 这里调用本地部署的 CrewAI 服务
    // 在实际部署中，这应该是一个 HTTP 请求到本地服务
    const crewaiBaseUrl = Deno.env.get('CREWAI_LOCAL_URL') || 'http://localhost:8000'
    
    const response = await fetch(`${crewaiBaseUrl}/api/crewai/chat`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        message: params.userInput,
        conversation_id: params.conversationId,
        user_id: params.userId,
      }),
    })

    if (!response.ok) {
      throw new Error(`CrewAI 服务错误: ${response.status}`)
    }

    return await response.json()

  } catch (error) {
    console.error('CrewAI 调用失败:', error)
    
    // 降级到直接使用 DeepSeek API
    return await fallbackToDeepSeek(params.userInput)
  }
}

// DeepSeek 降级方案
async function fallbackToDeepSeek(userInput: string): Promise<ChatResponse> {
  try {
    const deepseekApiKey = Deno.env.get('DEEPSEEK_API_KEY')
    if (!deepseekApiKey) {
      throw new Error('DeepSeek API 密钥未配置')
    }

    const response = await fetch('https://api.deepseek.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${deepseekApiKey}`,
      },
      body: JSON.stringify({
        model: 'deepseek-chat',
        messages: [
          {
            role: 'system',
            content: '你是一个第一性原理思考教练。帮助用户通过系统化思考解决问题。'
          },
          {
            role: 'user',
            content: userInput
          }
        ],
        temperature: 0.7,
        max_tokens: 1000,
      }),
    })

    if (!response.ok) {
      throw new Error(`DeepSeek API 错误: ${response.status}`)
    }

    const data = await response.json()
    const message = data.choices?.[0]?.message?.content || '抱歉，我无法生成回复。'

    return {
      success: true,
      message: message,
      data: {
        provider: 'deepseek',
        model: 'deepseek-chat',
        fallback: true,
      },
    }

  } catch (error) {
    console.error('DeepSeek 降级失败:', error)
    
    return {
      success: false,
      error: 'AI 服务暂时不可用，请稍后重试。',
      data: {
        fallback: false,
        error: error.message,
      },
    }
  }
}