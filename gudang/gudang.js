/**
 * File: gudang.js
 */

checkAuth("gudang");
document.getElementById("welcomeMessage").textContent = `Halo, ${sessionStorage.getItem("username")}`;

let scanInterval = null;
let currentSessionId = null;

// Mengambil Elemen Modal
const productModal = document.getElementById("productModal");
const productForm = document.getElementById("productForm");

// ==========================================
// 1. MEMUAT DATA PRODUK
// ==========================================
async function loadProducts() {
    const tableBody = document.getElementById("tableBody");
    tableBody.innerHTML = `<tr><td colspan="4" class="p-4 text-center">Memuat data dari database...</td></tr>`;
    
    const response = await apiGet("getProducts");

    if (response.success && response.data.length > 0) {
        tableBody.innerHTML = ""; 
        response.data.forEach(item => {
            const row = `
                <tr class="hover:bg-gray-50 border-b">
                    <td class="p-4 font-mono text-sm">${item.Barcode}</td>
                    <td class="p-4 font-semibold">${item.Nama_Barang}</td>
                    <td class="p-4">Rp ${Number(item.Harga_Jual).toLocaleString('id-ID')}</td>
                    <td class="p-4">
                        <span class="${item.Stok < 10 ? 'text-red-600 font-bold' : 'text-green-600 font-bold'}">${item.Stok}</span>
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
// 2. LOGIKA SINKRONISASI SCANNER HP
// ==========================================
document.getElementById("btnStartScan").addEventListener("click", () => {
    // Generate ID baru setiap kali tombol diklik
    currentSessionId = "GDG-" + Math.floor(1000 + Math.random() * 9000);
    document.getElementById("displaySessionId").textContent = currentSessionId;
    document.getElementById("scanStatusPanel").classList.remove("hidden");
    
    // Hentikan interval lama jika ada (mencegah bentrok jika tombol diklik 2x)
    if(scanInterval) clearInterval(scanInterval);
    
    // Mulai polling setiap 3 detik
    scanInterval = setInterval(checkScannerData, 3000);
});

async function checkScannerData() {
    const response = await apiGet("checkScan", { sessionId: currentSessionId });

    if (response.success && response.barcode) {
        // KODE DI BAWAH INI TELAH DIHAPUS AGAR SESI TIDAK MATI:
        // clearInterval(scanInterval); 
        // document.getElementById("scanStatusPanel").classList.add("hidden");
        
        // BUKA MODAL DAN ISI BARCODE OTOMATIS
        bukaModal(response.barcode);
    }
}

// ==========================================
// 3. LOGIKA FORM MODAL (TAMBAH/UPDATE PRODUK)
// ==========================================

// Tombol Tambah Manual
document.getElementById("btnTambahManual").addEventListener("click", () => {
    bukaModal(""); // Buka modal dengan barcode kosong
});

// Tombol Batal/Tutup
document.getElementById("btnTutupModal").addEventListener("click", () => {
    productModal.classList.add("hidden");
    productForm.reset();
});

function bukaModal(barcodeValue) {
    productForm.reset();
    document.getElementById("inputBarcode").value = barcodeValue;
    productModal.classList.remove("hidden");
    document.getElementById(barcodeValue ? "inputNama" : "inputBarcode").focus();
}

// Proses Submit Form
productForm.addEventListener("submit", async (e) => {
    e.preventDefault();
    
    const btnSimpan = document.getElementById("btnSimpanProduk");
    btnSimpan.textContent = "Menyimpan...";
    btnSimpan.disabled = true;

    // Siapkan Payload data JSON
    const payload = {
        action: "addProduct",
        barcode: document.getElementById("inputBarcode").value,
        nama: document.getElementById("inputNama").value,
        hargaBeli: document.getElementById("inputModal").value,
        hargaJual: document.getElementById("inputJual").value,
        stok: document.getElementById("inputStok").value
    };

    // Kirim POST ke Apps Script
    const response = await apiPost(payload);

    if (response.success) {
        alert("Sukses! " + response.message);
        productModal.classList.add("hidden");
        loadProducts(); // Muat ulang tabel
    } else {
        alert("Gagal menyimpan data: " + response.message);
    }

    btnSimpan.textContent = "Simpan Data";
    btnSimpan.disabled = false;
});

// Inisialisasi awal
window.onload = loadProducts;