const MAX_DIMENSION = 1024

export async function compressImage(buffer: Buffer): Promise<Buffer> {
  const sharp = (await import('sharp')).default
  const metadata = await sharp(buffer).metadata()
  const width = metadata.width || 0
  const height = metadata.height || 0

  if (width <= MAX_DIMENSION && height <= MAX_DIMENSION) {
    return sharp(buffer).png({ quality: 90 }).toBuffer()
  }

  return sharp(buffer)
    .resize({
      width: width > height ? MAX_DIMENSION : undefined,
      height: height >= width ? MAX_DIMENSION : undefined,
      fit: 'inside',
      withoutEnlargement: true,
    })
    .png({ quality: 90 })
    .toBuffer()
}
