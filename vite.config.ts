import { defineConfig } from 'vite';
// tests/ fica fora do watch: os testes gravam screenshots ali e não devem recarregar a página
export default defineConfig({ base: './', server: { watch: { ignored: ['**/tests/**'] } } });
