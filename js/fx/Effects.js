'use strict';

/** Pooled particle bursts. Zero allocations after warm-up. */
class Effects {
  constructor(scene) {
    this.scene  = scene;
    this.active = [];
    this.pool   = [];
    this.geo    = new THREE.BoxGeometry(0.13, 0.13, 0.13);
  }

  burst(pos, color, count, speed) {
    count = count || 12;
    speed = speed || 6;

    for (let i = 0; i < count; i++) {
      const p = this._acquire();
      p.mesh.position.copy(pos);
      p.mesh.material.color.setHex(color);
      p.mesh.material.opacity = 1;
      p.mesh.scale.setScalar(1);
      p.mesh.visible = true;

      p.vel.set(Math.random() - 0.5, Math.random() * 0.9 + 0.15, Math.random() - 0.5)
           .normalize()
           .multiplyScalar(speed * (0.4 + Math.random() * 0.9));

      p.life    = 0.45 + Math.random() * 0.45;
      p.maxLife = p.life;

      this.active.push(p);
    }
  }

  _acquire() {
    if (this.pool.length) return this.pool.pop();

    const mesh = new THREE.Mesh(
      this.geo,
      new THREE.MeshBasicMaterial({ color: 0xffffff, transparent: true, opacity: 1 })
    );
    this.scene.add(mesh);

    return { mesh: mesh, vel: new THREE.Vector3(), life: 0, maxLife: 1 };
  }

  update(dt) {
    for (let i = this.active.length - 1; i >= 0; i--) {
      const p = this.active[i];
      p.life -= dt;

      if (p.life <= 0) {
        p.mesh.visible = false;
        this.pool.push(p);
        this.active.splice(i, 1);
        continue;
      }

      p.vel.y -= 20 * dt;
      p.mesh.position.addScaledVector(p.vel, dt);

      const t = p.life / p.maxLife;
      p.mesh.material.opacity = t;
      p.mesh.scale.setScalar(0.35 + t * 0.9);
      p.mesh.rotation.x += dt * 7;
      p.mesh.rotation.y += dt * 6;
    }
  }
}
