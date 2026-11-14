# Evolution v2.0 — Discovery do multiplayer

Status: discovery concluído em 2026-11-14; implementação do MVP na branch `v2`.
Backend: projeto Supabase **evolution** (ref `xezwvhrbculmnyksjyen`, região `sa-east-1`). Front continua estático.

## 1. Objetivo e princípios

- O jogo continua 100% jogável **offline / convidado**, como na v1. O online é uma camada opcional: sem login,
  nenhum código de rede é carregado (o `supabase-js` entra por `import()` dinâmico só quando o jogador abre o online).
- Sem backend próprio: front estático + Supabase (Auth, Postgres com RLS, Realtime e funções SQL `security definer`).
  Edge Functions só se algo não couber em SQL (até aqui não foi preciso).
- O port da v1 fica intacto: o código novo mora em `src/online/`; no jogo entram só ganchos pequenos, comentados com
  `// v2:`.
- Casual entre amigos: o estado do jogo continua sendo do cliente (como na v1). O servidor garante o que é
  **social e transacional** (amizades, ofertas, desafios, quem recebe o quê) e valida limites básicos. Ver §7.

## 2. Features: MVP × depois

| Feature | MVP | Depois |
|---|---|---|
| Conta | e-mail + senha, nome de usuário único | magic link/OTP (precisa de SMTP próprio), OAuth GitHub/Google, login anônimo com upgrade, recuperação de senha |
| Save na nuvem | conta vinculada a um jogo local; envio periódico com controle de revisão e aviso de conflito; baixar o save em outro aparelho | histórico de versões, escolha campo a campo |
| Amigos | buscar por nome, pedir, aceitar/recusar, desfazer | sugestões, bloqueio |
| Perfil do amigo | dinheiro, dias de jogo, pirâmide evolutiva, terrário (besouros com atributos), histórico de lutas/corridas | ver o terrário animado no canvas, conquistas |
| Trocas | vender besouro por $, pedir para comprar um besouro do amigo, troca besouro×besouro (com $ opcional); cancelar/recusar devolve o que estava reservado | contraproposta, expiração automática |
| Desafios | luta ou corrida assíncrona com aposta; o desafiado escolhe o time e assiste; os dois podem rever o replay | torneios, revanche com 1 clique, ranking |
| Replay | determinístico (PRNG semeado, seed gravada no servidor) | trigonometria determinística entre navegadores (§8) |
| Presença na loja | amigo que está na loja aparece como NPC andando na sua loja; clique abre o perfil dele | emotes, chat curto |
| Notificações | aviso no jogo (balão `Word`) e contador no botão ONLINE quando chega pedido, oferta, desafio ou resultado | push/e-mail |

## 3. Telas e fluxos (encaixe na UI do jogo)

**Reaproveitado do SWF (canvas):**
- Botão **ONLINE** = sprite 57 (`attachSymbol(57, ...)`, mesmo botão de SETTINGS/CONTINUE) no HUD do terrário, da
  loja e da arena. Mostra o contador de pendências (ex.: `ONLINE (2)`).
- Avisos com o balão `Word` (`GAME.popWord`) e confirmações com `mPop` (frames `Y_N` e `WARN`).
- **NPC do amigo na loja** = `mPeople` (mesmo clip dos vendedores, aparência 2–5) com o nome do amigo no balão
  `Word_2`.
- **Luta/corrida online e replay** = as próprias arenas (`Pause_2`/`Pause_3`, `initial_3`/`initial_4`), com os
  botões de acelerar/pular corrida que já existem.
- Miniaturas de besouro no painel = o sprite `beetle` do SWF (frame da espécie + matriz de cor) desenhado num canvas
  fora da tela com `BitmapData.draw` (nada redesenhado).

**Painel online (HTML sobreposto ao canvas, no estilo dos popups do jogo: fundo preto, borda branca, destaque
`#00ccff`):** formulários e listas roláveis não existem no motor (os `mPop` têm frames fixos para os fluxos da v1);
em HTML ganhamos campos de e-mail/senha com o gerenciador de senhas do navegador, foco, rolagem e acessibilidade
sem inflar o motor. Abrir o painel pausa o jogo (`GAME.stop()`), como os `mPop`; fechar retoma.

Abas do painel:
1. **Conta**: entrar / criar conta (e-mail, senha, nome de usuário). Logado: nome, estado da sincronização,
   "vincular este jogo à conta" / "baixar save da nuvem", sair.
2. **Amigos**: busca por nome (prefixo), pedidos recebidos/enviados, lista de amigos (indica quem está na loja agora).
   Clique → **Perfil**.
3. **Perfil do amigo**: dinheiro, dias, pirâmide (15 miniaturas, as que ele já criou acesas), terrário (cards com
   miniatura, nome, sexo, idade, ataque/velocidade/HP), histórico (luta/corrida, adversário, resultado, aposta,
   botão **ASSISTIR**). Ações: **OFERECER TROCA**, **DESAFIAR: LUTA**, **DESAFIAR: CORRIDA**.
4. **Ofertas**: recebidas (aceitar/recusar) e enviadas (cancelar).
5. **Desafios**: recebidos (escolher time → assistir), enviados (aguardando/cancelar), concluídos (assistir).

Fluxos:
- *Oferta*: perfil → escolher "dou" (um besouro meu e/ou $) e "quero" (um besouro dele e/ou $) → enviar. O que eu dou
  sai do meu jogo na hora (fica reservado, como na lista de venda da v1). O amigo aceita ou recusa; recusar/cancelar
  devolve a reserva.
- *Desafio*: perfil → escolher 1–3 besouros (luta) ou 1–2 (corrida) e a aposta → enviar (aposta reservada). O amigo
  escolhe o mesmo número de besouros (e reserva a aposta) → a arena abre e a disputa roda ali; o vencedor leva 2× a
  aposta. O desafiante vê o resultado chegar e pode assistir ao replay.
- *Loja*: entrar na loja com login ativo publica presença; amigos presentes viram NPCs.

## 4. Auth

- **MVP: e-mail + senha** no Supabase Auth, com **confirmação de e-mail desligada**. Motivo: o SMTP embutido do
  Supabase só entrega para membros da organização, então magic link/OTP e confirmação não funcionam para jogadores
  reais sem um SMTP próprio (Resend, SES...). Consequências: não há recuperação de senha por e-mail e o e-mail não é
  verificado (impacto baixo num jogo entre amigos). → decisão em aberto D1.
- Nome de usuário em `profiles.username` (3–16 caracteres `[A-Za-z0-9_]`, único sem diferenciar maiúsculas).
- OAuth GitHub/Google: depois (exige criar os OAuth Apps e passar client id/secret ao Supabase).
- Login anônimo: não no MVP. "Convidado" = offline como na v1. Pode virar "online sem cadastro" com upgrade para
  e-mail depois, mas exige captcha contra criação de contas em massa.
- Sessão persistida pelo `supabase-js` no `localStorage` (`sb-*`), separada dos saves `evolution.so:*`.

## 5. Modelo de dados e RLS

Todas as tabelas com RLS ligada. Escrita sensível só por funções `security definer` (RPC), que validam o chamador
(`auth.uid()`), a amizade e os limites. Migrations em `supabase/migrations/`.

| Tabela | Conteúdo | Leitura (RLS) | Escrita |
|---|---|---|---|
| `profiles` | `id` (= auth.users), `username`, `look` (aparência do NPC 2–5) | qualquer usuário logado (para a busca) | o próprio (insert/update) |
| `saves` | save completo do jogo (`data` jsonb), `rev` | só o dono | RPC `push_save` |
| `snapshots` | resumo público: `money`, `level`, `days`, `score`, `have` (pirâmide), `bugs` (até 12), `selling` | dono e amigos | RPC `push_save` (junto com o save) |
| `friendships` | `requester`, `addressee`, `status` (`pending`/`accepted`), par único | as duas partes | RPCs `request_friend`, `respond_friend`, `remove_friend` |
| `offers` | `from_user`, `to_user`, `give_bug`, `give_money`, `want_bug`, `want_money`, `status` | as duas partes | RPCs `create_offer`, `respond_offer`, `cancel_offer` |
| `matches` | `kind` (`battle`/`race`), `challenger`, `opponent`, `bet`, `seed`, `team_a`, `team_b`, `status`, `winner`, `result` | participantes e amigos deles (histórico no perfil) | RPCs `create_match`, `accept_match`, `finish_match`, `cancel_match` |
| `inbox` | entregas pendentes para um jogador: `money`, `bug_add`, `bug_remove` | só o dono | RPCs acima inserem; o dono marca `applied_at` (`ack_inbox`) |

Funções auxiliares: `is_friend(a, b)` e `valid_bug(jsonb)` (espécie 0–14, cor 0–15, crescimento, idade, saúde e
aleatório dentro das faixas que o jogo produz). Limites nas RPCs: até 10 ofertas e 10 desafios pendentes por
jogador, aposta 1–100000, dinheiro 0–6666666 (o teto do próprio jogo), até 12 besouros, save até 256 KB.

Realtime: `postgres_changes` em `friendships`, `offers`, `matches` e `inbox` (o Realtime respeita a RLS, então cada
cliente só recebe o que pode ler) + canal de presença `shop`.

## 6. Sincronização do save local ↔ servidor

- **Vínculo**: a conta é vinculada a **um jogo local** (os 5 slots da v1 continuam). O vínculo fica no próprio save
  (`GAME.sOnlineUid`, `GAME.nOnlineRev`), que já é serializado pela v1.
- **Envio**: com o jogo vinculado e logado, a cada ~20 s (se mudou), ao trocar de tela e ao esconder a página:
  `push_save(data, snapshot, base_rev)`. O servidor só grava se `base_rev` = revisão atual e devolve a nova.
- **Conflito** (o jogo foi salvo em outro aparelho): `mPop Y_N` "carregar o save da nuvem?". Sim → recarrega o
  `GAME` a partir da nuvem; Não → este aparelho sobrescreve (envia com a revisão atual).
- **Outro aparelho**: logar num jogo novo de um aparelho sem vínculo oferece "baixar o save da nuvem" (substitui o
  jogo atual) ou "usar este jogo na conta" (sobrescreve a nuvem).
- **Entregas (inbox)**: tudo que muda o jogo de alguém por causa de outra pessoa (besouro recebido, dinheiro de venda,
  prêmio, devolução de reserva) vira uma linha em `inbox`, gravada na mesma transação da RPC. O cliente aplica as
  entregas no `GAME` quando está jogando o jogo vinculado, grava o save local na hora e confirma (`ack_inbox`). Os
  ids aplicados ficam no save (`GAME.aInboxDone`), então reaplicar é impossível mesmo se o ack falhar. Isso deixa
  as trocas atômicas no servidor e tolerantes a cliente offline/fechado.

## 7. Anti-trapaça básica: o que é confiável

- **Confiável no servidor**: identidade, amizade (só amigos negociam/desafiam), máquina de estados de ofertas e
  desafios (uma oferta só é aceita uma vez; `where status = 'pending'` dentro da RPC), quem recebe o quê (`inbox`
  gerado pelo servidor), seed do desafio (gerada no servidor, imutável), limites e formato dos besouros.
- **Não confiável (cliente, como na v1)**: dinheiro e besouros do save, o time enviado e o vencedor reportado. Um
  cliente adulterado pode inventar um besouro forte ou dinheiro dentro das faixas válidas.
- **Mitigações MVP**: faixas validadas (`valid_bug`, tetos de dinheiro/aposta); o resultado do desafio é reproduzível
  (qualquer um dos dois pode rever e o replay mostra se bate com o resultado gravado); histórico público entre amigos.
- **Depois**: validar evolução do save entre revisões (dinheiro não pode saltar sem entrega), auditoria de replays,
  resultado calculado por quem não tem interesse (os dois clientes precisam concordar).

## 8. Replay determinístico

- A disputa só usa aleatoriedade via `Math.random` (posições iniciais, animações, decisões de movimento, velocidade
  da corrida). Durante `initial_3/4` e cada `GAME.run()` de uma disputa online, `Math.random` é trocado por um PRNG
  semeado (mulberry32) com a seed do desafio e restaurado logo depois. Assim só a simulação consome a sequência:
  transições (`FADE`), balões e o resto do jogo continuam com o `Math.random` normal.
- A simulação avança por passos (`GAME.run()`), não por tempo: acelerar (2×/4×) ou pular a corrida executa a mesma
  sequência de passos, então o resultado é o mesmo.
- Os dois times são cópias (snapshots) dos besouros; os besouros vivos dos jogadores não são alterados pela disputa
  online (na v1 a luta mexe em felicidade/saúde; online fica só a aposta).
- `result` grava vencedor, nº de passos e HP final; o replay compara e avisa se divergir.
- **Risco**: `Math.sin/cos/atan2` podem diferir no último bit entre motores JS (V8 × SpiderMonkey × JavaScriptCore);
  a luta usa trigonometria e colisão, então um replay em outro navegador pode divergir. A corrida (rotação 0) é
  estável. Mitigação futura: trigonometria própria dentro da simulação. O resultado gravado é sempre o oficial.

## 9. Presença na loja

- Ao entrar na loja (`nScreen == 2`) logado, o cliente entra no canal Realtime de presença `shop` com
  `{uid, name, look}`; ao sair da loja, sai do canal.
- Cada cliente filtra os presentes pelos seus amigos aceitos e mantém um NPC por amigo: um `Sellman` (mesma rota
  aleatória dos vendedores particulares) que não vende nem compra, mostra o nome no balão e, ao clicar, abre o perfil
  do amigo (trocar/desafiar dali). Quando a rota acaba, ele recomeça enquanto o amigo estiver na loja.
- Privacidade: o canal é público para usuários logados (expõe "fulano está na loja" a quem conhece o canal).
  Depois: canal privado com autorização do Realtime (RLS em `realtime.messages`).

## 10. Testes

- `tests/harness.mjs` ganha `h.newPage()` (segundo contexto de navegador = segundo usuário).
- Cenários `tests/online-*.mjs`: cadastro de 2 usuários, amizade, perfil, oferta aceita/recusada (besouro e dinheiro
  mudam dos dois lados), desafio de corrida e de luta (o resultado do replay = resultado gravado), presença na loja
  (NPC do amigo aparece e some). Usuários de teste com e-mail `evo-test-*`; limpeza por SQL.

## 11. Publicação (não publicar sem aprovação)

- O GitHub Pages do repositório já serve a v1 (um site por repositório).
- **Proposta**: **Cloudflare Pages** ligado ao repositório, construindo a branch `v2` (preview por branch, grátis,
  sem limite de banda), em **`v2.evolution.hugobsan.com.br`** enquanto for beta; quando a v2 virar a principal,
  `evolution.hugobsan.com.br` passa a apontar para ela. Alternativas: Vercel (mesmo modelo; CLI ainda não logada) ou
  o próprio GitHub Pages servindo a v2 em `/v2/` (o workflow passaria a construir as duas branches).
- O domínio escolhido precisa entrar em *Site URL / Redirect URLs* do Supabase Auth.

## 12. Riscos e decisões em aberto

- **D1 — e-mail**: manter e-mail+senha sem confirmação, ou contratar SMTP (Resend tem plano grátis) para ligar
  confirmação, recuperação de senha e magic link?
- **D2 — publicação**: Cloudflare Pages em `v2.evolution.hugobsan.com.br`? (precisa de login no Cloudflare e DNS)
- **D3 — custo**: se a organização Supabase for paga, o novo projeto soma o custo de computação; no plano grátis,
  projetos inativos pausam após 7 dias sem uso.
- **D4 — OAuth**: GitHub/Google exigem criar OAuth Apps.
- Risco: trapaça por cliente adulterado (§7); divergência de replay entre navegadores (§8); abuso de cadastro
  (rate limit do Supabase no MVP, captcha depois); presença pública (§9).
