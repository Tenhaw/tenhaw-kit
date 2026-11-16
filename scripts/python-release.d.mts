export const pythonProjects: string[];
export interface PythonDistribution { name: string; version: string; filename: string; path: string; sha256: string }
export type RegistryGetter = (url: string, options?: { missing?: boolean }) => Promise<unknown>;
export interface PythonReleaseOptions { root?: string; version: string; project?: string; getJson?: RegistryGetter; retry?: <T>(operation: () => Promise<T>) => Promise<T> }
export interface PythonReleaseEvidence {
  version: string;
  scope: 'all' | 'selected-project';
  selectedProject: string | null;
  allPythonProjectsVerified: boolean;
  attestationCheck: string;
  packages: { name: string; version: string; distributions: { filename: string; sha256: string; attestations: boolean }[] }[];
}
export function selectedPythonProjects(project?: string): string[];
export function loadPythonDistributions(options: PythonReleaseOptions): Promise<PythonDistribution[]>;
export function getRegistryJson(url: string, options?: { missing?: boolean }): Promise<unknown>;
export function preparePythonRelease(options: PythonReleaseOptions): Promise<{ directory: string; projects: string[]; distributions: Pick<PythonDistribution, 'name' | 'filename' | 'sha256'>[] }>;
export function verifyPythonRelease(options: PythonReleaseOptions): Promise<PythonReleaseEvidence>;
