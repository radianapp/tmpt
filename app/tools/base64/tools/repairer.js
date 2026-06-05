/**
 * TMPT Base64 - Repairer
 */

export function repairBase64(input) {
    if (!input) return { repaired: '', repairs: [], isValid: false };
    const repairs = [];
    let repaired  = input;

    // 1. Hapus whitespace
    const noWs = repaired.replace(/\s/g, '');
    if (noWs !== repaired) { repairs.push('Whitespace dihapus'); repaired = noWs; }

    // 2. Konversi URL-safe ke standard
    const std = repaired.replace(/-/g, '+').replace(/_/g, '/');
    if (std !== repaired) { repairs.push('Karakter -_ dikonversi ke +/'); repaired = std; }

    // 3. Hapus karakter non-Base64
    const valid = repaired.replace(/[^A-Za-z0-9+/=]/g, '');
    if (valid !== repaired) {
        repairs.push(`${repaired.length - valid.length} karakter tidak valid dihapus`);
        repaired = valid;
    }

    // 4. Perbaiki padding
    const rem = repaired.replace(/=/g, '').length % 4;
    if (rem === 2) { repaired += '=='; repairs.push('Padding "==" ditambahkan'); }
    if (rem === 3) { repaired += '=';  repairs.push('Padding "=" ditambahkan');  }

    // 5. Validasi final
    let isValid = false;
    try { atob(repaired); isValid = true; }
    catch (e) { repairs.push('⚠️ Masih tidak valid setelah repair — string mungkin terpotong'); }

    return { repaired, repairs, isValid };
}
