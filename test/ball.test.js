import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { COLORS } from '../js/config.js';
import { Ball } from '../js/ball.js';

describe('Ball', () => {
  it('constructs for valid color indices', () => {
    const b = new Ball(0);
    assert.equal(b.color, 0);
    const last = new Ball(COLORS - 1);
    assert.equal(last.color, COLORS - 1);
  });

  it('throws on invalid color', () => {
    assert.throws(() => new Ball(-1), RangeError);
    assert.throws(() => new Ball(COLORS), RangeError);
  });

  it('svgPath matches asset naming', () => {
    assert.equal(Ball.svgPath(3), 'balls/ball3.svg');
  });

  it('svgPath throws on invalid color', () => {
    assert.throws(() => Ball.svgPath(-1), RangeError);
  });
});
