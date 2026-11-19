export const SECTION_STEP_CM = 1.0;
export const SWEEP_PROGRESS = { current: 0.5 };
export function resetScanBand(): void { SWEEP_PROGRESS.current = 0.5; }
export function setSweepProgress(v: number): void { SWEEP_PROGRESS.current = Math.max(0, Math.min(1, v)); }
export function stepFraction(_delta: number): number { return 0.02; }
