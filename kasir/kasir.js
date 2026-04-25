/**
 * File: kasir.js
 * Logika khusus untuk Point of Sale (POS).
 * Menangani Keranjang Belanja, Polling Scanner, dan Kalkulasi Harga.
 */

checkAuth("kasir");
document.getElementById("welcomeMessage").textContent = `Kasir: ${sessionStorage.getItem("username")}`;

// State Management (Variabel Global Halaman Kasir)
let catalog = []; // Menyimpan semua data produk dari database
let cart = [];    // Menyimpan produk yang masuk keranjang
let cartTotal = 0;
let cartTotalModal = 0; // Disimpan secara rahasia untuk hitung laba backend

let scanInterval = null;
let currentSessionId = null;

// ==========================================
// 1. MEMUAT KATALOG (CACHE LOKAL)
// ==========================================
// Kita memuat semua produk di awal agar saat barcode di-scan,
// kita tidak perlu mengambil data ke server lagi (mempercepat performa POS).
async function loadCatalog() {
    const response = await apiGet("getProducts");
    if (response.success) {
        catalog = response.data;
        console.log("Katalog dimuat:", catalog.length, "item");
    } else {
        alert("Gagal memuat data produk. Pastikan database terhubung.");
    }
}

// ==========================================
// 2. LOGIKA KERANJANG BELANJA (CART)
// ==========================================
function processBarcode(barcode) {
    // Cari produk di katalog berdasarkan barcode
    const product = catalog.find(p => String(p.Barcode) === String(barcode));
    
    if (!product) {
        alert(`Produk dengan barcode ${barcode} tidak ditemukan!`);
        return;
    }

    // Cek apakah barang sudah ada di keranjang
    const existingItemIndex = cart.findIndex(item => item.Barcode === product.Barcode);

    if (existingItemIndex > -1) {
        // Jika sudah ada, tambah Quantity (Qty)
        cart[existingItemIndex].qty += 1;
        cart[existingItemIndex].subtotal = cart[existingItemIndex].qty * cart[existingItemIndex].Harga_Jual;
    } else {
        // Jika belum ada, buat objek baru lalu masukkan ke array cart
        cart.push({
            Barcode: product.Barcode,
            Nama: product.Nama_Barang,
            Harga_Beli: Number(product.Harga_Beli), // Untuk hitung modal
            Harga_Jual: Number(product.Harga_Jual),
            qty: 1,
            subtotal: Number(product.Harga_Jual)
        });
    }

    renderCart(); // Perbarui tampilan antarmuka
}

function renderCart() {
    const cartBody = document.getElementById("cartBody");
    const displayTotal = document.getElementById("displayTotal");
    const btnCheckout = document.getElementById("btnCheckout");

    cartBody.innerHTML = "";
    cartTotal = 0;
    cartTotalModal = 0;

    if (cart.length === 0) {
        cartBody.innerHTML = `<tr><td colspan="5" class="py-4 text-center text-gray-400">Keranjang masih kosong</td></tr>`;
        displayTotal.textContent = "Rp 0";
        btnCheckout.disabled = true;
        btnCheckout.classList.add("cursor-not-allowed", "opacity-50");
        return;
    }

    // Render ulang isi tabel
    cart.forEach((item, index) => {
        cartTotal += item.subtotal;
        cartTotalModal += (item.Harga_Beli * item.qty);

        const row = `
            <tr class="hover:bg-gray-50">
                <td class="py-3">
                    <p class="font-semibold text-gray-800">${item.Nama}</p>
                    <p class="text-xs text-gray-400 font-mono">${item.Barcode}</p>
                </td>
                <td class="py-3 text-sm">Rp ${item.Harga_Jual.toLocaleString('id-ID')}</td>
                <td class="py-3 text-center">
                    <div class="flex items-center justify-center gap-2">
                        <button onclick="changeQty(${index}, -1)" class="bg-gray-200 px-2 rounded hover:bg-gray-300">-</button>
                        <span class="w-6 font-semibold">${item.qty}</span>
                        <button onclick="changeQty(${index}, 1)" class="bg-gray-200 px-2 rounded hover:bg-gray-300">+</button>
                    </div>
                </td>
                <td class="py-3 text-right font-semibold text-gray-800">Rp ${item.subtotal.toLocaleString('id-ID')}</td>
                <td class="py-3 text-right">
                    <button onclick="removeItem(${index})" class="text-red-500 hover:text-red-700 font-bold px-2">X</button>
                </td>
            </tr>
        `;
        cartBody.insertAdjacentHTML('beforeend', row);
    });

    displayTotal.textContent = `Rp ${cartTotal.toLocaleString('id-ID')}`;
    
    // Aktifkan tombol checkout
    btnCheckout.disabled = false;
    btnCheckout.classList.remove("cursor-not-allowed", "opacity-50");
}

// Fungsi Helper untuk Ubah Qty / Hapus Item
window.changeQty = function(index, delta) {
    if (cart[index].qty + delta > 0) {
        cart[index].qty += delta;
        cart[index].subtotal = cart[index].qty * cart[index].Harga_Jual;
        renderCart();
    }
};

window.removeItem = function(index) {
    cart.splice(index, 1);
    renderCart();
};

document.getElementById("btnClearCart").addEventListener("click", () => {
    cart = [];
    renderCart();
});

// ==========================================
// 3. LOGIKA SINKRONISASI SCANNER HP (POLLING)
// ==========================================
document.getElementById("btnStartScan").addEventListener("click", () => {
    // Generate Session ID khusus Kasir
    currentSessionId = "POS-" + Math.floor(1000 + Math.random() * 9000);
    
    document.getElementById("displaySessionId").textContent = currentSessionId;
    document.getElementById("scanStatusPanel").classList.remove("hidden");
    
    // Hentikan interval lama jika ada, lalu buat yang baru
    if(scanInterval) clearInterval(scanInterval);
    scanInterval = setInterval(checkScannerData, 3000);
});

async function checkScannerData() {
    const response = await apiGet("checkScan", { sessionId: currentSessionId });
    if (response.success && response.barcode) {
        // Berbeda dengan gudang, kasir tidak menghentikan polling setelah 1 barang.
        // Kasir mungkin men-scan 5 barang berturut-turut, jadi interval tetap berjalan.
        processBarcode(response.barcode);
    }
}

// Tambah Manual via Textbox
document.getElementById("btnAddManual").addEventListener("click", () => {
    const inputVal = document.getElementById("manualBarcode").value;
    if (inputVal) {
        processBarcode(inputVal);
        document.getElementById("manualBarcode").value = ""; // Bersihkan input
    }
});

// ==========================================
// 4. CHECKOUT (Menyimpan Transaksi)
// ==========================================
document.getElementById("btnCheckout").addEventListener("click", async () => {
    if (cart.length === 0) return;

    const confirmCheckout = confirm(`Selesaikan pembayaran dengan total Rp ${cartTotal.toLocaleString('id-ID')}?`);
    if (!confirmCheckout) return;

    // Ubah UI tombol saat loading
    const btnCheckout = document.getElementById("btnCheckout");
    btnCheckout.innerHTML = "Memproses...";
    btnCheckout.disabled = true;

    // Siapkan Payload data JSON untuk dikirim ke Backend (GAS)
    const payload = {
        action: "checkout",
        kasir: sessionStorage.getItem("username"),
        totalHarga: cartTotal,
        totalModal: cartTotalModal,
        items: cart // Kirim seluruh isi keranjang
    };

    // Panggil API POST (Catatan: Kita belum membuat fungsi 'checkout' di GAS, ini akan dibahas di sesi selanjutnya)
    const response = await apiPost(payload);

    if (response.success) {
        alert("Transaksi Berhasil Disimpan!");
        cart = []; // Kosongkan keranjang
        renderCart();
    } else {
        alert("Terjadi kesalahan: " + response.message);
    }
    
    btnCheckout.innerHTML = "Selesaikan Pembayaran";
    btnCheckout.disabled = false;
});

// Jalankan saat halaman dibuka
window.onload = loadCatalog;