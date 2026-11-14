-- Ofertas com vários besouros de cada lado (ex.: 2 ruins por 1 bom): give_bug/want_bug (um objeto) viram
-- give_bugs/want_bugs (array, até 12 de cada lado). Ofertas pendentes são convertidas; as reservas não mudam.

alter table public.offers add column give_bugs jsonb not null default '[]', add column want_bugs jsonb not null default '[]';
update public.offers set
  give_bugs = case when give_bug is null then '[]' else jsonb_build_array(give_bug) end,
  want_bugs = case when want_bug is null then '[]' else jsonb_build_array(want_bug) end;
drop function public.create_offer(uuid, jsonb, int, jsonb, int);
drop function public.respond_offer(bigint, boolean, jsonb);
alter table public.offers drop column give_bug, drop column want_bug; -- leva junto o check antigo
alter table public.offers add constraint offers_has_bug check (give_bugs <> '[]' or want_bugs <> '[]');

/** lista de besouros válida: array de até p_max besouros válidos, sem uid repetido */
create function public.valid_bugs(p jsonb, p_max int) returns boolean
language plpgsql immutable set search_path = '' as $$
begin
  if jsonb_typeof(p) is distinct from 'array' or jsonb_array_length(p) > p_max then return false; end if;
  return coalesce((select bool_and(public.valid_bug(x)) and count(distinct x ->> 'uid') = count(*)
                   from jsonb_array_elements(p) x), true);
end $$;

create function public.bug_uids(p jsonb) returns text[]
language sql immutable set search_path = '' as $$
  select coalesce(array_agg(x ->> 'uid' order by x ->> 'uid'), '{}') from jsonb_array_elements(p) x;
$$;

create function public.create_offer(p_to uuid, p_give_bugs jsonb, p_give_money int, p_want_bugs jsonb, p_want_money int)
returns bigint language plpgsql security definer set search_path = '' as $$
declare
  uid uuid := public.me();
  oid bigint;
begin
  if not public.is_friend(uid, p_to) then raise exception 'not friends'; end if;
  p_give_bugs := coalesce(p_give_bugs, '[]'); p_want_bugs := coalesce(p_want_bugs, '[]');
  if not public.valid_bugs(p_give_bugs, 12) or not public.valid_bugs(p_want_bugs, 12) then raise exception 'invalid bug'; end if;
  if p_give_bugs = '[]' and p_want_bugs = '[]' then raise exception 'offer needs a bug'; end if;
  if (select count(*) from public.offers where from_user = uid and status = 'pending') >= 10 then
    raise exception 'too many pending offers';
  end if;
  insert into public.offers (from_user, to_user, give_bugs, give_money, want_bugs, want_money)
  values (uid, p_to, p_give_bugs, coalesce(p_give_money, 0), p_want_bugs, coalesce(p_want_money, 0))
  returning id into oid;
  -- reserva do que eu dou
  perform public.deliver(uid, 'offer_sent', 'offer:' || oid, -coalesce(p_give_money, 0), '[]', public.bug_uids(p_give_bugs));
  return oid;
end $$;

create function public.respond_offer(p_id bigint, p_accept boolean, p_want_bugs jsonb default '[]')
returns void language plpgsql security definer set search_path = '' as $$
declare
  uid uuid := public.me();
  o public.offers;
  ref text := 'offer:' || p_id;
begin
  select * into o from public.offers where id = p_id and to_user = uid and status = 'pending' for update;
  if not found then raise exception 'offer not found'; end if;
  if p_accept then
    p_want_bugs := coalesce(p_want_bugs, '[]');
    -- quem aceita manda os besouros pedidos como estão no jogo dele (mesmos uids)
    if not public.valid_bugs(p_want_bugs, 12) or public.bug_uids(p_want_bugs) <> public.bug_uids(o.want_bugs) then
      raise exception 'invalid bug';
    end if;
    update public.offers set status = 'accepted', resolved_at = now() where id = p_id;
    perform public.deliver(uid, 'offer_accepted', ref, o.give_money - o.want_money, o.give_bugs, public.bug_uids(o.want_bugs));
    perform public.deliver(o.from_user, 'offer_accepted', ref, o.want_money, p_want_bugs, '{}');
  else
    update public.offers set status = 'declined', resolved_at = now() where id = p_id;
    perform public.deliver(o.from_user, 'offer_declined', ref, o.give_money, o.give_bugs, '{}');
  end if;
end $$;

create or replace function public.cancel_offer(p_id bigint) returns void
language plpgsql security definer set search_path = '' as $$
declare
  uid uuid := public.me();
  o public.offers;
begin
  select * into o from public.offers where id = p_id and from_user = uid and status = 'pending' for update;
  if not found then raise exception 'offer not found'; end if;
  update public.offers set status = 'cancelled', resolved_at = now() where id = p_id;
  perform public.deliver(uid, 'offer_cancelled', 'offer:' || p_id, o.give_money, o.give_bugs, '{}');
end $$;

create or replace function public.cancel_pending_for(p_user uuid) returns void
language plpgsql security definer set search_path = '' as $$
declare
  o public.offers;
  m public.matches;
begin
  for o in update public.offers set status = 'cancelled', resolved_at = now()
           where status = 'pending' and p_user in (from_user, to_user) returning * loop
    perform public.deliver(o.from_user, 'offer_cancelled', 'offer:' || o.id, o.give_money, o.give_bugs, '{}');
  end loop;
  for m in update public.matches set status = 'cancelled', finished_at = now()
           where status = 'pending' and p_user in (challenger, opponent) returning * loop
    perform public.deliver(m.challenger, 'match_cancelled', 'match:' || m.id, m.bet, '[]', '{}');
  end loop;
end $$;

revoke execute on function public.valid_bugs(jsonb, int), public.bug_uids(jsonb), public.create_offer(uuid, jsonb, int, jsonb, int),
  public.respond_offer(bigint, boolean, jsonb) from public, anon, authenticated;
grant execute on function public.create_offer(uuid, jsonb, int, jsonb, int), public.respond_offer(bigint, boolean, jsonb) to authenticated;
