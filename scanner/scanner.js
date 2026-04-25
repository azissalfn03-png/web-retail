/**
 * File: scanner.js
 * Menangani akses kamera HP dan pengiriman data ke Google Apps Script.
 */

// 1. Verifikasi Keamanan
checkAuth("scanner");

const sessionIdInput = document.getElementById("sessionIdInput");
const statusText = document.getElementById("statusText");

// Mencegah HP tertidur saat halaman ini terbuka (Opsional, fitur browser modern)
if ('wakeLock' in navigator) {
    navigator.wakeLock.request('screen').catch(err => console.log('Wake Lock error', err));
}

// Inisialisasi konfigurasi html5-qrcode
const html5QrCode = new Html5Qrcode("reader");
const config = { fps: 10, qrbox: { width: 250, height: 100 } };

/**
 * Fungsi ini dipanggil saat kamera berhasil membaca sebuah Barcode
 */
async function onScanSuccess(decodedText, decodedResult) {
    const sessionId = sessionIdInput.value.trim().toUpperCase();

    // Validasi: Pastikan Session ID sudah diisi oleh kasir/staf gudang
    if (!sessionId) {
        alert("Harap masukkan Session ID terlebih dahulu!");
        return;
    }

    // Jeda scanner sementara agar tidak membaca barcode yang sama berkali-kali dalam sedetik
    html5QrCode.pause();
    statusText.textContent = "Mengirim data ke PC...";
    statusText.classList.replace("text-gray-400", "text-yellow-400");

    // Kirim data ke Backend (GAS) menggunakan apiPost
    const payload = {
        action: "sendScan",
        sessionId: sessionId,
        barcode: decodedText
    };

    const response = await apiPost(payload);

    if (response.success) {
        statusText.textContent = "Sukses! Barcode terkirim.";
        statusText.classList.replace("text-yellow-400", "text-green-400");
        
        // Bunyikan "Beep" sukses (menggunakan API Web Audio bawaan browser)
        beep(); 
    } else {
        alert("Gagal mengirim data. Coba lagi.");
        statusText.textContent = "Arahkan kamera ke barcode/QR Code produk.";
        statusText.classList.replace("text-yellow-400", "text-gray-400");
    }

    // Lanjutkan scanner setelah 2 detik
    setTimeout(() => {
        statusText.textContent = "Arahkan kamera ke barcode/QR Code produk.";
        statusText.classList.replace("text-green-400", "text-gray-400");
        html5QrCode.resume();
    }, 2000);
}

/**
 * Memulai akses kamera belakang (environment)
 */
html5QrCode.start({ facingMode: "environment" }, config, onScanSuccess)
    .catch((err) => {
        statusText.textContent = "Gagal mengakses kamera. Pastikan izin diberikan.";
        console.error("Camera Error:", err);
    });

// FUNGSI HELPER: Membuat suara Beep sederhana
function beep() {
    const context = new (window.AudioContext || window.webkitAudioContext)();
    const oscillator = context.createOscillator();
    oscillator.type = "sine";
    oscillator.frequency.value = 800; // Frekuensi nada
    oscillator.connect(context.destination);
    oscillator.start();
    setTimeout(() => oscillator.stop(), 150); // Bunyi selama 150ms
}