import { COLORS } from './config.js';

const SVG_NS = 'http://www.w3.org/2000/svg';
const BALL_STYLES = [
  { fill: '#e53935', stroke: '#b71c1c' },
  { fill: '#1e88e5', stroke: '#1565c0' },
  { fill: '#43a047', stroke: '#2e7d32' },
  { fill: '#fdd835', stroke: '#f9a825' },
  { fill: '#8e24aa', stroke: '#6a1b9a' },
  { fill: '#e59ab9', stroke: '#c96f96' },
  { fill: '#d7f1f8', stroke: '#a8dce7' },
];

/**
 * Представление цвета и пути к SVG.
 */
export class Ball {
  /**
   * @param {number} color Индекс цвета 0 … COLORS-1
   */
  constructor(color) {
    if (color < 0 || color >= COLORS) {
      throw new RangeError('Ball: недопустимый цвет');
    }
    this.color = color;
  }

  /**
   * @param {number} color
   */
  static assertValidColor(color) {
    if (!Number.isInteger(color) || color < 0 || color >= COLORS) {
      throw new RangeError('Ball: недопустимый цвет');
    }
  }

  /**
   * Legacy path kept for compatibility with tests/build outputs.
   * Относительный путь к SVG в каталоге balls/.
   * @param {number} color
   */
  static svgPath(color) {
    Ball.assertValidColor(color);
    return 'balls/ball' + color + '.svg';
  }

  /**
   * Creates an inline SVG node to avoid device/browser issues with external SVG <img>.
   * @param {number} color
   */
  static createSvgElement(color) {
    Ball.assertValidColor(color);
    const { fill, stroke } = BALL_STYLES[color];

    const svg = document.createElementNS(SVG_NS, 'svg');
    svg.setAttribute('viewBox', '0 0 64 64');
    svg.setAttribute('width', '64');
    svg.setAttribute('height', '64');
    svg.setAttribute('aria-hidden', 'true');
    svg.setAttribute('focusable', 'false');

    const circle = document.createElementNS(SVG_NS, 'circle');
    circle.setAttribute('cx', '32');
    circle.setAttribute('cy', '32');
    circle.setAttribute('r', '28');
    circle.setAttribute('fill', fill);
    circle.setAttribute('stroke', stroke);
    circle.setAttribute('stroke-width', '2');
    svg.appendChild(circle);

    return svg;
  }
}
