// app/dev/diagram/js/rendering/svg-renderer.js
import { SHAPES } from './shapes.js';

export class SVGRenderer {
  constructor(svgEl, onGraphChange) {
    this.svg = svgEl;
    this.onGraphChange = onGraphChange;
    this.viewport = { panX: 0, panY: 0, zoom: 1 };
    
    // Create main content group
    this.g = this.svg.querySelector('.diagram-root');
    if (!this.g) {
      this.g = document.createElementNS('http://www.w3.org/2000/svg', 'g');
      this.g.setAttribute('class', 'diagram-root');
      this.svg.appendChild(this.g);
    }
    
    this.edgeGroup = this.g.querySelector('.edges-group') || this.createGroup('edges-group');
    this.nodeGroup = this.g.querySelector('.nodes-group') || this.createGroup('nodes-group');
    this.tempGroup = this.g.querySelector('.temp-group') || this.createGroup('temp-group');

    this.selectedNodeIds = new Set();
    this.selectedEdgeIds = new Set();

    this.setupZoomPan();
    this.setupPortDrawing();
  }

  createGroup(className) {
    const group = document.createElementNS('http://www.w3.org/2000/svg', 'g');
    group.setAttribute('class', className);
    this.g.appendChild(group);
    return group;
  }

  // Setup pan dan zoom manual (bebas dependensi D3)
  setupZoomPan() {
    let isPanning = false;
    let startX, startY;

    this.svg.addEventListener('mousedown', (e) => {
      const isNodeOrPortOrEdge = e.target.closest('.diagram-node') || e.target.closest('.diagram-edge') || e.target.closest('.port-indicator');

      // Pan jika klik tengah, Shift + klik kiri, atau klik kiri langsung di background kosong
      if (e.button === 1 || (e.button === 0 && (e.shiftKey || !isNodeOrPortOrEdge))) {
        isPanning = true;
        startX = e.clientX - this.viewport.panX;
        startY = e.clientY - this.viewport.panY;
        this.svg.style.cursor = 'grabbing';
        e.preventDefault();
      }
      
      if (e.button === 0 && !isNodeOrPortOrEdge) {
        // Klik di background -> clear selection
        this.clearSelection();
      }
    });

    window.addEventListener('mousemove', (e) => {
      if (!isPanning) return;
      this.viewport.panX = e.clientX - startX;
      this.viewport.panY = e.clientY - startY;
      this.applyTransform();
    });

    window.addEventListener('mouseup', () => {
      if (isPanning) {
        isPanning = false;
        this.svg.style.cursor = 'default';
      }
    });

    this.svg.addEventListener('wheel', (e) => {
      e.preventDefault();
      const zoomFactor = 1.1;
      const oldZoom = this.viewport.zoom;
      
      if (e.deltaY < 0) {
        this.viewport.zoom = Math.min(this.viewport.zoom * zoomFactor, 10);
      } else {
        this.viewport.zoom = Math.max(this.viewport.zoom / zoomFactor, 0.1);
      }

      // Zoom ke arah cursor mouse
      const rect = this.svg.getBoundingClientRect();
      const mouseX = e.clientX - rect.left;
      const mouseY = e.clientY - rect.top;

      this.viewport.panX = mouseX - (mouseX - this.viewport.panX) * (this.viewport.zoom / oldZoom);
      this.viewport.panY = mouseY - (mouseY - this.viewport.panY) * (this.viewport.zoom / oldZoom);

      this.applyTransform();
    });
  }

  applyTransform() {
    this.g.setAttribute('transform', `translate(${this.viewport.panX}, ${this.viewport.panY}) scale(${this.viewport.zoom})`);
    
    // Update background grid shift
    const gridPattern = document.getElementById('grid-pattern');
    if (gridPattern) {
      gridPattern.setAttribute('patternTransform', `translate(${this.viewport.panX}, ${this.viewport.panY}) scale(${this.viewport.zoom})`);
    }
  }

  zoomIn() {
    this.viewport.zoom = Math.min(this.viewport.zoom * 1.2, 10);
    this.applyTransform();
    if (this.onGraphChange) this.onGraphChange('update', this.graph);
  }

  zoomOut() {
    this.viewport.zoom = Math.max(this.viewport.zoom / 1.2, 0.1);
    this.applyTransform();
    if (this.onGraphChange) this.onGraphChange('update', this.graph);
  }

  zoomReset() {
    this.viewport.zoom = 1;
    this.viewport.panX = 0;
    this.viewport.panY = 0;
    this.applyTransform();
    if (this.onGraphChange) this.onGraphChange('update', this.graph);
  }

  clearSelection() {
    this.selectedNodeIds.clear();
    this.selectedEdgeIds.clear();
    this.updateSelectionVisuals();
    if (this.onGraphChange) this.onGraphChange('select', null);
  }

  updateSelectionVisuals() {
    this.nodeGroup.querySelectorAll('.diagram-node').forEach(el => {
      const id = el.getAttribute('data-id');
      if (this.selectedNodeIds.has(id)) {
        el.classList.add('selected');
      } else {
        el.classList.remove('selected');
      }
    });

    this.edgeGroup.querySelectorAll('.diagram-edge').forEach(el => {
      const id = el.getAttribute('data-id');
      if (this.selectedEdgeIds.has(id)) {
        el.classList.add('selected');
      } else {
        el.classList.remove('selected');
      }
    });
  }

  // Render nodes and edges
  render(graph) {
    this.graph = graph;
    this.renderEdges();
    this.renderNodes();
    this.applyTransform();
  }

  renderNodes() {
    this.nodeGroup.innerHTML = '';
    this.graph.nodes.forEach(node => {
      const g = document.createElementNS('http://www.w3.org/2000/svg', 'g');
      g.setAttribute('class', `diagram-node ${this.selectedNodeIds.has(node.id) ? 'selected' : ''}`);
      g.setAttribute('data-id', node.id);
      g.setAttribute('transform', `translate(${node.x}, ${node.y})`);

      const shapeDef = SHAPES[node.shape] || SHAPES.rectangle;
      
      // Render shape
      const path = document.createElementNS('http://www.w3.org/2000/svg', 'path');
      path.setAttribute('d', shapeDef.getPath(node.width, node.height));
      path.setAttribute('fill', node.style.fill || '#e0f2fe');
      path.setAttribute('stroke', node.style.stroke || '#0284c7');
      path.setAttribute('stroke-width', node.style.strokeWidth || 2);
      g.appendChild(path);

      // Render custom content for specific nodes
      if (node.shape === 'db_table' && node.db_table) {
        this.renderTableContent(g, node);
      } else {
        this.renderWrappedText(g, node);
      }

      // Add connection ports
      this.addPortsToNode(g, node, shapeDef);

      // Node selection handler
      g.addEventListener('click', (e) => {
        e.stopPropagation();
        if (e.ctrlKey) {
          if (this.selectedNodeIds.has(node.id)) {
            this.selectedNodeIds.delete(node.id);
          } else {
            this.selectedNodeIds.add(node.id);
          }
        } else {
          this.selectedNodeIds.clear();
          this.selectedEdgeIds.clear();
          this.selectedNodeIds.add(node.id);
        }
        this.updateSelectionVisuals();
        if (this.onGraphChange) this.onGraphChange('select', { type: 'node', id: node.id });
      });

      this.nodeGroup.appendChild(g);
    });

    this.attachDragBehavior();
  }

  renderWrappedText(g, node) {
    const text = document.createElementNS('http://www.w3.org/2000/svg', 'text');
    text.setAttribute('x', node.width / 2);
    text.setAttribute('text-anchor', 'middle');
    text.setAttribute('fill', node.style.fontColor || 'var(--pico-color)');
    
    const label = node.label || '';
    let fontSize = node.style.fontSize || 13;
    if (label.length > 20) {
      fontSize = Math.min(fontSize, 11);
    } else if (label.length > 12) {
      fontSize = Math.min(fontSize, 12);
    }
    text.setAttribute('font-size', `${fontSize}px`);

    const words = label.split(' ');
    const lines = [];
    let currentLine = '';

    words.forEach(word => {
      if ((currentLine + ' ' + word).trim().length > 15) {
        if (currentLine) lines.push(currentLine.trim());
        currentLine = word;
      } else {
        currentLine += ' ' + word;
      }
    });
    if (currentLine) lines.push(currentLine.trim());

    if (lines.length === 0 && label) {
      lines.push(label);
    }

    const lineHeight = fontSize + 3;
    const totalHeight = lines.length * lineHeight;
    const startY = (node.height - totalHeight) / 2 + fontSize - 2;

    lines.forEach((line, idx) => {
      const tspan = document.createElementNS('http://www.w3.org/2000/svg', 'tspan');
      tspan.setAttribute('x', node.width / 2);
      tspan.setAttribute('y', startY + idx * lineHeight);
      tspan.textContent = line;
      text.appendChild(tspan);
    });

    g.appendChild(text);
  }

  getBestPorts(sourceNode, targetNode) {
    const sPorts = (SHAPES[sourceNode.shape] || SHAPES.rectangle).ports(sourceNode.width, sourceNode.height);
    const tPorts = (SHAPES[targetNode.shape] || SHAPES.rectangle).ports(targetNode.width, targetNode.height);
    
    let bestSP = null;
    let bestTP = null;
    let minDist = Infinity;
    
    sPorts.forEach(sp => {
      const spX = sourceNode.x + sp.x;
      const spY = sourceNode.y + sp.y;
      
      tPorts.forEach(tp => {
        const tpX = targetNode.x + tp.x;
        const tpY = targetNode.y + tp.y;
        
        let dist = Math.hypot(tpX - spX, tpY - spY);
        
        // Prefer top-to-bottom flow (South -> North)
        if (targetNode.y > sourceNode.y + sourceNode.height) {
          if (sp.dir === 'S' && tp.dir === 'N') dist -= 60;
          if (sp.dir === 'N' || tp.dir === 'S') dist += 40;
        }
        
        // Prefer loop flow for back-edges (target is above source)
        if (targetNode.y + targetNode.height < sourceNode.y) {
          if (sp.dir === 'N' && tp.dir === 'S') dist -= 60;
          if (sp.dir === 'E' && tp.dir === 'E') dist -= 40;
          if (sp.dir === 'W' && tp.dir === 'W') dist -= 40;
        }
        
        if (dist < minDist) {
          minDist = dist;
          bestSP = { x: spX, y: spY, dir: sp.dir };
          bestTP = { x: tpX, y: tpY, dir: tp.dir };
        }
      });
    });
    
    return { source: bestSP, target: bestTP };
  }

  renderTableContent(g, node) {
    // Render Header Table
    const title = document.createElementNS('http://www.w3.org/2000/svg', 'text');
    title.setAttribute('x', 12);
    title.setAttribute('y', 20);
    title.setAttribute('font-weight', 'bold');
    title.setAttribute('fill', node.style.fontColor || 'var(--pico-color)');
    title.setAttribute('font-size', '13px');
    title.textContent = node.db_table.name;
    g.appendChild(title);

    // Separator line
    const line = document.createElementNS('http://www.w3.org/2000/svg', 'line');
    line.setAttribute('x1', 0);
    line.setAttribute('y1', 28);
    line.setAttribute('x2', node.width);
    line.setAttribute('y2', 28);
    line.setAttribute('stroke', node.style.stroke || '#0284c7');
    line.setAttribute('stroke-width', 1.5);
    g.appendChild(line);

    // Columns list
    node.db_table.columns.forEach((col, idx) => {
      const yPos = 45 + idx * 20;

      // pk key symbol or indicator
      const pkIndicator = col.constraints.includes('pk') ? '🔑 ' : '';
      
      const colText = document.createElementNS('http://www.w3.org/2000/svg', 'text');
      colText.setAttribute('x', 12);
      colText.setAttribute('y', yPos);
      colText.setAttribute('font-size', '12px');
      colText.setAttribute('fill', 'var(--pico-color)');
      colText.textContent = `${pkIndicator}${col.name} : ${col.type}`;
      g.appendChild(colText);
    });
  }

  addPortsToNode(g, node, shapeDef) {
    const ports = shapeDef.ports(node.width, node.height);
    ports.forEach((port, idx) => {
      const circle = document.createElementNS('http://www.w3.org/2000/svg', 'circle');
      circle.setAttribute('class', 'port-indicator');
      circle.setAttribute('cx', port.x);
      circle.setAttribute('cy', port.y);
      circle.setAttribute('r', 5);
      circle.setAttribute('data-port-idx', idx);
      circle.setAttribute('data-node-id', node.id);
      g.appendChild(circle);
    });
  }

  renderEdges() {
    this.edgeGroup.innerHTML = '';
    this.graph.edges.forEach(edge => {
      const sourceNode = this.graph.nodes.find(n => n.id === edge.source);
      const targetNode = this.graph.nodes.find(n => n.id === edge.target);
      if (!sourceNode || !targetNode) return;

      const g = document.createElementNS('http://www.w3.org/2000/svg', 'g');
      g.setAttribute('class', `diagram-edge ${this.selectedEdgeIds.has(edge.id) ? 'selected' : ''}`);
      g.setAttribute('data-id', edge.id);

      // Hitung port terbaik untuk koneksi lengkung/bebas tabrakan
      const { source: sp, target: tp } = this.getBestPorts(sourceNode, targetNode);
      if (!sp || !tp) return;

      // Draw cubic bezier curve or straight line if aligned
      const dx = Math.abs(tp.x - sp.x);
      const dy = Math.abs(tp.y - sp.y);
      const dist = Math.hypot(dx, dy);
      
      const path = document.createElementNS('http://www.w3.org/2000/svg', 'path');
      
      let labelX = (sp.x + tp.x) / 2;
      let labelY = (sp.y + tp.y) / 2;

      // Jika port sejajar secara vertikal (selisih X < 5px), gambar garis tegak lurus langsung
      if (dx < 5) {
        path.setAttribute('d', `M ${sp.x} ${sp.y} L ${tp.x} ${tp.y}`);
      } else {
        const offset = Math.min(100, Math.max(30, dist * 0.35));

        let cp1x = sp.x, cp1y = sp.y;
        if (sp.dir === 'N') cp1y -= offset;
        else if (sp.dir === 'S') cp1y += offset;
        else if (sp.dir === 'E') cp1x += offset;
        else if (sp.dir === 'W') cp1x -= offset;

        let cp2x = tp.x, cp2y = tp.y;
        if (tp.dir === 'N') cp2y -= offset;
        else if (tp.dir === 'S') cp2y += offset;
        else if (tp.dir === 'E') cp2x += offset;
        else if (tp.dir === 'W') cp2x -= offset;

        path.setAttribute('d', `M ${sp.x} ${sp.y} C ${cp1x} ${cp1y} ${cp2x} ${cp2y} ${tp.x} ${tp.y}`);

        // Rumus posisi titik tengah kubik bezier
        labelX = 0.125 * sp.x + 0.375 * cp1x + 0.375 * cp2x + 0.125 * tp.x;
        labelY = 0.125 * sp.y + 0.375 * cp1y + 0.375 * cp2y + 0.125 * tp.y;
      }
      path.setAttribute('fill', 'none'); // Wajib agar tidak terisi warna hitam di viewer eksternal
      path.setAttribute('stroke', edge.style.stroke || '#64748b');
      path.setAttribute('stroke-width', edge.style.strokeWidth || 1.5);
      if (edge.style.edgeStyle === 'dashed') {
        path.setAttribute('stroke-dasharray', '5 5');
      } else if (edge.style.edgeStyle === 'dotted') {
        path.setAttribute('stroke-dasharray', '2 3');
      }
      
      // End arrow indicator
      if (edge.style.endArrow && edge.style.endArrow !== 'none') {
        path.setAttribute('marker-end', `url(#arrow-${edge.style.endArrow})`);
      }
      
      g.appendChild(path);

      // Label edge di titik tengah
      if (edge.label) {
        const text = document.createElementNS('http://www.w3.org/2000/svg', 'text');
        text.setAttribute('x', labelX);
        text.setAttribute('y', labelY - 8);
        text.setAttribute('text-anchor', 'middle');
        text.setAttribute('font-size', '12px');
        text.setAttribute('fill', 'var(--pico-color)');
        text.textContent = edge.label;
        g.appendChild(text);
      }

      g.addEventListener('click', (e) => {
        e.stopPropagation();
        this.selectedNodeIds.clear();
        this.selectedEdgeIds.clear();
        this.selectedEdgeIds.add(edge.id);
        this.updateSelectionVisuals();
        if (this.onGraphChange) this.onGraphChange('select', { type: 'edge', id: edge.id });
      });

      this.edgeGroup.appendChild(g);
    });
  }

  // Setup interact.js for dragging nodes
  attachDragBehavior() {
    // interact.js dynamic setup
    if (!window.interact) return;

    window.interact('.diagram-node').draggable({
      ignoreFrom: '.port-indicator',
      listeners: {
        move: (event) => {
          const id = event.target.getAttribute('data-id');
          const node = this.graph.nodes.find(n => n.id === id);
          if (!node) return;

          // Shift coordinates accounting for zoom level
          node.x += event.dx / this.viewport.zoom;
          node.y += event.dy / this.viewport.zoom;

          // Apply instant CSS translate to drag smoothly
          event.target.setAttribute('transform', `translate(${node.x}, ${node.y})`);

          // Update linked edges in real-time
          this.renderEdges();
        },
        end: (event) => {
          if (this.onGraphChange) this.onGraphChange('update', this.graph);
        }
      }
    });
  }

  // Dragging from a port creates a new edge connection
  setupPortDrawing() {
    let activePort = null;
    let activeNodeId = null;
    let tempLine = null;

    this.svg.addEventListener('mousedown', (e) => {
      const port = e.target.closest('.port-indicator');
      if (!port) return;

      e.stopPropagation();
      e.preventDefault();
      
      const nodeEl = port.parentNode;
      activeNodeId = nodeEl.getAttribute('data-id');
      const node = this.graph.nodes.find(n => n.id === activeNodeId);
      const portIdx = parseInt(port.getAttribute('data-port-idx'));
      const shapeDef = SHAPES[node.shape] || SHAPES.rectangle;
      const ports = shapeDef.ports(node.width, node.height);
      activePort = ports[portIdx];

      tempLine = document.createElementNS('http://www.w3.org/2000/svg', 'line');
      tempLine.setAttribute('x1', node.x + activePort.x);
      tempLine.setAttribute('y1', node.y + activePort.y);
      tempLine.setAttribute('x2', node.x + activePort.x);
      tempLine.setAttribute('y2', node.y + activePort.y);
      tempLine.setAttribute('stroke', 'var(--pico-primary)');
      tempLine.setAttribute('stroke-width', 2);
      tempLine.setAttribute('stroke-dasharray', '4 4');
      this.tempGroup.appendChild(tempLine);
    });

    window.addEventListener('mousemove', (e) => {
      if (!tempLine) return;

      const rect = this.svg.getBoundingClientRect();
      // Hitung koordinat real world berdasarkan zoom dan pan
      const mouseX = (e.clientX - rect.left - this.viewport.panX) / this.viewport.zoom;
      const mouseY = (e.clientY - rect.top - this.viewport.panY) / this.viewport.zoom;

      tempLine.setAttribute('x2', mouseX);
      tempLine.setAttribute('y2', mouseY);
    });

    window.addEventListener('mouseup', (e) => {
      if (!tempLine) return;

      // Cari port target atau body node target
      const targetPortEl = e.target.closest('.port-indicator');
      const targetNodeEl = e.target.closest('.diagram-node');
      
      let targetNodeId = null;
      if (targetPortEl) {
        targetNodeId = targetPortEl.getAttribute('data-node-id');
      } else if (targetNodeEl) {
        targetNodeId = targetNodeEl.getAttribute('data-id');
      }

      if (targetNodeId && targetNodeId !== activeNodeId) {
        // Buat Edge baru
        const newEdge = {
          id: self.crypto.randomUUID ? self.crypto.randomUUID() : Math.random().toString(36).substr(2, 9),
          source: activeNodeId,
          target: targetNodeId,
          label: '',
          style: {
            stroke: '#64748b',
            strokeWidth: 1.5,
            edgeStyle: 'solid',
            startArrow: 'none',
            endArrow: 'filled'
          }
        };

        this.graph.edges.push(newEdge);
        this.render(this.graph); // Render koneksi baru secara real-time
        if (this.onGraphChange) this.onGraphChange('update', this.graph);
      }

      this.tempGroup.innerHTML = '';
      tempLine = null;
      activePort = null;
      activeNodeId = null;
    });
  }
}
