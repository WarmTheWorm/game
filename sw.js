// Serves the packs the tools keep in the browser (src/js/packstore.js): any
// request under /__idb/<kind>/<name>/ is answered from IndexedDB, so a stored
// pack reads exactly like a folder on disk. Everything else goes to the
// server as if this weren't here. It sits at the site's root so its scope
// takes in the game, the level editor and the asset pack creator alike.
importScripts('src/js/root.js', 'src/js/packstore.js');

// For a pack's page from before ?play hid its start menu: with ?play the menu
// is hidden from the first paint, and shown again only once the game has
// hidden it itself (she is in the level) — after that it is the menu again.
const PLAY_RUN = `<script>
if (new URLSearchParams(location.search).has('play')) {
  document.documentElement.classList.add('play-run');
  addEventListener('DOMContentLoaded', () => {
    const s = document.getElementById('startScreen');
    if (!s) { document.documentElement.classList.remove('play-run'); return; }
    new MutationObserver((m, o) => {
      if (s.classList.contains('hidden')) { document.documentElement.classList.remove('play-run'); o.disconnect(); }
    }).observe(s, { attributes: true, attributeFilter: ['class'] });
  });
}
</script>
<style>.play-run #startScreen { display: none !important; }</style>
`;

// The game page for a level pack's folder that has none: the built engine
// (dist/game.html, as npm run build leaves it), its pack roots set to the
// folder's own files, as a built pack's page has them (editor/index.html's
// packGame) — so playing it never meets an engine page older than the site.
const ROOTS_MARKER = '<!-- pack roots -->';
async function enginePage(kind, name) {
  const res = await fetch(wtwUrl('dist/game.html'), { cache: 'no-cache' });
  if (!res.ok) return new Response(`the game page is not here: /dist/game.html ${res.status}`, { status: 502, headers: { 'Content-Type': 'text/plain' } });
  let page = await res.text();
  const lp = await packStore.get(kind, name, 'levelpack.json');
  if (!lp) return new Response(`not in the browser's packs: ${packStore.url(kind, name)}levelpack.json`, { status: 404, headers: { 'Content-Type': 'text/plain' } });
  let data = {};
  try { data = JSON.parse(await new Response(lp.data).text()); } catch { /* the defaults, then */ }
  const str = v => JSON.stringify(String(v));
  const roots = '<script>\n'
    + `  window.PACK_URL = 'levelpack.json';\n`
    + `  window.OBJECTS_URL = ${str((data.objects && data.objects.manifest) || 'objects/objects.json')};\n`
    + `  window.SOUNDS_URL = ${str(data.sounds || 'sounds/default.json')};\n`
    + `  window.TILES_URL = ${str((data.tileset && data.tileset.texture) || 'tiles/tiles.png')};\n`
    + '</script>';
  page = page.includes(ROOTS_MARKER) ? page.replace(ROOTS_MARKER, roots) : page.replace('<head>', '<head>\n' + roots);
  if (!page.includes('wtwShareHost')) page += `\n<script src="${wtwUrl('src/js/sharehost.js')}"></script>\n`;
  if (page.includes('wtw:play') && !page.includes('play-run') && page.includes('<head>')) page = page.replace('<head>', '<head>\n' + PLAY_RUN);
  return new Response(page, { status: 200, headers: { 'Content-Type': 'text/html; charset=utf-8', 'Cache-Control': 'no-store' } });
}

self.addEventListener('install', () => self.skipWaiting());
self.addEventListener('activate', e => e.waitUntil(self.clients.claim()));

self.addEventListener('fetch', e => {
  const url = new URL(e.request.url);
  if (url.origin !== location.origin || e.request.method !== 'GET') return;
  const want = packStore.parse(url.pathname);
  if (!want) return;
  e.respondWith((async () => {
    try {
      // a level pack being edited is read at /__idb/drafts/<id>/: with no
      // draft (nothing changed since it was saved), that is what was saved
      if (want.kind === 'drafts' && !await packStore.manifest('drafts', want.name)) want.kind = 'packs';
      const rec = await packStore.get(want.kind, want.name, want.path);
      // a level pack's own folder (/__idb/packs/<id>/) keeps no game page: it
      // is played on the site's engine as it is now, pointed at the folder
      if (!rec && (want.kind === 'packs' || want.kind === 'drafts') && want.path === 'index.html') return await enginePage(want.kind, want.name);
      if (!rec) return new Response(`not in the browser's packs: ${url.pathname}`, { status: 404, headers: { 'Content-Type': 'text/plain' } });
      const headers = { 'Content-Type': rec.type, 'Cache-Control': 'no-store' };
      // a pack's page built before the game joined this browser's room
      // (src/js/sharehost.js) joins it all the same
      if (want.kind === 'levels' && String(rec.type).startsWith('text/html')) {
        let page = await new Response(rec.data).text();
        if (!page.includes('wtwShareHost')) page += `\n<script src="${wtwUrl('src/js/sharehost.js')}"></script>\n`;
        // ... and one built before ?play hid the start menu while it loads
        // (come through a flag from another pack) hides it too, until the
        // game hides it itself
        // (only one that can start at level one — wtw:play — or there'd be no menu at all)
        if (page.includes('wtw:play') && !page.includes('play-run') && page.includes('<head>')) page = page.replace('<head>', '<head>\n' + PLAY_RUN);
        return new Response(page, { status: 200, headers });
      }
      return new Response(rec.data, { status: 200, headers });
    } catch (err) {
      return new Response(`could not read the browser's packs: ${err.message}`, { status: 500, headers: { 'Content-Type': 'text/plain' } });
    }
  })());
});
