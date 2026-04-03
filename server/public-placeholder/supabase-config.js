// First Principles Supabase 配置
// 前端使用此配置连接到 Supabase 后端

const SUPABASE_CONFIG = {
  // 开发环境配置
  development: {
    supabaseUrl: 'http://localhost:54321',
    supabaseAnonKey: 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZS1kZW1vIiwicm9sZSI6ImFub24iLCJleHAiOjE5ODM4MTI5OTZ9.CRXP1A7WOeoJeXxjNni43kdQwgnWNReilDMblYTn_I0',
    apiBaseUrl: 'http://localhost:54321/functions/v1',
    realtimeEnabled: true,
  },
  
  // 生产环境配置 (部署到 Cloudflare 时使用)
  production: {
    supabaseUrl: 'https://your-project-ref.supabase.co',
    supabaseAnonKey: 'your-anon-key-here',
    apiBaseUrl: 'https://your-project-ref.supabase.co/functions/v1',
    realtimeEnabled: true,
  }
};

// 根据当前环境选择配置
const getConfig = () => {
  const hostname = window.location.hostname;
  
  if (hostname === 'localhost' || hostname === '127.0.0.1') {
    return SUPABASE_CONFIG.development;
  } else {
    return SUPABASE_CONFIG.production;
  }
};

// 导出配置
const config = getConfig();

// Supabase 客户端初始化
const { createClient } = supabase;
const supabaseClient = createClient(config.supabaseUrl, config.supabaseAnonKey);

// API 端点
const API_ENDPOINTS = {
  chat: `${config.apiBaseUrl}/chat`,
  crewai: `${config.apiBaseUrl}/crewai`,
  health: `${config.apiBaseUrl}/health`,
  
  // REST API (自动生成)
  conversations: `${config.supabaseUrl}/rest/v1/conversations`,
  messages: `${config.supabaseUrl}/rest/v1/messages`,
  thinkingSessions: `${config.supabaseUrl}/rest/v1/thinking_sessions`,
  mindmaps: `${config.supabaseUrl}/rest/v1/mindmaps`,
};

// 认证工具
const Auth = {
  // 获取当前用户
  async getCurrentUser() {
    const { data: { user }, error } = await supabaseClient.auth.getUser();
    if (error) throw error;
    return user;
  },
  
  // 注册新用户
  async signUp(email, password, username) {
    const { data, error } = await supabaseClient.auth.signUp({
      email,
      password,
      options: {
        data: {
          username,
        }
      }
    });
    
    if (error) throw error;
    return data;
  },
  
  // 登录
  async signIn(email, password) {
    const { data, error } = await supabaseClient.auth.signInWithPassword({
      email,
      password,
    });
    
    if (error) throw error;
    return data;
  },
  
  // 登出
  async signOut() {
    const { error } = await supabaseClient.auth.signOut();
    if (error) throw error;
  },
  
  // 获取会话
  async getSession() {
    const { data: { session }, error } = await supabaseClient.auth.getSession();
    if (error) throw error;
    return session;
  },
};

// API 调用工具
const API = {
  // 通用请求方法
  async request(endpoint, options = {}) {
    const session = await Auth.getSession();
    const token = session?.access_token;
    
    const headers = {
      'Content-Type': 'application/json',
      ...options.headers,
    };
    
    if (token) {
      headers['Authorization'] = `Bearer ${token}`;
    }
    
    const response = await fetch(endpoint, {
      ...options,
      headers,
    });
    
    if (!response.ok) {
      const error = await response.json().catch(() => ({ error: '请求失败' }));
      throw new Error(error.error || `HTTP ${response.status}`);
    }
    
    return response.json();
  },
  
  // 聊天 API
  async sendMessage(messages, conversationId = null) {
    const user = await Auth.getCurrentUser();
    
    return this.request(API_ENDPOINTS.chat, {
      method: 'POST',
      body: JSON.stringify({
        messages,
        conversationId,
        userId: user.id,
      }),
    });
  },
  
  // CrewAI API
  async startThinking(userInput, conversationId = null, phase = 'anchor') {
    const user = await Auth.getCurrentUser();
    
    return this.request(API_ENDPOINTS.crewai, {
      method: 'POST',
      body: JSON.stringify({
        action: 'start',
        userInput,
        conversationId,
        userId: user.id,
        phase,
      }),
    });
  },
  
  async getThinkingStatus(sessionId) {
    return this.request(API_ENDPOINTS.crewai, {
      method: 'POST',
      body: JSON.stringify({
        action: 'status',
        sessionId,
      }),
    });
  },
  
  async listThinkingSessions() {
    const user = await Auth.getCurrentUser();
    
    return this.request(API_ENDPOINTS.crewai, {
      method: 'POST',
      body: JSON.stringify({
        action: 'list',
        userId: user.id,
      }),
    });
  },
  
  // 健康检查
  async checkHealth() {
    return this.request(API_ENDPOINTS.health, {
      method: 'GET',
    });
  },
  
  // 数据查询
  async getConversations(limit = 20) {
    return this.request(`${API_ENDPOINTS.conversations}?select=*&order=created_at.desc&limit=${limit}`);
  },
  
  async getMessages(conversationId, limit = 50) {
    return this.request(
      `${API_ENDPOINTS.messages}?conversation_id=eq.${conversationId}&select=*&order=created_at.asc&limit=${limit}`
    );
  },
  
  async createConversation(title = 'New Session') {
    const user = await Auth.getCurrentUser();
    
    return this.request(API_ENDPOINTS.conversations, {
      method: 'POST',
      body: JSON.stringify({
        user_id: user.id,
        title,
        status: 'active',
      }),
    });
  },
};

// 实时订阅
const Realtime = {
  // 订阅对话更新
  subscribeToConversation(conversationId, callback) {
    if (!config.realtimeEnabled) {
      console.warn('实时功能未启用');
      return null;
    }
    
    return supabaseClient
      .channel(`conversation:${conversationId}`)
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'messages',
          filter: `conversation_id=eq.${conversationId}`,
        },
        (payload) => {
          callback(payload.new);
        }
      )
      .subscribe();
  },
  
  // 订阅思考会话更新
  subscribeToThinkingSession(sessionId, callback) {
    if (!config.realtimeEnabled) {
      console.warn('实时功能未启用');
      return null;
    }
    
    return supabaseClient
      .channel(`thinking:${sessionId}`)
      .on(
        'postgres_changes',
        {
          event: 'UPDATE',
          schema: 'public',
          table: 'thinking_sessions',
          filter: `crewai_session_id=eq.${sessionId}`,
        },
        (payload) => {
          callback(payload.new);
        }
      )
      .subscribe();
  },
  
  // 取消订阅
  unsubscribe(channel) {
    if (channel) {
      supabaseClient.removeChannel(channel);
    }
  },
};

// 导出所有工具
window.FirstPrinciples = {
  config,
  supabase: supabaseClient,
  Auth,
  API,
  Realtime,
  
  // 初始化函数
  async init() {
    try {
      // 检查连接
      const health = await API.checkHealth();
      console.log('First Principles 初始化成功:', health);
      
      // 自动恢复会话
      const session = await Auth.getSession();
      if (session) {
        console.log('用户已登录:', session.user.email);
      }
      
      return { success: true, health };
    } catch (error) {
      console.error('First Principles 初始化失败:', error);
      return { success: false, error: error.message };
    }
  },
};

// 自动初始化
document.addEventListener('DOMContentLoaded', () => {
  if (window.supabase) {
    window.FirstPrinciples.init().then(result => {
      if (!result.success) {
        console.warn('First Principles 后端连接失败，使用本地模式');
        // 可以在这里启用本地回退模式
      }
    });
  } else {
    console.error('Supabase 客户端未加载，请确保已引入 supabase-js');
  }
});