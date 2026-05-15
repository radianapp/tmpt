/**
 * TMPT PWA Module
 * Handles Service Worker registration and PWA installation.
 */

// Untuk pengembangan, kita matikan dulu agar tidak ada masalah cache
const ENABLE_PWA = false;

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
