'use strict';

class Panels {
  constructor(game) {
    this.game = game;

    this.editPanel    = document.getElementById('edit-panel');
    this.playPanel    = document.getElementById('play-panel');
    this.enemyCountEl = document.getElementById('enemy-count');

    this.meshModal    = new MeshModal(this.game, this);

    document.getElementById('btn-play')
      .addEventListener('click', () => this.game.switchToPlay());
    document.getElementById('btn-clear')
      .addEventListener('click', () => {
        this.game.editor.clearSpawns();
        this._refreshCount();
      });
    document.getElementById('btn-edit')
      .addEventListener('click', () => this.game.switchToEdit());

    document.getElementById('btn-mode-block')
      .addEventListener('click', () => this._setMode('block'));
    document.getElementById('btn-mode-enemy')
      .addEventListener('click', () => this._setMode('enemy'));
    document.getElementById('btn-mode-player')
      .addEventListener('click', () => this._setMode('player'));

    document.getElementById('btn-apply-size').addEventListener('click', () => {
      const size = parseInt(document.getElementById('input-map-size').value);
      if (size >= 10 && size <= 100) {
        this.game.arena.resize(size, size);
        this.game.editor.clearSpawns();
        if (this.game.world.grid) {
          this.game.world.grid.geometry.dispose();
          this.game.scene.remove(this.game.world.grid);
        }

        this.game.world.grid = new THREE.GridHelper(size, size, 0x1f3a5f, 0x122338);
        this.game.world.grid.position.y = 0.012;
        this.game.world.grid.material.transparent = true;
        this.game.world.grid.material.opacity = 0.5;
        this.game.scene.add(this.game.world.grid);
      }
    });

    document.getElementById('btn-generate').addEventListener('click', () => {
      const w = parseInt(document.getElementById('gen-width').value);
      const h = parseInt(document.getElementById('gen-height').value);
      const r = parseInt(document.getElementById('gen-rooms').value);

      this.game.arena.generate(w, h, r);
      document.getElementById('input-map-size').value = Math.max(w, h);

      this.game.editor.clearSpawns();

      // Update Grid Helper
      if (this.game.world.grid) {
        this.game.world.grid.geometry.dispose();
        this.game.scene.remove(this.game.world.grid);
      }
      const maxDim = Math.max(w, h);
      this.game.world.grid = new THREE.GridHelper(maxDim, maxDim, 0x1f3a5f, 0x122338);
      this.game.world.grid.position.y = 0.012;
      this.game.world.grid.material.transparent = true;
      this.game.world.grid.material.opacity = 0.5;
      this.game.scene.add(this.game.world.grid);
    });

    document.getElementById('btn-save-as').addEventListener('click', () => this._saveMapToStorage());

    this._loadMapList();

    document.getElementById('chk-armed')
      .addEventListener('change', e => {
        this.game.editor.armedNext = e.target.checked;
      });

    // ---- edit-panel sliders ----
    this._wireSlider(
      'slider-view-angle',
      v => {
        this.game.enemies.viewAngle = v * Math.PI / 180;
        if (this.game.editor) this.game.editor.refreshGhosts();
        if (this.game.mode === 'play') this.game.enemies.rebuildCones();
      },
      90, 0,
      v => Math.round(v) + '°'
    );

    this._wireSlider(
      'slider-suspicion-time',
      v => { this.game.enemies.suspicionTime = v; },
      2.0, 1,
      v => v.toFixed(1) + 's'
    );

    // ---- play-panel sliders ----
    this._wireSlider('slider-player-speed',   v => { this.game.player.walkSpeed = v; },            7.2, 2);
    this._wireSlider('slider-enemy-speed',    v => { this.game.enemies.speedMultiplier = v; },     1.0, 2);
    this._wireSlider('slider-enemy-hp',       v => { this.game.enemies.hpMultiplier = v; },        1.0, 2);
    this._wireSlider('slider-fire-rate',      v => { this.game.player.fireCooldown = v; },         0.11, 2);
    this._wireSlider('slider-bullet-damage',  v => { this.game.projectiles.damageMultiplier = v; }, 1.0, 2);
    this._wireSlider('slider-vision-range',   v => {
      this.game.enemies.visionRange = v;
      if (this.game.editor) this.game.editor.refreshGhosts();
      if (this.game.mode === 'play') this.game.enemies.rebuildCones();
    }, 20.0, 1);
    this._wireSlider('slider-enemy-damage',   v => { this.game.enemies.damage = v; },              9,    0);
    this._wireSlider('slider-enemy-fire',     v => { this.game.enemies.fireCooldown = v; },        1.6,  2);

    // ---- new AI sliders ----
    this._wireSlider(
      'slider-alert-threshold',
      v => {
        this.game.enemies.alertThreshold = v / 100;
        if (this.game.editor) this.game.editor.refreshGhosts();
      },
      66.67, 1,
      v => v.toFixed(1) + '%'
    );
    this._wireSlider(
      'slider-alert-duration',
      v => { this.game.enemies.alertDurationPercent = v; },
      33, 0,
      v => v.toFixed(0) + '%'
    );

    document.getElementById('chk-show-cones')
      .addEventListener('change', e => {
        this.game.enemies.setShowCones(e.target.checked);
      });

    this.game.editor.onChange = () => this._refreshCount();

    this._setMode('enemy');
    this.showEdit();
    this._refreshCount();
  }

  _wireSlider(id, setter, defaultValue, decimals, formatter) {
    const el  = document.getElementById(id);
    const out = document.getElementById(id + '-val');
    if (!el) return;
    decimals = decimals === undefined ? 2 : decimals;

    el.value = defaultValue;
    if (out) out.textContent = formatter ? formatter(defaultValue) : Number(defaultValue).toFixed(decimals);

    el.addEventListener('input', () => {
      const v = parseFloat(el.value);
      setter(v);
      if (out) out.textContent = formatter ? formatter(v) : v.toFixed(decimals);
    });
  }

  _setMode(mode) {
    this.game.editor.placeMode = mode;
    const btnBlock = document.getElementById('btn-mode-block');
    if (btnBlock) btnBlock.classList.toggle('active', mode === 'block');
    document.getElementById('btn-mode-enemy').classList.toggle('active',  mode === 'enemy');
    document.getElementById('btn-mode-player').classList.toggle('active', mode === 'player');

    const hint = document.getElementById('panel-hint');
    if (hint) {
      if (mode === 'player') {
        hint.innerHTML = '<span class="kbd">LMB</span> set player spawn &nbsp;·&nbsp; <span class="kbd">RMB</span> reset<br><span class="kbd">DRAG</span> orbit &nbsp;·&nbsp; <span class="kbd">SCROLL</span> zoom';
      } else if (mode === 'block') {
        hint.innerHTML = '<span class="kbd">LMB</span> toggle block (click to remove)<br><span class="kbd">DRAG</span> orbit &nbsp;·&nbsp; <span class="kbd">SCROLL</span> zoom';
      } else {
        hint.innerHTML = '<span class="kbd">LMB</span> place enemy &nbsp;·&nbsp; <span class="kbd">RMB</span> remove<br><span class="kbd">DRAG</span> orbit &nbsp;·&nbsp; <span class="kbd">SCROLL</span> zoom';
      }
    }
  }

  _refreshCount() {
    this.enemyCountEl.textContent = this.game.editor.spawns.length;
    const ps  = this.game.editor.getPlayerSpawn();
    const tag = document.getElementById('player-spawn-tag');
    if (tag) {
      tag.textContent = ps ? 'SET' : 'DEFAULT';
      tag.classList.toggle('set', !!ps);
    }
  }

  showEdit() {
    this.editPanel.classList.remove('hidden');
    this.playPanel.classList.add('hidden');
    document.body.classList.add('edit-mode');
    this._refreshCount();
  }

  showPlay() {
    this.editPanel.classList.add('hidden');
    this.playPanel.classList.remove('hidden');
    document.body.classList.remove('edit-mode');
  }

  _saveMapToStorage() {
    const nameInput = document.getElementById('input-map-name');
    const name = nameInput.value.trim() || 'Unnamed Map';

    // Capture Screenshot (hide UI temporarily for a clean shot)
    const panels = document.querySelectorAll('.panel');
    panels.forEach(p => p.style.display = 'none');
    this.game.render();
    const thumbnail = this.game.renderer.domElement.toDataURL('image/jpeg', 0.3);
    panels.forEach(p => p.style.display = '');

    const mapData = {
      id: Date.now().toString(),
      name: name,
      thumbnail: thumbnail,
      size: this.game.arena.half,
      w: this.game.arena.gridWidth,
      h: this.game.arena.gridLength,
      grid: this.game.arena.grid,
      spawns: this.game.editor.spawns,
      playerSpawn: this.game.editor.playerSpawn
    };

    // Save map data
    localStorage.setItem('voidrunner_map_' + mapData.id, JSON.stringify(mapData));

    // Update manifest
    let manifest = JSON.parse(localStorage.getItem('voidrunner_manifest') || '[]');
    manifest.push({ id: mapData.id, name: mapData.name, thumbnail: mapData.thumbnail });
    localStorage.setItem('voidrunner_manifest', JSON.stringify(manifest));

    nameInput.value = '';
    this._loadMapList();
  }

  _loadMapList() {
    const list = document.getElementById('saved-maps-list');
    if (!list) return;
    list.innerHTML = '';

    const manifest = JSON.parse(localStorage.getItem('voidrunner_manifest') || '[]');
    if (manifest.length === 0) {
      list.innerHTML = '<p class="panel-hint" style="text-align:center;">No saved maps.</p>';
      return;
    }

    manifest.forEach(meta => {
      const el = document.createElement('div');
      el.className = 'map-slot';
      el.innerHTML = `
        <img src="${meta.thumbnail}" class="map-thumb">
        <div class="map-info">
          <div class="map-name">${meta.name}</div>
          <div class="map-btns">
            <button class="btn-load" data-id="${meta.id}">LOAD</button>
            <button class="btn-override" data-id="${meta.id}">OVR</button>
            <button class="btn-del" data-id="${meta.id}">DEL</button>
          </div>
        </div>
      `;

      el.querySelector('.btn-load').addEventListener('click', () => this._loadMap(meta.id));
      el.querySelector('.btn-override').addEventListener('click', () => this._overrideMap(meta.id));
      el.querySelector('.btn-del').addEventListener('click', () => {
        localStorage.removeItem('voidrunner_map_' + meta.id);
        let m = JSON.parse(localStorage.getItem('voidrunner_manifest') || '[]');
        m = m.filter(x => x.id !== meta.id);
        localStorage.setItem('voidrunner_manifest', JSON.stringify(m));
        this._loadMapList();
      });

      list.appendChild(el);
    });
  }

  _loadMap(id) {
    const raw = localStorage.getItem('voidrunner_map_' + id);
    if (!raw) return;
    const data = JSON.parse(raw);

    const w = data.w || (data.size ? data.size * 2 : 64);
    const h = data.h || (data.size ? data.size * 2 : 64);
    this.game.arena.resize(w, h);
    this.game.arena.grid = data.grid;
    this.game.arena._buildMesh();

    // Update Grid Helper
    if (this.game.world.grid) {
      this.game.world.grid.geometry.dispose();
      this.game.scene.remove(this.game.world.grid);
    }
    const maxDim = Math.max(w, h);
    this.game.world.grid = new THREE.GridHelper(maxDim, maxDim, 0x1f3a5f, 0x122338);
    this.game.world.grid.position.y = 0.012;
    this.game.world.grid.material.transparent = true;
    this.game.world.grid.material.opacity = 0.5;
    this.game.scene.add(this.game.world.grid);

    const sizeInput = document.getElementById('input-map-size');
    if (sizeInput) sizeInput.value = maxDim;

    this.game.editor.spawns = data.spawns || [];
    this.game.editor.playerSpawn = data.playerSpawn || null;
    this.game.editor._rebuildGhosts();
    this._refreshCount();
  }

  _overrideMap(id) {
    const existingRaw = localStorage.getItem('voidrunner_map_' + id);
    const existingName = existingRaw ? (JSON.parse(existingRaw).name || 'Unnamed Map') : 'Unnamed Map';

    const mapData = {
      id: id,
      name: existingName,
      size: this.game.arena.half,
      w: this.game.arena.gridWidth,
      h: this.game.arena.gridLength,
      grid: this.game.arena.grid,
      spawns: this.game.editor.spawns,
      playerSpawn: this.game.editor.playerSpawn
    };

    const panels = document.querySelectorAll('.panel');
    panels.forEach(p => p.style.display = 'none');
    this.game.render();
    mapData.thumbnail = this.game.renderer.domElement.toDataURL('image/jpeg', 0.3);
    panels.forEach(p => p.style.display = '');

    localStorage.setItem('voidrunner_map_' + id, JSON.stringify(mapData));

    let manifest = JSON.parse(localStorage.getItem('voidrunner_manifest') || '[]');
    const idx = manifest.findIndex(x => x.id === id);
    if (idx !== -1) manifest[idx].thumbnail = mapData.thumbnail;
    localStorage.setItem('voidrunner_manifest', JSON.stringify(manifest));

    this._loadMapList();
  }
}
