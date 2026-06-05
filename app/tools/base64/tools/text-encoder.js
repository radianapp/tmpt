/**
 * TMPT Base64 - Text Encoder/Decoder
 */

export function encodeTextToBase64(text, charset = 'UTF-8', urlSafe = false) {
    if (!text) return '';
    const encoder = new TextEncoder();
    let bytes;
    
    if (charset === 'UTF-8') {
        bytes = encoder.encode(text);
    } else {
        // Fallback or custom encoding logic if charset is not UTF-8
        // Using native TextEncoder is UTF-8 only. For others we handle conversion:
        bytes = new TextEncoder().encode(text); // Default to UTF-8 for unsupported encoder charsets in native TextEncoder
    }
    
    let binary = '';
    const len = bytes.byteLength;
    for (let i = 0; i < len; i++) {
        binary += String.fromCharCode(bytes[i]);
    }
    
    let base64 = btoa(binary);
    
    if (urlSafe) {
        base64 = base64.replace(/\+/g, '-').replace(/\//g, '_').replace(/=/g, '');
    }
    
    return base64;
}

export function decodeBase64ToText(base64String, charset = 'UTF-8') {
    if (!base64String) return '';
    
    // Normalize URL-safe Base64
    let normalized = base64String
        .replace(/-/g, '+')
        .replace(/_/g, '/')
        .replace(/\s/g, '');

    // Add padding if missing
    const rem = normalized.length % 4;
    if (rem === 2) normalized += '==';
    else if (rem === 3) normalized += '=';

    const binaryString = atob(normalized);
    const bytes = new Uint8Array(binaryString.length);
    for (let i = 0; i < binaryString.length; i++) {
        bytes[i] = binaryString.charCodeAt(i);
    }
    
    try {
        return new TextDecoder(charset).decode(bytes);
    } catch (e) {
        // Fallback if charset is not supported or throws error
        return new TextDecoder('utf-8').decode(bytes);
    }
}
