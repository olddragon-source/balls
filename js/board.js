import { BOARD_SIZE, COLORS, EMPTY } from './config.js';
import { randInt } from './random.js';

/**
 * Модель поля.
 */
export class Board {
  constructor() {
    /** @type {number[][]} значения EMPTY или 0…COLORS-1 */
    this.cells = Board.createEmptyGrid();
  }

  static createEmptyGrid() {
    const g = [];
    for (let r = 0; r < BOARD_SIZE; r++) {
      const row = [];
      for (let c = 0; c < BOARD_SIZE; c++) row.push(EMPTY);
      g.push(row);
    }
    return g;
  }

  /**
   * @param {number} r
   * @param {number} c
   */
  inBounds(r, c) {
    return r >= 0 && r < BOARD_SIZE && c >= 0 && c < BOARD_SIZE;
  }

  getAt(r, c) {
    return this.cells[r][c];
  }

  setAt(r, c, v) {
    this.cells[r][c] = v;
  }

  /**
   * Число пустых клеток.
   */
  countEmpty() {
    let n = 0;
    for (let r = 0; r < BOARD_SIZE; r++) {
      for (let c = 0; c < BOARD_SIZE; c++) {
        if (this.cells[r][c] === EMPTY) n++;
      }
    }
    return n;
  }

  /**
   * Случайные пустые клетки в количестве count (или меньше, если пустых нет).
   * @param {number} count
   * @returns {Array<{r:number,c:number}>}
   */
  pickRandomEmptyCells(count) {
    const empties = [];
    for (let r = 0; r < BOARD_SIZE; r++) {
      for (let c = 0; c < BOARD_SIZE; c++) {
        if (this.cells[r][c] === EMPTY) empties.push({ r, c });
      }
    }
    /** @type {Array<{r:number,c:number}>} */
    const out = [];
    for (let i = 0; i < count && empties.length > 0; i++) {
      const idx = randInt(empties.length);
      out.push(empties[idx]);
      empties.splice(idx, 1);
    }
    return out;
  }

  /**
   * Помещает count случайных шариков случайных цветов в пустые клетки.
   * @param {number} count
   * @returns {boolean} false если не удалось разместить все (не хватило пустых).
   */
  placeRandomBalls(count) {
    const positions = this.pickRandomEmptyCells(count);
    if (positions.length < count) return false;
    for (const p of positions) {
      this.setAt(p.r, p.c, randInt(COLORS));
    }
    return true;
  }
}
