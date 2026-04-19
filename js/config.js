/** Размер поля (классика Lines 98). */
export const BOARD_SIZE = 9;

/** Число различимых цветов шариков (индексы 0 … COLORS - 1). */
export const COLORS = 7;

/** Пустая клетка в модели доски. */
export const EMPTY = -1;

/** Сколько шариков появляется, если линий не собрано. */
export const SPAWN_COUNT = 3;

/** Сколько шариков на старте раскладывается случайно по полю. */
export const INITIAL_RANDOM_BALLS = 5;

/** Длительность одного шага движения шарика по пути (мс). */
export const MOVE_STEP_MS = 115;

/** Длительность исчезновения линии (масштаб + прозрачность), мс. */
export const VANISH_MS = 220;

/** Пауза перед следующей проверкой каскада после сброса (мс). */
export const CASCADE_GAP_MS = 0;

/** Ключ localStorage для рекорда. */
export const LS_HIGH = 'lines98_highscore';

/** Максимум состояний в стеке отмены. */
export const UNDO_LIMIT = 80;
