// 简化健康检查测试函数

import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

serve(async (req) => {
  // 处理 CORS 预检请求
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    const response = {
      status: 'healthy' as const,
      timestamp: new Date().toISOString(),
      message: 'Edge Functions test succeeded',
      services: {
        supabase: { status: 'healthy' as const },
        crewai: { status: 'unknown' as const },
        deepseek: { status: 'unknown' as const },
      },
      version: '1.0.0',
      environment: 'development',
    }

    return new Response(
      JSON.stringify(response),
      {
        headers: {
          ...corsHeaders,
          'Content-Type': 'application/json',
        },
        status: 200,
      }
    )

  } catch (error) {
    console.error('Health test error:', error)

    const errorResponse = {
      status: 'unhealthy' as const,
      timestamp: new Date().toISOString(),
      error: error.message,
      message: 'Health check failed',
    }

    return new Response(
      JSON.stringify(errorResponse),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 500,
      }
    )
  }
})
