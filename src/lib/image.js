// Compress/resize an image File before upload. Images that can carry
// transparency (PNG/WebP/GIF/SVG) are kept as WebP (alpha-capable) so a
// transparent background stays transparent instead of turning black; opaque
// photos become JPEG for size.
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

  const alpha = /png|webp|gif|svg/i.test(file.type)
  const toBlob = (type, q) => new Promise((resolve) => canvas.toBlob(resolve, type, q))

  let type = alpha ? 'image/webp' : 'image/jpeg'
  let ext = alpha ? 'webp' : 'jpg'
  let blob = await toBlob(type, quality)

  // Fallback if the browser can't encode WebP.
  if (!blob && alpha) {
    type = 'image/png'
    ext = 'png'
    blob = await toBlob('image/png')
  }
  if (!blob) {
    type = 'image/jpeg'
    ext = 'jpg'
    blob = await toBlob('image/jpeg', quality)
  }

  return { blob, width, height, type, ext }
}
