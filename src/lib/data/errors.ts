// Distinguish rejected saved records from an unavailable IndexedDB database.
export class SavedDataError extends Error {
  constructor(message: string, cause: unknown = undefined) {
    super(message, { cause });
    this.name = 'SavedDataError';
  }
}
