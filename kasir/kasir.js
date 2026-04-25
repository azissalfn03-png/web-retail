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
// 4. LOGIKA MODAL PEMBAYARAN (BARU)
// ==========================================
const paymentModal = document.getElementById("paymentModal");
const paymentMethod = document.getElementById("paymentMethod");
const inputUang = document.getElementById("inputUang");
const modalKembalian = document.getElementById("modalKembalian");
const cashInputArea = document.getElementById("cashInputArea");
const kembalianArea = document.getElementById("kembalianArea");

// A. Tampilkan Modal Saat Tombol Selesaikan Pembayaran Diklik
document.getElementById("btnCheckout").addEventListener("click", () => {
    if (cart.length === 0) return;
    
    // Set UI Awal Modal
    document.getElementById("modalTotal").textContent = `Rp ${cartTotal.toLocaleString('id-ID')}`;
    inputUang.value = "";
    modalKembalian.textContent = "Rp 0";
    modalKembalian.className = "text-2xl font-bold text-gray-400";
    paymentMethod.value = "TUNAI";
    cashInputArea.classList.remove("hidden");
    kembalianArea.classList.remove("hidden");
    
    // Tampilkan Modal
    paymentModal.classList.remove("hidden");
    inputUang.focus();
});

// B. Logika Ganti Metode Pembayaran (Tunai vs QRIS)
paymentMethod.addEventListener("change", (e) => {
    if (e.target.value === "QRIS") {
        cashInputArea.classList.add("hidden");
        kembalianArea.classList.add("hidden");
    } else {
        cashInputArea.classList.remove("hidden");
        kembalianArea.classList.remove("hidden");
        inputUang.value = "";
        modalKembalian.textContent = "Rp 0";
        modalKembalian.className = "text-2xl font-bold text-gray-400";
        inputUang.focus();
    }
});

// C. Hitung Kembalian Otomatis (Saat Ngetik Uang)
inputUang.addEventListener("input", (e) => {
    const bayar = Number(e.target.value) || 0;
    const kembali = bayar - cartTotal;
    
    if (kembali >= 0) {
        modalKembalian.textContent = `Rp ${kembali.toLocaleString('id-ID')}`;
        modalKembalian.className = "text-2xl font-bold text-green-500"; // Warna Hijau
    } else {
        modalKembalian.textContent = `Kurang Rp ${Math.abs(kembali).toLocaleString('id-ID')}`;
        modalKembalian.className = "text-2xl font-bold text-red-500"; // Warna Merah
    }
});

// D. Tutup Modal
const tutupModal = () => paymentModal.classList.add("hidden");
document.getElementById("btnTutupPayment").addEventListener("click", tutupModal);
document.getElementById("btnTutupPaymentIcon").addEventListener("click", tutupModal);

// ==========================================
// 5. PROSES BAYAR & KIRIM DATA KE BACKEND
// ==========================================
document.getElementById("btnProsesBayar").addEventListener("click", async () => {
    let bayar = Number(inputUang.value) || 0;
    let metode = paymentMethod.value;
    let kembali = 0;

    // Validasi Uang Tunai
    if (metode === "TUNAI") {
        if (bayar < cartTotal) {
            alert("Uang pembayaran kurang!");
            return;
        }
        kembali = bayar - cartTotal;
    } else {
        // Jika QRIS, uang diterima dianggap pas sesuai total
        bayar = cartTotal; 
        kembali = 0;
    }

    // Tampilan Loading
    const btnProses = document.getElementById("btnProsesBayar");
    btnProses.innerHTML = "⏳ Memproses...";
    btnProses.disabled = true;

    // Kirim API ke Apps Script
    const payload = {
        action: "checkout",
        kasir: sessionStorage.getItem("username"),
        totalHarga: cartTotal,
        totalModal: cartTotalModal,
        items: cart
    };

    const response = await apiPost(payload);

    if (response.success) {
        // CETAK NOTA TERLEBIH DAHULU SEBELUM KERANJANG DIKOSONGKAN
        cetakNota(cart, cartTotal, metode, bayar, kembali);
        
        // Reset UI Kasir
        cart = [];
        renderCart();
        loadPendapatanHarian();
        tutupModal();
    } else {
        alert("Gagal menyimpan transaksi: " + response.message);
    }

    btnProses.innerHTML = "✓ Bayar & Cetak Struk";
    btnProses.disabled = false;
});

// ==========================================
// 6. FUNGSI CETAK NOTA (STRUK THERMAL 58MM PRO)
// ==========================================
function cetakNota(items, total, metode, bayar, kembali) {
    const printArea = document.getElementById("printArea");
    const kasirName = sessionStorage.getItem("username");
    
    const now = new Date();
    const tgl = now.toLocaleDateString('id-ID', {day: '2-digit', month: '2-digit', year: 'numeric'});
    const jam = now.toLocaleTimeString('id-ID', {hour: '2-digit', minute: '2-digit'});
    const idTrx = "TRX" + now.getTime().toString().slice(-5); 

    let strukHTML = `
        <div class="struk-header">
            <h2>GUDANG RETAIL</h2>
            <p>Jl. Teknologi No. 1, Jakarta</p>
        </div>
        <div class="struk-divider"></div>
        <div>
            <p>Tgl : ${tgl} ${jam}</p>
            <p>Ksr : ${kasirName}</p>
            <p>TRX : ${idTrx}</p>
        </div>
        <div class="struk-divider"></div>
        <table class="struk-table">
    `;
    
    items.forEach(item => {
        strukHTML += `
            <tr><td colspan="3" class="text-bold">${item.Nama}</td></tr>
            <tr>
                <td style="width: 20%;">${item.qty}x</td>
                <td style="width: 35%;">@${item.Harga_Jual.toLocaleString('id-ID')}</td>
                <td style="width: 45%;" class="text-right">${item.subtotal.toLocaleString('id-ID')}</td>
            </tr>
        `;
    });
    
    strukHTML += `
        </table>
        <div class="struk-divider"></div>
        <table class="struk-table text-bold">
            <tr>
                <td>TOTAL</td>
                <td class="text-right">Rp ${total.toLocaleString('id-ID')}</td>
            </tr>
    `;

    // Jika metode QRIS, tampilkan logo/tulisan QRIS. Jika Tunai, tampilkan bayar/kembali
    if (metode === "QRIS") {
        strukHTML += `
            </table>
            <div class="text-center" style="margin: 10px 0; border: 1px dashed black; padding: 5px;">
                <p style="font-size: 14px; font-weight: bold;">LUNAS VIA QRIS</p>
                <p style="font-size: 10px;">(Verified by System)</p>
            </div>
        `;
    } else {
        strukHTML += `
            <tr>
                <td>TUNAI</td>
                <td class="text-right">Rp ${bayar.toLocaleString('id-ID')}</td>
            </tr>
            <tr>
                <td>KEMBALI</td>
                <td class="text-right">Rp ${kembali.toLocaleString('id-ID')}</td>
            </tr>
        </table>
        `;
    }

    strukHTML += `
        <div class="struk-divider"></div>
        <div class="text-center" style="margin-top: 10px;">
            <p>*** TERIMA KASIH ***</p>
            <p style="font-size: 9px; margin-top: 3px;">Barang yang sudah dibeli</p>
            <p style="font-size: 9px;">tidak dapat ditukar/dikembalikan.</p>
        </div>
    `;
    
    printArea.innerHTML = strukHTML;
    window.print();
}