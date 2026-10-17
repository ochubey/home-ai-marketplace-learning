// Minimal typings for the few Node APIs used by specs, so that no @types/node dev dependency is needed.
declare module 'node:fs' {
  export function readFileSync(path: string, encoding: 'utf8'): string;
  export function readdirSync(path: string, options: { recursive: true }): string[];
  export function existsSync(path: string): boolean;
  export function statSync(path: string): { size: number; isFile(): boolean };
}
declare module 'node:path' {
  export function join(...parts: string[]): string;
  export function extname(path: string): string;
}
declare module 'node:zlib' {
  export function gzipSync(data: string | Uint8Array): { length: number };
}
declare const process: { cwd(): string };
