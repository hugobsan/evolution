-- Evolution v2: camada social (perfis, save na nuvem, amigos, ofertas, desafios, entregas).
-- Ver docs/V2_DISCOVERY.md. RLS em todas as tabelas; escrita sensível só pelas funções security definer abaixo.

create extension if not exists citext with schema extensions;

-- ───────────── tabelas ─────────────

create table public.profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  username extensions.citext not null unique check (username::text ~ '^[A-Za-z0-9_]{3,16}$'),
  look smallint not null default 2 check (look between 2 and 5), -- aparência do NPC na loja (frames 2–5 do mPeople)
  created_at timestamptz not null default now()
);

create table public.saves (
  user_id uuid primary key references public.profiles (id) on delete cascade,
  data jsonb not null check (octet_length(data::text) <= 262144),
  rev int not null default 1,
  updated_at timestamptz not null default now()
);

create table public.snapshots (
  user_id uuid primary key references public.profiles (id) on delete cascade,
  money int not null default 0 check (money between 0 and 6666666),
  level smallint not null default 0 check (level between 0 and 15),
  days int not null default 0 check (days between 0 and 100000000),
  score int not null default 0 check (score between 0 and 100000000),
  have smallint[] not null default '{}' check (cardinality(have) <= 15),
  bugs jsonb not null default '[]' check (jsonb_typeof(bugs) = 'array' and jsonb_array_length(bugs) <= 12),
  selling smallint not null default 0 check (selling between 0 and 100),
  updated_at timestamptz not null default now()
);

create table public.friendships (
  id bigint generated always as identity primary key,
  requester uuid not null references public.profiles (id) on delete cascade,
  addressee uuid not null references public.profiles (id) on delete cascade,
  status text not null default 'pending' check (status in ('pending', 'accepted')),
  created_at timestamptz not null default now(),
  check (requester <> addressee)
);
create unique index friendships_pair on public.friendships (least(requester, addressee), greatest(requester, addressee));
create index friendships_addressee on public.friendships (addressee);

create table public.offers (
  id bigint generated always as identity primary key,
  from_user uuid not null references public.profiles (id) on delete cascade,
  to_user uuid not null references public.profiles (id) on delete cascade,
  give_bug jsonb,
  give_money int not null default 0 check (give_money between 0 and 6666666),
  want_bug jsonb,
  want_money int not null default 0 check (want_money between 0 and 6666666),
  status text not null default 'pending' check (status in ('pending', 'accepted', 'declined', 'cancelled')),
  created_at timestamptz not null default now(),
  resolved_at timestamptz,
  check (give_bug is not null or want_bug is not null)
);
create index offers_from on public.offers (from_user);
create index offers_to on public.offers (to_user);

create table public.matches (
  id bigint generated always as identity primary key,
  kind text not null check (kind in ('battle', 'race')),
  challenger uuid not null references public.profiles (id) on delete cascade,
  opponent uuid not null references public.profiles (id) on delete cascade,
  bet int not null check (bet between 0 and 100000),
  seed int not null default floor(random() * 2147483647)::int,
  team_a jsonb not null,
  team_b jsonb,
  status text not null default 'pending' check (status in ('pending', 'accepted', 'done', 'declined', 'cancelled')),
  winner uuid,
  result jsonb,
  created_at timestamptz not null default now(),
  accepted_at timestamptz,
  finished_at timestamptz
);
create index matches_challenger on public.matches (challenger);
create index matches_opponent on public.matches (opponent);

-- entregas: tudo que muda o save de alguém por ação de outra pessoa (aplicado pelo cliente, idempotente)
create table public.inbox (
  id bigint generated always as identity primary key,
  user_id uuid not null references public.profiles (id) on delete cascade,
  kind text not null,                 -- evento (para o aviso no jogo): offer_accepted, match_won, ...
  ref text,                           -- 'offer:12', 'match:7'
  money int not null default 0,
  add_bugs jsonb not null default '[]',
  remove_uids text[] not null default '{}',
  created_at timestamptz not null default now(),
  applied_at timestamptz
);
create index inbox_pending on public.inbox (user_id) where applied_at is null;

-- ───────────── auxiliares ─────────────

create function public.is_friend(a uuid, b uuid) returns boolean
language sql stable security definer set search_path = '' as $$
  select exists (
    select 1 from public.friendships f
    where f.status = 'accepted'
      and ((f.requester = a and f.addressee = b) or (f.requester = b and f.addressee = a))
  );
$$;

-- besouro serializado pelo cliente (src/online/bugs.ts): faixas que o jogo produz
create function public.valid_bug(b jsonb) returns boolean
language plpgsql immutable set search_path = '' as $$
begin
  return coalesce(
    jsonb_typeof(b) = 'object'
    and coalesce(b ->> 'uid', '') ~ '^[A-Za-z0-9-]{8,40}$'
    and jsonb_typeof(b -> 'nId') = 'number' and (b ->> 'nId')::numeric in (0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14)
    and jsonb_typeof(b -> 'nId_color') = 'number' and (b ->> 'nId_color')::numeric between 0 and 15
    and jsonb_typeof(b -> 'nGrow') = 'number' and (b ->> 'nGrow')::numeric between 0 and 1000
    and jsonb_typeof(b -> 'nRandom') = 'number' and (b ->> 'nRandom')::numeric between 0 and 1
    and jsonb_typeof(b -> 'nHealth') = 'number' and (b ->> 'nHealth')::numeric between 0 and 100
    and jsonb_typeof(b -> 'nAge_now') = 'number' and (b ->> 'nAge_now')::numeric between 0 and 10000000
    and jsonb_typeof(b -> 'nSex') = 'number' and (b ->> 'nSex')::numeric in (-1, 1)
    and length(coalesce(b ->> 'sNickName', '')) <= 24,
    false);
exception when others then return false; -- cast inválido etc.
end $$;

create function public.valid_team(t jsonb, max_n int) returns boolean
language plpgsql immutable set search_path = '' as $$
begin
  return jsonb_typeof(t) = 'array' and jsonb_array_length(t) between 1 and max_n
    and (select bool_and(public.valid_bug(x)) from jsonb_array_elements(t) x);
exception when others then return false;
end $$;

create function public.me() returns uuid
language plpgsql stable set search_path = '' as $$
begin
  if auth.uid() is null then raise exception 'not authenticated'; end if;
  return auth.uid();
end $$;

-- perfil criado junto com o usuário (username vem do signUp: options.data.username)
create function public.handle_new_user() returns trigger
language plpgsql security definer set search_path = '' as $$
begin
  insert into public.profiles (id, username, look)
  values (new.id, new.raw_user_meta_data ->> 'username', 2 + floor(random() * 4)::int);
  return new;
end $$;
create trigger on_auth_user_created after insert on auth.users
  for each row execute function public.handle_new_user();

create function public.username_available(p_username text) returns boolean
language sql stable security definer set search_path = '' as $$
  select p_username ~ '^[A-Za-z0-9_]{3,16}$'
    and not exists (select 1 from public.profiles where username = p_username::extensions.citext);
$$;

-- ───────────── save ─────────────

create function public.push_save(p_data jsonb, p_snap jsonb, p_base_rev int, p_force boolean default false)
returns int language plpgsql security definer set search_path = '' as $$
declare
  uid uuid := public.me();
  r int;
begin
  if not (jsonb_typeof(p_snap -> 'bugs') = 'array'
          and coalesce((select bool_and(public.valid_bug(x)) from jsonb_array_elements(p_snap -> 'bugs') x), true)) then
    raise exception 'invalid snapshot';
  end if;
  select rev into r from public.saves where user_id = uid for update;
  if r is null then
    r := 1;
    insert into public.saves (user_id, data, rev) values (uid, p_data, r);
  else
    if not p_force and r <> p_base_rev then
      raise exception 'conflict' using detail = r::text, hint = 'save_conflict';
    end if;
    r := r + 1;
    update public.saves set data = p_data, rev = r, updated_at = now() where user_id = uid;
  end if;
  insert into public.snapshots as s (user_id, money, level, days, score, have, bugs, selling, updated_at)
  values (uid, (p_snap ->> 'money')::int, (p_snap ->> 'level')::smallint, (p_snap ->> 'days')::int,
          (p_snap ->> 'score')::int,
          coalesce((select array_agg(x::smallint) from jsonb_array_elements_text(p_snap -> 'have') x), '{}'),
          p_snap -> 'bugs', (p_snap ->> 'selling')::smallint, now())
  on conflict (user_id) do update set
    money = excluded.money, level = excluded.level, days = excluded.days, score = excluded.score,
    have = excluded.have, bugs = excluded.bugs, selling = excluded.selling, updated_at = now();
  return r;
end $$;

-- ───────────── amigos ─────────────

create function public.request_friend(p_username text) returns text
language plpgsql security definer set search_path = '' as $$
declare
  uid uuid := public.me();
  other uuid;
  f public.friendships;
begin
  select id into other from public.profiles where username = p_username::extensions.citext;
  if other is null then raise exception 'user not found'; end if;
  if other = uid then raise exception 'cannot add yourself'; end if;
  select * into f from public.friendships
    where least(requester, addressee) = least(uid, other) and greatest(requester, addressee) = greatest(uid, other);
  if found then
    if f.status = 'pending' and f.addressee = uid then
      update public.friendships set status = 'accepted' where id = f.id;
      return 'accepted';
    end if;
    return f.status; -- já pedido / já amigos
  end if;
  if (select count(*) from public.friendships where requester = uid and status = 'pending') >= 50 then
    raise exception 'too many pending requests';
  end if;
  insert into public.friendships (requester, addressee) values (uid, other);
  return 'requested';
end $$;

create function public.respond_friend(p_id bigint, p_accept boolean) returns void
language plpgsql security definer set search_path = '' as $$
declare uid uuid := public.me();
begin
  if p_accept then
    update public.friendships set status = 'accepted' where id = p_id and addressee = uid and status = 'pending';
  else
    delete from public.friendships where id = p_id and addressee = uid and status = 'pending';
  end if;
  if not found then raise exception 'request not found'; end if;
end $$;

create function public.remove_friend(p_other uuid) returns void
language plpgsql security definer set search_path = '' as $$
declare uid uuid := public.me();
begin
  delete from public.friendships
    where least(requester, addressee) = least(uid, p_other) and greatest(requester, addressee) = greatest(uid, p_other);
end $$;

-- ───────────── entregas ─────────────

create function public.deliver(p_user uuid, p_kind text, p_ref text, p_money int, p_add jsonb, p_remove text[])
returns void language sql security definer set search_path = '' as $$
  insert into public.inbox (user_id, kind, ref, money, add_bugs, remove_uids)
  values (p_user, p_kind, p_ref, coalesce(p_money, 0), coalesce(p_add, '[]'), coalesce(p_remove, '{}'));
$$;

create function public.ack_inbox(p_ids bigint[]) returns void
language sql security definer set search_path = '' as $$
  update public.inbox set applied_at = now()
  where user_id = public.me() and id = any (p_ids) and applied_at is null;
$$;

-- ───────────── ofertas (troca / venda / pedido de compra) ─────────────

create function public.create_offer(p_to uuid, p_give_bug jsonb, p_give_money int, p_want_bug jsonb, p_want_money int)
returns bigint language plpgsql security definer set search_path = '' as $$
declare
  uid uuid := public.me();
  oid bigint;
begin
  if not public.is_friend(uid, p_to) then raise exception 'not friends'; end if;
  if p_give_bug is null and p_want_bug is null then raise exception 'offer needs a bug'; end if;
  if p_give_bug is not null and not public.valid_bug(p_give_bug) then raise exception 'invalid bug'; end if;
  if p_want_bug is not null and not public.valid_bug(p_want_bug) then raise exception 'invalid bug'; end if;
  if (select count(*) from public.offers where from_user = uid and status = 'pending') >= 10 then
    raise exception 'too many pending offers';
  end if;
  insert into public.offers (from_user, to_user, give_bug, give_money, want_bug, want_money)
  values (uid, p_to, p_give_bug, coalesce(p_give_money, 0), p_want_bug, coalesce(p_want_money, 0))
  returning id into oid;
  -- reserva do que eu dou
  perform public.deliver(uid, 'offer_sent', 'offer:' || oid, -coalesce(p_give_money, 0), '[]',
    case when p_give_bug is null then '{}' else array[p_give_bug ->> 'uid'] end);
  return oid;
end $$;

create function public.respond_offer(p_id bigint, p_accept boolean, p_want_bug jsonb default null)
returns void language plpgsql security definer set search_path = '' as $$
declare
  uid uuid := public.me();
  o public.offers;
  ref text := 'offer:' || p_id;
begin
  select * into o from public.offers where id = p_id and to_user = uid and status = 'pending' for update;
  if not found then raise exception 'offer not found'; end if;
  if p_accept then
    if o.want_bug is not null and (p_want_bug is null or not public.valid_bug(p_want_bug)
                                   or p_want_bug ->> 'uid' <> o.want_bug ->> 'uid') then
      raise exception 'invalid bug';
    end if;
    update public.offers set status = 'accepted', resolved_at = now() where id = p_id;
    perform public.deliver(uid, 'offer_accepted', ref, o.give_money - o.want_money,
      case when o.give_bug is null then '[]' else jsonb_build_array(o.give_bug) end,
      case when o.want_bug is null then '{}' else array[o.want_bug ->> 'uid'] end);
    perform public.deliver(o.from_user, 'offer_accepted', ref, o.want_money,
      case when p_want_bug is null then '[]' else jsonb_build_array(p_want_bug) end, '{}');
  else
    update public.offers set status = 'declined', resolved_at = now() where id = p_id;
    perform public.deliver(o.from_user, 'offer_declined', ref, o.give_money,
      case when o.give_bug is null then '[]' else jsonb_build_array(o.give_bug) end, '{}');
  end if;
end $$;

create function public.cancel_offer(p_id bigint) returns void
language plpgsql security definer set search_path = '' as $$
declare
  uid uuid := public.me();
  o public.offers;
begin
  select * into o from public.offers where id = p_id and from_user = uid and status = 'pending' for update;
  if not found then raise exception 'offer not found'; end if;
  update public.offers set status = 'cancelled', resolved_at = now() where id = p_id;
  perform public.deliver(uid, 'offer_cancelled', 'offer:' || p_id, o.give_money,
    case when o.give_bug is null then '[]' else jsonb_build_array(o.give_bug) end, '{}');
end $$;

-- ───────────── desafios (luta / corrida) ─────────────

create function public.create_match(p_to uuid, p_kind text, p_bet int, p_team jsonb) returns bigint
language plpgsql security definer set search_path = '' as $$
declare
  uid uuid := public.me();
  mid bigint;
begin
  if not public.is_friend(uid, p_to) then raise exception 'not friends'; end if;
  if not public.valid_team(p_team, case when p_kind = 'race' then 2 else 3 end) then raise exception 'invalid team'; end if;
  if (select count(*) from public.matches where challenger = uid and status = 'pending') >= 10 then
    raise exception 'too many pending challenges';
  end if;
  insert into public.matches (kind, challenger, opponent, bet, team_a)
  values (p_kind, uid, p_to, p_bet, p_team) returning id into mid;
  perform public.deliver(uid, 'match_sent', 'match:' || mid, -p_bet, '[]', '{}');
  return mid;
end $$;

create function public.accept_match(p_id bigint, p_team jsonb) returns public.matches
language plpgsql security definer set search_path = '' as $$
declare
  uid uuid := public.me();
  m public.matches;
begin
  select * into m from public.matches where id = p_id and opponent = uid and status = 'pending' for update;
  if not found then raise exception 'challenge not found'; end if;
  if not public.valid_team(p_team, 3) or jsonb_array_length(p_team) <> jsonb_array_length(m.team_a) then
    raise exception 'invalid team';
  end if;
  update public.matches set status = 'accepted', team_b = p_team, accepted_at = now() where id = p_id
    returning * into m;
  perform public.deliver(uid, 'match_accepted', 'match:' || p_id, -m.bet, '[]', '{}');
  return m;
end $$;

create function public.decline_match(p_id bigint) returns void
language plpgsql security definer set search_path = '' as $$
declare
  uid uuid := public.me();
  m public.matches;
begin
  select * into m from public.matches where id = p_id and status = 'pending' and uid in (challenger, opponent) for update;
  if not found then raise exception 'challenge not found'; end if;
  update public.matches set status = case when uid = m.challenger then 'cancelled' else 'declined' end,
    finished_at = now() where id = p_id;
  perform public.deliver(m.challenger, case when uid = m.challenger then 'match_cancelled' else 'match_declined' end,
    'match:' || p_id, m.bet, '[]', '{}');
end $$;

-- quem rodar a simulação até o fim primeiro grava o resultado (o outro pode rever o replay)
create function public.finish_match(p_id bigint, p_winner_side text, p_result jsonb) returns void
language plpgsql security definer set search_path = '' as $$
declare
  uid uuid := public.me();
  m public.matches;
  w uuid;
begin
  select * into m from public.matches where id = p_id and status = 'accepted' and uid in (challenger, opponent) for update;
  if not found then return; end if; -- já terminada por outro cliente
  if p_winner_side not in ('a', 'b') then raise exception 'invalid winner'; end if;
  w := case when p_winner_side = 'a' then m.challenger else m.opponent end;
  update public.matches set status = 'done', winner = w, result = p_result, finished_at = now() where id = p_id;
  perform public.deliver(w, 'match_won', 'match:' || p_id, 2 * m.bet, '[]', '{}');
  perform public.deliver(case when w = m.challenger then m.opponent else m.challenger end,
    'match_lost', 'match:' || p_id, 0, '[]', '{}');
end $$;

-- ───────────── RLS ─────────────

alter table public.profiles enable row level security;
alter table public.saves enable row level security;
alter table public.snapshots enable row level security;
alter table public.friendships enable row level security;
alter table public.offers enable row level security;
alter table public.matches enable row level security;
alter table public.inbox enable row level security;

create policy profiles_read on public.profiles for select to authenticated using (true);
create policy profiles_update on public.profiles for update to authenticated
  using (id = (select auth.uid())) with check (id = (select auth.uid()));
create policy saves_read on public.saves for select to authenticated using (user_id = (select auth.uid()));
create policy snapshots_read on public.snapshots for select to authenticated
  using (user_id = (select auth.uid()) or public.is_friend((select auth.uid()), user_id));
create policy friendships_read on public.friendships for select to authenticated
  using ((select auth.uid()) in (requester, addressee));
create policy offers_read on public.offers for select to authenticated
  using ((select auth.uid()) in (from_user, to_user));
create policy matches_read on public.matches for select to authenticated
  using ((select auth.uid()) in (challenger, opponent)
         or public.is_friend((select auth.uid()), challenger) or public.is_friend((select auth.uid()), opponent));
create policy inbox_read on public.inbox for select to authenticated using (user_id = (select auth.uid()));

-- privilégios: leitura pela API só para logados; escrita direta só no próprio perfil (look/username)
revoke all on public.profiles, public.saves, public.snapshots, public.friendships, public.offers, public.matches,
  public.inbox from anon, authenticated;
grant select on public.profiles, public.saves, public.snapshots, public.friendships, public.offers, public.matches,
  public.inbox to authenticated;
grant update (username, look) on public.profiles to authenticated;

revoke execute on all functions in schema public from public, anon, authenticated;
grant execute on function public.is_friend(uuid, uuid), public.push_save(jsonb, jsonb, int, boolean),
  public.request_friend(text), public.respond_friend(bigint, boolean), public.remove_friend(uuid),
  public.ack_inbox(bigint[]), public.create_offer(uuid, jsonb, int, jsonb, int),
  public.respond_offer(bigint, boolean, jsonb), public.cancel_offer(bigint),
  public.create_match(uuid, text, int, jsonb), public.accept_match(bigint, jsonb), public.decline_match(bigint),
  public.finish_match(bigint, text, jsonb) to authenticated;
grant execute on function public.username_available(text) to anon, authenticated;

-- Realtime (postgres_changes respeita a RLS)
alter publication supabase_realtime add table public.friendships, public.offers, public.matches, public.inbox;
