# Evolution (web)

Port nativo em TypeScript do jogo Flash **Evolution** (FreeWorldGroup, 2007): crie, cruze, venda e coloque besouros
para lutar e correr. Roda direto no navegador, sem plugin Flash e sem emuladores (Ruffle etc.): motor próprio em
Canvas 2D + WebAudio que interpreta os assets extraídos do SWF.

- Jogar: https://evolution.hugobsan.com.br
- Dev: `npm install && npm run dev`
- Build: `npm run build` (saída em `dist/`)
- Arte, sons e fontes do jogo original pertencem à FreeWorldGroup.

Estrutura: `src/engine/` (motor: display list, render, texto, áudio, AS2), `src/game/` (classes e scripts portados
do jogo), `tools/extract.py` (SWF → `public/assets`), `docs/` (guia de port SWF → web e contrato do port).

Versões: `main` = v1 (offline). Branch `v2` = multiplayer (em desenvolvimento).

## v2 — multiplayer entre amigos (branch `v2`)

Camada online opcional sobre o jogo da v1 (que continua jogável offline, sem baixar nada de rede). Desenho e
decisões: [`docs/V2_DISCOVERY.md`](docs/V2_DISCOVERY.md).

- **Entrar**: no jogo, botão **ONLINE** (canto superior direito) → só o nome. O jogador recebe um **código de
  recuperação** (copiar e guardar): recupera o jogador num navegador limpo e leva para outro aparelho.
- **Mundo por código**: quem cria recebe um código de 6 letras para compartilhar (até 10 jogadores). O dono expulsa e
  encerra; o save local de cada um nunca é apagado.
- Entre membros do mundo: perfil (dinheiro, pirâmide, insetário, histórico), **trocas/compras de besouros**, **desafios
  assíncronos** de luta e corrida com aposta e **replay** determinístico, e o **NPC do amigo** andando na loja quando
  ele também está lá.
- Save na nuvem com revisão: dois aparelhos com o mesmo jogador recebem aviso de conflito e escolhem qual save fica.

Técnico: front estático + Supabase (Auth anônimo, Postgres com RLS em todas as tabelas, RPCs `security definer`,
Realtime). Código em `src/online/` (config pública em `src/online/config.ts`), migrations em `supabase/migrations/`.

- Testes com 2 navegadores: `GAME_URL=http://localhost:5300/ node tests/harness.mjs tests/online-world.mjs`
  (também `online-trade`, `online-match`, `online-shop`, `online-recover`). Cada execução cria jogadores `qa-*`; o login
  anônimo tem rate limit por IP (60/h).
- Limpar jogadores de teste: `npx supabase db query --remote --yes "delete from auth.users where id in (select id from
  public.profiles where username like 'qa-%')"`.
- Banco: `npx supabase db push --remote` (senha do banco só em `.env.local`, fora do git); auth/rate limits:
  `npx supabase config diff` / `config push`.
- Build funciona em subcaminho (`base: './'`), ex.: `evolution.hugobsan.com.br/v2/`. v1 e v2 no mesmo domínio
  compartilham os saves locais (`evolution.so:*`), que são compatíveis nos dois sentidos.
