import { COLORS } from './config.js';

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
   * Относительный путь к SVG в каталоге balls/.
   * @param {number} color
   */
  static svgPath(color) {
    return 'balls/ball' + color + '.svg';
  }
}
