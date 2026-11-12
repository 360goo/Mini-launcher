/* Puzzle games. See engine.js for the API. */
(function () {
  const { register } = Engine;

  // Fit a cols x rows grid into a box (defaults to the full game area).
  function layout(api, cols, rows, box) {
    const b = box || { x: 20, y: api.TOP + 12, w: api.W - 40, h: api.H - api.TOP - 24 };
    const cell = Math.floor(Math.min(b.w / cols, b.h / rows));
    return { cell, ox: Math.round(b.x + (b.w - cell * cols) / 2), oy: Math.round(b.y + (b.h - cell * rows) / 2) };
  }
  function moveCursor(cur, k, cols, rows, wrap) {
    const d = Engine.api.DIRS[k]; if (!d) return false;
    let x = cur.x + d[0], y = cur.y + d[1];
    if (wrap) { x = (x + cols) % cols; y = (y + rows) % rows; } else { x = Math.max(0, Math.min(cols - 1, x)); y = Math.max(0, Math.min(rows - 1, y)); }
    cur.x = x; cur.y = y; return true;
  }
  function timer(api) {
    let t = 0;
    return { tick(dt) { t += dt; api.setScore(Math.floor(t)); }, get s() { return Math.floor(t); } };
  }

  // ------------------------------------------------------------------ Merge Tiles
  register('merge', {
    title: 'Merge Tiles', icon: '🔢', color: '#C98B2B',
    help: 'Arrows slide all tiles · equal tiles merge · reach 2048',
    variants: [{ name: '3×3', n: 3 }, { name: '4×4', n: 4 }, { name: '5×5', n: 5 }, { name: '6×6', n: 6 }],
    create(o, api) {
      const n = o.n, C = api.C;
      const g = Array.from({ length: n }, () => Array(n).fill(0));
      const L = layout(api, n, n);
      let won = false, msgT = 0;
      function spawn() {
        const e = [];
        for (let y = 0; y < n; y++) for (let x = 0; x < n; x++) if (!g[y][x]) e.push([x, y]);
        if (!e.length) return;
        const [x, y] = api.pick(e); g[y][x] = Math.random() < 0.9 ? 2 : 4;
      }
      spawn(); spawn();
      function slide(line) {
        const a = line.filter(v => v), out = [];
        let gained = 0;
        for (let i = 0; i < a.length; i++) {
          if (i + 1 < a.length && a[i] === a[i + 1]) { out.push(a[i] * 2); gained += a[i] * 2; i++; } else out.push(a[i]);
        }
        while (out.length < n) out.push(0);
        return { out, gained };
      }
      function move(k) {
        let moved = false;
        for (let i = 0; i < n; i++) {
          const idx = [];
          for (let j = 0; j < n; j++) {
            if (k === 'left') idx.push([j, i]); else if (k === 'right') idx.push([n - 1 - j, i]);
            else if (k === 'up') idx.push([i, j]); else idx.push([i, n - 1 - j]);
          }
          const line = idx.map(([x, y]) => g[y][x]);
          const { out, gained } = slide(line);
          idx.forEach(([x, y], j) => { if (g[y][x] !== out[j]) moved = true; g[y][x] = out[j]; });
          api.addScore(gained);
        }
        return moved;
      }
      function canMove() {
        for (let y = 0; y < n; y++) for (let x = 0; x < n; x++) {
          if (!g[y][x]) return true;
          if (x + 1 < n && g[y][x] === g[y][x + 1]) return true;
          if (y + 1 < n && g[y][x] === g[y + 1][x]) return true;
        }
        return false;
      }
      const colors = { 2: '#3A3A48', 4: '#4A4458', 8: '#C9762B', 16: '#D9612B', 32: '#E0483A', 64: '#E8302B', 128: '#D4B02B', 256: '#D9B81F', 512: '#E0C010', 1024: '#3DBE78', 2048: '#2BB0D4' };
      return {
        key(k) {
          if (k === 'ok' || !api.DIRS[k]) return;
          if (move(k)) {
            spawn();
            if (!won && g.some(r => r.some(v => v >= 2048))) { won = true; msgT = 2.5; }
            if (!canMove()) api.end({ won, text: won ? 'You made 2048!' : 'No more moves' });
          }
        },
        update(dt) { if (msgT > 0) msgT -= dt; },
        draw() {
          const { cell, ox, oy } = L;
          api.rrect(ox - 8, oy - 8, cell * n + 16, cell * n + 16, 14, C.panel);
          for (let y = 0; y < n; y++) for (let x = 0; x < n; x++) {
            const v = g[y][x];
            api.rrect(ox + x * cell + 5, oy + y * cell + 5, cell - 10, cell - 10, 10, v ? (colors[v] || '#8A4BD4') : C.panel2);
            if (v) {
              const digits = String(v).length;
              api.text(v, ox + x * cell + cell / 2, oy + y * cell + cell / 2 + 2, Math.min(cell * 0.45, cell * 1.4 / digits), '#fff', 'center', 700);
            }
          }
          if (msgT > 0) { api.rrect(api.W / 2 - 200, api.TOP + 20, 400, 60, 30, C.good); api.text('2048! Keep going', api.W / 2, api.TOP + 50, 28, '#fff', 'center', 700); }
        }
      };
    }
  });

  // ------------------------------------------------------------------ Mines
  register('mines', {
    title: 'Mines', icon: '💣', color: '#5A6270', lowerIsBetter: true, scoreLabel: 'Time (s)',
    help: 'OK reveals · hold OK to flag · OK on a number opens its neighbours',
    variants: [
      { name: 'Easy', cols: 9, rows: 9, mines: 10 }, { name: 'Medium', cols: 12, rows: 12, mines: 24 },
      { name: 'Hard', cols: 16, rows: 16, mines: 40 }, { name: 'Expert', cols: 30, rows: 16, mines: 80 }
    ],
    create(o, api) {
      const { cols, rows } = o, C = api.C, T = timer(api);
      const L = layout(api, cols, rows);
      const mine = [], open = [], flag = [], num = [];
      for (let i = 0; i < cols * rows; i++) { mine.push(false); open.push(false); flag.push(false); num.push(0); }
      const cur = { x: cols >> 1, y: rows >> 1 };
      let placed = false, started = false, flaggedThisPress = false, okDown = false, boom = -1, opened = 0;
      const nb = i => {
        const x = i % cols, y = (i / cols) | 0, r = [];
        for (let dy = -1; dy <= 1; dy++) for (let dx = -1; dx <= 1; dx++) {
          const nx = x + dx, ny = y + dy;
          if ((dx || dy) && nx >= 0 && ny >= 0 && nx < cols && ny < rows) r.push(ny * cols + nx);
        }
        return r;
      };
      function place(safe) {
        const banned = new Set([safe, ...nb(safe)]);
        const cand = []; for (let i = 0; i < cols * rows; i++) if (!banned.has(i)) cand.push(i);
        api.shuffle(cand).slice(0, o.mines).forEach(i => mine[i] = true);
        for (let i = 0; i < cols * rows; i++) num[i] = nb(i).filter(j => mine[j]).length;
        placed = true;
      }
      function reveal(i) {
        if (open[i] || flag[i]) return;
        if (mine[i]) { boom = i; for (let j = 0; j < mine.length; j++) if (mine[j]) open[j] = true; api.end({ won: false, score: T.s, text: 'Boom!' }); return; }
        const stack = [i];
        while (stack.length) {
          const c = stack.pop();
          if (open[c] || flag[c]) continue;
          open[c] = true; opened++;
          if (num[c] === 0) nb(c).forEach(j => { if (!open[j] && !mine[j]) stack.push(j); });
        }
        if (opened === cols * rows - o.mines) api.end({ won: true, score: T.s, text: 'Cleared!' });
      }
      function act() {
        const i = cur.y * cols + cur.x;
        if (!placed) { place(i); started = true; }
        if (open[i]) {
          // chord: open neighbours when the right number of flags is around
          if (num[i] && nb(i).filter(j => flag[j]).length === num[i]) nb(i).forEach(j => { if (Engine.state === 'play') reveal(j); });
        } else reveal(i);
      }
      return {
        key(k, repeat) {
          if (k === 'ok') {
            if (!repeat) { okDown = true; flaggedThisPress = false; return; }
            if (okDown && !flaggedThisPress) {
              const i = cur.y * cols + cur.x;
              if (!open[i]) flag[i] = !flag[i];
              flaggedThisPress = true;
            }
            return;
          }
          moveCursor(cur, k, cols, rows, true);
        },
        keyUp(k) {
          if (k !== 'ok' || !okDown) return;
          okDown = false;
          if (!flaggedThisPress) act();
        },
        update(dt) { if (started) T.tick(dt); },
        draw() {
          const { cell, ox, oy } = L;
          const ncol = ['', '#4F8CFF', '#3DDC84', '#FF5A5F', '#B36BFF', '#FF8A3D', '#2BD4D4', '#F2F2F5', '#8A8A96'];
          for (let y = 0; y < rows; y++) for (let x = 0; x < cols; x++) {
            const i = y * cols + x, px = ox + x * cell, py = oy + y * cell;
            if (open[i]) {
              api.rrect(px + 1, py + 1, cell - 2, cell - 2, 4, i === boom ? C.bad : '#15151B');
              if (mine[i]) api.circle(px + cell / 2, py + cell / 2, cell * 0.25, '#000', '#ddd', 2);
              else if (num[i]) api.text(num[i], px + cell / 2, py + cell / 2 + 1, cell * 0.55, ncol[num[i]], 'center', 700);
            } else {
              api.rrect(px + 1, py + 1, cell - 2, cell - 2, 4, '#3A3A48');
              if (flag[i]) api.text('🚩', px + cell / 2, py + cell / 2 + 1, cell * 0.55, '#fff', 'center');
            }
          }
          api.rrect(ox + cur.x * cell, oy + cur.y * cell, cell, cell, 6, null, '#fff', 3);
          const left = o.mines - flag.filter(Boolean).length;
          api.text('Mines left: ' + left, api.W - 24, api.H - 18, 18, C.dim, 'right');
        }
      };
    }
  });

  // ------------------------------------------------------------------ Sudoku
  // Bitmask solver; count(limit) returns number of solutions up to limit.
  function sudokuCount(grid, limit) {
    const g = grid.slice();
    const row = Array(9).fill(0), col = Array(9).fill(0), box = Array(9).fill(0);
    for (let i = 0; i < 81; i++) if (g[i]) {
      const b = 1 << g[i], r = (i / 9) | 0, c = i % 9, bx = ((r / 3) | 0) * 3 + ((c / 3) | 0);
      if (row[r] & b || col[c] & b || box[bx] & b) return 0;
      row[r] |= b; col[c] |= b; box[bx] |= b;
    }
    let count = 0;
    (function rec() {
      if (count >= limit) return;
      let best = -1, bestMask = 0, bestN = 10;
      for (let i = 0; i < 81; i++) if (!g[i]) {
        const r = (i / 9) | 0, c = i % 9, bx = ((r / 3) | 0) * 3 + ((c / 3) | 0);
        const m = ~(row[r] | col[c] | box[bx]) & 0x3FE;
        let nbits = 0; for (let t = m; t; t &= t - 1) nbits++;
        if (nbits < bestN) { best = i; bestMask = m; bestN = nbits; if (!nbits) return; }
      }
      if (best < 0) { count++; return; }
      const r = (best / 9) | 0, c = best % 9, bx = ((r / 3) | 0) * 3 + ((c / 3) | 0);
      for (let d = 1; d <= 9; d++) if (bestMask & (1 << d)) {
        const b = 1 << d;
        g[best] = d; row[r] |= b; col[c] |= b; box[bx] |= b;
        rec();
        g[best] = 0; row[r] &= ~b; col[c] &= ~b; box[bx] &= ~b;
        if (count >= limit) return;
      }
    })();
    return count;
  }
  function sudokuSolution() {
    const g = Array(81).fill(0);
    function ok(i, d) {
      const r = (i / 9) | 0, c = i % 9, br = r - r % 3, bc = c - c % 3;
      for (let k = 0; k < 9; k++) if (g[r * 9 + k] === d || g[k * 9 + c] === d || g[(br + ((k / 3) | 0)) * 9 + bc + k % 3] === d) return false;
      return true;
    }
    (function fill(i) {
      if (i === 81) return true;
      for (const d of Engine.api.shuffle([1, 2, 3, 4, 5, 6, 7, 8, 9])) if (ok(i, d)) { g[i] = d; if (fill(i + 1)) return true; g[i] = 0; }
      return false;
    })(0);
    return g;
  }
  function sudokuPuzzle(clues) {
    const sol = sudokuSolution(), p = sol.slice();
    let filled = 81;
    for (const i of Engine.api.shuffle([...Array(81).keys()])) {
      if (filled <= clues) break;
      const v = p[i]; p[i] = 0;
      if (sudokuCount(p, 2) !== 1) p[i] = v; else filled--;
    }
    return { puzzle: p, solution: sol };
  }
  Engine.sudoku = { generate: sudokuPuzzle, count: sudokuCount };

  register('sudoku', {
    title: 'Sudoku', icon: '✏️', color: '#3E6FB0', lowerIsBetter: true, scoreLabel: 'Time (s)',
    help: 'Arrows move · OK on a cell opens the number picker · fill every row, column and box',
    variants: [{ name: 'Easy', clues: 40 }, { name: 'Medium', clues: 32 }, { name: 'Hard', clues: 28 }, { name: 'Expert', clues: 24 }],
    create(o, api) {
      const C = api.C, T = timer(api);
      const { puzzle } = sudokuPuzzle(o.clues);
      const g = puzzle.slice(), fixed = puzzle.map(v => v > 0);
      const L = layout(api, 9, 9, { x: 40, y: api.TOP + 14, w: 900, h: api.H - api.TOP - 28 });
      const cur = { x: 4, y: 4 };
      let picking = false, pick = 0; // pick: 0..9 (9 = clear)
      function conflict(i) {
        const v = g[i]; if (!v) return false;
        const r = (i / 9) | 0, c = i % 9, br = r - r % 3, bc = c - c % 3;
        for (let k = 0; k < 9; k++) {
          const a = r * 9 + k, b = k * 9 + c, d = (br + ((k / 3) | 0)) * 9 + bc + k % 3;
          if ((a !== i && g[a] === v) || (b !== i && g[b] === v) || (d !== i && g[d] === v)) return true;
        }
        return false;
      }
      const PX = 1000, PY = api.TOP + 160, PS = 76;
      return {
        key(k) {
          const i = cur.y * 9 + cur.x;
          if (picking) {
            const p = { x: pick % 3, y: (pick / 3) | 0 };
            if (k === 'ok') {
              g[i] = pick === 9 ? 0 : pick + 1; picking = false;
              if (g.every((v, j) => v && !conflict(j))) api.end({ won: true, score: T.s, text: 'Solved!' });
              return;
            }
            const d = api.DIRS[k]; if (!d) return;
            p.x = (p.x + d[0] + 3) % 3; p.y = (p.y + d[1] + 4) % 4;
            pick = p.y === 3 ? 9 : p.y * 3 + p.x;
            return;
          }
          if (k === 'ok') { if (!fixed[i]) { picking = true; pick = g[i] ? g[i] - 1 : 0; } return; }
          moveCursor(cur, k, 9, 9, true);
        },
        update(dt) { T.tick(dt); },
        draw() {
          const { cell, ox, oy } = L;
          api.rect(ox, oy, cell * 9, cell * 9, C.panel);
          const sel = g[cur.y * 9 + cur.x];
          for (let i = 0; i < 81; i++) {
            const x = i % 9, y = (i / 9) | 0, px = ox + x * cell, py = oy + y * cell;
            const same = x === cur.x || y === cur.y || ((x / 3 | 0) === (cur.x / 3 | 0) && (y / 3 | 0) === (cur.y / 3 | 0));
            if (same) api.rect(px, py, cell, cell, '#22222C');
            if (sel && g[i] === sel) api.rect(px, py, cell, cell, '#2B3550');
            if (g[i]) api.text(g[i], px + cell / 2, py + cell / 2 + 2, cell * 0.55, conflict(i) ? C.bad : fixed[i] ? C.text : '#7FB0FF', 'center', fixed[i] ? 700 : 500);
          }
          const ctx = api.ctx;
          for (let k = 0; k <= 9; k++) {
            ctx.fillStyle = k % 3 === 0 ? '#8A8A96' : '#3A3A48';
            const w = k % 3 === 0 ? 3 : 1;
            ctx.fillRect(ox + k * cell - w / 2, oy, w, cell * 9);
            ctx.fillRect(ox, oy + k * cell - w / 2, cell * 9, w);
          }
          api.rrect(ox + cur.x * cell + 2, oy + cur.y * cell + 2, cell - 4, cell - 4, 6, null, '#fff', 3);
          // picker
          api.text(picking ? 'Pick a number' : (fixed[cur.y * 9 + cur.x] ? 'Given number' : 'OK to enter a number'), PX + PS * 1.5, PY - 50, 22, C.dim, 'center');
          for (let n = 0; n < 10; n++) {
            const x = n === 9 ? 0 : n % 3, y = n === 9 ? 3 : (n / 3) | 0, w = n === 9 ? PS * 3 - 8 : PS - 8;
            const on = picking && pick === n;
            api.rrect(PX + x * PS, PY + y * PS, w, PS - 8, 10, on ? C.text : picking ? C.panel2 : C.panel);
            api.text(n === 9 ? 'Clear' : n + 1, PX + x * PS + w / 2, PY + y * PS + (PS - 8) / 2 + 2, n === 9 ? 24 : 32, on ? C.bg : picking ? C.text : C.dim, 'center', 600);
          }
        }
      };
    }
  });

  // ------------------------------------------------------------------ Sliding Puzzle
  register('slide', {
    title: 'Sliding Puzzle', icon: '🧩', color: '#8E5BC9', lowerIsBetter: true, scoreLabel: 'Moves',
    help: 'Arrows slide a tile into the gap · put the numbers in order',
    variants: [{ name: '3×3', n: 3 }, { name: '4×4', n: 4 }, { name: '5×5', n: 5 }, { name: '6×6', n: 6 }],
    create(o, api) {
      const n = o.n, C = api.C;
      const b = [...Array(n * n).keys()].map(i => (i + 1) % (n * n)); // 0 = gap, solved
      let gap = n * n - 1, moves = 0;
      const L = layout(api, n, n);
      // pressing a direction moves the tile on the opposite side of the gap in that direction
      function slide(k) {
        const d = api.DIRS[k]; if (!d) return false;
        const gx = gap % n, gy = (gap / n) | 0, tx = gx - d[0], ty = gy - d[1];
        if (tx < 0 || ty < 0 || tx >= n || ty >= n) return false;
        const t = ty * n + tx; b[gap] = b[t]; b[t] = 0; gap = t; return true;
      }
      let prev = null;
      const opp = { up: 'down', down: 'up', left: 'right', right: 'left' };
      for (let i = 0; i < 60 * n * n; i++) {
        const k = api.pick(['up', 'down', 'left', 'right']);
        if (k !== opp[prev] && slide(k)) prev = k;
      }
      if (b.every((v, i) => v === (i + 1) % (n * n))) { slide('right') || slide('left'); }
      Engine.api._slideBoard = b;
      return {
        key(k) {
          if (slide(k)) {
            moves++; api.setScore(moves);
            if (b.every((v, i) => v === (i + 1) % (n * n))) api.end({ won: true, score: moves, text: 'Solved!' });
          }
        },
        draw() {
          const { cell, ox, oy } = L;
          api.rrect(ox - 8, oy - 8, cell * n + 16, cell * n + 16, 14, C.panel);
          b.forEach((v, i) => {
            if (!v) return;
            const x = i % n, y = (i / n) | 0, home = v - 1 === i;
            api.rrect(ox + x * cell + 4, oy + y * cell + 4, cell - 8, cell - 8, 10, home ? '#6E4BA8' : '#3A3A48');
            api.text(v, ox + x * cell + cell / 2, oy + y * cell + cell / 2 + 2, cell * 0.4, '#fff', 'center', 700);
          });
        }
      };
    }
  });

  // ------------------------------------------------------------------ Light Switch
  register('lights', {
    title: 'Light Switch', icon: '💡', color: '#B8962E', lowerIsBetter: true, scoreLabel: 'Moves',
    help: 'OK flips a light and its neighbours · switch every light off',
    variants: [{ name: '5×5', n: 5 }, { name: '6×6', n: 6 }, { name: '7×7', n: 7 }],
    create(o, api) {
      const n = o.n, C = api.C;
      const on = Array(n * n).fill(false);
      const L = layout(api, n, n);
      const cur = { x: n >> 1, y: n >> 1 };
      let moves = 0;
      function press(x, y) {
        [[0, 0], [1, 0], [-1, 0], [0, 1], [0, -1]].forEach(([dx, dy]) => {
          const a = x + dx, b = y + dy;
          if (a >= 0 && b >= 0 && a < n && b < n) on[b * n + a] = !on[b * n + a];
        });
      }
      // random presses from all-off guarantee a solvable puzzle
      while (on.filter(Boolean).length < n) for (let i = 0; i < n * 2; i++) press(api.rnd(n), api.rnd(n));
      return {
        key(k) {
          if (k === 'ok') {
            press(cur.x, cur.y); moves++; api.setScore(moves);
            if (!on.some(Boolean)) api.end({ won: true, score: moves, text: 'Lights out!' });
            return;
          }
          moveCursor(cur, k, n, n, true);
        },
        draw() {
          const { cell, ox, oy } = L;
          on.forEach((v, i) => {
            const x = i % n, y = (i / n) | 0;
            api.rrect(ox + x * cell + 6, oy + y * cell + 6, cell - 12, cell - 12, 14, v ? '#FFD45A' : '#24242E');
          });
          api.rrect(ox + cur.x * cell + 1, oy + cur.y * cell + 1, cell - 2, cell - 2, 16, null, '#fff', 4);
        }
      };
    }
  });

  // ------------------------------------------------------------------ Maze
  register('maze', {
    title: 'Maze', icon: '🌀', color: '#2F7D8C', lowerIsBetter: true, scoreLabel: 'Time (s)',
    help: 'Arrows move (hold to run) · reach the green exit',
    variants: [{ name: 'Small', c: 15, r: 9 }, { name: 'Medium', c: 25, r: 14 }, { name: 'Large', c: 35, r: 19 }, { name: 'Huge', c: 49, r: 27 }],
    create(o, api) {
      const { c, r } = o, C = api.C, T = timer(api);
      // walls: bit 1=up 2=right 4=down 8=left
      const w = Array(c * r).fill(15), seen = Array(c * r).fill(false);
      const stack = [0]; seen[0] = true;
      const D = [[0, -1, 1, 4], [1, 0, 2, 8], [0, 1, 4, 1], [-1, 0, 8, 2]];
      while (stack.length) {
        const i = stack[stack.length - 1], x = i % c, y = (i / c) | 0;
        const opts = D.filter(([dx, dy]) => { const nx = x + dx, ny = y + dy; return nx >= 0 && ny >= 0 && nx < c && ny < r && !seen[ny * c + nx]; });
        if (!opts.length) { stack.pop(); continue; }
        const [dx, dy, b, ob] = api.pick(opts), j = (y + dy) * c + x + dx;
        w[i] &= ~b; w[j] &= ~ob; seen[j] = true; stack.push(j);
      }
      const L = layout(api, c, r);
      const p = { x: 0, y: 0 }, trail = new Set(['0,0']);
      return {
        key(k) {
          const d = D.find(([dx, dy]) => { const a = api.DIRS[k]; return a && a[0] === dx && a[1] === dy; });
          if (!d || w[p.y * c + p.x] & d[2]) return;
          p.x += d[0]; p.y += d[1]; trail.add(p.x + ',' + p.y);
          if (p.x === c - 1 && p.y === r - 1) api.end({ won: true, score: T.s, text: 'You escaped!' });
        },
        update(dt) { T.tick(dt); },
        draw() {
          const { cell, ox, oy } = L, ctx = api.ctx;
          api.rect(ox, oy, cell * c, cell * r, C.panel);
          trail.forEach(s => { const [x, y] = s.split(',').map(Number); api.rect(ox + x * cell + cell * 0.3, oy + y * cell + cell * 0.3, cell * 0.4, cell * 0.4, '#2B3550'); });
          api.rect(ox + (c - 1) * cell + 2, oy + (r - 1) * cell + 2, cell - 4, cell - 4, C.good);
          ctx.strokeStyle = '#9A9AAA'; ctx.lineWidth = Math.max(2, cell / 8); ctx.lineCap = 'square';
          ctx.beginPath();
          for (let i = 0; i < c * r; i++) {
            const x = ox + (i % c) * cell, y = oy + ((i / c) | 0) * cell;
            if (w[i] & 1) { ctx.moveTo(x, y); ctx.lineTo(x + cell, y); }
            if (w[i] & 8) { ctx.moveTo(x, y); ctx.lineTo(x, y + cell); }
            if ((i % c) === c - 1 && w[i] & 2) { ctx.moveTo(x + cell, y); ctx.lineTo(x + cell, y + cell); }
            if (((i / c) | 0) === r - 1 && w[i] & 4) { ctx.moveTo(x, y + cell); ctx.lineTo(x + cell, y + cell); }
          }
          ctx.stroke();
          api.circle(ox + p.x * cell + cell / 2, oy + p.y * cell + cell / 2, cell * 0.32, C.warn);
        }
      };
    }
  });

  // ------------------------------------------------------------------ Flood Fill
  register('flood', {
    title: 'Flood Fill', icon: '🌊', color: '#2B6CB0', lowerIsBetter: true, scoreLabel: 'Moves',
    help: 'Left/Right pick a colour · OK floods from the top-left corner · fill the board',
    variants: [{ name: '10×10', n: 10, max: 20 }, { name: '14×14', n: 14, max: 25 }, { name: '18×18', n: 18, max: 32 }],
    create(o, api) {
      const n = o.n, C = api.C, pal = C.pal.slice(0, 6);
      const g = Array.from({ length: n * n }, () => api.rnd(6));
      const L = layout(api, n, n, { x: 40, y: api.TOP + 12, w: 860, h: api.H - api.TOP - 24 });
      let sel = 0, moves = 0;
      function fill(col) {
        const from = g[0]; if (from === col) return false;
        const st = [0], seen = new Set();
        while (st.length) {
          const i = st.pop(); if (seen.has(i) || g[i] !== from) continue;
          seen.add(i); g[i] = col;
          const x = i % n, y = (i / n) | 0;
          if (x > 0) st.push(i - 1); if (x < n - 1) st.push(i + 1); if (y > 0) st.push(i - n); if (y < n - 1) st.push(i + n);
        }
        return true;
      }
      return {
        key(k) {
          if (k === 'left' || k === 'up') sel = (sel + 5) % 6;
          else if (k === 'right' || k === 'down') sel = (sel + 1) % 6;
          else if (k === 'ok' && fill(sel)) {
            moves++; api.setScore(moves);
            if (g.every(v => v === g[0])) api.end({ won: true, score: moves, text: 'Flooded!' });
            else if (moves >= o.max) api.end({ won: false, score: moves, text: 'Out of moves' });
          }
        },
        draw() {
          const { cell, ox, oy } = L;
          g.forEach((v, i) => api.rect(ox + (i % n) * cell, oy + ((i / n) | 0) * cell, cell, cell, pal[v]));
          const px = 960, py = api.TOP + 120;
          api.text('Moves ' + moves + ' / ' + o.max, px + 130, py - 50, 28, C.text, 'center', 600);
          pal.forEach((c, i) => {
            const x = px + (i % 3) * 90, y = py + ((i / 3) | 0) * 90;
            api.rrect(x, y, 76, 76, 14, c, sel === i ? '#fff' : null, 5);
          });
          api.text('Corner colour', px + 130, py + 240, 20, C.dim, 'center');
          api.rrect(px + 92, py + 270, 76, 40, 10, pal[g[0]]);
        }
      };
    }
  });

  // ------------------------------------------------------------------ Tile Collapse
  register('collapse', {
    title: 'Tile Collapse', icon: '🟥', color: '#B04A4A',
    help: 'OK clears a group of 2+ touching tiles · bigger groups score more',
    variants: [{ name: 'Small', c: 10, r: 8, k: 4 }, { name: 'Large', c: 16, r: 10, k: 5 }],
    create(o, api) {
      const { c, r } = o, C = api.C;
      // cols[x] is a bottom-up array of colours
      let cols = Array.from({ length: c }, () => Array.from({ length: r }, () => api.rnd(o.k)));
      const L = layout(api, c, r);
      const cur = { x: 0, y: r - 1 }; // y in screen rows (0 = top)
      const at = (x, y) => { const col = cols[x]; const h = r - 1 - y; return col && h < col.length ? col[h] : -1; };
      function group(x, y) {
        const v = at(x, y); if (v < 0) return [];
        const out = [], seen = new Set([x + ',' + y]), st = [[x, y]];
        while (st.length) {
          const [a, b] = st.pop(); out.push([a, b]);
          [[1, 0], [-1, 0], [0, 1], [0, -1]].forEach(([dx, dy]) => {
            const nx = a + dx, ny = b + dy, key = nx + ',' + ny;
            if (nx >= 0 && ny >= 0 && nx < c && ny < r && !seen.has(key) && at(nx, ny) === v) { seen.add(key); st.push([nx, ny]); }
          });
        }
        return out;
      }
      function anyMoves() {
        for (let x = 0; x < c; x++) for (let h = 0; h < cols[x].length; h++) {
          const v = cols[x][h];
          if (h + 1 < cols[x].length && cols[x][h + 1] === v) return true;
          if (x + 1 < c && cols[x + 1] && h < cols[x + 1].length && cols[x + 1][h] === v) return true;
        }
        return false;
      }
      return {
        key(k) {
          if (k !== 'ok') { moveCursor(cur, k, c, r, false); return; }
          const g = group(cur.x, cur.y); if (g.length < 2) return;
          const kill = new Set(g.map(([x, y]) => x + ',' + (r - 1 - y)));
          cols = cols.map((col, x) => col.filter((_, h) => !kill.has(x + ',' + h))).filter(col => col.length);
          while (cols.length < c) cols.push([]);
          api.addScore(g.length * (g.length - 1));
          if (!anyMoves()) {
            const left = cols.reduce((s, col) => s + col.length, 0);
            if (!left) api.addScore(1000);
            api.end({ won: !left, text: left ? 'No more groups' : 'Board cleared! +1000' });
          }
        },
        draw() {
          const { cell, ox, oy } = L;
          api.rrect(ox - 6, oy - 6, cell * c + 12, cell * r + 12, 10, C.panel);
          const hl = new Set(group(cur.x, cur.y).map(([x, y]) => x + ',' + y));
          const big = hl.size >= 2;
          for (let x = 0; x < c; x++) for (let y = 0; y < r; y++) {
            const v = at(x, y); if (v < 0) continue;
            const lit = big && hl.has(x + ',' + y);
            api.rrect(ox + x * cell + 3, oy + y * cell + 3, cell - 6, cell - 6, 8, C.pal[v], lit ? '#fff' : null, 3);
          }
          api.rrect(ox + cur.x * cell, oy + cur.y * cell, cell, cell, 10, null, '#fff', 4);
          if (big) api.text(hl.size + ' tiles · +' + hl.size * (hl.size - 1), api.W - 24, api.H - 16, 18, C.dim, 'right');
        }
      };
    }
  });
})();
