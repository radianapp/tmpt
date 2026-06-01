/**
 * TMPT Feedback Widget Module
 * Implements bug reporting and idea suggestion with automated metadata and local screen capture.
 */

(function () {
    const WIDGET_CONFIG = {
        formspreeEndpointBug: 'https://formspree.io/f/xaqkgonj',
        formspreeEndpointIdea: 'https://formspree.io/f/xaqkgonj',
        appVersion: '1.2.3',
        screenshotMaxBytes: 400 * 1024, // 400KB
        screenshotQuality: 0.35,
        screenshotMaxWidth: 800,
        cooldownMs: 30000 // 30 seconds
    };

    let currentScreenshotBase64 = null;
    let isCapturingScreenshot = false;

    // Load CSS dynamically
    function loadCSS() {
        if (!document.getElementById('tmpt-feedback-style')) {
            const link = document.createElement('link');
            link.id = 'tmpt-feedback-style';
            link.rel = 'stylesheet';
            link.href = '/app/feedback/feedback-widget.css';
            document.head.appendChild(link);
        }
    }

    // Load html2canvas dynamically if not loaded
    async function loadHtml2Canvas() {
        if (window.html2canvas) return window.html2canvas;
        return new Promise((resolve, reject) => {
            const script = document.createElement('script');
            script.src = '/app/feedback/vendor/html2canvas.min.js';
            script.defer = true;
            script.onload = () => resolve(window.html2canvas);
            script.onerror = () => reject(new Error('Gagal memuat html2canvas'));
            document.head.appendChild(script);
        });
    }

    // Initialize Widget HTML
    function createWidgetDialog() {
        let dialog = document.getElementById('tmpt-feedback-dialog');
        if (!dialog) {
            dialog = document.createElement('dialog');
            dialog.id = 'tmpt-feedback-dialog';
            document.body.appendChild(dialog);
        }
        return dialog;
    }

    // Check Cooldown
    function checkCooldown() {
        const lastSubmit = localStorage.getItem('tmpt_feedback_last_submit');
        if (lastSubmit) {
            const elapsed = Date.now() - parseInt(lastSubmit, 10);
            if (elapsed < WIDGET_CONFIG.cooldownMs) {
                return Math.ceil((WIDGET_CONFIG.cooldownMs - elapsed) / 1000);
            }
        }
        return 0;
    }

    // Collect Metadata
    function collectMetadata() {
        const now = new Date();
        const formatter = new Intl.DateTimeFormat('id-ID', {
            dateStyle: 'medium',
            timeStyle: 'medium',
            timeZone: 'Asia/Jakarta'
        });
        const timestampWIB = formatter.format(now) + ' WIB';
        const viewportWidth = window.innerWidth;
        const viewportHeight = window.innerHeight;
        const screenWidth = window.screen.width;
        const screenHeight = window.screen.height;
        const devicePixelRatio = window.devicePixelRatio || 1;

        return `=== TMPT FEEDBACK METADATA ===
Timestamp   : ${timestampWIB}
URL         : ${window.location.href}
Page Title  : ${document.title}
App Version : ${WIDGET_CONFIG.appVersion}
Viewport    : ${viewportWidth} × ${viewportHeight} px
Screen      : ${screenWidth} × ${screenHeight} px (ratio: ${devicePixelRatio})
Browser     : ${navigator.userAgent}
Referrer    : ${document.referrer || 'None'}
================================`;
    }

    // Mask Sensitive Fields in the Cloned Document
    function maskSensitiveFields(doc) {
        const selectors = [
            'input[type="password"]',
            'input[type="credit-card"]',
            'input[name*="pass"]',
            'input[name*="pin"]',
            '.sensitive',
            '[data-mask]'
        ];
        selectors.forEach(sel => {
            doc.querySelectorAll(sel).forEach(el => {
                el.style.filter = 'blur(8px)';
                el.style.userSelect = 'none';
            });
        });
    }

    // Capture & Compress Screen
    async function captureAndCompress() {
        try {
            await loadHtml2Canvas();
            const dialog = document.getElementById('tmpt-feedback-dialog');
            
            // Hide the widget modal itself during capture
            const originalDisplay = dialog.style.display;
            dialog.style.setProperty('display', 'none', 'important');

            const canvas = await window.html2canvas(document.body, {
                scale: 1, // Ignore devicePixelRatio to keep size small
                useCORS: true,
                allowTaint: false,
                ignoreElements: (el) => {
                    return el.id === 'tmpt-feedback-dialog' || el.classList.contains('feedback-toggle');
                },
                onclone: (clonedDoc) => {
                    maskSensitiveFields(clonedDoc);
                }
            });

            // Restore dialog display
            dialog.style.display = originalDisplay;

            // Resize if wider than maxWidth
            const maxWidth = WIDGET_CONFIG.screenshotMaxWidth;
            let width = canvas.width;
            let height = canvas.height;
            if (width > maxWidth) {
                height = Math.round(height * (maxWidth / width));
                width = maxWidth;
            }

            const resized = document.createElement('canvas');
            resized.width = width;
            resized.height = height;
            const ctx = resized.getContext('2d');
            ctx.drawImage(canvas, 0, 0, width, height);

            // Compress to JPEG
            const base64 = resized.toDataURL('image/jpeg', WIDGET_CONFIG.screenshotQuality);
            const estimatedBytes = base64.length / 1.37;

            if (estimatedBytes > WIDGET_CONFIG.screenshotMaxBytes) {
                return { success: false, reason: 'too_large', base64: null, bytes: estimatedBytes };
            }

            return { success: true, base64 };
        } catch (e) {
            console.error('Error during screen capture:', e);
            return { success: false, reason: 'error', error: e.message };
        }
    }

    // Set Modal Content (State Machine)
    function showState(stateName) {
        const dialog = document.getElementById('tmpt-feedback-dialog');
        if (!dialog) return;

        let content = '';

        if (stateName === 'home') {
            const cooldownSec = checkCooldown();
            let cooldownHTML = '';
            if (cooldownSec > 0) {
                cooldownHTML = `
                    <div class="feedback-cooldown-alert">
                        <strong>Batas Waktu Pengiriman</strong><br>
                        Silakan tunggu ${cooldownSec} detik sebelum mengirimkan masukan baru.
                    </div>
                `;
            }

            content = `
                <article>
                    <header>
                        <h3>Kirim masukan ke TMPT</h3>
                        <button class="close" aria-label="Tutup" onclick="window.TMPT_Feedback.closeWidget()">✕</button>
                    </header>
                    ${cooldownHTML}
                    <p style="font-size: 0.9rem; color: var(--pico-secondary-color); margin-bottom: 1rem;">
                        Pilih jenis masukan yang ingin Anda sampaikan kepada kami:
                    </p>
                    <div class="feedback-home-options">
                        <button class="feedback-option-btn" onclick="window.TMPT_Feedback.showState('bug')" ${cooldownSec > 0 ? 'disabled' : ''}>
                            <span class="feedback-option-icon">🐛</span>
                            <span class="feedback-option-text">
                                <strong>Laporkan Masalah</strong>
                                <span>Ada error, tampilan rusak, atau fitur tidak bekerja</span>
                            </span>
                        </button>
                        <button class="feedback-option-btn" onclick="window.TMPT_Feedback.showState('idea')" ${cooldownSec > 0 ? 'disabled' : ''}>
                            <span class="feedback-option-icon">💡</span>
                            <span class="feedback-option-text">
                                <strong>Sarankan Ide</strong>
                                <span>Usulan fitur baru atau saran penyempurnaan</span>
                            </span>
                        </button>
                    </div>
                </article>
            `;
        } else if (stateName === 'bug') {
            content = `
                <article>
                    <header>
                        <div style="display: flex; align-items: center; gap: 0.5rem;">
                            <button onclick="window.TMPT_Feedback.showState('home')" class="outline secondary" style="padding: 0.25rem 0.5rem; margin: 0; font-size: 0.75rem; border-radius: 6px;">← Kembali</button>
                            <h3 style="margin-left: 0.5rem;">Melaporkan Masalah</h3>
                        </div>
                        <button class="close" aria-label="Tutup" onclick="window.TMPT_Feedback.closeWidget()">✕</button>
                    </header>
                    <form id="tmpt-feedback-form" onsubmit="window.TMPT_Feedback.handleSubmit(event, 'bug')">
                        <label for="feedback-kategori">Kategori Masalah *</label>
                        <select id="feedback-kategori" name="kategori" required>
                            <option value="" disabled selected>Pilih Kategori...</option>
                            <option value="Membagikan file / folder">Membagikan file / folder</option>
                            <option value="Memulihkan file saya">Memulihkan file saya</option>
                            <option value="Melaporkan Spam">Melaporkan Spam</option>
                            <option value="Mengupload folder / file">Mengupload folder / file</option>
                            <option value="Menelusuri file">Menelusuri file</option>
                            <option value="Masalah tampilan / UI">Masalah tampilan / UI</option>
                            <option value="Masalah performa / lambat">Masalah performa / lambat</option>
                            <option value="Error / crash halaman">Error / crash halaman</option>
                            <option value="Lainnya">Lainnya</option>
                        </select>

                        <label for="feedback-deskripsi">Jelaskan masalah Anda *</label>
                        <div class="feedback-textarea-wrapper">
                            <textarea id="feedback-deskripsi" name="deskripsi" placeholder="Ketik deskripsi masalah Anda di sini (minimum 20 karakter)..." required minlength="20" maxlength="2000" oninput="window.TMPT_Feedback.updateCharCount(this, 2000)"></textarea>
                            <div class="feedback-char-counter"><span id="char-count-val">0</span>/2000</div>
                        </div>

                        <div class="feedback-screenshot-section">
                            <label style="margin-bottom: 0.5rem; cursor: pointer; display: flex; align-items: center; gap: 0.5rem;">
                                <input type="checkbox" id="feedback-include-screenshot" name="sertakan_screenshot" onchange="window.TMPT_Feedback.handleScreenshotToggle(this)" style="margin: 0;">
                                <span>Sertakan Screenshot (Opsional)</span>
                            </label>
                            <div id="feedback-screenshot-preview-container" style="display: none;">
                                <div class="feedback-screenshot-container">
                                    <div class="feedback-screenshot-preview" id="screenshot-preview-box"></div>
                                    <div class="feedback-screenshot-info">
                                        <span id="screenshot-size-info">Menangkap layar...</span>
                                        <button type="button" id="btn-download-screenshot" class="outline" style="display: none; padding: 0.25rem 0.5rem; font-size: 0.7rem; margin: 0.25rem 0 0 0; width: auto; border-radius: 6px;" onclick="window.TMPT_Feedback.downloadScreenshot()">Unduh Screenshot</button>
                                    </div>
                                </div>
                            </div>
                            <div class="feedback-screenshot-disclaimer">
                                Pastikan screenshot tidak menampilkan informasi sensitif atau data pribadi.
                            </div>
                        </div>

                        <div class="feedback-footer-actions">
                            <button type="button" class="outline secondary" onclick="window.TMPT_Feedback.closeWidget()">Batal</button>
                            <button type="submit" class="btn-navy" id="btn-submit-feedback">Kirim Laporan</button>
                        </div>
                    </form>
                </article>
            `;
        } else if (stateName === 'idea') {
            content = `
                <article>
                    <header>
                        <div style="display: flex; align-items: center; gap: 0.5rem;">
                            <button onclick="window.TMPT_Feedback.showState('home')" class="outline secondary" style="padding: 0.25rem 0.5rem; margin: 0; font-size: 0.75rem; border-radius: 6px;">← Kembali</button>
                            <h3 style="margin-left: 0.5rem;">Sarankan Ide</h3>
                        </div>
                        <button class="close" aria-label="Tutup" onclick="window.TMPT_Feedback.closeWidget()">✕</button>
                    </header>
                    <form id="tmpt-feedback-form" onsubmit="window.TMPT_Feedback.handleSubmit(event, 'idea')">
                        <label for="feedback-deskripsi">Jelaskan saran atau ide Anda *</label>
                        <div class="feedback-textarea-wrapper">
                            <textarea id="feedback-deskripsi" name="deskripsi" placeholder="Tuliskan detail ide atau usulan fitur baru Anda di sini (minimum 20 karakter)..." required minlength="20" maxlength="3000" oninput="window.TMPT_Feedback.updateCharCount(this, 3000)"></textarea>
                            <div class="feedback-char-counter"><span id="char-count-val">0</span>/3000</div>
                        </div>

                        <div class="feedback-screenshot-section">
                            <label style="margin-bottom: 0.5rem; cursor: pointer; display: flex; align-items: center; gap: 0.5rem;">
                                <input type="checkbox" id="feedback-include-screenshot" name="sertakan_screenshot" onchange="window.TMPT_Feedback.handleScreenshotToggle(this)" style="margin: 0;">
                                <span>Sertakan Screenshot (Opsional)</span>
                            </label>
                            <div id="feedback-screenshot-preview-container" style="display: none;">
                                <div class="feedback-screenshot-container">
                                    <div class="feedback-screenshot-preview" id="screenshot-preview-box"></div>
                                    <div class="feedback-screenshot-info">
                                        <span id="screenshot-size-info">Menangkap layar...</span>
                                        <button type="button" id="btn-download-screenshot" class="outline" style="display: none; padding: 0.25rem 0.5rem; font-size: 0.7rem; margin: 0.25rem 0 0 0; width: auto; border-radius: 6px;" onclick="window.TMPT_Feedback.downloadScreenshot()">Unduh Screenshot</button>
                                    </div>
                                </div>
                            </div>
                            <div class="feedback-screenshot-disclaimer">
                                Pastikan screenshot tidak menampilkan informasi sensitif atau data pribadi.
                            </div>
                        </div>

                        <div class="feedback-footer-actions">
                            <button type="button" class="outline secondary" onclick="window.TMPT_Feedback.closeWidget()">Batal</button>
                            <button type="submit" class="btn-navy" id="btn-submit-feedback">Kirim Ide</button>
                        </div>
                    </form>
                </article>
            `;
        } else if (stateName === 'success') {
            content = `
                <article class="feedback-status-state">
                    <div class="feedback-status-icon success">✓</div>
                    <div class="feedback-status-title">Terima Kasih!</div>
                    <p class="feedback-status-desc">Masukan Anda telah berhasil kami terima. Kami sangat menghargai kontribusi Anda dalam meningkatkan kualitas TMPT.</p>
                    <button class="btn-navy" onclick="window.TMPT_Feedback.closeWidget()" style="margin: 0 auto; width: auto;">Tutup</button>
                </article>
            `;
            // Auto close after 4 seconds
            setTimeout(() => {
                const dlg = document.getElementById('tmpt-feedback-dialog');
                if (dlg && dlg.hasAttribute('open')) {
                    window.TMPT_Feedback.closeWidget();
                }
            }, 4000);
        } else if (stateName === 'error') {
            content = `
                <article class="feedback-status-state">
                    <div class="feedback-status-icon error">⚠️</div>
                    <div class="feedback-status-title">Pengiriman Gagal</div>
                    <p class="feedback-status-desc">Terjadi kesalahan koneksi saat mengirim masukan. Silakan coba kembali beberapa saat lagi, atau kirim langsung ke email kami di <a href="mailto:support@tmpt.my.id">support@tmpt.my.id</a>.</p>
                    <div style="display: flex; gap: 1rem; justify-content: center;">
                        <button class="outline secondary" onclick="window.TMPT_Feedback.showState('home')" style="margin: 0; width: auto;">Kembali</button>
                        <button class="btn-navy" onclick="window.TMPT_Feedback.showState('bug')" style="margin: 0; width: auto;">Coba Lagi</button>
                    </div>
                </article>
            `;
        }

        dialog.innerHTML = content;
        currentScreenshotBase64 = null;
    }

    // Toggle Dialog Widget
    function toggleWidget() {
        const dialog = createWidgetDialog();
        loadCSS();
        if (dialog.hasAttribute('open')) {
            closeWidget();
        } else {
            showState('home');
            dialog.showModal();
        }
    }

    // Close Widget with confirmation if dirty
    function closeWidget() {
        const dialog = document.getElementById('tmpt-feedback-dialog');
        if (!dialog) return;

        const textarea = dialog.querySelector('textarea');
        if (textarea && textarea.value.trim().length > 0) {
            const confirmClose = window.confirm("Data yang sudah diisi akan hilang. Tutup tetap?");
            if (!confirmClose) return;
        }

        dialog.close();
        currentScreenshotBase64 = null;
    }

    // Update Textarea character counter
    function updateCharCount(textarea, max) {
        const countVal = document.getElementById('char-count-val');
        if (countVal) {
            const length = textarea.value.length;
            countVal.textContent = length;
            if (length > max) {
                countVal.parentElement.classList.add('error-limit');
            } else {
                countVal.parentElement.classList.remove('error-limit');
            }
        }
    }

    // Handle Screenshot Checkbox toggle
    async function handleScreenshotToggle(checkbox) {
        const container = document.getElementById('feedback-screenshot-preview-container');
        const previewBox = document.getElementById('screenshot-preview-box');
        const info = document.getElementById('screenshot-size-info');
        const dlBtn = document.getElementById('btn-download-screenshot');
        const submitBtn = document.getElementById('btn-submit-feedback');

        if (checkbox.checked) {
            container.style.display = 'block';
            previewBox.style.backgroundImage = 'none';
            info.textContent = 'Menangkap layar...';
            dlBtn.style.display = 'none';
            
            // Disable submit button while capturing
            if (submitBtn) submitBtn.disabled = true;

            const captureResult = await captureAndCompress();

            if (submitBtn) submitBtn.disabled = false;

            if (captureResult.success) {
                currentScreenshotBase64 = captureResult.base64;
                previewBox.style.backgroundImage = `url(${currentScreenshotBase64})`;
                
                // Estimate size display
                const bytes = currentScreenshotBase64.length / 1.37;
                const kb = Math.round(bytes / 1024);
                info.textContent = `Screenshot siap (~${kb} KB)`;
            } else {
                currentScreenshotBase64 = null;
                checkbox.checked = false;
                container.style.display = 'none';

                if (captureResult.reason === 'too_large') {
                    alert('Screenshot terlalu besar untuk dikirim secara otomatis. Silakan unduh screenshot secara manual jika ingin melampirkannya.');
                    // Fallback to manual download options
                    const captureAll = await window.html2canvas(document.body, { scale: 1 });
                    currentScreenshotBase64 = captureAll.toDataURL('image/jpeg', 0.85); // High quality for local download
                    
                    container.style.display = 'block';
                    previewBox.style.backgroundImage = `url(${currentScreenshotBase64})`;
                    info.innerHTML = `<span style="color: var(--pico-danger-color);">Terlalu besar (>400KB).</span>`;
                    dlBtn.style.display = 'inline-block';
                } else {
                    alert('Gagal mengambil screenshot: ' + (captureResult.error || 'Unknown Error'));
                }
            }
        } else {
            container.style.display = 'none';
            currentScreenshotBase64 = null;
            dlBtn.style.display = 'none';
        }
    }

    // Trigger local download of screenshot
    function downloadScreenshot() {
        if (!currentScreenshotBase64) return;
        const link = document.createElement('a');
        link.download = `tmpt-screenshot-${Date.now()}.jpg`;
        link.href = currentScreenshotBase64;
        link.click();
    }

    // Handle Form Submit
    async function handleSubmit(event, type) {
        event.preventDefault();

        const form = event.target;
        const submitBtn = form.querySelector('button[type="submit"]');
        const descVal = form.querySelector('[name="deskripsi"]').value;

        if (descVal.trim().length < 20) {
            alert('Deskripsi harus minimal 20 karakter.');
            return;
        }

        // Disable UI
        if (submitBtn) {
            submitBtn.setAttribute('aria-busy', 'true');
            submitBtn.disabled = true;
        }

        const categoryVal = type === 'bug' ? form.querySelector('[name="kategori"]').value : 'Idea Suggestion';
        const metadata = collectMetadata();
        const shortUrl = window.location.pathname;
        const timeStr = new Date().toISOString().replace('T', ' ').substring(0, 16);
        const subject = type === 'bug' 
            ? `[BUG] ${categoryVal} — ${shortUrl} — ${timeStr}`
            : `[IDEA] — ${shortUrl} — ${timeStr}`;

        const payload = {
            _subject: subject,
            kategori: categoryVal,
            deskripsi: descVal,
            _metadata: metadata,
            _screenshot_data: currentScreenshotBase64 || 'Tidak disertakan'
        };

        const endpoint = type === 'bug' ? WIDGET_CONFIG.formspreeEndpointBug : WIDGET_CONFIG.formspreeEndpointIdea;

        try {
            const response = await fetch(endpoint, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Accept': 'application/json'
                },
                body: JSON.stringify(payload)
            });

            if (response.ok) {
                localStorage.setItem('tmpt_feedback_last_submit', Date.now().toString());
                showState('success');
            } else {
                showState('error');
            }
        } catch (e) {
            console.error('Error submitting feedback:', e);
            showState('error');
        } finally {
            if (submitBtn) {
                submitBtn.removeAttribute('aria-busy');
                submitBtn.disabled = false;
            }
        }
    }

    // Export API to global window scope
    window.TMPT_Feedback = {
        toggleWidget,
        closeWidget,
        showState,
        updateCharCount,
        handleScreenshotToggle,
        downloadScreenshot,
        handleSubmit
    };
})();
