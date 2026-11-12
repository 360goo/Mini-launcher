/* Arcade games. See engine.js for the API. */
(function () {
  const { register } = Engine;

  // ------------------------------------------------------------------ Snake
  register('snake', {
    title: 'Snake', icon: '🐍', color: '#2E8B57',
    help: 'Arrows steer · eat the apples · don\'t bite yourself',
    variants: [
      { name: 'Classic', cols: 32, rows: 18, speed: 9, wrap: false, walls: false },
      { name: 'No Walls', cols: 32, rows: 18, speed: 9, wrap: true, walls: false },
      { name: 'Speed', cols: 32, rows: 18, speed: 15, wrap: false, walls: false },
      { name: 'Obstacles', cols: 32, rows: 18, speed: 10, wrap: false, walls: true },
    ],
    create(o, api) {
      const { TOP, W, H, C } = api;
      const cell = Math.floor(Math.min(W / o.cols, (H - TOP - 16) / o.rows));
      const ox = (W - cell * o.cols) / 2, oy = TOP + 8 + ((H - TOP - 16) - cell * o.rows) / 2;
      let snake = [[8, 9], [7, 9], [6, 9]], dir = [1, 0], queue = [], t = 0, grow = 0;
      const blocks = new Set();
      if (o.walls) {
        for (let i = 0; i < 6; i++) {
          const x = 4 + api.rnd(o.cols - 8), y = 2 + api.rnd(o.rows - 4), horiz = Math.random() < 0.5;
          for (let k = 0; k < 5; k++) {
            const bx = horiz ? x + k : x, by = horiz ? y : y + k;
            if (bx < o.cols && by < o.rows && !(by === 9 && bx < 14)) blocks.add(bx + ',' + by);
          }
        }
      }
      const occupied = (x, y) => blocks.has(x + ',' + y) || snake.some(s => s[0] === x && s[1] === y);
      let food = place();
      function place() {
        let x, y;
        do { x = api.rnd(o.cols); y = api.rnd(o.rows); } while (occupied(x, y));
        return [x, y];
      }
      return {
        key(k) {
          const d = api.DIRS[k]; if (!d) return;
          const lastDir = queue.length ? queue[queue.length - 1] : dir;
          if (d[0] === -lastDir[0] && d[1] === -lastDir[1]) return;
          if (queue.length < 3) queue.push(d);
        },
        update(dt) {
          t += dt;
          const step = 1 / (o.speed + Math.min(6, snake.length / 8));
          while (t >= step) {
            t -= step;
            if (queue.length) dir = queue.shift();
            let x = snake[0][0] + dir[0], y = snake[0][1] + dir[1];
            if (o.wrap) { x = (x + o.cols) % o.cols; y = (y + o.rows) % o.rows; }
            const tailMoves = grow === 0;
            const hitSelf = snake.some((s, i) => s[0] === x && s[1] === y && !(tailMoves && i === snake.length - 1));
            if (x < 0 || y < 0 || x >= o.cols || y >= o.rows || hitSelf || blocks.has(x + ',' + y)) {
              api.end({ won: false }); return;
            }
            snake.unshift([x, y]);
            if (x === food[0] && y === food[1]) { grow += 2; api.addScore(10); food = place(); }
            if (grow > 0) grow--; else snake.pop();
          }
        },
        draw(ctx) {
          api.rrect(ox - 4, oy - 4, cell * o.cols + 8, cell * o.rows + 8, 10, C.panel);
          blocks.forEach(b => { const [x, y] = b.split(',').map(Number); api.rrect(ox + x * cell + 1, oy + y * cell + 1, cell - 2, cell - 2, 4, C.line); });
          api.circle(ox + food[0] * cell + cell / 2, oy + food[1] * cell + cell / 2, cell * 0.38, C.bad);
          snake.forEach((s, i) => api.rrect(ox + s[0] * cell + 2, oy + s[1] * cell + 2, cell - 4, cell - 4, 6, i === 0 ? '#7CF0A8' : C.good));
        }
      };
    }
  });
  // ------------------------------------------------------------------ Falling Blocks
  register('blocks', {
    title: 'Falling Blocks', icon: '🧱', color: '#5B4BC4',
    help: '◀ ▶ move · ▲ rotate · ▼ soft drop · OK hard drop',
    variants: [
      { name: 'Classic', cols: 10, speed: 1 },
      { name: 'Fast', cols: 10, speed: 2.2 },
      { name: 'Narrow Well', cols: 7, speed: 1 },
    ],
    create(o, api) {
      const { TOP, W, H, C } = api;
      const ROWS = 20, COLS = o.cols;
      const cell = Math.floor((H - TOP - 20) / ROWS);
      const ox = Math.floor((W - cell * COLS) / 2), oy = TOP + 10;
      const SHAPES = [
        [[0, 1], [1, 1], [2, 1], [3, 1]], // I
        [[0, 0], [1, 0], [0, 1], [1, 1]], // O
        [[0, 1], [1, 1], [2, 1], [1, 0]], // T
        [[1, 0], [2, 0], [0, 1], [1, 1]], // S
        [[0, 0], [1, 0], [1, 1], [2, 1]], // Z
        [[0, 0], [0, 1], [1, 1], [2, 1]], // J
        [[2, 0], [0, 1], [1, 1], [2, 1]], // L
      ];
      const COLORS = ['#2BD4D4', '#FFC542', '#B36BFF', '#3DDC84', '#FF5A5F', '#4F8CFF', '#FF8A3D'];
      const board = Array.from({ length: ROWS }, () => Array(COLS).fill(-1));
      let bag = [], piece, next = newPiece(), t = 0, lines = 0, level = 1, softHeld = false;
      function newPiece() {
        if (!bag.length) bag = api.shuffle([0, 1, 2, 3, 4, 5, 6]);
        const k = bag.pop();
        return { k, cells: SHAPES[k].map(c => c.slice()), x: Math.floor(COLS / 2) - 2 + (k === 1 ? 1 : 0), y: 0 };
      }
      function fits(cells, x, y) {
        return cells.every(([cx, cy]) => {
          const bx = cx + x, by = cy + y;
          return bx >= 0 && bx < COLS && by < ROWS && (by < 0 || board[by][bx] < 0);
        });
      }
      function spawn() {
        piece = next; next = newPiece();
        if (!fits(piece.cells, piece.x, piece.y)) api.end({ won: false });
      }
      spawn();
      function rotate() {
        if (piece.k === 1) return;
        const size = piece.k === 0 ? 4 : 3;
        const r = piece.cells.map(([x, y]) => [size - 1 - y, x]);
        for (const dx of [0, -1, 1, -2, 2]) if (fits(r, piece.x + dx, piece.y)) { piece.cells = r; piece.x += dx; return; }
      }
      function lock() {
        for (const [cx, cy] of piece.cells) {
          const by = cy + piece.y;
          if (by < 0) { api.end({ won: false }); return; }
          board[by][cx + piece.x] = piece.k;
        }
        let cleared = 0;
        for (let y = ROWS - 1; y >= 0; y--) {
          if (board[y].every(v => v >= 0)) { board.splice(y, 1); board.unshift(Array(COLS).fill(-1)); cleared++; y++; }
        }
        if (cleared) {
          lines += cleared;
          api.addScore([0, 100, 300, 500, 800][cleared] * level);
          level = 1 + Math.floor(lines / 10);
        }
        spawn();
      }
      function drop() {
        if (fits(piece.cells, piece.x, piece.y + 1)) { piece.y++; return true; }
        lock(); return false;
      }
      const g = {
        get lines() { return lines; }, board, get piece() { return piece; },
        key(k) {
          if (k === 'left' && fits(piece.cells, piece.x - 1, piece.y)) piece.x--;
          else if (k === 'right' && fits(piece.cells, piece.x + 1, piece.y)) piece.x++;
          else if (k === 'up') rotate();
          else if (k === 'down') { softHeld = true; if (drop()) api.addScore(1); t = 0; }
          else if (k === 'ok') { let n = 0; while (fits(piece.cells, piece.x, piece.y + 1)) { piece.y++; n++; } api.addScore(n * 2); lock(); t = 0; }
        },
        keyUp(k) { if (k === 'down') softHeld = false; },
        update(dt) {
          t += dt;
          const interval = Math.max(0.06, 0.8 / o.speed - (level - 1) * 0.06);
          const step = softHeld && api.held.down ? Math.min(interval, 0.05) : interval;
          while (t >= step) { t -= step; drop(); }
        },
        draw(ctx) {
          api.rrect(ox - 6, oy - 6, cell * COLS + 12, cell * ROWS + 12, 8, C.panel);
          for (let y = 0; y < ROWS; y++) for (let x = 0; x < COLS; x++) {
            const v = board[y][x];
            api.rrect(ox + x * cell + 1, oy + y * cell + 1, cell - 2, cell - 2, 4, v >= 0 ? COLORS[v] : '#202028');
          }
          let gy = piece.y; while (fits(piece.cells, piece.x, gy + 1)) gy++;
          for (const [cx, cy] of piece.cells) {
            if (gy + cy >= 0) api.rrect(ox + (cx + piece.x) * cell + 1, oy + (cy + gy) * cell + 1, cell - 2, cell - 2, 4, null, COLORS[piece.k], 2);
          }
          for (const [cx, cy] of piece.cells) {
            if (piece.y + cy >= 0) api.rrect(ox + (cx + piece.x) * cell + 1, oy + (cy + piece.y) * cell + 1, cell - 2, cell - 2, 4, COLORS[piece.k]);
          }
          const sx = ox + cell * COLS + 50;
          api.text('Next', sx, oy + 20, 24, C.dim);
          for (const [cx, cy] of next.cells) api.rrect(sx + cx * 30, oy + 50 + cy * 30, 28, 28, 4, COLORS[next.k]);
          api.text('Lines ' + lines, sx, oy + 170, 24, C.text);
          api.text('Level ' + level, sx, oy + 210, 24, C.text);
        }
      };
      return g;
    }
  });

  // ------------------------------------------------------------------ Brick Breaker
  const BRICK_LEVELS = [
    { name: 'Level 1', speed: 420, rows: ['1111111111', '1111111111', '2222222222', '2222222222'] },
    { name: 'Level 2', speed: 460, rows: ['0011111100', '0122222210', '1233333321', '0122222210', '0011111100'] },
    { name: 'Level 3', speed: 500, rows: ['3030303030', '0303030303', '2020202020', '0202020202', '1010101010', '0101010101'] },
    { name: 'Level 4', speed: 540, rows: ['4444444444', '1000000001', '1022222201', '1020000201', '1022222201', '1000000001', '3333333333'] },
    { name: 'Level 5', speed: 600, rows: ['5555555555', '4444444444', '3333333333', '2222222222', '1111111111', '1111111111', '2222222222'] },
  ];
  register('bricks', {
    title: 'Brick Breaker', icon: '🏓', color: '#C2410C',
    help: '◀ ▶ move paddle · OK launch the ball',
    variants: BRICK_LEVELS,
    create(o, api) {
      const { TOP, W, H, C } = api;
      const cols = 10, bw = 108, bh = 30, gap = 6, bx0 = (W - cols * (bw + gap) + gap) / 2, by0 = TOP + 50;
      const bricks = [];
      o.rows.forEach((row, r) => [...row].forEach((ch, c) => {
        const hp = Number(ch); if (hp > 0) bricks.push({ x: bx0 + c * (bw + gap), y: by0 + r * (bh + gap), hp });
      }));
      const pw = 170, py = H - 50;
      let px = W / 2 - pw / 2, ball = null, lives = 3;
      const reset = () => { ball = { x: px + pw / 2, y: py - 12, vx: 0, vy: 0, stuck: true }; };
      reset();
      const BCOL = [null, C.pal[3], C.pal[2], C.pal[1], C.pal[5], C.pal[0]];
      return {
        bricks,
        key(k) {
          if (k === 'ok' && ball.stuck) {
            ball.stuck = false;
            const a = -Math.PI / 2 + (Math.random() - 0.5) * 0.8;
            ball.vx = Math.cos(a) * o.speed; ball.vy = Math.sin(a) * o.speed;
          }
        },
        update(dt) {
          const sp = 900;
          if (api.held.left) px -= sp * dt;
          if (api.held.right) px += sp * dt;
          px = api.clamp(px, 0, W - pw);
          if (ball.stuck) { ball.x = px + pw / 2; ball.y = py - 12; return; }
          const steps = 4;
          for (let s = 0; s < steps; s++) {
            ball.x += ball.vx * dt / steps; ball.y += ball.vy * dt / steps;
            if (ball.x < 10) { ball.x = 10; ball.vx = Math.abs(ball.vx); }
            if (ball.x > W - 10) { ball.x = W - 10; ball.vx = -Math.abs(ball.vx); }
            if (ball.y < TOP + 10) { ball.y = TOP + 10; ball.vy = Math.abs(ball.vy); }
            if (ball.vy > 0 && ball.y + 10 >= py && ball.y < py + 16 && ball.x > px - 8 && ball.x < px + pw + 8) {
              const rel = (ball.x - (px + pw / 2)) / (pw / 2);
              const speed = Math.hypot(ball.vx, ball.vy) * 1.01;
              const a = -Math.PI / 2 + rel * 1.05;
              ball.vx = Math.cos(a) * speed; ball.vy = Math.sin(a) * speed; ball.y = py - 10;
            }
            for (const b of bricks) {
              if (b.hp <= 0) continue;
              if (ball.x + 10 > b.x && ball.x - 10 < b.x + bw && ball.y + 10 > b.y && ball.y - 10 < b.y + bh) {
                const ox = Math.min(ball.x + 10 - b.x, b.x + bw - (ball.x - 10));
                const oy = Math.min(ball.y + 10 - b.y, b.y + bh - (ball.y - 10));
                if (ox < oy) ball.vx = -ball.vx; else ball.vy = -ball.vy;
                b.hp--; api.addScore(10);
                break;
              }
            }
          }
          if (ball.y > H + 20) {
            lives--;
            if (lives <= 0) { api.end({ won: false }); return; }
            reset();
          }
          if (bricks.every(b => b.hp <= 0)) api.end({ won: true, score: api.score + lives * 100 });
        },
        draw() {
          for (const b of bricks) if (b.hp > 0) api.rrect(b.x, b.y, bw, bh, 6, BCOL[Math.min(5, b.hp)]);
          api.rrect(px, py, pw, 16, 8, C.text);
          api.circle(ball.x, ball.y, 10, C.warn);
          api.text('♥'.repeat(lives), 30, H - 20, 24, C.bad);
          if (ball.stuck) api.text('Press OK to launch', W / 2, H - 120, 24, C.dim, 'center');
        }
      };
    }
  });

  // ------------------------------------------------------------------ Paddle Ball
  register('paddle', {
    title: 'Paddle Ball', icon: '🎾', color: '#0E7490',
    help: '▲ ▼ move your paddle · first to 7 wins',
    variants: [
      { name: 'Easy', cpu: 260, err: 70, speed: 480 },
      { name: 'Normal', cpu: 380, err: 40, speed: 560 },
      { name: 'Hard', cpu: 520, err: 18, speed: 640 },
    ],
    create(o, api) {
      const { TOP, W, H, C } = api;
      const ph = 120, pw = 18, top = TOP + 10, bot = H - 10;
      let py = (top + bot) / 2 - ph / 2, cy = py, me = 0, cpu = 0, ball, wait = 1, aimErr = 0;
      function serve(dir) {
        const a = (Math.random() - 0.5) * 0.9;
        ball = { x: W / 2, y: (top + bot) / 2, vx: Math.cos(a) * o.speed * dir, vy: Math.sin(a) * o.speed };
        wait = 0.8; aimErr = (Math.random() - 0.5) * 2 * o.err;
      }
      serve(Math.random() < 0.5 ? 1 : -1);
      return {
        update(dt) {
          const sp = 700;
          if (api.held.up) py -= sp * dt;
          if (api.held.down) py += sp * dt;
          py = api.clamp(py, top, bot - ph);
          const target = (ball.vx > 0 ? ball.y + aimErr : (top + bot) / 2) - ph / 2;
          cy += api.clamp(target - cy, -o.cpu * dt, o.cpu * dt);
          cy = api.clamp(cy, top, bot - ph);
          if (wait > 0) { wait -= dt; return; }
          ball.x += ball.vx * dt; ball.y += ball.vy * dt;
          if (ball.y < top + 10) { ball.y = top + 10; ball.vy = Math.abs(ball.vy); }
          if (ball.y > bot - 10) { ball.y = bot - 10; ball.vy = -Math.abs(ball.vy); }
          const hit = (padY, dir) => {
            const rel = (ball.y - (padY + ph / 2)) / (ph / 2);
            const speed = Math.min(1100, Math.hypot(ball.vx, ball.vy) * 1.05);
            const a = rel * 0.9;
            ball.vx = Math.cos(a) * speed * dir; ball.vy = Math.sin(a) * speed;
            aimErr = (Math.random() - 0.5) * 2 * o.err;
          };
          if (ball.vx < 0 && ball.x - 10 < 40 + pw && ball.x > 30 && ball.y > py - 10 && ball.y < py + ph + 10) { ball.x = 40 + pw + 10; hit(py, 1); }
          if (ball.vx > 0 && ball.x + 10 > W - 40 - pw && ball.x < W - 30 && ball.y > cy - 10 && ball.y < cy + ph + 10) { ball.x = W - 40 - pw - 10; hit(cy, -1); }
          if (ball.x < -20) { cpu++; if (cpu >= 7) api.end({ won: false, score: me, text: 'CPU wins' }); else serve(1); }
          if (ball.x > W + 20) { me++; api.setScore(me); if (me >= 7) api.end({ won: true, score: me }); else serve(-1); }
        },
        draw(ctx) {
          for (let y = top; y < bot; y += 30) api.rect(W / 2 - 2, y, 4, 16, C.line);
          api.text(me, W / 2 - 80, TOP + 60, 64, C.dim, 'center', 700);
          api.text(cpu, W / 2 + 80, TOP + 60, 64, C.dim, 'center', 700);
          api.rrect(40, py, pw, ph, 8, C.good);
          api.rrect(W - 40 - pw, cy, pw, ph, 8, C.bad);
          api.circle(ball.x, ball.y, 10, C.text);
        }
      };
    }
  });

  // ------------------------------------------------------------------ Flap
  register('flap', {
    title: 'Flappy Flight', icon: '🐤', color: '#CA8A04',
    help: 'OK or ▲ to flap · fly through the gaps',
    variants: [
      { name: 'Normal', gap: 210, speed: 240, spacing: 380 },
      { name: 'Hard', gap: 165, speed: 300, spacing: 340 },
    ],
    create(o, api) {
      const { TOP, W, H, C } = api;
      const bx = 300, ground = H - 40;
      let by = (TOP + ground) / 2, vy = 0, pipes = [], dist = 0, started = false;
      for (let i = 0; i < 4; i++) pipes.push(mk(W + 200 + i * o.spacing));
      function mk(x) { return { x, gy: TOP + 60 + api.rnd(ground - TOP - 120 - o.gap), passed: false }; }
      const flap = () => { started = true; vy = -520; };
      return {
        key(k) { if (k === 'ok' || k === 'up') flap(); },
        update(dt) {
          if (!started) { by = (TOP + ground) / 2 + Math.sin(performance.now() / 200) * 8; return; }
          vy += 1500 * dt; by += vy * dt;
          for (const p of pipes) {
            p.x -= o.speed * dt;
            if (!p.passed && p.x + 40 < bx) { p.passed = true; api.addScore(1); }
            if (bx + 18 > p.x - 40 && bx - 18 < p.x + 40 && (by - 18 < p.gy || by + 18 > p.gy + o.gap)) { api.end({ won: false }); return; }
          }
          if (pipes[0].x < -60) { pipes.shift(); pipes.push(mk(pipes[pipes.length - 1].x + o.spacing)); }
          if (by + 18 > ground || by < TOP) api.end({ won: false });
        },
        draw() {
          api.rect(0, TOP, W, H - TOP, '#10202E');
          for (const p of pipes) {
            api.rrect(p.x - 40, TOP - 10, 80, p.gy - TOP + 10, 8, '#2E8B57');
            api.rrect(p.x - 40, p.gy + o.gap, 80, ground - p.gy - o.gap, 8, '#2E8B57');
          }
          api.rect(0, ground, W, H - ground, '#5C4033');
          api.circle(bx, by, 18, C.warn);
          api.circle(bx + 7, by - 5, 4, C.bg);
          api.rect(bx + 14, by, 12, 6, C.pal[5]);
          if (!started) api.text('Press OK to flap', W / 2, TOP + 120, 28, C.text, 'center');
          api.text(api.score, W / 2, TOP + 60, 56, C.text, 'center', 700);
        }
      };
    }
  });

  // ------------------------------------------------------------------ Space Shooter
  register('shooter', {
    title: 'Space Shooter', icon: '🚀', color: '#1E3A8A',
    help: '◀ ▶ move · OK or ▲ fire · clear the waves',
    variants: [
      { name: 'Normal', enemyFire: 1.0, enemySpeed: 40 },
      { name: 'Hard', enemyFire: 2.0, enemySpeed: 70 },
    ],
    create(o, api) {
      const { TOP, W, H, C } = api;
      let x = W / 2, lives = 3, wave = 0, enemies = [], shots = [], bombs = [], cool = 0, dirX = 1, inv = 0;
      const stars = Array.from({ length: 80 }, () => ({ x: Math.random() * W, y: TOP + Math.random() * (H - TOP), s: 20 + Math.random() * 60 }));
      function nextWave() {
        wave++; enemies = [];
        const rows = Math.min(5, 2 + wave);
        for (let r = 0; r < rows; r++) for (let c = 0; c < 9; c++) enemies.push({ x: 220 + c * 95, y: TOP + 50 + r * 55, t: r });
        dirX = 1;
      }
      nextWave();
      const fire = () => { if (cool <= 0) { shots.push({ x, y: H - 80 }); cool = 0.28; } };
      return {
        key(k) { if (k === 'ok' || k === 'up') fire(); },
        update(dt) {
          if (api.held.left) x -= 600 * dt;
          if (api.held.right) x += 600 * dt;
          x = api.clamp(x, 30, W - 30);
          cool -= dt; inv -= dt;
          if ((api.held.ok || api.held.up)) fire();
          stars.forEach(s => { s.y += s.s * dt; if (s.y > H) s.y = TOP; });
          const sp = (o.enemySpeed + wave * 10) * dt;
          let edge = false;
          enemies.forEach(e => { e.x += sp * dirX; if (e.x < 30 || e.x > W - 30) edge = true; });
          if (edge) { dirX = -dirX; enemies.forEach(e => { e.y += 20; }); }
          if (enemies.length && Math.random() < dt * o.enemyFire * (1 + wave * 0.2)) {
            const e = api.pick(enemies); bombs.push({ x: e.x, y: e.y + 15 });
          }
          shots.forEach(s => s.y -= 800 * dt);
          bombs.forEach(b => b.y += (260 + wave * 15) * dt);
          for (const s of shots) for (const e of enemies) {
            if (!s.dead && !e.dead && Math.abs(s.x - e.x) < 26 && Math.abs(s.y - e.y) < 20) { s.dead = e.dead = true; api.addScore(10 * (5 - Math.min(4, e.t))); }
          }
          enemies = enemies.filter(e => !e.dead);
          shots = shots.filter(s => !s.dead && s.y > TOP);
          const hitMe = b => Math.abs(b.x - x) < 26 && b.y > H - 90 && b.y < H - 40;
          for (const b of bombs) if (!b.dead && hitMe(b)) { b.dead = true; if (inv <= 0) { lives--; inv = 1.5; } }
          bombs = bombs.filter(b => !b.dead && b.y < H);
          if (enemies.some(e => e.y > H - 110)) lives = 0;
          if (lives <= 0) { api.end({ won: false }); return; }
          if (!enemies.length) { api.addScore(100); nextWave(); }
        },
        draw() {
          stars.forEach(s => api.rect(s.x, s.y, 2, 2, '#555'));
          enemies.forEach(e => {
            api.rrect(e.x - 22, e.y - 14, 44, 28, 8, C.pal[e.t % C.pal.length]);
            api.rect(e.x - 12, e.y - 4, 6, 6, C.bg); api.rect(e.x + 6, e.y - 4, 6, 6, C.bg);
          });
          shots.forEach(s => api.rect(s.x - 2, s.y - 12, 4, 16, C.warn));
          bombs.forEach(b => api.circle(b.x, b.y, 5, C.bad));
          if (inv <= 0 || Math.floor(inv * 10) % 2) {
            const ctx = api.ctx; ctx.beginPath(); ctx.moveTo(x, H - 90); ctx.lineTo(x - 26, H - 45); ctx.lineTo(x + 26, H - 45); ctx.closePath();
            ctx.fillStyle = C.accent; ctx.fill();
          }
          api.text('♥'.repeat(Math.max(0, lives)) + '   Wave ' + wave, 30, H - 20, 22, C.dim);
        }
      };
    }
  });

  // ------------------------------------------------------------------ Space Rocks
  register('rocks', {
    title: 'Space Rocks', icon: '☄️', color: '#44403C',
    help: '◀ ▶ rotate · ▲ thrust · OK fire · split every rock',
    variants: [
      { name: 'Normal', rockSpeed: 70, start: 4 },
      { name: 'Hard', rockSpeed: 110, start: 6 },
    ],
    create(o, api) {
      const { TOP, W, H, C } = api;
      const AH = H - TOP;
      const ship = { x: W / 2, y: TOP + AH / 2, a: -Math.PI / 2, vx: 0, vy: 0 };
      let rocks = [], bullets = [], lives = 3, inv = 2, level = 0, cool = 0;
      function wrap(p) {
        if (p.x < 0) p.x += W; if (p.x > W) p.x -= W;
        if (p.y < TOP) p.y += AH; if (p.y > H) p.y -= AH;
      }
      function rock(x, y, size) {
        const a = Math.random() * Math.PI * 2, s = o.rockSpeed * (1 + (3 - size) * 0.4) * (0.6 + Math.random() * 0.8);
        const pts = Array.from({ length: 10 }, () => 0.75 + Math.random() * 0.35);
        return { x, y, vx: Math.cos(a) * s, vy: Math.sin(a) * s, size, r: size * 20 + 8, pts, rot: Math.random() * 6 };
      }
      function nextLevel() {
        level++;
        for (let i = 0; i < o.start + level - 1; i++) {
          let x, y; do { x = Math.random() * W; y = TOP + Math.random() * AH; } while (Math.hypot(x - ship.x, y - ship.y) < 220);
          rocks.push(rock(x, y, 3));
        }
      }
      nextLevel();
      const fire = () => { if (cool <= 0 && bullets.length < 8) { bullets.push({ x: ship.x + Math.cos(ship.a) * 20, y: ship.y + Math.sin(ship.a) * 20, vx: Math.cos(ship.a) * 700 + ship.vx, vy: Math.sin(ship.a) * 700 + ship.vy, life: 0.9 }); cool = 0.18; } };
      return {
        key(k) { if (k === 'ok') fire(); },
        update(dt) {
          cool -= dt; inv -= dt;
          if (api.held.left) ship.a -= 4.2 * dt;
          if (api.held.right) ship.a += 4.2 * dt;
          if (api.held.up) { ship.vx += Math.cos(ship.a) * 400 * dt; ship.vy += Math.sin(ship.a) * 400 * dt; }
          if (api.held.ok) fire();
          ship.vx *= Math.pow(0.6, dt); ship.vy *= Math.pow(0.6, dt);
          ship.x += ship.vx * dt; ship.y += ship.vy * dt; wrap(ship);
          rocks.forEach(r => { r.x += r.vx * dt; r.y += r.vy * dt; r.rot += dt * 0.5; wrap(r); });
          bullets.forEach(b => { b.x += b.vx * dt; b.y += b.vy * dt; b.life -= dt; wrap(b); });
          const born = [];
          for (const b of bullets) for (const r of rocks) {
            if (b.life > 0 && !r.dead && Math.hypot(b.x - r.x, b.y - r.y) < r.r) {
              b.life = 0; r.dead = true; api.addScore([0, 100, 50, 20][r.size]);
              if (r.size > 1) { born.push(rock(r.x, r.y, r.size - 1), rock(r.x, r.y, r.size - 1)); }
            }
          }
          rocks = rocks.filter(r => !r.dead).concat(born);
          bullets = bullets.filter(b => b.life > 0);
          if (inv <= 0 && rocks.some(r => Math.hypot(r.x - ship.x, r.y - ship.y) < r.r + 12)) {
            lives--; if (lives <= 0) { api.end({ won: false }); return; }
            Object.assign(ship, { x: W / 2, y: TOP + AH / 2, vx: 0, vy: 0 }); inv = 2.5;
          }
          if (!rocks.length) { api.addScore(250); nextLevel(); }
        },
        draw(ctx) {
          ctx.lineWidth = 3; ctx.strokeStyle = '#B8B0A8';
          rocks.forEach(r => {
            ctx.beginPath();
            r.pts.forEach((p, i) => { const a = r.rot + i / r.pts.length * Math.PI * 2; const px = r.x + Math.cos(a) * r.r * p, py = r.y + Math.sin(a) * r.r * p; i ? ctx.lineTo(px, py) : ctx.moveTo(px, py); });
            ctx.closePath(); ctx.stroke();
          });
          bullets.forEach(b => api.circle(b.x, b.y, 3, C.warn));
          if (inv <= 0 || Math.floor(inv * 10) % 2) {
            ctx.save(); ctx.translate(ship.x, ship.y); ctx.rotate(ship.a);
            ctx.beginPath(); ctx.moveTo(20, 0); ctx.lineTo(-14, -12); ctx.lineTo(-8, 0); ctx.lineTo(-14, 12); ctx.closePath();
            ctx.strokeStyle = C.text; ctx.stroke();
            if (api.held.up) { ctx.beginPath(); ctx.moveTo(-10, -5); ctx.lineTo(-22, 0); ctx.lineTo(-10, 5); ctx.strokeStyle = C.pal[5]; ctx.stroke(); }
            ctx.restore();
          }
          api.text('♥'.repeat(lives) + '   Level ' + level, 30, H - 20, 22, C.dim);
        }
      };
    }
  });

  // ------------------------------------------------------------------ Stack Tower
  register('stack', {
    title: 'Stack Tower', icon: '🏗️', color: '#BE185D',
    help: 'OK drops the moving block · stack as high as you can',
    variants: [
      { name: 'Normal', speed: 420 },
      { name: 'Fast', speed: 650 },
    ],
    create(o, api) {
      const { TOP, W, H, C } = api;
      const bh = 34, base = H - 40;
      let stack = [{ x: W / 2 - 160, w: 320 }], cur, camera = 0, falling = [];
      function spawn() {
        const top = stack[stack.length - 1];
        const fromLeft = stack.length % 2 === 0;
        cur = { x: fromLeft ? -top.w : W, w: top.w, dir: fromLeft ? 1 : -1, sp: o.speed + stack.length * 6 };
      }
      spawn();
      const yOf = i => base - (i + 1) * bh + camera;
      return {
        key(k) {
          if (k !== 'ok') return;
          const top = stack[stack.length - 1];
          const l = Math.max(cur.x, top.x), r = Math.min(cur.x + cur.w, top.x + top.w);
          if (r <= l) { falling.push({ x: cur.x, w: cur.w, y: yOf(stack.length), vy: 0 }); api.end({ won: false }); return; }
          if (cur.x < l) falling.push({ x: cur.x, w: l - cur.x, y: yOf(stack.length), vy: 0 });
          if (cur.x + cur.w > r) falling.push({ x: r, w: cur.x + cur.w - r, y: yOf(stack.length), vy: 0 });
          let x = l, w = r - l;
          if (Math.abs(w - top.w) < 6) { x = top.x; w = top.w; api.addScore(2); } else api.addScore(1);
          stack.push({ x, w });
          spawn();
        },
        update(dt) {
          cur.x += cur.dir * cur.sp * dt;
          if (cur.x + cur.w > W + 40) cur.dir = -1;
          if (cur.x < -40 - 0) { if (cur.dir < 0 && cur.x < -cur.w) cur.dir = 1; }
          if (cur.x < -cur.w) cur.dir = 1;
          const want = Math.max(0, (stack.length - 10) * bh);
          camera += (want - camera) * Math.min(1, dt * 5);
          falling.forEach(f => { f.vy += 1400 * dt; f.y += f.vy * dt; });
          falling = falling.filter(f => f.y < H + 50);
        },
        draw() {
          stack.forEach((s, i) => { const y = yOf(i); if (y < H && y > TOP - bh) api.rect(s.x, y, s.w, bh - 2, `hsl(${(i * 12) % 360},65%,55%)`); });
          if (cur) api.rect(cur.x, yOf(stack.length), cur.w, bh - 2, `hsl(${(stack.length * 12) % 360},65%,55%)`);
          falling.forEach(f => api.rect(f.x, f.y, f.w, bh - 2, C.dim));
          api.text(stack.length - 1, W / 2, TOP + 60, 56, C.text, 'center', 700);
        }
      };
    }
  });

  // ------------------------------------------------------------------ Endless Runner
  register('runner', {
    title: 'Endless Runner', icon: '🏃', color: '#4D7C0F',
    help: 'OK or ▲ jump · ▼ duck under birds',
    variants: [
      { name: 'Day', speed: 420, night: false },
      { name: 'Night', speed: 560, night: true },
    ],
    create(o, api) {
      const { TOP, W, H, C } = api;
      const ground = H - 90, px = 180;
      let y = 0, vy = 0, duck = false, obs = [], speed = o.speed, dist = 0, nextIn = 1;
      const fg = o.night ? '#CBD5E1' : '#3F3F46', sky = o.night ? '#0F172A' : '#E7E5E4';
      return {
        key(k) { if ((k === 'ok' || k === 'up') && y === 0) vy = 900; },
        update(dt) {
          duck = !!api.held.down && y === 0;
          if (api.held.down && y > 0) vy -= 3000 * dt;
          vy -= 2600 * dt; y += vy * dt; if (y < 0) { y = 0; vy = 0; }
          speed += dt * 8; dist += speed * dt; api.setScore(Math.floor(dist / 40));
          nextIn -= dt;
          if (nextIn <= 0) {
            const bird = api.score > 15 && Math.random() < 0.3;
            if (bird) obs.push({ x: W + 40, w: 46, h: 30, y: Math.random() < 0.5 ? 60 : 30 + 28, bird: true });
            else { const n = 1 + api.rnd(3); obs.push({ x: W + 40, w: 22 * n + 6, h: 40 + api.rnd(30), y: 0 }); }
            nextIn = 0.7 + Math.random() * 0.9 * (420 / speed) + 0.25;
          }
          obs.forEach(ob => ob.x -= speed * dt);
          obs = obs.filter(ob => ob.x > -100);
          const ph = duck ? 34 : 64, pw = duck ? 60 : 40;
          for (const ob of obs) {
            const oy1 = ob.y, oy2 = ob.y + ob.h;
            if (px + pw - 6 > ob.x && px + 6 < ob.x + ob.w && y + ph - 4 > oy1 && y + 4 < oy2) { api.end({ won: false }); return; }
          }
        },
        draw() {
          api.rect(0, TOP, W, H - TOP, sky);
          api.rect(0, ground, W, 3, fg);
          const ph = duck ? 34 : 64, pw = duck ? 60 : 40;
          api.rrect(px, ground - y - ph, pw, ph, 8, o.night ? '#FBBF24' : '#2563EB');
          api.rect(px + pw - 14, ground - y - ph + 10, 6, 6, sky);
          for (const ob of obs) {
            if (ob.bird) {
              const flap = Math.floor(performance.now() / 150) % 2;
              api.rrect(ob.x, ground - ob.y - ob.h, ob.w, ob.h - 10, 8, fg);
              api.rect(ob.x + 10, ground - ob.y - ob.h + (flap ? -12 : 14), 22, 10, fg);
            } else api.rrect(ob.x, ground - ob.h, ob.w, ob.h, 6, o.night ? '#22C55E' : '#15803D');
          }
        }
      };
    }
  });

  // ------------------------------------------------------------------ Lane Racer
  register('racer', {
    title: 'Lane Racer', icon: '🏎️', color: '#B91C1C',
    help: '◀ ▶ change lanes · dodge the traffic',
    variants: [
      { name: '3 Lanes', lanes: 3 },
      { name: '5 Lanes', lanes: 5 },
    ],
    create(o, api) {
      const { TOP, W, H, C } = api;
      const lw = 130, roadW = lw * o.lanes, rx = (W - roadW) / 2, carY = H - 140;
      let lane = Math.floor(o.lanes / 2), cx = rx + lane * lw + lw / 2, cars = [], speed = 380, dist = 0, spawnT = 0, stripe = 0;
      return {
        key(k) {
          if (k === 'left' && lane > 0) lane--;
          if (k === 'right' && lane < o.lanes - 1) lane++;
        },
        update(dt) {
          speed += dt * 10; dist += speed * dt; stripe = (stripe + speed * dt) % 80;
          api.setScore(Math.floor(dist / 100));
          const tx = rx + lane * lw + lw / 2; cx += (tx - cx) * Math.min(1, dt * 14);
          spawnT -= dt;
          if (spawnT <= 0) {
            const free = []; for (let i = 0; i < o.lanes; i++) free.push(i);
            const n = 1 + (Math.random() < 0.35 && o.lanes > 2 ? 1 : 0) + (o.lanes > 3 && Math.random() < 0.3 ? 1 : 0);
            api.shuffle(free).slice(0, Math.min(n, o.lanes - 1)).forEach(l => cars.push({ lane: l, y: TOP - 120, v: 0.35 + Math.random() * 0.3, c: api.pick(C.pal) }));
            spawnT = Math.max(0.45, 1.1 - speed / 2000);
          }
          cars.forEach(c => c.y += speed * (1 - c.v) * dt);
          cars = cars.filter(c => c.y < H + 50);
          for (const c of cars) {
            const x = rx + c.lane * lw + lw / 2;
            if (Math.abs(x - cx) < 70 && Math.abs(c.y - carY) < 90) { api.end({ won: false }); return; }
          }
        },
        draw() {
          api.rect(0, TOP, W, H - TOP, '#14532D');
          api.rect(rx, TOP, roadW, H - TOP, '#3F3F46');
          for (let l = 1; l < o.lanes; l++) for (let y = TOP - 80 + stripe; y < H; y += 80) api.rect(rx + l * lw - 3, y, 6, 40, '#E5E7EB');
          const car = (x, y, col) => { api.rrect(x - 34, y - 45, 68, 90, 12, col); api.rrect(x - 26, y - 25, 52, 26, 6, '#1E293B'); };
          cars.forEach(c => car(rx + c.lane * lw + lw / 2, c.y, c.c));
          car(cx, carY, '#F8FAFC');
        }
      };
    }
  });

  // ------------------------------------------------------------------ Road Crossing
  register('crossing', {
    title: 'Road Crossing', icon: '🐸', color: '#15803D',
    help: 'Arrows hop · cross roads, ride logs, reach the top',
    variants: [
      { name: 'Normal', speed: 1 },
      { name: 'Hard', speed: 1.5 },
    ],
    create(o, api) {
      const { TOP, W, H, C } = api;
      const ROWS = 13, cell = Math.floor((H - TOP) / ROWS), cols = Math.floor(W / cell), ox = (W - cols * cell) / 2, oy = TOP + ((H - TOP) - ROWS * cell) / 2;
      // row types from top: goal, river x5, safe, road x5, start
      const types = ['goal', 'river', 'river', 'river', 'river', 'river', 'safe', 'road', 'road', 'road', 'road', 'road', 'start'];
      let level = 1, lanes, fx, fy, lives = 3, best;
      function build() {
        lanes = types.map((t, r) => {
          if (t !== 'road' && t !== 'river') return { t, items: [] };
          const dir = r % 2 ? 1 : -1, sp = (40 + Math.random() * 70) * o.speed * (1 + (level - 1) * 0.15) * dir;
          const items = [], len = t === 'river' ? 3 + api.rnd(2) : 1 + api.rnd(2), gap = t === 'river' ? len + 2 + api.rnd(2) : len + 3 + api.rnd(3);
          for (let x = api.rnd(gap); x < cols + gap; x += len + gap) items.push({ x: x * cell, len: len * cell });
          return { t, items, sp, span: Math.ceil((cols + gap) / (len + gap)) * (len + gap) * cell, col: api.pick(C.pal) };
        });
      }
      function reset() { fx = Math.floor(cols / 2) * cell; fy = ROWS - 1; best = ROWS - 1; }
      build(); reset();
      function die() { lives--; if (lives <= 0) api.end({ won: false }); else reset(); }
      return {
        key(k) {
          const d = api.DIRS[k]; if (!d) return;
          fx = api.clamp(fx + d[0] * cell, 0, (cols - 1) * cell); fy = api.clamp(fy + d[1], 0, ROWS - 1);
          if (fy < best) { best = fy; api.addScore(10); }
          if (fy === 0) { api.addScore(100 * level); level++; build(); reset(); }
        },
        update(dt) {
          lanes.forEach(l => l.items.forEach(it => {
            it.x += l.sp * dt;
            if (l.sp > 0 && it.x > W) it.x -= l.span;
            if (l.sp < 0 && it.x + it.len < 0) it.x += l.span;
          }));
          const l = lanes[fy], cxm = fx + cell / 2;
          if (l.t === 'road') { if (l.items.some(it => cxm > it.x + 6 && cxm < it.x + it.len - 6 || (fx + cell - 8 > it.x && fx + 8 < it.x + it.len))) die(); }
          else if (l.t === 'river') {
            const on = l.items.find(it => cxm > it.x && cxm < it.x + it.len);
            if (!on) die(); else { fx += l.sp * dt; if (fx < -cell / 2 || fx > (cols - 0.5) * cell) die(); }
          }
        },
        draw(ctx) {
          ctx.save(); ctx.beginPath(); ctx.rect(ox, oy, cols * cell, ROWS * cell); ctx.clip();
          lanes.forEach((l, r) => {
            const y = oy + r * cell;
            const bg = { goal: '#166534', river: '#1E40AF', safe: '#4D7C0F', road: '#27272A', start: '#4D7C0F' }[l.t];
            api.rect(ox, y, cols * cell, cell, bg);
            l.items.forEach(it => {
              if (l.t === 'road') api.rrect(ox + it.x + 4, y + 8, it.len - 8, cell - 16, 8, l.col);
              else api.rrect(ox + it.x + 2, y + 6, it.len - 4, cell - 12, 10, '#92400E');
            });
          });
          api.circle(ox + fx + cell / 2, oy + fy * cell + cell / 2, cell * 0.36, '#A3E635', '#14532D', 3);
          ctx.restore();
          api.text('♥'.repeat(Math.max(0, lives)) + '  Level ' + level, ox + 10, oy + cell / 2, 22, C.text);
        }
      };
    }
  });
})();
