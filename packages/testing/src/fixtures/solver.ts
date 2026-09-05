/** Exact 9x9 counting solver, independent of domain candidates and technique implementations. */
export function readGrid(grid: string): number[] {
  if (typeof grid !== "string" || !/^[0-9]{81}(?![\s\S])/.test(grid)) throw new Error("invalid-grid");
  return [...grid].map(Number);
}

/** Returns 2 for at least two solutions. Conflicting givens are rejected, not repaired. */
export function countSolutions(grid: string): 0 | 1 | 2 {
  const values = readGrid(grid);
  const rows = new Uint16Array(9), columns = new Uint16Array(9), boxes = new Uint16Array(9);
  const boxOf = (i: number): number => 3 * Math.floor(i / 27) + Math.floor((i % 9) / 3);
  for (let i = 0; i < 81; i++) {
    const digit = values[i]!;
    if (digit === 0) continue;
    const r = Math.floor(i / 9), c = i % 9, b = boxOf(i), bit = 1 << (digit - 1);
    if ((rows[r]! | columns[c]! | boxes[b]!) & bit) throw new Error("conflicting-givens");
    rows[r] = rows[r]! | bit; columns[c] = columns[c]! | bit; boxes[b] = boxes[b]! | bit;
  }
  let count: 0 | 1 | 2 = 0;
  const search = (): void => {
    if (count === 2) return;
    let target = -1, targetMask = 0, minimum = 10;
    for (let i = 0; i < 81; i++) {
      if (values[i] !== 0) continue;
      const mask = 511 & ~(rows[Math.floor(i / 9)]! | columns[i % 9]! | boxes[boxOf(i)]!);
      if (mask === 0) return;
      let bits = mask, size = 0;
      while (bits) { bits &= bits - 1; size++; }
      // Strictly smaller preserves row-major ties. Scan all cells to detect contradictions.
      if (size < minimum) { minimum = size; target = i; targetMask = mask; }
    }
    if (target === -1) { count++; return; }
    const r = Math.floor(target / 9), c = target % 9, b = boxOf(target);
    for (let digit = 1; digit <= 9; digit++) {
      const bit = 1 << (digit - 1);
      if (!(targetMask & bit)) continue;
      values[target] = digit;
      rows[r] = rows[r]! | bit; columns[c] = columns[c]! | bit; boxes[b] = boxes[b]! | bit;
      search();
      values[target] = 0;
      rows[r] = rows[r]! & ~bit; columns[c] = columns[c]! & ~bit; boxes[b] = boxes[b]! & ~bit;
      if (Number(count) === 2) return;
    }
  };
  search();
  return count;
}
