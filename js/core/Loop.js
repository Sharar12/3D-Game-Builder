'use strict';

/**
 * Fixed-timestep accumulator.
 * update() always receives the same dt -> physics is frame-rate independent.
 * render() is called once per frame.
 */
class Loop {
  constructor(update, render, step) {
    this.update = update;
    this.render = render;
    this.step   = step || 1 / 60;
    this.acc    = 0;
    this.last   = 0;
    this.running = false;
    this._tick = this._tick.bind(this);
  }

  start() {
    if (this.running) return;
    this.running = true;
    this.last = performance.now();
    requestAnimationFrame(this._tick);
  }

  _tick(t) {
    if (!this.running) return;

    let dt = (t - this.last) / 1000;
    this.last = t;
    if (dt > 0.25) dt = 0.25;          // tab was backgrounded — don't fast-forward

    this.acc += dt;

    let guard = 0;
    while (this.acc >= this.step && guard++ < 5) {
      this.update(this.step);
      this.acc -= this.step;
    }

    this.render(this.acc / this.step);
    requestAnimationFrame(this._tick);
  }
}
