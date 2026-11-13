/**
 * sensors.js - Manejador de Giroscopio y Acelerómetro con Fallback de Escritorio
 * Filtro de suavizado exponencial (Low-Pass Filter) y calibración de punto cero.
 */
class SensorManager {
  constructor() {
    // Ángulos actuales de inclinación (en grados)
    this.rawBeta = 0;   // Frontal / Trasero (-180 a 180)
    this.rawGamma = 0;  // Izquierda / Derecha (-90 a 90)

    // Punto cero de calibración
    this.zeroBeta = 0;
    this.zeroGamma = 0;

    // Valores suavizados por Low-Pass Filter
    this.smoothBeta = 0;
    this.smoothGamma = 0;
    this.smoothingFactor = 0.15; // Suavizado exponencial para eliminar jitter

    // Límites de ángulo seguro para niños
    this.maxAngle = 35; // Grados máximos

    // Inclinación normalizada [-1, 1] que alimenta al motor físico
    this.tiltX = 0; // -1 (izquierda) a 1 (derecha)
    this.tiltY = 0; // -1 (arriba) a 1 (abajo)

    // Estado de detección de hardware
    this.hasGyroscope = false;
    this.isListening = false;
    this.permissionState = 'unknown'; // 'unknown', 'granted', 'denied'

    // Fallback de teclado para PC (WASD / Flechas)
    this.keys = { up: false, down: false, left: false, right: false };
    this.keyTiltX = 0;
    this.keyTiltY = 0;

    // Fallback de ratón para PC (arrastre)
    this.isMouseDown = false;
    this.mouseStartX = 0;
    this.mouseStartY = 0;
    this.mouseTiltX = 0;
    this.mouseTiltY = 0;

    this.initListeners();
  }

  // Inicializa listeners de sensores y teclado/ratón
  initListeners() {
    // Detección pasiva inicial de eventos de orientación
    if (window.DeviceOrientationEvent) {
      // En iOS 13+ se requiere permiso explícito mediante requestPermission()
      if (typeof DeviceOrientationEvent.requestPermission !== 'function') {
        this.startListening();
      }
    }

    // Listeners de fallback para teclado en PC
    window.addEventListener('keydown', (e) => {
      const code = e.key.toLowerCase();
      if (code === 'w' || code === 'arrowup') this.keys.up = true;
      if (code === 's' || code === 'arrowdown') this.keys.down = true;
      if (code === 'a' || code === 'arrowleft') this.keys.left = true;
      if (code === 'd' || code === 'arrowright') this.keys.right = true;
    });

    window.addEventListener('keyup', (e) => {
      const code = e.key.toLowerCase();
      if (code === 'w' || code === 'arrowup') this.keys.up = false;
      if (code === 's' || code === 'arrowdown') this.keys.down = false;
      if (code === 'a' || code === 'arrowleft') this.keys.left = false;
      if (code === 'd' || code === 'arrowright') this.keys.right = false;
    });
  }

  // Comienza a escuchar el evento de orientación nativo
  startListening() {
    if (this.isListening) return;

    window.addEventListener('deviceorientation', (event) => {
      // Verificar si hay datos reales de giroscopio
      if (event.beta !== null && event.gamma !== null) {
        this.hasGyroscope = true;
        this.rawBeta = event.beta;
        this.rawGamma = event.gamma;
      }
    }, { passive: true });

    this.isListening = true;
  }

  // Solicita permisos en iOS (debe llamarse desde un botón o gesto del usuario)
  async requestPermission() {
    if (typeof DeviceOrientationEvent !== 'undefined' && typeof DeviceOrientationEvent.requestPermission === 'function') {
      try {
        const response = await DeviceOrientationEvent.requestPermission();
        if (response === 'granted') {
          this.permissionState = 'granted';
          this.startListening();
          this.calibrate();
          return true;
        } else {
          this.permissionState = 'denied';
          return false;
        }
      } catch (err) {
        console.warn("Error al solicitar permiso de giroscopio:", err);
        return false;
      }
    } else {
      // Android o navegadores estándar sin requisito de permiso
      this.permissionState = 'granted';
      this.startListening();
      this.calibrate();
      return true;
    }
  }

  // Calibra la posición actual como el "Punto Cero" (caja horizontal plana)
  calibrate() {
    this.zeroBeta = this.rawBeta;
    this.zeroGamma = this.rawGamma;
    this.smoothBeta = 0;
    this.smoothGamma = 0;
  }

  // Manejo de arrastre de ratón sobre el canvas para simular inclinación en PC
  handleMouseDown(clientX, clientY, canvasRect) {
    if (this.hasGyroscope) return;
    this.isMouseDown = true;
    this.mouseStartX = clientX;
    this.mouseStartY = clientY;
  }

  handleMouseMove(clientX, clientY) {
    if (!this.isMouseDown || this.hasGyroscope) return;
    const dx = clientX - this.mouseStartX;
    const dy = clientY - this.mouseStartY;
    const maxDrag = 120; // Sensibilidad de arrastre

    this.mouseTiltX = Math.max(-1, Math.min(1, dx / maxDrag));
    this.mouseTiltY = Math.max(-1, Math.min(1, dy / maxDrag));
  }

  handleMouseUp() {
    this.isMouseDown = false;
  }

  // Actualización por cuadro: procesa Low-Pass Filter y calcula la inclinación final
  update() {
    if (this.hasGyroscope) {
      // Inclinación relativa al punto cero
      const deltaBeta = this.rawBeta - this.zeroBeta;
      const deltaGamma = this.rawGamma - this.zeroGamma;

      // Filtro pasa-bajos exponencial: smooth = smooth + factor * (target - smooth)
      this.smoothBeta += this.smoothingFactor * (deltaBeta - this.smoothBeta);
      this.smoothGamma += this.smoothingFactor * (deltaGamma - this.smoothGamma);

      // Limitar a los ángulos seguros [-maxAngle, maxAngle]
      const clampedGamma = Math.max(-this.maxAngle, Math.min(this.maxAngle, this.smoothGamma));
      const clampedBeta = Math.max(-this.maxAngle, Math.min(this.maxAngle, this.smoothBeta));

      // Normalizar entre -1 y 1
      this.tiltX = clampedGamma / this.maxAngle;
      this.tiltY = clampedBeta / this.maxAngle;
    } else {
      // Fallback para teclado en PC
      const keyTargetX = (this.keys.right ? 1 : 0) - (this.keys.left ? 1 : 0);
      const keyTargetY = (this.keys.down ? 1 : 0) - (this.keys.up ? 1 : 0);

      // Suavizar respuesta de teclado
      this.keyTiltX += 0.12 * (keyTargetX - this.keyTiltX);
      this.keyTiltY += 0.12 * (keyTargetY - this.keyTiltY);

      // Si no hay arrastre de ratón activo, desvanecer suavemente hacia el centro
      if (!this.isMouseDown) {
        this.mouseTiltX *= 0.90;
        this.mouseTiltY *= 0.90;
      }

      // Combinar teclado y ratón
      const combinedX = this.keyTiltX + this.mouseTiltX;
      const combinedY = this.keyTiltY + this.mouseTiltY;

      this.tiltX = Math.max(-1, Math.min(1, combinedX));
      this.tiltY = Math.max(-1, Math.min(1, combinedY));
    }

    return {
      tiltX: this.tiltX,
      tiltY: this.tiltY,
      hasGyro: this.hasGyroscope
    };
  }
}

// Exportar instancia global
window.sensorManager = new SensorManager();
