'use strict';

class World {
  constructor(scene) {
    this.scene = scene;

    scene.background = new THREE.Color(0x0a1020);
    scene.fog = null;

    // ---- lighting -------------------------------------------------
    scene.add(new THREE.HemisphereLight(0x8bc0ff, 0x141c30, 1.2));

    const key = new THREE.DirectionalLight(0xd5ecff, 2.0);
    key.position.set(25, 45, 20);
    key.castShadow = true;
    key.shadow.mapSize.set(2048, 2048);
    key.shadow.camera.near = 1;
    key.shadow.camera.far  = 160;
    key.shadow.camera.left = key.shadow.camera.bottom = -50;
    key.shadow.camera.right = key.shadow.camera.top   =  50;
    key.shadow.bias = -0.0006;
    scene.add(key);
    this.keyLight = key;

    const rim = new THREE.DirectionalLight(0xff4a6e, 0.7);
    rim.position.set(-24, 15, -20);
    scene.add(rim);

    // ---- ground ---------------------------------------------------
    const ground = new THREE.Mesh(
      new THREE.PlaneGeometry(220, 220),
      new THREE.MeshStandardMaterial({ color: 0x0f162c, roughness: 0.85, metalness: 0.15 })
    );
    ground.rotation.x = -Math.PI / 2;
    ground.receiveShadow = true;
    scene.add(ground);

    const grid = new THREE.GridHelper(220, 110, 0x3668a0, 0x1d3656);
    grid.position.y = 0.015;
    grid.material.transparent = true;
    grid.material.opacity = 0.75;
    scene.add(grid);
    this.grid = grid;
  }
}
