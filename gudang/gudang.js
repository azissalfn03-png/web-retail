/**
 * File: gudang.js
 * Logika khusus untuk halaman Manajemen Gudang.
 */

// 1. Verifikasi Keamanan: Pastikan yang mengakses ini adalah 'gudang'
checkAuth("gudang");

// Tampilkan nama user di navbar
document.getElementById("welcomeMessage").textContent = `Halo, ${sessionStorage.getItem("username")}`;

// Variabel Global untuk Polling
let scanInterval = null;
let currentSessionId = null;

// ==========================================
// FUNGSI 1: MENGAMBIL & MENAMPILKAN DATA
// ==========================================
async function loadProducts() {
    const tableBody = document.getElementById("tableBody");
    
    // Panggil fungsi global dari api.js
    const response = await apiGet("getProducts");

    if (response.success && response.data.length > 0) {
        tableBody.innerHTML = ""; // Bersihkan pesan "Memuat..."
        
        response.data.forEach(item => {
            // Gunakan template literal untuk merender baris tabel HTML
            const row = `
                <tr class="hover:bg-gray-50">
                    <td class="p-4 font-mono text-sm">${item.Barcode}</td>
                    <td class="p-4 font-semibold">${item.Nama_Barang}</td>
                    <td class="p-4">Rp ${Number(item.Harga_Jual).toLocaleString('id-ID')}</td>
                    <td class="p-4">
                        <span class="${item.Stok < 10 ? 'text-red-600 font-bold' : 'text-green-600'}">${item.Stok}</span>
                    </td>
                </tr>
            `;
            tableBody.insertAdjacentHTML('beforeend', row);
        });
    } else {
        tableBody.innerHTML = `<tr><td colspan="4" class="p-4 text-center text-red-500">Gagal memuat data atau data kosong.</td></tr>`;
    }
}

// ==========================================
// FUNGSI 2: LOGIKA SINKRONISASI SCANNER (POLLING)
// ==========================================
document.getElementById("btnStartScan").addEventListener("click", () => {
    // Buat Session ID unik (contoh: GDG-8372)
    currentSessionId = "GDG-" + Math.floor(1000 + Math.random() * 9000);
    
    // Tampilkan UI Sesi Scan
    document.getElementById("displaySessionId").textContent = currentSessionId;
    document.getElementById("scanStatusPanel").classList.remove("hidden");
    
    // Mulai Short Polling: Jalankan fungsi cek ke server setiap 3 detik (3000 ms)
    // KOMENTAR AKADEMIS: Polling digunakan karena Google Sheets tidak mendukung WebSockets (real-time).
    scanInterval = setInterval(checkScannerData, 3000);
});

async function checkScannerData() {
    console.log("Mengecek data barcode dari HP...");
    const response = await apiGet("checkScan", { sessionId: currentSessionId });

    if (response.success && response.barcode) {
        // Hentikan polling agar tidak terus-menerus membebani server setelah dapat 1 barcode
        clearInterval(scanInterval); 
        document.getElementById("scanStatusPanel").classList.add("hidden");
        
        // Output hasil scan (bisa dikembangkan untuk membuka modal tambah barang)
        alert(`Berhasil! Barcode diterima dari HP: ${response.barcode}\n\n(Di tahap selanjutnya, ini akan otomatis membuka form tambah stok).`);
    }
}

// Inisialisasi saat halaman pertama kali dimuat
window.onload = loadProducts;