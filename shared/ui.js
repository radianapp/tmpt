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
     * Show a global loading overlay with a message
     */
    showLoader(message = 'Memuat...') {
        let overlay = document.getElementById('tmpt-loader-overlay');
        if (!overlay) {
            overlay = document.createElement('div');
            overlay.id = 'tmpt-loader-overlay';
            overlay.style.cssText = `
                position: fixed;
                top: 0;
                left: 0;
                width: 100vw;
                height: 100vh;
                background: rgba(0, 0, 0, 0.4);
                display: flex;
                flex-direction: column;
                align-items: center;
                justify-content: center;
                z-index: 9999;
                color: white;
                font-weight: 600;
                backdrop-filter: blur(4px);
                transition: opacity 0.2s ease;
            `;
            
            const spinner = document.createElement('article');
            spinner.style.cssText = `
                display: flex;
                flex-direction: column;
                align-items: center;
                gap: 1rem;
                padding: 2rem;
                border-radius: 20px;
                background: var(--pico-card-background-color);
                box-shadow: var(--pico-box-shadow);
                color: var(--pico-color);
                margin: 0;
            `;
            spinner.innerHTML = `
                <span aria-busy="true" style="font-size: 2rem; display: block; margin: 0 auto;"></span>
                <span id="tmpt-loader-text" style="font-size: 0.95rem;">${message}</span>
            `;
            overlay.appendChild(spinner);
            document.body.appendChild(overlay);
        } else {
            const textEl = document.getElementById('tmpt-loader-text');
            if (textEl) textEl.textContent = message;
        }
    },

    /**
     * Hide the global loading overlay
     */
    hideLoader() {
        const overlay = document.getElementById('tmpt-loader-overlay');
        if (overlay) {
            overlay.remove();
        }
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
     * Cycle between: light -> dark
     */
    toggleTheme() {
        const currentTheme = localStorage.getItem('tmpt_theme') || 'light';
        let nextTheme = 'light';

        if (currentTheme === 'light') nextTheme = 'dark';
        else nextTheme = 'light';

        this.applyTheme(nextTheme);
    },

    /**
     * Apply theme to HTML element
     */
    applyTheme(theme) {
        const html = document.documentElement;
        if (theme === 'system' || !theme) theme = 'light';
        
        localStorage.setItem('tmpt_theme', theme);
        html.setAttribute('data-theme', theme);

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

        let targetPath = theme === 'dark' ? sunPath : moonPath;

        icons.forEach(icon => {
            const paths = icon.querySelectorAll('path');
            if (paths.length > 1) {
                paths[1].setAttribute('d', targetPath);
            }
            const btn = icon.closest('button');
            if (btn) {
                const titleStr = theme === 'dark' ? 'Tema: Gelap' : 'Tema: Terang';
                btn.setAttribute('aria-label', titleStr);
                btn.setAttribute('title', titleStr);
            }
        });
    },

    /**
     * Apply theme stylesheet dynamically
     */
    applyThemeStylesheet(filename) {
        localStorage.setItem('tmpt_theme_stylesheet', filename);
        let linkEl = document.getElementById('tmpt-theme-stylesheet');
        if (!linkEl) {
            linkEl = document.createElement('link');
            linkEl.id = 'tmpt-theme-stylesheet';
            linkEl.rel = 'stylesheet';
            document.head.appendChild(linkEl);
        }
        linkEl.href = `/shared/theme/${filename}?v=${Date.now()}`;
    },

    /**
     * Initialize theme from localStorage
     */
    initTheme() {
        const savedTheme = localStorage.getItem('tmpt_theme') || 'light';
        this.applyTheme(savedTheme === 'system' ? 'light' : savedTheme);

        const savedStylesheet = localStorage.getItem('tmpt_theme_stylesheet') || 'tmpt.css';
        this.applyThemeStylesheet(savedStylesheet);
    },
    /**
     * Generic Confirm Modal (Promise based)
     */
    async confirm(message, requiredText = null, title = 'Konfirmasi') {
        return new Promise((resolve) => {
            const modal = document.getElementById('confirm-modal');
            const titleEl = document.getElementById('confirm-title');
            const msgEl = document.getElementById('confirm-message');
            const inputContainer = document.getElementById('confirm-input-container');
            const inputEl = document.getElementById('confirm-input');
            const okBtn = document.getElementById('confirm-ok-btn');
            
            if (!modal || !msgEl || !okBtn) {
                // Fallback jika modal tidak ada di HTML
                if (requiredText) {
                    const promptVal = window.prompt(`${title}\n\n${message}\n\nKetik "${requiredText}" untuk konfirmasi:`);
                    resolve(promptVal === requiredText);
                } else {
                    resolve(window.confirm(`${title}\n\n${message}`));
                }
                return;
            }

            if (titleEl) titleEl.textContent = title;
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
            
            if (requiredText === "HAPUS PERMANEN" || message.includes("menghapus SELURUH data")) {
                okBtn.className = "btn-danger";
            } else {
                okBtn.className = "btn-navy";
            }
            
            // Simpan resolve function di element agar bisa dipanggil saat tombol diklik
            modal._resolve = resolve;
            modal.showModal();
        });
    },

    /**
     * Generic Custom Alert Dialog (Promise based, styled with PicoCSS)
     */
    async alert(message) {
        return new Promise((resolve) => {
            const dialog = document.createElement('dialog');
            dialog.style.borderRadius = '20px';
            dialog.style.padding = '2rem';
            dialog.style.maxWidth = '450px';
            dialog.style.width = '95%';

            dialog.innerHTML = `
                <article style="border: none; margin: 0; padding: 0; background: transparent; box-shadow: none;">
                    <h3 style="font-weight: 700; margin-bottom: 0.75rem; font-size: 1.5rem;">Perhatian</h3>
                    <p style="margin-bottom: 1.5rem; font-size: 0.95rem; line-height: 1.5; text-align: left;">${message}</p>
                    <div style="display: flex; justify-content: flex-end;">
                        <button type="button" class="btn-navy" id="ui-alert-ok" style="margin: 0; border-radius: 8px; padding: 0.4rem 1.5rem;">OK</button>
                    </div>
                </article>
            `;

            document.body.appendChild(dialog);
            dialog.showModal();

            const okBtn = dialog.querySelector('#ui-alert-ok');
            okBtn.focus();

            okBtn.onclick = () => {
                dialog.close();
                dialog.remove();
                resolve();
            };

            dialog.onkeydown = (e) => {
                if (e.key === 'Enter' || e.key === 'Escape') {
                    e.preventDefault();
                    okBtn.click();
                }
            };
        });
    },

    /**
     * Generic Dynamic Prompt Dialog (Promise based, styled with PicoCSS)
     */
    async prompt(message, placeholder = '', isPassword = false) {
        return new Promise((resolve) => {
            const dialog = document.createElement('dialog');
            dialog.style.borderRadius = '20px';
            dialog.style.padding = '2rem';
            dialog.style.maxWidth = '450px';
            dialog.style.width = '95%';

            const type = isPassword ? 'password' : 'text';
            dialog.innerHTML = `
                <article style="border: none; margin: 0; padding: 0; background: transparent; box-shadow: none;">
                    <h3 style="font-weight: 700; margin-bottom: 0.75rem; font-size: 1.5rem;">Masukan Diperlukan</h3>
                    <p style="margin-bottom: 1.25rem; font-size: 0.95rem; line-height: 1.5; text-align: left;">${message}</p>
                    <input type="${type}" id="ui-prompt-input" placeholder="${placeholder}" autocomplete="off" style="border-radius: 10px; margin-bottom: 1.5rem; width: 100%;">
                    <div style="display: flex; gap: 1rem; justify-content: flex-end;">
                        <button type="button" class="outline secondary" id="ui-prompt-cancel" style="margin: 0; border-radius: 8px; padding: 0.4rem 1.25rem;">Batal</button>
                        <button type="button" class="btn-navy" id="ui-prompt-ok" style="margin: 0; border-radius: 8px; padding: 0.4rem 1.5rem;">Lanjutkan</button>
                    </div>
                </article>
            `;

            document.body.appendChild(dialog);
            dialog.showModal();

            const input = dialog.querySelector('#ui-prompt-input');
            input.focus();

            dialog.querySelector('#ui-prompt-cancel').onclick = () => {
                dialog.close();
                dialog.remove();
                resolve(null);
            };

            dialog.querySelector('#ui-prompt-ok').onclick = () => {
                const val = input.value;
                dialog.close();
                dialog.remove();
                resolve(val);
            };

            // Support Enter key
            input.onkeydown = (e) => {
                if (e.key === 'Enter') {
                    e.preventDefault();
                    dialog.querySelector('#ui-prompt-ok').click();
                }
            };
        });
    },

    toggleAppLauncher(btnOrEvent, event) {
        let btn, ev;
        if (btnOrEvent && btnOrEvent.stopPropagation) {
            ev = btnOrEvent;
            btn = ev.currentTarget || (ev.target ? ev.target.closest('button') : null);
        } else {
            btn = btnOrEvent;
            ev = event;
        }
        if (ev) ev.stopPropagation();
        if (!btn) return;
        
        // Muat & urutkan daftar aplikasi dari JSON secara dinamis
        this.initAppLauncher();

        const menu = btn.nextElementSibling;
        const allLaunchers = document.querySelectorAll('#tmpt-app-launcher-menu, .tmpt-app-launcher-menu-class');
        const allProfiles = document.querySelectorAll('#tmpt-profile-menu, .tmpt-profile-menu-class');
        allProfiles.forEach(p => p.style.display = 'none');
        if (menu) {
            const isVisible = menu.style.display !== 'none';
            allLaunchers.forEach(l => l.style.display = 'none');
            menu.style.display = isVisible ? 'none' : 'block';
        }
    },

    toggleProfileMenu(btnOrEvent, event) {
        let btn, ev;
        if (btnOrEvent && btnOrEvent.stopPropagation) {
            ev = btnOrEvent;
            btn = ev.currentTarget || (ev.target ? ev.target.closest('button') : null);
        } else {
            btn = btnOrEvent;
            ev = event;
        }
        if (ev) ev.stopPropagation();
        if (!btn) return;
        const menu = btn.nextElementSibling;
        const allLaunchers = document.querySelectorAll('#tmpt-app-launcher-menu, .tmpt-app-launcher-menu-class');
        const allProfiles = document.querySelectorAll('#tmpt-profile-menu, .tmpt-profile-menu-class');
        allLaunchers.forEach(l => l.style.display = 'none');
        if (menu) {
            const isVisible = menu.style.display !== 'none';
            allProfiles.forEach(p => p.style.display = 'none');
            const isOpening = !isVisible;
            menu.style.display = isOpening ? 'block' : 'none';
            if (isOpening) {
                this.updateProfileUI();
            }
        }
    },

    async updateProfileUI() {
        // Helper to check if i18n is loaded and translate
        const t = (key, vars = {}) => {
            return window.TMPT_I18n ? window.TMPT_I18n.t(key, vars) : (vars.name || vars.plan || key.split('.').pop());
        };

        // Get license/pro status
        const isPro = window.TMPT_License && window.TMPT_License.isPro();
        const proStatus = window.TMPT_License ? window.TMPT_License.getProStatus() : null;
        
        // Get auth status
        const isUnlocked = window.TMPT_Auth && window.TMPT_Auth.isUnlocked();
        
        // Active Vault name
        let vaultName = window.TMPT_I18n ? t('profile.hello_guest').replace('Halo, ', '').replace('.', '') : "Tamu";
        let initial = "G";
        let emailStr = "belum_login@tmpt.my.id";
        
        if (isUnlocked) {
            const meta = window.TMPT_Vault ? window.TMPT_Vault.getMetadata() : null;
            vaultName = (meta && meta.name) || "Utama";
            initial = vaultName.charAt(0);
            emailStr = (proStatus && proStatus.email) || "vault.unlocked@tmpt.my.id";
        }
        
        // Update header icons / initials
        const initialEls = document.querySelectorAll('#tmpt-profile-initial, #tmpt-profile-avatar-large, .tmpt-profile-initial-class, .tmpt-profile-avatar-large-class');
        initialEls.forEach(el => {
            el.textContent = initial;
        });
        
        // Update emails
        const emailEls = document.querySelectorAll('#tmpt-profile-email, .tmpt-profile-email-class');
        emailEls.forEach(el => {
            el.textContent = emailStr;
        });
        
        // Update title/subtitles
        const titleEls = document.querySelectorAll('#tmpt-profile-title, .tmpt-profile-title-class');
        titleEls.forEach(el => {
            if (isUnlocked) {
                el.textContent = window.TMPT_I18n ? t('profile.hello_user', { name: vaultName }) : `Halo, ${vaultName}.`;
            } else {
                el.textContent = window.TMPT_I18n ? t('profile.hello_guest') : "Halo, Tamu.";
            }
        });
        const subtitleEls = document.querySelectorAll('#tmpt-profile-subtitle, .tmpt-profile-subtitle-class');
        subtitleEls.forEach(el => {
            if (isUnlocked) {
                el.textContent = window.TMPT_I18n ? t('profile.status_unlocked') : "Tmpt terbuka";
            } else {
                el.textContent = window.TMPT_I18n ? t('profile.status_locked') : "Tmpt terkunci";
            }
        });
        
        // Update status badge
        const badgeEls = document.querySelectorAll('#tmpt-profile-status-badge, .tmpt-profile-status-badge-class');
        badgeEls.forEach(badgeEl => {
            if (isPro) {
                const planName = (proStatus && proStatus.plan) ? proStatus.plan.toUpperCase() : 'AKTIF';
                const badgeText = window.TMPT_I18n ? t('profile.license_pro', { plan: planName }) : `TMPT PRO (${planName})`;
                badgeEl.innerHTML = `<span style="background: linear-gradient(135deg, #1e40af, #0284c7); color: white; font-size: 0.75rem; font-weight: 800; padding: 0.25rem 0.75rem; border-radius: 20px; letter-spacing: 0.05em; display: inline-block;">${badgeText}</span>`;
            } else {
                const badgeText = window.TMPT_I18n ? t('profile.license_free') : "Edisi Standar Gratis";
                badgeEl.innerHTML = `<span style="background: var(--pico-muted-border-color); color: var(--pico-secondary-color); font-size: 0.75rem; font-weight: 600; padding: 0.25rem 0.75rem; border-radius: 20px; display: inline-block;">${badgeText}</span>`;
            }
        });
        
        // Render vault switching list (Multi-vault switcher inside profile dropdown)
        const listEls = document.querySelectorAll('#tmpt-profile-vault-list, .tmpt-profile-vault-list-class');
        listEls.forEach(listEl => {
            listEl.innerHTML = '';
            
            if (isUnlocked) {
                const titleHeader = document.createElement('div');
                titleHeader.style.cssText = "font-size: 0.8rem; font-weight: 600; color: var(--pico-secondary-color); margin-bottom: 0.25rem;";
                titleHeader.textContent = window.TMPT_I18n ? t('profile.vault_list') : "Daftar Tmpt (Vault):";
                listEl.appendChild(titleHeader);
                
                const vaults = window.TMPT_Vault ? window.TMPT_Vault.listVaults() : [];
                vaults.forEach(vault => {
                    const item = document.createElement('div');
                    item.style.cssText = "display: flex; justify-content: space-between; align-items: center; padding: 0.5rem 0.75rem; border-radius: 8px; font-size: 0.85rem; font-weight: 500; cursor: pointer; transition: background-color 0.2s;";
                    
                    if (vault.isActive) {
                        item.style.backgroundColor = "var(--pico-muted-border-color)";
                        item.style.fontWeight = "700";
                        item.innerHTML = `
                            <span>🟢 ${vault.name}</span>
                            <span style="font-size: 0.7rem; background: var(--pico-primary); color: white; padding: 0.1rem 0.35rem; border-radius: 4px;" data-i18n="common.active">${window.TMPT_I18n ? t('common.active') : 'Aktif'}</span>
                        `;
                    } else {
                        // Switch on click if Pro
                        item.style.color = "var(--pico-color)";
                        item.innerHTML = `
                            <span>⚪ ${vault.name}</span>
                        `;
                        item.onmouseover = () => { item.style.backgroundColor = "var(--pico-muted-border-color)"; };
                        item.onmouseout = () => { item.style.backgroundColor = "transparent"; };
                        item.onclick = () => {
                            if (isPro) {
                                const allProfiles = document.querySelectorAll('#tmpt-profile-menu, .tmpt-profile-menu-class');
                                allProfiles.forEach(p => p.style.display = 'none');
                                const confirmModal = document.getElementById('vault-confirm-modal');
                                if (confirmModal) {
                                    const confirmMsg = document.getElementById('vault-confirm-message');
                                    const confirmBtn = document.getElementById('vault-confirm-btn');
                                    if (confirmMsg) confirmMsg.innerHTML = window.TMPT_I18n ? t('profile.confirm_switch_message', { name: vault.name }) : `Apakah Anda yakin ingin beralih ke Tmpt <strong>"${vault.name}"</strong>? Sesi Tmpt yang sedang terbuka saat ini akan otomatis dikunci.`;
                                    if (confirmBtn) {
                                        confirmBtn.onclick = () => {
                                            window.TMPT_Vault.switchVault(vault.id);
                                        };
                                    }
                                    confirmModal.showModal();
                                } else {
                                    window.TMPT_Vault.switchVault(vault.id);
                                }
                            } else {
                                UIModule.alert(window.TMPT_I18n ? t('profile.pro_required') : "Fitur Ganti Tmpt (Multi-Vault) memerlukan akun TMPT Pro!");
                            }
                        };
                    }
                    listEl.appendChild(item);
                });
            } else {
                listEl.innerHTML = `<div style="font-size: 0.8rem; text-align: center; color: var(--pico-secondary-color); padding: 0.5rem 0;">${window.TMPT_I18n ? t('profile.guest_prompt') : 'Buka Tmpt untuk melihat profil.'}</div>`;
            }
        });
        
        // Update footer actions
        const actionEls = document.querySelectorAll('#tmpt-profile-action-btn, .tmpt-profile-action-btn-class');
        actionEls.forEach(actionBtn => {
            if (isUnlocked) {
                actionBtn.textContent = window.TMPT_I18n ? t('profile.action_lock') : "Kunci Tmpt";
                actionBtn.className = "outline secondary";
                actionBtn.onclick = () => {
                    if (window.TMPT_lockVault) window.TMPT_lockVault();
                    else if (window.TMPT_Auth) window.TMPT_Auth.lock();
                };
            } else {
                actionBtn.textContent = window.TMPT_I18n ? t('profile.action_unlock') : "Buka Tmpt";
                actionBtn.className = "outline primary";
                actionBtn.onclick = () => {
                    window.location.href = '/app/auth/login/';
                };
            }
        });

        // Update settings button in profile dropdown
        const settingsEls = document.querySelectorAll('#tmpt-profile-settings-btn, .tmpt-profile-settings-btn-class');
        settingsEls.forEach(settingsBtn => {
            settingsBtn.textContent = window.TMPT_I18n ? t('common.settings') : "Setelan";
            settingsBtn.style.display = isUnlocked ? 'block' : 'none';
        });
    },

    async initAppLauncher() {
        let rawData = null;
        try {
            const res = await fetch('/shared/apps.json');
            rawData = await res.json();
        } catch (e) {
            console.error("Failed to load apps configuration", e);
            rawData = {
                "kerja": [
                    { "name": "Brankas", "url": "/app/kerja/vault/", "icon": "🔐" },
                    { "name": "Hitung", "url": "/app/kerja/hitung/", "icon": "📊" }
                ],
                "dev": [
                    { "name": "Code", "url": "/app/dev/code/", "icon": "💻" }
                ],
                "tools": [
                ]
            };
        }

        const favorites = JSON.parse(localStorage.getItem('tmpt_favorite_apps') || '[]');
        const favoritedApps = [];
        ['kerja', 'dev', 'tools'].forEach(cat => {
            if (rawData[cat]) {
                rawData[cat].forEach(app => {
                    if (favorites.includes(app.name)) {
                        favoritedApps.push(app);
                    }
                });
            }
        });

        const renderAppItems = (items) => {
            if (!items) return '';
            // Urutkan alfabetis
            const sorted = [...items].sort((a, b) => a.name.localeCompare(b.name));
            return sorted.map(app => {
                const isEnabled = app.isEnabled !== false;
                const style = isEnabled 
                    ? `display: flex; flex-direction: column; align-items: center; gap: 0.15rem; text-decoration: none; color: var(--pico-color); font-size: 0.7rem; font-weight: 600; padding: 0.35rem 0; border-radius: 8px; transition: background-color 0.2s;`
                    : `display: flex; flex-direction: column; align-items: center; gap: 0.15rem; text-decoration: none; color: var(--pico-muted-color); font-size: 0.7rem; font-weight: 600; padding: 0.35rem 0; border-radius: 8px; opacity: 0.4; cursor: not-allowed; pointer-events: none;`;
                const hoverAttr = isEnabled 
                    ? `onmouseover="this.style.backgroundColor='var(--pico-card-sectioning-background-color)'" onmouseout="this.style.backgroundColor='transparent'"`
                    : '';
                const url = isEnabled ? app.url : '#';
                return `
                    <a href="${url}" class="app-launcher-item" style="${style}" ${hoverAttr}>
                        <span style="font-size: 1.3rem; filter: ${isEnabled ? 'none' : 'grayscale(1)'}">${app.icon}</span>
                        <span style="display: block; margin-top: 2px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; max-width: 95%;">${app.name}</span>
                    </a>
                `;
            }).join('');
        };

        const menus = document.querySelectorAll('.tmpt-app-launcher-menu-class, #tmpt-app-launcher-menu');
        menus.forEach(menu => {
            menu.style.setProperty('width', '380px', 'important');
            menu.style.setProperty('max-height', '80vh', 'important');
            menu.style.setProperty('overflow-y', 'auto', 'important');
            
            let favoriteBlockHtml = '';
            if (favoritedApps.length > 0) {
                favoriteBlockHtml = `
                    <!-- TMPT Favorit (Card Wrapper) -->
                    <div style="background-color: rgba(245, 158, 11, 0.05); border-radius: 20px; padding: 0.75rem; margin-bottom: 0.85rem; border: 1px solid rgba(245, 158, 11, 0.25);">
                        <div style="font-size: 0.7rem; font-weight: 800; color: #d97706; margin-bottom: 0.35rem; text-transform: uppercase; letter-spacing: 0.05em; padding-left: 0.25rem;">⭐ Aplikasi Favorit</div>
                        <div style="display: grid; grid-template-columns: repeat(3, 1fr); gap: 0.35rem 0.15rem; text-align: center;">
                            ${renderAppItems(favoritedApps)}
                        </div>
                    </div>
                `;
            }

            menu.innerHTML = `
                <h4 style="font-size: 0.95rem; font-weight: 800; margin-top: 0; margin-bottom: 0.75rem; border-bottom: 1px solid var(--pico-muted-border-color); padding-bottom: 0.5rem; color: var(--pico-h1-color); text-align: left;">Aplikasi TMPT</h4>
                <div style="display: block; text-align: left;">
                    ${favoriteBlockHtml}
                    <!-- TMPT Kerja (Card Wrapper) -->
                    <div style="background-color: var(--pico-card-sectioning-background-color); border-radius: 20px; padding: 0.75rem; margin-bottom: 0.85rem; border: 1px solid var(--pico-muted-border-color);">
                        <div style="font-size: 0.7rem; font-weight: 800; color: var(--pico-muted-color); margin-bottom: 0.35rem; text-transform: uppercase; letter-spacing: 0.05em; padding-left: 0.25rem;">Tmpt Kerja</div>
                        <div style="display: grid; grid-template-columns: repeat(3, 1fr); gap: 0.35rem 0.15rem; text-align: center;">
                            ${renderAppItems(rawData.kerja)}
                        </div>
                    </div>
                    
                    <!-- TMPT Dev -->
                    <div style="font-size: 0.7rem; font-weight: 800; color: var(--pico-muted-color); margin-top: 0.75rem; margin-bottom: 0.35rem; text-transform: uppercase; letter-spacing: 0.05em; padding-left: 0.25rem;">Tmpt Dev</div>
                    <div style="display: grid; grid-template-columns: repeat(3, 1fr); gap: 0.35rem 0.15rem; text-align: center; margin-bottom: 0.85rem;">
                        ${renderAppItems(rawData.dev)}
                    </div>
                    
                    <!-- TMPT Tools -->
                    <div style="font-size: 0.7rem; font-weight: 800; color: var(--pico-muted-color); margin-top: 0.75rem; margin-bottom: 0.35rem; text-transform: uppercase; letter-spacing: 0.05em; padding-left: 0.25rem;">Tmpt Tools</div>
                    <div style="display: grid; grid-template-columns: repeat(3, 1fr); gap: 0.35rem 0.15rem; text-align: center; margin-bottom: 0.75rem;">
                        ${renderAppItems(rawData.tools)}
                    </div>
                    
                </div>
            `;
        });
    },

    /**
     * Render dynamic application grids into any page, grouped by category.
     * @param {string} containerSelector CSS selector of the wrapper element
     * @param {Array<string>} filterCategories optional category names to render (e.g. ['kerja', 'dev', 'tools'])
     */
    async renderAppSelectorGrid(containerSelector, filterCategories = []) {
        const wrapperEl = document.querySelector(containerSelector);
        if (!wrapperEl) return;

        let rawData = null;
        try {
            const res = await fetch('/shared/apps.json');
            rawData = await res.json();
        } catch (e) {
            console.error("Failed to load apps config for grid rendering", e);
            return;
        }

        // Metadata per kategori
        const styleMap = {
            "kerja": {
                "badge": "🏢 TMPT Kerja",
                "desc": "Aplikasi produktivitas modern untuk dokumen, spreadsheet, presentasi, tugas, dan manajemen file — langsung dari browser kamu.",
                "grad": "linear-gradient(135deg, rgba(37, 99, 235, 0.1) 0%, rgba(29, 78, 216, 0.1) 100%)",
                "btnClass": "btn-navy",
                "btnStyle": ""
            },
            "dev": {
                "badge": "💻 TMPT Dev",
                "desc": "Workspace untuk Developer. Tools developer modern yang berjalan langsung di browser dengan fokus pada kecepatan dan privasi.",
                "grad": "linear-gradient(135deg, rgba(79, 70, 229, 0.1) 0%, rgba(67, 56, 202, 0.1) 100%)",
                "btnClass": "btn-navy",
                "btnStyle": "background-color: #4f46e5; border-color: #4f46e5;"
            },
            "tools": {
                "badge": "🔧 TMPT Tools",
                "desc": "Utilitas Cepat Harian. Kumpulan utilitas ringan untuk keamanan, efisiensi kerja, dan aktivitas sehari-hari.",
                "grad": "linear-gradient(135deg, rgba(16, 185, 129, 0.1) 0%, rgba(4, 120, 87, 0.1) 100%)",
                "btnClass": "btn-navy",
                "btnStyle": "background-color: #10b981; border-color: #10b981;"
            }
        };

        let htmlContent = '';
        const categories = filterCategories.length > 0 ? filterCategories : Object.keys(rawData).filter(c => c !== 'platform');

        categories.forEach(cat => {
            const apps = rawData[cat] || [];
            if (apps.length === 0) return;

            const sorted = [...apps].sort((a, b) => a.name.localeCompare(b.name));
            const styles = styleMap[cat] || styleMap["kerja"];

            // Buka section kategori
            htmlContent += `
                <section class="apps-section" style="margin-top: 4rem;">
                    <div style="text-align: center; margin-bottom: 3rem;">
                        <h2 style="font-weight: 800; font-size: 2.25rem; color: var(--pico-h1-color); margin-bottom: 0.5rem;">${styles.badge}</h2>
                        <p class="secondary" style="font-size: 1.1rem; max-width: 800px; margin: 0 auto;">${styles.desc}</p>
                    </div>
                    <div class="app-selector-grid" style="display: grid; grid-template-columns: repeat(auto-fill, minmax(260px, 1fr)); gap: 1.5rem;">
            `;

            sorted.forEach(app => {
                const isEnabled = app.isEnabled !== false;
                
                // Warna tombol per nama app
                const btnColorMap = {
                    "Hitung":           "background-color: #10b981; border-color: #10b981;",
                    "Slide":            "background-color: #8b5cf6; border-color: #8b5cf6;",
                    "Forms":            "background-color: #ec4899; border-color: #ec4899;",
                    "Kalender":         "background-color: #0ea5e9; border-color: #0ea5e9;",
                    "Tugas":            "background-color: #f59e0b; border-color: #f59e0b;",
                    "Berkas":           "background-color: #4b5563; border-color: #4b5563;",
                    "Diagram":          "background-color: #06b6d2; border-color: #06b6d2;",
                    "Regex":            "background-color: #ef4444; border-color: #ef4444;",
                    "JSON":             "background-color: #f59e0b; border-color: #f59e0b;",
                    "Brankas":          "background-color: #0ea5e9; border-color: #0ea5e9;",
                    "Password Checker": "background-color: #6366f1; border-color: #6366f1;",
                    "QR Tools":         "background-color: #4b5563; border-color: #4b5563;",
                    "QR":               "background-color: #4b5563; border-color: #4b5563;",
                    "Pomodoro":         "background-color: #ef4444; border-color: #ef4444;",
                    "Kalkulator & Konversi": "background-color: #2563eb; border-color: #2563eb;",
                    "Favicon Generator":"background-color: #06b6d4; border-color: #06b6d4;"
                };

                // Gradien latar ikon per nama app
                const gradMap = {
                    "Hitung":           "linear-gradient(135deg, rgba(16, 185, 129, 0.1) 0%, rgba(15, 110, 86, 0.1) 100%)",
                    "Slide":            "linear-gradient(135deg, rgba(139, 92, 246, 0.1) 0%, rgba(124, 58, 237, 0.1) 100%)",
                    "Forms":            "linear-gradient(135deg, rgba(236, 72, 153, 0.1) 0%, rgba(219, 39, 119, 0.1) 100%)",
                    "Kalender":         "linear-gradient(135deg, rgba(14, 165, 233, 0.1) 0%, rgba(2, 132, 199, 0.1) 100%)",
                    "Tugas":            "linear-gradient(135deg, rgba(245, 158, 11, 0.1) 0%, rgba(217, 119, 6, 0.1) 100%)",
                    "Catatan":          "linear-gradient(135deg, rgba(16, 185, 129, 0.1) 0%, rgba(5, 150, 105, 0.1) 100%)",
                    "Berkas":           "linear-gradient(135deg, rgba(107, 114, 128, 0.1) 0%, rgba(75, 85, 99, 0.1) 100%)",
                    "Diagram":          "linear-gradient(135deg, rgba(6, 182, 212, 0.1) 0%, rgba(8, 145, 178, 0.1) 100%)",
                    "Regex":            "linear-gradient(135deg, rgba(239, 68, 68, 0.1) 0%, rgba(220, 38, 38, 0.1) 100%)",
                    "JSON":             "linear-gradient(135deg, rgba(245, 158, 11, 0.1) 0%, rgba(217, 119, 6, 0.1) 100%)",
                    "Brankas":          "linear-gradient(135deg, rgba(14, 165, 233, 0.1) 0%, rgba(2, 132, 199, 0.1) 100%)",
                    "Password Checker": "linear-gradient(135deg, rgba(99, 102, 241, 0.1) 0%, rgba(79, 70, 229, 0.1) 100%)",
                    "QR Tools":         "linear-gradient(135deg, rgba(75, 85, 99, 0.1) 0%, rgba(55, 65, 81, 0.1) 100%)",
                    "QR":               "linear-gradient(135deg, rgba(75, 85, 99, 0.1) 0%, rgba(55, 65, 81, 0.1) 100%)",
                    "Pomodoro":         "linear-gradient(135deg, rgba(239, 68, 68, 0.1) 0%, rgba(185, 28, 28, 0.1) 100%)",
                    "Kalkulator & Konversi": "linear-gradient(135deg, rgba(37, 99, 235, 0.1) 0%, rgba(29, 78, 216, 0.1) 100%)",
                    "Favicon Generator":"linear-gradient(135deg, rgba(6, 182, 212, 0.1) 0%, rgba(8, 145, 178, 0.1) 100%)"
                };

                const cardBtnStyle = btnColorMap[app.name] || styles.btnStyle;
                const bgGrad = gradMap[app.name] || styles.grad;

                if (isEnabled) {
                    htmlContent += `
                        <article class="app-selector-card">
                            <div class="icon-wrapper" style="background: ${bgGrad}; display: flex; align-items: center; justify-content: center; font-size: 2.5rem; height: 80px; width: 80px; margin: 0 auto 1rem; border-radius: 20px;">
                                ${app.icon}
                            </div>
                            <h3>${app.name}</h3>
                            <p style="font-size: 0.85rem; margin-bottom: 1rem;" class="secondary">${app.desc || ''}</p>
                            <div class="card-action">
                                <a href="${app.url}" role="button" class="${styles.btnClass}" style="width: 100%; text-align: center; display: block; border-radius: 10px; font-weight: 600; padding: 0.6rem 1rem; ${cardBtnStyle}">Buka Aplikasi</a>
                            </div>
                        </article>
                    `;
                } else {
                    htmlContent += `
                        <article class="app-selector-card" style="opacity: 0.55; position: relative;">
                            <div class="icon-wrapper" style="background: ${bgGrad}; display: flex; align-items: center; justify-content: center; font-size: 2.5rem; height: 80px; width: 80px; margin: 0 auto 1rem; border-radius: 20px; filter: grayscale(1);">
                                ${app.icon}
                            </div>
                            <h3>${app.name}</h3>
                            <p style="font-size: 0.85rem; margin-bottom: 1rem;" class="secondary">${app.desc || ''}</p>
                            <div class="card-action">
                                <button class="outline secondary" style="width: 100%; text-align: center; display: block; border-radius: 10px; font-weight: 600; padding: 0.6rem 1rem; cursor: not-allowed; pointer-events: none;" disabled>Segera Hadir</button>
                            </div>
                        </article>
                    `;
                }
            });

            // Tutup grid dan section
            htmlContent += `
                    </div>
                </section>
            `;
        });

        wrapperEl.innerHTML = htmlContent;
    }
};

window.TMPT_UI = UIModule;
// Jalankan sesegera mungkin
window.TMPT_UI.initTheme();

// Inisialisasi awal dan saat HTMX memuat komponen baru
document.addEventListener('DOMContentLoaded', () => {
    if (window.TMPT_UI) window.TMPT_UI.initAppLauncher();
});
document.addEventListener('htmx:afterSwap', () => {
    if (window.TMPT_UI) window.TMPT_UI.initAppLauncher();
});

// Close launcher and profile menu when clicking outside
document.addEventListener('click', (e) => {
    const launchers = document.querySelectorAll('#tmpt-app-launcher-menu, .tmpt-app-launcher-menu-class');
    const profiles = document.querySelectorAll('#tmpt-profile-menu, .tmpt-profile-menu-class');
    
    if (!e.target.closest('.tmpt-app-launcher')) {
        launchers.forEach(l => {
            if (l.style.display !== 'none') l.style.display = 'none';
        });
    }
    if (!e.target.closest('.tmpt-profile-dropdown')) {
        profiles.forEach(p => {
            if (p.style.display !== 'none') p.style.display = 'none';
        });
    }
});
