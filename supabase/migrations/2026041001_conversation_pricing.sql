-- Conversation pricing update:
-- 1. New users get 2 free sessions
-- 2. After free sessions are exhausted, each new conversation costs 2 credits

ALTER TABLE public.users
  ADD COLUMN IF NOT EXISTS free_sessions_remaining INTEGER NOT NULL DEFAULT 2;

ALTER TABLE public.users
  ALTER COLUMN credits_balance SET DEFAULT 0;

UPDATE public.users
SET free_sessions_remaining = COALESCE(free_sessions_remaining, 2)
WHERE free_sessions_remaining IS NULL;

CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO public.users (id, email, credits_balance, free_sessions_remaining)
  VALUES (NEW.id, NEW.email, 0, 2);
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE OR REPLACE FUNCTION public.start_conversation_session(user_id UUID)
RETURNS TABLE (
  allowed BOOLEAN,
  charged_credits INTEGER,
  remaining_credits INTEGER,
  free_sessions_remaining INTEGER,
  message TEXT
) AS $$
DECLARE
  current_free INTEGER;
  current_balance INTEGER;
BEGIN
  SELECT u.free_sessions_remaining, u.credits_balance
  INTO current_free, current_balance
  FROM public.users u
  WHERE u.id = user_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'User not found';
  END IF;

  IF current_free > 0 THEN
    UPDATE public.users
    SET free_sessions_remaining = free_sessions_remaining - 1,
        total_sessions = total_sessions + 1
    WHERE id = user_id
    RETURNING credits_balance, free_sessions_remaining
    INTO remaining_credits, free_sessions_remaining;

    INSERT INTO public.credit_transactions (user_id, amount, transaction_type, description, metadata)
    VALUES (
      user_id,
      0,
      'free_trial',
      'Started a free thinking session',
      jsonb_build_object('charged_credits', 0)
    );

    RETURN QUERY
    SELECT TRUE, 0, remaining_credits, free_sessions_remaining, 'Started with a free session'::TEXT;
    RETURN;
  END IF;

  IF current_balance < 2 THEN
    RETURN QUERY
    SELECT FALSE, 0, current_balance, current_free, 'Not enough credits to start a new session'::TEXT;
    RETURN;
  END IF;

  UPDATE public.users
  SET credits_balance = credits_balance - 2,
      total_sessions = total_sessions + 1
  WHERE id = user_id
  RETURNING credits_balance, free_sessions_remaining
  INTO remaining_credits, free_sessions_remaining;

  INSERT INTO public.credit_transactions (user_id, amount, transaction_type, description, metadata)
  VALUES (
    user_id,
    -2,
    'session_consumed',
    'Started a paid thinking session',
    jsonb_build_object('charged_credits', 2)
  );

  RETURN QUERY
  SELECT TRUE, 2, remaining_credits, free_sessions_remaining, 'Charged 2 credits to start a new session'::TEXT;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
