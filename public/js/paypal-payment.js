// PayPal 支付集成配置
const PAYPAL_CONFIG = {
  // PayPal Client ID (沙盒环境)
  clientId: 'AU_ZropTaP02Cbe_FaE1mz2h0TGiNh2G0RadG69OFbpDRDrA4wc19xhY30w61q_egWrWSEDQ6TIOE-dD',
  
  // PayPal SDK URL
  sdkUrl: 'https://www.paypal.com/sdk/js?client-id=AU_ZropTaP02Cbe_FaE1mz2h0TGiNh2G0RadG69OFbpDRDrA4wc19xhY30w61q_egWrWSEDQ6TIOE-dD&currency=USD',
  
  // 价格配置
  plans: {
    basic: {
      name: 'Basic Pack',
      amount: 0.99,
      credits: 5,
    },
    pro: {
      name: 'Pro Pack',
      amount: 4.99,
      credits: 30,
    },
  },
}

// ==================== PayPal 支付相关函数 ====================

/**
 * 初始化 PayPal SDK
 */
let paypalLoaded = false
function loadPayPalSDK() {
  return new Promise((resolve, reject) => {
    if (paypalLoaded) {
      resolve()
      return
    }

    const script = document.createElement('script')
    script.src = PAYPAL_CONFIG.sdkUrl
    script.onload = () => {
      paypalLoaded = true
      resolve()
    }
    script.onerror = () => reject(new Error('Failed to load PayPal SDK'))
    document.head.appendChild(script)
  })
}

/**
 * 创建 PayPal 订单
 * @param {string} plan - 计划类型 ('basic' | 'pro')
 * @param {string} userId - 用户 ID
 * @returns {Promise<{orderId: string, approvalUrl: string}>}
 */
async function createPayPalOrder(plan, userId) {
  try {
    const response = await fetch(`${SUPABASE_URL}/functions/v1/payment-paypal/create-order`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${SUPABASE_ANON_KEY}`,
      },
      body: JSON.stringify({ plan, userId }),
    })

    if (!response.ok) {
      throw new Error('Failed to create PayPal order')
    }

    return await response.json()
  } catch (error) {
    console.error('Error creating PayPal order:', error)
    throw error
  }
}

/**
 * 捕获 PayPal 支付
 * @param {string} orderId - PayPal 订单 ID
 * @returns {Promise<Object>}
 */
async function capturePayPalOrder(orderId) {
  try {
    const response = await fetch(`${SUPABASE_URL}/functions/v1/payment-paypal/capture-order`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${SUPABASE_ANON_KEY}`,
      },
      body: JSON.stringify({ orderId }),
    })

    if (!response.ok) {
      throw new Error('Failed to capture PayPal order')
    }

    return await response.json()
  } catch (error) {
    console.error('Error capturing PayPal order:', error)
    throw error
  }
}

/**
 * 使用 PayPal 按钮支付
 * @param {string} plan - 计划类型
 */
async function handlePayPalPayment(plan) {
  // 检查用户是否已登录
  const { data: { user } } = await window.supabaseClient.auth.getUser()
  
  if (!user) {
    alert('请先登录以购买积分')
    window.location.href = '/chat.html#signin'
    return
  }

  try {
    // 显示加载状态
    const btn = event.target
    const originalText = btn.textContent
    btn.textContent = '处理中...'
    btn.disabled = true

    // 加载 PayPal SDK
    await loadPayPalSDK()

    // 创建 PayPal 订单
    const { orderId } = await createPayPalOrder(plan, user.id)

    // 使用 PayPal JS SDK 渲染按钮并跳转
    if (window.paypal) {
      window.paypal.Buttons({
        createOrder: () => orderId,
        onApprove: async (data) => {
          // 用户授权后，捕获支付
          const captureResult = await capturePayPalOrder(data.orderID)
          
          if (captureResult.success) {
            alert('🎉 支付成功！积分已添加到您的账户')
            window.location.href = '/pricing.html?success=true'
          }
        },
        onError: (err) => {
          console.error('PayPal error:', err)
          alert('支付失败，请重试')
          btn.textContent = originalText
          btn.disabled = false
        },
        onCancel: () => {
          alert('支付已取消')
          btn.textContent = originalText
          btn.disabled = false
        },
      }).render('body').then(() => {
        // 自动点击 PayPal 按钮
        setTimeout(() => {
          document.querySelector('.paypal-buttons')?.click()
        }, 500)
      })
    }
  } catch (error) {
    console.error('Error:', error)
    alert('创建订单失败，请重试')
    
    // 恢复按钮状态
    const btn = event.target
    btn.textContent = originalText
    btn.disabled = false
  }
}

/**
 * 检查支付结果
 */
function checkPayPalPaymentResult() {
  const urlParams = new URLSearchParams(window.location.search)
  const success = urlParams.get('success')
  const token = urlParams.get('token') // PayPal 返回的订单 ID

  if (success === 'true' && token) {
    // 支付成功，显示确认消息
    setTimeout(() => {
      alert('🎉 支付成功！您的积分已添加到账户')
      // 清除 URL 参数
      window.history.replaceState({}, '', '/pricing.html')
    }, 500)
  }
}
