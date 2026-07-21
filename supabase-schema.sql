-- Run this in Supabase SQL Editor (Dashboard → SQL Editor → New Query)

-- Users table
CREATE TABLE IF NOT EXISTS users (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  email TEXT UNIQUE NOT NULL,
  track TEXT DEFAULT 'SDE',
  city TEXT DEFAULT 'Seattle, WA',
  school TEXT DEFAULT '',
  org TEXT DEFAULT '',
  linkedin TEXT DEFAULT '',
  avail TEXT DEFAULT 'coffee',
  new_too BOOLEAN DEFAULT true,
  building TEXT DEFAULT '',
  interests TEXT[] DEFAULT '{}',
  topics TEXT[] DEFAULT '{}',
  bio TEXT DEFAULT '',
  photo TEXT DEFAULT NULL,
  privacy JSONB DEFAULT '{"onMap":true,"city":true,"office":true,"school":true,"interests":true,"linkedin":true,"email":true,"availability":true}',
  created_at TIMESTAMPTZ DEFAULT now()
);

-- Messages table
CREATE TABLE IF NOT EXISTS messages (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  convo_key TEXT NOT NULL,
  from_id UUID NOT NULL REFERENCES users(id),
  text TEXT NOT NULL,
  ts BIGINT NOT NULL DEFAULT (extract(epoch from now()) * 1000)::bigint,
  created_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_messages_convo_ts ON messages(convo_key, ts);

-- Groups table
CREATE TABLE IF NOT EXISTS groups (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  emoji TEXT DEFAULT '',
  title TEXT NOT NULL,
  description TEXT DEFAULT '',
  city TEXT DEFAULT '',
  created_by UUID REFERENCES users(id),
  created_at TIMESTAMPTZ DEFAULT now()
);

-- Group members
CREATE TABLE IF NOT EXISTS group_members (
  group_id UUID NOT NULL REFERENCES groups(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  joined_at TIMESTAMPTZ DEFAULT now(),
  PRIMARY KEY (group_id, user_id)
);

-- Enable Row Level Security (permissive for hackathon)
ALTER TABLE users ENABLE ROW LEVEL SECURITY;
ALTER TABLE messages ENABLE ROW LEVEL SECURITY;
ALTER TABLE groups ENABLE ROW LEVEL SECURITY;
ALTER TABLE group_members ENABLE ROW LEVEL SECURITY;

-- Allow all operations with anon key (hackathon — no auth complexity).
-- NOTE: fully permissive RLS means anyone with the anon key can read/write/delete
-- any row. Acceptable for a demo; tighten (ownership checks) before real-world use.
-- DROP-then-CREATE makes this script safe to re-run.
DROP POLICY IF EXISTS "Allow all on users" ON users;
DROP POLICY IF EXISTS "Allow all on messages" ON messages;
DROP POLICY IF EXISTS "Allow all on groups" ON groups;
DROP POLICY IF EXISTS "Allow all on group_members" ON group_members;
CREATE POLICY "Allow all on users" ON users FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Allow all on messages" ON messages FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Allow all on groups" ON groups FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Allow all on group_members" ON group_members FOR ALL USING (true) WITH CHECK (true);

-- Enable Realtime (idempotent — ignore "already member of publication" on re-run)
DO $$
BEGIN
  ALTER PUBLICATION supabase_realtime ADD TABLE messages;
  ALTER PUBLICATION supabase_realtime ADD TABLE users;
  ALTER PUBLICATION supabase_realtime ADD TABLE groups;
  ALTER PUBLICATION supabase_realtime ADD TABLE group_members;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- Seed default groups
INSERT INTO groups (id, emoji, title, description, city) VALUES
  ('00000000-0000-0000-0000-000000000001', '🍱', 'Seattle AFEs lunch', 'Grab lunch downtown, Thursdays.', 'Seattle, WA'),
  ('00000000-0000-0000-0000-000000000002', '🎤', 'HDE interns Q&A', 'HDE-only space to swap portfolio + critique tips.', ''),
  ('00000000-0000-0000-0000-000000000003', '📊', 'First demo prep', 'Practice your first sprint demo, get gentle feedback.', ''),
  ('00000000-0000-0000-0000-000000000004', '🧍', 'First-standup brown bag (PT)', 'Pacific-time first-timers: what even is a standup?', '')
ON CONFLICT (id) DO NOTHING;
