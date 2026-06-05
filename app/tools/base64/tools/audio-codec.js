/**
 * TMPT Base64 - Audio Codec
 */

export function decodeBase64ToAudio(base64String, mimeType = 'audio/mp3') {
    const clean = base64String.replace(/\s/g, '').split(',').pop();
    const binaryString = atob(clean);
    const bytes = new Uint8Array(binaryString.length);
    for (let i = 0; i < binaryString.length; i++) {
        bytes[i] = binaryString.charCodeAt(i);
    }
    const blob = new Blob([bytes], { type: mimeType });
    return URL.createObjectURL(blob);
}

export function audioToBase64(file) {
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
