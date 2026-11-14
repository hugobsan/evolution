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
