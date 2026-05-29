/**
 * HITUNG — Unit Test Formula Engine
 * Bahasa Indonesia: Uji Unit Mesin Formula HITUNG
 * 
 * Menjalankan pengujian otomatis untuk memvalidasi seluruh fungsi formula
 * dan mekanisme circular dependency pada mesin HITUNG.
 */

const { HitungFormulaEngine } = require('./hitung_formula.js');

function assert(condition, message) {
    if (!condition) {
        console.error(`❌ FAILED: ${message}`);
        process.exit(1);
    } else {
        console.log(`✅ PASSED: ${message}`);
    }
}

function runTests() {
    console.log("Memulai pengujian unit HITUNG Formula Engine...\n");

    // Mock data sel spreadsheet
    const cells = {
        'A1': { value: 10, type: 'number' },
        'A2': { value: 20, type: 'number' },
        'A3': { value: 30, type: 'number' },
        'B1': { formula: '=A1+A2', type: 'formula' }, // 30
        'B2': { formula: '=SUM(A1:A3)', type: 'formula' }, // 60
        'B3': { formula: '=AVERAGE(A1:A3)', type: 'formula' }, // 20
        'C1': { value: "Hello", type: 'text' },
        'C2': { value: "World", type: 'text' },
        'D1': { value: 5, type: 'number' },
        'D2': { value: 150000, type: 'number' },
        'E1': { value: 5, type: 'number' },
        'E2': { value: 10, type: 'number' }
    };

    const engine = new HitungFormulaEngine(cells);

    // 1. Uji Operasi Aritmatika Dasar & Referensi
    assert(engine.evaluate('=A1+A2', 'B1') === 30, "Aritmatika A1+A2");
    assert(engine.evaluate('=B2*2', 'B4') === 120, "Perkalian referensi formula B2*2");

    // 2. Uji Math & Stats Functions
    assert(engine.evaluate('=SUM(A1:A3)', 'B2') === 60, "Fungsi SUM(A1:A3)");
    assert(engine.evaluate('=AVERAGE(A1:A3)', 'B3') === 20, "Fungsi AVERAGE(A1:A3)");
    assert(engine.evaluate('=COUNT(A1:A3, C1)', 'B5') === 3, "Fungsi COUNT");
    assert(engine.evaluate('=COUNTA(A1:A3, C1)', 'B6') === 4, "Fungsi COUNTA");
    assert(engine.evaluate('=MAX(A1:A3)', 'B7') === 30, "Fungsi MAX");
    assert(engine.evaluate('=MIN(A1:A3)', 'B8') === 10, "Fungsi MIN");
    assert(engine.evaluate('=ROUND(3.14159, 2)', 'B9') === 3.14, "Fungsi ROUND");
    assert(engine.evaluate('=ABS(-50)', 'B10') === 50, "Fungsi ABS");
    assert(engine.evaluate('=SQRT(9)', 'B11') === 3, "Fungsi SQRT");
    assert(engine.evaluate('=POWER(2, 3)', 'B12') === 8, "Fungsi POWER");

    // 3. Uji Fungsi Logika
    assert(engine.evaluate('=IF(A1>5, "Besar", "Kecil")', 'B13') === "Besar", "Fungsi IF (True Case)");
    assert(engine.evaluate('=IF(A1>15, "Besar", "Kecil")', 'B14') === "Kecil", "Fungsi IF (False Case)");
    assert(engine.evaluate('=AND(TRUE, FALSE)', 'B15') === false, "Fungsi AND");
    assert(engine.evaluate('=OR(TRUE, FALSE)', 'B16') === true, "Fungsi OR");
    assert(engine.evaluate('=NOT(TRUE)', 'B17') === false, "Fungsi NOT");

    // 4. Uji Fungsi Teks
    assert(engine.evaluate('=CONCATENATE(C1, " ", C2)', 'B18') === "Hello World", "Fungsi CONCATENATE");
    assert(engine.evaluate('=LEFT(C1, 3)', 'B19') === "Hel", "Fungsi LEFT");
    assert(engine.evaluate('=RIGHT(C1, 2)', 'B20') === "lo", "Fungsi RIGHT");
    assert(engine.evaluate('=LEN(C1)', 'B21') === 5, "Fungsi LEN");
    assert(engine.evaluate('=UPPER(C1)', 'B22') === "HELLO", "Fungsi UPPER");
    assert(engine.evaluate('=LOWER(C1)', 'B23') === "hello", "Fungsi LOWER");

    // 5. Uji Fungsi Tanggal
    assert(typeof engine.evaluate('=TODAY()', 'B24') === 'string', "Fungsi TODAY");
    assert(engine.evaluate('=YEAR("2026-05-26")', 'B25') === 2026, "Fungsi YEAR");
    assert(engine.evaluate('=MONTH("2026-05-26")', 'B26') === 5, "Fungsi MONTH");
    assert(engine.evaluate('=DAY("2026-05-26")', 'B27') === 26, "Fungsi DAY");

    // 6. Uji Fungsi Kustom Indonesia
    assert(engine.evaluate('=SUMPRICE(A1:A2, E1:E2)', 'B28') === 250, "Fungsi SUMPRICE");
    assert(engine.evaluate('=SUMPRICE(A1:A2, D1:D1)', 'B31') === 50, "Fungsi SUMPRICE panjang tidak sama");
    assert(engine.evaluate('=TAX(D2, 11)', 'B29') === 16500, "Fungsi TAX (11%)");
    assert(engine.evaluate('=DISCOUNT(D2, 10)', 'B30') === 15000, "Fungsi DISCOUNT (10%)");

    // 7. Uji Deteksi Circular Dependency
    const circularCells = {
        'A1': { formula: '=B1', type: 'formula' },
        'B1': { formula: '=A1', type: 'formula' }
    };
    const circularEngine = new HitungFormulaEngine(circularCells);
    const circularResult = circularEngine.evaluate('=B1', 'A1');
    assert(circularResult && circularResult.error === true && circularResult.type === '#REF!', "Circular Dependency Detection");

    console.log("\n🎉 SELURUH PENGUJIAN FORMULA BERHASIL DIJALANKAN!");
}

runTests();
