import * as THREE from "three";
import { OrbitControls } from "three/examples/jsm/controls/OrbitControls.js";
import { CSM } from "three/examples/jsm/csm/CSM.js";
import { HorizonSky } from "../components/HorizonSky";
import { Skybox } from "../components/Skybox";
import { Floor } from "../components/Floor";
import { Building } from "../components/Building";
import { ControlsManager } from "../controls/ControlsManager";
import { HorizonSkyControls } from "../controls/HorizonSkyControls";
import { SkyControls } from "../controls/SkyControls";
import { FloorControls } from "../controls/FloorControls";
import { LightsControls } from "../controls/LightsControls";
import { CSMControls } from "../controls/CSMControls";
import { CameraControls, type CameraMode } from "../controls/CameraControls";
import { PhysicsManager } from "../physics/PhysicsManager";
import { RapierDebugRenderer } from "../physics/RapierDebugRenderer";
import { CharacterController } from "../character/CharacterController";

export class GameScene {
  private scene: THREE.Scene;
  private camera: THREE.PerspectiveCamera;
  private renderer: THREE.WebGLRenderer;
  private controls: OrbitControls;
  private horizonSky: HorizonSky;
  private skybox: Skybox;
  private floor: Floor;
  private building: Building;
  private ambientLight: THREE.AmbientLight;
  private directionalLight: THREE.DirectionalLight;
  private controlsManager!: ControlsManager; // Initialized in setupControls()
  private physicsManager: PhysicsManager;
  private rapierDebugRenderer: RapierDebugRenderer;
  private characterController: CharacterController | null = null;
  private clock: THREE.Clock;
  private cameraMode: CameraMode = "follow";
  private animationId: number | null = null;
  private csm: CSM | null = null;
  private patchedMaterials: Map<THREE.Material, any> = new Map();
  private csmControls: CSMControls | null = null;

  constructor(container: HTMLElement) {
    console.log("GameScene constructor called");

    // Create scene
    this.scene = new THREE.Scene();

    // Get container dimensions (fallback to window if container is 0)
    const width = container.clientWidth || window.innerWidth;
    const height = container.clientHeight || window.innerHeight;

    console.log("Scene dimensions:", width, "x", height);

    // Create camera
    this.camera = new THREE.PerspectiveCamera(40, width / height, 0.1, 10000);
    this.camera.position.set(3, 3, 3);
    this.camera.lookAt(0, 0, 0);

    // Create renderer
    this.renderer = new THREE.WebGLRenderer({
      antialias: true,
    });
    this.renderer.outputColorSpace = THREE.SRGBColorSpace;
    this.renderer.toneMapping = THREE.ACESFilmicToneMapping;
    this.renderer.toneMappingExposure = 1.0;
    this.renderer.setSize(width, height);
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));

    // Enable shadow mapping
    this.renderer.shadowMap.enabled = true;
    this.renderer.shadowMap.type = THREE.PCFSoftShadowMap; // Soft shadows
    container.appendChild(this.renderer.domElement);

    // Create OrbitControls
    this.controls = new OrbitControls(this.camera, this.renderer.domElement);
    this.controls.enableDamping = true;
    this.controls.dampingFactor = 0.05;
    this.controls.minDistance = 1;
    this.controls.maxDistance = 2000;

    // Create HorizonSky
    console.log("Creating HorizonSky...");
    this.horizonSky = new HorizonSky({
      topColor: "#0077ff",
      bottomColor: "#ffffff",
      offset: 33,
      exponent: 0.6,
      radius: 4000,
    });
    this.scene.add(this.horizonSky.getMesh());
    console.log("HorizonSky added to scene");

    // Create Skybox
    console.log("Creating Skybox...");
    this.skybox = new Skybox();
    this.skybox.setVisible(false); // Disabled by default, HorizonSky is enabled
    this.scene.add(this.skybox.getMesh());
    console.log("Skybox added to scene");

    // Create floor
    console.log("Creating floor...");
    this.floor = new Floor({
      size: 200,
      position: [0, 0, 0],
      textureScale: 400, // TILE_REFERENCE_SCALE
    });
    this.scene.add(this.floor.getMesh());
    console.log("Floor added to scene");

    // Create building (same as Map1.jsx)
    console.log("Creating building...");
    const floorPosition: [number, number, number] = [0, 0, 0];
    const scale = 1;
    const buildingHeight = 60 * scale;
    const buildingPosition: [number, number, number] = [
      floorPosition[0] - 30 * scale,
      floorPosition[1] + buildingHeight / 2,
      floorPosition[2] - 20 * scale,
    ];

    this.building = new Building({
      scale: 1,
      position: buildingPosition,
      width: 18,
      height: 60,
      depth: 14,
    });
    this.scene.add(this.building.getMesh());
    console.log("Building added to scene");

    // Add lighting for the floor (MeshStandardMaterial needs lights)
    this.ambientLight = new THREE.AmbientLight(0xffffff, 0.6);
    this.scene.add(this.ambientLight);

    this.directionalLight = new THREE.DirectionalLight(0xffffff, 0.8);
    this.directionalLight.position.set(5, 10, 5);
    this.directionalLight.castShadow = true;

    // Configure shadow camera
    // Using reasonable settings for good quality shadows (CSM will be added later)
    this.directionalLight.shadow.mapSize.width = 2048;
    this.directionalLight.shadow.mapSize.height = 2048;
    this.directionalLight.shadow.camera.near = 0.5;
    this.directionalLight.shadow.camera.far = 200;
    // Reasonable frustum size for good shadow quality (not too large to avoid blurriness)
    // Covering 400x400 area (200 units in each direction from center)
    this.directionalLight.shadow.camera.left = -200;
    this.directionalLight.shadow.camera.right = 200;
    this.directionalLight.shadow.camera.top = 200;
    this.directionalLight.shadow.camera.bottom = -200;
    this.directionalLight.shadow.bias = -0.00005; // Better bias value
    this.directionalLight.shadow.normalBias = 0.0;
    this.directionalLight.shadow.radius = 4; // Shadow blur radius for softer shadows
    // Update shadow camera to look down at the scene
    this.directionalLight.shadow.camera.updateProjectionMatrix();

    this.scene.add(this.directionalLight);

    console.log("Lights added to scene");

    // Initialize CSM (Cascaded Shadow Maps)
    this.initCSM();

    // Initialize physics
    this.physicsManager = new PhysicsManager();
    this.rapierDebugRenderer = new RapierDebugRenderer(this.scene);
    this.clock = new THREE.Clock();

    // Enable debug renderer by default (can be toggled in controls)
    this.rapierDebugRenderer.setEnabled(true);

    // Initialize physics and setup floor with terrain ready callback
    this.initPhysics();

    // Setup Tweakpane controls
    this.setupControls();

    // Handle window resize
    window.addEventListener("resize", () => this.handleResize(container));
  }

  private async initPhysics(): Promise<void> {
    await this.physicsManager.init();

    // Add physics to floor with terrain ready callback
    this.floor.addPhysics(
      this.physicsManager.getRAPIER(),
      this.physicsManager.getWorld(),
      () => {
        console.log("Terrain ready, spawning character...");
        this.spawnCharacter();
      }
    );

    // Add physics to building
    this.building.addPhysics(
      this.physicsManager.getRAPIER(),
      this.physicsManager.getWorld()
    );
  }

  private updateCameraMode(): void {
    if (this.cameraMode === "orbit") {
      this.controls.enabled = true;
      // Set OrbitControls target to character position if character exists
      if (
        this.characterController &&
        (this.characterController as any).container
      ) {
        const pos = (this.characterController as any).container.position;
        this.controls.target.set(pos.x, pos.y + 1, pos.z);
        this.controls.update();
      }
    } else if (
      this.cameraMode === "follow" ||
      this.cameraMode === "follow-orbit"
    ) {
      this.controls.enabled = false;
      // Update camera mode in character controller if it supports it
      if (this.characterController) {
        (this.characterController as any).cameraMode = this.cameraMode;
      }
    }
  }

  private async spawnCharacter(): Promise<void> {
    if (this.characterController) {
      console.warn("Character already spawned");
      return;
    }

    try {
      // Get ground mesh from floor for collision detection (optional)
      const groundMesh = this.floor.getMesh();

      // Get RAPIER instance from PhysicsManager to pass to CharacterController
      const RAPIER = this.physicsManager.getRAPIER();

      // Create character controller (it loads the model internally)
      // Pass RAPIER instance from PhysicsManager so it uses the same initialized instance
      this.characterController = new CharacterController(
        this.scene,
        this.physicsManager.getWorld(),
        this.camera,
        groundMesh as any,
        RAPIER // Pass initialized RAPIER instance from PhysicsManager
      );

      // Create physics body
      this.characterController.createPhysicsBody([0, 2, 0]);

      console.log("Character spawned successfully");

      // Apply CSM to character materials and building
      this.applyCSMToScene();

      // Setup character controls after character is loaded
      this.setupCharacterControls();
    } catch (error) {
      console.error("Error spawning character:", error);
    }
  }

  private setupCharacterControls(): void {
    if (!this.characterController) return;

    // Note: FollowCameraControls may need to be updated to work with new CharacterController API
    // The new CharacterController uses config object for camera settings
    // For now, we'll skip FollowCameraControls setup since it expects methods that don't exist
    // You can manually adjust camera settings via characterController.config if needed
  }

  private setupControls(): void {
    this.controlsManager = new ControlsManager();

    // Sky Toggle Controls
    const skyToggleFolder = this.controlsManager.getFolder("🌌 Sky", {
      expanded: true,
    });
    new SkyControls(skyToggleFolder, this.horizonSky, this.skybox, {
      horizonSkyEnabled: true,
      skyboxEnabled: false,
    });

    // HorizonSky Controls
    const skyFolder = this.controlsManager.getFolder("🌅 Horizon Sky", {
      expanded: true,
    });
    new HorizonSkyControls(skyFolder, this.horizonSky, {
      topColor: "#0077ff",
      bottomColor: "#ffffff",
      offset: 33,
      exponent: 0.6,
      radius: 4000,
    });

    // Camera Controls
    const cameraFolder = this.controlsManager.getFolder("📷 Camera", {
      expanded: false,
    });
    new CameraControls(cameraFolder, (mode) => {
      this.cameraMode = mode;
      this.updateCameraMode();
    });

    // Character Controls (will be set up after character spawns)
    this.setupCharacterControls();

    // Floor Controls
    const floorFolder = this.controlsManager.getFolder("🏠 Floor", {
      expanded: true,
    });
    new FloorControls(floorFolder, this.floor, {
      textureScale: 400,
      gradientIntensity: 0.5,
      gradientBias: 0.0,
    });

    // Lights Controls
    const lightsFolder = this.controlsManager.getFolder("💡 Lights", {
      expanded: false,
    });
    new LightsControls(lightsFolder, this.ambientLight, this.directionalLight, {
      ambientIntensity: 0.6,
      directionalIntensity: 0.8,
      directionalColor: "#ffffff",
      directionalPositionX: 5,
      directionalPositionY: 10,
      directionalPositionZ: 5,
    });

    // CSM Controls
    const csmFolder = this.controlsManager.getFolder("🌑 CSM Shadows", {
      expanded: false,
    });
    this.csmControls = new CSMControls(
      csmFolder,
      this.csm,
      this.scene,
      this.camera,
      this.directionalLight,
      this.patchedMaterials,
      () => this.applyCSMToScene(),
      {
        cascades: 3,
        shadowMapSize: 2048,
        shadowBias: -0.00005,
        shadowNormalBias: 0.0,
        fade: true,
        lightMargin: 150,
        maxFar: 300,
      }
    );

    // Update CSM reference when it's recreated
    this.csmControls.setOnCSMRecreated((newCSM) => {
      this.csm = newCSM;
    });

    console.log("Controls setup complete");
  }

  private handleResize(container: HTMLElement): void {
    this.camera.aspect = container.clientWidth / container.clientHeight;
    this.camera.updateProjectionMatrix();
    this.renderer.setSize(container.clientWidth, container.clientHeight);

    // Update CSM frustums when camera changes
    if (this.csm) {
      this.csm.updateFrustums();
    }
  }

  public animate(): void {
    this.animationId = requestAnimationFrame(() => this.animate());

    const deltaTime = this.clock.getDelta();

    // Update camera mode in character controller if it supports it
    if (this.characterController) {
      (this.characterController as any).cameraMode = this.cameraMode;
    }

    // Step physics FIRST (as per usage example: world.step() then character.update())
    if (this.physicsManager.isInitialized()) {
      this.physicsManager.step(deltaTime);
      // Update debug renderer
      this.rapierDebugRenderer.update(this.physicsManager.getWorld());
    }

    // Update character (handles input, animation, and camera internally)
    // Character reads position from physics body after step
    if (this.characterController) {
      this.characterController.update(deltaTime);
    }

    // Update camera based on mode
    if (this.cameraMode === "orbit") {
      this.controls.update();
    } else if (
      (this.cameraMode === "follow" || this.cameraMode === "follow-orbit") &&
      this.characterController
    ) {
      // Follow camera is handled by CharacterController
      this.controls.enabled = false;
    }

    // Update CSM (must be called before render)
    if (this.csm) {
      this.csm.update();
    }

    // Render scene
    this.renderer.render(this.scene, this.camera);
  }

  public stop(): void {
    if (this.animationId !== null) {
      cancelAnimationFrame(this.animationId);
      this.animationId = null;
    }
  }

  public getScene(): THREE.Scene {
    return this.scene;
  }

  public getCamera(): THREE.PerspectiveCamera {
    return this.camera;
  }

  public getRenderer(): THREE.WebGLRenderer {
    return this.renderer;
  }

  public getHorizonSky(): HorizonSky {
    return this.horizonSky;
  }

  public getSkybox(): Skybox {
    return this.skybox;
  }

  public getFloor(): Floor {
    return this.floor;
  }

  public getControlsManager(): ControlsManager {
    return this.controlsManager;
  }

  private initCSM(): void {
    // Calculate light direction from position
    const lightDir = new THREE.Vector3()
      .copy(this.directionalLight.position)
      .normalize()
      .multiplyScalar(-1); // Reverse direction

    // Initialize CSM with default settings (matching wawa-template)
    // Use reasonable maxFar instead of camera.far (10000 is too large)
    const maxFar = Math.min(this.camera.far, 300);

    this.csm = new CSM({
      camera: this.camera,
      parent: this.scene,
      cascades: 3,
      shadowMapSize: 2048,
      shadowBias: -0.00005,
      lightDirection: lightDir,
      lightIntensity: this.directionalLight.intensity,
      maxFar: maxFar,
      lightMargin: 150,
    });

    // Configure CSM
    this.csm.fade = true;

    // Configure each CSM light
    this.csm.lights.forEach((light) => {
      light.castShadow = true;
      light.intensity = this.directionalLight.intensity;
      light.color.copy(this.directionalLight.color);
      light.shadow.bias = -0.00005;
      light.shadow.normalBias = 0.0;
      light.shadow.mapSize.set(2048, 2048);
    });

    // Update frustums and apply to scene
    this.csm.updateFrustums();
    this.applyCSMToScene();

    // Disable regular directional light shadows when using CSM
    this.directionalLight.castShadow = false;

    console.log("CSM initialized", {
      cascades: this.csm.cascades,
      lights: this.csm.lights.length,
      lightDirection: lightDir,
      maxFar: maxFar,
    });
  }

  private applyCSMToScene(): void {
    if (!this.csm) return;

    this.scene.traverse((child) => {
      // Use isMesh property like wawa-template does
      if (!(child as any).isMesh) {
        return;
      }

      const mesh = child as THREE.Mesh;
      const materials = Array.isArray(mesh.material)
        ? mesh.material
        : [mesh.material];

      materials.forEach((material: THREE.Material) => {
        if (material && material instanceof THREE.Material) {
          // Patch all materials - CSM should work with any material that supports shadows
          this.patchMaterialWithCSM(material);
        }
      });
    });
  }

  private patchMaterialWithCSM(material: THREE.Material): void {
    if (!this.csm || !material) {
      return;
    }

    // Skip if already patched
    if (this.patchedMaterials.has(material)) {
      return;
    }

    // Debug: log material being patched
    console.log("Patching material with CSM:", material.type, material);

    // Store original onBeforeCompile if it exists
    const originalOnBeforeCompile = material.onBeforeCompile;

    // Setup material for CSM
    this.csm.setupMaterial(material);

    // Wrap onBeforeCompile to preserve any existing hooks
    // CSM uses the old signature: onBeforeCompile(shader) not onBeforeCompile(shader, renderer)
    const csmOnBeforeCompile = material.onBeforeCompile;
    if (csmOnBeforeCompile) {
      // Use function declaration to preserve 'this' context, matching wawa-template
      material.onBeforeCompile = function (shader: any, renderer?: any) {
        const context = this;
        // CSM's onBeforeCompile only takes shader parameter
        if (csmOnBeforeCompile) {
          (csmOnBeforeCompile as any).call(context, shader);
        }
        // Original might use new signature (shader, renderer) or old (shader)
        if (originalOnBeforeCompile) {
          if (originalOnBeforeCompile.length === 2 && renderer !== undefined) {
            originalOnBeforeCompile.call(context, shader, renderer);
          } else {
            (originalOnBeforeCompile as any).call(context, shader);
          }
        }
      };
    }

    material.needsUpdate = true;

    // Track patched material
    this.patchedMaterials.set(material, {
      originalOnBeforeCompile,
      csmOnBeforeCompile,
    });
  }

  public dispose(): void {
    this.stop();

    // Dispose CSM
    if (this.csm) {
      // Restore materials
      this.patchedMaterials.forEach((record, material) => {
        if (record.originalOnBeforeCompile) {
          material.onBeforeCompile = record.originalOnBeforeCompile;
        } else {
          // Remove onBeforeCompile by setting to undefined (TypeScript-safe)
          (material as any).onBeforeCompile = undefined;
        }
        material.needsUpdate = true;
      });
      this.patchedMaterials.clear();

      this.csm.remove();
      this.csm.dispose();
      this.csm = null;
    }

    this.controlsManager.dispose();
    this.characterController?.dispose();
    this.rapierDebugRenderer.dispose();
    this.physicsManager.dispose();
    this.horizonSky.dispose();
    this.skybox.dispose();
    this.floor.dispose();
    this.building.dispose();
    this.controls.dispose();
    this.renderer.dispose();
  }
}
