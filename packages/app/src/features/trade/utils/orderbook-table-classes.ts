// Table cell/head classes — import directly by full name to aid tree-shaking.
const PAD = "px-2 py-1";
const HEAD = `h-(--table-head-h) ${PAD} type-label font-medium text-muted-foreground uppercase tracking-wider`;
const CELL_CLASS = `${PAD} type-data whitespace-nowrap`;
const CELL_NUM_CLASS = `${CELL_CLASS} text-right tabular-nums col-num`;
export const CELL_HEAD_CLASS = HEAD;
export const CELL_HEAD_NUM_CLASS = `${HEAD} text-right col-num whitespace-nowrap`;

// Short aliases for ergonomic use across table components
export const c = CELL_CLASS;
export const cNum = CELL_NUM_CLASS;
export const cHead = CELL_HEAD_CLASS;
export const cHeadNum = CELL_HEAD_NUM_CLASS;
