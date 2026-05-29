/**
 * HITUNG — Converter Module
 * Bahasa Indonesia: Konverter Format Berkas HITUNG
 * 
 * Mengonversi struktur data antara format Native (.hitung),
 * Grid x-spreadsheet, Excel (.xlsx), dan CSV menggunakan pustaka SheetJS (XLSX).
 */

const HitungConverter = {
    /**
     * Mengonversi berkas format native .hitung ke struktur x-spreadsheet
     * @param {Object} hitungFile - Format Native
     * @returns {Array} Array of Sheet data untuk x-spreadsheet
     */
    hitungToXSpreadsheet(hitungFile) {
        if (!hitungFile || !hitungFile.sheets) return [];

        return hitungFile.sheets.map(sheet => {
            const xSheet = {
                name: sheet.name || "Sheet1",
                rows: {},
                cols: { len: sheet.cols || 26 },
                styles: [], // Array styles global x-spreadsheet
                merges: sheet.merges || [] // Salin range cell yang digabung
            };

            if (sheet.freeze) {
                xSheet.freeze = sheet.freeze;
            }
            if (sheet.autofilter) {
                xSheet.autofilter = sheet.autofilter;
                xSheet.filter = sheet.autofilter;
            }

            // Tambahkan baris kosong dasar
            const maxRow = sheet.rows || 100;
            xSheet.rows.len = maxRow;

            // Masukkan data sel
            if (sheet.cells) {
                Object.entries(sheet.cells).forEach(([addr, cell]) => {
                    const { row, col } = this._decodeCell(addr);
                    
                    if (this._isCellInsideMergeAndNotTopLeft(row, col, xSheet.merges)) {
                        return;
                    }
                    
                    if (!xSheet.rows[row]) {
                        xSheet.rows[row] = { cells: {} };
                    }

                    // Teks sel diisi formula (jika ada) atau value mentah
                    let text = "";
                    if (cell.formula) {
                        text = cell.formula;
                    } else if (cell.value !== undefined && cell.value !== null) {
                        text = String(cell.value);
                    }

                    const xCell = { text: text };

                    // Evaluasi value untuk ditampilkan
                    if (cell.display_value !== undefined) {
                        xCell.value = cell.display_value;
                    } else if (cell.value !== undefined) {
                        xCell.value = String(cell.value);
                    }

                    // Mapping style jika ada
                    if (cell.style) {
                        const xStyle = {};
                        if (cell.style.font) {
                            xStyle.font = {};
                            if (cell.style.font.bold) xStyle.font.bold = true;
                            if (cell.style.font.italic) xStyle.font.italic = true;
                            if (cell.style.font.color) xStyle.font.color = cell.style.font.color;
                            if (cell.style.font.size) xStyle.font.size = cell.style.font.size;
                            if (cell.style.font.name) xStyle.font.name = cell.style.font.name;
                        }
                        if (cell.style.background) {
                            xStyle.bgcolor = cell.style.background;
                            // Hitung kontras warna teks otomatis jika tidak didefinisikan secara eksplisit
                            if (!xStyle.font) xStyle.font = {};
                            if (!xStyle.font.color) {
                                xStyle.font.color = this._isLightColor(cell.style.background) ? "#111111" : "#ffffff";
                            }
                        }
                        if (cell.style.align) {
                            xStyle.align = cell.style.align;
                        }
                        if (cell.style.valign) {
                            xStyle.valign = cell.style.valign;
                        }
                        if (cell.style.textwrap) {
                            xStyle.textwrap = true;
                            xStyle.wrap = true;
                        }
                        if (cell.style.border) {
                            xStyle.border = cell.style.border;
                        }
                        if (cell.style.format) {
                            xStyle.format = cell.style.format;
                        }
                        if (cell.style.underline) {
                            xStyle.underline = true;
                        }
                        if (cell.style.strike) {
                            xStyle.strike = true;
                        }

                        // Cari indeks style yang mirip atau buat baru
                        let styleIdx = xSheet.styles.findIndex(s => JSON.stringify(s) === JSON.stringify(xStyle));
                        if (styleIdx === -1) {
                            xSheet.styles.push(xStyle);
                            styleIdx = xSheet.styles.length - 1;
                        }
                        xCell.style = styleIdx;
                    }

                    xSheet.rows[row].cells[col] = xCell;
                });
            }

            return xSheet;
        });
    },

    /**
     * Mengonversi dari struktur data x-spreadsheet kembali ke format native .hitung
     * @param {Array} xData - Output dari x-spreadsheet (grid.getData())
     * @param {Object} currentMetadata - Metadata berkas saat ini
     * @returns {Object} Format Native HitungFile
     */
    xSpreadsheetToHitung(xData, currentMetadata = {}) {
        const hitungFile = {
            format: "hitung-v1",
            created_at: currentMetadata.created_at || new Date().toISOString(),
            modified_at: new Date().toISOString(),
            app_version: "1.0.0",
            metadata: {
                title: currentMetadata.title || "Lembar Kerja Tanpa Judul",
                author: currentMetadata.author || "Pengguna TMPT"
            },
            settings: {
                locale: "id-ID",
                currency: "IDR",
                date_format: "DD/MM/YYYY"
            },
            sheets: []
        };

        xData.forEach((xSheet, idx) => {
            const sheet = {
                id: `sheet_${idx + 1}`,
                name: xSheet.name || `Sheet${idx + 1}`,
                index: idx,
                rows: xSheet.rows.len || 100,
                cols: xSheet.cols.len || 26,
                cells: {},
                merges: xSheet.merges || [] // Salin range cell yang digabung
            };

            if (xSheet.freeze) {
                sheet.freeze = xSheet.freeze;
            }
            const autofilter = xSheet.autofilter || xSheet.filter;
            if (autofilter) {
                sheet.autofilter = autofilter;
            }

            const styles = xSheet.styles || [];

            if (xSheet.rows) {
                Object.entries(xSheet.rows).forEach(([rowStr, rowData]) => {
                    const rowIdx = parseInt(rowStr);
                    if (isNaN(rowIdx) || rowStr === 'len') return;

                    if (rowData.cells) {
                        Object.entries(rowData.cells).forEach(([colStr, xCell]) => {
                            const colIdx = parseInt(colStr);
                            if (isNaN(colIdx)) return;

                            const addr = this._encodeCell(rowIdx, colIdx);
                            const cell = {};

                            // Jika sel berada di dalam area merge tapi bukan top-left, jangan simpan gaya/nilainya (hindari inner borders)
                            if (this._isCellInsideMergeAndNotTopLeft(rowIdx, colIdx, sheet.merges)) {
                                return;
                            }

                            const hasText = xCell.text !== undefined && xCell.text !== null && xCell.text !== "";
                            const hasStyle = xCell.style !== undefined;
                            if (!hasText && !hasStyle) return; // Lewati sel kosong tanpa format

                            if (hasText) {
                                // Deteksi formula
                                if (xCell.text.startsWith('=')) {
                                    cell.formula = xCell.text;
                                    cell.type = "formula";
                                    // Simpan value hasil hitung
                                    cell.value = xCell.value;
                                    cell.display_value = xCell.value;
                                } else {
                                    const val = xCell.text;
                                    const num = parseFloat(val);
                                    if (!isNaN(num) && /^-?\d+(\.\d+)?$/.test(val.trim())) {
                                        cell.value = num;
                                        cell.type = "number";
                                    } else if (val.toUpperCase() === 'TRUE' || val.toUpperCase() === 'FALSE') {
                                        cell.value = val.toUpperCase() === 'TRUE';
                                        cell.type = "boolean";
                                    } else {
                                        cell.value = val;
                                        cell.type = "text";
                                    }
                                    cell.display_value = val;
                                }
                            }

                            // Ekstrak styling dari indeks styles global x-spreadsheet
                            if (xCell.style !== undefined && styles[xCell.style]) {
                                const xStyle = styles[xCell.style];
                                cell.style = {};
                                
                                if (xStyle.font) {
                                    cell.style.font = {};
                                    if (xStyle.font.bold) cell.style.font.bold = true;
                                    if (xStyle.font.italic) cell.style.font.italic = true;
                                    if (xStyle.font.color) cell.style.font.color = xStyle.font.color;
                                    if (xStyle.font.size) cell.style.font.size = xStyle.font.size;
                                    if (xStyle.font.name) cell.style.font.name = xStyle.font.name;
                                }
                                if (xStyle.bgcolor) {
                                    cell.style.background = xStyle.bgcolor;
                                }
                                if (xStyle.align) {
                                    cell.style.align = xStyle.align;
                                }
                                if (xStyle.valign) {
                                    cell.style.valign = xStyle.valign;
                                }
                                if (xStyle.textwrap || xStyle.wrap) {
                                    cell.style.textwrap = true;
                                }
                                if (xStyle.border) {
                                    cell.style.border = xStyle.border;
                                }
                                if (xStyle.format) {
                                    cell.style.format = xStyle.format;
                                }
                                if (xStyle.underline) {
                                    cell.style.underline = true;
                                }
                                if (xStyle.strike) {
                                    cell.style.strike = true;
                                }
                            }

                            sheet.cells[addr] = cell;
                        });
                    }
                });
            }

            hitungFile.sheets.push(sheet);
        });

        return hitungFile;
    },

    /**
     * Membaca berkas Excel (.xlsx) atau CSV menggunakan SheetJS dan mengonversinya ke native .hitung
     * @param {ArrayBuffer} arrayBuffer
     * @param {string} fileName
     * @returns {Object} Native HitungFile
     */
    importFromExcel(arrayBuffer, fileName) {
        const workbook = XLSX.read(arrayBuffer, { type: 'array', cellNF: true, cellStyles: true });
        
        const hitungFile = {
            format: "hitung-v1",
            created_at: new Date().toISOString(),
            modified_at: new Date().toISOString(),
            app_version: "1.0.0",
            metadata: {
                title: fileName.replace(/\.[^/.]+$/, ""), // Bersihkan ekstensi berkas
                description: `Diimpor dari berkas ${fileName}`
            },
            settings: {
                locale: "id-ID",
                currency: "IDR",
                date_format: "DD/MM/YYYY"
            },
            sheets: []
        };

        workbook.SheetNames.forEach((sheetName, idx) => {
            const worksheet = workbook.Sheets[sheetName];
            
            // Cari tahu dimensi rentang sel asli Excel
            const ref = worksheet['!ref'] || "A1:Z100";
            const [startRange, endRange] = ref.split(':');
            const endAddr = this._decodeCell(endRange || "Z100");

            const sheet = {
                id: `sheet_${idx + 1}`,
                name: sheetName,
                index: idx,
                rows: Math.max(100, endAddr.row + 1),
                cols: Math.max(26, endAddr.col + 1),
                cells: {}
            };

            // Iterasi seluruh sel SheetJS
            Object.entries(worksheet).forEach(([addr, cell]) => {
                if (addr.startsWith('!')) return; // Lewati kunci metadata (!ref, !merges, dll)

                const hitungCell = {};
                
                // Cek formula Excel
                if (cell.f) {
                    hitungCell.formula = '=' + cell.f;
                    hitungCell.type = "formula";
                    hitungCell.value = cell.v;
                } else {
                    hitungCell.value = cell.v;
                    if (cell.t === 'n') {
                        hitungCell.type = "number";
                    } else if (cell.t === 'b') {
                        hitungCell.type = "boolean";
                    } else {
                        hitungCell.type = "text";
                    }
                }
                
                hitungCell.display_value = cell.w || (cell.v !== undefined ? String(cell.v) : "");
                sheet.cells[addr] = hitungCell;
            });

            hitungFile.sheets.push(sheet);
        });

        return hitungFile;
    },

    /**
     * Mengekspor native .hitung ke file Excel Blob (.xlsx) menggunakan SheetJS
     * @param {Object} hitungFile - Native format
     * @returns {Blob} XLSX Blob
     */
    exportToExcel(hitungFile) {
        const wb = XLSX.utils.book_new();

        hitungFile.sheets.forEach(sheet => {
            const ws = {};
            let maxRow = 0;
            let maxCol = 0;

            // Masukkan sel satu per satu
            Object.entries(sheet.cells).forEach(([addr, cell]) => {
                const wsCell = {};
                if (cell.formula) {
                    wsCell.f = cell.formula.substring(1); // Potong tanda =
                    wsCell.v = cell.value;
                } else {
                    wsCell.v = cell.value;
                }

                // Tentukan tipe data
                if (typeof wsCell.v === 'number') {
                    wsCell.t = 'n';
                } else if (typeof wsCell.v === 'boolean') {
                    wsCell.t = 'b';
                } else {
                    wsCell.t = 's';
                }

                ws[addr] = wsCell;

                // Hitung dimensi
                const decoded = this._decodeCell(addr);
                if (decoded.row > maxRow) maxRow = decoded.row;
                if (decoded.col > maxCol) maxCol = decoded.col;
            });

            // Set dimensi rentang sel di excel
            const startRange = "A1";
            const endRange = this._encodeCell(maxRow, maxCol);
            ws['!ref'] = `${startRange}:${endRange}`;

            XLSX.utils.book_append_sheet(wb, ws, sheet.name);
        });

        const wbout = XLSX.write(wb, { bookType: 'xlsx', type: 'array' });
        return new Blob([wbout], { type: "application/octet-stream" });
    },

    /**
     * Mengekspor sheet pertama dalam berkas .hitung ke CSV text
     */
    exportToCSV(hitungFile) {
        if (!hitungFile || hitungFile.sheets.length === 0) return "";
        
        const sheet = hitungFile.sheets[0];
        const matrix = [];
        
        // Cari dimensi
        let maxRow = 0;
        let maxCol = 0;
        Object.keys(sheet.cells).forEach(addr => {
            const decoded = this._decodeCell(addr);
            if (decoded.row > maxRow) maxRow = decoded.row;
            if (decoded.col > maxCol) maxCol = decoded.col;
        });

        // Bangun baris-baris
        for (let r = 0; r <= maxRow; r++) {
            const row = [];
            for (let c = 0; c <= maxCol; c++) {
                const addr = this._encodeCell(r, c);
                const cell = sheet.cells[addr];
                row.push(cell && cell.value !== undefined ? `"${String(cell.value).replace(/"/g, '""')}"` : "");
            }
            matrix.push(row.join(','));
        }

        return matrix.join('\n');
    },

    _isCellInsideMergeAndNotTopLeft(row, col, merges) {
        if (!merges || !Array.isArray(merges)) return false;
        
        for (const rangeStr of merges) {
            if (typeof rangeStr !== 'string') continue;
            const parts = rangeStr.split(':');
            if (parts.length !== 2) continue;
            
            try {
                const sCell = this._decodeCell(parts[0]);
                const eCell = this._decodeCell(parts[1]);
                
                const startRow = Math.min(sCell.row, eCell.row);
                const endRow = Math.max(sCell.row, eCell.row);
                const startCol = Math.min(sCell.col, eCell.col);
                const endCol = Math.max(sCell.col, eCell.col);
                
                if (row >= startRow && row <= endRow && col >= startCol && col <= endCol) {
                    if (row !== startRow || col !== startCol) {
                        return true;
                    }
                }
            } catch (e) {
                // Abaikan jika koordinat salah
            }
        }
        return false;
    },

    /**
     * Helpers untuk decode/encode sel (sama seperti di formula engine)
     */
    _decodeCell(addr) {
        const match = addr.toUpperCase().match(/^([A-Z]+)([0-9]+)$/);
        if (!match) throw new Error(`Alamat sel tidak valid: ${addr}`);
        
        const [, colStr, rowStr] = match;
        
        let col = 0;
        for (let i = 0; i < colStr.length; i++) {
            col = col * 26 + (colStr.charCodeAt(i) - 65 + 1);
        }
        col -= 1;

        const row = parseInt(rowStr) - 1;

        return { row, col };
    },

    _encodeCell(row, col) {
        let colStr = '';
        let c = col;
        while (c >= 0) {
            colStr = String.fromCharCode(65 + (c % 26)) + colStr;
            c = Math.floor(c / 26) - 1;
        }
        return colStr + (row + 1);
    },

    _isLightColor(hexColor) {
        if (!hexColor) return false;
        let hex = hexColor.replace('#', '');
        if (hex.length === 3) {
            hex = hex[0] + hex[0] + hex[1] + hex[1] + hex[2] + hex[2];
        }
        if (hex.length !== 6) return false;
        const r = parseInt(hex.substring(0, 2), 16);
        const g = parseInt(hex.substring(2, 4), 16);
        const b = parseInt(hex.substring(4, 6), 16);
        const yiq = ((r * 299) + (g * 587) + (b * 114)) / 1000;
        return yiq >= 128;
    }
};

window.HitungConverter = HitungConverter;
