(function () {
    let page = 1;
    const transactionsBody = document.getElementById('transactionsBody');
    const transactionsPagination = document.getElementById('transactionsPagination');
    const searchTransaction = document.getElementById('searchTransaction');
    const filterDate = document.getElementById('filterDate');
    const filterPayment = document.getElementById('filterPayment');
    const filterStatus = document.getElementById('filterStatus');
    const transactionDetailContent = document.getElementById('transactionDetailContent');
    const transactionDetailFooter = document.getElementById('transactionDetailFooter');

    async function loadTransactions() {
        try {
            const search = searchTransaction.value;
            const date = filterDate.value;
            const payment = filterPayment.value;
            const status = filterStatus.value;
            let url = `/api/transactions?page=${page}&limit=20`;
            if (search) url += `&search=${encodeURIComponent(search)}`;
            if (date) url += `&date=${date}`;
            if (payment) url += `&payment_method=${payment}`;
            if (status) url += `&status=${status}`;
            const data = await api(url);
            const transactions = data.data.transactions || [];
            const total = data.data.total || 0;
            renderTransactions(transactions);
            renderPagination(total);
        } catch (err) {
            showToast(err.message, 'error');
        }
    }

    function renderTransactions(transactions) {
        if (!transactions.length) {
            transactionsBody.innerHTML = `<tr><td colspan="7"><div class="empty-state"><p>Tidak ada transaksi</p><span>Transaksi akan muncul di sini</span></div></td></tr>`;
            return;
        }
        transactionsBody.innerHTML = transactions.map(t => `
            <tr>
                <td class="text-mono">${t.transaction_id}</td>
                <td>${formatDateTime(t.created_at)}</td>
                <td>${t.staff_name || '-'}</td>
                <td>${formatCurrency(t.total)}</td>
                <td>${t.payment_method.toUpperCase()}</td>
                <td><span class="badge ${t.status === 'completed' ? 'badge-success' : 'badge-danger'}">${t.status === 'completed' ? 'Selesai' : 'Dibatalkan'}</span></td>
                <td>
                    <button class="btn-icon view-transaction" data-id="${t.id}" aria-label="Lihat detail">
                        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/><circle cx="12" cy="12" r="3"/></svg>
                    </button>
                </td>
            </tr>
        `).join('');

        transactionsBody.querySelectorAll('.view-transaction').forEach(btn => {
            btn.addEventListener('click', async function () {
                try {
                    const data = await api(`/api/transactions/${this.dataset.id}`);
                    const t = data.data;
                    renderTransactionDetail(t);
                    openModal('transactionDetailModal');
                } catch (err) {
                    showToast(err.message, 'error');
                }
            });
        });
    }

    function renderTransactionDetail(t) {
        transactionDetailContent.innerHTML = `
            <div style="margin-bottom:16px;">
                <strong>${t.transaction_id}</strong>
                <div style="color:var(--text-secondary);font-size:0.875rem;">${formatDateTime(t.created_at)}</div>
                <div style="color:var(--text-secondary);font-size:0.875rem;">Staff: ${t.staff_name || '-'}</div>
            </div>
            <table class="data-table" style="width:100%;margin-bottom:16px;">
                <thead><tr><th>Produk</th><th>Qty</th><th>Harga</th><th>Subtotal</th></tr></thead>
                <tbody>
                    ${(t.items || []).map(item => `
                        <tr>
                            <td>${item.product_name}</td>
                            <td>${item.quantity}</td>
                            <td>${formatCurrency(item.price)}</td>
                            <td>${formatCurrency(item.price * item.quantity)}</td>
                        </tr>
                    `).join('')}
                </tbody>
            </table>
            <div style="display:flex;justify-content:space-between;padding:8px 0;"><span>Total</span><strong>${formatCurrency(t.total)}</strong></div>
            <div style="display:flex;justify-content:space-between;padding:4px 0;color:var(--text-secondary);"><span>Pembayaran</span>${t.payment_method.toUpperCase()}</div>
            ${t.payment_amount ? `<div style="display:flex;justify-content:space-between;padding:4px 0;color:var(--text-secondary);"><span>Jumlah Bayar</span>${formatCurrency(t.payment_amount)}</div>` : ''}
            ${t.change_amount > 0 ? `<div style="display:flex;justify-content:space-between;padding:4px 0;color:var(--text-secondary);"><span>Kembalian</span>${formatCurrency(t.change_amount)}</div>` : ''}
            <div style="margin-top:8px;"><span class="badge ${t.status === 'completed' ? 'badge-success' : 'badge-danger'}">${t.status === 'completed' ? 'Selesai' : 'Dibatalkan'}</span></div>
        `;
        transactionDetailFooter.innerHTML = '';
        if (t.status === 'completed') {
            transactionDetailFooter.innerHTML = `<button class="btn-danger btn-sm" id="cancelTransactionBtn" data-id="${t.id}">Batalkan Transaksi</button>`;
            transactionDetailFooter.querySelector('#cancelTransactionBtn').addEventListener('click', async function () {
                if (!confirm('Batalkan transaksi ini? Stok akan dikembalikan.')) return;
                try {
                    await api(`/api/transactions/${this.dataset.id}/cancel`, { method: 'POST' });
                    showToast('Transaksi dibatalkan', 'success');
                    closeModal('transactionDetailModal');
                    loadTransactions();
                } catch (err) {
                    showToast(err.message, 'error');
                }
            });
        }
    }

    function renderPagination(total) {
        const totalPages = Math.ceil(total / 20);
        if (totalPages <= 1) { transactionsPagination.innerHTML = ''; return; }
        let html = `<button ${page === 1 ? 'disabled' : ''} data-page="${page - 1}">←</button>`;
        for (let i = 1; i <= totalPages; i++) {
            html += `<button class="${i === page ? 'active' : ''}" data-page="${i}">${i}</button>`;
        }
        html += `<button ${page === totalPages ? 'disabled' : ''} data-page="${page + 1}">→</button>`;
        transactionsPagination.innerHTML = html;
        transactionsPagination.querySelectorAll('button').forEach(btn => {
            btn.addEventListener('click', function () {
                const p = parseInt(this.dataset.page);
                if (p >= 1 && p <= totalPages) { page = p; loadTransactions(); }
            });
        });
    }

    searchTransaction.addEventListener('input', debounce(loadTransactions, 300));
    filterDate.addEventListener('change', function () { page = 1; loadTransactions(); });
    filterPayment.addEventListener('change', function () { page = 1; loadTransactions(); });
    filterStatus.addEventListener('change', function () { page = 1; loadTransactions(); });

    function debounce(fn, delay) {
        let timer;
        return function (...args) {
            clearTimeout(timer);
            timer = setTimeout(() => fn.apply(this, args), delay);
        };
    }

    loadTransactions();
})();
