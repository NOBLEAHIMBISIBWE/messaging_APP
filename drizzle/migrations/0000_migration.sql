CREATE TABLE public.profiles (
  id uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  username text NOT NULL UNIQUE,
  prompt text NOT NULL DEFAULT 'Send me an anonymous message!',
  blocked_words text[] NOT NULL DEFAULT '{}',
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT ON public.profiles TO anon;
GRANT SELECT, UPDATE ON public.profiles TO authenticated;
GRANT ALL ON public.profiles TO service_role;
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
CREATE POLICY "own profile read" ON public.profiles FOR SELECT TO authenticated USING (auth.uid() = id);
CREATE POLICY "own profile update" ON public.profiles FOR UPDATE TO authenticated USING (auth.uid() = id) WITH CHECK (auth.uid() = id);

-- public view of safe columns only
CREATE VIEW public.public_profiles WITH (security_invoker = false) AS
  SELECT username, prompt FROM public.profiles;
GRANT SELECT ON public.public_profiles TO anon, authenticated;

CREATE TABLE public.messages (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  receiver_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  content text NOT NULL,
  sender_hash text NOT NULL,
  is_reported boolean NOT NULL DEFAULT false,
  is_archived boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, UPDATE, DELETE ON public.messages TO authenticated;
GRANT ALL ON public.messages TO service_role;
ALTER TABLE public.messages ENABLE ROW LEVEL SECURITY;
CREATE POLICY "receiver reads" ON public.messages FOR SELECT TO authenticated USING (auth.uid() = receiver_id);
CREATE POLICY "receiver updates" ON public.messages FOR UPDATE TO authenticated USING (auth.uid() = receiver_id) WITH CHECK (auth.uid() = receiver_id);
CREATE POLICY "receiver deletes" ON public.messages FOR DELETE TO authenticated USING (auth.uid() = receiver_id);
CREATE INDEX ON public.messages (receiver_id, created_at DESC);
CREATE INDEX ON public.messages (sender_hash, created_at DESC);
-- hide sender_hash from receivers
REVOKE SELECT ON public.messages FROM authenticated;
GRANT SELECT (id, receiver_id, content, is_reported, is_archived, created_at) ON public.messages TO authenticated;

CREATE OR REPLACE FUNCTION public.send_message(_username text, _content text, _sender text)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE r public.profiles; w text; c text;
BEGIN
  c := btrim(_content);
  IF c IS NULL OR length(c) = 0 THEN RAISE EXCEPTION 'Message is empty'; END IF;
  IF length(c) > 500 THEN RAISE EXCEPTION 'Message is too long (max 500 characters)'; END IF;
  IF _sender IS NULL OR length(_sender) < 8 OR length(_sender) > 100 THEN RAISE EXCEPTION 'Invalid sender'; END IF;
  SELECT * INTO r FROM public.profiles WHERE username = lower(_username);
  IF NOT FOUND THEN RAISE EXCEPTION 'User not found'; END IF;
  IF (SELECT count(*) FROM public.messages WHERE sender_hash = md5(_sender) AND created_at > now() - interval '1 minute') >= 5 THEN
    RAISE EXCEPTION 'Slow down! You can send 5 messages per minute.';
  END IF;
  FOREACH w IN ARRAY r.blocked_words LOOP
    IF length(w) > 0 AND position(lower(w) in lower(c)) > 0 THEN
      RAISE EXCEPTION 'This person doesn''t accept messages with that wording.';
    END IF;
  END LOOP;
  INSERT INTO public.messages (receiver_id, content, sender_hash) VALUES (r.id, c, md5(_sender));
END $$;
REVOKE ALL ON FUNCTION public.send_message(text,text,text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.send_message(text,text,text) TO anon, authenticated;

CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE base text; u text; n int := 0;
BEGIN
  base := lower(regexp_replace(coalesce(NEW.raw_user_meta_data->>'username', split_part(NEW.email,'@',1)), '[^a-zA-Z0-9_]', '', 'g'));
  IF length(base) < 3 THEN base := 'user' || base; END IF;
  base := left(base, 20);
  u := base;
  WHILE EXISTS (SELECT 1 FROM public.profiles WHERE username = u) LOOP
    n := n + 1; u := base || n;
  END LOOP;
  INSERT INTO public.profiles (id, username) VALUES (NEW.id, u);
  RETURN NEW;
END $$;
CREATE TRIGGER on_auth_user_created AFTER INSERT ON auth.users FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();