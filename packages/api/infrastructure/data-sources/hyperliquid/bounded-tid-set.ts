// Bounded FIFO set of recently seen trade ids. The audit listener runs on the
// sync transport callback, so dedupe state is kept as a plain bounded Map.
export class BoundedTidSet {
  private readonly seen = new Map<number, true>();

  constructor(private readonly max: number) {}

  has(tid: number): boolean {
    return this.seen.has(tid);
  }

  add(tid: number): void {
    this.seen.set(tid, true);
    if (this.seen.size > this.max) {
      const oldest = this.seen.keys().next().value;
      if (oldest !== undefined) this.seen.delete(oldest);
    }
  }
}
