export const IMAGE_MIME_TYPES = ['image/jpeg', 'image/png', 'image/webp', 'image/gif'] as const;
export type ImageMediaType = (typeof IMAGE_MIME_TYPES)[number];

export function isSupportedImage(mime: string): mime is ImageMediaType {
  return (IMAGE_MIME_TYPES as readonly string[]).includes(mime);
}

export function fileToBase64(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onerror = () => reject(reader.error ?? new Error('read_failed'));
    reader.onload = () => {
      const dataUrl = String(reader.result ?? '');
      const i = dataUrl.indexOf(',');
      resolve(i >= 0 ? dataUrl.slice(i + 1) : dataUrl);
    };
    reader.readAsDataURL(file);
  });
}
