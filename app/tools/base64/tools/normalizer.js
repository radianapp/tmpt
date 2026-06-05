/**
 * TMPT Base64 - Normalizer
 */

export function normalizeBase64(input, options = {}) {
    if (!input) return '';
    const { urlSafe = false, addPadding = true, lineWrap = 0 } = options;

    let normalized = input.replace(/\s/g, ''); // Hapus semua whitespace

    // Konversi karakter
    if (urlSafe) {
        normalized = normalized.replace(/\+/g, '-').replace(/\//g, '_').replace(/=/g, '');
    } else {
        normalized = normalized.replace(/-/g, '+').replace(/_/g, '/');
    }

    // Perbaiki padding
    if (addPadding && !urlSafe) {
        const rem = normalized.length % 4;
        if (rem === 2) normalized += '==';
        else if (rem === 3) normalized += '=';
    }

    // Line wrapping
    if (lineWrap > 0) {
        const matches = normalized.match(new RegExp(`.{1,${lineWrap}}`, 'g'));
        if (matches) {
            normalized = matches.join('\n');
        }
    }

    return normalized;
}
