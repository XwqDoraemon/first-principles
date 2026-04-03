-- First Principles 简化架构数据库迁移
-- 移除 CrewAI 相关表，简化架构
-- 创建时间: 2026-04-03

-- 删除 CrewAI 相关的表（如果存在）
DROP TABLE IF EXISTS public.thinking_sessions CASCADE;
DROP TABLE IF EXISTS public.usage_stats CASCADE;

-- 简化 conversations 表，移除 CrewAI 相关字段
ALTER TABLE public.conversations 
DROP COLUMN IF EXISTS current_phase,
DROP COLUMN IF EXISTS phase_progress;

-- 简化 messages 表，移除 AI 分析相关字段
ALTER TABLE public.messages 
DROP COLUMN IF EXISTS analysis_result,
DROP COLUMN IF EXISTS model_used,
DROP COLUMN IF EXISTS tokens_used;

-- 创建简化的 conversations 表（如果不存在）
CREATE TABLE IF NOT EXISTS public.conversations (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID REFERENCES public.users(id) ON DELETE CASCADE,
    title TEXT NOT NULL DEFAULT 'New Session',
    
    -- 会话状态
    status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'archived', 'deleted')),
    
    -- 元数据
    message_count INTEGER DEFAULT 0,
    last_message_at TIMESTAMP WITH TIME ZONE,
    
    -- 时间戳
    created_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc'::text, NOW()) NOT NULL,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc'::text, NOW()) NOT NULL,
    
    -- 索引
    CONSTRAINT conversations_user_id_status_idx UNIQUE(user_id, status, created_at)
);

-- 创建简化的 messages 表（如果不存在）
CREATE TABLE IF NOT EXISTS public.messages (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    conversation_id UUID REFERENCES public.conversations(id) ON DELETE CASCADE NOT NULL,
    
    -- 消息内容
    role TEXT NOT NULL CHECK (role IN ('user', 'assistant', 'system')),
    content TEXT NOT NULL,
    
    -- 时间戳
    created_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc'::text, NOW()) NOT NULL,
    
    -- 索引
    CONSTRAINT messages_conversation_created_idx UNIQUE(conversation_id, created_at)
);

-- 创建简化的 mindmaps 表（如果不存在）
CREATE TABLE IF NOT EXISTS public.mindmaps (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    conversation_id UUID REFERENCES public.conversations(id) ON DELETE CASCADE NOT NULL,
    
    -- 导图数据
    title TEXT NOT NULL,
    mermaid_syntax TEXT NOT NULL,
    svg_content TEXT,
    
    -- 元数据
    nodes_count INTEGER DEFAULT 0,
    edges_count INTEGER DEFAULT 0,
    
    -- 时间戳
    created_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc'::text, NOW()) NOT NULL,
    
    -- 索引
    CONSTRAINT mindmaps_conversation_unique UNIQUE(conversation_id)
);

-- 重新创建索引
DROP INDEX IF EXISTS idx_conversations_user_id;
DROP INDEX IF EXISTS idx_conversations_status;
DROP INDEX IF EXISTS idx_messages_conversation_id;
DROP INDEX IF EXISTS idx_mindmaps_conversation_id;

CREATE INDEX IF NOT EXISTS idx_conversations_user_id ON public.conversations(user_id);
CREATE INDEX IF NOT EXISTS idx_conversations_status ON public.conversations(status);
CREATE INDEX IF NOT EXISTS idx_messages_conversation_id ON public.messages(conversation_id);
CREATE INDEX IF NOT EXISTS idx_mindmaps_conversation_id ON public.mindmaps(conversation_id);

-- 重新创建 RLS 策略
DROP POLICY IF EXISTS "用户只能访问自己的对话" ON public.conversations;
DROP POLICY IF EXISTS "用户只能访问自己对话的消息" ON public.messages;
DROP POLICY IF EXISTS "用户只能访问自己对话的思维导图" ON public.mindmaps;

ALTER TABLE public.conversations ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.messages ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.mindmaps ENABLE ROW LEVEL SECURITY;

-- 用户只能访问自己的对话
CREATE POLICY "用户只能访问自己的对话" ON public.conversations
    FOR ALL USING (auth.uid() IN (SELECT auth_id FROM public.users WHERE id = user_id));

-- 用户只能访问自己对话的消息
CREATE POLICY "用户只能访问自己对话的消息" ON public.messages
    FOR ALL USING (EXISTS (
        SELECT 1 FROM public.conversations c
        JOIN public.users u ON c.user_id = u.id
        WHERE c.id = conversation_id AND u.auth_id = auth.uid()
    ));

-- 用户只能访问自己对话的思维导图
CREATE POLICY "用户只能访问自己对话的思维导图" ON public.mindmaps
    FOR ALL USING (EXISTS (
        SELECT 1 FROM public.conversations c
        JOIN public.users u ON c.user_id = u.id
        WHERE c.id = conversation_id AND u.auth_id = auth.uid()
    ));

-- 重新创建消息计数触发器
DROP TRIGGER IF EXISTS update_message_count ON public.messages;
DROP FUNCTION IF EXISTS update_conversation_message_count();

CREATE OR REPLACE FUNCTION update_conversation_message_count()
RETURNS TRIGGER AS $$
BEGIN
    IF TG_OP = 'INSERT' THEN
        UPDATE public.conversations 
        SET message_count = message_count + 1,
            last_message_at = NEW.created_at
        WHERE id = NEW.conversation_id;
    ELSIF TG_OP = 'DELETE' THEN
        UPDATE public.conversations 
        SET message_count = message_count - 1
        WHERE id = OLD.conversation_id;
    END IF;
    RETURN NULL;
END;
$$ language 'plpgsql';

CREATE TRIGGER update_message_count AFTER INSERT OR DELETE ON public.messages
    FOR EACH ROW EXECUTE FUNCTION update_conversation_message_count();

-- 重新创建更新时间触发器
DROP TRIGGER IF EXISTS update_conversations_updated_at ON public.conversations;

CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = TIMEZONE('utc'::text, NOW());
    RETURN NEW;
END;
$$ language 'plpgsql';

CREATE TRIGGER update_conversations_updated_at BEFORE UPDATE ON public.conversations
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- 注释说明
COMMENT ON TABLE public.conversations IS '对话会话表 - 简化架构版本';
COMMENT ON TABLE public.messages IS '消息记录表 - 简化架构版本';
COMMENT ON TABLE public.mindmaps IS '思维导图表 - 简化架构版本';
COMMENT ON COLUMN public.conversations.status IS '会话状态: active(活跃), archived(归档), deleted(删除)';
COMMENT ON COLUMN public.messages.role IS '消息角色: user(用户), assistant(助手), system(系统)';