export async function getPerspectiveCroppedFile(image: HTMLImageElement, points: PerspectiveCorners): Promise<File> {
  const imageWidth = image.naturalWidth;
  const imageHeight = image.naturalHeight;
  if (!imageWidth || !imageHeight) throw new Error('Image has no readable dimensions');

  // Corner values are normalized against the original image, not its displayed size.
  const source = points.map(({ x, y }) => ({
    x: Math.max(0, Math.min(1, x)) * imageWidth,
    y: Math.max(0, Math.min(1, y)) * imageHeight,
  }));
  const [tl, tr, br, bl] = source;
  const width = Math.max(Math.hypot(tr.x - tl.x, tr.y - tl.y), Math.hypot(br.x - bl.x, br.y - bl.y));
  const height = Math.max(Math.hypot(bl.x - tl.x, bl.y - tl.y), Math.hypot(br.x - tr.x, br.y - tr.y));
  if (width < 2 || height < 2) throw new Error('Select a larger receipt area');

  const outputScale = Math.min(1, 1400 / Math.max(width, height));
  const outputWidth = Math.max(1, Math.round(width * outputScale));
  const outputHeight = Math.max(1, Math.round(height * outputScale));
  const canvas = document.createElement('canvas');
  canvas.width = outputWidth;
  canvas.height = outputHeight;
  const ctx = canvas.getContext('2d');
  if (!ctx) throw new Error('Canvas 2D context is not available');

  // Bound source pixel memory for large phone photos while retaining original-point mapping.
  const sourceScale = Math.min(1, 2400 / Math.max(imageWidth, imageHeight));
  const sourceWidth = Math.max(1, Math.round(imageWidth * sourceScale));
  const sourceHeight = Math.max(1, Math.round(imageHeight * sourceScale));
  const sourceCanvas = document.createElement('canvas');
  sourceCanvas.width = sourceWidth;
  sourceCanvas.height = sourceHeight;
  const sourceCtx = sourceCanvas.getContext('2d', { willReadFrequently: true });
  if (!sourceCtx) throw new Error('Canvas 2D context is not available');
  sourceCtx.drawImage(image, 0, 0, sourceWidth, sourceHeight);
  const toBlobFile = () => new Promise<File>((resolve, reject) => {
    try {
      canvas.toBlob((blob) => {
        if (!blob || blob.size === 0) {
          reject(new Error('Canvas is empty'));
          return;
        }
        resolve(new File([blob], 'receipt.jpg', { type: 'image/jpeg' }));
      }, 'image/jpeg', 0.9);
    } catch (cause) {
      reject(cause);
    }
  });

  try {
    // Solve the projective transform from the selected quadrilateral to the output rectangle.
    const dx1 = tr.x - br.x;
    const dx2 = bl.x - br.x;
    const dx3 = tl.x - tr.x + br.x - bl.x;
    const dy1 = tr.y - br.y;
    const dy2 = bl.y - br.y;
    const dy3 = tl.y - tr.y + br.y - bl.y;
    const denominator = dx1 * dy2 - dx2 * dy1;
    let g = 0;
    let h = 0;
    if (Math.abs(dx3) + Math.abs(dy3) >= 1e-8) {
      if (!Number.isFinite(denominator) || Math.abs(denominator) < 1e-8) throw new Error('Degenerate perspective matrix');
      g = (dx3 * dy2 - dx2 * dy3) / denominator;
      h = (dx1 * dy3 - dx3 * dy1) / denominator;
    }
    if (!Number.isFinite(g) || !Number.isFinite(h)) throw new Error('Degenerate perspective matrix');

    const a = tr.x - tl.x + g * tr.x;
    const b = bl.x - tl.x + h * bl.x;
    const c = tl.x;
    const d = tr.y - tl.y + g * tr.y;
    const e = bl.y - tl.y + h * bl.y;
    const f = tl.y;
    const pixels = sourceCtx.getImageData(0, 0, sourceWidth, sourceHeight);
    const output = ctx.createImageData(outputWidth, outputHeight);

    for (let y = 0; y < outputHeight; y++) {
      for (let x = 0; x < outputWidth; x++) {
        const u = x / (outputWidth - 1 || 1);
        const v = y / (outputHeight - 1 || 1);
        const divisor = g * u + h * v + 1;
        if (!Number.isFinite(divisor) || Math.abs(divisor) < 1e-8) throw new Error('Degenerate perspective mapping');
        const sx = ((a * u + b * v + c) / divisor) * sourceScale;
        const sy = ((d * u + e * v + f) / divisor) * sourceScale;
        const x0 = Math.floor(sx);
        const y0 = Math.floor(sy);
        if (x0 < 0 || y0 < 0 || x0 >= sourceWidth || y0 >= sourceHeight) continue;
        const x1 = Math.min(x0 + 1, sourceWidth - 1);
        const y1 = Math.min(y0 + 1, sourceHeight - 1);
        const fx = sx - x0;
        const fy = sy - y0;
        const target = (y * outputWidth + x) * 4;
        for (let channel = 0; channel < 4; channel++) {
          const topLeft = pixels.data[(y0 * sourceWidth + x0) * 4 + channel];
          const topRight = pixels.data[(y0 * sourceWidth + x1) * 4 + channel];
          const bottomLeft = pixels.data[(y1 * sourceWidth + x0) * 4 + channel];
          const bottomRight = pixels.data[(y1 * sourceWidth + x1) * 4 + channel];
          output.data[target + channel] = topLeft * (1 - fx) * (1 - fy) + topRight * fx * (1 - fy) + bottomLeft * (1 - fx) * fy + bottomRight * fx * fy;
        }
      }
    }
    ctx.putImageData(output, 0, 0);
    return await toBlobFile();
  } catch {
    // Keep scanning usable when a dragged quadrilateral produces a singular transform.
    const left = Math.min(tl.x, tr.x, br.x, bl.x) * sourceScale;
    const top = Math.min(tl.y, tr.y, br.y, bl.y) * sourceScale;
    const right = Math.max(tl.x, tr.x, br.x, bl.x) * sourceScale;
    const bottom = Math.max(tl.y, tr.y, br.y, bl.y) * sourceScale;
    const cropWidth = Math.max(1, right - left);
    const cropHeight = Math.max(1, bottom - top);
    ctx.clearRect(0, 0, outputWidth, outputHeight);
    ctx.drawImage(sourceCanvas, left, top, cropWidth, cropHeight, 0, 0, outputWidth, outputHeight);
    return await toBlobFile();
  }
}

export type Corner = { x: number; y: number };
export type PerspectiveCorners = [Corner, Corner, Corner, Corner];

export interface PixelCrop {
  x: number;
  y: number;
  width: number;
  height: number;
}

const createImage = (url: string): Promise<HTMLImageElement> =>
  new Promise((resolve, reject) => {
    const image = new Image();
    image.addEventListener('load', () => resolve(image));
    image.addEventListener('error', (error) => reject(error));
    image.setAttribute('crossOrigin', 'anonymous');
    image.src = url;
  });

export async function getCroppedImg(imageSrc: string, pixelCrop: PixelCrop): Promise<File> {
  const image = await createImage(imageSrc);
  const canvas = document.createElement('canvas');
  const ctx = canvas.getContext('2d');

  if (!ctx) {
    throw new Error('Canvas 2D context is not available');
  }

  canvas.width = pixelCrop.width;
  canvas.height = pixelCrop.height;

  ctx.drawImage(
    image,
    pixelCrop.x,
    pixelCrop.y,
    pixelCrop.width,
    pixelCrop.height,
    0,
    0,
    pixelCrop.width,
    pixelCrop.height
  );

  return new Promise((resolve, reject) => {
    canvas.toBlob((blob) => {
      if (!blob) {
        reject(new Error('Canvas is empty'));
        return;
      }
      resolve(new File([blob], 'cropped_receipt.jpg', { type: 'image/jpeg' }));
    }, 'image/jpeg', 0.95);
  });
}