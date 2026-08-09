(function () {
    const loginForm = document.getElementById('loginForm');
    const registerForm = document.getElementById('registerForm');

    if (loginForm) {
        loginForm.addEventListener('submit', async function (e) {
            e.preventDefault();
            const email = document.getElementById('email').value.trim();
            const password = document.getElementById('password').value;
            const formError = document.getElementById('formError');
            const loginBtn = document.getElementById('loginBtn');

            formError.textContent = '';
            document.querySelectorAll('.form-error').forEach(el => el.textContent = '');
            loginBtn.disabled = true;
            loginBtn.textContent = 'Memproses...';

            try {
                const data = await api('/api/auth/login', {
                    method: 'POST',
                    body: { email, password },
                });
                if (data.data.role === 'owner') {
                    window.location.href = '/dashboard.html';
                } else {
                    window.location.href = '/pos.html';
                }
            } catch (err) {
                formError.textContent = err.message;
            } finally {
                loginBtn.disabled = false;
                loginBtn.textContent = 'Masuk';
            }
        });
    }

    if (registerForm) {
        registerForm.addEventListener('submit', async function (e) {
            e.preventDefault();
            const name = document.getElementById('name').value.trim();
            const email = document.getElementById('email').value.trim();
            const password = document.getElementById('password').value;
            const storeName = document.getElementById('storeName').value.trim();
            const formError = document.getElementById('formError');
            const registerBtn = document.getElementById('registerBtn');

            formError.textContent = '';
            document.querySelectorAll('.form-error').forEach(el => el.textContent = '');
            registerBtn.disabled = true;
            registerBtn.textContent = 'Memproses...';

            if (password.length < 8) {
                document.getElementById('passwordError').textContent = 'Password minimal 8 karakter';
                registerBtn.disabled = false;
                registerBtn.textContent = 'Daftar Sekarang';
                return;
            }

            try {
                await api('/api/auth/register', {
                    method: 'POST',
                    body: { name, email, password, store_name: storeName },
                });
                window.location.href = '/dashboard.html';
            } catch (err) {
                formError.textContent = err.message;
            } finally {
                registerBtn.disabled = false;
                registerBtn.textContent = 'Daftar Sekarang';
            }
        });
    }

    const logoutBtn = document.getElementById('logoutBtn');
    if (logoutBtn) {
        logoutBtn.addEventListener('click', async function () {
            try {
                await api('/api/auth/logout', { method: 'POST' });
                window.location.href = '/login.html';
            } catch (err) {
                window.location.href = '/login.html';
            }
        });
    }

    const savePaymentMethods = document.getElementById('savePaymentMethods');
    if (savePaymentMethods) {
        savePaymentMethods.addEventListener('click', async function () {
            const paymentMethods = [];
            if (document.getElementById('pmCash').checked) paymentMethods.push('cash');
            if (document.getElementById('pmQris').checked) paymentMethods.push('qris');
            if (document.getElementById('pmTransfer').checked) paymentMethods.push('transfer');
            if (document.getElementById('pmOther').checked) paymentMethods.push('other');
            try {
                await api('/api/settings/payment-methods', {
                    method: 'PATCH',
                    body: { payment_methods: paymentMethods },
                });
                showToast('Metode pembayaran disimpan', 'success');
            } catch (err) {
                showToast(err.message, 'error');
            }
        });
    }

    const profileForm = document.getElementById('profileForm');
    if (profileForm) {
        profileForm.addEventListener('submit', async function (e) {
            e.preventDefault();
            const name = document.getElementById('settingsName').value.trim();
            const email = document.getElementById('settingsEmail').value.trim();
            const password = document.getElementById('settingsPassword').value;
            const body = { name, email };
            if (password) body.password = password;
            try {
                await api('/api/auth/profile', {
                    method: 'PATCH',
                    body,
                });
                showToast('Profil berhasil diperbarui', 'success');
                document.getElementById('settingsPassword').value = '';
            } catch (err) {
                showToast(err.message, 'error');
            }
        });
    }

    const storeForm = document.getElementById('storeForm');
    if (storeForm) {
        storeForm.addEventListener('submit', async function (e) {
            e.preventDefault();
            const storeName = document.getElementById('storeName').value.trim();
            const currency = document.getElementById('storeCurrency').value.trim();
            const timezone = document.getElementById('storeTimezone').value;
            const lowStockThreshold = parseInt(document.getElementById('storeLowStock').value) || 10;
            const receiptFooter = document.getElementById('storeReceiptFooter').value.trim();
            try {
                await api('/api/settings/store', {
                    method: 'PATCH',
                    body: {
                        store_name: storeName,
                        currency,
                        timezone,
                        low_stock_threshold: lowStockThreshold,
                        receipt_footer: receiptFooter,
                    },
                });
                showToast('Pengaturan toko disimpan', 'success');
            } catch (err) {
                showToast(err.message, 'error');
            }
        });

        (async function loadSettings() {
            try {
                const data = await api('/api/auth/me');
                const user = data.data;
                document.getElementById('settingsName').value = user.name || '';
                document.getElementById('settingsEmail').value = user.email || '';
                if (user.store) {
                    document.getElementById('storeName').value = user.store.name || '';
                    document.getElementById('storeCurrency').value = user.store.currency || 'Rp';
                    document.getElementById('storeTimezone').value = user.store.timezone || 'Asia/Jakarta';
                    document.getElementById('storeLowStock').value = user.store.low_stock_threshold || 10;
                    document.getElementById('storeReceiptFooter').value = user.store.receipt_footer || 'Terima kasih telah berbelanja!';
                    const pm = user.store.payment_methods || ['cash', 'qris', 'transfer', 'other'];
                    document.getElementById('pmCash').checked = pm.includes('cash');
                    document.getElementById('pmQris').checked = pm.includes('qris');
                    document.getElementById('pmTransfer').checked = pm.includes('transfer');
                    document.getElementById('pmOther').checked = pm.includes('other');
                }
            } catch (err) {}
        })();
    }
})();
