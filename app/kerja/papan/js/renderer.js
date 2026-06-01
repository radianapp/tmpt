// Custom Hand-drawn & Freehand Rendering Engine for TMPT Papan
// Simulates Rough.js (sketchy shapes using seed-based deterministic jitter)
// and Perfect Freehand (variable-width smoothing for freehand drawing)

export class Renderer {
  constructor(canvas) {
    this.canvas = canvas;
    this.ctx = canvas.getContext('2d');
  }

  // LCG Pseudo-Random generator for deterministic sketching
  random(seed, index) {
    const x = Math.sin(seed + index * 37.4) * 10000;
    return x - Math.floor(x); // returns 0..1
  }

  getJitterOffset(seed, index, magnitude) {
    const r = this.random(seed, index);
    return (r - 0.5) * magnitude;
  }

  // Draw a sketchy line from (x1, y1) to (x2, y2)
  drawSketchyLine(ctx, x1, y1, x2, y2, seed, roughness, strokeColor, strokeWidth, strokeStyle) {
    ctx.save();
    ctx.strokeStyle = strokeColor;
    ctx.lineWidth = strokeWidth;

    if (strokeStyle === 'dashed') ctx.setLineDash([8, 8]);
    else if (strokeStyle === 'dotted') ctx.setLineDash([2, 6]);
    else ctx.setLineDash([]);

    if (roughness === 0) {
      // Clean render
      ctx.beginPath();
      ctx.moveTo(x1, y1);
      ctx.lineTo(x2, y2);
      ctx.stroke();
      ctx.restore();
      return;
    }

    // Sketchy render: Draw line twice with jitter
    const len = Math.hypot(x2 - x1, y2 - y1);
    const jitterMagnitude = roughness * 2.5;

    for (let pass = 0; pass < 2; pass++) {
      ctx.beginPath();
      ctx.moveTo(
        x1 + this.getJitterOffset(seed + pass * 100, 1, jitterMagnitude),
        y1 + this.getJitterOffset(seed + pass * 100, 2, jitterMagnitude)
      );

      // Generate intermediate points for curvature
      const midX = (x1 + x2) / 2;
      const midY = (y1 + y2) / 2;
      
      // Calculate perpendicular offset for curve
      const dx = x2 - x1;
      const dy = y2 - y1;
      const nx = -dy / len;
      const ny = dx / len;
      
      const jitterMid = this.getJitterOffset(seed + pass * 100, 3, jitterMagnitude);
      const curveOffset = (this.random(seed + pass * 100, 4) - 0.5) * (len * 0.02 * roughness);

      const mx = midX + nx * (jitterMid + curveOffset);
      const my = midY + ny * (jitterMid + curveOffset);

      ctx.quadraticCurveTo(
        mx, my,
        x2 + this.getJitterOffset(seed + pass * 100, 5, jitterMagnitude),
        y2 + this.getJitterOffset(seed + pass * 100, 6, jitterMagnitude)
      );
      ctx.stroke();
    }
    ctx.restore();
  }

  // Sketchy polygon renderer
  drawSketchyPolygon(ctx, points, seed, roughness, strokeColor, strokeWidth, strokeStyle) {
    if (points.length < 2) return;
    for (let i = 0; i < points.length; i++) {
      const p1 = points[i];
      const p2 = points[(i + 1) % points.length];
      this.drawSketchyLine(ctx, p1[0], p1[1], p2[0], p2[1], seed + i * 13, roughness, strokeColor, strokeWidth, strokeStyle);
    }
  }

  // Sketchy ellipse renderer
  drawSketchyEllipse(ctx, cx, cy, rx, ry, seed, roughness, strokeColor, strokeWidth, strokeStyle) {
    ctx.save();
    ctx.strokeStyle = strokeColor;
    ctx.lineWidth = strokeWidth;

    if (strokeStyle === 'dashed') ctx.setLineDash([8, 8]);
    else if (strokeStyle === 'dotted') ctx.setLineDash([2, 6]);
    else ctx.setLineDash([]);

    if (roughness === 0) {
      ctx.beginPath();
      ctx.ellipse(cx, cy, rx, ry, 0, 0, Math.PI * 2);
      ctx.stroke();
      ctx.restore();
      return;
    }

    // Generate sketchy ellipse path (drawn in segments with jitter)
    const segments = 16;
    const jitterMagnitude = roughness * 2.0;

    for (let pass = 0; pass < 2; pass++) {
      ctx.beginPath();
      const passSeed = seed + pass * 400;

      for (let i = 0; i <= segments; i++) {
        const theta = (i / segments) * Math.PI * 2;
        
        // Add random radius jitter
        const rJitterX = this.getJitterOffset(passSeed, i * 2, jitterMagnitude);
        const rJitterY = this.getJitterOffset(passSeed, i * 2 + 1, jitterMagnitude);

        const x = cx + Math.cos(theta) * (rx + rJitterX);
        const y = cy + Math.sin(theta) * (ry + rJitterY);

        if (i === 0) ctx.moveTo(x, y);
        else ctx.lineTo(x, y);
      }
      ctx.stroke();
    }
    ctx.restore();
  }

  // Draw hachure fill (diagonal parallel lines)
  drawHachureFill(ctx, x, y, width, height, seed, roughness, fillColor) {
    ctx.save();
    ctx.strokeStyle = fillColor;
    ctx.lineWidth = 1.5;
    
    // Spacing between hachure lines
    const spacing = 8 + roughness * 2;
    const diagonal = Math.hypot(width, height);

    // Draw parallel lines at 45 degree angle across the clipped diagonal range
    let index = 0;
    for (let cur = -2 * diagonal; cur < 2 * diagonal; cur += spacing) {
      const x1 = cur;
      const y1 = -diagonal;
      const x2 = cur + diagonal * 2;
      const y2 = diagonal;

      this.drawSketchyLine(ctx, x1, y1, x2, y2, seed + index * 9, roughness, fillColor, 1.5, 'solid');
      index++;
    }
    ctx.restore();
  }

  // Render element on canvas
  renderElement(el, ctx, viewport) {
    const { x, y, width, height, angle = 0 } = el;
    const { toScreen } = viewport;

    // Convert coordinates to screen space
    const center = viewport.toScreen(x, y);
    const sW = width * viewport.zoom;
    const sH = height * viewport.zoom;

    ctx.save();
    // Apply opacity / transparency
    ctx.globalAlpha = el.opacity ?? 1;

    // Move to center, rotate, and scale/translate
    ctx.translate(center.x, center.y);
    ctx.rotate(angle);

    const halfW = sW / 2;
    const halfH = sH / 2;

    const strokeColor = el.strokeColor || '#000000';
    const strokeWidth = (el.strokeWidth || 2) * viewport.zoom;
    const strokeStyle = el.strokeStyle || 'solid';
    const roughness = el.roughness ?? 1;

    // 1. Draw Background / Fill (Clipped to actual shape boundaries)
    if (el.backgroundColor && el.backgroundColor !== 'transparent') {
      ctx.save();
      ctx.beginPath();
      if (el.type === 'ellipse') {
        ctx.ellipse(0, 0, halfW, halfH, 0, 0, Math.PI * 2);
      } else if (el.type === 'diamond') {
        ctx.moveTo(0, -halfH);
        ctx.lineTo(halfW, 0);
        ctx.lineTo(0, halfH);
        ctx.lineTo(-halfW, 0);
        ctx.closePath();
      } else if (el.type === 'triangle') {
        ctx.moveTo(0, -halfH);
        ctx.lineTo(halfW, halfH);
        ctx.lineTo(-halfW, halfH);
        ctx.closePath();
      } else {
        // Rectangle / Sticky
        ctx.rect(-halfW, -halfH, sW, sH);
      }
      ctx.clip();

      if (el.fillStyle === 'solid') {
        ctx.fillStyle = el.backgroundColor;
        ctx.fillRect(-halfW, -halfH, sW, sH);
      } else if (el.fillStyle === 'hachure') {
        this.drawHachureFill(ctx, -halfW, -halfH, sW, sH, el.seed, roughness, el.backgroundColor);
      }
      ctx.restore();
    }

    // 2. Draw outline based on type
    switch (el.type) {
      case 'rectangle':
      case 'sticky':
        this.drawSketchyPolygon(ctx, [
          [-halfW, -halfH],
          [halfW, -halfH],
          [halfW, halfH],
          [-halfW, halfH]
        ], el.seed, roughness, strokeColor, strokeWidth, strokeStyle);
        break;

      case 'ellipse':
        this.drawSketchyEllipse(ctx, 0, 0, halfW, halfH, el.seed, roughness, strokeColor, strokeWidth, strokeStyle);
        break;

      case 'diamond':
        this.drawSketchyPolygon(ctx, [
          [0, -halfH],
          [halfW, 0],
          [0, halfH],
          [-halfW, 0]
        ], el.seed, roughness, strokeColor, strokeWidth, strokeStyle);
        break;

      case 'triangle':
        this.drawSketchyPolygon(ctx, [
          [0, -halfH],
          [halfW, halfH],
          [-halfW, halfH]
        ], el.seed, roughness, strokeColor, strokeWidth, strokeStyle);
        break;

      case 'line':
        this.drawSketchyLine(ctx, -halfW, 0, halfW, 0, el.seed, roughness, strokeColor, strokeWidth, strokeStyle);
        break;

      case 'arrow':
        // Line body
        this.drawSketchyLine(ctx, -halfW, 0, halfW, 0, el.seed, roughness, strokeColor, strokeWidth, strokeStyle);
        // Arrow head (drawn sketchy)
        const headSize = Math.max(8, 12 * viewport.zoom);
        this.drawSketchyLine(ctx, halfW, 0, halfW - headSize, -headSize / 2, el.seed + 1, roughness, strokeColor, strokeWidth, 'solid');
        this.drawSketchyLine(ctx, halfW, 0, halfW - headSize, headSize / 2, el.seed + 2, roughness, strokeColor, strokeWidth, 'solid');
        break;

      case 'freedraw':
        // Freehand draw points are relative to el.x, el.y
        ctx.restore(); // Exit rotation translation because freedraw uses absolute coordinates mapped via viewport
        ctx.save();
        
        ctx.strokeStyle = el.strokeColor;
        ctx.lineWidth = el.strokeWidth * viewport.zoom;
        ctx.lineCap = 'round';
        ctx.lineJoin = 'round';

        if (el.tool === 'highlighter') {
          ctx.globalAlpha = 0.35;
          ctx.lineWidth = el.strokeWidth * 4 * viewport.zoom;
        }

        ctx.beginPath();
        el.points.forEach((pt, idx) => {
          const spt = viewport.toScreen(el.x + pt[0], el.y + pt[1]);
          if (idx === 0) ctx.moveTo(spt.x, spt.y);
          else ctx.lineTo(spt.x, spt.y);
        });
        ctx.stroke();
        ctx.restore();
        return; // Early return to avoid secondary restore
    }

    // 3. Draw text content inside shape/sticky or standalone
    if (el.text) {
      ctx.save();
      ctx.fillStyle = strokeColor;
      
      const fontSize = (el.fontSize || 16) * viewport.zoom;
      let fontName = 'sans-serif';
      if (el.fontFamily === 'hand') fontName = 'Caveat, cursive, sans-serif';
      else if (el.fontFamily === 'code') fontName = 'Courier New, monospace';
      
      ctx.font = `${fontSize}px ${fontName}`;
      ctx.textAlign = el.textAlign || 'center';
      ctx.textBaseline = el.verticalAlign || 'middle';

      const lines = el.text.split('\n');
      const lineHeight = fontSize * 1.25;
      const startY = -((lines.length - 1) * lineHeight) / 2;

      lines.forEach((line, index) => {
        ctx.fillText(line, 0, startY + index * lineHeight);
      });
      ctx.restore();
    }

    ctx.restore();
  }

  // Draw active selection bounding box and handles
  renderSelectionHandles(elements, viewport) {
    if (elements.length === 0) return;

    // Find bounding box containing all selected elements
    let minX = Infinity, minY = Infinity;
    let maxX = -Infinity, maxY = -Infinity;

    elements.forEach(el => {
      const halfW = el.width / 2;
      const halfH = el.height / 2;
      minX = Math.min(minX, el.x - halfW);
      minY = Math.min(minY, el.y - halfH);
      maxX = Math.max(maxX, el.x + halfW);
      maxY = Math.max(maxY, el.y + halfH);
    });

    const sMin = viewport.toScreen(minX, minY);
    const sMax = viewport.toScreen(maxX, maxY);
    const sW = sMax.x - sMin.x;
    const sH = sMax.y - sMin.y;

    const ctx = this.ctx;
    ctx.save();
    ctx.strokeStyle = '#0284c7';
    ctx.lineWidth = 1.5;
    ctx.setLineDash([4, 4]);
    ctx.strokeRect(sMin.x, sMin.y, sW, sH);

    // Draw handles on 4 corners (only if single element selected for simplicity)
    if (elements.length === 1) {
      ctx.fillStyle = '#ffffff';
      ctx.strokeStyle = '#0284c7';
      ctx.lineWidth = 2;
      ctx.setLineDash([]);
      
      const size = 8;
      const corners = [
        { x: sMin.x, y: sMin.y },
        { x: sMin.x + sW, y: sMin.y },
        { x: sMin.x, y: sMin.y + sH },
        { x: sMin.x + sW, y: sMin.y + sH }
      ];

      corners.forEach(c => {
        ctx.fillRect(c.x - size / 2, c.y - size / 2, size, size);
        ctx.strokeRect(c.x - size / 2, c.y - size / 2, size, size);
      });
    }
    ctx.restore();
  }
}
