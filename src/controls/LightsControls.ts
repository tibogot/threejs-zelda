import * as THREE from "three";
import * as Tweakpane from "tweakpane";

export interface LightsControlParams {
  ambientIntensity: number;
  directionalIntensity: number;
  directionalColor: string;
  directionalPositionX: number;
  directionalPositionY: number;
  directionalPositionZ: number;
}

export class LightsControls {
  private folder: Tweakpane.FolderApi;
  private params: LightsControlParams;
  private ambientLight: THREE.AmbientLight;
  private directionalLight: THREE.DirectionalLight;

  constructor(
    folder: Tweakpane.FolderApi,
    ambientLight: THREE.AmbientLight,
    directionalLight: THREE.DirectionalLight,
    initialParams: LightsControlParams
  ) {
    this.folder = folder;
    this.ambientLight = ambientLight;
    this.directionalLight = directionalLight;
    this.params = { ...initialParams };

    this.setupControls();
  }

  private setupControls(): void {
    // Ambient Light Intensity
    this.folder.addBinding(this.params, "ambientIntensity", {
      label: "Ambient Intensity",
      min: 0,
      max: 2,
      step: 0.1,
    }).on("change", (ev) => {
      this.ambientLight.intensity = ev.value;
    });

    // Directional Light Intensity
    this.folder.addBinding(this.params, "directionalIntensity", {
      label: "Directional Intensity",
      min: 0,
      max: 2,
      step: 0.1,
    }).on("change", (ev) => {
      this.directionalLight.intensity = ev.value;
    });

    // Directional Light Color
    this.folder.addBinding(this.params, "directionalColor", {
      label: "Directional Color",
      picker: "inline",
    }).on("change", (ev) => {
      this.directionalLight.color.set(ev.value);
    });

    // Directional Light Position
    const positionFolder = this.folder.addFolder({
      title: "Directional Position",
      expanded: false,
    });

    positionFolder.addBinding(this.params, "directionalPositionX", {
      label: "X",
      min: -50,
      max: 50,
      step: 0.5,
    }).on("change", (ev) => {
      this.directionalLight.position.x = ev.value;
    });

    positionFolder.addBinding(this.params, "directionalPositionY", {
      label: "Y",
      min: 0,
      max: 50,
      step: 0.5,
    }).on("change", (ev) => {
      this.directionalLight.position.y = ev.value;
    });

    positionFolder.addBinding(this.params, "directionalPositionZ", {
      label: "Z",
      min: -50,
      max: 50,
      step: 0.5,
    }).on("change", (ev) => {
      this.directionalLight.position.z = ev.value;
    });
  }

  getParams(): LightsControlParams {
    return { ...this.params };
  }
}
