import { Renderer } from './renderer.js';
import { Viewport } from './viewport.js';

export function exportBoardAsPng(board) {
  if (!board.elements || board.elements.length === 0) {
    alert("Papan kosong tidak dapat diekspor.");
    return;
  }

  // Calculate bounding box containing all elements
  let minX = Infinity, minY = Infinity;
  let maxX = -Infinity, maxY = -Infinity;

  board.elements.forEach(el => {
    if (el.type === 'freedraw') {
      el.points.forEach(pt => {
        const px = el.x + pt[0];
        const py = el.y + pt[1];
        minX = Math.min(minX, px);
        minY = Math.min(minY, py);
        maxX = Math.max(maxX, px);
        maxY = Math.max(maxY, py);
      });
    } else {
      const halfW = el.width / 2;
      const halfH = el.height / 2;
      minX = Math.min(minX, el.x - halfW);
      minY = Math.min(minY, el.y - halfH);
      maxX = Math.max(maxX, el.x + halfW);
      maxY = Math.max(maxY, el.y + halfH);
    }
  });

  const padding = 50;
  const contentW = (maxX - minX) + padding * 2;
  const contentH = (maxY - minY) + padding * 2;

  // Create an offscreen canvas at 2x scale (Retina resolution)
  const scale = 2;
  const offCanvas = document.createElement('canvas');
  offCanvas.width = contentW * scale;
  offCanvas.height = contentH * scale;

  const ctx = offCanvas.getContext('2d');
  ctx.scale(scale, scale);

  // Set background color
  ctx.fillStyle = board.appState?.viewBackgroundColor || '#ffffff';
  ctx.fillRect(0, 0, contentW, contentH);

  // Configure offscreen viewport to render only the bounding box area
  const offViewport = new Viewport();
  offViewport.zoom = 1.0;
  offViewport.scrollX = -minX + padding;
  offViewport.scrollY = -minY + padding;

  const offRenderer = new Renderer(offCanvas);
  
  // Render all elements sorted by zIndex
  const sorted = [...board.elements].sort((a, b) => (a.zIndex || 0) - (b.zIndex || 0));
  sorted.forEach(el => {
    offRenderer.renderElement(el, ctx, offViewport);
  });

  // Download the PNG
  const dataUrl = offCanvas.toDataURL('image/png');
  const downloadAnchor = document.createElement('a');
  downloadAnchor.setAttribute("href", dataUrl);
  downloadAnchor.setAttribute("download", `${board.title || 'papan-coretan'}.png`);
  document.body.appendChild(downloadAnchor);
  downloadAnchor.click();
  downloadAnchor.remove();
}

export function exportBoardAsSvg(board) {
  if (!board.elements || board.elements.length === 0) {
    alert("Papan kosong tidak dapat diekspor.");
    return;
  }

  // Calculate bounding box containing all elements
  let minX = Infinity, minY = Infinity;
  let maxX = -Infinity, maxY = -Infinity;

  board.elements.forEach(el => {
    if (el.type === 'freedraw') {
      el.points.forEach(pt => {
        const px = el.x + pt[0];
        const py = el.y + pt[1];
        minX = Math.min(minX, px);
        minY = Math.min(minY, py);
        maxX = Math.max(maxX, px);
        maxY = Math.max(maxY, py);
      });
    } else {
      const halfW = el.width / 2;
      const halfH = el.height / 2;
      minX = Math.min(minX, el.x - halfW);
      minY = Math.min(minY, el.y - halfH);
      maxX = Math.max(maxX, el.x + halfW);
      maxY = Math.max(maxY, el.y + halfH);
    }
  });

  const padding = 50;
  const contentW = (maxX - minX) + padding * 2;
  const contentH = (maxY - minY) + padding * 2;

  // Render SVG content wrapper
  let svgContent = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${contentW} ${contentH}" width="${contentW}" height="${contentH}">\n`;
  svgContent += `  <rect width="100%" height="100%" fill="${board.appState?.viewBackgroundColor || '#ffffff'}" />\n`;

  // Draw simple path & shapes
  board.elements.forEach(el => {
    const relX = el.x - minX + padding;
    const relY = el.y - minY + padding;
    const fill = el.backgroundColor && el.backgroundColor !== 'transparent' ? el.backgroundColor : 'none';
    const stroke = el.strokeColor || '#000000';
    const strokeWidth = el.strokeWidth || 2;

    if (el.type === 'rectangle' || el.type === 'sticky') {
      svgContent += `  <rect x="${relX - el.width / 2}" y="${relY - el.height / 2}" width="${el.width}" height="${el.height}" fill="${fill}" stroke="${stroke}" stroke-width="${strokeWidth}" />\n`;
    } else if (el.type === 'ellipse') {
      svgContent += `  <ellipse cx="${relX}" cy="${relY}" rx="${el.width / 2}" ry="${el.height / 2}" fill="${fill}" stroke="${stroke}" stroke-width="${strokeWidth}" />\n`;
    } else if (el.type === 'text' && el.text) {
      const font = el.fontFamily === 'hand' ? 'Caveat, cursive' : 'sans-serif';
      svgContent += `  <text x="${relX}" y="${relY}" font-family="${font}" font-size="${el.fontSize || 16}" fill="${stroke}" text-anchor="middle" dominant-baseline="middle">${el.text}</text>\n`;
    } else if (el.type === 'freedraw') {
      let pathData = '';
      el.points.forEach((pt, idx) => {
        const px = relX + pt[0];
        const py = relY + pt[1];
        if (idx === 0) pathData += `M ${px} ${py}`;
        else pathData += ` L ${px} ${py}`;
      });
      svgContent += `  <path d="${pathData}" fill="none" stroke="${stroke}" stroke-width="${strokeWidth}" stroke-linecap="round" stroke-linejoin="round" />\n`;
    }
  });

  svgContent += `</svg>`;

  const dataStr = "data:image/svg+xml;charset=utf-8," + encodeURIComponent(svgContent);
  const downloadAnchor = document.createElement('a');
  downloadAnchor.setAttribute("href", dataStr);
  downloadAnchor.setAttribute("download", `${board.title || 'papan-coretan'}.svg`);
  document.body.appendChild(downloadAnchor);
  downloadAnchor.click();
  downloadAnchor.remove();
}
