/**
 * TMPT Base64 - HEX Codec
 */

export function base64ToHex(base64String, separator = '', uppercase = true) {
    if (!base64String) return '';
    const clean = base64String.replace(/\s/g, '').replace(/-/g, '+').replace(/_/g, '/');
    const binaryString = atob(clean);
    const hexArray = Array.from(binaryString).map(c => {
        const hex = c.charCodeAt(0).toString(16).padStart(2, '0');
        return uppercase ? hex.toUpperCase() : hex;
    });
    return hexArray.join(separator);
}

export function hexToBase64(hexString) {
    if (!hexString) return '';
    const cleanHex = hexString
        .replace(/0x/gi, '')
        .replace(/[^0-9A-Fa-f]/g, '');

    if (cleanHex.length % 2 !== 0) {
        throw new Error('Panjang hex string harus genap');
    }

    const bytes = [];
    for (let i = 0; i < cleanHex.length; i += 2) {
        bytes.push(parseInt(cleanHex.slice(i, i + 2), 16));
    }
    return btoa(String.fromCharCode(...bytes));
}
