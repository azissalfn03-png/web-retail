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

let scanInterval = null, currentSessionId = null;
let isModeTukar = false; // Tambah status mode tukar

// ==========================================
// FITUR NOTIFIKASI MODERN (TOAST NOTIFICATION)
// ==========================================
window.showToast = function(message, type = "error") {
    const container = document.getElementById("toastContainer");
    if (!container) return;

    const toast = document.createElement("div");
    
    // PERBAIKAN: Ganti w-full jadi w-max dan beri min-w-[250px] agar kotak bisa melar ke samping
    toast.className = `transform transition-all duration-300 translate-x-full opacity-0 w-max min-w-[250px] max-w-md shadow-lg rounded-xl pointer-events-auto overflow-hidden ring-1 ring-black/5`;
    
    // Warna & Ikon berdasarkan tipe
    let bgColor = type === "success" ? "bg-green-50" : "bg-red-50";
    let borderColor = type === "success" ? "border-green-500" : "border-red-500";
    let iconColor = type === "success" ? "text-green-500" : "text-red-500";
    let iconSvg = type === "success" 
        ? `<svg class="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M5 13l4 4L19 7"></path></svg>`
        : `<svg class="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"></path></svg>`;

    // Format HTML Toast
    toast.innerHTML = `
        <div class="${bgColor} border-l-4 ${borderColor} p-4">
            <div class="flex items-center">
                <div class="flex-shrink-0 ${iconColor}">${iconSvg}</div>
                <!-- PERBAIKAN: Hapus w-0 dan break-words biar teks tidak patah-patah -->
                <div class="ml-3 flex-1">
                    <p class="text-sm font-bold text-gray-800">${message.replace(/\n/g, '<br>')}</p>
                </div>
            </div>
        </div>
    `;

    container.appendChild(toast);

    // Trigger animasi muncul seketika
    setTimeout(() => {
        toast.classList.remove("translate-x-full", "opacity-0");
    }, 10);

    // Hilang otomatis setelah 3.5 detik
    setTimeout(() => {
        toast.classList.add("translate-x-full", "opacity-0");
        setTimeout(() => toast.remove(), 300); // Hapus dari HTML setelah animasi selesai
    }, 3500);
};

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
        showToast("Gagal memuat data produk. Pastikan database terhubung.", "error");
    }
}

// ==========================================
// 2. LOGIKA KERANJANG BELANJA (CART)
// ==========================================
async function processBarcode(barcode) {
    // 1. Animasi flash saat scan
    const main = document.getElementById("mainContainer");
    if(main) {
        main.classList.add("scan-flash");
        setTimeout(() => main.classList.remove("scan-flash"), 500);
    }

    // 2. Cari produk di katalog
    let product = catalog.find(p => String(p.Barcode) === String(barcode));
    if (!product) { 
        await loadCatalog(); 
        product = catalog.find(p => String(p.Barcode) === String(barcode)); 
    }
    if (!product) { showToast(`Produk dengan barcode ${barcode} tidak ada di gudang!`, "error"); return; }

    // 3. Pelindung Error (Cegah nama Undefined & harga NaN)
    if (product.Nama_Barang === undefined || product.Harga_Jual === undefined) {
        showToast("Error: Barcode ditemukan, tapi Nama atau Harga barang kosong. Cek Header Google Sheets kamu (Pastikan pakai garis bawah: Nama_Barang, Harga_Jual).", "error");
        return;
    }

    // ==========================================
    // 3. KUNCI PERBAIKANNYA DI SINI!
    // Langsung baca variabel 'isModeTukar' dari tombol, bukan dari checkbox lagi!
    // ==========================================
    const qtyToAdd = isModeTukar ? -1 : 1;
    const prefix = isModeTukar ? "[RETUR] " : "";

    const idx = cart.findIndex(item => item.Barcode === product.Barcode && item.isTukar === isModeTukar);

    if (idx > -1) {
        cart[idx].qty += qtyToAdd;
        cart[idx].subtotal = cart[idx].qty * cart[idx].Harga_Jual;
        if (cart[idx].qty === 0) cart.splice(idx, 1);
    } else {
        cart.push({
            Barcode: product.Barcode, 
            Nama: prefix + product.Nama_Barang,
            Harga_Beli: Number(product.Harga_Beli), 
            Harga_Jual: Number(product.Harga_Jual),
            Stok: Number(product.Stok || 0), // <--- INI OBATNYA BOS! BIAR STOK TERBACA!
            qty: qtyToAdd, 
            subtotal: qtyToAdd * Number(product.Harga_Jual),
            isTukar: isModeTukar
        });
    }

    // 5. Matikan tombol retur secara otomatis setelah 1 barang sukses masuk
    if (isModeTukar) {
        const btnTukar = document.getElementById("btnModeTukar");
        if (btnTukar) btnTukar.click(); // Ini akan mematikan warna merahnya
    }
    
    renderCart();
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
         const textColor = item.isTukar ? "text-red-500 font-bold" : "font-semibold text-gray-800";
// Gunakan variabel textColor ini di class nama produk dalam template row kamu
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
// 4. LOGIKA SINKRONISASI SCANNER HP (POLLING)
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
// 5. LOGIKA MODAL PEMBAYARAN (ANTI-ERROR)
// ==========================================
// Fungsi hitung dinamis
function updateModalHitungan() {
    const inputUangEl = document.getElementById("inputUang");
    const inputDiskonEl = document.getElementById("inputDiskon");
    
    // Keajaiban: Sistem akan mencari nama ID yang ada, baik yang lama maupun yang baru!
    const modalTotalEl = document.getElementById("modalTotalAkhir") || document.getElementById("modalTotal");
    const modalKembalianEl = document.getElementById("modalKembalian");

    if (!modalTotalEl || !modalKembalianEl) return;

    const bayar = Number(inputUangEl ? inputUangEl.value : 0) || 0;
    const diskon = Number(inputDiskonEl ? inputDiskonEl.value : 0) || 0;
    
    // Potong total dengan diskon
    const totalAkhir = cartTotal - diskon; 
    
    // Update Teks Total Tagihan
    if (totalAkhir < 0 && cartTotal < 0) {
        modalTotalEl.textContent = `KEMBALIKAN: Rp ${Math.abs(totalAkhir).toLocaleString('id-ID')}`;
        modalTotalEl.className = "text-3xl font-black text-red-500";
    } else {
        modalTotalEl.textContent = `Rp ${totalAkhir.toLocaleString('id-ID')}`;
        modalTotalEl.className = "text-4xl font-black text-slate-900";
    }

    // Update Teks Kembalian
    const kembali = bayar - totalAkhir;
    if (kembali >= 0) {
        modalKembalianEl.textContent = `Rp ${kembali.toLocaleString('id-ID')}`;
        modalKembalianEl.className = "text-2xl font-bold text-green-500";
    } else {
        modalKembalianEl.textContent = `Kurang Rp ${Math.abs(kembali).toLocaleString('id-ID')}`;
        modalKembalianEl.className = "text-2xl font-bold text-red-500";
    }
}

// FUNGSI BARU: Mengubah Persen (%) menjadi Nominal (Rp) otomatis
window.hitungDiskonPersen = function() {
    const persenEl = document.getElementById("inputDiskonPersen");
    const nominalEl = document.getElementById("inputDiskon");
    if (!persenEl || !nominalEl) return;

    let persen = Number(persenEl.value) || 0;
    
    // Cegah kasir masukin lebih dari 100%
    if (persen > 100) { 
        persen = 100; 
        persenEl.value = 100; 
    }

    // Rumus: (Total Belanja * Persen) / 100
    let nominalDiskon = (cartTotal * persen) / 100;
    
    // Masukkan hasilnya ke kotak Rp secara otomatis
    nominalEl.value = nominalDiskon;

    // Panggil fungsi hitung total tagihan agar berubah seketika
    updateModalHitungan();
};

// Tambahan: Jika kasir ngetik manual di kotak Rp, kosongkan kotak %-nya
document.getElementById("inputDiskon").addEventListener("input", () => {
    const persenEl = document.getElementById("inputDiskonPersen");
    if (persenEl) persenEl.value = ""; 
});
// Event Delegation untuk Input (Pasti Jalan walau HTML berantakan)
document.addEventListener("input", function(e) {
    if (e.target && (e.target.id === "inputUang" || e.target.id === "inputDiskon")) {
        updateModalHitungan();
    }
});

// Ganti Metode Pembayaran
document.addEventListener("change", function(e) {
    if (e.target && e.target.id === "paymentMethod") {
        const cashInputArea = document.getElementById("cashInputArea");
        const kembalianArea = document.getElementById("kembalianArea");
        if (e.target.value === "QRIS") {
            if(cashInputArea) cashInputArea.classList.add("hidden");
            if(kembalianArea) kembalianArea.classList.add("hidden");
        } else {
            if(cashInputArea) cashInputArea.classList.remove("hidden");
            if(kembalianArea) kembalianArea.classList.remove("hidden");
            const inputUangEl = document.getElementById("inputUang");
            if(inputUangEl) {
                inputUangEl.value = "";
                inputUangEl.focus();
            }
        }
        updateModalHitungan();
    }
});

// Buka Modal
document.getElementById("btnCheckout").addEventListener("click", () => {
    if (cart.length === 0) return;
    
    // 👇👇👇 TAMBAHAN RAZIA STOK SEBELUM CHECKOUT 👇👇👇
    let stokAman = true;
    let pesanError = "⚠️ GAGAL CHECKOUT!\nStok barang berikut tidak mencukupi:\n\n";

    for (let item of cart) {
        // Kita abaikan pengecekan jika barang tersebut adalah barang retur (isTukar)
        if (!item.isTukar && item.qty > Number(item.Stok || 0)) {
            stokAman = false;
            pesanError += `- ${item.Nama} (Diminta: ${item.qty}, Sisa Gudang: ${item.Stok || 0})\n`;
        }
    }

    // Jika ada yang kurang, batalkan buka modal dan tampilkan notifikasi
    if (!stokAman) {
        showToast(pesanError, "error"); 
        return; 
    }
    // 👆👆👆 ========================================= 👆👆👆

    // INI DIA YANG HILANG TADI BOS! (Variabel pengenal elemen HTML)
    const inputUangEl = document.getElementById("inputUang");
    const inputDiskonEl = document.getElementById("inputDiskon");
    const paymentMethodEl = document.getElementById("paymentMethod");
    
    if (inputUangEl) inputUangEl.value = "";
    if (inputDiskonEl) inputDiskonEl.value = "";
    if (paymentMethodEl) paymentMethodEl.value = "TUNAI";
    
    const cashInputArea = document.getElementById("cashInputArea");
    const kembalianArea = document.getElementById("kembalianArea");
    if(cashInputArea) cashInputArea.classList.remove("hidden");
    if(kembalianArea) kembalianArea.classList.remove("hidden");
    
    if (cartTotal < 0) { 
        if(inputUangEl) inputUangEl.disabled = true;
        if(inputDiskonEl) inputDiskonEl.disabled = true;
    } else {
        if(inputUangEl) inputUangEl.disabled = false;
        if(inputDiskonEl) inputDiskonEl.disabled = false;
    }
    
    updateModalHitungan(); 
    document.getElementById("paymentModal").classList.remove("hidden");
    if(inputUangEl) inputUangEl.focus();
});

// Tutup Modal
const tutupModal = () => document.getElementById("paymentModal").classList.add("hidden");
document.getElementById("btnTutupPayment").addEventListener("click", tutupModal);

// ==========================================
// 6. PROSES BAYAR & KIRIM DATA
// ==========================================
document.getElementById("btnProsesBayar").addEventListener("click", async () => {
    const inputUangEl = document.getElementById("inputUang");
    const inputDiskonEl = document.getElementById("inputDiskon");
    const paymentMethodEl = document.getElementById("paymentMethod");

    let bayar = Number(inputUangEl ? inputUangEl.value : 0) || 0;
    let diskon = Number(inputDiskonEl ? inputDiskonEl.value : 0) || 0;
    let metode = paymentMethodEl ? paymentMethodEl.value : "TUNAI";
    
    let totalAkhir = cartTotal - diskon;
    let kembali = bayar - totalAkhir;

    if (metode === "TUNAI" && totalAkhir > 0 && bayar < totalAkhir) {
        showToast("Uang pembayaran kurang bos!", "error");
    }
    if (metode === "QRIS" || totalAkhir < 0) { 
        bayar = Math.abs(totalAkhir); 
        kembali = 0;
    }

    const btnProses = document.getElementById("btnProsesBayar");
    btnProses.innerHTML = "⏳ Memproses..."; btnProses.disabled = true;

    const payload = { 
        action: "checkout", 
        kasir: sessionStorage.getItem("username"), 
        totalHarga: totalAkhir, 
        totalModal: cartTotalModal, 
        items: cart 
    };
    
    const res = await apiPost(payload);
    
    if (res.success) {
        cetakNota(cart, cartTotal, diskon, totalAkhir, metode, Math.abs(bayar), Math.abs(kembali));
        cart = []; 
        renderCart(); 
        if (typeof loadPendapatanHarian === "function") loadPendapatanHarian();
        tutupModal();
    } else { 
        showToast("Gagal menyimpan transaksi!", "success"); 
    }
    btnProses.innerHTML = "✓ Bayar & Cetak Struk"; btnProses.disabled = false;
});

// ==========================================
// 7. FUNGSI CETAK NOTA 
// ==========================================
function cetakNota(items, subtotal, diskon, totalAkhir, metode, bayar, kembali) {
    const printArea = document.getElementById("printArea");
    const kasirName = sessionStorage.getItem("username");
    const now = new Date();
    const tgl = now.toLocaleDateString('id-ID', {day: '2-digit', month: '2-digit', year: 'numeric'}) + " " + now.toLocaleTimeString('id-ID', {hour: '2-digit', minute: '2-digit'});
    const idTrx = "TRX" + now.getTime().toString().slice(-5); 

    let strukHTML = `
        <div style="text-align:center; border-bottom: 1px dashed black; padding-bottom: 5px; margin-bottom: 5px;">
            <h2 style="margin:0; font-weight:bold;">GUDANG RETAIL</h2>
            <p style="margin:0; font-size:10px;">Jl. Teknologi No. 1</p>
        </div>
        <div style="font-size:10px; border-bottom: 1px dashed black; padding-bottom: 5px; margin-bottom: 5px;">
            <p style="margin:0;">Tgl : ${tgl}</p>
            <p style="margin:0;">Ksr : ${kasirName}</p>
            <p style="margin:0;">TRX : ${idTrx}</p>
        </div>
        <table style="width: 100%; font-size:10px; margin-bottom: 5px;">
    `;
    
    items.forEach(item => {
        strukHTML += `
            <tr><td colspan="3" style="font-weight:bold;">${item.Nama}</td></tr>
            <tr>
                <td style="width: 15%;">${item.qty}x</td>
                <td style="width: 35%;">@${item.Harga_Jual.toLocaleString('id-ID')}</td>
                <td style="width: 50%; text-align:right;">${item.subtotal.toLocaleString('id-ID')}</td>
            </tr>
        `;
    });
    
    strukHTML += `</table><div style="border-top: 1px dashed black; margin: 5px 0;"></div><table style="width: 100%; font-size:10px; font-weight:bold;"><tr><td>SUBTOTAL</td><td style="text-align:right;">Rp ${subtotal.toLocaleString('id-ID')}</td></tr>`;

    if (diskon > 0) {
        strukHTML += `<tr><td>DISKON</td><td style="text-align:right;">- Rp ${diskon.toLocaleString('id-ID')}</td></tr>`;
    }

    strukHTML += `<tr style="font-size:12px;"><td>TOTAL</td><td style="text-align:right;">Rp ${totalAkhir.toLocaleString('id-ID')}</td></tr>`;

    if (metode === "QRIS") {
        strukHTML += `</table><div style="text-align:center; border:1px dashed black; padding:5px; margin-top:5px; font-weight:bold; font-size:10px;">LUNAS VIA QRIS</div>`;
    } else {
        strukHTML += `<tr><td>TUNAI</td><td style="text-align:right;">Rp ${bayar.toLocaleString('id-ID')}</td></tr><tr><td>KEMBALI</td><td style="text-align:right;">Rp ${kembali.toLocaleString('id-ID')}</td></tr></table>`;
    }

    strukHTML += `<div style="border-top: 1px dashed black; margin: 5px 0;"></div><div style="text-align:center; font-size:10px;"><p>*** TERIMA KASIH ***</p></div>`;
    
    printArea.innerHTML = strukHTML;
    window.print();
}
// ==========================================
// 8. MEMUAT PENDAPATAN HARIAN KASIR
// ==========================================
async function loadPendapatanHarian() {
    const elOmzet = document.getElementById("omzetKasirHarian");
    if(!elOmzet) return; 
    
    const kasirAktif = sessionStorage.getItem("username");
    
    const now = new Date();
    const dd = String(now.getDate()).padStart(2, '0');
    const mm = String(now.getMonth() + 1).padStart(2, '0');
    const yyyy = now.getFullYear();
    const todayStr = `${dd}/${mm}/${yyyy}`;

    const response = await apiGet("getTransactions");
    
    if (response.success && response.data) {
        let omzetHariIni = 0;
        
        response.data.forEach(trx => {
            if (!trx.Tanggal) return;
            let tanggalSaja = "";
            const dateString = String(trx.Tanggal);
            
            // Penyesuaian format tanggal
            if (dateString.includes("T")) {
                const dObj = new Date(dateString);
                const d = String(dObj.getDate()).padStart(2, '0');
                const m = String(dObj.getMonth() + 1).padStart(2, '0');
                const y = dObj.getFullYear();
                tanggalSaja = `${d}/${m}/${y}`;
            } else {
                tanggalSaja = dateString.split(" ")[0];
            }

            if (tanggalSaja === todayStr && trx.Kasir === kasirAktif) {
                omzetHariIni += (Number(trx.Total_Harga) || 0);
            }
        });
        
        elOmzet.textContent = `Rp ${omzetHariIni.toLocaleString('id-ID')}`;
    } else {
        elOmzet.textContent = "Rp 0";
    }
}

// ==========================================
// 9. JALANKAN SEMUA FUNGSI SAAT WEB DIBUKA
// ==========================================
window.onload = () => {
    loadCatalog();          // Tarik data barang
    loadPendapatanHarian(); // Tarik data omzet
};

// ==========================================
// FUNGSI KLIK TOMBOL RETUR
// ==========================================
const btnTukar = document.getElementById("btnModeTukar");
if (btnTukar) {
    btnTukar.addEventListener("click", () => {
        isModeTukar = !isModeTukar;
        const banner = document.getElementById("tukarBanner");
        
        if (isModeTukar) {
            // Jika mode retur NYALA (Jadi Merah)
            if (banner) banner.classList.remove("hidden");
            btnTukar.className = "w-full mb-4 bg-red-600 text-white p-3 rounded-xl font-bold flex items-center justify-center gap-2 hover:bg-red-700 transition-all shadow-lg";
            btnTukar.innerHTML = `Batalkan Mode Retur`;
        } else {
            // Jika mode retur MATI (Kembali Abu-abu)
            if (banner) banner.classList.add("hidden");
            btnTukar.className = "w-full mb-4 bg-gray-100 text-gray-600 p-3 rounded-xl font-bold flex items-center justify-center gap-2 hover:bg-red-50 hover:text-red-600 transition-all border border-gray-200";
            btnTukar.innerHTML = `Aktifkan Mode Retur`;
        }
    });
}

// LOGIKA PENGELUARAN
const expModal = document.getElementById("expenseModal");
document.getElementById("btnPengeluaran").addEventListener("click", () => expModal.classList.remove("hidden"));
document.getElementById("btnCancelExp").addEventListener("click", () => expModal.classList.add("hidden"));

document.getElementById("btnSaveExp").addEventListener("click", async () => {
    const note = document.getElementById("expNote").value;
    const amount = document.getElementById("expAmount").value;
    if(!note || !amount) return showToast("Isi semua data!", "error");

    const btn = document.getElementById("btnSaveExp");
    btn.textContent = "Menyimpan..."; btn.disabled = true;

    const res = await apiPost({ 
        action: "addExpense", // Pastikan di Apps Script kamu ada fungsi addExpense
        user: sessionStorage.getItem("username"),
        note: note,
        amount: Number(amount)
    });

    if(res.success) {
        showToast("Pengeluaran tercatat!", "success");
        expModal.classList.add("hidden");
        document.getElementById("expNote").value = "";
        document.getElementById("expAmount").value = "";
    }
    btn.textContent = "Simpan"; btn.disabled = false;
});