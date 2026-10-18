// Service worker: guarda o jogo para funcionar sem internet.
// Na instalação guarda só o básico (página, código, ícones). O resto (modelos, sons, falas) entra no cache
// quando é usado ou quando o jogador toca em "Salvar para jogar sem internet" (a página baixa a lista toda).
// A versão do cache muda a cada publicação; caches antigos são apagados.
const CACHE = 'nave-__VERSAO__';
const BASICOS = __BASICOS__;

self.addEventListener('install', (e) => {
  e.waitUntil(caches.open(CACHE).then((c) => c.addAll(BASICOS)).then(() => self.skipWaiting()));
});

self.addEventListener('activate', (e) => {
  e.waitUntil(
    caches.keys()
      .then((nomes) => Promise.all(nomes.filter((n) => n.startsWith('nave-') && n !== CACHE).map((n) => caches.delete(n))))
      .then(() => self.clients.claim()),
  );
});

// Página: rede primeiro (pega a versão nova assim que publicada); sem internet, a cópia guardada.
// Outros arquivos: cache primeiro; o que vier da rede é guardado para a próxima vez.
self.addEventListener('fetch', (e) => {
  if (e.request.method !== 'GET') return;
  if (e.request.mode === 'navigate') {
    e.respondWith(
      fetch(e.request)
        .then((r) => { const copia = r.clone(); caches.open(CACHE).then((c) => c.put('./', copia)); return r; })
        .catch(() => caches.match('./')),
    );
    return;
  }
  if (new URL(e.request.url).pathname.endsWith('lista_offline.json')) return; // sempre da rede
  e.respondWith(
    caches.match(e.request, { ignoreSearch: true }).then((r) => r || fetch(e.request).then((resp) => {
      if (resp.ok) { const copia = resp.clone(); caches.open(CACHE).then((c) => c.put(e.request, copia)); }
      return resp;
    })),
  );
});

self.addEventListener('message', (e) => {
  if (e.data === 'pular-espera') self.skipWaiting();
});
