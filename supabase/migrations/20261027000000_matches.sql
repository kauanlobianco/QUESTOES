-- Partidas do Mestre dos Negócios.
--
-- matches      estado público (view) que os dois jogadores leem e assinam via Realtime.
-- match_state  estado completo da engine (perguntas usadas, respostas do duelo). Só o servidor lê.
--
-- Clientes nunca escrevem direto: toda mudança passa por /api/game com a service role,
-- usando as funções abaixo (escrita atômica com controle de versão).

create table public.matches (
  id          uuid primary key,
  code        text not null unique check (code ~ '^[A-Z0-9]{6}$'),
  p1          uuid not null,
  p2          uuid,
  status      text not null check (status in ('WAITING_OPPONENT', 'ACTIVE', 'ENDED')),
  turn_of     smallint not null check (turn_of in (1, 2)),
  version     integer not null default 1,
  view        jsonb not null,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now(),
  expires_at  timestamptz not null
);

create index matches_p1_idx on public.matches (p1, updated_at desc);
create index matches_p2_idx on public.matches (p2, updated_at desc);

create table public.match_state (
  match_id  uuid primary key references public.matches (id) on delete cascade,
  state     jsonb not null
);

-- ---------------------------------------------------------------------------
-- Segurança
-- ---------------------------------------------------------------------------

alter table public.matches enable row level security;
alter table public.match_state enable row level security;

-- Jogador lê só as partidas em que está. Sem políticas de escrita: ninguém escreve pelo cliente.
create policy "jogadores leem suas partidas"
  on public.matches for select
  to authenticated
  using ((select auth.uid()) in (p1, p2));

revoke all on public.match_state from anon, authenticated;
revoke insert, update, delete on public.matches from anon, authenticated;

-- ---------------------------------------------------------------------------
-- Funções do servidor (service role)
-- ---------------------------------------------------------------------------

-- Cria partida. Retorna false se o código já existir (o servidor sorteia outro).
create function public.create_match(
  p_id uuid,
  p_code text,
  p_p1 uuid,
  p_status text,
  p_turn_of smallint,
  p_view jsonb,
  p_state jsonb,
  p_expires_at timestamptz
) returns boolean
language plpgsql
set search_path = ''
as $$
begin
  insert into public.matches (id, code, p1, status, turn_of, view, expires_at)
  values (p_id, p_code, p_p1, p_status, p_turn_of, p_view, p_expires_at);
  insert into public.match_state (match_id, state) values (p_id, p_state);
  return true;
exception
  when unique_violation then
    return false;
end;
$$;

-- Lê estado completo + versão atual.
create function public.load_match(p_id uuid default null, p_code text default null)
returns table (id uuid, version integer, state jsonb)
language sql
stable
set search_path = ''
as $$
  select m.id, m.version, s.state
  from public.matches m
  join public.match_state s on s.match_id = m.id
  where (p_id is not null and m.id = p_id)
     or (p_code is not null and m.code = upper(p_code))
  limit 1;
$$;

-- Grava novo estado se a versão bater (concorrência otimista). Retorna false em conflito.
create function public.commit_match(
  p_id uuid,
  p_version integer,
  p_p2 uuid,
  p_status text,
  p_turn_of smallint,
  p_view jsonb,
  p_state jsonb,
  p_expires_at timestamptz
) returns boolean
language plpgsql
set search_path = ''
as $$
begin
  update public.matches
     set version = version + 1,
         p2 = coalesce(p2, p_p2),
         status = p_status,
         turn_of = p_turn_of,
         view = p_view,
         updated_at = now(),
         expires_at = p_expires_at
   where id = p_id and version = p_version;
  if not found then
    return false;
  end if;
  update public.match_state set state = p_state where match_id = p_id;
  return true;
end;
$$;

revoke execute on function public.create_match from public, anon, authenticated;
revoke execute on function public.load_match from public, anon, authenticated;
revoke execute on function public.commit_match from public, anon, authenticated;
grant execute on function public.create_match to service_role;
grant execute on function public.load_match to service_role;
grant execute on function public.commit_match to service_role;

-- ---------------------------------------------------------------------------
-- Tempo real: os dois navegadores recebem cada atualização da partida.
-- ---------------------------------------------------------------------------

alter publication supabase_realtime add table public.matches;
