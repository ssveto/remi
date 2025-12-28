import * as Phaser from "phaser";
import { ASSET_KEYS, CARD_HEIGHT, CARD_WIDTH, SCENE_KEYS } from "./common";

export class PreloadScene extends Phaser.Scene {
  constructor() {
    super({ key: SCENE_KEYS.PRELOAD });
  }

  public preload(): void {
    this.load.spritesheet(ASSET_KEYS.CARDS, "assets/images/spritesheet-revorked.png", {
      frameWidth: 219,
      frameHeight: 312,
      spacing: 8,
      margin: 0,
      //endFrame: 55, // 55 cards total (0-54)
    });

  }

  
  public create(): void {

    this.time.delayedCall(1000, () => {
      this.scene.start(SCENE_KEYS.MENU);
    });
  }
}
