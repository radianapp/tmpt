const CACHE_NAME = 'tmpt-cache-v2.9';
const ASSETS = [
  '/',
  '/404.html',
  '/app/auth/login/index.html',
  '/app/auth/login/login.css',
  '/app/auth/settings/index.html',
  '/app/auth/settings/settings.css',
  '/app/auth/setup/index.html',
  '/app/auth/setup/setup.css',
  '/app/dev/code/code.css',
  '/app/dev/code/code.js',
  '/app/dev/code/editor.html',
  '/app/dev/code/index.html',
  '/app/dev/code/js/editor-init.js',
  '/app/dev/code/js/fsaa.js',
  '/app/dev/code/js/github.js',
  '/app/dev/code/js/python-worker.js',
  '/app/dev/code/js/runner.js',
  '/app/dev/code/vendor/jszip.min.js',
  '/app/dev/markdown/index.html',
  '/app/dev/markdown/markdown.css',
  '/app/dev/markdown/markdown.js',
  '/app/dev/markdown/vendor/katex.min.css',
  '/app/dev/markdown/vendor/katex.min.js',
  '/app/dev/markdown/vendor/marked.min.js',
  '/app/dev/markdown/vendor/mermaid.min.js',
  '/app/dev/markdown/vendor/purify.min.js',
  '/app/feedback/feedback-widget.css',
  '/app/feedback/feedback-widget.js',
  '/app/feedback/vendor/html2canvas.min.js',
  '/app/home/contact/index.html',
  '/app/home/faq/index.html',
  '/app/home/harga/index.html',
  '/app/home/help/index.html',
  '/app/home/privacy/index.html',
  '/app/home/pro/index.html',
  '/app/home/sponsor/donors.js',
  '/app/home/sponsor/index.html',
  '/app/home/sponsor/sponsor.css',
  '/app/home/tentang/index.html',
  '/app/home/terms/index.html',
  '/app/index.html',
  '/app/kerja/berkas/berkas.css',
  '/app/kerja/berkas/index.html',
  '/app/kerja/berkas/js/backup.js',
  '/app/kerja/berkas/js/berkas-db.js',
  '/app/kerja/berkas/js/dashboard.js',
  '/app/kerja/berkas/js/fsaa.js',
  '/app/kerja/berkas/js/opfs.js',
  '/app/kerja/berkas/js/search.js',
  '/app/kerja/catatan/index.html',
  '/app/kerja/hitung/hitung_chart.js',
  '/app/kerja/hitung/hitung_converter.js',
  '/app/kerja/hitung/hitung_formula.js',
  '/app/kerja/hitung/hitung_storage.js',
  '/app/kerja/hitung/hitung_template.js',
  '/app/kerja/hitung/index.html',
  '/app/kerja/hitung/test_formula.js',
  '/app/kerja/hitung/vendor/58eaeb4e52248a5c75936c6f4c33a370.svg',
  '/app/kerja/hitung/vendor/chart.js',
  '/app/kerja/hitung/vendor/xlsx.full.min.js',
  '/app/kerja/hitung/vendor/xspreadsheet.css',
  '/app/kerja/hitung/vendor/xspreadsheet.js',
  '/app/kerja/papan/editor.html',
  '/app/kerja/papan/index.html',
  '/app/kerja/papan/js/compat.js',
  '/app/kerja/papan/js/export.js',
  '/app/kerja/papan/js/history.js',
  '/app/kerja/papan/js/papan-core.js',
  '/app/kerja/papan/js/renderer.js',
  '/app/kerja/papan/js/viewport.js',
  '/app/kerja/papan/papan.css',
  '/app/kerja/pdf/compress.html',
  '/app/kerja/pdf/extract-pages.html',
  '/app/kerja/pdf/index.html',
  '/app/kerja/pdf/jpg-to-pdf.html',
  '/app/kerja/pdf/js/pdf-core.js',
  '/app/kerja/pdf/js/pdf-preview.js',
  '/app/kerja/pdf/js/tools/compress.js',
  '/app/kerja/pdf/js/tools/extract-pages.js',
  '/app/kerja/pdf/js/tools/jpg-to-pdf.js',
  '/app/kerja/pdf/js/tools/merge.js',
  '/app/kerja/pdf/js/tools/organize.js',
  '/app/kerja/pdf/js/tools/page-numbers.js',
  '/app/kerja/pdf/js/tools/pdf-to-jpg.js',
  '/app/kerja/pdf/js/tools/protect.js',
  '/app/kerja/pdf/js/tools/remove-pages.js',
  '/app/kerja/pdf/js/tools/rotate.js',
  '/app/kerja/pdf/js/tools/sign.js',
  '/app/kerja/pdf/js/tools/split.js',
  '/app/kerja/pdf/js/tools/unlock.js',
  '/app/kerja/pdf/js/tools/watermark.js',
  '/app/kerja/pdf/merge.html',
  '/app/kerja/pdf/organize.html',
  '/app/kerja/pdf/page-numbers.html',
  '/app/kerja/pdf/pdf-to-jpg.html',
  '/app/kerja/pdf/pdf.css',
  '/app/kerja/pdf/protect.html',
  '/app/kerja/pdf/remove-pages.html',
  '/app/kerja/pdf/rotate.html',
  '/app/kerja/pdf/sign.html',
  '/app/kerja/pdf/split.html',
  '/app/kerja/pdf/unlock.html',
  '/app/kerja/pdf/vendor/crypto-aes-decrypt.js',
  '/app/kerja/pdf/vendor/crypto-aes.js',
  '/app/kerja/pdf/vendor/crypto-rc4.js',
  '/app/kerja/pdf/vendor/jszip.min.js',
  '/app/kerja/pdf/vendor/pdf-decrypt.js',
  '/app/kerja/pdf/vendor/pdf-encrypt.js',
  '/app/kerja/pdf/vendor/pdf-lib.min.js',
  '/app/kerja/pdf/vendor/pdf.min.js',
  '/app/kerja/pdf/vendor/pdf.worker.min.js',
  '/app/kerja/pdf/vendor/sortable.min.js',
  '/app/kerja/pdf/watermark.html',
  '/app/kerja/vault/index.html',
  '/app/tools/favicon/checker.html',
  '/app/tools/favicon/converter.html',
  '/app/tools/favicon/css/favicon.css',
  '/app/tools/favicon/emoji.html',
  '/app/tools/favicon/index.html',
  '/app/tools/favicon/js/checker.js',
  '/app/tools/favicon/js/converter.js',
  '/app/tools/favicon/js/emoji-data.js',
  '/app/tools/favicon/js/emoji-gen.js',
  '/app/tools/favicon/js/favicon-core.js',
  '/app/tools/favicon/js/logo-gen.js',
  '/app/tools/favicon/js/text-gen.js',
  '/app/tools/favicon/logo.html',
  '/app/tools/favicon/panduan/apa-itu-favicon.html',
  '/app/tools/favicon/panduan/cara-install.html',
  '/app/tools/favicon/panduan/favicon-framework.html',
  '/app/tools/favicon/panduan/favicon-pwa.html',
  '/app/tools/favicon/panduan/index.html',
  '/app/tools/favicon/panduan/svg-favicon.html',
  '/app/tools/favicon/panduan/troubleshooting.html',
  '/app/tools/favicon/panduan/ukuran-favicon.html',
  '/app/tools/favicon/text.html',
  '/app/tools/index.html',
  '/app/tools/license-generator/.keys/private.jwk.json',
  '/app/tools/license-generator/.keys/public.jwk.json',
  '/app/tools/license-generator/generate.js',
  '/app/tools/license-generator/keygen.js',
  '/app/tools/license-generator/package.json',
  '/app/tools/license-generator/test-recovery.js',
  '/app/tools/license-generator/test.js',
  '/app/tools/notes-encryptor/index.html',
  '/app/tools/password-checker/index.html',
  '/app/tools/password-gen/index.html',
  '/assets/css/catat.css',
  '/assets/img/hero-preview.png',
  '/assets/img/icon-192.png',
  '/assets/img/icon-512.png',
  '/assets/img/icon_brankas.png',
  '/assets/img/icon_catat.png',
  '/assets/img/icon_daftar.png',
  '/assets/img/logo.png',
  '/assets/img/logo.svg',
  '/favicon-48.png',
  '/favicon-512.png',
  '/favicon.png',
  '/index.html',
  '/manifest.json',
  '/shared/app-bridge.js',
  '/shared/app-header.html',
  '/shared/app.css',
  '/shared/apps.json',
  '/shared/auth.js',
  '/shared/backup.js',
  '/shared/broadcast.js',
  '/shared/checker.js',
  '/shared/crypto.js',
  '/shared/db.js',
  '/shared/footer.html',
  '/shared/generator.js',
  '/shared/header.html',
  '/shared/htmx.min.js',
  '/shared/incognito.js',
  '/shared/license.js',
  '/shared/opfs.js',
  '/shared/pico.min.css',
  '/shared/pricing.json',
  '/shared/pwa.js',
  '/shared/recovery-code.js',
  '/shared/seo-config.js',
  '/shared/seo-schemas.js',
  '/shared/seo.js',
  '/shared/theme/cyberpunk.css',
  '/shared/theme/midnight-gold.css',
  '/shared/theme/nord.css',
  '/shared/theme/tmpt.css',
  '/shared/ui.js',
  '/shared/vault-switcher.html',
  '/shared/vault.js',
  '/shared/vendor/jszip.min.js',
  '/shared/version.js'
];

// Install Event
self.addEventListener('install', event => {
  self.skipWaiting();
  event.waitUntil(
    caches.open(CACHE_NAME).then(cache => {
      console.log('SW: Caching static assets');
      return cache.addAll(ASSETS);
    })
  );
});

// Activate Event
self.addEventListener('activate', event => {
  event.waitUntil(self.clients.claim());
  event.waitUntil(
    caches.keys().then(keys => {
      return Promise.all(
        keys.filter(key => key !== CACHE_NAME)
            .map(key => caches.delete(key))
      );
    })
  );
  self.clients.claim();
});

// Fetch Event
self.addEventListener('fetch', event => {
  event.respondWith(
    caches.match(event.request).then(cachedResponse => {
      // Return cached response if found, otherwise fetch from network
      return cachedResponse || fetch(event.request).then(fetchResponse => {
        // Optionally cache new successful requests
        if (fetchResponse.status === 200 && event.request.method === 'GET') {
          return caches.open(CACHE_NAME).then(cache => {
            cache.put(event.request, fetchResponse.clone());
            return fetchResponse;
          });
        }
        return fetchResponse;
      });
    }).catch(() => {
        // Offline fallback if needed
    })
  );
});
