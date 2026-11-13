/**
 * physics.js - Micro-motor Físico 2D para Canica sobre Cartón Kraft
 * Principio KISS: Colisiones elásticas círculo-segmento, gravedad y 3 materiales.
 */

const MARBLE_TYPES = {
  acero: {
    id: 'acero',
    name: 'Canica de Acero',
    mass: 1.5,
    bounce: 0.22,
    friction: 0.988,
    accel: 0.65,
    color1: '#FFFFFF',
    color2: '#A4B0BE',
    color3: '#2F3542'
  },
  goma: {
    id: 'goma',
    name: 'Pelota de Goma',
    mass: 0.9,
    bounce: 0.78,
    friction: 0.982,
    accel: 0.55,
    color1: '#FF9FF3',
    color2: '#FF4757',
    color3: '#B31B2A'
  },
  plastilina: {
    id: 'plastilina',
    name: 'Bolita de Plastilina',
    mass: 1.2,
    bounce: 0.05,
    friction: 0.948,
    accel: 0.38,
    color1: '#70A1FF',
    color2: '#1E90FF',
    color3: '#0A3D62'
  }
};

class MarblePhysics {
  constructor() {
    this.x = 0;
    this.y = 0;
    this.vx = 0;
    this.vy = 0;
    this.radius = 14;
    this.scale = 1.0;
    this.isFalling = false;
    this.fallTimer = 0;
    this.isVictory = false;
    this.currentMarbleType = 'acero';
  }

  // Configura el tipo de material de la canica
  setMarbleType(typeId) {
    if (MARBLE_TYPES[typeId]) {
      this.currentMarbleType = typeId;
    }
  }

  // Reinicia la canica en el punto de salida
  reset(pos) {
    this.x = pos.x;
    this.y = pos.y;
    this.vx = 0;
    this.vy = 0;
    this.scale = 1.0;
    this.isFalling = false;
    this.fallTimer = 0;
    this.isVictory = false;
  }

  // Paso físico de simulación
  update(dt, tiltX, tiltY, boxBounds, level, getCellCenter, getGridInter, onVictory, onRespawn) {
    if (this.isVictory) return;

    // 1. Animación de caída en hoyo
    if (this.isFalling) {
      this.fallTimer += dt;
      this.scale = Math.max(0.05, 1.0 - (this.fallTimer / 420));
      this.vx *= 0.85;
      this.vy *= 0.85;
      this.x += this.vx;
      this.y += this.vy;

      if (this.fallTimer >= 420) {
        onRespawn();
      }
      return;
    }

    const cfg = MARBLE_TYPES[this.currentMarbleType] || MARBLE_TYPES.acero;

    // 2. Fuerza de gravedad según inclinación y fricción
    const gravityAccel = cfg.accel * (dt / 16.66);
    this.vx = (this.vx + tiltX * gravityAccel) * cfg.friction;
    this.vy = (this.vy + tiltY * gravityAccel) * cfg.friction;

    this.x += this.vx;
    this.y += this.vy;

    // Sonido dinámico de rodadura
    const speed = Math.hypot(this.vx, this.vy);
    if (window.soundEffects) {
      window.soundEffects.updateRolling(speed);
    }

    // 3. Colisión con límites de la caja exterior
    let collided = false;
    let impactIntensity = 0;

    const r = this.radius;
    const { left, top, width, height } = boxBounds;

    if (this.x < left + r) {
      this.x = left + r;
      impactIntensity = Math.abs(this.vx) / 8;
      this.vx = -this.vx * cfg.bounce;
      collided = true;
    } else if (this.x > left + width - r) {
      this.x = left + width - r;
      impactIntensity = Math.abs(this.vx) / 8;
      this.vx = -this.vx * cfg.bounce;
      collided = true;
    }

    if (this.y < top + r) {
      this.y = top + r;
      impactIntensity = Math.max(impactIntensity, Math.abs(this.vy) / 8);
      this.vy = -this.vy * cfg.bounce;
      collided = true;
    } else if (this.y > top + height - r) {
      this.y = top + height - r;
      impactIntensity = Math.max(impactIntensity, Math.abs(this.vy) / 8);
      this.vy = -this.vy * cfg.bounce;
      collided = true;
    }

    // 4. Colisiones con paredes internas de cartón
    const wallHalfThick = 6;
    const minCollisionDist = r + wallHalfThick;

    for (let i = 0; i < level.walls.length; i++) {
      const w = level.walls[i];
      const p1 = getGridInter(w.c1, w.r1);
      const p2 = getGridInter(w.c2, w.r2);

      const vx = p2.x - p1.x;
      const vy = p2.y - p1.y;
      const l2 = vx * vx + vy * vy;
      if (l2 === 0) continue;

      let t = ((this.x - p1.x) * vx + (this.y - p1.y) * vy) / l2;
      t = Math.max(0, Math.min(1, t));

      const closeX = p1.x + t * vx;
      const closeY = p1.y + t * vy;
      const dx = this.x - closeX;
      const dy = this.y - closeY;
      const dist = Math.hypot(dx, dy);

      if (dist < minCollisionDist) {
        const nx = dx / (dist || 1);
        const ny = dy / (dist || 1);
        const penetration = minCollisionDist - dist;

        this.x += nx * penetration;
        this.y += ny * penetration;

        const normalVel = this.vx * nx + this.vy * ny;
        if (normalVel < 0) {
          const impulse = -(1 + cfg.bounce) * normalVel;
          this.vx += nx * impulse;
          this.vy += ny * impulse;

          const currImp = Math.abs(normalVel) / 8;
          if (currImp > impactIntensity) impactIntensity = currImp;
          collided = true;
        }
      }
    }

    if (collided && impactIntensity > 0.08 && window.soundEffects) {
      window.soundEffects.playImpact(impactIntensity);
    }

    // 5. Comprobar caída en hoyos trampa
    const holeRadius = boxBounds.cellSize * 0.32;
    for (let i = 0; i < level.holes.length; i++) {
      const hc = getCellCenter(level.holes[i].col, level.holes[i].row);
      if (Math.hypot(this.x - hc.x, this.y - hc.y) < holeRadius) {
        this.isFalling = true;
        this.fallTimer = 0;
        this.vx = (hc.x - this.x) * 0.15;
        this.vy = (hc.y - this.y) * 0.15;
        if (window.soundEffects) window.soundEffects.playHoleDrop();
        return;
      }
    }

    // 6. Comprobar llegada a la meta dorada
    const gc = getCellCenter(level.goal.col, level.goal.row);
    if (!this.isVictory && Math.hypot(this.x - gc.x, this.y - gc.y) < holeRadius * 0.95) {
      this.isVictory = true;
      this.x = gc.x;
      this.y = gc.y;
      this.vx = 0;
      this.vy = 0;
      if (window.soundEffects) window.soundEffects.stopRolling();
      onVictory();
    }
  }
}

// Instancia global
window.marblePhysics = new MarblePhysics();
