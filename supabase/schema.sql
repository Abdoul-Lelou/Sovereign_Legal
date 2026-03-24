-- Enable the pgvector extension to work with embedding vectors
create extension if not exists vector;

-- Create a table to store your cases and their embeddings
create table if not exists case_embeddings_chat (
  id uuid primary key default gen_random_uuid(),
  case_id uuid not null,
  content text not null,
  embedding vector(1536), -- Truncated gemini-embedding-001 output
  metadata jsonb,
  created_at timestamp with time zone default timezone('utc'::text, now()) not null
);

-- Enable RLS
alter table case_embeddings_chat enable row level security;

-- Create policies (for testing it's easiest to allow anon read if you aren't doing full auth yet, or restrict it)
create policy "Allow public read access"
  on case_embeddings_chat
  for select
  to public
  using (true);

-- Create a function to search for similar cases
create or replace function match_case_embeddings_chat (
  query_embedding vector(1536),
  match_threshold float,
  match_count int
)
returns table (
  id uuid,
  case_id uuid,
  content text,
  metadata jsonb,
  similarity float
)
language sql stable
as $$
  select
    case_embeddings_chat.id,
    case_embeddings_chat.case_id,
    case_embeddings_chat.content,
    case_embeddings_chat.metadata,
    1 - (case_embeddings_chat.embedding <=> query_embedding) as similarity
  from case_embeddings_chat
  where 1 - (case_embeddings_chat.embedding <=> query_embedding) > match_threshold
  order by case_embeddings_chat.embedding <=> query_embedding
  limit match_count;
$$;

-- Table for conversations
create table if not exists conversations (
  id uuid primary key default gen_random_uuid(),
  title text not null default 'Nouvelle conversation',
  user_id uuid references auth.users(id),
  created_at timestamp with time zone default timezone('utc'::text, now()) not null
);

-- Table for chat history
create table if not exists chat_messages (
  id uuid primary key default gen_random_uuid(),
  conversation_id uuid references conversations(id) on delete cascade,
  user_id uuid references auth.users(id), -- Optional: for RLS if auth is enabled
  role text not null check (role in ('user', 'assistant')),
  content text not null,
  created_at timestamp with time zone default timezone('utc'::text, now()) not null
);

-- Enable RLS
alter table conversations enable row level security;
alter table chat_messages enable row level security;

-- Policies for conversations
create policy "Users can manage their own conversations"
  on conversations for all
  using (true); -- Demo/Assessment: allow all for now

-- Policies for chat_messages
create policy "Users can see their own messages"
  on chat_messages for select
  using (true); -- Demo/Assessment: allow all read

create policy "Users can insert their own messages"
  on chat_messages for insert
  with check (true);

create policy "Service role can manage messages"
  on chat_messages for all
  using (true);
