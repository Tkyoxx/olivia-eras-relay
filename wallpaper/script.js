/* ==========================================================================
   OLIVIA RODRIGO · ULTIMATE ERAS — script.js  (motor optimizado)

   CÓMO SE MANTIENE LIGERO
   · Un solo reloj (Clock) a 24 fps mueve TODO: partículas, columpio, goteo,
     frases, anuncios… No hay animaciones CSS infinitas, así que el navegador
     solo dibuja 24 veces por segundo (no 60–144).
   · Si hay un video reproduciéndose, el reloj se engancha a sus cuadros
     (requestVideoFrameCallback): video y animaciones salen en el mismo cuadro.
   · Fondo, manchas de color, bokeh, partículas, estrellas fugaces, grano y
     viñeta se dibujan en WebGL (la GPU) con un atlas de sprites: 2 canvas,
     pocas llamadas de dibujo por cuadro. El canvas de fondo es opaco.
   · El DOM solo recibe cambios de transform/opacity en capas propias (no se
     vuelve a pintar) y solo cuando el valor cambia.
   · Modos de calidad: ultra · high · perf · eco.

   Módulos: CONFIG · DATA · Stage · Pointer · Clock · Tweens · Era · EraFX ·
   Bigword · Sprites · Renderer · Particles · Glow · Ambient · Phrases ·
   Collage · HUD · Video · Media · Song · VideoSync · YTDirect · YTRelay ·
   AudioFX · Quality · WE bridge
   ========================================================================== */
(() => {
  'use strict';

  /* ───────────────────────── CONFIG ───────────────────────── */
  const CONFIG = {
    quality: 'high',      // 'ultra' | 'high' | 'perf' | 'eco'
    fps: 24,              // cuadros por segundo de TODO el wallpaper
    density: 1,           // multiplicador de partículas (0 … 2)
    eraMode: 'cycle',     // 'cycle' | 'sour' | 'guts' | 'pink'
    eraDuration: 45,      // segundos por era en modo ciclo
    eraAnnounce: true,    // anuncio grande al cambiar de era / canción
    parallax: 0.6,        // 0 … 1
    phrases: true,
    phraseEvery: 3,       // segundos entre frases nuevas
    audio: true,
    clock24: false,
    trail: true,          // estela de destellos del cursor
    glow: true,           // halo de luz del cursor
    meteors: true,        // estrellas fugaces
    grain: true,          // grano de película
    videoSource: 'auto',  // 'auto' (archivo local → YouTube) | 'local' | 'youtube' | 'off'
    videoOffset: 0,       // ajuste global de sincronía en segundos (+ adelanta el video)
    ytRelay: 'https://tkyoxx.github.io/olivia-eras-relay/',  // puente de YouTube en GitHub Pages (ver youtube-relay/LEEME.txt)
    online: true,         // con internet, abrir la copia publicada (ahí YouTube sí funciona dentro de Wallpaper Engine)

    // ✍️ Escribe aquí tus frases o versos favoritos. También puedes ponerlos
    //    desde Wallpaper Engine en "Tus frases", separados con |
    customPhrases: [],
  };

  // back/front = resolución de cada canvas (1 = nítido) · dpr = tope para pantallas HiDPI
  const QUALITY = {
    // ambient = cuadros/s de las micro-animaciones del collage (columpio, gotas, brillo…)
    ultra: { back: 1,   front: 1,   dpr: 1.5, particles: 110, bokeh: 14, meteors: true,  tilt: true,  glow: true,  trail: true,  phrases: 3, grain: true,  ambient: 24 },
    high:  { back: .8,  front: 1,   dpr: 1,   particles: 85,  bokeh: 10, meteors: true,  tilt: true,  glow: true,  trail: true,  phrases: 3, grain: true,  ambient: 12 },
    perf:  { back: .6,  front: .8,  dpr: 1,   particles: 55,  bokeh: 6,  meteors: false, tilt: false, glow: true,  trail: true,  phrases: 2, grain: true,  ambient: 8  },
    eco:   { back: .5,  front: .65, dpr: 1,   particles: 28,  bokeh: 3,  meteors: false, tilt: false, glow: false, trail: false, phrases: 1, grain: false, ambient: 6  },
  };
  let Q = QUALITY.high;

  /* ───────────────────────── helpers ───────────────────────── */
  const $ = (s) => document.querySelector(s);
  const $$ = (s) => [...document.querySelectorAll(s)];
  const rand = (a, b) => a + Math.random() * (b - a);
  const pick = (arr) => arr[(Math.random() * arr.length) | 0];
  const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
  const pad2 = (n) => String(n).padStart(2, '0');
  const TAU = Math.PI * 2;
  const wave = (t, period, phase = 0) => 0.5 - 0.5 * Math.cos(TAU * (t / period + phase));   // 0→1→0 suave
  const hex = (h) => { const n = parseInt(h.slice(1), 16); return [(n >> 16) / 255, ((n >> 8) & 255) / 255, (n & 255) / 255]; };
  // escribe un estilo solo si cambió (evita trabajo de estilo inútil)
  const put = (el, prop, v) => { const c = el.__s || (el.__s = {}); if (c[prop] !== v) { c[prop] = v; el.style[prop] = v; } };
  const Ease = {
    lin: (k) => k,
    out: (k) => 1 - (1 - k) ** 3,
    inOut: (k) => (k < 0.5 ? 4 * k * k * k : 1 - (-2 * k + 2) ** 3 / 2),
    back: (k) => { const c1 = 2.7, c3 = c1 + 1; return 1 + c3 * (k - 1) ** 3 + c1 * (k - 1) ** 2; },
  };

  function weighted(weights) {
    let r = Math.random() * Object.values(weights).reduce((a, b) => a + b, 0);
    for (const k in weights) { r -= weights[k]; if (r <= 0) return k; }
    return Object.keys(weights)[0];
  }

  /* ───────────────────────── DATA ───────────────────────── */
  const ERAS = {
    sour: {
      vhs: 'MAY.21 2021',
      flash: { title: 'SOUR', sub: 'era i · sour · 2021' },
      chan: { no: 'CH 01', title: 'SOUR' },
      ticket: { kick: 'an evening with olivia', title: ['SOUR', 'TOUR'], meta: '2022 · GA FLOOR', fine: 'bring tissues, just in case', no: '№ 2022' },
      phone: { msg: '1 new voicemail', from: "from: ♡ (don't)" },
      // fondo (lo pinta el shader): degradado base + 3 manchas fijas + colores de las manchas que flotan
      bg: {
        base: ['#1b0836', '#0d0418'],
        spots: [[.18, .08, .638, .464, '#4c1499'], [.88, .92, .385, .385, '#7a0f3a'], [.70, .30, .42, .35, '#2a0d5c']],
        main: '#6d28d9', hot: '#be123c', accent: '#a855f7',
      },
      weights: { butterfly: .36, bandaid: .2, star: .12, sparkle: .2, broken: .12 },
      pal: {
        butterfly: ['#efe4ff', '#8b5cf6', '#2e1065'],
        bandaid:   ['#d9c7ff', '#f6f0ff', '#7c3aed'],
        broken:    ['#ff8fa8', '#d1123f', '#4a0416'],
        heart:     ['#ffe0ef', '#c084fc', '#4c1d95'],
        sparkle:   '#c4b5fd',
        bat:       '#a855f7',
        bokeh:     '#a78bfa',
      },
    },
    guts: {
      vhs: 'SEP.08 2023',
      flash: { title: 'GUTS', sub: 'era ii · guts · 2023' },
      chan: { no: 'CH 02', title: 'GUTS' },
      ticket: { kick: 'an evening with olivia', title: ['GUTS', 'WORLD TOUR'], meta: 'SEC 104 · ROW 12 · SEAT 8', fine: 'no refunds on broken hearts', no: '№ 2024' },
      phone: { msg: '3 missed calls', from: 'from: ✕ blocked' },
      bg: {
        base: ['#1d050d', '#09020a'],
        spots: [[.78, .12, .56, .448, '#8f0b26'], [.12, .88, .464, .406, '#44107a'], [.40, .50, .35, .28, '#2a0612']],
        main: '#b3122f', hot: '#7c3aed', accent: '#ff2e4d',
      },
      weights: { butterfly: .2, star: .24, sparkle: .16, broken: .22, bat: .1, bandaid: .08 },
      pal: {
        butterfly: ['#fbd5f5', '#a21caf', '#3b0764'],
        bandaid:   ['#e8b994', '#f7e3cf', '#c81e3c'],
        broken:    ['#ff6b81', '#c8102e', '#3f0310'],
        heart:     ['#ffd0d8', '#e11d48', '#4c0519'],
        sparkle:   '#fecdd3',
        bat:       '#ff2e4d',
        bokeh:     '#ff4d6d',
      },
    },
    pink: {
      vhs: 'JUN.12 2026',
      flash: { title: 'so in love', sub: 'era iii · you seem pretty sad for a girl so in love · 2026' },
      chan: { no: 'CH 03', title: 'so in love' },
      ticket: { kick: 'an evening with olivia', title: ['THE UNRAVELED', 'TOUR'], meta: '2026 — 27 · FLOOR A', fine: 'pretty sad, still dancing', no: '№ 2026', long: true },
      phone: { msg: '1 new message ♡', from: 'from: ♡ (him?)' },
      bg: {
        base: ['#2c1028', '#12060f'],
        spots: [[.50, 0, .58, .464, '#8a3168'], [.92, .86, .448, .392, '#5a2390'], [.10, .70, .39, .325, '#6e1f45']],
        main: '#d9588f', hot: '#8b5cf6', accent: '#f9a8d4',
      },
      weights: { butterfly: .26, heart: .24, sparkle: .22, bandaid: .12, star: .1, broken: .06 },
      pal: {
        butterfly: ['#fff1f8', '#f472b6', '#701a75'],
        bandaid:   ['#f9c6dc', '#fff0f6', '#db2777'],
        broken:    ['#ffb3cf', '#e11d74', '#500724'],
        heart:     ['#fff1f7', '#f9a8d4', '#be185d'],
        sparkle:   '#fbcfe8',
        bat:       '#f472b6',
        bokeh:     '#f9a8d4',
      },
    },
  };
  const ERA_ORDER = ['sour', 'guts', 'pink'];

  // Tracklists (solo títulos)
  const SONGS = {
    sour: ['brutal', 'traitor', 'drivers license', '1 step forward, 3 steps back', 'deja vu', 'good 4 u',
           'enough for you', 'happier', 'jealousy, jealousy', 'favorite crime', 'hope ur ok'],
    guts: ['all-american bitch', 'bad idea right?', 'vampire', 'lacy', 'ballad of a homeschooled girl',
           'making the bed', 'logical', 'get him back!', 'love is embarrassing', 'the grudge',
           "pretty isn't pretty", 'teenage dream'],
    pink: ['drop dead', 'stupid song', 'honeybee', 'maggots for brains', 'u + me = <3', 'my way', 'purple',
           'the cure', 'begged', "what's wrong with me", 'less', 'expectations', 'cigarette smoke'],
  };

  function songKicker(era, i) {
    const n = pad2(i + 1);
    if (era === 'sour') return `SOUR · track ${n}`;
    if (era === 'guts') return `GUTS · track ${n}`;
    return (i < 7 ? 'girl so in love' : 'you seem pretty sad') + ` · ${n}`;
  }

  // Canciones fuera de los 3 álbumes que también se reconocen
  const SONG_EXTRAS = [
    { title: 'obsessed',              era: 'guts', kick: 'GUTS (spilled) · bonus' },
    { title: "girl i've always been", era: 'guts', kick: 'GUTS (spilled) · bonus' },
    { title: 'scared of my guitar',   era: 'guts', kick: 'GUTS (spilled) · bonus' },
    { title: 'stranger',              era: 'guts', kick: 'GUTS (spilled) · bonus' },
    { title: "can't catch me now",    era: 'guts', kick: 'single · 2023' },
    { title: 'all i want',            era: 'sour', kick: 'single · 2019' },
  ];

  // 🎬 Videoclips oficiales — IDs verificados en el canal OliviaRodrigoVEVO.
  //    offset: segundos a sumar a la posición de la canción si el video tiene
  //    una intro (también se puede ajustar en vivo con los botones de la pantalla).
  //    boost: partículas extra mientras suena.
  const SONG_VIDEOS = {
    'drivers license':    { yt: 'ZmDBbnmKpqQ' },
    'deja vu':            { yt: 'cii6ruuycQA' },
    'good 4 u':           { yt: 'gNi_6U5Pm_o' },
    'traitor':            { yt: 'CRrf3h9vhp8' },
    'brutal':             { yt: 'OGUy2UmRxJ0' },
    'vampire':            { yt: 'RlPNh_PBZb4', boost: { bat: .35, broken: .3 } },
    'bad idea right?':    { yt: 'Dj9qJsJTsjQ' },
    'get him back!':      { yt: 'ZsJ-BHohXRI' },
    'all-american bitch': { yt: 'n2BnbpjpRdo' },   // lyric video oficial
    'obsessed':           { yt: 'QXcjPySjdJU' },
    "can't catch me now": { yt: 'UjvcgfYB6T0' },   // lyric video oficial
    'drop dead':          { yt: '78wrful9cVU' },
    'stupid song':        { yt: 'Rt9tW3cMLhI' },
    'the cure':           { yt: 'B402rKl4bUg' },
  };

  // "Bad Idea Right?" → "badidearight" · sirve para comparar títulos de Spotify
  const norm = (t) => String(t || '').toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '')
    .replace(/\s+-\s+.*$/, '').replace(/\(.*?\)|\[.*?\]/g, '').replace(/[^a-z0-9]/g, '');
  // "Bad Idea Right?" → "bad-idea-right" · nombre del archivo en videos/
  const slug = (t) => String(t || '').toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '')
    .replace(/['’]/g, '').replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');

  const Catalog = (() => {
    const map = new Map();
    for (const era of ERA_ORDER) SONGS[era].forEach((title, i) => map.set(norm(title), { title, era, kick: songKicker(era, i) }));
    for (const x of SONG_EXTRAS) map.set(norm(x.title), { ...x });
    for (const [title, v] of Object.entries(SONG_VIDEOS)) { const e = map.get(norm(title)); if (e) Object.assign(e, v); }
    const eraOfAlbum = (album) =>
      /so in love|pretty sad/i.test(album) ? 'pink' : /guts/i.test(album) ? 'guts' : /sour/i.test(album) ? 'sour' : null;
    return {
      find(title, album) {
        const hit = map.get(norm(title));
        if (hit) return hit;
        return { title: String(title).toLowerCase(), era: eraOfAlbum(album) || Era.current, kick: album || 'olivia rodrigo' };
      },
    };
  })();

  // Frases originales en el espíritu de cada era (no son letras)
  const LINES = {
    any: [
      'teenage heartbreak, deluxe edition', 'purple ink. red lipstick. no regrets.',
      'screaming the bridge alone in the car', 'heart: broken · volume: max',
      'rewind. repeat. rewind.', 'certified bedroom pop-punk', 'permission to be dramatic: granted',
      'sour then. guts now. soft forever.', 'best friends & front row', 'louder at the bridge',
    ],
    sour: ['band-aids on a paper heart', 'sweet like sour candy', 'diary entry · may 2021',
           'butterflies in a glass jar', 'learning to drive & to let go'],
    guts: ['glitter, guts & grudges', 'too loud for the suburbs', 'mascara on the pillowcase',
           'cried in the parking lot, again', 'fangs out, chin up'],
    pink: ['a girl so in love (pretty sad about it)', 'pastel pink, still a little punk',
           'swinging upside down', 'soft focus, sharp feelings', 'honey on the bruises', 'unraveled, beautifully'],
  };

  /* ───────────────────────── Stage ───────────────────────── */
  const Stage = {
    el: $('#stage'),
    scale: 1,
    fit() {
      this.scale = Math.min(innerWidth / 1920, innerHeight / 1080);
      this.el.style.transform = `scale(${this.scale})`;
    },
    rectOf(el) {
      const r = el.getBoundingClientRect(), s = this.el.getBoundingClientRect(), k = this.scale;
      return { x: (r.left - s.left) / k, y: (r.top - s.top) / k, w: r.width / k, h: r.height / k };
    },
  };

  /* ───────────────────────── Pointer ───────────────────────── */
  const Pointer = {
    x: 0, y: 0, tx: 0, ty: 0,      // normalizado −1…1 (suavizado / objetivo)
    cx: 0, cy: 0,                  // igual pero sin deriva automática (para el collage)
    px: -9999, py: -9999,          // píxeles reales
    lastMove: -1e9,
    init() {
      addEventListener('mousemove', (e) => {
        const dist = this.px < -999 ? 0 : Math.hypot(e.clientX - this.px, e.clientY - this.py);
        this.tx = (e.clientX / innerWidth) * 2 - 1;
        this.ty = (e.clientY / innerHeight) * 2 - 1;
        this.px = e.clientX; this.py = e.clientY;
        this.lastMove = performance.now();
        if (CONFIG.trail && Q.trail) Particles.trail(e.clientX, e.clientY, dist);
      }, { passive: true });
      addEventListener('mousedown', (e) => {
        Particles.burst(e.clientX, e.clientY, 16, 1);
        Particles.ring(e.clientX, e.clientY);
      });
    },
    get idle() { return performance.now() - this.lastMove; },
    get moving() { return this.idle < 600; },
    get resting() { const i = this.idle; return i > 900 && i < 25000 && this.px > -999; },
    update(t, dt) {
      let gx = this.tx, gy = this.ty;
      if (this.idle > 7000) { gx = Math.sin(t * 0.13) * 0.4; gy = Math.cos(t * 0.09) * 0.25; }   // deriva suave sin mouse
      const k = 1 - Math.exp(-dt * 3.2);
      this.x += (gx - this.x) * k;
      this.y += (gy - this.y) * k;
      this.cx += (this.tx - this.cx) * k;
      this.cy += (this.ty - this.cy) * k;
    },
  };

  /* ───────────────────────── Clock: el ÚNICO reloj del wallpaper ───────────────────────── */
  // Usa requestAnimationFrame (Wallpaper Engine lo entrega a ritmo constante; los
  // setTimeout los frena muchísimo y el wallpaper quedaba a ~3 fps).
  // En cada llamada decide si toca un cuadro según una agenda fija: así salen
  // exactamente 24 cuadros por segundo aunque el monitor vaya a 60 o 144 Hz.
  // Las llamadas que no tocan no hacen nada → no se dibuja ni se gasta.
  const Clock = {
    fps: 24, weFps: 0, paused: false,
    last: 0, due: 0, t: 0, raf: 0,
    frames: 0, workMs: 0,
    interval() { return 1000 / clamp(Math.min(this.fps, this.weFps || 1e9), 5, 240); },
    start() {
      this.last = this.due = performance.now();
      const loop = (now) => {
        this.raf = requestAnimationFrame(loop);
        if (!this.paused) this.frame(now);
      };
      this.raf = requestAnimationFrame(loop);
    },
    frame(now) {
      const iv = this.interval();
      if (now < this.due - 2) return;                     // todavía no toca
      this.due += iv;
      if (now - this.due > iv * 2) this.due = now + iv;   // si se atrasó mucho, no intenta "recuperar"
      const dt = Math.min((now - this.last) / 1000, 0.1);
      this.last = now;
      this.t += dt;
      const w0 = performance.now();
      tick(dt, this.t);
      this.workMs += performance.now() - w0;
      this.frames++;
    },
    // (se mantiene por compatibilidad: ya no se engancha al video)
    lock() {},
    videoActive() { return false; },
    setPaused(p) {
      this.paused = p;
      if (!p) this.last = this.due = performance.now();
    },
  };

  /* ───────────────────────── Tweens (animaciones puntuales, al ritmo del reloj) ───────────────────────── */
  const Tweens = {
    list: [],
    add(o) {
      const tw = { t: -(o.delay || 0), dur: o.dur, ease: o.ease || Ease.out, step: o.step, done: o.done, dead: false };
      this.list.push(tw);
      return tw;
    },
    kill(tw) { if (tw) tw.dead = true; },
    update(dt) {
      for (let i = this.list.length - 1; i >= 0; i--) {
        const tw = this.list[i];
        if (tw.dead) { this.list.splice(i, 1); continue; }
        tw.t += dt;
        if (tw.t < 0) continue;
        const k = Math.min(1, tw.t / tw.dur);
        tw.step(tw.ease(k), k);
        if (k >= 1) { this.list.splice(i, 1); if (tw.done) tw.done(); }
      }
    },
  };

  /* ───────────────────────── Era ───────────────────────── */
  const Era = {
    current: 'sour',
    timer: 0,
    // fx(apply) decide cuándo se cambian los colores del DOM (en el pico del destello)
    set(id, fx) {
      if (!ERAS[id] || id === this.current) return false;
      const prev = this.current;
      this.current = id;
      this.timer = 0;
      Particles.onEra();
      Renderer.toEra(id);
      const apply = () => { document.body.dataset.era = id; Bigword.show(id, prev); HUD.onEra(id); };
      (fx || ((a) => EraFX.announce(id, a)))(apply);
      return true;
    },
    setMode(mode) {
      CONFIG.eraMode = mode;
      this.timer = 0;
      if (mode !== 'cycle' && !Song.cur) this.set(mode);
    },
    update(dt) {
      if (CONFIG.eraMode !== 'cycle' || Song.cur) return;   // mientras suena Olivia manda su álbum
      this.timer += dt;
      if (this.timer >= CONFIG.eraDuration) {
        this.set(ERA_ORDER[(ERA_ORDER.indexOf(this.current) + 1) % ERA_ORDER.length]);
      }
    },
  };

  // Los "momentos": cambio de era o canción de Olivia detectada en Spotify
  const EraFX = {
    wash: $('#era-wash'), flash: $('#era-flash'), kick: $('#era-flash-kick'),
    title: $('#era-flash-title'), sub: $('#era-flash-sub'), hud: $('#hud-mode'),
    flashTw: null, washTw: null, hudT: 0,
    announce(id, apply, quiet) {
      const f = ERAS[id].flash;
      this.rewind();
      this.show('now entering', f.title, f.sub, !quiet, apply);
    },
    nowPlaying(e, apply) {
      this.rewind();
      this.show('♪ now playing', e.title, e.kick, true, apply);
    },
    rewind() {
      Video.glitch();
      this.hud.textContent = '◀◀ REW';
      this.hudT = 1.8;
    },
    update(dt) {
      if (this.hudT > 0 && (this.hudT -= dt) <= 0) this.hud.textContent = '▶ PLAY';
    },
    // destello de color; en su pico se cambian los colores (así no hace falta transición CSS)
    doWash(peak, strength) {
      const w = this.wash;
      Tweens.kill(this.washTw);
      w.style.display = 'block';
      let fired = false;
      const fire = () => { if (!fired) { fired = true; if (peak) peak(); } };
      this.washTw = Tweens.add({
        dur: 1.8, ease: Ease.lin,
        step: (e) => {
          const a = e < 0.14 ? e / 0.14 : 1 - (e - 0.14) / 0.86;
          put(w, 'opacity', (strength * a).toFixed(3));
          if (e >= 0.14) fire();
        },
        done: () => { fire(); put(w, 'opacity', '0'); w.style.display = 'none'; },
      });
    },
    show(kick, title, sub, big, apply) {
      if (!CONFIG.eraAnnounce) { this.doWash(apply, 0.25); return; }
      this.kick.textContent = kick;
      this.sub.textContent = sub;
      let i = 0;
      const letters = [];
      const words = title.split(/\s+/).filter(Boolean);
      const len = title.replace(/\s/g, '').length + words.length * 0.5;
      this.title.style.setProperty('--fs', `${clamp(60 / len, 2.6, 7.6).toFixed(2)}vw`);
      this.title.replaceChildren(...words.map((w) => {
        const word = document.createElement('span');
        word.className = 'word';
        for (const ch of w) {
          const s = document.createElement('span');
          s.className = `r r${(i % 6) + 1}`;
          s.textContent = ch;
          s.style.opacity = '0';
          letters.push({ s, i: i++ });
          word.append(s);
        }
        return word;
      }));
      const fl = this.flash;
      fl.classList.add('is-on');
      Tweens.kill(this.flashTw);
      this.flashTw = Tweens.add({
        dur: 3.6, ease: Ease.lin,
        step: (k) => {
          let op = 1, sc = 0.98, rot = -2, y = 0;
          if (k < 0.12) { const p = Ease.out(k / 0.12); op = p; sc = 1.2 - 0.2 * p; rot = -5 + 3 * p; }
          else if (k < 0.8) { sc = 1 - 0.02 * (k - 0.12) / 0.68; }
          else { const p = (k - 0.8) / 0.2; op = 1 - p; sc = 0.98 - 0.04 * p; y = p * 2; }
          put(fl, 'opacity', op.toFixed(3));
          put(fl, 'transform', `translate(-50%, ${(-50 + y).toFixed(2)}%) scale(${sc.toFixed(3)}) rotate(${rot.toFixed(2)}deg)`);
        },
        done: () => { fl.classList.remove('is-on'); this.title.replaceChildren(); },
      });
      for (const L of letters) {
        Tweens.add({
          delay: L.i * 0.07 + 0.12, dur: 0.55, ease: Ease.back,
          step: (e) => {
            L.s.style.opacity = Math.min(1, e * 1.5).toFixed(3);
            L.s.style.scale = (0.2 + 0.8 * e).toFixed(3);
            L.s.style.translate = `0 ${((1 - e) * 2).toFixed(2)}vw`;
          },
        });
      }
      if (big) {
        this.doWash(apply, 0.5);
        Particles.burst(innerWidth / 2, innerHeight / 2, 46, 1.8);
      } else if (apply) apply();
    },
  };

  // Palabra gigante del álbum (se funde entre eras)
  const Bigword = {
    words: {},
    init() {
      for (const el of $$('.bigword__w')) this.words[el.dataset.for] = el;
      const w = this.words[Era.current]; w.style.display = 'block'; w.style.opacity = '1';
    },
    show(id, prev) {
      const a = this.words[prev], b = this.words[id];
      b.style.display = 'block';
      Tweens.add({
        dur: 2.5, ease: Ease.inOut,
        step: (e) => { if (a) put(a, 'opacity', (1 - e).toFixed(3)); put(b, 'opacity', e.toFixed(3)); },
        done: () => { if (a && a !== b) a.style.display = 'none'; },
      });
    },
  };

  /* ───────────────────────── Sprites (se dibujan una vez → atlas) ───────────────────────── */
  const TYPES = ['butterfly', 'bandaid', 'star', 'sparkle', 'broken', 'heart', 'bat'];
  const Sprites = (() => {
    const S = 128, cache = {};
    let sharedStar = null, streak = null;
    const canBlur = 'filter' in CanvasRenderingContext2D.prototype;

    const make = (draw) => {
      const c = document.createElement('canvas');
      c.width = c.height = S;
      const g = c.getContext('2d');
      g.translate(S / 2, S / 2);
      draw(g);
      return c;
    };
    // versión desenfocada para partículas muy cercanas (profundidad de campo)
    const blurOf = (src) => make((g) => { if (canBlur) g.filter = 'blur(3px)'; g.drawImage(src, -56, -56, 112, 112); });
    const dot = (g, x, y, r) => { g.beginPath(); g.arc(x, y, r, 0, TAU); g.fill(); };
    const roundRect = (g, x, y, w, h, r) => {
      g.beginPath();
      g.moveTo(x + r, y); g.arcTo(x + w, y, x + w, y + h, r); g.arcTo(x + w, y + h, x, y + h, r);
      g.arcTo(x, y + h, x, y, r); g.arcTo(x, y, x + w, y, r); g.closePath();
    };
    const heartPath = (g) => {
      g.beginPath();
      g.moveTo(0, -24);
      g.bezierCurveTo(-10, -50, -56, -46, -54, -14);
      g.bezierCurveTo(-52, 12, -20, 30, 0, 50);
      g.bezierCurveTo(20, 30, 52, 12, 54, -14);
      g.bezierCurveTo(56, -46, 10, -50, 0, -24);
      g.closePath();
    };
    const heartFill = (g, [light, mid, dark]) => {
      const gr = g.createRadialGradient(-20, -22, 4, 0, 0, 64);
      gr.addColorStop(0, light); gr.addColorStop(.45, mid); gr.addColorStop(1, dark);
      return gr;
    };
    function hexA(h, a) { const n = parseInt(h.slice(1), 16); return `rgba(${n >> 16},${(n >> 8) & 255},${n & 255},${a})`; }
    function shade(h, k) {
      const n = parseInt(h.slice(1), 16);
      const f = (v) => clamp(Math.round(v * (1 + k)), 0, 255);
      return `rgb(${f(n >> 16)},${f((n >> 8) & 255)},${f(n & 255)})`;
    }

    function butterfly(g, [light, mid, dark]) {
      for (const side of [-1, 1]) {
        g.save(); g.scale(side, 1);
        let gr = g.createRadialGradient(10, -10, 2, 24, -22, 56);
        gr.addColorStop(0, light); gr.addColorStop(.45, mid); gr.addColorStop(1, dark);
        g.fillStyle = gr; g.strokeStyle = dark; g.lineWidth = 2.5;
        g.beginPath(); g.moveTo(2, -6); g.bezierCurveTo(10, -52, 62, -60, 58, -24); g.bezierCurveTo(56, -4, 26, 4, 2, 2);
        g.closePath(); g.fill(); g.stroke();
        gr = g.createRadialGradient(8, 10, 2, 20, 22, 44);
        gr.addColorStop(0, light); gr.addColorStop(.5, mid); gr.addColorStop(1, dark);
        g.fillStyle = gr;
        g.beginPath(); g.moveTo(2, 4); g.bezierCurveTo(30, 2, 52, 24, 38, 44); g.bezierCurveTo(28, 58, 8, 44, 2, 12);
        g.closePath(); g.fill(); g.stroke();
        g.strokeStyle = 'rgba(255,255,255,.38)'; g.lineWidth = 1.2;
        g.beginPath();
        g.moveTo(4, -3); g.quadraticCurveTo(24, -24, 48, -36);
        g.moveTo(4, -1); g.quadraticCurveTo(28, -10, 52, -16);
        g.moveTo(4, 6);  g.quadraticCurveTo(20, 16, 32, 38);
        g.stroke();
        g.fillStyle = 'rgba(255,255,255,.92)';
        dot(g, 50, -30, 3.4); dot(g, 41, -41, 2.2); dot(g, 31, 40, 2.6);
        g.restore();
      }
      g.fillStyle = dark; g.strokeStyle = dark; g.lineWidth = 2; g.lineCap = 'round';
      g.beginPath(); g.ellipse(0, 4, 3.8, 21, 0, 0, TAU); g.fill();
      dot(g, 0, -18, 4.8);
      g.beginPath();
      g.moveTo(-1, -21); g.quadraticCurveTo(-6, -38, -15, -47);
      g.moveTo(1, -21);  g.quadraticCurveTo(6, -38, 15, -47);
      g.stroke();
      dot(g, -15, -47, 2.6); dot(g, 15, -47, 2.6);
    }
    function bandaid(g, [base, pad, accent]) {
      g.rotate(-0.35);
      const gr = g.createLinearGradient(0, -20, 0, 20);
      gr.addColorStop(0, base); gr.addColorStop(1, shade(base, -0.12));
      roundRect(g, -58, -20, 116, 40, 20);
      g.fillStyle = gr; g.fill();
      g.strokeStyle = 'rgba(0,0,0,.18)'; g.lineWidth = 1.5; g.stroke();
      g.fillStyle = 'rgba(0,0,0,.16)';
      for (const x of [-48, -40, -32, 32, 40, 48]) for (const y of [-8, 0, 8]) dot(g, x, y, 1.5);
      roundRect(g, -20, -15, 40, 30, 5);
      g.fillStyle = pad; g.fill();
      g.fillStyle = accent;
      g.save(); g.scale(.17, .17); heartPath(g); g.fill(); g.restore();
    }
    function star(g) {
      const gr = g.createLinearGradient(-44, -50, 44, 50);
      gr.addColorStop(0, '#ffffff'); gr.addColorStop(.32, '#d9dce6'); gr.addColorStop(.55, '#8d91a3');
      gr.addColorStop(.78, '#f5f6fa'); gr.addColorStop(1, '#9ea3b5');
      g.beginPath();
      for (let i = 0; i < 10; i++) { const r = i % 2 ? 23 : 56, a = -Math.PI / 2 + (i * Math.PI) / 5; g.lineTo(Math.cos(a) * r, Math.sin(a) * r); }
      g.closePath();
      g.fillStyle = gr; g.fill();
      g.strokeStyle = 'rgba(255,255,255,.85)'; g.lineWidth = 2; g.lineJoin = 'round'; g.stroke();
      g.fillStyle = 'rgba(255,255,255,.75)';
      g.beginPath(); g.ellipse(-10, -16, 5, 10, -0.5, 0, TAU); g.fill();
    }
    function sparkle(g, color) {
      const glow = g.createRadialGradient(0, 0, 0, 0, 0, 44);
      glow.addColorStop(0, hexA(color, .55)); glow.addColorStop(1, hexA(color, 0));
      g.fillStyle = glow; dot(g, 0, 0, 44);
      g.beginPath();
      g.moveTo(0, -58); g.quadraticCurveTo(6, -6, 58, 0); g.quadraticCurveTo(6, 6, 0, 58);
      g.quadraticCurveTo(-6, 6, -58, 0); g.quadraticCurveTo(-6, -6, 0, -58);
      g.fillStyle = '#ffffff'; g.fill();
    }
    function bokeh(g, color) {
      const gr = g.createRadialGradient(0, 0, 0, 0, 0, 60);
      gr.addColorStop(0, hexA(color, .55)); gr.addColorStop(.7, hexA(color, .4));
      gr.addColorStop(.86, hexA(color, .55)); gr.addColorStop(1, hexA(color, 0));
      g.fillStyle = gr; dot(g, 0, 0, 60);
    }
    function ring(g, color) {
      g.strokeStyle = color; g.lineWidth = 3.5;
      g.beginPath(); g.arc(0, 0, 58, 0, TAU); g.stroke();
    }
    function brokenHeart(g, pal) {
      const crack = [[0, -24], [-8, -10], [6, 2], [-6, 16], [5, 30], [0, 50]];
      const half = (sideX, dx, dy, rot) => {
        g.save();
        g.translate(dx, dy); g.rotate(rot);
        g.beginPath(); g.moveTo(sideX, -70); g.lineTo(0, -70);
        for (const [x, y] of crack) g.lineTo(x, y);
        g.lineTo(0, 70); g.lineTo(sideX, 70); g.closePath();
        g.clip();
        heartPath(g);
        g.fillStyle = heartFill(g, pal); g.fill();
        g.strokeStyle = pal[2]; g.lineWidth = 3; g.stroke();
        g.beginPath(); for (const [x, y] of crack) g.lineTo(x, y); g.stroke();
        g.restore();
      };
      g.scale(.94, .94);
      half(-70, -6, 2, -0.14);
      half(70, 6, 5, 0.16);
      g.fillStyle = 'rgba(255,255,255,.55)';
      g.beginPath(); g.ellipse(-30, -24, 8, 13, -0.6, 0, TAU); g.fill();
    }
    function heart(g, pal) {
      g.scale(.94, .94);
      heartPath(g);
      g.fillStyle = heartFill(g, pal); g.fill();
      g.strokeStyle = 'rgba(255,255,255,.7)'; g.lineWidth = 3; g.stroke();
      g.fillStyle = 'rgba(255,255,255,.7)';
      g.beginPath(); g.ellipse(-26, -22, 8, 13, -0.6, 0, TAU); g.fill();
    }
    function bat(g, rim) {
      g.beginPath();
      g.moveTo(0, -8);
      g.quadraticCurveTo(22, -32, 58, -18); g.quadraticCurveTo(50, -6, 52, 10);
      g.quadraticCurveTo(40, 0, 34, 14);    g.quadraticCurveTo(26, 2, 16, 16);
      g.quadraticCurveTo(8, 6, 0, 18);
      g.quadraticCurveTo(-8, 6, -16, 16);   g.quadraticCurveTo(-26, 2, -34, 14);
      g.quadraticCurveTo(-40, 0, -52, 10);  g.quadraticCurveTo(-50, -6, -58, -18);
      g.quadraticCurveTo(-22, -32, 0, -8);
      g.closePath();
      g.fillStyle = '#1a0a1f'; g.fill();
      g.strokeStyle = hexA(rim, .75); g.lineWidth = 2.2; g.stroke();
      g.beginPath(); g.ellipse(0, 2, 8, 14, 0, 0, TAU); g.fill();
      g.beginPath(); g.moveTo(-7, -9); g.lineTo(-5, -22); g.lineTo(-1, -11); g.moveTo(7, -9); g.lineTo(5, -22); g.lineTo(1, -11); g.fill();
      g.fillStyle = '#ff2e4d'; dot(g, -3, -4, 1.6); dot(g, 3, -4, 1.6);
    }
    // estela de estrella fugaz: línea blanca que se desvanece hacia la cola (cabeza a la derecha)
    function makeStreak() {
      return make((g) => {
        const h = g.createLinearGradient(-64, 0, 64, 0);
        h.addColorStop(0, 'rgba(255,255,255,0)'); h.addColorStop(.85, 'rgba(255,255,255,.85)'); h.addColorStop(1, '#fff');
        g.fillStyle = h; g.fillRect(-64, -20, 128, 40);
        g.globalCompositeOperation = 'destination-in';
        const v = g.createLinearGradient(0, -20, 0, 20);
        v.addColorStop(0, 'rgba(0,0,0,0)'); v.addColorStop(.5, '#000'); v.addColorStop(1, 'rgba(0,0,0,0)');
        g.fillStyle = v; g.fillRect(-64, -20, 128, 40);
      });
    }

    function build(id) {
      const p = ERAS[id].pal;
      sharedStar = sharedStar || make(star);
      const set = {
        butterfly: make((g) => butterfly(g, p.butterfly)),
        bandaid:   make((g) => bandaid(g, p.bandaid)),
        star:      sharedStar,
        sparkle:   make((g) => sparkle(g, p.sparkle)),
        broken:    make((g) => brokenHeart(g, p.broken)),
        heart:     make((g) => heart(g, p.heart)),
        bat:       make((g) => bat(g, p.bat)),
      };
      set.blur = {};
      for (const k of TYPES) set.blur[k] = blurOf(set[k]);
      set.bokeh = make((g) => bokeh(g, p.bokeh));
      set.ring = make((g) => ring(g, p.sparkle));
      return set;
    }

    const api = {
      SIZE: S, BLUR_SCALE: 128 / 112,
      get: (id) => cache[id] || (cache[id] = build(id)),
      get streak() { return streak || (streak = makeStreak()); },
      uv: new Map(),
      // Atlas 1024×1024 (8×8 celdas de 128 px) para WebGL, con mipmaps → nítido a cualquier tamaño
      atlas() {
        const list = new Set();
        for (const id of ERA_ORDER) {
          const s = api.get(id);
          for (const k of TYPES) { list.add(s[k]); list.add(s.blur[k]); }
          list.add(s.bokeh); list.add(s.ring);
        }
        list.add(api.streak);
        const c = document.createElement('canvas');
        c.width = c.height = 1024;
        const g = c.getContext('2d');
        let i = 0;
        for (const img of list) {
          const x = (i % 8) * S, y = ((i / 8) | 0) * S;
          g.drawImage(img, x, y);
          const h = 0.5 / 1024;
          api.uv.set(img, [x / 1024 + h, y / 1024 + h, (x + S) / 1024 - h, (y + S) / 1024 - h]);
          i++;
        }
        return c;
      },
    };
    return api;
  })();

  /* ───────────────────────── Renderer: WebGL (o Canvas 2D si no hay WebGL) ───────────────────────── */
  const VS_SPRITE = `
    attribute vec2 p; attribute vec2 uv; attribute float a;
    uniform vec2 res;
    varying vec2 vUv; varying float vA;
    void main() { vec2 q = p / res * 2.0 - 1.0; gl_Position = vec4(q.x, -q.y, 0.0, 1.0); vUv = uv; vA = a; }`;
  const FS_SPRITE = `
    precision mediump float;
    uniform sampler2D tex; varying vec2 vUv; varying float vA;
    void main() { gl_FragColor = texture2D(tex, vUv) * vA; }`;
  const VS_QUAD = `
    attribute vec2 p; varying vec2 vUv;
    void main() { vUv = p * 0.5 + 0.5; gl_Position = vec4(p, 0.0, 1.0); }`;
  const PREC = `
    #ifdef GL_FRAGMENT_PRECISION_HIGH
    precision highp float;
    #else
    precision mediump float;
    #endif`;
  // Fondo: degradado de la era + 3 manchas fijas + 3 manchas que flotan + trama de puntos + halo del mouse
  const FS_BG = PREC + `
    varying vec2 vUv;
    uniform vec2 res;
    uniform vec3 base0, base1;
    uniform vec4 spot[3]; uniform vec3 spotCol[3];
    uniform vec4 blob[3]; uniform vec3 blobCol[3];
    uniform vec3 glow; uniform vec3 glowA, glowB;
    vec3 layerSpot(vec3 col, vec2 uv, vec4 s, vec3 c) { return mix(col, c, clamp(1.0 - length((uv - s.xy) / s.zw), 0.0, 1.0)); }
    vec3 layerBlob(vec3 col, vec2 px, vec4 b, vec3 c) { return mix(col, c, clamp(1.0 - length(px - b.xy) / b.z, 0.0, 1.0) * b.w); }
    void main() {
      vec2 uv = vec2(vUv.x, 1.0 - vUv.y);
      vec2 px = uv * res;
      vec2 dir = vec2(0.342, 0.940);
      float L = abs(res.x * dir.x) + abs(res.y * dir.y);
      vec3 col = mix(base0, base1, clamp(dot(px - res * 0.5, dir) / L + 0.5, 0.0, 1.0));
      col = layerSpot(col, uv, spot[2], spotCol[2]);
      col = layerSpot(col, uv, spot[1], spotCol[1]);
      col = layerSpot(col, uv, spot[0], spotCol[0]);
      col = layerBlob(col, px, blob[0], blobCol[0]);
      col = layerBlob(col, px, blob[1], blobCol[1]);
      col = layerBlob(col, px, blob[2], blobCol[2]);
      vec2 d2 = vec2(0.883, 0.469);
      float L2 = abs(res.x * d2.x) + abs(res.y * d2.y);
      float g = dot(px - res * 0.5, d2) / L2 + 0.5;
      float band = g < 0.52 ? clamp((g - 0.18) / 0.34, 0.0, 1.0) : clamp((0.88 - g) / 0.36, 0.0, 1.0);
      float dt = 1.0 - smoothstep(1.0, 1.6, length(mod(px, 7.0) - 3.5));
      col = mix(col, vec3(1.0), 0.075 * dt * band);
      if (glow.z > 0.001) {
        float r = length(px - glow.xy) / 300.0;
        float ga = r < 0.55 ? mix(0.46, 0.2, r / 0.55) : mix(0.2, 0.0, clamp((r - 0.55) / 0.45, 0.0, 1.0));
        col = mix(col, mix(glowA, glowB, clamp(r / 0.55, 0.0, 1.0)), ga * glow.z);
      }
      gl_FragColor = vec4(col, 1.0);
    }`;
  // Encima de todo: viñeta + grano de película (cambia en cada cuadro, como el cine a 24 fps)
  const FS_OVER = PREC + `
    varying vec2 vUv;
    uniform float seed, grain, vig;
    float hash(vec2 p) { return fract(sin(dot(p, vec2(12.9898, 78.233)) + seed) * 43758.5453); }
    void main() {
      vec2 uv = vec2(vUv.x, 1.0 - vUv.y);
      float d = length((uv - vec2(0.5, 0.48)) / vec2(0.78, 0.72));
      float va = vig * 0.62 * clamp((d - 0.55) / 0.45, 0.0, 1.0);
      vec3 c = vec3(0.0196, 0.0, 0.039) * va;
      float ga = grain * 0.085 * clamp(1.4 * hash(floor(gl_FragCoord.xy)) - 0.2, 0.0, 1.0);
      gl_FragColor = vec4(c * (1.0 - ga) + vec3(ga), va + ga * (1.0 - va));
    }`;

  function createGLLayer(canvas, kind, atlas) {
    const opaque = kind === 'back';
    const gl = canvas.getContext('webgl', {
      alpha: !opaque, premultipliedAlpha: true, antialias: false, depth: false, stencil: false,
      preserveDrawingBuffer: false, powerPreference: 'low-power',
    });
    if (!gl) return null;
    const compile = (type, src) => {
      const sh = gl.createShader(type);
      gl.shaderSource(sh, src); gl.compileShader(sh);
      if (!gl.getShaderParameter(sh, gl.COMPILE_STATUS)) throw new Error(gl.getShaderInfoLog(sh));
      return sh;
    };
    const program = (vs, fs) => {
      const p = gl.createProgram();
      gl.attachShader(p, compile(gl.VERTEX_SHADER, vs)); gl.attachShader(p, compile(gl.FRAGMENT_SHADER, fs));
      gl.linkProgram(p);
      if (!gl.getProgramParameter(p, gl.LINK_STATUS)) throw new Error(gl.getProgramInfoLog(p));
      return p;
    };
    const sp = program(VS_SPRITE, FS_SPRITE);
    const qp = program(VS_QUAD, opaque ? FS_BG : FS_OVER);
    const loc = (p, n) => gl.getUniformLocation(p, n);
    const S = { res: loc(sp, 'res'), tex: loc(sp, 'tex'), p: gl.getAttribLocation(sp, 'p'), uv: gl.getAttribLocation(sp, 'uv'), a: gl.getAttribLocation(sp, 'a') };
    const QU = {};
    for (const n of ['res', 'base0', 'base1', 'spot', 'spotCol', 'blob', 'blobCol', 'glow', 'glowA', 'glowB', 'seed', 'grain', 'vig']) QU[n] = loc(qp, n);
    const qa = gl.getAttribLocation(qp, 'p');

    const quad = gl.createBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER, quad);
    gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, 1, -1, -1, 1, -1, 1, 1, -1, 1, 1]), gl.STATIC_DRAW);

    const MAX = 1000, FLOATS = 5;                 // x, y, u, v, alpha
    const data = new Float32Array(MAX * 6 * FLOATS);
    const vbuf = gl.createBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER, vbuf);
    gl.bufferData(gl.ARRAY_BUFFER, data.byteLength, gl.DYNAMIC_DRAW);

    const tex = gl.createTexture();
    gl.bindTexture(gl.TEXTURE_2D, tex);
    gl.pixelStorei(gl.UNPACK_PREMULTIPLY_ALPHA_WEBGL, true);
    gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, atlas);
    gl.generateMipmap(gl.TEXTURE_2D);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR_MIPMAP_LINEAR);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);

    canvas.addEventListener('webglcontextlost', (e) => e.preventDefault());
    canvas.addEventListener('webglcontextrestored', () => location.reload());

    let n = 0, w = 1, h = 1;
    return {
      resize(cw, ch, scale) {
        w = cw; h = ch;
        canvas.width = Math.max(1, Math.round(cw * scale));
        canvas.height = Math.max(1, Math.round(ch * scale));
      },
      begin() { n = 0; },
      sprite(img, x, y, sw, shh, rot, sx, a) {
        if (n >= MAX || a <= 0.004) return;
        const uv = Sprites.uv.get(img);
        if (!uv) return;
        const c = Math.cos(rot), s = Math.sin(rot);
        const hw = sw * 0.5 * sx, hh = shh * 0.5;
        const x0 = x - hw * c + hh * s, y0 = y - hw * s - hh * c;
        const x1 = x + hw * c + hh * s, y1 = y + hw * s - hh * c;
        const x2 = x + hw * c - hh * s, y2 = y + hw * s + hh * c;
        const x3 = x - hw * c - hh * s, y3 = y - hw * s + hh * c;
        const [u0, v0, u1, v1] = uv;
        let o = n * 30;
        data[o++] = x0; data[o++] = y0; data[o++] = u0; data[o++] = v0; data[o++] = a;
        data[o++] = x1; data[o++] = y1; data[o++] = u1; data[o++] = v0; data[o++] = a;
        data[o++] = x2; data[o++] = y2; data[o++] = u1; data[o++] = v1; data[o++] = a;
        data[o++] = x0; data[o++] = y0; data[o++] = u0; data[o++] = v0; data[o++] = a;
        data[o++] = x2; data[o++] = y2; data[o++] = u1; data[o++] = v1; data[o++] = a;
        data[o++] = x3; data[o++] = y3; data[o++] = u0; data[o++] = v1; data[o] = a;
        n++;
      },
      end(U) {
        gl.viewport(0, 0, canvas.width, canvas.height);
        if (opaque) {
          // 1) fondo (opaco, sin mezcla)
          gl.disable(gl.BLEND);
          gl.useProgram(qp);
          gl.uniform2f(QU.res, w, h);
          gl.uniform3fv(QU.base0, U.base0); gl.uniform3fv(QU.base1, U.base1);
          gl.uniform4fv(QU.spot, U.spot); gl.uniform3fv(QU.spotCol, U.spotCol);
          gl.uniform4fv(QU.blob, U.blob); gl.uniform3fv(QU.blobCol, U.blobCol);
          gl.uniform3fv(QU.glow, U.glow); gl.uniform3fv(QU.glowA, U.glowA); gl.uniform3fv(QU.glowB, U.glowB);
          gl.bindBuffer(gl.ARRAY_BUFFER, quad);
          gl.enableVertexAttribArray(qa);
          gl.vertexAttribPointer(qa, 2, gl.FLOAT, false, 0, 0);
          gl.drawArrays(gl.TRIANGLES, 0, 6);
          gl.disableVertexAttribArray(qa);
        } else {
          gl.clearColor(0, 0, 0, 0);
          gl.clear(gl.COLOR_BUFFER_BIT);
        }
        // 2) sprites (alfa premultiplicado)
        gl.enable(gl.BLEND);
        gl.blendFunc(gl.ONE, gl.ONE_MINUS_SRC_ALPHA);
        if (n) {
          gl.useProgram(sp);
          gl.uniform2f(S.res, w, h);
          gl.uniform1i(S.tex, 0);
          gl.activeTexture(gl.TEXTURE0);
          gl.bindTexture(gl.TEXTURE_2D, tex);
          gl.bindBuffer(gl.ARRAY_BUFFER, vbuf);
          gl.bufferSubData(gl.ARRAY_BUFFER, 0, data.subarray(0, n * 30));
          const st = FLOATS * 4;
          gl.enableVertexAttribArray(S.p); gl.vertexAttribPointer(S.p, 2, gl.FLOAT, false, st, 0);
          gl.enableVertexAttribArray(S.uv); gl.vertexAttribPointer(S.uv, 2, gl.FLOAT, false, st, 8);
          gl.enableVertexAttribArray(S.a); gl.vertexAttribPointer(S.a, 1, gl.FLOAT, false, st, 16);
          gl.drawArrays(gl.TRIANGLES, 0, n * 6);
          gl.disableVertexAttribArray(S.p); gl.disableVertexAttribArray(S.uv); gl.disableVertexAttribArray(S.a);
        }
        // 3) viñeta + grano (solo canvas frontal)
        if (!opaque && (U.vig > 0 || U.grain > 0)) {
          gl.useProgram(qp);
          gl.uniform1f(QU.seed, U.seed); gl.uniform1f(QU.grain, U.grain); gl.uniform1f(QU.vig, U.vig);
          gl.bindBuffer(gl.ARRAY_BUFFER, quad);
          gl.enableVertexAttribArray(qa);
          gl.vertexAttribPointer(qa, 2, gl.FLOAT, false, 0, 0);
          gl.drawArrays(gl.TRIANGLES, 0, 6);
          gl.disableVertexAttribArray(qa);
        }
      },
    };
  }

  function create2DLayer(canvas) {
    const ctx = canvas.getContext('2d');
    let k = 1;
    return {
      resize(cw, ch, scale) {
        canvas.width = Math.max(1, Math.round(cw * scale));
        canvas.height = Math.max(1, Math.round(ch * scale));
        k = canvas.width / cw;
      },
      begin() { ctx.setTransform(1, 0, 0, 1, 0, 0); ctx.clearRect(0, 0, canvas.width, canvas.height); },
      sprite(img, x, y, sw, shh, rot, sx, a) {
        if (a <= 0.004) return;
        const c = Math.cos(rot), s = Math.sin(rot);
        const kx = (sw / 128) * k * sx, ky = (shh / 128) * k;
        ctx.globalAlpha = Math.min(1, a);
        ctx.setTransform(c * kx, s * kx, -s * ky, c * ky, x * k, y * k);
        ctx.drawImage(img, -64, -64);
      },
      end() { ctx.globalAlpha = 1; },
    };
  }

  const Renderer = {
    gl: false, B: null, F: null,
    vec: null, from: null, to: null, mixK: 1,
    U: null,
    init() {
      const atlas = Sprites.atlas();
      try {
        this.B = createGLLayer($('#fx-back'), 'back', atlas);
        this.F = this.B && createGLLayer($('#fx-front'), 'front', atlas);
        this.gl = !!(this.B && this.F);
      } catch (err) {
        console.warn('WebGL no disponible, uso Canvas 2D:', err);
        this.gl = false;
      }
      if (!this.gl) {
        document.body.classList.add('no-gl');
        // un canvas que ya pidió WebGL no puede dar 2D: se reemplaza
        for (const id of ['fx-back', 'fx-front']) { const old = $('#' + id), c = old.cloneNode(false); old.replaceWith(c); }
        this.B = create2DLayer($('#fx-back'));
        this.F = create2DLayer($('#fx-front'));
      }
      this.vec = this.eraVec(Era.current);
      this.from = this.vec.slice(); this.to = this.vec.slice();
      this.U = {
        base0: new Float32Array(3), base1: new Float32Array(3),
        spot: new Float32Array(12), spotCol: new Float32Array(9),
        blob: new Float32Array(12), blobCol: new Float32Array(9),
        glow: new Float32Array(3), glowA: new Float32Array(3), glowB: new Float32Array(3),
        seed: 0, grain: 0, vig: 1,
      };
      this.resize();
    },
    resize() {
      const w = innerWidth, h = innerHeight, d = Math.min(devicePixelRatio || 1, Q.dpr);
      this.w = w; this.h = h;
      this.B.resize(w, h, d * Q.back);
      this.F.resize(w, h, d * Q.front);
    },
    // paleta del fondo como un vector de números → se puede mezclar suavemente entre eras
    eraVec(id) {
      const b = ERAS[id].bg, v = [...hex(b.base[0]), ...hex(b.base[1])];
      for (const s of b.spots) v.push(s[0], s[1], s[2], s[3], ...hex(s[4]));
      v.push(...hex(b.main), ...hex(b.hot), ...hex(b.accent));
      return v;
    },
    toEra(id) { this.from = this.vec.slice(); this.to = this.eraVec(id); this.mixK = 0; },
    sprite(front, img, x, y, w, h, rot, sx, a) { (front ? this.F : this.B).sprite(img, x, y, w, h, rot, sx, a); },
    frame(t, dt) {
      if (this.mixK < 1) {
        this.mixK = Math.min(1, this.mixK + dt / 2.5);
        const e = Ease.inOut(this.mixK);
        for (let i = 0; i < this.vec.length; i++) this.vec[i] = this.from[i] + (this.to[i] - this.from[i]) * e;
      }
      this.B.begin(); this.F.begin();
      Particles.draw(t);
      if (this.gl) this.fillUniforms(t);
      this.B.end(this.U); this.F.end(this.U);
    },
    fillUniforms(t) {
      const v = this.vec, U = this.U, W = this.w, H = this.h, vmax = Math.max(W, H);
      U.base0.set(v.slice(0, 3)); U.base1.set(v.slice(3, 6));
      for (let i = 0; i < 3; i++) { const o = 6 + i * 7; U.spot.set(v.slice(o, o + 4), i * 4); U.spotCol.set(v.slice(o + 4, o + 7), i * 3); }
      const main = v.slice(27, 30), hot = v.slice(30, 33), acc = v.slice(33, 36);
      // manchas que flotan (equivalente a las 3 animaciones CSS de antes, pero calculado aquí)
      const R = 0.316 * vmax;
      const blob = (i, p, cx, cy, A, B, s1, s2, op, col) => {
        const k = p < 0.5 ? p * 2 : (p - 0.5) * 2;
        const ax = p < 0.5 ? 0 : A[0], ay = p < 0.5 ? 0 : A[1], bx = p < 0.5 ? A[0] : B[0], by = p < 0.5 ? A[1] : B[1];
        const sa = p < 0.5 ? 1 : s1, sb = p < 0.5 ? s1 : s2;
        U.blob[i * 4] = cx + (ax + (bx - ax) * k) * W;
        U.blob[i * 4 + 1] = cy + (ay + (by - ay) * k) * H;
        U.blob[i * 4 + 2] = R * (sa + (sb - sa) * k);
        U.blob[i * 4 + 3] = op;
        U.blobCol.set(col, i * 3);
      };
      blob(0, wave(t, 76), 0.14 * vmax, 0.08 * vmax, [0.18, 0.12], [0.06, 0.30], 1.15, 0.92, 0.55, main);
      blob(1, wave(t, 92), W - 0.10 * vmax, 0.42 * vmax, [-0.22, 0.18], [-0.08, -0.10], 0.9, 1.12, 0.38, hot);
      blob(2, wave(t, 108), 0.54 * vmax, H + 0.04 * vmax, [-0.14, -0.20], [0.20, -0.06], 1.2, 1.0, 0.32, acc);
      U.glow[0] = Glow.x; U.glow[1] = Glow.y; U.glow[2] = Glow.op;
      U.glowA.set(acc); U.glowB.set(main);
      U.seed = (t * 24) % 97;
      U.grain = CONFIG.grain && Q.grain ? 1 : 0;
      U.vig = 1;
    },
  };

  /* ───────────────────────── Particles ───────────────────────── */
  const Particles = {
    list: [], bursts: [], bokeh: [], meteors: [], rings: [],
    meteorTimer: 4, trailAcc: 0,
    SIZE: { butterfly: 54, bandaid: 56, star: 32, sparkle: 28, broken: 40, heart: 36, bat: 46 },
    SPIN: { bandaid: 0.5, star: 0.35, broken: 0.25, heart: 0.2, sparkle: 0.6 },
    get w() { return innerWidth; },
    get h() { return innerHeight; },

    setCount(n) {
      n = clamp(n | 0, 0, 400);
      while (this.list.length > n) this.list.pop();
      while (this.list.length < n) { const p = {}; this.spawn(p, true); this.list.push(p); }
    },
    setBokeh(n) {
      while (this.bokeh.length > n) this.bokeh.pop();
      while (this.bokeh.length < n) { const b = {}; this.spawnBokeh(b, true); this.bokeh.push(b); }
    },
    spawn(p, initial) {
      const boost = Song.cur && Song.cur.boost;
      const type = weighted(boost ? { ...ERAS[Era.current].weights, ...boost } : ERAS[Era.current].weights);
      const set = Sprites.get(Era.current);
      p.type = type;
      p.front = Math.random() < 0.16;
      p.z = p.front ? rand(0.95, 1.4) : rand(0.3, 0.9);
      p.blur = p.front && p.z > 1.12;                     // muy cerca de la cámara → desenfocada
      p.sprite = p.blur ? set.blur[type] : set[type];
      p.size = this.SIZE[type] * p.z * rand(0.8, 1.2) * (p.blur ? Sprites.BLUR_SCALE : 1);
      p.x = rand(-40, this.w + 40);
      p.y = rand(-40, this.h + 40);
      p.vx = rand(-8, 8) * p.z;
      p.vy = -rand(6, 18) * p.z;
      p.rot = type === 'butterfly' || type === 'bat' ? 0 : rand(-Math.PI, Math.PI);
      p.vr = rand(-1, 1) * (this.SPIN[type] || 0);
      p.phase = rand(0, TAU);
      p.flap = type === 'bat' ? rand(10, 13) : rand(6, 10);
      p.orbit = rand(45, 120);
      p.maxLife = rand(14, 30);
      p.life = initial ? rand(0, p.maxLife * 0.8) : 0;
      p.alpha = p.front ? rand(0.55, 0.8) : 0.35 + 0.6 * p.z;
      p.twinkle = type === 'star' || type === 'sparkle';
    },
    spawnBokeh(b, initial) {
      b.sprite = Sprites.get(Era.current).bokeh;
      b.x = rand(0, this.w); b.y = rand(0, this.h);
      b.size = rand(120, 380);
      b.vx = rand(-6, 6); b.vy = rand(-9, -2);
      b.maxLife = rand(16, 32);
      b.life = initial ? rand(0, b.maxLife) : 0;
      b.alpha = rand(0.06, 0.16);
      b.z = rand(0.15, 0.4);
      b.phase = rand(0, TAU);
    },
    onEra() {
      for (const p of this.list) if (Math.random() < 0.55) p.maxLife = Math.min(p.maxLife, p.life + rand(1.5, 6));
      for (const b of this.bokeh) b.maxLife = Math.min(b.maxLife, b.life + rand(1, 5));
    },

    burst(x, y, n = 16, power = 1) {
      const types = ['sparkle', 'star', Era.current === 'pink' ? 'heart' : 'broken', 'butterfly'];
      const set = Sprites.get(Era.current);
      for (let i = 0; i < n; i++) {
        const a = rand(0, TAU), sp = rand(120, 340) * power, type = pick(types);
        this.bursts.push({
          sprite: set[type], x, y, vx: Math.cos(a) * sp, vy: Math.sin(a) * sp - 60,
          rot: rand(-1, 1), vr: rand(-4, 4), size: this.SIZE[type] * rand(0.55, 0.95),
          life: 0, max: rand(0.9, 1.6) * (power > 1 ? 1.4 : 1), flap: type === 'butterfly' ? 9 : 0, g: 90, drag: 2.6,
        });
      }
    },
    trail(x, y, dist) {
      this.trailAcc += dist;
      if (this.trailAcc < 14 || this.bursts.length > 260) return;
      this.trailAcc = 0;
      const set = Sprites.get(Era.current);
      const type = Math.random() < 0.72 ? 'sparkle' : (Math.random() < 0.6 ? 'star' : (Era.current === 'pink' ? 'heart' : 'butterfly'));
      this.bursts.push({
        sprite: set[type], x: x + rand(-6, 6), y: y + rand(-6, 6), vx: rand(-30, 30), vy: rand(-20, 30),
        rot: rand(-1, 1), vr: rand(-3, 3), size: rand(10, 19) * (type === 'butterfly' ? 1.4 : 1),
        life: 0, max: rand(0.55, 1.05), flap: type === 'butterfly' ? 10 : 0, g: 40, drag: 3.5,
      });
    },
    ring(x, y) { this.rings.push({ x, y, life: 0, max: 0.9, sprite: Sprites.get(Era.current).ring }); },

    update(dt, t) {
      const speed = 1 + AudioFX.level * 1.4;
      const offK = CONFIG.parallax * 46;
      const fleeing = Pointer.moving, resting = Pointer.resting;
      const W = this.w, H = this.h;
      let orbiting = 0;

      for (const p of this.list) {
        p.life += dt;
        if (p.life >= p.maxLife) { this.spawn(p, false); continue; }
        const sway = p.type === 'butterfly' || p.type === 'bat';
        const mx = p.vx + Math.sin(t * (sway ? 0.8 : 0.4) + p.phase) * (sway ? 22 : 7) * p.z;
        const my = p.vy + (sway ? Math.cos(t * 1.1 + p.phase * 1.3) * 14 * p.z : 0);
        p.x += mx * dt * speed;
        p.y += my * dt * speed;
        p.rot = sway ? Math.sin(t * 0.6 + p.phase) * 0.35 : p.rot + p.vr * dt;

        const ox = -Pointer.x * offK * p.z, oy = -Pointer.y * offK * p.z;
        const dx = p.x + ox - Pointer.px, dy = p.y + oy - Pointer.py;
        const d2 = dx * dx + dy * dy;
        if (resting && p.type === 'butterfly' && !p.blur && orbiting < 7 && d2 < 420 * 420) {
          // cursor quieto → las mariposas se acercan y revolotean a su alrededor
          orbiting++;
          const a = t * (0.7 + p.z * 0.4) + p.phase;
          const k = Math.min(1, dt * 1.6);
          p.x += (Pointer.px + Math.cos(a) * p.orbit - ox - p.x) * k;
          p.y += (Pointer.py + Math.sin(a) * p.orbit * 0.6 - oy - p.y) * k;
          p.life = Math.min(p.life, p.maxLife - 3);
        } else if (fleeing && d2 < 150 * 150 && d2 > 1) {
          // cursor en movimiento → todo lo esquiva
          const d = Math.sqrt(d2), f = (1 - d / 150) * (sway ? 300 : 130) * dt;
          p.x += (dx / d) * f; p.y += (dy / d) * f;
        }
        const m = 90;
        if (p.y < -m) p.y = H + m; else if (p.y > H + m) p.y = -m;
        if (p.x < -m) p.x = W + m; else if (p.x > W + m) p.x = -m;
      }

      for (const b of this.bokeh) {
        b.life += dt;
        if (b.life >= b.maxLife) { this.spawnBokeh(b, false); continue; }
        b.x += b.vx * dt; b.y += b.vy * dt;
        if (b.y < -200) b.y = H + 200;
      }

      for (let i = this.bursts.length - 1; i >= 0; i--) {
        const b = this.bursts[i];
        b.life += dt;
        if (b.life >= b.max) { this.bursts.splice(i, 1); continue; }
        const drag = Math.exp(-dt * b.drag);
        b.vx *= drag; b.vy = b.vy * drag + b.g * dt;
        b.x += b.vx * dt; b.y += b.vy * dt; b.rot += b.vr * dt;
      }

      if (CONFIG.meteors && Q.meteors) {
        this.meteorTimer -= dt;
        if (this.meteorTimer <= 0) {
          this.meteorTimer = rand(5, 12) * (Era.current === 'guts' ? 0.6 : 1);
          const ang = rand(2.6, 2.85), sp = rand(750, 1050);
          this.meteors.push({ x: rand(W * 0.35, W * 1.05), y: rand(-20, H * 0.35),
            vx: Math.cos(ang) * sp, vy: Math.sin(ang) * sp, len: rand(140, 240), life: 0, max: rand(0.7, 1.1) });
        }
      }
      for (let i = this.meteors.length - 1; i >= 0; i--) {
        const m = this.meteors[i];
        m.life += dt;
        if (m.life >= m.max) { this.meteors.splice(i, 1); continue; }
        m.x += m.vx * dt; m.y += m.vy * dt;
      }
      for (let i = this.rings.length - 1; i >= 0; i--) {
        const r = this.rings[i];
        r.life += dt;
        if (r.life >= r.max) this.rings.splice(i, 1);
      }
    },

    draw(t) {
      const R = Renderer, offK = CONFIG.parallax * 46, beat = AudioFX.level;
      for (const b of this.bokeh) {
        const fade = Math.min(1, b.life / 3, (b.maxLife - b.life) / 3);
        const a = b.alpha * fade * (0.75 + 0.25 * Math.sin(t * 0.5 + b.phase)) * (1 + beat * 0.8);
        R.sprite(0, b.sprite, b.x - Pointer.x * offK * b.z, b.y - Pointer.y * offK * b.z, b.size, b.size, 0, 1, Math.min(1, a));
      }
      for (const m of this.meteors) {
        const k = m.life / m.max, a = Math.sin(Math.PI * k);
        const sp = Math.hypot(m.vx, m.vy), ux = m.vx / sp, uy = m.vy / sp;
        R.sprite(0, Sprites.streak, m.x - ux * m.len * 0.5, m.y - uy * m.len * 0.5, m.len, 22, Math.atan2(m.vy, m.vx), 1, a);
      }
      for (const p of this.list) {
        const lt = p.life, fade = Math.min(1, lt / 2, (p.maxLife - lt) / 2);
        let a = p.alpha * fade;
        if (p.twinkle) a *= 0.55 + 0.45 * Math.sin(t * 3 + p.phase) + beat * 0.4;
        if (a <= 0.01) continue;
        let sx = 1;
        if (p.type === 'butterfly') sx = 0.16 + 0.84 * Math.abs(Math.sin(t * p.flap * (1 + beat) + p.phase));
        else if (p.type === 'bat') sx = 0.45 + 0.55 * Math.abs(Math.sin(t * p.flap + p.phase));
        const size = p.size * (p.twinkle || p.type === 'heart' ? 1 + beat * 0.35 : 1);
        R.sprite(p.front ? 1 : 0, p.sprite, p.x - Pointer.x * offK * p.z, p.y - Pointer.y * offK * p.z, size, size, p.rot, sx, Math.min(1, a));
      }
      for (const b of this.bursts) {
        const k = b.life / b.max;
        const sx = b.flap ? 0.2 + 0.8 * Math.abs(Math.sin(t * b.flap)) : 1;
        const s = b.size * (1 - k * 0.4);
        R.sprite(1, b.sprite, b.x, b.y, s, s, b.rot, sx, 1 - k * k);
      }
      for (const r of this.rings) {
        const k = r.life / r.max, e = 1 - (1 - k) ** 3, f = 128 / 116;
        const s1 = (10 + e * 110) * 2 * f, s2 = (6 + e * 62) * 2 * f;
        R.sprite(1, r.sprite, r.x, r.y, s1, s1, 0, 1, (1 - k) * 0.85);
        R.sprite(1, r.sprite, r.x, r.y, s2, s2, 0, 1, (1 - k) * 0.5);
      }
    },
  };

  /* ───────────────────────── Glow (halo del mouse, lo pinta el shader del fondo) ───────────────────────── */
  const Glow = {
    x: -9999, y: -9999, op: 0,
    update(dt) {
      const target = CONFIG.glow && Q.glow && Renderer.gl && Pointer.px > -999 && Pointer.idle < 20000 ? 1 : 0;
      this.op += (target - this.op) * Math.min(1, dt * 2);
      if (this.op < 0.005) return;
      if (this.x < -999) { this.x = Pointer.px; this.y = Pointer.py; }
      const k = 1 - Math.exp(-dt * 7);
      this.x += (Pointer.px - this.x) * k;
      this.y += (Pointer.py - this.y) * k;
    },
  };

  /* ───────────────────────── Ambient: micro-animaciones del collage (antes eran CSS) ───────────────────────── */
  const Ambient = {
    init() {
      this.rec = $('.rec'); this.env = $('.lcd__env'); this.swing = $('.swing'); this.charm = $('.phone__charm');
      this.roll = $('.screen__roll'); this.stat = $('.static'); this.chan = $('#chan-title'); this.holo = $('.license__holo');
      this.cd = $('#cd'); this.big = $('.bigword'); this.vm = $('.lcd__vm'); this.lcd = $('.lcd'); this.screen = $('#screen');
      this.cdAngle = 0; this.staticStep = 0; this.staticT = 0;
      // gotas de sangre: posición y tamaño en vw a partir del dibujo original de 1920 px
      this.drops = $$('.drip__drop').map((el) => {
        const x = +el.dataset.x, w = +el.dataset.w, len = +el.dataset.len;
        el.style.left = `${((x - w / 2) / 19.2).toFixed(3)}vw`;
        el.style.width = `${(w / 19.2).toFixed(3)}vw`;
        el.style.height = `${(len / 19.2).toFixed(3)}vw`;
        return { el, dur: +el.dataset.dur, d: +el.dataset.d };
      });
    },
    // el canal "sin señal" se ve si no hay video, o si YouTube está oculto un momento
    get noSignal() {
      const c = this.screen.classList;
      return (c.contains('is-empty') && !c.contains('show-song')) || (c.contains('show-yt') && c.contains('yt-hide'));
    },
    acc: 0,
    update(t, dt) {
      // las micro-animaciones son lentas: a 12 fps se ven igual y cuestan la mitad
      this.acc += dt;
      if (this.acc < 1 / Q.ambient - 0.004) return;
      dt = this.acc; this.acc = 0;
      put(this.rec, 'opacity', t % 1.2 < 0.6 ? '1' : '0');
      put(this.env, 'opacity', t % 1 < 0.5 ? '1' : '0');
      put(this.swing, 'transform', `rotate(${(7 * Math.sin(TAU * t / 7.6)).toFixed(2)}deg)`);
      put(this.charm, 'transform', `rotate(${(-1 + 11 * Math.sin(TAU * t / 6.2)).toFixed(2)}deg)`);
      for (const d of this.drops) put(d.el, 'transform', `scaleY(${(0.3 + 0.7 * wave(t - d.d, d.dur * 2)).toFixed(3)})`);
      if (CONFIG.quality === 'ultra') put(this.roll, 'transform', `translateY(${(((t % 7) / 7) * 440).toFixed(1)}%)`);
      if (this.noSignal) {
        if ((this.staticT += dt) > 0.1) {
          this.staticT = 0;
          const o = [[0, 0], [-46, 30], [38, -52], [-60, -18], [24, 56]][this.staticStep = (this.staticStep + 1) % 5];
          put(this.stat, 'transform', `translate(${o[0]}px, ${o[1]}px)`);
        }
        put(this.chan, 'opacity', (1 - 0.18 * wave(t, 4)).toFixed(3));
      }
      const c = (t % 8) / 8;
      const hx = c < 0.55 ? -80 : c < 0.85 ? -80 + 160 * Ease.inOut((c - 0.55) / 0.3) : 80;
      put(this.holo, 'transform', `translateX(${hx.toFixed(1)}%)`);
      if (Song.cur && Media.playing) {
        this.cdAngle = (this.cdAngle + dt * 100) % 360;
        put(this.cd, 'transform', `rotate(${this.cdAngle.toFixed(1)}deg)`);
      }
      const b = wave(t, 80);
      put(this.big, 'transform', `translate(${(4 * b).toFixed(3)}vw, ${(-2 * b).toFixed(3)}vw)`);
      if (Song.note) {
        const e = wave(t, 2);
        put(Song.note, 'transform', `translateY(${(-2 + 5 * e).toFixed(2)}px) rotate(${(-10 + 18 * e).toFixed(1)}deg)`);
      }
      put(this.vm, 'opacity', this.lcd.classList.contains('is-song') ? (1 - 0.25 * wave(t, 1.2)).toFixed(3) : '1');
    },
  };

  /* ───────────────────────── Phrases ───────────────────────── */
  const Phrases = {
    layer: $('#phrases'),
    active: new Set(),
    recent: [],
    custom: [],
    timer: 2.5,
    ready: false,

    init() {
      this.setCustom(CONFIG.customPhrases);
      const go = () => { this.ready = true; };
      if (document.fonts && document.fonts.ready) document.fonts.ready.then(go);
      setTimeout(go, 3000);
    },
    setCustom(v) {
      const list = Array.isArray(v) ? v : String(v || '').split(/[|\n]/);
      this.custom = list.map((s) => s.trim()).filter(Boolean);
    },
    setEnabled(on) {
      CONFIG.phrases = on;
      if (!on) for (const el of this.active) this.dismiss(el);
    },
    update(dt) {
      for (const el of this.active) if (!el._out && (el._hold -= dt) <= 0) this.dismiss(el);
      if (!CONFIG.phrases || !this.ready) return;
      this.timer -= dt;
      if (this.timer > 0) return;
      this.timer = CONFIG.phraseEvery * rand(0.7, 1.3);
      // si no encontró hueco libre, reintenta enseguida con otra frase
      if (this.active.size < Q.phrases && !this.spawn()) this.timer = 0.35;
    },

    choose() {
      const era = Era.current, r = Math.random(), hasCustom = this.custom.length > 0;
      let item;
      for (let tries = 0; tries < 8; tries++) {
        if (hasCustom && r < 0.4) {
          item = { text: pick(this.custom), kind: 'line' };
        } else if (r < (hasCustom ? 0.7 : 0.55)) {
          const e = Math.random() < 0.75 ? era : pick(ERA_ORDER);
          const i = (Math.random() * SONGS[e].length) | 0;
          item = { text: SONGS[e][i], kind: 'song', kick: songKicker(e, i) };
        } else {
          item = { text: pick(Math.random() < 0.6 ? LINES[era] : LINES.any), kind: 'line' };
        }
        if (!this.recent.includes(item.text)) break;
      }
      this.recent.push(item.text);
      if (this.recent.length > 10) this.recent.shift();

      const len = item.text.length;
      let styles = item.kind === 'song' ? ['song', 'song', 'song'] : ['marker', 'type', 'type', 'script'];
      if (len <= 26) styles.push('cutout');
      if (len <= 20) styles.push('label');
      if (len > 40) styles = ['marker'];
      item.style = pick(styles);
      return item;
    },

    build(item) {
      const el = document.createElement('div');
      el.className = 'phrase';
      const clip = document.createElement('div');
      clip.className = 'phrase__clip';
      const inn = document.createElement('div');
      inn.className = `phrase__in phrase--${item.style}`;
      clip.append(inn); el.append(clip);
      const span = (cls, text) => { const s = document.createElement('span'); s.className = cls; s.textContent = text; return s; };
      switch (item.style) {
        case 'song': inn.append(span('kick', item.kick), span('ttl', item.text)); break;
        case 'cutout': item.text.split(/\s+/).forEach((w) => inn.append(span(`w w${(Math.random() * 5) | 0}`, w))); break;
        case 'type': inn.textContent = item.text; inn.append(Object.assign(document.createElement('i'), { className: 'type-cover' })); break;
        case 'script': inn.textContent = item.text; clip.classList.add('is-wipe'); break;
        default: inn.textContent = item.text;
      }
      if (item.text.length > 40) { el.style.whiteSpace = 'normal'; el.style.width = '560px'; }
      el._clip = clip; el._in = inn; el._item = item;
      return el;
    },

    spawn() {
      const item = this.choose();
      const el = this.build(item);
      el.style.visibility = 'hidden';
      this.layer.append(el);
      const w = el.offsetWidth, h = el.offsetHeight;

      const PAD = 16;
      const blocked = $$('[data-protect]').map((n) => Stage.rectOf(n));
      for (const other of this.active) blocked.push(other._rect);
      const hits = (r) => blocked.some((b) =>
        r.x < b.x + b.w + PAD && r.x + r.w + PAD > b.x && r.y < b.y + b.h + PAD && r.y + r.h + PAD > b.y);
      let spot = null;
      for (let i = 0; i < 50 && !spot; i++) {
        const r = { x: rand(40, 1880 - w), y: rand(120, 1050 - h), w, h };   // y≥120: debajo del goteo
        if (r.x > 0 && r.y > 0 && !hits(r)) spot = r;
      }
      if (!spot) { el.remove(); return false; }

      el._rect = spot;
      el.style.left = `${spot.x}px`;
      el.style.top = `${spot.y}px`;
      el.style.visibility = '';
      const rot = rand(-6, 6).toFixed(1);
      el._rot = rot;
      this.active.add(el);
      el._hold = 5.2 + item.text.length * (item.style === 'type' ? 0.075 : 0.04);

      // entrada
      el._tw = Tweens.add({
        dur: 1.1, ease: Ease.out,
        step: (e) => {
          put(el, 'opacity', e.toFixed(3));
          put(el, 'transform', `translateY(${(16 * (1 - e)).toFixed(2)}px) rotate(${rot}deg) scale(${(0.94 + 0.06 * e).toFixed(4)})`);
        },
      });
      // máquina de escribir: el papel de encima se corre letra a letra
      if (item.style === 'type') {
        const cover = el._in.querySelector('.type-cover'), len = item.text.length, tw = el._in.offsetWidth - 36;
        Tweens.add({ delay: 0.35, dur: len * 0.055, ease: Ease.lin,
          step: (e) => put(cover, 'transform', `translateX(${((Math.ceil(e * len) / len) * tw).toFixed(1)}px)`) });
      }
      // cursiva: se "escribe" de izquierda a derecha (dos capas que se deslizan, sin repintar)
      if (item.style === 'script') {
        const W = el._in.offsetWidth;
        put(el._clip, 'transform', `translateX(${-W}px)`); put(el._in, 'transform', `translateX(${W}px)`);
        Tweens.add({ delay: 0.2, dur: 2.4, ease: Ease.inOut,
          step: (e) => {
            const o = ((1 - e) * W).toFixed(1);
            put(el._clip, 'transform', `translateX(-${o}px)`); put(el._in, 'transform', `translateX(${o}px)`);
          } });
      }
      return true;
    },

    dismiss(el) {
      if (el._out) return;
      el._out = true;
      Tweens.kill(el._tw);
      const rot = el._rot;
      Tweens.add({
        dur: 1.4, ease: Ease.inOut,
        step: (e) => {
          put(el, 'opacity', (1 - e).toFixed(3));
          put(el, 'transform', `translateY(${(-12 * e).toFixed(2)}px) rotate(${rot}deg) scale(${(1 + 0.03 * e).toFixed(4)})`);
        },
        done: () => { el.remove(); this.active.delete(el); },
      });
    },
  };

  /* ───────────────────────── Collage (parallax + polaroid 3D) ───────────────────────── */
  // Mientras mueves el mouse las piezas son capas de GPU (parallax suave a 24 fps).
  // Quieto el mouse, el collage se "duerme": se aplana en una sola capa y el
  // compositor dibuja 1 cosa en vez de ~20 en cada cuadro.
  const Collage = {
    layers: [], shine: $('#shine'),
    lastX: 9, lastY: 9, live: false,
    init() {
      this.layers = $$('.layer').map((el) => ({ el, d: parseFloat(el.dataset.depth) || 0.5, tilt: el.hasAttribute('data-tilt') }));
    },
    update() {
      const moving = Math.abs(Pointer.cx - this.lastX) > 0.0008 || Math.abs(Pointer.cy - this.lastY) > 0.0008;
      const live = moving || Pointer.idle < 1500;
      if (live !== this.live) { this.live = live; Stage.el.classList.toggle('is-live', live); }
      if (!moving) return;
      this.lastX = Pointer.cx; this.lastY = Pointer.cy;
      const x = Pointer.cx, y = Pointer.cy, k = CONFIG.parallax * 26;
      for (const { el, d, tilt } of this.layers) {
        let tf = `translate3d(${(-x * k * d).toFixed(1)}px, ${(-y * k * d).toFixed(1)}px, 0)`;
        if (tilt && Q.tilt) {
          const a = CONFIG.parallax;
          tf += ` perspective(1600px) rotateX(${(y * 5 * a).toFixed(2)}deg) rotateY(${(-x * 7 * a).toFixed(2)}deg)`;
        }
        put(el, 'transform', tf);
      }
      if (Q.tilt) put(this.shine, 'transform', `translate3d(${(x * 32).toFixed(1)}%, 0, 0)`);
    },
  };

  /* ───────────────────────── HUD (todo dentro del reloj principal) ───────────────────────── */
  const HUD = {
    clock: $('#clock'), ampm: $('#ampm'), date: $('#date'),
    vhsDate: $('#vhs-date'), counter: $('#vhs-counter'), np: $('#now-playing'),
    tkKick: $('#tk-kicker'), tkTitle: $('#tk-title'), tkMeta: $('#tk-meta'), tkFine: $('#tk-fine'), tkNo: $('#tk-no'),
    lcdMsg: $('#lcd-msg'), lcdFrom: $('#lcd-from'), lcd: $('.lcd'), capLabel: $('#cap-label'),
    start: Date.now(), lastSec: -1, songT: 9,
    phoneOverride: null, npTw: null,
    init() { this.tick(); },
    update(dt) {
      const s = Math.floor(Date.now() / 1000);
      if (s !== this.lastSec) { this.lastSec = s; this.tick(); }
      if ((this.songT -= dt) <= 0) { this.songT = 9; this.nextSong(); }
    },
    tick() {
      const d = new Date();
      let h = d.getHours();
      if (CONFIG.clock24) this.ampm.textContent = '';
      else { this.ampm.textContent = h >= 12 ? 'PM' : 'AM'; h = h % 12 || 12; }
      const hm = `${pad2(h)}:${pad2(d.getMinutes())}`;
      if (this.clock.textContent !== hm) this.clock.textContent = hm;
      const wd = d.toLocaleDateString('en-US', { weekday: 'short' }).toUpperCase();
      const mo = d.toLocaleDateString('en-US', { month: 'short' }).toUpperCase();
      const ds = `${wd} · ${mo} ${pad2(d.getDate())}`;
      if (this.date.textContent !== ds) this.date.textContent = ds;
      const s = ((Date.now() - this.start) / 1000) | 0;
      this.counter.textContent = `${(s / 3600) | 0}:${pad2(((s / 60) | 0) % 60)}:${pad2(s % 60)}`;
    },
    // se llama en el pico del destello → el cambio no se nota
    onEra(id) {
      const e = ERAS[id];
      this.vhsDate.textContent = e.vhs;
      Video.setChannel(id);
      this.tkKick.textContent = e.ticket.kick;
      this.tkTitle.replaceChildren(e.ticket.title[0], document.createElement('br'), e.ticket.title[1]);
      this.tkTitle.classList.toggle('is-long', !!e.ticket.long);
      this.tkMeta.textContent = e.ticket.meta;
      this.tkFine.textContent = e.ticket.fine;
      this.tkNo.textContent = e.ticket.no;
      this.setPhone(this.phoneOverride);
      if (!Song.cur) this.nextSong();
    },
    setNowPlaying(title) {
      const np = this.np;
      Tweens.kill(this.npTw);
      this.npTw = Tweens.add({
        dur: 1.2, ease: Ease.lin,
        step: (e, k) => {
          if (k >= 0.5 && np.textContent !== title) { np.textContent = title; np.classList.toggle('is-long', title.length > 16); }
          const v = k < 0.5 ? 1 - k * 2 : (k - 0.5) * 2;
          put(np, 'opacity', v.toFixed(3));
          put(np, 'transform', `translateY(${((1 - v) * 6).toFixed(2)}px)`);
        },
      });
    },
    showSong(e) {
      this.capLabel.textContent = 'now playing on spotify ♪';
      this.setNowPlaying(e.title);
      this.setPhone({ msg: `♪ ${e.title}`, from: 'on spotify · live' });
      this.lcd.classList.add('is-song');
    },
    showForeign(title) {
      this.setPhone({ msg: `♪ ${title}`, from: 'from: ♡ play olivia?' });
      this.lcd.classList.remove('is-song');
    },
    clearSong() {
      this.capLabel.textContent = 'now playing ♪';
      this.setPhone(null);
      this.lcd.classList.remove('is-song');
      this.nextSong();
    },
    setPhone(ph) {
      this.phoneOverride = ph;
      const p = ph || ERAS[Era.current].phone;
      this.lcdMsg.textContent = p.msg;
      this.lcdFrom.textContent = p.from;
    },
    nextSong() {
      if (Song.cur) return;            // si suena Olivia, el caption muestra la canción real
      const list = SONGS[Era.current];
      let song = pick(list);
      if (song === this.np.textContent) song = pick(list);
      this.setNowPlaying(song);
    },
  };

  /* ───────────────────────── Video ───────────────────────── */
  const Video = {
    el: $('#video'), screen: $('#screen'),
    chanNo: $('#chan-no'), chanTitle: $('#chan-title'),
    paused: false, glitchT: rand(6, 15),
    init() {
      const v = this.el;
      v.addEventListener('loadeddata', () => { this.screen.classList.remove('is-empty'); this.updateLock(); });
      v.addEventListener('error', () => { this.screen.classList.add('is-empty'); this.updateLock(); });
      for (const ev of ['play', 'pause', 'playing']) v.addEventListener(ev, () => this.updateLock());
      if (v.readyState >= 2) this.screen.classList.remove('is-empty');
      v.play().catch(() => {});
      this.makeStatic();
    },
    // el reloj se engancha al video que realmente se está viendo
    updateLock() {
      let v = null;
      if (VideoSync.mode === 'local') v = VideoSync.local;
      else if (VideoSync.mode === 'none' && !this.screen.classList.contains('is-empty')) v = this.el;
      Clock.lock(v);
    },
    makeStatic() {
      const c = document.createElement('canvas');
      c.width = c.height = 220;
      const g = c.getContext('2d'), img = g.createImageData(220, 220), d = img.data;
      for (let i = 0; i < d.length; i += 4) { const v = (Math.random() * 255) | 0; d[i] = d[i + 1] = d[i + 2] = v; d[i + 3] = 255; }
      g.putImageData(img, 0, 0);
      $('.static').style.backgroundImage = `url(${c.toDataURL()})`;
    },
    setChannel(id) {
      const c = ERAS[id].chan;
      this.chanNo.textContent = c.no;
      this.chanTitle.textContent = c.title;
      this.chanTitle.className = `chan__title chan__title--${id}`;
    },
    glitch() {
      const s = this.screen;
      const kf = ['translate(-7px,2px) skewX(-5deg)', 'translate(6px,-1px)', 'translate(-3px,0) skewX(3deg)', 'translate(4px,1px)', 'none'];
      Tweens.add({ dur: 0.38, ease: Ease.lin, step: (e, k) => put(s, 'transform', kf[Math.min(4, Math.floor(k * 5))]) });
    },
    update(dt) {
      if ((this.glitchT -= dt) <= 0) { this.glitchT = rand(6, 15); this.glitch(); }
    },
    resume() { if (!this.paused) this.el.play().catch(() => {}); },
    setPaused(p) {
      this.paused = p;
      if (p) this.el.pause();
      else if (VideoSync.mode === 'none') this.el.play().catch(() => {});
    },
    setSound(on) { this.el.muted = !on; if (on) this.el.play().catch(() => {}); },
    setVolume(v) { this.el.volume = clamp(v, 0, 1); },
  };

  /* ───────────────────────── Media (Spotify vía Wallpaper Engine) ───────────────────────── */
  const Media = {
    enabled: true, key: '',
    title: '', artist: '', album: '',
    playing: false, pos: 0, posAt: 0, dur: 0, hasTimeline: false,
    get position() { return this.pos + (this.playing ? (performance.now() - this.posAt) / 1000 : 0); },
    init() {
      const w = window;
      if (typeof w.wallpaperRegisterMediaPropertiesListener !== 'function') return this.simulate();
      // WE pide registrar los listeners en cuanto carga la página
      if (typeof w.wallpaperRegisterMediaStatusListener === 'function') {
        w.wallpaperRegisterMediaStatusListener((e) => { this.enabled = e.enabled; if (!e.enabled) this.clear(); });
      }
      w.wallpaperRegisterMediaPropertiesListener((e) => this.onProps(e));
      w.wallpaperRegisterMediaPlaybackListener((e) => this.onPlayback(e.state));
      w.wallpaperRegisterMediaTimelineListener((e) => this.onTimeline(e));
      w.wallpaperRegisterMediaThumbnailListener((e) => Song.setArt(e.thumbnail));
    },
    onProps(e) {
      const key = `${e.title}|${e.artist}`;
      if (key === this.key) return;
      this.key = key;
      this.title = e.title || ''; this.artist = e.artist || ''; this.album = e.albumTitle || '';
      this.pos = 0; this.posAt = performance.now(); this.hasTimeline = false;
      Song.onTrack();
    },
    onPlayback(state) {
      const M = window.wallpaperMediaIntegration || {};
      const PLAYING = M.PLAYBACK_PLAYING ?? 1, STOPPED = M.PLAYBACK_STOPPED ?? 0;
      this.pos = this.position; this.posAt = performance.now();
      this.playing = state === PLAYING;
      if (state === STOPPED) return this.clear();
      Song.onPlayback();
    },
    onTimeline(e) {
      if (!(e.duration > 0)) return;
      this.pos = e.position; this.posAt = performance.now(); this.dur = e.duration;
      this.hasTimeline = true;
      VideoSync.sync(true);
    },
    clear() {
      this.key = ''; this.title = ''; this.playing = false;
      Song.stop(); HUD.setPhone(null);
    },
    // Vista previa en navegador: index.html?sim=vampire&at=40 finge que Spotify suena
    simulate() {
      const q = new URLSearchParams(location.search), sim = q.get('sim');
      if (!sim) return;
      setTimeout(() => {
        this.onProps({ title: sim, artist: q.get('artist') || 'Olivia Rodrigo', albumTitle: q.get('album') || '' });
        this.onPlayback(1);
        this.onTimeline({ position: parseFloat(q.get('at')) || 0, duration: 240 });
      }, 2600);
    },
  };

  /* ───────────────────────── Song (reacción a la canción) ───────────────────────── */
  const Song = {
    cur: null, note: null,
    cd: $('#cd'), cdArt: $('#cd-art'),
    items: [],
    init() {
      this.items = $$('.notebook__list li').map((li) => ({ li, key: norm(li.dataset.song) }));
    },
    onTrack() {
      const isOlivia = /olivia\s*rodrigo/i.test(Media.artist);
      if (!isOlivia) {
        this.stop();
        if (Media.title) HUD.showForeign(Media.title);
        return;
      }
      const e = Catalog.find(Media.title, Media.album);
      this.cur = e;
      document.body.classList.add('has-song');
      // su álbum manda la era; el anuncio "now playing" tapa el cambio de colores
      if (!Era.set(e.era, (apply) => EraFX.nowPlaying(e, apply))) EraFX.nowPlaying(e);
      this.markSetlist(e);
      HUD.showSong(e);
      Particles.onEra();
      VideoSync.load(e);
      this.onPlayback();
    },
    markSetlist(e) {
      if (this.note) { this.note.remove(); this.note = null; }
      const key = e ? norm(e.title) : '';
      for (const it of this.items) {
        const on = it.key === key;
        it.li.classList.toggle('is-now', on);
        if (on) { this.note = Object.assign(document.createElement('i'), { className: 'now-note', textContent: '♪' }); it.li.append(this.note); }
      }
    },
    onPlayback() {
      document.body.classList.toggle('song-paused', !Media.playing);
      VideoSync.sync(true);
    },
    stop() {
      if (!this.cur) return;
      this.cur = null;
      document.body.classList.remove('has-song', 'song-paused');
      this.markSetlist(null);
      Era.timer = 0;
      if (CONFIG.eraMode !== 'cycle') Era.set(CONFIG.eraMode);
      HUD.clearSong();
      VideoSync.unload();
    },
    setArt(b64) {
      if (!b64) { this.cd.classList.remove('has-art'); return; }
      this.cdArt.src = b64.startsWith('data:') ? b64 : `data:image/png;base64,${b64}`;
      this.cd.classList.add('has-art');
    },
  };

  /* ───────────────────────── VideoSync (videoclip sincronizado) ───────────────────────── */
  // Orden: videos/<cancion>.mp4 → YouTube (relay o directo) → video por defecto
  const VideoSync = {
    screen: $('#screen'), local: $('#song-video'), src: $('#hud-src'), offEl: $('#sync-offset'),
    entry: null, mode: 'none', token: 0, yt: null, lastSeek: 0, failTimer: 0,
    offsets: {}, ytLead: 0.8, seekCheck: false, acc: 0,
    init() {
      try { this.offsets = JSON.parse(localStorage.getItem('or-offsets') || '{}'); } catch (_) { this.offsets = {}; }
      for (const b of $$('.sync__btn')) {
        b.addEventListener('mousedown', (ev) => ev.stopPropagation());
        b.addEventListener('click', () => this.nudge(parseFloat(b.dataset.d)));
      }
      addEventListener('message', (ev) => YTRelay.onMessage(ev));
      for (const ev of ['play', 'pause', 'playing']) this.local.addEventListener(ev, () => Video.updateLock());
    },
    update(dt) {
      if ((this.acc += dt) > 0.5) { this.acc = 0; this.sync(false); }
    },
    get offset() {
      if (!this.entry) return 0;
      return (this.entry.offset || 0) + (this.offsets[norm(this.entry.title)] || 0) + CONFIG.videoOffset;
    },
    nudge(d) {
      if (!this.entry) return;
      const k = norm(this.entry.title);
      this.offsets[k] = Math.round(((this.offsets[k] || 0) + d) * 100) / 100;
      try { localStorage.setItem('or-offsets', JSON.stringify(this.offsets)); } catch (_) {}
      this.showOffset();
      this.sync(true);
    },
    showOffset() {
      const o = this.entry ? (this.offsets[norm(this.entry.title)] || 0) : 0;
      this.offEl.textContent = `${o >= 0 ? '+' : ''}${o.toFixed(2)}s`;
    },
    setMode(m) {
      this.mode = m;
      this.screen.classList.toggle('show-local', m === 'local');
      this.screen.classList.toggle('show-yt', m === 'yt');
      this.screen.classList.toggle('show-song', m !== 'none');
      if (m !== 'yt') this.screen.classList.remove('yt-hide');
      if (m === 'none') Video.resume(); else Video.el.pause();   // el video por defecto descansa
      Video.updateLock();
      this.label();
    },
    label(text) {
      const t = text || (this.mode === 'none' ? 'SP'
        : `${Media.hasTimeline ? 'SYNC' : '≈SYNC'} ${this.mode === 'yt' ? 'YT' : 'MP4'}`);
      if (this.src.textContent !== t) this.src.textContent = t;
    },
    load(e) {
      this.unload();
      this.entry = e;
      this.showOffset();
      if (CONFIG.videoSource === 'off') return;
      const token = ++this.token;
      if (CONFIG.videoSource === 'youtube' || Online.hosted) return this.tryYouTube(e, token);   // en la copia publicada no hay archivos locales
      const v = this.local;
      v.onloadeddata = () => { if (token === this.token) { this.setMode('local'); this.sync(true); } };
      v.onerror = () => { if (token === this.token) this.tryYouTube(e, token); };
      v.src = `videos/${slug(e.title)}.mp4`;
      v.load();
    },
    tryYouTube(e, token) {
      if (!e.yt || CONFIG.videoSource === 'local') return this.setMode('none');
      const adapter = CONFIG.ytRelay && !Online.hosted ? YTRelay : YTDirect;   // en https YouTube va directo
      if (adapter.broken) { this.setMode('none'); return this.label('YT ✕'); }
      this.yt = adapter;
      this.screen.classList.add('yt-on');
      this.label('YT …');
      adapter.load(e.yt, Math.max(0, Media.position + this.offset), {
        playing: () => {
          if (token !== this.token || this.mode === 'yt') return;
          clearTimeout(this.failTimer);
          this.setMode('yt');
          this.sync(true);
        },
        error: (code) => { if (token === this.token) this.fail(adapter, code); },
      });
      // si en 75 s no arrancó (sin internet, bloqueado…) se usa el video por defecto.
      // Es largo a propósito: YouTube a veces pone uno o dos anuncios antes del videoclip
      // (el anuncio nunca se ve: la pantalla solo muestra YouTube cuando ya suena el videoclip)
      clearTimeout(this.failTimer);
      this.failTimer = setTimeout(() => { if (token === this.token && this.mode !== 'yt') this.fail(adapter, 'timeout'); }, 75000);
    },
    fail(adapter, code) {
      clearTimeout(this.failTimer);
      if (adapter === YTDirect && (code === 153 || code === 'api')) adapter.broken = true;  // sin referrer / sin internet
      adapter.stop();
      this.screen.classList.remove('yt-on');
      this.setMode('none');
      this.label(`YT ✕${code === 'timeout' ? '' : ' ' + code}`);
    },
    unload() {
      this.token++;
      clearTimeout(this.failTimer);
      this.entry = null;
      const v = this.local;
      v.onloadeddata = v.onerror = null;
      if (v.getAttribute('src')) { v.pause(); v.removeAttribute('src'); v.load(); }
      if (this.yt) this.yt.stop();
      this.yt = null;
      this.screen.classList.remove('yt-on');
      if (this.mode !== 'none') this.setMode('none'); else this.label();
    },
    // corrige la deriva: compara el video con la posición de Spotify
    sync(force) {
      if (!this.entry || this.mode === 'none') return;
      const target = Math.max(0, Media.position + this.offset);
      const now = performance.now();
      if (this.mode === 'local') {
        const v = this.local;
        if (Media.playing && v.paused) v.play().catch(() => {});
        if (!Media.playing && !v.paused) v.pause();
        const diff = target - v.currentTime;
        if ((force || Math.abs(diff) > 1.2) && now - this.lastSeek > 400) {
          v.currentTime = Math.min(target, (v.duration || 1e9) - 0.05);   // salto si está muy lejos
          v.playbackRate = 1;
          this.lastSeek = now;
        } else {
          // desfase pequeño: acelera o frena un poquito, sin saltos visibles
          v.playbackRate = Math.abs(diff) < 0.04 ? 1 : clamp(1 + diff * 0.8, 0.88, 1.12);
        }
      } else {
        const a = this.yt;
        a.poll();
        if (Media.playing) a.play(); else a.pause();
        // oculta el video mientras YouTube muestra su interfaz (pausa, carga, final, anuncio)
        const hide = !Media.playing || a.state() !== 1;
        this.screen.classList.toggle('yt-hide', hide);
        if (hide) this.label(Media.playing ? 'YT …' : '‖ PAUSE');
        const diff = target - a.time();
        if (a.buffering() && !force && Math.abs(diff) < 8) return;   // está cargando: esperar
        // aprende cuánto tarda YouTube tras un salto (solo midiendo con el video ya andando, no cargando)
        if (this.seekCheck && now - this.lastSeek > 2000 && a.state() === 1) {
          this.ytLead = clamp(this.ytLead + diff * 0.35, 0, 3);
          this.seekCheck = false;
        }
        // desfase grande (> 1 s): salto. Desfase chico: se acelera o frena el video un 5-10 %
        // (YouTube lo hace sin cortes; un salto lo deja en negro un instante mientras carga)
        if ((force || Math.abs(diff) > 1) && now - this.lastSeek > 3000) {
          a.setRate(1);
          a.seek(target + (Media.playing ? this.ytLead : 0));
          this.lastSeek = now;
          this.seekCheck = Media.playing;
        } else if (a.state() === 1 && now - this.lastSeek > 1500) {
          const ad = Math.abs(diff);
          const r = ad < 0.06 ? 1 : ad < 0.15 ? a.rate : 1 + Math.sign(diff) * (ad > 0.4 ? 0.1 : 0.05);
          a.setRate(r);
        }
        if (hide) return;
      }
      this.label();
    },
    drift() {
      if (this.mode === 'none') return null;
      const t = this.mode === 'local' ? this.local.currentTime : this.yt.time();
      return t - (Media.position + this.offset);
    },
  };

  // YouTube directo (IFrame API). Puede fallar con "error 153" porque los wallpapers
  // se cargan como archivo local (sin "referrer"); en ese caso se usa el relay o el MP4.
  const YTDirect = {
    api: null, player: null, cb: null,
    // Comprobado dentro de Wallpaper Engine: como archivo local (file://) YouTube no
    // reproduce (error 153, sin "referrer"). No se intenta: ahorra un iframe pesado e inútil.
    broken: location.protocol === 'file:',
    loadApi() {
      if (this.api) return this.api;
      this.api = new Promise((resolve, reject) => {
        const prev = window.onYouTubeIframeAPIReady;
        window.onYouTubeIframeAPIReady = () => { if (prev) prev(); resolve(); };
        const s = document.createElement('script');
        s.src = 'https://www.youtube.com/iframe_api';
        s.onerror = () => reject(new Error('api'));
        document.head.append(s);
      });
      return this.api;
    },
    load(id, start, cb) {
      this.cb = cb;
      this.loadApi().then(() => {
        this.rate = 1;
        if (this.player && this.player.loadVideoById) { this.player.setPlaybackRate(1); this.player.loadVideoById({ videoId: id, startSeconds: start }); return; }
        const host = document.createElement('div');
        $('#yt-box').replaceChildren(host);
        this.player = new window.YT.Player(host, {
          videoId: id,
          playerVars: { autoplay: 1, mute: 1, controls: 0, disablekb: 1, fs: 0, rel: 0, iv_load_policy: 3, playsinline: 1, start: Math.floor(start) },
          events: {
            onReady: (ev) => { ev.target.mute(); ev.target.playVideo(); },
            onStateChange: (ev) => { if (ev.data === 1 && this.cb) this.cb.playing(); },
            onError: (ev) => { if (this.cb) this.cb.error(ev.data); },
          },
        });
      }).catch(() => { if (this.cb) this.cb.error('api'); });
    },
    ok() { return this.player && typeof this.player.getCurrentTime === 'function'; },
    time() { return this.ok() ? this.player.getCurrentTime() : 0; },
    seek(t) { if (this.ok()) this.player.seekTo(t, true); },
    state() { return this.ok() ? this.player.getPlayerState() : -1; },
    buffering() { return this.state() === 3; },
    play() { if (this.ok() && this.player.getPlayerState() !== 1) this.player.playVideo(); },
    pause() { if (this.ok() && this.player.getPlayerState() === 1) this.player.pauseVideo(); },
    poll() {},
    rate: 1,
    setRate(r) { if (r !== this.rate && this.ok()) { this.rate = r; this.player.setPlaybackRate(r); } },
    stop() { this.cb = null; this.rate = 1; if (this.ok()) this.player.stopVideo(); },
  };

  // YouTube a través de una página "relay" alojada en https (GitHub Pages):
  // ahí YouTube sí recibe un origen válido, así que no aparece el error 153.
  // El relay no usa temporizadores: el wallpaper le pide el tiempo en cada sync (cada 0,5 s)
  // y tras 45 s sin canción de Olivia se libera el reproductor de YouTube (memoria y CPU a cero).
  const YTRelay = {
    frame: null, url: '', ready: false, queue: [], cb: null, t: 0, tAt: 0, st: -1, broken: false, idle: 0,
    ensure() {
      clearTimeout(this.idle);
      if (this.frame && this.url === CONFIG.ytRelay) return;
      this.url = CONFIG.ytRelay; this.ready = false; this.queue = [];
      this.frame = document.createElement('iframe');
      this.frame.className = 'yt-frame';
      this.frame.allow = 'autoplay; encrypted-media';
      this.frame.src = this.url;
      $('#yt-box').replaceChildren(this.frame);
    },
    send(msg) {
      if (!this.frame) return;
      if (!this.ready) { this.queue.push(msg); return; }
      this.frame.contentWindow.postMessage({ or: 1, ...msg }, '*');
    },
    onMessage(ev) {
      const d = ev.data;
      if (!this.frame || ev.source !== this.frame.contentWindow || !d || d.orRelay !== 1) return;
      if (d.ev === 'ready') { this.ready = true; const q = this.queue; this.queue = []; q.forEach((m) => this.send(m)); }
      else if (d.ev === 'time' || d.ev === 'state') {
        this.t = d.t; this.tAt = performance.now(); this.st = d.state;
        if (d.state === 1 && this.cb) this.cb.playing();
      }
      else if (d.ev === 'error' && this.cb) this.cb.error(d.code);
    },
    load(id, start, cb) { this.cb = cb; this.st = -1; this.ensure(); this.send({ cmd: 'load', id, start }); },
    poll() { this.send({ cmd: 'poll' }); },
    rate: 1,
    setRate(r) { if (r !== this.rate) { this.rate = r; this.send({ cmd: 'rate', r }); } },
    time() { return this.t + (this.st === 1 ? (performance.now() - this.tAt) / 1000 : 0); },
    seek(t) { this.send({ cmd: 'seek', t }); this.t = t; this.tAt = performance.now(); },
    state() { return this.st; },
    buffering() { return this.st === 3; },
    play() { if (this.st !== 1) this.send({ cmd: 'play' }); },
    pause() { if (this.st === 1) this.send({ cmd: 'pause' }); },
    stop() {
      this.cb = null; this.st = -1; this.rate = 1;
      if (!this.frame) return;
      this.send({ cmd: 'stop' });
      clearTimeout(this.idle);
      this.idle = setTimeout(() => this.free(), 45000);
    },
    free() {
      if (!this.frame) return;
      this.send({ cmd: 'free' });
      this.frame.remove();
      this.frame = null; this.url = ''; this.ready = false; this.queue = [];
    },
  };

  /* ───────────────────────── AudioFX ───────────────────────── */
  const AudioFX = {
    level: 0, raw: 0,
    glow: $('#glow'),
    init() {
      // Wallpaper Engine entrega 128 valores: 0-63 canal izq., 64-127 der. (graves primero)
      if (typeof window.wallpaperRegisterAudioListener === 'function') {
        window.wallpaperRegisterAudioListener((a) => {
          let s = 0;
          for (let i = 0; i < 8; i++) s += a[i] + a[64 + i];
          this.raw = Math.min(1, (s / 16) * 1.6);
        });
      }
    },
    update(dt) {
      const target = CONFIG.audio ? this.raw : 0;
      const k = target > this.level ? 18 : 3.5;        // sube rápido, baja suave
      this.level += (target - this.level) * Math.min(1, k * dt);
      put(this.glow, 'opacity', (0.28 + this.level * 0.6).toFixed(2));
    },
  };

  /* ───────────────────────── Calidad ───────────────────────── */
  const Quality = {
    apply(name) {
      if (!QUALITY[name]) name = 'high';
      CONFIG.quality = name;
      Q = QUALITY[name];
      document.body.classList.remove('q-ultra', 'q-high', 'q-perf', 'q-eco');
      document.body.classList.add(`q-${name}`);
      Particles.setCount(Math.round(Q.particles * CONFIG.density));
      Particles.setBokeh(Q.bokeh);
      if (Renderer.B) Renderer.resize();
      Collage.lastX = 9;    // fuerza a recalcular (por si se apagó la inclinación 3D)
    },
  };

  /* ───────────────────────── Un cuadro (24 por segundo) ───────────────────────── */
  function tick(dt, t) {
    Pointer.update(t, dt);
    Era.update(dt);
    AudioFX.update(dt);
    Particles.update(dt, t);
    Glow.update(dt);
    Renderer.frame(t, dt);
    Tweens.update(dt);
    Ambient.update(t, dt);
    Collage.update();
    Phrases.update(dt);
    HUD.update(dt);
    EraFX.update(dt);
    Video.update(dt);
    VideoSync.update(dt);
    if (Debug.el) Debug.update(dt);
  }

  // Panel de depuración: index.html?debug
  const Debug = {
    el: null, acc: 0, f0: 0, w0: 0,
    init() {
      if (location.search.includes('debug')) {
        window.__OR = { Particles, Pointer, Era, CONFIG, Media, Song, VideoSync, Clock, Renderer, Quality, Ambient, Collage, Phrases, HUD, AudioFX, Online };
        this.show(true);
      }
    },
    // también se activa desde Wallpaper Engine → "Mostrar FPS"
    show(on) {
      if (on && !this.el) {
        this.el = Object.assign(document.createElement('pre'), { className: 'perf', textContent: 'midiendo…' });
        document.body.append(this.el);
        this.f0 = Clock.frames; this.w0 = Clock.workMs; this.acc = 0;
      } else if (!on && this.el) { this.el.remove(); this.el = null; }
    },
    update(dt) {
      if ((this.acc += dt) < 1) return;
      const f = Clock.frames - this.f0, w = Clock.workMs - this.w0;
      this.f0 = Clock.frames; this.w0 = Clock.workMs;
      const d = VideoSync.drift();
      this.el.textContent =
        `${f} fps · ${(w / Math.max(1, f)).toFixed(2)} ms/cuadro · ${Renderer.gl ? 'WebGL' : 'Canvas2D'} · calidad ${CONFIG.quality}` +
        ` · reloj rAF\n` +
        `song ${Song.cur ? Song.cur.title : '-'} · mode ${VideoSync.mode} · drift ${d == null ? '-' : d.toFixed(2) + 's'}`;
      this.acc = 0;
    },
  };

  /* ───────────────────────── Modo en línea ───────────────────────── */
  // Abierto como archivo local (file://), Wallpaper Engine congela los iframes de otros sitios:
  // YouTube carga pero nunca reproduce. En la copia publicada en https sí funcionan. Así que, con
  // internet, el wallpaper local salta a esa copia y le pasa tus opciones (Wallpaper Engine solo se
  // las entrega a la página que abrió él). Sin internet se queda el local, completo pero sin videoclips.
  const Online = {
    url: 'https://tkyoxx.github.io/olivia-eras-relay/wallpaper/',
    hosted: location.protocol !== 'file:',
    props: {}, general: {}, timer: 0, gone: false,
    remember(p, general) {
      if (this.hosted) return;
      Object.assign(general ? this.general : this.props, p);
      clearTimeout(this.timer);
      this.timer = setTimeout(() => this.go(), 250);     // Wallpaper Engine manda todas las opciones juntas
    },
    async go() {
      if (this.gone || !CONFIG.online || !(CONFIG.videoSource === 'auto' || CONFIG.videoSource === 'youtube')) return;
      if (navigator.onLine === false) return;
      const ctl = new AbortController(), to = setTimeout(() => ctl.abort(), 6000);
      try { await fetch(this.url + 'script.js', { method: 'HEAD', mode: 'no-cors', cache: 'no-store', signal: ctl.signal }); }
      catch (_) { return; }                              // sin conexión: se queda la versión local
      finally { clearTimeout(to); }
      if (!CONFIG.online || this.gone) return;
      this.gone = true;
      const p = {};                                      // solo los valores (URL corta)
      for (const [k, v] of Object.entries(this.props)) if (v && 'value' in v) p[k] = { value: v.value };
      const data = encodeURIComponent(JSON.stringify({ p, g: this.general }));
      location.replace(`${this.url}#we=${data}`);
    },
    // en la copia publicada: aplica las opciones que le pasó el wallpaper local
    restore() {
      const m = /[#&]we=([^&]+)/.exec(location.hash);
      if (!m) return;
      try {
        const d = JSON.parse(decodeURIComponent(m[1]));
        window.wallpaperPropertyListener.applyUserProperties(d.p || {});
        window.wallpaperPropertyListener.applyGeneralProperties(d.g || {});
      } catch (_) {}
    },
  };

  /* ───────────────────────── Init ───────────────────────── */
  // Vista previa en navegador: index.html?era=guts&q=eco&fps=30
  const qs = new URLSearchParams(location.search);
  if (ERAS[qs.get('era')]) CONFIG.eraMode = qs.get('era');
  if (QUALITY[qs.get('q')]) CONFIG.quality = qs.get('q');
  if (+qs.get('fps')) CONFIG.fps = +qs.get('fps');
  if (qs.get('relay')) CONFIG.ytRelay = qs.get('relay');

  Q = QUALITY[CONFIG.quality];
  Stage.fit();
  Era.current = CONFIG.eraMode === 'cycle' ? 'sour' : CONFIG.eraMode;
  document.body.dataset.era = Era.current;
  Pointer.init();
  Renderer.init();
  Quality.apply(CONFIG.quality);
  Bigword.init();
  Collage.init();
  Ambient.init();
  Video.init();
  VideoSync.init();
  Song.init();
  Media.init();   // registrar YA: Wallpaper Engine lo exige al cargar
  HUD.init();
  HUD.onEra(Era.current);
  AudioFX.init();
  Phrases.init();
  Debug.init();
  Clock.fps = CONFIG.fps;
  Clock.start();
  Video.updateLock();
  // bienvenida: cuando el collage termina de "caer", se anuncia la era actual
  setTimeout(() => EraFX.announce(Era.current, null, true), 1900);
  // al terminar la intro se quita la animación: si no, Chrome deja esas piezas
  // (y todo lo que tienen encima) como capas de GPU extra para siempre
  setTimeout(() => { for (const el of $$('.drop-in')) el.classList.remove('drop-in'); }, 3200);

  addEventListener('resize', () => { Stage.fit(); Renderer.resize(); });
  document.addEventListener('visibilitychange', () => { Clock.setPaused(document.hidden); Video.setPaused(document.hidden); });

  /* ───────────────────────── Wallpaper Engine ───────────────────────── */
  window.wallpaperPropertyListener = {
    applyUserProperties(p) {
      Online.remember(p);
      if (p.quality)         Quality.apply(p.quality.value);
      if (p.fps)             Clock.fps = CONFIG.fps = +p.fps.value || 24;
      if (p.particledensity) { CONFIG.density = p.particledensity.value / 100; Quality.apply(CONFIG.quality); }
      if (p.particlecount)   { CONFIG.density = p.particlecount.value / 90; Quality.apply(CONFIG.quality); }   // versión anterior
      if (p.eramode)         Era.setMode(p.eramode.value);
      if (p.eraduration)     CONFIG.eraDuration = Math.max(5, p.eraduration.value);
      if (p.eraannounce)     CONFIG.eraAnnounce = p.eraannounce.value;
      if (p.parallax)        { CONFIG.parallax = p.parallax.value / 100; Collage.lastX = 9; }
      if (p.mousetrail)      CONFIG.trail = p.mousetrail.value;
      if (p.cursorglow)      CONFIG.glow = p.cursorglow.value;
      if (p.meteors)         CONFIG.meteors = p.meteors.value;
      if (p.showphrases)     Phrases.setEnabled(p.showphrases.value);
      if (p.phraseinterval)  CONFIG.phraseEvery = Math.max(1, p.phraseinterval.value);
      if (p.customphrases)   Phrases.setCustom(p.customphrases.value);
      if (p.videotint)       document.body.classList.toggle('no-tint', !p.videotint.value);
      if (p.videosound)      Video.setSound(p.videosound.value);
      if (p.videovolume)     Video.setVolume(p.videovolume.value / 100);
      if (p.audioreactive)   CONFIG.audio = p.audioreactive.value;
      if (p.clock24)         { CONFIG.clock24 = p.clock24.value; HUD.tick(); }
      if (p.showgrain)       CONFIG.grain = p.showgrain.value;
      if (p.videosource)     { CONFIG.videoSource = p.videosource.value; if (Song.cur) VideoSync.load(Song.cur); }
      if (p.videooffset)     { CONFIG.videoOffset = p.videooffset.value; VideoSync.sync(true); }
      if (p.showfps)         Debug.show(p.showfps.value);
      if (p.onlinevideos)    CONFIG.online = p.onlinevideos.value;
      if (p.ytrelay)         { CONFIG.ytRelay = String(p.ytrelay.value || '').trim(); YTRelay.broken = false; if (Song.cur) VideoSync.load(Song.cur); }
    },
    applyGeneralProperties(p) {
      if (p.fps) Clock.weFps = p.fps;
      Online.remember(p, true);
    },
    setPaused(paused) { Clock.setPaused(paused); Video.setPaused(paused); },
  };
  if (Online.hosted) Online.restore();
})();
