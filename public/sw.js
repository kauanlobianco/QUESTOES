// Service worker do Mestre dos Negócios: o app abre sem rede (mostra o aviso
// de conexão) e as visitas seguintes não baixam de novo o que não mudou.
// Jogadas (/api) e Supabase passam direto: nunca vêm do cache.
const VERSION = 'mdn-v2'
const SHELL = ['/', '/manifest.webmanifest', '/icons/icon-192.png']
const MAX_ASSETS = 80

self.addEventListener('install', (event) => {
  event.waitUntil(caches.open(VERSION).then((c) => c.addAll(SHELL)).then(() => self.skipWaiting()))
})

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) => Promise.all(keys.filter((k) => k !== VERSION).map((k) => caches.delete(k))))
      .then(() => self.clients.claim()),
  )
})

self.addEventListener('fetch', (event) => {
  const req = event.request
  const url = new URL(req.url)
  if (req.method !== 'GET' || url.origin !== self.location.origin || url.pathname.startsWith('/api/')) return

  // Páginas: rede primeiro (versão nova assim que publicada); sem rede, o app em cache.
  if (req.mode === 'navigate') {
    event.respondWith(
      fetch(req)
        .then((res) => {
          if (res.ok) store('/', res)
          return res
        })
        .catch(() => caches.match('/')),
    )
    return
  }

  // Arquivos do build têm hash no nome: nunca mudam, cache primeiro.
  if (url.pathname.startsWith('/assets/')) {
    event.respondWith(
      caches.match(req).then(
        (hit) =>
          hit ??
          fetch(req).then((res) => {
            if (res.ok) store(req, res).then(trim)
            return res
          }),
      ),
    )
    return
  }

  // Ícones e manifesto: responde do cache e atualiza em segundo plano.
  event.respondWith(
    caches.match(req).then((hit) => {
      const fresh = fetch(req).then((res) => {
        if (res.ok) store(req, res)
        return res
      })
      return hit ?? fresh
    }),
  )
})

/** Guarda uma cópia; o clone tem de ser feito já, antes de a página ler o corpo. */
function store(key, res) {
  const copy = res.clone()
  return caches.open(VERSION).then((c) => c.put(key, copy).then(() => c))
}

/** Builds antigos deixam arquivos órfãos: guarda só os mais recentes. */
async function trim(cache) {
  const keys = (await cache.keys()).filter((r) => new URL(r.url).pathname.startsWith('/assets/'))
  await Promise.all(keys.slice(0, Math.max(0, keys.length - MAX_ASSETS)).map((r) => cache.delete(r)))
}
