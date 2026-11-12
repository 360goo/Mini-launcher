/* Casual, word, number and puzzle games. See engine.js for the API. */
(function () {
  const { register } = Engine;

  // Shared: tiny beeper (optional, silently ignored if audio is unavailable).
  let actx = null;
  function beep(freq, dur, type) {
    try {
      actx = actx || new (window.AudioContext || window.webkitAudioContext)();
      const o = actx.createOscillator(), g = actx.createGain();
      o.type = type || 'sine'; o.frequency.value = freq;
      g.gain.setValueAtTime(0.15, actx.currentTime);
      g.gain.exponentialRampToValueAtTime(0.001, actx.currentTime + (dur || 0.2));
      o.connect(g); g.connect(actx.destination);
      o.start(); o.stop(actx.currentTime + (dur || 0.2));
    } catch (e) { /* no audio */ }
  }

  // Move a cursor among arbitrary points (screen coords) in a D-pad direction.
  function nearestInDir(points, cur, d) {
    const p = points[cur];
    let best = -1, bestScore = Infinity;
    points.forEach((q, i) => {
      if (i === cur || q.off) return;
      const dx = q.x - p.x, dy = q.y - p.y;
      const along = dx * d[0] + dy * d[1];
      if (along <= 1) return;
      const across = Math.abs(dx * d[1] - dy * d[0]);
      const s = along + across * 2.5;
      if (s < bestScore) { bestScore = s; best = i; }
    });
    return best < 0 ? cur : best;
  }

  // ------------------------------------------------------------------ Echo
  register('echo', {
    title: 'Echo', icon: '🔊', color: '#7B3FBF',
    help: 'Watch the pads light up, then repeat with the arrows',
    variants: [{ name: 'Normal', speed: 1 }, { name: 'Fast', speed: 1.8 }],
    create(o, api) {
      const { W, H, TOP, C } = api;
      const pads = ['up', 'right', 'down', 'left'];
      const colors = ['#3DDC84', '#FF5A5F', '#FFC542', '#4F8CFF'];
      const tones = [392, 330, 262, 523];
      const cx = W / 2, cy = (TOP + H) / 2 + 10, R = 200;
      const pos = [[0, -1], [1, 0], [0, 1], [-1, 0]];
      let seq = [], phase = 'show', idx = 0, t = 0, lit = -1, litT = 0, input = 0, msg = 'Watch…';
      function next() { seq.push(api.rnd(4)); phase = 'show'; idx = 0; t = -0.6; msg = 'Watch…'; }
      next();
      const on = 0.55 / o.speed, gap = 0.2 / o.speed;
      function flash(i) { lit = i; litT = Math.min(on, 0.35); beep(tones[i], 0.25); }
      return {
        key(k, rep) {
          if (phase !== 'input' || rep) return;
          const i = pads.indexOf(k); if (i < 0) return;
          flash(i);
          if (i !== seq[input]) { beep(110, 0.5, 'square'); api.end({ won: false, text: 'Wrong pad!' }); return; }
          input++;
          if (input === seq.length) { api.setScore(seq.length); phase = 'wait'; t = 0; msg = 'Nice!'; }
        },
        update(dt) {
          if (litT > 0) { litT -= dt; if (litT <= 0) lit = -1; }
          t += dt;
          if (phase === 'show') {
            if (t >= 0 && idx < seq.length && t >= idx * (on + gap)) { lit = seq[idx]; litT = on; beep(tones[seq[idx]], on * 0.9); idx++; }
            if (idx >= seq.length && t >= seq.length * (on + gap)) { phase = 'input'; input = 0; msg = 'Your turn'; }
          } else if (phase === 'wait' && t > 0.8) next();
        },
        draw() {
          pads.forEach((p, i) => {
            const x = cx + pos[i][0] * R * 0.9, y = cy + pos[i][1] * R * 0.9;
            api.circle(x, y, 95, lit === i ? colors[i] : colors[i] + '44', lit === i ? '#fff' : null, 6);
          });
          api.circle(cx, cy, 70, C.panel);
          api.text(seq.length, cx, cy - 10, 44, C.text, 'center', 700);
          api.text(msg, cx, cy + 32, 18, C.dim, 'center');
        }
      };
    }
  });

  // ------------------------------------------------------------------ Hangman
  const WORDS = {
    animals: 'ELEPHANT GIRAFFE KANGAROO PENGUIN DOLPHIN TIGER LION ZEBRA MONKEY RABBIT TURTLE SQUIRREL HEDGEHOG OCTOPUS CHEETAH LEOPARD BUFFALO CAMEL DONKEY FLAMINGO GORILLA HIPPOPOTAMUS JAGUAR KOALA LOBSTER MEERKAT OSTRICH PANTHER PELICAN RACCOON RHINOCEROS SALMON SCORPION SPARROW TORTOISE WALRUS WOLF BADGER BEAVER CROCODILE FALCON HAMSTER LIZARD MOOSE PEACOCK',
    countries: 'INDIA BRAZIL CANADA FRANCE GERMANY JAPAN MEXICO EGYPT KENYA SPAIN ITALY CHINA RUSSIA NORWAY SWEDEN FINLAND IRELAND PORTUGAL GREECE TURKEY THAILAND VIETNAM INDONESIA MALAYSIA PHILIPPINES AUSTRALIA ARGENTINA CHILE PERU COLOMBIA NIGERIA GHANA MOROCCO ICELAND POLAND AUSTRIA BELGIUM DENMARK HUNGARY NEPAL BHUTAN PAKISTAN SINGAPORE MONGOLIA CUBA JAMAICA',
    food: 'PIZZA PASTA BURGER SANDWICH PANCAKE WAFFLE NOODLES DUMPLING CURRY BISCUIT CHOCOLATE AVOCADO BANANA MANGO PINEAPPLE STRAWBERRY BLUEBERRY WATERMELON CARROT POTATO TOMATO CUCUMBER BROCCOLI CABBAGE ONION GARLIC CHEESE BUTTER YOGURT OMELETTE POPCORN PRETZEL MUFFIN CUPCAKE DOUGHNUT PUDDING LEMONADE COCONUT ALMOND PEANUT CINNAMON SAMOSA BIRYANI LASAGNA TACO'
  };
  Object.keys(WORDS).forEach(k => { WORDS[k] = WORDS[k].split(' '); });
  WORDS.mixed = WORDS.animals.concat(WORDS.countries, WORDS.food);
  register('hangman', {
    title: 'Hangman', icon: '🪢', color: '#8C5A2B',
    help: 'Arrows pick a letter · OK guesses · 6 misses and you\'re out',
    variants: [
      { name: 'Animals', list: 'animals' }, { name: 'Countries', list: 'countries' },
      { name: 'Food', list: 'food' }, { name: 'Mixed', list: 'mixed' }
    ],
    create(o, api) {
      const { W, C } = api;
      const COLS = 9, letters = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ'.split('');
      const pool = api.shuffle(WORDS[o.list].slice());
      let word, guessed, misses, cur = 0, solved = 0, pause = 0, lastWord = '';
      function newWord() { word = pool[solved % pool.length]; guessed = new Set(); misses = 0; }
      newWord();
      const done = () => word.split('').every(ch => guessed.has(ch));
      return {
        key(k) {
          if (pause > 0) return;
          const d = api.DIRS[k];
          if (d) {
            let r = Math.floor(cur / COLS), c = cur % COLS;
            const rows = Math.ceil(letters.length / COLS);
            c = (c + d[0] + COLS) % COLS; r = (r + d[1] + rows) % rows;
            cur = Math.min(letters.length - 1, r * COLS + c);
            return;
          }
          if (k !== 'ok') return;
          const L = letters[cur];
          if (guessed.has(L)) return;
          guessed.add(L);
          if (word.indexOf(L) < 0) {
            misses++;
            if (misses >= 6) api.end({ won: false, text: 'It was ' + word });
          } else if (done()) {
            solved++; api.addScore(10 + (6 - misses) * 5); lastWord = word; pause = 1.2;
          }
        },
        update(dt) { if (pause > 0) { pause -= dt; if (pause <= 0) newWord(); } },
        draw(ctx) {
          // Gallows
          ctx.strokeStyle = C.dim; ctx.lineWidth = 6; ctx.lineCap = 'round';
          ctx.beginPath(); ctx.moveTo(80, 600); ctx.lineTo(300, 600); ctx.moveTo(130, 600); ctx.lineTo(130, 120);
          ctx.lineTo(260, 120); ctx.lineTo(260, 170); ctx.stroke();
          ctx.strokeStyle = C.text;
          if (misses > 0) api.circle(260, 205, 35, null, C.text, 6);
          ctx.beginPath();
          if (misses > 1) { ctx.moveTo(260, 240); ctx.lineTo(260, 380); }
          if (misses > 2) { ctx.moveTo(260, 270); ctx.lineTo(210, 330); }
          if (misses > 3) { ctx.moveTo(260, 270); ctx.lineTo(310, 330); }
          if (misses > 4) { ctx.moveTo(260, 380); ctx.lineTo(215, 470); }
          if (misses > 5) { ctx.moveTo(260, 380); ctx.lineTo(305, 470); }
          ctx.stroke();
          // Word
          const show = pause > 0 ? lastWord : word;
          const n = show.length, slot = Math.min(60, 820 / n), x0 = 400 + (840 - slot * n) / 2;
          show.split('').forEach((ch, i) => {
            const x = x0 + i * slot;
            api.rect(x + 6, 230, slot - 12, 4, C.dim);
            if (guessed.has(ch) || pause > 0) api.text(ch, x + slot / 2, 200, Math.min(48, slot * 0.8), pause > 0 ? C.good : C.text, 'center', 700);
          });
          api.text('Misses ' + misses + '/6   ·   Words ' + solved, 820, 130, 22, C.dim, 'center');
          // Letter grid
          const cw = 84, ch = 76, gx = 820 - (COLS * cw) / 2, gy = 320;
          letters.forEach((L, i) => {
            const x = gx + (i % COLS) * cw, y = gy + Math.floor(i / COLS) * ch;
            const used = guessed.has(L), hit = used && word.indexOf(L) >= 0;
            api.rrect(x + 4, y + 4, cw - 8, ch - 8, 10, used ? (hit ? '#1E5E3A' : '#3A1E22') : C.panel, i === cur ? '#fff' : null, 4);
            api.text(L, x + cw / 2, y + ch / 2, 30, used ? C.dim : C.text, 'center', 600);
          });
        }
      };
    }
  });

  // ------------------------------------------------------------------ Gem Swap (match-3)
  register('match3', {
    title: 'Gem Swap', icon: '💎', color: '#1F6FB2',
    help: 'Arrows move · OK selects a gem · then an arrow swaps it · line up 3+',
    variants: [{ name: 'Timed', time: 90 }, { name: 'Moves', moves: 30 }],
    create(o, api) {
      const { W, H, TOP, C } = api;
      const N = 8, K = 6, cell = 76, ox = (W - N * cell) / 2 - 140, oy = TOP + (H - TOP - N * cell) / 2;
      const gemColors = ['#FF5A5F', '#FFC542', '#3DDC84', '#4F8CFF', '#B36BFF', '#FF8A3D'];
      let b = [], cx = 3, cy = 3, sel = false, phase = 'idle', t = 0, combo = 0, clearing = null;
      let time = o.time || 0, moves = o.moves || 0, msg = '';
      const at = (x, y) => b[y * N + x];
      function findMatches(board) {
        const m = new Set();
        for (let y = 0; y < N; y++) for (let x = 0; x < N; x++) {
          const v = board[y * N + x]; if (v < 0) continue;
          if (x < N - 2 && board[y * N + x + 1] === v && board[y * N + x + 2] === v) [0, 1, 2].forEach(i => m.add(y * N + x + i));
          if (y < N - 2 && board[(y + 1) * N + x] === v && board[(y + 2) * N + x] === v) [0, 1, 2].forEach(i => m.add((y + i) * N + x));
        }
        return m;
      }
      function hasMove(board) {
        for (let y = 0; y < N; y++) for (let x = 0; x < N; x++) for (const [dx, dy] of [[1, 0], [0, 1]]) {
          const nx = x + dx, ny = y + dy; if (nx >= N || ny >= N) continue;
          const c = board.slice(); const i = y * N + x, j = ny * N + nx;
          [c[i], c[j]] = [c[j], c[i]];
          if (findMatches(c).size) return true;
        }
        return false;
      }
      function fresh() {
        do {
          b = [];
          for (let i = 0; i < N * N; i++) {
            let v; const x = i % N, y = Math.floor(i / N);
            do { v = api.rnd(K); } while ((x >= 2 && b[i - 1] === v && b[i - 2] === v) || (y >= 2 && b[i - N] === v && b[i - 2 * N] === v));
            b.push(v);
          }
        } while (!hasMove(b));
      }
      fresh();
      function trySwap(d) {
        const nx = cx + d[0], ny = cy + d[1];
        if (nx < 0 || ny < 0 || nx >= N || ny >= N) return;
        const i = cy * N + cx, j = ny * N + nx;
        [b[i], b[j]] = [b[j], b[i]];
        if (!findMatches(b).size) { [b[i], b[j]] = [b[j], b[i]]; msg = 'No match'; t = 0; return; }
        cx = nx; cy = ny; sel = false; combo = 0; msg = '';
        if (o.moves) moves--;
        phase = 'resolve'; t = 0;
      }
      function step() {
        const m = findMatches(b);
        if (!m.size) {
          phase = 'idle';
          if (!hasMove(b)) { msg = 'Shuffled!'; fresh(); }
          if (o.moves && moves <= 0) api.end({ won: true, text: 'Out of moves' });
          return;
        }
        combo++;
        api.addScore(m.size * 10 * combo);
        m.forEach(i => { b[i] = -1; });
        // gravity + refill
        for (let x = 0; x < N; x++) {
          const col = [];
          for (let y = N - 1; y >= 0; y--) if (b[y * N + x] >= 0) col.push(b[y * N + x]);
          for (let y = N - 1, k = 0; y >= 0; y--, k++) b[y * N + x] = k < col.length ? col[k] : api.rnd(K);
        }
        clearing = m; t = 0;
      }
      return {
        _board: () => b, _findMatches: findMatches, _hasMove: hasMove,
        key(k) {
          if (phase !== 'idle') return;
          const d = api.DIRS[k];
          if (k === 'ok') { sel = !sel; return; }
          if (!d) return;
          if (sel) trySwap(d);
          else { cx = api.clamp(cx + d[0], 0, N - 1); cy = api.clamp(cy + d[1], 0, N - 1); }
        },
        update(dt) {
          t += dt;
          if (o.time) { time -= dt; if (time <= 0 && phase === 'idle') { time = 0; api.end({ won: true, text: 'Time\'s up!' }); return; } }
          if (phase === 'resolve' && t > 0.22) { clearing = null; step(); }
        },
        draw() {
          api.rrect(ox - 8, oy - 8, N * cell + 16, N * cell + 16, 12, C.panel);
          for (let y = 0; y < N; y++) for (let x = 0; x < N; x++) {
            const v = at(x, y), px = ox + x * cell + cell / 2, py = oy + y * cell + cell / 2;
            const flash = clearing && clearing.has(y * N + x);
            if (v >= 0) {
              ctxDiamond(px, py, cell * 0.36, gemColors[v], flash);
            }
          }
          const sx = ox + cx * cell, sy = oy + cy * cell;
          api.rrect(sx + 3, sy + 3, cell - 6, cell - 6, 10, sel ? 'rgba(255,255,255,0.18)' : null, '#fff', sel ? 6 : 3);
          const px = ox + N * cell + 60;
          api.text(o.time ? 'Time' : 'Moves', px, oy + 40, 24, C.dim);
          api.text(o.time ? Math.ceil(time) : moves, px, oy + 90, 56, C.text, 'left', 700);
          api.text('Score', px, oy + 170, 24, C.dim);
          api.text(api.score, px, oy + 220, 44, C.text, 'left', 700);
          if (sel) api.text('Pick a direction', px, oy + 300, 20, C.warn);
          if (msg && t < 1.2) api.text(msg, px, oy + 340, 20, C.dim);
        }
      };
      function ctxDiamond(x, y, r, color, flash) {
        const c = api.ctx;
        c.beginPath(); c.moveTo(x, y - r); c.lineTo(x + r, y); c.lineTo(x, y + r); c.lineTo(x - r, y); c.closePath();
        c.fillStyle = flash ? '#fff' : color; c.fill();
        c.beginPath(); c.moveTo(x, y - r); c.lineTo(x + r * 0.45, y - r * 0.1); c.lineTo(x - r * 0.45, y - r * 0.1); c.closePath();
        c.fillStyle = 'rgba(255,255,255,0.35)'; c.fill();
      }
    }
  });

  // ------------------------------------------------------------------ Whack-a-Mole
  register('whack', {
    title: 'Whack-a-Mole', icon: '🔨', color: '#6B8E23',
    help: 'Arrows move the hammer · OK whacks · 60 seconds',
    variants: [{ name: 'Normal', up: [0.9, 1.6], spawn: 0.8 }, { name: 'Fast', up: [0.5, 0.9], spawn: 0.45 }],
    create(o, api) {
      const { W, H, TOP, C } = api;
      const holes = Array.from({ length: 9 }, () => ({ t: 0, hit: 0 }));
      let cur = 4, time = 60, spawnT = 0.5, swing = 0, hits = 0, missed = 0;
      const cell = 190, ox = W / 2 - cell * 1.5, oy = TOP + 40;
      return {
        key(k) {
          const d = api.DIRS[k];
          if (d) { const x = api.clamp(cur % 3 + d[0], 0, 2), y = api.clamp(Math.floor(cur / 3) + d[1], 0, 2); cur = y * 3 + x; return; }
          if (k !== 'ok') return;
          swing = 0.15;
          const h = holes[cur];
          if (h.t > 0 && !h.hit) { h.hit = 0.3; h.t = 0.3; hits++; api.addScore(10); beep(660, 0.08, 'square'); }
        },
        update(dt) {
          time -= dt; swing = Math.max(0, swing - dt);
          if (time <= 0) { api.end({ won: true, text: hits + ' moles whacked' }); return; }
          spawnT -= dt;
          if (spawnT <= 0) {
            spawnT = o.spawn * (0.6 + Math.random() * 0.8);
            const free = holes.map((h, i) => i).filter(i => holes[i].t <= 0);
            if (free.length) { const h = holes[api.pick(free)]; h.t = o.up[0] + Math.random() * (o.up[1] - o.up[0]); h.hit = 0; }
          }
          holes.forEach(h => { if (h.t > 0) { h.t -= dt; if (h.t <= 0 && !h.hit) missed++; } });
        },
        draw() {
          holes.forEach((h, i) => {
            const x = ox + (i % 3) * cell + cell / 2, y = oy + Math.floor(i / 3) * cell + cell / 2;
            api.ctx.beginPath(); api.ctx.ellipse(x, y + 40, 70, 26, 0, 0, Math.PI * 2); api.ctx.fillStyle = '#2A1D14'; api.ctx.fill();
            if (h.t > 0) {
              api.circle(x, y, 52, h.hit ? '#7A5A40' : '#9B6B43');
              api.text(h.hit ? '✖✖' : '• •', x, y - 8, 24, '#1A1A1A', 'center', 900);
              api.circle(x, y + 14, 10, '#E07A7A');
            }
            if (i === cur) api.rrect(x - cell / 2 + 10, y - cell / 2 + 10, cell - 20, cell - 20, 16, null, '#fff', 4);
            if (i === cur) api.text('🔨', x + 50, y - 40 + (swing > 0 ? 25 : 0), 54, C.text, 'center');
          });
          api.text('Time ' + Math.ceil(time), 120, TOP + 60, 30, C.text, 'left', 700);
          api.text('Missed ' + missed, 120, TOP + 105, 22, C.dim);
        }
      };
    }
  });

  // ------------------------------------------------------------------ Math Quiz
  register('math', {
    title: 'Math Quiz', icon: '➗', color: '#C0392B',
    help: 'Arrows pick an answer · OK locks it in · 60 seconds',
    variants: [{ name: 'Addition', ops: '+' }, { name: 'Subtraction', ops: '-' }, { name: 'Multiplication', ops: '×' }, { name: 'Mixed', ops: '+-×' }],
    create(o, api) {
      const { W, H, TOP, C } = api;
      let time = 60, q, cur = 0, streak = 0, right = 0, flash = 0, flashGood = true;
      function newQ() {
        const op = o.ops[api.rnd(o.ops.length)];
        let a, b, ans;
        if (op === '+') { a = 2 + api.rnd(60); b = 2 + api.rnd(60); ans = a + b; }
        else if (op === '-') { a = 10 + api.rnd(90); b = 1 + api.rnd(a); ans = a - b; }
        else { a = 2 + api.rnd(11); b = 2 + api.rnd(11); ans = a * b; }
        const opts = new Set([ans]);
        while (opts.size < 4) { const d = (1 + api.rnd(10)) * (Math.random() < 0.5 ? -1 : 1); if (ans + d >= 0) opts.add(ans + d); }
        q = { text: a + ' ' + op + ' ' + b, ans, opts: api.shuffle([...opts]) };
      }
      newQ();
      return {
        key(k) {
          const d = api.DIRS[k];
          if (d) { const x = api.clamp(cur % 2 + d[0], 0, 1), y = api.clamp(Math.floor(cur / 2) + d[1], 0, 1); cur = y * 2 + x; return; }
          if (k !== 'ok') return;
          if (q.opts[cur] === q.ans) { streak++; right++; api.addScore(10 + Math.min(streak - 1, 10) * 2); flashGood = true; beep(880, 0.08); }
          else { streak = 0; flashGood = false; beep(160, 0.2, 'square'); }
          flash = 0.3; newQ();
        },
        update(dt) { time -= dt; flash -= dt; if (time <= 0) api.end({ won: true, text: right + ' correct' }); },
        draw() {
          if (flash > 0) api.rect(0, TOP, W, H - TOP, flashGood ? 'rgba(61,220,132,0.12)' : 'rgba(255,90,95,0.15)');
          api.text('Time ' + Math.max(0, Math.ceil(time)), 60, TOP + 50, 28, C.text, 'left', 700);
          api.text('Streak ' + streak, W - 60, TOP + 50, 28, streak > 2 ? C.warn : C.dim, 'right', 700);
          api.text(q.text + ' = ?', W / 2, TOP + 150, 72, C.text, 'center', 700);
          q.opts.forEach((v, i) => {
            const x = W / 2 - 310 + (i % 2) * 320, y = TOP + 260 + Math.floor(i / 2) * 150;
            api.rrect(x, y, 300, 120, 18, C.panel, i === cur ? '#fff' : null, 5);
            api.text(v, x + 150, y + 60, 48, C.text, 'center', 600);
          });
        }
      };
    }
  });

  // ------------------------------------------------------------------ Number Guess
  register('guess', {
    title: 'Number Guess', icon: '🔢', color: '#2C7A7B',
    help: 'Up/Down ±1 · Left/Right ±10 · OK to guess',
    lowerIsBetter: true, scoreLabel: 'Guesses',
    variants: [{ name: '1–100', max: 100 }, { name: '1–1000', max: 1000 }],
    create(o, api) {
      const { W, TOP, C } = api;
      const secret = 1 + api.rnd(o.max);
      let pick = Math.ceil(o.max / 2), lo = 1, hi = o.max, guesses = 0, hint = 'I\'m thinking of a number from 1 to ' + o.max, history = [];
      return {
        key(k) {
          const step = { up: 1, down: -1, right: 10, left: -10 }[k];
          if (step) { pick = api.clamp(pick + step, 1, o.max); return; }
          if (k !== 'ok') return;
          guesses++; api.setScore(guesses);
          if (pick === secret) { api.end({ won: true, score: guesses, text: secret + ' in ' + guesses + '!' }); return; }
          if (pick < secret) { hint = pick + ' is too low ⬆'; lo = Math.max(lo, pick + 1); }
          else { hint = pick + ' is too high ⬇'; hi = Math.min(hi, pick - 1); }
          history.unshift(pick);
          pick = api.clamp(Math.round((lo + hi) / 2), 1, o.max);
        },
        draw() {
          api.text(hint, W / 2, TOP + 80, 30, C.text, 'center');
          api.rrect(W / 2 - 200, TOP + 150, 400, 200, 24, C.panel, '#fff', 4);
          api.text('▲', W / 2, TOP + 175, 22, C.dim, 'center');
          api.text(pick, W / 2, TOP + 250, 100, C.text, 'center', 700);
          api.text('▼', W / 2, TOP + 325, 22, C.dim, 'center');
          api.text('◀ −10', W / 2 - 290, TOP + 250, 24, C.dim, 'center');
          api.text('+10 ▶', W / 2 + 290, TOP + 250, 24, C.dim, 'center');
          api.text('Range: ' + lo + ' – ' + hi, W / 2, TOP + 420, 26, C.accent, 'center');
          api.text(history.slice(0, 10).join('   '), W / 2, TOP + 490, 22, C.dim, 'center');
        }
      };
    }
  });

  // ------------------------------------------------------------------ Reaction Time
  register('reaction', {
    title: 'Reaction Time', icon: '⚡', color: '#D4A017',
    help: 'Wait for green, then press OK as fast as you can · 5 rounds',
    lowerIsBetter: true, scoreLabel: 'Avg ms',
    variants: [{ name: '' }],
    create(o, api) {
      const { W, H, TOP, C } = api;
      let phase = 'wait', t = 0, delay = 1.5 + Math.random() * 2.5, times = [], early = 0, last = null;
      function nextRound() { phase = 'wait'; t = 0; delay = 1.5 + Math.random() * 2.5; }
      return {
        key(k, rep) {
          if (k !== 'ok' || rep) return;
          if (phase === 'wait') { early++; last = 'early'; nextRound(); beep(150, 0.2, 'square'); return; }
          if (phase === 'go') {
            const ms = Math.round(t * 1000); times.push(ms); last = ms; phase = 'shown'; t = 0;
            const avg = Math.round(times.reduce((a, b) => a + b, 0) / times.length) + early * 100;
            api.setScore(avg);
            if (times.length >= 5) api.end({ won: true, score: avg, text: 'Average ' + avg + ' ms' });
            return;
          }
          if (phase === 'shown') nextRound();
        },
        update(dt) {
          t += dt;
          if (phase === 'wait' && t >= delay) { phase = 'go'; t = 0; }
          if (phase === 'shown' && t > 1.2) nextRound();
        },
        draw() {
          const col = phase === 'go' ? '#1F9D55' : phase === 'wait' ? '#8E2B2B' : C.panel;
          api.rect(0, TOP, W, H - TOP, col);
          const big = phase === 'go' ? 'PRESS OK!' : phase === 'wait' ? 'Wait for green…' : last + ' ms';
          api.text(big, W / 2, H / 2 - 20, 72, C.text, 'center', 700);
          if (last === 'early' && phase === 'wait') api.text('Too early! +100 ms penalty', W / 2, H / 2 + 60, 28, C.warn, 'center');
          api.text('Round ' + Math.min(times.length + 1, 5) + ' / 5' + (early ? '   ·   early presses: ' + early : ''), W / 2, H - 60, 24, C.text, 'center');
        }
      };
    }
  });

  // ------------------------------------------------------------------ Picture Logic (nonogram)
  register('nonogram', {
    title: 'Picture Logic', icon: '🧩', color: '#4B5D8C',
    help: 'Arrows move · OK cycles: fill → mark ✕ → empty · match the number clues',
    lowerIsBetter: true, scoreLabel: 'Seconds',
    variants: [{ name: '5×5', n: 5 }, { name: '10×10', n: 10 }],
    create(o, api) {
      const { W, H, TOP, C } = api;
      const n = o.n;
      let sol;
      do { sol = Array.from({ length: n * n }, () => Math.random() < 0.58 ? 1 : 0); } while (sol.every(v => v) || sol.every(v => !v));
      const runs = arr => { const r = []; let c = 0; arr.forEach(v => { if (v === 1) c++; else if (c) { r.push(c); c = 0; } }); if (c) r.push(c); return r.length ? r : [0]; };
      const row = (g, y) => g.slice(y * n, y * n + n);
      const col = (g, x) => Array.from({ length: n }, (_, y) => g[y * n + x]);
      const rowClues = Array.from({ length: n }, (_, y) => runs(row(sol, y)));
      const colClues = Array.from({ length: n }, (_, x) => runs(col(sol, x)));
      const grid = new Array(n * n).fill(0); // 0 empty, 1 filled, 2 X
      let cx = 0, cy = 0, time = 0;
      const maxRow = Math.max(...rowClues.map(c => c.length)), maxCol = Math.max(...colClues.map(c => c.length));
      const cell = Math.floor(Math.min((W - 300) / (n + maxRow * 0.6), (H - TOP - 40) / (n + maxCol * 0.6)));
      const clueW = maxRow * cell * 0.6, clueH = maxCol * cell * 0.6;
      const ox = (W - (n * cell + clueW)) / 2 + clueW, oy = TOP + 20 + clueH;
      const same = (a, b) => a.length === b.length && a.every((v, i) => v === b[i]);
      const fill = g => g.map(v => v === 1 ? 1 : 0);
      function solved() {
        const f = fill(grid);
        for (let i = 0; i < n; i++) if (!same(runs(row(f, i)), rowClues[i]) || !same(runs(col(f, i)), colClues[i])) return false;
        return true;
      }
      return {
        key(k) {
          const d = api.DIRS[k];
          if (d) { cx = (cx + d[0] + n) % n; cy = (cy + d[1] + n) % n; return; }
          if (k !== 'ok') return;
          const i = cy * n + cx; grid[i] = (grid[i] + 1) % 3;
          if (solved()) api.end({ won: true, score: Math.floor(time), text: 'Picture complete!' });
        },
        update(dt) { time += dt; api.setScore(Math.floor(time)); },
        draw() {
          const f = fill(grid), fs = Math.max(14, cell * 0.38);
          for (let y = 0; y < n; y++) {
            const ok = same(runs(row(f, y)), rowClues[y]);
            rowClues[y].slice().reverse().forEach((c, j) => api.text(c, ox - (j + 0.5) * cell * 0.6, oy + y * cell + cell / 2, fs, ok ? C.good : (y === cy ? C.text : C.dim), 'center', 600));
          }
          for (let x = 0; x < n; x++) {
            const ok = same(runs(col(f, x)), colClues[x]);
            colClues[x].slice().reverse().forEach((c, j) => api.text(c, ox + x * cell + cell / 2, oy - (j + 0.5) * cell * 0.6, fs, ok ? C.good : (x === cx ? C.text : C.dim), 'center', 600));
          }
          for (let y = 0; y < n; y++) for (let x = 0; x < n; x++) {
            const v = grid[y * n + x], px = ox + x * cell, py = oy + y * cell;
            api.rect(px + 1, py + 1, cell - 2, cell - 2, v === 1 ? '#E8E8F0' : C.panel);
            if (v === 2) api.text('✕', px + cell / 2, py + cell / 2, cell * 0.5, C.bad, 'center', 700);
          }
          api.ctx.strokeStyle = C.dim; api.ctx.lineWidth = 2;
          for (let i = 0; i <= n; i += 5) {
            api.ctx.beginPath(); api.ctx.moveTo(ox + i * cell, oy); api.ctx.lineTo(ox + i * cell, oy + n * cell);
            api.ctx.moveTo(ox, oy + i * cell); api.ctx.lineTo(ox + n * cell, oy + i * cell); api.ctx.stroke();
          }
          api.rrect(ox + cx * cell - 2, oy + cy * cell - 2, cell + 4, cell + 4, 6, null, C.accent, 4);
        }
      };
    }
  });

  // ------------------------------------------------------------------ Peg Solitaire
  register('pegs', {
    title: 'Peg Solitaire', icon: '📍', color: '#9C6B30',
    help: 'Pick a peg with OK · arrow chooses where it jumps · OK confirms',
    lowerIsBetter: true, scoreLabel: 'Pegs left',
    variants: [{ name: 'English Cross', board: 'cross' }, { name: 'Triangle', board: 'tri' }],
    create(o, api) {
      const { W, H, TOP, C } = api;
      const holes = []; // {r,c,x,y,peg}
      const idx = {};
      let dirs;
      if (o.board === 'cross') {
        const sp = 82, ox = W / 2 - 3 * sp, oy = TOP + 50 + 10;
        for (let r = 0; r < 7; r++) for (let c = 0; c < 7; c++) {
          if ((r < 2 || r > 4) && (c < 2 || c > 4)) continue;
          idx[r + ',' + c] = holes.length;
          holes.push({ r, c, x: ox + c * sp, y: oy + r * sp, peg: !(r === 3 && c === 3) });
        }
        dirs = [[0, 1], [0, -1], [1, 0], [-1, 0]];
      } else {
        const sp = 110, oy = TOP + 80;
        for (let r = 0; r < 5; r++) for (let c = 0; c <= r; c++) {
          idx[r + ',' + c] = holes.length;
          holes.push({ r, c, x: W / 2 + (c - r / 2) * sp, y: oy + r * sp * 0.87, peg: !(r === 0 && c === 0) });
        }
        dirs = [[0, 1], [0, -1], [1, 0], [-1, 0], [1, 1], [-1, -1]];
      }
      const get = (r, c) => { const i = idx[r + ',' + c]; return i == null ? null : holes[i]; };
      function jumpsFrom(i) {
        const h = holes[i], out = [];
        if (!h.peg) return out;
        dirs.forEach(([dr, dc]) => {
          const mid = get(h.r + dr, h.c + dc), to = get(h.r + 2 * dr, h.c + 2 * dc);
          if (mid && to && mid.peg && !to.peg) out.push({ mid: holes.indexOf(mid), to: holes.indexOf(to) });
        });
        return out;
      }
      const pegCount = () => holes.filter(h => h.peg).length;
      const anyMove = () => holes.some((h, i) => jumpsFrom(i).length);
      let cur = holes.findIndex(h => h.peg), sel = -1, targets = [], tsel = 0, msg = '';
      api.setScore(pegCount());
      return {
        key(k) {
          const d = api.DIRS[k];
          if (sel >= 0) {
            if (d) {
              // pick the target that best matches the direction
              const p = holes[sel];
              let bi = -1, bs = 0;
              targets.forEach((t, i) => {
                const q = holes[t.to], dx = q.x - p.x, dy = q.y - p.y, len = Math.hypot(dx, dy);
                const s = (dx * d[0] + dy * d[1]) / len;
                if (s > bs) { bs = s; bi = i; }
              });
              if (bi >= 0) tsel = bi;
              return;
            }
            if (k === 'ok') {
              const t = targets[tsel];
              if (t) {
                holes[sel].peg = false; holes[t.mid].peg = false; holes[t.to].peg = true;
                cur = t.to; sel = -1; api.setScore(pegCount());
                if (!anyMove()) {
                  const left = pegCount();
                  api.end({ won: true, score: left, text: left === 1 ? 'Perfect — one peg!' : 'No more moves' });
                }
              }
              return;
            }
            return;
          }
          if (d) {
            const pts = holes.map(h => ({ x: h.x, y: h.y }));
            cur = nearestInDir(pts, cur, d); msg = ''; return;
          }
          if (k === 'ok') {
            const j = jumpsFrom(cur);
            if (!j.length) { msg = holes[cur].peg ? 'That peg can\'t jump' : 'Pick a peg'; return; }
            sel = cur; targets = j; tsel = 0; msg = '';
          }
        },
        draw() {
          holes.forEach((h, i) => {
            api.circle(h.x, h.y, 30, '#2A2A33');
            if (h.peg) api.circle(h.x, h.y, 24, i === sel ? C.warn : '#D9A066');
          });
          if (sel >= 0) targets.forEach((t, i) => api.circle(holes[t.to].x, holes[t.to].y, 26, null, i === tsel ? C.good : C.good + '66', i === tsel ? 6 : 3));
          const h = holes[sel >= 0 ? sel : cur];
          api.circle(h.x, h.y, 36, null, '#fff', 4);
          api.text(sel >= 0 ? 'Arrows: choose jump · OK: jump' : msg, W / 2, H - 30, 22, sel >= 0 ? C.good : C.dim, 'center');
          if (sel >= 0 && !targets.length) sel = -1;
        },
        _cancel() { sel = -1; }
      };
    }
  });

  // ------------------------------------------------------------------ Tower Puzzle (Hanoi)
  register('hanoi', {
    title: 'Tower Puzzle', icon: '🗼', color: '#5D6D7E',
    help: 'Move the whole tower to another peg · never a big disk on a small one',
    lowerIsBetter: true, scoreLabel: 'Moves',
    variants: [{ name: '4 Disks', n: 4 }, { name: '5 Disks', n: 5 }, { name: '6 Disks', n: 6 }],
    create(o, api) {
      const { W, H, TOP, C } = api;
      const pegs = [[], [], []];
      for (let d = o.n; d >= 1; d--) pegs[0].push(d);
      let cur = 0, held = null, from = -1, moves = 0, msg = 'Best possible: ' + (Math.pow(2, o.n) - 1) + ' moves';
      const base = H - 90, pegX = i => W / 2 + (i - 1) * 380, dh = 40;
      return {
        key(k) {
          if (k === 'left') { cur = (cur + 2) % 3; return; }
          if (k === 'right') { cur = (cur + 1) % 3; return; }
          if (k === 'up' && held == null) k = 'ok';
          else if (k === 'down' && held != null) k = 'ok';
          if (k !== 'ok') return;
          const p = pegs[cur];
          if (held == null) {
            if (p.length) { held = p.pop(); from = cur; }
          } else {
            if (p.length && p[p.length - 1] < held) { msg = 'A bigger disk can\'t go on a smaller one'; return; }
            p.push(held);
            if (cur !== from) { moves++; api.setScore(moves); }
            held = null; msg = '';
            if (pegs[1].length === o.n || pegs[2].length === o.n) api.end({ won: true, score: moves, text: 'Solved in ' + moves + ' moves' });
          }
        },
        draw() {
          api.rect(W / 2 - 600, base, 1200, 16, '#4A4A55');
          for (let i = 0; i < 3; i++) {
            api.rrect(pegX(i) - 7, base - (o.n + 1.5) * dh, 14, (o.n + 1.5) * dh, 6, '#4A4A55');
            pegs[i].forEach((d, j) => {
              const w = 60 + d * 42;
              api.rrect(pegX(i) - w / 2, base - (j + 1) * dh, w, dh - 4, 10, C.pal[(d - 1) % C.pal.length]);
            });
          }
          const top = TOP + 50;
          if (held != null) { const w = 60 + held * 42; api.rrect(pegX(cur) - w / 2, top, w, dh - 4, 10, C.pal[(held - 1) % C.pal.length], '#fff', 3); }
          else api.text('▼', pegX(cur), top + 18, 32, '#fff', 'center');
          api.text(msg, W / 2, H - 40, 22, msg.startsWith('A bigger') ? C.bad : C.dim, 'center');
        }
      };
    }
  });
})();
