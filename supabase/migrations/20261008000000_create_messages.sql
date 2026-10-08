-- CRUD Hello World: one small table for messages of 1-40 characters.
create table public.messages (
  id bigint generated always as identity primary key,
  content text not null check (char_length(content) between 1 and 40),
  created_at timestamptz not null default now()
);

alter table public.messages enable row level security;

-- Demo access: the Worker calls Supabase server-side with the publishable (anon) key.
-- anon may only read/add/delete rows and edit the content column of this one table.
revoke all on table public.messages from anon, authenticated;
grant select, insert, delete on table public.messages to anon;
grant update (content) on table public.messages to anon;

create policy "demo: anyone can read messages" on public.messages
  for select to anon using (true);
create policy "demo: anyone can add messages" on public.messages
  for insert to anon with check (char_length(content) between 1 and 40);
create policy "demo: anyone can edit messages" on public.messages
  for update to anon using (true) with check (char_length(content) between 1 and 40);
create policy "demo: anyone can delete messages" on public.messages
  for delete to anon using (true);
