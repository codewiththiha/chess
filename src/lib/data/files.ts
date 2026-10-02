// Export local files and copy notation without network services.
import { AVATAR_PIXELS, isAvatarDataUri } from '../domain/bots';
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

/**
 * Read a bot picture the reader chose and return a small square data URI, so the
 * database stores a bounded string and the app never uploads anything. The image
 * is centre-cropped to a square and scaled down first; when the browser cannot do
 * that, the original bytes are kept only if the stored-size limit still allows it.
 */
export async function readPicture(file: File): Promise<string> {
  if (!file.type.startsWith('image/'))
    throw new Error('Choose an image file (PNG, JPEG, or WebP).');
  const raw = await readAsDataUri(file);
  const scaled = await scalePicture(raw).catch(() => null);
  const result = scaled ?? raw;
  if (!isAvatarDataUri(result))
    throw new Error('That image is too large. Choose one under 200 KB.');
  return result;
}

function readAsDataUri(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.addEventListener(
      'error',
      () => reject(new Error('The picture could not be read.')),
      { once: true },
    );
    reader.addEventListener(
      'load',
      () =>
        typeof reader.result === 'string'
          ? resolve(reader.result)
          : reject(new Error('The picture could not be read.')),
      { once: true },
    );
    reader.readAsDataURL(file);
  });
}

async function scalePicture(source: string): Promise<string> {
  const image = new Image();
  await new Promise<void>((resolve, reject) => {
    image.addEventListener('load', () => resolve(), { once: true });
    image.addEventListener(
      'error',
      () => reject(new Error('The picture could not be decoded.')),
      { once: true },
    );
    image.src = source;
  });
  const size = Math.min(image.width, image.height);
  if (!size) throw new Error('The picture has no pixels.');
  const canvas = document.createElement('canvas');
  canvas.width = AVATAR_PIXELS;
  canvas.height = AVATAR_PIXELS;
  const context = canvas.getContext('2d');
  if (!context) throw new Error('The picture could not be prepared.');
  context.drawImage(
    image,
    (image.width - size) / 2,
    (image.height - size) / 2,
    size,
    size,
    0,
    0,
    AVATAR_PIXELS,
    AVATAR_PIXELS,
  );
  return canvas.toDataURL('image/webp', 0.86);
}
