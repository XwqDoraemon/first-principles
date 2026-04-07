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

# CRITICAL: JSON Output Format (VERY IMPORTANT)
You MUST respond ONLY with a valid JSON object. Do NOT include any text before or after the JSON.


**SINGLE-LAYER JSON ONLY - NO NESTING**

Your response must be exactly in this format:
{"phase": 1, "reply": "Your response text here"}

Rules:
- "phase" must be a number (1-4): 1=Understand, 2=Deconstruct, 3=Rebuild, 4=Act
- "reply" must be a string containing your actual response text
- Do NOT wrap the JSON in backticks
- Do NOT add any explanation text outside the JSON
- Return ONLY the JSON object, nothing else

Example of CORRECT response:
{"phase": 1, "reply": "我理解你的问题。我会用大约 5-8 个问题引导你找到答案。我们先从最重要的一个问题开始——你希望这个问题解决之后，你的生活会有什么不同？"}

Example of WRONG response:
\`\`\`
{"phase": 1, "reply": "text"}
\`\`\`

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

## Interaction Flow

### Initial Response (Phase 1)
When user first asks a question:
1. Rephrase the problem to confirm understanding
2. **Set expectations explicitly**: Tell the user "I'll guide you through approximately 5-8 questions to help you find the answer yourself"
3. **Declare current phase**: "We're now in Phase 1: Understanding the Problem"
4. Ask the first guiding question

### Phase Transitions
When moving to a new phase:
1. **Declare the transition**: "Great, now we're entering Phase 2: Deconstructing Assumptions"
2. Explain what this phase focuses on
3. Ask the first question of this phase

### Throughout the Conversation
- Always reference the current phase when relevant
- Remind the user of progress (e.g., "We're making good progress")
- Give a sense of how many questions remain (e.g., "This is our 3rd question out of approximately 8")

## Thinking Process (4 Phases)

### Phase 1: Understand (理解问题)
Goal: Grasp the core problem.
- Rephrase the problem in your own words
- Set expectations: "I'll guide you through 5-8 questions"
- Declare phase: "We're now in Phase 1: Understanding"
- Ask clarifying questions

### Phase 2: Deconstruct (拆解假设)
Goal: Break down assumptions.
- **Declare**: "Now we're entering Phase 2: Deconstructing Assumptions"
- Identify hidden assumptions
- Challenge "taken for granted" premises
- Use 5 Whys technique

### Phase 3: Rebuild (重建方案)
Goal: Build from first principles.
- **Declare**: "We're moving to Phase 3: Rebuilding from First Principles"
- Start from fundamental facts
- Derive solutions from facts
- Explore alternatives

### Phase 4: Act (定义行动)
Goal: Define clear actions.
- **Declare**: "Finally, we're in Phase 4: Defining Actions"
- Determine next steps
- Set measurable goals
- Create action plan

## Important: Include These Elements in Your Responses

1. **Phase Declarations**: Always mention which phase you're in when transitioning
2. **Progress Indicators**: Give users a sense of where they are in the process
3. **Question Count**: Mention "approximately 5-8 questions" at the start and occasionally update (e.g., "This is our 3rd question")

## REMEMBER
- ALWAYS return valid JSON: {"phase": number, "reply": "string"}
- Include phase declarations and progress indicators in the content
- Start with Phase 1, progress through phases as conversation advances
- Be encouraging and clear about the process`;

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

    // Return SSE stream
    const stream = new ReadableStream({
      async start(controller) {
        try {
          // Send conversation ID first
          const convId = conversationId || `conv-${Date.now()}`
          controller.enqueue(
            new TextEncoder().encode(
              `data: ${JSON.stringify({ conversationId: convId })}\n\n`
            )
          )

          // Send message content
          if (aiResponse.success && aiResponse.message) {
            controller.enqueue(
              new TextEncoder().encode(
                `data: ${JSON.stringify({ content: aiResponse.message })}\n\n`
              )
            )
          }

          // Send DONE marker
          controller.enqueue(
            new TextEncoder().encode('data: [DONE]\n\n')
          )

          controller.close()
        } catch (error) {
          console.error('Stream error:', error)
          controller.error(error)
        }
      },
    })

    return new Response(stream, {
      headers: {
        ...corsHeaders,
        'Content-Type': 'text/event-stream',
        'Cache-Control': 'no-cache',
        'Connection': 'keep-alive',
      },
      status: aiResponse.success ? 200 : 500,
    })

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
        stream: true,  // 启用 SSE 流式响应
      }),
    })

    if (!response.ok) {
      const errorText = await response.text()
      throw new Error(`DeepSeek API error: ${response.status} - ${errorText}`)
    }

    // 读取流式响应
    const reader = response.body?.getReader()
    if (!reader) {
      throw new Error('No response body')
    }

    const decoder = new TextDecoder()
    let fullContent = ''

    while (true) {
      const { done, value } = await reader.read()
      if (done) break

      const chunk = decoder.decode(value)
      const lines = chunk.split('\n')

      for (const line of lines) {
        if (line.startsWith('data: ')) {
          const data = line.slice(6).trim()
          if (data === '[DONE]') break

          try {
            const parsed = JSON.parse(data)
            const content = parsed.choices?.[0]?.delta?.content
            if (content) {
              fullContent += content
            }
          } catch (e) {
            // Ignore parse errors
          }
        }
      }
    }

    return {
      success: true,
      message: fullContent || 'Sorry, I could not generate a response.',
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




