import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { EMPTY } from '../js/config.js';
import { Board } from '../js/board.js';
import { findPathBFS } from '../js/pathfinding.js';

describe('pathfinding', () => {
  it('returns direct path on adjacent empty target', () => {
    const board = new Board();
    board.setAt(1, 1, 0);
    board.setAt(1, 2, EMPTY);
    const path = findPathBFS(board, { r: 1, c: 1 }, { r: 1, c: 2 });
    assert.ok(path);
    assert.equal(path.length, 2);
    assert.deepEqual(path[0], { r: 1, c: 1 });
    assert.deepEqual(path[1], { r: 1, c: 2 });
  });

  it('finds orthogonal path around obstacle', () => {
    const board = new Board();
    board.setAt(0, 0, 1);
    board.setAt(0, 2, EMPTY);
    board.setAt(0, 1, 2);
    const path = findPathBFS(board, { r: 0, c: 0 }, { r: 0, c: 2 });
    assert.ok(path);
    assert.deepEqual(path[path.length - 1], { r: 0, c: 2 });
  });

  it('returns null when target occupied', () => {
    const board = new Board();
    board.setAt(0, 0, 0);
    board.setAt(0, 1, 1);
    assert.equal(findPathBFS(board, { r: 0, c: 0 }, { r: 0, c: 1 }), null);
  });

  it('returns null when no route', () => {
    const board = new Board();
    board.setAt(0, 0, 0);
    board.setAt(0, 2, EMPTY);
    board.setAt(0, 1, 1);
    board.setAt(1, 1, 1);
    board.setAt(1, 0, 1);
    board.setAt(1, 2, 1);
    assert.equal(findPathBFS(board, { r: 0, c: 0 }, { r: 0, c: 2 }), null);
  });

  it('treats start cell as walkable for expansion', () => {
    const board = new Board();
    board.setAt(2, 2, 0);
    board.setAt(2, 3, EMPTY);
    board.setAt(3, 2, EMPTY);
    board.setAt(3, 3, EMPTY);
    const path = findPathBFS(board, { r: 2, c: 2 }, { r: 3, c: 3 });
    assert.ok(path && path.length >= 2);
  });
});
