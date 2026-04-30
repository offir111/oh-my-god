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
    if (x > 0) queue.push(pos - 1);
    if (x < width - 1) queue.push(pos + 1);
    if (y > 0) queue.push(pos - width);
    if (y < height - 1) queue.push(pos + width);
  }
}

function opaquePixelRatio(imageData) {
  const d = imageData.data;
  let opaque = 0;
  for (let i = 3; i < d.length; i += 4) {
    if (d[i] > 16) opaque += 1;
  }
  return opaque / (d.length / 4);
}

/** crossOrigin גורם לכשלי טעינה ב־WebView / נתיבים יחסיים; משתמשים בו רק ל־HTTP ממש מחוצה למקור הדף */
function shouldUseCrossOrigin(src) {
  if (typeof window === 'undefined' || !src || !/^https?:\/\//i.test(src)) return false;
  try {
    return !src.startsWith(window.location.origin);
  } catch {
    return false;
  }
}

export default function TransparentImage({
  src,
  alt = '',
  width,
  height,
  className,
  style,
  /** ברירת המחדל חזקה; לדמויות הבית הגבוה משמר קצוות ובשר הדמויות אחרי עיבוד בקלאוד */
  whiteThreshold = 235,
  loading,
  decoding,
}) {
  const [displaySrc, setDisplaySrc] = useState(src);

  useEffect(() => {
    let cancelled = false;
    setDisplaySrc(src);
    const img = new Image();
    if (shouldUseCrossOrigin(src)) img.crossOrigin = 'anonymous';
    img.onload = () => {
      try {
        const canvas = document.createElement('canvas');
        canvas.width = img.width;
        canvas.height = img.height;
        const ctx = canvas.getContext('2d');
        ctx.drawImage(img, 0, 0);
        const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
        floodFillRemoveBg(imageData, canvas.width, canvas.height, whiteThreshold);
        if (opaquePixelRatio(imageData) < 0.03) {
          if (!cancelled) setDisplaySrc(src);
          return;
        }
        ctx.putImageData(imageData, 0, 0);
        if (!cancelled) setDisplaySrc(canvas.toDataURL());
      } catch {
        if (!cancelled) setDisplaySrc(src);
      }
    };
    img.onerror = () => {
      if (!cancelled) setDisplaySrc(src);
    };
    img.src = src;
    return () => { cancelled = true; };
  }, [src, whiteThreshold]);

  return (
    <img
      src={displaySrc || src}
      alt={alt}
      width={width}
      height={height}
      className={className}
      loading={loading}
      decoding={decoding}
      draggable={false}
      style={{ objectFit: 'contain', display: 'block', margin: '0 auto', flexShrink: 0, ...(style || {}) }}
    />
  );
}
