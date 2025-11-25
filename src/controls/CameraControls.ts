import type { FolderApi } from "tweakpane";

export type CameraMode = "orbit" | "follow";

export class CameraControls {
  private cameraMode: CameraMode = "follow";
  private onModeChange?: (mode: CameraMode) => void;

  constructor(parent: FolderApi, onModeChange?: (mode: CameraMode) => void) {
    this.onModeChange = onModeChange;

    // Add controls directly to the provided folder (don't create another folder)
    parent
      .addBinding(this, "cameraMode", {
        label: "Mode",
        options: {
          Follow: "follow",
          Orbit: "orbit",
        },
      })
      .on("change", (ev) => {
        if (this.onModeChange) {
          this.onModeChange(ev.value as CameraMode);
        }
      });
  }

  getMode(): CameraMode {
    return this.cameraMode;
  }
}
