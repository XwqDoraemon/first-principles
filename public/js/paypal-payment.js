// PayPal payment integration
const PAYPAL_CONFIG = {
  clientId: window.PAYPAL_CLIENT_ID || 'AU_ZropTaP02Cbe_FaE1mz2h0TGiNh2G0RadG69OFbpDRDrA4wc19xhY30w61q_egWrWSEDQ6TIOE-dD',
  currency: 'USD',
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

const DEFAULT_SUPABASE_URL = 'https://bmstklfbnyevuyxidmhv.supabase.co'
const PAYPAL_FUNCTION_URL = `${window.APP_SUPABASE_URL || DEFAULT_SUPABASE_URL}/functions/v1/payment-paypal`
const PAYPAL_NOTICE_STORAGE_KEY = 'paypal_payment_notice'

let paypalSdkPromise = null
let lastPayPalErrorMessage = ''

function showPayPalNotice(message, state = 'info', options = {}) {
  if (typeof window.showPaymentNotice === 'function') {
    window.showPaymentNotice(message, state, options)
    return
  }

  if (message) {
    alert(message)
  }
}

function persistPayPalNotice(notice) {
  try {
    window.sessionStorage?.setItem(PAYPAL_NOTICE_STORAGE_KEY, JSON.stringify(notice))
  } catch (error) {
    console.warn('Failed to persist PayPal notice:', error)
  }
}

function consumePayPalNotice() {
  try {
    const raw = window.sessionStorage?.getItem(PAYPAL_NOTICE_STORAGE_KEY)
    if (!raw) {
      return null
    }

    window.sessionStorage.removeItem(PAYPAL_NOTICE_STORAGE_KEY)
    return JSON.parse(raw)
  } catch (error) {
    console.warn('Failed to consume PayPal notice:', error)
    return null
  }
}

function getPayPalModalElements() {
  return {
    modal: document.getElementById('paypalCheckoutModal'),
    planName: document.getElementById('paypalPlanName'),
    planMeta: document.getElementById('paypalPlanMeta'),
    status: document.getElementById('paypalStatus'),
    container: document.getElementById('paypalButtonContainer'),
  }
}

function setPayPalStatus(message, isError = false) {
  const { status } = getPayPalModalElements()
  if (!status) return

  status.textContent = message
  status.dataset.state = isError ? 'error' : 'default'
}

function openPayPalModal(plan) {
  const pricingPlan = PAYPAL_CONFIG.plans[plan]
  const { modal, planName, planMeta, container } = getPayPalModalElements()
  if (!modal || !pricingPlan) return

  planName.textContent = pricingPlan.name
  planMeta.textContent = `$${pricingPlan.amount.toFixed(2)} • ${pricingPlan.credits} credits`
  container.innerHTML = ''
  setPayPalStatus('Choose PayPal below to complete your purchase.')
  modal.classList.add('active')
}

function closePayPalModal() {
  const { modal, container } = getPayPalModalElements()
  if (!modal) return

  modal.classList.remove('active')
  container.innerHTML = ''
}

async function requireAuthenticatedSession() {
  let session = window.getCurrentSession
    ? await window.getCurrentSession()
    : (await window.supabaseClient?.auth.getSession())?.data?.session

  if (!session?.user) {
    window.openAuthModal?.()
    throw new Error('Please sign in first to purchase credits.')
  }

  if (window.supabaseClient?.auth?.refreshSession) {
    const { data, error } = await window.supabaseClient.auth.refreshSession()
    if (!error && data.session?.access_token) {
      session = data.session
    }
  }

  return session
}

function loadPayPalSDK() {
  if (window.paypal) {
    return Promise.resolve(window.paypal)
  }

  if (paypalSdkPromise) {
    return paypalSdkPromise
  }

  paypalSdkPromise = new Promise((resolve, reject) => {
    const script = document.createElement('script')
    script.src = `https://www.paypal.com/sdk/js?client-id=${encodeURIComponent(PAYPAL_CONFIG.clientId)}&currency=${PAYPAL_CONFIG.currency}&intent=capture&components=buttons`
    script.onload = () => resolve(window.paypal)
    script.onerror = () => {
      paypalSdkPromise = null
      reject(new Error('Failed to load PayPal SDK'))
    }
    document.head.appendChild(script)
  })

  return paypalSdkPromise
}

async function createPayPalOrder(plan, accessToken) {
  const sendRequest = async (token) => fetch(`${PAYPAL_FUNCTION_URL}/create-order`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'apikey': window.APP_SUPABASE_ANON_KEY,
      'Authorization': `Bearer ${token}`,
    },
    body: JSON.stringify({ plan }),
  })

  let response = await sendRequest(accessToken)
  let data = await response.json().catch(() => ({}))

  if (response.status === 401 && window.supabaseClient?.auth?.refreshSession) {
    const { data: refreshed, error } = await window.supabaseClient.auth.refreshSession()
    const refreshedToken = refreshed.session?.access_token
    if (!error && refreshedToken) {
      response = await sendRequest(refreshedToken)
      data = await response.json().catch(() => ({}))
    }
  }

  if (!response.ok) {
    const errorMessage = data.error || data.message || data.details || `Failed to create PayPal order (${response.status})`
    console.error('PayPal create-order failed:', {
      status: response.status,
      body: data,
    })
    lastPayPalErrorMessage = errorMessage
    throw new Error(errorMessage)
  }

  lastPayPalErrorMessage = ''
  return data
}

async function capturePayPalOrder(orderId, accessToken) {
  const sendRequest = async (token) => fetch(`${PAYPAL_FUNCTION_URL}/capture-order`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'apikey': window.APP_SUPABASE_ANON_KEY,
      'Authorization': `Bearer ${token}`,
    },
    body: JSON.stringify({ orderId }),
  })

  let response = await sendRequest(accessToken)
  let data = await response.json().catch(() => ({}))

  if (response.status === 401 && window.supabaseClient?.auth?.refreshSession) {
    const { data: refreshed, error } = await window.supabaseClient.auth.refreshSession()
    const refreshedToken = refreshed.session?.access_token
    if (!error && refreshedToken) {
      response = await sendRequest(refreshedToken)
      data = await response.json().catch(() => ({}))
    }
  }

  if (!response.ok) {
    const errorMessage = data.error || data.message || data.details || `Failed to capture PayPal order (${response.status})`
    console.error('PayPal capture-order failed:', {
      status: response.status,
      body: data,
    })
    lastPayPalErrorMessage = errorMessage
    throw new Error(errorMessage)
  }

  lastPayPalErrorMessage = ''
  return data
}

async function renderPayPalButtons(plan, accessToken) {
  const { container } = getPayPalModalElements()
  if (!container) {
    throw new Error('Missing PayPal container')
  }

  container.innerHTML = ''
  const buttons = window.paypal.Buttons({
    style: {
      layout: 'vertical',
      shape: 'rect',
      label: 'paypal',
      tagline: false,
    },
    createOrder: async () => {
      setPayPalStatus('Creating your order...')
      const result = await createPayPalOrder(plan, accessToken)
      setPayPalStatus('Order created. Continue in the PayPal popup.')
      return result.orderId
    },
    onApprove: async (data) => {
      setPayPalStatus('Payment approved. Confirming your credits...')
      const result = await capturePayPalOrder(data.orderID, accessToken)

      if (result.success) {
        persistPayPalNotice({
          state: 'success',
          title: 'Credits added',
          message: 'Payment successful. Your credits have been added to your account.',
        })
        closePayPalModal()
        await window.refreshUserCredits?.()
        window.location.href = '/pricing?paypal=success'
      }
    },
    onCancel: () => {
      setPayPalStatus('Payment was cancelled. You can try again.')
      showPayPalNotice('Payment was cancelled. No charge was made.', 'info', {
        title: 'Checkout cancelled',
      })
    },
    onError: (error) => {
      console.error('PayPal checkout error:', error)
      const message = lastPayPalErrorMessage || error?.message || 'PayPal checkout failed. Please try again.'
      setPayPalStatus(message, true)
      showPayPalNotice(message, 'error', {
        title: 'Payment failed',
        duration: 7000,
      })
    },
  })

  await buttons.render(container)
}

async function handlePayPalPayment(plan) {
  try {
    const session = await requireAuthenticatedSession()
    await loadPayPalSDK()
    openPayPalModal(plan)
    await renderPayPalButtons(plan, session.access_token)
  } catch (error) {
    console.error('Error starting PayPal payment:', error)
    if (error.message) {
      showPayPalNotice(error.message, 'error', {
        title: 'Payment failed',
        duration: 7000,
      })
    }
  }
}

function checkPayPalPaymentResult() {
  const urlParams = new URLSearchParams(window.location.search)
  const success = urlParams.get('paypal')
  const storedNotice = consumePayPalNotice()

  if (success === 'success') {
    setTimeout(async () => {
      await window.refreshUserCredits?.()
      const notice = storedNotice || {
        state: 'success',
        title: 'Credits added',
        message: 'Payment successful. Your credits have been added to your account.',
      }
      showPayPalNotice(notice.message, notice.state, {
        title: notice.title,
      })
      window.history.replaceState({}, '', '/pricing')
    }, 300)
    return
  }

  if (storedNotice?.message) {
    showPayPalNotice(storedNotice.message, storedNotice.state, {
      title: storedNotice.title,
    })
  }
}

window.handlePayPalPayment = handlePayPalPayment
window.closePayPalModal = closePayPalModal
window.checkPayPalPaymentResult = checkPayPalPaymentResult
