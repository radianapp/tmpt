/**
 * TMPT Base64 - HTML Encoder
 */

export function encodeHTMLToBase64(html) {
    if (!html) return { base64: '', dataUri: '', iframeCode: '' };
    
    const bytes = new TextEncoder().encode(html);
    let binary = '';
    for (let i = 0; i < bytes.byteLength; i++) {
        binary += String.fromCharCode(bytes[i]);
    }
    const base64 = btoa(binary);
    const dataUri = `data:text/html;charset=utf-8;base64,${base64}`;
    const iframeCode = `<iframe src="${dataUri}" width="100%" height="500px" frameborder="0"></iframe>`;
    
    return { base64, dataUri, iframeCode };
}

export function decodeBase64ToHTML(base64String) {
    if (!base64String) return '';
    const clean = base64String.replace(/\s/g, '').split(',').pop();
    const binary = atob(clean);
    const bytes = new Uint8Array(binary.length);
    for (let i = 0; i < binary.length; i++) {
        bytes[i] = binary.charCodeAt(i);
    }
    return new TextDecoder().decode(bytes);
}
