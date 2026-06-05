// app/kerja/slide/js/editor/canvas.js
import { state, triggerAutosave } from './editor.js';
import { Elements } from './elements.js';

export const Canvas = {
  init() {
    this.canvasElement = document.getElementById('editor-slide-canvas');
    this.elementsLayer = document.getElementById('canvas-elements-layer');
    this.bgLayer = document.getElementById('canvas-slide-bg');
    this.workspaceElement = document.querySelector('.canvas-workspace');

    // Deselect click on empty canvas
    this.canvasElement.addEventListener('mousedown', (e) => {
      if (e.target === this.canvasElement || e.target === this.elementsLayer || e.target === this.bgLayer) {
        Elements.deselectAll();
      }
    });

    // Handle window resize for autoscale
    window.addEventListener('resize', () => this.scaleCanvas());
    this.scaleCanvas();
  },

  scaleCanvas() {
    if (!this.canvasElement || !this.workspaceElement) return;

    const availableWidth = this.workspaceElement.clientWidth - 48;
    const availableHeight = this.workspaceElement.clientHeight - 80; // Offset for headers/footers

    const scaleX = availableWidth / 960;
    const scaleY = availableHeight / 540;
    const scale = Math.min(scaleX, scaleY, 1.5) * (state.zoomLevel / 100);

    this.canvasElement.style.transform = `scale(${scale})`;
    this.canvasElement.style.transformOrigin = 'center center';
  },

  renderActiveSlide() {
    const activeSlide = state.presentation.slides[state.activeSlideIndex];
    if (!activeSlide) return;

    // 1. Render Background
    const bg = activeSlide.background || { type: 'color', color: '#ffffff' };
    if (bg.type === 'color') {
      this.bgLayer.style.background = bg.color;
    } else if (bg.type === 'image') {
      this.bgLayer.style.backgroundImage = `url(${bg.image})`;
    } else {
      this.bgLayer.style.background = '#ffffff';
    }

    // 2. Render Elements
    this.elementsLayer.innerHTML = '';
    
    // Sort elements by zIndex
    const sortedElements = [...activeSlide.elements].sort((a, b) => a.zIndex - b.zIndex);
    
    sortedElements.forEach((el) => {
      const elNode = this.createElementNode(el);
      this.elementsLayer.appendChild(elNode);
    });

    // 3. Update active element class and properties
    if (state.selectedElementId) {
      const elNode = this.elementsLayer.querySelector(`[data-id="${state.selectedElementId}"]`);
      if (elNode) {
        elNode.classList.add('selected');
        Elements.showSelectionHandles(elNode);
      } else {
        state.selectedElementId = null;
      }
    }

    // 4. Update Slide Counter
    const counter = document.getElementById('slide-counter');
    if (counter) {
      counter.textContent = `Slide ${state.activeSlideIndex + 1} dari ${state.presentation.slides.length}`;
    }

    this.scaleCanvas();
  },

  createElementNode(el) {
    const node = document.createElement('div');
    node.className = 'slide-element';
    node.dataset.id = el.id;
    node.dataset.type = el.type;

    node.style.left = `${el.x}px`;
    node.style.top = `${el.y}px`;
    node.style.width = `${el.width}px`;
    node.style.height = `${el.height}px`;
    node.style.transform = `rotate(${el.rotation || 0}deg)`;
    node.style.zIndex = el.zIndex || 1;
    node.style.opacity = el.opacity !== undefined ? el.opacity : 1;

    // Content container wrapper
    const wrapper = document.createElement('div');
    wrapper.className = 'element-content-wrapper';

    if (el.type === 'text') {
      const content = document.createElement('div');
      content.className = 'text-element-content';
      content.contentEditable = 'true';
      content.style.fontFamily = el.fontFamily || 'Arial, sans-serif';
      content.style.fontSize = `${el.fontSize || 18}px`;
      content.style.fontWeight = el.fontWeight || 'normal';
      content.style.fontStyle = el.fontStyle || 'normal';
      content.style.color = el.color || '#000000';
      content.style.textAlign = el.textAlign || 'left';
      content.style.backgroundColor = el.backgroundColor || 'transparent';
      content.textContent = el.content || '';
      
      // Auto-update content in state
      content.addEventListener('input', () => {
        el.content = content.textContent;
        triggerAutosave();
      });

      wrapper.appendChild(content);

    } else if (el.type === 'image') {
      const img = document.createElement('img');
      img.className = 'image-element-content';
      img.src = el.src;
      img.style.objectFit = el.fit || 'fill';
      wrapper.appendChild(img);

    } else if (el.type === 'shape') {
      const shape = document.createElement('div');
      shape.className = 'shape-element-content';
      
      const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
      svg.setAttribute('width', '100%');
      svg.setAttribute('height', '100%');
      svg.setAttribute('viewBox', '0 0 100 100');
      svg.setAttribute('preserveAspectRatio', 'none');

      let shapePath = null;
      const fill = el.fill || '#3b82f6';
      const strokeColor = el.stroke ? el.stroke.color : 'transparent';
      const strokeWidth = el.stroke ? el.stroke.width : 0;

      if (el.shapeType === 'circle') {
        shapePath = document.createElementNS('http://www.w3.org/2000/svg', 'circle');
        shapePath.setAttribute('cx', '50');
        shapePath.setAttribute('cy', '50');
        shapePath.setAttribute('r', '48');
      } else if (el.shapeType === 'triangle') {
        shapePath = document.createElementNS('http://www.w3.org/2000/svg', 'polygon');
        shapePath.setAttribute('points', '50,4 96,96 4,96');
      } else if (el.shapeType === 'star') {
        shapePath = document.createElementNS('http://www.w3.org/2000/svg', 'polygon');
        shapePath.setAttribute('points', '50,5 64,36 98,36 70,57 81,91 50,70 19,91 30,57 2,36 36,36');
      } else if (el.shapeType === 'arrow-right') {
        shapePath = document.createElementNS('http://www.w3.org/2000/svg', 'polygon');
        shapePath.setAttribute('points', '10,35 60,35 60,10 90,50 60,90 60,65 10,65');
      } else if (el.shapeType === 'arrow-left') {
        shapePath = document.createElementNS('http://www.w3.org/2000/svg', 'polygon');
        shapePath.setAttribute('points', '90,35 40,35 40,10 10,50 40,90 40,65 90,65');
      } else {
        // default rectangle
        shapePath = document.createElementNS('http://www.w3.org/2000/svg', 'rect');
        shapePath.setAttribute('x', '2');
        shapePath.setAttribute('y', '2');
        shapePath.setAttribute('width', '96');
        shapePath.setAttribute('height', '96');
        if (el.borderRadius) {
          shapePath.setAttribute('rx', el.borderRadius);
          shapePath.setAttribute('ry', el.borderRadius);
        }
      }

      shapePath.setAttribute('fill', fill);
      shapePath.setAttribute('stroke', strokeColor);
      shapePath.setAttribute('stroke-width', strokeWidth);
      svg.appendChild(shapePath);
      shape.appendChild(svg);
      wrapper.appendChild(shape);

    } else if (el.type === 'line') {
      const line = document.createElement('div');
      line.className = 'shape-element-content';
      const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
      svg.setAttribute('width', '100%');
      svg.setAttribute('height', '100%');
      svg.setAttribute('viewBox', '0 0 100 100');
      svg.setAttribute('preserveAspectRatio', 'none');

      const path = document.createElementNS('http://www.w3.org/2000/svg', 'line');
      path.setAttribute('x1', '0');
      path.setAttribute('y1', '50');
      path.setAttribute('x2', '100');
      path.setAttribute('y2', '50');
      path.setAttribute('stroke', el.color || '#333333');
      path.setAttribute('stroke-width', el.strokeWidth || '5');
      svg.appendChild(path);
      line.appendChild(svg);
      wrapper.appendChild(line);

    } else if (el.type === 'table') {
      const table = document.createElement('table');
      table.className = 'table-element-content';
      
      const rows = el.rows || 3;
      const cols = el.cols || 3;
      const cells = el.cells || [];

      for (let r = 0; r < rows; r++) {
        const tr = document.createElement('tr');
        for (let c = 0; c < cols; c++) {
          const td = document.createElement('td');
          td.contentEditable = 'true';
          const cellIndex = r * cols + c;
          const cellData = cells[cellIndex] || { content: '' };
          td.textContent = cellData.content || '';
          
          td.addEventListener('input', () => {
            if (!el.cells) el.cells = [];
            el.cells[cellIndex] = { content: td.textContent };
            triggerAutosave();
          });
          
          tr.appendChild(td);
        }
        table.appendChild(tr);
      }
      wrapper.appendChild(table);
    }

    node.appendChild(wrapper);

    // Mousedown listener to select element
    node.addEventListener('mousedown', (e) => {
      e.stopPropagation();
      Elements.selectElement(el.id);
    });

    return node;
  }
};
