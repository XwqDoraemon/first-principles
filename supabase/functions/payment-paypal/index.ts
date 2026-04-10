import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const supabase = createClient(
  Deno.env.get('SUPABASE_URL') ?? '',
  Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
)

const PAYPAL_CONFIG = {
  clientId: Deno.env.get('PAYPAL_CLIENT_ID') || '',
  clientSecret: Deno.env.get('PAYPAL_CLIENT_SECRET') || '',
  baseUrl: Deno.env.get('PAYPAL_MODE') === 'live'
    ? 'https://api-m.paypal.com'
    : 'https://api-m.sandbox.paypal.com',
}

const PRICING_PLANS: Record<string, { name: string; amount: number; credits: number; currency: string }> = {
  basic: {
    name: 'Basic Pack',
    amount: 0.99,
    credits: 10,
    currency: 'USD',
  },
  pro: {
    name: 'Pro Pack',
    amount: 4.99,
    credits: 60,
    currency: 'USD',
  },
}

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

function matchesRoute(pathname: string, route: string) {
  return pathname === route || pathname.endsWith(route)
}

async function getAuthenticatedUser(req: Request) {
  const authHeader = req.headers.get('Authorization')
  if (!authHeader?.startsWith('Bearer ')) {
    throw new Error('Missing authorization header')
  }

  const token = authHeader.replace('Bearer ', '').trim()
  const { data: { user }, error } = await supabase.auth.getUser(token)

  if (error || !user) {
    throw new Error('Invalid user token')
  }

  return user
}

async function getPayPalAccessToken() {
  if (!PAYPAL_CONFIG.clientId || !PAYPAL_CONFIG.clientSecret) {
    throw new Error('Missing PayPal credentials')
  }

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
    const error = await response.text()
    throw new Error(`Failed to get PayPal access token: ${error}`)
  }

  const data = await response.json()
  return data.access_token as string
}

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
      'PayPal-Request-Id': `${userId}:${plan}:${crypto.randomUUID()}`,
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
      application_context: {
        shipping_preference: 'NO_SHIPPING',
        user_action: 'PAY_NOW',
      },
    }),
  })

  if (!response.ok) {
    const error = await response.text()
    throw new Error(`Failed to create PayPal order: ${error}`)
  }

  return await response.json()
}

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

async function completeOrder(orderId: string) {
  const { data: order, error: orderError } = await supabase
    .from('orders')
    .select('id, user_id, credits_purchased, status, metadata')
    .eq('payment_intent_id', orderId)
    .maybeSingle()

  if (orderError) {
    throw new Error(`Failed to load order: ${orderError.message}`)
  }

  if (!order) {
    throw new Error('Order record not found')
  }

  if (order.status === 'completed') {
    return { alreadyCompleted: true, order }
  }

  const completedAt = new Date().toISOString()
  const { error: updateError } = await supabase
    .from('orders')
    .update({
      status: 'completed',
      completed_at: completedAt,
    })
    .eq('id', order.id)

  if (updateError) {
    throw new Error(`Failed to update order: ${updateError.message}`)
  }

  const plan = order.metadata?.plan || 'paypal'
  const { error: creditError } = await supabase.rpc('add_credits', {
    user_id: order.user_id,
    amount: order.credits_purchased,
    transaction_type: 'purchase',
    description: `Purchased ${plan} pack via PayPal`,
    order_id: order.id,
  })

  if (creditError) {
    throw new Error(`Failed to add credits: ${creditError.message}`)
  }

  return { alreadyCompleted: false, order }
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    const { method } = req
    const path = new URL(req.url).pathname

    if (method === 'POST' && matchesRoute(path, '/create-order')) {
      const user = await getAuthenticatedUser(req)
      const { plan } = await req.json()
      if (!plan) {
        throw new Error('Missing plan')
      }

      const pricingPlan = PRICING_PLANS[plan]
      if (!pricingPlan) {
        throw new Error('Invalid plan')
      }

      const paypalOrder = await createPayPalOrder(plan, user.id)
      const { data: order, error: insertError } = await supabase
        .from('orders')
        .insert({
          user_id: user.id,
          amount: pricingPlan.amount,
          currency: pricingPlan.currency,
          credits_purchased: pricingPlan.credits,
          status: 'pending',
          payment_provider: 'paypal',
          payment_intent_id: paypalOrder.id,
          metadata: { plan },
        })
        .select('id')
        .single()

      if (insertError) {
        throw new Error(`Failed to create order record: ${insertError.message}`)
      }

      return new Response(
        JSON.stringify({
          orderId: paypalOrder.id,
          appOrderId: order.id,
        }),
        {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        }
      )
    }

    if (method === 'POST' && matchesRoute(path, '/capture-order')) {
      await getAuthenticatedUser(req)
      const { orderId } = await req.json()
      if (!orderId) {
        throw new Error('Missing orderId')
      }

      const captureData = await capturePayPalOrder(orderId)
      if (captureData.status !== 'COMPLETED') {
        throw new Error(`Unexpected PayPal capture status: ${captureData.status}`)
      }

      const completion = await completeOrder(orderId)
      return new Response(
        JSON.stringify({
          success: true,
          alreadyCompleted: completion.alreadyCompleted,
          data: captureData,
        }),
        {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        }
      )
    }

    if (method === 'POST' && matchesRoute(path, '/webhook')) {
      const body = await req.json()

      if (body.event_type === 'CHECKOUT.ORDER.APPROVED') {
        return new Response(JSON.stringify({ received: true }), {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        })
      }

      if (body.event_type === 'PAYMENT.CAPTURE.COMPLETED') {
        const orderId = body.resource?.supplementary_data?.related_ids?.order_id
        if (orderId) {
          console.log(`Received PayPal capture webhook for order ${orderId}`)
        }
      }

      return new Response(JSON.stringify({ received: true }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    return new Response('Not found', { status: 404, headers: corsHeaders })
  } catch (error) {
    console.error('PayPal function error:', error)
    return new Response(
      JSON.stringify({ error: error.message }),
      {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      }
    )
  }
})
