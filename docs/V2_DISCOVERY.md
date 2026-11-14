# Evolution v2.0 — Discovery do multiplayer

Status: discovery concluído em 2026-11-14 e revisado com as decisões do usuário (mundo por código, login anônimo com
código de recuperação, deploy em `/v2/`); implementação do MVP na branch `v2`.
Backend: projeto Supabase **evolution** (ref `xezwvhrbculmnyksjyen`, região `sa-east-1`, plano Free). Front estático.

## 1. Objetivo e princípios

- O jogo continua 100% jogável **offline / convidado**, como na v1. O online é uma camada opcional: sem entrar no
  online, nenhum código de rede é carregado (o `supabase-js` entra por `import()` dinâmico só quando o jogador abre o
  painel online ou já tem sessão salva).
- Sem backend próprio: front estático + Supabase (Auth, Postgres com RLS, Realtime e funções SQL `security definer`).
  Edge Functions não foram necessárias.
- O port da v1 fica intacto: o código novo mora em `src/online/` e se liga ao jogo por fora (embrulha os frame scripts
  das telas e métodos de `Game`), sem editar a lógica portada.
- Casual entre amigos: o estado do jogo continua sendo do cliente (como na v1). O servidor garante o que é
  **social e transacional** (quem é do mundo, ofertas, desafios, quem recebe o quê) e valida limites básicos (§7).
- Cada jogador **sempre mantém a cópia local** single-player do próprio progresso; sair, ser expulso ou o mundo acabar
  não apaga o save local.

## 2. Features: MVP × depois

| Feature | MVP | Depois |
|---|---|---|
| Identidade | entra só com o nome (usuário anônimo do Supabase) + **código de recuperação** (recupera o jogador e leva para outro aparelho) | Google OAuth como vínculo opcional; captcha ligado (gancho pronto, desligado) |
| Mundo | quem cria recebe um **código de mundo** (até 10 membros); o dono expulsa membros e encerra o multiplayer; membros podem sair | vários mundos por jogador, transferir a posse |
| Save na nuvem | o jogo local é vinculado ao jogador; envio periódico com revisão e aviso de conflito; baixar o save em outro aparelho | histórico de versões |
| Perfil do membro | dinheiro, dias, pirâmide evolutiva, insetário (besouros com atributos), histórico de lutas/corridas com replay | insetário animado no canvas, conquistas |
| Trocas | vender besouro por $, pedir para comprar um besouro, troca besouro×besouro (com $ opcional); recusar/cancelar devolve a reserva | contraproposta, expiração automática |
| Desafios | luta ou corrida assíncrona com aposta; o desafiado escolhe o time e assiste; os dois podem rever o replay | torneios, revanche com 1 clique, ranking do mundo |
| Replay | determinístico (PRNG semeado, seed gravada no servidor) | trigonometria determinística entre navegadores (§8) |
| Presença na loja | membro que está na loja aparece como NPC andando na loja dos outros; clique abre o perfil | emotes, chat curto |
| Notificações | balão `Word` no jogo e contador no botão ONLINE (oferta, desafio, resultado, entrou/expulso/encerrado) | push |

## 3. Telas e fluxos (encaixe na UI do jogo)

**Tudo no motor do jogo (canvas), no estilo das telas modais da v1** (Setting/pirâmide/popups: fundo em gradiente com
bolhas — sprites 309/311/317 —, painéis 9-slice (48), slots (59), botões (57), textos (5/76), campos de entrada do próprio
jogo = `TextField` de entrada do motor, como o RENAME). Código em `src/online/kit.ts` (host da tela: `FADE()`, `GAME.stop()`,
volta com `GAME.start()`, popups Sim/Não do jogo para confirmar). Não há HTML próprio.

- **Botões do HUD** (`hud.ts`): ícones novos no padrão do `mIco` (`icons.ts`: engrenagem, dois NPCs `mPeople`, espadas, setas;
  registrados como o sprite extra `mIcoOn`) no mesmo botão de ícone (357). O terrário ganha **Configuração do multiplayer** e
  **Amigos** (grade 5×2, botões a 90%, painel de info e botão SPEED recuados), a arena **PvP**, a loja **Troca multiplayer**.
  Entram em **depth negativa** com `timeline` (como o btContinue do menu): o `mGame.remove()` não os apaga e eles somem sozinhos
  na troca de frame. Contador vermelho de ofertas/desafios pendentes. O botão ONLINE do topo foi removido.
- **Criação do jogo** (`creation.ts`, sprite 434 frame 32, instruções): toggle MULTIPLAYER (desenhado no padrão das bolinhas
  de presença); ligado, o texto dá lugar aos painéis JOGADOR ONLINE (nome ou código de recuperação; com jogador: SAIR e
  carregar o save da nuvem) e MUNDO (criar mundo novo / entrar no mundo de um amigo com o código). INICIAR JOGO cria o
  jogador e o mundo antes (erro = aviso, o jogo não começa) e o terrário vincula o jogo novo (`sOnlineUid`). Jogo com o
  toggle desligado (`sOnlineUid` vazio) não mostra nada do multiplayer (HUD, conta, NPC na loja, avisos).
- **Configuração do multiplayer** (aba MUNDO): código do mundo (copiar), criar ou entrar por código (depois de sair),
  sair/encerrar (confirmação no popup do jogo), dono remove membros.
- **Conta** (nome, código de recuperação, save na nuvem, sair): botão CONFIGURAÇÕES DE CONTA nas **Configurações** (sprite
  404, frame Setting), só em jogo multiplayer; abre a tela da conta no mesmo clip (somem Música/Som/Idioma/Sincronizar,
  ficam SAIR PARA O MENU e VOLTAR AO JOGO).
- **Amigos**: todos do mundo com presença Realtime (conectado agora / na loja) e perfil (pirâmide com os hexágonos do jogo,
  insetário em slots, histórico com ASSISTIR).
- **PvP** (arena): desafios recebidos (aceitar → popup de adversário da arena `mPop` BATTLE/RACE, o mesmo dos NPCs, com o time
  do desafiante no lado da CPU e a aposta do desafio), desafiar (luta/corrida + aposta; rollover na caixa preta de info, cópia
  dos clips 239/348/356 do HUD), histórico do mundo.
- **Troca** (loja): à venda (lista de venda `aAdult_sell` dos amigos, no snapshot), ofertas e propor troca (até 12 besouros
  de cada lado + $, `give_bugs`/`want_bugs`; rollover na caixa preta de info).
- Avisos com o balão `Word` (`GAME.popWord`); conflito de save com `mPop` (frame `Y_N`); resultado da disputa com `mPop` (`WARN`).
- **NPC do membro na loja** = `mPeople` com o nome numa etiqueta (sprite 76); **luta/corrida e replay** = as próprias arenas.

Fluxos:
- *Entrar*: novo jogo → instruções → MULTIPLAYER ligado → nome (ou código de recuperação) e criar mundo / código de um amigo →
  INICIAR JOGO: o jogo novo vira o save na nuvem; o código de recuperação fica em Configurações → CONFIGURAÇÕES DE CONTA.
- *Oferta*: Troca → TROCAR COM UM AMIGO → escolher "dou" (besouros meus e/ou $) e "quero" (besouros dele e/ou $) → enviar;
  ou FOR SALE → COMPRAR um besouro da lista de venda dele (compra direta: o anúncio já é o aceite, fecha na hora pela RPC buy_listed). O que eu dou
  sai do meu jogo na hora (reservado, como a lista de venda da v1); recusar/cancelar devolve.
- *Desafio*: PvP → DESAFIAR UM AMIGO → 1–3 besouros (luta) ou 1–2 (corrida) + aposta → enviar (aposta reservada). O amigo escolhe o
  mesmo número de besouros (reserva a aposta) → a arena abre e a disputa roda; o vencedor leva 2× a aposta. O
  desafiante recebe o resultado e pode rever.
- *Loja*: com identidade e mundo, entrar na loja publica presença no canal do mundo; membros presentes viram NPCs.

## 4. Identidade (decisão do usuário: "mundo por código", sem e-mail/SMTP/OAuth no MVP)

- **Entrar**: `signInAnonymously({ options: { data: { username } } })`; o gatilho `handle_new_user` cria o perfil com o
  nome (2–16 caracteres, não precisa ser único) e uma aparência de NPC aleatória. Confirmação de e-mail desligada.
- **Código de recuperação / transferência** (implementado como sugerido): logo após entrar, o cliente vincula ao
  usuário anônimo uma credencial sintética com `updateUser({ email, password })`:
  - código = 24 caracteres base32 Crockford, exibido em grupos `XXXX-XXXX-XXXX-XXXX-XXXX-XXXX`;
  - os 8 primeiros formam o e-mail `p-<8>@players.invalid` (domínio reservado pela RFC 2606: nunca é entregue; o
    Supabase confirma na hora porque a confirmação está desligada); os 16 restantes são a senha (80 bits aleatórios
    de `crypto.getRandomValues`);
  - em outro aparelho ou depois de limpar o navegador: `signInWithPassword` com o par → mesma conta, mesmo save na
    nuvem, mesmo mundo. O código fica guardado no aparelho (`evolution.online.code`) para ser mostrado de novo; a
    senha não pode ser lida do servidor;
  - alternativas avaliadas: guardar um hash do segredo numa tabela e trocar por sessão exigiria Edge Function com a
    service role (`admin.generateLink`) e um e-mail do mesmo jeito; não compensa. A credencial sintética usa só o
    Auth padrão (rate limit e bloqueio de força bruta do Supabase inclusos).
- **Dois aparelhos**: o save na nuvem tem revisão (`saves.rev`). Cada envio diz em qual revisão se baseou; se outro
  aparelho gravou antes, o servidor recusa (`conflict`) e o jogo pergunta (`mPop Y_N`) "Jogado em outro aparelho!
  Carregar o save da nuvem?". **Sim** troca o jogo local pela nuvem; **Não** grava este aparelho por cima (última
  gravação vence, por escolha explícita). Entregas (§6) aplicadas num aparelho e descartadas pela escolha somem junto
  com o save descartado: não há duplicação, porque a escolha é do save inteiro.
- **Captcha**: gancho pronto (`CAPTCHA.siteKey` em `src/online/config.ts`; Turnstile invisível antes de
  `signInAnonymously`/`signInWithPassword`), **desligado** até existir a chave. Para ligar: siteKey no config +
  `[auth.captcha]` no Supabase.
- **Google OAuth**: fora do MVP (depois, como vínculo opcional da identidade anônima via `linkIdentity`).
- Sessão persistida pelo `supabase-js` no `localStorage` (`sb-*`), separada dos saves `evolution.so:*`.

## 5. Modelo de dados e RLS

Todas as tabelas com RLS. Escrita sensível só por funções `security definer` (RPC), que validam o chamador
(`auth.uid()`), o mundo e os limites. Migrations em `supabase/migrations/`.

| Tabela | Conteúdo | Leitura (RLS) | Escrita |
|---|---|---|---|
| `profiles` | `id` (= auth.users), `username`, `look` | eu e os membros do meu mundo | o próprio `username` |
| `worlds` | `code` (6 caracteres sem ambíguos), `owner` | membros | `create_world`, `end_world` |
| `world_members` | `user_id` (PK: um mundo por jogador), `world_id` | membros do mesmo mundo | `join_world`, `leave_world`, `kick_member` |
| `saves` | save completo (`data` jsonb), `rev` | só o dono | `push_save` |
| `snapshots` | resumo público: `money`, `level`, `days`, `score`, `have` (pirâmide), `bugs` (até 12), `selling`, `sell` (a lista de venda: besouros com `price`, até 12) | dono e membros do mundo | `push_save` |
| `offers` | `from_user`, `to_user`, `give_bug`, `give_money`, `want_bug`, `want_money`, `status` | as duas partes | `create_offer`, `respond_offer`, `cancel_offer` |
| `matches` | `kind`, `challenger`, `opponent`, `bet`, `seed`, `team_a`, `team_b`, `status`, `winner`, `result` | participantes e membros do mundo deles | `create_match`, `accept_match`, `decline_match`, `finish_match` |
| `inbox` | entregas: `money`, `add_bugs`, `remove_uids`, `kind` (aviso) | só o dono | as RPCs acima inserem; `ack_inbox` marca |

- `is_friend(a, b)` = "mesmo mundo"; é a regra usada por RLS e RPCs de ofertas/desafios.
- `valid_bug(jsonb)`: espécie 0–14, cor 0–15, crescimento 0–1000, aleatório 0–1, saúde 0–100, idade, sexo ±1, nome.
- Limites: 10 membros por mundo, 10 ofertas e 10 desafios pendentes por jogador, aposta 0–100000, dinheiro 0–6666666
  (teto do jogo), 12 besouros no resumo, save até 256 KB.
- Sair/ser expulso/encerrar: `cancel_pending_for` cancela ofertas e desafios pendentes do jogador e devolve as
  reservas pelo `inbox`; o expulso e os membros recebem aviso (`world_kicked`, `world_ended`, `world_joined`).
- `ping()` (security definer, liberado para `anon`): devolve `now()`; o ping agendado do Main chama
  `POST /rest/v1/rpc/ping` para o projeto Free não pausar.
- Realtime: `postgres_changes` em `offers`, `matches`, `inbox` e `world_members` (respeita a RLS) + presença no canal
  `shop:<id do mundo>`.
- Migration `20261114080000_snapshot_sell.sql` (retrocompatível): coluna `snapshots.sell` + validação em `push_save`
  (clientes antigos não enviam `sell`: fica `[]`). O besouro da lista de venda guarda `sUid` e os atributos (`Adult_sell`).

## 6. Sincronização do save local ↔ servidor

- **Vínculo**: o jogador online é vinculado a **um jogo local** (os 5 slots da v1 continuam). O vínculo fica no próprio
  save (`GAME.sOnlineUid`, `GAME.nOnlineRev`), que a v1 já serializa. No 1º acesso o jogo aberto é vinculado sozinho;
  se a nuvem já tem save (recuperação em outro aparelho), o painel pergunta: carregar a nuvem ou usar este jogo.
- **Envio**: com o jogo vinculado, a cada 20 s (se mudou), ao trocar de tela e ao esconder a página:
  `push_save(data, snapshot, base_rev)`. Conflito: ver §4.
- **Entregas (inbox)**: tudo que muda o jogo de alguém por ação de outra pessoa (besouro recebido, dinheiro de venda,
  prêmio, devolução de reserva) vira uma linha em `inbox`, gravada na mesma transação da RPC. O cliente aplica no
  `GAME` (só com o jogo vinculado aberto), grava o save local na hora e confirma (`ack_inbox`). Os ids aplicados ficam
  no save (`GAME.aInboxDone`), então reaplicar é impossível mesmo se o ack falhar. Até a reserva do próprio autor
  passa pelo `inbox`: a oferta existe ⇔ a reserva foi registrada.
- Terrário cheio (12): o besouro recebido vai para a lista de venda da v1 com preço que nenhum NPC paga; "RETIRAR"
  traz de volta quando houver espaço.

## 7. Anti-trapaça básica: o que é confiável

- **Confiável no servidor**: identidade, pertencer ao mundo (só membros negociam/desafiam), máquina de estados de
  ofertas e desafios (`where status = 'pending' ... for update` dentro da RPC: aceita uma vez só), quem recebe o quê
  (`inbox` gerado pelo servidor), seed do desafio (gerada no servidor, imutável), limites e formato dos besouros.
- **Não confiável (cliente, como na v1)**: dinheiro e besouros do save, o time enviado e o vencedor reportado. Um
  cliente adulterado pode inventar um besouro forte ou dinheiro dentro das faixas válidas.
- **Mitigações MVP**: faixas validadas, tetos de dinheiro/aposta, mundo fechado de até 10 amigos (o dono expulsa),
  resultado reproduzível (o replay mostra se bate com o gravado), histórico visível no mundo.
- **Depois**: validar a evolução do save entre revisões (dinheiro não salta sem entrega), auditoria de replays,
  resultado aceito só quando os dois clientes concordam.

## 8. Replay determinístico

- A disputa só usa aleatoriedade via `Math.random`. Durante `initial_3/4` e cada `GAME.run()` de uma disputa online,
  `Math.random` vira um PRNG semeado (mulberry32) com a seed do desafio e é restaurado logo depois: só a simulação
  consome a sequência; transições (`FADE`), balões e o resto do jogo seguem com o `Math.random` normal.
- A simulação avança por passos (`GAME.run()`), não por tempo: acelerar (2×/4×) ou pular a corrida executa a mesma
  sequência de passos e dá o mesmo resultado.
- Os times são cópias (snapshots); os besouros vivos não são alterados pela disputa online (na v1 a luta mexe em
  felicidade/saúde; online fica só a aposta). O lado B se chama "CPU " internamente (é assim que `Adult` escolhe o
  inimigo); o painel mostra o nome real.
- `result` grava vencedor e nº de passos; o replay compara e avisa se divergir. Empate segue a v1 (favorece o lado B).
- **Risco**: `Math.sin/cos/atan2` podem diferir no último bit entre motores JS (V8 × SpiderMonkey × JavaScriptCore); a
  luta usa trigonometria e colisão, então um replay em outro navegador pode divergir (a corrida, com rotação 0, é
  estável). O resultado gravado é sempre o oficial. Mitigação futura: trigonometria própria dentro da simulação.

## 9. Presença na loja

- Com identidade e mundo, o cliente publica presença no canal Realtime `shop:<id do mundo>` o tempo todo com
  `{name, look, shop}` (`shop` = está na loja, `nScreen == 2`): quem tem presença está **conectado agora** (tela Amigos) e
  `shop: true` vira NPC na loja dos outros.
- Cada membro presente vira um NPC: um `Sellman` (rota aleatória dos vendedores particulares) que não vende nem compra,
  com o nome em cima; clique abre o perfil (trocar/desafiar dali). Quando a rota acaba, ele recomeça enquanto o membro
  estiver na loja.
- Privacidade: o nome do canal usa o id (uuid) do mundo, conhecido só pelos membros. Depois: canal privado com
  autorização do Realtime.

## 10. Testes

- `tests/harness.mjs` ganhou `h.newPage()` (segundo contexto de navegador = segundo jogador).
- `tests/online-*.mjs`: mundo (entrar pelas Configurações, criar, entrar pelo código, amigos com presença, perfil, remover,
  encerrar), trocas (venda, compra da lista de venda, recusa, cancelamento), desafios (resultado do replay = resultado
  gravado), presença na loja (NPC abre o perfil), recuperação em outro aparelho. A UI é do canvas: `tests/online-lib.mjs`
  clica nos botões pelo rótulo (`__find`) e preenche campos pelo nome (`__fill`, só em dev, `src/devtools.ts`).
- `tests/shots-online.mjs` gera as capturas EN/PT de todas as telas para comparar com as telas originais.
- Jogadores de teste usam nomes `qa-*`; limpeza manual por SQL (README).

## 11. Publicação (não publicar sem aprovação)

- Decisão provável do usuário: **GitHub Pages em `evolution.hugobsan.com.br/v2/`** (o Main configura o workflow na
  `main` quando a v2 estiver pronta). O build usa `base: './'` (assets relativos), então funciona sob `/v2/`;
  verificado servindo `dist/` num subcaminho.
- `https://evolution.hugobsan.com.br` já está nas Redirect URLs do Supabase Auth (o online não usa redirects hoje).

## 12. Riscos e decisões em aberto

- Captcha: ligar quando houver a chave (abuso de criação de identidades anônimas; hoje vale o rate limit do Supabase).
- Perda do código de recuperação = perda da identidade online (o save local continua).
- Trapaça por cliente adulterado (§7); divergência de replay entre navegadores (§8).
- Plano Free: projeto pausa após 7 dias sem uso → ping agendado do Main.
