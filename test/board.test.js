import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { BOARD_SIZE, COLORS, EMPTY } from '../js/config.js';
import { Board } from '../js/board.js';

describe('Board', () => {
  it('createEmptyGrid is all EMPTY with correct size', () => {
    const g = Board.createEmptyGrid();
    assert.equal(g.length, BOARD_SIZE);
    assert.equal(g[0].length, BOARD_SIZE);
    let empty = 0;
    for (const row of g) {
      for (const v of row) {
        if (v === EMPTY) empty++;
      }
    }
    assert.equal(empty, BOARD_SIZE * BOARD_SIZE);
  });

  it('inBounds', () => {
    const b = new Board();
    assert.equal(b.inBounds(0, 0), true);
    assert.equal(b.inBounds(BOARD_SIZE - 1, BOARD_SIZE - 1), true);
    assert.equal(b.inBounds(-1, 0), false);
    assert.equal(b.inBounds(0, BOARD_SIZE), false);
  });

  it('countEmpty on fresh board', () => {
    const b = new Board();
    assert.equal(b.countEmpty(), BOARD_SIZE * BOARD_SIZE);
  });

  it('placeRandomBalls returns false when not enough empty cells', () => {
    const b = new Board();
    for (let r = 0; r < BOARD_SIZE; r++) {
      for (let c = 0; c < BOARD_SIZE; c++) {
        if (r === 0 && c === 0) continue;
        b.setAt(r, c, 0);
      }
    }
    assert.equal(b.countEmpty(), 1);
    assert.equal(b.placeRandomBalls(2), false);
  });

  it('placeRandomBalls fills exactly count cells with valid colors', () => {
    const b = new Board();
    assert.equal(b.placeRandomBalls(4), true);
    assert.equal(b.countEmpty(), BOARD_SIZE * BOARD_SIZE - 4);
    for (let r = 0; r < BOARD_SIZE; r++) {
      for (let c = 0; c < BOARD_SIZE; c++) {
        const v = b.getAt(r, c);
        if (v !== EMPTY) {
          assert.ok(v >= 0 && v < COLORS, `color in range: ${v}`);
        }
      }
    }
  });
});
