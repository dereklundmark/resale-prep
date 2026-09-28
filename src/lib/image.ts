// Photos are shrunk on the device before they're stored, so an iPhone's
// 3–5 MB original becomes ~150 KB. That keeps browser storage small now and
// keeps the Azure SQL free tier (32 GB) effectively unlimited in layer 3.

const FULL_EDGE = 1280;
const THUMB_EDGE = 160;

function canvasToJpeg(canvas: HTMLCanvasElement, quality: number): Promise<Blob> {
  return new Promise((resolve, reject) =>
    canvas.toBlob((b) => (b ? resolve(b) : reject(new Error('Could not encode photo'))), 'image/jpeg', quality),
  );
}

function draw(
  img: ImageBitmap,
  w: number,
  h: number,
  sx = 0,
  sy = 0,
  sw = img.width,
  sh = img.height,
): HTMLCanvasElement {
  const c = document.createElement('canvas');
  c.width = w;
  c.height = h;
  const ctx = c.getContext('2d');
  if (!ctx) throw new Error('Canvas unavailable');
  ctx.imageSmoothingQuality = 'high';
  ctx.drawImage(img, sx, sy, sw, sh, 0, 0, w, h);
  return c;
}

export async function compressPhoto(file: Blob): Promise<{ full: Blob; thumb: Blob }> {
  // createImageBitmap applies the EXIF rotation, so portrait phone shots stay upright.
  const img = await createImageBitmap(file, { imageOrientation: 'from-image' });
  try {
    const scale = Math.min(1, FULL_EDGE / Math.max(img.width, img.height));
    const full = await canvasToJpeg(draw(img, Math.round(img.width * scale), Math.round(img.height * scale)), 0.8);

    // Centre-crop to a square for the list thumbnail.
    const side = Math.min(img.width, img.height);
    const thumbCanvas = draw(img, THUMB_EDGE, THUMB_EDGE, (img.width - side) / 2, (img.height - side) / 2, side, side);
    const thumb = await canvasToJpeg(thumbCanvas, 0.75);
    return { full, thumb };
  } finally {
    img.close();
  }
}
