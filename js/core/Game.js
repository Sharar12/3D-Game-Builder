'use strict';

class Game {
  constructor() {
    this.canvas = document.getElementById('scene');

    this.renderer = new THREE.WebGLRenderer({
      canvas: this.canvas,
      antialias: true,
      powerPreference: 'high-performance',
      preserveDrawingBuffer: true
    });
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    this.renderer.setSize(window.innerWidth, window.innerHeight);
    this.renderer.shadowMap.enabled = true;
    this.renderer.shadowMap.type    = THREE.PCFSoftShadowMap;
    this.renderer.outputEncoding    = THREE.sRGBEncoding;
    this.renderer.toneMapping       = THREE.ACESFilmicToneMapping;
    this.renderer.toneMappingExposure = 1.15;

    this.scene  = new THREE.Scene();
    this.camera = new THREE.PerspectiveCamera(
      72, window.innerWidth / window.innerHeight, 0.1, 300
    );

    this.world       = new World(this.scene);
    this.arena       = new Arena(this.scene, 32);
    this.effects     = new Effects(this.scene);
    this.player      = new Player(this.scene, this.camera);
    this.enemies     = new Enemies(this.scene, this.camera, this.effects, this.arena);
    this.projectiles = new Projectiles(this.scene);
    this.hud         = new HUD();
    this.input       = new Input(this.canvas, locked => this._onLockChange(locked));
    this.editor      = new Editor(this.scene, this.camera, this.arena, this.canvas, this.enemies);
    this.panels      = new Panels(this);

    this.mode     = 'edit';   // 'edit' | 'play' | 'gameover'
    this.paused   = false;
    this.score    = 0;
    this.waveActive = false;

    window.addEventListener('resize', () => this._resize());

    this.hud.btn.addEventListener('click',     () => this._onOverlayPrimary());
    this.hud.btnEdit.addEventListener('click', () => this.switchToEdit());

    this.canvas.addEventListener('mousedown', () => {
      if (this.mode === 'play' && !this.paused && !this.input.locked) {
        this.input.requestLock();
      }
    });

    this.loop = new Loop(dt => this.update(dt), () => this.render());
    this.loop.start();

    this._resize();
    this.hud.setHealth(this.player.health, this.player.maxHealth);
    this.hud.setScore(0);
    this.hud.setEnemiesLeft(0);

    this.switchToEdit();
  }

  // ==================================================================
  _resize() {
    const w = window.innerWidth, h = window.innerHeight;
    this.camera.aspect = w / h;
    this.camera.updateProjectionMatrix();
    this.renderer.setSize(w, h);
  }

  _onLockChange(locked) {
    if (!locked && this.mode === 'play' && !this.paused) {
      this.paused = true;
      this.hud.showOverlay('PAUSED', 'Resume or return to editor', 'RESUME', true);
    }
  }

  _onOverlayPrimary() {
    if (this.mode === 'gameover') {
      this.switchToEdit();
    } else if (this.mode === 'play' && this.paused) {
      this.paused = false;
      this.hud.hideOverlay();
      this.input.requestLock();
    }
  }

  // ==================================================================
  switchToEdit() {
    this.mode      = 'edit';
    this.paused    = false;
    this.waveActive = false;

    this.input.releaseLock();
    this.input.consumeMouse();
    this.enemies.clear();
    this.projectiles.clear();
    this.player.mesh.visible = false;

    this.editor.enter();
    this.editor.syncCamera();

    this.hud.hideOverlay();
    this.panels.showEdit();
  }

  switchToPlay() {
    let spawns = this.editor.getSpawns();
    if (spawns.length === 0) {
      // Default wave if user hasn't placed any enemies yet
      spawns = [
        { x: 0, z: -14, armed: false },
        { x: -8, z: -18, armed: false },
        { x: 8, z: -18, armed: true },
        { x: -14, z: -10, armed: true },
        { x: 14, z: -10, armed: false }
      ];
    }

    const pSpawn = this.editor.getPlayerSpawn();
    if (pSpawn) {
      this.player.spawnPoint.set(pSpawn.x, 0, pSpawn.z);
    } else if (this.arena && this.arena.mainEntrance) {
      this.player.spawnPoint.set(this.arena.mainEntrance.x, 0, this.arena.mainEntrance.z);
    } else {
      this.player.spawnPoint.set(0, 0, 6);
    }

    this.score = 0;
    this.player.reset();
    this.player.mesh.visible = true;
    this.projectiles.clear();
    this.enemies.spawnAll(spawns);

    this.waveActive = true;
    this.editor.exit();

    this.hud.setScore(0);
    this.hud.setEnemiesLeft(this.enemies.count);
    this.hud.setHealth(this.player.health, this.player.maxHealth);
    this.hud.hideOverlay();

    this.mode   = 'play';
    this.paused = false;
    this.panels.showPlay();
    this.input.requestLock();
  }

  gameOver(title, sub) {
    this.mode       = 'gameover';
    this.waveActive = false;
    this.input.releaseLock();
    this.hud.showOverlay(title, sub, 'BACK TO EDIT', false);
  }

  // ==================================================================
  update(dt) {
    this.hud.update(dt);

    if (this.mode === 'edit') {
      this.editor.update(dt);
      this.effects.update(dt);
      return;
    }

    if (this.mode === 'gameover') {
      this.input.consumeMouse();
      this.player.updateCamera(dt);
      this.effects.update(dt);
      return;
    }

    if (this.paused) {
      this.input.consumeMouse();
      this.effects.update(dt);
      return;
    }

    // ---- play mode ----
    const mouse = this.input.consumeMouse();
    const hpBefore = this.player.health;

    this.player.update(dt, this.input, mouse, this.arena, this.projectiles, this.effects);
    this.enemies.update(dt, this.player);

    this.projectiles.update(dt, this.arena, this.enemies, () => {
      this.score += 10;
      this.hud.setScore(this.score);
    });

    this.effects.update(dt);
    this.hud.setEnemiesLeft(this.enemies.count);

    if (this.player.health < hpBefore) this.hud.flashDamage();
    this.hud.setHealth(this.player.health, this.player.maxHealth);

    if (this.player.health <= 0) {
      this.effects.burst(
        new THREE.Vector3(this.player.pos.x, this.player.pos.y + 1, this.player.pos.z),
        0x63e8ff, 30, 9
      );
      this.player.mesh.visible = false;
      this.gameOver('GAME OVER', 'Score: ' + this.score + ' · Enemies left: ' + this.enemies.count);
      return;
    }

    if (this.waveActive && this.enemies.count === 0) {
      this.gameOver('CLEARED', 'Score: ' + this.score + ' · All enemies destroyed');
      return;
    }
  }

  render() {
    this.renderer.render(this.scene, this.camera);
  }
}
