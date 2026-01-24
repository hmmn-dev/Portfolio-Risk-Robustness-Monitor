export function stableSort<T>(arr: T[], cmp: (a: T, b: T) => number): T[] {
  return arr
    .map((v, i) => ({ v, i }))
    .sort((a, b) => cmp(a.v, b.v) || a.i - b.i)
    .map((x) => x.v)
}
