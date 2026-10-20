'use strict';

class MeshModal {
  constructor(game, panels) {
    this.game   = game;
    this.panels = panels;

    this.modal  = document.getElementById('modal-create-mesh');
    this.canvas = document.getElementById('mesh-blueprint-canvas');
    this.ctx    = this.canvas ? this.canvas.getContext('2d') : null;

    this.width       = 40;
    this.length      = 40;
    this.rooms       = 6;
    this.wallHeight  = 3.0;
    this.glowColor   = 0x2fd4ff;
    this.glowHexStr  = '#2fd4ff';
    this.preset      = 'dungeon';
    this.tool        = 'wall'; // 'wall' | 'carve' | 'room'

    this.grid        = [];
    this.isDrawing   = false;
    this.drawVal     = 1;
    this.dragStart   = null;
    this.hoverTile   = null;

    if (this.canvas) {
      this.canvas.width  = 360;
      this.canvas.height = 360;
    }

    this._bindEvents();
  }

  _bindEvents() {
    // Open trigger buttons
    const openBtn = document.getElementById('btn-open-create-mesh');
    if (openBtn) openBtn.addEventListener('click', () => this.open());

    const openAltBtn = document.getElementById('btn-open-create-mesh-alt');
    if (openAltBtn) openAltBtn.addEventListener('click', () => this.open());

    // Close and Cancel buttons
    const closeBtn = document.getElementById('btn-close-mesh-modal');
    if (closeBtn) closeBtn.addEventListener('click', () => this.close());

    const cancelBtn = document.getElementById('btn-mesh-modal-cancel');
    if (cancelBtn) cancelBtn.addEventListener('click', () => this.close());

    // Escape key closes modal
    window.addEventListener('keydown', e => {
      if (e.key === 'Escape' && this.modal && !this.modal.classList.contains('hidden')) {
        this.close();
      }
    });

    // Apply button
    const applyBtn = document.getElementById('btn-mesh-modal-apply');
    if (applyBtn) applyBtn.addEventListener('click', () => this.apply());

    // Preset buttons
    const presetBtns = document.querySelectorAll('.preset-btn');
    presetBtns.forEach(btn => {
      btn.addEventListener('click', () => {
        presetBtns.forEach(b => b.classList.remove('active'));
        btn.classList.add('active');
        this.preset = btn.dataset.preset;
        this.generatePreset();
      });
    });

    // Sliders
    const widthSlider = document.getElementById('modal-mesh-width');
    const widthVal = document.getElementById('modal-mesh-width-val');
    if (widthSlider) {
      widthSlider.addEventListener('input', () => {
        this.width = parseInt(widthSlider.value);
        if (widthVal) widthVal.textContent = this.width;
        this.generatePreset();
      });
    }

    const lengthSlider = document.getElementById('modal-mesh-length');
    const lengthVal = document.getElementById('modal-mesh-length-val');
    if (lengthSlider) {
      lengthSlider.addEventListener('input', () => {
        this.length = parseInt(lengthSlider.value);
        if (lengthVal) lengthVal.textContent = this.length;
        this.generatePreset();
      });
    }

    const roomsSlider = document.getElementById('modal-mesh-rooms');
    const roomsVal = document.getElementById('modal-mesh-rooms-val');
    if (roomsSlider) {
      roomsSlider.addEventListener('input', () => {
        this.rooms = parseInt(roomsSlider.value);
        if (roomsVal) roomsVal.textContent = this.rooms;
        this.generatePreset();
      });
    }

    const heightSlider = document.getElementById('modal-mesh-height');
    const heightVal = document.getElementById('modal-mesh-height-val');
    if (heightSlider) {
      heightSlider.addEventListener('input', () => {
        this.wallHeight = parseFloat(heightSlider.value);
        if (heightVal) heightVal.textContent = this.wallHeight.toFixed(1) + 'm';
      });
    }

    // Glow Swatches
    const swatches = document.querySelectorAll('.glow-swatch');
    swatches.forEach(swatch => {
      swatch.addEventListener('click', () => {
        swatches.forEach(s => s.classList.remove('active'));
        swatch.classList.add('active');
        this.glowColor = parseInt(swatch.dataset.color, 16);
        this.glowHexStr = '#' + this.glowColor.toString(16).padStart(6, '0');
        this.renderCanvas();
      });
    });

    // Brush Tools
    const toolBtns = [
      { id: 'brush-wall',  tool: 'wall' },
      { id: 'brush-carve', tool: 'carve' },
      { id: 'brush-room',  tool: 'room' }
    ];
    toolBtns.forEach(tb => {
      const el = document.getElementById(tb.id);
      if (el) {
        el.addEventListener('click', () => {
          toolBtns.forEach(t => {
            const b = document.getElementById(t.id);
            if (b) b.classList.remove('active');
          });
          el.classList.add('active');
          this.tool = tb.tool;
        });
      }
    });

    // Re-roll button
    const rerollBtn = document.getElementById('btn-modal-reroll');
    if (rerollBtn) rerollBtn.addEventListener('click', () => this.generatePreset());

    // Reset/Clear button
    const clearBtn = document.getElementById('btn-modal-clear');
    if (clearBtn) clearBtn.addEventListener('click', () => {
      this.grid = Arena.createGrid('blank', this.width, this.length);
      this.renderCanvas();
    });

    // Canvas Mouse Events
    if (this.canvas) {
      this.canvas.addEventListener('mousedown', e => this._onCanvasDown(e));
      this.canvas.addEventListener('mousemove', e => this._onCanvasMove(e));
      window.addEventListener('mouseup', () => this._onCanvasUp());
      this.canvas.addEventListener('mouseleave', () => {
        this.hoverTile = null;
        if (!this.isDrawing) this.renderCanvas();
      });
      this.canvas.addEventListener('contextmenu', e => {
        e.preventDefault();
        const pt = this._canvasToGrid(e);
        if (pt && !this._isBorder(pt.x, pt.z)) {
          this.grid[pt.x][pt.z] = 0;
          this.renderCanvas();
        }
      });
    }
  }

  _isGridAllEmpty(grid) {
    if (!grid || !grid.length) return true;
    for (let x = 1; x < grid.length - 1; x++) {
      if (!grid[x]) continue;
      for (let z = 1; z < grid[x].length - 1; z++) {
        if (grid[x][z] === 1) return false;
      }
    }
    return true;
  }

  open() {
    if (!this.modal) this.modal = document.getElementById('modal-create-mesh');
    if (!this.canvas) {
      this.canvas = document.getElementById('mesh-blueprint-canvas');
      this.ctx    = this.canvas ? this.canvas.getContext('2d') : null;
      if (this.canvas) {
        this.canvas.width = 360;
        this.canvas.height = 360;
      }
    }
    if (!this.modal) return;
    this.modal.classList.remove('hidden');

    // If grid already exists and has custom layout, load it; otherwise generate active preset
    const currentArenaGrid = this.game && this.game.arena ? this.game.arena.grid : null;
    if (currentArenaGrid && !this._isGridAllEmpty(currentArenaGrid)) {
      this.width      = this.game.arena.gridWidth || 40;
      this.length     = this.game.arena.gridLength || 40;
      this.wallHeight = this.game.arena.wallHeight || 3.0;
      this.glowColor  = this.game.arena.glowColor !== undefined ? this.game.arena.glowColor : 0x2fd4ff;
      this.glowHexStr = '#' + this.glowColor.toString(16).padStart(6, '0');
      this.grid       = currentArenaGrid.map(row => row.slice());
    } else {
      this.generatePreset();
    }

    // Sync UI elements
    const widthSlider = document.getElementById('modal-mesh-width');
    const widthVal = document.getElementById('modal-mesh-width-val');
    if (widthSlider) widthSlider.value = this.width;
    if (widthVal) widthVal.textContent = this.width;

    const lengthSlider = document.getElementById('modal-mesh-length');
    const lengthVal = document.getElementById('modal-mesh-length-val');
    if (lengthSlider) lengthSlider.value = this.length;
    if (lengthVal) lengthVal.textContent = this.length;

    const heightSlider = document.getElementById('modal-mesh-height');
    const heightVal = document.getElementById('modal-mesh-height-val');
    if (heightSlider) heightSlider.value = this.wallHeight;
    if (heightVal) heightVal.textContent = this.wallHeight.toFixed(1) + 'm';

    this.renderCanvas();
  }

  close() {
    if (this.modal) this.modal.classList.add('hidden');
    this.isDrawing = false;
    this.dragStart = null;
    this.hoverTile = null;
  }

  generatePreset() {
    this.grid = Arena.createGrid(this.preset, this.width, this.length, {
      roomCount: this.rooms
    });
    this.renderCanvas();
  }

  _canvasToGrid(e) {
    if (!this.canvas) return null;
    const rect = this.canvas.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;
    if (x < 0 || x >= rect.width || y < 0 || y >= rect.height) return null;

    const gx = Math.floor((x / rect.width) * this.width);
    const gz = Math.floor((y / rect.height) * this.length);

    if (gx >= 0 && gx < this.width && gz >= 0 && gz < this.length) {
      return { x: gx, z: gz };
    }
    return null;
  }

  _isBorder(x, z) {
    return x === 0 || x === this.width - 1 || z === 0 || z === this.length - 1;
  }

  _onCanvasDown(e) {
    if (e.button !== 0) return;
    const pt = this._canvasToGrid(e);
    if (!pt) return;

    this.isDrawing = true;

    if (this.tool === 'room') {
      this.dragStart = { x: pt.x, z: pt.z };
    } else if (this.tool === 'wall') {
      // Toggle block on click, or paint solid
      this.drawVal = (this.grid[pt.x][pt.z] === 1 && !this._isBorder(pt.x, pt.z)) ? 0 : 1;
      this.grid[pt.x][pt.z] = this.drawVal;
      this.renderCanvas();
    } else if (this.tool === 'carve') {
      this.drawVal = 0;
      if (!this._isBorder(pt.x, pt.z)) {
        this.grid[pt.x][pt.z] = 0;
        this.renderCanvas();
      }
    }
  }

  _onCanvasMove(e) {
    const pt = this._canvasToGrid(e);
    this.hoverTile = pt;

    if (this.isDrawing && pt) {
      if (this.tool === 'wall' || this.tool === 'carve') {
        if (!this._isBorder(pt.x, pt.z)) {
          this.grid[pt.x][pt.z] = this.drawVal;
        } else if (this.drawVal === 1) {
          this.grid[pt.x][pt.z] = 1;
        }
      }
    }

    this.renderCanvas();
  }

  _onCanvasUp() {
    if (!this.isDrawing) return;

    if (this.tool === 'room' && this.dragStart && this.hoverTile) {
      const x0 = Math.min(this.dragStart.x, this.hoverTile.x);
      const x1 = Math.max(this.dragStart.x, this.hoverTile.x);
      const z0 = Math.min(this.dragStart.z, this.hoverTile.z);
      const z1 = Math.max(this.dragStart.z, this.hoverTile.z);

      for (let x = x0; x <= x1; x++) {
        for (let z = z0; z <= z1; z++) {
          if (!this._isBorder(x, z)) {
            this.grid[x][z] = 0;
          }
        }
      }
      this.dragStart = null;
    }

    this.isDrawing = false;
    this.renderCanvas();
  }

  renderCanvas() {
    if (!this.ctx || !this.canvas || !this.grid || !this.grid.length) return;

    const ctx = this.ctx;
    const cw  = this.canvas.width;
    const ch  = this.canvas.height;
    const w   = this.width;
    const h   = this.length;
    const cellW = cw / w;
    const cellH = ch / h;

    // Clear background
    ctx.fillStyle = '#030713';
    ctx.fillRect(0, 0, cw, ch);

    let solidCount = 0;

    // Render floor and walls
    for (let x = 0; x < w; x++) {
      for (let z = 0; z < h; z++) {
        const isWall = this.grid[x] && this.grid[x][z] === 1;
        const px = x * cellW;
        const pz = z * cellH;

        if (isWall) {
          solidCount++;
          // Metallic body
          ctx.fillStyle = '#111b2e';
          ctx.fillRect(px, pz, cellW, cellH);

          // Subtle inner shading
          ctx.fillStyle = 'rgba(255, 255, 255, 0.05)';
          ctx.fillRect(px, pz, cellW, 1.2);

          // Glowing edge where facing floor
          ctx.strokeStyle = this.glowHexStr;
          ctx.lineWidth = 1.2;
          ctx.beginPath();
          if (z + 1 < h && this.grid[x] && this.grid[x][z + 1] === 0) {
            ctx.moveTo(px, pz + cellH); ctx.lineTo(px + cellW, pz + cellH);
          }
          if (z - 1 >= 0 && this.grid[x] && this.grid[x][z - 1] === 0) {
            ctx.moveTo(px, pz); ctx.lineTo(px + cellW, pz);
          }
          if (x + 1 < w && this.grid[x + 1] && this.grid[x + 1][z] === 0) {
            ctx.moveTo(px + cellW, pz); ctx.lineTo(px + cellW, pz + cellH);
          }
          if (x - 1 >= 0 && this.grid[x - 1] && this.grid[x - 1][z] === 0) {
            ctx.moveTo(px, pz); ctx.lineTo(px, pz + cellH);
          }
          ctx.stroke();
        } else {
          // Dark floor
          ctx.fillStyle = '#060d1f';
          ctx.fillRect(px, pz, cellW, cellH);

          // Floor grid dot
          ctx.fillStyle = 'rgba(99, 232, 255, 0.08)';
          ctx.fillRect(px + cellW * 0.5 - 0.5, pz + cellH * 0.5 - 0.5, 1, 1);
        }
      }
    }

    // Grid wireframe
    ctx.strokeStyle = 'rgba(99, 232, 255, 0.04)';
    ctx.lineWidth = 0.5;
    for (let x = 0; x <= w; x += 5) {
      ctx.beginPath();
      ctx.moveTo(x * cellW, 0);
      ctx.lineTo(x * cellW, ch);
      ctx.stroke();
    }
    for (let z = 0; z <= h; z += 5) {
      ctx.beginPath();
      ctx.moveTo(0, z * cellH);
      ctx.lineTo(cw, z * cellH);
      ctx.stroke();
    }

    // Room Drag Preview
    if (this.dragStart && this.hoverTile && this.tool === 'room') {
      const x0 = Math.min(this.dragStart.x, this.hoverTile.x);
      const x1 = Math.max(this.dragStart.x, this.hoverTile.x);
      const z0 = Math.min(this.dragStart.z, this.hoverTile.z);
      const z1 = Math.max(this.dragStart.z, this.hoverTile.z);

      const rx = x0 * cellW;
      const rz = z0 * cellH;
      const rw = (x1 - x0 + 1) * cellW;
      const rh = (z1 - z0 + 1) * cellH;

      ctx.fillStyle = 'rgba(0, 240, 255, 0.15)';
      ctx.fillRect(rx, rz, rw, rh);
      ctx.strokeStyle = '#00f0ff';
      ctx.lineWidth = 1.5;
      ctx.setLineDash([4, 3]);
      ctx.strokeRect(rx, rz, rw, rh);
      ctx.setLineDash([]);
    }

    // Hover Highlight
    if (this.hoverTile) {
      const hx = this.hoverTile.x * cellW;
      const hz = this.hoverTile.z * cellH;
      ctx.strokeStyle = '#ffffff';
      ctx.lineWidth = 1.5;
      ctx.strokeRect(hx, hz, cellW, cellH);
    }

    // Render Doorways / Entrances on Perimeter
    // 1. South Main Entrance (z = h - 1)
    const southDoorX = [];
    for (let x = 0; x < w; x++) {
      if (this.grid[x] && this.grid[x][h - 1] === 0) {
        southDoorX.push(x);
      }
    }
    if (southDoorX.length > 0) {
      const minX = Math.min(...southDoorX) * cellW;
      const maxX = (Math.max(...southDoorX) + 1) * cellW;
      const doorW = maxX - minX;

      // Glowing emerald entrance threshold bar
      ctx.fillStyle = 'rgba(0, 255, 170, 0.85)';
      ctx.shadowColor = '#00ffaa';
      ctx.shadowBlur = 8;
      ctx.fillRect(minX, (h - 1) * cellH, doorW, cellH);
      ctx.shadowBlur = 0;

      // Entrance badge and arrow
      ctx.fillStyle = '#00ffaa';
      ctx.font = 'bold 9px monospace';
      ctx.textAlign = 'center';
      const labelY = Math.max(12, (h - 1) * cellH - 4);
      ctx.fillText('▲ ENTRANCE', minX + doorW / 2, labelY);
    }

    // 2. North Service Gate (z = 0)
    const northDoorX = [];
    for (let x = 0; x < w; x++) {
      if (this.grid[x] && this.grid[x][0] === 0) {
        northDoorX.push(x);
      }
    }
    if (northDoorX.length > 0) {
      const minX = Math.min(...northDoorX) * cellW;
      const maxX = (Math.max(...northDoorX) + 1) * cellW;
      const doorW = maxX - minX;

      ctx.fillStyle = 'rgba(47, 212, 255, 0.75)';
      ctx.shadowColor = '#2fd4ff';
      ctx.shadowBlur = 6;
      ctx.fillRect(minX, 0, doorW, cellH);
      ctx.shadowBlur = 0;

      ctx.fillStyle = '#2fd4ff';
      ctx.font = 'bold 8px monospace';
      ctx.textAlign = 'center';
      ctx.fillText('▼ REAR GATE', minX + doorW / 2, cellH + 10);
    }

    // Update Statistics
    const dimTag    = document.getElementById('canvas-dim-tag');
    const blocksTag = document.getElementById('canvas-blocks-tag');
    const floorTag  = document.getElementById('canvas-floor-tag');
    const gateTag   = document.getElementById('canvas-gate-tag');

    const totalCells = w * h;
    const floorCells = totalCells - solidCount;
    const floorPct   = Math.round((floorCells / totalCells) * 100);

    if (dimTag)    dimTag.textContent    = `${w} × ${h}`;
    if (blocksTag) blocksTag.textContent = solidCount;
    if (floorTag)  floorTag.textContent  = `${floorPct}%`;
    if (gateTag) {
      const hasSouth = southDoorX.length > 0;
      gateTag.textContent = hasSouth ? 'SOUTH GATE' : 'SEALED';
      gateTag.style.color = hasSouth ? '#00ffaa' : '#ff4466';
    }
  }

  apply() {
    if (!this.game || !this.game.arena) return;

    // Apply grid to arena
    this.game.arena.setGrid(this.grid, this.width, this.length, this.wallHeight, this.glowColor);

    // Update world grid helper
    if (this.game.world && this.game.world.grid) {
      this.game.world.grid.geometry.dispose();
      this.game.scene.remove(this.game.world.grid);
    }
    const maxDim = Math.max(this.width, this.length);
    this.game.world.grid = new THREE.GridHelper(maxDim, maxDim, 0x1f3a5f, 0x122338);
    this.game.world.grid.position.y = 0.012;
    this.game.world.grid.material.transparent = true;
    this.game.world.grid.material.opacity = 0.5;
    this.game.scene.add(this.game.world.grid);

    // Filter out enemy spawns that are now inside walls or out of bounds
    if (this.game.editor) {
      const limX = (this.width / 2) - 1.2;
      const limZ = (this.length / 2) - 1.2;

      this.game.editor.spawns = this.game.editor.spawns.filter(s => {
        if (Math.abs(s.x) > limX || Math.abs(s.z) > limZ) return false;
        return !this.game.arena.pointBlocked(new THREE.Vector3(s.x, 1.0, s.z));
      });

      // Check player spawn
      if (this.game.editor.playerSpawn) {
        const ps = this.game.editor.playerSpawn;
        if (Math.abs(ps.x) > limX || Math.abs(ps.z) > limZ ||
            this.game.arena.pointBlocked(new THREE.Vector3(ps.x, 1.0, ps.z))) {
          this.game.editor.playerSpawn = null;
        }
      }

      this.game.editor._rebuildGhosts();

      // Clamp editor camera target to within the new arena boundaries
      this.game.editor.target.x = clamp(this.game.editor.target.x, -this.game.arena.half, this.game.arena.half);
      this.game.editor.target.z = clamp(this.game.editor.target.z, -this.game.arena.half, this.game.arena.half);
      this.game.editor.updateCamera();
    }

    // Refresh telemetry and edit panel size input
    const sizeInput = document.getElementById('input-map-size');
    if (sizeInput) sizeInput.value = maxDim;

    if (this.panels) {
      this.panels._refreshCount();
    }

    this.close();
  }
}
