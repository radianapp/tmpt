/**
 * TMPT PWA Module
 * Handles Service Worker registration and PWA installation.
 */

// Deteksi otomatis environment berdasarkan domain
const isLocalhost = Boolean(
    window.location.hostname === 'localhost' ||
    window.location.hostname === '[::1]' ||
    window.location.hostname.match(/^127(?:\.(?:25[0-5]|2[0-4][0-9]|[01]?[0-9][0-9]?)){3}$/)
);

// PWA hanya aktif di production (domain selain localhost)
const ENABLE_PWA = !isLocalhost;

if (ENABLE_PWA && 'serviceWorker' in navigator) {
    window.addEventListener('load', () => {
        navigator.serviceWorker.register('/sw.js')
            .then(reg => {
                console.log('SW Registered!', reg);
                
                // Cek update
                reg.onupdatefound = () => {
                    const installingWorker = reg.installing;
                    installingWorker.onstatechange = () => {
                        if (installingWorker.state === 'installed') {
                            if (navigator.serviceWorker.controller) {
                                console.log('New content available; please refresh.');
                            }
                        }
                    };
                };
            })
            .catch(err => console.log('SW Reg failed:', err));
    });
} else if (!ENABLE_PWA && 'serviceWorker' in navigator) {
    // Jika dimatikan, pastikan kita UNREGISTER yang sudah ada
    navigator.serviceWorker.getRegistrations().then(registrations => {
        for (let registration of registrations) {
            registration.unregister();
            console.log('SW Unregistered successfully.');
        }
    });
}
