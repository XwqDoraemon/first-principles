// First Principles Health Check Edge Function
// 部署: supabase functions deploy health

import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.39.0'

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
    const supabaseClient = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_ANON_KEY') ?? '',
      {
        global: {
          headers: { Authorization: req.headers.get('Authorization')! },
        },
      }
    )

    // 检查数据库连接
    const { data: dbCheck, error: dbError } = await supabaseClient
      .from('conversations')
      .select('count')
      .limit(1)

    const dbStatus = !dbError ? 'healthy' : 'unhealthy'

    // 检查 DeepSeek API 连接
    const deepseekApiKey = Deno.env.get('DEEPSEEK_API_KEY')
    let apiStatus = 'unknown'
    
    if (deepseekApiKey) {
      try {
        const testResponse = await fetch('https://api.deepseek.com/v1/models', {
          headers: {
            'Authorization': `Bearer ${deepseekApiKey}`,
          },
        })
        apiStatus = testResponse.ok ? 'healthy' : 'unhealthy'
      } catch (error) {
        apiStatus = 'unhealthy'
      }
    } else {
      apiStatus = 'unconfigured'
    }

    // 检查环境变量
    const envVars = {
      SUPABASE_URL: Deno.env.get('SUPABASE_URL') ? 'configured' : 'missing',
      SUPABASE_ANON_KEY: Deno.env.get('SUPABASE_ANON_KEY') ? 'configured' : 'missing',
      DEEPSEEK_API_KEY: deepseekApiKey ? 'configured' : 'missing',
    }

    // 总体状态
    const overallStatus = dbStatus === 'healthy' && apiStatus === 'healthy' ? 'healthy' : 'degraded'

    const healthData = {
      status: overallStatus,
      timestamp: new Date().toISOString(),
      services: {
        database: {
          status: dbStatus,
          error: dbError?.message || null,
        },
        deepseek_api: {
          status: apiStatus,
          configured: !!deepseekApiKey,
        },
      },
      environment: envVars,
      architecture: 'simplified-llm-api-v1.0',
      version: '1.0.0',
    }

    const statusCode = overallStatus === 'healthy' ? 200 : 503

    return new Response(
      JSON.stringify(healthData),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: statusCode,
      }
    )

  } catch (error) {
    console.error('Health check error:', error)

    return new Response(
      JSON.stringify({
        status: 'unhealthy',
        error: error.message,
        timestamp: new Date().toISOString(),
      }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 503,
      }
    )
  }
})