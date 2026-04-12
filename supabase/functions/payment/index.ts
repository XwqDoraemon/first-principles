import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'
import Stripe from 'https://esm.sh/stripe@14.21.0'

const stripe = new Stripe(Deno.env.get('STRIPE_SECRET_KEY') || '', {
  apiVersion: '2023-10-16',
})

const adminSupabase = createClient(
  Deno.env.get('SUPABASE_URL') ?? '',
  Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
)

// 价格配置（美元）
const PRICING_PLANS = {
  basic: {
    name: 'Basic Pack',
    amount: 0.99, // $0.99
    credits: 10,
    currency: 'usd',
  },
  pro: {
    name: 'Pro Pack',
    amount: 4.99, // $4.99
    credits: 60,
    currency: 'usd',
  },
}

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

function matchesRoute(pathname: string, route: string) {
  return pathname === route || pathname.endsWith(route)
}

function createRequestSupabaseClient(req: Request) {
  const authHeader = req.headers.get('Authorization')
  if (!authHeader) {
    return null
  }

  return createClient(
    Deno.env.get('SUPABASE_URL') ?? '',
    Deno.env.get('SUPABASE_ANON_KEY') ?? '',
    {
      global: {
        headers: { Authorization: authHeader },
      },
    }
  )
}

serve(async (req) => {
  // 处理 CORS 预检请求
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    const { method } = req
    const url = new URL(req.url)
    const path = url.pathname

    // 创建支付意图
    if (method === 'POST' && matchesRoute(path, '/create-payment-intent')) {
      const { plan, userId } = await req.json()

      if (!plan || !userId) {
        throw new Error('Missing plan or userId')
      }

      const pricingPlan = PRICING_PLANS[plan]
      if (!pricingPlan) {
        throw new Error('Invalid plan')
      }

      // 创建 Stripe 支付意图
      const paymentIntent = await stripe.paymentIntents.create({
        amount: Math.round(pricingPlan.amount * 100), // 转换为美分
        currency: pricingPlan.currency,
        metadata: {
          userId,
          plan,
          credits: pricingPlan.credits.toString(),
        },
      })

      // 在数据库中创建订单记录
      const { data: order, error: orderError } = await adminSupabase
        .from('orders')
        .insert({
          user_id: userId,
          amount: pricingPlan.amount,
          credits_purchased: pricingPlan.credits,
          status: 'pending',
          payment_intent_id: paymentIntent.id,
          metadata: { plan },
        })
        .select()
        .single()

      if (orderError) {
        console.error('Error creating order:', orderError)
      }

      return new Response(
        JSON.stringify({
          clientSecret: paymentIntent.client_secret,
          orderId: order?.id,
        }),
        {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        }
      )
    }

    // Webhook 处理
    if (method === 'POST' && matchesRoute(path, '/webhook')) {
      const body = await req.text()
      const signature = req.headers.get('Stripe-Signature')

      const webhookSecret = Deno.env.get('STRIPE_WEBHOOK_SECRET')
      if (!webhookSecret) {
        throw new Error('Missing webhook secret')
      }

      let event
      try {
        event = stripe.webhooks.constructEvent(
          body,
          signature,
          webhookSecret
        )
      } catch (err) {
        console.error('Webhook signature verification failed:', err)
        return new Response('Invalid signature', { status: 400 })
      }

      // 处理支付成功事件
      if (event.type === 'payment_intent.succeeded') {
        const paymentIntent = event.data.object
        const { userId, plan, credits } = paymentIntent.metadata

        // 更新订单状态
        const { error: updateError } = await adminSupabase
          .from('orders')
          .update({
            status: 'completed',
            completed_at: new Date().toISOString(),
          })
          .eq('payment_intent_id', paymentIntent.id)

        if (updateError) {
          console.error('Error updating order:', updateError)
        }

        // 添加积分到用户账户
        const { error: creditError } = await adminSupabase.rpc('add_credits', {
          user_id: userId,
          amount: parseInt(credits),
          transaction_type: 'purchase',
          description: `Purchased ${plan} pack`,
        })

        if (creditError) {
          console.error('Error adding credits:', creditError)
        }

        console.log(`Successfully added ${credits} credits to user ${userId}`)
      }

      // 处理支付失败事件
      if (event.type === 'payment_intent.payment_failed') {
        const paymentIntent = event.data.object

        await adminSupabase
          .from('orders')
          .update({ status: 'failed' })
          .eq('payment_intent_id', paymentIntent.id)
      }

      return new Response(JSON.stringify({ received: true }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    // 获取用户积分余额
    if (method === 'GET' && matchesRoute(path, '/credits')) {
      const requestSupabase = createRequestSupabaseClient(req)
      if (!requestSupabase) {
        throw new Error('Missing authorization header')
      }

      const { data: { user }, error } = await requestSupabase.auth.getUser()

      if (error || !user) {
        throw new Error('Invalid user token')
      }

      const { data: userData } = await adminSupabase
        .from('users')
        .select('credits_balance, total_sessions, free_sessions_remaining')
        .eq('id', user.id)
        .single()

      return new Response(
        JSON.stringify({
          credits: userData?.credits_balance || 0,
          totalSessions: userData?.total_sessions || 0,
          freeSessionsRemaining: userData?.free_sessions_remaining || 0,
          canStartConversation: (userData?.free_sessions_remaining || 0) > 0 || (userData?.credits_balance || 0) >= 2,
          conversationCost: 2,
        }),
        {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        }
      )
    }

    return new Response('Not found', { status: 404, headers: corsHeaders })
  } catch (error) {
    console.error('Error:', error)
    return new Response(
      JSON.stringify({ error: error.message }),
      {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      }
    )
  }
})
