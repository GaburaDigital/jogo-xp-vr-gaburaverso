// Configuração do Vite do jogo.
// "npm run build" gera dist/ para o GitHub Pages, com service worker e a lista de arquivos para jogar sem internet.
import { defineConfig, type Plugin } from 'vite';
import { readdirSync, readFileSync, statSync, writeFileSync } from 'node:fs';
import { join, relative } from 'node:path';

const VERSAO = new Date().toISOString().replace(/[-:T.Z]/g, '').slice(0, 14);

/** Depois do build: escreve no sw.js a versão e os arquivos básicos, e cria lista_offline.json com tudo. */
function listaOffline(): Plugin {
  return {
    name: 'lista-offline',
    apply: 'build',
    closeBundle() {
      const raiz = 'dist';
      const todos: { url: string; bytes: number }[] = [];
      const andar = (d: string) => {
        for (const n of readdirSync(d)) {
          const c = join(d, n);
          const s = statSync(c);
          if (s.isDirectory()) andar(c);
          else if (n !== 'sw.js' && n !== 'lista_offline.json') todos.push({ url: './' + relative(raiz, c).replace(/\\/g, '/'), bytes: s.size });
        }
      };
      andar(raiz);
      // básicos: a página, o código e os ícones (o resto vem com "Salvar para jogar sem internet" ou ao jogar)
      const basicos = ['./', ...todos.filter((a) => /^\.\/(index\.html|assets\/|icones\/|manifest)/.test(a.url)).map((a) => a.url)];
      const sw = readFileSync(join(raiz, 'sw.js'), 'utf8').replace('__VERSAO__', VERSAO).replace('__BASICOS__', JSON.stringify(basicos, null, 2));
      writeFileSync(join(raiz, 'sw.js'), sw);
      writeFileSync(join(raiz, 'lista_offline.json'), JSON.stringify({ versao: VERSAO, arquivos: todos }, null, 1));
    },
  };
}

export default defineConfig({
  base: '/jogo-xp-vr-gaburaverso/',
  define: {
    __VERSAO_APP__: JSON.stringify(new Date().toLocaleDateString('pt-BR', { timeZone: 'America/Fortaleza' })),
    __VERSAO_CACHE__: JSON.stringify(VERSAO),
  },
  plugins: [listaOffline()],
  build: { chunkSizeWarningLimit: 1500, assetsInlineLimit: 0 },
});
