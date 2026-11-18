// Where the site is served from: '/' on a host of its own (localhost:5180,
// shor-ofer.github.io), or the folder it sits in — '/game/' on GitHub Pages
// as warmtheworm.github.io/game/. Every page, and the service worker, reach
// the site's own files through it (wtwUrl), never from the host's root.
//
// A page knows it from its own address: the part before the first of the
// site's folders (editor/, share/, src/, levelpacks/, __idb/, …); a page at
// the top (index.html) is in the root itself. The service worker knows it as
// its scope. Read once, by whichever script loads first.
var WTW_ROOT = typeof WTW_ROOT === 'string' ? WTW_ROOT : (() => {
  if (typeof registration !== 'undefined' && registration && registration.scope) return new URL(registration.scope).pathname;
  const path = location.pathname;
  const m = /^(.*?\/)(?:editor|share|src|dist|levelpacks|assetpacks|assetpack-editor|__idb|tools|docs)\//.exec(path);
  return m ? m[1] : path.replace(/[^/]*$/, '');
})();
// A path of the site's — 'share/', or '/levelpacks/garden/' as an index lists
// it — as an address on this host.
function wtwUrl(path) {
  const p = String(path);
  if (/^[a-z]+:/i.test(p) || p.startsWith(WTW_ROOT)) return p;
  return WTW_ROOT + p.replace(/^\/+/, '');
}
