import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { cloneGrid, keyRC, parseKey } from '../js/grid-utils.js';

describe('grid-utils', () => {
  it('cloneGrid returns independent copy', () => {
    const g = [
      [1, 2],
      [3, 4],
    ];
    const copy = cloneGrid(g);
    assert.notEqual(copy, g);
    assert.deepEqual(copy, g);
    copy[0][0] = 99;
    assert.equal(g[0][0], 1);
  });

  it('keyRC and parseKey roundtrip', () => {
    const k = keyRC(4, 7);
    assert.equal(k, '4,7');
    assert.deepEqual(parseKey(k), { r: 4, c: 7 });
  });
});
