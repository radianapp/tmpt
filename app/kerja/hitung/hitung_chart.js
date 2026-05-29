/**
 * HITUNG — Chart Visualization Module
 * Bahasa Indonesia: Modul Visualisasi Grafik HITUNG
 * 
 * Mengintegrasikan Chart.js untuk menampilkan grafik interaktif (Line, Bar, Pie)
 * berdasarkan rentang data sel yang dipilih pada lembar kerja.
 */

const HitungChart = {
    activeCharts: new Map(), // Menyimpan instansi chart aktif berdasarkan Chart ID

    /**
     * Mengekstrak data dari rentang sel untuk Chart.js
     * @param {Object} sheetCells - Objek cells native format
     * @param {string} rangeStr - Contoh: "A1:B5"
     * @param {boolean} useFirstRowAsHeaders
     * @param {boolean} useFirstColAsLabels
     * @returns {Object} { labels, datasets }
     */
    extractChartData(sheetCells, rangeStr, useFirstRowAsHeaders = true, useFirstColAsLabels = true) {
        const [start, end] = rangeStr.split(':');
        const startAddr = this._decodeCell(start.toUpperCase());
        const endAddr = this._decodeCell(end.toUpperCase());

        const startRow = Math.min(startAddr.row, endAddr.row);
        const endRow = Math.max(startAddr.row, endAddr.row);
        const startCol = Math.min(startAddr.col, endAddr.col);
        const endCol = Math.max(startAddr.col, endAddr.col);

        // 1. Ekstrak data mentah menjadi matriks 2D
        const matrix = [];
        for (let r = startRow; r <= endRow; r++) {
            const row = [];
            for (let c = startCol; c <= endCol; c++) {
                const addr = this._encodeCell(r, c);
                const cell = sheetCells[addr];
                let val = 0;
                
                if (cell) {
                    val = cell.value !== undefined ? cell.value : 0;
                    // Jika angka berupa teks, konversi ke float
                    if (typeof val === 'string') {
                        const parsed = parseFloat(val);
                        if (!isNaN(parsed)) val = parsed;
                    }
                }
                row.push(val);
            }
            matrix.push(row);
        }

        if (matrix.length === 0 || matrix[0].length === 0) {
            return { labels: [], datasets: [] };
        }

        let labels = [];
        let datasets = [];
        let dataStartRow = 0;
        let dataStartCol = 0;
        let headers = [];

        // 2. Ambil Header Baris Pertama (Nama Dataset)
        if (useFirstRowAsHeaders) {
            dataStartRow = 1;
            const headerRow = matrix[0];
            const colOffset = useFirstColAsLabels ? 1 : 0;
            for (let c = colOffset; c < headerRow.length; c++) {
                headers.push(String(headerRow[c]) || `Seri ${c - colOffset + 1}`);
            }
        }

        // 3. Ambil Label Kolom Pertama (X-Axis Labels)
        if (useFirstColAsLabels) {
            dataStartCol = 1;
            for (let r = dataStartRow; r < matrix.length; r++) {
                labels.push(String(matrix[r][0]) || `Baris ${r - dataStartRow + 1}`);
            }
        } else {
            // Label default jika tidak memakai kolom pertama
            for (let r = dataStartRow; r < matrix.length; r++) {
                labels.push(`Baris ${r - dataStartRow + 1}`);
            }
        }

        // 4. Bangun Dataset Angka
        const numCols = matrix[0].length;
        const colorPalette = this._getHarmoniousColors();

        let colorIdx = 0;
        for (let c = dataStartCol; c < numCols; c++) {
            const datasetData = [];
            for (let r = dataStartRow; r < matrix.length; r++) {
                datasetData.push(parseFloat(matrix[r][c]) || 0);
            }

            const labelName = headers[c - dataStartCol] || `Seri ${c - dataStartCol + 1}`;
            const color = colorPalette[colorIdx % colorPalette.length];
            colorIdx++;

            datasets.push({
                label: labelName,
                data: datasetData,
                backgroundColor: color.bg,
                borderColor: color.border,
                borderWidth: 2,
                fill: false,
                tension: 0.1
            });
        }

        return { labels, datasets };
    },

    /**
     * Membuat dan memasang Floating Chart di layar atas grid
     * @param {Object} options - { id, type, range, cells, containerId, title }
     */
    createFloatingChart(options) {
        const { id, type, range, cells, containerId, title, position } = options;
        
        // Hapus chart lama jika ID nya tabrakan
        this.destroyChart(id);

        const chartContainer = document.getElementById(containerId);
        if (!chartContainer) return;

        // Ekstrak data
        const { labels, datasets } = this.extractChartData(cells, range);
        if (datasets.length === 0) {
            alert("Rentang data kosong atau tidak valid untuk grafik!");
            return;
        }

        // Buat container pembungkus grafik (Floating Card)
        const floatCard = document.createElement('div');
        floatCard.id = `floating-chart-${id}`;
        floatCard.className = 'floating-chart-card';
        
        // Posisi default atau kustom
        const leftPos = position?.left || '100px';
        const topPos = position?.top || '200px';
        const cardWidth = position?.width || '450px';
        const cardHeight = position?.height || '320px';

        floatCard.style.cssText = `
            position: absolute;
            left: ${leftPos};
            top: ${topPos};
            width: ${cardWidth};
            height: ${cardHeight};
            background: var(--pico-card-bg);
            border: 1px solid var(--pico-muted-border-color);
            border-radius: 16px;
            box-shadow: 0 10px 30px rgba(0, 0, 0, 0.15);
            padding: 1rem;
            z-index: 100;
            display: flex;
            flex-direction: column;
            resize: both;
            overflow: hidden;
            min-width: 300px;
            min-height: 220px;
        `;

        // Card Header (Judul & Drag Handle & Close Button)
        floatCard.innerHTML = `
            <div class="chart-drag-handle" style="display: flex; justify-content: space-between; align-items: center; cursor: move; margin-bottom: 0.75rem; border-bottom: 1px solid var(--pico-muted-border-color); padding-bottom: 0.5rem; user-select: none;">
                <span style="font-weight: 700; font-size: 0.95rem; color: var(--pico-color);">${title || 'Grafik Data'}</span>
                <div style="display: flex; gap: 0.5rem; align-items: center;">
                    <button class="outline secondary" onclick="HitungChart.destroyChart('${id}')" style="margin: 0; padding: 0.2rem 0.5rem; font-size: 0.75rem; border-radius: 6px; border: none; background: transparent; cursor: pointer; color: var(--pico-color);">✕</button>
                </div>
            </div>
            <div class="chart-canvas-wrapper" style="flex: 1; position: relative; width: 100%; height: 100%;">
                <canvas id="canvas-chart-${id}"></canvas>
            </div>
        `;

        chartContainer.appendChild(floatCard);

        // Buat objek Chart.js
        const canvasCtx = document.getElementById(`canvas-chart-${id}`).getContext('2d');
        
        // Pilihan styling khusus untuk grafik Pie
        if (type === 'pie' && datasets.length > 0) {
            // Berikan warna latar belakang acak untuk setiap irisan di pie chart
            const palette = this._getHarmoniousColors();
            datasets[0].backgroundColor = palette.map(p => p.bg);
            datasets[0].borderColor = palette.map(p => p.border);
        }

        const chartInstance = new Chart(canvasCtx, {
            type: type,
            data: {
                labels: labels,
                datasets: datasets
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                plugins: {
                    legend: {
                        position: 'bottom',
                        labels: {
                            color: 'var(--pico-color)',
                            boxWidth: 12,
                            font: { size: 10 }
                        }
                    }
                },
                scales: type === 'pie' ? {} : {
                    x: {
                        ticks: { color: 'var(--pico-color)', font: { size: 9 } },
                        grid: { color: 'rgba(150, 150, 150, 0.1)' }
                    },
                    y: {
                        ticks: { color: 'var(--pico-color)', font: { size: 9 } },
                        grid: { color: 'rgba(150, 150, 150, 0.1)' }
                    }
                }
            }
        });

        this.activeCharts.set(id, {
            chart: chartInstance,
            el: floatCard,
            type: type,
            range: range,
            title: title
        });

        // Aktifkan fitur Drag-and-Drop sederhana pada floatCard
        this._makeDraggable(floatCard, floatCard.querySelector('.chart-drag-handle'));
    },

    destroyChart(id) {
        const item = this.activeCharts.get(id);
        if (item) {
            item.chart.destroy();
            item.el.remove();
            this.activeCharts.delete(id);
        }
    },

    destroyAll() {
        Array.from(this.activeCharts.keys()).forEach(id => this.destroyChart(id));
    },

    /**
     * Mengatur posisi drag element
     */
    _makeDraggable(el, handle) {
        let pos1 = 0, pos2 = 0, pos3 = 0, pos4 = 0;
        
        handle.onmousedown = dragMouseDown;

        function dragMouseDown(e) {
            e = e || window.event;
            // Hanya biarkan klik kiri utama
            if (e.button !== 0) return;
            e.preventDefault();
            // Ambil posisi cursor saat mulai
            pos3 = e.clientX;
            pos4 = e.clientY;
            document.onmouseup = closeDragElement;
            document.onmousemove = elementDrag;
        }

        function elementDrag(e) {
            e = e || window.event;
            e.preventDefault();
            // Hitung perpindahan posisi cursor
            pos1 = pos3 - e.clientX;
            pos2 = pos4 - e.clientY;
            pos3 = e.clientX;
            pos4 = e.clientY;
            // Setel posisi baru element
            el.style.top = (el.offsetTop - pos2) + "px";
            el.style.left = (el.offsetLeft - pos1) + "px";
        }

        function closeDragElement() {
            document.onmouseup = null;
            document.onmousemove = null;
        }
    },

    /**
     * Palet warna harmonis yang selaras dengan PicoCSS & Tema Premium
     */
    _getHarmoniousColors() {
        return [
            { bg: 'rgba(15, 110, 86, 0.65)', border: 'rgb(15, 110, 86)' },     // Emerald Green (Aksen utama HITUNG)
            { bg: 'rgba(14, 165, 233, 0.65)', border: 'rgb(14, 165, 233)' },   // Sky Blue
            { bg: 'rgba(245, 158, 11, 0.65)', border: 'rgb(245, 158, 11)' },   // Amber
            { bg: 'rgba(168, 85, 247, 0.65)', border: 'rgb(168, 85, 247)' },   // Purple
            { bg: 'rgba(239, 68, 68, 0.65)', border: 'rgb(239, 68, 68)' },     // Red
            { bg: 'rgba(75, 85, 99, 0.65)', border: 'rgb(75, 85, 99)' }        // Cool Gray
        ];
    },

    _decodeCell(addr) {
        const match = addr.match(/^([A-Z]+)([0-9]+)$/);
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
    }
};

window.HitungChart = HitungChart;
