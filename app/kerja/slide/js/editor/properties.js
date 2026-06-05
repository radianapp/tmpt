// app/kerja/slide/js/editor/properties.js
import { state, triggerAutosave, saveHistoryState } from './editor.js';
import { Canvas } from './canvas.js';
import { SlidePanel } from './slide-panel.js';
import { Elements } from './elements.js';

export const Properties = {
  init() {
    this.setupPropertiesPanelListeners();
    this.setupToolbarFormattingListeners();
  },

  setupPropertiesPanelListeners() {
    // Width, Height, X, Y
    const propW = document.getElementById('prop-width');
    const propH = document.getElementById('prop-height');
    const propX = document.getElementById('prop-x');
    const propY = document.getElementById('prop-y');

    const updateCoords = () => {
      const el = Elements.getElementById(state.selectedElementId);
      if (!el) return;

      el.width = parseInt(propW.value) || el.width;
      el.height = parseInt(propH.value) || el.height;
      el.x = parseInt(propX.value) || el.x;
      el.y = parseInt(propY.value) || el.y;

      const node = Canvas.elementsLayer.querySelector(`[data-id="${el.id}"]`);
      if (node) {
        node.style.left = `${el.x}px`;
        node.style.top = `${el.y}px`;
        node.style.width = `${el.width}px`;
        node.style.height = `${el.height}px`;
      }
      triggerAutosave();
      SlidePanel.renderActiveThumbnail();
    };

    propW?.addEventListener('change', updateCoords);
    propH?.addEventListener('change', updateCoords);
    propX?.addEventListener('change', updateCoords);
    propY?.addEventListener('change', updateCoords);

    // Rotation
    const propRot = document.getElementById('prop-rotation');
    const propRotLbl = document.getElementById('prop-rotation-label');
    
    propRot?.addEventListener('input', (e) => {
      const el = Elements.getElementById(state.selectedElementId);
      if (!el) return;

      el.rotation = parseInt(e.target.value) || 0;
      if (propRotLbl) propRotLbl.textContent = `${el.rotation}°`;

      const node = Canvas.elementsLayer.querySelector(`[data-id="${el.id}"]`);
      if (node) {
        node.style.transform = `rotate(${el.rotation}deg)`;
      }
      triggerAutosave();
    });

    propRot?.addEventListener('change', () => {
      saveHistoryState();
      SlidePanel.renderActiveThumbnail();
    });

    // Opacity
    const propOpacity = document.getElementById('prop-opacity');
    const propOpacityLbl = document.getElementById('prop-opacity-label');

    propOpacity?.addEventListener('input', (e) => {
      const el = Elements.getElementById(state.selectedElementId);
      if (!el) return;

      el.opacity = parseFloat(e.target.value) / 100;
      if (propOpacityLbl) propOpacityLbl.textContent = `${e.target.value}%`;

      const node = Canvas.elementsLayer.querySelector(`[data-id="${el.id}"]`);
      if (node) {
        node.style.opacity = el.opacity;
      }
      triggerAutosave();
    });

    propOpacity?.addEventListener('change', () => {
      saveHistoryState();
      SlidePanel.renderActiveThumbnail();
    });

    // Slide Background Color
    const slideBgPicker = document.getElementById('slide-bg-color-picker');
    slideBgPicker?.addEventListener('input', (e) => {
      const activeSlide = state.presentation.slides[state.activeSlideIndex];
      if (!activeSlide) return;

      activeSlide.background = { type: 'color', color: e.target.value };
      Canvas.bgLayer.style.background = e.target.value;
      triggerAutosave();
    });

    slideBgPicker?.addEventListener('change', () => {
      saveHistoryState();
      SlidePanel.renderActiveThumbnail();
    });

    // Slide Transition
    const slideTransition = document.getElementById('slide-transition-select');
    slideTransition?.addEventListener('change', (e) => {
      const activeSlide = state.presentation.slides[state.activeSlideIndex];
      if (!activeSlide) return;

      activeSlide.transition = { type: e.target.value, duration: 300 };
      saveHistoryState();
      triggerAutosave();
    });

    // Speaker Notes
    const speakerNotes = document.getElementById('speaker-notes-input');
    speakerNotes?.addEventListener('input', (e) => {
      const activeSlide = state.presentation.slides[state.activeSlideIndex];
      if (!activeSlide) return;

      activeSlide.notes = e.target.value;
      triggerAutosave();
    });
  },

  setupToolbarFormattingListeners() {
    // Font family
    document.getElementById('font-family-select')?.addEventListener('change', (e) => {
      const el = Elements.getElementById(state.selectedElementId);
      if (el && el.type === 'text') {
        el.fontFamily = e.target.value;
        const node = Canvas.elementsLayer.querySelector(`[data-id="${el.id}"] .text-element-content`);
        if (node) node.style.fontFamily = el.fontFamily;
        saveHistoryState();
        triggerAutosave();
        SlidePanel.renderActiveThumbnail();
      }
    });

    // Font size
    document.getElementById('font-size-select')?.addEventListener('change', (e) => {
      const el = Elements.getElementById(state.selectedElementId);
      if (el && el.type === 'text') {
        el.fontSize = parseInt(e.target.value);
        const node = Canvas.elementsLayer.querySelector(`[data-id="${el.id}"] .text-element-content`);
        if (node) node.style.fontSize = `${el.fontSize}px`;
        saveHistoryState();
        triggerAutosave();
        SlidePanel.renderActiveThumbnail();
      }
    });

    // Bold
    document.getElementById('bold-btn')?.addEventListener('click', (e) => {
      const el = Elements.getElementById(state.selectedElementId);
      if (el && el.type === 'text') {
        el.fontWeight = el.fontWeight === 'bold' ? 'normal' : 'bold';
        e.target.classList.toggle('active');
        const node = Canvas.elementsLayer.querySelector(`[data-id="${el.id}"] .text-element-content`);
        if (node) node.style.fontWeight = el.fontWeight;
        saveHistoryState();
        triggerAutosave();
        SlidePanel.renderActiveThumbnail();
      }
    });

    // Italic
    document.getElementById('italic-btn')?.addEventListener('click', (e) => {
      const el = Elements.getElementById(state.selectedElementId);
      if (el && el.type === 'text') {
        el.fontStyle = el.fontStyle === 'italic' ? 'normal' : 'italic';
        e.target.classList.toggle('active');
        const node = Canvas.elementsLayer.querySelector(`[data-id="${el.id}"] .text-element-content`);
        if (node) node.style.fontStyle = el.fontStyle;
        saveHistoryState();
        triggerAutosave();
        SlidePanel.renderActiveThumbnail();
      }
    });

    // Text Alignments Left/Center/Right
    const setAlign = (align) => {
      const el = Elements.getElementById(state.selectedElementId);
      if (el && el.type === 'text') {
        el.textAlign = align;
        
        document.getElementById('align-left-btn').classList.remove('active');
        document.getElementById('align-center-btn').classList.remove('active');
        document.getElementById('align-right-btn').classList.remove('active');
        
        document.getElementById(`align-${align}-btn`).classList.add('active');

        const node = Canvas.elementsLayer.querySelector(`[data-id="${el.id}"] .text-element-content`);
        if (node) node.style.textAlign = el.textAlign;
        saveHistoryState();
        triggerAutosave();
        SlidePanel.renderActiveThumbnail();
      }
    };

    document.getElementById('align-left-btn')?.addEventListener('click', () => setAlign('left'));
    document.getElementById('align-center-btn')?.addEventListener('click', () => setAlign('center'));
    document.getElementById('align-right-btn')?.addEventListener('click', () => setAlign('right'));

    // Text Color
    document.getElementById('text-color-picker')?.addEventListener('input', (e) => {
      const el = Elements.getElementById(state.selectedElementId);
      if (el && el.type === 'text') {
        el.color = e.target.value;
        const node = Canvas.elementsLayer.querySelector(`[data-id="${el.id}"] .text-element-content`);
        if (node) node.style.color = el.color;
        triggerAutosave();
      }
    });

    document.getElementById('text-color-picker')?.addEventListener('change', () => {
      saveHistoryState();
      SlidePanel.renderActiveThumbnail();
    });

    // Textbox Background Color
    document.getElementById('bg-color-picker')?.addEventListener('input', (e) => {
      const el = Elements.getElementById(state.selectedElementId);
      if (el && el.type === 'text') {
        el.backgroundColor = e.target.value;
        const node = Canvas.elementsLayer.querySelector(`[data-id="${el.id}"] .text-element-content`);
        if (node) node.style.backgroundColor = el.backgroundColor;
        triggerAutosave();
      }
    });

    document.getElementById('bg-color-picker')?.addEventListener('change', () => {
      saveHistoryState();
      SlidePanel.renderActiveThumbnail();
    });
  },

  showElementProperties(el) {
    document.getElementById('element-properties-section').style.display = 'block';
    this.updateElementPropertyFields(el);
  },

  updateElementPropertyFields(el) {
    const propW = document.getElementById('prop-width');
    const propH = document.getElementById('prop-height');
    const propX = document.getElementById('prop-x');
    const propY = document.getElementById('prop-y');
    const propRot = document.getElementById('prop-rotation');
    const propRotLbl = document.getElementById('prop-rotation-label');
    const propOpacity = document.getElementById('prop-opacity');
    const propOpacityLbl = document.getElementById('prop-opacity-label');

    if (propW) propW.value = Math.round(el.width);
    if (propH) propH.value = Math.round(el.height);
    if (propX) propX.value = Math.round(el.x);
    if (propY) propY.value = Math.round(el.y);
    if (propRot) propRot.value = el.rotation || 0;
    if (propRotLbl) propRotLbl.textContent = `${el.rotation || 0}°`;
    if (propOpacity) propOpacity.value = Math.round((el.opacity !== undefined ? el.opacity : 1) * 100);
    if (propOpacityLbl) propOpacityLbl.textContent = `${Math.round((el.opacity !== undefined ? el.opacity : 1) * 100)}%`;
  },

  hideElementProperties() {
    document.getElementById('element-properties-section').style.display = 'none';
  },

  updateSlidePropertyFields() {
    const activeSlide = state.presentation.slides[state.activeSlideIndex];
    if (!activeSlide) return;

    // Background color
    const slideBgPicker = document.getElementById('slide-bg-color-picker');
    if (slideBgPicker) {
      slideBgPicker.value = (activeSlide.background && activeSlide.background.color) || '#ffffff';
    }

    // Transition
    const slideTransition = document.getElementById('slide-transition-select');
    if (slideTransition) {
      slideTransition.value = (activeSlide.transition && activeSlide.transition.type) || 'none';
    }

    // Speaker notes
    const speakerNotes = document.getElementById('speaker-notes-input');
    if (speakerNotes) {
      speakerNotes.value = activeSlide.notes || '';
    }
  }
};
