window.TMPT_VERSION = {
    major: 1,
    minor: 0,
    patch: 1,
    full: "1.0.1",
    codename: "Release Candidate 1",
    last_update: "2026-05-21"
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


