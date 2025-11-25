import * as Tweakpane from "tweakpane";
import { Floor } from "../components/Floor";

export interface FloorControlParams {
  textureScale: number;
  gradientIntensity: number;
  gradientBias: number;
}

export class FloorControls {
  private folder: Tweakpane.FolderApi;
  private params: FloorControlParams;
  private floor: Floor;

  constructor(
    folder: Tweakpane.FolderApi,
    floor: Floor,
    initialParams: FloorControlParams
  ) {
    this.folder = folder;
    this.floor = floor;
    this.params = { ...initialParams };

    this.setupControls();
  }

  private setupControls(): void {
    // Texture Scale
    this.folder.addBinding(this.params, "textureScale", {
      label: "Texture Scale",
      min: 1,
      max: 1000,
      step: 1,
    }).on("change", (ev) => {
      this.floor.setTextureScale(ev.value);
    });

    // Gradient Intensity
    this.folder.addBinding(this.params, "gradientIntensity", {
      label: "Gradient Intensity",
      min: 0,
      max: 1,
      step: 0.01,
    }).on("change", (ev) => {
      this.floor.setGradientIntensity(ev.value);
    });

    // Gradient Bias
    this.folder.addBinding(this.params, "gradientBias", {
      label: "Gradient Bias",
      min: -1,
      max: 1,
      step: 0.01,
    }).on("change", (ev) => {
      this.floor.setGradientBias(ev.value);
    });
  }

  getParams(): FloorControlParams {
    return { ...this.params };
  }
}
