/**
 * TMPT Base64 - Basic Auth Decoder/Encoder
 */

export function decodeBasicAuth(headerValue) {
    if (!headerValue) return null;
    const base64Part = headerValue.trim().startsWith('Basic ')
        ? headerValue.trim().slice(6)
        : headerValue.trim();

    try {
        const decoded = atob(base64Part);
        const colonIndex = decoded.indexOf(':');

        if (colonIndex === -1) {
            throw new Error('Format tidak valid: tidak ada pemisah ":"');
        }

        return {
            username: decoded.slice(0, colonIndex),
            password: decoded.slice(colonIndex + 1),
        };
    } catch (e) {
        throw new Error('Gagal mendecode Basic Auth: ' + e.message);
    }
}

export function encodeBasicAuth(username, password) {
    return `Basic ${btoa(`${username}:${password}`)}`;
}
