import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { BOARD_SIZE, EMPTY } from '../js/config.js';
import { Board } from '../js/board.js';
import { findLinesAndScore, scoreForLineLength } from '../js/lines.js';

function emptyGrid() {
  return Board.createEmptyGrid();
}

describe('lines', () => {
  it('scoreForLineLength matches game formula', () => {
    assert.equal(scoreForLineLength(4), 0);
    assert.equal(scoreForLineLength(5), 10);
    assert.equal(scoreForLineLength(6), 12);
    assert.equal(scoreForLineLength(7), 14);
  });

  it('findLinesAndScore detects horizontal run of 5', () => {
    const grid = emptyGrid();
    const r = 3;
    for (let c = 0; c < 5; c++) grid[r][c] = 2;
    const { segments, cells, scoreDelta } = findLinesAndScore(grid);
    assert.equal(segments.length, 1);
    assert.equal(scoreDelta, 10);
    assert.equal(cells.size, 5);
  });

  it('findLinesAndScore counts a six-in-a-row as one segment', () => {
    const grid = emptyGrid();
    const r = 4;
    for (let c = 0; c < 5; c++) grid[r][c] = 1;
    grid[r][5] = 1;
    const { cells, scoreDelta } = findLinesAndScore(grid);
    assert.equal(cells.size, 6);
    assert.ok(scoreDelta > 10);
  });

  it('findLinesAndScore detects main diagonal of 5', () => {
    const grid = emptyGrid();
    for (let i = 0; i < 5; i++) grid[i][i] = 3;
    const { segments, scoreDelta } = findLinesAndScore(grid);
    assert.ok(segments.some((s) => s.length >= 5));
    assert.equal(scoreDelta, 10);
  });

  it('findLinesAndScore returns empty when no line', () => {
    const grid = emptyGrid();
    grid[0][0] = 0;
    grid[0][1] = 1;
    const { cells, scoreDelta } = findLinesAndScore(grid);
    assert.equal(cells.size, 0);
    assert.equal(scoreDelta, 0);
  });

  it('ignores EMPTY runs', () => {
    const grid = emptyGrid();
    for (let c = 0; c < BOARD_SIZE; c++) grid[0][c] = EMPTY;
    const { cells } = findLinesAndScore(grid);
    assert.equal(cells.size, 0);
  });
});
