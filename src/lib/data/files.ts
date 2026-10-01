// Export local files and copy notation without network services.
export function download(
  text: string,
  filename: string,
  type = 'application/x-chess-pgn',
): void {
  const url = URL.createObjectURL(new Blob([text], { type }));
  const anchor = document.createElement('a');
  anchor.href = url;
  anchor.download = filename.replace(/[^a-zA-Z0-9_. -]/g, '_');
  anchor.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
export async function copyText(text: string): Promise<void> {
  if (!navigator.clipboard)
    throw new Error(
      'Clipboard access is unavailable. Export a PGN file instead.',
    );
  await navigator.clipboard.writeText(text);
}
