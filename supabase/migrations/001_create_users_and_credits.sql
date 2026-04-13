-- First Principles 数据库架构
-- 创建用户和积分系统

-- 启用 UUID 扩展
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- 用户表（扩展 auth.users）
CREATE TABLE IF NOT EXISTS public.users (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  email TEXT UNIQUE NOT NULL,
  credits_balance INTEGER DEFAULT 2 NOT NULL, -- 新用户默认 2 次免费
  total_sessions INTEGER DEFAULT 0 NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW() NOT NULL,
  updated_at TIMESTAMPTZ DEFAULT NOW() NOT NULL
);

-- 会话表
CREATE TABLE IF NOT EXISTS public.conversations (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  title TEXT DEFAULT 'New Thinking Session',
  messages JSONB DEFAULT '[]'::jsonb NOT NULL,
  current_phase INTEGER DEFAULT 1 NOT NULL,
  mindmap_data JSONB,
  is_completed BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMPTZ DEFAULT NOW() NOT NULL,
  updated_at TIMESTAMPTZ DEFAULT NOW() NOT NULL
);

-- 积分历史表
CREATE TABLE IF NOT EXISTS public.credit_transactions (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  amount INTEGER NOT NULL, -- 正数为充值，负数为消费
  transaction_type TEXT NOT NULL, -- 'purchase', 'free_trial', 'session_consumed', 'refund'
  description TEXT,
  metadata JSONB DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ DEFAULT NOW() NOT NULL
);

-- 支付订单表
CREATE TABLE IF NOT EXISTS public.orders (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  amount DECIMAL(10,2) NOT NULL,
  currency TEXT DEFAULT 'USD',
  credits_purchased INTEGER NOT NULL,
  status TEXT DEFAULT 'pending' NOT NULL, -- 'pending', 'completed', 'failed', 'refunded'
  payment_provider TEXT DEFAULT 'stripe',
  payment_intent_id TEXT UNIQUE,
  metadata JSONB DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ DEFAULT NOW() NOT NULL,
  completed_at TIMESTAMPTZ
);

-- 索引优化
CREATE INDEX IF NOT EXISTS idx_conversations_user_id ON public.conversations(user_id);
CREATE INDEX IF NOT EXISTS idx_conversations_created_at ON public.conversations(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_credit_transactions_user_id ON public.credit_transactions(user_id);
CREATE INDEX IF NOT EXISTS idx_orders_user_id ON public.orders(user_id);
CREATE INDEX IF NOT EXISTS idx_orders_status ON public.orders(status);

-- RLS (Row Level Security) 策略
ALTER TABLE public.users ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.conversations ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.credit_transactions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.orders ENABLE ROW LEVEL SECURITY;

-- 用户只能访问自己的数据 (保持幂等，避免重复创建导致迁移失败)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE schemaname = 'public' AND tablename = 'users' AND policyname = 'Users can view own data'
  ) THEN
    CREATE POLICY "Users can view own data" ON public.users
      FOR SELECT USING (auth.uid() = id);
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE schemaname = 'public' AND tablename = 'users' AND policyname = 'Users can update own data'
  ) THEN
    CREATE POLICY "Users can update own data" ON public.users
      FOR UPDATE USING (auth.uid() = id);
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE schemaname = 'public' AND tablename = 'conversations' AND policyname = 'Users can view own conversations'
  ) THEN
    CREATE POLICY "Users can view own conversations" ON public.conversations
      FOR SELECT USING (auth.uid() = user_id);
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE schemaname = 'public' AND tablename = 'conversations' AND policyname = 'Users can insert own conversations'
  ) THEN
    CREATE POLICY "Users can insert own conversations" ON public.conversations
      FOR INSERT WITH CHECK (auth.uid() = user_id);
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE schemaname = 'public' AND tablename = 'conversations' AND policyname = 'Users can update own conversations'
  ) THEN
    CREATE POLICY "Users can update own conversations" ON public.conversations
      FOR UPDATE USING (auth.uid() = user_id);
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE schemaname = 'public' AND tablename = 'credit_transactions' AND policyname = 'Users can view own transactions'
  ) THEN
    CREATE POLICY "Users can view own transactions" ON public.credit_transactions
      FOR SELECT USING (auth.uid() = user_id);
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE schemaname = 'public' AND tablename = 'orders' AND policyname = 'Users can view own orders'
  ) THEN
    CREATE POLICY "Users can view own orders" ON public.orders
      FOR SELECT USING (auth.uid() = user_id);
  END IF;
END $$;

-- 自动更新 updated_at 的触发器
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_trigger WHERE tgname = 'update_users_updated_at'
  ) THEN
    CREATE TRIGGER update_users_updated_at
      BEFORE UPDATE ON public.users
      FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_trigger WHERE tgname = 'update_conversations_updated_at'
  ) THEN
    CREATE TRIGGER update_conversations_updated_at
      BEFORE UPDATE ON public.conversations
      FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
  END IF;
END $$;

-- 新用户注册时自动创建用户记录
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO public.users (id, email, credits_balance)
  VALUES (NEW.id, NEW.email, 2); -- 新用户 2 次免费
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_trigger WHERE tgname = 'on_auth_user_created'
  ) THEN
    CREATE TRIGGER on_auth_user_created
      AFTER INSERT ON auth.users
      FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();
  END IF;
END $$;

-- 检查并扣除积分的函数
CREATE OR REPLACE FUNCTION public.consume_session_credit(user_id UUID)
RETURNS BOOLEAN AS $$
DECLARE
  current_balance INTEGER;
BEGIN
  -- 获取当前积分
  SELECT credits_balance INTO current_balance
  FROM public.users
  WHERE id = user_id
  FOR UPDATE;

  -- 检查积分是否足够
  IF current_balance <= 0 THEN
    RETURN FALSE;
  END IF;

  -- 扣除积分
  UPDATE public.users
  SET credits_balance = credits_balance - 1,
      total_sessions = total_sessions + 1
  WHERE id = user_id;

  -- 记录交易
  INSERT INTO public.credit_transactions (user_id, amount, transaction_type, description)
  VALUES (user_id, -1, 'session_consumed', 'Session consumed');

  RETURN TRUE;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 添加积分的函数
CREATE OR REPLACE FUNCTION public.add_credits(
  user_id UUID,
  amount INTEGER,
  transaction_type TEXT,
  description TEXT,
  order_id UUID DEFAULT NULL
)
RETURNS void AS $$
BEGIN
  -- 添加积分
  UPDATE public.users
  SET credits_balance = credits_balance + amount
  WHERE id = user_id;

  -- 记录交易
  INSERT INTO public.credit_transactions (user_id, amount, transaction_type, description, metadata)
  VALUES (user_id, amount, transaction_type, description, jsonb_build_object('order_id', order_id));
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 获取用户积分余额的函数
CREATE OR REPLACE FUNCTION public.get_user_credits(user_id UUID)
RETURNS INTEGER AS $$
BEGIN
  RETURN (SELECT credits_balance FROM public.users WHERE id = user_id);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
