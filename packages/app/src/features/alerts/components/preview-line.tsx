export function PreviewLine({ count }: { count: number | null | undefined }) {
  if (count === undefined) {
    return <p className="type-data text-muted-foreground">Checking past 7 days…</p>;
  }
  if (count === null) {
    return <p className="type-data text-muted-foreground">Not enough history to check</p>;
  }
  return (
    <p className="type-data text-muted-foreground">
      Would have fired <span className="tabular-nums">{count}</span>{" "}
      {count === 1 ? "time" : "times"}
    </p>
  );
}
