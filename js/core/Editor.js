'use strict';

class Editor {
  static GHOST_GEO        = new THREE.OctahedronGeometry(0.85, 0);
  static GHOST_MAT        = new THREE.MeshBasicMaterial({ color: 0xff3b5c, transparent: true, opacity: 0.4 });
  static GHOST_GUN_GEO    = new THREE.BoxGeometry(0.15, 0.15, 0.6);
  static GHOST_GUN_MAT    = new THREE.MeshBasicMaterial({ color: 0xffaa44, transparent: true, opacity: 0.7 });
  static PLAYER_GHOST_GEO = new THREE.CapsuleGeometry(0.4, 0.85, 4, 8);
  static PLAYER_GHOST_MAT = new THREE.MeshBasicMaterial({
    color: 0x63e8ff, transparent: true, opacity: 0.5, wireframe: true
  });
  static POINTER_GEO = new THREE.ConeGeometry(0.16, 0.42, 6);
  static POINTER_MAT = new THREE.MeshBasicMaterial({
    color: 0x63e8ff, transparent: true, opacity: 0.9
  });

  static buildConeMesh(x, z, facing, range, angle, alertPct, arena) {
    const group = new THREE.Group();
    const segs  = 32;
    const facingAngle = Math.atan2(facing ? facing.x : 0, facing ? facing.z : 1);

    const ray = new THREE.Raycaster();
    const origin = new THREE.Vector3(x, 1.0, z);
    const dir = new THREE.Vector3();

    const makeCone = (radius, color, opacity, offsetY) => {
      const verts = [0, 0, 0];

      for (let i = 0; i <= segs; i++) {
        const localA = -angle / 2 + (i / segs) * angle;
        let r = radius;

        // Cast a ray to see if a wall blocks this specific segment of the cone
        if (arena && arena.group && arena.group.children.length) {
          const worldA = facingAngle + localA;
          dir.set(Math.sin(worldA), 0, Math.cos(worldA));
          ray.set(origin, dir);
          ray.near = 0;
          ray.far = radius;

          const hits = ray.intersectObjects(arena.group.children, false);
          if (hits.length > 0) {
            r = Math.min(r, hits[0].distance);
          }
        }

        verts.push(Math.sin(localA) * r, 0, Math.cos(localA) * r);
      }

      const indices = [];
      for (let i = 1; i <= segs; i++) indices.push(0, i, i + 1);

      const geo = new THREE.BufferGeometry();
      geo.setAttribute('position', new THREE.Float32BufferAttribute(verts, 3));
      geo.setIndex(indices);

      const mat = new THREE.MeshBasicMaterial({
        color: color, transparent: true, opacity: opacity,
        side: THREE.DoubleSide, depthWrite: false, fog: false
      });

      const mesh = new THREE.Mesh(geo, mat);
      mesh.position.y = offsetY;
      return mesh;
    };

    // 1. Full Suspicious Cone (Yellow)
    group.add(makeCone(range, 0xffcc00, 0.18, 0));

    // 2. Inner Alert Cone (Red)
    const innerRange = range * (alertPct !== undefined ? alertPct : 0.6667);
    if (innerRange > 0.1) {
      group.add(makeCone(innerRange, 0xff2222, 0.45, 0.005));
    }

    return group;
  }

  constructor(scene, camera, arena, canvas, enemies) {
    this.scene   = scene;
    this.camera  = camera;
    this.arena   = arena;
    this.canvas  = canvas;
    this.enemies = enemies;

    this.active      = false;
    this.spawns      = [];
    this.playerSpawn = null;
    this.placeMode   = 'enemy';
    this.armedNext   = false;
    this.onChange    = null;

    this.ghostGroup = new THREE.Group();
    this.ghostGroup.visible = false;
    scene.add(this.ghostGroup);

    this.coneGroup = new THREE.Group();
    this.coneGroup.visible = false;
    scene.add(this.coneGroup);

    this.playerGhost = new THREE.Mesh(Editor.PLAYER_GHOST_GEO, Editor.PLAYER_GHOST_MAT);
    this.playerGhost.visible = false;
    scene.add(this.playerGhost);

    this.target = new THREE.Vector3(0, 0, 0);
    this.zoom   = 42;
    this.theta  = 0.6;
    this.phi    = 0.85;

    this.raycaster   = new THREE.Raycaster();
    this.mouseNDC    = new THREE.Vector2();
    this.groundPlane = new THREE.Plane(new THREE.Vector3(0, 1, 0), 0);

    this._dragStart = { x: 0, y: 0 };
    this._dragging  = null;
    this._dragMoved = false;

    this._bind();
    this.updateCamera();
  }

  enter() {
    this.active = true;
    this.ghostGroup.visible = true;
    this.coneGroup.visible  = true;
    this._rebuildGhosts();
    this.updateCamera();
  }

  exit() {
    this.active = false;
    this.ghostGroup.visible = false;
    this.coneGroup.visible  = false;
    this.playerGhost.visible = false;
  }

  syncCamera() { this.updateCamera(); }

  updateCamera() {
    const sp = Math.sin(this.phi), cp = Math.cos(this.phi);
    const st = Math.sin(this.theta), ct = Math.cos(this.theta);
    this.camera.position.set(
      this.target.x + this.zoom * sp * st,
      this.target.y + this.zoom * cp,
      this.target.z + this.zoom * sp * ct
    );
    this.camera.lookAt(this.target);
  }

  _bind() {
    this.canvas.addEventListener('mousedown', e => this._onDown(e));
    window.addEventListener('mousemove', e => this._onMove(e));
    window.addEventListener('mouseup',   e => this._onUp(e));
    this.canvas.addEventListener('wheel', e => this._onWheel(e), { passive: false });
    this.canvas.addEventListener('contextmenu', e => e.preventDefault());
  }

  _onDown(e) {
    if (!this.active) return;
    const modal = document.getElementById('modal-create-mesh');
    if (modal && !modal.classList.contains('hidden')) return;

    this._dragStart.x = e.clientX;
    this._dragStart.y = e.clientY;
    this._dragMoved = false;

    if (e.button === 0)      this._dragging = e.shiftKey ? 'pan' : 'orbit';
    else if (e.button === 1) { this._dragging = 'pan'; e.preventDefault(); }
    else if (e.button === 2) this._dragging = 'pending-remove';
  }

  _onMove(e) {
    if (!this.active || !this._dragging) return;
    const dx = e.clientX - this._dragStart.x;
    const dy = e.clientY - this._dragStart.y;
    if (Math.abs(dx) > 3 || Math.abs(dy) > 3) this._dragMoved = true;

    if (this._dragging === 'orbit') {
      this.theta -= dx * 0.005;
      this.phi = clamp(this.phi - dy * 0.005, 0.15, Math.PI / 2 - 0.05);
      this._dragStart.x = e.clientX;
      this._dragStart.y = e.clientY;
      this.updateCamera();
    } else if (this._dragging === 'pan') {
      const right = new THREE.Vector3( Math.cos(this.theta), 0, -Math.sin(this.theta));
      const fwd   = new THREE.Vector3(-Math.sin(this.theta), 0, -Math.cos(this.theta));
      const panScale = this.zoom * 0.0016;
      this.target.addScaledVector(right, -dx * panScale);
      this.target.addScaledVector(fwd,    dy * panScale);
      const lim = this.arena.half;
      this.target.x = clamp(this.target.x, -lim, lim);
      this.target.z = clamp(this.target.z, -lim, lim);
      this._dragStart.x = e.clientX;
      this._dragStart.y = e.clientY;
      this.updateCamera();
    }
  }

  _onUp(e) {
    if (!this.active) return;
    const wasDrag = this._dragMoved;
    const mode    = this._dragging;
    this._dragging = null;
    if (wasDrag) return;

    if (mode === 'orbit' && e.button === 0) this._tryPlace(e);
    else if (mode === 'pending-remove' && e.button === 2) this._tryRemove(e);
  }

  _onWheel(e) {
    if (!this.active) return;
    const modal = document.getElementById('modal-create-mesh');
    if (modal && !modal.classList.contains('hidden')) return;

    e.preventDefault();
    this.zoom = clamp(this.zoom + e.deltaY * 0.035, 12, 200);
    this.updateCamera();
  }

  _groundPoint(e) {
    const rect = this.canvas.getBoundingClientRect();
    this.mouseNDC.x =  ((e.clientX - rect.left) / rect.width)  * 2 - 1;
    this.mouseNDC.y = -((e.clientY - rect.top)  / rect.height) * 2 + 1;
    this.raycaster.setFromCamera(this.mouseNDC, this.camera);
    const out = new THREE.Vector3();
    const hit = this.raycaster.ray.intersectPlane(this.groundPlane, out);
    return hit ? out : null;
  }

  _tryPlace(e) {
    const p = this._groundPoint(e);
    if (!p) return;

    if (this.placeMode === 'block') {
      // Snap to grid
      const gx = Math.floor(p.x) + 0.5;
      const gz = Math.floor(p.z) + 0.5;

      this.arena.toggleBlock(p.x, p.z);

      // If a block is placed where a ghost exists, remove the ghost
      this.spawns = this.spawns.filter(s =>
        Math.hypot(s.x - gx, s.z - gz) > 0.8
      );
      if (this.playerSpawn && Math.hypot(this.playerSpawn.x - gx, this.playerSpawn.z - gz) < 0.8) {
        this.playerSpawn = null;
      }
      this._rebuildGhosts();
      if (this.onChange) this.onChange();
      return;
    }

    const lim = this.arena.half - 2;
    p.x = clamp(p.x, -lim, lim);
    p.z = clamp(p.z, -lim, lim);

    if (this.arena.pointBlocked(new THREE.Vector3(p.x, 1.5, p.z))) return;

    if (this.placeMode === 'player') {
      this.playerSpawn = { x: p.x, z: p.z };
    } else {
      const len = Math.hypot(p.x, p.z);
      const facing = len > 0.5
        ? { x: -p.x / len, z: -p.z / len }
        : { x: 0, z: -1 };
      this.spawns.push({ x: p.x, z: p.z, armed: this.armedNext, facing });
    }
    this._rebuildGhosts();
    if (this.onChange) this.onChange();
  }

  _tryRemove(e) {
    const rect = this.canvas.getBoundingClientRect();
    this.mouseNDC.x =  ((e.clientX - rect.left) / rect.width)  * 2 - 1;
    this.mouseNDC.y = -((e.clientY - rect.top)  / rect.height) * 2 + 1;
    this.raycaster.setFromCamera(this.mouseNDC, this.camera);

    const targets = this.ghostGroup.children.slice();
    if (this.playerGhost.visible) targets.push(this.playerGhost);

    const hits = this.raycaster.intersectObjects(targets, true);   // recursive — hits pointer/gun children too
    if (!hits.length) return;

    // find topmost ancestor that is in the ghost group (or is the player ghost)
    let obj = hits[0].object;
    if (obj === this.playerGhost || isDescendantOf(obj, this.playerGhost)) {
      this.playerSpawn = null;
    } else {
      // walk up until direct child of ghostGroup
      while (obj.parent && obj.parent !== this.ghostGroup) obj = obj.parent;
      if (obj.parent !== this.ghostGroup) return;
      const idx = obj.userData.spawnIndex;
      if (idx === undefined) return;
      this.spawns.splice(idx, 1);
    }
    this._rebuildGhosts();
    if (this.onChange) this.onChange();
  }

  _rebuildGhosts() {
    while (this.ghostGroup.children.length) {
      this.ghostGroup.remove(this.ghostGroup.children[0]);
    }
    while (this.coneGroup.children.length) {
      const c = this.coneGroup.children[0];
      this.coneGroup.remove(c);
      c.traverse(o => {
        if (o.geometry) o.geometry.dispose();
        if (o.material) o.material.dispose();
      });
    }

    const range = this.enemies ? this.enemies.visionRange : 20;
    const angle = this.enemies ? this.enemies.viewAngle    : Math.PI * 0.5;
    const alertPct = this.enemies ? this.enemies.alertThreshold : 0.6667;

    for (let i = 0; i < this.spawns.length; i++) {
      const s = this.spawns[i];

      const m = new THREE.Mesh(Editor.GHOST_GEO, Editor.GHOST_MAT);
      m.position.set(s.x, 1.4, s.z);
      m.rotation.y = Math.atan2(s.facing.x, s.facing.z);   // face placement direction
      m.userData.spawnIndex = i;
      m.userData.armed      = !!s.armed;

      // facing pointer
      const pointer = new THREE.Mesh(Editor.POINTER_GEO, Editor.POINTER_MAT);
      pointer.rotation.x = Math.PI / 2;
      pointer.position.set(0, 0, 0.9);
      m.add(pointer);

      if (s.armed) {
        const gun = new THREE.Mesh(Editor.GHOST_GUN_GEO, Editor.GHOST_GUN_MAT);
        gun.position.set(0.42, -0.2, 0.55);
        m.add(gun);
      }
      this.ghostGroup.add(m);

      const cone = Editor.buildConeMesh(s.x, s.z, s.facing, range, angle, alertPct, this.arena);
      cone.position.set(s.x, 0.03, s.z);
      cone.rotation.y = Math.atan2(s.facing.x, s.facing.z);
      this.coneGroup.add(cone);
    }

    if (this.playerSpawn) {
      this.playerGhost.position.set(this.playerSpawn.x, 0.85, this.playerSpawn.z);
      this.playerGhost.visible = true;
    } else {
      this.playerGhost.visible = false;
    }
  }

  refreshGhosts() {
    if (!this.active) return;
    this._rebuildGhosts();
  }

  getSpawns()      { return this.spawns.slice(); }
  getPlayerSpawn() { return this.playerSpawn ? { x: this.playerSpawn.x, z: this.playerSpawn.z } : null; }

  clearSpawns() {
    this.spawns.length = 0;
    this.playerSpawn   = null;
    this._rebuildGhosts();
    if (this.onChange) this.onChange();
  }

  update(dt) {
    if (!this.active) return;
    const t = performance.now() * 0.002;
    for (const g of this.ghostGroup.children) {
      g.position.y = 1.4 + Math.sin(t + g.userData.spawnIndex * 1.3) * 0.15;
    }
    if (this.playerGhost.visible) {
      this.playerGhost.rotation.y += dt * 1.2;
      this.playerGhost.position.y = 0.85 + Math.sin(t) * 0.1;
    }
  }
}

function isDescendantOf(node, ancestor) {
  let n = node;
  while (n) { if (n === ancestor) return true; n = n.parent; }
  return false;
}

Editor.buildConeMesh = Editor.buildConeMesh;
