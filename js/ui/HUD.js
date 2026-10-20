'use strict';

class HUD {
  constructor() {
    this.healthFill = document.getElementById('health-fill');
    this.scoreEl    = document.getElementById('score-value');
    this.waveEl     = document.getElementById('wave-value');
    this.overlay    = document.getElementById('overlay');
    this.titleEl    = document.getElementById('ov-title');
    this.subEl      = document.getElementById('ov-sub');
    this.btn        = document.getElementById('ov-btn');
    this.btnEdit    = document.getElementById('ov-btn-edit');
    this.vignette   = document.getElementById('vignette');

    this._vigTimer = 0;
  }

  setHealth(v, max) {
    this.healthFill.style.width = (clamp(v / max, 0, 1) * 100) + '%';
  }

  setScore(n)        { this.scoreEl.textContent = n; }
  setEnemiesLeft(n)  { this.waveEl.textContent  = n; }

  flashDamage() {
    this.vignette.classList.add('hit');
    this._vigTimer = 0.12;
  }

  update(dt) {
    if (this._vigTimer > 0) {
      this._vigTimer -= dt;
      if (this._vigTimer <= 0) this.vignette.classList.remove('hit');
    }
  }

  showOverlay(title, sub, buttonText, showEditBtn) {
    this.titleEl.textContent = title;
    this.subEl.textContent   = sub;
    this.btn.textContent     = buttonText;
    if (showEditBtn) this.btnEdit.classList.remove('hidden');
    else             this.btnEdit.classList.add('hidden');
    this.overlay.classList.remove('hidden');
  }

  hideOverlay() {
    this.overlay.classList.add('hidden');
  }
}
