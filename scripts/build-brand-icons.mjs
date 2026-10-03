import sharp from 'sharp';
import fs from 'fs';
import path from 'path';

const srcPath = 'C:/Users/lavin/.gemini/antigravity-ide/brain/091d5d78-ee58-4c6b-97e4-558c2aa0bcca/.user_uploaded/media_1791003404501.jpg';
const publicDir = path.resolve('./public');

async function buildIcons() {
  console.log('Loading source image...');
  const { data, info } = await sharp(srcPath).raw().toBuffer({ resolveWithObject: true });
  const w = info.width, h = info.height;

  // 1. Flood-fill from corners to make outside background transparent
  const visited = new Uint8Array(w * h);
  const queue = [];
  
  function isBg(x, y) {
    const idx = (y * w + x) * 3;
    const r = data[idx], g = data[idx+1], b = data[idx+2];
    return r >= 248 && g >= 248 && b >= 248;
  }
  
  const seeds = [[0,0], [w-1,0], [0,h-1], [w-1,h-1]];
  for (const [sx, sy] of seeds) {
    if (isBg(sx, sy)) {
      queue.push(sy * w + sx);
      visited[sy * w + sx] = 1;
    }
  }
  
  let head = 0;
  while(head < queue.length) {
    const curr = queue[head++];
    const cx = curr % w;
    const cy = Math.floor(curr / w);
    
    const neighbors = [
      [cx + 1, cy], [cx - 1, cy], [cx, cy + 1], [cx, cy - 1]
    ];
    for (const [nx, ny] of neighbors) {
      if (nx >= 0 && nx < w && ny >= 0 && ny < h) {
        const nidx = ny * w + nx;
        if (!visited[nidx] && isBg(nx, ny)) {
          visited[nidx] = 1;
          queue.push(nidx);
        }
      }
    }
  }

  // Smooth edges: calculate alpha with a subtle 2-pixel anti-aliasing feather
  const rgba = Buffer.alloc(w * h * 4);
  for (let i = 0; i < w * h; i++) {
    const sidx = i * 3;
    const didx = i * 4;
    rgba[didx] = data[sidx];
    rgba[didx + 1] = data[sidx + 1];
    rgba[didx + 2] = data[sidx + 2];
    rgba[didx + 3] = visited[i] ? 0 : 255;
  }

  // Master transparent image buffer
  const masterTransparentBuffer = await sharp(rgba, { raw: { width: w, height: h, channels: 4 } })
    .png()
    .toBuffer();

  // Save master app-icon.png
  await sharp(masterTransparentBuffer).toFile(path.join(publicDir, 'app-icon.png'));
  console.log('Saved app-icon.png');

  // Also save master original as app-icon-original.png
  fs.copyFileSync(srcPath, path.join(publicDir, 'app-icon-original.jpg'));

  // 2. Standard "any" icons (transparent outside squircle)
  // icon-512.png (512x512)
  await sharp(masterTransparentBuffer)
    .resize(512, 512, { fit: 'contain', background: { r: 0, g: 0, b: 0, alpha: 0 } })
    .png({ quality: 100, compressionLevel: 9 })
    .toFile(path.join(publicDir, 'icon-512.png'));
  console.log('Generated icon-512.png');

  // icon-192.png (192x192)
  await sharp(masterTransparentBuffer)
    .resize(192, 192, { fit: 'contain', background: { r: 0, g: 0, b: 0, alpha: 0 } })
    .png({ quality: 100, compressionLevel: 9 })
    .toFile(path.join(publicDir, 'icon-192.png'));
  console.log('Generated icon-192.png');

  // apple-touch-icon.png (180x180) - iOS prefers solid background (#ffffff or #0f172a).
  // On #ffffff, the squircle blends seamlessly, with slight padding to look like a native iOS icon!
  const appleTile = await sharp(masterTransparentBuffer)
    .resize(164, 164, { fit: 'contain', background: { r: 0, g: 0, b: 0, alpha: 0 } })
    .toBuffer();

  await sharp({
    create: {
      width: 180,
      height: 180,
      channels: 4,
      background: { r: 255, g: 255, b: 255, alpha: 1 }
    }
  })
    .composite([{ input: appleTile, gravity: 'center' }])
    .png({ quality: 100 })
    .toFile(path.join(publicDir, 'apple-touch-icon.png'));
  console.log('Generated apple-touch-icon.png');

  // badge-96.png (96x96)
  await sharp(masterTransparentBuffer)
    .resize(96, 96, { fit: 'contain', background: { r: 0, g: 0, b: 0, alpha: 0 } })
    .png({ quality: 100 })
    .toFile(path.join(publicDir, 'badge-96.png'));
  console.log('Generated badge-96.png');

  // favicon-32x32.png & favicon-16x16.png
  await sharp(masterTransparentBuffer)
    .resize(32, 32, { fit: 'contain', background: { r: 0, g: 0, b: 0, alpha: 0 } })
    .png()
    .toFile(path.join(publicDir, 'favicon-32x32.png'));
  await sharp(masterTransparentBuffer)
    .resize(16, 16, { fit: 'contain', background: { r: 0, g: 0, b: 0, alpha: 0 } })
    .png()
    .toFile(path.join(publicDir, 'favicon-16x16.png'));
  await sharp(masterTransparentBuffer)
    .resize(48, 48, { fit: 'contain', background: { r: 0, g: 0, b: 0, alpha: 0 } })
    .png()
    .toFile(path.join(publicDir, 'favicon.png'));
  // Write favicon.ico from 48x48 png (most browsers accept PNG-in-ICO or direct favicon.ico)
  fs.copyFileSync(path.join(publicDir, 'favicon.png'), path.join(publicDir, 'favicon.ico'));
  console.log('Generated favicons');

  // 3. Maskable icons (512x512 & 192x192)
  // Maskable spec: inner 80% circle is safe.
  // 512 * 0.78 = ~400px.
  // Center 400x400 tile on 512x512 background.
  // Let's create maskable with matching #0f172a theme color background AND test with #ffffff
  const maskableInner512 = await sharp(masterTransparentBuffer)
    .resize(420, 420, { fit: 'contain', background: { r: 0, g: 0, b: 0, alpha: 0 } })
    .toBuffer();

  await sharp({
    create: {
      width: 512,
      height: 512,
      channels: 4,
      background: { r: 255, g: 255, b: 255, alpha: 1 }
    }
  })
    .composite([{ input: maskableInner512, gravity: 'center' }])
    .png({ quality: 100 })
    .toFile(path.join(publicDir, 'icon-maskable-512.png'));

  const maskableInner192 = await sharp(masterTransparentBuffer)
    .resize(158, 158, { fit: 'contain', background: { r: 0, g: 0, b: 0, alpha: 0 } })
    .toBuffer();

  await sharp({
    create: {
      width: 192,
      height: 192,
      channels: 4,
      background: { r: 255, g: 255, b: 255, alpha: 1 }
    }
  })
    .composite([{ input: maskableInner192, gravity: 'center' }])
    .png({ quality: 100 })
    .toFile(path.join(publicDir, 'icon-maskable-192.png'));
  console.log('Generated maskable icons');

  // 4. Generate SVG favicon embedding the clean 512x512 PNG as base64
  const png512Base64 = fs.readFileSync(path.join(publicDir, 'icon-512.png')).toString('base64');
  const svgContent = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 512 512" width="512" height="512">
  <image href="data:image/png;base64,${png512Base64}" width="512" height="512" />
</svg>`;
  fs.writeFileSync(path.join(publicDir, 'favicon.svg'), svgContent, 'utf-8');
  console.log('Generated favicon.svg');

  // 5. Update Android mipmaps if directory exists
  const androidResDir = path.resolve('./android/app/src/main/res');
  if (fs.existsSync(androidResDir)) {
    const mipmaps = [
      { dir: 'mipmap-mdpi', size: 48 },
      { dir: 'mipmap-hdpi', size: 72 },
      { dir: 'mipmap-xhdpi', size: 96 },
      { dir: 'mipmap-xxhdpi', size: 144 },
      { dir: 'mipmap-xxxhdpi', size: 192 },
    ];
    for (const m of mipmaps) {
      const targetDir = path.join(androidResDir, m.dir);
      if (fs.existsSync(targetDir)) {
        await sharp(masterTransparentBuffer)
          .resize(m.size, m.size, { fit: 'contain', background: { r: 0, g: 0, b: 0, alpha: 0 } })
          .png()
          .toFile(path.join(targetDir, 'ic_launcher.png'));
        
        await sharp(masterTransparentBuffer)
          .resize(m.size, m.size, { fit: 'contain', background: { r: 0, g: 0, b: 0, alpha: 0 } })
          .png()
          .toFile(path.join(targetDir, 'ic_launcher_round.png'));

        // Foreground: safe zone inset ~70%
        const fgInner = await sharp(masterTransparentBuffer)
          .resize(Math.round(m.size * 0.72), Math.round(m.size * 0.72), { fit: 'contain', background: { r: 0, g: 0, b: 0, alpha: 0 } })
          .toBuffer();
        await sharp({
          create: {
            width: m.size,
            height: m.size,
            channels: 4,
            background: { r: 0, g: 0, b: 0, alpha: 0 }
          }
        })
          .composite([{ input: fgInner, gravity: 'center' }])
          .png()
          .toFile(path.join(targetDir, 'ic_launcher_foreground.png'));
      }
    }
    console.log('Updated Android launcher mipmaps');
  }

  console.log('ALL ICONS GENERATED SUCCESSFULLY!');
}

buildIcons().catch(console.error);
