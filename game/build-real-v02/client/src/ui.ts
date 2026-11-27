// (provisório para validar o renderer; substituído pela HUD V02 completa)
import type { ContinentSummary, SnapshotFull } from "./contracts";
import type { GraphicsSettings } from "./settings";
import type { Perf } from "./perf";
import type { StrategyCamera } from "./camera";
export interface UiDeps { continent: ContinentSummary; settings: GraphicsSettings; perf: Perf; select: (id: string) => void; setEconomic: (on: boolean) => void; applySettings: (s: GraphicsSettings) => void; camera: StrategyCamera }
export class Ui {
  selected = "";
  constructor(private d: UiDeps) {}
  log(s: string) { console.log(s); }
  toast(s: string) { console.log(s); }
  frame(_s: SnapshotFull, _t: number) {}
}
