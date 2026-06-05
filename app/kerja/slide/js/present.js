// app/kerja/slide/js/present.js
import { getPresentation } from './db.js';

let presentation = null;
let currentSlideIndex = 0;
let isBlankScreen = false;
let controlsTimeout = null;

// Drawing & Pointer mode variables
let currentMode = 'nav'; // 'nav', 'laser', 'draw'
let isDrawing = false;
let lastX = 0;
let lastY = 0;
let drawingHistory = []; // Array of { color, width, points: [{x, y}] }
let canvas = null;
let ctx = null;
let mousePos = { x: 0, y: 0 };

document.addEventListener('DOMContentLoaded', async () => {
  const urlParams = new URLSearchParams(window.location.search);
  const id = urlParams.get('id');
  const slideNum = parseInt(urlParams.get('slide')) || 1;

  if (!id) {
    document.getElementById('present-deck').innerHTML = '<div class="loading-state">Error: ID Presentasi diperlukan.</div>';
    return;
  }

  presentation = await getPresentation(id);
  if (!presentation) {
    document.getElementById('present-deck').innerHTML = '<div class="loading-state">Error: Presentasi tidak ditemukan.</div>';
    return;
  }

  currentSlideIndex = Math.max(0, Math.min(presentation.slides.length - 1, slideNum - 1));

  renderSlides();
  setupEvents();
  initCanvas();
  showSlide(currentSlideIndex);
  triggerControlsActivity();
});

function renderSlides() {
  const deck = document.getElementById('present-deck');
  if (!deck) return;

  deck.innerHTML = presentation.slides.map((slide, idx) => {
    const bg = slide.background || { type: 'color', color: '#ffffff' };
    const bgStyle = bg.type === 'color' 
      ? `background-color: ${bg.color};` 
      : `background-image: url(${bg.image});`;

    const transitionType = (slide.transition && slide.transition.type) || 'none';

    let elementsHtml = slide.elements.map(el => {
      const rotationStyle = el.rotation ? `transform: rotate(${el.rotation}deg);` : '';
      const opacityStyle = el.opacity !== undefined ? `opacity: ${el.opacity};` : '';
      
      let innerHtml = '';
      if (el.type === 'text') {
        innerHtml = `
          <div class="present-text-content" style="font-family: ${el.fontFamily || 'Arial, sans-serif'}; font-size: ${el.fontSize || 18}px; font-weight: ${el.fontWeight || 'normal'}; font-style: ${el.fontStyle || 'normal'}; color: ${el.color || '#000000'}; text-align: ${el.textAlign || 'left'}; background-color: ${el.backgroundColor || 'transparent'};">
            ${escapeHtml(el.content || '')}
          </div>
        `;
      } else if (el.type === 'image') {
        innerHtml = `<img class="present-image-content" src="${el.src}" style="object-fit: ${el.fit || 'fill'};">`;
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
        innerHtml = `<svg width="100%" height="100%" viewBox="0 0 100 100" preserveAspectRatio="none"><line x1="0" y1="50" x2="100" y2="50" stroke="${el.color || '#333333'}" stroke-width="${el.strokeWidth || 5}"/></svg>`;
      } else if (el.type === 'table') {
        const rows = el.rows || 3;
        const cols = el.cols || 3;
        const cells = el.cells || [];
        
        let tableRows = '';
        for (let r = 0; r < rows; r++) {
          tableRows += '<tr>';
          for (let c = 0; c < cols; c++) {
            const cellData = cells[r * cols + c] || { content: '' };
            tableRows += `<td>${escapeHtml(cellData.content)}</td>`;
          }
          tableRows += '</tr>';
        }
        innerHtml = `<table class="present-table-content">${tableRows}</table>`;
      }

      return `
        <div class="present-element" style="position: absolute; left: ${el.x}px; top: ${el.y}px; width: ${el.width}px; height: ${el.height}px; z-index: ${el.zIndex || 1}; ${rotationStyle} ${opacityStyle}">
          ${innerHtml}
        </div>
      `;
    }).join('');

    return `
      <div class="present-slide" data-index="${idx}" data-transition="${transitionType}" style="${bgStyle}">
        <div class="present-slide-content">
          ${elementsHtml}
        </div>
      </div>
    `;
  }).join('');
}

function showSlide(idx) {
  if (idx < 0 || idx >= presentation.slides.length) return;

  const slides = document.querySelectorAll('.present-slide');
  slides.forEach((slide, i) => {
    if (i === idx) {
      slide.classList.add('active');
    } else {
      slide.classList.remove('active');
    }
  });

  currentSlideIndex = idx;

  // Clear drawing canvas when changing slides
  clearCanvas();

  // Update controls indicator
  const indicator = document.getElementById('ctrl-indicator');
  if (indicator) {
    indicator.textContent = `${currentSlideIndex + 1} / ${presentation.slides.length}`;
  }

  // Log speaker notes to developer console for double display setups
  const activeSlide = presentation.slides[currentSlideIndex];
  if (activeSlide && activeSlide.notes) {
    console.log(`[Speaker Notes Slide ${currentSlideIndex + 1}]: ${activeSlide.notes}`);
  }

  scaleSlideContent();
}

function nextSlide() {
  if (currentSlideIndex < presentation.slides.length - 1) {
    showSlide(currentSlideIndex + 1);
  }
}

function prevSlide() {
  if (currentSlideIndex > 0) {
    showSlide(currentSlideIndex - 1);
  }
}

function scaleSlideContent() {
  const activeSlide = document.querySelector('.present-slide.active');
  if (!activeSlide) return;

  const content = activeSlide.querySelector('.present-slide-content');
  if (!content) return;

  const availableWidth = window.innerWidth;
  const availableHeight = window.innerHeight;

  const scaleX = availableWidth / 960;
  const scaleY = availableHeight / 540;
  const scale = Math.min(scaleX, scaleY);

  content.style.transform = `scale(${scale})`;
  content.style.transformOrigin = 'center center';
}

// --- Drawing & Laser Canvas Methods ---
function initCanvas() {
  canvas = document.getElementById('drawing-canvas');
  if (!canvas) return;
  ctx = canvas.getContext('2d');
  resizeCanvas();

  // Pointer & Scribble events
  canvas.addEventListener('mousedown', startDrawing);
  canvas.addEventListener('mousemove', handleDrawingMouseMove);
  canvas.addEventListener('mouseup', stopDrawing);
  canvas.addEventListener('mouseleave', stopDrawing);

  // Touch screen support
  canvas.addEventListener('touchstart', (e) => {
    e.preventDefault();
    startDrawing(getTouchPos(e));
  });
  canvas.addEventListener('touchmove', (e) => {
    e.preventDefault();
    handleDrawingMouseMove(getTouchPos(e));
  });
  canvas.addEventListener('touchend', (e) => {
    e.preventDefault();
    stopDrawing();
  });
}

function resizeCanvas() {
  if (!canvas) return;
  canvas.width = window.innerWidth;
  canvas.height = window.innerHeight;
  redrawCanvas();
}

function clearCanvas() {
  if (!ctx || !canvas) return;
  ctx.clearRect(0, 0, canvas.width, canvas.height);
  drawingHistory = [];
  document.getElementById('btn-mode-clear').style.display = 'none';
}

function redrawCanvas() {
  if (!ctx || !canvas) return;
  ctx.clearRect(0, 0, canvas.width, canvas.height);
  
  // Re-draw drawings
  drawingHistory.forEach(line => {
    ctx.beginPath();
    ctx.strokeStyle = line.color || '#ff3333';
    ctx.lineWidth = line.width || 3;
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';
    
    if (line.points.length > 0) {
      ctx.moveTo(line.points[0].x, line.points[0].y);
      for (let i = 1; i < line.points.length; i++) {
        ctx.lineTo(line.points[i].x, line.points[i].y);
      }
    }
    ctx.stroke();
  });
}

function startDrawing(e) {
  if (currentMode !== 'draw') return;
  isDrawing = true;
  lastX = e.clientX;
  lastY = e.clientY;
  
  drawingHistory.push({
    color: '#ff3333',
    width: 3,
    points: [{ x: lastX, y: lastY }]
  });
  
  document.getElementById('btn-mode-clear').style.display = 'inline-block';
}

function handleDrawingMouseMove(e) {
  mousePos.x = e.clientX;
  mousePos.y = e.clientY;

  if (currentMode === 'laser') {
    redrawCanvas();
    drawLaserDot();
  } else if (currentMode === 'draw' && isDrawing) {
    const currentX = e.clientX;
    const currentY = e.clientY;
    
    ctx.beginPath();
    ctx.strokeStyle = '#ff3333';
    ctx.lineWidth = 3;
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';
    ctx.moveTo(lastX, lastY);
    ctx.lineTo(currentX, currentY);
    ctx.stroke();
    
    const currentLine = drawingHistory[drawingHistory.length - 1];
    if (currentLine) {
      currentLine.points.push({ x: currentX, y: currentY });
    }
    
    lastX = currentX;
    lastY = currentY;
  }
}

function stopDrawing() {
  isDrawing = false;
}

function getTouchPos(e) {
  if (e.touches && e.touches[0]) {
    return {
      clientX: e.touches[0].clientX,
      clientY: e.touches[0].clientY
    };
  }
  return { clientX: 0, clientY: 0 };
}

function drawLaserDot() {
  if (!ctx) return;
  ctx.beginPath();
  ctx.arc(mousePos.x, mousePos.y, 8, 0, Math.PI * 2);
  ctx.fillStyle = '#ff0000';
  ctx.shadowColor = '#ff0000';
  ctx.shadowBlur = 12;
  ctx.fill();
  ctx.shadowBlur = 0; // reset
}

function changeMode(mode) {
  currentMode = mode;
  document.body.classList.remove('mode-laser', 'mode-draw');
  
  // Remove active from all buttons
  document.getElementById('btn-mode-select').classList.remove('active');
  document.getElementById('btn-mode-laser').classList.remove('active');
  document.getElementById('btn-mode-draw').classList.remove('active');
  
  if (mode === 'laser') {
    document.body.classList.add('mode-laser');
    document.getElementById('btn-mode-laser').classList.add('active');
  } else if (mode === 'draw') {
    document.body.classList.add('mode-draw');
    document.getElementById('btn-mode-draw').classList.add('active');
  } else {
    document.getElementById('btn-mode-select').classList.add('active');
  }
  
  redrawCanvas();
}

function setupEvents() {
  // Window Resizing
  window.addEventListener('resize', () => {
    scaleSlideContent();
    resizeCanvas();
  });

  // Mouse Move activity to reveal toolbar
  window.addEventListener('mousemove', triggerControlsActivity);
  window.addEventListener('click', triggerControlsActivity);

  // Click on slide background to go to next page
  document.getElementById('present-deck')?.addEventListener('click', (e) => {
    if (e.target.closest('#controls-bar') || currentMode !== 'nav') return;
    nextSlide();
  });

  // Mode selectors
  document.getElementById('btn-mode-select')?.addEventListener('click', () => changeMode('nav'));
  document.getElementById('btn-mode-laser')?.addEventListener('click', () => changeMode('laser'));
  document.getElementById('btn-mode-draw')?.addEventListener('click', () => changeMode('draw'));
  document.getElementById('btn-mode-clear')?.addEventListener('click', clearCanvas);

  // Controls UI click bindings
  document.getElementById('ctrl-prev')?.addEventListener('click', prevSlide);
  document.getElementById('ctrl-next')?.addEventListener('click', nextSlide);
  document.getElementById('ctrl-exit')?.addEventListener('click', () => {
    window.close();
  });

  document.getElementById('ctrl-fullscreen')?.addEventListener('click', toggleFullscreen);

  // Keyboard navigation
  let numBuffer = '';
  window.addEventListener('keydown', (e) => {
    triggerControlsActivity();

    // Next
    if (e.key === 'ArrowRight' || e.key === ' ' || e.key === 'PageDown') {
      e.preventDefault();
      nextSlide();
    }
    // Prev
    if (e.key === 'ArrowLeft' || e.key === 'Backspace' || e.key === 'PageUp') {
      e.preventDefault();
      prevSlide();
    }
    // Fullscreen toggle (F)
    if (e.key.toLowerCase() === 'f') {
      e.preventDefault();
      toggleFullscreen();
    }
    // Exit (Esc)
    if (e.key === 'Escape') {
      if (document.fullscreenElement) {
        document.exitFullscreen();
      } else {
        window.close();
      }
    }
    // Blank Screen Toggle (.)
    if (e.key === '.') {
      e.preventDefault();
      toggleBlankScreen();
    }

    // Number keyboard jump (e.g. "5" + Enter jumps to slide 5)
    if (e.key >= '0' && e.key <= '9') {
      numBuffer += e.key;
    }
    if (e.key === 'Enter' && numBuffer !== '') {
      const slideNum = parseInt(numBuffer);
      if (slideNum >= 1 && slideNum <= presentation.slides.length) {
        showSlide(slideNum - 1);
      }
      numBuffer = '';
    }
    if (e.key !== 'Enter' && !(e.key >= '0' && e.key <= '9')) {
      numBuffer = '';
    }
  });
}

function toggleFullscreen() {
  if (!document.fullscreenElement) {
    document.documentElement.requestFullscreen().catch(err => {
      console.error(`Error requesting fullscreen: ${err.message}`);
    });
  } else {
    document.exitFullscreen();
  }
}

function toggleBlankScreen() {
  const deck = document.getElementById('present-deck');
  if (!deck) return;

  isBlankScreen = !isBlankScreen;
  if (isBlankScreen) {
    deck.classList.add('blank-screen');
  } else {
    deck.classList.remove('blank-screen');
  }
}

function triggerControlsActivity() {
  const bar = document.getElementById('controls-bar');
  if (!bar) return;

  bar.classList.add('show');
  
  clearTimeout(controlsTimeout);
  controlsTimeout = setTimeout(() => {
    bar.classList.remove('show');
  }, 3000);
}

function escapeHtml(str) {
  if (!str) return '';
  const d = document.createElement('div');
  d.textContent = str;
  return d.innerHTML;
}
