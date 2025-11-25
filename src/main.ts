import "./style.css";
import { GameScene } from "./core/Scene";

// Wait for DOM to be ready
function init() {
  // Get the app container
  const app = document.querySelector<HTMLDivElement>("#app");
  
  if (!app) {
    console.error("Could not find #app element");
    return;
  }

  // Clear any existing content
  app.innerHTML = "";

  console.log("Initializing game scene...");
  console.log("Container dimensions:", app.clientWidth, "x", app.clientHeight);

  // Create and initialize the game scene
  const gameScene = new GameScene(app);

  console.log("Game scene created, starting animation...");

  // Start the animation loop
  gameScene.animate();

  // Cleanup on page unload
  window.addEventListener("beforeunload", () => {
    gameScene.dispose();
  });
}

// Initialize when DOM is ready
if (document.readyState === "loading") {
  document.addEventListener("DOMContentLoaded", init);
} else {
  init();
}