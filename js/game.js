/**
 * Lines / «Линии» — логика и представление для браузера.
 * Поле 9×9, 7 цветов, движение по ортогональному пути (BFS),
 * линии из 5+ по горизонтали, вертикали и обеим диагоналям,
 * цепные сбросы, предпросмотр 3 шариков, рекорд, отмена хода.
 */

(function () {
  'use strict';

  /** Размер поля (классика Lines 98). */
  const BOARD_SIZE = 9;

  /** Число различимых цветов шариков (индексы 0 … COLORS - 1). */
  const COLORS = 7;

  /** Пустая клетка в модели доски. */
  const EMPTY = -1;

  /** Сколько шариков появляется, если линий не собрано. */
  const SPAWN_COUNT = 3;

  /** Сколько шариков на старте раскладывается случайно по полю. */
  const INITIAL_RANDOM_BALLS = 5;

  /** Длительность одного шага движения шарика по пути (мс). */
  const MOVE_STEP_MS = 115;

  /** Длительность исчезновения линии (масштаб + прозрачность), мс. */
  const VANISH_MS = 220;

  /** Пауза перед следующей проверкой каскада после сброса (мс), 0 — без лишней задержки. */
  const CASCADE_GAP_MS = 0;

  /** Ключ localStorage для рекорда (дублирует попытку чтения highscore.txt при HTTP). */
  const LS_HIGH = 'lines98_highscore';

  /** Максимум состояний в стеке отмены (защита от утечки памяти). */
  const UNDO_LIMIT = 80;

  // ——— Утилиты ———

  /**
   * Случайное целое в диапазоне [0, max).
   * @param {number} max
   */
  function randInt(max) {
    return Math.floor(Math.random() * max);
  }

  /**
   * Глубокое копирование сетки (двумерный массив чисел).
   * @param {number[][]} grid
   * @returns {number[][]}
   */
  function cloneGrid(grid) {
    return grid.map((row) => row.slice());
  }

  /**
   * Ключ клетки для Set/Map.
   * @param {number} r
   * @param {number} c
   */
  function keyRC(r, c) {
    return r + ',' + c;
  }

  /**
   * Парсинг ключа "r,c".
   * @param {string} k
   * @returns {{ r: number, c: number }}
   */
  function parseKey(k) {
    const [r, c] = k.split(',').map(Number);
    return { r, c };
  }

  /**
   * Очки за одну непрерывную линию длины L ≥ 5:
   * 10 за базовые 5 шариков + 2 * N, где N — число «лишних» шариков (L - 5).
   * @param {number} length
   */
  function scoreForLineLength(length) {
    if (length < 5) return 0;
    const n = length - 5;
    return 10 + 2 * n;
  }

  // ——— Класс Ball — представление цвета и пути к SVG ———

  class Ball {
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

  // ——— Класс Board — модель поля ———

  class Board {
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

  // ——— Поиск пути BFS (только ортогонально; старт временно «проходим») ———

  /**
   * @param {Board} board
   * @param {{r:number,c:number}} start Клетка с выбранным шариком
   * @param {{r:number,c:number}} end Целевая пустая клетка
   * @returns {Array<{r:number,c:number}>|null} Путь от start до end включительно, либо null
   */
  function findPathBFS(board, start, end) {
    const g = board.cells;
    if (!board.inBounds(start.r, start.c) || !board.inBounds(end.r, end.c)) return null;
    if (g[end.r][end.c] !== EMPTY) return null;
    if (start.r === end.r && start.c === end.c) return [start];

    /** @type {boolean[][]} */
    const seen = Array.from({ length: BOARD_SIZE }, () =>
      Array(BOARD_SIZE).fill(false)
    );
    /** @type {({r:number,c:number}|null)[][]} */
    const parent = Array.from({ length: BOARD_SIZE }, () =>
      Array(BOARD_SIZE).fill(null)
    );

    const q = [];
    q.push(start);
    seen[start.r][start.c] = true;

    const dirs = [
      [0, 1],
      [0, -1],
      [1, 0],
      [-1, 0],
    ];

    while (q.length > 0) {
      const cur = q.shift();
      if (!cur) break;
      for (const [dr, dc] of dirs) {
        const nr = cur.r + dr;
        const nc = cur.c + dc;
        if (!board.inBounds(nr, nc) || seen[nr][nc]) continue;

        const cell = g[nr][nc];
        const isStart = nr === start.r && nc === start.c;
        const isEnd = nr === end.r && nc === end.c;
        // Цель должна быть пустой; старт считаем свободным для прохода шарика
        let walk = false;
        if (isEnd) walk = cell === EMPTY;
        else if (isStart) walk = true;
        else walk = cell === EMPTY;

        if (!walk) continue;

        seen[nr][nc] = true;
        parent[nr][nc] = cur;
        if (isEnd) {
          /** @type {Array<{r:number,c:number}>} */
          const path = [];
          let p = /** @type {{r:number,c:number}} */ ({ r: end.r, c: end.c });
          path.push(p);
          while (!(p.r === start.r && p.c === start.c)) {
            const par = parent[p.r][p.c];
            if (!par) return null;
            p = par;
            path.unshift(p);
          }
          return path;
        }
        q.push({ r: nr, c: nc });
      }
    }
    return null;
  }

  // ——— Поиск всех отрезков длины ≥ 5 по 4 направлениям ———

  /**
   * Добавляет отрезки в список (каждый отрезок — массив клеток).
   * @param {number[][]} grid
   * @param {Array<Array<{r:number,c:number}>>} out
   */
  function collectHorizontal(grid, out) {
    for (let r = 0; r < BOARD_SIZE; r++) {
      let c = 0;
      while (c < BOARD_SIZE) {
        const v = grid[r][c];
        if (v === EMPTY) {
          c++;
          continue;
        }
        let c2 = c;
        while (c2 < BOARD_SIZE && grid[r][c2] === v) c2++;
        const len = c2 - c;
        if (len >= 5) {
          const seg = [];
          for (let k = c; k < c2; k++) seg.push({ r, c: k });
          out.push(seg);
        }
        c = c2;
      }
    }
  }

  function collectVertical(grid, out) {
    for (let c = 0; c < BOARD_SIZE; c++) {
      let r = 0;
      while (r < BOARD_SIZE) {
        const v = grid[r][c];
        if (v === EMPTY) {
          r++;
          continue;
        }
        let r2 = r;
        while (r2 < BOARD_SIZE && grid[r2][c] === v) r2++;
        const len = r2 - r;
        if (len >= 5) {
          const seg = [];
          for (let k = r; k < r2; k++) seg.push({ r: k, c });
          out.push(seg);
        }
        r = r2;
      }
    }
  }

  /**
   * Диагонали обеих ориентаций: обход «от начала» отрезка по 4 направлениям,
   * чтобы не пропускать линии из-за порядка точек на длинной диагонали.
   * Дубликаты одного и того же набора клеток отсекаются по сигнатуре.
   */
  function collectAllDiagonals(grid, out) {
    const dirs = [
      [1, 1],
      [1, -1],
      [-1, 1],
      [-1, -1],
    ];
    const seen = new Set();
    for (let r = 0; r < BOARD_SIZE; r++) {
      for (let c = 0; c < BOARD_SIZE; c++) {
        const v = grid[r][c];
        if (v === EMPTY) continue;
        for (const [dr, dc] of dirs) {
          const pr = r - dr;
          const pc = c - dc;
          if (
            pr >= 0 &&
            pr < BOARD_SIZE &&
            pc >= 0 &&
            pc < BOARD_SIZE &&
            grid[pr][pc] === v
          ) {
            continue;
          }
          /** @type {Array<{r:number,c:number}>} */
          const seg = [];
          let cr = r;
          let cc = c;
          while (
            cr >= 0 &&
            cr < BOARD_SIZE &&
            cc >= 0 &&
            cc < BOARD_SIZE &&
            grid[cr][cc] === v
          ) {
            seg.push({ r: cr, c: cc });
            cr += dr;
            cc += dc;
          }
          if (seg.length < 5) continue;
          const sig = seg
            .map((p) => keyRC(p.r, p.c))
            .sort()
            .join('|');
          if (seen.has(sig)) continue;
          seen.add(sig);
          out.push(seg);
        }
      }
    }
  }

  /**
   * Все отрезки длины ≥ 5 и объединение клеток к удалению.
   * @param {number[][]} grid
   * @returns {{ segments: Array<Array<{r:number,c:number}>>, cells: Set<string>, scoreDelta: number }}
   */
  function findLinesAndScore(grid) {
    /** @type {Array<Array<{r:number,c:number}>>} */
    const segments = [];
    collectHorizontal(grid, segments);
    collectVertical(grid, segments);
    collectAllDiagonals(grid, segments);

    let scoreDelta = 0;
    for (const seg of segments) {
      scoreDelta += scoreForLineLength(seg.length);
    }

    const cells = new Set();
    for (const seg of segments) {
      for (const p of seg) cells.add(keyRC(p.r, p.c));
    }

    return { segments, cells, scoreDelta };
  }

  // ——— Класс Game — состояние, ходы, UI ———

  class Game {
    constructor() {
      this.board = new Board();
      /** @type {number[]} три предстоящих цвета для штрафного появления */
      this.nextColors = [];
      /**
       * Три пустые клетки, куда встанут nextColors при следующем «штрафном» появлении.
       * В модели доски там EMPTY; визуально — половинные маркеры.
       * @type {Array<{r:number,c:number}|null>}
       */
      this.nextSpawnCells = [null, null, null];
      /** @type {number} */
      this.score = 0;
      /** @type {number} */
      this.highScore = 0;
      /** @type {{r:number,c:number}|null} */
      this.selection = null;
      /** @type {Array<{ board: number[][], nextColors: number[], score: number }>} */
      this.undoStack = [];

      this._busy = false;
      this._gameOver = false;

      this.elBoard = document.getElementById('board');
      this.elScore = document.getElementById('score');
      this.elHigh = document.getElementById('highscore');
      this.elOverlay = document.getElementById('overlay-gameover');
      this.elGoFinal = document.getElementById('go-final');

      this._buildBoardDom();
      this._bindUi();
    }

    /**
     * Создаёт сетку клеток один раз.
     */
    _buildBoardDom() {
      this.elBoard.innerHTML = '';
      /** @type {HTMLElement[][]} */
      this.cellEls = [];
      for (let r = 0; r < BOARD_SIZE; r++) {
        const row = [];
        for (let c = 0; c < BOARD_SIZE; c++) {
          const cell = document.createElement('div');
          cell.className = 'cell';
          cell.dataset.r = String(r);
          cell.dataset.c = String(c);
          cell.setAttribute('role', 'gridcell');
          const wrap = document.createElement('div');
          wrap.className = 'ball-wrap';
          cell.appendChild(wrap);
          cell.addEventListener('pointerdown', (e) => this._onPointerCell(e, r, c));
          this.elBoard.appendChild(cell);
          row.push(cell);
        }
        this.cellEls.push(row);
      }
    }

    _bindUi() {
      document.getElementById('btn-new').addEventListener('click', () => this.newGame());
      document.getElementById('btn-undo').addEventListener('click', () => this.undo());
      document.getElementById('btn-exit').addEventListener('click', () => this._exit());
      document.getElementById('btn-restart').addEventListener('click', () => {
        this.elOverlay.classList.add('hidden');
        this.newGame();
      });
    }

    /**
     * Выход: закрытие окна, если разрешено; иначе — безопасный переход.
     */
    _exit() {
      try {
        window.close();
      } catch (e) {
        /* ignore */
      }
      setTimeout(() => {
        if (!window.closed) {
          window.location.href = 'about:blank';
        }
      }, 50);
    }

    /**
     * Загрузка рекорда: localStorage, затем попытка highscore.txt по HTTP.
     */
    async loadHighScore() {
      const fromLs = localStorage.getItem(LS_HIGH);
      if (fromLs !== null && fromLs !== '') {
        const n = parseInt(fromLs, 10);
        if (!isNaN(n)) {
          this.highScore = n;
          this._renderHigh();
          return;
        }
      }
      try {
        const res = await fetch('highscore.txt', { cache: 'no-store' });
        if (res.ok) {
          const t = await res.text();
          const n = parseInt(t.trim(), 10);
          if (!isNaN(n) && n >= 0) {
            this.highScore = n;
            localStorage.setItem(LS_HIGH, String(n));
            this._renderHigh();
            return;
          }
        }
      } catch (err) {
        /* file:// или нет файла — норма */
      }
      this.highScore = 0;
      this._renderHigh();
    }

    /**
     * Сохранение рекорда в localStorage (и файл highscore.txt в вебе без сервера недоступен для прямой записи).
     */
    saveHighScore() {
      try {
        localStorage.setItem(LS_HIGH, String(this.highScore));
      } catch (e) {
        /* квота и т.д. */
      }
    }

    newGame() {
      this._gameOver = false;
      this.elOverlay.classList.add('hidden');
      this.board = new Board();
      this.score = 0;
      this.selection = null;
      this.undoStack = [];
      this._busy = false;
      this._fillNextColors();
      this.board.placeRandomBalls(INITIAL_RANDOM_BALLS);
      this._assignNextSpawnPreview();
      this._syncUndoButton();
      this._fullRedraw();
      this._renderScore();
    }

    _fillNextColors() {
      this.nextColors = [];
      for (let i = 0; i < SPAWN_COUNT; i++) this.nextColors.push(randInt(COLORS));
    }

    /**
     * Выбирает три пустые клетки — будущие места для nextColors (пока клетки остаются пустыми в логике).
     */
    _assignNextSpawnPreview() {
      this.nextSpawnCells = [null, null, null];
      if (this.board.countEmpty() < SPAWN_COUNT) return;
      const picked = this.board.pickRandomEmptyCells(SPAWN_COUNT);
      if (picked.length < SPAWN_COUNT) return;
      for (let i = 0; i < SPAWN_COUNT; i++) {
        this.nextSpawnCells[i] = { r: picked[i].r, c: picked[i].c };
      }
    }

    /**
     * После хода: оставляет валидные клетки превью, недоступные слоты заполняет новыми пустыми (без полного сброса).
     */
    _repairNextSpawnPreview() {
      const used = new Set();
      for (let i = 0; i < SPAWN_COUNT; i++) {
        const p = this.nextSpawnCells[i];
        if (p && this.board.getAt(p.r, p.c) === EMPTY) {
          used.add(keyRC(p.r, p.c));
        } else {
          this.nextSpawnCells[i] = null;
        }
      }
      for (let i = 0; i < SPAWN_COUNT; i++) {
        if (this.nextSpawnCells[i]) continue;
        const candidates = [];
        for (let r = 0; r < BOARD_SIZE; r++) {
          for (let c = 0; c < BOARD_SIZE; c++) {
            if (this.board.getAt(r, c) !== EMPTY) continue;
            const k = keyRC(r, c);
            if (!used.has(k)) candidates.push({ r, c });
          }
        }
        if (candidates.length === 0) continue;
        const pick = candidates[randInt(candidates.length)];
        this.nextSpawnCells[i] = pick;
        used.add(keyRC(pick.r, pick.c));
      }
    }

    /**
     * Индекс в nextColors / nextSpawnCells для клетки с маркером «следующий шарик», иначе -1.
     * @param {number} r
     * @param {number} c
     */
    _nextPreviewIndex(r, c) {
      for (let i = 0; i < this.nextSpawnCells.length; i++) {
        const p = this.nextSpawnCells[i];
        if (p && p.r === r && p.c === c) return i;
      }
      return -1;
    }

    _snapshot() {
      return {
        board: cloneGrid(this.board.cells),
        nextColors: this.nextColors.slice(),
        nextSpawnCells: this.nextSpawnCells.map((p) => (p ? { r: p.r, c: p.c } : null)),
        score: this.score,
      };
    }

    _restore(snap) {
      this.board.cells = cloneGrid(snap.board);
      this.nextColors = snap.nextColors.slice();
      this.score = snap.score;
      if (snap.nextSpawnCells && snap.nextSpawnCells.length === SPAWN_COUNT) {
        this.nextSpawnCells = snap.nextSpawnCells.map((p) => (p ? { r: p.r, c: p.c } : null));
      } else {
        this._assignNextSpawnPreview();
      }
    }

    _renderScore() {
      this.elScore.textContent = String(this.score);
    }

    _renderHigh() {
      this.elHigh.textContent = String(this.highScore);
    }

    _syncUndoButton() {
      const btn = document.getElementById('btn-undo');
      btn.disabled = this.undoStack.length === 0 || this._busy;
    }

    _fullRedraw() {
      for (let r = 0; r < BOARD_SIZE; r++) {
        for (let c = 0; c < BOARD_SIZE; c++) {
          this._renderCell(r, c, false);
        }
      }
      this._renderSelection();
    }

    /**
     * Отрисовка одной клетки: полный шарик, пусто, или маркер будущего шарика (в 2 раза меньше).
     */
    _renderCell(r, c, withVanishClass) {
      const cell = this.cellEls[r][c];
      const wrap = cell.querySelector('.ball-wrap');
      wrap.classList.remove('vanish');
      const v = this.board.getAt(r, c);
      wrap.innerHTML = '';
      if (v !== EMPTY) {
        const img = document.createElement('img');
        img.src = Ball.svgPath(v);
        img.alt = 'шар';
        img.draggable = false;
        wrap.appendChild(img);
        if (withVanishClass) wrap.classList.add('vanish');
      } else {
        const pi = this._nextPreviewIndex(r, c);
        if (pi >= 0 && this.nextColors[pi] !== undefined) {
          const mark = document.createElement('div');
          mark.className = 'ball-next-marker';
          mark.setAttribute('aria-hidden', 'true');
          const img = document.createElement('img');
          img.src = Ball.svgPath(this.nextColors[pi]);
          img.alt = '';
          img.draggable = false;
          mark.appendChild(img);
          wrap.appendChild(mark);
        }
      }
    }

    _renderSelection() {
      for (let r = 0; r < BOARD_SIZE; r++) {
        for (let c = 0; c < BOARD_SIZE; c++) {
          this.cellEls[r][c].classList.toggle(
            'selected',
            this.selection !== null &&
              this.selection.r === r &&
              this.selection.c === c
          );
        }
      }
    }

    /**
     * Обработка нажатия на клетку (мышь и тач через pointer).
     */
    _onPointerCell(e, r, c) {
      if (this._busy || this._gameOver) return;
      e.preventDefault();

      const val = this.board.getAt(r, c);

      if (val !== EMPTY) {
        if (this.selection && this.selection.r === r && this.selection.c === c) {
          this.selection = null;
          this._renderSelection();
          return;
        }
        this.selection = { r, c };
        this._renderSelection();
        return;
      }

      if (!this.selection) return;

      const path = findPathBFS(this.board, this.selection, { r, c });
      if (!path) return;

      this._pushUndoSnapshot();
      const color = this.board.getAt(this.selection.r, this.selection.c);
      const from = { ...this.selection };
      this.selection = null;
      this._renderSelection();

      this._busy = true;
      this._syncUndoButton();
      this._animateMoveAlongPath(from, { r, c }, color, path, () => {
        this._afterMoveResolved();
      });
    }

    /**
     * Сохраняет состояние до хода (для отмены).
     */
    _pushUndoSnapshot() {
      if (this.undoStack.length >= UNDO_LIMIT) this.undoStack.shift();
      this.undoStack.push(this._snapshot());
    }

    /**
     * Анимация: плавное перемещение img по центрам клеток пути.
     */
    _animateMoveAlongPath(from, to, color, path, onDone) {
      const startEl = this.cellEls[from.r][from.c];
      const wrapSource = startEl.querySelector('.ball-wrap');
      wrapSource.innerHTML = '';

      const flyer = document.createElement('div');
      flyer.className = 'ball-fly';
      const img = document.createElement('img');
      img.src = Ball.svgPath(color);
      flyer.appendChild(img);
      document.body.appendChild(flyer);

      const rectAt = (r, c) => this.cellEls[r][c].getBoundingClientRect();

      let step = 0;
      const advance = () => {
        if (step >= path.length) {
          document.body.removeChild(flyer);
          this.board.setAt(from.r, from.c, EMPTY);
          this.board.setAt(to.r, to.c, color);
          this._repairNextSpawnPreview();
          this._renderCell(from.r, from.c, false);
          this._renderCell(to.r, to.c, false);
          onDone();
          return;
        }
        const { r, c } = path[step];
        const rect = rectAt(r, c);
        const size = Math.min(rect.width, rect.height) * 0.78;
        flyer.style.width = size + 'px';
        flyer.style.height = size + 'px';
        const left = rect.left + (rect.width - size) / 2 + window.scrollX;
        const top = rect.top + (rect.height - size) / 2 + window.scrollY;
        flyer.style.left = left + 'px';
        flyer.style.top = top + 'px';
        step++;
        window.setTimeout(advance, MOVE_STEP_MS);
      };

      advance();
    }

    /**
     * После физического хода: снятие линий (с каскадом) или появление 3 шариков.
     */
    _afterMoveResolved() {
      /**
       * Три новых шарика добавляются только если за весь ход (включая цепные сбросы)
       * не было ни одного удаления. Если хоть раз линии снимались — шарики не появляются.
       */
      this._resolveLinesChain(false, () => {
        this._busy = false;
        this._checkGameOver();
        this._syncUndoButton();
      });
    }

    /**
     * Удаляет линии в цикле, пока они есть.
     * @param {boolean} removedYet Были ли уже снятия в этом ходе (включая предыдущие каскады).
     * @param {() => void} done
     */
    _resolveLinesChain(removedYet, done) {
      const grid = this.board.cells;
      const { cells, scoreDelta } = findLinesAndScore(grid);

      if (cells.size === 0) {
        if (!removedYet) {
          this._spawnNextThree(() => done());
        } else {
          this._assignNextSpawnPreview();
          done();
        }
        return;
      }

      this.score += scoreDelta;
      if (this.score > this.highScore) {
        this.highScore = this.score;
        this.saveHighScore();
        this._renderHigh();
      }
      this._renderScore();

      const list = Array.from(cells).map(parseKey);
      this._animateVanish(list, () => {
        for (const p of list) {
          this.board.setAt(p.r, p.c, EMPTY);
        }
        this._repairNextSpawnPreview();
        this._fullRedraw();
        window.setTimeout(() => this._resolveLinesChain(true, done), CASCADE_GAP_MS);
      });
    }

    /**
     * Плавное исчезновение: класс vanish на обёртках клеток.
     */
    _animateVanish(positions, onDone) {
      for (const p of positions) {
        const wrap = this.cellEls[p.r][p.c].querySelector('.ball-wrap');
        if (wrap) wrap.classList.add('vanish');
      }
      window.setTimeout(onDone, VANISH_MS);
    }

    /**
     * Три шарика из очереди nextColors в заранее показанные клетки nextSpawnCells; очередь и места обновляются.
     */
    _spawnNextThree(done) {
      const need = SPAWN_COUNT;
      if (this.board.countEmpty() < need) {
        this._gameOver = true;
        this._showGameOver();
        done();
        return;
      }

      const used = new Set();
      for (let i = 0; i < need; i++) {
        const col = this.nextColors[i];
        let p = null;
        const planned = this.nextSpawnCells[i];
        if (planned && this.board.getAt(planned.r, planned.c) === EMPTY && !used.has(keyRC(planned.r, planned.c))) {
          p = planned;
        } else {
          for (let r = 0; r < BOARD_SIZE && !p; r++) {
            for (let c = 0; c < BOARD_SIZE && !p; c++) {
              const k = keyRC(r, c);
              if (this.board.getAt(r, c) === EMPTY && !used.has(k)) {
                p = { r, c };
              }
            }
          }
        }
        if (!p) {
          this._gameOver = true;
          this._showGameOver();
          done();
          return;
        }
        used.add(keyRC(p.r, p.c));
        this.board.setAt(p.r, p.c, col);
      }
      this._fillNextColors();
      this._assignNextSpawnPreview();
      this._fullRedraw();
      done();
    }

    /**
     * Конец игры: нет места под новые шарики или поле полностью заполнено после хода.
     */
    _checkGameOver() {
      if (this.board.countEmpty() === 0) {
        this._gameOver = true;
        this._showGameOver();
      }
    }

    _showGameOver() {
      this.elGoFinal.textContent = String(this.score);
      this.elOverlay.classList.remove('hidden');
      this._syncUndoButton();
    }

    /**
     * Откат к состоянию до последнего успешного хода (после анимации движения и всей обработки
     * отменить нельзя — отменяется целый «логический ход» одним снимком до начала хода).
     * Здесь снимок сделан до начала перемещения, поэтому отмена возвращает полностью предыдущее состояние.
     */
    undo() {
      if (this._busy || this.undoStack.length === 0) return;
      const snap = this.undoStack.pop();
      this._restore(snap);
      this.selection = null;
      this._gameOver = false;
      this.elOverlay.classList.add('hidden');
      this._fullRedraw();
      this._renderScore();
      if (this.score > this.highScore) {
        this.highScore = this.score;
        this.saveHighScore();
        this._renderHigh();
      }
      this._syncUndoButton();
    }

    async start() {
      await this.loadHighScore();
      this.newGame();
    }
  }

  // ——— Запуск ———

  const game = new Game();
  game.start();
})();
