export type SectionPlaneName = 'axial' | 'coronal' | 'sagittal';
export interface SliceWindow { zoom: number; panX: number; panY: number; }
export interface SectionMeasure { x1: number; y1: number; x2: number; y2: number; }

export const AXIAL_CANVAS = { width: 512, height: 512 };
export const RETAKE_INTERVAL_MS = 120;
export const WHEEL_SETTLE_MS = 180;
export const SLICE_PIXELS = 512;
export const SECTION_VIEW = { plane: 'axial' as SectionPlaneName };
export const SECTION_WINDOW: SliceWindow = { zoom: 1, panX: 0, panY: 0 };
export const TORCH = { enabled: false, x: 0.5, y: 0.5 };
export const SLICE_PATHOLOGY_OVERLAY: { activeId: string | null } = { activeId: null };
export const PDF_CLINICAL_SCAN_DATA_URLS: Record<string, string> = {};

export function getPdfClinicalScanDataUrl(_caseId: string, _modality?: string): string { return ''; }
export function formatDistance(cm: number): string { return `${cm.toFixed(1)} cm`; }
export function measureCm(m: SectionMeasure): number { return Math.hypot(m.x2 - m.x1, m.y2 - m.y1) * 0.1; }
export function onLevel(): string { return 'T4'; }
export function panWindow(w: SliceWindow, dx: number, dy: number): SliceWindow { return { ...w, panX: w.panX + dx, panY: w.panY + dy }; }
export function zoomWindow(w: SliceWindow, factor: number): SliceWindow { return { ...w, zoom: Math.max(0.5, Math.min(8, w.zoom * factor)) }; }
export function pointInSection(_x: number, _y: number): boolean { return true; }
export function pointOnScreen(x: number, y: number): { x: number; y: number } { return { x, y }; }
export function sectionFileName(plane: string, level: string): string { return `codeblue-${plane}-${level}.png`; }
export function sectionImage(): string | null { return null; }
export function restoreSlice(): void {}
export function slicePlane(): SectionPlaneName { return 'axial'; }
export function torchDirection(): { x: number; y: number } { return { x: 0, y: 0 }; }
export function wantSection(): boolean { return false; }
export function wheelPixels(e: { deltaY: number }): number { return e.deltaY; }
export function wheelSteps(e: { deltaY: number }): number { return Math.sign(e.deltaY); }
