import en from './en.json';

export type MessageKey = keyof typeof en;
export type Vars = Record<string, string | number>;

/** Looks up a UI string by key and fills `{name}` placeholders. A missing key fails the typecheck. */
export function t(key: MessageKey, vars?: Vars): string {
  const text: string = en[key];
  if (!vars) return text;
  return text.replace(/\{(\w+)\}/g, (whole, name: string) => (name in vars ? String(vars[name]) : whole));
}
