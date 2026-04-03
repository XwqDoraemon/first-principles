// 健康检查 Edge Function
// 检查所有服务的状态

import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.39.0'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

interface HealthCheckResponse {
  status: 'healthy' | 'degraded' | 'unhealthy'
  timestamp: string
  services: {
    supabase: {
      status: 'healthy' | 'unhealthy'
      latency?: number
      error?: string
    }
    crewai: {
      status: 'healthy' | 'unhealthy' | 'unknown'
      latency?: number
      error?: string
    }
    deepseek: {
      status: 'healthy' | 'unhealthy' | 'unknown'
      error?: string
    }
  }
  version: string
  environment: string
}

serve(async (req) => {
  // 处理 CORS 预检请求
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    const startTime = Date.now()
    const healthChecks: HealthCheckResponse['services'] = {
      supabase: { status: 'unhealthy' },
      crewai: { status: 'unknown' },
      deepseek: { status: 'unknown' },
    }

    // 1. 检查 Supabase 连接
    try {
      const supabaseClient = createClient(
        Deno.env.get('SUPABASE_URL') ?? '',
        Deno.env.get('SUPABASE_ANON_KEY') ?? '',
        {
          auth: {
            autoRefreshToken: false,
            persistSession: false,
          },
        }
      )

      const supabaseStart = Date.now()
      const { error } = await supabaseClient.from('conversations').select('count', { count: 'exact', head: true })
      const supabaseLatency = Date.now() - supabaseStart

      if (error) {
        healthChecks.supabase = {
          status: 'unhealthy',
          latency: supabaseLatency,
          error: error.message,
        }
      } else {
        healthChecks.supabase = {
          status: 'healthy',
          latency: supabaseLatency,
        }
      }
    } catch (error) {
      healthChecks.supabase = {
        status: 'unhealthy',
        error: error.message,
      }
    }

    // 2. 检查 CrewAI 服务
    try {
      const crewaiBaseUrl = Deno.env.get('CREWAI_LOCAL_URL') || 'http://localhost:8000'
      const crewaiStart = Date.now()
      
      const response = await fetch(`${crewaiBaseUrl}/api/crewai/health`, {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json',
        },
        signal: AbortSignal.timeout(5000), // 5秒超时
      })
      
      const crewaiLatency = Date.now() - crewaiStart

      if (response.ok) {
        const data = await response.json()
        healthChecks.crewai = {
          status: data.status === 'healthy' ? 'healthy' : 'unhealthy',
          latency: crewaiLatency,
          error: data.error,
        }
      } else {
        healthChecks.crewai = {
          status: 'unhealthy',
          latency: crewaiLatency,
          error: `HTTP ${response.status}`,
        }
      }
    } catch (error) {
      healthChecks.crewai = {
        status: 'unhealthy',
        error: error.message,
      }
    }

    // 3. 检查 DeepSeek API
    try {
      const deepseekApiKey = Deno.env.get('DEEPSEEK_API_KEY')
      
      if (!deepseekApiKey) {
        healthChecks.deepseek = {
          status: 'unknown',
          error: 'API 密钥未配置',
        }
      } else {
        // 简单检查 API 密钥格式
        if (deepseekApiKey.startsWith('sk-') && deepseekApiKey.length > 20) {
          healthChecks.deepseek = {
            status: 'healthy',
          }
        } else {
          healthChecks.deepseek = {
            status: 'unhealthy',
            error: 'API 密钥格式无效',
          }
        }
      }
    } catch (error) {
      healthChecks.deepseek = {
        status: 'unhealthy',
        error: error.message,
      }
    }

    // 计算总体状态
    const healthyServices = Object.values(healthChecks).filter(s => s.status === 'healthy').length
    const totalServices = Object.keys(healthChecks).length
    
    let overallStatus: HealthCheckResponse['status'] = 'healthy'
    
    if (healthyServices === 0) {
      overallStatus = 'unhealthy'
    } else if (healthyServices < totalServices) {
      overallStatus = 'degraded'
    }

    const response: HealthCheckResponse = {
      status: overallStatus,
      timestamp: new Date().toISOString(),
      services: healthChecks,
      version: '1.0.0',
      environment: Deno.env.get('ENVIRONMENT') || 'development',
    }

    const totalLatency = Date.now() - startTime

    return new Response(
      JSON.stringify(response),
      {
        headers: {
          ...corsHeaders,
          'Content-Type': 'application/json',
          'X-Response-Time': `${totalLatency}ms`,
        },
        status: overallStatus === 'unhealthy' ? 503 : 200,
      }
    )

  } catch (error) {
    console.error('Health check error:', error)

    const errorResponse = {
      status: 'unhealthy' as const,
      timestamp: new Date().toISOString(),
      error: error.message,
      services: {
        supabase: { status: 'unknown' as const, error: '健康检查失败' },
        crewai: { status: 'unknown' as const, error: '健康检查失败' },
        deepseek: { status: 'unknown' as const, error: '健康检查失败' },
      },
      version: '1.0.0',
      environment: Deno.env.get('ENVIRONMENT') || 'development',
    }

    return new Response(
      JSON.stringify(errorResponse),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 503,
      }
    )
  }
})