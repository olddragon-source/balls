/**
 * Глубокое копирование сетки (двумерный массив чисел).
 * @param {number[][]} grid
 * @returns {number[][]}
 */
export function cloneGrid(grid) {
  return grid.map((row) => row.slice());
}

/**
 * Ключ клетки для Set/Map.
 * @param {number} r
 * @param {number} c
 */
export function keyRC(r, c) {
  return r + ',' + c;
}

/**
 * Парсинг ключа "r,c".
 * @param {string} k
 * @returns {{ r: number, c: number }}
 */
export function parseKey(k) {
  const [r, c] = k.split(',').map(Number);
  return { r, c };
}
