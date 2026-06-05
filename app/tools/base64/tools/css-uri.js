/**
 * TMPT Base64 - CSS Data URI Converter
 */

export function convertToCSSDataURI(base64Data, mimeType, fileName = 'file') {
    if (!base64Data) return { cssSnippet: '', type: 'other' };
    
    const dataUri = base64Data.startsWith('data:') ? base64Data : `data:${mimeType};base64,${base64Data}`;
    const cleanMime = mimeType.toLowerCase();
    
    if (cleanMime.startsWith('image/')) {
        return {
            cssSnippet: `.bg-element {\n  background-image: url("${dataUri}");\n  background-repeat: no-repeat;\n  background-size: cover;\n}`,
            type: 'image'
        };
    } else if (cleanMime.startsWith('font/') || fileName.endsWith('.ttf') || fileName.endsWith('.woff') || fileName.endsWith('.woff2') || fileName.endsWith('.otf')) {
        let format = 'woff2';
        if (fileName.endsWith('.ttf')) format = 'truetype';
        else if (fileName.endsWith('.woff')) format = 'woff';
        else if (fileName.endsWith('.otf')) format = 'opentype';
        
        const fontName = fileName.split('.')[0] || 'MyFont';
        return {
            cssSnippet: `@font-face {\n  font-family: '${fontName}';\n  src: url("${dataUri}") format('${format}');\n  font-weight: normal;\n  font-style: normal;\n}`,
            type: 'font'
        };
    }
    
    return {
        cssSnippet: `/* CSS URI untuk ${fileName} */\n/* MIME: ${mimeType} */\n.custom-style {\n  background: url("${dataUri}");\n}`,
        type: 'other'
    };
}
