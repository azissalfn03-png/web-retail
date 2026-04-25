/**
 * File: api.js
 * Fungsi: Mengelola semua request HTTP ke Google Apps Script.
 * Konsep: Modularisasi (Clean Code) - Memisahkan logika jaringan dari logika UI.
 */

// TODO: Ganti URL di bawah ini dengan Web App URL Google Apps Script Anda!
const GAS_URL = "https://script.google.com/macros/s/AKfycbzDhEZEVbXFY5ftpDk4MrXYekxzMffZEVcorAP8ekeiixWlDqOTT3g8vwHFazoaGfB01A/exec";

/**
 * Fungsi untuk melakukan request GET (Mengambil data)
 * @param {string} action - Nama aksi yang dikirim ke backend (contoh: 'getProducts')
 * @param {object} params - Parameter tambahan (opsional, contoh: { sessionId: '123' })
 */
async function apiGet(action, params = {}) {
    try {
        // Membangun URL dengan query parameters
        let url = new URL(GAS_URL);
        url.searchParams.append("action", action);
        
        // Loop untuk menambahkan parameter lain jika ada
        for (const key in params) {
            url.searchParams.append(key, params[key]);
        }

        const response = await fetch(url);
        const result = await response.json();
        return result;
    } catch (error) {
        console.error("API GET Error:", error);
        return { error: true, message: "Gagal terhubung ke server." };
    }
}

/**
 * Fungsi untuk melakukan request POST (Mengirim data)
 * @param {object} payload - Data yang akan dikirim (contoh: { action: 'sendScan', barcode: '123' })
 */
async function apiPost(payload) {
    try {
        const response = await fetch(GAS_URL, {
            method: "POST",
            // Menggunakan text/plain untuk menghindari CORS preflight block dari Google
            headers: {
                "Content-Type": "text/plain;charset=utf-8", 
            },
            body: JSON.stringify(payload)
        });
        const result = await response.json();
        return result;
    } catch (error) {
        console.error("API POST Error:", error);
        return { error: true, message: "Gagal mengirim data ke server." };
    }
}