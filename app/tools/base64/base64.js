/**
 * TMPT Base64 - Main Application Controller
 */

import { encodeTextToBase64, decodeBase64ToText } from './tools/text-encoder.js';
import { base64ToHex, hexToBase64 } from './tools/hex-codec.js';
import { fileToBase64, detectMimeFromBytes } from './tools/file-encoder.js';
import { decodeBase64ToImage, imageToBase64WithOptions, parseDataUri } from './tools/image-codec.js';
import { decodeBase64ToAudio, audioToBase64 } from './tools/audio-codec.js';
import { decodeBase64ToVideo, videoToBase64 } from './tools/video-codec.js';
import { decodeBase64ToPDF, pdfToBase64 } from './tools/pdf-codec.js';
import { encodeHTMLToBase64, decodeBase64ToHTML } from './tools/html-encoder.js';
import { convertToCSSDataURI } from './tools/css-uri.js';
import { decodeBasicAuth, encodeBasicAuth } from './tools/basic-auth.js';
import { encodeURLToBase64, decodeBase64ToURL } from './tools/url-encoder.js';
import { validateBase64 } from './tools/validator.js';
import { normalizeBase64 } from './tools/normalizer.js';
import { repairBase64 } from './tools/repairer.js';
import { detectEncoding } from './tools/encoding-detector.js';
import { detectBase64Standard } from './tools/standard-detector.js';
import { checkAndDecompressGzip } from './tools/gzip-checker.js';
import { decodeUUencoded } from './tools/uuencoded-decoder.js';

// List of all 29 tools
const TOOLS = [
    // DECODER
    { id: 'base64-to-ascii', name: 'Base64 to ASCII', cat: 'decode', icon: '🔤', desc: 'Decode Base64 ke teks ASCII standar', pri: 'P0' },
    { id: 'base64-to-audio', name: 'Base64 to Audio', cat: 'decode', icon: '🔊', desc: 'Decode Base64 ke player audio yang dapat diputar', pri: 'P1' },
    { id: 'basic-auth-decode', name: 'Basic Auth Decode', cat: 'decode', icon: '🔑', desc: 'Decode header HTTP Basic Authentication', pri: 'P0' },
    { id: 'base64-to-file', name: 'Base64 to File', cat: 'decode', icon: '📁', desc: 'Decode Base64 ke file biner untuk diunduh', pri: 'P0' },
    { id: 'base64-to-hex', name: 'Base64 to HEX', cat: 'decode', icon: '#️⃣', desc: 'Decode Base64 ke representasi string HEX', pri: 'P1' },
    { id: 'base64-to-image', name: 'Base64 to Image', cat: 'decode', icon: '🖼', desc: 'Decode Base64 ke gambar yang dapat di-preview', pri: 'P0' },
    { id: 'base64-to-pdf', name: 'Base64 to PDF', cat: 'decode', icon: '📄', desc: 'Decode Base64 ke preview dokumen PDF', pri: 'P1' },
    { id: 'base64-to-text', name: 'Base64 to Text', cat: 'decode', icon: '🔤', desc: 'Decode Base64 ke teks Unicode (UTF-8)', pri: 'P0' },
    { id: 'base64-to-video', name: 'Base64 to Video', cat: 'decode', icon: '🎬', desc: 'Decode Base64 ke player video yang dapat diputar', pri: 'P2' },

    // ENCODER
    { id: 'audio-to-base64', name: 'Audio to Base64', cat: 'encode', icon: '🔊', desc: 'Encode file audio ke Base64 / Data URI', pri: 'P1' },
    { id: 'css-to-base64', name: 'CSS to Base64', cat: 'encode', icon: '🎨', desc: 'Encode file stylesheet CSS ke Base64', pri: 'P1' },
    { id: 'file-to-base64', name: 'File to Base64', cat: 'encode', icon: '📁', desc: 'Encode file apapun menjadi string Base64', pri: 'P0' },
    { id: 'hex-to-base64', name: 'HEX to Base64', cat: 'encode', icon: '#️⃣', desc: 'Encode string HEX ke format Base64', pri: 'P1' },
    { id: 'html-to-base64', name: 'HTML to Base64', cat: 'encode', icon: '📝', desc: 'Encode kode HTML ke Base64 / Data URI', pri: 'P1' },
    { id: 'image-to-base64', name: 'Image to Base64', cat: 'encode', icon: '🖼', desc: 'Encode file gambar ke Base64 atau Data URI', pri: 'P0' },
    { id: 'pdf-to-base64', name: 'PDF to Base64', cat: 'encode', icon: '📄', desc: 'Encode dokumen PDF ke format Base64', pri: 'P1' },
    { id: 'text-to-base64', name: 'Text to Base64', cat: 'encode', icon: '🔤', desc: 'Encode teks biasa (UTF-8) ke Base64', pri: 'P0' },
    { id: 'url-to-base64', name: 'URL to Base64', cat: 'encode', icon: '🔗', desc: 'Encode string URL ke format Base64', pri: 'P1' },
    { id: 'video-to-base64', name: 'Video to Base64', cat: 'encode', icon: '🎬', desc: 'Encode file video ke Base64 / Data URI', pri: 'P2' },

    // UTILITAS
    { id: 'encoding-detect', name: 'Encoding Detection', cat: 'util', icon: '🔍', desc: 'Deteksi otomatis encoding teks dari byte data', pri: 'P1' },
    { id: 'css-data-uri', name: 'CSS Data URI Converter', cat: 'util', icon: '🎨', desc: 'Konversi file/URI menjadi CSS background/font snippet', pri: 'P0' },
    { id: 'data-uri-to-image', name: 'Data URI to Image', cat: 'util', icon: '🖼', desc: 'Parse Data URI dan tampilkan sebagai gambar', pri: 'P0' },
    { id: 'standard-detect', name: 'Base64 Standard Detector', cat: 'util', icon: '🏷', desc: 'Identifikasi standar/varian Base64 dari input', pri: 'P1' },
    { id: 'gzip-check', name: 'Check Gzip Compression', cat: 'util', icon: '🗜', desc: 'Periksa gzip header dan decompress isinya', pri: 'P1' },
    { id: 'basic-auth-simulator', name: 'HTTP Req Simulator', cat: 'util', icon: '🌐', desc: 'Simulasi/visualisasi header HTTP Authorization', pri: 'P2' },
    { id: 'normalize-base64', name: 'Normalize Base64', cat: 'util', icon: '🔧', desc: 'Bersihkan whitespace dan ganti format URL-safe', pri: 'P1' },
    { id: 'repair-base64', name: 'Repair Base64', cat: 'util', icon: '🩹', desc: 'Perbaiki padding/karakter tidak valid pada Base64', pri: 'P0' },
    { id: 'uuencoded-decode', name: 'UUencode Decoder', cat: 'util', icon: '📦', desc: 'Decode file terenkode format jadul UUencode', pri: 'P2' },
    { id: 'validate-base64', name: 'Validate Base64', cat: 'util', icon: '✅', desc: 'Validasi kepatuhan format Base64 beserta laporannya', pri: 'P0' }
];

document.addEventListener('DOMContentLoaded', () => {
    // 1. Initial State
    let activeTool = 'dashboard';
    let searchQuery = '';
    let sidebarSearchQuery = '';
    let settings = {
        output_line_wrap: 0,
        url_safe_mode: false,
        auto_detect_charset: true,
        show_char_count: true,
        copy_on_encode: false
    };
    
    // Load settings from localStorage
    const savedSettings = localStorage.getItem('tmpt_base64_settings');
    if (savedSettings) {
        settings = { ...settings, ...JSON.parse(savedSettings) };
    }

    // 2. Load History
    let history = [];
    const savedHistory = localStorage.getItem('tmpt_base64_history');
    if (savedHistory) {
        history = JSON.parse(savedHistory);
    }

    // Dom Elements
    const sidebarList = document.getElementById('sidebar-tool-list');
    const mainWorkbench = document.getElementById('main-workbench');
    const searchInput = document.getElementById('header-search');
    const sidebarSearch = document.getElementById('sidebar-search');

    // 3. Save Settings Helper
    function saveSettings() {
        localStorage.setItem('tmpt_base64_settings', JSON.stringify(settings));
    }

    // 4. Save to History Helper
    function saveToHistory(entry) {
        history.unshift({
            id: crypto.randomUUID(),
            timestamp: new Date().toISOString(),
            ...entry
        });
        history = history.slice(0, 15);
        localStorage.setItem('tmpt_base64_history', JSON.stringify(history));
        renderHistory();
    }

    // 5. Build Sidebar
    function renderSidebar() {
        if (!sidebarList) return;
        
        let html = '';
        const categories = {
            'decode': '🔓 DECODER',
            'encode': '🔒 ENCODER',
            'util': '🔧 UTILITAS'
        };

        Object.keys(categories).forEach(cat => {
            const catTools = TOOLS.filter(t => t.cat === cat && 
                t.name.toLowerCase().includes(sidebarSearchQuery.toLowerCase()));
            
            if (catTools.length > 0) {
                html += `<div class="tool-group-title">${categories[cat]}</div>`;
                catTools.forEach(tool => {
                    const isActive = activeTool === tool.id ? 'active' : '';
                    html += `
                        <a class="sidebar-tool-link ${isActive}" data-id="${tool.id}">
                            <span class="tool-icon">${tool.icon}</span>
                            <span>${tool.name}</span>
                        </a>
                    `;
                });
            }
        });

        sidebarList.innerHTML = html;

        // Bind click events
        sidebarList.querySelectorAll('.sidebar-tool-link').forEach(btn => {
            btn.addEventListener('click', () => {
                const toolId = btn.dataset.id;
                switchTool(toolId);
            });
        });
    }

    // 6. Switch Tool Route
    function switchTool(toolId) {
        activeTool = toolId;
        renderSidebar();
        
        // Push state or URL parameter
        const url = new URL(window.location.href);
        if (toolId === 'dashboard') {
            url.searchParams.delete('tool');
        } else {
            url.searchParams.set('tool', toolId);
        }
        window.history.pushState({}, '', url.toString());

        renderActiveWorkspace();
    }

    // 7. Render Active Workspace
    function renderActiveWorkspace() {
        if (!mainWorkbench) return;

        if (activeTool === 'dashboard') {
            renderDashboard();
            return;
        }

        const tool = TOOLS.find(t => t.id === activeTool);
        if (!tool) {
            renderDashboard();
            return;
        }

        // Base Template for Tools
        mainWorkbench.innerHTML = `
            <div class="tool-workspace">
                <div class="tool-workspace-header">
                    <div style="display:flex; align-items:center; gap:0.5rem;">
                        <button class="outline secondary" id="back-to-dashboard-btn" style="margin-bottom:0; font-size:0.8rem; padding:0.4rem 0.85rem;">← Kembali</button>
                        <h2>${tool.icon} ${tool.name}</h2>
                    </div>
                    <span class="badge-priority priority-${tool.pri.toLowerCase()}">${tool.pri}</span>
                </div>
                
                <div id="tool-interactive-area">
                    <!-- Tool Specific UI loaded dynamically -->
                </div>
            </div>
            
            <section class="quick-converter-card" style="margin-top: 1.5rem;">
                <h3>📊 Riwayat Aksi Terakhir</h3>
                <div id="local-history-container">
                    <!-- Loaded dynamically -->
                </div>
            </section>
        `;

        document.getElementById('back-to-dashboard-btn').addEventListener('click', () => {
            switchTool('dashboard');
        });

        // Setup Specific Tool UI & Logic
        setupSpecificToolLogic(tool.id);
        renderHistory();
    }

    // 8. Render Dashboard
    function renderDashboard() {
        let html = `
            <!-- Quick Converter Section -->
            <section class="quick-converter-card">
                <h3>🔡 Konversi Cepat (Quick Converter)</h3>
                <p class="secondary" style="font-size:0.85rem; margin-bottom: 1rem;">Konversi dua arah Teks &harr; Base64 secara instan.</p>
                <div class="quick-converter-grid">
                    <div>
                        <label for="quick-input" class="pane-title">INPUT (Teks biasa / Base64)</label>
                        <textarea id="quick-input" placeholder="Tempel teks biasa atau Base64 di sini..." class="pane-textarea"></textarea>
                    </div>
                    <div>
                        <label for="quick-output" class="pane-title">OUTPUT</label>
                        <textarea id="quick-output" placeholder="Hasil konversi otomatis..." readonly class="pane-textarea"></textarea>
                    </div>
                </div>
                <div class="quick-converter-actions">
                    <button id="quick-encode-btn" class="btn-navy" style="margin-bottom:0;">Encode →</button>
                    <button id="quick-decode-btn" class="outline secondary" style="margin-bottom:0;">← Decode</button>
                    <button id="quick-swap-btn" class="outline secondary" style="margin-bottom:0;">Swap ⇄</button>
                    <button id="quick-clear-btn" class="outline secondary" style="margin-bottom:0;">Clear ✕</button>
                    <button id="quick-copy-btn" class="outline secondary" style="margin-bottom:0;">Copy 📋</button>
                    
                    <div style="flex-grow:1;"></div>
                    
                    <div class="quick-converter-options">
                        <label style="margin-bottom:0; font-size:0.85rem;">
                            <input type="checkbox" id="quick-opt-urlsafe" ${settings.url_safe_mode ? 'checked' : ''}> URL-safe
                        </label>
                        <label style="margin-bottom:0; font-size:0.85rem;">
                            Wrap:
                            <select id="quick-opt-wrap" style="width:auto; margin-bottom:0; display:inline-block; padding: 0.2rem 0.5rem; font-size:0.8rem; height:auto;">
                                <option value="0" ${settings.output_line_wrap === 0 ? 'selected' : ''}>None</option>
                                <option value="64" ${settings.output_line_wrap === 64 ? 'selected' : ''}>64 (PEM)</option>
                                <option value="76" ${settings.output_line_wrap === 76 ? 'selected' : ''}>76 (MIME)</option>
                            </select>
                        </label>
                    </div>
                </div>
            </section>

            <!-- All 29 Tools Grid Grouped -->
            <div style="margin-top: 2rem;">
                <h3 style="border-bottom: 2px solid var(--pico-muted-border-color); padding-bottom: 0.5rem; margin-bottom: 1.5rem;">🛠️ Pilih Perkakas Konversi</h3>
                <div class="dashboard-grid" id="dashboard-tools-grid">
                    <!-- Populated by search/filter -->
                </div>
            </div>

            <!-- History Section -->
            <section class="quick-converter-card" style="margin-top: 2rem;">
                <h3>📊 Riwayat Aksi</h3>
                <div id="local-history-container">
                    <!-- Loaded dynamically -->
                </div>
            </section>
        `;

        mainWorkbench.innerHTML = html;

        // Populate the tools grid
        renderDashboardToolsGrid();
        renderHistory();

        // Setup Quick Converter Actions
        const quickInput = document.getElementById('quick-input');
        const quickOutput = document.getElementById('quick-output');
        const quickOptUrlSafe = document.getElementById('quick-opt-urlsafe');
        const quickOptWrap = document.getElementById('quick-opt-wrap');

        const doQuickEncode = () => {
            const text = quickInput.value;
            let result = encodeTextToBase64(text, 'UTF-8', quickOptUrlSafe.checked);
            const wrapVal = parseInt(quickOptWrap.value);
            if (wrapVal > 0 && result) {
                const matches = result.match(new RegExp(`.{1,${wrapVal}}`, 'g'));
                if (matches) result = matches.join('\n');
            }
            quickOutput.value = result;
        };

        const doQuickDecode = () => {
            const text = quickInput.value;
            try {
                quickOutput.value = decodeBase64ToText(text, 'UTF-8');
            } catch (e) {
                quickOutput.value = `Error: ${e.message}\nString mungkin malformed atau tidak valid.`;
            }
        };

        document.getElementById('quick-encode-btn').addEventListener('click', doQuickEncode);
        document.getElementById('quick-decode-btn').addEventListener('click', doQuickDecode);
        
        document.getElementById('quick-swap-btn').addEventListener('click', () => {
            const temp = quickInput.value;
            quickInput.value = quickOutput.value;
            quickOutput.value = temp;
        });

        document.getElementById('quick-clear-btn').addEventListener('click', () => {
            quickInput.value = '';
            quickOutput.value = '';
        });

        document.getElementById('quick-copy-btn').addEventListener('click', () => {
            if (quickOutput.value) {
                navigator.clipboard.writeText(quickOutput.value);
                window.TMPT_UI.toast('✓ Hasil disalin ke clipboard!', 'success');
            }
        });

        // Settings updates
        quickOptUrlSafe.addEventListener('change', (e) => {
            settings.url_safe_mode = e.target.checked;
            saveSettings();
        });
        quickOptWrap.addEventListener('change', (e) => {
            settings.output_line_wrap = parseInt(e.target.value);
            saveSettings();
        });
    }

    function renderDashboardToolsGrid() {
        const grid = document.getElementById('dashboard-tools-grid');
        if (!grid) return;

        // Filter search
        const filtered = TOOLS.filter(tool => {
            const q = searchQuery.toLowerCase();
            return tool.name.toLowerCase().includes(q) || tool.desc.toLowerCase().includes(q);
        });

        if (filtered.length === 0) {
            grid.innerHTML = `<p class="secondary" style="grid-column: 1/-1; text-align: center; padding: 2rem;">Perkakas tidak ditemukan untuk "${searchQuery}".</p>`;
            return;
        }

        grid.innerHTML = filtered.map(tool => `
            <div class="dashboard-tool-card" data-id="${tool.id}">
                <div class="card-title-row">
                    <span style="font-size:1.25rem;">${tool.icon}</span>
                    <h4>${tool.name}</h4>
                    <span class="badge-priority priority-${tool.pri.toLowerCase()}">${tool.pri}</span>
                </div>
                <p class="card-desc">${tool.desc}</p>
            </div>
        `).join('');

        grid.querySelectorAll('.dashboard-tool-card').forEach(card => {
            card.addEventListener('click', () => {
                switchTool(card.dataset.id);
            });
        });
    }

    // 9. Render History
    function renderHistory() {
        const containers = document.querySelectorAll('#local-history-container');
        containers.forEach(container => {
            if (!container) return;
            if (history.length === 0) {
                container.innerHTML = '<p class="secondary" style="font-size:0.85rem; text-align:center; padding:1rem;">Belum ada riwayat penggunaan.</p>';
                return;
            }

            container.innerHTML = `
                <div class="history-list">
                    ${history.map(item => {
                        const dateStr = new Date(item.timestamp).toLocaleTimeString();
                        const sizeStr = item.input_size ? `${item.input_size} B &rarr; ${item.output_size} B` : '';
                        return `
                            <div class="history-item">
                                <div>
                                    <strong>${item.name}</strong> 
                                    <span class="secondary" style="font-size:0.75rem; margin-left:0.5rem;">${dateStr}</span>
                                </div>
                                <div style="display:flex; align-items:center; gap:1rem;">
                                    <span class="secondary" style="font-size:0.8rem;">${sizeStr}</span>
                                    <button class="outline secondary" data-action-load="${item.tool}" style="margin-bottom:0; font-size:0.75rem; padding:0.25rem 0.5rem;">Buka</button>
                                </div>
                            </div>
                        `;
                    }).join('')}
                </div>
            `;

            container.querySelectorAll('[data-action-load]').forEach(btn => {
                btn.addEventListener('click', () => {
                    switchTool(btn.dataset.actionLoad);
                });
            });
        });
    }

    // 10. Logic per-tool
    function setupSpecificToolLogic(toolId) {
        const area = document.getElementById('tool-interactive-area');
        if (!area) return;

        // Custom template generation based on category/type
        if (toolId === 'base64-to-text' || toolId === 'base64-to-ascii') {
            setupTextDecoderUI(area, toolId === 'base64-to-ascii' ? 'ASCII' : 'UTF-8');
        } else if (toolId === 'text-to-base64') {
            setupTextEncoderUI(area);
        } else if (toolId === 'image-to-base64') {
            setupImageEncoderUI(area);
        } else if (toolId === 'base64-to-image') {
            setupImageDecoderUI(area);
        } else if (toolId === 'file-to-base64' || toolId === 'css-to-base64' || toolId === 'pdf-to-base64' || toolId === 'audio-to-base64' || toolId === 'video-to-base64') {
            setupGenericFileEncoderUI(area, toolId);
        } else if (toolId === 'base64-to-file') {
            setupGenericFileDecoderUI(area);
        } else if (toolId === 'base64-to-hex') {
            setupBase64ToHexUI(area);
        } else if (toolId === 'hex-to-base64') {
            setupHexToBase64UI(area);
        } else if (toolId === 'basic-auth-decode') {
            setupBasicAuthDecodeUI(area);
        } else if (toolId === 'url-to-base64') {
            setupUrlToBase64UI(area);
        } else if (toolId === 'html-to-base64') {
            setupHtmlToBase64UI(area);
        } else if (toolId === 'validate-base64') {
            setupValidateUI(area);
        } else if (toolId === 'normalize-base64') {
            setupNormalizeUI(area);
        } else if (toolId === 'repair-base64') {
            setupRepairUI(area);
        } else if (toolId === 'encoding-detect') {
            setupEncodingDetectUI(area);
        } else if (toolId === 'standard-detect') {
            setupStandardDetectUI(area);
        } else if (toolId === 'gzip-check') {
            setupGzipCheckUI(area);
        } else if (toolId === 'uuencoded-decode') {
            setupUUencodedDecodeUI(area);
        } else if (toolId === 'css-data-uri') {
            setupCssDataUriUI(area);
        } else if (toolId === 'data-uri-to-image') {
            setupDataUriToImageUI(area);
        } else if (toolId === 'base64-to-pdf') {
            setupBase64ToPdfUI(area);
        } else if (toolId === 'base64-to-audio') {
            setupBase64ToAudioUI(area);
        } else if (toolId === 'base64-to-video') {
            setupBase64ToVideoUI(area);
        } else if (toolId === 'basic-auth-simulator') {
            setupBasicAuthSimulatorUI(area);
        }
    }

    // Helper functions to populate specific UI
    function buildSplitPaneHTML(inputLabel, outputLabel, isInputReadOnly = false, isOutputReadOnly = true) {
        return `
            <div class="editor-split-pane">
                <div>
                    <label class="pane-title">${inputLabel}</label>
                    <textarea id="tool-input" placeholder="Ketik atau tempel data di sini..." class="pane-textarea" ${isInputReadOnly ? 'readonly' : ''}></textarea>
                    <div class="pane-actions" id="input-pane-actions"></div>
                </div>
                <div>
                    <label class="pane-title">${outputLabel}</label>
                    <textarea id="tool-output" placeholder="Hasil pemrosesan..." class="pane-textarea" ${isOutputReadOnly ? 'readonly' : ''}></textarea>
                    <div class="pane-actions" id="output-pane-actions"></div>
                </div>
            </div>
            <div class="stats-panel" id="tool-stats-panel" style="display:none;"></div>
        `;
    }

    function setupCommonOutputActions(outputId = 'tool-output') {
        const pane = document.getElementById('output-pane-actions');
        if (!pane) return;
        pane.innerHTML = `
            <button class="btn-navy" id="btn-copy-out" style="margin-bottom:0; font-size:0.8rem; padding:0.4rem 0.85rem;">📋 Salin</button>
            <button class="outline secondary" id="btn-download-out" style="margin-bottom:0; font-size:0.8rem; padding:0.4rem 0.85rem;">💾 Unduh</button>
        `;
        
        document.getElementById('btn-copy-out').addEventListener('click', () => {
            const outVal = document.getElementById(outputId).value;
            if (outVal) {
                navigator.clipboard.writeText(outVal);
                window.TMPT_UI.toast('✓ Disalin ke clipboard!', 'success');
            }
        });

        document.getElementById('btn-download-out').addEventListener('click', () => {
            const outVal = document.getElementById(outputId).value;
            if (outVal) {
                const blob = new Blob([outVal], { type: 'text/plain;charset=utf-8' });
                const url = URL.createObjectURL(blob);
                const a = document.createElement('a');
                a.href = url;
                a.download = `base64-output-${new Date().toISOString().slice(0,10)}.txt`;
                a.click();
                URL.revokeObjectURL(url);
            }
        });
    }

    function updateStats(inputLen, outputLen) {
        const panel = document.getElementById('tool-stats-panel');
        if (!panel) return;
        panel.style.display = 'block';
        const diff = inputLen ? ((outputLen - inputLen) / inputLen * 100).toFixed(1) : 0;
        panel.innerHTML = `
            <div class="stats-grid">
                <div class="stat-item"><span class="stat-label">Ukuran Input</span><span class="stat-value">${inputLen.toLocaleString()} byte</span></div>
                <div class="stat-item"><span class="stat-label">Ukuran Output</span><span class="stat-value">${outputLen.toLocaleString()} byte</span></div>
                <div class="stat-item"><span class="stat-label">Perubahan</span><span class="stat-value">${diff > 0 ? '+' : ''}${diff}%</span></div>
            </div>
        `;
    }

    // 10.1 Text Decoder
    function setupTextDecoderUI(container, charset) {
        container.innerHTML = buildSplitPaneHTML('Base64 Input', `Teks Output (${charset})`);
        setupCommonOutputActions();
        
        const input = document.getElementById('tool-input');
        const output = document.getElementById('tool-output');

        const process = () => {
            try {
                output.value = decodeBase64ToText(input.value, charset);
                updateStats(input.value.length, output.value.length);
            } catch (e) {
                output.value = `Error: String tidak valid untuk Base64 / charset ${charset}.\nDetail: ${e.message}`;
            }
        };

        input.addEventListener('input', process);
    }

    // 10.2 Text Encoder
    function setupTextEncoderUI(container) {
        container.innerHTML = `
            ${buildSplitPaneHTML('Teks Input', 'Base64 Output')}
            <div class="quick-converter-options" style="margin-top: 1rem;">
                <label style="margin-bottom:0;"><input type="checkbox" id="chk-urlsafe"> URL-safe Base64</label>
                <label style="margin-bottom:0;">
                    Wrap baris:
                    <select id="sel-wrap" style="width:auto; margin-bottom:0; display:inline-block; padding:0.2rem 0.5rem; font-size:0.8rem; height:auto;">
                        <option value="0">None</option>
                        <option value="64">64 (PEM)</option>
                        <option value="76">76 (MIME)</option>
                    </select>
                </label>
            </div>
        `;
        setupCommonOutputActions();

        const input = document.getElementById('tool-input');
        const output = document.getElementById('tool-output');
        const chkUrlSafe = document.getElementById('chk-urlsafe');
        const selWrap = document.getElementById('sel-wrap');

        const process = () => {
            let res = encodeTextToBase64(input.value, 'UTF-8', chkUrlSafe.checked);
            const wrap = parseInt(selWrap.value);
            if (wrap > 0 && res) {
                const matches = res.match(new RegExp(`.{1,${wrap}}`, 'g'));
                if (matches) res = matches.join('\n');
            }
            output.value = res;
            updateStats(input.value.length, res.length);
        };

        input.addEventListener('input', process);
        chkUrlSafe.addEventListener('change', process);
        selWrap.addEventListener('change', process);
    }

    // 10.3 Image Encoder
    function setupImageEncoderUI(container) {
        container.innerHTML = `
            <div class="grid" style="grid-template-columns: 1fr 1fr; gap:1.5rem;">
                <div>
                    <label class="pane-title">Unggah Gambar</label>
                    <div class="drop-zone" id="img-drop-zone">
                        <span class="drop-zone-icon">🖼️</span>
                        <span>Drag & Drop gambar di sini atau klik untuk memilih</span>
                        <input type="file" id="img-file-input" accept="image/*" style="display:none;">
                    </div>
                    <div id="img-options-area" style="margin-top:1rem; display:none;">
                        <h4 style="font-size:0.9rem;">Opsi Kompresi (Opsional)</h4>
                        <label>Max Lebar (px): <input type="number" id="img-max-w" placeholder="Lebar asli"></label>
                        <label>Max Tinggi (px): <input type="number" id="img-max-h" placeholder="Tinggi asli"></label>
                        <label>Kualitas (JPEG/WEBP): <input type="range" id="img-quality" min="1" max="100" value="85"></label>
                    </div>
                </div>
                <div>
                    <label class="pane-title">Hasil Base64 / Data URI</label>
                    <textarea id="img-output" class="pane-textarea" readonly placeholder="Output Base64 akan tampil di sini..."></textarea>
                    <div class="pane-actions" id="img-output-actions"></div>
                </div>
            </div>
            <div id="img-preview-box" style="margin-top: 1rem; display:none; text-align:center;">
                <label class="pane-title">Preview Gambar</label>
                <img id="img-preview" style="max-height:250px; border:1px solid var(--pico-muted-border-color); border-radius:8px;">
            </div>
        `;

        const dropZone = document.getElementById('img-drop-zone');
        const fileInput = document.getElementById('img-file-input');
        const output = document.getElementById('img-output');
        const preview = document.getElementById('img-preview');
        const previewBox = document.getElementById('img-preview-box');
        const optionsArea = document.getElementById('img-options-area');

        let loadedFile = null;

        dropZone.addEventListener('click', () => fileInput.click());
        fileInput.addEventListener('change', (e) => {
            if (e.target.files.length > 0) handleImageFile(e.target.files[0]);
        });
        
        dropZone.addEventListener('dragover', (e) => {
            e.preventDefault();
            dropZone.classList.add('dragover');
        });
        dropZone.addEventListener('dragleave', () => dropZone.classList.remove('dragover'));
        dropZone.addEventListener('drop', (e) => {
            e.preventDefault();
            dropZone.classList.remove('dragover');
            if (e.dataTransfer.files.length > 0) handleImageFile(e.dataTransfer.files[0]);
        });

        async function handleImageFile(file) {
            loadedFile = file;
            optionsArea.style.display = 'block';
            
            const w = document.getElementById('img-max-w').value;
            const h = document.getElementById('img-max-h').value;
            const q = document.getElementById('img-quality').value / 100;

            const res = await imageToBase64WithOptions(file, {
                maxWidth: w ? parseInt(w) : undefined,
                maxHeight: h ? parseInt(h) : undefined,
                quality: q
            });

            output.value = res.dataUri;
            preview.src = res.dataUri;
            previewBox.style.display = 'block';

            // Actions setup
            document.getElementById('img-output-actions').innerHTML = `
                <button class="btn-navy" id="btn-copy-img" style="margin-bottom:0;">📋 Salin</button>
            `;
            document.getElementById('btn-copy-img').addEventListener('click', () => {
                navigator.clipboard.writeText(output.value);
                window.TMPT_UI.toast('✓ Data URI gambar disalin!', 'success');
            });

            saveToHistory({
                name: `Encode Gambar: ${file.name}`,
                tool: 'image-to-base64',
                input_size: file.size,
                output_size: res.dataUri.length
            });
        }
    }

    // 10.4 Image Decoder
    function setupImageDecoderUI(container) {
        container.innerHTML = `
            <div class="grid" style="grid-template-columns: 1fr 1fr; gap:1.5rem;">
                <div>
                    <label class="pane-title">Input Base64 / Data URI Gambar</label>
                    <textarea id="img-dec-input" placeholder="Tempel Base64 gambar di sini..." class="pane-textarea"></textarea>
                </div>
                <div>
                    <label class="pane-title">Preview Gambar</label>
                    <div style="border: 1px solid var(--pico-muted-border-color); border-radius:12px; height:250px; display:flex; align-items:center; justify-content:center; overflow:hidden; background:#f8fafc;">
                        <img id="img-dec-preview" style="max-height:100%; max-width:100%; object-fit:contain; display:none;">
                        <span id="img-dec-placeholder" class="secondary">Preview gambar akan muncul di sini...</span>
                    </div>
                    <div class="pane-actions" id="img-dec-actions" style="margin-top:1rem; display:none;">
                        <button class="btn-navy" id="btn-download-img" style="margin-bottom:0;">💾 Unduh Gambar</button>
                    </div>
                </div>
            </div>
        `;

        const input = document.getElementById('img-dec-input');
        const img = document.getElementById('img-dec-preview');
        const placeholder = document.getElementById('img-dec-placeholder');
        const actions = document.getElementById('img-dec-actions');

        input.addEventListener('input', async () => {
            if (!input.value) {
                img.style.display = 'none';
                placeholder.style.display = 'block';
                actions.style.display = 'none';
                return;
            }

            try {
                const res = await decodeBase64ToImage(input.value);
                img.src = res.src;
                img.style.display = 'block';
                placeholder.style.display = 'none';
                actions.style.display = 'block';

                document.getElementById('btn-download-img').onclick = () => {
                    const a = document.createElement('a');
                    a.href = res.src;
                    a.download = `base64-decoded-${Date.now()}.png`;
                    a.click();
                };
            } catch (e) {
                placeholder.textContent = 'Error: Gagal mendekode gambar.';
                img.style.display = 'none';
                actions.style.display = 'none';
            }
        });
    }

    // 10.5 Hex to Base64
    function setupHexToBase64UI(container) {
        container.innerHTML = buildSplitPaneHTML('Hex Input', 'Base64 Output');
        setupCommonOutputActions();
        const input = document.getElementById('tool-input');
        const output = document.getElementById('tool-output');

        input.addEventListener('input', () => {
            try {
                output.value = hexToBase64(input.value);
                updateStats(input.value.length, output.value.length);
            } catch (e) {
                output.value = 'Error: ' + e.message;
            }
        });
    }

    // 10.6 Base64 to Hex
    function setupBase64ToHexUI(container) {
        container.innerHTML = `
            ${buildSplitPaneHTML('Base64 Input', 'HEX Output')}
            <div class="quick-converter-options" style="margin-top:1rem;">
                <label style="margin-bottom:0;">
                    Pemisah (Separator):
                    <select id="hex-sep" style="width:auto; margin-bottom:0; display:inline-block; padding:0.2rem 0.5rem; font-size:0.8rem; height:auto;">
                        <option value="">Tanpa Pemisah</option>
                        <option value=" ">Spasi</option>
                        <option value=":">Titik Dua (:)</option>
                    </select>
                </label>
                <label style="margin-bottom:0;">
                    <input type="checkbox" id="hex-upper" checked> Huruf Besar (UPPERCASE)
                </label>
            </div>
        `;
        setupCommonOutputActions();

        const input = document.getElementById('tool-input');
        const output = document.getElementById('tool-output');
        const sep = document.getElementById('hex-sep');
        const upper = document.getElementById('hex-upper');

        const process = () => {
            try {
                output.value = base64ToHex(input.value, sep.value, upper.checked);
                updateStats(input.value.length, output.value.length);
            } catch (e) {
                output.value = 'Error: ' + e.message;
            }
        };

        input.addEventListener('input', process);
        sep.addEventListener('change', process);
        upper.addEventListener('change', process);
    }

    // 10.7 Basic Auth Decode
    function setupBasicAuthDecodeUI(container) {
        container.innerHTML = `
            <div class="grid" style="grid-template-columns:1fr; gap:1.5rem;">
                <div>
                    <label class="pane-title">Input Header Basic Auth (atau string Base64)</label>
                    <input type="text" id="auth-input" placeholder="Basic dXNlcjpwYXNz atau dXNlcjpwYXNz">
                </div>
                <div id="auth-result-box" style="display:none; background: var(--pico-secondary-hover-background); padding:1rem; border-radius:8px;">
                    <h4>Credentials Terdecode:</h4>
                    <p><strong>Username:</strong> <code id="auth-user"></code></p>
                    <p><strong>Password:</strong> <code id="auth-pass" style="-webkit-text-security: disc;"></code> 
                        <button id="toggle-pass-btn" class="outline secondary" style="font-size:0.7rem; padding:0.2rem 0.5rem; margin-bottom:0; display:inline-block; width:auto; height:auto; margin-left:1rem;">Tampilkan</button>
                    </p>
                    <p style="color:var(--pico-form-element-invalid-border-color); font-size:0.8rem; font-weight:bold; margin-top:1rem;">
                        ⚠️ Peringatan: Jangan pernah menggunakan Basic Auth melalui protokol HTTP tanpa enkripsi HTTPS!
                    </p>
                </div>
            </div>
        `;

        const input = document.getElementById('auth-input');
        const box = document.getElementById('auth-result-box');
        const user = document.getElementById('auth-user');
        const pass = document.getElementById('auth-pass');
        const toggleBtn = document.getElementById('toggle-pass-btn');

        let showPassword = false;

        toggleBtn.addEventListener('click', () => {
            showPassword = !showPassword;
            pass.style.webkitTextSecurity = showPassword ? 'none' : 'disc';
            toggleBtn.textContent = showPassword ? 'Sembunyikan' : 'Tampilkan';
        });

        input.addEventListener('input', () => {
            if (!input.value) {
                box.style.display = 'none';
                return;
            }

            try {
                const creds = decodeBasicAuth(input.value);
                if (creds) {
                    user.textContent = creds.username;
                    pass.textContent = creds.password;
                    box.style.display = 'block';
                }
            } catch (e) {
                user.textContent = 'Error';
                pass.textContent = e.message;
                box.style.display = 'block';
            }
        });
    }

    // 10.8 URL to Base64
    function setupUrlToBase64UI(container) {
        container.innerHTML = buildSplitPaneHTML('URL Input', 'Base64 Output');
        setupCommonOutputActions();
        const input = document.getElementById('tool-input');
        const output = document.getElementById('tool-output');

        input.addEventListener('input', () => {
            try {
                output.value = encodeURLToBase64(input.value);
            } catch (e) {
                output.value = 'Error: ' + e.message;
            }
        });
    }

    // 10.9 HTML to Base64
    function setupHtmlToBase64UI(container) {
        container.innerHTML = `
            ${buildSplitPaneHTML('HTML Input', 'Base64 Output')}
            <div id="html-iframe-snippet" style="margin-top:1rem; display:none;">
                <label class="pane-title">Iframe Embed Code</label>
                <textarea id="iframe-code" class="pane-textarea" style="min-height:80px;" readonly></textarea>
            </div>
        `;
        setupCommonOutputActions();
        const input = document.getElementById('tool-input');
        const output = document.getElementById('tool-output');
        const iframeBox = document.getElementById('html-iframe-snippet');
        const iframeCode = document.getElementById('iframe-code');

        input.addEventListener('input', () => {
            const res = encodeHTMLToBase64(input.value);
            output.value = res.dataUri;
            if (res.iframeCode) {
                iframeBox.style.display = 'block';
                iframeCode.value = res.iframeCode;
            } else {
                iframeBox.style.display = 'none';
            }
        });
    }

    // 10.10 Validate Base64
    function setupValidateUI(container) {
        container.innerHTML = `
            <div class="grid" style="grid-template-columns:1fr; gap:1.5rem;">
                <div>
                    <label class="pane-title">Input Base64 String yang akan Divalidasi</label>
                    <textarea id="val-input" placeholder="Tempel string Base64 di sini..." class="pane-textarea"></textarea>
                </div>
                <div id="val-result-box" style="display:none; background: var(--pico-secondary-hover-background); padding:1.25rem; border-radius:12px;">
                    <div style="display:flex; align-items:center; gap:0.5rem; margin-bottom:1rem;">
                        <span id="val-badge" style="padding:0.25rem 0.75rem; border-radius:20px; font-weight:bold; font-size:0.85rem;"></span>
                    </div>
                    <p><strong>Panjang String:</strong> <span id="val-length"></span> karakter</p>
                    <p><strong>Status Padding:</strong> <span id="val-padding"></span></p>
                    <p><strong>Estimasi Hasil Decode:</strong> <span id="val-bytes"></span> byte</p>
                    <div id="val-issues-box" style="margin-top:1rem; display:none;">
                        <strong style="color:var(--pico-form-element-invalid-border-color);">Isu yang Ditemukan:</strong>
                        <ul id="val-issues-list" style="margin-top:0.5rem; font-size:0.85rem;"></ul>
                    </div>
                </div>
            </div>
        `;

        const input = document.getElementById('val-input');
        const box = document.getElementById('val-result-box');
        const badge = document.getElementById('val-badge');
        const len = document.getElementById('val-length');
        const pad = document.getElementById('val-padding');
        const bytes = document.getElementById('val-bytes');
        const issuesBox = document.getElementById('val-issues-box');
        const issuesList = document.getElementById('val-issues-list');

        input.addEventListener('input', () => {
            if (!input.value) {
                box.style.display = 'none';
                return;
            }

            const rep = validateBase64(input.value);
            len.textContent = rep.length;
            pad.textContent = rep.paddingStatus;
            bytes.textContent = rep.estimatedBytes;

            if (rep.isValid) {
                badge.textContent = '✅ Valid';
                badge.style.backgroundColor = 'rgba(34, 197, 94, 0.1)';
                badge.style.color = '#22c55e';
                issuesBox.style.display = 'none';
            } else {
                badge.textContent = '❌ Tidak Valid';
                badge.style.backgroundColor = 'rgba(239, 68, 68, 0.1)';
                badge.style.color = '#ef4444';
                
                issuesList.innerHTML = rep.issues.map(i => `<li>${i}</li>`).join('');
                issuesBox.style.display = 'block';
            }
            box.style.display = 'block';
        });
    }

    // 10.11 Normalize Base64
    function setupNormalizeUI(container) {
        container.innerHTML = `
            ${buildSplitPaneHTML('Input Base64', 'Normalized Output')}
            <div class="quick-converter-options" style="margin-top:1rem;">
                <label style="margin-bottom:0;"><input type="checkbox" id="norm-safe"> Jadikan URL-safe</label>
                <label style="margin-bottom:0;"><input type="checkbox" id="norm-pad" checked> Perbaiki Padding</label>
                <label style="margin-bottom:0;">
                    Wrap Line:
                    <select id="norm-wrap" style="width:auto; margin-bottom:0; display:inline-block; padding:0.2rem 0.5rem; font-size:0.8rem; height:auto;">
                        <option value="0">None</option>
                        <option value="64">64</option>
                        <option value="76">76</option>
                    </select>
                </label>
            </div>
        `;
        setupCommonOutputActions();

        const input = document.getElementById('tool-input');
        const output = document.getElementById('tool-output');
        const safe = document.getElementById('norm-safe');
        const pad = document.getElementById('norm-pad');
        const wrap = document.getElementById('norm-wrap');

        const process = () => {
            output.value = normalizeBase64(input.value, {
                urlSafe: safe.checked,
                addPadding: pad.checked,
                lineWrap: parseInt(wrap.value)
            });
        };

        input.addEventListener('input', process);
        safe.addEventListener('change', process);
        pad.addEventListener('change', process);
        wrap.addEventListener('change', process);
    }

    // 10.12 Repair Base64
    function setupRepairUI(container) {
        container.innerHTML = `
            <div class="grid" style="grid-template-columns:1fr 1fr; gap:1.5rem;">
                <div>
                    <label class="pane-title">Input Base64 Rusak</label>
                    <textarea id="rep-input" placeholder="Tempel Base64 yang rusak di sini..." class="pane-textarea"></textarea>
                </div>
                <div>
                    <label class="pane-title">Hasil Repair</label>
                    <textarea id="rep-output" readonly class="pane-textarea"></textarea>
                    <div id="rep-log" style="margin-top:0.5rem; font-size:0.8rem; background:rgba(0,0,0,0.02); padding:0.5rem; border-radius:6px; max-height:80px; overflow-y:auto;"></div>
                </div>
            </div>
        `;

        const input = document.getElementById('rep-input');
        const output = document.getElementById('rep-output');
        const log = document.getElementById('rep-log');

        input.addEventListener('input', () => {
            if (!input.value) {
                output.value = '';
                log.innerHTML = '';
                return;
            }
            const res = repairBase64(input.value);
            output.value = res.repaired;
            log.innerHTML = `<strong>Tindakan Perbaikan:</strong><br>${res.repairs.length > 0 ? res.repairs.map(r => `&bull; ${r}`).join('<br>') : 'Tidak ada tindakan perbaikan dibutuhkan.'}`;
        });
    }

    // 10.13 Encoding Detect
    function setupEncodingDetectUI(container) {
        container.innerHTML = `
            <div class="grid" style="grid-template-columns:1fr 1fr; gap:1.5rem;">
                <div>
                    <label class="pane-title">Input String Base64</label>
                    <textarea id="enc-input" placeholder="Tempel Base64 untuk mendeteksi encoding teks hasilnya..." class="pane-textarea"></textarea>
                </div>
                <div>
                    <label class="pane-title">Hasil Deteksi Encoding</label>
                    <table id="enc-table" style="font-size:0.85rem; display:none;">
                        <thead>
                            <tr>
                                <th>Charset</th>
                                <th>Confidence</th>
                                <th>Keterangan</th>
                            </tr>
                        </thead>
                        <tbody id="enc-tbody"></tbody>
                    </table>
                    <div id="enc-placeholder" class="secondary" style="padding:2rem; text-align:center;">
                        Masukkan string Base64 di panel kiri
                    </div>
                </div>
            </div>
        `;

        const input = document.getElementById('enc-input');
        const table = document.getElementById('enc-table');
        const tbody = document.getElementById('enc-tbody');
        const placeholder = document.getElementById('enc-placeholder');

        input.addEventListener('input', () => {
            if (!input.value) {
                table.style.display = 'none';
                placeholder.style.display = 'block';
                return;
            }

            try {
                const binary = atob(input.value.replace(/\s/g, '').replace(/-/g, '+').replace(/_/g, '/'));
                const bytes = Uint8Array.from(binary, c => c.charCodeAt(0));
                const candidates = detectEncoding(bytes);

                tbody.innerHTML = candidates.map(c => `
                    <tr>
                        <td><strong>${c.charset}</strong></td>
                        <td>${c.confidence}%</td>
                        <td>${c.note}</td>
                    </tr>
                `).join('');
                
                table.style.display = 'table';
                placeholder.style.display = 'none';
            } catch (e) {
                placeholder.innerHTML = `<span style="color:var(--pico-form-element-invalid-border-color);">Error: Gagal mendekode Base64. ${e.message}</span>`;
                table.style.display = 'none';
                placeholder.style.display = 'block';
            }
        });
    }

    // 10.14 Standard Detect
    function setupStandardDetectUI(container) {
        container.innerHTML = `
            <div class="grid" style="grid-template-columns:1fr 1fr; gap:1.5rem;">
                <div>
                    <label class="pane-title">Input Base64</label>
                    <textarea id="std-input" placeholder="Tempel Base64 di sini..." class="pane-textarea"></textarea>
                </div>
                <div>
                    <label class="pane-title">Deteksi Standar</label>
                    <div id="std-result-box" style="background:var(--pico-secondary-hover-background); padding:1rem; border-radius:8px; display:none;">
                        <ul id="std-list" style="margin:0; padding-left:1rem; font-size:0.9rem;"></ul>
                    </div>
                </div>
            </div>
        `;

        const input = document.getElementById('std-input');
        const box = document.getElementById('std-result-box');
        const list = document.getElementById('std-list');

        input.addEventListener('input', () => {
            if (!input.value) {
                box.style.display = 'none';
                return;
            }

            const standards = detectBase64Standard(input.value);
            if (standards.length > 0) {
                list.innerHTML = standards.map(s => `<li><strong>${s.standard}</strong> (Keyakinan: ${s.confidence}%)</li>`).join('');
                box.style.display = 'block';
            } else {
                list.innerHTML = '<li>Tidak ada standar Base64/32/62 yang cocok terdeteksi secara pasti.</li>';
                box.style.display = 'block';
            }
        });
    }

    // 10.15 Gzip Check
    function setupGzipCheckUI(container) {
        container.innerHTML = `
            <div class="grid" style="grid-template-columns:1fr 1fr; gap:1.5rem;">
                <div>
                    <label class="pane-title">Input Base64 Gzip</label>
                    <textarea id="gzip-input" placeholder="Tempel Base64 terkompresi gzip di sini..." class="pane-textarea"></textarea>
                </div>
                <div>
                    <label class="pane-title">Laporan Gzip & Hasil Decompress</label>
                    <div id="gzip-report" style="margin-bottom:1rem; background:rgba(0,0,0,0.02); padding:0.75rem; border-radius:6px; display:none; font-size:0.85rem;"></div>
                    <textarea id="gzip-output" readonly placeholder="Konten hasil decompress..." class="pane-textarea" style="display:none;"></textarea>
                </div>
            </div>
        `;

        const input = document.getElementById('gzip-input');
        const report = document.getElementById('gzip-report');
        const output = document.getElementById('gzip-output');

        input.addEventListener('input', async () => {
            if (!input.value) {
                report.style.display = 'none';
                output.style.display = 'none';
                return;
            }

            const res = await checkAndDecompressGzip(input.value);
            if (res.isGzip) {
                report.innerHTML = `
                    <span style="color:#22c55e; font-weight:bold;">✅ Gzip Terdeteksi</span><br>
                    Ukuran Asli Gzip: ${res.originalSize} byte<br>
                    Ukuran Hasil Dekompresi: ${res.decompressedSize} byte<br>
                    Rasio Kompresi: ${res.ratio}
                `;
                output.value = res.content;
                output.style.display = 'block';
            } else {
                report.innerHTML = `<span style="color:#ef4444; font-weight:bold;">❌ Gzip Tidak Terdeteksi</span><br>${res.message}`;
                output.style.display = 'none';
            }
            report.style.display = 'block';
        });
    }

    // 10.16 UUencoded Decode
    function setupUUencodedDecodeUI(container) {
        container.innerHTML = `
            <div class="grid" style="grid-template-columns: 1fr 1fr; gap:1.5rem;">
                <div>
                    <label class="pane-title">Input UUencoded Text</label>
                    <textarea id="uu-input" placeholder="begin 644 file.txt\\n...\\nend" class="pane-textarea"></textarea>
                </div>
                <div>
                    <label class="pane-title">Output File</label>
                    <div id="uu-result" style="display:none; background: var(--pico-secondary-hover-background); padding:1rem; border-radius:8px;">
                        <p><strong>Nama File:</strong> <span id="uu-filename"></span></p>
                        <p><strong>Ukuran Data:</strong> <span id="uu-size"></span> byte</p>
                        <button class="btn-navy" id="uu-download-btn">💾 Unduh File</button>
                    </div>
                </div>
            </div>
        `;

        const input = document.getElementById('uu-input');
        const result = document.getElementById('uu-result');
        const filename = document.getElementById('uu-filename');
        const size = document.getElementById('uu-size');
        const downloadBtn = document.getElementById('uu-download-btn');

        input.addEventListener('input', () => {
            if (!input.value) {
                result.style.display = 'none';
                return;
            }

            try {
                const res = decodeUUencoded(input.value);
                filename.textContent = res.filename;
                size.textContent = res.data.length;
                result.style.display = 'block';

                downloadBtn.onclick = () => {
                    const blob = new Blob([res.data], { type: 'application/octet-stream' });
                    const url = URL.createObjectURL(blob);
                    const a = document.createElement('a');
                    a.href = url;
                    a.download = res.filename;
                    a.click();
                    URL.revokeObjectURL(url);
                };
            } catch (e) {
                filename.textContent = 'Error';
                size.textContent = e.message;
                result.style.display = 'block';
            }
        });
    }

    // 10.17 CSS Data URI
    function setupCssDataUriUI(container) {
        container.innerHTML = `
            <div class="grid" style="grid-template-columns: 1fr 1fr; gap:1.5rem;">
                <div>
                    <label class="pane-title">Unggah Aset (Gambar atau Font)</label>
                    <div class="drop-zone" id="css-drop-zone">
                        <span class="drop-zone-icon">🎨</span>
                        <span>Drag & Drop file gambar/font di sini</span>
                        <input type="file" id="css-file-input" style="display:none;">
                    </div>
                </div>
                <div>
                    <label class="pane-title">CSS Snippet Output</label>
                    <textarea id="css-output" readonly class="pane-textarea" placeholder="CSS snippet akan muncul di sini..."></textarea>
                    <div class="pane-actions" id="css-output-actions"></div>
                </div>
            </div>
        `;

        const dropZone = document.getElementById('css-drop-zone');
        const fileInput = document.getElementById('css-file-input');
        const output = document.getElementById('css-output');
        const actions = document.getElementById('css-output-actions');

        dropZone.addEventListener('click', () => fileInput.click());
        fileInput.addEventListener('change', (e) => {
            if (e.target.files.length > 0) handleCssFile(e.target.files[0]);
        });

        async function handleCssFile(file) {
            const res = await fileToBase64(file);
            const cssRes = convertToCSSDataURI(res.base64, res.mimeType, file.name);
            output.value = cssRes.cssSnippet;

            actions.innerHTML = `<button class="btn-navy" id="btn-copy-css">📋 Salin Snippet</button>`;
            document.getElementById('btn-copy-css').onclick = () => {
                navigator.clipboard.writeText(output.value);
                window.TMPT_UI.toast('✓ Snippet CSS disalin!', 'success');
            };
        }
    }

    // 10.18 Data URI to Image
    function setupDataUriToImageUI(container) {
        container.innerHTML = `
            <div class="grid" style="grid-template-columns: 1fr 1fr; gap:1.5rem;">
                <div>
                    <label class="pane-title">Masukkan Data URI</label>
                    <textarea id="uri-input" placeholder="data:image/png;base64,..." class="pane-textarea"></textarea>
                </div>
                <div>
                    <label class="pane-title">Preview Gambar</label>
                    <div style="border:1px solid var(--pico-muted-border-color); border-radius:12px; height:250px; display:flex; align-items:center; justify-content:center; background:#fff;">
                        <img id="uri-preview" style="max-height:100%; max-width:100%; object-fit:contain; display:none;">
                        <span id="uri-placeholder" class="secondary">Preview gambar...</span>
                    </div>
                </div>
            </div>
        `;

        const input = document.getElementById('uri-input');
        const img = document.getElementById('uri-preview');
        const placeholder = document.getElementById('uri-placeholder');

        input.addEventListener('input', () => {
            if (!input.value) {
                img.style.display = 'none';
                placeholder.style.display = 'block';
                return;
            }

            try {
                const parsed = parseDataUri(input.value);
                if (parsed.mimeType.startsWith('image/')) {
                    img.src = input.value;
                    img.style.display = 'block';
                    placeholder.style.display = 'none';
                } else {
                    placeholder.textContent = 'MIME type terdeteksi bukan gambar: ' + parsed.mimeType;
                    img.style.display = 'none';
                }
            } catch (e) {
                placeholder.textContent = 'Format Data URI tidak valid.';
                img.style.display = 'none';
            }
        });
    }

    // 10.19 Base64 to PDF
    function setupBase64ToPdfUI(container) {
        container.innerHTML = `
            <div class="grid" style="grid-template-columns: 1.2fr 2fr; gap:1.5rem;">
                <div>
                    <label class="pane-title">Base64 PDF Input</label>
                    <textarea id="pdf-input" placeholder="Tempel Base64 PDF di sini..." class="pane-textarea" style="min-height:220px;"></textarea>
                    <div style="margin-top:1rem;">
                        <button class="btn-navy w-100" id="btn-render-pdf" disabled>Render Preview</button>
                    </div>
                </div>
                <div>
                    <label class="pane-title">Preview PDF</label>
                    <div class="pdf-preview-container" id="pdf-view-container" style="display:none; text-align:center;">
                        <div style="display:flex; justify-content:space-between; align-items:center; background:#111; padding:0.25rem 0.5rem; color:#fff; font-size:0.85rem; border-top-left-radius:8px; border-top-right-radius:8px;">
                            <button id="pdf-prev" class="outline secondary" style="margin-bottom:0; font-size:0.75rem; padding:0.2rem 0.5rem; color:#fff;">&larr; Prev</button>
                            <span>Halaman <span id="pdf-page-num">1</span> dari <span id="pdf-page-count">-</span></span>
                            <button id="pdf-next" class="outline secondary" style="margin-bottom:0; font-size:0.75rem; padding:0.2rem 0.5rem; color:#fff;">Next &rarr;</button>
                        </div>
                        <canvas id="pdf-canvas" style="background:#fff; width:100%; border-bottom-left-radius:8px; border-bottom-right-radius:8px;"></canvas>
                    </div>
                    <div id="pdf-placeholder" class="secondary" style="border:1px dashed var(--pico-muted-border-color); border-radius:8px; padding:4rem; text-align:center;">
                        Masukkan Base64 di panel kiri dan klik Render Preview
                    </div>
                </div>
            </div>
        `;

        const input = document.getElementById('pdf-input');
        const btnRender = document.getElementById('btn-render-pdf');
        const containerView = document.getElementById('pdf-view-container');
        const canvas = document.getElementById('pdf-canvas');
        const placeholder = document.getElementById('pdf-placeholder');
        const prevBtn = document.getElementById('pdf-prev');
        const nextBtn = document.getElementById('pdf-next');
        const pageNumSpan = document.getElementById('pdf-page-num');
        const pageCountSpan = document.getElementById('pdf-page-count');

        let pdfDoc = null;
        let pageNum = 1;
        let pageRendering = false;
        let pageNumPending = null;
        const ctx = canvas.getContext('2d');

        input.addEventListener('input', () => {
            btnRender.disabled = !input.value;
        });

        btnRender.addEventListener('click', async () => {
            placeholder.textContent = 'Memuat dan me-render PDF...';
            try {
                pdfDoc = await decodeBase64ToPDF(input.value);
                pageCountSpan.textContent = pdfDoc.numPages;
                pageNum = 1;
                renderPage(pageNum);

                placeholder.style.display = 'none';
                containerView.style.display = 'block';
            } catch (e) {
                placeholder.innerHTML = `<span style="color:#ef4444;">Error: Gagal memuat PDF. ${e.message}</span>`;
                containerView.style.display = 'none';
            }
        });

        function renderPage(num) {
            pageRendering = true;
            pdfDoc.getPage(num).then(page => {
                const viewport = page.getViewport({ scale: 1.5 });
                canvas.height = viewport.height;
                canvas.width = viewport.width;

                const renderContext = {
                    canvasContext: ctx,
                    viewport: viewport
                };
                const renderTask = page.render(renderContext);

                renderTask.promise.then(() => {
                    pageRendering = false;
                    if (pageNumPending !== null) {
                        renderPage(pageNumPending);
                        pageNumPending = null;
                    }
                });
            });

            pageNumSpan.textContent = num;
        }

        function queueRenderPage(num) {
            if (pageRendering) {
                pageNumPending = num;
            } else {
                renderPage(num);
            }
        }

        prevBtn.addEventListener('click', () => {
            if (pageNum <= 1) return;
            pageNum--;
            queueRenderPage(pageNum);
        });

        nextBtn.addEventListener('click', () => {
            if (pageNum >= pdfDoc.numPages) return;
            pageNum++;
            queueRenderPage(pageNum);
        });
    }

    // 10.20 Generic File Encoder UI (Audio / Video / PDF / Any File)
    function setupGenericFileEncoderUI(container, toolId) {
        container.innerHTML = `
            <div class="grid" style="grid-template-columns: 1fr 1fr; gap:1.5rem;">
                <div>
                    <label class="pane-title">Pilih File</label>
                    <div class="drop-zone" id="file-drop-zone">
                        <span class="drop-zone-icon">📁</span>
                        <span>Drag & Drop file di sini atau klik untuk memilih</span>
                        <input type="file" id="file-input-el" style="display:none;">
                    </div>
                    <div id="file-meta-box" style="margin-top:1rem; display:none; background:var(--pico-secondary-hover-background); padding:0.75rem; border-radius:8px;">
                        <p style="margin:0; font-size:0.85rem;"><strong>File:</strong> <span id="meta-name"></span> (<span id="meta-size"></span> byte)</p>
                    </div>
                </div>
                <div>
                    <label class="pane-title">Output Base64</label>
                    <textarea id="file-output" readonly class="pane-textarea" placeholder="Output Base64 akan tampil di sini..."></textarea>
                    <div class="pane-actions" id="file-actions"></div>
                </div>
            </div>
        `;

        const dropZone = document.getElementById('file-drop-zone');
        const fileInput = document.getElementById('file-input-el');
        const output = document.getElementById('file-output');
        const metaBox = document.getElementById('file-meta-box');
        const metaName = document.getElementById('meta-name');
        const metaSize = document.getElementById('meta-size');
        const actions = document.getElementById('file-actions');

        dropZone.addEventListener('click', () => fileInput.click());
        fileInput.addEventListener('change', (e) => {
            if (e.target.files.length > 0) handleFile(e.target.files[0]);
        });

        async function handleFile(file) {
            metaName.textContent = file.name;
            metaSize.textContent = file.size.toLocaleString();
            metaBox.style.display = 'block';

            const res = await fileToBase64(file);
            output.value = res.dataUri;

            actions.innerHTML = `
                <button class="btn-navy" id="btn-copy-file">📋 Salin</button>
            `;
            document.getElementById('btn-copy-file').onclick = () => {
                navigator.clipboard.writeText(output.value);
                window.TMPT_UI.toast('✓ Output Base64 disalin!', 'success');
            };

            saveToHistory({
                name: `Encode File: ${file.name}`,
                tool: toolId,
                input_size: file.size,
                output_size: res.dataUri.length
            });
        }
    }

    // 10.21 Base64 to File
    function setupGenericFileDecoderUI(container) {
        container.innerHTML = `
            <div class="grid" style="grid-template-columns: 1fr 1fr; gap:1.5rem;">
                <div>
                    <label class="pane-title">Input Base64</label>
                    <textarea id="bin-input" placeholder="Tempel Base64 string di sini..." class="pane-textarea"></textarea>
                </div>
                <div>
                    <label class="pane-title">File Hasil Dekode</label>
                    <div id="bin-result-box" style="display:none; background:var(--pico-secondary-hover-background); padding:1rem; border-radius:8px;">
                        <p><strong>Deteksi Format:</strong> <span id="bin-mime"></span></p>
                        <button class="btn-navy" id="btn-download-bin">💾 Unduh File</button>
                    </div>
                </div>
            </div>
        `;

        const input = document.getElementById('bin-input');
        const box = document.getElementById('bin-result-box');
        const mimeSpan = document.getElementById('bin-mime');
        const downloadBtn = document.getElementById('btn-download-bin');

        input.addEventListener('input', () => {
            if (!input.value) {
                box.style.display = 'none';
                return;
            }

            try {
                const clean = input.value.replace(/\s/g, '').split(',').pop();
                const binary = atob(clean);
                const bytes = new Uint8Array(binary.length);
                for (let i = 0; i < binary.length; i++) {
                    bytes[i] = binary.charCodeAt(i);
                }

                const fileInfo = detectMimeFromBytes(bytes);
                mimeSpan.textContent = `${fileInfo.mime} (.${fileInfo.ext})`;
                box.style.display = 'block';

                downloadBtn.onclick = () => {
                    const blob = new Blob([bytes], { type: fileInfo.mime });
                    const url = URL.createObjectURL(blob);
                    const a = document.createElement('a');
                    a.href = url;
                    a.download = `base64-decoded-${Date.now()}.${fileInfo.ext}`;
                    a.click();
                    URL.revokeObjectURL(url);
                };
            } catch (e) {
                mimeSpan.textContent = 'Gagal mendeteksi. Data tidak valid: ' + e.message;
                box.style.display = 'block';
            }
        });
    }

    // 10.22 Base64 to Audio
    function setupBase64ToAudioUI(container) {
        container.innerHTML = `
            <div class="grid" style="grid-template-columns: 1fr 1fr; gap:1.5rem;">
                <div>
                    <label class="pane-title">Input Base64 Audio</label>
                    <textarea id="aud-input" placeholder="Tempel Base64 audio di sini..." class="pane-textarea"></textarea>
                </div>
                <div>
                    <label class="pane-title">Player Audio</label>
                    <div id="aud-player-container" style="display:none; text-align:center;">
                        <audio id="aud-player" controls style="width:100%; margin-bottom:1rem;"></audio>
                        <button class="outline secondary" id="aud-download-btn">💾 Unduh Audio</button>
                    </div>
                </div>
            </div>
        `;

        const input = document.getElementById('aud-input');
        const playerContainer = document.getElementById('aud-player-container');
        const player = document.getElementById('aud-player');
        const downloadBtn = document.getElementById('aud-download-btn');

        input.addEventListener('input', () => {
            if (!input.value) {
                playerContainer.style.display = 'none';
                return;
            }

            try {
                let mime = 'audio/mp3';
                if (input.value.startsWith('data:')) {
                    const match = input.value.match(/^data:([^;]+)/);
                    if (match) mime = match[1];
                }
                const url = decodeBase64ToAudio(input.value, mime);
                player.src = url;
                playerContainer.style.display = 'block';

                downloadBtn.onclick = () => {
                    const a = document.createElement('a');
                    a.href = url;
                    a.download = `base64-audio-${Date.now()}.mp3`;
                    a.click();
                };
            } catch (e) {
                playerContainer.style.display = 'none';
            }
        });
    }

    // 10.23 Base64 to Video
    function setupBase64ToVideoUI(container) {
        container.innerHTML = `
            <div class="grid" style="grid-template-columns: 1fr 1.5fr; gap:1.5rem;">
                <div>
                    <label class="pane-title">Input Base64 Video</label>
                    <textarea id="vid-input" placeholder="Tempel Base64 video di sini..." class="pane-textarea"></textarea>
                </div>
                <div>
                    <label class="pane-title">Player Video</label>
                    <div id="vid-player-container" style="display:none; text-align:center;">
                        <video id="vid-player" controls style="width:100%; max-height:300px; margin-bottom:1rem; border-radius:8px; background:#000;"></video>
                        <button class="outline secondary" id="vid-download-btn">💾 Unduh Video</button>
                    </div>
                </div>
            </div>
        `;

        const input = document.getElementById('vid-input');
        const playerContainer = document.getElementById('vid-player-container');
        const player = document.getElementById('vid-player');
        const downloadBtn = document.getElementById('vid-download-btn');

        input.addEventListener('input', () => {
            if (!input.value) {
                playerContainer.style.display = 'none';
                return;
            }

            try {
                let mime = 'video/mp4';
                if (input.value.startsWith('data:')) {
                    const match = input.value.match(/^data:([^;]+)/);
                    if (match) mime = match[1];
                }
                const url = decodeBase64ToVideo(input.value, mime);
                player.src = url;
                playerContainer.style.display = 'block';

                downloadBtn.onclick = () => {
                    const a = document.createElement('a');
                    a.href = url;
                    a.download = `base64-video-${Date.now()}.mp4`;
                    a.click();
                };
            } catch (e) {
                playerContainer.style.display = 'none';
            }
        });
    }

    // 10.24 HTTP Auth Request Simulator
    function setupBasicAuthSimulatorUI(container) {
        container.innerHTML = `
            <div class="grid" style="grid-template-columns: 1fr 1.2fr; gap:1.5rem;">
                <div>
                    <label class="pane-title">Kredensial Basic Auth</label>
                    <label>Username: <input type="text" id="sim-user" placeholder="admin"></label>
                    <label>Password: <input type="password" id="sim-pass" placeholder="password"></label>
                    <button class="btn-navy" id="btn-sim-gen" style="margin-top:0.5rem;">Simulasikan Header HTTP</button>
                </div>
                <div>
                    <label class="pane-title">HTTP Request Headers Mockup</label>
                    <textarea id="sim-output" readonly class="pane-textarea" style="min-height:180px;"></textarea>
                    <div class="pane-actions" id="sim-actions"></div>
                </div>
            </div>
        `;

        const user = document.getElementById('sim-user');
        const pass = document.getElementById('sim-pass');
        const output = document.getElementById('sim-output');
        const btnGen = document.getElementById('btn-sim-gen');
        const actions = document.getElementById('sim-actions');

        btnGen.onclick = () => {
            const username = user.value || 'admin';
            const password = pass.value || 'password';
            const authHeader = encodeBasicAuth(username, password);

            output.value = `GET /api/v1/resource HTTP/1.1\nHost: api.tmpt.my.id\nAuthorization: ${authHeader}\nAccept: application/json\nUser-Agent: TMPT-HTTP-Simulator/1.0`;

            actions.innerHTML = `<button class="btn-navy" id="btn-sim-copy">📋 Salin Header</button>`;
            document.getElementById('btn-sim-copy').onclick = () => {
                navigator.clipboard.writeText(authHeader);
                window.TMPT_UI.toast('✓ Header Authorization disalin!', 'success');
            };
        };
    }

    // 11. Global Search Actions
    if (searchInput) {
        searchInput.addEventListener('input', (e) => {
            searchQuery = e.target.value;
            if (activeTool === 'dashboard') {
                renderDashboardToolsGrid();
            }
        });
    }

    if (sidebarSearch) {
        sidebarSearch.addEventListener('input', (e) => {
            sidebarSearchQuery = e.target.value;
            renderSidebar();
        });
    }

    // 12. Hotkeys / Keyboard Shortcuts
    document.addEventListener('keydown', (e) => {
        // Ctrl+Enter = Process/Run
        if (e.ctrlKey && e.key === 'Enter') {
            e.preventDefault();
            const processBtn = document.getElementById('btn-render-pdf') || 
                               document.getElementById('btn-sim-gen') || 
                               document.getElementById('quick-encode-btn');
            if (processBtn && !processBtn.disabled) processBtn.click();
        }

        // Ctrl+C = Copy Output
        if (e.ctrlKey && e.key === 'c' && !window.getSelection().toString()) {
            const copyBtn = document.getElementById('btn-copy-out') || 
                            document.getElementById('btn-copy-img') || 
                            document.getElementById('btn-copy-css') ||
                            document.getElementById('quick-copy-btn');
            if (copyBtn) {
                e.preventDefault();
                copyBtn.click();
            }
        }

        // Ctrl+Shift+C = Clear Input
        if (e.ctrlKey && e.shiftKey && e.key === 'C') {
            e.preventDefault();
            const clearBtn = document.getElementById('quick-clear-btn');
            if (clearBtn) clearBtn.click();
            const toolInput = document.getElementById('tool-input');
            if (toolInput) toolInput.value = '';
        }

        // Ctrl+S = Download Output
        if (e.ctrlKey && e.key === 's') {
            e.preventDefault();
            const dlBtn = document.getElementById('btn-download-out') || 
                          document.getElementById('btn-download-img') || 
                          document.getElementById('btn-download-bin');
            if (dlBtn) dlBtn.click();
        }
    });

    document.addEventListener('tmpt:sidebar-toggle', (e) => {
        e.preventDefault();
        const layout = document.querySelector('.base64-layout');
        const sidebar = document.querySelector('.tool-sidebar');
        if (layout && sidebar) {
            layout.classList.toggle('sidebar-collapsed');
            sidebar.classList.toggle('collapsed');
        }
    });

    // 13. Parse URL Parameter on Load
    const params = new URLSearchParams(window.location.search);
    const initialTool = params.get('tool');
    if (initialTool && TOOLS.some(t => t.id === initialTool)) {
        activeTool = initialTool;
    } else {
        activeTool = 'dashboard';
    }

    // Initial render
    renderSidebar();
    renderActiveWorkspace();
});
