'use strict';

class Input {
  constructor(canvas, onLockChange) {
    this.canvas       = canvas;
    this.keys         = new Set();
    this.mdx          = 0;
    this.mdy          = 0;
    this.firing       = false;
    this.jumpPressed  = false;
    this.locked       = false;
    this.onLockChange = onLockChange || function () {};
    this._bind();
  }

  _bind() {
    window.addEventListener('keydown', e => {
      this.keys.add(e.code);
      if (e.code === 'Space') { this.jumpPressed = true; e.preventDefault(); }
      if (['KeyW','KeyA','KeyS','KeyD'].includes(e.code)) e.preventDefault();
    });

    window.addEventListener('keyup', e => this.keys.delete(e.code));

    window.addEventListener('blur', () => {
      this.keys.clear();
      this.firing = false;
    });

    this.canvas.addEventListener('mousedown', e => {
      if (e.button === 0) this.firing = true;
    });
    window.addEventListener('mouseup', e => {
      if (e.button === 0) this.firing = false;
    });
    this.canvas.addEventListener('contextmenu', e => e.preventDefault());

    document.addEventListener('mousemove', e => {
      if (!this.locked) return;
      this.mdx += e.movementX;
      this.mdy += e.movementY;
    });

    document.addEventListener('pointerlockchange', () => {
      this.locked = document.pointerLockElement === this.canvas;
      if (!this.locked) this.firing = false;
      this.onLockChange(this.locked);
    });

    document.addEventListener('pointerlockerror', (err) => {
      console.warn('Pointer lock failed or was rejected:', err);
    });
  }

  requestLock() {
    try {
      const p = this.canvas.requestPointerLock();
      if (p && typeof p.catch === 'function') {
        p.catch(e => console.warn('Pointer lock request error:', e));
      }
    } catch (e) {
      console.warn('Pointer lock exception:', e);
    }
  }

  releaseLock() {
    if (document.pointerLockElement) document.exitPointerLock();
  }

  consumeMouse() {
    const d = { dx: this.mdx, dy: this.mdy };
    this.mdx = 0; this.mdy = 0;
    return d;
  }

  consumeJump() {
    const j = this.jumpPressed;
    this.jumpPressed = false;
    return j;
  }

  axis() {
    let x = 0, z = 0;
    if (this.keys.has('KeyW')) z -= 1;
    if (this.keys.has('KeyS')) z += 1;
    if (this.keys.has('KeyA')) x -= 1;
    if (this.keys.has('KeyD')) x += 1;
    return { x, z };
  }

  sprinting() { return this.keys.has('ShiftLeft') || this.keys.has('ShiftRight'); }
}
