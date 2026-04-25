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
function processTransactionData(transactions) {
    let totalOmzet = 0;
    let totalLaba = 0;
    
    // Objek untuk mengelompokkan laba berdasarkan tanggal (Grouping Data)
    const labaHarian = {}; 

    transactions.forEach(trx => {
        // Akumulasi total keseluruhan
        totalOmzet += Number(trx.Total_Harga);
        totalLaba += Number(trx.Laba);

        // Ekstraksi Tanggal Saja (Menghapus jam/menit/detik dari string "dd/MM/yyyy HH:mm:ss")
        const tanggalSaja = trx.Tanggal.split(" ")[0]; 

        // Jika tanggal belum ada di objek, inisialisasi dengan 0
        if (!labaHarian[tanggalSaja]) {
            labaHarian[tanggalSaja] = 0;
        }
        
        // Tambahkan laba transaksi ini ke tanggal tersebut
        labaHarian[tanggalSaja] += Number(trx.Laba);
    });

    // Perbarui UI Metrik (Summary Cards)
    document.getElementById("totalOmzet").textContent = `Rp ${totalOmzet.toLocaleString('id-ID')}`;
    document.getElementById("totalLaba").textContent = `Rp ${totalLaba.toLocaleString('id-ID')}`;
    document.getElementById("totalTransaksi").textContent = transactions.length;

    // Menyiapkan Data untuk Chart.js
    // Object.keys mengambil array tanggal, Object.values mengambil array total labanya
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