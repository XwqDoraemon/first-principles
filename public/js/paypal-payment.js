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

let paypalSdkPromise = null
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
  const session = window.getCurrentSession
    ? await window.getCurrentSession()
    : (await window.supabaseClient?.auth.getSession())?.data?.session

  if (!session?.user) {
    window.openAuthModal?.()
    throw new Error('Please sign in first to purchase credits.')
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
  const response = await fetch(`${PAYPAL_FUNCTION_URL}/create-order`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${accessToken}`,
    },
    body: JSON.stringify({ plan }),
  })

  const data = await response.json().catch(() => ({}))
  if (!response.ok) {
    throw new Error(data.error || 'Failed to create PayPal order')
  }

  return data
}

async function capturePayPalOrder(orderId, accessToken) {
  const response = await fetch(`${PAYPAL_FUNCTION_URL}/capture-order`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${accessToken}`,
    },
    body: JSON.stringify({ orderId }),
  })

  const data = await response.json().catch(() => ({}))
  if (!response.ok) {
    throw new Error(data.error || 'Failed to capture PayPal order')
  }

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
        closePayPalModal()
        await window.refreshUserCredits?.()
        window.location.href = '/pricing.html?paypal=success'
      }
    },
    onCancel: () => {
      setPayPalStatus('Payment was cancelled. You can try again.')
    },
    onError: (error) => {
      console.error('PayPal checkout error:', error)
      setPayPalStatus('PayPal checkout failed. Please try again.', true)
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
      alert(error.message)
    }
  }
}

function checkPayPalPaymentResult() {
  const urlParams = new URLSearchParams(window.location.search)
  const success = urlParams.get('paypal')

  if (success === 'success') {
    setTimeout(async () => {
      await window.refreshUserCredits?.()
      alert('Payment successful. Your credits have been added to your account.')
      window.history.replaceState({}, '', '/pricing.html')
    }, 300)
  }
}

window.handlePayPalPayment = handlePayPalPayment
window.closePayPalModal = closePayPalModal
window.checkPayPalPaymentResult = checkPayPalPaymentResult
