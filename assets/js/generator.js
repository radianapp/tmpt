/**
 * TMPT Password Generator Module
 * Menyediakan fungsi untuk membuat password acak, memorable (passphrase), dan PIN.
 */

window.TMPT_Generator = (function() {
    
    // Konstanta karakter
    const CHARS = {
        lowercase: 'abcdefghijklmnopqrstuvwxyz',
        uppercase: 'ABCDEFGHIJKLMNOPQRSTUVWXYZ',
        numbers: '0123456789',
        symbols: '!@#$%^&*()_+~`|}{[]:;?><,./-='
    };

    // Daftar kata untuk Memorable Password (subset kecil untuk efisiensi)
    // Berisi kata dasar Bahasa Indonesia yang mudah diingat dan dieja
    const WORD_LIST = [
        "alam", "batu", "cahaya", "daun", "elang", "fajar", "gajah", "hutan", "ikan", "jalan",
        "kaca", "langit", "malam", "naga", "ombak", "padi", "qari", "raja", "satu", "tari",
        "uang", "vas", "waktu", "xilem", "yakin", "zaman", "angin", "bintang", "cinta", "damai",
        "emas", "flora", "gunung", "harimau", "indah", "jauh", "kapal", "laut", "mata", "nusa",
        "obat", "pulau", "qatar", "roda", "suara", "tanah", "udara", "voli", "warna", "yoga",
        "zona", "api", "besi", "cincin", "dewa", "es", "foto", "gigi", "hati", "ibu",
        "jam", "kayu", "lilin", "madu", "nada", "obor", "pintu", "qada", "roti", "susu",
        "topi", "ubi", "villa", "wajah", "xenon", "yoyo", "zaitun", "air", "buku", "cermin", "kaka"
    ];

    /**
     * Helper untuk mendapatkan angka acak kriptografis
     * @param {number} max Batas atas (exclusive)
     * @returns {number} Angka acak dari 0 sampai max-1
     */
    function getSecureRandomInt(max) {
        const randomBuffer = new Uint32Array(1);
        window.crypto.getRandomValues(randomBuffer);
        return randomBuffer[0] % max;
    }

    /**
     * Generate password acak
     * @param {number} length Panjang password
     * @param {Object} options { uppercase: bool, numbers: bool, symbols: bool }
     */
    function generateRandom(length = 16, options = { uppercase: true, numbers: true, symbols: true }) {
        let charset = CHARS.lowercase;
        if (options.uppercase) charset += CHARS.uppercase;
        if (options.numbers) charset += CHARS.numbers;
        if (options.symbols) charset += CHARS.symbols;

        let password = '';
        const charsetLength = charset.length;
        
        // Pastikan setidaknya ada satu dari setiap karakter yang dipilih jika panjang memungkinkan
        if (length >= 4) {
            password += CHARS.lowercase[getSecureRandomInt(CHARS.lowercase.length)];
            if (options.uppercase) password += CHARS.uppercase[getSecureRandomInt(CHARS.uppercase.length)];
            if (options.numbers) password += CHARS.numbers[getSecureRandomInt(CHARS.numbers.length)];
            if (options.symbols) password += CHARS.symbols[getSecureRandomInt(CHARS.symbols.length)];
        }

        // Isi sisanya
        while (password.length < length) {
            password += charset[getSecureRandomInt(charsetLength)];
        }

        // Acak ulang (shuffle) agar karakter wajib tidak selalu di awal
        return password.split('').sort(() => 0.5 - Math.random()).join('');
    }

    /**
     * Generate memorable password (passphrase)
     * @param {number} wordCount Jumlah kata
     * @param {string} separator Pemisah antar kata (misal: '-' atau ' ')
     * @param {boolean} capitalize Apakah kata diawali huruf besar
     * @param {boolean} addNumber Apakah diakhiri dengan angka acak
     * @param {boolean} addSymbol Apakah ditambahkan simbol acak di akhir
     */
    function generateMemorable(wordCount = 4, separator = '-', capitalize = true, addNumber = true, addSymbol = false) {
        let words = [];
        for (let i = 0; i < wordCount; i++) {
            let word = WORD_LIST[getSecureRandomInt(WORD_LIST.length)];
            if (capitalize) {
                word = word.charAt(0).toUpperCase() + word.slice(1);
            }
            words.push(word);
        }
        
        let result = words.join(separator);
        if (addNumber) {
            result += separator + getSecureRandomInt(100);
        }
        if (addSymbol) {
            const syms = '!@#$%^&*';
            result += syms[getSecureRandomInt(syms.length)];
        }
        return result;
    }

    /**
     * Generate PIN angka
     * @param {number} length Panjang PIN
     */
    function generatePIN(length = 6) {
        let pin = '';
        for (let i = 0; i < length; i++) {
            pin += CHARS.numbers[getSecureRandomInt(CHARS.numbers.length)];
        }
        return pin;
    }

    return {
        generateRandom,
        generateMemorable,
        generatePIN
    };

})();
