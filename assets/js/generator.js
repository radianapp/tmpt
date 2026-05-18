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
    function generateRandom(length = 16, options = { uppercase: true, numbers: true, symbols: true, lowercase: true }) {
        let charset = '';
        let requiredChars = [];

        if (options.lowercase !== false) {
            charset += CHARS.lowercase;
            requiredChars.push(CHARS.lowercase[getSecureRandomInt(CHARS.lowercase.length)]);
        }
        if (options.uppercase) {
            charset += CHARS.uppercase;
            requiredChars.push(CHARS.uppercase[getSecureRandomInt(CHARS.uppercase.length)]);
        }
        if (options.numbers) {
            charset += CHARS.numbers;
            requiredChars.push(CHARS.numbers[getSecureRandomInt(CHARS.numbers.length)]);
        }
        if (options.symbols) {
            charset += CHARS.symbols;
            requiredChars.push(CHARS.symbols[getSecureRandomInt(CHARS.symbols.length)]);
        }

        // Pastikan minimal ada charset jika user uncheck semua
        if (charset.length === 0) {
            charset = CHARS.lowercase;
            requiredChars.push(CHARS.lowercase[getSecureRandomInt(CHARS.lowercase.length)]);
        }

        let password = requiredChars.join('');
        const charsetLength = charset.length;

        while (password.length < length) {
            password += charset[getSecureRandomInt(charsetLength)];
        }

        if (password.length > length) {
            password = password.slice(0, length);
        }

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
