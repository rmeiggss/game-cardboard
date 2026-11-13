/**
 * renderer.js - Renderizador Canvas 2.5D para "Cardboard Tilt Maze"
 * Principio KISS: Textura de cartón en caché, sombras dinámicas y confeti.
 */
class MazeRenderer {
  constructor(canvas) {
    this.canvas = canvas;
    this.ctx = canvas.getContext('2d');
    this.cardboardPattern = null;
    this.confetti = [];
    this.initTexture();
  }

  // Genera textura de cartón Kraft procedural en memoria
  initTexture() {
    const pCanvas = document.createElement('canvas');
    pCanvas.width = 120;
    pCanvas.height = 120;
    const pctx = pCanvas.getContext('2d');

    pctx.fillStyle = '#C89D7C';
    pctx.fillRect(0, 0, 120, 120);

    // Ondulaciones corrugadas
    for (let y = 0; y < 120; y += 8) {
      pctx.fillStyle = 'rgba(181, 136, 99, 0.4)';
      pctx.fillRect(0, y, 120, 3);
      pctx.fillStyle = 'rgba(235, 206, 178, 0.22)';
      pctx.fillRect(0, y + 3, 120, 2);
    }

    // Fibras y motas
    for (let i = 0; i < 200; i++) {
      pctx.fillStyle = `rgba(90, 55, 25, ${Math.random() * 0.15 + 0.05})`;
      pctx.fillRect(Math.random() * 120, Math.random() * 120, Math.random() * 2 + 0.5, Math.random() * 2 + 0.5);
    }

    this.cardboardPattern = this.ctx.createPattern(pCanvas, 'repeat');
  }

  // Render principal por cuadro
  render(bounds, level, ball, tiltX, tiltY, mode, wallPreview, getCellCenter, getGridInter) {
    const ctx = this.ctx;
    ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);

    const shadowX = -tiltX * 14;
    const shadowY = -tiltY * 14;

    this.drawFlaps(bounds, tiltX, tiltY);
    this.drawFloor(bounds);

    if (mode === 'build') {
      this.drawGrid(bounds);
    }

    this.drawHoles(level.holes, bounds.cellSize, shadowX, shadowY, getCellCenter);
    this.drawStartAndGoal(level.start, level.goal, bounds.cellSize, getCellCenter);
    this.drawWalls(level.walls, shadowX, shadowY, getGridInter);

    if (mode === 'build' && wallPreview) {
      this.drawPreview(wallPreview, getGridInter);
    }

    this.drawMarble(ball, tiltX, tiltY, shadowX, shadowY);
    this.drawConfetti();
  }

  // Dibuja las solapas exteriores de la caja
  drawFlaps(bounds, tiltX, tiltY) {
    const ctx = this.ctx;
    ctx.fillStyle = '#4A3326';
    ctx.fillRect(0, 0, this.canvas.width, this.canvas.height);

    ctx.save();
    ctx.fillStyle = '#A77B5A';
    const flap = 22, ox = bounds.left - flap, oy = bounds.top - flap;
    const ow = bounds.width + flap * 2, oh = bounds.height + flap * 2;
    ctx.shadowColor = 'rgba(0, 0, 0, 0.45)';
    ctx.shadowBlur = 16;
    ctx.shadowOffsetX = -tiltX * 8;
    ctx.shadowOffsetY = -tiltY * 8;
    ctx.fillRect(ox, oy, ow, oh);
    ctx.restore();

    ctx.save();
    ctx.strokeStyle = '#8C6239';
    ctx.lineWidth = 2.5;
    ctx.beginPath();
    ctx.moveTo(ox, oy); ctx.lineTo(bounds.left, bounds.top);
    ctx.moveTo(ox + ow, oy); ctx.lineTo(bounds.left + bounds.width, bounds.top);
    ctx.moveTo(ox, oy + oh); ctx.lineTo(bounds.left, bounds.top + bounds.height);
    ctx.moveTo(ox + ow, oy + oh); ctx.lineTo(bounds.left + bounds.width, bounds.top + bounds.height);
    ctx.stroke();

    ctx.fillStyle = 'rgba(0, 0, 0, 0.2)';
    ctx.fillRect(bounds.left, bounds.top, bounds.width, 10);
    ctx.fillRect(bounds.left, bounds.top, 10, bounds.height);
    ctx.restore();
  }

  // Fondo de cartón Kraft interior
  drawFloor(bounds) {
    this.ctx.fillStyle = this.cardboardPattern || '#C89D7C';
    this.ctx.fillRect(bounds.left, bounds.top, bounds.width, bounds.height);
  }

  // Grilla punteada en modo edición
  drawGrid(bounds) {
    const ctx = this.ctx;
    ctx.save();
    ctx.strokeStyle = 'rgba(140, 98, 57, 0.35)';
    ctx.lineWidth = 1.2;
    ctx.setLineDash([4, 4]);
    ctx.beginPath();
    for (let c = 0; c <= 9; c++) {
      const x = bounds.left + c * bounds.cellSize;
      ctx.moveTo(x, bounds.top); ctx.lineTo(x, bounds.top + bounds.height);
    }
    for (let r = 0; r <= 14; r++) {
      const y = bounds.top + r * bounds.cellSize;
      ctx.moveTo(bounds.left, y); ctx.lineTo(bounds.left + bounds.width, y);
    }
    ctx.stroke();
    ctx.restore();
  }

  // Dibuja agujeros con profundidad realista
  drawHoles(holes, cellSize, sx, sy, getCellCenter) {
    const ctx = this.ctx;
    const r = cellSize * 0.34;
    holes.forEach(h => {
      const hc = getCellCenter(h.col, h.row);
      ctx.save();
      ctx.beginPath();
      ctx.arc(hc.x, hc.y, r, 0, Math.PI * 2);
      ctx.fillStyle = '#1E140F';
      ctx.fill();

      const grad = ctx.createRadialGradient(hc.x + sx * 0.5, hc.y + sy * 0.5, r * 0.2, hc.x, hc.y, r);
      grad.addColorStop(0, '#0D0805');
      grad.addColorStop(0.7, '#24160E');
      grad.addColorStop(1, 'rgba(190, 140, 100, 0.6)');
      ctx.fillStyle = grad;
      ctx.fill();

      ctx.strokeStyle = '#8C5E35';
      ctx.lineWidth = 2;
      ctx.stroke();
      ctx.restore();
    });
  }

  // Dibuja inicio (⭐) y meta (🏆)
  drawStartAndGoal(start, goal, cellSize, getCellCenter) {
    const ctx = this.ctx;
    const r = cellSize * 0.34;

    // Meta Dorada
    const gc = getCellCenter(goal.col, goal.row);
    ctx.save();
    ctx.shadowColor = 'rgba(255, 215, 0, 0.5)';
    ctx.shadowBlur = 12;
    ctx.beginPath();
    ctx.arc(gc.x, gc.y, r, 0, Math.PI * 2);
    const gold = ctx.createRadialGradient(gc.x, gc.y, 2, gc.x, gc.y, r);
    gold.addColorStop(0, '#FFF275');
    gold.addColorStop(0.6, '#FFC048');
    gold.addColorStop(1, '#C88A1A');
    ctx.fillStyle = gold;
    ctx.fill();
    ctx.strokeStyle = '#FFFFFF';
    ctx.lineWidth = 2.5;
    ctx.stroke();
    ctx.fillStyle = '#5A3D00';
    ctx.font = `bold ${Math.floor(cellSize * 0.42)}px sans-serif`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText('🏆', gc.x, gc.y + 1);
    ctx.restore();

    // Inicio Estrella
    const sc = getCellCenter(start.col, start.row);
    ctx.save();
    ctx.beginPath();
    ctx.arc(sc.x, sc.y, r * 0.85, 0, Math.PI * 2);
    ctx.fillStyle = 'rgba(46, 213, 115, 0.25)';
    ctx.fill();
    ctx.strokeStyle = '#2ED573';
    ctx.lineWidth = 2.5;
    ctx.setLineDash([4, 3]);
    ctx.stroke();
    ctx.font = `bold ${Math.floor(cellSize * 0.36)}px sans-serif`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText('⭐', sc.x, sc.y);
    ctx.restore();
  }

  // Dibuja paredes de cartón con relieve y sombras dinámicas
  drawWalls(walls, sx, sy, getGridInter) {
    const ctx = this.ctx;
    walls.forEach(w => {
      const p1 = getGridInter(w.c1, w.r1);
      const p2 = getGridInter(w.c2, w.r2);

      // Sombra dinámica
      ctx.save();
      ctx.shadowColor = 'rgba(0, 0, 0, 0.35)';
      ctx.shadowBlur = 6;
      ctx.shadowOffsetX = sx;
      ctx.shadowOffsetY = sy;
      ctx.beginPath();
      ctx.moveTo(p1.x, p1.y); ctx.lineTo(p2.x, p2.y);
      ctx.lineWidth = 12;
      ctx.lineCap = 'round';
      ctx.strokeStyle = '#B58863';
      ctx.stroke();
      ctx.restore();

      // Relieve superior Kraft
      ctx.save();
      ctx.beginPath();
      ctx.moveTo(p1.x, p1.y); ctx.lineTo(p2.x, p2.y);
      ctx.lineWidth = 12;
      ctx.lineCap = 'round';
      ctx.strokeStyle = '#D4AA85';
      ctx.stroke();
      ctx.lineWidth = 1.5;
      ctx.strokeStyle = '#8C6239';
      ctx.stroke();
      ctx.restore();
    });
  }

  // Previsualización de pared en construcción
  drawPreview(preview, getGridInter) {
    const p1 = getGridInter(preview.c, preview.r);
    const p2 = preview.hover;
    this.ctx.save();
    this.ctx.beginPath();
    this.ctx.moveTo(p1.x, p1.y); this.ctx.lineTo(p2.x, p2.y);
    this.ctx.lineWidth = 10;
    this.ctx.lineCap = 'round';
    this.ctx.strokeStyle = 'rgba(46, 213, 115, 0.6)';
    this.ctx.setLineDash([6, 6]);
    this.ctx.stroke();
    this.ctx.restore();
  }

  // Dibuja la canica con reflejos reactivos
  drawMarble(ball, tiltX, tiltY, sx, sy) {
    const r = ball.radius * ball.scale;
    if (r <= 0.5) return;
    const ctx = this.ctx;
    const cfg = MARBLE_TYPES[ball.currentMarbleType] || MARBLE_TYPES.acero;

    ctx.save();
    if (!ball.isFalling) {
      ctx.save();
      ctx.beginPath();
      ctx.arc(ball.x + sx, ball.y + sy, r * 0.95, 0, Math.PI * 2);
      ctx.fillStyle = 'rgba(0, 0, 0, 0.38)';
      ctx.filter = 'blur(3px)';
      ctx.fill();
      ctx.restore();
    }

    ctx.beginPath();
    ctx.arc(ball.x, ball.y, r, 0, Math.PI * 2);
    const lx = ball.x - tiltX * (r * 0.38);
    const ly = ball.y - tiltY * (r * 0.38);
    const grad = ctx.createRadialGradient(lx, ly, r * 0.1, ball.x, ball.y, r);
    grad.addColorStop(0, cfg.color1);
    grad.addColorStop(0.5, cfg.color2);
    grad.addColorStop(1, cfg.color3);
    ctx.fillStyle = grad;
    ctx.fill();

    // Brillo especular
    ctx.beginPath();
    ctx.arc(lx - r * 0.15, ly - r * 0.15, r * 0.28, 0, Math.PI * 2);
    ctx.fillStyle = 'rgba(255, 255, 255, 0.65)';
    ctx.fill();
    ctx.strokeStyle = 'rgba(0, 0, 0, 0.25)';
    ctx.lineWidth = 1;
    ctx.stroke();
    ctx.restore();
  }

  // Inicia confeti
  spawnConfetti(bounds) {
    this.confetti = [];
    const colors = ['#FF4757', '#2ED573', '#1E90FF', '#FFA502', '#FF6B81'];
    for (let i = 0; i < 60; i++) {
      this.confetti.push({
        x: bounds.left + bounds.width / 2 + (Math.random() * 80 - 40),
        y: bounds.top + bounds.height / 2 + (Math.random() * 80 - 40),
        vx: Math.random() * 12 - 6,
        vy: Math.random() * -14 - 4,
        size: Math.random() * 9 + 5,
        color: colors[Math.floor(Math.random() * colors.length)],
        rot: Math.random() * 360,
        vRot: Math.random() * 8 - 4,
        alpha: 1.0
      });
    }
  }

  drawConfetti() {
    for (let i = this.confetti.length - 1; i >= 0; i--) {
      const p = this.confetti[i];
      p.x += p.vx; p.y += p.vy; p.vy += 0.35;
      p.rot += p.vRot; p.alpha -= 0.008;

      if (p.alpha <= 0) { this.confetti.splice(i, 1); continue; }
      this.ctx.save();
      this.ctx.translate(p.x, p.y);
      this.ctx.rotate((p.rot * Math.PI) / 180);
      this.ctx.fillStyle = p.color;
      this.ctx.globalAlpha = p.alpha;
      this.ctx.fillRect(-p.size / 2, -p.size / 4, p.size, p.size * 0.6);
      this.ctx.restore();
    }
  }
}
