// app/kerja/slide/js/editor/slide-panel.js
import { state, triggerAutosave, saveHistoryState } from './editor.js';
import { Canvas } from './canvas.js';
import { Properties } from './properties.js';
import { Elements } from './elements.js';

export const SlidePanel = {
  init() {
    this.container = document.getElementById('slide-thumbnails-container');
    
    document.getElementById('add-slide-btn')?.addEventListener('click', () => {
      this.addNewSlide();
    });

    this.renderThumbnails();
  },

  renderThumbnails() {
    if (!this.container) return;
    this.container.innerHTML = '';

    state.presentation.slides.forEach((slide, index) => {
      const wrapper = document.createElement('div');
      wrapper.className = `slide-thumb-wrapper ${index === state.activeSlideIndex ? 'active' : ''}`;
      wrapper.draggable = true;
      wrapper.dataset.index = index;

      // Number label
      const numLabel = document.createElement('span');
      numLabel.className = 'slide-number';
      numLabel.textContent = index + 1;
      wrapper.appendChild(numLabel);

      // Thumbnail box
      const thumb = document.createElement('div');
      thumb.className = 'slide-thumb';

      // Background inside thumbnail
      const bg = document.createElement('div');
      bg.className = 'slide-thumb-bg';
      const bgStyle = slide.background || { type: 'color', color: '#ffffff' };
      if (bgStyle.type === 'color') {
        bg.style.background = bgStyle.color;
      } else if (bgStyle.type === 'image') {
        bg.style.backgroundImage = `url(${bgStyle.image})`;
      }
      thumb.appendChild(bg);

      // Micro elements replica
      const microElements = document.createElement('div');
      microElements.className = 'slide-thumb-elements';
      
      slide.elements.forEach(el => {
        const microEl = document.createElement('div');
        microEl.style.position = 'absolute';
        microEl.style.left = `${el.x}px`;
        microEl.style.top = `${el.y}px`;
        microEl.style.width = `${el.width}px`;
        microEl.style.height = `${el.height}px`;
        microEl.style.zIndex = el.zIndex || 1;
        microEl.style.transform = `rotate(${el.rotation || 0}deg)`;
        microEl.style.opacity = el.opacity !== undefined ? el.opacity : 1;

        if (el.type === 'text') {
          microEl.style.fontFamily = el.fontFamily || 'Arial, sans-serif';
          microEl.style.fontSize = `${el.fontSize || 18}px`;
          microEl.style.fontWeight = el.fontWeight || 'normal';
          microEl.style.fontStyle = el.fontStyle || 'normal';
          microEl.style.color = el.color || '#000000';
          microEl.style.textAlign = el.textAlign || 'left';
          microEl.style.backgroundColor = el.backgroundColor || 'transparent';
          microEl.style.overflow = 'hidden';
          microEl.textContent = el.content || '';
        } else if (el.type === 'image') {
          const img = document.createElement('img');
          img.src = el.src;
          img.style.width = '100%';
          img.style.height = '100%';
          img.style.objectFit = el.fit || 'fill';
          microEl.appendChild(img);
        } else if (el.type === 'shape') {
          microEl.style.backgroundColor = el.fill || '#3b82f6';
          if (el.shapeType === 'circle') microEl.style.borderRadius = '50%';
        } else if (el.type === 'line') {
          microEl.style.height = '2px';
          microEl.style.backgroundColor = el.color || '#333333';
        } else if (el.type === 'table') {
          microEl.style.border = '1px solid #94a3b8';
          microEl.style.backgroundColor = '#f1f5f9';
        }

        microElements.appendChild(microEl);
      });
      thumb.appendChild(microElements);
      wrapper.appendChild(thumb);

      // Delete slide button
      const delBtn = document.createElement('button');
      delBtn.className = 'delete-slide-btn';
      delBtn.innerHTML = '×';
      delBtn.title = 'Hapus Slide';
      delBtn.addEventListener('click', (e) => {
        e.stopPropagation();
        this.deleteSlide(index);
      });
      wrapper.appendChild(delBtn);

      // Event Click to switch slide
      wrapper.addEventListener('click', () => {
        this.switchActiveSlide(index);
      });

      // Drag and Drop reordering handlers
      this.setupDragAndDrop(wrapper);

      this.container.appendChild(wrapper);
    });
  },

  renderActiveThumbnail() {
    // Re-render only active slide's thumbnail for snappy response
    const activeSlide = state.presentation.slides[state.activeSlideIndex];
    if (!activeSlide) return;

    const wrapper = this.container.querySelector(`.slide-thumb-wrapper[data-index="${state.activeSlideIndex}"]`);
    if (!wrapper) return;

    // Reset bg
    const bg = wrapper.querySelector('.slide-thumb-bg');
    if (bg) {
      const bgStyle = activeSlide.background || { type: 'color', color: '#ffffff' };
      if (bgStyle.type === 'color') {
        bg.style.background = bgStyle.color;
        bg.style.backgroundImage = '';
      } else if (bgStyle.type === 'image') {
        bg.style.backgroundImage = `url(${bgStyle.image})`;
      }
    }

    // Reset elements
    const microElements = wrapper.querySelector('.slide-thumb-elements');
    if (microElements) {
      microElements.innerHTML = '';
      activeSlide.elements.forEach(el => {
        const microEl = document.createElement('div');
        microEl.style.position = 'absolute';
        microEl.style.left = `${el.x}px`;
        microEl.style.top = `${el.y}px`;
        microEl.style.width = `${el.width}px`;
        microEl.style.height = `${el.height}px`;
        microEl.style.zIndex = el.zIndex || 1;
        microEl.style.transform = `rotate(${el.rotation || 0}deg)`;
        microEl.style.opacity = el.opacity !== undefined ? el.opacity : 1;

        if (el.type === 'text') {
          microEl.style.fontFamily = el.fontFamily || 'Arial, sans-serif';
          microEl.style.fontSize = `${el.fontSize || 18}px`;
          microEl.style.fontWeight = el.fontWeight || 'normal';
          microEl.style.fontStyle = el.fontStyle || 'normal';
          microEl.style.color = el.color || '#000000';
          microEl.style.textAlign = el.textAlign || 'left';
          microEl.style.backgroundColor = el.backgroundColor || 'transparent';
          microEl.style.overflow = 'hidden';
          microEl.textContent = el.content || '';
        } else if (el.type === 'image') {
          const img = document.createElement('img');
          img.src = el.src;
          img.style.width = '100%';
          img.style.height = '100%';
          img.style.objectFit = el.fit || 'fill';
          microEl.appendChild(img);
        } else if (el.type === 'shape') {
          microEl.style.backgroundColor = el.fill || '#3b82f6';
          if (el.shapeType === 'circle') microEl.style.borderRadius = '50%';
        } else if (el.type === 'line') {
          microEl.style.height = '2px';
          microEl.style.backgroundColor = el.color || '#333333';
        } else if (el.type === 'table') {
          microEl.style.border = '1px solid #94a3b8';
          microEl.style.backgroundColor = '#f1f5f9';
        }

        microElements.appendChild(microEl);
      });
    }
  },

  switchActiveSlide(index) {
    if (index === state.activeSlideIndex) return;

    Elements.deselectAll();
    
    state.activeSlideIndex = index;
    
    // Toggle active classes in thumbnail panel
    this.container.querySelectorAll('.slide-thumb-wrapper').forEach((node, idx) => {
      if (idx === index) node.classList.add('active');
      else node.classList.remove('active');
    });

    Canvas.renderActiveSlide();
    Properties.updateSlidePropertyFields();
  },

  addNewSlide() {
    const newSlide = {
      id: crypto.randomUUID(),
      background: { type: 'color', color: '#ffffff' },
      transition: { type: 'none', duration: 300 },
      notes: '',
      elements: []
    };

    state.presentation.slides.splice(state.activeSlideIndex + 1, 0, newSlide);
    state.activeSlideIndex++;
    
    saveHistoryState();
    this.renderThumbnails();
    Canvas.renderActiveSlide();
    Properties.updateSlidePropertyFields();
    triggerAutosave();
  },

  deleteSlide(index) {
    if (state.presentation.slides.length <= 1) {
      if (window.TMPT_UI) window.TMPT_UI.toast('Presentasi harus memiliki minimal satu slide.', 'warning');
      return;
    }

    state.presentation.slides.splice(index, 1);

    if (state.activeSlideIndex >= state.presentation.slides.length) {
      state.activeSlideIndex = state.presentation.slides.length - 1;
    }

    saveHistoryState();
    this.renderThumbnails();
    Canvas.renderActiveSlide();
    Properties.updateSlidePropertyFields();
    triggerAutosave();
  },

  setupDragAndDrop(node) {
    node.addEventListener('dragstart', (e) => {
      e.dataTransfer.setData('text/plain', node.dataset.index);
      node.style.opacity = '0.5';
    });

    node.addEventListener('dragend', () => {
      node.style.opacity = '1';
      this.container.querySelectorAll('.slide-thumb-wrapper').forEach(w => {
        w.style.borderTop = '';
        w.style.borderBottom = '';
      });
    });

    node.addEventListener('dragover', (e) => {
      e.preventDefault();
      const draggingIdx = parseInt(e.dataTransfer.types.includes('text/plain') ? '0' : ''); // placeholder check
      const currentIdx = parseInt(node.dataset.index);
      const rect = node.getBoundingClientRect();
      const midpoint = rect.top + rect.height / 2;

      if (e.clientY < midpoint) {
        node.style.borderTop = '3px solid var(--pico-primary)';
        node.style.borderBottom = '';
      } else {
        node.style.borderBottom = '3px solid var(--pico-primary)';
        node.style.borderTop = '';
      }
    });

    node.addEventListener('dragleave', () => {
      node.style.borderTop = '';
      node.style.borderBottom = '';
    });

    node.addEventListener('drop', (e) => {
      e.preventDefault();
      const fromIndex = parseInt(e.dataTransfer.getData('text/plain'));
      const toIndex = parseInt(node.dataset.index);

      if (fromIndex === toIndex) return;

      const rect = node.getBoundingClientRect();
      const midpoint = rect.top + rect.height / 2;
      let finalIndex = toIndex;

      if (e.clientY >= midpoint && fromIndex > toIndex) {
        finalIndex = toIndex + 1;
      } else if (e.clientY < midpoint && fromIndex < toIndex) {
        finalIndex = toIndex - 1;
      }

      // Reorder slides array
      const slideToMove = state.presentation.slides.splice(fromIndex, 1)[0];
      state.presentation.slides.splice(finalIndex, 0, slideToMove);

      // Maintain active slide target
      if (state.activeSlideIndex === fromIndex) {
        state.activeSlideIndex = finalIndex;
      } else if (state.activeSlideIndex > fromIndex && state.activeSlideIndex <= finalIndex) {
        state.activeSlideIndex--;
      } else if (state.activeSlideIndex < fromIndex && state.activeSlideIndex >= finalIndex) {
        state.activeSlideIndex++;
      }

      saveHistoryState();
      this.renderThumbnails();
      Canvas.renderActiveSlide();
      triggerAutosave();
    });
  }
};
