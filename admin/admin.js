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
    // Jalankan dua request API secara bersamaan menggunakan Promise.all (Best Practice untuk performa)
    const [trxResponse, produkResponse] = await Promise.all([
        apiGet("getTransactions"),
        apiGet("getProducts")
    ]);

    if (trxResponse.success) {
        processTransactionData(trxResponse.data);
    } else {
        alert("Gagal memuat data transaksi.");
    }

    if (produkResponse.success) {
        processLowStock(produkResponse.data);
    } else {
        alert("Gagal memuat data produk.");
    }
}

// ==========================================
// LOGIKA TRANSAKSI & CHART.JS
// ==========================================
// ==========================================
// LOGIKA TRANSAKSI & CHART.JS
// ==========================================
// ==========================================
// LOGIKA TRANSAKSI & CHART.JS
// ==========================================
function processTransactionData(transactions) {
    let totalLaba = 0;
    let omzetHariIni = 0;
    let omzetMingguIni = 0;
    let omzetBulanIni = 0;
    
    const labaHarian = {}; 

    const now = new Date();
    const dd = String(now.getDate()).padStart(2, '0');
    const mm = String(now.getMonth() + 1).padStart(2, '0');
    const yyyy = now.getFullYear();
    
    const todayStr = `${dd}/${mm}/${yyyy}`; 
    const thisMonthStr = `${mm}/${yyyy}`;   
    
    const startOfWeek = new Date(now);
    startOfWeek.setDate(now.getDate() - now.getDay());
    startOfWeek.setHours(0, 0, 0, 0);

    // Proteksi: Jika belum ada transaksi sama sekali
    if (!transactions || transactions.length === 0) {
        document.getElementById("omzetHarian").textContent = "Rp 0";
        document.getElementById("omzetMingguan").textContent = "Rp 0";
        document.getElementById("omzetBulanan").textContent = "Rp 0";
        document.getElementById("totalLaba").textContent = "Rp 0";
        renderChart([], []);
        return;
    }

    transactions.forEach(trx => {
        try {
            const omzet = Number(trx.Total_Harga) || 0;
            const laba = Number(trx.Laba) || 0;
            totalLaba += laba;

            if (!trx.Tanggal) return; // Lewati jika tanggal kosong

            let tanggalSaja = "";
            let trxDateObj = null;
            const dateString = String(trx.Tanggal);

            // Deteksi Otomatis Format Tanggal dari Google Sheets
            if (dateString.includes("T")) {
                // Jika terbaca sebagai Format ISO (Contoh: 2026-04-25T12:00...)
                trxDateObj = new Date(dateString);
                const d = String(trxDateObj.getDate()).padStart(2, '0');
                const m = String(trxDateObj.getMonth() + 1).padStart(2, '0');
                const y = trxDateObj.getFullYear();
                tanggalSaja = `${d}/${m}/${y}`;
            } else {
                // Jika terbaca sebagai String Manual (Contoh: 25/04/2026 14:30:00)
                tanggalSaja = dateString.split(" ")[0];
                const parts = tanggalSaja.split("/");
                if (parts.length === 3) {
                    trxDateObj = new Date(parts[2], parts[1] - 1, parts[0]);
                }
            }
            
            // 1. Cek Hari Ini
            if (tanggalSaja === todayStr) omzetHariIni += omzet;

            // 2. Cek Bulan Ini
            if (tanggalSaja.endsWith(thisMonthStr)) omzetBulanIni += omzet;

            // 3. Cek Minggu Ini
            if (trxDateObj && trxDateObj >= startOfWeek) omzetMingguIni += omzet;

            // Kumpulkan Data untuk Chart
            if (!labaHarian[tanggalSaja]) labaHarian[tanggalSaja] = 0;
            labaHarian[tanggalSaja] += laba;

        } catch (err) {
            console.error("Error membaca baris transaksi: ", err);
        }
    });

    // Update Angka di Layar
    document.getElementById("omzetHarian").textContent = `Rp ${omzetHariIni.toLocaleString('id-ID')}`;
    document.getElementById("omzetMingguan").textContent = `Rp ${omzetMingguIni.toLocaleString('id-ID')}`;
    document.getElementById("omzetBulanan").textContent = `Rp ${omzetBulanIni.toLocaleString('id-ID')}`;
    document.getElementById("totalLaba").textContent = `Rp ${totalLaba.toLocaleString('id-ID')}`;

    // Render Grafik
    const labels = Object.keys(labaHarian); 
    const dataLaba = Object.values(labaHarian);
    renderChart(labels, dataLaba);
}

function renderChart(labels, data) {
    const ctx = document.getElementById('labaChart').getContext('2d');
    
    new Chart(ctx, {
        type: 'line', // Jenis grafik garis
        data: {
            labels: labels,
            datasets: [{
                label: 'Laba Bersih (Rp)',
                data: data,
                borderColor: 'rgb(34, 197, 94)', // Warna garis hijau Tailwind (green-500)
                backgroundColor: 'rgba(34, 197, 94, 0.2)', // Warna latar transparan
                borderWidth: 2,
                tension: 0.3, // Membuat lengkungan garis agar lebih halus
                fill: true
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            plugins: {
                legend: { display: false } // Sembunyikan legenda agar lebih bersih
            },
            scales: {
                y: { beginAtZero: true }
            }
        }
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