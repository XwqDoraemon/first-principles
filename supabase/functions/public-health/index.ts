// 公开健康检查函数 (无需认证)

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

  // 允许所有来源访问
  const headers = {
    ...corsHeaders,
    'Content-Type': 'application/json',
  }

  try {
    const response = {
      success: true,
      status: 'healthy',
      timestamp: new Date().toISOString(),
      message: 'First Principles API is running normally',
      version: '1.0.0',
      environment: 'development',
      endpoints: {
        chat: '/functions/v1/chat',
        crewai: '/functions/v1/crewai',
        health: '/functions/v1/health',
      },
      services: {
        supabase: 'running',
        edge_functions: 'running',
        database: 'connected',
      }
    }

    return new Response(
      JSON.stringify(response, null, 2),
      { headers, status: 200 }
    )

  } catch (error) {
    console.error('Public health error:', error)

    const errorResponse = {
      success: false,
      status: 'error',
      timestamp: new Date().toISOString(),
      error: error.message,
      message: 'Service is temporarily unavailable',
    }

    return new Response(
      JSON.stringify(errorResponse, null, 2),
      { headers, status: 500 }
    )
  }
})
