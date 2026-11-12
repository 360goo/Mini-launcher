/*
 * Tiny engine for the launcher's offline games. 1280x720 canvas, D-pad input.
 *
 * Engine.register(id, {
 *   title, icon (emoji), color (tile colour), help (one line of controls),
 *   lowerIsBetter (bool, e.g. time/moves),
 *   variants: [{name, ...options}],          // each variant is one launcher tile
 *   create(opts, api) -> { update(dt), draw(ctx), key(k, repeat), keyUp?(k) }
 * })
 * Keys: 'up' 'down' 'left' 'right' 'ok'.
 * The game area is x 0..1280, y api.TOP..720 (the engine draws a header bar above api.TOP).
 * Call api.setScore(n) to update the header, api.end({won, score, text}) to finish.
 */
(function () {
  const W = 1280, H = 720, TOP = 64;
  const canvas = document.getElementById('c');
  const ctx = canvas.getContext('2d');
  const games = {}, order = [];

  const store = {
    get(k) { try { return window.Android ? Android.get(k) : localStorage.getItem(k); } catch (e) { return null; } },
    set(k, v) { try { window.Android ? Android.set(k, String(v)) : localStorage.setItem(k, String(v)); } catch (e) {} }
  };

  // ------------------------------------------------------------- drawing helpers
  const C = {
    bg: '#0B0B0F', panel: '#1B1B22', panel2: '#26262F', line: '#34343F',
    text: '#F2F2F5', dim: '#8A8A96', accent: '#4F8CFF', good: '#3DDC84', bad: '#FF5A5F',
    warn: '#FFC542', pal: ['#FF5A5F', '#FFC542', '#3DDC84', '#4F8CFF', '#B36BFF', '#FF8A3D', '#2BD4D4', '#FF6FB5']
  };
  function text(s, x, y, size, color, align, weight) {
    ctx.font = (weight || 500) + ' ' + (size || 24) + 'px sans-serif';
    ctx.fillStyle = color || C.text;
    ctx.textAlign = align || 'left';
    ctx.textBaseline = 'middle';
    ctx.fillText(String(s), x, y);
  }
  function rect(x, y, w, h, color) { ctx.fillStyle = color; ctx.fillRect(x, y, w, h); }
  function rrect(x, y, w, h, r, color, stroke, lw) {
    r = Math.min(r, w / 2, h / 2);
    ctx.beginPath();
    ctx.moveTo(x + r, y); ctx.arcTo(x + w, y, x + w, y + h, r); ctx.arcTo(x + w, y + h, x, y + h, r);
    ctx.arcTo(x, y + h, x, y, r); ctx.arcTo(x, y, x + w, y, r); ctx.closePath();
    if (color) { ctx.fillStyle = color; ctx.fill(); }
    if (stroke) { ctx.strokeStyle = stroke; ctx.lineWidth = lw || 3; ctx.stroke(); }
  }
  function circle(x, y, r, color, stroke, lw) {
    ctx.beginPath(); ctx.arc(x, y, r, 0, Math.PI * 2);
    if (color) { ctx.fillStyle = color; ctx.fill(); }
    if (stroke) { ctx.strokeStyle = stroke; ctx.lineWidth = lw || 3; ctx.stroke(); }
  }
  const rnd = n => Math.floor(Math.random() * n);
  const pick = a => a[rnd(a.length)];
  function shuffle(a) { for (let i = a.length - 1; i > 0; i--) { const j = rnd(i + 1); [a[i], a[j]] = [a[j], a[i]]; } return a; }
  const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
  const DIRS = { up: [0, -1], down: [0, 1], left: [-1, 0], right: [1, 0] };

  // ------------------------------------------------------------- state machine
  let def = null, variant = 0, opts = null, game = null;
  let state = 'title';        // title | play | over
  let score = 0, result = null, best = null, last = 0, overAt = 0;
  const held = {};

  function bestKey() { return 'best:' + def.id + ':' + variant; }
  function loadBest() { const v = store.get(bestKey()); best = v == null ? null : Number(v); }

  const api = {
    W, H, TOP, C, ctx, text, rect, rrect, circle, rnd, pick, shuffle, clamp, DIRS, held,
    setScore(n) { score = n; },
    addScore(n) { score += n; },
    get score() { return score; },
    end(r) {
      if (state !== 'play') return;
      result = r || {};
      if (result.score == null) result.score = score;
      const s = result.score;
      const counts = def.lowerIsBetter ? result.won : true;  // only wins count for lower-is-better
      result.newBest = false;
      if (counts && s != null && (best == null || (def.lowerIsBetter ? s < best : s > best))) {
        best = s; result.newBest = true; store.set(bestKey(), s);
      }
      state = 'over'; overAt = performance.now();
    }
  };

  function start() {
    score = 0; result = null;
    game = def.create(opts, api);
    state = 'play';
  }

  const Engine = window.Engine = {
    api,
    register(id, d) { d.id = id; games[id] = d; order.push(id); },
    /** Flat list of launcher tiles, used to generate catalog.json. */
    catalog() {
      const out = [];
      for (const id of order) {
        const d = games[id];
        d.variants.forEach((v, i) => out.push({
          id, variant: i, title: d.title, variantName: d.variants.length > 1 ? v.name : (v.name || ''),
          icon: d.icon, color: d.color
        }));
      }
      return out;
    },
    key(k, repeat) {
      if (!def) return;
      held[k] = true;
      if (state === 'title') { if (k === 'ok' && !repeat) start(); return; }
      if (state === 'over') { if (k === 'ok' && !repeat && performance.now() - overAt > 400) start(); return; }
      game.key && game.key(k, !!repeat);
    },
    keyUp(k) { held[k] = false; if (state === 'play' && game.keyUp) game.keyUp(k); },
    /** For tests: start a game directly. */
    load(id, v) {
      def = games[id]; variant = v || 0;
      if (!def) return false;
      opts = Object.assign({}, def.variants[variant]);
      loadBest(); state = 'title'; game = null;
      return true;
    },
    start,
    get state() { return state; },
    get game() { return game; },
    boot() {
      const m = /^#([^/]*)\/(\d+)/.exec(location.hash) || [];
      if (!Engine.load(m[1] || order[0], Number(m[2] || 0))) Engine.load(order[0], 0);
      fit(); window.addEventListener('resize', fit);
      // Keyboard fallback (desktop testing / TV keyboards). On the TV the app forwards D-pad keys itself.
      const map = { ArrowUp: 'up', ArrowDown: 'down', ArrowLeft: 'left', ArrowRight: 'right', Enter: 'ok', ' ': 'ok' };
      window.addEventListener('keydown', e => { const k = map[e.key]; if (k) { e.preventDefault(); Engine.key(k, e.repeat); } });
      window.addEventListener('keyup', e => { const k = map[e.key]; if (k) Engine.keyUp(k); });
      requestAnimationFrame(frame);
    }
  };

  function fit() {
    const s = Math.min(window.innerWidth / W, window.innerHeight / H);
    canvas.style.width = (W * s) + 'px';
    canvas.style.height = (H * s) + 'px';
  }

  function frame(t) {
    const dt = Math.min(0.05, last ? (t - last) / 1000 : 0);
    last = t;
    try {
      if (state === 'play' && game.update) game.update(dt);
      draw();
    } catch (e) {
      rect(0, 0, W, H, C.bg); text('Error: ' + e.message, W / 2, H / 2, 24, C.bad, 'center');
      console.error(e);
    }
    requestAnimationFrame(frame);
  }

  function header() {
    rect(0, 0, W, TOP, '#121218');
    text(def.icon + '  ' + def.title, 32, TOP / 2, 26, C.text, 'left', 600);
    const vn = def.variants.length > 1 ? def.variants[variant].name : '';
    if (vn) text(vn, 32 + ctx.measureText(def.icon + '  ' + def.title).width + 24, TOP / 2, 20, C.dim);
    const right = (state !== 'title' ? 'Score ' + score : '') + (best != null ? '    Best ' + best : '');
    text(right, W - 32, TOP / 2, 22, C.dim, 'right');
  }

  function draw() {
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    rect(0, 0, W, H, C.bg);
    if (state === 'title') {
      header();
      text(def.icon, W / 2, 250, 120, C.text, 'center');
      text(def.title, W / 2, 380, 56, C.text, 'center', 700);
      const vn = def.variants[variant].name;
      if (vn && def.variants.length > 1) text(vn, W / 2, 440, 28, C.dim, 'center');
      if (def.help) text(def.help, W / 2, 520, 22, C.dim, 'center');
      rrect(W / 2 - 160, 580, 320, 64, 32, C.text);
      text('Press OK to start', W / 2, 612, 26, C.bg, 'center', 600);
      return;
    }
    ctx.save();
    game.draw(ctx);
    ctx.restore();
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    header();
    if (state === 'over') {
      ctx.fillStyle = 'rgba(0,0,0,0.65)'; ctx.fillRect(0, 0, W, H);
      rrect(W / 2 - 300, 190, 600, 340, 24, C.panel);
      const won = result.won;
      text(result.text || (won ? 'You win!' : 'Game over'), W / 2, 260, 48, won ? C.good : C.text, 'center', 700);
      if (result.score != null) text((def.scoreLabel || 'Score') + ': ' + result.score, W / 2, 330, 30, C.text, 'center');
      text(result.newBest ? '★ New best!' : (best != null ? 'Best: ' + best : ''), W / 2, 380, 24, result.newBest ? C.warn : C.dim, 'center');
      rrect(W / 2 - 160, 430, 320, 64, 32, C.text);
      text('OK to play again', W / 2, 462, 26, C.bg, 'center', 600);
      text('Back to exit', W / 2, 560, 20, C.dim, 'center');
    }
  }
})();
