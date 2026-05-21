/**
 * TMPT Password Checker Module
 * Menghitung estimasi kekuatan (entropi) kata sandi secara lokal.
 */

window.TMPT_Checker = (function() {
    function calculateStrength(password) {
        if (!password) {
            return { score: 0, entropy: 0, feedback: 'Mulai ketik kata sandi Anda...', timeToCrack: '-' };
        }
        
        let entropy = 0;
        let poolSize = 0;
        
        if (/[a-z]/.test(password)) poolSize += 26;
        if (/[A-Z]/.test(password)) poolSize += 26;
        if (/[0-9]/.test(password)) poolSize += 10;
        if (/[^A-Za-z0-9]/.test(password)) poolSize += 32;
        
        if (poolSize === 0) poolSize = 1;
        
        entropy = password.length * Math.log2(poolSize);
        
        // Penalti untuk pola yang sangat umum (Dictionary attack sederhana)
        const commonWords = ['password', '123456', 'qwerty', 'admin', 'rahasia', 'sayang', 'cinta'];
        const lowerPass = password.toLowerCase();
        for (let word of commonWords) {
            if (lowerPass.includes(word)) {
                entropy -= 20; // Hukuman berat untuk kata sandi pasaran
            }
        }
        
        // Penalti untuk karakter berulang (misal: aaaaa)
        if (/(.)\1{2,}/.test(password)) {
            entropy -= 15;
        }

        // Penalti jika hanya angka atau hanya huruf
        if (/^[a-zA-Z]+$/.test(password) || /^[0-9]+$/.test(password)) {
            entropy -= 10; 
        }
        
        if (entropy < 0) entropy = 0;
        
        let score = 0;
        let feedback = '';
        let timeToCrack = '';
        
        if (entropy < 28) {
            score = 1; // Merah
            feedback = 'Sangat Lemah. Tambahkan variasi huruf, angka, atau simbol.';
            timeToCrack = 'Instan - Beberapa detik';
        } else if (entropy < 36) {
            score = 2; // Kuning
            feedback = 'Lemah. Coba buat lebih panjang minimal 12 karakter.';
            timeToCrack = 'Beberapa jam - hari';
        } else if (entropy < 60) {
            score = 3; // Hijau
            feedback = 'Kuat. Kata sandi ini cukup aman.';
            timeToCrack = 'Bertahun-tahun';
        } else {
            score = 4; // Biru
            feedback = 'Sangat Kuat! Sangat sulit untuk diretas.';
            timeToCrack = 'Berabad-abad';
        }
        
        return {
            score,
            entropy: Math.round(entropy),
            feedback,
            timeToCrack
        };
    }

    return {
        calculateStrength
    };
})();
