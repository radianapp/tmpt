// app/dev/diagram/js/diagram-app.js
import { openTmptDB, dbGet, dbPut } from '/shared/db.js';
const generateId = () => self.crypto.randomUUID();
const toast = (msg, type) => window.TMPT_UI.toast(msg, type);
const confirm = (msg, opts) => window.TMPT_UI.confirm(msg, opts);
import { broadcastTMPT as broadcastEvent, TMPT_EVENTS } from '/shared/broadcast.js';
import { SVGRenderer } from './rendering/svg-renderer.js';
import { parseDBML } from './modules/data/dbml-parser.js';
import { generateSQL } from './modules/data/sql-generator.js';

const DB_NAME = 'tmpt_diagram';
const DB_VERSION = 2;
const STORE_NAME = 'documents';

let db;
let currentDoc = null;
let renderer = null;
let monacoEditor = null;
let activeModule = 'draw'; // draw, code, data, arch
let isChangingFromCode = false;

// ── Inisialisasi Aplikasi ─────────────────────────────────────────────────────
async function init() {
  try {
    db = await openTmptDB(DB_NAME, DB_VERSION, (dbInstance) => {
      if (!dbInstance.objectStoreNames.contains(STORE_NAME)) {
        const store = dbInstance.createObjectStore(STORE_NAME, { keyPath: 'id' });
        store.createIndex('by_updated', 'updated_at', { unique: false });
        store.createIndex('by_title', 'title', { unique: false });
      }
    });

    const params = new URLSearchParams(window.location.search);
    const docId = params.get('id');
    const isNew = params.get('new') === '1';
    const initModule = params.get('module') || 'draw';
    const template = params.get('template');

    if (isNew) {
      currentDoc = await createNewDocument(initModule, template);
      // Ganti URL agar memiliki id berkas baru tanpa reload
      window.history.replaceState(null, '', `./editor.html?id=${currentDoc.id}`);
    } else if (docId) {
      currentDoc = await dbGet(db, STORE_NAME, docId);
      if (!currentDoc) {
        toast('Diagram tidak ditemukan.', 'error');
        setTimeout(() => window.location.href = './index.html', 1500);
        return;
      }
    } else {
      // Fallback ke list jika tidak ada id
      window.location.href = './index.html';
      return;
    }

    activeModule = currentDoc.module || initModule;
    document.getElementById('diagram-title-display').textContent = currentDoc.title;

    // Initialize SVG Renderer
    const svgEl = document.getElementById('diagram-canvas');
    renderer = new SVGRenderer(svgEl, handleGraphInteraction);
    renderer.render(currentDoc);

    setupEventListeners();
    switchModule(activeModule);
    updateStatusBar();
    initMonacoEditor();
  } catch (err) {
    console.error(err);
    toast('Gagal menginisialisasi editor.', 'error');
  }
}

// ── Monaco Editor Loader ──────────────────────────────────────────────────────
function updateMonacoTheme() {
  if (typeof monaco !== 'undefined' && monacoEditor) {
    const isDark = document.documentElement.getAttribute('data-theme') === 'dark';
    monaco.editor.setTheme(isDark ? 'vs-dark' : 'vs');
  }
}

function initMonacoEditor() {
  if (typeof require === 'undefined') return;

  require.config({ paths: { vs: '/app/dev/code/vendor/monaco/vs' } });
  
  require(['vs/editor/editor.main'], () => {
    const host = document.getElementById('monaco-editor-host');
    if (!host) return;

    const currentTheme = document.documentElement.getAttribute('data-theme') === 'dark' ? 'vs-dark' : 'vs';

    monacoEditor = monaco.editor.create(host, {
      value: '',
      language: 'markdown',
      theme: currentTheme,
      fontSize: 14,
      minimap: { enabled: false },
      automaticLayout: true,
      scrollbar: {
        verticalScrollbarSize: 8,
        horizontalScrollbarSize: 8
      }
    });

    // Observer untuk sinkronisasi tema dengan Monaco secara realtime
    const themeObserver = new MutationObserver(() => {
      updateMonacoTheme();
    });
    themeObserver.observe(document.documentElement, { attributes: true, attributeFilter: ['data-theme'] });

    // Populate editor based on active module
    updateEditorContent();

    // Editor change listener
    monacoEditor.onDidChangeModelContent(() => {
      if (isChangingFromCode) return;
      
      const val = monacoEditor.getValue();
      if (activeModule === 'code') {
        syncFromMermaid(val);
      } else if (activeModule === 'data') {
        syncFromDBML(val);
      }
    });
  });
}

function updateEditorContent() {
  if (!monacoEditor) return;
  isChangingFromCode = true;

  if (activeModule === 'code') {
    monaco.editor.setModelLanguage(monacoEditor.getModel(), 'markdown');
    monacoEditor.setValue(currentDoc.mermaid_code || serializeToMermaid(currentDoc));
  } else if (activeModule === 'data') {
    monaco.editor.setModelLanguage(monacoEditor.getModel(), 'apex'); // DBML is similar to apex/java syntax highlight
    monacoEditor.setValue(currentDoc.dbml_code || serializeToDBML(currentDoc));
  }

  isChangingFromCode = false;
}

// ── CRUD & Templates ─────────────────────────────────────────────────────────
async function createNewDocument(moduleName, templateName) {
  const newId = generateId();
  const doc = {
    id: newId,
    title: 'Diagram Tanpa Judul',
    module: moduleName,
    nodes: [],
    edges: [],
    viewport: { scrollX: 0, scrollY: 0, zoom: 1 },
    mermaid_code: '',
    dbml_code: '',
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString()
  };

  // Load Templates
  if (templateName === 'aws-3tier') {
    doc.title = 'AWS 3-Tier Architecture';
    doc.nodes = [
      { id: 'n1', label: 'CloudFront', shape: 'cloud', x: 50, y: 150, width: 120, height: 60, style: { fill: '#e0f2fe', stroke: '#0284c7', fontSize: 13 } },
      { id: 'n2', label: 'Load Balancer', shape: 'rounded', x: 230, y: 150, width: 120, height: 60, style: { fill: '#f0fdf4', stroke: '#16a34a', fontSize: 13 } },
      { id: 'n3', label: 'Web Server', shape: 'rectangle', x: 410, y: 100, width: 120, height: 60, style: { fill: '#faf5ff', stroke: '#7c3aed', fontSize: 13 } },
      { id: 'n4', label: 'App Server', shape: 'rectangle', x: 410, y: 200, width: 120, height: 60, style: { fill: '#faf5ff', stroke: '#7c3aed', fontSize: 13 } },
      { id: 'n5', label: 'RDS Database', shape: 'cylinder', x: 590, y: 150, width: 120, height: 60, style: { fill: '#fffbeb', stroke: '#d97706', fontSize: 13 } }
    ];
    doc.edges = [
      { id: 'e1', source: 'n1', target: 'n2', label: '', style: { stroke: '#64748b', strokeWidth: 1.5, edgeStyle: 'solid', endArrow: 'filled' } },
      { id: 'e2', source: 'n2', target: 'n3', label: '', style: { stroke: '#64748b', strokeWidth: 1.5, edgeStyle: 'solid', endArrow: 'filled' } },
      { id: 'e3', source: 'n2', target: 'n4', label: '', style: { stroke: '#64748b', strokeWidth: 1.5, edgeStyle: 'solid', endArrow: 'filled' } },
      { id: 'e4', source: 'n3', target: 'n5', label: '', style: { stroke: '#64748b', strokeWidth: 1.5, edgeStyle: 'solid', endArrow: 'filled' } },
      { id: 'e5', source: 'n4', target: 'n5', label: '', style: { stroke: '#64748b', strokeWidth: 1.5, edgeStyle: 'solid', endArrow: 'filled' } }
    ];
  } else if (templateName === 'ecommerce') {
    doc.title = 'Skema Basis Data E-Commerce';
    doc.nodes = [
      {
        id: 't_users',
        label: 'users',
        shape: 'db_table',
        x: 50, y: 80, width: 160, height: 120,
        style: { fill: '#fffdf5', stroke: '#d97706', fontSize: 12 },
        db_table: {
          name: 'users',
          columns: [
            { name: 'id', type: 'integer', constraints: ['pk'] },
            { name: 'username', type: 'varchar', constraints: [] },
            { name: 'email', type: 'varchar', constraints: ['unique'] }
          ]
        }
      },
      {
        id: 't_orders',
        label: 'orders',
        shape: 'db_table',
        x: 300, y: 80, width: 160, height: 120,
        style: { fill: '#fffdf5', stroke: '#d97706', fontSize: 12 },
        db_table: {
          name: 'orders',
          columns: [
            { name: 'id', type: 'integer', constraints: ['pk'] },
            { name: 'user_id', type: 'integer', constraints: [] },
            { name: 'total_price', type: 'decimal', constraints: [] }
          ]
        }
      }
    ];
    doc.edges = [
      {
        id: 'ref1',
        source: 't_orders',
        target: 't_users',
        label: 'FK',
        style: { stroke: '#b45309', strokeWidth: 1.5, edgeStyle: 'solid', endArrow: 'filled' }
      }
    ];
  } else if (templateName === 'login-flow') {
    doc.title = 'Alur Masuk Pengguna';
    doc.nodes = [
      { id: 'start', label: 'Mulai', shape: 'rounded', x: 50, y: 150, width: 100, height: 50, style: { fill: '#e0f2fe', stroke: '#0284c7', fontSize: 13 } },
      { id: 'input', label: 'Isi Email & Sandi', shape: 'rectangle', x: 200, y: 150, width: 140, height: 50, style: { fill: '#f1f5f9', stroke: '#475569', fontSize: 13 } },
      { id: 'check', label: 'Apakah Benar?', shape: 'diamond', x: 390, y: 135, width: 120, height: 80, style: { fill: '#fffbeb', stroke: '#d97706', fontSize: 12 } },
      { id: 'success', label: 'Masuk Berhasil', shape: 'rounded', x: 560, y: 150, width: 120, height: 50, style: { fill: '#f0fdf4', stroke: '#16a34a', fontSize: 13 } },
      { id: 'fail', label: 'Tampilkan Error', shape: 'rectangle', x: 380, y: 280, width: 140, height: 50, style: { fill: '#fef2f2', stroke: '#dc2626', fontSize: 13 } }
    ];
    doc.edges = [
      { id: 'e1', source: 'start', target: 'input', label: '', style: { stroke: '#64748b', strokeWidth: 1.5, edgeStyle: 'solid', endArrow: 'filled' } },
      { id: 'e2', source: 'input', target: 'check', label: '', style: { stroke: '#64748b', strokeWidth: 1.5, edgeStyle: 'solid', endArrow: 'filled' } },
      { id: 'e3', source: 'check', target: 'success', label: 'Ya', style: { stroke: '#16a34a', strokeWidth: 1.5, edgeStyle: 'solid', endArrow: 'filled' } },
      { id: 'e4', source: 'check', target: 'fail', label: 'Tidak', style: { stroke: '#dc2626', strokeWidth: 1.5, edgeStyle: 'solid', endArrow: 'filled' } },
      { id: 'e5', source: 'fail', target: 'input', label: '', style: { stroke: '#64748b', strokeWidth: 1.5, edgeStyle: 'dashed', endArrow: 'filled' } }
    ];
  } else {
    // Blank default
    doc.nodes = [
      { id: 'n1', label: 'Mulai', shape: 'rounded', x: 100, y: 150, width: 120, height: 60, style: { fill: '#e0f2fe', stroke: '#0284c7', fontSize: 13 } }
    ];
  }

  // Pre-generate code strings
  doc.mermaid_code = serializeToMermaid(doc);
  doc.dbml_code = serializeToDBML(doc);

  await dbPut(db, STORE_NAME, doc);
  broadcastEvent(TMPT_EVENTS.FILE_CREATED, {
    id: newId,
    type: 'diagram',
    title: doc.title,
    app_db: DB_NAME
  });

  return doc;
}

// ── Two-Way Sync Logic (Mermaid ↔ State) ──────────────────────────────────────
function serializeToMermaid(doc) {
  const lines = ['flowchart TD'];
  doc.nodes.forEach(node => {
    const escaped = node.label.replace(/"/g, '#quot;');
    if (node.shape === 'rounded') {
      lines.push(`  ${node.id}(${escaped})`);
    } else if (node.shape === 'ellipse') {
      lines.push(`  ${node.id}((${escaped}))`);
    } else if (node.shape === 'diamond') {
      lines.push(`  ${node.id}{${escaped}}`);
    } else if (node.shape === 'cylinder') {
      lines.push(`  ${node.id}[(${escaped})]`);
    } else if (node.shape === 'cloud') {
      lines.push(`  ${node.id}[/${escaped}\\]`);
    } else {
      lines.push(`  ${node.id}[${escaped}]`);
    }
  });

  doc.edges.forEach(edge => {
    const linkStr = edge.label ? `-- ${edge.label} -->` : '-->';
    lines.push(`  ${edge.source} ${linkStr} ${edge.target}`);
  });

  return lines.join('\n');
}

function syncFromMermaid(mermaidText) {
  try {
    const nodesMap = {};
    const parsedEdges = [];
    const lines = mermaidText.split('\n').map(l => l.trim()).filter(Boolean);
    
    lines.forEach(line => {
      // Abaikan header diagram
      if (line.match(/^flowchart/i) || line.match(/^graph/i)) return;

      // 1. Ekstrak semua deklarasi node pada baris ini secara aman
      const nodeDeclRegex = /(\w+)(?:\[\((.+?)\)\]|\(\((.+?)\)\)|\{(.+?)\}|\((.+?)\)|\[\/(.+?)\\\]|\[(.+?)\])/g;
      for (const match of line.matchAll(nodeDeclRegex)) {
        const id = match[1];
        const label = match[2] || match[3] || match[4] || match[5] || match[6] || match[7] || id;
        
        let shape = 'rectangle';
        if (match[0].includes('[(')) shape = 'cylinder';
        else if (match[0].includes('((')) shape = 'ellipse';
        else if (match[0].includes('(')) shape = 'rounded';
        else if (match[0].includes('{')) shape = 'diamond';
        else if (match[0].includes('[/')) shape = 'cloud';

        nodesMap[id] = { label, shape };
      }

      // 2. Bersihkan baris dari deklarasi label/tanda kurung agar menyisakan ID node & konektor
      let cleanLine = line
        .replace(/\[\((.+?)\)\]/g, '')
        .replace(/\(\((.+?)\)\)/g, '')
        .replace(/\{(.+?)\}/g, '')
        .replace(/\((.+?)\)/g, '')
        .replace(/\[\/(.+?)\\\]/g, '')
        .replace(/\[(.+?)\]/g, '')
        .trim();

      // 3. Cocokkan konektor pada baris yang telah dibersihkan
      const edgeMatch = cleanLine.match(/^(\w+)\s+(?:-->|--\s*(.+?)\s*-->)\s+(\w+)$/);
      if (edgeMatch) {
        const source = edgeMatch[1];
        const label = edgeMatch[2] || '';
        const target = edgeMatch[3];
        
        parsedEdges.push({
          id: generateId(),
          source,
          target,
          label,
          style: { stroke: '#64748b', strokeWidth: 1.5, edgeStyle: 'solid', endArrow: 'filled' }
        });

        // Pastikan source & target terdaftar di nodesMap
        if (!nodesMap[source]) {
          nodesMap[source] = { label: source, shape: 'rectangle' };
        }
        if (!nodesMap[target]) {
          nodesMap[target] = { label: target, shape: 'rectangle' };
        }
      }
    });

    const parsedNodes = Object.keys(nodesMap).map((id) => {
      const existing = currentDoc.nodes.find(n => n.id === id);
      const nodeInfo = nodesMap[id];
      
      // Hitung lebar & tinggi dinamis berdasarkan kata terpanjang
      const words = nodeInfo.label.split(' ');
      const longestWordLength = Math.max(...words.map(w => w.length), 0);
      
      let width = 120;
      let height = 60;
      
      if (nodeInfo.shape === 'diamond') {
        width = Math.max(140, longestWordLength * 12 + 60);
        height = Math.max(90, longestWordLength * 8 + 45);
      } else {
        width = Math.max(120, longestWordLength * 10 + 40);
        height = 60;
      }

      return {
        id,
        label: nodeInfo.label,
        shape: nodeInfo.shape,
        x: existing ? existing.x : 100 + Math.random() * 200,
        y: existing ? existing.y : 100 + Math.random() * 200,
        width: width,
        height: height,
        style: existing ? existing.style : { fill: '#e0f2fe', stroke: '#0284c7', fontSize: 13 }
      };
    });

    // Hanya terapkan penataan tata letak otomatis jika graf benar-benar baru (koordinat kosong)
    const hasCoordinates = parsedNodes.some(n => n.x > 250 || n.y > 250);
    if (!hasCoordinates && parsedNodes.length > 0) {
      arrangeNodesVertically(parsedNodes, parsedEdges);
    }

    if (parsedNodes.length > 0) {
      currentDoc.nodes = parsedNodes;
      currentDoc.edges = parsedEdges;
      currentDoc.mermaid_code = mermaidText; // Pertahankan input kode buatan user
      renderer.render(currentDoc);
      triggerAutosave();
    }
  } catch (err) {
    console.warn('Gagal memproses kode Mermaid:', err.message);
    // Tampilkan status error sementara di save status tanpa meng-hang halaman
    const saveStatus = document.getElementById('save-status');
    if (saveStatus) saveStatus.textContent = 'Format Tidak Valid ⚠️';
  }
}

// Fungsi penataan otomatis vertikal berbasis level koneksi (Top-Bottom)
function arrangeNodesVertically(nodes, edges) {
  const adj = {};
  nodes.forEach(n => {
    adj[n.id] = [];
  });

  edges.forEach(e => {
    if (adj[e.source]) adj[e.source].push(e.target);
  });

  // 1. Deteksi back-edge (siklus) menggunakan DFS
  const visited = {};
  const recStack = {};
  const backEdges = new Set();

  function dfs(u) {
    visited[u] = true;
    recStack[u] = true;

    if (adj[u]) {
      adj[u].forEach(v => {
        if (!visited[v]) {
          dfs(v);
        } else if (recStack[v]) {
          backEdges.add(`${u}->${v}`);
        }
      });
    }

    recStack[u] = false;
  }

  nodes.forEach(n => {
    if (!visited[n.id]) {
      dfs(n.id);
    }
  });

  // 2. Buat DAG tanpa back-edge dan hitung in-degree
  const dagAdj = {};
  const dagInDegree = {};
  nodes.forEach(n => {
    dagAdj[n.id] = [];
    dagInDegree[n.id] = 0;
  });

  edges.forEach(e => {
    if (backEdges.has(`${e.source}->${e.target}`)) return; // Lewati back-edge
    if (dagAdj[e.source]) dagAdj[e.source].push(e.target);
    if (dagInDegree[e.target] !== undefined) dagInDegree[e.target]++;
  });

  // 3. Hitung level menggunakan topological sort
  const levels = {};
  const queue = [];

  nodes.forEach(n => {
    if (dagInDegree[n.id] === 0) {
      levels[n.id] = 0;
      queue.push(n.id);
    }
  });

  // Fallback jika ada sirkularitas mutlak
  if (queue.length === 0 && nodes.length > 0) {
    levels[nodes[0].id] = 0;
    queue.push(nodes[0].id);
  }

  while (queue.length > 0) {
    const u = queue.shift();
    const currentLvl = levels[u] || 0;
    dagAdj[u].forEach(v => {
      levels[v] = Math.max(levels[v] || 0, currentLvl + 1);
      dagInDegree[v]--;
      if (dagInDegree[v] === 0) {
        queue.push(v);
      }
    });
  }

  // Isi sisa node yang tidak terjangkau
  nodes.forEach(n => {
    if (levels[n.id] === undefined) {
      levels[n.id] = 0;
    }
  });

  const levelGroups = {};
  nodes.forEach(n => {
    const lvl = levels[n.id];
    if (!levelGroups[lvl]) levelGroups[lvl] = [];
    levelGroups[lvl].push(n);
  });

  const startY = 60;
  const levelHeight = 150; // Tinggi antar level lebih renggang agar rapi
  const spacingX = 200;    // Jarak horizontal antar node
  const centerX = 400;

  Object.keys(levelGroups).forEach(lvl => {
    const group = levelGroups[lvl];
    const y = startY + lvl * levelHeight;
    const totalWidth = (group.length - 1) * spacingX;
    const startX = centerX - totalWidth / 2;

    group.forEach((node, idx) => {
      node.x = startX + idx * spacingX;
      node.y = y;
    });
  });
}

// ── Two-Way Sync Logic (DBML ↔ State) ────────────────────────────────────────
function serializeToDBML(doc) {
  const dbml = [];
  doc.nodes.forEach(node => {
    if (node.shape === 'db_table' && node.db_table) {
      const tbl = node.db_table;
      dbml.push(`Table ${tbl.name} {`);
      tbl.columns.forEach(col => {
        const constraints = col.constraints.map(c => c === 'pk' ? 'pk' : c).join(', ');
        const cStr = constraints ? ` [${constraints}]` : '';
        dbml.push(`  ${col.name} ${col.type}${cStr}`);
      });
      dbml.push('}\n');
    }
  });

  doc.edges.forEach(edge => {
    const sNode = doc.nodes.find(n => n.id === edge.source);
    const tNode = doc.nodes.find(n => n.id === edge.target);
    if (sNode && tNode && sNode.db_table && tNode.db_table) {
      dbml.push(`Ref: ${sNode.db_table.name}.${sNode.db_table.columns[0].name} > ${tNode.db_table.name}.${tNode.db_table.columns[0].name}`);
    }
  });

  return dbml.join('\n');
}

function syncFromDBML(dbmlText) {
  const { tables, refs } = parseDBML(dbmlText);
  const parsedNodes = [];
  const parsedEdges = [];

  tables.forEach((tbl, idx) => {
    const existing = currentDoc.nodes.find(n => n.id === `t_${tbl.name}`);
    parsedNodes.push({
      id: `t_${tbl.name}`,
      label: tbl.name,
      shape: 'db_table',
      x: existing ? existing.x : 50 + idx * 200,
      y: existing ? existing.y : 80,
      width: 160,
      height: 60 + tbl.columns.length * 20,
      style: { fill: '#fffdf5', stroke: '#d97706', fontSize: 12 },
      db_table: tbl
    });
  });

  refs.forEach(ref => {
    parsedEdges.push({
      id: generateId(),
      source: `t_${ref.source_table}`,
      target: `t_${ref.target_table}`,
      label: 'FK',
      style: { stroke: '#b45309', strokeWidth: 1.5, edgeStyle: 'solid', endArrow: 'filled' }
    });
  });

  if (parsedNodes.length > 0) {
    currentDoc.nodes = parsedNodes;
    currentDoc.edges = parsedEdges;
    currentDoc.dbml_code = dbmlText;
    renderer.render(currentDoc);
    triggerAutosave();
  }
}

// ── UI & Module Switching ─────────────────────────────────────────────────────
function switchModule(moduleName) {
  activeModule = moduleName;
  currentDoc.module = moduleName;

  // Update tabs visual state
  ['draw', 'code', 'data', 'arch'].forEach(m => {
    const btn = document.getElementById(`btn-mod-${m}`);
    if (m === moduleName) {
      btn.classList.add('active');
    } else {
      btn.classList.remove('active');
    }
  });

  // Handle panel structures
  const sidebar = document.getElementById('sidebar-panel');
  const codePanel = document.getElementById('right-code-panel');
  const archCat = document.getElementById('arch-category');

  if (moduleName === 'draw') {
    sidebar.classList.remove('collapsed');
    codePanel.classList.add('collapsed');
    archCat.style.display = 'none';
  } else if (moduleName === 'arch') {
    sidebar.classList.remove('collapsed');
    codePanel.classList.add('collapsed');
    archCat.style.display = 'block';
  } else if (moduleName === 'code' || moduleName === 'data') {
    sidebar.classList.add('collapsed');
    codePanel.classList.remove('collapsed');
    updateEditorContent();
  }

  updateStatusBar();
}

function handleGraphInteraction(action, data) {
  if (action === 'update') {
    // Visual drag or connect triggers update
    currentDoc.nodes = data.nodes;
    currentDoc.edges = data.edges;
    
    // Hanya lakukan serialisasi ulang kode jika user tidak sedang aktif di modul editor kode terkait
    if (activeModule !== 'code') {
      currentDoc.mermaid_code = serializeToMermaid(currentDoc);
    }
    if (activeModule !== 'data') {
      currentDoc.dbml_code = serializeToDBML(currentDoc);
    }
    
    updateEditorContent();
    updateStatusBar();
    triggerAutosave();
  } else if (action === 'select') {
    showProperties(data);
  }
}

// ── Properties Panel ──────────────────────────────────────────────────────────
function showProperties(selection) {
  const panel = document.getElementById('properties-panel');
  const content = document.getElementById('properties-content');
  
  if (!selection) {
    panel.classList.add('hidden');
    return;
  }

  panel.classList.remove('hidden');
  content.innerHTML = '';

  if (selection.type === 'node') {
    const node = currentDoc.nodes.find(n => n.id === selection.id);
    if (!node) return;

    content.innerHTML = `
      <label>Label:
        <input type="text" id="prop-label" value="${node.label}">
      </label>
      <div style="display:grid; grid-template-columns: 1fr 1fr; gap: 0.5rem;">
        <label>Lebar:
          <input type="number" id="prop-w" value="${node.width}">
        </label>
        <label>Tinggi:
          <input type="number" id="prop-h" value="${node.height}">
        </label>
      </div>
      <label>Warna Latar:
        <input type="color" id="prop-fill" value="${node.style.fill || '#ffffff'}">
      </label>
      <label>Warna Garis:
        <input type="color" id="prop-stroke" value="${node.style.stroke || '#000000'}">
      </label>
      <button id="btn-delete-node" class="outline" style="border-color:#ef4444; color:#ef4444; margin-top:0.5rem;">Hapus Elemen</button>
    `;

    document.getElementById('prop-label').addEventListener('input', (e) => {
      node.label = e.target.value;
      renderer.render(currentDoc);
      handleGraphInteraction('update', currentDoc);
    });

    document.getElementById('prop-w').addEventListener('input', (e) => {
      node.width = parseInt(e.target.value) || 80;
      renderer.render(currentDoc);
      handleGraphInteraction('update', currentDoc);
    });

    document.getElementById('prop-h').addEventListener('input', (e) => {
      node.height = parseInt(e.target.value) || 40;
      renderer.render(currentDoc);
      handleGraphInteraction('update', currentDoc);
    });

    document.getElementById('prop-fill').addEventListener('input', (e) => {
      node.style.fill = e.target.value;
      renderer.render(currentDoc);
      handleGraphInteraction('update', currentDoc);
    });

    document.getElementById('prop-stroke').addEventListener('input', (e) => {
      node.style.stroke = e.target.value;
      renderer.render(currentDoc);
      handleGraphInteraction('update', currentDoc);
    });

    document.getElementById('btn-delete-node').addEventListener('click', () => {
      currentDoc.nodes = currentDoc.nodes.filter(n => n.id !== node.id);
      currentDoc.edges = currentDoc.edges.filter(e => e.source !== node.id && e.target !== node.id);
      renderer.render(currentDoc);
      handleGraphInteraction('update', currentDoc);
      showProperties(null);
    });
  } else if (selection.type === 'edge') {
    const edge = currentDoc.edges.find(e => e.id === selection.id);
    if (!edge) return;

    content.innerHTML = `
      <label>Label Garis:
        <input type="text" id="prop-edge-label" value="${edge.label || ''}">
      </label>
      <label>Gaya Garis:
        <select id="prop-edge-style">
          <option value="solid" ${edge.style.edgeStyle === 'solid' ? 'selected' : ''}>Solid</option>
          <option value="dashed" ${edge.style.edgeStyle === 'dashed' ? 'selected' : ''}>Dashed</option>
          <option value="dotted" ${edge.style.edgeStyle === 'dotted' ? 'selected' : ''}>Dotted</option>
        </select>
      </label>
      <button id="btn-delete-edge" class="outline" style="border-color:#ef4444; color:#ef4444; margin-top:0.5rem;">Hapus Koneksi</button>
    `;

    document.getElementById('prop-edge-label').addEventListener('input', (e) => {
      edge.label = e.target.value;
      renderer.render(currentDoc);
      handleGraphInteraction('update', currentDoc);
    });

    document.getElementById('prop-edge-style').addEventListener('change', (e) => {
      edge.style.edgeStyle = e.target.value;
      renderer.render(currentDoc);
      handleGraphInteraction('update', currentDoc);
    });

    document.getElementById('btn-delete-edge').addEventListener('click', () => {
      currentDoc.edges = currentDoc.edges.filter(e => e.id !== edge.id);
      renderer.render(currentDoc);
      handleGraphInteraction('update', currentDoc);
      showProperties(null);
    });
  }
}

// ── Event Listeners Setup ─────────────────────────────────────────────────────
function setupEventListeners() {
  // Zoom Controls
  document.getElementById('btn-zoom-in').addEventListener('click', () => {
    if (renderer) renderer.zoomIn();
  });
  document.getElementById('btn-zoom-out').addEventListener('click', () => {
    if (renderer) renderer.zoomOut();
  });
  document.getElementById('btn-zoom-reset').addEventListener('click', () => {
    if (renderer) renderer.zoomReset();
  });
  document.getElementById('btn-auto-layout').addEventListener('click', () => {
    if (renderer && currentDoc) {
      arrangeNodesVertically(currentDoc.nodes, currentDoc.edges);
      renderer.render(currentDoc);
      triggerAutosave();
    }
  });

  // Title edit
  const titleDisplay = document.getElementById('diagram-title-display');
  titleDisplay.addEventListener('blur', async () => {
    const newTitle = titleDisplay.textContent.trim() || 'Diagram Tanpa Judul';
    titleDisplay.textContent = newTitle;
    if (newTitle !== currentDoc.title) {
      currentDoc.title = newTitle;
      triggerAutosave();
    }
  });

  // Mode button events
  ['draw', 'code', 'data', 'arch'].forEach(m => {
    document.getElementById(`btn-mod-${m}`).addEventListener('click', () => switchModule(m));
  });

  // Shape drop/click listeners
  document.querySelectorAll('.shape-item').forEach(item => {
    item.addEventListener('dragstart', (e) => {
      e.dataTransfer.setData('text/shape', item.getAttribute('data-shape'));
    });
  });

  const canvasHost = document.getElementById('canvas-container-host');
  canvasHost.addEventListener('dragover', (e) => e.preventDefault());
  canvasHost.addEventListener('drop', (e) => {
    e.preventDefault();
    const shape = e.dataTransfer.getData('text/shape');
    if (!shape) return;

    const rect = canvasHost.getBoundingClientRect();
    // Convert coordinate accounting for zoom & translation
    const x = (e.clientX - rect.left - renderer.viewport.panX) / renderer.viewport.zoom;
    const y = (e.clientY - rect.top - renderer.viewport.panY) / renderer.viewport.zoom;

    const newNode = {
      id: 'node_' + Math.random().toString(36).substr(2, 9),
      label: shape.charAt(0).toUpperCase() + shape.slice(1),
      shape: shape,
      x: x - 60,
      y: y - 30,
      width: 120,
      height: 60,
      style: { fill: '#e0f2fe', stroke: '#0284c7', fontSize: 13 }
    };

    if (shape === 'c4_person') {
      newNode.style.fill = '#0a85ea';
      newNode.style.stroke = '#0258a1';
      newNode.style.fontColor = '#ffffff';
    } else if (shape === 'c4_system') {
      newNode.style.fill = '#1168bd';
      newNode.style.stroke = '#0b4d90';
      newNode.style.fontColor = '#ffffff';
    }

    currentDoc.nodes.push(newNode);
    renderer.render(currentDoc);
    handleGraphInteraction('update', currentDoc);
  });

  // Properties close
  document.getElementById('btn-close-properties').addEventListener('click', () => showProperties(null));

  // Export handlers
  document.getElementById('export-json').addEventListener('click', (e) => {
    e.preventDefault();
    downloadBlob(JSON.stringify(currentDoc, null, 2), `${currentDoc.title.toLowerCase().replace(/\s+/g, '-')}.diagram`, 'application/json');
  });

  document.getElementById('export-svg').addEventListener('click', (e) => {
    e.preventDefault();
    
    // Clone node SVG agar tidak merusak tampilan live editor
    const canvas = document.getElementById('diagram-canvas');
    const svgClone = canvas.cloneNode(true);
    
    // 1. Hapus semua indikator port (titik-titik putih) agar hasil ekspor bersih
    svgClone.querySelectorAll('.port-indicator').forEach(el => el.remove());
    
    // 2. Ganti background grid dengan warna putih solid (#ffffff)
    const bgRect = svgClone.querySelector('rect[fill*="grid-pattern"]');
    if (bgRect) {
      bgRect.setAttribute('fill', '#ffffff');
    }
    
    // 3. Konversi CSS variables menjadi warna solid agar terbaca di viewer gambar eksternal
    svgClone.querySelectorAll('text').forEach(el => {
      const fill = el.getAttribute('fill');
      if (!fill || fill.includes('var(')) {
        el.setAttribute('fill', '#1e293b'); // Warna teks abu-abu gelap
      }
    });

    svgClone.querySelectorAll('path').forEach(el => {
      const stroke = el.getAttribute('stroke');
      if (stroke && stroke.includes('var(')) {
        el.setAttribute('stroke', '#64748b'); // Warna garis solid
      }
    });

    // 4. Hitung bounding box diagram untuk menentukan viewBox ekspor yang pas (tidak terpotong)
    const nodes = currentDoc.nodes;
    if (nodes.length > 0) {
      let minX = Infinity, minY = Infinity;
      let maxX = -Infinity, maxY = -Infinity;
      
      nodes.forEach(n => {
        minX = Math.min(minX, n.x);
        minY = Math.min(minY, n.y);
        maxX = Math.max(maxX, n.x + n.width);
        maxY = Math.max(maxY, n.y + n.height);
      });
      
      // Tambahkan margin padding 40px di sekeliling diagram
      const padding = 40;
      minX -= padding;
      minY -= padding;
      const width = (maxX - minX) + padding * 2;
      const height = (maxY - minY) + padding * 2;
      
      svgClone.setAttribute('viewBox', `${minX} ${minY} ${width} ${height}`);
      svgClone.setAttribute('width', width);
      svgClone.setAttribute('height', height);
      
      // Hilangkan transform translate & scale viewport editor agar render pas di koordinat viewBox
      const rootG = svgClone.querySelector('.diagram-root');
      if (rootG) {
        rootG.removeAttribute('transform');
      }
    }

    const svgString = new XMLSerializer().serializeToString(svgClone);
    downloadBlob(svgString, `${currentDoc.title.toLowerCase().replace(/\s+/g, '-')}.svg`, 'image/svg+xml');
  });

  document.getElementById('export-sql').addEventListener('click', (e) => {
    e.preventDefault();
    document.getElementById('modal-sql-dialect').showModal();
  });

  document.getElementById('btn-confirm-sql-export').addEventListener('click', () => {
    const dialect = document.getElementById('select-sql-dialect').value;
    const tables = currentDoc.nodes.filter(n => n.shape === 'db_table').map(n => n.db_table).filter(Boolean);
    
    // Extract relations
    const refs = currentDoc.edges.map(edge => {
      const sNode = currentDoc.nodes.find(n => n.id === edge.source);
      const tNode = currentDoc.nodes.find(n => n.id === edge.target);
      if (sNode && tNode && sNode.db_table && tNode.db_table) {
        return {
          source_table: sNode.db_table.name,
          source_col: sNode.db_table.columns[0].name,
          target_table: tNode.db_table.name,
          target_col: tNode.db_table.columns[0].name
        };
      }
      return null;
    }).filter(Boolean);

    const sqlText = generateSQL(tables, refs, dialect);
    downloadBlob(sqlText, `${currentDoc.title.toLowerCase().replace(/\s+/g, '-')}.sql`, 'text/plain');
    document.getElementById('modal-sql-dialect').close();
  });

  // Keydown to delete selected items
  window.addEventListener('keydown', (e) => {
    if (e.key === 'Delete' || e.key === 'Backspace') {
      // Don't intercept if inside input/editor
      if (document.activeElement.tagName === 'INPUT' || document.activeElement.tagName === 'TEXTAREA' || document.activeElement.closest('.monaco-editor')) {
        return;
      }
      let changed = false;
      if (renderer.selectedNodeIds.size > 0) {
        currentDoc.nodes = currentDoc.nodes.filter(n => !renderer.selectedNodeIds.has(n.id));
        currentDoc.edges = currentDoc.edges.filter(edge => !renderer.selectedNodeIds.has(edge.source) && !renderer.selectedNodeIds.has(edge.target));
        renderer.selectedNodeIds.clear();
        changed = true;
      }
      if (renderer.selectedEdgeIds.size > 0) {
        currentDoc.edges = currentDoc.edges.filter(edge => !renderer.selectedEdgeIds.has(edge.id));
        renderer.selectedEdgeIds.clear();
        changed = true;
      }
      if (changed) {
        renderer.render(currentDoc);
        handleGraphInteraction('update', currentDoc);
        showProperties(null);
      }
    }
  });
}

function downloadBlob(content, filename, contentType) {
  const blob = new Blob([content], { type: contentType });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

// ── Autosave & Status indicators ──────────────────────────────────────────────
let autosaveTimer = null;
function triggerAutosave() {
  document.getElementById('save-status').textContent = 'Ada perubahan';
  clearTimeout(autosaveTimer);
  autosaveTimer = setTimeout(async () => {
    document.getElementById('save-status').textContent = 'Menyimpan...';
    try {
      currentDoc.updated_at = new Date().toISOString();
      await dbPut(db, STORE_NAME, currentDoc);
      document.getElementById('save-status').textContent = 'Tersimpan ✓';

      // Send broadcast update
      broadcastEvent(TMPT_EVENTS.FILE_UPDATED, {
        id: currentDoc.id,
        type: 'diagram',
        title: currentDoc.title,
        app_db: DB_NAME,
        app_link: `/app/dev/diagram/editor.html?id=${currentDoc.id}`
      });
    } catch (err) {
      document.getElementById('save-status').textContent = 'Gagal menyimpan ⚠️';
    }
  }, 2000);
}

function updateStatusBar() {
  document.getElementById('status-mode').textContent = `Modul ${activeModule.charAt(0).toUpperCase() + activeModule.slice(1)}`;
  document.getElementById('node-count-display').textContent = `${currentDoc.nodes.length} node`;
  document.getElementById('edge-count-display').textContent = `${currentDoc.edges.length} edge`;
  document.getElementById('zoom-display').textContent = `${Math.round(renderer.viewport.zoom * 100)}%`;
}

// Run init
window.addEventListener('DOMContentLoaded', init);
