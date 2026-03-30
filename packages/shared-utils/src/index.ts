export function createId(prefix: string): string {
  const value = Math.random().toString(36).slice(2, 10);
  return `${prefix}_${value}`;
}

export function nowIso(): string {
  return new Date().toISOString();
}

