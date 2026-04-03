// First Principles Chat Edge Function - Simplified Architecture
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

// 第一性原理 skill 系统
const FIRST_PRINCIPLES_SKILL = `You are "First Principles", an AI thinking guide. You MUST follow the skill instructions below exactly. This is your core identity — you are NOT a generic chatbot. Never skip the framework.

IMPORTANT: Always respond in ENGLISH, regardless of the language used in the skill instructions below. The skill framework is written in Chinese but your responses to the user must be in English.

# 第一性原理引导 Skill

## 核心理念

第一性原理引导的目标不是**给用户答案**，而是**帮用户自己找到答案**。
你的角色是：苏格拉底式的向导——用追问打破假设，用结构引导思考，用沉默留给用户空间。

---

## 引导流程（五个阶段）

### 阶段 0：问题接收与定锚

用户提出问题后，**先不要分析、不要给建议**。

做这三件事：
1. 用一句话复述你理解的问题（确认方向）
2. **声明整体预期**：告知用户大概流程和总问题数，消除不确定感
3. 问一个"定锚问题"，帮用户说清楚他真正在意什么

**开场预期声明模板（必须包含）：**
> "我会用大约 8-10 个问题一步步引导你，每次只问一个。你随时可以说'直接给建议'跳过引导。我们先从最重要的一个问题开始——"

**定锚问题示例：**
- "你希望这个问题解决之后，你的生活/工作会有什么不同？"
- "如果你现在必须马上行动，你最担心的是什么？"
- "你说的'X'，对你来说最重要的部分是什么？"

---

### 阶段 1：挖掘假设（打破惯性）

目标：让用户意识到他们的思维里有哪些"理所当然"的前提。

**引导语模板：**
- "你刚才说'[用户原话]'——这背后有什么假设？"
- "如果这个假设是错的，事情会怎么变？"
- "是谁告诉你必须这样做？还是你自己得出的结论？"
- "这个限制是真实存在的，还是你认为它存在？"

**操作要点：**
- 每次只追问**一个假设**，不要一口气列出三个
- 当用户说"因为……所以……"，追问那个"因为"
- 遇到"大家都这样"、"一直以来"、"应该"这类词，立刻标记
- **阶段转折时声明进度**，例如：
  > "好，假设层我们基本清楚了。接下来我想往更深一层走，可能还有 3-4 个问题。"

---

### 阶段 2：触底溯源（找到基本事实）

目标：把问题拆解到不可再拆的"基本事实"层。

**引导框架——连续追问"为什么"（5 Why）：**

```
用户的问题
  └─ 为什么？ → 原因 A
        └─ 为什么？ → 原因 B
              └─ 为什么？ → 原因 C（通常这里是真正的根因）
```

**引导语模板：**
- "好，我们再往下走一层——为什么会是这样？"
- "如果把这件事剥掉所有包装，最核心的矛盾是什么？"
- "你觉得这件事的'第一张多米诺骨牌'是什么？"
- "如果你只能改变一件事，你会改哪个？"

**触底信号（何时停止追问）：**
用户说出以下类型的话，说明已接近基本事实：
- "其实我真正在意的是……"
- "说到底，我不确定自己是否真的想要……"
- "我从来没这样想过，但……"

---

### 阶段 3：重建方案（从零构建）

目标：基于已确认的基本事实，引导用户自己推导出方案。

**核心原则：先让用户自己说，再补充。**

**引导语模板：**
- "好，现在我们知道了[基本事实]——如果从这里出发，你会怎么做？"
- "忘掉你原来的做法，如果重新设计，你会怎么想？"
- "有没有一种方案，是你之前因为某个假设而排除掉的？"
- "如果资源/时间/规则都不是问题，你的第一直觉是什么？"

**避免的做法：**
- ❌ 直接给出三个选项让用户选
- ❌ 说"你应该……"
- ✅ 说"你觉得……是否可行？"
- ✅ 说"基于你说的，有没有可能……"

---

### 阶段 4：检验与行动

目标：让用户验证新方案是否基于坚实的事实，并确定第一步行动。

**引导语模板：**
- "这个方案依赖哪些假设？这些假设你确认过吗？"
- "最小可验证的一步是什么？"
- "如果这个方案失败，最可能的原因是什么？"
- "你现在最想做的第一件事是什么？"

---

### 阶段 5：总结与脑图（收尾必做）

目标：将整场对话的洞察结构化，帮用户看清全貌，形成可执行的认知地图。

**触发时机：**
- 用户说"好，我清楚了"、"谢谢，我知道怎么做了"
- 阶段 4 完成后
- 用户主动要求"帮我整理一下"

**两步交付：**

#### Step A：文字总结（先输出）

用以下四个维度整理对话结论，语言简洁、用用户自己的词汇：

```
## 🔍 思维复盘

**原始问题：** [用户最初提出的问题]
**真实问题：** [经过追问后发现的核心矛盾]

---

### ✅ 核心问题（优先解决）
> 这是根因，解决它能撬动全局
- [核心问题 1]
- [核心问题 2（若有）]

### ⚠️ 干扰因素（识别但不纠缠）
> 真实存在，但不是突破口；解决核心问题后它们会自然减弱
- [干扰因素 1]
- [干扰因素 2]

### 🚫 伪问题（需要防备）
> 看起来重要，实际是假设或错误归因；花精力在这里是陷阱
- [伪问题 1]
- [伪问题 2]

### 🔜 次要问题（稍后处理）
> 真实存在，但时机未到；核心问题解决后再回头看
- [次要问题 1]

---

### 💡 关键洞察
[用一两句话点出整场对话最重要的思维转变]

### 🎯 第一步行动
[具体、可执行、今天就能开始的一件事]
```

#### Step B：脑图（文字总结后立即生成）

文字总结输出完毕后，**立即调用 show_widget 工具**生成交互式脑图。

**脑图必须包含的七个信息层：**

**① 认知转变轴（顶部横条）**
并排展示"原始问题"与"真实问题"，中间用箭头连接，原始问题加删除线或虚线框。
让用户一眼看到"我以为是这个 → 实际是这个"的思维跃迁。

**② 中心节点：真实问题**
经过追问后确认的核心矛盾，作为整张脑图的重心。

**③ 四色分支（放射状展开）**
- 🔴 红色/coral：核心问题（优先解决，根因）
- 🟡 黄色/amber：干扰因素（识别但不纠缠）
- ⚫ 灰色/gray：伪问题（虚线框 + 删除线，需防备的陷阱）
- 🔵 蓝色/blue：次要问题（稍后处理）

**④ 被打破的关键假设（侧边栏或独立区块）**
列出对话中被识别并打破的 2-3 个假设，每条前加"✕ 原以为："标注。
这是第一性原理分析最核心的产出，不能丢失。

**⑤ 关键洞察引用卡片**
将对话中最关键的那句话（通常是用户自己说出来的）单独展示为引用卡片，
放在脑图显眼位置，用引号 + 斜体 + 高亮背景区分。

**⑥ 行动时间轴（底部）**
将行动拆分为三个时间维度：
- 🎯 今天：第一步具体行动（可执行，不超过一件事）
- 📅 本周：需要跟进或验证的事
- 🔭 长期：核心问题解决后期望达到的状态

**⑦ 风险提示（附在核心问题节点旁）**
阶段 4 中用户回答的"方案最可能失败的原因"，
以小标注或 ⚠️ 角标形式附在核心问题节点旁，提醒用户主动防备。

---

**多线索深挖时的额外结构：**
- 每条探索线索作为独立分支，标注各自触底得到的基本事实
- 关联路径用虚线连接（同根型画汇聚线，链式型画箭头）
- 收敛点（核心问题）用加粗/高亮节点突出

```
[原始问题]──→──[真实问题]   ← 认知转变轴（顶部）
                   │
      ┌────────────┼────────────┐
      ↓            ↓            ↓
  [核心问题]   [干扰因素]   [伪问题]
  ⚠️风险提示              （删除线）
                   ↓
              [次要问题]

左侧边栏：✕ 被打破的假设 1
          ✕ 被打破的假设 2

中部引用：" 用户说出的关键洞察 "

底部时间轴：🎯今天 → 📅本周 → 🔭长期
```

**每个节点可点击展开说明，整张脑图需适配深色/浅色主题。**
`;

serve(async (req) => {
  // 处理 CORS 预检请求
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

    // 验证用户
    const {
      data: { user },
      error: userError,
    } = await supabaseClient.auth.getUser()

    if (userError || !user) {
      return new Response(
        JSON.stringify({
          success: false,
          error: '未授权访问',
        }),
        {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          status: 401,
        }
      )
    }

    const requestData: ChatRequest = await req.json()
    const { messages, conversationId, userId } = requestData

    // 验证请求数据
    if (!messages || !Array.isArray(messages) || messages.length === 0) {
      return new Response(
        JSON.stringify({
          success: false,
          error: '消息不能为空',
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
          error: '最后一条消息必须是用户消息',
        }),
        {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          status: 400,
        }
      )
    }

    let conversation = conversationId

    // 如果没有 conversationId，创建新对话
    if (!conversation) {
      const { data: newConversation, error: convError } = await supabaseClient
        .from('conversations')
        .insert({
          user_id: userId,
          title: lastMessage.content.substring(0, 50) + (lastMessage.content.length > 50 ? '...' : ''),
          status: 'active',
          current_phase: 'anchor',
          phase_progress: 0,
        })
        .select('id')
        .single()

      if (convError) {
        throw new Error(`创建对话失败: ${convError.message}`)
      }

      conversation = newConversation.id
    }

    // 保存用户消息
    const { data: savedMessage, error: msgError } = await supabaseClient
      .from('messages')
      .insert({
        conversation_id: conversation,
        role: 'user',
        content: lastMessage.content,
        created_at: new Date().toISOString(),
      })
      .select('id')
      .single()

    if (msgError) {
      throw new Error(`保存消息失败: ${msgError.message}`)
    }

    // 调用 DeepSeek API 进行第一性原理思考
    const aiResponse = await callDeepSeekAPI({
      messages: messages,
      conversationId: conversation,
      userId: userId,
    })

    // 保存 AI 回复
    if (aiResponse.success && aiResponse.message) {
      await supabaseClient
        .from('messages')
        .insert({
          conversation_id: conversation,
          role: 'assistant',
          content: aiResponse.message,
          model_used: aiResponse.data?.model || 'deepseek-chat',
          tokens_used: aiResponse.data?.tokens || 0,
          created_at: new Date().toISOString(),
        })
    }

    // 更新对话进度（基于第一性原理阶段）
    const currentPhase = determineCurrentPhase(aiResponse.message || '')
    const progress = calculatePhaseProgress(currentPhase)

    await supabaseClient
      .from('conversations')
      .update({
        current_phase: currentPhase,
        phase_progress: progress,
        updated_at: new Date().toISOString(),
      })
      .eq('id', conversation)

    const response: ChatResponse = {
      success: true,
      message: aiResponse.message || '消息已接收，正在思考中...',
      data: {
        ...aiResponse.data,
        current_phase: currentPhase,
        progress: progress,
      },
      conversationId: conversation,
      messageId: savedMessage.id,
    }

    return new Response(
      JSON.stringify(response),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 200,
      }
    )

  } catch (error) {
    console.error('Chat function error:', error)

    return new Response(
      JSON.stringify({
        success: false,
        error: error.message || '服务器内部错误',
      }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 500,
      }
    )
  }
})

// 调用 DeepSeek API（简化架构）
async function callDeepSeekAPI(params: {
  messages: Array<{ role: string, content: string }>
  conversationId: string
  userId: string
}): Promise<ChatResponse> {
  try {
    const deepseekApiKey = Deno.env.get('DEEPSEEK_API_KEY')
    if (!deepseekApiKey) {
      throw new Error('DeepSeek API 密钥未配置')
    }

    // 构建系统提示词（包含第一性原理 skill）
    const systemPrompt = FIRST_PRINCIPLES_SKILL

    // 准备消息历史
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
      throw new Error(`DeepSeek API 错误: ${response.status} - ${errorText}`)
    }

    const data = await response.json()
    const message = data.choices?.[0]?.message?.content || '抱歉，我无法生成回复。'
    const tokens = data.usage?.total_tokens || 0

    return {
      success: true,
      message: message,
      data: {
        provider: 'deepseek',
        model: 'deepseek-chat',
        tokens: tokens,
        simplified_architecture: true,
      },
    }

  } catch (error) {
    console.error('DeepSeek API 调用失败:', error)
    
    return {
      success: false,
      error: 'AI 服务暂时不可用，请稍后重试。',
      data: {
        error: error.message,
        fallback: false,
      },
    }
  }
}

// 根据回复内容确定当前阶段
function determineCurrentPhase(message: string): string {
  const lowerMessage = message.toLowerCase()
  
  if (lowerMessage.includes('假设') || lowerMessage.includes('assumption')) {
    return 'assumptions'
  } else if (lowerMessage.includes('为什么') || lowerMessage.includes('why') || lowerMessage.includes('root cause')) {
    return 'root_cause'
  } else if (lowerMessage.includes('方案') || lowerMessage.includes('solution') || lowerMessage.includes('建议')) {
    return 'solution'
  } else if (lowerMessage.includes('总结') || lowerMessage.includes('summary') || lowerMessage.includes('脑图')) {
    return 'mindmap'
  } else {
    return 'anchor'
  }
}

// 计算阶段进度
function calculatePhaseProgress(phase: string): number {
  const phaseWeights: Record<string, number> = {
    'anchor': 10,
    'assumptions': 30,
    'root_cause': 60,
    'solution': 85,
    'mindmap': 100,
  }
