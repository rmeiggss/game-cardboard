/**
 * game.js - Controlador Principal del Juego "Cardboard Tilt Maze" (v0.1)
 * Principio KISS: Orquesta física, renderizado 2.5D, progresión y editor (< 300 líneas).
 */

class CardboardMazeGame {
  constructor() {
    this.canvas = document.getElementById('gameCanvas');
    this.renderer = new MazeRenderer(this.canvas);
    this.physics = window.marblePhysics;
    this.generator = window.mazeGenerator;

    this.mode = 'play'; // 'play' o 'build'
    this.levelNum = parseInt(localStorage.getItem('cardboard_maze_level') || '1', 10);
    this.level = this.generator.generate(this.levelNum);

    this.bounds = { left: 0, top: 0, width: 0, height: 0, cellSize: 0 };
    this.buildTool = 'wall';
    this.wallDragStart = null;
    this.hoverPos = null;

    this.resize();
    window.addEventListener('resize', () => this.resize());
    this.initEvents();
    this.resetBall();
    this.updateHUD();

    this.lastTime = performance.now();
    requestAnimationFrame((t) => this.loop(t));
  }

  // Ajusta dimensiones de la caja
  resize() {
    const parent = this.canvas.parentElement;
    this.canvas.width = parent.clientWidth;
    this.canvas.height = parent.clientHeight;

    const margin = Math.min(this.canvas.width, this.canvas.height) * 0.05;
    const availW = this.canvas.width - margin * 2;
    const availH = this.canvas.height - margin * 2;
    const cell = Math.floor(Math.min(availW / 9, availH / 14));

    this.bounds.cellSize = cell;
    this.bounds.width = cell * 9;
    this.bounds.height = cell * 14;
    this.bounds.left = Math.floor((this.canvas.width - this.bounds.width) / 2);
    this.bounds.top = Math.floor((this.canvas.height - this.bounds.height) / 2);
    this.physics.radius = Math.max(9, Math.floor(cell * 0.28));
  }

  getCellCenter(c, r) {
    return {
      x: this.bounds.left + c * this.bounds.cellSize + this.bounds.cellSize / 2,
      y: this.bounds.top + r * this.bounds.cellSize + this.bounds.cellSize / 2
    };
  }

  getGridInter(c, r) {
    return {
      x: this.bounds.left + c * this.bounds.cellSize,
      y: this.bounds.top + r * this.bounds.cellSize
    };
  }

  resetBall() {
    this.physics.reset(this.getCellCenter(this.level.start.col, this.level.start.row));
  }

  // Avanza al siguiente nivel procedural más difícil
  nextLevel() {
    this.levelNum++;
    localStorage.setItem('cardboard_maze_level', this.levelNum);
    this.level = this.generator.generate(this.levelNum);
    this.resetBall();
    this.updateHUD();
    document.getElementById('victoryModal').classList.add('hidden');
  }

  updateHUD() {
    const badge = document.getElementById('levelBadge');
    if (badge) badge.textContent = `Nivel ${this.levelNum}`;
  }

  // Bucle a 60 FPS
  loop(time) {
    const dt = Math.min(32, time - this.lastTime);
    this.lastTime = time;

    const tilt = window.sensorManager.update();

    if (this.mode === 'play') {
      this.physics.update(
        dt, tilt.tiltX, tilt.tiltY, this.bounds, this.level,
        (c, r) => this.getCellCenter(c, r),
        (c, r) => this.getGridInter(c, r),
        () => this.onVictory(),
        () => this.resetBall()
      );
    }

    const preview = (this.wallDragStart && this.hoverPos)
      ? { c: this.wallDragStart.c, r: this.wallDragStart.r, hover: this.hoverPos }
      : null;

    this.renderer.render(
      this.bounds, this.level, this.physics, tilt.tiltX, tilt.tiltY,
      this.mode, preview,
      (c, r) => this.getCellCenter(c, r),
      (c, r) => this.getGridInter(c, r)
    );

    requestAnimationFrame((t) => this.loop(t));
  }

  onVictory() {
    if (window.soundEffects) {
      window.soundEffects.stopRolling();
      window.soundEffects.playVictory();
    }
    this.renderer.spawnConfetti(this.bounds);
    document.getElementById('victoryModal').classList.remove('hidden');
  }

  // Manejo de eventos
  initEvents() {
    const getPos = (e) => {
      const rect = this.canvas.getBoundingClientRect();
      const cx = e.touches ? e.touches[0].clientX : e.clientX;
      const cy = e.touches ? e.touches[0].clientY : e.clientY;
      return { x: cx - rect.left, y: cy - rect.top, cx, cy };
    };

    const onDown = (e) => {
      if (window.soundEffects) window.soundEffects.initContext();
      const p = getPos(e);
      if (this.mode === 'play') {
        window.sensorManager.handleMouseDown(p.cx, p.cy);
      } else {
        this.handleBuildDown(p.x, p.y);
      }
    };

    const onMove = (e) => {
      const p = getPos(e);
      if (this.mode === 'play') {
        window.sensorManager.handleMouseMove(p.cx, p.cy);
      } else {
        this.hoverPos = { x: p.x, y: p.y };
      }
    };

    const onUp = () => {
      if (this.mode === 'play') {
        window.sensorManager.handleMouseUp();
      } else {
        if (this.wallDragStart && this.hoverPos) this.handleBuildUp(this.hoverPos.x, this.hoverPos.y);
        this.wallDragStart = null;
      }
    };

    this.canvas.addEventListener('mousedown', onDown);
    window.addEventListener('mousemove', onMove);
    window.addEventListener('mouseup', onUp);
    this.canvas.addEventListener('touchstart', (e) => { e.preventDefault(); onDown(e); }, { passive: false });
    window.addEventListener('touchmove', (e) => { if (e.touches.length > 0) onMove(e); }, { passive: false });
    window.addEventListener('touchend', onUp);

    this.setupUIBindings();
  }

  handleBuildDown(px, py) {
    if (px < this.bounds.left || px > this.bounds.left + this.bounds.width ||
        py < this.bounds.top || py > this.bounds.top + this.bounds.height) return;

    const col = Math.floor((px - this.bounds.left) / this.bounds.cellSize);
    const row = Math.floor((py - this.bounds.top) / this.bounds.cellSize);

    if (this.buildTool === 'wall') {
      const c = Math.max(0, Math.min(9, Math.round((px - this.bounds.left) / this.bounds.cellSize)));
      const r = Math.max(0, Math.min(14, Math.round((py - this.bounds.top) / this.bounds.cellSize)));
      this.wallDragStart = { c, r };
    } else if (this.buildTool === 'hole') {
      const idx = this.level.holes.findIndex(h => h.col === col && h.row === row);
      if (idx !== -1) {
        this.level.holes.splice(idx, 1);
      } else {
        this.level.holes.push({ col, row });
      }
      if (window.soundEffects) window.soundEffects.playClick();
    } else if (this.buildTool === 'start') {
      this.level.start = { col, row };
      this.resetBall();
    } else if (this.buildTool === 'goal') {
      this.level.goal = { col, row };
    } else if (this.buildTool === 'eraser') {
      this.level.holes = this.level.holes.filter(h => !(h.col === col && h.row === row));
      this.eraseNearestWall(px, py);
    }
  }

  handleBuildUp(px, py) {
    if (this.buildTool !== 'wall' || !this.wallDragStart) return;
    const c2 = Math.max(0, Math.min(9, Math.round((px - this.bounds.left) / this.bounds.cellSize)));
    const r2 = Math.max(0, Math.min(14, Math.round((py - this.bounds.top) / this.bounds.cellSize)));

    const c1 = this.wallDragStart.c;
    const r1 = this.wallDragStart.r;

    if (c1 !== c2 || r1 !== r2) {
      if (Math.abs(c2 - c1) >= Math.abs(r2 - r1)) {
        const minC = Math.min(c1, c2), maxC = Math.max(c1, c2);
        for (let c = minC; c < maxC; c++) this.toggleWall(c, r1, c + 1, r1);
      } else {
        const minR = Math.min(r1, r2), maxR = Math.max(r1, r2);
        for (let r = minR; r < maxR; r++) this.toggleWall(c1, r, c1, r + 1);
      }
      if (window.soundEffects) window.soundEffects.playImpact(0.4);
    }
    this.wallDragStart = null;
  }

  toggleWall(c1, r1, c2, r2) {
    const idx = this.level.walls.findIndex(w =>
      (w.c1 === c1 && w.r1 === r1 && w.c2 === c2 && w.r2 === r2) ||
      (w.c1 === c2 && w.r1 === r2 && w.c2 === c1 && w.r2 === r1)
    );
    if (idx === -1) this.level.walls.push({ c1, r1, c2, r2 });
  }

  eraseNearestWall(px, py) {
    let minD = 24, rm = -1;
    this.level.walls.forEach((w, i) => {
      const p1 = this.getGridInter(w.c1, w.r1), p2 = this.getGridInter(w.c2, w.r2);
      const l2 = (p2.x - p1.x) ** 2 + (p2.y - p1.y) ** 2;
      let t = l2 ? Math.max(0, Math.min(1, ((px - p1.x) * (p2.x - p1.x) + (py - p1.y) * (p2.y - p1.y)) / l2)) : 0;
      const d = Math.hypot(px - (p1.x + t * (p2.x - p1.x)), py - (p1.y + t * (p2.y - p1.y)));
      if (d < minD) { minD = d; rm = i; }
    });
    if (rm !== -1) this.level.walls.splice(rm, 1);
  }

  setupUIBindings() {
    const play = document.getElementById('btnPlay'), edit = document.getElementById('btnEdit'), bar = document.getElementById('buildToolbar');
    play.addEventListener('click', () => {
      this.mode = 'play'; this.resetBall();
      play.classList.add('hidden'); edit.classList.remove('hidden'); bar.classList.add('hidden');
    });
    edit.addEventListener('click', () => {
      this.mode = 'build';
      edit.classList.add('hidden'); play.classList.remove('hidden'); bar.classList.remove('hidden');
    });

    document.querySelectorAll('[data-tool]').forEach(b => b.addEventListener('click', () => {
      document.querySelectorAll('[data-tool]').forEach(x => x.classList.remove('active'));
      b.classList.add('active'); this.buildTool = b.dataset.tool;
    }));

    document.querySelectorAll('[data-marble]').forEach(b => b.addEventListener('click', () => {
      document.querySelectorAll('[data-marble]').forEach(x => x.classList.remove('active'));
      b.classList.add('active'); this.physics.setMarbleType(b.dataset.marble);
    }));

    document.getElementById('btnNextLevel').addEventListener('click', () => this.nextLevel());
    document.getElementById('btnPlayAgain').addEventListener('click', () => {
      document.getElementById('victoryModal').classList.add('hidden'); this.resetBall();
    });
    document.getElementById('btnBackToEdit').addEventListener('click', () => {
      document.getElementById('victoryModal').classList.add('hidden'); edit.click();
    });
    document.getElementById('btnCalibrate').addEventListener('click', () => window.sensorManager.requestPermission());
    document.getElementById('btnMute').addEventListener('click', (e) => {
      const m = window.soundEffects.toggleMute();
      e.currentTarget.innerHTML = m ? '<span>🔇</span>' : '<span>🔊</span>';
    });
    document.getElementById('btnClear').addEventListener('click', () => {
      this.level.walls = []; this.level.holes = []; this.resetBall();
    });
  }
}

window.addEventListener('DOMContentLoaded', () => {
  window.cardboardGame = new CardboardMazeGame();
});
