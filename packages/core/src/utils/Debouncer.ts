/**
 * Debouncer - delays execution until after wait ms of inactivity
 */

export class Debouncer<T extends unknown[] = []> {
  private timeoutId: ReturnType<typeof setTimeout> | null = null;

  constructor(
    private readonly fn: (...args: T) => void | Promise<void>,
    private readonly waitMs: number
  ) {}

  run(...args: T): void {
    if (this.timeoutId) clearTimeout(this.timeoutId);
    this.timeoutId = setTimeout(() => {
      this.timeoutId = null;
      void this.fn(...args);
    }, this.waitMs);
  }

  cancel(): void {
    if (this.timeoutId) {
      clearTimeout(this.timeoutId);
      this.timeoutId = null;
    }
  }

  flush(...args: T): void {
    this.cancel();
    void this.fn(...args);
  }
}
