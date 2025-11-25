import * as Tweakpane from "tweakpane";
import { HorizonSky } from "../components/HorizonSky";
import { Skybox } from "../components/Skybox";

export interface SkyControlParams {
  horizonSkyEnabled: boolean;
  skyboxEnabled: boolean;
}

export class SkyControls {
  private folder: Tweakpane.FolderApi;
  private params: SkyControlParams;
  private horizonSky: HorizonSky;
  private skybox: Skybox;

  constructor(
    folder: Tweakpane.FolderApi,
    horizonSky: HorizonSky,
    skybox: Skybox,
    initialParams: SkyControlParams
  ) {
    this.folder = folder;
    this.horizonSky = horizonSky;
    this.skybox = skybox;
    this.params = { ...initialParams };

    this.setupControls();
  }

  private setupControls(): void {
    // Horizon Sky Toggle
    this.folder
      .addBinding(this.params, "horizonSkyEnabled", {
        label: "Horizon Sky",
      })
      .on("change", (ev: { value: boolean }) => {
        this.horizonSky.getMesh().visible = ev.value;
      });

    // Skybox Toggle
    this.folder
      .addBinding(this.params, "skyboxEnabled", {
        label: "Skybox",
      })
      .on("change", (ev: { value: boolean }) => {
        this.skybox.setVisible(ev.value);
      });
  }

  getParams(): SkyControlParams {
    return { ...this.params };
  }
}
