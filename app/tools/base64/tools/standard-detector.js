/**
 * TMPT Base64 - Standard Detector
 */

export function detectBase64Standard(input) {
    if (!input) return [];
    const clean          = input.trim().replace(/\s/g, '');
    const hasPlus        = clean.includes('+');
    const hasSlash       = clean.includes('/');
    const hasMinus       = clean.includes('-');
    const hasUnderscore  = clean.includes('_');
    const hasPadding     = /=+$/.test(clean);
    const lines          = input.split('\n');
    const lineLength     = lines.length > 0 ? lines[0].trim().length : 0;
    const results        = [];

    if (/^[A-Z2-7=]+$/.test(clean))
        results.push({ standard: 'Base32', confidence: 95 });

    if (/^[A-Za-z0-9]+$/.test(clean) && !hasPadding)
        results.push({ standard: 'Base62 / URL-safe (tanpa padding)', confidence: 80 });

    if ((hasPlus || hasSlash) || hasPadding) {
        if (lineLength === 64) results.push({ standard: 'RFC 1421 (PEM)', confidence: 90 });
        if (lineLength === 76) results.push({ standard: 'RFC 2045 (MIME)', confidence: 90 });
        results.push({ standard: 'RFC 4648 Base64 (Standard)', confidence: 75 });
    }

    if ((hasMinus || hasUnderscore) && !hasPadding)
        results.push({ standard: 'RFC 4648 Base64url (JWT/URL)', confidence: 95 });

    return results.sort((a, b) => b.confidence - a.confidence);
}
