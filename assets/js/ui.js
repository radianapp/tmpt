/**
 * TMPT UI Module
 * Helper functions for UI interactions, toasts, and modals.
 */

const UIModule = {
    /**
     * Show a toast notification
     */
    toast(message, type = 'info') {
        let container = document.getElementById('toast-container');
        if (!container) {
            container = document.createElement('div');
            container.id = 'toast-container';
            document.body.appendChild(container);
        }

        const toast = document.createElement('div');
        toast.className = `toast toast-${type}`;
        toast.textContent = message;

        container.appendChild(toast);

        // Auto remove
        setTimeout(() => {
            toast.style.opacity = '0';
            toast.style.transform = 'translateX(100%)';
            setTimeout(() => toast.remove(), 300);
        }, 3000);
    },

    /**
     * Show/Hide loading state on a button or element
     */
    setLoading(selector, isLoading) {
        const el = document.querySelector(selector);
        if (!el) return;
        if (isLoading) {
            el.setAttribute('aria-busy', 'true');
            el.setAttribute('disabled', 'disabled');
        } else {
            el.removeAttribute('aria-busy');
            el.removeAttribute('disabled');
        }
    },

    /**
     * Cycle between: system -> light -> dark
     */
    toggleTheme() {
        const currentTheme = localStorage.getItem('tmpt_theme') || 'system';
        let nextTheme = 'light';

        if (currentTheme === 'system') nextTheme = 'light';
        else if (currentTheme === 'light') nextTheme = 'dark';
        else if (currentTheme === 'dark') nextTheme = 'system';

        this.applyTheme(nextTheme);
    },

    /**
     * Apply theme to HTML element
     */
    applyTheme(theme) {
        const html = document.documentElement;
        localStorage.setItem('tmpt_theme', theme);

        if (theme === 'system') {
            html.removeAttribute('data-theme'); // PicoCSS automatic handle
        } else {
            html.setAttribute('data-theme', theme);
        }

        this.updateThemeIcons(theme);
    },

    /**
     * Update toggle icons based on theme
     */
    updateThemeIcons(theme) {
        const icons = document.querySelectorAll('.theme-toggle-icon');
        // SVG Paths
        const sunPath = "M12 12m-4 0a4 4 0 1 0 8 0a4 4 0 1 0 -8 0M3 12h1m8 -9v1m8 8h1m-9 8v1m-6.4 -15.4l.7 .7m12.1 -.7l-.7 .7m0 11.4l.7 .7m-12.1 -.7l-.7 .7";
        const moonPath = "M12 3c.132 0 .263 0 .393 0a7.5 7.5 0 0 0 7.92 12.446a9 9 0 1 1 -8.313 -12.454z";
        const devicePath = "M3 5a1 1 0 0 1 1 -1h16a1 1 0 0 1 1 1v10a1 1 0 0 1 -1 1h-16a1 1 0 0 1 -1 -1v-10z M7 20h10 M9 16v4 M15 16v4";

        let targetPath = devicePath;
        if (theme === 'light') targetPath = sunPath;
        else if (theme === 'dark') targetPath = moonPath;
        else if (theme === 'system') targetPath = devicePath;

        icons.forEach(icon => {
            const paths = icon.querySelectorAll('path');
            if (paths.length > 1) {
                paths[1].setAttribute('d', targetPath);
            }
            const btn = icon.closest('button');
            if (btn) {
                const titleStr = theme === 'system' ? 'Tema: System' : theme === 'light' ? 'Tema: Terang' : 'Tema: Gelap';
                btn.setAttribute('aria-label', titleStr);
                btn.setAttribute('title', titleStr);
            }
        });
    },

    /**
     * Initialize theme from localStorage
     */
    initTheme() {
        const savedTheme = localStorage.getItem('tmpt_theme') || 'system';
        this.applyTheme(savedTheme);
    },
    /**
     * Generic Confirm Modal (Promise based)
     */
    async confirm(message, requiredText = null) {
        return new Promise((resolve) => {
            const modal = document.getElementById('confirm-modal');
            const msgEl = document.getElementById('confirm-message');
            const inputContainer = document.getElementById('confirm-input-container');
            const inputEl = document.getElementById('confirm-input');
            const okBtn = document.getElementById('confirm-ok-btn');
            
            if (!modal || !msgEl || !okBtn) {
                // Fallback jika modal tidak ada di HTML
                if (requiredText) {
                    const promptVal = window.prompt(`${message}\n\nKetik "${requiredText}" untuk konfirmasi:`);
                    resolve(promptVal === requiredText);
                } else {
                    resolve(window.confirm(message));
                }
                return;
            }

            msgEl.textContent = message;
            
            if (requiredText && inputContainer && inputEl) {
                inputContainer.style.display = 'block';
                inputEl.value = '';
                inputEl.placeholder = `Ketik "${requiredText}"`;
                okBtn.disabled = true;
                
                inputEl.oninput = (e) => {
                    if (e.target.value === requiredText) {
                        okBtn.disabled = false;
                    } else {
                        okBtn.disabled = true;
                    }
                };
            } else if (inputContainer) {
                inputContainer.style.display = 'none';
                okBtn.disabled = false;
            } else {
                okBtn.disabled = false;
            }
            
            // Simpan resolve function di element agar bisa dipanggil saat tombol diklik
            modal._resolve = resolve;
            modal.showModal();
        });
    },
};

window.TMPT_UI = UIModule;
// Jalankan sesegera mungkin
window.TMPT_UI.initTheme();
