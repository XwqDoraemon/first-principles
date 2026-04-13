// First Principles Chat Edge Function - Simplified Version
// 部署: supabase functions deploy chat

import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.39.0'

const adminSupabase = createClient(
  Deno.env.get('SUPABASE_URL') ?? '',
  Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
)

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

interface StartConversationResult {
  allowed: boolean
  charged_credits: number
  remaining_credits: number
  free_sessions_remaining: number
  message: string
}

interface ChatResponse {
  success: boolean
  message?: string
  error?: string
  data?: any
  conversationId?: string
  messageId?: string
}

const MAX_SESSION_USER_TURNS = 15

function extractAccessToken(req: Request) {
  const authHeader = req.headers.get('Authorization')
  if (!authHeader) {
    return null
  }

  const [scheme, token] = authHeader.split(' ')
  if (scheme !== 'Bearer' || !token) {
    return null
  }

  return token
}

async function ensureUserRecord(user: { id: string; email?: string | null }) {
  const { data: existingUser, error: loadError } = await adminSupabase
    .from('users')
    .select('id, credits_balance, free_sessions_remaining')
    .eq('id', user.id)
    .maybeSingle()

  if (loadError) {
    throw new Error(`Failed to load user profile: ${loadError.message}`)
  }

  if (existingUser) {
    return {
      credits_balance: existingUser.credits_balance ?? 0,
      free_sessions_remaining: existingUser.free_sessions_remaining ?? 0,
    }
  }

  const { data: createdUser, error: createError } = await adminSupabase
    .from('users')
    .insert({
      id: user.id,
      email: user.email ?? `${user.id}@placeholder.local`,
      credits_balance: 0,
      free_sessions_remaining: 2,
    })
    .select('credits_balance, free_sessions_remaining')
    .single()

  if (createError) {
    throw new Error(`Failed to create user profile: ${createError.message}`)
  }

  return {
    credits_balance: createdUser.credits_balance ?? 0,
    free_sessions_remaining: createdUser.free_sessions_remaining ?? 2,
  }
}

async function recordCreditTransaction(payload: {
  userId: string
  amount: number
  transactionType: string
  description: string
  metadata: Record<string, unknown>
}) {
  const { error } = await adminSupabase
    .from('credit_transactions')
    .insert({
      user_id: payload.userId,
      amount: payload.amount,
      transaction_type: payload.transactionType,
      description: payload.description,
      metadata: payload.metadata,
    })

  if (error) {
    console.warn('Failed to record credit transaction:', error)
  }
}

async function startConversationSession(user: { id: string; email?: string | null }): Promise<StartConversationResult> {
  const profile = await ensureUserRecord(user)
  const currentFree = profile.free_sessions_remaining ?? 0
  const currentBalance = profile.credits_balance ?? 0

  if (currentFree > 0) {
    const nextFree = currentFree - 1
    const { error: updateError } = await adminSupabase
      .from('users')
      .update({ free_sessions_remaining: nextFree })
      .eq('id', user.id)

    if (updateError) {
      throw new Error(`Failed to update free session count: ${updateError.message}`)
    }

    await recordCreditTransaction({
      userId: user.id,
      amount: 0,
      transactionType: 'free_trial',
      description: 'Started a free thinking session',
      metadata: { charged_credits: 0 },
    })

    return {
      allowed: true,
      charged_credits: 0,
      remaining_credits: currentBalance,
      free_sessions_remaining: nextFree,
      message: 'Started with a free session',
    }
  }

  if (currentBalance < 2) {
    return {
      allowed: false,
      charged_credits: 0,
      remaining_credits: currentBalance,
      free_sessions_remaining: currentFree,
      message: 'Not enough credits to start a new session',
    }
  }

  const nextBalance = currentBalance - 2
  const { error: updateError } = await adminSupabase
    .from('users')
    .update({ credits_balance: nextBalance })
    .eq('id', user.id)

  if (updateError) {
    throw new Error(`Failed to deduct credits: ${updateError.message}`)
  }

  await recordCreditTransaction({
    userId: user.id,
    amount: -2,
    transactionType: 'session_consumed',
    description: 'Started a paid thinking session',
    metadata: { charged_credits: 2 },
  })

  return {
    allowed: true,
    charged_credits: 2,
    remaining_credits: nextBalance,
    free_sessions_remaining: currentFree,
    message: 'Charged 2 credits to start a new session',
  }
}

// 简化的第一性原理 skill 系统
const FIRST_PRINCIPLES_SKILL = `You are "First Principles", an AI thinking guide. You MUST follow the skill instructions below exactly.

# CRITICAL: JSON Output Format (VERY IMPORTANT)
You MUST respond ONLY with a valid JSON object. Do NOT include any text before or after the JSON.


**SINGLE-LAYER JSON ONLY - NO NESTING**

Your response must use one of these formats:

For phases 1-4:
{"phase": 1, "reply": "Your response text here"}

For phase 5:
{"phase": 5, "reply": "Your final response text here", "summary": {"core_problem": "string", "thinking_traps": ["string"], "primary_tension": "string", "secondary_tension": "string", "clarity": "string", "next_actions": ["string"], "takeaway": "string"}}

Rules:
- "phase" must be a number (1-5): 1=Understand, 2=Challenge, 3=Rebuild, 4=Decide, 5=Act
- "reply" must be a string containing your actual response text
- When "phase" is 5, you MUST include a "summary" object
- "thinking_traps" must be an array of 2-4 concise strings
- "next_actions" must be an array of 3 concise, concrete steps
- Do NOT wrap the JSON in backticks
- Do NOT add any explanation text outside the JSON
- Return ONLY the JSON object, nothing else

Example of CORRECT response:
{"phase": 1, "reply": "I understand your question. I will guide you through approximately 8-15 questions to help you find the answer yourself. Let's begin with the most important one: if this problem were solved, what would be different in your life?"}

Example of WRONG response:
\`\`\`
{"phase": 1, "reply": "text"}
\`\`\`

# Language Rule
CRITICAL: You MUST respond in clear, natural English.
- Always reply in English
- If the user writes in another language, still reply in English
- Keep the tone professional, warm, and easy to follow

# First Principles Thinking Guide

## Core Philosophy
The goal is not to give answers, but to help users find answers themselves.
Your role: Socratic guide - question assumptions, guide thinking, leave space for users.

## Interaction Flow

### Initial Response (Phase 1)
When user first asks a question:
1. Rephrase the problem to confirm understanding
2. **Set expectations explicitly**: Tell the user "I'll guide you through approximately 8-15 questions to help you find the answer yourself"
3. **Declare current phase**: "We're now in Phase 1: Understand"
4. Ask the first guiding question

### Phase Transitions
When moving to a new phase:
1. **Declare the transition**: "Great, now we're entering Phase 2: Challenge"
2. Explain what this phase focuses on
3. Ask the first question of this phase

### Throughout the Conversation
- Always reference the current phase when relevant
- Remind the user of progress (e.g., "We're making good progress")
- Give a sense of how many questions remain (e.g., "This is our 3rd question out of approximately 12")

## Thinking Process (5 Phases)

### Phase 1: Understand
Goal: Grasp the core problem.
- Rephrase the problem in your own words
- Set expectations: "I'll guide you through 8-15 questions"
- Declare phase: "We're now in Phase 1: Understand"
- Ask clarifying questions

### Phase 2: Challenge
Goal: Test assumptions.
- **Declare**: "Now we're entering Phase 2: Challenge"
- Identify hidden assumptions
- Challenge "taken for granted" premises
- Use 5 Whys technique

### Phase 3: Rebuild
Goal: Build from first principles.
- **Declare**: "We're moving to Phase 3: Rebuild"
- Start from fundamental facts
- Derive solutions from facts
- Explore alternatives

### Phase 4: Decide
Goal: Make the key decision.
- **Declare**: "We're moving to Phase 4: Decide"
- Clarify the real trade-off
- Name the choice that matters most
- Reduce the decision to a clear commitment

### Phase 5: Act
Goal: Define clear next steps.
- **Declare**: "Finally, we're in Phase 5: Act"
- Determine next steps
- Set measurable goals
- Create action plan
- This phase should conclude the session rather than open a new exploration loop
- In Phase 5, include a structured "summary" object with:
  - core_problem
  - thinking_traps
  - primary_tension
  - secondary_tension
  - clarity
  - next_actions
  - takeaway

## Important: Include These Elements in Your Responses

1. **Phase Declarations**: Always mention which phase you're in when transitioning
2. **Progress Indicators**: Give users a sense of where they are in the process
3. **Question Count**: Mention "approximately 8-15 questions" at the start and occasionally update (e.g., "This is our 3rd question")
4. **End decisively**: Move to Phase 5 no later than the 15th assistant reply and finish with a concise action plan
5. **Create a valuable wrap-up**: The final response should feel like a premium thinking summary the user can save or act on

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
    const accessToken = extractAccessToken(req)
    if (!accessToken) {
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

    const { data: { user }, error: userError } = await adminSupabase.auth.getUser(accessToken)
    if (userError || !user) {
      return new Response(
        JSON.stringify({
          success: false,
          error: 'Invalid user session',
        }),
        {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          status: 401,
        }
      )
    }

    const requestData: ChatRequest = await req.json()
    const { messages, conversationId } = requestData
    const userMessageCount = messages.filter((message) => message.role === 'user').length
    const assistantMessageCount = messages.filter((message) => message.role === 'assistant').length

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

    if (conversationId && (userMessageCount > MAX_SESSION_USER_TURNS || assistantMessageCount >= MAX_SESSION_USER_TURNS)) {
      return new Response(
        JSON.stringify({
          success: false,
          error: 'This thinking session is complete. Start a new session to continue.',
          details: {
            completed: true,
            maxUserTurns: MAX_SESSION_USER_TURNS,
          },
        }),
        {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          status: 409,
        }
      )
    }

    if (!conversationId) {
      let sessionResult: StartConversationResult

      try {
        sessionResult = await startConversationSession(user)
      } catch (sessionError) {
        console.error('Failed to start conversation session:', sessionError)
        return new Response(
          JSON.stringify({
            success: false,
            error: 'Failed to verify conversation quota',
          }),
          {
            headers: { ...corsHeaders, 'Content-Type': 'application/json' },
            status: 500,
          }
        )
      }

      if (!sessionResult?.allowed) {
        return new Response(
          JSON.stringify({
            success: false,
            error: 'Not enough credits to start a new session',
            details: {
              remainingCredits: sessionResult?.remaining_credits || 0,
              freeSessionsRemaining: sessionResult?.free_sessions_remaining || 0,
              conversationCost: 2,
            },
          }),
          {
            headers: { ...corsHeaders, 'Content-Type': 'application/json' },
            status: 402,
          }
        )
      }
    }

    // Call DeepSeek API
    const aiResponse = await callDeepSeekAPI({
      messages: messages,
      conversationId: conversationId,
      userId: user.id,
      assistantMessageCount,
    })

    if (!aiResponse.success) {
      return new Response(
        JSON.stringify({
          success: false,
          error: aiResponse.error || 'AI service temporarily unavailable',
          details: aiResponse.data || null,
        }),
        {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          status: 502,
        }
      )
    }

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
      status: 200,
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

function getEnhancedSystemPrompt(_userMessage: string, assistantMessageCount: number): string {
  let completionInstruction = '\n\n# Session Length Guidance\nYou should usually conclude within 8-15 assistant replies.'

  if (assistantMessageCount >= 12) {
    completionInstruction += '\nYou are near the end of the session. Move the user toward Phase 4: Decide or Phase 5: Act.'
  }

  if (assistantMessageCount >= 14) {
    completionInstruction += '\nThis should be the final reply. Return phase 5, summarize the key insight, and give a concise action plan. Do not ask another open-ended exploration question.'
  }

  return FIRST_PRINCIPLES_SKILL
    + `\n\n# Current Conversation Language: English\nRespond in English only.`
    + completionInstruction
}

// Call DeepSeek API
async function callDeepSeekAPI(params: {
  messages: Array<{ role: string, content: string }>
  conversationId?: string
  userId: string
  assistantMessageCount: number
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
    const systemPrompt = getEnhancedSystemPrompt(lastUserMessage, params.assistantMessageCount)

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

    const payload = await response.json()
    const fullContent = payload.choices?.[0]?.message?.content?.trim()

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
