import * as Tweakpane from "tweakpane";
import { HorizonSky } from "../components/HorizonSky";

export interface HorizonSkyControlParams {
  topColor: string;
  bottomColor: string;
  offset: number;
  exponent: number;
  radius: number;
}

export class HorizonSkyControls {
  private folder: Tweakpane.FolderApi;
  private params: HorizonSkyControlParams;
  private horizonSky: HorizonSky;

  constructor(
    folder: Tweakpane.FolderApi,
    horizonSky: HorizonSky,
    initialParams: HorizonSkyControlParams
  ) {
    this.folder = folder;
    this.horizonSky = horizonSky;
    this.params = { ...initialParams };

    this.setupControls();
  }

  private setupControls(): void {
    // Top Color
    this.folder.addBinding(this.params, "topColor", {
      label: "Top Color",
      picker: "inline",
    }).on("change", (ev) => {
      this.horizonSky.setTopColor(ev.value);
    });

    // Bottom Color
    this.folder.addBinding(this.params, "bottomColor", {
      label: "Bottom Color",
      picker: "inline",
    }).on("change", (ev) => {
      this.horizonSky.setBottomColor(ev.value);
    });

    // Offset
    this.folder.addBinding(this.params, "offset", {
      label: "Offset",
      min: 0,
      max: 100,
      step: 1,
    }).on("change", (ev) => {
      this.horizonSky.setOffset(ev.value);
    });

    // Exponent
    this.folder.addBinding(this.params, "exponent", {
      label: "Exponent",
      min: 0.1,
      max: 5,
      step: 0.1,
    }).on("change", (ev) => {
      this.horizonSky.setExponent(ev.value);
    });

    // Radius
    this.folder.addBinding(this.params, "radius", {
      label: "Radius",
      min: 500,
      max: 8000,
      step: 100,
    }).on("change", (ev) => {
      // Radius requires recreating the geometry, so we'll handle this differently
      // For now, we'll just update the uniform if possible
      // Note: Changing radius requires mesh.geometry update, which we'll handle in HorizonSky
      console.log("Radius change requires geometry update - implement in HorizonSky if needed");
    });
  }

  getParams(): HorizonSkyControlParams {
    return { ...this.params };
  }
}
