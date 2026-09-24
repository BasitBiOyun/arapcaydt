/** Serialize writes so an older network response cannot overwrite a newer edit. */
export function createSaveQueue<T>(write: (value: T) => Promise<T>) {
  let tail: Promise<unknown> = Promise.resolve();
  const pending = new Map<T, Promise<T>>();
  return (value: T): Promise<T> => {
    const existing = pending.get(value);
    if (existing) return existing;
    const result = tail.then(() => write(value));
    pending.set(value, result);
    void result.then(() => pending.delete(value), () => pending.delete(value));
    tail = result.catch(() => undefined);
    return result;
  };
}
