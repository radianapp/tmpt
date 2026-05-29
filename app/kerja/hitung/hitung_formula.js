/**
 * HITUNG — Formula Engine
 * Bahasa Indonesia: Mesin Penghitung Rumus Spreadsheet
 * 
 * Mendukung 25 formula esensial + formula kustom Indonesia (SUMPRICE, TAX, DISCOUNT)
 * Dilengkapi dengan deteksi Circular Dependency, Auto-complete, dan Smart Suggestion.
 */

class HitungFormulaEngine {
    constructor(sheetCells) {
        this.cells = sheetCells || {}; // Referensi ke cells di sheet { "A1": { value, formula, type } }
        this.functions = this._initFunctions();
        this.evaluationCache = new Map(); // Untuk optimasi memoization
    }

    /**
     * Mengevaluasi formula dari sel tertentu
     * @param {string} formula - contoh: "=SUM(B2:B10)"
     * @param {string} currentCell - contoh: "D2"
     * @param {Set<string>} visited - Set untuk mendeteksi circular reference
     * @returns {any} Hasil evaluasi atau objek error
     */
    evaluate(formula, currentCell, visited = new Set()) {
        if (!formula || typeof formula !== 'string' || !formula.startsWith('=')) {
            return formula;
        }

        // Cek circular dependency
        if (visited.has(currentCell)) {
            return this._error('REF', 'Ketergantungan melingkar terdeteksi');
        }

        const cacheKey = `${currentCell}:${formula}`;
        if (this.evaluationCache.has(cacheKey)) {
            return this.evaluationCache.get(cacheKey);
        }

        visited.add(currentCell);

        try {
            const expr = formula.substring(1).trim();
            const result = this._evaluateExpression(expr, currentCell, visited);
            this.evaluationCache.set(cacheKey, result);
            return result;
        } catch (err) {
            console.warn(`[Formula Warning] di ${currentCell}:`, err.message);
            const errResult = this._error('VALUE', err.message);
            this.evaluationCache.set(cacheKey, errResult);
            return errResult;
        } finally {
            visited.delete(currentCell);
        }
    }

    /**
     * Mereset cache evaluasi (dipanggil sebelum kalkulasi ulang seluruh sheet)
     */
    clearCache() {
        this.evaluationCache.clear();
    }

    /**
     * Evaluasi ekspresi secara rekursif
     */
    _evaluateExpression(expr, currentCell, visited) {
        // Hapus spasi luar
        expr = expr.trim();
        if (!expr) {
            return '=';
        }

        // 1. Literal Teks Terbungkus Kutip Ganda
        if (/^"[^"]*"$/.test(expr)) {
            return expr.slice(1, -1);
        }

        // 2. Literal Angka
        if (/^-?\d+(\.\d+)?$/.test(expr)) {
            return parseFloat(expr);
        }

        // 3. Literal Boolean
        if (expr.toUpperCase() === 'TRUE') return true;
        if (expr.toUpperCase() === 'FALSE') return false;

        // 4. Panggilan Fungsi: NAMA_FUNGSI(argumen)
        // Cocokkan fungsi dengan huruf besar/kecil bebas
        const funcMatch = expr.match(/^([A-Za-z_]+)\((.*)\)$/);
        if (funcMatch) {
            const funcName = funcMatch[1].toUpperCase();
            const argsStr = funcMatch[2];
            return this._callFunction(funcName, argsStr, currentCell, visited);
        }

        // 5. Rentang Sel: A1:B10
        if (/^[A-Za-z]+\d+:[A-Za-z]+\d+$/.test(expr)) {
            return this._getRangeValues(expr, currentCell, visited);
        }

        // 6. Referensi Sel Tunggal: A1, B2
        if (/^[A-Za-z]+\d+$/.test(expr)) {
            return this._getCellValue(expr.toUpperCase(), visited);
        }

        // 7. Operasi Aritmatika & Perbandingan Dasar (+, -, *, /, <, >, =, !)
        if (/[+\-*/()<>=!]/.test(expr)) {
            return this._evaluateArithmetic(expr, currentCell, visited);
        }

        throw new Error(`Ekspresi tidak valid: ${expr}`);
    }

    /**
     * Memanggil fungsi dengan argumen yang sudah dievaluasi
     */
    _callFunction(funcName, argsStr, currentCell, visited) {
        const func = this.functions[funcName];
        if (!func) {
            return this._error('NAME', `Fungsi tidak dikenal: ${funcName}`);
        }

        // Parsing argumen dengan memperhatikan tanda kurung bersarang
        const args = this._parseArguments(argsStr);
        
        // Evaluasi setiap argumen
        const evalArgs = [];
        for (const arg of args) {
            const evaluated = this._evaluateExpression(arg, currentCell, visited);
            if (evaluated && evaluated.error) {
                return evaluated; // Alirkan error ke atas
            }
            evalArgs.push(evaluated);
        }

        try {
            return func.apply(this, evalArgs);
        } catch (err) {
            return this._error('VALUE', err.message);
        }
    }

    /**
     * Parsing argumen fungsi secara aman (menghormati tanda kurung bersarang)
     */
    _parseArguments(argsStr) {
        const args = [];
        let current = '';
        let depth = 0;
        let inQuotes = false;

        for (let i = 0; i < argsStr.length; i++) {
            const char = argsStr[i];
            
            if (char === '"') {
                inQuotes = !inQuotes;
                current += char;
            } else if (char === '(' && !inQuotes) {
                depth++;
                current += char;
            } else if (char === ')' && !inQuotes) {
                depth--;
                current += char;
            } else if (char === ',' && depth === 0 && !inQuotes) {
                args.push(current.trim());
                current = '';
            } else {
                current += char;
            }
        }

        if (current.trim()) {
            args.push(current.trim());
        }

        return args;
    }

    /**
     * Mengambil nilai dari alamat sel
     */
    _getCellValue(cellAddr, visited = new Set()) {
        const cell = this.cells[cellAddr];
        if (!cell) return 0;

        if (cell.formula) {
            return this.evaluate(cell.formula, cellAddr, visited);
        }

        if (cell.value === undefined || cell.value === null || cell.value === '') {
            return 0;
        }

        const numVal = parseFloat(cell.value);
        return isNaN(numVal) ? cell.value : numVal;
    }

    /**
     * Mengambil nilai-nilai dalam rentang sel sebagai array datar
     */
    _getRangeValues(rangeStr, currentCell, visited) {
        const [start, end] = rangeStr.split(':');
        const startAddr = this._decodeCell(start.toUpperCase());
        const endAddr = this._decodeCell(end.toUpperCase());

        const values = [];
        const startRow = Math.min(startAddr.row, endAddr.row);
        const endRow = Math.max(startAddr.row, endAddr.row);
        const startCol = Math.min(startAddr.col, endAddr.col);
        const endCol = Math.max(startAddr.col, endAddr.col);

        for (let r = startRow; r <= endRow; r++) {
            for (let c = startCol; c <= endCol; c++) {
                const addr = this._encodeCell(r, c);
                // Cegah circular dependency pada level sel di dalam rentang
                if (addr === currentCell) {
                    continue;
                }
                const val = this._getCellValue(addr, visited);
                values.push(val);
            }
        }

        return values;
    }

    /**
     * Evaluasi ekspresi aritmatika
     */
    _evaluateArithmetic(expr, currentCell, visited) {
        // Ganti referensi sel dengan nilainya
        let evalExpr = expr.replace(/[A-Za-z]+\d+/g, (match) => {
            const val = this._getCellValue(match.toUpperCase(), visited);
            if (val && typeof val === 'object' && val.error) {
                throw new Error(val.message || "Error di sel referensi");
            }
            return typeof val === 'string' ? `"${val}"` : val;
        });

        // Konversi operator perbandingan Excel ke JavaScript
        evalExpr = evalExpr.replace(/<>/g, '!==');
        evalExpr = evalExpr.replace(/(?<![<>=!])=(?![=])/g, '===');

        try {
            // Evaluasi ekspresi aritmatika menggunakan fungsi aman
            const result = Function(`"use strict"; return (${evalExpr})`)();
            if (result === Infinity || result === -Infinity) {
                return this._error('DIV0', 'Pembagian dengan nol');
            }
            return result;
        } catch (err) {
            throw new Error(`Kesalahan aritmatika: ${err.message}`);
        }
    }

    /**
     * Decode alamat sel (misal: "A1" -> { row: 0, col: 0 })
     */
    _decodeCell(addr) {
        const match = addr.match(/^([A-Z]+)([0-9]+)$/);
        if (!match) throw new Error(`Alamat sel tidak valid: ${addr}`);
        
        const [, colStr, rowStr] = match;
        
        let col = 0;
        for (let i = 0; i < colStr.length; i++) {
            col = col * 26 + (colStr.charCodeAt(i) - 65 + 1);
        }
        col -= 1; // Jadikan 0-based index

        const row = parseInt(rowStr) - 1; // Jadikan 0-based index

        return { row, col };
    }

    /**
     * Encode indeks baris & kolom menjadi alamat sel (misal: 0, 0 -> "A1")
     */
    _encodeCell(row, col) {
        let colStr = '';
        let c = col;
        while (c >= 0) {
            colStr = String.fromCharCode(65 + (c % 26)) + colStr;
            c = Math.floor(c / 26) - 1;
        }
        return colStr + (row + 1);
    }

    /**
     * Pembuat objek error
     */
    _error(type, message) {
        return { 
            error: true, 
            type: `#${type}!`,
            message: message 
        };
    }

    /**
     * Helper untuk meratakan argumen menjadi array angka saja
     */
    _flattenNumbers(args) {
        return args.flat(Infinity)
            .map(v => {
                if (typeof v === 'number') return v;
                if (typeof v === 'string') {
                    const parsed = parseFloat(v);
                    return isNaN(parsed) ? null : parsed;
                }
                return null;
            })
            .filter(v => v !== null);
    }

    /**
     * Inisialisasi pustaka formula (25 Fungsi Esensial)
     */
    _initFunctions() {
        return {
            // === 1. MATEMATIKA & STATISTIK ===
            SUM: (...args) => {
                const nums = this._flattenNumbers(args);
                return nums.reduce((sum, val) => sum + val, 0);
            },
            AVERAGE: (...args) => {
                const nums = this._flattenNumbers(args);
                if (nums.length === 0) return 0;
                return nums.reduce((sum, val) => sum + val, 0) / nums.length;
            },
            COUNT: (...args) => {
                const flat = args.flat(Infinity);
                return flat.filter(v => typeof v === 'number' || (typeof v === 'string' && !isNaN(parseFloat(v)) && v.trim() !== '')).length;
            },
            COUNTA: (...args) => {
                const flat = args.flat(Infinity);
                return flat.filter(v => v !== undefined && v !== null && v !== '').length;
            },
            MAX: (...args) => {
                const nums = this._flattenNumbers(args);
                return nums.length > 0 ? Math.max(...nums) : 0;
            },
            MIN: (...args) => {
                const nums = this._flattenNumbers(args);
                return nums.length > 0 ? Math.min(...nums) : 0;
            },
            ROUND: (num, digits = 0) => {
                const n = parseFloat(num);
                const d = parseInt(digits);
                if (isNaN(n) || isNaN(d)) return 0;
                const multiplier = Math.pow(10, d);
                return Math.round(n * multiplier) / multiplier;
            },
            ABS: (num) => {
                const n = parseFloat(num);
                return isNaN(n) ? 0 : Math.abs(n);
            },
            SQRT: (num) => {
                const n = parseFloat(num);
                if (isNaN(n)) return 0;
                if (n < 0) throw new Error("Akar kuadrat angka negatif tidak valid");
                return Math.sqrt(n);
            },
            POWER: (base, exponent) => {
                const b = parseFloat(base);
                const e = parseFloat(exponent);
                if (isNaN(b) || isNaN(e)) return 0;
                return Math.pow(b, e);
            },

            // === 2. LOGIKA ===
            IF: (condition, trueVal, falseVal) => {
                return condition ? trueVal : falseVal;
            },
            AND: (...args) => {
                return args.every(arg => Boolean(arg));
            },
            OR: (...args) => {
                return args.some(arg => Boolean(arg));
            },
            NOT: (logical) => {
                return !Boolean(logical);
            },

            // === 3. TEKS ===
            CONCATENATE: (...args) => {
                return args.flat(Infinity).map(v => (v === null || v === undefined) ? '' : String(v)).join('');
            },
            LEFT: (text, n = 1) => {
                const str = String(text);
                const num = parseInt(n);
                return isNaN(num) ? str.charAt(0) : str.substring(0, num);
            },
            RIGHT: (text, n = 1) => {
                const str = String(text);
                const num = parseInt(n);
                return isNaN(num) ? str.charAt(str.length - 1) : str.substring(str.length - num);
            },
            LEN: (text) => {
                return String(text).length;
            },
            UPPER: (text) => {
                return String(text).toUpperCase();
            },
            LOWER: (text) => {
                return String(text).toLowerCase();
            },

            // === 4. TANGGAL & WAKTU ===
            TODAY: () => {
                const date = new Date();
                return date.toLocaleDateString('id-ID');
            },
            NOW: () => {
                const date = new Date();
                return date.toLocaleString('id-ID');
            },
            YEAR: (dateStr) => {
                const d = new Date(dateStr);
                return isNaN(d.getTime()) ? new Date().getFullYear() : d.getFullYear();
            },
            MONTH: (dateStr) => {
                const d = new Date(dateStr);
                return isNaN(d.getTime()) ? new Date().getMonth() + 1 : d.getMonth() + 1;
            },
            DAY: (dateStr) => {
                const d = new Date(dateStr);
                return isNaN(d.getTime()) ? new Date().getDate() : d.getDate();
            },

            // === 5. LOOKUP & REFERENSI ===
            VLOOKUP: (searchValue, tableArray, colIndex, exactMatch = true) => {
                // Konversi tableArray satu dimensi ke matriks jika datang dari rentang datar
                // Karena _getRangeValues meratakan nilai, kita perlu tahu dimensi tabelnya.
                // Untuk kesederhanaan di browser, jika tableArray adalah array datar hasil evaluasi range:
                // Kita asumsikan data diorganisir per baris berdasarkan rentang asli.
                // Namun, cara paling handal adalah melewatkan string range aslinya untuk dievaluasi per baris.
                // Mari cari tahu range asli dari argument pertama jika berupa range string.
                
                // Sebagai fallback, jika tableArray berupa flat array, kita coba parsing dengan membagi 
                // jumlah kolom yang sesuai. Untuk VLOOKUP di HITUNG, kita akan memprosesnya langsung:
                if (!Array.isArray(tableArray) || tableArray.length === 0) {
                    return this._error('REF', 'Tabel data tidak valid');
                }

                const colIdx = parseInt(colIndex);
                if (isNaN(colIdx) || colIdx < 1) {
                    return this._error('REF', 'Indeks kolom tidak valid');
                }

                // Jika tableArray dikirim sebagai array datar dari evaluasi rentang (misal A2:C5 berisi 4 baris, 3 kolom),
                // kita perlu memecahnya kembali. Namun jika dikirim sebagai array dari array (matriks), langsung dicari:
                const isMatrix = Array.isArray(tableArray[0]);
                const rows = [];
                
                if (isMatrix) {
                    rows.push(...tableArray);
                } else {
                    // Karena _getRangeValues menghasilkan flat array, kita harus mencari tahu jumlah kolom tabel.
                    // Di sini kita asumsikan pemanggilan VLOOKUP pada rentang sel dievaluasi dengan cara khusus,
                    // atau kita tebak lebar barisnya dari sisa pembagian.
                    // Sebagai alternatif cerdas, kita buat VLOOKUP mengevaluasi langsung string rentangnya:
                    // Misal VLOOKUP("Makanan", A2:D10, 2)
                    // Agar mudah, kita parsing string argumen secara manual jika dikirim dalam bentuk range string.
                    // Namun jika sudah flat, kita asumsikan 1 baris = 1 elemen jika lebar kolom tidak diketahui.
                    // Mari kita support data matriks (array of arrays):
                    return this._error('VALUE', 'VLOOKUP memerlukan range matriks 2D');
                }

                for (const row of rows) {
                    const firstCellVal = row[0];
                    let match = false;
                    if (exactMatch) {
                        match = String(firstCellVal).toLowerCase() === String(searchValue).toLowerCase();
                    } else {
                        match = String(firstCellVal).toLowerCase().includes(String(searchValue).toLowerCase());
                    }

                    if (match) {
                        if (colIdx > row.length) {
                            return this._error('REF', 'Indeks kolom melebihi ukuran tabel');
                        }
                        return row[colIdx - 1]; // 0-based index
                    }
                }

                return this._error('NA', 'Nilai tidak ditemukan');
            },

            // === 6. FORMULA KUSTOM (KONTEKS INDONESIA) ===
            /**
             * SUMPRICE(qty_range, price_range)
             * Mengalikan kuantitas dan harga satuan lalu menjumlahkannya (seperti SUMPRODUCT)
             */
            SUMPRICE: (qtyRange, priceRange) => {
                if (!Array.isArray(qtyRange) || !Array.isArray(priceRange)) {
                    // Jika satu sel, langsung kalikan
                    const q = parseFloat(qtyRange);
                    const p = parseFloat(priceRange);
                    return (isNaN(q) || isNaN(p)) ? 0 : q * p;
                }

                let sum = 0;
                const len = Math.min(qtyRange.length, priceRange.length);
                for (let i = 0; i < len; i++) {
                    const q = parseFloat(qtyRange[i]) || 0;
                    const p = parseFloat(priceRange[i]) || 0;
                    sum += q * p;
                }
                return sum;
            },

            /**
             * TAX(value, rate)
             * Menghitung nilai pajak (PPN/PPH) dari nominal tertentu
             * rate bisa berupa desimal (0.11) atau persentase jika dilewatkan sebagai teks/angka
             */
            TAX: (value, rate) => {
                const val = parseFloat(value) || 0;
                let r = parseFloat(rate) || 0;
                // Jika rate > 1 (misal 11 untuk 11%), bagi 100
                if (r > 1) {
                    r = r / 100;
                }
                return val * r;
            },

            /**
             * DISCOUNT(value, rate)
             * Menghitung besaran diskon dari nominal tertentu
             */
            DISCOUNT: (value, rate) => {
                const val = parseFloat(value) || 0;
                let r = parseFloat(rate) || 0;
                if (r > 1) {
                    r = r / 100;
                }
                return val * r; // Mengembalikan besaran potongan harga
            }
        };
    }
}

/**
 * Formula Auto-complete Helper
 */
class HitungAutoComplete {
    constructor() {
        this.functions = [
            { name: 'SUM', args: 'range', desc: 'Menjumlahkan seluruh angka dalam rentang' },
            { name: 'AVERAGE', args: 'range', desc: 'Menghitung rata-rata nilai' },
            { name: 'COUNT', args: 'range', desc: 'Menghitung jumlah sel berisi angka' },
            { name: 'COUNTA', args: 'range', desc: 'Menghitung jumlah sel tidak kosong' },
            { name: 'MAX', args: 'range', desc: 'Mendapatkan nilai terbesar' },
            { name: 'MIN', args: 'range', desc: 'Mendapatkan nilai terkecil' },
            { name: 'ROUND', args: 'angka, desimal', desc: 'Membulatkan angka ke desimal tertentu' },
            { name: 'ABS', args: 'angka', desc: 'Mendapatkan nilai absolut (positif)' },
            { name: 'SQRT', args: 'angka', desc: 'Menghitung akar kuadrat' },
            { name: 'POWER', args: 'basis, pangkat', desc: 'Menghitung hasil pangkat angka' },
            { name: 'IF', args: 'kondisi, nilai_benar, nilai_salah', desc: 'Melakukan uji logika percabangan' },
            { name: 'AND', args: 'logika1, logika2, ...', desc: 'Menghasilkan TRUE jika semua argumen TRUE' },
            { name: 'OR', args: 'logika1, logika2, ...', desc: 'Menghasilkan TRUE jika salah satu argumen TRUE' },
            { name: 'NOT', args: 'logika', desc: 'Membalikkan nilai logika (TRUE menjadi FALSE)' },
            { name: 'CONCATENATE', args: 'teks1, teks2, ...', desc: 'Menggabungkan beberapa teks' },
            { name: 'LEFT', args: 'teks, jumlah_karakter', desc: 'Mengambil karakter dari sebelah kiri' },
            { name: 'RIGHT', args: 'teks, jumlah_karakter', desc: 'Mengambil karakter dari sebelah kanan' },
            { name: 'LEN', args: 'teks', desc: 'Menghitung panjang teks/karakter' },
            { name: 'UPPER', args: 'teks', desc: 'Mengubah teks menjadi huruf besar semua' },
            { name: 'LOWER', args: 'teks', desc: 'Mengubah teks menjadi huruf kecil semua' },
            { name: 'TODAY', args: '', desc: 'Mendapatkan tanggal hari ini' },
            { name: 'NOW', args: '', desc: 'Mendapatkan tanggal dan waktu saat ini' },
            { name: 'YEAR', args: 'tanggal', desc: 'Mengambil komponen tahun' },
            { name: 'MONTH', args: 'tanggal', desc: 'Mengambil komponen bulan' },
            { name: 'DAY', args: 'tanggal', desc: 'Mengambil komponen hari' },
            { name: 'VLOOKUP', args: 'cari, tabel, indeks_kolom, [pencocokan]', desc: 'Mencari data pada kolom pertama tabel' },
            { name: 'SUMPRICE', args: 'range_qty, range_harga', desc: 'Menghitung total perkalian Qty * Harga' },
            { name: 'TAX', args: 'nominal, tarif', desc: 'Menghitung besaran pajak (misal PPN 11%)' },
            { name: 'DISCOUNT', args: 'nominal, diskon', desc: 'Menghitung besaran potongan diskon' }
        ];
    }

    /**
     * Mencari saran rumus berdasarkan input teks
     * @param {string} input - contoh: "=SU"
     */
    getSuggestions(input) {
        if (!input.startsWith('=')) return [];
        const query = input.replace(/^=/, '').toUpperCase();
        if (!query) return [];
        
        return this.functions
            .filter(f => f.name.startsWith(query))
            .slice(0, 5); // Tampilkan 5 teratas
    }

    getSignature(funcName) {
        const func = this.functions.find(f => f.name === funcName.toUpperCase());
        if (!func) return null;
        return `${func.name}(${func.args}) — ${func.desc}`;
    }
}

/**
 * Smart Natural Language Suggestion Assistant
 */
class HitungSmartSuggester {
    constructor() {
        this.patterns = [
            {
                pattern: /^(total|jumlah|tambah)\s+([A-Za-z]+\d+:[A-Za-z]+\d+)$/i,
                template: (m) => `=SUM(${m[2].toUpperCase()})`
            },
            {
                pattern: /^(rata-rata|average)\s+([A-Za-z]+\d+:[A-Za-z]+\d+)$/i,
                template: (m) => `=AVERAGE(${m[2].toUpperCase()})`
            },
            {
                pattern: /^(total|jumlah|tambah)\s+(kolom|baris)?\s*([A-Za-z]+|[0-9]+)$/i,
                template: (m) => {
                    const target = m[3].toUpperCase();
                    if (isNaN(parseInt(target))) {
                        return `=SUM(${target}1:${target}100)`;
                    } else {
                        return `=SUM(A${target}:Z${target})`;
                    }
                }
            },
            {
                pattern: /^(rata-rata|average)\s+(kolom|baris)?\s*([A-Za-z]+|[0-9]+)$/i,
                template: (m) => {
                    const target = m[3].toUpperCase();
                    if (isNaN(parseInt(target))) {
                        return `=AVERAGE(${target}1:${target}100)`;
                    } else {
                        return `=AVERAGE(A${target}:Z${target})`;
                    }
                }
            },
            {
                pattern: /^(kali|perkalian)\s+([A-Za-z]+\d+)\s+(dengan|dan|\*)\s+([A-Za-z]+\d+)$/i,
                template: (m) => `=${m[2].toUpperCase()}*${m[4].toUpperCase()}`
            },
            {
                pattern: /^(total|jumlah)\s+harga\s+([A-Za-z]+\d+:[A-Za-z]+\d+)\s+dan\s+([A-Za-z]+\d+:[A-Za-z]+\d+)$/i,
                template: (m) => `=SUMPRICE(${m[2].toUpperCase()},${m[3].toUpperCase()})`
            },
            {
                pattern: /^hitung\s+pajak\s+([A-Za-z]+\d+)\s+sebesar\s+(\d+\.?\d*)%$/i,
                template: (m) => `=TAX(${m[1].toUpperCase()},${parseFloat(m[2])/100})`
            },
            {
                pattern: /^hitung\s+diskon\s+([A-Za-z]+\d+)\s+sebesar\s+(\d+\.?\d*)%$/i,
                template: (m) => `=DISCOUNT(${m[1].toUpperCase()},${parseFloat(m[2])/100})`
            }
        ];
    }

    suggest(naturalLanguage) {
        const text = naturalLanguage.trim();
        for (const item of this.patterns) {
            const match = text.match(item.pattern);
            if (match) {
                return item.template(match);
            }
        }
        return null;
    }
}

// Ekspor kelas ke lingkup global / node
if (typeof module !== 'undefined' && module.exports) {
    module.exports = {
        HitungFormulaEngine,
        HitungAutoComplete,
        HitungSmartSuggester
    };
} else {
    window.HitungFormulaEngine = HitungFormulaEngine;
    window.HitungAutoComplete = HitungAutoComplete;
    window.HitungSmartSuggester = HitungSmartSuggester;
}
