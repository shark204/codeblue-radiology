export type ScanTintId = 'bone' | 'soft' | 'lung' | 'brain' | 'angio';
export interface ScanTintSpec {
  id: ScanTintId;
  label: string;
  css: string;
  accent: string;
}
export const SCAN_TINTS: readonly ScanTintSpec[] = [
  { id: 'bone', label: 'Bone / Classic', css: 'grayscale(1) contrast(1.15)', accent: '#38bdf8' },
  { id: 'lung', label: 'Lung Window', css: 'grayscale(1) contrast(1.35) brightness(1.05)', accent: '#10b981' },
  { id: 'soft', label: 'Soft Tissue', css: 'grayscale(1) contrast(1.05)', accent: '#f59e0b' },
  { id: 'brain', label: 'Brain Window', css: 'grayscale(1) contrast(1.25)', accent: '#a855f7' },
  { id: 'angio', label: 'Angio / Contrast', css: 'grayscale(0.8) contrast(1.2)', accent: '#f43f5e' },
];
export function scanTint(id: ScanTintId): ScanTintSpec {
  return SCAN_TINTS.find((t) => t.id === id) ?? SCAN_TINTS[0]!;
}
