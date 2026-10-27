// Group photos are shrunk on the phone before uploading
// (Plans/Accounts-groups-and-chat.md section 4): quicker on mobile data, and
// well under the bucket's 1 MB limit.

/** The longest side of an uploaded photo, in pixels. */
export const PHOTO_MAX = 1280

/** The size a photo is shrunk to: the longest side at most `max`, never enlarged. */
export function fitWithin(width: number, height: number, max = PHOTO_MAX): { width: number; height: number } {
  const scale = Math.min(1, max / Math.max(width, height))
  return { width: Math.round(width * scale), height: Math.round(height * scale) }
}

/** Shrinks a photo and turns it into a JPEG (the phone turns iPhone photos into something it can read). */
export async function shrinkPhoto(file: File): Promise<Blob> {
  const bitmap = await createImageBitmap(file)
  const { width, height } = fitWithin(bitmap.width, bitmap.height)
  const canvas = document.createElement('canvas')
  canvas.width = width
  canvas.height = height
  canvas.getContext('2d')?.drawImage(bitmap, 0, 0, width, height)
  bitmap.close()
  return new Promise((resolve, reject) =>
    canvas.toBlob(
      (blob) => (blob ? resolve(blob) : reject(new Error('Could not read that photo. Try another one.'))),
      'image/jpeg',
      0.85,
    ),
  )
}
