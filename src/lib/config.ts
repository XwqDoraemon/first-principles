// Supabase 配置
export const supabaseConfig = {
  url: 'https://bmstklfbnyevuyxidmhv.supabase.co',
  anonKey: 'sb_publishable_wnQx8LZ7qUgVAsVOaEnuVQ_Ede5tM3w'
};

// API 端点
export const API_ENDPOINTS = {
  chat: `${supabaseConfig.url}/functions/v1/chat`,
  conversations: `${supabaseConfig.url}/rest/v1/conversations`,
  messages: `${supabaseConfig.url}/rest/v1/messages`,
  health: `${supabaseConfig.url}/functions/v1/health`
};