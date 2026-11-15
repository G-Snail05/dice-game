// Seeded RNG (mulberry32). The whole state is one uint32, so a run can be saved and resumed exactly.
export function hashSeed(str) {
  let h = 2166136261 >>> 0;
  for (const ch of String(str)) { h ^= ch.codePointAt(0); h = Math.imul(h, 16777619) >>> 0; }
  return h || 1;
}

export function makeRng(state) {
  const r = {
    state: state >>> 0,
    next() {
      let t = (r.state = (r.state + 0x6D2B79F5) >>> 0);
      t = Math.imul(t ^ (t >>> 15), t | 1);
      t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    },
    int(n) { return Math.floor(r.next() * n); },
    pick(a) { return a[r.int(a.length)]; },
    weighted(entries) { // [[value, weight], ...]
      const tot = entries.reduce((s, e) => s + e[1], 0);
      let x = r.next() * tot;
      for (const [v, w] of entries) { if ((x -= w) < 0) return v; }
      return entries[entries.length - 1][0];
    },
    shuffle(a) {
      for (let i = a.length - 1; i > 0; i--) { const j = r.int(i + 1); [a[i], a[j]] = [a[j], a[i]]; }
      return a;
    },
  };
  return r;
}

export function randomSeed() {
  const c = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  let s = '';
  for (let i = 0; i < 6; i++) s += c[Math.floor(Math.random() * c.length)];
  return s;
}
