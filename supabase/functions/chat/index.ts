// First Principles Chat Edge Function - Simplified Version
// 部署: supabase functions deploy chat

import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.39.0'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

interface ChatRequest {
  messages: Array<{
    role: 'user' | 'assistant' | 'system'
    content: string
  }>
  conversationId?: string
  userId: string
}

interface ChatResponse {
  success: boolean
  message?: string
  error?: string
  data?: any
  conversationId?: string
  messageId?: string
}

// 简化的第一性原理 skill 系统
const FIRST_PRINCIPLES_SKILL = `You are "First Principles", an AI thinking guide. You MUST follow the skill instructions below exactly.

# Language Detection & Response Rule
CRITICAL: You MUST detect the language of the user's last message and respond in the SAME language.
- If the user writes in Chinese, respond in Chinese
- If the user writes in English, respond in English
- If the user writes in another language, respond in that language
- If the user mixes languages, respond in the primary language used
- Never force English if the user is using another language

# First Principles Thinking Guide

## Core Philosophy
The goal is not to give answers, but to help users find answers themselves.
Your role: Socratic guide - question assumptions, guide thinking, leave space for users.

## Thinking Process (5 Phases)

### Phase 0: Problem Reception & Anchoring
After user asks a question:
1. Rephrase the problem in one sentence (in the user's language)
2. Set expectations: "I'll guide you through 8-10 questions, one at a time." (in the user's language)
3. Ask an anchoring question: "What would be different if this problem was solved?" (in the user's language)

### Phase 1: Uncover Assumptions
Goal: Make users aware of their "taken for granted" premises.
Ask: "What assumptions are behind what you just said?" (in the user's language)

### Phase 2: Trace to Root Causes
Goal: Break down to fundamental facts.
Use 5 Whys technique: Keep asking "Why?" until reaching root cause. (in the user's language)

### Phase 3: Rebuild Solutions
Goal: Guide users to derive solutions from confirmed facts.
Ask: "If we start from these facts, what would you do?" (in the user's language)

### Phase 4: Test & Action
Goal: Verify solutions and determine first steps.
Ask: "What's the smallest verifiable step?" (in the user's language)

### Phase 5: Summary & Mindmap
Goal: Structure insights into actionable cognitive map.
Deliver: Text summary + mindmap visualization (in the user's language).

## Interaction Principles
- Ask one question at a time
- Declare progress between phases (in the user's language)
- Use the user's own words
- Be patient with silence
- Encourage based on specific content (in the user's language)`;

serve(async (req) => {
  // Handle CORS preflight
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    const supabaseClient = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_ANON_KEY') ?? '',
      {
        global: {
          headers: { Authorization: req.headers.get('Authorization')! },
        },
      }
    )

    // Verify user (simplified for demo)
    const authHeader = req.headers.get('Authorization')
    if (!authHeader) {
      return new Response(
        JSON.stringify({
          success: false,
          error: 'Authorization required',
        }),
        {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          status: 401,
        }
      )
    }

    const requestData: ChatRequest = await req.json()
    const { messages, conversationId, userId } = requestData

    // Validate request
    if (!messages || !Array.isArray(messages) || messages.length === 0) {
      return new Response(
        JSON.stringify({
          success: false,
          error: 'Messages cannot be empty',
        }),
        {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          status: 400,
        }
      )
    }

    const lastMessage = messages[messages.length - 1]
    if (lastMessage.role !== 'user') {
      return new Response(
        JSON.stringify({
          success: false,
          error: 'Last message must be from user',
        }),
        {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          status: 400,
        }
      )
    }

    // Call DeepSeek API
    const aiResponse = await callDeepSeekAPI({
      messages: messages,
      conversationId: conversationId,
      userId: userId,
    })

    const response: ChatResponse = {
      success: aiResponse.success,
      message: aiResponse.message,
      error: aiResponse.error,
      data: aiResponse.data,
      conversationId: conversationId || `conv-${Date.now()}`,
    }

    return new Response(
      JSON.stringify(response),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: aiResponse.success ? 200 : 500,
      }
    )

  } catch (error) {
    console.error('Chat function error:', error)

    return new Response(
      JSON.stringify({
        success: false,
        error: error.message || 'Internal server error',
      }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 500,
      }
    )
  }
})

// 简单的语言检测函数
function detectLanguage(text: string): string {
  // 检测中文字符
  const chineseRegex = /[\u4e00-\u9fff]/
  // 检测英文字符
  const englishRegex = /[a-zA-Z]/
  
  // 统计字符类型
  let chineseCount = 0
  let englishCount = 0
  let otherCount = 0
  
  for (const char of text) {
    if (chineseRegex.test(char)) {
      chineseCount++
    } else if (englishRegex.test(char)) {
      englishCount++
    } else if (char.trim()) {
      otherCount++
    }
  }
  
  // 如果中文字符占主导，返回中文
  if (chineseCount > englishCount * 2 && chineseCount > 0) {
    return 'chinese'
  }
  // 如果英文字符占主导，返回英文
  else if (englishCount > chineseCount * 2 && englishCount > 0) {
    return 'english'
  }
  // 默认返回英文
  return 'english'
}

// 根据检测到的语言增强系统提示
function getEnhancedSystemPrompt(userMessage: string): string {
  const language = detectLanguage(userMessage)
  
  let languageSpecificInstruction = ''
  if (language === 'chinese') {
    languageSpecificInstruction = `\n\n# 当前对话语言：中文\n你正在与使用中文的用户对话。请务必使用中文回复，保持专业、清晰的表达。`
  } else if (language === 'english') {
    languageSpecificInstruction = `\n\n# Current Conversation Language: English\nYou are conversing with a user who is using English. Please respond in English, maintaining professional and clear expression.`
  } else {
    languageSpecificInstruction = `\n\n# Current Conversation Language: Detected as ${language}\nPlease respond in the same language as the user's message.`
  }
  
  return FIRST_PRINCIPLES_SKILL + languageSpecificInstruction
}

// Call DeepSeek API
async function callDeepSeekAPI(params: {
  messages: Array<{ role: string, content: string }>
  conversationId?: string
  userId: string
}): Promise<ChatResponse> {
  try {
    const deepseekApiKey = Deno.env.get('DEEPSEEK_API_KEY')
    if (!deepseekApiKey) {
      throw new Error('DeepSeek API key not configured')
    }

    // 获取用户最后一条消息
    const lastUserMessage = params.messages
      .filter(msg => msg.role === 'user')
      .pop()?.content || ''
    
    // 构建增强的系统提示
    const systemPrompt = getEnhancedSystemPrompt(lastUserMessage)

    // Prepare messages
    const apiMessages = [
      { role: 'system' as const, content: systemPrompt },
      ...params.messages.map(msg => ({
        role: msg.role as 'user' | 'assistant' | 'system',
        content: msg.content
      }))
    ]

    const response = await fetch('https://api.deepseek.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${deepseekApiKey}`,
      },
      body: JSON.stringify({
        model: 'deepseek-chat',
        messages: apiMessages,
        temperature: 0.7,
        max_tokens: 2000,
        stream: false,
      }),
    })

    if (!response.ok) {
      const errorText = await response.text()
      throw new Error(`DeepSeek API error: ${response.status} - ${errorText}`)
    }

    const data = await response.json()
    const message = data.choices?.[0]?.message?.content || 'Sorry, I could not generate a response.'

    return {
      success: true,
      message: message,
      data: {
        provider: 'deepseek',
        model: 'deepseek-chat',
        simplified_architecture: true,
        detected_language: detectLanguage(lastUserMessage),
      },
    }

  } catch (error) {
    console.error('DeepSeek API call failed:', error)
    
    return {
      success: false,
      error: 'AI service temporarily unavailable. Please try again later.',
      data: {
        error: error.message,
      },
    }
  }
}