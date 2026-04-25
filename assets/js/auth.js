/**
 * File: auth.js
 * Fungsi: Menangani proses login dan rute (routing) ke modul yang sesuai.
 */

const loginForm = document.getElementById("loginForm");
const errorMessage = document.getElementById("errorMessage");

// Akun dummy sementara untuk pengujian tanpa hit ke database terus-menerus.
// Pada sistem produksi nyata, verifikasi ini harus dilakukan di Backend (GAS).
const DUMMY_USERS = {
    "admin": { user: "admin", pass: "admin123" },
    "kasir": { user: "kasir1", pass: "kasir123" },
    "gudang": { user: "staf", pass: "staf123" },
    "scanner": { user: "hp1", pass: "scan123" }
};

if (loginForm) {
    loginForm.addEventListener("submit", function(e) {
        e.preventDefault(); // Mencegah halaman refresh saat tombol submit ditekan

        const role = document.getElementById("role").value;
        const usernameInput = document.getElementById("username").value;
        const passwordInput = document.getElementById("password").value;

        // Validasi Kredensial Sederhana
        if (DUMMY_USERS[role] && 
            DUMMY_USERS[role].user === usernameInput && 
            DUMMY_USERS[role].pass === passwordInput) {
            
            // Simpan sesi login ke dalam sessionStorage browser
            sessionStorage.setItem("isLoggedIn", "true");
            sessionStorage.setItem("userRole", role);
            sessionStorage.setItem("username", usernameInput);

            // Arahkan (Redirect) ke modul yang sesuai
            switch(role) {
                case "admin":
                    window.location.href = "admin/dashboard.html";
                    break;
                case "kasir":
                    window.location.href = "kasir/pos.html";
                    break;
                case "gudang":
                    window.location.href = "gudang/stok.html";
                    break;
                case "scanner":
                    window.location.href = "scanner/mobile-scan.html";
                    break;
            }
        } else {
            // Tampilkan pesan error jika login gagal
            errorMessage.textContent = "Username atau Password salah untuk role tersebut!";
            errorMessage.classList.remove("hidden");
        }
    });
}

/**
 * Fungsi utilitas untuk memproteksi halaman modul.
 * Panggil fungsi ini di baris pertama pada file admin.js, kasir.js, dll.
 * Jika belum login, akan langsung dilempar kembali ke index.html.
 */
function checkAuth(requiredRole) {
    const isLoggedIn = sessionStorage.getItem("isLoggedIn");
    const currentRole = sessionStorage.getItem("userRole");

    if (!isLoggedIn || currentRole !== requiredRole) {
        alert("Akses Ditolak! Silakan login kembali.");
        // Arahkan kembali ke portal login (naik satu tingkat dari folder modul)
        window.location.href = "../index.html"; 
    }
}

/**
 * Fungsi untuk Logout
 */
function logout() {
    sessionStorage.clear();
    window.location.href = "../index.html";
}