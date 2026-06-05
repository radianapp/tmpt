/**
 * TMPT Base64 - UUencoded Decoder
 */

export function decodeUUencoded(uuText) {
    if (!uuText) throw new Error('Input kosong');
    
    const lines  = uuText.trim().split('\n');
    const header = lines[0].match(/^begin\s+(\d+)\s+(.+)$/);
    if (!header) throw new Error('Format UUencoded tidak valid — baris "begin" tidak ditemukan');

    const filename = header[2].trim();
    const result   = [];

    for (let i = 1; i < lines.length; i++) {
        const line = lines[i].trim();
        if (line === '`' || line.startsWith('end') || line === '') break;

        const length = (line.charCodeAt(0) - 32) & 0x3F;
        const enc    = line.slice(1);

        for (let j = 0; j < enc.length - 1; j += 4) {
            const a = (enc.charCodeAt(j) - 32) & 0x3F;
            const b = (enc.charCodeAt(j+1) - 32) & 0x3F;
            const c = (enc.charCodeAt(j+2) - 32) & 0x3F;
            const d = (enc.charCodeAt(j+3) - 32) & 0x3F;
            
            result.push((a << 2) | (b >> 4));
            result.push(((b & 0xF) << 4) | (c >> 2));
            result.push(((c & 0x3) << 6) | d);
        }
        
        // Potong ke panjang yang benar
        while (result.length > length) {
            result.pop();
        }
    }

    return { filename, data: new Uint8Array(result) };
}
