export interface NpmVisibilityPackage {
  name: string;
  version: string;
  integrity: string;
}
export interface NpmVisibilityOptions {
  getPackage: (name: string, version: string) => Promise<unknown | null>;
  timeoutMs?: number;
  intervalMs?: number;
  now?: () => number;
  pause?: (milliseconds: number) => Promise<void>;
  report?: (message: string) => void;
}
export function waitForNpmVisibility(packages: readonly NpmVisibilityPackage[], options: NpmVisibilityOptions): Promise<void>;
