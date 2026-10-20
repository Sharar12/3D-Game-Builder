'use strict';

class Arena {
  constructor(scene, half) {
    this.scene     = scene;
    this.colliders = [];
    this.group     = new THREE.Group();
    scene.add(this.group);

    // Map Grid dimensions: default 64x64 (32 half-width)
    this.half       = half || 32;
    this.gridWidth  = this.half * 2;
    this.gridLength = this.half * 2;
    this.grid       = Array.from({ length: this.gridWidth }, () => new Array(this.gridLength).fill(0));

    this.wallHeight = 3;
    this.glowColor  = 0x2fd4ff;

    // Border walls
    for (let x = 0; x < this.gridWidth; x++) {
      this.grid[x][0] = 1; this.grid[x][this.gridLength - 1] = 1;
    }
    for (let z = 0; z < this.gridLength; z++) {
      this.grid[0][z] = 1; this.grid[this.gridWidth - 1][z] = 1;
    }

    // Punch main entrance
    const cx = Math.floor(this.gridWidth / 2);
    this.grid[cx - 1][this.gridLength - 1] = 0;
    this.grid[cx][this.gridLength - 1]     = 0;
    this.grid[cx + 1][this.gridLength - 1] = 0;

    this._buildMesh();
  }

  _buildMesh() {
    while (this.group.children.length > 0) {
      const c = this.group.children[0];
      this.group.remove(c);
      if (c.geometry) c.geometry.dispose();
      if (c.material) c.material.dispose();
    }
    this.colliders = [];

    const wallH   = this.wallHeight || 3;
    const bodyMat = new THREE.MeshStandardMaterial({ color: 0x141c30, roughness: 0.65, metalness: 0.45 });
    const glowMat = new THREE.MeshBasicMaterial({ color: this.glowColor !== undefined ? this.glowColor : 0x2fd4ff });

    const halfX = this.gridWidth / 2;
    const halfZ = this.gridLength / 2;

    for (let x = 0; x < this.gridWidth; x++) {
      if (!this.grid[x]) continue;
      for (let z = 0; z < this.gridLength; z++) {
        if (this.grid[x][z] === 0) continue;

        const w = 1, d = 1, h = wallH;
        const px = x - halfX + 0.5;
        const pz = z - halfZ + 0.5;

        const mesh = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), bodyMat);
        mesh.position.set(px, h / 2, pz);
        mesh.castShadow = true;
        mesh.receiveShadow = true;
        this.group.add(mesh);

        const strip = new THREE.Mesh(new THREE.BoxGeometry(w * 1.05, 0.05, d * 1.05), glowMat);
        strip.position.set(px, h - 0.025, pz);
        this.group.add(strip);

        this.colliders.push({
          min: new THREE.Vector3(px - 0.5, 0, pz - 0.5),
          max: new THREE.Vector3(px + 0.5, h, pz + 0.5)
        });
      }
    }

    // Dynamic detection of South Main Entrance
    const southOpenings = [];
    for (let x = 1; x < this.gridWidth - 1; x++) {
      if (this.grid[x] && this.grid[x][this.gridLength - 1] === 0) {
        southOpenings.push(x);
      }
    }

    let mainDoorX = Math.floor(this.gridWidth / 2);
    if (southOpenings.length > 0) {
      // Find the cluster closest to center
      southOpenings.sort((a, b) => Math.abs(a - mainDoorX) - Math.abs(b - mainDoorX));
      mainDoorX = southOpenings[0];
    }

    const enterPx = mainDoorX - halfX + 0.5;
    const enterPz = (this.gridLength - 2) - halfZ + 0.5;
    this.mainEntrance = { x: enterPx, z: enterPz };

    if (southOpenings.length > 0) {
      // Emerald glowing entrance threshold
      const threshMat  = new THREE.MeshBasicMaterial({ color: 0x00ffaa, transparent: true, opacity: 0.85 });
      const threshMesh = new THREE.Mesh(new THREE.BoxGeometry(3.0, 0.05, 1.4), threshMat);
      threshMesh.position.set(enterPx, 0.025, (this.gridLength - 1) - halfZ + 0.5);
      this.group.add(threshMesh);
    }

    // Secondary North Service Gate detection
    if (this.grid[mainDoorX] && this.grid[mainDoorX][0] === 0) {
      const northMat  = new THREE.MeshBasicMaterial({ color: 0x2fd4ff, transparent: true, opacity: 0.65 });
      const northMesh = new THREE.Mesh(new THREE.BoxGeometry(2.0, 0.04, 1.2), northMat);
      northMesh.position.set(enterPx, 0.02, 0 - halfZ + 0.5);
      this.group.add(northMesh);
    }
  }

  setGrid(newGrid, w, h, wallHeight, glowColor) {
    this.gridWidth  = w;
    this.gridLength = h;
    this.half       = Math.max(w, h) / 2;
    this.grid       = newGrid;
    if (wallHeight !== undefined) this.wallHeight = wallHeight;
    if (glowColor !== undefined)  this.glowColor  = glowColor;
    this._buildMesh();
  }

  resize(w, h) {
    h = h || w;
    this.half = Math.max(w, h) / 2; // used for camera panning limits
    this.gridWidth = w;
    this.gridLength = h;
    this.grid = Array.from({ length: this.gridWidth }, () => new Array(this.gridLength).fill(0));

    for (let x = 0; x < this.gridWidth; x++) {
      this.grid[x][0] = 1; this.grid[x][this.gridLength - 1] = 1;
    }
    for (let z = 0; z < this.gridLength; z++) {
      this.grid[0][z] = 1; this.grid[this.gridWidth - 1][z] = 1;
    }
    // Punch main entrance
    const cx = Math.floor(this.gridWidth / 2);
    this.grid[cx - 1][this.gridLength - 1] = 0;
    this.grid[cx][this.gridLength - 1]     = 0;
    this.grid[cx + 1][this.gridLength - 1] = 0;

    this._buildMesh();
  }

  generate(w, h, roomCount) {
    this.grid = Arena.createGrid('dungeon', w, h, { roomCount: roomCount || 6 });
    this.gridWidth = w;
    this.gridLength = h;
    this.half = Math.max(w, h) / 2;
    this._buildMesh();
  }

  generatePreset(type, w, h, options) {
    this.grid = Arena.createGrid(type, w, h, options);
    this.gridWidth = w;
    this.gridLength = h;
    this.half = Math.max(w, h) / 2;
    this._buildMesh();
  }

  static createGrid(type, w, h, options) {
    w = Math.max(14, w || 40);
    h = Math.max(14, h || 40);
    options = options || {};

    const grid = Array.from({ length: w }, () => new Array(h).fill(0));

    // Fill perimeter walls
    for (let x = 0; x < w; x++) { grid[x][0] = 1; grid[x][h - 1] = 1; }
    for (let z = 0; z < h; z++) { grid[0][z] = 1; grid[w - 1][z] = 1; }

    const mainDoorX = Math.floor(w / 2);

    if (type === 'blank') {
      // 3-block wide main entrance
      grid[mainDoorX - 1][h - 1] = 0;
      grid[mainDoorX][h - 1]     = 0;
      grid[mainDoorX + 1][h - 1] = 0;
      return grid;
    }

    if (type === 'warehouse') {
      // 4-block wide main loading dock entrance
      for (let dx = -2; dx <= 1; dx++) {
        grid[mainDoorX + dx][h - 1] = 0;
        for (let dz = 1; dz <= 3; dz++) grid[mainDoorX + dx][h - 1 - dz] = 0;
      }

      // Warehouse: wide central cross aisles with double-crate rows
      const spacing = 6;
      for (let x = 4; x < w - 5; x += spacing) {
        for (let z = 4; z < h - 5; z++) {
          if (z % 5 !== 0 && (z + 1) % 5 !== 0) {
            grid[x][z] = 1;
            if (x + 1 < w - 4 && z % 2 === 0) grid[x + 1][z] = 1;
          }
        }
      }
      return grid;
    }

    if (type === 'arena') {
      // 4 Grand Compass Gates on perimeter (North, South, East, West)
      const cx = Math.floor(w / 2), cz = Math.floor(h / 2);
      for (let d = -1; d <= 1; d++) {
        grid[cx + d][0] = 0;     grid[cx + d][h - 1] = 0;
        grid[0][cz + d] = 0;     grid[w - 1][cz + d] = 0;
      }
      const offset = Math.max(3, Math.floor(Math.min(w, h) * 0.16));
      for (let dx of [-offset, offset]) {
        for (let dz of [-offset, offset]) {
          grid[cx + dx][cz + dz] = 1;
          if (cx + dx + 1 < w - 1) grid[cx + dx + 1][cz + dz] = 1;
        }
      }
      // 4 Corner pillboxes
      const corners = [
        { x: 3, z: 3, dx: 1, dz: 1 },
        { x: w - 7, z: 3, dx: -1, dz: 1 },
        { x: 3, z: h - 7, dx: 1, dz: -1 },
        { x: w - 7, z: h - 7, dx: -1, dz: -1 }
      ];
      for (let c of corners) {
        for (let ix = 0; ix < 4; ix++) {
          for (let iz = 0; iz < 4; iz++) {
            if (ix === 0 || ix === 3 || iz === 0 || iz === 3) {
              if (ix >= 1 && ix <= 2 && iz === (c.dz > 0 ? 3 : 0)) continue;
              grid[c.x + ix][c.z + iz] = 1;
            }
          }
        }
      }
      return grid;
    }

    if (type === 'facility') {
      const cx = Math.floor(w / 2), cz = Math.floor(h / 2);
      // Main entrance lobby
      grid[mainDoorX - 1][h - 1] = 0;
      grid[mainDoorX][h - 1]     = 0;
      grid[mainDoorX + 1][h - 1] = 0;
      for (let dx = -1; dx <= 1; dx++) {
        for (let dz = 1; dz <= 3; dz++) grid[mainDoorX + dx][h - 1 - dz] = 0;
      }

      const qw = Math.floor((w - 7) / 2);
      const qh = Math.floor((h - 7) / 2);
      const makeWing = (rx, rz, rw, rh) => {
        for (let x = rx; x < rx + rw; x++) {
          for (let z = rz; z < rz + rh; z++) {
            if (x === rx || x === rx + rw - 1 || z === rz || z === rz + rh - 1) {
              const isDoorX = (x === rx + Math.floor(rw / 2) || x === rx + Math.floor(rw / 2) + 1);
              const isDoorZ = (z === rz + Math.floor(rh / 2) || z === rz + Math.floor(rh / 2) + 1);
              if ((isDoorX && (z === rz || z === rz + rh - 1)) || (isDoorZ && (x === rx || x === rx + rw - 1))) {
                grid[x][z] = 0;
              } else {
                grid[x][z] = 1;
              }
            }
          }
        }
        const midX = rx + Math.floor(rw / 2);
        for (let z = rz + 2; z < rz + rh - 2; z++) {
          if (z % 4 !== 0) grid[midX][z] = 1;
        }
      };

      if (qw > 7 && qh > 7) {
        makeWing(2, 2, qw, qh);
        makeWing(w - qw - 2, 2, qw, qh);
        makeWing(2, h - qh - 2, qw, qh);
        makeWing(w - qw - 2, h - qh - 2, qw, qh);
      }
      return grid;
    }

    if (type === 'labyrinth') {
      for (let x = 0; x < w; x++) for (let z = 0; z < h; z++) grid[x][z] = 1;
      grid[mainDoorX - 1][h - 1] = 0; grid[mainDoorX][h - 1] = 0; grid[mainDoorX + 1][h - 1] = 0;
      grid[mainDoorX - 1][0]     = 0; grid[mainDoorX][0]     = 0;
      for (let x = 2; x < w - 2; x += 3) {
        for (let z = 2; z < h - 2; z++) {
          grid[x][z] = 0;
          if (x + 1 < w - 2) grid[x + 1][z] = 0;
        }
      }
      for (let z = 4; z < h - 4; z += 5) {
        for (let x = 2; x < w - 2; x++) {
          grid[x][z] = 0;
          if (z + 1 < h - 4) grid[x][z + 1] = 0;
        }
      }
      for (let x = 0; x < w; x++) {
        grid[x][0]     = (x === mainDoorX - 1 || x === mainDoorX) ? 0 : 1;
        grid[x][h - 1] = (Math.abs(x - mainDoorX) <= 1) ? 0 : 1;
      }
      for (let z = 0; z < h; z++) { grid[0][z] = 1; grid[w - 1][z] = 1; }
      return grid;
    }

    // Default: 'dungeon' (BSP Floorplan Generator with 80% space utilization)
    const minSize = 6;
    const maxSplit = options.roomCount ? Math.max(3, Math.min(options.roomCount, 10)) : 6;
    const rooms = [];

    function split(node, depth) {
      const canSplitV = node.w >= minSize * 2 + 1;
      const canSplitH = node.h >= minSize * 2 + 1;
      if ((!canSplitV && !canSplitH) || depth >= maxSplit) {
        rooms.push(node);
        return;
      }

      let splitV = canSplitV && canSplitH
        ? (node.w > node.h ? true : (node.h > node.w ? false : Math.random() > 0.5))
        : canSplitV;

      if (splitV) {
        const splitX = Math.floor(node.x + minSize + Math.random() * (node.w - minSize * 2 + 1));
        // Draw 1-block dividing wall
        for (let z = node.z; z < node.z + node.h; z++) grid[splitX][z] = 1;
        // Punch 2-block wide doorway
        const doorZ = Math.floor(node.z + 1 + Math.random() * Math.max(1, node.h - 3));
        grid[splitX][doorZ] = 0;
        if (doorZ + 1 < node.z + node.h - 1) grid[splitX][doorZ + 1] = 0;

        split({ x: node.x, z: node.z, w: splitX - node.x, h: node.h }, depth + 1);
        split({ x: splitX + 1, z: node.z, w: node.x + node.w - splitX - 1, h: node.h }, depth + 1);
      } else {
        const splitZ = Math.floor(node.z + minSize + Math.random() * (node.h - minSize * 2 + 1));
        // Draw 1-block dividing wall
        for (let x = node.x; x < node.x + node.w; x++) grid[x][splitZ] = 1;
        // Punch 2-block wide doorway
        const doorX = Math.floor(node.x + 1 + Math.random() * Math.max(1, node.w - 3));
        grid[doorX][splitZ] = 0;
        if (doorX + 1 < node.x + node.w - 1) grid[doorX + 1][splitZ] = 0;

        split({ x: node.x, z: node.z, w: node.w, h: splitZ - node.z }, depth + 1);
        split({ x: node.x, z: splitZ + 1, w: node.w, h: node.z + node.h - splitZ - 1 }, depth + 1);
      }
    }

    split({ x: 1, z: 1, w: w - 2, h: h - 2 }, 0);

    // Place tactical cover pillars inside large rooms
    for (const r of rooms) {
      if (r.w >= 10 && r.h >= 10) {
        const rcx = Math.floor(r.x + r.w / 2);
        const rcz = Math.floor(r.z + r.h / 2);
        grid[rcx][rcz] = 1;
      }
    }

    // 3-block wide GRAND MAIN ENTRANCE on front South wall
    grid[mainDoorX - 1][h - 1] = 0;
    grid[mainDoorX][h - 1]     = 0;
    grid[mainDoorX + 1][h - 1] = 0;

    // Clear entrance foyer inside so entering is unobstructed
    for (let dx = -1; dx <= 1; dx++) {
      for (let dz = 1; dz <= 3; dz++) {
        if (h - 1 - dz > 0) grid[mainDoorX + dx][h - 1 - dz] = 0;
      }
    }

    // Rear courtyard exit on North wall
    grid[mainDoorX - 1][0] = 0;
    grid[mainDoorX][0]     = 0;

    return grid;
  }

  toggleBlock(x, z) {
    // Convert world coords to grid indices
    const halfX = this.gridWidth / 2;
    const halfZ = this.gridLength / 2;
    const gx = Math.floor(x + halfX);
    const gz = Math.floor(z + halfZ);

    if (gx > 0 && gx < this.gridWidth - 1 && gz > 0 && gz < this.gridLength - 1) {
      this.grid[gx][gz] = this.grid[gx][gz] === 0 ? 1 : 0;
      this._buildMesh();
    }
  }

  /** Push a vertical cylinder (pos.x, pos.z, radius) out of every box. */
  resolve(pos, radius) {
    for (const c of this.colliders) {
      if (pos.y > c.max.y + radius) continue;

      const cx = clamp(pos.x, c.min.x, c.max.x);
      const cz = clamp(pos.z, c.min.z, c.max.z);
      const dx = pos.x - cx;
      const dz = pos.z - cz;
      const d2 = dx * dx + dz * dz;

      if (d2 >= radius * radius) continue;

      if (d2 > 1e-8) {
        const d = Math.sqrt(d2);
        const push = radius - d;
        pos.x += (dx / d) * push;
        pos.z += (dz / d) * push;
      } else {
        // centre is inside the box: eject along the shallowest face
        const left  = pos.x - c.min.x;
        const right = c.max.x - pos.x;
        const back  = pos.z - c.min.z;
        const front = c.max.z - pos.z;
        const m = Math.min(left, right, back, front);
        if      (m === left)  pos.x = c.min.x - radius;
        else if (m === right) pos.x = c.max.x + radius;
        else if (m === back)  pos.z = c.min.z - radius;
        else                  pos.z = c.max.z + radius;
      }
    }

    const limX = (this.gridWidth / 2) - 1.4 - radius;
    const limZ = (this.gridLength / 2) - 1.4 - radius;
    pos.x = clamp(pos.x, -limX, limX);
    pos.z = clamp(pos.z, -limZ, limZ);
  }

  /** Point-in-solid test, used by projectiles. */
  pointBlocked(p) {
    for (const c of this.colliders) {
      if (p.x > c.min.x && p.x < c.max.x &&
          p.y > c.min.y && p.y < c.max.y &&
          p.z > c.min.z && p.z < c.max.z) return true;
    }
    return false;
  }
}
