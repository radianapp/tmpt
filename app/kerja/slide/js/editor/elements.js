// app/kerja/slide/js/editor/elements.js
import { state, triggerAutosave, saveHistoryState } from './editor.js';
import { Canvas } from './canvas.js';
import { SlidePanel } from './slide-panel.js';
import { Properties } from './properties.js';

export const Elements = {
  init() {
    this.setupToolbarListeners();
  },

  setupToolbarListeners() {
    // Add Text
    document.getElementById('add-text-btn')?.addEventListener('click', () => {
      this.addNewElement('text', {
        content: 'Klik dua kali untuk menulis...',
        width: 320,
        height: 60,
        fontSize: 20
      });
    });

    // Add Image File Selection Trigger
    const imgLoader = document.getElementById('image-loader-input');
    document.getElementById('add-image-btn')?.addEventListener('click', () => {
      imgLoader.click();
    });

    imgLoader?.addEventListener('change', (e) => {
      const file = e.target.files[0];
      if (!file) return;

      const reader = new FileReader();
      reader.onload = (event) => {
        // Compress/resize image here if needed, or embed directly for v1.0
        this.addNewElement('image', {
          src: event.target.result,
          width: 300,
          height: 200
        });
      };
      reader.readAsDataURL(file);
      imgLoader.value = ''; // Reset input
    });

    // Add Shapes from dropdown
    document.querySelectorAll('#shape-dropdown a').forEach(item => {
      item.addEventListener('click', (e) => {
        e.preventDefault();
        const shapeType = item.dataset.shape;
        this.addNewElement('shape', {
          shapeType: shapeType,
          fill: '#3b82f6',
          width: 150,
          height: 150
        });
        document.getElementById('shape-dropdown').removeAttribute('open');
      });
    });

    // Add Line
    document.getElementById('add-line-btn')?.addEventListener('click', () => {
      this.addNewElement('line', {
        width: 200,
        height: 20,
        color: '#333333'
      });
    });

    // Add Table Dialog Trigger
    const tableDialog = document.getElementById('table-size-dialog');
    document.getElementById('add-table-btn')?.addEventListener('click', () => {
      tableDialog.showModal();
    });

    document.getElementById('table-cancel-btn')?.addEventListener('click', () => {
      tableDialog.close();
    });

    document.getElementById('table-confirm-btn')?.addEventListener('click', () => {
      const rows = parseInt(document.getElementById('table-rows-input').value) || 3;
      const cols = parseInt(document.getElementById('table-cols-input').value) || 3;
      
      const cells = [];
      for (let i = 0; i < rows * cols; i++) {
        cells.push({ content: '' });
      }

      this.addNewElement('table', {
        rows: rows,
        cols: cols,
        cells: cells,
        width: 400,
        height: 150
      });
      tableDialog.close();
    });

    // Layer management
    document.getElementById('layer-up-btn')?.addEventListener('click', () => this.shiftLayer('up'));
    document.getElementById('layer-down-btn')?.addEventListener('click', () => this.shiftLayer('down'));
    document.getElementById('delete-element-btn')?.addEventListener('click', () => this.deleteSelectedElement());
  },

  setupInteract() {
    if (!window.interact) return;

    const self = this;

    interact('.slide-element')
      .draggable({
        listeners: {
          start(event) {
            // Select element if not already
            const id = event.target.dataset.id;
            if (state.selectedElementId !== id) {
              self.selectElement(id);
            }
          },
          move(event) {
            const id = event.target.dataset.id;
            const el = self.getElementById(id);
            if (!el) return;

            // Snap to grid (10px) if not holding Alt/Ctrl
            let dx = event.dx;
            let dy = event.dy;

            el.x += dx;
            el.y += dy;

            // Simple boundary constraints
            el.x = Math.max(-100, Math.min(960, el.x));
            el.y = Math.max(-100, Math.min(540, el.y));

            // Alignments Guides center line checks
            self.checkAlignGuides(el);

            // Update DOM element positions directly for performance during drag
            event.target.style.left = `${el.x}px`;
            event.target.style.top = `${el.y}px`;

            // Update values in properties panel
            Properties.updateElementPropertyFields(el);
          },
          end(event) {
            // Snap final coords to grid (10px)
            const id = event.target.dataset.id;
            const el = self.getElementById(id);
            if (el) {
              el.x = Math.round(el.x / 10) * 10;
              el.y = Math.round(el.y / 10) * 10;
              event.target.style.left = `${el.x}px`;
              event.target.style.top = `${el.y}px`;
            }

            document.getElementById('guides-overlay').style.display = 'none';
            saveHistoryState();
            triggerAutosave();
            SlidePanel.renderActiveThumbnail();
          }
        }
      })
      .resizable({
        edges: { left: '.w', right: '.e', bottom: '.s', top: '.n', topLeft: '.nw', topRight: '.ne', bottomLeft: '.sw', bottomRight: '.se' },
        listeners: {
          move(event) {
            const id = event.target.dataset.id;
            const el = self.getElementById(id);
            if (!el) return;

            el.x += event.deltaRect.left;
            el.y += event.deltaRect.top;
            el.width = Math.max(10, event.rect.width);
            el.height = Math.max(10, event.rect.height);

            event.target.style.left = `${el.x}px`;
            event.target.style.top = `${el.y}px`;
            event.target.style.width = `${el.width}px`;
            event.target.style.height = `${el.height}px`;

            Properties.updateElementPropertyFields(el);
          },
          end(event) {
            const id = event.target.dataset.id;
            const el = self.getElementById(id);
            if (el) {
              // Snap final size to grid
              el.x = Math.round(el.x / 10) * 10;
              el.y = Math.round(el.y / 10) * 10;
              el.width = Math.round(el.width / 10) * 10;
              el.height = Math.round(el.height / 10) * 10;

              event.target.style.left = `${el.x}px`;
              event.target.style.top = `${el.y}px`;
              event.target.style.width = `${el.width}px`;
              event.target.style.height = `${el.height}px`;
            }

            saveHistoryState();
            triggerAutosave();
            SlidePanel.renderActiveThumbnail();
          }
        }
      });
  },

  checkAlignGuides(el) {
    const guideOverlay = document.getElementById('guides-overlay');
    const guideX = document.getElementById('guide-x');
    const guideY = document.getElementById('guide-y');
    let showGuides = false;

    // Check center vertical alignment (X center is 480)
    const elCenterX = el.x + el.width / 2;
    if (Math.abs(elCenterX - 480) < 5) {
      el.x = 480 - el.width / 2; // Snap
      guideY.style.display = 'block';
      showGuides = true;
    } else {
      guideY.style.display = 'none';
    }

    // Check center horizontal alignment (Y center is 270)
    const elCenterY = el.y + el.height / 2;
    if (Math.abs(elCenterY - 270) < 5) {
      el.y = 270 - el.height / 2; // Snap
      guideX.style.display = 'block';
      showGuides = true;
    } else {
      guideX.style.display = 'none';
    }

    if (showGuides) {
      guideOverlay.style.display = 'block';
    } else {
      guideOverlay.style.display = 'none';
    }
  },

  addNewElement(type, customProps = {}) {
    const activeSlide = state.presentation.slides[state.activeSlideIndex];
    if (!activeSlide) return;

    const newId = crypto.randomUUID();
    const zIndexMax = activeSlide.elements.length > 0
      ? Math.max(...activeSlide.elements.map(el => el.zIndex || 1)) + 1
      : 1;

    const defaultElement = {
      id: newId,
      type: type,
      x: 380, // Centered default
      y: 220,
      width: 200,
      height: 100,
      rotation: 0,
      zIndex: zIndexMax,
      opacity: 1
    };

    const element = { ...defaultElement, ...customProps };
    activeSlide.elements.push(element);

    saveHistoryState();
    this.selectElement(newId);
    Canvas.renderActiveSlide();
    SlidePanel.renderActiveThumbnail();
    triggerAutosave();
  },

  selectElement(id) {
    if (state.selectedElementId === id) return;
    
    this.deselectAll();
    
    state.selectedElementId = id;
    const activeSlide = state.presentation.slides[state.activeSlideIndex];
    const el = activeSlide.elements.find(e => e.id === id);
    if (!el) return;

    // Show selection in CSS
    const node = Canvas.elementsLayer.querySelector(`[data-id="${id}"]`);
    if (node) {
      node.classList.add('selected');
      this.showSelectionHandles(node);
    }

    // Update Toolbar formatting buttons state
    this.updateToolbarFormatting(el);

    // Show Properties Panel properties section
    Properties.showElementProperties(el);

    // Enable Layer actions
    const upBtn = document.getElementById('layer-up-btn');
    const downBtn = document.getElementById('layer-down-btn');
    const delBtn = document.getElementById('delete-element-btn');
    if (upBtn) upBtn.disabled = false;
    if (downBtn) downBtn.disabled = false;
    if (delBtn) delBtn.disabled = false;
  },

  deselectAll() {
    state.selectedElementId = null;
    document.querySelectorAll('.slide-element').forEach(node => {
      node.classList.remove('selected');
      node.querySelectorAll('.resize-handle, .rotate-handle, .rotate-line').forEach(h => h.remove());
    });

    Properties.hideElementProperties();

    // Disable Layer buttons
    const upBtn = document.getElementById('layer-up-btn');
    const downBtn = document.getElementById('layer-down-btn');
    const delBtn = document.getElementById('delete-element-btn');
    if (upBtn) upBtn.disabled = true;
    if (downBtn) downBtn.disabled = true;
    if (delBtn) delBtn.disabled = true;
  },

  showSelectionHandles(node) {
    // Resize handles
    const directions = ['nw', 'ne', 'se', 'sw', 'n', 's', 'e', 'w'];
    directions.forEach(dir => {
      const handle = document.createElement('div');
      handle.className = `resize-handle ${dir}`;
      node.appendChild(handle);
    });

    // Rotation controls
    const line = document.createElement('div');
    line.className = 'rotate-line';
    node.appendChild(line);

    const rotHandle = document.createElement('div');
    rotHandle.className = 'rotate-handle';
    node.appendChild(rotHandle);

    // Set rotation dragging via interact.js if rotHandle is present
    this.setupRotateInteract(node, rotHandle);
  },

  setupRotateInteract(node, rotHandle) {
    const id = node.dataset.id;
    const el = this.getElementById(id);
    if (!el) return;

    let startAngle = el.rotation || 0;
    let center = { x: 0, y: 0 };

    interact(rotHandle).draggable({
      onstart(event) {
        const rect = node.getBoundingClientRect();
        center = {
          x: rect.left + rect.width / 2,
          y: rect.top + rect.height / 2
        };
        startAngle = el.rotation || 0;
      },
      onmove(event) {
        // Calculate angle between cursor and center
        const angle = Math.atan2(event.clientY - center.y, event.clientX - center.x) * 180 / Math.PI;
        // Adjust angle by +90deg to match rotation handle position at top center
        let adjustedAngle = Math.round(angle + 90);
        
        // Lock rotation values in [-180, 180]
        if (adjustedAngle > 180) adjustedAngle -= 360;
        if (adjustedAngle < -180) adjustedAngle += 360;

        el.rotation = adjustedAngle;
        node.style.transform = `rotate(${el.rotation}deg)`;
        Properties.updateElementPropertyFields(el);
      },
      onend() {
        saveHistoryState();
        triggerAutosave();
        SlidePanel.renderActiveThumbnail();
      }
    });
  },

  deleteSelectedElement() {
    if (!state.selectedElementId) return;

    const activeSlide = state.presentation.slides[state.activeSlideIndex];
    activeSlide.elements = activeSlide.elements.filter(el => el.id !== state.selectedElementId);

    this.deselectAll();
    Canvas.renderActiveSlide();
    SlidePanel.renderActiveThumbnail();
    saveHistoryState();
    triggerAutosave();
  },

  duplicateSelectedElement() {
    if (!state.selectedElementId) return;

    const activeSlide = state.presentation.slides[state.activeSlideIndex];
    const el = activeSlide.elements.find(e => e.id === state.selectedElementId);
    if (!el) return;

    const dup = JSON.parse(JSON.stringify(el));
    dup.id = crypto.randomUUID();
    dup.x = Math.min(800, dup.x + 20); // slightly offset
    dup.y = Math.min(440, dup.y + 20);
    dup.zIndex = Math.max(...activeSlide.elements.map(e => e.zIndex || 1)) + 1;

    activeSlide.elements.push(dup);
    saveHistoryState();
    this.selectElement(dup.id);
    Canvas.renderActiveSlide();
    SlidePanel.renderActiveThumbnail();
    triggerAutosave();
  },

  nudgeSelectedElement(direction, step) {
    const el = this.getElementById(state.selectedElementId);
    if (!el) return;

    if (direction === 'ArrowLeft') el.x -= step;
    if (direction === 'ArrowRight') el.x += step;
    if (direction === 'ArrowUp') el.y -= step;
    if (direction === 'ArrowDown') el.y += step;

    const node = Canvas.elementsLayer.querySelector(`[data-id="${el.id}"]`);
    if (node) {
      node.style.left = `${el.x}px`;
      node.style.top = `${el.y}px`;
    }

    Properties.updateElementPropertyFields(el);
    triggerAutosave();
  },

  shiftLayer(dir) {
    if (!state.selectedElementId) return;

    const activeSlide = state.presentation.slides[state.activeSlideIndex];
    const currentEl = activeSlide.elements.find(e => e.id === state.selectedElementId);
    if (!currentEl) return;

    // Simple sorting shift
    const sorted = [...activeSlide.elements].sort((a, b) => a.zIndex - b.zIndex);
    const index = sorted.findIndex(e => e.id === currentEl.id);

    if (dir === 'up' && index < sorted.length - 1) {
      const nextEl = sorted[index + 1];
      const temp = currentEl.zIndex;
      currentEl.zIndex = nextEl.zIndex;
      nextEl.zIndex = temp;
    } else if (dir === 'down' && index > 0) {
      const prevEl = sorted[index - 1];
      const temp = currentEl.zIndex;
      currentEl.zIndex = prevEl.zIndex;
      prevEl.zIndex = temp;
    }

    saveHistoryState();
    Canvas.renderActiveSlide();
    SlidePanel.renderActiveThumbnail();
    triggerAutosave();
  },

  updateToolbarFormatting(el) {
    const fontSelect = document.getElementById('font-family-select');
    const sizeSelect = document.getElementById('font-size-select');
    const boldBtn = document.getElementById('bold-btn');
    const italicBtn = document.getElementById('italic-btn');
    const alignL = document.getElementById('align-left-btn');
    const alignC = document.getElementById('align-center-btn');
    const alignR = document.getElementById('align-right-btn');
    const colorPicker = document.getElementById('text-color-picker');
    const bgPicker = document.getElementById('bg-color-picker');

    if (el.type === 'text') {
      if (fontSelect) fontSelect.value = el.fontFamily || 'Arial, sans-serif';
      if (sizeSelect) sizeSelect.value = el.fontSize || 18;
      
      if (boldBtn) {
        if (el.fontWeight === 'bold') boldBtn.classList.add('active');
        else boldBtn.classList.remove('active');
      }

      if (italicBtn) {
        if (el.fontStyle === 'italic') italicBtn.classList.add('active');
        else italicBtn.classList.remove('active');
      }

      if (alignL) {
        if (el.textAlign === 'left') alignL.classList.add('active');
        else alignL.classList.remove('active');
      }
      if (alignC) {
        if (el.textAlign === 'center') alignC.classList.add('active');
        else alignC.classList.remove('active');
      }
      if (alignR) {
        if (el.textAlign === 'right') alignR.classList.add('active');
        else alignR.classList.remove('active');
      }

      if (colorPicker) colorPicker.value = el.color || '#000000';
      if (bgPicker) {
        bgPicker.value = (!el.backgroundColor || el.backgroundColor === 'transparent') ? '#ffffff' : el.backgroundColor;
      }
    }
  },

  getElementById(id) {
    const activeSlide = state.presentation.slides[state.activeSlideIndex];
    if (!activeSlide) return null;
    return activeSlide.elements.find(e => e.id === id);
  }
};
