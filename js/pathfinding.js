import { BOARD_SIZE, EMPTY } from './config.js';

/**
 * Поиск пути BFS (только ортогонально; старт временно «проходим»).
 * @param {import('./board.js').Board} board
 * @param {{r:number,c:number}} start Клетка с выбранным шариком
 * @param {{r:number,c:number}} end Целевая пустая клетка
 * @returns {Array<{r:number,c:number}>|null} Путь от start до end включительно, либо null
 */
export function findPathBFS(board, start, end) {
  const g = board.cells;
  if (!board.inBounds(start.r, start.c) || !board.inBounds(end.r, end.c)) return null;
  if (g[end.r][end.c] !== EMPTY) return null;
  if (start.r === end.r && start.c === end.c) return [start];

  /** @type {boolean[][]} */
  const seen = Array.from({ length: BOARD_SIZE }, () => Array(BOARD_SIZE).fill(false));
  /** @type {({r:number,c:number}|null)[][]} */
  const parent = Array.from({ length: BOARD_SIZE }, () => Array(BOARD_SIZE).fill(null));

  const q = [];
  q.push(start);
  seen[start.r][start.c] = true;

  const dirs = [
    [0, 1],
    [0, -1],
    [1, 0],
    [-1, 0],
  ];

  while (q.length > 0) {
    const cur = q.shift();
    if (!cur) break;
    for (const [dr, dc] of dirs) {
      const nr = cur.r + dr;
      const nc = cur.c + dc;
      if (!board.inBounds(nr, nc) || seen[nr][nc]) continue;

      const cell = g[nr][nc];
      const isStart = nr === start.r && nc === start.c;
      const isEnd = nr === end.r && nc === end.c;
      let walk = false;
      if (isEnd) walk = cell === EMPTY;
      else if (isStart) walk = true;
      else walk = cell === EMPTY;

      if (!walk) continue;

      seen[nr][nc] = true;
      parent[nr][nc] = cur;
      if (isEnd) {
        /** @type {Array<{r:number,c:number}>} */
        const path = [];
        let p = /** @type {{r:number,c:number}} */ ({ r: end.r, c: end.c });
        path.push(p);
        while (!(p.r === start.r && p.c === start.c)) {
          const par = parent[p.r][p.c];
          if (!par) return null;
          p = par;
          path.unshift(p);
        }
        return path;
      }
      q.push({ r: nr, c: nc });
    }
  }
  return null;
}
