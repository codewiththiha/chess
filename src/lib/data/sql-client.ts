// Talk to the SQLite worker from the application thread with request identity.
export interface DatabaseStatus {
  persistent: boolean;
  version: string;
  notes: string;
}

interface Pending {
  resolve(value: unknown): void;
  reject(error: Error): void;
}

export class SqlClient {
  private worker: Worker | null = null;
  private pending = new Map<number, Pending>();
  private sequence = 0;
  private opening: Promise<DatabaseStatus> | null = null;
  private status: DatabaseStatus | null = null;

  get persistent(): boolean {
    return this.status?.persistent ?? false;
  }

  get version(): string {
    return this.status?.version ?? '';
  }

  get notes(): string {
    return this.status?.notes ?? '';
  }

  open(): Promise<DatabaseStatus> {
    this.opening ??= new Promise<DatabaseStatus>((resolve, reject) => {
      const worker = new Worker(
        new URL('./sqlite-worker.ts', import.meta.url),
        {
          type: 'module',
          name: 'sqlite',
        },
      );
      this.worker = worker;
      worker.addEventListener(
        'message',
        (event: MessageEvent<Record<string, unknown>>) => {
          const message = event.data ?? {};
          if (message.type === 'ready') {
            this.status = {
              persistent: message.persistent === true,
              version:
                typeof message.version === 'string' ? message.version : '',
              notes: typeof message.notes === 'string' ? message.notes : '',
            };
            resolve(this.status);
            return;
          }
          if (message.type === 'failed') {
            const error = new Error(
              typeof message.message === 'string'
                ? message.message
                : 'The local database could not start.',
            );
            this.status = null;
            this.fail(error);
            reject(error);
            return;
          }
          const id = message.id;
          if (typeof id !== 'number') return;
          const entry = this.pending.get(id);
          if (!entry) return;
          this.pending.delete(id);
          if (message.type === 'result') entry.resolve(message.value);
          else
            entry.reject(
              new Error(
                typeof message.message === 'string'
                  ? message.message
                  : 'Database operation failed.',
              ),
            );
        },
      );
      worker.addEventListener('error', (event) => {
        const error = new Error(event.message || 'The database worker failed.');
        this.status = null;
        this.fail(error);
        reject(error);
      });
      worker.addEventListener('messageerror', () => {
        const error = new Error(
          'The database worker returned unreadable data.',
        );
        this.fail(error);
        reject(error);
      });
    });
    return this.opening;
  }

  private fail(error: Error): void {
    for (const entry of this.pending.values()) entry.reject(error);
    this.pending.clear();
  }

  call<T>(method: string, ...args: unknown[]): Promise<T> {
    const worker = this.worker;
    if (!worker)
      return Promise.reject(new Error('The local database is closed.'));
    const id = ++this.sequence;
    return new Promise<T>((resolve, reject) => {
      this.pending.set(id, {
        resolve: (value) => {
          resolve(value as T);
        },
        reject,
      });
      try {
        // oxlint-disable-next-line unicorn/require-post-message-target-origin -- Worker messages take transferables, not Window targetOrigin.
        worker.postMessage({ id, method, args });
      } catch (error) {
        this.pending.delete(id);
        reject(error instanceof Error ? error : new Error(String(error)));
      }
    });
  }

  close(): void {
    this.worker?.terminate();
    this.worker = null;
    this.status = null;
    this.opening = null;
    this.fail(new Error('The local database was closed.'));
  }
}
