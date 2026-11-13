/**
 * generator.js - Generador Procedural de Laberintos con Dificultad Progresiva
 * Principio KISS: Algoritmo DFS + BFS para garantizar solvencia (100% Offline).
 */
class MazeGenerator {
  constructor(cols = 9, rows = 14) {
    this.cols = cols;
    this.rows = rows;
  }

  // Genera un nivel completo según el número de nivel
  generate(levelNum = 1) {
    const start = { col: 1, row: 1 };
    
    // 1. Crear árbol de pasillos usando DFS (Recursive Backtracker)
    const passages = this.createSpanningTree(start);

    // 2. Encontrar distancias desde start y camino óptimo usando BFS
    const { distances, parents, maxCell } = this.solveBFS(start, passages);

    // 3. Determinar posición de la Meta según dificultad
    let goal = maxCell;
    if (levelNum <= 2) {
      // En niveles iniciales, buscar una celda a distancia moderada
      const candidates = [];
      for (let r = 0; r < this.rows; r++) {
        for (let c = 0; c < this.cols; c++) {
          const d = distances[r][c];
          if (d >= 8 && d <= 15) candidates.push({ col: c, row: r });
        }
      }
      if (candidates.length > 0) {
        goal = candidates[Math.floor(Math.random() * candidates.length)];
      }
    }

    // 4. Identificar celdas del camino crítico para protegerlas de hoyos
    const criticalPath = new Set();
    let curr = `${goal.col},${goal.row}`;
    while (curr) {
      criticalPath.add(curr);
      curr = parents.get(curr);
    }

    // 5. Convertir pasajes en lista de paredes físicas entre grillas
    const walls = this.buildWallsFromPassages(passages, levelNum);

    // 6. Colocar hoyos trampa justos (NUNCA en el camino crítico)
    const holes = this.placeFairHoles(criticalPath, levelNum);

    return {
      id: `proc_lvl_${levelNum}`,
      name: `Caja #${levelNum}`,
      levelNum,
      start,
      goal,
      walls,
      holes
    };
  }

  // Genera pasajes conectados entre celdas (árbol libre de ciclos)
  createSpanningTree(start) {
    const visited = Array.from({ length: this.rows }, () => Array(this.cols).fill(false));
    const passages = new Set();
    const stack = [{ col: start.col, row: start.row }];
    visited[start.row][start.col] = true;

    const dirs = [
      { dc: 0, dr: -1 }, // Arriba
      { dc: 1, dr: 0 },  // Derecha
      { dc: 0, dr: 1 },  // Abajo
      { dc: -1, dr: 0 }  // Izquierda
    ];

    while (stack.length > 0) {
      const current = stack[stack.length - 1];
      // Buscar vecinos no visitados
      const neighbors = [];
      for (const d of dirs) {
        const nc = current.col + d.dc;
        const nr = current.row + d.dr;
        if (nc >= 0 && nc < this.cols && nr >= 0 && nr < this.rows && !visited[nr][nc]) {
          neighbors.push({ col: nc, row: nr });
        }
      }

      if (neighbors.length > 0) {
        const next = neighbors[Math.floor(Math.random() * neighbors.length)];
        visited[next.row][next.col] = true;
        // Guardar conexión bidireccional
        passages.add(`${current.col},${current.row}-${next.col},${next.row}`);
        passages.add(`${next.col},${next.row}-${current.col},${current.row}`);
        stack.push(next);
      } else {
        stack.pop();
      }
    }

    return passages;
  }

  // Búsqueda en anchura (BFS) para calcular distancias y camino crítico
  solveBFS(start, passages) {
    const distances = Array.from({ length: this.rows }, () => Array(this.cols).fill(-1));
    const parents = new Map();
    const queue = [start];

    distances[start.row][start.col] = 0;
    parents.set(`${start.col},${start.row}`, null);

    let maxDist = 0;
    let maxCell = start;

    const dirs = [{ dc: 0, dr: -1 }, { dc: 1, dr: 0 }, { dc: 0, dr: 1 }, { dc: -1, dr: 0 }];

    while (queue.length > 0) {
      const u = queue.shift();
      const uDist = distances[u.row][u.col];

      if (uDist > maxDist) {
        maxDist = uDist;
        maxCell = u;
      }

      for (const d of dirs) {
        const nc = u.col + d.dc;
        const nr = u.row + d.dr;
        if (nc >= 0 && nc < this.cols && nr >= 0 && nr < this.rows) {
          if (distances[nr][nc] === -1 && passages.has(`${u.col},${u.row}-${nc},${nr}`)) {
            distances[nr][nc] = uDist + 1;
            parents.set(`${nc},${nr}`, `${u.col},${u.row}`);
            queue.push({ col: nc, row: nr });
          }
        }
      }
    }

    return { distances, parents, maxCell };
  }

  // Convierte las conexiones en segmentos de paredes de cartón
  buildWallsFromPassages(passages, levelNum) {
    const walls = [];

    // Porcentaje de paredes a abrir para crear bucles según el nivel
    // Nivel 1: abre 35% de paredes extra para pasillos amplios
    // Nivel 6+: abre casi nada para laberinto estricto
    const loopProb = Math.max(0.04, 0.40 - levelNum * 0.04);

    // Paredes verticales internas (entre columnas c y c+1)
    for (let c = 0; c < this.cols - 1; c++) {
      for (let r = 0; r < this.rows; r++) {
        const isOpen = passages.has(`${c},${r}-${c + 1},${r}`);
        if (!isOpen) {
          if (Math.random() > loopProb) {
            walls.push({ c1: c + 1, r1: r, c2: c + 1, r2: r + 1 });
          }
        }
      }
    }

    // Paredes horizontales internas (entre filas r y r+1)
    for (let r = 0; r < this.rows - 1; r++) {
      for (let c = 0; c < this.cols; c++) {
        const isOpen = passages.has(`${c},${r}-${c},${r + 1}`);
        if (!isOpen) {
          if (Math.random() > loopProb) {
            walls.push({ c1: c, r1: r + 1, c2: c + 1, r2: r + 1 });
          }
        }
      }
    }

    return walls;
  }

  // Ubica agujeros justos de forma progresiva
  placeFairHoles(criticalPath, levelNum) {
    const holes = [];
    // Cantidad progresiva de hoyos: Nivel 1 = 1-2, Nivel 5 = 5-6, Nivel 10+ = 10
    const targetCount = Math.min(1 + Math.floor(levelNum * 0.9), 10);

    const candidates = [];
    for (let r = 0; r < this.rows; r++) {
      for (let c = 0; c < this.cols; c++) {
        const key = `${c},${r}`;
        // Si no está en el camino crítico de victoria, es candidato
        if (!criticalPath.has(key)) {
          candidates.push({ col: c, row: r });
        }
      }
    }

    // Mezclar candidatos aleatoriamente
    for (let i = candidates.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [candidates[i], candidates[j]] = [candidates[j], candidates[i]];
    }

    for (let i = 0; i < Math.min(targetCount, candidates.length); i++) {
      holes.push(candidates[i]);
    }

    return holes;
  }
}

// Instancia global
window.mazeGenerator = new MazeGenerator(9, 14);
