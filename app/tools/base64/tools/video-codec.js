/**
 * TMPT Base64 - Video Codec
 */

export function decodeBase64ToVideo(base64String, mimeType = 'video/mp4') {
    const clean = base64String.replace(/\s/g, '').split(',').pop();
    const binaryString = atob(clean);
    const bytes = new Uint8Array(binaryString.length);
    for (let i = 0; i < binaryString.length; i++) {
        bytes[i] = binaryString.charCodeAt(i);
    }
    const blob = new Blob([bytes], { type: mimeType });
    return URL.createObjectURL(blob);
}

export function videoToBase64(file) {
    return new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = (e) => {
            const dataUri = e.target.result;
            const base64 = dataUri.split(',')[1];
            resolve({ base64, dataUri, mimeType: file.type, fileName: file.name });
        };
        reader.onerror = reject;
        reader.readAsDataURL(file);
    });
}
