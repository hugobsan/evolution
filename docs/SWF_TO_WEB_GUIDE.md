# Guia: portar um jogo Flash (.swf) para JavaScript/TypeScript nativo

Roteiro genérico para um agente portar **qualquer** jogo .swf para rodar no navegador
sem plugin e sem runtimes de terceiros (Ruffle, CheerpX, etc.). Documento vivo:
acrescente o que aprender a cada port. Exemplos entre "(ex.: ...)" vêm de ports
anteriores e são só ilustração.

## 0. Antes de tudo: o jogo já existe em versão web/JS?

Pesquise antes de portar: nome do jogo + "html5" / "javascript" / "web version",
nome do autor ou portal original, Flashpoint Archive, itch.io, Newgrounds, Poki.
Se existir versão oficial, o port pode ser desnecessário. Registre o resultado
(mesmo negativo) no README do projeto.

## 1. Triagem do SWF (5 min)

```bash
file jogo.swf      # "Macromedia Flash data (compressed), version N"
```
- Cabeçalho `CWS` = zlib, `FWS` = sem compressão, `ZWS` = LZMA.
- **Versão ≤ 8 → ActionScript 2/1 (AVM1)**. Versão ≥ 9 com tag DoABC (82) → AS3 (AVM2).
  AS2 espalha código pela timeline (frame scripts, `on(release)` em instâncias,
  `onClipEvent`); AS3 costuma concentrar tudo em classes.
- Descompactar em Python: `b = d[:8] + zlib.decompress(d[8:])`. Contar tags
  (tipo = `uint16 >> 6`, tamanho = `& 63`; se 63, o tamanho é o uint32 seguinte)
  dá a noção do trabalho: nº de sprites (39), shapes (2/22/32/83), sons (14),
  scripts (12 DoAction, 59 DoInitAction = classes AS2, 82 DoABC = AS3), texto (37/11),
  morph shapes (46/84), vídeo (60), bitmaps (6/21/35/20/36).
- Ver o palco no header: retângulo em twips (÷20 = px), frame rate (uint16 8.8).

## 2. Ferramentas

- **REA (MCP)**: rejeita SWF ("unsupported binary format"). Não serve para SWF;
  não perca tempo além de uma tentativa.
- **JPEXS FFDec** (Java, `ffdec-cli.jar`): a ferramenta de análise. Usada **só em
  build/análise**; o jogo final não depende dela. Baixar o zip da release em
  `github.com/jindrapetrik/jpexs-decompiler/releases`. O download de binário pode ser
  bloqueado pelo classificador de permissões → peça ao usuário para rodar com
  `! comando`. Nunca tente "driblar" o bloqueio.
- Comandos:
  ```bash
  java -jar ffdec-cli.jar -help export     # lista formatos
  java -jar ffdec-cli.jar -format frame:png -export script,image,shape,sound,text,font,frame,symbolClass out jogo.swf
  java -jar ffdec-cli.jar -swf2xml jogo.swf out/swf.xml     # dump completo de todas as tags
  ```
- Saída de scripts AS2:
  - `scripts/__Packages/*.as` = classes;
  - `scripts/DefineSprite_<id>[_<linkage>]/frame_<n>/DoAction.as` = frame scripts;
  - `.../frame_<n>/PlaceObject2_<charId>_<depth>/CLIPACTIONRECORD on(evento).as`
    = handlers de instância. Chave estável de um handler: **(sprite, frame, depth)**.
  - `scripts/frame_<n>/` = timeline raiz.
- Concatenar todos os scripts de timeline num arquivo e lê-lo inteiro antes de
  desenhar o motor: revela quais APIs do Flash o jogo realmente usa.
- `frames/*.png` exportados mostram só o estado inicial de cada frame da raiz;
  útil para referência visual, não para estados dinâmicos.

## 3. Princípios

1. **Reaproveite os assets do SWF** (shapes, bitmaps, sons, fontes, animações) extraídos
   pelo FFDec. Nunca peça a um agente para redesenhar ou recriar assets.
2. **Converta dados, não reescreva**: posições, matrizes, quadros, rótulos, textos e
   timelines viram JSON por script. Código à mão só para comportamento (ActionScript).
3. **Biblioteca reutilizável**: os equivalentes do Flash (MovieClip, timeline, eventos,
   transformações, texto, som, SharedObject) ficam num motor sem nada do jogo
   (ex.: `src/engine/` de um port anterior pode ser copiado e estendido).
4. **Traduza em pedaços isolados**: cada agente recebe um conjunto de classes ou de
   scripts de timeline e o contrato da API, não o decompilado inteiro.
5. **Renderizador**: Canvas 2D nativo (Path2D) basta para jogos pequenos (até poucas
   centenas de objetos) e não adiciona dependência. Alternativa: **PixiJS** (WebGL),
   que traz filtros, máscaras e hit test prontos e escala melhor. Mas é dependência
   de runtime, e ainda é preciso converter as arestas do SWF em paths. Use Pixi se
   o desempenho do Canvas 2D não bastar ou se o usuário aceitar dependências.
6. **Linguagem do port pela versão do AS**: **AS2 → JavaScript** (AS2 é dinâmico,
   quase ES3: o port fica 1:1, sem brigar com tipos, e com menos código);
   **AS3 → TypeScript** (as anotações de tipo do AS3 viram tipos TS diretamente).
   Se usar TS num jogo AS2, use `any`/`[k: string]: any` (foi o caso do primeiro
   port) e espere o mesmo resultado do JS com um pouco mais de ruído.

## 4. Arquitetura recomendada

1. **Extrator (Python, build-time)**: `swf.xml` → `swf.json` próprio, com shapes já
   convertidas em paths SVG, timelines como operações por frame (place/remove/sound),
   rótulos, textos, fontes (glifos como paths), botões, exports (linkage → id).
   Copiar bitmaps/sons exportados pelo FFDec para `public/assets`.
2. **Mini-motor de display (TS + Canvas 2D)** implementando só a parte da API
   Flash que o jogo usa: MovieClip/timeline, display list por depth, shapes
   (Path2D), textos com glifos embutidos, máscaras, filtros, mouse, sons,
   SharedObject.
3. **Port manual do ActionScript para TS**, contra uma API com os mesmos nomes do
   Flash (`_x`, `gotoAndStop`, `attachMovie`, `onPress`...). O código portado fica
   quase linha a linha igual ao original, o que facilita revisar.

Escrever um interpretador AVM1/AVM2 é reconstruir o Ruffle; o port manual compensa
quando o código do jogo tem até alguns milhares de linhas.

Paralelização: o motor é dependência de tudo. Feche a API do motor primeiro; depois o
port de classes e de scripts de timeline pode ser dividido entre agentes.

## 5. Formato SWF: o que o extrator precisa acertar

- Unidades: **twips** (1/20 px). Converter para px no build.
- MATRIX: `a=scaleX, b=rotateSkew0, c=rotateSkew1, d=scaleY`;
  `x' = a*x + c*y + tx`, `y' = b*x + d*y + ty`. No XML do FFDec, scale/rotate só valem
  quando `hasScale`/`hasRotate` = true (senão 1/0).
- **Shapes**: cada aresta tem fillStyle0 (lado esquerdo) e fillStyle1 (direito).
  Coloque a aresta como está na lista do fill1 e **invertida** na do fill0; depois
  encadeie as arestas pelo ponto inicial em subpaths fechados. Linhas: na ordem
  original. `StyleChangeRecord` com `stateNewStyles` abre nova camada (descarregue
  as anteriores). Ordem de desenho por camada: fills por índice, depois linhas.
  Regra de preenchimento: even-odd.
- Gradientes: o quadrado do gradiente vai de −16384 a 16384 twips (±819,2 px quando
  só o translate é convertido). Linear com eixos perpendiculares e radial com escala
  uniforme dá para fazer direto no canvas; no caso geral use
  `clip(path)` + `transform(matriz)` + `fillRect`. Focal (tipo 19): `focalPoint × raio`.
- Bitmap fill com `bitmapId=65535` = vazio (ignorar). Matriz de bitmap: dividir
  a,b,c,d,tx,ty por 20.
- DefineFont3: glifos em EM de 1024×20 → dividir por 20 = EM 1024;
  escala do texto = altura_px / 1024. DefineText: `glyphAdvance` em twips.
- `DefineEditText`: `useOutlines` = fonte embutida (desenhar glifos); senão fonte do
  sistema (`fillText`). Gutter de 2 px dentro do retângulo. `html` = o texto/variável
  é HTML simples (`<p align>`, `<font color>`, `<br>`).
- `DefineScalingGrid` = 9-slice do símbolo.
- `ExportAssetsTag` = nomes de linkage usados por `attachMovie`/`attachSound`.
- Música de fundo muitas vezes não é exportada; procure `StartSound` com
  `hasLoops`/`loopCount` alto dentro de algum sprite.
- PlaceObject3 traz filtros (DropShadow/Glow: ângulo em **radianos** no XML, mas em
  graus na API AS2) e blend modes.

## 6. Semântica AVM1 (AS2) que o motor precisa respeitar

- **Ordem de execução** ao entrar num frame: o script do frame do pai roda **antes**
  dos scripts de frame 1 dos filhos recém-colocados. `on(construct)` roda na criação
  do filho, antes de qualquer script dele. Sintoma de ordem errada: botões sem rótulo,
  variáveis lidas como undefined.
- `gotoAndStop` aplica a display list na hora (código seguinte já enxerga os novos
  filhos); os scripts do frame-alvo vão para a fila e rodam depois do script atual.
- `attachMovie(id, nome, depth, initObj)`: initObj aplicado antes de qualquer script.
- Depths: objetos da timeline ficam em depth negativa (`depthSWF − 16384`).
  `removeMovieClip` só funciona com depth ≥ 0; `swapDepths` tira o objeto do controle
  da timeline (por isso jogos AS2 têm rotinas que varrem e removem clips "órfãos").
- Variáveis de timeline: `var x` e `function f()` num frame script viram propriedades
  do clip. `var x;` sem valor não apaga a propriedade (no-op no port).
- Funções declaradas num frame script enxergam as variáveis do clip pela scope chain,
  não por `this`; `this` é quem recebeu o evento.
- **undefined é silencioso em AS2**: chamar método ou ler propriedade de undefined não
  lança erro. No port use `?.` em toda referência que pode sumir (clip removido,
  alvo nulo). Clip removido: propriedades como `_x` passam a ser undefined.
- Aritmética com undefined dá NaN (SWF ≥ 7); `int(x)` trunca e `int(NaN)` = 0;
  `random(n)` = inteiro em [0, n).
- TextField com `variable`: o texto acompanha a variável (caminhos tipo `_parent.x`).
  Se a variável não existe na criação, ela é criada com o texto inicial.
  `onChanged` só dispara com digitação do usuário.
- `eval("_parent.ob.s_0")` resolve caminhos; string que não é identificador → undefined.
- `for...in` em arrays AS2 enumera do índice mais alto para o mais baixo (afeta laços
  que fazem `splice` durante a iteração).
- Propriedades `_X`/`_Y` maiúsculas no código decompilado são as mesmas `_x`/`_y`.
- `setInterval(obj, "metodo", ms)` é a forma AS2; `hitTest(x, y, true)` testa a forma
  real e ignora `_visible`.
- `hitArea = _root` num clip transparente com `onPress` = escudo de input do jogo todo.
- SharedObject → localStorage. Serialize sem MovieClips nem funções e com proteção
  contra ciclos; o Flash grava ao sair (salve em `pagehide`/`visibilitychange` e
  periodicamente). Classes AS2 viram objetos simples ao recarregar; muitos jogos
  reconstroem as instâncias nos construtores a partir desses objetos.
- `BitmapData.draw(_root)` (usado em transições) = snapshot do palco num canvas offscreen.
- Áudio: navegadores exigem gesto do usuário; crie o `AudioContext` e chame `resume()`
  no primeiro clique.
- **Referências a clips são por caminho**: se um clip é removido e outro com o mesmo
  nome aparece no mesmo pai (ex.: botão que troca o campo de texto entre os frames
  Up/Over/Down), a referência antiga (ex.: `hitArea = tLabel`) passa a valer para o novo.
  Implemente um `live(ref)` que re-resolve pai + nome quando o alvo foi removido.
- Chamar algo que não é função (ex.: `obj.metodo()` num objeto que voltou do save sem
  a classe) devolve undefined em AS2. No port: `obj?.metodo?.()`. Atribuir propriedade
  em undefined (`this.mClip.onPress = ...` com mClip indefinido) também é ignorado; no
  port, proteja com `if (!this.mClip) return`.
- **Nomes internos do motor não podem colidir com variáveis do jogo**: scripts AS2 criam
  funções arbitrárias nos clips (ex.: `mBar.goto = function...`). Um método interno
  `goto` foi sobrescrito e causou recursão infinita (página travada, som em loop).
  Use prefixo (`$goto`) em tudo que é interno e cruze os nomes (script que lista
  `mc.X = ` no port vs membros do motor).
- Botões (`DefineButton2`) também aceitam `onPress`, `startDrag` etc. em AS2: não
  restrinja essas APIs a MovieClip.

## 6.1 Particularidades de render e texto

- `DefineEditText.variableName` é o vínculo da variável: o campo precisa ler isso do SWF.
  Ler `_width`/`text` de um campo vinculado deve sincronizar com a variável na hora (o
  script redimensiona botões logo depois de mudar o rótulo).
- `autoSize` "right"/"center" desloca o **`_x` do campo**, não o retângulo interno.
- Traços com `noHScale/noVScale` (non-scaling) não podem engrossar com escala não
  uniforme: transforme o path para o espaço da tela e trace com matriz identidade.
  Sintoma: faixas grossas nas laterais de barras esticadas e bordas de painéis 9-slice.
- `DefineScalingGrid` (9-slice) aparece em painéis e botões esticados por script.
- Filtros: glow/sombra **internos** com `knockout` (o objeto some e fica só a vinheta)
  existem; sem implementar, aparece um retângulo branco em cima da cena.
- **Pool de canvas offscreen** (usado para filtros) é reaproveitado entre frames:
  resete o estado do contexto (`globalCompositeOperation`, sombra, alpha, transform)
  ao entregar um canvas. Sintoma do bug: objetos com filtro somem quando a quantidade
  de objetos na tela muda.
- `_quality` (LOW/MEDIUM/HIGH/BEST): no navegador atual não faz sentido baixar a qualidade;
  ignore o setter, renderize sempre no máximo e esconda os botões de qualidade do jogo.

## 6.2 Testes

- Exponha helpers só em modo dev (`window.__player`, `__btn(label)`, `__clickObj(clip)`)
  e rode cenários com um harness headless (playwright-core + Chrome do sistema,
  `executablePath: /usr/bin/google-chrome`). Toda avaliação com **timeout**: loops
  infinitos de port aparecem como "travou" em vez de congelar o agente.
- Logs da página durante um travamento: grave em arquivo (`fs.appendFileSync`) no
  handler de console; stdout do Node se perde quando o processo é morto.
- Depois de cada transição de tela (FADE), espere ~1 s antes de clicar: o jogo bloqueia
  input durante a transição.
- Screenshot logo após navegar pode pegar um frame vazio: espere o estado (frame/label).
- Navegador do usuário e testes headless podem rodar em paralelo (saves no localStorage
  de cada navegador). Para paralelizar entre agentes, cada um com seu Chrome headless.

- **Opções que mudam o ritmo do jogo** (ex.: "sincronizar insetos com a velocidade"): o loop por frame
  (`onEnterFrame`, 30 fps) e o relógio de dias (`setInterval`) são independentes no original. Para
  acelerar o loop, chame a função de passo N vezes por frame em vez de escalar passos/ângulos: contadores
  (`nTime_th % 30`), colisões e estados escalam juntos e a lógica fica intacta. Limite: animações de
  timeline (pernas, `play()`) seguem a 30 fps. Teste medindo distância com o estado fixo (statement e tick
  de dia estubados) e contando chamadas do passo: o ruído do comportamento aleatório esconde a razão real.

## 7. Decisões típicas de produto

- Remover anúncios (MochiAd e afins), preloaders de rede e envio/visualização de
  highscore online quando o objetivo for versão offline.
- Links externos de portais antigos (sites que não existem mais): esconder ou deixar
  inertes.
- Manter o save local (SharedObject → localStorage).
- Registrar ajustes pós-versão 1 num `TODO.md`.

## 8. Camada online sobre um port (lições do multiplayer)

- **Ligue o online por fora do port**: embrulhe os frame scripts das telas (o registro de scripts é consultado em
  tempo de execução) e métodos do protótipo das classes portadas, em vez de editar a lógica fiel. O port continua
  comparável ao original e a camada nova fica num diretório só.
- **Replay determinístico**: se a simulação usa só `Math.random`, troque-o por um PRNG semeado (seed gravada no
  servidor) apenas *em volta* do passo da simulação (`init` + `run()`), e restaure logo depois. Assim transições e
  efeitos visuais não consomem a sequência. Simulação por passos (não por tempo) deixa acelerar/pular sem mudar o
  resultado. Risco: `Math.sin/cos/atan2` podem diferir entre motores JS; grave o resultado oficial e compare no replay.
- **Formulários e listas em HTML sobreposto**, desenhados nas coordenadas do palco (ex.: 640×480) com
  `transform: scale()` acompanhando o canvas; pare a propagação dos eventos de ponteiro e pause o jogo enquanto aberto.
  Popups do canvas não podem ficar escondidos atrás do overlay (feche-o quando o jogo precisar perguntar algo).
- Campos de texto reaproveitados de popups do SWF costumam ser de **uma linha**: `\n` não quebra; mantenha os textos
  curtos e confira na tradução.
- **Save na nuvem**: reaproveite a serialização do SharedObject (grave e leia o próprio item do `localStorage`) para
  o formato ficar idêntico ao local. Revisão no servidor detecta dois aparelhos; o que muda o save de outra pessoa
  (trocas, prêmios) vira uma "entrega" aplicada pelo cliente e marcada no próprio save (idempotente).
- **Testes multiusuário**: um contexto de navegador por jogador; espere o render assíncrono terminar antes de
  preencher campos (um atributo `data-busy` no painel resolve); force o idioma para os seletores; lembre do rate
  limit do provedor de auth ao criar muitos usuários de teste.
