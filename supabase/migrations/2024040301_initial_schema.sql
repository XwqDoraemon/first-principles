-- First Principles 数据库初始 Schema
-- 创建时间: 2026-04-03

-- 启用必要的扩展
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- 用户表 (使用 Supabase Auth 的用户扩展)
CREATE TABLE IF NOT EXISTS public.users (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    email TEXT UNIQUE NOT NULL,
    username TEXT,
    avatar_url TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc'::text, NOW()) NOT NULL,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc'::text, NOW()) NOT NULL,
    
    -- 来自 Supabase Auth 的引用
    auth_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
    
    -- 用户设置
    settings JSONB DEFAULT '{"theme": "dark", "language": "en"}'::jsonb,
    
    -- 使用统计
    usage_count INTEGER DEFAULT 0,
    last_active_at TIMESTAMP WITH TIME ZONE
);

-- 对话会话表
CREATE TABLE IF NOT EXISTS public.conversations (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID REFERENCES public.users(id) ON DELETE CASCADE,
    title TEXT NOT NULL DEFAULT 'New Session',
    
    -- 会话状态
    status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'archived', 'deleted')),
    
    -- 元数据
    message_count INTEGER DEFAULT 0,
    last_message_at TIMESTAMP WITH TIME ZONE,
    
    -- 第一性原理阶段
    current_phase TEXT DEFAULT 'anchor' CHECK (current_phase IN ('anchor', 'assumptions', 'root_cause', 'solution', 'mindmap')),
    phase_progress INTEGER DEFAULT 0 CHECK (phase_progress >= 0 AND phase_progress <= 100),
    
    -- 时间戳
    created_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc'::text, NOW()) NOT NULL,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc'::text, NOW()) NOT NULL,
    
    -- 索引
    CONSTRAINT conversations_user_id_status_idx UNIQUE(user_id, status, created_at)
);

-- 消息表
CREATE TABLE IF NOT EXISTS public.messages (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    conversation_id UUID REFERENCES public.conversations(id) ON DELETE CASCADE NOT NULL,
    
    -- 消息内容
    role TEXT NOT NULL CHECK (role IN ('user', 'assistant', 'system')),
    content TEXT NOT NULL,
    
    -- AI 相关字段
    model_used TEXT,
    tokens_used INTEGER,
    
    -- 第一性原理分析结果 (JSON)
    analysis_result JSONB,
    
    -- 时间戳
    created_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc'::text, NOW()) NOT NULL,
    
    -- 索引
    CONSTRAINT messages_conversation_created_idx UNIQUE(conversation_id, created_at)
);

-- CrewAI 思考会话表
CREATE TABLE IF NOT EXISTS public.thinking_sessions (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    conversation_id UUID REFERENCES public.conversations(id) ON DELETE CASCADE NOT NULL,
    user_id UUID REFERENCES public.users(id) ON DELETE CASCADE,
    
    -- 会话状态
    status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'running', 'completed', 'failed', 'cancelled')),
    
    -- 输入和输出
    user_input TEXT NOT NULL,
    phase TEXT NOT NULL DEFAULT 'anchor' CHECK (phase IN ('anchor', 'assumptions', 'root_cause', 'solution', 'mindmap')),
    
    -- 分析结果 (JSON)
    problem_statement JSONB,
    assumption_analysis JSONB,
    root_cause_analysis JSONB,
    solution_design JSONB,
    mind_map_data JSONB,
    
    -- 性能指标
    started_at TIMESTAMP WITH TIME ZONE,
    completed_at TIMESTAMP WITH TIME ZONE,
    duration_seconds INTEGER,
    
    -- 错误信息
    error_message TEXT,
    error_stack TEXT,
    
    -- 元数据
    crewai_session_id TEXT,
    model_used TEXT,
    total_tokens INTEGER,
    
    -- 时间戳
    created_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc'::text, NOW()) NOT NULL,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc'::text, NOW()) NOT NULL
);

-- 思维导图表
CREATE TABLE IF NOT EXISTS public.mindmaps (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    conversation_id UUID REFERENCES public.conversations(id) ON DELETE CASCADE NOT NULL,
    thinking_session_id UUID REFERENCES public.thinking_sessions(id) ON DELETE SET NULL,
    
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

-- 使用统计表
CREATE TABLE IF NOT EXISTS public.usage_stats (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID REFERENCES public.users(id) ON DELETE CASCADE,
    
    -- 统计周期
    period_date DATE NOT NULL,
    period_type TEXT NOT NULL CHECK (period_type IN ('daily', 'weekly', 'monthly')),
    
    -- 使用量统计
    conversation_count INTEGER DEFAULT 0,
    message_count INTEGER DEFAULT 0,
    thinking_session_count INTEGER DEFAULT 0,
    total_tokens INTEGER DEFAULT 0,
    
    -- AI 提供商使用统计
    openai_tokens INTEGER DEFAULT 0,
    deepseek_tokens INTEGER DEFAULT 0,
    other_tokens INTEGER DEFAULT 0,
    
    -- 时间戳
    created_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc'::text, NOW()) NOT NULL,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc'::text, NOW()) NOT NULL,
    
    -- 唯一约束
    CONSTRAINT usage_stats_user_period_unique UNIQUE(user_id, period_date, period_type)
);

-- 创建索引
CREATE INDEX IF NOT EXISTS idx_conversations_user_id ON public.conversations(user_id);
CREATE INDEX IF NOT EXISTS idx_conversations_status ON public.conversations(status);
CREATE INDEX IF NOT EXISTS idx_messages_conversation_id ON public.messages(conversation_id);
CREATE INDEX IF NOT EXISTS idx_thinking_sessions_conversation_id ON public.thinking_sessions(conversation_id);
CREATE INDEX IF NOT EXISTS idx_thinking_sessions_status ON public.thinking_sessions(status);
CREATE INDEX IF NOT EXISTS idx_mindmaps_conversation_id ON public.mindmaps(conversation_id);
CREATE INDEX IF NOT EXISTS idx_usage_stats_user_id ON public.usage_stats(user_id);
CREATE INDEX IF NOT EXISTS idx_usage_stats_period ON public.usage_stats(period_date);

-- 创建 RLS (Row Level Security) 策略
ALTER TABLE public.users ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.conversations ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.messages ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.thinking_sessions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.mindmaps ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.usage_stats ENABLE ROW LEVEL SECURITY;

-- 用户只能访问自己的数据
CREATE POLICY "用户只能访问自己的数据" ON public.users
    FOR ALL USING (auth.uid() = auth_id);

CREATE POLICY "用户只能访问自己的对话" ON public.conversations
    FOR ALL USING (auth.uid() IN (SELECT auth_id FROM public.users WHERE id = user_id));

CREATE POLICY "用户只能访问自己对话的消息" ON public.messages
    FOR ALL USING (EXISTS (
        SELECT 1 FROM public.conversations c
        JOIN public.users u ON c.user_id = u.id
        WHERE c.id = conversation_id AND u.auth_id = auth.uid()
    ));

CREATE POLICY "用户只能访问自己的思考会话" ON public.thinking_sessions
    FOR ALL USING (auth.uid() IN (SELECT auth_id FROM public.users WHERE id = user_id));

CREATE POLICY "用户只能访问自己对话的思维导图" ON public.mindmaps
    FOR ALL USING (EXISTS (
        SELECT 1 FROM public.conversations c
        JOIN public.users u ON c.user_id = u.id
        WHERE c.id = conversation_id AND u.auth_id = auth.uid()
    ));

CREATE POLICY "用户只能访问自己的使用统计" ON public.usage_stats
    FOR ALL USING (auth.uid() IN (SELECT auth_id FROM public.users WHERE id = user_id));

-- 创建更新时间触发器函数
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = TIMEZONE('utc'::text, NOW());
    RETURN NEW;
END;
$$ language 'plpgsql';

-- 为需要 updated_at 的表添加触发器
CREATE TRIGGER update_users_updated_at BEFORE UPDATE ON public.users
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_conversations_updated_at BEFORE UPDATE ON public.conversations
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_thinking_sessions_updated_at BEFORE UPDATE ON public.thinking_sessions
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_usage_stats_updated_at BEFORE UPDATE ON public.usage_stats
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- 创建消息计数触发器
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

-- 创建初始数据（可选）
-- 注意：auth_id 需要引用有效的 auth.users 记录
-- INSERT INTO public.users (email, username, auth_id) 
-- VALUES ('demo@firstprinciples.ai', 'Demo User', 'valid-auth-uuid-here')
-- ON CONFLICT (email) DO NOTHING;