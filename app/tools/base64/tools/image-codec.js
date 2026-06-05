/**
 * TMPT Base64 - Image Codec
 */

export function parseDataUri(dataUri) {
    const match = dataUri.match(/^data:([^;]+)(?:;([^,]+))?,(.+)$/);
    if (!match) throw new Error('Format Data URI tidak valid');

    const [, mimeType, encoding, data] = match;
    return { mimeType, encoding: encoding || 'base64', data, isBase64: encoding === 'base64' };
}

export function decodeBase64ToImage(input) {
    const src = input.startsWith('data:')
        ? input
        : `data:image/png;base64,${input}`;

    return new Promise((resolve, reject) => {
        const img = new Image();
        img.onload = () => resolve({ img, src, width: img.naturalWidth, height: img.naturalHeight });
        img.onerror = () => reject(new Error('Gagal memuat gambar dari Base64'));
        img.src = src;
    });
}

function loadImage(file) {
    return new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = (e) => {
            const img = new Image();
            img.onload = () => resolve(img);
            img.onerror = reject;
            img.src = e.target.result;
        };
        reader.onerror = reject;
        reader.readAsDataURL(file);
    });
}

export async function imageToBase64WithOptions(file, options = {}) {
    const { maxWidth, maxHeight, quality = 0.85, outputFormat } = options;
    const img = await loadImage(file);
    const canvas = document.createElement('canvas');
    const ctx = canvas.getContext('2d');

    let { width, height } = img;
    if (maxWidth && width > maxWidth) {
        height *= maxWidth / width;
        width = maxWidth;
    }
    if (maxHeight && height > maxHeight) {
        width *= maxHeight / height;
        height = maxHeight;
    }

    canvas.width = Math.round(width);
    canvas.height = Math.round(height);
    ctx.drawImage(img, 0, 0, canvas.width, canvas.height);

    const mime = outputFormat || file.type || 'image/png';
    const dataUri = canvas.toDataURL(mime, quality);
    return { base64: dataUri.split(',')[1], dataUri, width: canvas.width, height: canvas.height };
}
