/**
 * File: admin.js
 * Fungsi: Mengambil data transaksi dan produk, melakukan kalkulasi statistik, 
 * dan memvisualisasikannya dengan Chart.js.
 */

// 1. Verifikasi Keamanan: Hanya Role 'admin' yang boleh masuk
checkAuth("admin");
document.getElementById("welcomeMessage").textContent = `Halo, Admin ${sessionStorage.getItem("username")}`;

// ==========================================
// FUNGSI UTAMA: MEMUAT DASHBOARD
// ==========================================
async function loadDashboardData() {
    // Siapkan 3 variabel: trx, produk, dan exp
    const [trxResponse, produkResponse, expResponse] = await Promise.all([
        apiGet("getTransactions"),
        apiGet("getProducts"),
        apiGet("getExpenses") 
    ]);

    // Kirim data transaksi DAN pengeluaran ke fungsi pemroses
    if (trxResponse.success && expResponse.success) {
        processTransactionData(trxResponse.data, expResponse.data);
    } else {
        alert("Gagal memuat data transaksi atau pengeluaran. Cek tab 'Pengeluaran' di Sheets.");
    }

    if (produkResponse.success) {
        processLowStock(produkResponse.data);
    }
}


// ==========================================
// LOGIKA TRANSAKSI & CHART.JS
// ==========================================
function processTransactionData(transactions, expenses) {
    let omzetHariIni = 0;
    let omzetBulanIni = 0;
    let labaHariIni = 0;
    let labaBulanIni = 0;
    let expHariIni = 0;
    let expBulanIni = 0;
    let totalLabaKumulatif = 0; // Untuk grafik donat

    const now = new Date();
    const todayStr = now.toLocaleDateString('id-ID'); 
    const currentMonth = now.getMonth();
    const currentYear = now.getFullYear();

    const dailyData = {};

    // 1. Hitung Transaksi (Omzet & Laba)
    transactions.forEach(trx => {
        const d = new Date(trx.Tanggal);
        const tgl = d.toLocaleDateString('id-ID');
        const nominal = Number(trx.Total_Harga) || 0;
        const laba = Number(trx.Laba) || 0;

        // Cek Apakah Transaksi Hari Ini
        if (tgl === todayStr) {
            omzetHariIni += nominal;
            labaHariIni += laba;
        }
        
        // Cek Apakah Transaksi Bulan Ini
        if (d.getMonth() === currentMonth && d.getFullYear() === currentYear) {
            omzetBulanIni += nominal;
            labaBulanIni += laba;
        }

        totalLabaKumulatif += laba;

        if (!dailyData[tgl]) dailyData[tgl] = { rev: 0, exp: 0, laba: 0 };
        dailyData[tgl].rev += nominal;
        dailyData[tgl].laba += laba;
    });

    // 2. Hitung Pengeluaran
    expenses.forEach(ex => {
        const d = new Date(ex.Tanggal);
        const tgl = d.toLocaleDateString('id-ID');
        const nominal = Number(ex.Nominal) || 0;

        if (tgl === todayStr) expHariIni += nominal;
        if (d.getMonth() === currentMonth && d.getFullYear() === currentYear) {
            expBulanIni += nominal;
        }

        if (!dailyData[tgl]) dailyData[tgl] = { rev: 0, exp: 0, laba: 0 };
        dailyData[tgl].exp += nominal;
    });

    // 3. Update Tampilan Angka ke HTML
    document.getElementById("omzetHarian").textContent = `Rp ${omzetHariIni.toLocaleString('id-ID')}`;
    document.getElementById("omzetBulanan").textContent = `Rp ${omzetBulanIni.toLocaleString('id-ID')}`;
    document.getElementById("expHarian").textContent = `Rp ${expHariIni.toLocaleString('id-ID')}`;
    document.getElementById("expBulanan").textContent = `Rp ${expBulanIni.toLocaleString('id-ID')}`;
    document.getElementById("labaHarian").textContent = `Rp ${labaHariIni.toLocaleString('id-ID')}`;
    document.getElementById("labaBulanan").textContent = `Rp ${labaBulanIni.toLocaleString('id-ID')}`;

    // 4. Update Grafik
    renderAllCharts(dailyData, totalLabaKumulatif, expBulanIni);
}

// FUNGSI PERINGATAN STOK (PANGGIL KEMBALI)
function processLowStock(products) {
    const lowStockList = document.getElementById("lowStockList");
    const criticalStock = products.filter(p => Number(p.Stok) < 10);

    lowStockList.innerHTML = ""; 

    if (criticalStock.length === 0) {
        lowStockList.innerHTML = `<li class="py-4 text-center text-sm text-green-600 font-semibold">✅ Semua stok produk aman.</li>`;
        return;
    }

    criticalStock.forEach(item => {
        const li = `
            <li class="py-3 flex justify-between items-center">
                <div>
                    <p class="font-bold text-slate-800">${item.Nama_Barang}</p>
                    <p class="text-xs text-slate-400 font-mono">${item.Barcode}</p>
                </div>
                <div class="text-right">
                    <span class="bg-red-100 text-red-700 px-3 py-1 rounded-full text-xs font-black">Sisa: ${item.Stok}</span>
                </div>
            </li>`;
        lowStockList.insertAdjacentHTML('beforeend', li);
    });
}

function renderAllCharts(dailyData, totalLaba, totalExp) {
    const labels = Object.keys(dailyData).sort(); // Urutkan tanggal
    const revs = labels.map(l => dailyData[l].rev);
    const exps = labels.map(l => dailyData[l].exp);
    const profits = labels.map(l => dailyData[l].laba);

    // Grafik Batang (Cashflow)
    new Chart(document.getElementById('cashflowBarChart'), {
        type: 'bar',
        data: {
            labels: labels,
            datasets: [
                { label: 'Omzet', data: revs, backgroundColor: '#3b82f6' },
                { label: 'Pengeluaran', data: exps, backgroundColor: '#f59e0b' }
            ]
        }
    });

    // Grafik Garis (Laba)
    new Chart(document.getElementById('labaLineChart'), {
        type: 'line',
        data: {
            labels: labels,
            datasets: [{ label: 'Laba Bersih', data: profits, borderColor: '#10b981', fill: true, backgroundColor: 'rgba(16,185,129,0.1)', tension: 0.4 }]
        }
    });

    // Grafik Donat (Rasio)
    new Chart(document.getElementById('financeDonutChart'), {
        type: 'doughnut',
        data: {
            labels: ['Laba', 'Pengeluaran'],
            datasets: [{ data: [totalLaba, totalExp], backgroundColor: ['#10b981', '#f59e0b'] }]
        }
    });
}

function renderCharts(revData, expData, labaData) {
    const labels = Object.keys(revData);

    // 1. Diagram Batang (Beda warna Omzet vs Pengeluaran)
    new Chart(document.getElementById('cashflowBarChart'), {
        type: 'bar',
        data: {
            labels: labels,
            datasets: [
                { label: 'Omzet', data: Object.values(revData), backgroundColor: '#3b82f6' },
                { label: 'Pengeluaran', data: Object.values(expData), backgroundColor: '#f59e0b' }
            ]
        }
    });

    // 2. Diagram Garis (Tren Laba)
    new Chart(document.getElementById('labaLineChart'), {
        type: 'line',
        data: {
            labels: labels,
            datasets: [{ label: 'Laba', data: Object.values(labaData), borderColor: '#10b981', fill: true, backgroundColor: 'rgba(16,185,129,0.1)' }]
        }
    });

    // 3. Diagram Donat (Rasio Laba vs Pengeluaran total)
    const totalLaba = Object.values(labaData).reduce((a,b)=>a+b, 0);
    const totalExp = Object.values(expData).reduce((a,b)=>a+b, 0);
    new Chart(document.getElementById('financeDonutChart'), {
        type: 'doughnut',
        data: {
            labels: ['Total Laba', 'Total Pengeluaran'],
            datasets: [{ data: [totalLaba, totalExp], backgroundColor: ['#10b981', '#f59e0b'] }]
        },
        options: { cutout: '70%' }
    });
}

// ==========================================
// LOGIKA PERINGATAN STOK
// ==========================================
function processLowStock(products) {
    const lowStockList = document.getElementById("lowStockList");
    
    // Filter array: Hanya ambil barang yang stoknya kurang dari 10
    const criticalStock = products.filter(p => Number(p.Stok) < 10);

    lowStockList.innerHTML = ""; // Bersihkan status loading

    if (criticalStock.length === 0) {
        lowStockList.innerHTML = `<li class="py-4 text-center text-sm text-green-600 font-semibold">Semua stok produk aman.</li>`;
        return;
    }

    // Render daftar barang yang stoknya menipis
    criticalStock.forEach(item => {
        const li = `
            <li class="py-3 flex justify-between items-center">
                <div>
                    <p class="font-semibold text-gray-800 text-sm">${item.Nama_Barang}</p>
                    <p class="text-xs text-gray-500 font-mono">${item.Barcode}</p>
                </div>
                <span class="bg-red-100 text-red-700 px-2 py-1 rounded text-xs font-bold">
                    Sisa: ${item.Stok}
                </span>
            </li>
        `;
        lowStockList.insertAdjacentHTML('beforeend', li);
    });
}

// Jalankan pengambilan data saat halaman dibuka
window.onload = loadDashboardData;