// QR Generator wrapper using qr-code-styling

// Because qr-code-styling might be loaded as a global UMD, let's detect it
const getQRCodeStylingClass = () => {
  if (window.QRCodeStyling) return window.QRCodeStyling;
  // If imported as ES module, it might be available differently
  return window.QRCodeStyling;
};

export function createQR(content, design) {
  const QRCodeStyling = getQRCodeStylingClass();
  if (!QRCodeStyling) {
    console.error('qr-code-styling library not loaded');
    return null;
  }

  const options = {
    width: design.size || 300,
    height: design.size || 300,
    data: content,
    qrOptions: {
      typeNumber: 0,
      mode: 'Byte',
      errorCorrectionLevel: design.ecl || 'H',
    },
    dotsOptions: {
      color: design.foreground_color || '#000000',
      type: design.dot_style || 'square',
    },
    cornersSquareOptions: {
      type: design.corner_style || 'square',
      color: design.foreground_color || '#000000',
    },
    cornersDotOptions: {
      type: design.corner_style === 'square' ? 'square' : 'dot',
      color: design.foreground_color || '#000000',
    },
    backgroundOptions: {
      color: design.background_color || '#FFFFFF',
    },
  };

  // Add gradient if present
  if (design.gradient && design.gradient.color1 && design.gradient.color2) {
    const angleRad = ((design.gradient.angle || 0) * Math.PI) / 180;
    options.dotsOptions.gradient = {
      type: design.gradient.type || 'linear',
      rotation: angleRad,
      colorStops: [
        { offset: 0, color: design.gradient.color1 },
        { offset: 1, color: design.gradient.color2 }
      ]
    };
    
    // Apply gradient to corners too for better design aesthetics
    options.cornersSquareOptions.gradient = options.dotsOptions.gradient;
    options.cornersDotOptions.gradient = options.dotsOptions.gradient;
  }

  // Add logo if present
  if (design.logo && design.logo.data) {
    options.image = design.logo.data;
    options.imageOptions = {
      crossOrigin: 'anonymous',
      margin: design.logo.padding !== undefined ? design.logo.padding : 5,
      imageSize: (design.logo.size || 20) / 100,
      hideBackgroundDots: true
    };
  }

  return new QRCodeStyling(options);
}

export async function downloadQR(qr, format, filename, frameConfig = null) {
  if (!qr) return;

  if (frameConfig && frameConfig.style && frameConfig.style !== 'none') {
    // If a frame is used, we draw it onto a custom canvas
    const rawCanvasContainer = document.createElement('div');
    rawCanvasContainer.style.display = 'none';
    document.body.appendChild(rawCanvasContainer);
    
    await qr.append(rawCanvasContainer);
    
    // Wait for canvas to be fully drawn (e.g. image loads)
    await new Promise(resolve => setTimeout(resolve, 300));
    
    const canvas = rawCanvasContainer.querySelector('canvas');
    if (canvas) {
      const framedCanvas = renderWithFrame(canvas, frameConfig, qr.options.width);
      document.body.removeChild(rawCanvasContainer);

      if (format === 'pdf') {
        await downloadAsPDF(framedCanvas, filename);
      } else {
        const mimeType = `image/${format === 'jpg' ? 'jpeg' : format}`;
        const dataUrl = framedCanvas.toDataURL(mimeType);
        const link = document.createElement('a');
        link.download = `${filename}.${format}`;
        link.href = dataUrl;
        link.click();
      }
    }
    return;
  }

  // Regular download without frame
  if (format === 'pdf') {
    const rawCanvasContainer = document.createElement('div');
    rawCanvasContainer.style.display = 'none';
    document.body.appendChild(rawCanvasContainer);
    await qr.append(rawCanvasContainer);
    await new Promise(resolve => setTimeout(resolve, 200));
    const canvas = rawCanvasContainer.querySelector('canvas');
    if (canvas) {
      await downloadAsPDF(canvas, filename);
    }
    document.body.removeChild(rawCanvasContainer);
  } else {
    // png, svg, webp, jpeg
    const ext = format === 'jpg' ? 'jpeg' : format;
    await qr.download({ name: filename, extension: ext });
  }
}

async function downloadAsPDF(canvas, filename) {
  // If jsPDF is UMD, access it via window.jspdf.jsPDF
  const jsPDFClass = window.jspdf ? window.jspdf.jsPDF : null;
  if (!jsPDFClass) {
    console.error('jsPDF not loaded');
    return;
  }
  
  const imgData = canvas.toDataURL('image/png');
  const pdf = new jsPDFClass({ unit: 'mm', format: 'a4' });
  // Center the QR code in A4 page
  const qrSizeMM = 80;
  const x = (210 - qrSizeMM) / 2;
  const y = (297 - qrSizeMM) / 2;
  
  pdf.addImage(imgData, 'PNG', x, y, qrSizeMM, qrSizeMM);
  pdf.save(`${filename}.pdf`);
}

// Render CTA Frame around the canvas
export function renderWithFrame(sourceCanvas, frameConfig, qrSize) {
  const { style, color, text, text_color } = frameConfig;
  const FRAME_PADDING = 24;
  const TEXT_HEIGHT = 48;

  const finalCanvas = document.createElement('canvas');
  const totalWidth = qrSize + (FRAME_PADDING * 2);
  const totalHeight = totalWidth + TEXT_HEIGHT;

  finalCanvas.width = totalWidth;
  finalCanvas.height = totalHeight;

  const ctx = finalCanvas.getContext('2d');

  // Background frame
  ctx.fillStyle = color || '#000000';
  
  // Custom rounded rectangle helper
  const drawRoundRect = (x, y, w, h, r) => {
    ctx.beginPath();
    ctx.moveTo(x + r, y);
    ctx.arcTo(x + w, y, x + w, y + h, r);
    ctx.arcTo(x + w, y + h, x, y + h, r);
    ctx.arcTo(x, y + h, x, y, r);
    ctx.arcTo(x, y, x + w, y, r);
    ctx.closePath();
    ctx.fill();
  };

  if (style === 'rounded') {
    drawRoundRect(0, 0, totalWidth, totalHeight, 20);
  } else {
    ctx.fillRect(0, 0, totalWidth, totalHeight);
  }

  // Draw pure white background behind the QR for contrast (if QR background is transparent or colored)
  ctx.fillStyle = '#FFFFFF';
  ctx.fillRect(FRAME_PADDING - 4, FRAME_PADDING - 4, qrSize + 8, qrSize + 8);

  // Draw the QR code
  ctx.drawImage(sourceCanvas, FRAME_PADDING, FRAME_PADDING, qrSize, qrSize);

  // CTA Text
  ctx.fillStyle = text_color || '#FFFFFF';
  ctx.font = `bold ${Math.floor(TEXT_HEIGHT * 0.45)}px system-ui, -apple-system, sans-serif`;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  
  const textX = totalWidth / 2;
  const textY = totalWidth + (TEXT_HEIGHT / 2);
  ctx.fillText(text || 'SCAN ME', textX, textY);

  return finalCanvas;
}
