-- Lista de venda (aAdult_sell) no resumo público: os amigos veem os besouros à venda e pedem para comprar.
-- Retrocompatível: clientes antigos não enviam `sell` (fica '[]') e o formato do besouro é o mesmo (+ `price`).

alter table public.snapshots add column sell jsonb not null default '[]'
  check (jsonb_typeof(sell) = 'array' and jsonb_array_length(sell) <= 12);

create function public.valid_sell(s jsonb) returns boolean
language plpgsql immutable set search_path = '' as $$
begin
  return jsonb_typeof(s) = 'array' and jsonb_array_length(s) <= 12
    and coalesce((select bool_and(public.valid_bug(x) and jsonb_typeof(x -> 'price') = 'number'
                                  and (x ->> 'price')::numeric between 0 and 6666666)
                  from jsonb_array_elements(s) x), true);
exception when others then return false;
end $$;

create or replace function public.push_save(p_data jsonb, p_snap jsonb, p_base_rev int, p_force boolean default false)
returns int language plpgsql security definer set search_path = '' as $$
declare
  uid uuid := public.me();
  r int;
  sell jsonb := coalesce(p_snap -> 'sell', '[]');
begin
  if not (jsonb_typeof(p_snap -> 'bugs') = 'array'
          and coalesce((select bool_and(public.valid_bug(x)) from jsonb_array_elements(p_snap -> 'bugs') x), true))
     or not public.valid_sell(sell) then
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
  insert into public.snapshots as s (user_id, money, level, days, score, have, bugs, selling, sell, updated_at)
  values (uid, (p_snap ->> 'money')::int, (p_snap ->> 'level')::smallint, (p_snap ->> 'days')::int,
          (p_snap ->> 'score')::int,
          coalesce((select array_agg(x::smallint) from jsonb_array_elements_text(p_snap -> 'have') x), '{}'),
          p_snap -> 'bugs', (p_snap ->> 'selling')::smallint, sell, now())
  on conflict (user_id) do update set
    money = excluded.money, level = excluded.level, days = excluded.days, score = excluded.score,
    have = excluded.have, bugs = excluded.bugs, selling = excluded.selling, sell = excluded.sell, updated_at = now();
  return r;
end $$;
