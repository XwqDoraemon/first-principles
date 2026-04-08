// Supabase Auth 认证配置和函数

const SUPABASE_URL = 'https://bmstklfbnyevuyxidmhv.supabase.co';
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImJtc3RrbGZibnlldnV5eGlkbWh2Iiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc3NTE5MjIxNywiZXhwIjoyMDkwNzY4MjE3fQ.vOF2sa_QnbJ4r510GnAn4I3ZtPiRjXXj2yyhEhU7Pnc';

const supabase = supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

// ==================== 认证状态管理 ====================

/**
 * 检查用户登录状态
 * @returns {Promise<Object|null>} 用户信息或 null
 */
async function getCurrentUser() {
  try {
    const { data: { user } } = await supabase.auth.getUser();
    return user;
  } catch (error) {
    console.error('Error getting user:', error);
    return null;
  }
}

/**
 * 监听认证状态变化
 * @param {Function} callback - 状态变化回调
 */
function onAuthStateChange(callback) {
  supabase.auth.onAuthStateChange((event, session) => {
    callback(event, session?.user || null);
  });
}

// ==================== Google 登录 ====================

/**
 * 使用 Google OAuth 登录
 */
async function signInWithGoogle() {
  try {
    const { data, error } = await supabase.auth.signInWithOAuth({
      provider: 'google',
      options: {
        redirectTo: `${window.location.origin}/chat.html`,
        queryParams: {
          access_type: 'offline',
          prompt: 'consent',
        },
      },
    });

    if (error) throw error;
    
    // Supabase 会自动重定向到 Google
    console.log('Redirecting to Google OAuth...');
  } catch (error) {
    console.error('Error signing in with Google:', error);
    alert('登录失败，请重试');
  }
}

// ==================== 邮箱登录 ====================

/**
 * 使用邮箱密码登录
 * @param {string} email - 邮箱
 * @param {string} password - 密码
 */
async function signInWithEmail(email, password) {
  try {
    const { data, error } = await supabase.auth.signInWithPassword({
      email,
      password,
    });

    if (error) throw error;
    
    return { success: true, user: data.user };
  } catch (error) {
    console.error('Error signing in:', error);
    return { success: false, error: error.message };
  }
}

/**
 * 注册新用户
 * @param {string} email - 邮箱
 * @param {string} password - 密码
 */
async function signUpWithEmail(email, password) {
  try {
    const { data, error } = await supabase.auth.signUp({
      email,
      password,
    });

    if (error) throw error;
    
    return { success: true, user: data.user };
  } catch (error) {
    console.error('Error signing up:', error);
    return { success: false, error: error.message };
  }
}

// ==================== 退出登录 ====================

/**
 * 退出登录
 */
async function signOut() {
  try {
    const { error } = await supabase.auth.signOut();
    if (error) throw error;
    
    // 重定向到首页
    window.location.href = '/';
  } catch (error) {
    console.error('Error signing out:', error);
    alert('退出失败，请重试');
  }
}

// ==================== UI 更新 ====================

/**
 * 更新 UI 显示用户信息
 * @param {Object} user - 用户信息
 */
function updateUserUI(user) {
  const userMenu = document.getElementById('userMenu');
  const userName = document.getElementById('userName');
  const userAvatar = document.getElementById('userAvatar');

  if (!userMenu) return;

  if (user) {
    // 用户已登录
    const email = user.email;
    const avatarUrl = user.user_metadata?.avatar_url || user.user_metadata?.picture;
    
    if (userName) userName.textContent = email;
    if (userAvatar && avatarUrl) userAvatar.src = avatarUrl;
    
    userMenu.classList.remove('hidden');
    userMenu.classList.add('logged-in');
  } else {
    // 用户未登录
    userMenu.classList.add('hidden');
    userMenu.classList.remove('logged-in');
  }
}

/**
 * 显示用户积分余额
 */
async function displayUserCredits() {
  const user = await getCurrentUser();
  if (!user) return;

  try {
    const response = await fetch(`${SUPABASE_URL}/functions/v1/payment/credits`, {
      method: 'GET',
      headers: {
        'Authorization': `Bearer ${SUPABASE_ANON_KEY}`,
      },
    });

    if (response.ok) {
      const data = await response.json();
      const creditsDisplay = document.getElementById('userCredits');
      if (creditsDisplay) {
        creditsDisplay.textContent = `${data.credits} 积分`;
      }
    }
  } catch (error) {
    console.error('Error fetching credits:', error);
  }
}

// ==================== 初始化 ====================

/**
 * 页面加载时检查认证状态
 */
document.addEventListener('DOMContentLoaded', async () => {
  // 监听认证状态变化
  onAuthStateChange((event, user) => {
    console.log('Auth event:', event, user);
    updateUserUI(user);
    
    if (user) {
      displayUserCredits();
    }
  });

  // 检查当前用户
  const user = await getCurrentUser();
  updateUserUI(user);
  
  if (user) {
    displayUserCredits();
  }
});
