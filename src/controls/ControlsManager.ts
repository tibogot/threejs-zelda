import * as Tweakpane from "tweakpane";

export class ControlsManager {
  private pane: Tweakpane.Pane;
  private folders: Map<string, Tweakpane.FolderApi> = new Map();

  constructor() {
    this.pane = new Tweakpane.Pane({
      title: "Game Controls",
      expanded: true,
    });
  }

  /**
   * Get or create a folder for organizing controls
   */
  getFolder(name: string, options?: { expanded?: boolean }): Tweakpane.FolderApi {
    if (!this.folders.has(name)) {
      const folder = this.pane.addFolder({
        title: name,
        expanded: options?.expanded ?? true,
      });
      this.folders.set(name, folder);
    }
    return this.folders.get(name)!;
  }

  /**
   * Get the main pane (for adding controls directly)
   */
  getPane(): Tweakpane.Pane {
    return this.pane;
  }

  /**
   * Dispose of the controls manager
   */
  dispose(): void {
    this.pane.dispose();
    this.folders.clear();
  }
}
