import * as THREE from "three";
import * as Tweakpane from "tweakpane";
import { CSM } from "three/examples/jsm/csm/CSM.js";

export interface CSMControlParams {
  cascades: number;
  shadowMapSize: number;
  shadowBias: number;
  shadowNormalBias: number;
  fade: boolean;
  lightMargin: number;
  maxFar: number;
}

export class CSMControls {
  private folder: Tweakpane.FolderApi;
  private params: CSMControlParams;
  private csm: CSM | null;
  private scene: THREE.Scene;
  private camera: THREE.PerspectiveCamera;
  private directionalLight: THREE.DirectionalLight;
  private patchedMaterials: Map<THREE.Material, any>;
  private applyCSMToScene: () => void;

  constructor(
    folder: Tweakpane.FolderApi,
    csm: CSM | null,
    scene: THREE.Scene,
    camera: THREE.PerspectiveCamera,
    directionalLight: THREE.DirectionalLight,
    patchedMaterials: Map<THREE.Material, any>,
    applyCSMToScene: () => void,
    initialParams: CSMControlParams
  ) {
    this.folder = folder;
    this.csm = csm;
    this.scene = scene;
    this.camera = camera;
    this.directionalLight = directionalLight;
    this.patchedMaterials = patchedMaterials;
    this.applyCSMToScene = applyCSMToScene;
    this.params = { ...initialParams };

    this.setupControls();
  }

  private setupControls(): void {
    // Cascades (requires CSM recreation)
    this.folder.addBinding(this.params, "cascades", {
      label: "Cascades",
      min: 1,
      max: 4,
      step: 1,
    }).on("change", (ev) => {
      if (this.csm && this.csm.cascades !== ev.value) {
        this.recreateCSM();
      }
    });

    // Shadow Map Size (requires CSM recreation)
    this.folder.addBinding(this.params, "shadowMapSize", {
      label: "Shadow Map Size",
      options: { "512": 512, "1024": 1024, "2048": 2048, "4096": 4096, "8192": 8192 },
    }).on("change", (ev) => {
      if (this.csm) {
        const currentSize = this.csm.lights[0]?.shadow.mapSize.width || 2048;
        if (currentSize !== ev.value) {
          this.recreateCSM();
        }
      }
    });

    // Shadow Bias (can update directly)
    this.folder.addBinding(this.params, "shadowBias", {
      label: "Shadow Bias",
      min: -0.001,
      max: 0.001,
      step: 0.00001,
    }).on("change", (ev) => {
      if (this.csm) {
        this.csm.lights.forEach((light) => {
          light.shadow.bias = ev.value;
        });
      }
    });

    // Shadow Normal Bias (can update directly)
    this.folder.addBinding(this.params, "shadowNormalBias", {
      label: "Normal Bias",
      min: 0,
      max: 0.1,
      step: 0.001,
    }).on("change", (ev) => {
      if (this.csm) {
        this.csm.lights.forEach((light) => {
          light.shadow.normalBias = ev.value;
        });
      }
    });

    // Fade (can update directly)
    this.folder.addBinding(this.params, "fade", {
      label: "Fade Between Cascades",
    }).on("change", (ev) => {
      if (this.csm) {
        this.csm.fade = ev.value;
        // Need to reapply to materials when fade changes
        this.applyCSMToScene();
      }
    });

    // Light Margin (requires CSM recreation)
    this.folder.addBinding(this.params, "lightMargin", {
      label: "Light Margin",
      min: 0,
      max: 1000,
      step: 10,
    }).on("change", (ev) => {
      if (this.csm) {
        // lightMargin is used during CSM creation, so we need to recreate
        this.recreateCSM();
      }
    });

    // Max Far (requires frustum update)
    this.folder.addBinding(this.params, "maxFar", {
      label: "Max Far",
      min: 100,
      max: 5000,
      step: 50,
    }).on("change", (ev) => {
      if (this.csm) {
        // Note: maxFar is set during CSM creation, but we can update it
        (this.csm as any).maxFar = ev.value;
        this.csm.updateFrustums();
      }
    });
  }

  private recreateCSM(): void {
    if (!this.csm) return;

    // Restore materials before disposing
    this.patchedMaterials.forEach((record, material) => {
      if (record.originalOnBeforeCompile) {
        material.onBeforeCompile = record.originalOnBeforeCompile;
      } else if (material.onBeforeCompile) {
        (material as any).onBeforeCompile = undefined;
      }
      material.needsUpdate = true;
    });
    this.patchedMaterials.clear();

    // Dispose old CSM
    this.csm.remove();
    this.csm.dispose();

    // Calculate light direction
    const lightDir = new THREE.Vector3()
      .copy(this.directionalLight.position)
      .normalize()
      .multiplyScalar(-1);

    // Create new CSM with updated params
    const newCSM = new CSM({
      camera: this.camera,
      parent: this.scene,
      cascades: this.params.cascades,
      shadowMapSize: this.params.shadowMapSize,
      shadowBias: this.params.shadowBias,
      lightDirection: lightDir,
      lightIntensity: this.directionalLight.intensity,
      maxFar: this.params.maxFar,
      lightMargin: this.params.lightMargin,
    });

    // Configure CSM
    newCSM.fade = this.params.fade;

    // Configure each CSM light
    newCSM.lights.forEach((light) => {
      light.castShadow = true;
      light.intensity = this.directionalLight.intensity;
      light.color.copy(this.directionalLight.color);
      light.shadow.bias = this.params.shadowBias;
      light.shadow.normalBias = this.params.shadowNormalBias;
      light.shadow.mapSize.set(this.params.shadowMapSize, this.params.shadowMapSize);
    });

    // Update frustums and apply to scene
    newCSM.updateFrustums();
    this.csm = newCSM;
    this.applyCSMToScene();

    // Notify parent that CSM was recreated (if callback provided)
    if ((this as any).onCSMRecreated) {
      (this as any).onCSMRecreated(newCSM);
    }

    console.log("CSM recreated with new settings");
  }

  updateCSM(csm: CSM | null): void {
    this.csm = csm;
  }

  setOnCSMRecreated(callback: (csm: CSM) => void): void {
    (this as any).onCSMRecreated = callback;
  }

  getParams(): CSMControlParams {
    return { ...this.params };
  }
}

