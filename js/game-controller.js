import {
  BOARD_SIZE,
  COLORS,
  EMPTY,
  SPAWN_COUNT,
  INITIAL_RANDOM_BALLS,
  MOVE_STEP_MS,
  VANISH_MS,
  CASCADE_GAP_MS,
  LS_HIGH,
  UNDO_LIMIT,
} from './config.js';
import { cloneGrid, keyRC, parseKey } from './grid-utils.js';
import { randInt } from './random.js';
import { Ball } from './ball.js';
import { Board } from './board.js';
import { findPathBFS } from './pathfinding.js';
import { findLinesAndScore } from './lines.js';

/**
 * Состояние игры, ходы и привязка к DOM.
 */
export class Game {
  constructor() {
    this.board = new Board();
    /** @type {number[]} три предстоящих цвета для штрафного появления */
    this.nextColors = [];
    /**
     * Три пустые клетки, куда встанут nextColors при следующем «штрафном» появлении.
     * @type {Array<{r:number,c:number}|null>}
     */
    this.nextSpawnCells = [null, null, null];
    /** @type {number} */
    this.score = 0;
    /** @type {number} */
    this.highScore = 0;
    /** @type {{r:number,c:number}|null} */
    this.selection = null;
    /** @type {Array<{ board: number[][], nextColors: number[], nextSpawnCells: Array<{r:number,c:number}|null>, score: number }>} */
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

  _assignNextSpawnPreview() {
    this.nextSpawnCells = [null, null, null];
    if (this.board.countEmpty() < SPAWN_COUNT) return;
    const picked = this.board.pickRandomEmptyCells(SPAWN_COUNT);
    if (picked.length < SPAWN_COUNT) return;
    for (let i = 0; i < SPAWN_COUNT; i++) {
      this.nextSpawnCells[i] = { r: picked[i].r, c: picked[i].c };
    }
  }

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

  _sanitizeNextSpawnCellsToMatchBoard() {
    const used = new Set();
    for (let i = 0; i < SPAWN_COUNT; i++) {
      const p = this.nextSpawnCells[i];
      if (!p) continue;
      const k = keyRC(p.r, p.c);
      if (
        !this.board.inBounds(p.r, p.c) ||
        this.board.getAt(p.r, p.c) !== EMPTY ||
        used.has(k)
      ) {
        this.nextSpawnCells[i] = null;
      } else {
        used.add(k);
      }
    }
    this._repairNextSpawnPreview();
  }

  _restore(snap) {
    const g = cloneGrid(snap.board);
    for (let r = 0; r < BOARD_SIZE; r++) {
      for (let c = 0; c < BOARD_SIZE; c++) {
        this.board.cells[r][c] = g[r][c];
      }
    }
    this.nextColors = snap.nextColors.slice();
    this.score = snap.score;

    if (Array.isArray(snap.nextSpawnCells) && snap.nextSpawnCells.length === SPAWN_COUNT) {
      this.nextSpawnCells = snap.nextSpawnCells.map((p) =>
        p && typeof p.r === 'number' && typeof p.c === 'number' ? { r: p.r, c: p.c } : null
      );
    } else {
      this.nextSpawnCells = [null, null, null];
    }
    this._sanitizeNextSpawnCellsToMatchBoard();
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
          this.selection !== null && this.selection.r === r && this.selection.c === c
        );
      }
    }
  }

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

  _pushUndoSnapshot() {
    if (this.undoStack.length >= UNDO_LIMIT) this.undoStack.shift();
    this.undoStack.push(this._snapshot());
  }

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

  _afterMoveResolved() {
    this._resolveLinesChain(false, () => {
      this._busy = false;
      this._checkGameOver();
      this._syncUndoButton();
    });
  }

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

  _animateVanish(positions, onDone) {
    for (const p of positions) {
      const wrap = this.cellEls[p.r][p.c].querySelector('.ball-wrap');
      if (wrap) wrap.classList.add('vanish');
    }
    window.setTimeout(onDone, VANISH_MS);
  }

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

  undo() {
    if (this._busy || this.undoStack.length === 0) return;
    const snap = this.undoStack.pop();
    document.querySelectorAll('.ball-fly').forEach((el) => {
      el.remove();
    });
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
