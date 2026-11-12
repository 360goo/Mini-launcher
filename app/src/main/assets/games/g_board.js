/* Board games: Tic-Tac-Toe, Four in a Row, Reversi, Checkers, Five in a Row, Memory Match, Code Breaker. */
(function () {
  const { register } = Engine;
  const A = Engine.api;
  const CPU_DELAY = 0.4;

  // Delays the result overlay a moment so the final move is visible.
  function finisher(api) {
    let pending = null, t = 0;
    return {
      finish(r) { if (!pending) { pending = r; t = 0; } },
      get done() { return !!pending; },
      tick(dt) { if (pending) { t += dt; if (t > 1) api.end(pending); } }
    };
  }
  function moveCursor(cur, k, cols, rows) {
    const d = A.DIRS[k]; if (!d) return false;
    cur.x = (cur.x + d[0] + cols) % cols; cur.y = (cur.y + d[1] + rows) % rows;
    return true;
  }
  function status(api, s, color) { api.text(s, api.W / 2, api.H - 22, 24, color || api.C.dim, 'center'); }

  // ================================================================ Tic-Tac-Toe
  const LINES = [[0, 1, 2], [3, 4, 5], [6, 7, 8], [0, 3, 6], [1, 4, 7], [2, 5, 8], [0, 4, 8], [2, 4, 6]];
  function tttWinner(b) {
    for (const [a, c, d] of LINES) if (b[a] && b[a] === b[c] && b[a] === b[d]) return b[a];
    return b.every(x => x) ? 'D' : null;
  }
  function tttMinimax(b, me, turn, depth) {
    const w = tttWinner(b);
    if (w === 'D') return 0;
    if (w) return w === me ? 10 - depth : depth - 10;
    let best = turn === me ? -99 : 99;
    for (let i = 0; i < 9; i++) if (!b[i]) {
      b[i] = turn;
      const s = tttMinimax(b, me, turn === 'X' ? 'O' : 'X', depth + 1);
      b[i] = null;
      best = turn === me ? Math.max(best, s) : Math.min(best, s);
    }
    return best;
  }
  function tttBest(b, me) {
    const opp = me === 'X' ? 'O' : 'X';
    let bestS = -99, moves = [];
    for (let i = 0; i < 9; i++) if (!b[i]) {
      b[i] = me; const s = tttMinimax(b, me, opp, 1); b[i] = null;
      if (s > bestS) { bestS = s; moves = [i]; } else if (s === bestS) moves.push(i);
    }
    return A.pick(moves);
  }
  function tttEasy(b, me) {
    const opp = me === 'X' ? 'O' : 'X';
    const empty = b.map((v, i) => v ? -1 : i).filter(i => i >= 0);
    for (const p of [me, opp]) {
      if (p === opp && Math.random() < 0.5) break;
      for (const i of empty) { b[i] = p; const w = tttWinner(b) === p; b[i] = null; if (w) return i; }
    }
    return A.pick(empty);
  }

  register('tictactoe', {
    title: 'Tic-Tac-Toe', icon: '❌', color: '#C0392B',
    help: 'Arrows move · OK places your mark · three in a row wins',
    variants: [{ name: 'vs CPU Easy', cpu: 'easy' }, { name: 'vs CPU Hard', cpu: 'hard' }, { name: '2 Players', cpu: null }],
    create(o, api) {
      const { C, W, TOP } = api;
      const b = Array(9).fill(null), cur = { x: 1, y: 1 }, fin = finisher(api);
      let turn = 'X', cpuT = 0, line = null;
      const size = 170, ox = W / 2 - size * 1.5, oy = TOP + 60;
      function place(i) {
        if (b[i] || fin.done) return;
        b[i] = turn;
        const w = tttWinner(b);
        if (w) {
          line = LINES.find(([a, c, d]) => b[a] && b[a] === b[c] && b[a] === b[d]);
          if (o.cpu) {
            const sc = w === 'X' ? 3 : w === 'D' ? 1 : 0;
            api.setScore(sc);
            fin.finish({ won: w === 'X', text: w === 'X' ? 'You win!' : w === 'D' ? 'Draw' : 'You lose' });
          } else fin.finish({ won: w !== 'D', text: w === 'D' ? 'Draw' : w + ' wins', score: null });
          return;
        }
        turn = turn === 'X' ? 'O' : 'X';
      }
      return {
        key(k) {
          if (moveCursor(cur, k, 3, 3)) return;
          if (k === 'ok' && !(o.cpu && turn === 'O')) place(cur.y * 3 + cur.x);
        },
        update(dt) {
          fin.tick(dt);
          if (o.cpu && turn === 'O' && !fin.done && (cpuT += dt) > CPU_DELAY) {
            cpuT = 0; place(o.cpu === 'hard' ? tttBest(b, 'O') : tttEasy(b, 'O'));
          }
        },
        draw(ctx) {
          api.rrect(ox - 10, oy - 10, size * 3 + 20, size * 3 + 20, 16, C.panel);
          for (let i = 0; i < 9; i++) {
            const x = ox + (i % 3) * size, y = oy + Math.floor(i / 3) * size;
            api.rrect(x + 6, y + 6, size - 12, size - 12, 12, C.panel2);
            const cx = x + size / 2, cy = y + size / 2, r = size * 0.28;
            ctx.lineWidth = 14; ctx.lineCap = 'round';
            if (b[i] === 'X') {
              ctx.strokeStyle = C.bad; ctx.beginPath();
              ctx.moveTo(cx - r, cy - r); ctx.lineTo(cx + r, cy + r); ctx.moveTo(cx + r, cy - r); ctx.lineTo(cx - r, cy + r); ctx.stroke();
            } else if (b[i] === 'O') api.circle(cx, cy, r, null, C.accent, 14);
          }
          if (!fin.done) api.rrect(ox + cur.x * size + 3, oy + cur.y * size + 3, size - 6, size - 6, 14, null, C.warn, 5);
          if (line) {
            const p = i => [ox + (i % 3) * size + size / 2, oy + Math.floor(i / 3) * size + size / 2];
            ctx.strokeStyle = C.text; ctx.lineWidth = 10; ctx.beginPath();
            ctx.moveTo(...p(line[0])); ctx.lineTo(...p(line[2])); ctx.stroke();
          }
          status(api, fin.done ? '' : o.cpu ? (turn === 'X' ? 'Your turn (X)' : 'CPU is thinking…') : turn + ' to move');
        }
      };
    }
  });

  // ================================================================ Four in a Row
  const FR = 6, FC = 7, ORDER = [3, 2, 4, 1, 5, 0, 6];
  function fourDrop(b, c) { for (let r = FR - 1; r >= 0; r--) if (!b[r][c]) return r; return -1; }
  function fourWinAt(b, r, c, p) {
    for (const [dr, dc] of [[0, 1], [1, 0], [1, 1], [1, -1]]) {
      let n = 1;
      for (const s of [1, -1]) {
        let rr = r + dr * s, cc = c + dc * s;
        while (rr >= 0 && rr < FR && cc >= 0 && cc < FC && b[rr][cc] === p) { n++; rr += dr * s; cc += dc * s; }
      }
      if (n >= 4) return true;
    }
    return false;
  }
  function fourEval(b, p) {
    const o = 3 - p; let s = 0;
    for (let r = 0; r < FR; r++) { if (b[r][3] === p) s += 3; else if (b[r][3] === o) s -= 3; }
    const win = (cells) => {
      let mp = 0, mo = 0;
      for (const [r, c] of cells) { if (b[r][c] === p) mp++; else if (b[r][c] === o) mo++; }
      if (mp && mo) return 0;
      if (mp === 3) return 5; if (mp === 2) return 2;
      if (mo === 3) return -4; if (mo === 2) return -2;
      return 0;
    };
    for (let r = 0; r < FR; r++) for (let c = 0; c < FC; c++) {
      for (const [dr, dc] of [[0, 1], [1, 0], [1, 1], [1, -1]]) {
        const er = r + dr * 3, ec = c + dc * 3;
        if (er < 0 || er >= FR || ec < 0 || ec >= FC) continue;
        s += win([[r, c], [r + dr, c + dc], [r + 2 * dr, c + 2 * dc], [er, ec]]);
      }
    }
    return s;
  }
  function fourNegamax(b, depth, alpha, beta, p) {
    let best = -Infinity, any = false;
    for (const c of ORDER) {
      const r = fourDrop(b, c); if (r < 0) continue;
      any = true;
      b[r][c] = p;
      let s;
      if (fourWinAt(b, r, c, p)) s = 100000 + depth;
      else if (depth === 0) s = fourEval(b, p);
      else s = -fourNegamax(b, depth - 1, -beta, -alpha, 3 - p);
      b[r][c] = 0;
      if (s > best) best = s;
      if (best > alpha) alpha = best;
      if (alpha >= beta) break;
    }
    return any ? best : 0;
  }
  function fourBest(b, p, depth) {
    let best = -Infinity, moves = [];
    for (const c of ORDER) {
      const r = fourDrop(b, c); if (r < 0) continue;
      b[r][c] = p;
      const s = fourWinAt(b, r, c, p) ? 1e6 : -fourNegamax(b, depth - 1, -Infinity, Infinity, 3 - p);
      b[r][c] = 0;
      if (s > best) { best = s; moves = [c]; } else if (s === best) moves.push(c);
    }
    return moves[0];
  }
  function fourEasy(b, p) {
    const cols = ORDER.filter(c => fourDrop(b, c) >= 0);
    for (const q of [p, 3 - p]) for (const c of cols) {
      const r = fourDrop(b, c); b[r][c] = q; const w = fourWinAt(b, r, c, q); b[r][c] = 0;
      if (w && (q === p || Math.random() < 0.6)) return c;
    }
    return A.pick(cols);
  }

  register('four', {
    title: 'Four in a Row', icon: '🔴', color: '#1F5FBF',
    help: 'Left/Right pick a column · OK drops a disc · connect four',
    variants: [{ name: 'vs CPU Easy', cpu: 'easy' }, { name: 'vs CPU Hard', cpu: 'hard' }, { name: '2 Players', cpu: null }],
    create(o, api) {
      const { C, W, TOP } = api;
      const b = Array.from({ length: FR }, () => Array(FC).fill(0));
      const cell = 84, ox = W / 2 - cell * FC / 2, oy = TOP + 100;
      const fin = finisher(api), colors = [null, C.bad, C.warn], names = [null, 'Red', 'Yellow'];
      let col = 3, turn = 1, cpuT = 0, moves = 0, winCells = null;
      function drop(c) {
        const r = fourDrop(b, c); if (r < 0 || fin.done) return;
        b[r][c] = turn; moves++;
        if (fourWinAt(b, r, c, turn)) {
          winCells = [r, c];
          if (o.cpu) {
            api.setScore(turn === 1 ? Math.max(1, 43 - moves) : 0);
            fin.finish({ won: turn === 1, text: turn === 1 ? 'You win!' : 'You lose' });
          } else fin.finish({ won: true, text: names[turn] + ' wins', score: null });
          return;
        }
        if (moves === FR * FC) { fin.finish({ won: false, text: 'Draw', score: o.cpu ? 0 : null }); return; }
        turn = 3 - turn;
      }
      return {
        key(k) {
          if (o.cpu && turn === 2) return;
          if (k === 'left') col = (col + FC - 1) % FC;
          else if (k === 'right') col = (col + 1) % FC;
          else if (k === 'ok') drop(col);
        },
        update(dt) {
          fin.tick(dt);
          if (o.cpu && turn === 2 && !fin.done && (cpuT += dt) > CPU_DELAY) {
            cpuT = 0; drop(o.cpu === 'hard' ? fourBest(b, 2, 6) : fourEasy(b, 2));
          }
        },
        draw(ctx) {
          if (!fin.done && !(o.cpu && turn === 2)) api.circle(ox + col * cell + cell / 2, oy - 46, cell * 0.38, colors[turn]);
          api.rrect(ox - 12, oy - 12, cell * FC + 24, cell * FR + 24, 18, '#1F4FA8');
          for (let r = 0; r < FR; r++) for (let c = 0; c < FC; c++)
            api.circle(ox + c * cell + cell / 2, oy + r * cell + cell / 2, cell * 0.38, b[r][c] ? colors[b[r][c]] : C.bg);
          if (winCells) api.circle(ox + winCells[1] * cell + cell / 2, oy + winCells[0] * cell + cell / 2, cell * 0.42, null, C.text, 5);
          status(api, fin.done ? '' : o.cpu ? (turn === 1 ? 'Your turn (Red)' : 'CPU is thinking…') : names[turn] + ' to move', colors[turn]);
        }
      };
    }
  });

  // ================================================================ Reversi
  const D8 = [[1, 0], [-1, 0], [0, 1], [0, -1], [1, 1], [1, -1], [-1, 1], [-1, -1]];
  const RW = [
    100, -20, 10, 5, 5, 10, -20, 100, -20, -50, -2, -2, -2, -2, -50, -20, 10, -2, 1, 1, 1, 1, -2, 10, 5, -2, 1, 0, 0, 1, -2, 5,
    5, -2, 1, 0, 0, 1, -2, 5, 10, -2, 1, 1, 1, 1, -2, 10, -20, -50, -2, -2, -2, -2, -50, -20, 100, -20, 10, 5, 5, 10, -20, 100];
  function rvFlips(b, i, p) {
    if (b[i]) return [];
    const r = i >> 3, c = i & 7, out = [];
    for (const [dr, dc] of D8) {
      let rr = r + dr, cc = c + dc; const line = [];
      while (rr >= 0 && rr < 8 && cc >= 0 && cc < 8 && b[rr * 8 + cc] === 3 - p) { line.push(rr * 8 + cc); rr += dr; cc += dc; }
      if (line.length && rr >= 0 && rr < 8 && cc >= 0 && cc < 8 && b[rr * 8 + cc] === p) out.push(...line);
    }
    return out;
  }
  function rvMoves(b, p) {
    const m = [];
    for (let i = 0; i < 64; i++) if (!b[i]) { const f = rvFlips(b, i, p); if (f.length) m.push({ i, f }); }
    return m;
  }
  function rvApply(b, m, p) { const nb = b.slice(); nb[m.i] = p; for (const j of m.f) nb[j] = p; return nb; }
  function rvEval(b, p) {
    let s = 0;
    for (let i = 0; i < 64; i++) if (b[i] === p) s += RW[i]; else if (b[i]) s -= RW[i];
    return s + 4 * (rvMoves(b, p).length - rvMoves(b, 3 - p).length);
  }
  function rvSearch(b, p, depth, alpha, beta) {
    const moves = rvMoves(b, p);
    if (depth === 0) return rvEval(b, p);
    if (!moves.length) {
      if (!rvMoves(b, 3 - p).length) { let d = 0; for (const x of b) if (x === p) d++; else if (x) d--; return d * 1000; }
      return -rvSearch(b, 3 - p, depth - 1, -beta, -alpha);
    }
    let best = -Infinity;
    for (const m of moves) {
      const s = -rvSearch(rvApply(b, m, p), 3 - p, depth - 1, -beta, -alpha);
      if (s > best) best = s; if (best > alpha) alpha = best; if (alpha >= beta) break;
    }
    return best;
  }
  function rvBest(b, p, depth) {
    let best = -Infinity, pickM = [];
    for (const m of rvMoves(b, p)) {
      const s = -rvSearch(rvApply(b, m, p), 3 - p, depth - 1, -Infinity, Infinity);
      if (s > best) { best = s; pickM = [m]; } else if (s === best) pickM.push(m);
    }
    return A.pick(pickM);
  }

  register('reversi', {
    title: 'Reversi', icon: '⚫', color: '#1E7A46',
    help: 'Arrows move · OK places · outflank to flip discs · most discs wins',
    variants: [{ name: 'vs CPU Easy', cpu: 'easy' }, { name: 'vs CPU Hard', cpu: 'hard' }, { name: '2 Players', cpu: null }],
    create(o, api) {
      const { C, W, TOP } = api;
      let b = Array(64).fill(0);
      b[27] = b[36] = 2; b[28] = b[35] = 1;
      const cell = 74, ox = W / 2 - cell * 4, oy = TOP + 18;
      const fin = finisher(api), cur = { x: 2, y: 3 }, names = [null, 'Black', 'White'];
      let turn = 1, cpuT = 0, msg = '', moves = rvMoves(b, 1);
      const count = p => b.filter(x => x === p).length;
      function play(m) {
        b = rvApply(b, m, turn); msg = '';
        api.setScore(count(1));
        let next = 3 - turn;
        if (!rvMoves(b, next).length) {
          if (!rvMoves(b, turn).length) return gameOver();
          msg = names[next] + ' has no move — pass';
          next = turn;
        }
        turn = next; moves = rvMoves(b, turn);
      }
      function gameOver() {
        const a = count(1), w = count(2);
        api.setScore(a);
        if (o.cpu) fin.finish({ won: a > w, text: a > w ? 'You win!' : a === w ? 'Draw' : 'You lose', score: a });
        else fin.finish({ won: a !== w, text: a === w ? 'Draw' : (a > w ? 'Black' : 'White') + ' wins ' + Math.max(a, w) + '–' + Math.min(a, w), score: null });
        moves = [];
      }
      return {
        key(k) {
          if (moveCursor(cur, k, 8, 8) || k !== 'ok' || fin.done || (o.cpu && turn === 2)) return;
          const m = moves.find(m => m.i === cur.y * 8 + cur.x);
          if (m) play(m);
        },
        update(dt) {
          fin.tick(dt);
          if (o.cpu && turn === 2 && !fin.done && (cpuT += dt) > CPU_DELAY) {
            cpuT = 0; play(o.cpu === 'hard' ? rvBest(b, 2, 3) : A.pick(moves));
          }
        },
        draw(ctx) {
          api.rrect(ox - 10, oy - 10, cell * 8 + 20, cell * 8 + 20, 14, '#14532D');
          for (let i = 0; i < 64; i++) {
            const x = ox + (i & 7) * cell, y = oy + (i >> 3) * cell;
            api.rect(x + 2, y + 2, cell - 4, cell - 4, '#1E7A46');
            if (b[i]) api.circle(x + cell / 2, y + cell / 2, cell * 0.4, b[i] === 1 ? '#111' : '#F5F5F5', b[i] === 1 ? '#444' : null, 2);
          }
          if (!(o.cpu && turn === 2)) for (const m of moves)
            api.circle(ox + (m.i & 7) * cell + cell / 2, oy + (m.i >> 3) * cell + cell / 2, 8, 'rgba(255,255,255,0.35)');
          if (!fin.done) api.rrect(ox + cur.x * cell + 1, oy + cur.y * cell + 1, cell - 2, cell - 2, 8, null, C.warn, 4);
          const sx = ox + cell * 8 + 50;
          api.circle(sx + 20, TOP + 120, 20, '#111', '#444', 2); api.text(count(1), sx + 56, TOP + 120, 32, C.text);
          api.circle(sx + 20, TOP + 180, 20, '#F5F5F5'); api.text(count(2), sx + 56, TOP + 180, 32, C.text);
          if (!fin.done) api.text((o.cpu ? (turn === 1 ? 'Your turn' : 'CPU…') : names[turn] + ' to move'), sx, TOP + 250, 24, C.dim);
          if (msg) api.text(msg, 40, TOP + 300, 20, C.warn);
        }
      };
    }
  });

  // ================================================================ Checkers
  function ckDirs(pc) { return pc.k ? [[-1, -1], [-1, 1], [1, -1], [1, 1]] : pc.p === 1 ? [[-1, -1], [-1, 1]] : [[1, -1], [1, 1]]; }
  function ckJumps(b, from, pc, cur, path, caps, out) {
    const r = cur >> 3, c = cur & 7; let found = false;
    for (const [dr, dc] of ckDirs(pc)) {
      const lr = r + 2 * dr, lc = c + 2 * dc;
      if (lr < 0 || lr > 7 || lc < 0 || lc > 7) continue;
      const m = (r + dr) * 8 + c + dc, l = lr * 8 + lc;
      if (b[m] && b[m].p !== pc.p && !caps.includes(m) && (!b[l] || l === from)) {
        found = true;
        const np = path.concat(l), nc = caps.concat(m);
        const kinged = !pc.k && ((pc.p === 1 && lr === 0) || (pc.p === 2 && lr === 7));
        if (kinged) out.push({ from, path: np, caps: nc }); else ckJumps(b, from, pc, l, np, nc, out);
      }
    }
    if (!found && path.length) out.push({ from, path, caps });
  }
  function ckSeqs(b, p) {
    const jumps = [], steps = [];
    for (let i = 0; i < 64; i++) if (b[i] && b[i].p === p) ckJumps(b, i, b[i], i, [], [], jumps);
    if (jumps.length) return jumps;
    for (let i = 0; i < 64; i++) if (b[i] && b[i].p === p) {
      for (const [dr, dc] of ckDirs(b[i])) {
        const r = (i >> 3) + dr, c = (i & 7) + dc;
        if (r >= 0 && r < 8 && c >= 0 && c < 8 && !b[r * 8 + c]) steps.push({ from: i, path: [r * 8 + c], caps: [] });
      }
    }
    return steps;
  }
  function ckApply(b, s) {
    const nb = b.slice(), pc = Object.assign({}, nb[s.from]);
    nb[s.from] = null; for (const c of s.caps) nb[c] = null;
    const land = s.path[s.path.length - 1], lr = land >> 3;
    if ((pc.p === 1 && lr === 0) || (pc.p === 2 && lr === 7)) pc.k = true;
    nb[land] = pc; return nb;
  }
  function ckMaterial(b, p) { let s = 0; for (const x of b) if (x) s += (x.p === p ? 1 : -1) * (x.k ? 1.6 : 1); return s; }
  function ckCpu(b, p) {
    let best = -Infinity, choices = [];
    for (const s of ckSeqs(b, p)) {
      const nb = ckApply(b, s);
      const replies = ckSeqs(nb, 3 - p);
      let worst = replies.length ? Infinity : 1000;
      for (const r of replies) worst = Math.min(worst, ckMaterial(ckApply(nb, r), p));
      // small preference for advancing and staying on the edges
      const land = s.path[s.path.length - 1], adv = (land >> 3) * 0.02, edge = ((land & 7) === 0 || (land & 7) === 7) ? 0.03 : 0;
      const sc = worst + adv + edge;
      if (sc > best + 1e-9) { best = sc; choices = [s]; } else if (Math.abs(sc - best) < 1e-9) choices.push(s);
    }
    return A.pick(choices);
  }

  register('checkers', {
    title: 'Checkers', icon: '🔵', color: '#8E5A2B',
    help: 'OK selects a piece, then OK on a highlighted square · captures are compulsory',
    variants: [{ name: 'vs CPU', cpu: true }, { name: '2 Players', cpu: false }],
    create(o, api) {
      const { C, W, TOP } = api;
      let b = Array(64).fill(null);
      for (let i = 0; i < 64; i++) if (((i >> 3) + (i & 7)) % 2) { if ((i >> 3) < 3) b[i] = { p: 2, k: false }; else if ((i >> 3) > 4) b[i] = { p: 1, k: false }; }
      const cell = 76, ox = W / 2 - cell * 4, oy = TOP + 14, fin = finisher(api), cur = { x: 2, y: 5 };
      const names = [null, 'Red', 'Blue'], colors = [null, '#E5484D', '#3E7BFA'];
      let turn = 1, sel = null, partial = [], seqs = ckSeqs(b, 1), cpuT = 0, quiet = 0;
      function cands() { return seqs.filter(s => s.from === sel && partial.every((v, i) => s.path[i] === v)); }
      function commit(s) {
        b = ckApply(b, s); sel = null; partial = [];
        quiet = s.caps.length ? 0 : quiet + 1;
        const left = p => b.filter(x => x && x.p === p).length;
        api.setScore(o.cpu ? left(1) * 10 : 0);
        turn = 3 - turn; seqs = ckSeqs(b, turn);
        if (!seqs.length) {
          const winner = 3 - turn;
          if (o.cpu) fin.finish({ won: winner === 1, text: winner === 1 ? 'You win!' : 'You lose', score: winner === 1 ? left(1) * 10 : 0 });
          else fin.finish({ won: true, text: names[winner] + ' wins', score: null });
        } else if (quiet >= 80) fin.finish({ won: false, text: 'Draw', score: o.cpu ? 0 : null });
      }
      return {
        key(k) {
          if (moveCursor(cur, k, 8, 8) || k !== 'ok' || fin.done || (o.cpu && turn === 2)) return;
          const i = cur.y * 8 + cur.x;
          if (sel === null || (!partial.length && seqs.some(s => s.from === i))) {
            if (sel === i) { sel = null; return; }
            if (seqs.some(s => s.from === i)) { sel = i; partial = []; }
            return;
          }
          const cs = cands(), next = cs.map(s => s.path[partial.length]);
          if (!next.includes(i)) return;
          partial.push(i);
          const done = cs.find(s => s.path.length === partial.length && s.path.every((v, j) => v === partial[j]));
          if (done) commit(done);
        },
        update(dt) {
          fin.tick(dt);
          if (o.cpu && turn === 2 && !fin.done && (cpuT += dt) > CPU_DELAY + 0.2) { cpuT = 0; commit(ckCpu(b, 2)); }
        },
        draw(ctx) {
          api.rrect(ox - 10, oy - 10, cell * 8 + 20, cell * 8 + 20, 12, '#5A3A1C');
          const targets = sel !== null ? cands().map(s => s.path[partial.length]) : [];
          const movable = new Set(seqs.map(s => s.from));
          for (let i = 0; i < 64; i++) {
            const x = ox + (i & 7) * cell, y = oy + (i >> 3) * cell, dark = ((i >> 3) + (i & 7)) % 2;
            api.rect(x, y, cell, cell, dark ? '#7A5230' : '#E8D3B0');
            if (partial.includes(i)) api.rect(x, y, cell, cell, 'rgba(255,197,66,0.35)');
            const pc = b[i];
            if (pc) {
              api.circle(x + cell / 2, y + cell / 2, cell * 0.36, colors[pc.p], i === sel ? C.warn : 'rgba(0,0,0,0.4)', i === sel ? 6 : 3);
              if (pc.k) api.text('♔', x + cell / 2, y + cell / 2 + 2, 34, '#fff', 'center');
              else if (!fin.done && movable.has(i) && !(o.cpu && turn === 2) && sel === null) api.circle(x + cell / 2, y + cell / 2, 6, 'rgba(255,255,255,0.7)');
            }
            if (targets.includes(i)) api.circle(x + cell / 2, y + cell / 2, 14, 'rgba(61,220,132,0.85)');
          }
          if (!fin.done) api.rrect(ox + cur.x * cell + 2, oy + cur.y * cell + 2, cell - 4, cell - 4, 8, null, C.warn, 4);
          const sx = ox + cell * 8 + 40;
          if (!fin.done) api.text(o.cpu ? (turn === 1 ? 'Your move (Red)' : 'CPU…') : names[turn] + ' to move', sx, TOP + 120, 24, colors[turn]);
          if (seqs.length && seqs[0].caps.length && !fin.done) api.text('Capture!', sx, TOP + 160, 22, C.warn);
        }
      };
    }
  });

  // ================================================================ Five in a Row
  const GN = 15;
  function gmLine(b, i, p, dr, dc) {
    // Counts stones of p through i (assumed p) in one direction pair, plus open ends.
    const r = Math.floor(i / GN), c = i % GN; let n = 1, open = 0;
    for (const s of [1, -1]) {
      let rr = r + dr * s, cc = c + dc * s;
      while (rr >= 0 && rr < GN && cc >= 0 && cc < GN && b[rr * GN + cc] === p) { n++; rr += dr * s; cc += dc * s; }
      if (rr >= 0 && rr < GN && cc >= 0 && cc < GN && !b[rr * GN + cc]) open++;
    }
    return [n, open];
  }
  const GDIRS = [[0, 1], [1, 0], [1, 1], [1, -1]];
  function gmWins(b, i, p) { return GDIRS.some(([dr, dc]) => gmLine(b, i, p, dr, dc)[0] >= 5); }
  function gmCellScore(b, i, p) {
    let s = 0;
    for (const [dr, dc] of GDIRS) {
      const [n, open] = gmLine(b, i, p, dr, dc);
      if (n >= 5) s += 100000;
      else if (n === 4) s += open === 2 ? 10000 : open === 1 ? 1200 : 0;
      else if (n === 3) s += open === 2 ? 1000 : open === 1 ? 100 : 0;
      else if (n === 2) s += open === 2 ? 100 : open === 1 ? 10 : 0;
      else s += open;
    }
    return s;
  }
  function gmBest(b, p) {
    let best = -1, moves = [], any = false;
    for (let i = 0; i < GN * GN; i++) {
      if (b[i]) { any = true; continue; }
      const r = Math.floor(i / GN), c = i % GN; let near = false;
      for (let dr = -2; dr <= 2 && !near; dr++) for (let dc = -2; dc <= 2; dc++) {
        const rr = r + dr, cc = c + dc;
        if (rr >= 0 && rr < GN && cc >= 0 && cc < GN && b[rr * GN + cc]) { near = true; break; }
      }
      if (!near) continue;
      b[i] = p; const att = gmCellScore(b, i, p);
      b[i] = 3 - p; const def = gmCellScore(b, i, 3 - p);
      b[i] = 0;
      const s = att * 1.1 + def;
      if (s > best) { best = s; moves = [i]; } else if (s === best) moves.push(i);
    }
    if (!any) return 7 * GN + 7;
    return moves.length ? A.pick(moves) : b.indexOf(0);
  }

  register('gomoku', {
    title: 'Five in a Row', icon: '⚪', color: '#B7791F',
    help: 'Arrows move · OK places a stone · get five in a line',
    variants: [{ name: 'vs CPU', cpu: true }, { name: '2 Players', cpu: false }],
    create(o, api) {
      const { C, W, TOP } = api;
      const b = Array(GN * GN).fill(0), cell = 42, ox = W / 2 - cell * GN / 2, oy = TOP + 12;
      const fin = finisher(api), cur = { x: 7, y: 7 }, names = [null, 'Black', 'White'];
      let turn = 1, cpuT = 0, last = -1, n = 0;
      function place(i) {
        if (b[i] || fin.done) return;
        b[i] = turn; last = i; n++;
        if (gmWins(b, i, turn)) {
          if (o.cpu) { api.setScore(turn === 1 ? Math.max(1, 120 - Math.ceil(n / 2)) : 0); fin.finish({ won: turn === 1, text: turn === 1 ? 'You win!' : 'You lose' }); }
          else fin.finish({ won: true, text: names[turn] + ' wins', score: null });
          return;
        }
        if (n === GN * GN) { fin.finish({ won: false, text: 'Draw', score: o.cpu ? 0 : null }); return; }
        turn = 3 - turn;
      }
      return {
        key(k) {
          if (moveCursor(cur, k, GN, GN) || k !== 'ok' || (o.cpu && turn === 2)) return;
          place(cur.y * GN + cur.x);
        },
        update(dt) {
          fin.tick(dt);
          if (o.cpu && turn === 2 && !fin.done && (cpuT += dt) > CPU_DELAY) { cpuT = 0; place(gmBest(b, 2)); }
        },
        draw(ctx) {
          api.rrect(ox - 12, oy - 12, cell * GN + 24, cell * GN + 24, 12, '#C9A063');
          ctx.strokeStyle = '#6B4E22'; ctx.lineWidth = 2;
          for (let i = 0; i < GN; i++) {
            ctx.beginPath(); ctx.moveTo(ox + cell / 2, oy + i * cell + cell / 2); ctx.lineTo(ox + cell * GN - cell / 2, oy + i * cell + cell / 2); ctx.stroke();
            ctx.beginPath(); ctx.moveTo(ox + i * cell + cell / 2, oy + cell / 2); ctx.lineTo(ox + i * cell + cell / 2, oy + cell * GN - cell / 2); ctx.stroke();
          }
          for (let i = 0; i < GN * GN; i++) if (b[i]) {
            const x = ox + (i % GN) * cell + cell / 2, y = oy + Math.floor(i / GN) * cell + cell / 2;
            api.circle(x, y, cell * 0.42, b[i] === 1 ? '#111' : '#F5F5F5', i === last ? C.bad : null, 3);
          }
          if (!fin.done) api.rrect(ox + cur.x * cell + 2, oy + cur.y * cell + 2, cell - 4, cell - 4, 6, null, C.accent, 4);
          if (!fin.done) api.text(o.cpu ? (turn === 1 ? 'Your turn' : 'CPU…') : names[turn], ox + cell * GN + 40, TOP + 120, 24, C.dim);
        }
      };
    }
  });

  // ================================================================ Memory Match
  const FACES = ['🍎', '🍌', '🍇', '🍉', '🍒', '🍓', '🥝', '🍍', '🥕', '🌽', '🍄', '🐶', '🐱', '🦊', '🐼', '🐸', '🚗', '⚽', '🎈', '⭐'];
  register('memory', {
    title: 'Memory Match', icon: '🃏', color: '#7D3C98', lowerIsBetter: true, scoreLabel: 'Moves',
    help: 'Arrows move · OK flips a card · find all the pairs in few moves',
    variants: [{ name: '4×3', cols: 4, rows: 3 }, { name: '4×4', cols: 4, rows: 4 }, { name: '6×4', cols: 6, rows: 4 }, { name: '6×5', cols: 6, rows: 5 }],
    create(o, api) {
      const { C, W, H, TOP } = api;
      const n = o.cols * o.rows;
      const cards = api.shuffle(api.shuffle(FACES.slice()).slice(0, n / 2).flatMap(f => [f, f])).map(f => ({ f, up: false, done: false }));
      const gap = 14, cw = Math.min(150, (W - 200) / o.cols - gap), ch = Math.min(cw * 1.1, (H - TOP - 40) / o.rows - gap);
      const ox = W / 2 - (o.cols * (cw + gap) - gap) / 2, oy = TOP + 20 + ((H - TOP - 40) - (o.rows * (ch + gap) - gap)) / 2;
      const cur = { x: 0, y: 0 };
      let open = [], wait = 0, moves = 0;
      return {
        key(k) {
          if (moveCursor(cur, k, o.cols, o.rows) || k !== 'ok' || wait > 0) return;
          const c = cards[cur.y * o.cols + cur.x];
          if (c.up || c.done) return;
          c.up = true; open.push(c);
          if (open.length === 2) {
            moves++; api.setScore(moves);
            if (open[0].f === open[1].f) {
              open.forEach(x => x.done = true); open = [];
              if (cards.every(x => x.done)) api.end({ won: true, score: moves, text: 'All pairs found!' });
            } else wait = 0.8;
          }
        },
        update(dt) {
          if (wait > 0 && (wait -= dt) <= 0) { open.forEach(x => x.up = false); open = []; }
        },
        draw(ctx) {
          cards.forEach((c, i) => {
            const x = ox + (i % o.cols) * (cw + gap), y = oy + Math.floor(i / o.cols) * (ch + gap);
            api.rrect(x, y, cw, ch, 12, c.done ? '#2A3A2F' : c.up ? C.panel2 : '#5B2C83');
            if (c.up || c.done) api.text(c.f, x + cw / 2, y + ch / 2 + 2, Math.min(cw, ch) * 0.5, C.text, 'center');
            else api.text('?', x + cw / 2, y + ch / 2, Math.min(cw, ch) * 0.35, 'rgba(255,255,255,0.25)', 'center', 700);
          });
          api.rrect(ox + cur.x * (cw + gap) - 4, oy + cur.y * (ch + gap) - 4, cw + 8, ch + 8, 14, null, C.warn, 5);
        }
      };
    }
  });

  // ================================================================ Code Breaker
  register('codebreak', {
    title: 'Code Breaker', icon: '🔐', color: '#34495E', lowerIsBetter: true, scoreLabel: 'Guesses',
    help: 'Left/Right pick a slot · Up/Down change colour · OK on ✓ checks · ● right place, ○ wrong place',
    variants: [{ name: 'Classic', slots: 4, colors: 6 }, { name: 'Hard', slots: 5, colors: 8 }],
    create(o, api) {
      const { C, W, TOP } = api;
      const MAX = 10, pal = C.pal.slice(0, o.colors);
      const secret = Array.from({ length: o.slots }, () => api.rnd(o.colors));
      const rows = []; let guess = Array(o.slots).fill(0), pos = 0, over = false;
      const rh = 58, peg = 22, ox = W / 2 - 260, oy = TOP + 14;
      function score(g) {
        let black = 0, white = 0; const cs = [], cg = [];
        for (let i = 0; i < o.slots; i++) { if (g[i] === secret[i]) black++; else { cs.push(secret[i]); cg.push(g[i]); } }
        for (const x of cg) { const j = cs.indexOf(x); if (j >= 0) { white++; cs.splice(j, 1); } }
        return [black, white];
      }
      return {
        key(k) {
          if (over) return;
          if (k === 'left') pos = (pos + o.slots) % (o.slots + 1);
          else if (k === 'right') pos = (pos + 1) % (o.slots + 1);
          else if ((k === 'up' || k === 'down') && pos < o.slots) guess[pos] = (guess[pos] + (k === 'up' ? 1 : o.colors - 1)) % o.colors;
          else if (k === 'ok') {
            if (pos < o.slots) { pos++; return; }
            const fb = score(guess);
            rows.push({ g: guess.slice(), fb }); api.setScore(rows.length); pos = 0;
            if (fb[0] === o.slots) { over = true; api.end({ won: true, score: rows.length, text: 'Cracked it!' }); }
            else if (rows.length >= MAX) { over = true; api.end({ won: false, score: rows.length, text: 'Out of guesses' }); }
          }
        },
        update() {},
        draw(ctx) {
          api.rrect(ox - 20, oy - 6, 520 + 40, rh * (MAX + 1) + 4, 14, C.panel);
          for (let r = 0; r <= MAX; r++) {
            const y = oy + r * rh + rh / 2;
            const row = r < rows.length ? rows[r] : null, isCur = r === rows.length && !over;
            api.text(r < MAX ? String(r + 1) : '', ox, y, 18, C.dim, 'center');
            if (r === MAX) {
              // secret row: revealed only at the end
              api.text('Code', ox, y, 16, C.dim, 'center');
              for (let i = 0; i < o.slots; i++) {
                const x = ox + 50 + i * 62;
                if (over) api.circle(x, y, peg, pal[secret[i]]); else api.circle(x, y, peg, C.panel2, C.line, 2);
                if (!over) api.text('?', x, y, 20, C.dim, 'center');
              }
              continue;
            }
            for (let i = 0; i < o.slots; i++) {
              const x = ox + 50 + i * 62;
              const col = row ? pal[row.g[i]] : isCur ? pal[guess[i]] : null;
              api.circle(x, y, peg, col || C.bg, isCur && pos === i ? C.text : null, 4);
              if (isCur && pos === i) { api.text('▲', x, y - peg - 8, 12, C.text, 'center'); }
            }
            if (row) {
              const fx = ox + 50 + o.slots * 62 + 20;
              for (let i = 0; i < o.slots; i++) {
                const px = fx + (i % 3) * 18, py = y - 9 + Math.floor(i / 3) * 18;
                if (i < row.fb[0]) api.circle(px, py, 7, C.text);
                else if (i < row.fb[0] + row.fb[1]) api.circle(px, py, 7, null, C.text, 2);
                else api.circle(px, py, 3, C.line);
              }
            }
            if (isCur) {
              const bx = ox + 50 + o.slots * 62 + 10;
              api.rrect(bx, y - 22, 70, 44, 22, pos === o.slots ? C.good : C.panel2, null);
              api.text('✓', bx + 35, y + 1, 26, pos === o.slots ? C.bg : C.text, 'center', 700);
            }
          }
          const lx = ox + 620;
          api.text('Colours', lx, TOP + 40, 20, C.dim);
          pal.forEach((c, i) => api.circle(lx + 20 + (i % 4) * 50, TOP + 90 + Math.floor(i / 4) * 50, 18, c));
          api.text('● right colour, right place', lx, TOP + 220, 18, C.dim);
          api.text('○ right colour, wrong place', lx, TOP + 250, 18, C.dim);
          api.text('Colours may repeat', lx, TOP + 280, 18, C.dim);
        }
      };
    }
  });

  Engine.boardAI = { tttBest, tttWinner, fourBest, fourDrop, fourWinAt, rvBest, rvMoves, rvApply, gmBest, ckSeqs, ckApply, ckCpu };
})();
