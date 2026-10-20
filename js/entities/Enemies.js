'use strict';

class Enemy {
  constructor(scene, pos, hp, speed, phase, armed, facing) {
    this.pos    = pos.clone();
    this.vel    = new THREE.Vector3();
    this.radius = 0.85;
    this.hp     = hp;
    this.maxHp  = hp;
    this.baseSpeed = speed;
    this.phase  = phase;
    this.armed  = !!armed;

    // ---- stealth state ----
    this.state      = 'idle';
    this.facing     = new THREE.Vector2(facing.x, facing.z).normalize();
    this.baseFacing = this.facing.clone();
    this.scanPhase  = phase;
    this.progress   = 0;            // 0..1 meter for alert progression
    this.lastSeenPos = null;
    this.timeSinceSeen = 999;
    this.alertTimer = 0;
    this.maxAlertTimer = 1;         // To calculate the UI bar % later

    this.hitFlash = 0;
    this.attackCd = 0;
    this.shootCd  = 0;
    this.dead     = false;

    // ---- mesh ----
    this.mesh = new THREE.Mesh(
      Enemies.GEO,
      new THREE.MeshStandardMaterial({
        color: 0x884444, emissive: 0x440810, emissiveIntensity: 1.4,
        roughness: 0.35, metalness: 0.55
      })
    );
    this.mesh.castShadow = true;

    // direction pointer
    const pointer = new THREE.Mesh(Enemies.POINTER_GEO, Enemies.POINTER_MAT);
    pointer.rotation.x = Math.PI / 2;
    pointer.position.set(0, 0, 0.9);
    this.mesh.add(pointer);

    // gun (armed only)
    if (this.armed) {
      const gunMat = new THREE.MeshStandardMaterial({
        color: 0xffaa44, emissive: 0xff6600, emissiveIntensity: 1.4,
        roughness: 0.3, metalness: 0.7
      });
      const gun = new THREE.Mesh(new THREE.BoxGeometry(0.15, 0.15, 0.7), gunMat);
      gun.position.set(0.42, -0.15, 0.55);
      this.mesh.add(gun);
    }

    this.mesh.position.copy(this.pos);
    this.mesh.rotation.y = Math.atan2(this.facing.x, this.facing.y);
    scene.add(this.mesh);
    this.scene = scene;

    // ---- floating UI bars ----
    this.uiGroup = new THREE.Group();
    this.uiGroup.position.set(0, 1.8, 0); // Above head
    this.uiGroup.visible = false;
    
    // Background
    const bgGeo = new THREE.PlaneGeometry(1.2, 0.12);
    const bgMat = new THREE.MeshBasicMaterial({ color: 0x000000, transparent: true, opacity: 0.6, depthTest: false });
    const bg = new THREE.Mesh(bgGeo, bgMat);
    this.uiGroup.add(bg);

    // Helper to make a fill bar that anchors to the left (-0.6 to +0.6)
    const fillGeo = new THREE.PlaneGeometry(1.2, 0.12);
    fillGeo.translate(0.6, 0, 0); // Pivot at left edge

    // Yellow Suspicious Bar
    const susMat = new THREE.MeshBasicMaterial({ color: 0xffcc00, depthTest: false });
    this.uiSus = new THREE.Mesh(fillGeo, susMat);
    this.uiSus.position.set(-0.6, 0, 0.01);
    this.uiGroup.add(this.uiSus);

    // Red Alert Bar
    const alertMat = new THREE.MeshBasicMaterial({ color: 0xff2222, depthTest: false });
    this.uiAlert = new THREE.Mesh(fillGeo, alertMat);
    this.uiAlert.position.set(-0.6, 0, 0.01);
    this.uiGroup.add(this.uiAlert);

    this.mesh.add(this.uiGroup);

    this.cone = null;
  }

  rebuildCone(viewAngle, visionRange) {
    if (this.cone) {
      this.scene.remove(this.cone);
      this.cone.geometry.dispose();
      this.cone.material.dispose();
      this.cone = null;
    }
  }

  damage(amount) {
    if (this.dead) return;
    this.hp -= amount;
    this.hitFlash = 0.08;
    if (this.state === 'idle' || this.state === 'suspicious') {
      this.state = 'attack';
      this.timeSinceSeen = 0;
    }
    if (this.hp <= 0) this.dead = true;
  }

  dispose() {
    if (this.cone) {
      this.scene.remove(this.cone);
      this.cone.geometry.dispose();
      this.cone.material.dispose();
    }
    this.scene.remove(this.mesh);
    this.mesh.traverse(o => {
      if (o.geometry && o.geometry !== Enemies.GEO && o.geometry !== Enemies.POINTER_GEO) o.geometry.dispose();
      if (o.material && o.material !== Enemies.POINTER_MAT) o.material.dispose();
    });
  }
}

class Enemies {
  static GEO = new THREE.OctahedronGeometry(0.85, 0);
  static POINTER_GEO = new THREE.ConeGeometry(0.16, 0.42, 6);
  static POINTER_MAT = new THREE.MeshStandardMaterial({
    color: 0x63e8ff, emissive: 0x2fd4ff, emissiveIntensity: 1.2, roughness: 0.3, metalness: 0.5
  });

  static STATE_COLORS = {
    idle:       0x884444,
    suspicious: 0xffcc00,
    alert:      0xff2222,
    attack:     0xff0066
  };

  static STATE_EMISSIVE = {
    idle:       0x440810,
    suspicious: 0x886600,
    alert:      0x6a0a1c,
    attack:     0x6a0033
  };

  constructor(scene, camera, effects, arena) {
    this.scene   = scene;
    this.camera  = camera;
    this.effects = effects;
    this.arena   = arena;
    this.list    = [];

    // tuning
    this.speedMultiplier = 1.0;
    this.hpMultiplier    = 1.0;
    this.damage          = 9;
    this.visionRange     = 20;
    this.viewAngle       = Math.PI * 0.5;
    this.suspicionTime   = 2.0;
    this.alertThreshold  = 0.6667;
    this.alertDurationPercent = 33;
    this.fireCooldown    = 1.6;
    this.showCones       = false;

    this.enemyBullets = [];
    this.bulletPool   = [];
    this.bulletGeo    = new THREE.SphereGeometry(0.13, 8, 6);
    this.bulletMat    = new THREE.MeshBasicMaterial({ color: 0xff5544 });

    this._losRaycaster = new THREE.Raycaster();
  }

  spawnAt(x, z, armed, facing) {
    const hp   = 40 * this.hpMultiplier;
    const base = 3.2;
    const f    = facing || { x: 0, z: -1 };
    const e = new Enemy(
      this.scene, new THREE.Vector3(x, 1.4, z), hp, base,
      Math.random() * Math.PI * 2, armed, f
    );
    e.rebuildCone(this.viewAngle, this.visionRange);
    this.list.push(e);
    return e;
  }

  spawnAll(spawns) {
    this.clear();
    for (const s of spawns) this.spawnAt(s.x, s.z, s.armed, s.facing);
  }

  rebuildCones() {
    for (const e of this.list) e.rebuildCone(this.viewAngle, this.visionRange);
  }

  setShowCones(v) {
    this.showCones = v;
  }

  _isInCone(e, nx, nz) {
    const dot = nx * e.facing.x + nz * e.facing.y;
    return dot >= Math.cos(this.viewAngle / 2);
  }

  _faceToward(e, dx, dz) {
    const len = Math.hypot(dx, dz) || 1;
    e.facing.x = dx / len;
    e.facing.y = dz / len;
  }

  _setFacing(e, baseVec, offset) {
    const c = Math.cos(offset), s = Math.sin(offset);
    e.facing.x = baseVec.x * c - baseVec.y * s;
    e.facing.y = baseVec.x * s + baseVec.y * c;
  }

  _alertDuration() {
    return Math.max(0.2, this.suspicionTime * (this.alertDurationPercent / 100));
  }

  update(dt, player) {
    const bulletSpeed = 22;
    const meleeSq     = 2.4;
    const stopRange   = 11;

    for (const e of this.list) {
      if (e.dead) continue;

      e.phase += dt * 2.6;
      e.timeSinceSeen += dt;

      const dx = player.pos.x - e.pos.x;
      const dz = player.pos.z - e.pos.z;
      const dist    = Math.hypot(dx, dz) || 1;
      const inRange = dist <= this.visionRange;
      
      // Line of Sight Check
      let hasLOS = false;
      if (inRange) {
        const origin = new THREE.Vector3(e.pos.x, 1.0, e.pos.z);
        const target = new THREE.Vector3(player.pos.x, 1.0, player.pos.z);
        const rayDir = target.clone().sub(origin).normalize();
        const rayDist = origin.distanceTo(target);

        this._losRaycaster.set(origin, rayDir);
        this._losRaycaster.far = rayDist;
        const hits = this._losRaycaster.intersectObjects(this.arena.group.children, false);
        hasLOS = hits.length === 0;
      }

      const inCone = inRange && hasLOS && this._isInCone(e, dx / dist, dz / dist);

      // ---------- state machine ----------
      if (e.state === 'idle') {
        e.scanPhase += dt * 0.8;
        const offset = Math.sin(e.scanPhase) * (Math.PI / 4);
        this._setFacing(e, e.baseFacing, offset);
        e.vel.x = damp(e.vel.x, 0, 6, dt);
        e.vel.z = damp(e.vel.z, 0, 6, dt);

        if (inCone) {
          e.state = 'suspicious';
          e.progress = 0;
          e.lastSeenPos = player.pos.clone();
          e.timeSinceSeen = 0;
        }
      }
      else if (e.state === 'suspicious') {
        this._faceToward(e, dx, dz);
        e.vel.x = damp(e.vel.x, 0, 8, dt);
        e.vel.z = damp(e.vel.z, 0, 8, dt);

        if (inCone) {
          e.lastSeenPos = player.pos.clone();
          e.timeSinceSeen = 0;

          const clampedDist = Math.max(dist, this.visionRange * 0.05);
          const fillTime    = this.suspicionTime * (clampedDist / this.visionRange);
          const fillRate    = 1 / Math.max(0.1, fillTime);
          e.progress += fillRate * dt;

          if (e.progress >= this.alertThreshold) {
            e.state = 'alert';
            e.progress = this.alertThreshold;
            e.alertTimer = this._alertDuration();
            e.maxAlertTimer = e.alertTimer;
          }
        } else {
          e.progress -= (1 / 4) * dt;
          if (e.progress <= 0) {
            e.state = 'idle';
            e.progress = 0;
            e.lastSeenPos = null;
          }
        }
      }
      else if (e.state === 'alert') {
        e.alertTimer -= dt;

        if (e.lastSeenPos) {
          const lx = e.lastSeenPos.x - e.pos.x;
          const lz = e.lastSeenPos.z - e.pos.z;
          const ld = Math.hypot(lx, lz) || 1;

          if (ld > 1.0) {
            this._faceToward(e, lx, lz);
            const spd = e.baseSpeed * this.speedMultiplier * 0.7;
            e.vel.x = damp(e.vel.x, (lx / ld) * spd, 4.5, dt);
            e.vel.z = damp(e.vel.z, (lz / ld) * spd, 4.5, dt);
          } else {
            e.vel.x = damp(e.vel.x, 0, 6, dt);
            e.vel.z = damp(e.vel.z, 0, 6, dt);
          }
        }

        if (inCone) {
          e.state = 'attack';
          e.timeSinceSeen = 0;
          e.lastSeenPos = player.pos.clone();
        } else if (e.alertTimer <= 0) {
          e.state = 'idle';
          e.progress = 0;
          e.lastSeenPos = null;
          e.alertTimer = 0;
        }
      }
      else if (e.state === 'attack') {
        this._faceToward(e, dx, dz);
        if (inCone) {
          e.timeSinceSeen = 0;
          e.lastSeenPos = player.pos.clone();
        }

        const hold = e.armed ? stopRange : 0;
        if (dist > hold + 0.5) {
          const spd = e.baseSpeed * this.speedMultiplier;
          e.vel.x = damp(e.vel.x, (dx / dist) * spd, 4.5, dt);
          e.vel.z = damp(e.vel.z, (dz / dist) * spd, 4.5, dt);
        } else {
          e.vel.x = damp(e.vel.x, 0, 6, dt);
          e.vel.z = damp(e.vel.z, 0, 6, dt);
        }

        e.attackCd -= dt;
        const pdy = (player.pos.y + 1.0) - e.pos.y;
        if (e.attackCd <= 0 && dist * dist < meleeSq && Math.abs(pdy) < 2.2) {
          e.attackCd = 0.85;
          player.hurt(this.damage);
          this.effects.burst(
            new THREE.Vector3(player.pos.x, player.pos.y + 1.1, player.pos.z), 0xff3b5c, 10, 5
          );
        }

        e.shootCd -= dt;
        if (e.armed && inRange && dist > 2.5 && e.shootCd <= 0) {
          e.shootCd = this.fireCooldown * (0.85 + Math.random() * 0.3);
          this._fireBullet(e, player, bulletSpeed);
        }

        if (e.timeSinceSeen > 2.5) {
          e.state = 'alert';
          e.alertTimer = this._alertDuration();
          e.maxAlertTimer = e.alertTimer;
        }
      }

      // ---------- physics ----------
      e.pos.x += e.vel.x * dt;
      e.pos.z += e.vel.z * dt;
      this.arena.resolve(e.pos, e.radius);
      e.pos.y = 1.4 + Math.sin(e.phase) * 0.28;

      // ---------- mesh sync ----------
      e.mesh.position.copy(e.pos);
      e.mesh.rotation.y = Math.atan2(e.facing.x, e.facing.y);
      e.mesh.material.color.setHex(Enemies.STATE_COLORS[e.state] || 0xff3b5c);
      if (Enemies.STATE_EMISSIVE && Enemies.STATE_EMISSIVE[e.state]) {
        e.mesh.material.emissive.setHex(Enemies.STATE_EMISSIVE[e.state]);
      }

      if (e.hitFlash > 0) {
        e.hitFlash -= dt;
        e.mesh.material.emissiveIntensity = 6;
      } else {
        e.mesh.material.emissiveIntensity = 1.4;
      }

      // ---------- UI Bars ----------
      // Billboard effect: Cancel parent mesh rotation so bars always face the camera
      if (this.camera) {
        e.uiGroup.quaternion.copy(e.mesh.quaternion).invert().multiply(this.camera.quaternion);
      }

      if (e.state === 'suspicious') {
        e.uiGroup.visible = true;
        e.uiSus.visible = true;
        e.uiAlert.visible = false;
        const normProgress = e.progress / Math.max(0.01, this.alertThreshold);
        e.uiSus.scale.x = Math.max(0.001, Math.min(1, normProgress));
      } 
      else if (e.state === 'alert') {
        e.uiGroup.visible = true;
        e.uiSus.visible = false;
        e.uiAlert.visible = true;
        e.uiAlert.scale.x = Math.max(0.001, Math.min(1, e.alertTimer / (e.maxAlertTimer || 1)));
      } 
      else if (e.state === 'attack') {
        e.uiGroup.visible = true;
        e.uiSus.visible = false;
        e.uiAlert.visible = true;
        e.uiAlert.scale.x = 1; // Full red bar during attack
      } 
      else {
        e.uiGroup.visible = false; // Hidden when Idle
      }
    }

    // reap
    for (let i = this.list.length - 1; i >= 0; i--) {
      const e = this.list[i];
      if (!e.dead) continue;
      this.effects.burst(e.pos, 0xff3b5c, 16, 7);
      this.effects.burst(e.pos, 0xffffff, 6, 4);
      e.dispose();
      this.list.splice(i, 1);
    }

    this._updateBullets(dt, player);
  }

  _fireBullet(enemy, player, speed) {
    const origin = new THREE.Vector3(enemy.pos.x, enemy.pos.y, enemy.pos.z);
    const dir = new THREE.Vector3(
      player.pos.x - origin.x,
      (player.pos.y + 1.0) - origin.y,
      player.pos.z - origin.z
    ).normalize();

    const b = this._acquireBullet();
    b.mesh.position.copy(origin);
    b.mesh.visible = true;
    b.vel.copy(dir).multiplyScalar(speed);
    b.life = 3.0;

    this.effects.burst(origin, 0xffaa44, 3, 3);
    this.enemyBullets.push(b);
  }

  _acquireBullet() {
    if (this.bulletPool.length) {
      const b = this.bulletPool.pop();
      this.scene.add(b.mesh);
      return b;
    }
    const mesh = new THREE.Mesh(this.bulletGeo, this.bulletMat);
    this.scene.add(mesh);
    return { mesh, vel: new THREE.Vector3(), life: 0 };
  }

  _updateBullets(dt, player) {
    for (let i = this.enemyBullets.length - 1; i >= 0; i--) {
      const b = this.enemyBullets[i];
      b.life -= dt;
      b.mesh.position.addScaledVector(b.vel, dt);

      let dead = b.life <= 0;
      if (!dead && this.arena.pointBlocked(b.mesh.position)) dead = true;

      if (!dead) {
        const dx = player.pos.x - b.mesh.position.x;
        const dy = (player.pos.y + 1.0) - b.mesh.position.y;
        const dz = player.pos.z - b.mesh.position.z;
        if (dx * dx + dy * dy + dz * dz < 0.7 * 0.7) {
          player.hurt(this.damage);
          this.effects.burst(b.mesh.position, 0xff5544, 8, 4);
          dead = true;
        }
      }

      if (dead) {
        this.scene.remove(b.mesh);
        b.mesh.visible = false;
        this.bulletPool.push(b);
        this.enemyBullets.splice(i, 1);
      }
    }
  }

  clear() {
    for (const e of this.list) e.dispose();
    this.list.length = 0;
    for (const b of this.enemyBullets) {
      this.scene.remove(b.mesh);
      this.bulletPool.push(b);
    }
    this.enemyBullets.length = 0;
  }

  get count() { return this.list.length; }
}

// Backward compatibility aliases
Enemies.GEO = Enemies.GEO;
Enemies.POINTER_GEO = Enemies.POINTER_GEO;
Enemies.POINTER_MAT = Enemies.POINTER_MAT;
Enemies.STATE_COLORS = Enemies.STATE_COLORS;
Enemies.STATE_EMISSIVE = Enemies.STATE_EMISSIVE;
