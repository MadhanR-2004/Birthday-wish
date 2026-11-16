// Small repeatable "random" numbers so scenes look the same every load.
export function seeded(n) {
  const x = Math.sin(n * 9301 + 49297) * 233280;
  return x - Math.floor(x);
}
