// Distinguish rejected saved records from an unavailable IndexedDB database.
export class SavedDataError extends Error {
  constructor(message: string, cause: unknown) {
    super(message, { cause });
    this.name = 'SavedDataError';
  }
}
