// Compress/resize an image File to a reasonable size before upload, keeping
// storage light. Returns a JPEG blob plus its dimensions.
export async function compressImage(file, maxDim = 1600, quality = 0.82) {
  const bitmap = await createImageBitmap(file)
  let { width, height } = bitmap
  if (width > maxDim || height > maxDim) {
    const scale = maxDim / Math.max(width, height)
    width = Math.round(width * scale)
    height = Math.round(height * scale)
  }
  const canvas = document.createElement('canvas')
  canvas.width = width
  canvas.height = height
  const ctx = canvas.getContext('2d')
  ctx.drawImage(bitmap, 0, 0, width, height)
  bitmap.close?.()

  const blob = await new Promise((resolve) => canvas.toBlob(resolve, 'image/jpeg', quality))
  return { blob, width, height }
}
