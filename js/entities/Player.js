'use strict';

class Player {
  constructor(scene, camera) {
    this.camera = camera;

    this.pos      = new THREE.Vector3(0, 0, 6);   // feet position
    this.vel      = new THREE.Vector3();
    this.radius   = 0.45;
    this.yaw      = 0;
    this.pitch    = -0.12;

    this.maxHealth = 100;
    this.health    = 100;
    this.onGround  = true;
    this.cooldown  = 0;
    this.invuln    = 0;
    this.walkSpeed    = 7.2;
    this.fireCooldown = 0.11;
    this.spawnPoint = new THREE.Vector3(0, 0, 6);

    this.camDist  = 5.2;
    this.aimDir   = new THREE.Vector3();
    this.wish     = new THREE.Vector3();
    this._tmp     = new THREE.Vector3();

    this.mesh = this._buildMesh();
    scene.add(this.mesh);

    this.updateCamera(1);
  }

  _buildMesh() {
    const g = new THREE.Group();

    const bodyMat = new THREE.MeshStandardMaterial({
      color: 0x2b3a63, roughness: 0.42, metalness: 0.65
    });
    const accentMat = new THREE.MeshStandardMaterial({
      color: 0x63e8ff, emissive: 0x1a7f99, emissiveIntensity: 1.6,
      roughness: 0.25, metalness: 0.3
    });

    const body = new THREE.Mesh(new THREE.CapsuleGeometry(0.4, 0.85, 6, 14), bodyMat);
    body.position.y = 0.85;
    body.castShadow = true;
    g.add(body);

    const visor = new THREE.Mesh(new THREE.BoxGeometry(0.44, 0.13, 0.1), accentMat);
    visor.position.set(0, 1.33, -0.37);
    g.add(visor);

    const gun = new THREE.Mesh(new THREE.BoxGeometry(0.15, 0.15, 0.62), accentMat);
    gun.position.set(0.35, 1.06, -0.44);
    gun.castShadow = true;
    g.add(gun);

    const pack = new THREE.Mesh(new THREE.BoxGeometry(0.44, 0.5, 0.22), accentMat);
    pack.position.set(0, 1.05, 0.36);
    g.add(pack);

    return g;
  }

  reset() {
    this.pos.copy(this.spawnPoint);
    this.vel.set(0, 0, 0);
    this.yaw   = 0;
    this.pitch = -0.12;
    this.health   = this.maxHealth;
    this.cooldown = 0;
    this.invuln   = 0;
    this.onGround = true;
    this.mesh.visible = true;
    this.updateCamera(1);
  }

  hurt(amount) {
    if (this.invuln > 0 || this.health <= 0) return;
    this.health = Math.max(0, this.health - amount);
    this.invuln = 0.3;
  }

  /** forward vector of the camera, flattened to XZ */
  forwardXZ(out) {
    return out.set(-Math.sin(this.yaw), 0, -Math.cos(this.yaw));
  }

  update(dt, input, mouse, arena, projectiles, effects) {
    // ---------- look ----------
    const sens = 0.0022;
    this.yaw   -= mouse.dx * sens;
    this.pitch  = clamp(this.pitch - mouse.dy * sens, -0.95, 0.45);

    if (this.invuln > 0) this.invuln -= dt;

    // ---------- movement ----------
    const ax = input.axis();
    const fwd   = this.forwardXZ(new THREE.Vector3());
    const right = new THREE.Vector3(Math.cos(this.yaw), 0, -Math.sin(this.yaw));

    this.wish.set(0, 0, 0);
    this.wish.addScaledVector(fwd,   -ax.z);
    this.wish.addScaledVector(right,  ax.x);
    if (this.wish.lengthSq() > 0) this.wish.normalize();

    const speed = input.sprinting() ? this.walkSpeed * 1.6 : this.walkSpeed;
    this.vel.x = damp(this.vel.x, this.wish.x * speed, 15, dt);
    this.vel.z = damp(this.vel.z, this.wish.z * speed, 15, dt);

    if (this.onGround && input.consumeJump()) {
      this.vel.y  = 8.4;
      this.onGround = false;
    }
    this.vel.y -= 26 * dt;

    this.pos.addScaledVector(this.vel, dt);
    arena.resolve(this.pos, this.radius);

    if (this.pos.y <= 0) {
      this.pos.y  = 0;
      this.vel.y  = 0;
      this.onGround = true;
    }

    this.updateCamera(dt);

    // ---------- shooting ----------
    this.cooldown -= dt;
    if (input.firing && this.cooldown <= 0) {
      this.cooldown = this.fireCooldown;

      const camDir = this.aimDir
        .set(0, 0, -1)
        .applyEuler(new THREE.Euler(this.pitch, this.yaw, 0, 'YXZ'))
        .normalize();

      // aim point far along the camera ray -> muzzle converges on the crosshair
      const aimPoint = this.camera.position.clone().addScaledVector(camDir, 70);

      const origin = new THREE.Vector3(this.pos.x, this.pos.y + 1.15, this.pos.z)
        .addScaledVector(fwd, 0.6);

      const dir = aimPoint.sub(origin).normalize();

      projectiles.spawn(origin, dir, 78, 22);

      effects.burst(origin, 0x8ff6ff, 3, 4);
    }

    // ---------- mesh sync ----------
    this.mesh.position.copy(this.pos);
    this.mesh.rotation.y = this.yaw;
  }

  updateCamera(dt) {
    const pivot = this._tmp.set(this.pos.x, this.pos.y + 1.45, this.pos.z);

    const right = new THREE.Vector3(Math.cos(this.yaw), 0, -Math.sin(this.yaw));
    const back  = new THREE.Vector3(0, 0, 1)
      .applyEuler(new THREE.Euler(this.pitch, this.yaw, 0, 'YXZ'));

    const desired = pivot.clone()
      .addScaledVector(right, 0.68)
      .addScaledVector(back,  this.camDist);

    if (desired.y < 0.6) desired.y = 0.6;

    this.camera.position.lerp(desired, 1 - Math.exp(-22 * dt));

    const aim = new THREE.Vector3(0, 0, -1)
      .applyEuler(new THREE.Euler(this.pitch, this.yaw, 0, 'YXZ'));

    this.camera.lookAt(this.camera.position.clone().add(aim));
  }
}
