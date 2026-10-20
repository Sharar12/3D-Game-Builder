'use strict';

class Projectiles {
  constructor(scene) {
    this.scene = scene;
    this.list  = [];
    this.pool  = [];
    this.geo   = new THREE.BoxGeometry(0.08, 0.08, 0.95);
    this.mat   = new THREE.MeshBasicMaterial({ color: 0x8ff6ff });
    this._fwd  = new THREE.Vector3(0, 0, 1);
    this.damageMultiplier = 1.0;
  }

  spawn(origin, dir, speed, damage) {
    const mesh = this.pool.pop() || new THREE.Mesh(this.geo, this.mat);
    mesh.position.copy(origin);
    mesh.quaternion.setFromUnitVectors(this._fwd, dir);
    mesh.visible = true;
    this.scene.add(mesh);

    this.list.push({
      mesh: mesh,
      vel: dir.clone().multiplyScalar(speed),
      damage: damage * this.damageMultiplier,
      life: 2.2
    });
  }

  update(dt, arena, enemies, onKill) {
    for (let i = this.list.length - 1; i >= 0; i--) {
      const b = this.list[i];
      b.life -= dt;
      b.mesh.position.addScaledVector(b.vel, dt);

      let dead = b.life <= 0;

      if (!dead && arena.pointBlocked(b.mesh.position)) dead = true;

      if (!dead) {
        for (const e of enemies.list) {
          if (e.dead) continue;
          const dx = e.pos.x - b.mesh.position.x;
          const dy = e.pos.y - b.mesh.position.y;
          const dz = e.pos.z - b.mesh.position.z;
          const r  = e.radius + 0.4;

          if (dx * dx + dy * dy + dz * dz < r * r) {
            e.damage(b.damage);
            if (e.dead && onKill) onKill(e);
            dead = true;
            break;
          }
        }
      }

      if (dead) {
        this.scene.remove(b.mesh);
        b.mesh.visible = false;
        this.pool.push(b.mesh);
        this.list.splice(i, 1);
      }
    }
  }

  clear() {
    for (const b of this.list) {
      this.scene.remove(b.mesh);
      b.mesh.visible = false;
      this.pool.push(b.mesh);
    }
    this.list.length = 0;
  }
}
