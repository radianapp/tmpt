/**
 * TMPT Base64 - Gzip Checker
 */

export async function checkAndDecompressGzip(base64String) {
    if (!base64String) return { isGzip: false, message: 'Input kosong' };
    
    try {
        const binaryString = atob(base64String.replace(/\s/g, '').replace(/-/g, '+').replace(/_/g, '/'));
        const bytes = Uint8Array.from(binaryString, c => c.charCodeAt(0));

        // Cek gzip magic bytes: 1F 8B
        if (bytes[0] !== 0x1F || bytes[1] !== 0x8B) {
            return { isGzip: false, message: 'Bukan gzip (magic bytes 1F 8B tidak ditemukan)' };
        }

        // Gunakan DecompressionStream API native — tidak perlu library!
        const stream = new Response(bytes).body.pipeThrough(new DecompressionStream('gzip'));
        const decompressed = await new Response(stream).arrayBuffer();
        const text = new TextDecoder().decode(decompressed);

        return {
            isGzip:           true,
            originalSize:     bytes.length,
            decompressedSize: decompressed.byteLength,
            ratio:            ((1 - bytes.length / decompressed.byteLength) * 100).toFixed(1) + '%',
            content:          text,
        };
    } catch (e) {
        return { isGzip: false, message: 'Gagal mendekode atau mendekompresi: ' + e.message };
    }
}
