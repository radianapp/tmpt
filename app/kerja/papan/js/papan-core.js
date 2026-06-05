import { openTmptDB } from '/shared/db.js';
import { Viewport } from './viewport.js';
import { Renderer } from './renderer.js';
import { HistoryManager } from './history.js';
import { exportBoardAsPng, exportBoardAsSvg } from './export.js';
import { exportBoardAsJson, exportBoardAsExcalidraw } from './compat.js';

document.addEventListener('DOMContentLoaded', async () => {
  const canvas = document.getElementById('papan-canvas');
  const boardTitleInput = document.getElementById('board-title-input');
  const saveStatus = document.getElementById('save-status');

  const btnUndo = document.getElementById('btn-undo');
  const btnRedo = document.getElementById('btn-redo');
  const btnClearCanvas = document.getElementById('btn-clear-canvas');
  const clearModal = document.getElementById('clear-confirm-modal');
  const btnConfirmClear = document.getElementById('btn-confirm-clear');
  const btnCancelClear = document.getElementById('btn-cancel-clear');
  const btnCloseClearModal = document.getElementById('btn-close-clear-modal');

  const btnZoomIn = document.getElementById('zoom-in-btn');
  const btnZoomOut = document.getElementById('zoom-out-btn');
  const btnZoomReset = document.getElementById('zoom-reset-btn');
  const zoomValueSpan = document.getElementById('zoom-value-span');

  const toolbar = document.getElementById('main-toolbar');
  const propertiesPanel = document.getElementById('properties-panel');
  const fontGroup = document.getElementById('font-family-group');
  const fillGroup = document.getElementById('fill-prop-group');
  const fillStyleGroup = document.getElementById('fill-style-group');

  const strokeColorPicker = document.getElementById('stroke-color-picker');
  const fillColorPicker = document.getElementById('fill-color-picker');
  const fillStyleSelect = document.getElementById('fill-style-select');
  const roughnessSelect = document.getElementById('roughness-select');
  const strokeWidthSelect = document.getElementById('stroke-width-select');
  const fontFamilySelect = document.getElementById('font-family-select');
  const canvasGridSelect = document.getElementById('canvas-grid-select');
  const opacitySlider = document.getElementById('opacity-slider');

  const textEditorOverlay = document.getElementById('text-editor-overlay');

  const exportPngBtn = document.getElementById('export-png-btn');
  const exportSvgBtn = document.getElementById('export-svg-btn');
  const exportPapanBtn = document.getElementById('export-papan-btn');
  const exportExcalBtn = document.getElementById('export-excal-btn');

  // Core App State
  let db = null;
  let boardId = new URLSearchParams(window.location.search).get('id');
  let board = {
    id: boardId || crypto.randomUUID(),
    title: 'Papan Coretan Baru',
    elements: [],
    appState: {
      viewBackgroundColor: '#ffffff',
      gridMode: false,
      gridStyle: 'blank',
      snapToGrid: false,
      gridSize: 20,
      theme: 'light'
    },
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
    thumbnail: '',
    version: 1
  };

  let selectedElements = [];
  let currentTool = 'select'; // select, rectangle, ellipse, diamond, triangle, line, arrow, freedraw, text, sticky
  let isDrawing = false;
  let isDragging = false;
  let isPanning = false;
  
  let startX = 0; // World coords
  let startY = 0;
  let dragStartX = 0;
  let dragStartY = 0;
  let currentElement = null;
  let hoveredSnapElement = null;

  // Configuration settings for newly created elements
  let defaultStrokeColor = '#1e1e1e';
  let defaultFillColor = 'transparent';
  let defaultFillStyle = 'solid';
  let defaultRoughness = 1;
  let defaultStrokeWidth = 2;
  let defaultFontFamily = 'hand';
  let defaultOpacity = 1;

  // Dynamic Cursor Setting
  function updateCursor() {
    if (isPanning) {
      canvas.style.cursor = 'grabbing';
      return;
    }
    if (currentTool === 'pan') {
      canvas.style.cursor = 'grab';
    } else if (currentTool === 'select') {
      canvas.style.cursor = 'default';
    } else {
      canvas.style.cursor = 'crosshair';
    }
  }

  // Adjust default colors for Dark Mode
  function adjustDefaultColors() {
    const isDark = document.documentElement.getAttribute('data-theme') === 'dark';
    if (isDark) {
      defaultStrokeColor = '#ffffff';
      board.appState.viewBackgroundColor = '#121212';
    } else {
      defaultStrokeColor = '#1e1e1e';
      board.appState.viewBackgroundColor = '#ffffff';
    }
  }

  // Observe theme changes to adapt canvas
  const themeObserver = new MutationObserver(() => {
    adjustDefaultColors();
    requestRender();
  });
  themeObserver.observe(document.documentElement, { attributes: true, attributeFilter: ['data-theme'] });

  // Initialize helper modules
  const viewport = new Viewport();
  const renderer = new Renderer(canvas);
  const history = new HistoryManager();

  // Resize canvas to fill viewport
  function resizeCanvas() {
    canvas.width = canvas.parentElement.clientWidth;
    canvas.height = canvas.parentElement.clientHeight;
    requestRender();
  }

  let renderPending = false;
  function requestRender() {
    if (renderPending) return;
    renderPending = true;
    requestAnimationFrame(() => {
      renderPending = false;
      const ctx = canvas.getContext('2d');
      ctx.clearRect(0, 0, canvas.width, canvas.height);

      // Render grid if enabled
      if (board.appState.gridStyle && board.appState.gridStyle !== 'blank') {
        drawGrid(ctx);
      }

      // Render elements
      const sorted = [...board.elements].sort((a, b) => (a.zIndex || 0) - (b.zIndex || 0));
      sorted.forEach(el => {
        renderer.renderElement(el, ctx, viewport);
      });

      // Render active drawing ghost if any
      if (isDrawing && currentElement) {
        renderer.renderElement(currentElement, ctx, viewport);
      }

      // Render selection bounding box
      if (currentTool === 'select' && selectedElements.length > 0) {
        renderer.renderSelectionHandles(selectedElements, viewport);
      }

      // Render snap target indicator for arrow connections
      if (isDrawing && currentTool === 'arrow' && hoveredSnapElement) {
        const sEl = hoveredSnapElement;
        const center = viewport.toScreen(sEl.x, sEl.y);
        const sW = sEl.width * viewport.zoom;
        const sH = sEl.height * viewport.zoom;
        ctx.save();
        ctx.translate(center.x, center.y);
        ctx.rotate(sEl.angle || 0);
        ctx.strokeStyle = '#059669'; // Emerald snap green
        ctx.lineWidth = 2;
        ctx.setLineDash([6, 4]);
        ctx.strokeRect(-sW/2 - 6, -sH/2 - 6, sW + 12, sH + 12);
        ctx.restore();
      }

      // Update zoom indicator
      zoomValueSpan.textContent = `${Math.round(viewport.zoom * 100)}%`;
      updateCursor();
    });
  }

  function drawGrid(ctx) {
    ctx.save();
    ctx.strokeStyle = document.documentElement.getAttribute('data-theme') === 'dark' ? '#222' : '#f0f0f0';
    ctx.lineWidth = 1;

    const size = board.appState.gridSize * viewport.zoom;
    const startY = (viewport.scrollY * viewport.zoom) % size;

    if (board.appState.gridStyle === 'grid') {
      const startX = (viewport.scrollX * viewport.zoom) % size;
      for (let x = startX; x < canvas.width; x += size) {
        ctx.beginPath();
        ctx.moveTo(x, 0);
        ctx.lineTo(x, canvas.height);
        ctx.stroke();
      }
    }

    for (let y = startY; y < canvas.height; y += size) {
      ctx.beginPath();
      ctx.moveTo(0, y);
      ctx.lineTo(canvas.width, y);
      ctx.stroke();
    }
    ctx.restore();
  }

  // Open database and load board
  async function init() {
    adjustDefaultColors();
    try {
      db = await openTmptDB('tmpt_papan', 2, (database) => {
        if (!database.objectStoreNames.contains('boards')) {
          database.createObjectStore('boards', { keyPath: 'id' });
        }
      });

      if (boardId) {
        const transaction = db.transaction('boards', 'readonly');
        const store = transaction.objectStore('boards');
        const req = store.get(boardId);
        
        req.onsuccess = () => {
          if (req.result) {
            board = req.result;
            // Handle backwards compatibility for gridStyle
            if (board.appState.gridStyle === undefined) {
              board.appState.gridStyle = board.appState.gridMode ? 'grid' : 'blank';
            }
            boardTitleInput.value = board.title;
            history.push(board.elements);
            viewport.fitToElements(board.elements, canvas.width, canvas.height);
          }
          updatePropertiesPanel();
          requestRender();
        };
      } else {
        updatePropertiesPanel();
      }
    } catch (err) {
      console.error(err);
    }
  }

  // Auto-save logic with 2s debounce
  let autosaveTimer = null;
  function triggerAutosave() {
    clearTimeout(autosaveTimer);
    saveStatus.textContent = 'Ada perubahan...';
    
    autosaveTimer = setTimeout(async () => {
      saveStatus.textContent = 'Menyimpan...';
      try {
        // Generate base64 thumbnail of canvas area containing elements
        const offCanvas = document.createElement('canvas');
        offCanvas.width = 180;
        offCanvas.height = 100;
        const oCtx = offCanvas.getContext('2d');
        oCtx.fillStyle = board.appState.viewBackgroundColor || '#ffffff';
        oCtx.fillRect(0, 0, 180, 100);
        
        // draw preview elements if any
        if (board.elements.length > 0) {
          const previewViewport = new Viewport();
          previewViewport.fitToElements(board.elements, 180, 100);
          const previewRenderer = new Renderer(offCanvas);
          board.elements.slice(0, 10).forEach(el => {
            previewRenderer.renderElement(el, oCtx, previewViewport);
          });
        }
        
        board.thumbnail = offCanvas.toDataURL('image/jpeg', 0.6);
        board.updated_at = new Date().toISOString();
        board.title = boardTitleInput.value.trim() || 'Papan Coretan Baru';

        const transaction = db.transaction('boards', 'readwrite');
        const store = transaction.objectStore('boards');
        store.put(board);

        transaction.oncomplete = () => {
          saveStatus.textContent = 'Tersimpan ✓';
          if (window.broadcastTMPT) {
            window.broadcastTMPT('FILE_UPDATED', {
              id: board.id,
              type: 'papan',
              title: board.title,
              app_db: 'tmpt_papan'
            });
          }
        };
      } catch (err) {
        console.error(err);
        saveStatus.textContent = 'Gagal menyimpan ⚠️';
      }
    }, 2000);
  }

  // Hit testing to select elements
  function getElementAtPosition(x, y) {
    // Traverse in reverse z-index order to pick top element
    const sorted = [...board.elements].sort((a, b) => (b.zIndex || 0) - (a.zIndex || 0));
    
    for (const el of sorted) {
      if (el.type === 'freedraw') {
        // Simple bounding box hit test for freehand path
        let minX = Infinity, minY = Infinity;
        let maxX = -Infinity, maxY = -Infinity;
        el.points.forEach(pt => {
          const px = el.x + pt[0];
          const py = el.y + pt[1];
          minX = Math.min(minX, px);
          minY = Math.min(minY, py);
          maxX = Math.max(maxX, px);
          maxY = Math.max(maxY, py);
        });
        if (x >= minX && x <= maxX && y >= minY && y <= maxY) {
          return el;
        }
      } else {
        const halfW = el.width / 2;
        const halfH = el.height / 2;
        if (x >= el.x - halfW && x <= el.x + halfW && y >= el.y - halfH && y <= el.y + halfH) {
          return el;
        }
      }
    }
    return null;
  }

  // Selection state updates UI properties panel
  function updatePropertiesPanel() {
    const strokeGroup = document.getElementById('stroke-prop-group');
    const roughnessGroup = document.getElementById('roughness-prop-group');
    const strokeWidthGroup = document.getElementById('stroke-width-prop-group');
    const layersGroup = document.getElementById('layers-prop-group');

    // Determine the active item type to show controls for
    let activeType = 'canvas';
    if (selectedElements.length > 0) {
      activeType = selectedElements[0].type;
    } else if (currentTool !== 'select' && currentTool !== 'pan') {
      activeType = currentTool;
    }

    if (activeType === 'canvas') {
      propertiesPanel.style.display = 'none';
      return;
    }

    propertiesPanel.style.display = 'flex';

    // Show/hide layers controls based on selection
    if (layersGroup) {
      if (selectedElements.length > 0) {
        layersGroup.style.display = 'block';
      } else {
        layersGroup.style.display = 'none';
      }
    }

    // Show/hide type-specific settings
    if (activeType === 'text') {
      fontGroup.style.display = 'block';
      strokeGroup.style.display = 'block';
      strokeWidthGroup.style.display = 'block';
      fillGroup.style.display = 'none';
      fillStyleGroup.style.display = 'none';
      roughnessGroup.style.display = 'none';
    } else if (activeType === 'sticky') {
      fontGroup.style.display = 'block';
      strokeGroup.style.display = 'block';
      strokeWidthGroup.style.display = 'block';
      roughnessGroup.style.display = 'block';
      fillGroup.style.display = 'block';
      fillStyleGroup.style.display = 'block';
    } else if (activeType === 'freedraw') {
      fontGroup.style.display = 'none';
      strokeGroup.style.display = 'block';
      strokeWidthGroup.style.display = 'block';
      roughnessGroup.style.display = 'block';
      fillGroup.style.display = 'none';
      fillStyleGroup.style.display = 'none';
    } else {
      // standard shapes: rectangle, ellipse, diamond, triangle, line, arrow
      fontGroup.style.display = 'none';
      strokeGroup.style.display = 'block';
      strokeWidthGroup.style.display = 'block';
      roughnessGroup.style.display = 'block';
      
      // line and arrow do not use fill/bg
      if (activeType === 'line' || activeType === 'arrow') {
        fillGroup.style.display = 'none';
        fillStyleGroup.style.display = 'none';
      } else {
        fillGroup.style.display = 'block';
        fillStyleGroup.style.display = 'block';
      }
    }

    // Helper to toggle active buttons in button groups
    const setActiveBtn = (groupId, val) => {
      const container = document.getElementById(groupId);
      if (!container) return;
      Array.from(container.querySelectorAll('.prop-btn')).forEach(btn => {
        btn.classList.toggle('active', btn.dataset.value == val);
      });
    };

    // Set properties control values based on selected element or defaults
    if (selectedElements.length > 0) {
      const first = selectedElements[0];
      setActiveBtn('roughness-group-btns', first.roughness ?? 1);
      setActiveBtn('stroke-width-group-btns', first.strokeWidth ?? 2);
      if (first.fontFamily) setActiveBtn('font-family-group-btns', first.fontFamily);
      if (first.fillStyle) setActiveBtn('fill-style-group-btns', first.fillStyle);

      // Highlight active colors
      Array.from(strokeColorPicker.children).forEach(sw => {
        sw.classList.toggle('active', sw.dataset.color === first.strokeColor);
      });
      Array.from(fillColorPicker.children).forEach(sw => {
        sw.classList.toggle('active', sw.dataset.color === (first.backgroundColor || 'transparent'));
      });

      if (opacitySlider) {
        opacitySlider.value = Math.round((first.opacity ?? 1) * 100);
      }
    } else {
      // Setup defaults for current creation tool
      setActiveBtn('roughness-group-btns', defaultRoughness);
      setActiveBtn('stroke-width-group-btns', defaultStrokeWidth);
      setActiveBtn('font-family-group-btns', defaultFontFamily);
      setActiveBtn('fill-style-group-btns', defaultFillStyle);

      // Highlight active default colors
      Array.from(strokeColorPicker.children).forEach(sw => {
        sw.classList.toggle('active', sw.dataset.color === defaultStrokeColor);
      });
      Array.from(fillColorPicker.children).forEach(sw => {
        sw.classList.toggle('active', sw.dataset.color === defaultFillColor);
      });

      if (opacitySlider) {
        opacitySlider.value = Math.round(defaultOpacity * 100);
      }
    }
  }

  // Tool change
  toolbar.addEventListener('click', (e) => {
    const btn = e.target.closest('.toolbar-btn');
    if (!btn || btn.id === 'btn-clear-canvas') return;

    Array.from(toolbar.querySelectorAll('.toolbar-btn')).forEach(b => b.classList.remove('active'));
    btn.classList.add('active');
    currentTool = btn.dataset.tool;
    
    // Clear selection on switching away from select tool
    if (currentTool !== 'select') {
      selectedElements = [];
    }
    updatePropertiesPanel();
    updateCursor();
    requestRender();
  });

  // Zoom bindings
  btnZoomOut.onclick = () => {
    viewport.zoomAt(canvas.width / 2, canvas.height / 2, 0.8);
    requestRender();
  };

  btnZoomIn.onclick = () => {
    viewport.zoomAt(canvas.width / 2, canvas.height / 2, 1.25);
    requestRender();
  };

  btnZoomReset.onclick = () => {
    viewport.reset();
    requestRender();
  };

  // Clear Canvas Confirm Modal triggers
  btnClearCanvas.onclick = () => {
    if (clearModal) clearModal.showModal();
  };

  if (btnConfirmClear) {
    btnConfirmClear.onclick = () => {
      history.push(board.elements);
      board.elements = [];
      selectedElements = [];
      updatePropertiesPanel();
      requestRender();
      triggerAutosave();
      if (clearModal) clearModal.close();
    };
  }

  if (btnCancelClear) {
    btnCancelClear.onclick = () => {
      if (clearModal) clearModal.close();
    };
  }

  if (btnCloseClearModal) {
    btnCloseClearModal.onclick = (e) => {
      e.preventDefault();
      if (clearModal) clearModal.close();
    };
  }

  // Undo/Redo actions
  btnUndo.onclick = () => {
    const prev = history.undo(board.elements);
    if (prev !== null) {
      board.elements = prev;
      selectedElements = [];
      updatePropertiesPanel();
      requestRender();
      triggerAutosave();
    }
  };

  btnRedo.onclick = () => {
    const next = history.redo(board.elements);
    if (next !== null) {
      board.elements = next;
      selectedElements = [];
      updatePropertiesPanel();
      requestRender();
      triggerAutosave();
    }
  };

  // Mouse Interaction handlers
  canvas.addEventListener('mousedown', (e) => {
    // If text editor is open, blur it to save typed text first before starting new canvas action
    if (textEditorOverlay.style.display === 'block') {
      textEditorOverlay.blur();
    }

    if (e.button === 1 || e.button === 2 || currentTool === 'pan' || e.shiftKey) {
      isPanning = true;
      dragStartX = e.clientX;
      dragStartY = e.clientY;
      updateCursor();
      return;
    }

    const mouseWorld = viewport.toWorld(e.offsetX, e.offsetY);
    startX = mouseWorld.x;
    startY = mouseWorld.y;

    if (currentTool === 'select') {
      const clicked = getElementAtPosition(startX, startY);
      if (clicked) {
        if (e.ctrlKey || e.shiftKey) {
          // Toggle selection
          const idx = selectedElements.indexOf(clicked);
          if (idx > -1) selectedElements.splice(idx, 1);
          else selectedElements.push(clicked);
        } else {
          // Select single if not already selected
          if (!selectedElements.includes(clicked)) {
            selectedElements = [clicked];
          }
        }
        isDragging = true;
        dragStartX = mouseWorld.x;
        dragStartY = mouseWorld.y;
      } else {
        selectedElements = [];
      }
      updatePropertiesPanel();
    } else {
      isDrawing = true;
      history.push(board.elements);

      const zIndex = board.elements.length > 0 ? Math.max(...board.elements.map(el => el.zIndex || 0)) + 1 : 1;

      if (currentTool === 'freedraw') {
        currentElement = {
          id: crypto.randomUUID(),
          type: 'freedraw',
          x: startX,
          y: startY,
          width: 0,
          height: 0,
          strokeColor: defaultStrokeColor,
          strokeWidth: defaultStrokeWidth,
          roughness: defaultRoughness,
          opacity: defaultOpacity,
          tool: 'freedraw',
          points: [[0, 0]],
          zIndex
        };
      } else if (currentTool === 'text') {
        e.preventDefault();
        e.stopPropagation();
        showInlineTextEditor(e.offsetX, e.offsetY, null);
        isDrawing = false;
      } else {
        currentElement = {
          id: crypto.randomUUID(),
          type: currentTool,
          x: startX,
          y: startY,
          width: 0,
          height: 0,
          angle: 0,
          strokeColor: defaultStrokeColor,
          backgroundColor: defaultFillColor,
          fillStyle: defaultFillStyle,
          strokeWidth: defaultStrokeWidth,
          roughness: defaultRoughness,
          opacity: defaultOpacity,
          seed: Math.floor(Math.random() * 2147483647),
          zIndex
        };
      }
    }
    requestRender();
  });

  canvas.addEventListener('mousemove', (e) => {
    if (isPanning) {
      const dx = e.clientX - dragStartX;
      const dy = e.clientY - dragStartY;
      viewport.pan(dx, dy);
      dragStartX = e.clientX;
      dragStartY = e.clientY;
      requestRender();
      return;
    }

    const mouseWorld = viewport.toWorld(e.offsetX, e.offsetY);

    if (isDragging && selectedElements.length > 0) {
      const dx = mouseWorld.x - dragStartX;
      const dy = mouseWorld.y - dragStartY;
      
      selectedElements.forEach(el => {
        el.x += dx;
        el.y += dy;
      });

      dragStartX = mouseWorld.x;
      dragStartY = mouseWorld.y;
      requestRender();
    } else if (isDrawing && currentElement) {
      if (currentTool === 'freedraw') {
        // Append relative coordinates
        const relX = mouseWorld.x - currentElement.x;
        const relY = mouseWorld.y - currentElement.y;
        currentElement.points.push([relX, relY]);
      } else if (currentTool === 'line' || currentTool === 'arrow') {
        const dx = mouseWorld.x - startX;
        const dy = mouseWorld.y - startY;
        currentElement.width = Math.hypot(dx, dy);
        currentElement.height = 0;
        currentElement.angle = Math.atan2(dy, dx);
        currentElement.x = (startX + mouseWorld.x) / 2;
        currentElement.y = (startY + mouseWorld.y) / 2;

        // Show snap helper visual when arrow is near other shapes
        if (currentTool === 'arrow') {
          hoveredSnapElement = getElementAtPosition(mouseWorld.x, mouseWorld.y);
        }
      } else {
        // Standard shapes
        currentElement.width = Math.abs(mouseWorld.x - startX);
        currentElement.height = Math.abs(mouseWorld.y - startY);
        currentElement.x = (startX + mouseWorld.x) / 2;
        currentElement.y = (startY + mouseWorld.y) / 2;
      }
      requestRender();
    }
  });

  canvas.addEventListener('mouseup', () => {
    isPanning = false;
    isDragging = false;
    hoveredSnapElement = null;
    updateCursor();

    if (isDrawing && currentElement) {
      if (currentTool === 'sticky') {
        currentElement.text = '📌 Ide Baru';
        currentElement.fontFamily = 'hand';
        currentElement.textAlign = 'center';
        currentElement.verticalAlign = 'middle';
        currentElement.backgroundColor = '#fb923c'; // beautiful orange background by default
      }

      board.elements.push(currentElement);
      currentElement = null;
      isDrawing = false;
      triggerAutosave();
    }
    requestRender();
  });

  // Inline text editor overlay
  function showInlineTextEditor(screenX, screenY, existingTextElement) {
    textEditorOverlay.style.display = 'block';
    textEditorOverlay.style.left = `${screenX}px`;
    textEditorOverlay.style.top = `${screenY}px`;
    textEditorOverlay.textContent = existingTextElement ? existingTextElement.text : '';

    // Style overlay transparently to blend with canvas
    textEditorOverlay.style.background = 'transparent';
    textEditorOverlay.style.border = '1px dashed var(--pico-primary)';
    
    // Set dynamic color and font size based on current zoom and stroke settings
    const strokeColor = existingTextElement ? existingTextElement.strokeColor : defaultStrokeColor;
    const fontSize = (existingTextElement ? (existingTextElement.fontSize || 20) : 20) * viewport.zoom;
    
    textEditorOverlay.style.color = strokeColor;
    textEditorOverlay.style.fontSize = `${fontSize}px`;

    if (existingTextElement && existingTextElement.fontFamily) {
      let fontName = 'sans-serif';
      if (existingTextElement.fontFamily === 'hand') fontName = 'Caveat, cursive, sans-serif';
      else if (existingTextElement.fontFamily === 'code') fontName = 'Courier New, monospace';
      textEditorOverlay.style.fontFamily = fontName;
    } else {
      let fontName = 'sans-serif';
      if (defaultFontFamily === 'hand') fontName = 'Caveat, cursive, sans-serif';
      else if (defaultFontFamily === 'code') fontName = 'Courier New, monospace';
      textEditorOverlay.style.fontFamily = fontName;
    }

    textEditorOverlay.onkeydown = (e) => {
      if (e.key === 'Enter' && !e.shiftKey) {
        e.preventDefault();
        textEditorOverlay.blur();
      }
    };

    setTimeout(() => {
      textEditorOverlay.focus();
      try {
        // Place cursor at end
        const range = document.createRange();
        const sel = window.getSelection();
        range.selectNodeContents(textEditorOverlay);
        range.collapse(false);
        sel.removeAllRanges();
        sel.addRange(range);
      } catch (err) {}
    }, 50);

    function finishEditing() {
      textEditorOverlay.style.display = 'none';
      const text = textEditorOverlay.innerText.trim();
      
      if (text) {
        history.push(board.elements);
        const worldCoords = viewport.toWorld(screenX, screenY);
        const zIndex = board.elements.length > 0 ? Math.max(...board.elements.map(el => el.zIndex || 0)) + 1 : 1;

        if (existingTextElement) {
          existingTextElement.text = text;
        } else {
          board.elements.push({
            id: crypto.randomUUID(),
            type: 'text',
            x: worldCoords.x,
            y: worldCoords.y,
            width: 150,
            height: 40,
            text,
            strokeColor: defaultStrokeColor,
            fontFamily: defaultFontFamily,
            fontSize: 20,
            opacity: defaultOpacity,
            zIndex
          });
        }
        triggerAutosave();
        requestRender();
      }
      textEditorOverlay.removeEventListener('blur', finishEditing);
    }

    textEditorOverlay.addEventListener('blur', finishEditing);
  }

  // Double click to edit texts/stickies
  canvas.addEventListener('dblclick', (e) => {
    const mouseWorld = viewport.toWorld(e.offsetX, e.offsetY);
    const clicked = getElementAtPosition(mouseWorld.x, mouseWorld.y);

    if (clicked && (clicked.type === 'text' || clicked.type === 'sticky')) {
      showInlineTextEditor(e.offsetX, e.offsetY, clicked);
    } else {
      // Create new text on double click
      showInlineTextEditor(e.offsetX, e.offsetY, null);
    }
  });

  // Keyboard shortcut actions
  window.addEventListener('keydown', (e) => {
    if (document.activeElement.tagName === 'INPUT' || document.activeElement.contentEditable === 'true') {
      return;
    }

    if (e.key === 'Delete' || e.key === 'Backspace') {
      if (selectedElements.length > 0) {
        history.push(board.elements);
        board.elements = board.elements.filter(el => !selectedElements.includes(el));
        selectedElements = [];
        updatePropertiesPanel();
        requestRender();
        triggerAutosave();
      }
    } else if (e.ctrlKey && e.key === 'z') {
      e.preventDefault();
      btnUndo.click();
    } else if (e.ctrlKey && e.key === 'y') {
      e.preventDefault();
      btnRedo.click();
    } else if (e.key === 'Escape') {
      // Switch back to select tool
      const selectBtn = toolbar.querySelector('[data-tool="select"]');
      if (selectBtn) selectBtn.click();
    } else if (e.key.toLowerCase() === 'h') {
      const panBtn = toolbar.querySelector('[data-tool="pan"]');
      if (panBtn) panBtn.click();
    } else if (e.key.toLowerCase() === 'v') {
      const selectBtn = toolbar.querySelector('[data-tool="select"]');
      if (selectBtn) selectBtn.click();
    }
  });

  // Properties binding updates elements properties
  strokeColorPicker.addEventListener('click', (e) => {
    const swatch = e.target.closest('.color-swatch');
    if (!swatch) return;

    defaultStrokeColor = swatch.dataset.color;
    if (selectedElements.length > 0) {
      history.push(board.elements);
      selectedElements.forEach(el => el.strokeColor = defaultStrokeColor);
      requestRender();
      triggerAutosave();
    }
    updatePropertiesPanel();
  });

  fillColorPicker.addEventListener('click', (e) => {
    const swatch = e.target.closest('.color-swatch');
    if (!swatch) return;

    defaultFillColor = swatch.dataset.color;
    if (selectedElements.length > 0) {
      history.push(board.elements);
      selectedElements.forEach(el => el.backgroundColor = defaultFillColor);
      requestRender();
      triggerAutosave();
    }
    updatePropertiesPanel();
  });

  document.getElementById('fill-style-group-btns').addEventListener('click', (e) => {
    const btn = e.target.closest('.prop-btn');
    if (!btn) return;
    Array.from(btn.parentElement.children).forEach(b => b.classList.remove('active'));
    btn.classList.add('active');
    defaultFillStyle = btn.dataset.value;
    if (selectedElements.length > 0) {
      history.push(board.elements);
      selectedElements.forEach(el => el.fillStyle = defaultFillStyle);
      requestRender();
      triggerAutosave();
    }
  });

  function changeZOrder(action) {
    if (selectedElements.length === 0) return;

    history.push(board.elements);

    let newElements = [...board.elements];
    const isSelected = (el) => selectedElements.some(sel => sel.id === el.id);

    if (action === 'to-front') {
      const selected = newElements.filter(isSelected);
      const unselected = newElements.filter(el => !isSelected(el));
      newElements = [...unselected, ...selected];
    } else if (action === 'to-back') {
      const selected = newElements.filter(isSelected);
      const unselected = newElements.filter(el => !isSelected(el));
      newElements = [...selected, ...unselected];
    } else if (action === 'forward') {
      for (let i = newElements.length - 2; i >= 0; i--) {
        if (isSelected(newElements[i]) && !isSelected(newElements[i + 1])) {
          const temp = newElements[i];
          newElements[i] = newElements[i + 1];
          newElements[i + 1] = temp;
        }
      }
    } else if (action === 'backward') {
      for (let i = 1; i < newElements.length; i++) {
        if (isSelected(newElements[i]) && !isSelected(newElements[i - 1])) {
          const temp = newElements[i];
          newElements[i] = newElements[i - 1];
          newElements[i - 1] = temp;
        }
      }
    }

    newElements.forEach((el, index) => {
      el.zIndex = index + 1;
    });

    board.elements = newElements;
    requestRender();
    triggerAutosave();
  }

  const layersGroupBtns = document.getElementById('layers-group-btns');
  if (layersGroupBtns) {
    layersGroupBtns.addEventListener('click', (e) => {
      const btn = e.target.closest('.prop-btn');
      if (!btn) return;
      const action = btn.dataset.action;
      if (action) {
        changeZOrder(action);
      }
    });
  }

  if (opacitySlider) {
    opacitySlider.addEventListener('input', (e) => {
      const val = parseInt(e.target.value) / 100;
      defaultOpacity = val;
      if (selectedElements.length > 0) {
        history.push(board.elements);
        selectedElements.forEach(el => el.opacity = defaultOpacity);
        requestRender();
        triggerAutosave();
      }
    });
  }

  document.getElementById('roughness-group-btns').addEventListener('click', (e) => {
    const btn = e.target.closest('.prop-btn');
    if (!btn) return;
    Array.from(btn.parentElement.children).forEach(b => b.classList.remove('active'));
    btn.classList.add('active');
    defaultRoughness = parseInt(btn.dataset.value);
    if (selectedElements.length > 0) {
      history.push(board.elements);
      selectedElements.forEach(el => el.roughness = defaultRoughness);
      requestRender();
      triggerAutosave();
    }
  });

  document.getElementById('stroke-width-group-btns').addEventListener('click', (e) => {
    const btn = e.target.closest('.prop-btn');
    if (!btn) return;
    Array.from(btn.parentElement.children).forEach(b => b.classList.remove('active'));
    btn.classList.add('active');
    defaultStrokeWidth = parseInt(btn.dataset.value);
    if (selectedElements.length > 0) {
      history.push(board.elements);
      selectedElements.forEach(el => el.strokeWidth = defaultStrokeWidth);
      requestRender();
      triggerAutosave();
    }
  });

  document.getElementById('font-family-group-btns').addEventListener('click', (e) => {
    const btn = e.target.closest('.prop-btn');
    if (!btn) return;
    Array.from(btn.parentElement.children).forEach(b => b.classList.remove('active'));
    btn.classList.add('active');
    defaultFontFamily = btn.dataset.value;
    if (selectedElements.length > 0) {
      history.push(board.elements);
      selectedElements.forEach(el => el.fontFamily = defaultFontFamily);
      requestRender();
      triggerAutosave();
    }
  });

  canvasGridSelect.onchange = () => {
    board.appState.gridStyle = canvasGridSelect.value;
    board.appState.gridMode = board.appState.gridStyle !== 'blank';
    requestRender();
    triggerAutosave();
  };

  boardTitleInput.oninput = () => {
    triggerAutosave();
  };

  // Export options binding
  exportPngBtn.onclick = (e) => {
    e.preventDefault();
    exportBoardAsPng(board);
  };

  exportSvgBtn.onclick = (e) => {
    e.preventDefault();
    exportBoardAsSvg(board);
  };

  exportPapanBtn.onclick = (e) => {
    e.preventDefault();
    exportBoardAsJson(board);
  };

  exportExcalBtn.onclick = (e) => {
    e.preventDefault();
    exportBoardAsExcalidraw(board);
  };

  // Pinch zoom and Pan via wheel/trackpad
  canvas.addEventListener('wheel', (e) => {
    e.preventDefault();
    if (e.ctrlKey) {
      // trackpad pinch gesture or Ctrl+scroll
      const zoomFactor = 1 - e.deltaY * 0.01;
      viewport.zoomAt(e.offsetX, e.offsetY, zoomFactor);
    } else {
      // mouse wheel scroll pans around
      viewport.pan(-e.deltaX, -e.deltaY);
    }
    requestRender();
  }, { passive: false });

  // Resize listener
  window.addEventListener('resize', resizeCanvas);

  await init();
  resizeCanvas();
});
