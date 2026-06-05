// app/kerja/slide/js/editor/export.js
import { state } from './editor.js';

async function loadScript(src) {
  if (document.querySelector(`script[src="${src}"]`)) return;
  return new Promise((resolve, reject) => {
    const script = document.createElement('script');
    script.src = src;
    script.onload = resolve;
    script.onerror = reject;
    document.head.appendChild(script);
  });
}

export const Export = {
  init() {
    this.setupListeners();
  },

  setupListeners() {
    document.getElementById('export-json-btn')?.addEventListener('click', (e) => {
      e.preventDefault();
      this.exportJSON();
    });

    document.getElementById('export-html-btn')?.addEventListener('click', (e) => {
      e.preventDefault();
      this.exportHTML();
    });

    document.getElementById('export-pdf-btn')?.addEventListener('click', (e) => {
      e.preventDefault();
      this.exportPDF();
    });

    document.getElementById('export-pptx-btn')?.addEventListener('click', (e) => {
      e.preventDefault();
      this.exportPPTX();
    });
  },

  exportJSON() {
    if (!state.presentation) return;
    const dataStr = "data:text/json;charset=utf-8," + encodeURIComponent(JSON.stringify(state.presentation, null, 2));
    const dlAnchor = document.createElement('a');
    dlAnchor.setAttribute("href", dataStr);
    dlAnchor.setAttribute("download", `${state.presentation.title.replace(/\s+/g, '_')}_backup.json`);
    document.body.appendChild(dlAnchor);
    dlAnchor.click();
    dlAnchor.remove();
  },

  exportPDF() {
    // Open standard browser print dialog
    window.print();
  },

  exportHTML() {
    if (!state.presentation) return;

    // Build standalone self-contained HTML slide deck
    let slidesHtml = '';
    state.presentation.slides.forEach((slide, idx) => {
      const bg = slide.background || { type: 'color', color: '#ffffff' };
      const bgStyle = bg.type === 'color' 
        ? `background-color: ${bg.color};` 
        : `background-image: url(${bg.image}); background-size: cover; background-position: center;`;

      slidesHtml += `
        <div class="slide ${idx === 0 ? 'active' : ''}" data-transition="${(slide.transition && slide.transition.type) || 'none'}" style="${bgStyle}">
          <div class="slide-content">
      `;

      slide.elements.forEach(el => {
        const rotationStyle = el.rotation ? `transform: rotate(${el.rotation}deg);` : '';
        const opacityStyle = el.opacity !== undefined ? `opacity: ${el.opacity};` : '';
        
        let innerHtml = '';
        if (el.type === 'text') {
          innerHtml = `<div style="font-family: ${el.fontFamily || 'sans-serif'}; font-size: ${el.fontSize || 18}px; font-weight: ${el.fontWeight || 'normal'}; font-style: ${el.fontStyle || 'normal'}; color: ${el.color || '#000'}; text-align: ${el.textAlign || 'left'}; background-color: ${el.backgroundColor || 'transparent'}; width: 100%; height: 100%; white-space: pre-wrap; word-wrap: break-word;">${escapeHtml(el.content || '')}</div>`;
        } else if (el.type === 'image') {
          innerHtml = `<img src="${el.src}" style="width: 100%; height: 100%; object-fit: ${el.fit || 'fill'};">`;
        } else if (el.type === 'shape') {
          const fill = el.fill || '#3b82f6';
          const stroke = el.stroke ? `stroke="${el.stroke.color}" stroke-width="${el.stroke.width}"` : '';
          
          let svgContent = '';
          if (el.shapeType === 'circle') {
            svgContent = `<circle cx="50" cy="50" r="48" fill="${fill}" ${stroke}/>`;
          } else if (el.shapeType === 'triangle') {
            svgContent = `<polygon points="50,4 96,96 4,96" fill="${fill}" ${stroke}/>`;
          } else if (el.shapeType === 'star') {
            svgContent = `<polygon points="50,5 64,36 98,36 70,57 81,91 50,70 19,91 30,57 2,36 36,36" fill="${fill}" ${stroke}/>`;
          } else if (el.shapeType === 'arrow-right') {
            svgContent = `<polygon points="10,35 60,35 60,10 90,50 60,90 60,65 10,65" fill="${fill}" ${stroke}/>`;
          } else if (el.shapeType === 'arrow-left') {
            svgContent = `<polygon points="90,35 40,35 40,10 10,50 40,90 40,65 90,65" fill="${fill}" ${stroke}/>`;
          } else {
            const rx = el.borderRadius ? `rx="${el.borderRadius}" ry="${el.borderRadius}"` : '';
            svgContent = `<rect x="2" y="2" width="96" height="96" fill="${fill}" ${rx} ${stroke}/>`;
          }

          innerHtml = `<svg width="100%" height="100%" viewBox="0 0 100 100" preserveAspectRatio="none">${svgContent}</svg>`;
        } else if (el.type === 'line') {
          innerHtml = `<svg width="100%" height="100%" viewBox="0 0 100 100" preserveAspectRatio="none"><line x1="0" y1="50" x2="100" y2="50" stroke="${el.color || '#333'}" stroke-width="${el.strokeWidth || 5}"/></svg>`;
        } else if (el.type === 'table') {
          const rows = el.rows || 3;
          const cols = el.cols || 3;
          const cells = el.cells || [];
          
          let tableRows = '';
          for (let r = 0; r < rows; r++) {
            tableRows += '<tr>';
            for (let c = 0; c < cols; c++) {
              const cellData = cells[r * cols + c] || { content: '' };
              tableRows += `<td style="border: 1px solid #94a3b8; padding: 4px 8px; font-size: 0.9rem; background-color: white;">${escapeHtml(cellData.content)}</td>`;
            }
            tableRows += '</tr>';
          }
          innerHtml = `<table style="width: 100%; height: 100%; border-collapse: collapse; margin: 0;">${tableRows}</table>`;
        }

        slidesHtml += `
          <div class="element" style="position: absolute; left: ${el.x}px; top: ${el.y}px; width: ${el.width}px; height: ${el.height}px; z-index: ${el.zIndex || 1}; ${rotationStyle} ${opacityStyle}">
            ${innerHtml}
          </div>
        `;
      });

      slidesHtml += `
          </div>
        </div>
      `;
    });

    const standaloneHtml = `<!DOCTYPE html>
<html lang="id">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>${escapeHtml(state.presentation.title)}</title>
  <style>
    body, html {
      margin: 0; padding: 0; width: 100%; height: 100%; overflow: hidden; background: #000; font-family: sans-serif;
    }
    .slide-deck {
      width: 100%; height: 100%; position: relative;
    }
    .slide {
      position: absolute; inset: 0; display: none; justify-content: center; align-items: center; background-size: cover; background-position: center; transition: all 0.3s ease-in-out;
    }
    .slide.active {
      display: flex;
    }
    .slide-content {
      width: 960px; height: 540px; position: relative; flex-shrink: 0;
    }
    .element {
      box-sizing: border-box;
    }
    
    /* Transitions */
    .slide[data-transition="fade"] { opacity: 0; }
    .slide[data-transition="fade"].active { opacity: 1; }
    
    .slide[data-transition="slide-left"] { transform: translateX(100%); }
    .slide[data-transition="slide-left"].active { transform: translateX(0); }
    
    .slide[data-transition="slide-up"] { transform: translateY(100%); }
    .slide[data-transition="slide-up"].active { transform: translateY(0); }
    
    .slide[data-transition="zoom"] { transform: scale(0.5); opacity: 0; }
    .slide[data-transition="zoom"].active { transform: scale(1); opacity: 1; }

    .nav-controls {
      position: fixed;
      bottom: 20px;
      right: 20px;
      display: flex;
      gap: 10px;
      z-index: 9999;
      background: rgba(15, 23, 42, 0.85);
      border: 1px solid rgba(255, 255, 255, 0.15);
      border-radius: 30px;
      padding: 6px 16px;
      box-shadow: 0 10px 25px rgba(0,0,0,0.3);
      align-items: center;
    }
    .nav-btn {
      background: rgba(255,255,255,0.15);
      color: white;
      border: none;
      padding: 6px 12px;
      font-size: 0.9rem;
      border-radius: 20px;
      cursor: pointer;
      transition: background 0.2s;
    }
    .nav-btn:hover {
      background: rgba(255,255,255,0.3);
    }
  </style>
</head>
<body>
  <div class="slide-deck">
    ${slidesHtml}
  </div>
  <div class="nav-controls">
    <button class="nav-btn" onclick="window.prevSlide()">◀</button>
    <span id="counter" style="color: white; align-self: center; font-size: 0.9rem;">1 / ${state.presentation.slides.length}</span>
    <button class="nav-btn" onclick="window.nextSlide()">▶</button>
  </div>

  <script>
    let currentIdx = 0;
    const slides = document.querySelectorAll('.slide');
    const counter = document.getElementById('counter');

    function showSlide(idx) {
      if (idx < 0 || idx >= slides.length) return;
      slides[currentIdx].classList.remove('active');
      currentIdx = idx;
      slides[currentIdx].classList.add('active');
      counter.textContent = (currentIdx + 1) + ' / ' + slides.length;
      scaleSlides();
    }

    window.nextSlide = function() {
      if (currentIdx < slides.length - 1) showSlide(currentIdx + 1);
    };

    window.prevSlide = function() {
      if (currentIdx > 0) showSlide(currentIdx - 1);
    };

    function scaleSlides() {
      const activeSlideContent = document.querySelector('.slide.active .slide-content');
      if (!activeSlideContent) return;
      const scaleX = window.innerWidth / 960;
      const scaleY = window.innerHeight / 540;
      const scale = Math.min(scaleX, scaleY, 1.5);
      activeSlideContent.style.transform = 'scale(' + scale + ')';
      activeSlideContent.style.transformOrigin = 'center center';
    }

    window.addEventListener('resize', scaleSlides);
    window.addEventListener('keydown', (e) => {
      if (e.key === 'ArrowRight' || e.key === ' ' || e.key === 'PageDown') window.nextSlide();
      if (e.key === 'ArrowLeft' || e.key === 'Backspace' || e.key === 'PageUp') window.prevSlide();
    });

    scaleSlides();
  </script>
</body>
</html>`;

    const blob = new Blob([standaloneHtml], { type: 'text/html' });
    const url = URL.createObjectURL(blob);
    const dlAnchor = document.createElement('a');
    dlAnchor.setAttribute("href", url);
    dlAnchor.setAttribute("download", `${state.presentation.title.replace(/\s+/g, '_')}.html`);
    document.body.appendChild(dlAnchor);
    dlAnchor.click();
    dlAnchor.remove();
  },

  async exportPPTX() {
    if (!state.presentation) return;

    if (window.TMPT_UI) window.TMPT_UI.setLoading('#export-pptx-btn', true);

    try {
      if (typeof window.PptxGenJS === 'undefined' && typeof window.pptxgen === 'undefined') {
        await loadScript('./vendor/pptxgen.min.js');
      }

      const PPTXClass = window.PptxGenJS || window.pptxgen;
      if (!PPTXClass) {
        throw new Error('PptxGenJS is not loaded');
      }
      const pptx = new PPTXClass();
      pptx.layout = 'LAYOUT_16x9';

      state.presentation.slides.forEach(slideData => {
        const slide = pptx.addSlide();

        // 1. Slide Background
        const bg = slideData.background || { type: 'color', color: '#ffffff' };
        if (bg.type === 'color') {
          slide.background = { color: bg.color.replace('#', '') };
        } else if (bg.type === 'image') {
          slide.background = { data: bg.image };
        }

        // 2. Elements
        slideData.elements.forEach(el => {
          // Convert pixels (at 960x540) to Inches (PowerPoint default ratio)
          // Width in inches = width / 96
          const x = el.x / 96;
          const y = el.y / 96;
          const w = el.width / 96;
          const h = el.height / 96;
          const rotate = el.rotation || 0;

          if (el.type === 'text') {
            slide.addText(el.content || '', {
              x: x,
              y: y,
              w: w,
              h: h,
              rotate: rotate,
              fontFace: el.fontFamily?.replace(', sans-serif', '')?.replace(', serif', '')?.replace(/'/g, '') || 'Arial',
              fontSize: el.fontSize || 18,
              bold: el.fontWeight === 'bold',
              italic: el.fontStyle === 'italic',
              color: (el.color || '#000000').replace('#', ''),
              fill: el.backgroundColor === 'transparent' ? undefined : { color: (el.backgroundColor || '#ffffff').replace('#', '') },
              align: el.textAlign || 'left',
              valign: 'middle'
            });
          } else if (el.type === 'image') {
            slide.addImage({
              data: el.src, // Base64
              x: x,
              y: y,
              w: w,
              h: h,
              rotate: rotate
            });
          } else if (el.type === 'shape') {
            let shapeName = pptx.shapes.RECTANGLE;
            if (el.shapeType === 'circle') shapeName = pptx.shapes.OVAL;
            else if (el.shapeType === 'triangle') shapeName = pptx.shapes.TRIANGLE;
            else if (el.shapeType === 'star') shapeName = pptx.shapes.STAR_5_POINT;
            else if (el.shapeType === 'arrow-right') shapeName = pptx.shapes.RIGHT_ARROW;
            else if (el.shapeType === 'arrow-left') shapeName = pptx.shapes.LEFT_ARROW;

            slide.addShape(shapeName, {
              x: x,
              y: y,
              w: w,
              h: h,
              rotate: rotate,
              fill: { color: (el.fill || '#3b82f6').replace('#', '') },
              line: el.stroke && el.stroke.color !== 'transparent' 
                ? { color: el.stroke.color.replace('#', ''), width: el.stroke.width || 1 } 
                : undefined
            });
          } else if (el.type === 'line') {
            slide.addShape(pptx.shapes.LINE, {
              x: x,
              y: y,
              w: w,
              h: 0.1,
              rotate: rotate,
              line: { color: (el.color || '#333333').replace('#', ''), width: el.strokeWidth || 4 }
            });
          } else if (el.type === 'table') {
            const rows = el.rows || 3;
            const cols = el.cols || 3;
            const cells = el.cells || [];
            
            const tableData = [];
            for (let r = 0; r < rows; r++) {
              const rowCells = [];
              for (let c = 0; c < cols; c++) {
                const cellData = cells[r * cols + c] || { content: '' };
                rowCells.push({
                  text: cellData.content || '',
                  options: {
                    fill: { color: 'FFFFFF' },
                    color: '333333',
                    align: 'center',
                    valign: 'middle'
                  }
                });
              }
              tableData.push(rowCells);
            }

            slide.addTable(tableData, {
              x: x,
              y: y,
              w: w,
              h: h
            });
          }
        });

        // 3. Speaker notes
        if (slideData.notes) {
          slide.addNotes(slideData.notes);
        }
      });

      await pptx.writeFile({ fileName: `${state.presentation.title.replace(/\s+/g, '_')}.pptx` });
      if (window.TMPT_UI) window.TMPT_UI.toast('Presentasi PowerPoint (.pptx) berhasil diunduh.', 'success');

    } catch (err) {
      console.error(err);
      if (window.TMPT_UI) window.TMPT_UI.toast('Gagal mengekspor PPTX: ' + err.message, 'error');
    } finally {
      if (window.TMPT_UI) window.TMPT_UI.setLoading('#export-pptx-btn', false);
    }
  }
};

function escapeHtml(str) {
  if (!str) return '';
  const d = document.createElement('div');
  d.textContent = str;
  return d.innerHTML;
}
