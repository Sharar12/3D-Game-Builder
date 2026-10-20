# 🎮 3D Game Builder (VOIDRUNNER)

An interactive, in-browser 3D arena combat game and procedural level architect built with **Three.js** and vanilla JavaScript. Design custom tactical facilities, sculpt multi-room battle arenas in real time, and immediately playtest them in fast-paced combat.

![Project Status](https://img.shields.io/badge/status-active-emerald)
![Technology](https://img.shields.io/badge/engine-Three.js-blue)
![Architecture](https://img.shields.io/badge/architecture-BSP%20Dungeon%20Generator-cyan)
![Platform](https://img.shields.io/badge/platform-Web%20Browser-orange)

---

## ⚡ Highlights & Key Features

### 🏰 Procedural Sector Architect & BSP Generator
- **Binary Space Partitioning (BSP):** Generates high-efficiency, multi-room compounds with ~80% usable floor space, single-block dividing partition walls, and interconnected 2-block doorways.
- **Grand Main Entrance & Foyers:** Automatic South Perimeter entrance gates with glowing emerald threshold lights and cleared interior foyers, plus secondary rear service gates.
- **Architectural Presets:**
  - 🏰 **Dungeon:** Classic segmented chambers with dynamic corridor connections.
  - 🏢 **Warehouse:** Broad central aisles lined with dual-crate storage rows.
  - 🏟️ **Colosseum:** Massive central arena with quad compass gates and corner pillboxes.
  - 🌀 **Labyrinth:** Tight, winding corridors designed for close-quarters engagements.
  - 🔬 **Facility:** Multi-wing research layout with perimeter offices and central lab.
  - ◻️ **Blank Canvas:** Clean perimeter bounds ready for custom sculpting.

### 🖌️ Interactive 2D Blueprint Sculptor
- Real-time 2D grid editor modal with multi-tool brush suite:
  - **Paint Wall:** Place solid block barriers.
  - **Carve Floor:** Hollow out custom walkable paths.
  - **Hollow Room:** Click & drag rectangular rooms.
- Live canvas metrics displaying map dimensions, block count, floor utilization percentage, and perimeter gate status.
- Customizable wall heights and glowing sci-fi edge trim colors (Cyan, Emerald, Amber, Crimson, Violet).

### ⚔️ Combat Simulation & Tactical AI
- **Third-Person & Over-the-Shoulder Controls:** Fluid WASD movement, sprint, jump physics, aim-tracking, and rapid-fire plasma projectiles.
- **Hostile AI Entities:** State-driven pursuit behavior with Line-of-Sight (LOS) occlusion checks (walls block sight).
- **Billboarding UI:** Dynamic 3D health and detection bars floating over hostiles that continuously orient toward the active camera.
- **Editor Placement Tool:** Click to position custom enemy spawn points (armed or unarmed) and custom player spawn locations directly in the 3D viewport.

### 💾 Map Slot Manager & Visual Thumbnails
- Save up to 5 custom map configurations into browser `localStorage`.
- Automated WebGL buffer captures generate live thumbnail previews for each saved slot.
- Single-click slot loading and clearing.

---

## 🕹️ Controls

### In Editor Mode (Architect)
| Action | Key / Input |
|---|---|
| **Place Enemy / Block** | Left Mouse Button (`LMB`) |
| **Remove Enemy / Block** | Right Mouse Button (`RMB`) |
| **Orbit View** | Click + Drag |
| **Pan Camera** | Right Click + Drag |
| **Zoom In / Out** | Mouse Wheel (`Scroll`) |
| **Open Mesh Architect** | Click `❖ CREATE MESH` |
| **Start Combat** | Click `▶ INITIATE COMBAT` or Press `Enter` |

### In Combat Mode (Simulation)
| Action | Key / Input |
|---|---|
| **Move** | `W` `A` `S` `D` |
| **Look / Aim** | Mouse |
| **Sprint** | `Left Shift` |
| **Jump** | `Space` |
| **Fire Projectile** | `LMB` |
| **Pause / Return** | `Escape` |

---

## 🚀 Getting Started

No build step, package manager, or Node.js server is required.

### Quick Start
1. Clone the repository:
   ```bash
   git clone https://github.com/Sharar12/3D-Game-Builder.git
   ```
2. Navigate into the project folder:
   ```bash
   cd 3D-Game-Builder
   ```
3. Open `index.html` in any modern web browser, or serve locally with any static HTTP server:
   ```bash
   # Using Python 3
   python -m http.server 8000

   # Or using VS Code Live Server extension
   ```
4. Access `http://localhost:8000` and start designing!

---

## 📂 Project Structure

```
3D-Game-Builder/
├── index.html              # Core application entry point & HUD UI
├── css/
│   └── style.css           # Cyberpunk dark-mode design system & animations
├── js/
│   ├── main.js             # Game lifecycle bootstrap
│   ├── core/
│   │   ├── Game.js         # Master game loop, mode switching & orchestrator
│   │   ├── Editor.js       # 3D viewport editor, camera orbit & placement tools
│   │   ├── Input.js        # Keyboard, pointer-lock & mouse handler
│   │   ├── Loop.js         # RAF-based fixed/delta-time game loop
│   │   └── Utils.js        # Math helpers, vector operations & clamps
│   ├── world/
│   │   ├── Arena.js        # BSP generation, colliders & 3D mesh building
│   │   └── World.js        # Scene lighting, ground grid, shadows & sky atmosphere
│   ├── entities/
│   │   ├── Player.js       # Player character controller, physics & camera spring
│   │   ├── Enemies.js      # AI state machine, billboarding UI & LOS vision
│   │   └── Projectiles.js  # High-speed plasma bolts & hit detection
│   ├── ui/
│   │   ├── HUD.js          # Player integrity, enemy counter & pause overlay
│   │   ├── Panels.js       # Collapsible editor panels & map save/load manager
│   │   └── MeshModal.js    # Interactive 2D blueprint sculpting popup
│   └── fx/
│       └── Effects.js      # Particle emitters, muzzle flashes & impact sparks
└── assets/                 # Audio files and textures
```

---

## 🛠️ Built With
- **[Three.js](https://threejs.org/)** (r147) - 3D rendering, scene graph, materials & lighting.
- **HTML5 Canvas API** - Real-time 2D blueprint preview and interactive sculptor.
- **Vanilla Modern JavaScript (ES6+)** - Clean, modular class hierarchy with zero build overhead.
- **Vanilla CSS3** - Responsive glassmorphism panels, glowing neon accents, and custom sliders.

---

## 📄 License
This project is open source and available under the [MIT License](LICENSE).
