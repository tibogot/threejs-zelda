import type { FolderApi } from "tweakpane";
import { CharacterController } from "../character/CharacterController";

export interface FollowCameraControlsParams {
  cameraDistance?: number;
  cameraHeight?: number;
  cameraTargetZ?: number;
  cameraLerpSpeed?: number;
}

export class FollowCameraControls {
  private folder: FolderApi;
  private characterController: CharacterController;
  private cameraDistance: number;
  private cameraHeight: number;
  private cameraTargetZ: number;
  private cameraLerpSpeed: number;

  constructor(
    parent: FolderApi,
    characterController: CharacterController,
    params: FollowCameraControlsParams = {}
  ) {
    this.characterController = characterController;
    this.cameraDistance = params.cameraDistance ?? characterController.getCameraDistance();
    this.cameraHeight = params.cameraHeight ?? characterController.getCameraHeight();
    this.cameraTargetZ = params.cameraTargetZ ?? characterController.getCameraTargetZ();
    this.cameraLerpSpeed = params.cameraLerpSpeed ?? characterController.getCameraLerpSpeed();

    // Create folder for follow camera controls
    this.folder = parent.addFolder({ title: "📷 Follow Camera", expanded: false });

    this.folder
      .addBinding(this, "cameraDistance", {
        label: "Distance",
        min: 1,
        max: 15,
        step: 0.1,
        hint: "Camera distance behind character (negative Z)",
      })
      .on("change", (ev) => {
        this.characterController.setCameraDistance(ev.value);
      });

    this.folder
      .addBinding(this, "cameraHeight", {
        label: "Height",
        min: 0,
        max: 10,
        step: 0.1,
        hint: "Camera height above character",
      })
      .on("change", (ev) => {
        this.characterController.setCameraHeight(ev.value);
      });

    this.folder
      .addBinding(this, "cameraTargetZ", {
        label: "Target Distance",
        min: -2,
        max: 10,
        step: 0.1,
        hint: "Look-at target distance forward from character",
      })
      .on("change", (ev) => {
        this.characterController.setCameraTargetZ(ev.value);
      });

    this.folder
      .addBinding(this, "cameraLerpSpeed", {
        label: "Lerp Speed",
        min: 0.01,
        max: 0.5,
        step: 0.01,
        hint: "Camera smoothing speed (lower = smoother)",
      })
      .on("change", (ev) => {
        this.characterController.setCameraLerpSpeed(ev.value);
      });
  }

  // Getters for Tweakpane binding
  getCameraDistance(): number {
    return this.cameraDistance;
  }

  getCameraHeight(): number {
    return this.cameraHeight;
  }

  getCameraTargetZ(): number {
    return this.cameraTargetZ;
  }

  getCameraLerpSpeed(): number {
    return this.cameraLerpSpeed;
  }
}

