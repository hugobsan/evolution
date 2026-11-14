-- Compra direta de um besouro anunciado (lista de venda do jogo do amigo): quem anunciou já aceitou o preço, então a
-- compra fecha na hora, sem proposta. Fica no histórico de ofertas como aceita.

create function public.buy_listed(p_seller uuid, p_uid text, p_price int)
returns bigint language plpgsql security definer set search_path = '' as $$
declare
  uid uuid := public.me();
  v_sell jsonb;
  bug jsonb;
  oid bigint;
  o public.offers;
begin
  if not public.is_friend(uid, p_seller) then raise exception 'not friends'; end if;
  -- trava o resumo do vendedor: duas compras do mesmo besouro ao mesmo tempo, só uma passa
  select s.sell into v_sell from public.snapshots s where s.user_id = p_seller for update;
  select x into bug from jsonb_array_elements(coalesce(v_sell, '[]')) x where x ->> 'uid' = p_uid;
  if bug is null then raise exception 'not for sale'; end if;
  if (bug ->> 'price')::numeric <> p_price then raise exception 'price changed'; end if;
  -- vendido e o vendedor ainda não recebeu a entrega: um resumo antigo dele pode ter voltado a anunciá-lo
  if exists (select 1 from public.inbox where user_id = p_seller and applied_at is null and p_uid = any (remove_uids)) then
    raise exception 'not for sale';
  end if;
  update public.snapshots set sell = (select coalesce(jsonb_agg(x), '[]') from jsonb_array_elements(v_sell) x where x ->> 'uid' <> p_uid)
  where user_id = p_seller;
  bug := bug - 'price';
  insert into public.offers (from_user, to_user, give_money, want_bugs, status, resolved_at)
  values (uid, p_seller, p_price, jsonb_build_array(bug), 'accepted', now())
  returning id into oid;
  perform public.deliver(uid, 'bought', 'offer:' || oid, -p_price, jsonb_build_array(bug), '{}');
  perform public.deliver(p_seller, 'sold', 'offer:' || oid, p_price, '[]', array[p_uid]);
  -- pedidos de compra/troca pendentes por esse besouro não podem mais ser aceitos: devolve o que estava reservado
  for o in update public.offers set status = 'cancelled', resolved_at = now()
           where status = 'pending' and to_user = p_seller and p_uid = any (public.bug_uids(want_bugs)) returning * loop
    perform public.deliver(o.from_user, 'offer_cancelled', 'offer:' || o.id, o.give_money, o.give_bugs, '{}');
  end loop;
  return oid;
end $$;

revoke execute on function public.buy_listed(uuid, text, int) from public, anon, authenticated;
grant execute on function public.buy_listed(uuid, text, int) to authenticated;
