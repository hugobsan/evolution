# Diretrizes do projeto (Evolution v2)

## Testes e regressão

- **Regressão proporcional ao que a mudança alcança.** Rode os testes das telas e fluxos que a mudança realmente toca (inclusive via código compartilhado que seja exercido ali). Não rode a lista inteira por hábito: uma funcionalidade só do insetário não precisa da arena, por exemplo.
- **Não teste "se traduziu".** O i18n já garante a tradução quando as chaves existem em `src/game/i18n.ts`; não rode `tests/i18n.mjs` nem crie teste só para conferir que um texto tem versão PT.
- **Prints só quando a interface muda naquele ponto.** Texto novo (ou caixa/botão novo) ganha print em PT e EN, porque um texto que cabe em um idioma pode estourar a caixa no outro. Sem mudança de interface, sem print.
- Ao criar recurso visual novo, confira por print lado a lado com objetos do próprio jogo (contorno escuro, gradiente, paleta) e siga a arte original.
