/**
 * TMPT Base64 - URL to Base64
 */

export function encodeURLToBase64(url) {
    if (!url) return '';
    return btoa(encodeURIComponent(url));
}

export function decodeBase64ToURL(base64) {
    if (!base64) return '';
    try {
        return decodeURIComponent(atob(base64.trim().replace(/\s/g, '')));
    } catch (e) {
        throw new Error('Gagal mendecode Base64 ke URL: ' + e.message);
    }
}
