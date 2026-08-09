(function () {
    let cart = [];
    let products = [];

    const posSearch = document.getElementById('posSearch');
    const posProducts = document.getElementById('posProducts');
    const posCartItems = document.getElementById('posCartItems');
    const posTotal = document.getElementById('posTotal');
    const paymentMethod = document.getElementById('paymentMethod');
    const paymentAmount = document.getElementById('paymentAmount');
    const posCashInput = document.getElementById('posCashInput');
    const posChange = document.getElementById('posChange');
    const changeAmount = document.getElementById('changeAmount');
    const completeSaleBtn = document.getElementById('completeSale');
    const clearCartBtn = document.getElementById('clearCart');
    const receiptContent = document.getElementById('receiptContent');
    const btnNewSale = document.getElementById('btnNewSale');
    const btnPrintReceipt = document.getElementById('btnPrintReceipt');

    async function loadProducts(search = '') {
        try {
            const data = await api(`/api/products?status=active&search=${encodeURIComponent(search)}&limit=100`);
            products = data.data.products || [];
            renderProducts(products);
        } catch (err) {
            showToast(err.message, 'error');
        }
    }

    function renderProducts(list) {
        posProducts.innerHTML = list.map(p => `
            <div class="pos-product-card" data-id="${p.id}" data-name="${p.name}" data-price="${p.selling_price}" data-stock="${p.stock}">
                <div class="product-name">${p.name}</div>
                <div class="product-price">${formatCurrency(p.selling_price)}</div>
                <div class="product-stock">Stok: ${p.stock}</div>
            </div>
        `).join('');

        posProducts.querySelectorAll('.pos-product-card').forEach(card => {
            card.addEventListener('click', function () {
                const id = this.dataset.id;
                const name = this.dataset.name;
                const price = parseFloat(this.dataset.price);
                const stock = parseInt(this.dataset.stock);
                if (stock <= 0) {
                    showToast('Stok tidak mencukupi', 'warning');
                    return;
                }
                addToCart(id, name, price, stock);
            });
        });
    }

    function addToCart(id, name, price, stock) {
        const existing = cart.find(item => item.id === id);
        if (existing) {
            if (existing.qty >= stock) {
                showToast('Stok tidak mencukupi', 'warning');
                return;
            }
            existing.qty += 1;
        } else {
            cart.push({ id, name, price, stock, qty: 1 });
        }
        renderCart();
    }

    function removeFromCart(index) {
        cart.splice(index, 1);
        renderCart();
    }

    function updateQty(index, delta) {
        const item = cart[index];
        const newQty = item.qty + delta;
        if (newQty < 1) {
            removeFromCart(index);
            return;
        }
        if (newQty > item.stock) {
            showToast('Stok tidak mencukupi', 'warning');
            return;
        }
        item.qty = newQty;
        renderCart();
    }

    function calculateTotal() {
        return cart.reduce((sum, item) => sum + item.price * item.qty, 0);
    }

    function renderCart() {
        const total = calculateTotal();
        posTotal.textContent = formatCurrency(total);

        if (cart.length === 0) {
            posCartItems.innerHTML = `
                <div class="empty-state">
                    <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5"><circle cx="9" cy="21" r="1"/><circle cx="20" cy="21" r="1"/><path d="M1 1h4l2.68 13.39a2 2 0 0 0 2 1.61h9.72a2 2 0 0 0 2-1.61L23 6H6"/></svg>
                    <p>Keranjang kosong</p>
                    <span>Pilih produk untuk memulai transaksi</span>
                </div>
            `;
            completeSaleBtn.disabled = true;
        } else {
            posCartItems.innerHTML = cart.map((item, index) => `
                <div class="pos-cart-item">
                    <div class="pos-cart-item-info">
                        <div class="item-name">${item.name}</div>
                        <div class="item-price">${formatCurrency(item.price)}</div>
                    </div>
                    <div class="pos-cart-item-qty">
                        <button onclick="window.posUpdateQty(${index}, -1)">-</button>
                        <span>${item.qty}</span>
                        <button onclick="window.posUpdateQty(${index}, 1)">+</button>
                    </div>
                    <div class="pos-cart-item-subtotal">${formatCurrency(item.price * item.qty)}</div>
                    <button class="pos-cart-item-remove" onclick="window.posRemoveItem(${index})">
                        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
                    </button>
                </div>
            `).join('');
            completeSaleBtn.disabled = false;
        }
        updatePaymentUI();
    }

    window.posUpdateQty = function (index, delta) {
        updateQty(index, delta);
    };

    window.posRemoveItem = function (index) {
        removeFromCart(index);
    };

    function updatePaymentUI() {
        const method = paymentMethod.value;
        if (method === 'cash') {
            posCashInput.style.display = 'flex';
        } else {
            posCashInput.style.display = 'none';
            posChange.style.display = 'none';
            paymentAmount.value = '';
        }
    }

    paymentMethod.addEventListener('change', updatePaymentUI);

    paymentAmount.addEventListener('input', function () {
        const total = calculateTotal();
        const paid = parseFloat(this.value) || 0;
        if (paid >= total && total > 0) {
            posChange.style.display = 'flex';
            changeAmount.textContent = formatCurrency(paid - total);
        } else {
            posChange.style.display = 'none';
        }
    });

    clearCartBtn.addEventListener('click', function () {
        cart = [];
        renderCart();
    });

    completeSaleBtn.addEventListener('click', async function () {
        if (cart.length === 0) return;
        const total = calculateTotal();
        const method = paymentMethod.value;
        const paid = parseFloat(paymentAmount.value) || 0;

        if (method === 'cash' && paid < total) {
            showToast('Jumlah pembayaran kurang', 'warning');
            return;
        }

        completeSaleBtn.disabled = true;
        completeSaleBtn.textContent = 'Memproses...';

        try {
            const data = await api('/api/transactions', {
                method: 'POST',
                body: {
                    items: cart.map(item => ({
                        product_id: item.id,
                        quantity: item.qty,
                    })),
                    payment_method: method,
                    payment_amount: method === 'cash' ? paid : total,
                },
            });

            const t = data.data;
            const changeAmountValue = method === 'cash' ? paid - total : 0;
            receiptContent.innerHTML = `
                <div class="receipt-print" style="font-family:var(--font-mono);font-size:0.8125rem;line-height:1.8;">
                    <div style="text-align:center;margin-bottom:16px;">
                        <strong style="font-size:1rem;">${t.store_name || 'Kasir Digital'}</strong>
                        <div style="color:var(--text-secondary);">${t.transaction_id}</div>
                        <div style="color:var(--text-secondary);">${formatDateTime(t.created_at)}</div>
                    </div>
                    <div style="border-top:1px dashed var(--border);border-bottom:1px dashed var(--border);padding:12px 0;margin-bottom:12px;">
                        ${cart.map(item => `
                            <div style="display:flex;justify-content:space-between;">
                                <span>${item.name} &times; ${item.qty}</span>
                                <span>${formatCurrency(item.price * item.qty)}</span>
                            </div>
                        `).join('')}
                    </div>
                    <div style="display:flex;justify-content:space-between;font-weight:600;"><span>Total</span><span>${formatCurrency(total)}</span></div>
                    ${method === 'cash' ? `<div style="display:flex;justify-content:space-between;"><span>Cash</span><span>${formatCurrency(paid)}</span></div>` : ''}
                    ${method === 'cash' ? `<div style="display:flex;justify-content:space-between;font-weight:600;"><span>Kembalian</span><span>${formatCurrency(changeAmountValue)}</span></div>` : ''}
                    <div style="display:flex;justify-content:space-between;margin-top:8px;"><span>Pembayaran</span><span>${method.toUpperCase()}</span></div>
                    <div style="text-align:center;margin-top:16px;color:var(--text-secondary);font-style:italic;">${t.receipt_footer || 'Terima kasih telah berbelanja!'}</div>
                </div>
            `;
            openModal('receiptModal');
            cart = [];
            renderCart();
            showToast('Transaksi berhasil', 'success');
        } catch (err) {
            showToast(err.message, 'error');
        } finally {
            completeSaleBtn.disabled = false;
            completeSaleBtn.textContent = 'Selesaikan Pembayaran';
        }
    });

    btnNewSale.addEventListener('click', function () {
        closeModal('receiptModal');
        cart = [];
        renderCart();
    });

    btnPrintReceipt.addEventListener('click', function () {
        const printContent = receiptContent.querySelector('.receipt-print').cloneNode(true);
        const win = window.open('', '_blank', 'width=300,height=600');
        win.document.write('<html><head><title>Struk</title></head><body>');
        win.document.body.appendChild(printContent);
        win.document.write('</body></html>');
        win.document.close();
        setTimeout(() => win.print(), 300);
    });

    let searchTimeout;
    posSearch.addEventListener('input', function () {
        clearTimeout(searchTimeout);
        searchTimeout = setTimeout(() => {
            loadProducts(this.value);
        }, 300);
    });

    loadProducts();
})();
