import { test, expect } from '@playwright/test';

test.describe('TMPT Auth & Setup Flow', () => {
  test('harus dapat melakukan setup Tmpt baru dari landing page', async ({ page }) => {
    // 1. Buka landing page
    await page.goto('/');
    await expect(page).toHaveTitle(/TMPT/);

    // 2. Klik tombol "Mulai Gratis"
    const startButton = page.locator('#hero-btn-primary');
    await expect(startButton).toBeVisible();
    await startButton.click();

    // Karena localStorage bersih di Playwright sandbox, harusnya diarahkan ke halaman login
    // yang menampilkan pesan bahwa Tmpt/Brankas belum dibuat.
    await expect(page).toHaveURL(/\/app\/auth\/login\//);
    await expect(page.locator('text=Brankas tidak ditemukan di browser ini')).toBeVisible();

    // 3. Klik tombol "Buat Baru"
    const createNewBtn = page.locator('a:has-text("Buat Baru")');
    await expect(createNewBtn).toBeVisible();
    await createNewBtn.click();

    // Harus dialihkan ke halaman setup
    await expect(page).toHaveURL(/\/app\/auth\/setup\//);

    // 4. Isi Form Pendaftaran
    await page.fill('#vault_name', 'Tmpt Kerja Playwright');
    await page.fill('#password', 'password-super-aman-e2e-testing');
    await page.fill('#confirm_password', 'password-super-aman-e2e-testing');
    
    // Centang checkbox konfirmasi risiko
    const riskCheckbox = page.locator('input[type="checkbox"]');
    await riskCheckbox.check();

    // Klik tombol submit
    const submitBtn = page.locator('#submit-btn');
    await submitBtn.click();

    // 5. Setelah setup berhasil, sistem akan otomatis melakukan unlock dan mengarahkan ke halaman vault
    // Gunakan timeout agak panjang karena proses derive key PBKDF2 100.000 iterasi membutuhkan waktu
    await page.waitForURL(/\/app\/tools\/vault\//, { timeout: 15000 });
    
    // Verifikasi bahwa modul vault telah dimuat dan menampilkan header halaman Brangkas (Vault)
    await expect(page.locator('h1:has-text("Brangkas")')).toBeVisible();
  });
});
