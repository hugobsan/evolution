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

Versões: `main` = v2 multiplayer (mais recente), em https://evolution.hugobsan.com.br (deploy automático a cada push). Branch `v1` = v1 offline, em https://evolution.hugobsan.com.br/v1/ (mudou só a v1, rode o workflow manualmente).

## v2 — multiplayer entre amigos (branch `main`)

Camada online opcional sobre o jogo da v1 (que continua jogável offline, sem baixar nada de rede). Desenho e
decisões: [`docs/V2_DISCOVERY.md`](docs/V2_DISCOVERY.md).

- **Entrar**: nas **Configurações** do jogo (botão de menu do HUD, ou SETTINGS no menu inicial) → **CONTA ONLINE**: só o
  nome. O jogador recebe um **código de recuperação** (copiar e guardar): recupera o jogador num navegador limpo e leva
  para outro aparelho (campo "Código de recuperação" + RECUPERAR, nas mesmas Configurações). Também ali: renomear,
  sincronizar o save da nuvem e sair.
- **Botões novos no HUD** (mesmo estilo dos botões de ícone do jogo, canto inferior direito; contadores vermelhos para
  ofertas e desafios pendentes): no terrário, **Configuração do multiplayer** (engrenagem) e **Amigos**; na arena,
  **PvP**; na loja, **Troca multiplayer**. Cada um abre uma tela modal no estilo das telas do jogo (fundo, botões, fonte,
  FADE; o jogo pausa e retoma ao voltar), toda no motor do jogo, sem HTML próprio.
- **Mundo por código** (Configuração do multiplayer): ativar o multiplayer cria um mundo e dá um código de 6 letras para
  compartilhar (até 10 jogadores); entrar com o código de um amigo; o dono remove membros e encerra, os membros saem; o
  save local de cada um nunca é apagado.
- **Amigos**: todos do mundo, com quem está **conectado agora** (presença em tempo real); abrir o perfil (dinheiro,
  pirâmide, insetário, histórico com ASSISTIR). **PvP**: desafios recebidos (aceitar e escolher o time), desafiar amigos
  (luta/corrida + aposta) e histórico recente do mundo com **replay** determinístico. **Troca**: besouros à venda dos
  amigos (a lista de venda do jogo deles) para comprar, ofertas recebidas/enviadas e propor troca. O **NPC do amigo**
  anda na loja quando ele também está lá.
- Save na nuvem com revisão: dois aparelhos com o mesmo jogador recebem aviso de conflito e escolhem qual save fica.

Técnico: front estático + Supabase (Auth anônimo, Postgres com RLS em todas as tabelas, RPCs `security definer`,
Realtime). Código em `src/online/` (config pública em `src/online/config.ts`), migrations em `supabase/migrations/`.

- Testes com 2 navegadores: `GAME_URL=http://localhost:5300/ node tests/harness.mjs tests/online-world.mjs`
  (também `online-trade`, `online-match`, `online-shop`, `online-recover`; a UI é do canvas: os testes clicam nos botões do jogo pelo rótulo, `tests/online-lib.mjs`). Cada execução cria jogadores `qa-*`; o login
  anônimo tem rate limit por IP (60/h).
- Limpar jogadores de teste: `npx supabase db query --remote --yes "delete from auth.users where id in (select id from
  public.profiles where username like 'qa-%')"`.
- Banco: `npx supabase db push --remote` (senha do banco só em `.env.local`, fora do git); auth/rate limits:
  `npx supabase config diff` / `config push`.
- Build funciona em subcaminho (`base: './'`), ex.: `evolution.hugobsan.com.br/v2/`. v1 e v2 no mesmo domínio
  compartilham os saves locais (`evolution.so:*`), que são compatíveis nos dois sentidos.
