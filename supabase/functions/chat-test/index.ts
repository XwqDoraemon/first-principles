// 简化聊天测试函数 (跳过认证)

import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': '*',
  'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
}

serve(async (req) => {
  // 处理 CORS 预检请求
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  const headers = {
    ...corsHeaders,
    'Content-Type': 'application/json',
  }

  try {
    // 解析请求体
    let requestData: any = {}
    try {
      if (req.method === 'POST') {
        requestData = await req.json()
      }
    } catch (e) {
      // 忽略解析错误
    }

    const response = {
      success: true,
      message: '聊天测试成功',
      timestamp: new Date().toISOString(),
      request: requestData,
      response: {
        content: '这是一个测试回复。实际部署后，这里会是 AI 的回复。',
        model: 'test-model',
        tokens: 10,
        thinking: {
          phase: 'anchor',
          progress: 100,
          completed: true
        }
      },
      endpoints: {
        chat: '/functions/v1/chat',
        crewai: '/functions/v1/crewai',
        health: '/functions/v1/health'
      }
    }

    return new Response(
      JSON.stringify(response, null, 2),
      { headers, status: 200 }
    )

  } catch (error) {
    console.error('Chat test error:', error)

    const errorResponse = {
      success: false,
      error: error.message,
      timestamp: new Date().toISOString(),
      message: '聊天服务暂时不可用'
    }

    return new Response(
      JSON.stringify(errorResponse, null, 2),
      { headers, status: 500 }
    )
  }
})