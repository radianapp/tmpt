/**
 * TMPT Base64 - PDF Codec
 */

async function lazyLoadPDFjs() {
    if (window.pdfjsLib) return window.pdfjsLib;

    return new Promise((resolve, reject) => {
        const script = document.createElement('script');
        script.src = '/app/kerja/pdf/vendor/pdf.min.js';
        script.onload = () => {
            window.pdfjsLib.GlobalWorkerOptions.workerSrc = '/app/kerja/pdf/vendor/pdf.worker.min.js';
            resolve(window.pdfjsLib);
        };
        script.onerror = () => reject(new Error('Gagal memuat library PDF.js'));
        document.head.appendChild(script);
    });
}

export async function decodeBase64ToPDF(base64String) {
    const pdfjsLib = await lazyLoadPDFjs();
    const clean = base64String.replace(/\s/g, '').split(',').pop();
    const pdfData = atob(clean);
    const uint8 = new Uint8Array(pdfData.length);
    for (let i = 0; i < pdfData.length; i++) {
        uint8[i] = pdfData.charCodeAt(i);
    }
    return pdfjsLib.getDocument({ data: uint8 }).promise;
}

export function pdfToBase64(file) {
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
