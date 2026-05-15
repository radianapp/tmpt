window.TMPT_VERSION = {
    major: 2,
    minor: 0,
    patch: 1,
    full: "2.0.1",
    codename: "Pico Rise",
    last_update: "2026-05-15"
};

// Fungsi untuk mengisi versi ke elemen HTML
function populateVersion() {
    const versionElements = document.querySelectorAll('.tmpt-version');
    versionElements.forEach(el => {
        el.textContent = `v${window.TMPT_VERSION.full}`;
    });
}

// Jalankan saat DOM siap
document.addEventListener('DOMContentLoaded', populateVersion);

// Jalankan setiap kali HTMX melakukan swap konten (untuk footer dll)
document.addEventListener('htmx:afterSwap', populateVersion);
