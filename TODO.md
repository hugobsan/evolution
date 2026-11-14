# TODO

## v2 (multiplayer) — depois do MVP

Ver `docs/V2_DISCOVERY.md` (§2 "Depois" e §12). Principais:
- Ligar o captcha (Turnstile) no login anônimo quando houver a chave (`src/online/config.ts` + `[auth.captcha]`).
- Google OAuth como vínculo opcional da identidade anônima.
- Trigonometria determinística na simulação (replay de luta idêntico entre navegadores diferentes).
- Validar a evolução do save no servidor (anti-trapaça) e resultado de desafio confirmado pelos dois lados.
- Mover `is_friend`/`my_world` para um schema não exposto pela API (hoje são chamáveis por RPC; só leem pertença).
- Expiração automática de ofertas/desafios pendentes; contraproposta; revanche.
