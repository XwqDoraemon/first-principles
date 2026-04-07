import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const supabase = createClient(
  Deno.env.get('SUPABASE_URL') ?? '',
  Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
)

// PayPal 配置
const PAYPAL_CONFIG = {
  clientId: Deno.env.get('PAYPAL_CLIENT_ID') || '',
  clientSecret: Deno.env.get('PAYPAL_CLIENT_SECRET') || '',
  baseUrl: Deno.env.get('PAYPAL_MODE') === 'live' 
    ? 'https://api-m.paypal.com'
    : 'https://api-m.sandbox.paypal.com',
}

// 价格配置（美元）
const PRICING_PLANS = {
  basic: {
    name: 'Basic Pack',
    amount: 0.99,
    credits: 5,
    currency: 'USD',
  },
  pro: {
    name: 'Pro Pack',
    amount: 4.99,
    credits: 30,
    currency: 'USD',
  },
}

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

/**
 * 获取 PayPal 访问令牌
 */
async function getPayPalAccessToken() {
  const auth = btoa(`${PAYPAL_CONFIG.clientId}:${PAYPAL_CONFIG.clientSecret}`)
  
  const response = await fetch(`${PAYPAL_CONFIG.baseUrl}/v1/oauth2/token`, {
    method: 'POST',
    headers: {
      'Authorization': `Basic ${auth}`,
      'Content-Type': 'application/x-www-form-urlencoded',
    },
    body: 'grant_type=client_credentials',
  })

  if (!response.ok) {
    throw new Error('Failed to get PayPal access token')
  }

  const data = await response.json()
  return data.access_token
}

/**
 * 创建 PayPal 订单
 */
async function createPayPalOrder(plan: string, userId: string) {
  const pricingPlan = PRICING_PLANS[plan]
  if (!pricingPlan) {
    throw new Error('Invalid plan')
  }

  const accessToken = await getPayPalAccessToken()

  const response = await fetch(`${PAYPAL_CONFIG.baseUrl}/v2/checkout/orders`, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${accessToken}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      intent: 'CAPTURE',
      purchase_units: [{
        amount: {
          currency_code: pricingPlan.currency,
          value: pricingPlan.amount.toFixed(2),
        },
        description: `${pricingPlan.name} - ${pricingPlan.credits} credits`,
      }],
      metadata: {
        userId,
        plan,
        credits: pricingPlan.credits.toString(),
      },
    }),
  })

  if (!response.ok) {
    const error = await response.text()
    throw new Error(`Failed to create PayPal order: ${error}`)
  }

  return await response.json()
}

/**
 * 捕获 PayPal 支付
 */
async function capturePayPalOrder(orderId: string) {
  const accessToken = await getPayPalAccessToken()

  const response = await fetch(`${PAYPAL_CONFIG.baseUrl}/v2/checkout/orders/${orderId}/capture`, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${accessToken}`,
      'Content-Type': 'application/json',
    },
  })

  if (!response.ok) {
    const error = await response.text()
    throw new Error(`Failed to capture PayPal order: ${error}`)
  }

  return await response.json()
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    const url = new URL(req.url)
    const path = url.pathname

    // 创建 PayPal 订单
    if (req.method === 'POST' && path === '/create-order') {
      const { plan, userId } = await req.json()

      if (!plan || !userId) {
        throw new Error('Missing plan or userId')
      }

      // 创建 PayPal 订单
      const paypalOrder = await createPayPalOrder(plan, userId)

      // 在数据库中创建订单记录
      const { data: order, error: orderError } = await supabase
        .from('orders')
        .insert({
          user_id: userId,
          amount: PRICING_PLANS[plan].amount,
          credits_purchased: PRICING_PLANS[plan].credits,
          status: 'pending',
          payment_provider: 'paypal',
          payment_intent_id: paypalOrder.id,
          metadata: { plan },
        })
        .select()
        .single()

      if (orderError) {
        console.error('Error creating order:', orderError)
      }

      return new Response(
        JSON.stringify({
          orderId: paypalOrder.id,
          approvalUrl: paypalOrder.links?.find((link: any) => link.rel === 'approve')?.href,
        }),
        {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        }
      )
    }

    // 捕获支付（Webhook 或前端回调）
    if (req.method === 'POST' && path === '/capture-order') {
      const { orderId, userId } = await req.json()

      if (!orderId) {
        throw new Error('Missing orderId')
      }

      // 捕获 PayPal 支付
      const captureData = await capturePayPalOrder(orderId)

      // 检查支付状态
      if (captureData.status === 'COMPLETED') {
        const purchaseUnit = captureData.purchase_units[0]
        const metadata = purchaseUnit.custom_id || purchaseUnit.description
        
        // 从 PayPal 自定义数据中提取元数据
        let userId = userId
        let plan = 'basic'
        let credits = 5

        try {
          const customData = JSON.parse(purchaseUnit.custom_id || '{}')
          userId = customData.userId
          plan = customData.plan
          credits = parseInt(customData.credits)
        } catch (e) {
          console.error('Error parsing custom data:', e)
        }

        // 更新订单状态
        const { error: updateError } = await supabase
          .from('orders')
          .update({
            status: 'completed',
            completed_at: new Date().toISOString(),
          })
          .eq('payment_intent_id', orderId)

        if (updateError) {
          console.error('Error updating order:', updateError)
        }

        // 添加积分到用户账户
        const { error: creditError } = await supabase.rpc('add_credits', {
          user_id: userId,
          amount: credits,
          transaction_type: 'purchase',
          description: `Purchased ${plan} pack`,
        })

        if (creditError) {
          console.error('Error adding credits:', creditError)
        }

        console.log(`Successfully added ${credits} credits to user ${userId}`)
      }

      return new Response(
        JSON.stringify({ success: true, data: captureData }),
        {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        }
      )
    }

    // PayPal Webhook 处理
    if (req.method === 'POST' && path === '/webhook') {
      const body = await req.json()
      
      // PayPal webhook 验证（可选，推荐生产环境使用）
      const webhookId = Deno.env.get('PAYPAL_WEBHOOK_ID')
      if (webhookId) {
        // TODO: 验证 webhook 签名
        // https://developer.paypal.com/docs/api-basics/notifications/webhooks/#verify-the-webhook-message
      }

      // 处理支付完成事件
      if (body.event_type === 'PAYMENT.CAPTURE.COMPLETED') {
        const resource = body.resource
        const orderId = resource.supplementary_data?.related_ids?.order_id
        
        if (orderId) {
          // 更新订单状态
          await supabase
            .from('orders')
            .update({ status: 'completed' })
            .eq('payment_intent_id', orderId)
        }
      }

      return new Response(JSON.stringify({ received: true }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    return new Response('Not found', { status: 404 })
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
