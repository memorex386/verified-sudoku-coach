// Independent test oracle: Algorithm X over the 324 Sudoku constraints, without bit masks,
// domain candidate helpers, fixture generator imports, or technique rules.
export function exactCoverCount(grid) {
  const rows = [];
  const columns = new Map(Array.from({ length: 324 }, (_, index) => [index, new Set()]));
  for (let cell = 0; cell < 81; cell++) {
    const r = Math.floor(cell / 9), c = cell % 9, box = Math.floor(r / 3) * 3 + Math.floor(c / 3);
    for (let d = 0; d < 9; d++) {
      if (grid[cell] !== "0" && Number(grid[cell]) !== d + 1) continue;
      const constraints = [cell, 81 + r * 9 + d, 162 + c * 9 + d, 243 + box * 9 + d];
      const row = rows.length;
      rows.push(constraints);
      for (const constraint of constraints) columns.get(constraint).add(row);
    }
  }
  let solutions = 0;
  function search() {
    if (columns.size === 0) { solutions++; return; }
    let smallest;
    for (const candidates of columns.values()) if (!smallest || candidates.size < smallest.size) smallest = candidates;
    for (const selected of [...smallest]) {
      const removed = [];
      for (const constraint of rows[selected]) {
        const candidates = columns.get(constraint);
        for (const row of candidates) for (const other of rows[row]) {
          if (other !== constraint) columns.get(other)?.delete(row);
        }
        removed.push([constraint, candidates]);
        columns.delete(constraint);
      }
      search();
      for (const [constraint, candidates] of removed.reverse()) {
        columns.set(constraint, candidates);
        for (const row of candidates) for (const other of rows[row]) {
          if (other !== constraint) columns.get(other)?.add(row);
        }
      }
      if (solutions >= 2) return;
    }
  }
  search();
  return solutions;
}
