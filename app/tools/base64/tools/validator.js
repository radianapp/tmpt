/**
 * TMPT Base64 - Validator
 */

export function validateBase64(input) {
    if (!input) return { isValid: false, issues: ['Input kosong'] };
    const clean = input.trim();
    const report = {
        isValid:          false,
        length:           clean.length,
        invalidChars:     [],
        paddingStatus:    'unknown',
        estimatedBytes:   0,
        detectedStandard: null,
        issues:           [],
    };

    // Cek karakter tidak valid
    const invalidMatches = [...clean.matchAll(/[^A-Za-z0-9+/=\-_\s]/g)];
    if (invalidMatches.length > 0) {
        report.invalidChars = invalidMatches.map(m => ({
            char: m[0], position: m.index, charCode: m[0].charCodeAt(0),
        }));
        report.issues.push(`${invalidMatches.length} karakter tidak valid`);
    }

    // Cek padding
    const noPad = clean.replace(/\s/g, '').replace(/=/g, '');
    const rem = noPad.length % 4;
    if (rem === 0) {
        report.paddingStatus = 'valid';
    } else if (rem === 1) {
        report.paddingStatus = 'invalid';
        report.issues.push('Panjang tidak valid (mod 4 = 1)');
    } else if (rem === 2) {
        report.paddingStatus = 'missing-double';
        report.issues.push('Padding "==" hilang');
    } else if (rem === 3) {
        report.paddingStatus = 'missing-single';
        report.issues.push('Padding "=" hilang');
    }

    // Estimasi ukuran hasil decode
    const padCount = (clean.match(/=/g) || []).length;
    report.estimatedBytes = Math.floor((noPad.length * 3) / 4) - padCount;

    // Konfirmasi decode
    try {
        const checkStr = noPad.replace(/-/g, '+').replace(/_/g, '/').padEnd(noPad.length + (4 - rem) % 4, '=');
        atob(checkStr);
        report.isValid = report.issues.length === 0;
    } catch (e) {
        report.isValid = false;
        report.issues.push('Decode gagal: ' + e.message);
    }

    return report;
}
