import type { FolderApi } from "tweakpane";
import { CharacterModel } from "../character/CharacterModel";

export interface CharacterControlsParams {
  yPosition?: number;
  scale?: number;
}

export class CharacterControls {
  private characterModel: CharacterModel;
  private yPosition: number = -0.99;
  private scale: number = 1;

  constructor(
    parent: FolderApi,
    characterModel: CharacterModel,
    params: CharacterControlsParams = {}
  ) {
    this.characterModel = characterModel;
    this.yPosition = params.yPosition ?? -0.99;
    this.scale = params.scale ?? 1;

    parent
      .addBinding(this, "yPosition", {
        label: "Feet Position",
        min: -2,
        max: 2,
        step: 0.01,
        hint: "Align feet with capsule bottom",
      })
      .on("change", (ev) => {
        this.characterModel.setYPosition(ev.value);
      });

    parent
      .addBinding(this, "scale", {
        label: "Scale",
        min: 0.1,
        max: 5,
        step: 0.1,
      })
      .on("change", (ev) => {
        this.characterModel.setScale(ev.value);
      });
  }

  getYPosition(): number {
    return this.yPosition;
  }

  getScale(): number {
    return this.scale;
  }
}
