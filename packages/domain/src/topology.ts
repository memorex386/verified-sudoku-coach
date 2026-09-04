declare const cellBrand: unique symbol;
export type CellId = string & { readonly [cellBrand]: true };
export type Digit = 1 | 2 | 3 | 4 | 5 | 6 | 7 | 8 | 9;
export type Topology = Readonly<
  { type: "classic"; size: 6; boxRows: 2; boxColumns: 3 } |
  { type: "classic"; size: 9; boxRows: 3; boxColumns: 3 }
>;
export type Unit = Readonly<{
  kind: "row" | "column" | "box";
  index: number;
  cells: readonly CellId[];
}>;
const topologies = new WeakSet<object>();

export function createTopology(size: 6 | 9): Topology {
  const topology: Topology = size === 6
    ? { type: "classic", size: 6, boxRows: 2, boxColumns: 3 }
    : size === 9 ? { type: "classic", size: 9, boxRows: 3, boxColumns: 3 }
      : (() => { throw new Error("topology-size"); })();
  topologies.add(topology);
  return Object.freeze(topology);
}

export function requireTopology(topology: Topology): void {
  if (!topologies.has(topology)) throw new Error("untrusted-topology");
}

export function cellId(topology: Topology, value: string): CellId {
  requireTopology(topology);
  if (typeof value !== "string" || !/^r[1-9]c[1-9](?![\s\S])/.test(value) ||
      Number(value[1]) > topology.size || Number(value[3]) > topology.size) throw new Error("cell-id");
  return value as CellId;
}

export function digit(topology: Topology, value: number): Digit {
  requireTopology(topology);
  if (!Number.isSafeInteger(value) || value < 1 || value > topology.size) throw new Error("digit");
  return value as Digit;
}

export function cells(topology: Topology): readonly CellId[] {
  requireTopology(topology);
  return Object.freeze(Array.from({ length: topology.size ** 2 }, (_, i) =>
    cellId(topology, `r${Math.floor(i / topology.size) + 1}c${i % topology.size + 1}`)));
}

export function units(topology: Topology): readonly Unit[] {
  const all = cells(topology);
  const result: Unit[] = [];
  for (const kind of ["row", "column", "box"] as const) {
    for (let index = 1; index <= topology.size; index++) {
      result.push(Object.freeze({ kind, index, cells: Object.freeze(all.filter((cell) => {
        const row = Number(cell[1]) - 1;
        const column = Number(cell[3]) - 1;
        const unit = kind === "row" ? row : kind === "column" ? column :
          Math.floor(row / topology.boxRows) * (topology.size / topology.boxColumns) +
          Math.floor(column / topology.boxColumns);
        return unit === index - 1;
      })) }));
    }
  }
  return Object.freeze(result);
}

export function peers(topology: Topology, cell: CellId): readonly CellId[] {
  cellId(topology, cell);
  const linked = new Set(units(topology).filter((unit) => unit.cells.includes(cell)).flatMap((unit) => unit.cells));
  linked.delete(cell);
  return Object.freeze([...linked].sort());
}
