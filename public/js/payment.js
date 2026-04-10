// 支付集成配置
const STRIPE_CONFIG = {
  // 替换为你的 Stripe 可发布密钥 (PK)
  publishableKey: 'pk_test_your_stripe_publishable_key_here',
  
  // 价格配置
  plans: {
    basic: {
      name: 'Basic Pack',
      amount: 0.99,
      credits: 10,
    },
    pro: {
      name: 'Pro Pack',
      amount: 4.99,
      credits: 60,
    },
  },
}

// ==================== 支付相关函数 ====================

/**
 * 创建支付意图
 * @param {string} plan - 计划类型 ('basic' | 'pro')
 * @param {string} userId - 用户 ID
 * @returns {Promise<{clientSecret: string, orderId: string}>}
 */
async function createPaymentIntent(plan, userId) {
  try {
    const response = await fetch(`${SUPABASE_URL}/functions/v1/payment/create-payment-intent`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'apikey': SUPABASE_ANON_KEY,
        'Authorization': `Bearer ${SUPABASE_ANON_KEY}`,
      },
      body: JSON.stringify({ plan, userId }),
    })

    if (!response.ok) {
      throw new Error('Failed to create payment intent')
    }

    return await response.json()
  } catch (error) {
    console.error('Error creating payment intent:', error)
    throw error
  }
}

/**
 * 获取用户积分余额
 * @param {string} token - 用户认证 token
 * @returns {Promise<{credits: number, totalSessions: number}>}
 */
async function getUserCredits(token) {
  try {
    const response = await fetch(`${SUPABASE_URL}/functions/v1/payment/credits`, {
      method: 'GET',
      headers: {
        'apikey': SUPABASE_ANON_KEY,
        'Authorization': `Bearer ${token}`,
      },
    })

    if (!response.ok) {
      throw new Error('Failed to fetch user credits')
    }

    return await response.json()
  } catch (error) {
    console.error('Error fetching credits:', error)
    return { credits: 0, totalSessions: 0 }
  }
}

/**
 * 初始化 Stripe
 */
let stripe = null
function initStripe() {
  if (typeof Stripe !== 'undefined' && !stripe) {
    stripe = Stripe(STRIPE_CONFIG.publishableKey)
  }
  return stripe
}

/**
 * 处理支付按钮点击
 * @param {string} plan - 计划类型
 */
async function handlePayment(plan) {
  // 检查用户是否已登录
  const { data: { user } } = await window.supabaseClient.auth.getUser()
  
  if (!user) {
    alert('Please sign in first to purchase credits')
    window.location.href = '/chat.html#signin'
    return
  }

  try {
    // 显示加载状态
    const btn = event.target
    const originalText = btn.textContent
    btn.textContent = 'Processing...'
    btn.disabled = true

    // 创建支付意图
    const { clientSecret, orderId } = await createPaymentIntent(plan, user.id)

    // 初始化 Stripe
    const stripeInstance = initStripe()
    
    // 重定向到 Stripe Checkout
    const { error } = await stripeInstance.confirmPayment({
      clientSecret,
      confirmParams: {
        return_url: `${window.location.origin}/pricing.html?success=true&order=${orderId}`,
      },
    })

    if (error) {
      console.error('Payment error:', error)
      alert('Payment failed: ' + error.message)
      btn.textContent = originalText
      btn.disabled = false
    }
  } catch (error) {
    console.error('Error:', error)
    alert('Failed to process payment. Please try again.')
    
    // 恢复按钮状态
    const btn = event.target
    btn.textContent = originalText
    btn.disabled = false
  }
}

/**
 * 检查支付结果
 */
function checkPaymentResult() {
  const urlParams = new URLSearchParams(window.location.search)
  const success = urlParams.get('success')
  const orderId = urlParams.get('order')

  if (success === 'true' && orderId) {
    // 支付成功，显示确认消息
    setTimeout(() => {
      alert('🎉 Payment successful! Your credits have been added to your account.')
      // 清除 URL 参数
      window.history.replaceState({}, '', '/pricing.html')
    }, 500)
  }
}
