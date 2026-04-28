import React, { useEffect, useState } from 'react';

function floodFillRemoveBg(imageData, width, height, threshold = 235) {
  const d = imageData.data;
  const visited = new Uint8Array(width * height);
  const queue = [];

  function isWhitish(i) {
    return d[i] > threshold && d[i + 1] > threshold && d[i + 2] > threshold;
  }

  // seed from all four corners
  [[0, 0], [width - 1, 0], [0, height - 1], [width - 1, height - 1]].forEach(([x, y]) => {
    const pos = y * width + x;
    if (isWhitish(pos * 4)) queue.push(pos);
  });

  while (queue.length > 0) {
    const pos = queue.pop();
    if (visited[pos]) continue;
    visited[pos] = 1;
    const i = pos * 4;
    if (!isWhitish(i)) continue;
    d[i + 3] = 0; // make transparent
    const x = pos % width;
    const y = Math.floor(pos / width);
    if (x > 0)          queue.push(pos - 1);
    if (x < width - 1)  queue.push(pos + 1);
    if (y > 0)          queue.push(pos - width);
    if (y < height - 1) queue.push(pos + width);
  }
}

export default function TransparentImage({ src, alt, size = 120 }) {
  const [dataUrl, setDataUrl] = useState(null);

  useEffect(() => {
    let cancelled = false;
    const img = new Image();
    img.crossOrigin = 'anonymous';
    img.onload = () => {
      try {
        const canvas = document.createElement('canvas');
        canvas.width = img.width;
        canvas.height = img.height;
        const ctx = canvas.getContext('2d');
        ctx.drawImage(img, 0, 0);
        const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
        floodFillRemoveBg(imageData, canvas.width, canvas.height);
        ctx.putImageData(imageData, 0, 0);
        if (!cancelled) setDataUrl(canvas.toDataURL());
      } catch {
        if (!cancelled) setDataUrl(src);
      }
    };
    img.onerror = () => {
      if (!cancelled) setDataUrl(src);
    };
    img.src = src;
    return () => { cancelled = true; };
  }, [src]);

  if (!dataUrl) return <div style={{ width: size, height: size, flexShrink: 0 }} />;
  return (
    <img src={dataUrl} alt={alt} style={{ width: size, height: size, objectFit: 'contain', display: 'block', margin: '0 auto', flexShrink: 0 }} />
  );
}
