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
})();
