-- Evolution v2: "mundo por código" substitui amizades e busca global (decisão do usuário).
-- Identidade = usuário anônimo do Supabase com nome; quem cria um mundo recebe um código (até 10 membros);
-- "amigos" = membros do mesmo mundo. is_friend() passa a significar isso, então RLS e RPCs de ofertas/desafios seguem.

-- ───────────── sai: amizades, busca e nome único ─────────────
alter publication supabase_realtime drop table public.friendships;
drop function public.request_friend(text), public.respond_friend(bigint, boolean), public.remove_friend(uuid),
  public.username_available(text);
drop table public.friendships;

alter table public.profiles drop constraint profiles_username_key;
alter table public.profiles drop constraint profiles_username_check;
alter table public.profiles alter column username type text;
alter table public.profiles add constraint profiles_username_check
  check (char_length(btrim(username)) between 2 and 16 and username !~ '[[:cntrl:]<>]');

-- ───────────── mundos ─────────────
create table public.worlds (
  id uuid primary key default gen_random_uuid(),
  code text not null unique check (code ~ '^[A-Z2-9]{6}$'),
  owner uuid not null references public.profiles (id) on delete cascade,
  created_at timestamptz not null default now()
);
create table public.world_members (
  user_id uuid primary key references public.profiles (id) on delete cascade, -- um mundo por jogador
  world_id uuid not null references public.worlds (id) on delete cascade,
  joined_at timestamptz not null default now()
);
create index world_members_world on public.world_members (world_id);

create function public.my_world() returns uuid
language sql stable security definer set search_path = '' as $$
  select world_id from public.world_members where user_id = auth.uid();
$$;

create or replace function public.is_friend(a uuid, b uuid) returns boolean
language sql stable security definer set search_path = '' as $$
  select a <> b and exists (
    select 1 from public.world_members m1 join public.world_members m2 on m2.world_id = m1.world_id
    where m1.user_id = a and m2.user_id = b);
$$;

-- devolve as reservas de tudo que está pendente envolvendo o jogador (saiu, foi expulso ou o mundo acabou)
create function public.cancel_pending_for(p_user uuid) returns void
language plpgsql security definer set search_path = '' as $$
declare
  o public.offers;
  m public.matches;
begin
  for o in update public.offers set status = 'cancelled', resolved_at = now()
           where status = 'pending' and p_user in (from_user, to_user) returning * loop
    perform public.deliver(o.from_user, 'offer_cancelled', 'offer:' || o.id, o.give_money,
      case when o.give_bug is null then '[]' else jsonb_build_array(o.give_bug) end, '{}');
  end loop;
  for m in update public.matches set status = 'cancelled', finished_at = now()
           where status = 'pending' and p_user in (challenger, opponent) returning * loop
    perform public.deliver(m.challenger, 'match_cancelled', 'match:' || m.id, m.bet, '[]', '{}');
  end loop;
end $$;

create function public.notify_world(p_world uuid, p_kind text, p_except uuid) returns void
language sql security definer set search_path = '' as $$
  select public.deliver(user_id, p_kind, 'world:' || p_world, 0, '[]', '{}')
  from public.world_members where world_id = p_world and user_id is distinct from p_except;
$$;

create function public.create_world() returns text
language plpgsql security definer set search_path = '' as $$
declare
  uid uuid := public.me();
  c text;
  w uuid;
begin
  if public.my_world() is not null then raise exception 'already in a world'; end if;
  loop
    c := (select string_agg(substr('ABCDEFGHJKLMNPQRSTUVWXYZ23456789', 1 + floor(random() * 32)::int, 1), '')
          from generate_series(1, 6));
    exit when not exists (select 1 from public.worlds where code = c);
  end loop;
  insert into public.worlds (code, owner) values (c, uid) returning id into w;
  insert into public.world_members (user_id, world_id) values (uid, w);
  return c;
end $$;

create function public.join_world(p_code text) returns uuid
language plpgsql security definer set search_path = '' as $$
declare
  uid uuid := public.me();
  w uuid;
begin
  select id into w from public.worlds where code = upper(btrim(p_code)) for update;
  if w is null then raise exception 'world not found'; end if;
  if public.my_world() = w then return w; end if;
  if public.my_world() is not null then raise exception 'already in a world'; end if;
  if (select count(*) from public.world_members where world_id = w) >= 10 then raise exception 'world is full'; end if;
  insert into public.world_members (user_id, world_id) values (uid, w);
  perform public.notify_world(w, 'world_joined', uid);
  return w;
end $$;

create function public.leave_world() returns void
language plpgsql security definer set search_path = '' as $$
declare uid uuid := public.me();
begin
  if exists (select 1 from public.worlds where owner = uid) then raise exception 'the owner ends the world instead'; end if;
  perform public.cancel_pending_for(uid);
  delete from public.world_members where user_id = uid;
end $$;

create function public.kick_member(p_user uuid) returns void
language plpgsql security definer set search_path = '' as $$
declare
  uid uuid := public.me();
  w uuid;
begin
  select id into w from public.worlds where owner = uid;
  if w is null or p_user = uid then raise exception 'not allowed'; end if;
  delete from public.world_members where user_id = p_user and world_id = w;
  if not found then raise exception 'member not found'; end if;
  perform public.cancel_pending_for(p_user);
  perform public.deliver(p_user, 'world_kicked', 'world:' || w, 0, '[]', '{}');
end $$;

create function public.end_world() returns void
language plpgsql security definer set search_path = '' as $$
declare
  uid uuid := public.me();
  w uuid;
  u uuid;
begin
  select id into w from public.worlds where owner = uid;
  if w is null then raise exception 'not allowed'; end if;
  for u in select user_id from public.world_members where world_id = w loop
    perform public.cancel_pending_for(u);
  end loop;
  perform public.notify_world(w, 'world_ended', uid);
  delete from public.worlds where id = w; -- membros saem em cascata
end $$;

-- ping agendado (evita a pausa por inatividade do plano Free)
create function public.ping() returns timestamptz
language sql security definer set search_path = '' as $$ select now(); $$;

-- ───────────── RLS ─────────────
alter table public.worlds enable row level security;
alter table public.world_members enable row level security;

drop policy profiles_read on public.profiles;
create policy profiles_read on public.profiles for select to authenticated
  using (id = (select auth.uid()) or public.is_friend((select auth.uid()), id));
create policy worlds_read on public.worlds for select to authenticated using (id = (select public.my_world()));
create policy members_read on public.world_members for select to authenticated using (world_id = (select public.my_world()));

revoke all on public.worlds, public.world_members from anon, authenticated;
grant select on public.worlds, public.world_members to authenticated;
revoke update (username, look) on public.profiles from authenticated;
grant update (username) on public.profiles to authenticated;

revoke execute on function public.my_world(), public.cancel_pending_for(uuid), public.notify_world(uuid, text, uuid),
  public.create_world(), public.join_world(text), public.leave_world(), public.kick_member(uuid), public.end_world(),
  public.ping() from public, anon, authenticated;
grant execute on function public.my_world(), public.create_world(), public.join_world(text), public.leave_world(),
  public.kick_member(uuid), public.end_world() to authenticated;
grant execute on function public.ping() to anon, authenticated;

alter publication supabase_realtime add table public.world_members;
