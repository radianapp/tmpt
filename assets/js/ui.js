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
     * Helper to load partial HTML (if not using HTMX directly)
     */
    async loadPartial(targetSelector, url) {
        try {
            const response = await fetch(url);
            const html = await response.text();
            document.querySelector(targetSelector).innerHTML = html;
        } catch (e) {
            console.error("Failed to load partial", url, e);
        }
    }
};

window.TMPT_UI = UIModule;
