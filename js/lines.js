import { BOARD_SIZE, EMPTY } from './config.js';
import { keyRC } from './grid-utils.js';

/**
 * Очки за одну непрерывную линию длины L ≥ 5:
 * 5 = 10, 6 = 12, далее +4 за каждый следующий шарик.
 * @param {number} length
 */
export function scoreForLineLength(length) {
  if (length < 5) return 0;
  if (length === 5) return 10;
  if (length === 6) return 12;
  return 12 + (length - 6) * 4;
}

/**
 * @param {number[][]} grid
 * @param {Array<Array<{r:number,c:number}>>} out
 */
function collectHorizontal(grid, out) {
  for (let r = 0; r < BOARD_SIZE; r++) {
    let c = 0;
    while (c < BOARD_SIZE) {
      const v = grid[r][c];
      if (v === EMPTY) {
        c++;
        continue;
      }
      let c2 = c;
      while (c2 < BOARD_SIZE && grid[r][c2] === v) c2++;
      const len = c2 - c;
      if (len >= 5) {
        const seg = [];
        for (let k = c; k < c2; k++) seg.push({ r, c: k });
        out.push(seg);
      }
      c = c2;
    }
  }
}

/**
 * @param {number[][]} grid
 * @param {Array<Array<{r:number,c:number}>>} out
 */
function collectVertical(grid, out) {
  for (let c = 0; c < BOARD_SIZE; c++) {
    let r = 0;
    while (r < BOARD_SIZE) {
      const v = grid[r][c];
      if (v === EMPTY) {
        r++;
        continue;
      }
      let r2 = r;
      while (r2 < BOARD_SIZE && grid[r2][c] === v) r2++;
      const len = r2 - r;
      if (len >= 5) {
        const seg = [];
        for (let k = r; k < r2; k++) seg.push({ r: k, c });
        out.push(seg);
      }
      r = r2;
    }
  }
}

/**
 * Диагонали обеих ориентаций.
 * @param {number[][]} grid
 * @param {Array<Array<{r:number,c:number}>>} out
 */
function collectAllDiagonals(grid, out) {
  const dirs = [
    [1, 1],
    [1, -1],
    [-1, 1],
    [-1, -1],
  ];
  const seen = new Set();
  for (let r = 0; r < BOARD_SIZE; r++) {
    for (let c = 0; c < BOARD_SIZE; c++) {
      const v = grid[r][c];
      if (v === EMPTY) continue;
      for (const [dr, dc] of dirs) {
        const pr = r - dr;
        const pc = c - dc;
        if (
          pr >= 0 &&
          pr < BOARD_SIZE &&
          pc >= 0 &&
          pc < BOARD_SIZE &&
          grid[pr][pc] === v
        ) {
          continue;
        }
        /** @type {Array<{r:number,c:number}>} */
        const seg = [];
        let cr = r;
        let cc = c;
        while (
          cr >= 0 &&
          cr < BOARD_SIZE &&
          cc >= 0 &&
          cc < BOARD_SIZE &&
          grid[cr][cc] === v
        ) {
          seg.push({ r: cr, c: cc });
          cr += dr;
          cc += dc;
        }
        if (seg.length < 5) continue;
        const sig = seg
          .map((p) => keyRC(p.r, p.c))
          .sort()
          .join('|');
        if (seen.has(sig)) continue;
        seen.add(sig);
        out.push(seg);
      }
    }
  }
}

/**
 * Все отрезки длины ≥ 5 и объединение клеток к удалению.
 * @param {number[][]} grid
 * @returns {{ segments: Array<Array<{r:number,c:number}>>, cells: Set<string>, scoreDelta: number }}
 */
export function findLinesAndScore(grid) {
  /** @type {Array<Array<{r:number,c:number}>>} */
  const segments = [];
  collectHorizontal(grid, segments);
  collectVertical(grid, segments);
  collectAllDiagonals(grid, segments);

  let scoreDelta = 0;
  for (const seg of segments) {
    scoreDelta += scoreForLineLength(seg.length);
  }

  const cells = new Set();
  for (const seg of segments) {
    for (const p of seg) cells.add(keyRC(p.r, p.c));
  }

  return { segments, cells, scoreDelta };
}
