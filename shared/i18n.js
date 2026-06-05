/**
 * i18n Main Module for TMPT
 * Engine Penerjemah Client-side & Local-first
 */

const TMPT_I18n = {
    // Kunci localStorage untuk bahasa
    STORAGE_KEY: 'tmpt_lang',
    
    // Default bahasa
    DEFAULT_LANG: 'id',

    /**
     * Dapatkan bahasa saat ini yang dipilih user
     * @returns {string} 'id' | 'en'
     */
    getLang() {
        return localStorage.getItem(this.STORAGE_KEY) || this.DEFAULT_LANG;
    },

    /**
     * Setel bahasa baru dan reload halaman
     * @param {string} lang 'id' | 'en'
     */
    setLang(lang) {
        if (lang === 'id' || lang === 'en') {
            localStorage.setItem(this.STORAGE_KEY, lang);
            // Reload halaman untuk menerapkan bahasa secara penuh (Pilihan A)
            window.location.reload();
        }
    },

    /**
     * Dapatkan string terjemahan berdasarkan key
     * Format key: "namespace.string_key" (misal: "common.save")
     * @param {string} key 
     * @param {Object} vars Variabel substitusi (opsional)
     * @returns {string} Terjemahan atau key itu sendiri sebagai fallback
     */
    t(key, vars = {}) {
        const lang = this.getLang();
        const parts = key.split('.');
        if (parts.length !== 2) return key;

        const [namespace, stringKey] = parts;
        const config = window.TMPT_I18n_Config;

        if (!config || !config[namespace] || !config[namespace][lang]) {
            // Coba cari di default lang (id) jika config untuk bahasa terpilih tidak ada
            if (config && config[namespace] && config[namespace][this.DEFAULT_LANG]) {
                let text = config[namespace][this.DEFAULT_LANG][stringKey];
                if (text !== undefined) return this._interpolate(text, vars);
            }
            return key;
        }

        let text = config[namespace][lang][stringKey];
        if (text === undefined) {
            // Fallback ke default lang (id)
            if (config[namespace][this.DEFAULT_LANG] && config[namespace][this.DEFAULT_LANG][stringKey] !== undefined) {
                text = config[namespace][this.DEFAULT_LANG][stringKey];
            } else {
                return key;
            }
        }

        return this._interpolate(text, vars);
    },

    /**
     * Melakukan substitusi variabel dalam string (contoh: {name})
     */
    _interpolate(text, vars) {
        if (typeof text !== 'string') return text;
        return text.replace(/{([^{}]+)}/g, (match, key) => {
            return vars[key] !== undefined ? vars[key] : match;
        });
    },

    /**
     * Cari semua elemen di DOM yang memiliki atribut data-i18n* dan terjemahkan
     */
    applyTranslations() {
        const lang = this.getLang();
        document.documentElement.setAttribute('lang', lang);

        // 1. data-i18n (mengubah textContent)
        document.querySelectorAll('[data-i18n]').forEach(el => {
            const key = el.getAttribute('data-i18n');
            el.textContent = this.t(key);
        });

        // 2. data-i18n-placeholder (mengubah placeholder atribut)
        document.querySelectorAll('[data-i18n-placeholder]').forEach(el => {
            const key = el.getAttribute('data-i18n-placeholder');
            el.setAttribute('placeholder', this.t(key));
        });

        // 3. data-i18n-title (mengubah title atribut)
        document.querySelectorAll('[data-i18n-title]').forEach(el => {
            const key = el.getAttribute('data-i18n-title');
            el.setAttribute('title', this.t(key));
        });

        // 4. data-i18n-aria (mengubah aria-label atribut)
        document.querySelectorAll('[data-i18n-aria]').forEach(el => {
            const key = el.getAttribute('data-i18n-aria');
            el.setAttribute('aria-label', this.t(key));
        });
    }
};

window.TMPT_I18n = TMPT_I18n;

// Jalankan translasi DOM secara otomatis saat DOM dimuat
document.addEventListener('DOMContentLoaded', () => {
    if (window.TMPT_I18n_Config) {
        window.TMPT_I18n.applyTranslations();
    }
});

// Jalankan juga saat HTMX selesai swap konten
document.addEventListener('htmx:afterSwap', () => {
    if (window.TMPT_I18n_Config) {
        window.TMPT_I18n.applyTranslations();
    }
});
