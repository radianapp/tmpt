export class Viewport {
  constructor() {
    this.scrollX = 0; // World space offset X
    this.scrollY = 0; // World space offset Y
    this.zoom = 1.0;  // Zoom scale: 0.1 - 10.0
  }

  toScreen(wx, wy) {
    return {
      x: (wx + this.scrollX) * this.zoom,
      y: (wy + this.scrollY) * this.zoom,
    };
  }

  toWorld(sx, sy) {
    return {
      x: (sx / this.zoom) - this.scrollX,
      y: (sy / this.zoom) - this.scrollY,
    };
  }

  pan(dx, dy) {
    // dx and dy are screen delta
    this.scrollX += dx / this.zoom;
    this.scrollY += dy / this.zoom;
  }

  zoomAt(sx, sy, factor) {
    const prevZoom = this.zoom;
    const nextZoom = Math.min(10.0, Math.max(0.1, prevZoom * factor));

    if (prevZoom === nextZoom) return;

    // Pin the point (sx, sy) under the zoom
    const wx = (sx / prevZoom) - this.scrollX;
    const wy = (sy / prevZoom) - this.scrollY;

    this.zoom = nextZoom;
    this.scrollX = (sx / nextZoom) - wx;
    this.scrollY = (sy / nextZoom) - wy;
  }

  reset() {
    this.scrollX = 0;
    this.scrollY = 0;
    this.zoom = 1.0;
  }

  fitToElements(elements, width, height) {
    if (!elements || elements.length === 0) {
      this.reset();
      return;
    }

    let minX = Infinity, minY = Infinity;
    let maxX = -Infinity, maxY = -Infinity;

    elements.forEach(el => {
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

    const padding = 100;
    const boardW = (maxX - minX) + padding * 2;
    const boardH = (maxY - minY) + padding * 2;

    this.zoom = Math.min(width / boardW, height / boardH, 2.0); // Cap zoom at 2.0 for fit
    this.zoom = Math.max(0.2, this.zoom); // Floor at 0.2

    this.scrollX = -minX + (width / this.zoom - (maxX - minX)) / 2;
    this.scrollY = -minY + (height / this.zoom - (maxY - minY)) / 2;
  }
}
