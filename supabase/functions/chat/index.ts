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

interface StructuredSummary {
  core_problem: string
  thinking_traps: string[]
  primary_tension: string
  secondary_tension: string
  clarity: string
  next_actions: string[]
  takeaway: string
}

interface StructuredAiMessage {
  phase: number
  reply: string
  summary?: StructuredSummary
}

function detectPrimaryLanguage(text: string): 'zh' | 'en' {
  return /[\u4e00-\u9fff]/.test(text) ? 'zh' : 'en'
}

function stripCodeFences(text: string): string {
  return text
    .replace(/^```(?:json)?\s*/i, '')
    .replace(/\s*```$/i, '')
    .trim()
}

function extractFirstJsonObject(text: string): string | null {
  const source = stripCodeFences(text)
  const start = source.indexOf('{')
  if (start === -1) {
    return null
  }

  let depth = 0
  let inString = false
  let escaped = false

  for (let i = start; i < source.length; i += 1) {
    const char = source[i]

    if (escaped) {
      escaped = false
      continue
    }

    if (char === '\\') {
      escaped = true
      continue
    }

    if (char === '"') {
      inString = !inString
      continue
    }

    if (inString) {
      continue
    }

    if (char === '{') {
      depth += 1
    } else if (char === '}') {
      depth -= 1
      if (depth === 0) {
        return source.slice(start, i + 1)
      }
    }
  }

  return null
}

function tryParseStructuredObject(text: string): Record<string, unknown> | null {
  const candidates = [
    text.trim(),
    stripCodeFences(text),
    extractFirstJsonObject(text),
  ].filter((candidate): candidate is string => Boolean(candidate))

  for (const candidate of candidates) {
    try {
      const parsed = JSON.parse(candidate)
      if (parsed && typeof parsed === 'object' && !Array.isArray(parsed)) {
        return parsed as Record<string, unknown>
      }
    } catch {
      // Ignore parse failures and continue trying the next candidate.
    }
  }

  return null
}

function normalizePhaseValue(value: unknown): number | null {
  const parsedNumber = typeof value === 'number'
    ? value
    : typeof value === 'string'
      ? Number.parseInt(value, 10)
      : Number.NaN

  if (!Number.isFinite(parsedNumber)) {
    return null
  }

  return Math.max(1, Math.min(5, parsedNumber))
}

function inferPhaseFromTurnCount(assistantMessageCount: number): number {
  const upcomingReplyIndex = assistantMessageCount + 1

  if (upcomingReplyIndex <= 2) return 1
  if (upcomingReplyIndex <= 5) return 2
  if (upcomingReplyIndex <= 8) return 3
  if (upcomingReplyIndex <= 11) return 4
  return 5
}

function inferPhaseFromReply(reply: string, assistantMessageCount: number): number {
  const normalizedReply = reply.toLowerCase()

  const phaseKeywords: Record<number, string[]> = {
    5: [
      'phase 5',
      '阶段 5',
      '思维复盘',
      '总结',
      '行动计划',
      'takeaway',
      'next actions',
      'wrap-up',
      'summary',
    ],
    4: [
      'phase 4',
      '阶段 4',
      '最小可验证',
      '第一步行动',
      '最可能失败',
      '依赖哪些假设',
      'first step',
      'smallest testable',
      'what could fail',
      'commitment',
    ],
    3: [
      'phase 3',
      '阶段 3',
      '重建方案',
      '重新设计',
      '从零开始',
      '忘掉原来的做法',
      'from here',
      'rebuild',
      'redesign',
      'from first principles',
    ],
    2: [
      'phase 2',
      '阶段 2',
      '为什么',
      '根因',
      '基本事实',
      '多米诺骨牌',
      'assumption',
      'challenge',
      '5 whys',
      'root cause',
    ],
    1: [
      'phase 1',
      '阶段 1',
      '我会用大约',
      '8-10 个问题',
      '8-15 questions',
      '最重要的一个问题',
      'anchor',
      '定锚',
    ],
  }

  let bestPhase = 0
  let bestScore = 0

  for (const [phaseKey, keywords] of Object.entries(phaseKeywords)) {
    const score = keywords.filter((keyword) => normalizedReply.includes(keyword)).length
    if (score > bestScore) {
      bestScore = score
      bestPhase = Number(phaseKey)
    }
  }

  return bestScore > 0 ? bestPhase : inferPhaseFromTurnCount(assistantMessageCount)
}

function normalizeStringList(value: unknown, fallback: string[]): string[] {
  if (Array.isArray(value)) {
    const normalized = value
      .map((item) => String(item ?? '').trim())
      .filter(Boolean)

    if (normalized.length > 0) {
      return normalized
    }
  }

  if (typeof value === 'string' && value.trim()) {
    return [value.trim()]
  }

  return fallback
}

function buildFallbackSummary(reply: string, lastUserMessage: string, language: 'zh' | 'en'): StructuredSummary {
  const trimmedReply = stripCodeFences(reply)
  const takeaway = trimmedReply
    .split('\n')
    .map((line) => line.trim())
    .filter(Boolean)
    .slice(-1)[0]
    || (language === 'zh'
      ? '清晰感来自把洞察变成下一步行动。'
      : 'Clarity grows when insight turns into the next concrete action.')

  if (language === 'zh') {
    return {
      core_problem: lastUserMessage || '当前这次需要解决的问题',
      thinking_traps: [
        '把情绪压力和真正要解决的问题混在了一起。',
        '在行动前过度追求完全确定。',
      ],
      primary_tension: '想先获得足够安全感，再决定是否行动。',
      secondary_tension: '继续思考会更安心，但行动才能带来真实反馈。',
      clarity: trimmedReply || '这次对话已经把核心矛盾和下一步行动说清楚了。',
      next_actions: [
        '写下你真正要解决的那个核心问题，只保留一句话。',
        '把它转成一个本周可以验证的小动作。',
        '做完后根据结果复盘，而不是继续空想。',
      ],
      takeaway,
    }
  }

  return {
    core_problem: lastUserMessage || 'The core question you are trying to resolve',
    thinking_traps: [
      'Mixing emotional discomfort with the actual decision to be made.',
      'Waiting for full certainty before taking the next step.',
    ],
    primary_tension: 'You want clarity, but you also want safety before acting.',
    secondary_tension: 'Reflection feels safer, while action creates the feedback you need.',
    clarity: trimmedReply || 'This conversation clarified the real issue and the next move.',
    next_actions: [
      'Write the single core question you are actually trying to solve.',
      'Turn it into one small experiment you can run this week.',
      'Review the result after acting instead of waiting for certainty first.',
    ],
    takeaway,
  }
}

function normalizeSummaryObject(value: unknown, reply: string, lastUserMessage: string, language: 'zh' | 'en'): StructuredSummary | undefined {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    return undefined
  }

  const summary = value as Record<string, unknown>
  const fallback = buildFallbackSummary(reply, lastUserMessage, language)

  return {
    core_problem: String(summary.core_problem || fallback.core_problem).trim(),
    thinking_traps: normalizeStringList(summary.thinking_traps, fallback.thinking_traps).slice(0, 4),
    primary_tension: String(summary.primary_tension || fallback.primary_tension).trim(),
    secondary_tension: String(summary.secondary_tension || fallback.secondary_tension).trim(),
    clarity: String(summary.clarity || fallback.clarity).trim(),
    next_actions: normalizeStringList(summary.next_actions, fallback.next_actions).slice(0, 3),
    takeaway: String(summary.takeaway || fallback.takeaway).trim(),
  }
}

function normalizeDeepSeekResponse(rawContent: string, assistantMessageCount: number, lastUserMessage: string): StructuredAiMessage {
  const structured = tryParseStructuredObject(rawContent)
  const language = detectPrimaryLanguage(`${lastUserMessage}\n${rawContent}`)

  const replySource = structured?.reply ?? structured?.content ?? rawContent
  const reply = typeof replySource === 'string'
    ? stripCodeFences(replySource)
    : stripCodeFences(JSON.stringify(replySource))

  const phase = normalizePhaseValue(structured?.phase) ?? inferPhaseFromReply(reply, assistantMessageCount)
  const normalized: StructuredAiMessage = {
    phase,
    reply,
  }

  if (phase === 5) {
    normalized.summary = normalizeSummaryObject(structured?.summary, reply, lastUserMessage, language)
      ?? buildFallbackSummary(reply, lastUserMessage, language)
  }

  return normalized
}

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

async function previewConversationSession(user: { id: string; email?: string | null }): Promise<StartConversationResult> {
  const profile = await ensureUserRecord(user)
  const currentFree = profile.free_sessions_remaining ?? 0
  const currentBalance = profile.credits_balance ?? 0

  if (currentFree > 0) {
    return {
      allowed: true,
      charged_credits: 0,
      remaining_credits: currentBalance,
      free_sessions_remaining: currentFree,
      message: 'Eligible to start with a free session',
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

  return {
    allowed: true,
    charged_credits: 0,
    remaining_credits: currentBalance,
    free_sessions_remaining: currentFree,
    message: 'Eligible to start a paid thinking session',
  }
}

function normalizeSessionResult(row: unknown): StartConversationResult {
  if (!row || typeof row !== 'object' || Array.isArray(row)) {
    throw new Error('Billing result is malformed')
  }

  const result = row as Record<string, unknown>

  return {
    allowed: Boolean(result.allowed),
    charged_credits: Number(result.charged_credits ?? 0),
    remaining_credits: Number(result.remaining_credits ?? 0),
    free_sessions_remaining: Number(result.free_sessions_remaining ?? 0),
    message: String(result.message ?? ''),
  }
}

async function startConversationSessionFallback(user: { id: string; email?: string | null }): Promise<StartConversationResult> {
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
      metadata: { charged_credits: 0, finalized_after_ai_success: true },
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
    metadata: { charged_credits: 2, finalized_after_ai_success: true },
  })

  return {
    allowed: true,
    charged_credits: 2,
    remaining_credits: nextBalance,
    free_sessions_remaining: currentFree,
    message: 'Charged 2 credits to start a new session',
  }
}

async function finalizeConversationSession(user: { id: string; email?: string | null }): Promise<StartConversationResult> {
  await ensureUserRecord(user)

  const { data, error } = await adminSupabase.rpc('start_conversation_session', {
    user_id: user.id,
  })

  if (error) {
    console.warn('start_conversation_session RPC failed, falling back to direct update:', error)
    return startConversationSessionFallback(user)
  }

  const row = Array.isArray(data) ? data[0] : data
  return normalizeSessionResult(row)
}

// 简化的第一性原理 skill 系统
const FIRST_PRINCIPLES_SKILL = `You are "First Principles", a premium first-principles thinking guide.

# CRITICAL JSON CONTRACT
- Respond with json only.
- Return exactly one valid JSON object and nothing else.
- Never use markdown code fences.
- Every reply MUST include "phase" and "reply".
- Phase 3 and Phase 4 MUST still include the "phase" field. Never omit it.
- "phase" must always be an integer from 1 to 5.
- "reply" must always be a natural-language string for the user.
- Only phase 5 may include "summary", and phase 5 must include it.

Valid formats:
{"phase": 1, "reply": "text"}
{"phase": 2, "reply": "text"}
{"phase": 3, "reply": "text"}
{"phase": 4, "reply": "text"}
{"phase": 5, "reply": "text", "summary": {"core_problem": "string", "thinking_traps": ["string"], "primary_tension": "string", "secondary_tension": "string", "clarity": "string", "next_actions": ["string"], "takeaway": "string"}}

Examples for the phases that are easy to omit:
{"phase": 3, "reply": "我们已经挖到了基本事实。现在进入第 3 阶段：重建方案。先不沿用旧路径，如果从这些基本事实重新设计，你第一反应会怎么做？"}
{"phase": 4, "reply": "好，现在进入第 4 阶段：检验与行动。这个方案依赖哪些假设？最小可验证的一步是什么？"}

# LANGUAGE
- Mirror the user's language by default.
- If the user writes in Chinese, reply in Chinese.
- If the user writes in English, reply in English.
- Keep wording warm, precise, calm, and high-value.

# CORE PHILOSOPHY
- Do not rush to give answers. Help the user discover their own answer.
- One question at a time.
- Reuse the user's wording whenever possible.
- At phase transitions, explicitly say what phase they are in and what this phase is for.
- The experience should feel premium, save-worthy, and worth returning to. Create clarity, momentum, and emotional precision.
- Never sound salesy. Never mention pricing unless the user asks.

# FLOW FROM THE REPO SKILL

Phase 1: Receive, anchor, and surface assumptions
- First restate the user's problem in one sentence.
- Explicitly set expectations: about 8-10 questions, one at a time, and the user can say "直接给建议" / "give me advice directly" to skip.
- Ask one anchor question about what really matters.
- Then start surfacing one hidden assumption at a time.

Phase 2: Go deeper until you reach basic facts
- Use a 5 Whys style descent.
- Ask what the first domino is, what the core contradiction is, or what is truly non-negotiable.
- Stop digging when the user reaches something irreducible or emotionally true.

Phase 3: Rebuild from the ground up
- Start from the confirmed basic facts.
- Let the user propose the new path first.
- Do not dump three options immediately.
- Use prompts like: "如果从这里重新设计，你会怎么做？"

Phase 4: Validate and commit
- Test the new path against reality.
- Ask which assumptions it still depends on.
- Ask for the smallest testable next step.
- Ask what would most likely make the plan fail.

Phase 5: Wrap up with a premium takeaway
- Conclude decisively instead of reopening exploration.
- The written reply should feel like a high-value coaching summary the user would want to save.
- Include a "summary" object with:
  - core_problem
  - thinking_traps (2-4 concise items)
  - primary_tension
  - secondary_tension
  - clarity
  - next_actions (exactly 3 concise actions)
  - takeaway

# INTERACTION RULES
- Mention progress naturally when useful.
- Keep momentum, but do not overwhelm the user.
- If the user resists the process and wants direct advice, give a concise direction after one final high-leverage question.
- Finish by phase 5 no later than the 15th assistant reply.
- Make the final output feel strong enough that the user would think: "This was more useful than generic AI chat."
`;

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

    let sessionPreview: StartConversationResult | null = null

    if (!conversationId) {
      let previewResult: StartConversationResult

      try {
        previewResult = await previewConversationSession(user)
      } catch (sessionError) {
        console.error('Failed to verify conversation quota:', sessionError)
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

      sessionPreview = previewResult

      if (!previewResult?.allowed) {
        return new Response(
          JSON.stringify({
            success: false,
            error: 'Not enough credits to start a new session',
            details: {
              remainingCredits: previewResult?.remaining_credits || 0,
              freeSessionsRemaining: previewResult?.free_sessions_remaining || 0,
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

    if (!conversationId) {
      let sessionResult: StartConversationResult

      try {
        sessionResult = await finalizeConversationSession(user)
      } catch (sessionError) {
        console.error('Failed to finalize conversation billing:', sessionError)
        return new Response(
          JSON.stringify({
            success: false,
            error: 'The AI reply was ready, but billing could not be completed. No credits were deducted. Please try again.',
          }),
          {
            headers: { ...corsHeaders, 'Content-Type': 'application/json' },
            status: 503,
          }
        )
      }

      if (!sessionResult?.allowed) {
        return new Response(
          JSON.stringify({
            success: false,
            error: 'Session availability changed before billing completed. No credits were deducted.',
            details: {
              remainingCredits: sessionResult?.remaining_credits || sessionPreview?.remaining_credits || 0,
              freeSessionsRemaining: sessionResult?.free_sessions_remaining || sessionPreview?.free_sessions_remaining || 0,
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

          const structuredPayload = aiResponse.data?.structured_payload as StructuredAiMessage | undefined

          // Send message content
          if (aiResponse.success && aiResponse.message) {
            controller.enqueue(
              new TextEncoder().encode(
                `data: ${JSON.stringify({
                  phase: structuredPayload?.phase,
                  summary: structuredPayload?.summary,
                  content: aiResponse.message,
                })}\n\n`
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

function getEnhancedSystemPrompt(userMessage: string, assistantMessageCount: number): string {
  const language = detectPrimaryLanguage(userMessage)
  let completionInstruction = language === 'zh'
    ? '\n\n# 会话长度指引\n通常请在 8-15 次 assistant 回复内完成完整引导。'
    : '\n\n# Session Length Guidance\nYou should usually conclude within 8-15 assistant replies.'

  if (assistantMessageCount >= 12) {
    completionInstruction += language === 'zh'
      ? '\n你已经接近会话后段。请推动用户进入第 4 阶段或第 5 阶段，不要继续在前面阶段徘徊。'
      : '\nYou are near the end of the session. Move the user toward Phase 4 or Phase 5.'
  }

  if (assistantMessageCount >= 14) {
    completionInstruction += language === 'zh'
      ? '\n这应当是最终回复。请返回 phase 5，总结关键洞察，给出简洁明确的行动计划，不要再抛出新的开放式探索问题。'
      : '\nThis should be the final reply. Return phase 5, summarize the key insight, and give a concise action plan. Do not ask another open-ended exploration question.'
  }

  return FIRST_PRINCIPLES_SKILL
    + (language === 'zh'
      ? '\n\n# 当前对话语言\n请默认用中文回复，并保持自然、像真实教练一样。'
      : '\n\n# Current Conversation Language\nPlease reply in English and keep the tone natural and coach-like.')
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
        response_format: { type: 'json_object' },
        temperature: 0.2,
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
    if (!fullContent) {
      throw new Error('DeepSeek returned empty content')
    }

    const normalizedMessage = normalizeDeepSeekResponse(
      fullContent,
      params.assistantMessageCount,
      lastUserMessage
    )

    return {
      success: true,
      message: JSON.stringify(normalizedMessage),
      data: {
        provider: 'deepseek',
        model: 'deepseek-chat',
        simplified_architecture: true,
        input_language: detectPrimaryLanguage(lastUserMessage) === 'zh' ? 'chinese' : 'english',
        structured_payload: normalizedMessage,
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
