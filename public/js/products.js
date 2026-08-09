(function () {
    const currentPage = window.location.pathname;

    if (currentPage.includes('products.html')) {
        initProductsPage();
    } else if (currentPage.includes('inventory.html')) {
        initInventoryPage();
    } else if (currentPage.includes('employees.html')) {
        initEmployeesPage();
    } else if (currentPage.includes('expenses.html')) {
        initExpensesPage();
    }

    function initProductsPage() {
        let page = 1;
        const searchProduct = document.getElementById('searchProduct');
        const filterCategory = document.getElementById('filterCategory');
        const productsBody = document.getElementById('productsBody');
        const productsPagination = document.getElementById('productsPagination');
        const addProductBtn = document.getElementById('addProductBtn');
        const productModal = document.getElementById('productModal');
        const productModalTitle = document.getElementById('productModalTitle');
        const saveProduct = document.getElementById('saveProduct');
        const productForm = document.getElementById('productForm');
        const productId = document.getElementById('productId');
        const productCategory = document.getElementById('productCategory');

        async function loadCategories() {
            try {
                const data = await api('/api/categories');
                const cats = data.data.categories || [];
                const options = cats.map(c => `<option value="${c.id}">${c.name}</option>`).join('');
                filterCategory.innerHTML = '<option value="">Semua Kategori</option>' + options;
                productCategory.innerHTML = '<option value="">Pilih Kategori</option>' + options;
            } catch (err) {}
        }

        async function loadProducts() {
            try {
                const search = searchProduct.value;
                const category = filterCategory.value;
                const data = await api(`/api/products?search=${encodeURIComponent(search)}&category_id=${category}&page=${page}&limit=20`);
                const products = data.data.products || [];
                const total = data.data.total || 0;
                renderTable(products);
                renderPagination(total);
            } catch (err) {
                showToast(err.message, 'error');
            }
        }

        function renderTable(products) {
            if (!products.length) {
                productsBody.innerHTML = `<tr><td colspan="7"><div class="empty-state"><p>Belum ada produk</p><span>Tambah produk pertama Anda</span></div></td></tr>`;
                return;
            }
            productsBody.innerHTML = products.map(p => `
                <tr>
                    <td><strong>${p.name}</strong></td>
                    <td class="text-mono">${p.sku}</td>
                    <td>${p.category_name || '-'}</td>
                    <td>${formatCurrency(p.selling_price)}</td>
                    <td>${p.stock} ${p.unit || 'pcs'}</td>
                    <td><span class="badge ${p.is_active ? 'badge-success' : 'badge-danger'}">${p.is_active ? 'Aktif' : 'Nonaktif'}</span></td>
                    <td>
                        <button class="btn-icon edit-product" data-id="${p.id}" aria-label="Edit produk">
                            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/></svg>
                        </button>
                        <button class="btn-icon delete-product" data-id="${p.id}" aria-label="Hapus produk">
                            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="3 6 5 6 21 6"/><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/></svg>
                        </button>
                    </td>
                </tr>
            `).join('');

            productsBody.querySelectorAll('.edit-product').forEach(btn => {
                btn.addEventListener('click', async function () {
                    const id = this.dataset.id;
                    try {
                        const data = await api(`/api/products/${id}`);
                        const p = data.data;
                        productId.value = p.id;
                        document.getElementById('productName').value = p.name;
                        document.getElementById('productSku').value = p.sku;
                        document.getElementById('productCategory').value = p.category_id || '';
                        document.getElementById('productUnit').value = p.unit;
                        document.getElementById('productCost').value = p.cost_price;
                        document.getElementById('productPrice').value = p.selling_price;
                        document.getElementById('productStock').value = p.stock;
                        document.getElementById('productThreshold').value = p.low_stock_threshold;
                        document.getElementById('productStatus').checked = p.is_active;
                        productModalTitle.textContent = 'Edit Produk';
                        openModal('productModal');
                    } catch (err) {
                        showToast(err.message, 'error');
                    }
                });
            });

            productsBody.querySelectorAll('.delete-product').forEach(btn => {
                btn.addEventListener('click', async function () {
                    if (!confirm('Hapus produk ini?')) return;
                    try {
                        await api(`/api/products/${this.dataset.id}`, { method: 'DELETE' });
                        showToast('Produk dihapus', 'success');
                        loadProducts();
                    } catch (err) {
                        showToast(err.message, 'error');
                    }
                });
            });
        }

        function renderPagination(total) {
            const totalPages = Math.ceil(total / 20);
            if (totalPages <= 1) {
                productsPagination.innerHTML = '';
                return;
            }
            let html = `<button ${page === 1 ? 'disabled' : ''} data-page="${page - 1}">←</button>`;
            for (let i = 1; i <= totalPages; i++) {
                html += `<button class="${i === page ? 'active' : ''}" data-page="${i}">${i}</button>`;
            }
            html += `<button ${page === totalPages ? 'disabled' : ''} data-page="${page + 1}">→</button>`;
            productsPagination.innerHTML = html;
            productsPagination.querySelectorAll('button').forEach(btn => {
                btn.addEventListener('click', function () {
                    const p = parseInt(this.dataset.page);
                    if (p >= 1 && p <= totalPages) {
                        page = p;
                        loadProducts();
                    }
                });
            });
        }

        addProductBtn.addEventListener('click', function () {
            productForm.reset();
            productId.value = '';
            productModalTitle.textContent = 'Tambah Produk';
            document.getElementById('productStatus').checked = true;
            openModal('productModal');
        });

        saveProduct.addEventListener('click', async function () {
            const body = {
                name: document.getElementById('productName').value.trim(),
                sku: document.getElementById('productSku').value.trim(),
                category_id: document.getElementById('productCategory').value || null,
                unit: document.getElementById('productUnit').value.trim(),
                cost_price: parseFloat(document.getElementById('productCost').value) || 0,
                selling_price: parseFloat(document.getElementById('productPrice').value) || 0,
                stock: parseInt(document.getElementById('productStock').value) || 0,
                low_stock_threshold: parseInt(document.getElementById('productThreshold').value) || 10,
                is_active: document.getElementById('productStatus').checked,
            };
            const id = productId.value;
            try {
                if (id) {
                    await api(`/api/products/${id}`, { method: 'PATCH', body });
                    showToast('Produk diperbarui', 'success');
                } else {
                    await api('/api/products', { method: 'POST', body });
                    showToast('Produk ditambahkan', 'success');
                }
                closeModal('productModal');
                loadProducts();
            } catch (err) {
                showToast(err.message, 'error');
            }
        });

        searchProduct.addEventListener('input', debounce(loadProducts, 300));
        filterCategory.addEventListener('change', loadProducts);
        loadCategories();
        loadProducts();
    }

    function initInventoryPage() {
        let page = 1;
        const inventoryBody = document.getElementById('inventoryBody');
        const inventoryPagination = document.getElementById('inventoryPagination');
        const restockBtn = document.getElementById('restockBtn');
        const adjustBtn = document.getElementById('adjustBtn');
        const restockProduct = document.getElementById('restockProduct');
        const adjustProduct = document.getElementById('adjustProduct');

        async function loadInventory() {
            try {
                const data = await api(`/api/inventory?page=${page}&limit=20`);
                const movements = data.data.movements || [];
                const total = data.data.total || 0;
                renderInventory(movements);
                renderInventoryPagination(total);
            } catch (err) {
                showToast(err.message, 'error');
            }
        }

        function renderInventory(movements) {
            if (!movements.length) {
                inventoryBody.innerHTML = `<tr><td colspan="7"><div class="empty-state"><p>Belum ada pergerakan stok</p></div></td></tr>`;
                return;
            }
            inventoryBody.innerHTML = movements.map(m => `
                <tr>
                    <td>${formatDateTime(m.created_at)}</td>
                    <td>${m.product_name}</td>
                    <td><span class="badge badge-${m.movement_type === 'sale' ? 'info' : m.movement_type === 'restock' ? 'success' : 'warning'}">${m.movement_type.toUpperCase()}</span></td>
                    <td>${m.quantity > 0 ? '+' : ''}${m.quantity}</td>
                    <td>${m.stock_after}</td>
                    <td>${m.reference || '-'}</td>
                    <td>${m.note || '-'}</td>
                </tr>
            `).join('');
        }

        function renderInventoryPagination(total) {
            const totalPages = Math.ceil(total / 20);
            if (totalPages <= 1) { inventoryPagination.innerHTML = ''; return; }
            let html = `<button ${page === 1 ? 'disabled' : ''} data-page="${page - 1}">←</button>`;
            for (let i = 1; i <= totalPages; i++) {
                html += `<button class="${i === page ? 'active' : ''}" data-page="${i}">${i}</button>`;
            }
            html += `<button ${page === totalPages ? 'disabled' : ''} data-page="${page + 1}">→</button>`;
            inventoryPagination.innerHTML = html;
            inventoryPagination.querySelectorAll('button').forEach(btn => {
                btn.addEventListener('click', function () {
                    const p = parseInt(this.dataset.page);
                    if (p >= 1 && p <= totalPages) { page = p; loadInventory(); }
                });
            });
        }

        async function loadProductOptions() {
            try {
                const data = await api('/api/products?status=active&limit=200');
                const products = data.data.products || [];
                const options = products.map(p => `<option value="${p.id}">${p.name} (Stok: ${p.stock})</option>`).join('');
                restockProduct.innerHTML = '<option value="">Pilih Produk</option>' + options;
                adjustProduct.innerHTML = '<option value="">Pilih Produk</option>' + options;
            } catch (err) {}
        }

        restockBtn.addEventListener('click', function () {
            loadProductOptions();
            document.getElementById('restockForm').reset();
            openModal('restockModal');
        });

        adjustBtn.addEventListener('click', function () {
            loadProductOptions();
            document.getElementById('adjustForm').reset();
            document.getElementById('adjustCurrentStock').textContent = '-';
            document.getElementById('adjustDifference').textContent = '-';
            openModal('adjustModal');
        });

        adjustProduct.addEventListener('change', async function () {
            const id = this.value;
            if (!id) return;
            try {
                const data = await api(`/api/products/${id}`);
                document.getElementById('adjustCurrentStock').textContent = data.data.stock;
                updateAdjustDifference();
            } catch (err) {}
        });

        document.getElementById('adjustActual').addEventListener('input', updateAdjustDifference);

        function updateAdjustDifference() {
            const current = parseInt(document.getElementById('adjustCurrentStock').textContent) || 0;
            const actual = parseInt(document.getElementById('adjustActual').value) || 0;
            const diff = actual - current;
            document.getElementById('adjustDifference').textContent = (diff >= 0 ? '+' : '') + diff;
        }

        document.getElementById('saveRestock').addEventListener('click', async function () {
            const body = {
                product_id: restockProduct.value,
                quantity: parseInt(document.getElementById('restockQuantity').value),
                cost: parseFloat(document.getElementById('restockCost').value) || 0,
                supplier: document.getElementById('restockSupplier').value.trim(),
                note: document.getElementById('restockNote').value.trim(),
            };
            if (!body.product_id || !body.quantity) { showToast('Isi data dengan lengkap', 'warning'); return; }
            try {
                await api('/api/inventory/restock', { method: 'POST', body });
                showToast('Restock berhasil', 'success');
                closeModal('restockModal');
                loadInventory();
            } catch (err) {
                showToast(err.message, 'error');
            }
        });

        document.getElementById('saveAdjust').addEventListener('click', async function () {
            const body = {
                product_id: adjustProduct.value,
                actual_stock: parseInt(document.getElementById('adjustActual').value),
                reason: document.getElementById('adjustReason').value,
            };
            if (!body.product_id || isNaN(body.actual_stock) || !body.reason) { showToast('Isi data dengan lengkap', 'warning'); return; }
            try {
                await api('/api/inventory/adjust', { method: 'POST', body });
                showToast('Adjustment berhasil', 'success');
                closeModal('adjustModal');
                loadInventory();
            } catch (err) {
                showToast(err.message, 'error');
            }
        });

        loadInventory();
    }

    function initEmployeesPage() {
        const employeesBody = document.getElementById('employeesBody');
        const addEmployeeBtn = document.getElementById('addEmployeeBtn');
        const employeeModal = document.getElementById('employeeModal');
        const employeeModalTitle = document.getElementById('employeeModalTitle');
        const employeeForm = document.getElementById('employeeForm');
        const employeeId = document.getElementById('employeeId');
        const employeePasswordGroup = document.getElementById('employeePasswordGroup');
        const employeeResetGroup = document.getElementById('employeeResetGroup');
        const saveEmployee = document.getElementById('saveEmployee');
        const resetPasswordBtn = document.getElementById('resetPasswordBtn');

        async function loadEmployees() {
            try {
                const data = await api('/api/employees');
                const employees = data.data.employees || [];
                renderEmployees(employees);
            } catch (err) {
                showToast(err.message, 'error');
            }
        }

        function renderEmployees(employees) {
            if (!employees.length) {
                employeesBody.innerHTML = `<tr><td colspan="6"><div class="empty-state"><p>Belum ada staff</p><span>Tambah staff untuk membantu operasional</span></div></td></tr>`;
                return;
            }
            employeesBody.innerHTML = employees.map(e => `
                <tr>
                    <td><strong>${e.name}</strong></td>
                    <td>${e.email}</td>
                    <td><span class="badge ${e.role === 'owner' ? 'badge-info' : 'badge-success'}">${e.role.toUpperCase()}</span></td>
                    <td><span class="badge ${e.is_active ? 'badge-success' : 'badge-danger'}">${e.is_active ? 'Aktif' : 'Nonaktif'}</span></td>
                    <td>${formatDate(e.created_at)}</td>
                    <td>
                        ${e.role !== 'owner' ? `
                            <button class="btn-icon edit-employee" data-id="${e.id}" aria-label="Edit staff">
                                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/></svg>
                            </button>
                            <button class="btn-icon toggle-employee" data-id="${e.id}" data-active="${e.is_active}" aria-label="${e.is_active ? 'Nonaktifkan' : 'Aktifkan'} staff">
                                ${e.is_active ? '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M18.36 6.64a9 9 0 1 1-12.73 0"/><line x1="12" y1="2" x2="12" y2="12"/></svg>' : '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="20 6 9 17 4 12"/></svg>'}
                            </button>
                        ` : ''}
                    </td>
                </tr>
            `).join('');

            employeesBody.querySelectorAll('.edit-employee').forEach(btn => {
                btn.addEventListener('click', async function () {
                    const id = this.dataset.id;
                    try {
                        const data = await api(`/api/employees/${id}`);
                        const e = data.data;
                        employeeId.value = e.id;
                        document.getElementById('employeeName').value = e.name;
                        document.getElementById('employeeEmail').value = e.email;
                        document.getElementById('employeePassword').value = '';
                        employeePasswordGroup.style.display = 'none';
                        employeeResetGroup.style.display = 'flex';
                        employeeModalTitle.textContent = 'Edit Staff';
                        openModal('employeeModal');
                    } catch (err) {
                        showToast(err.message, 'error');
                    }
                });
            });

            employeesBody.querySelectorAll('.toggle-employee').forEach(btn => {
                btn.addEventListener('click', async function () {
                    try {
                        await api(`/api/employees/${this.dataset.id}`, {
                            method: 'PATCH',
                            body: { is_active: this.dataset.active === 'true' ? false : true },
                        });
                        showToast('Status staff diubah', 'success');
                        loadEmployees();
                    } catch (err) {
                        showToast(err.message, 'error');
                    }
                });
            });
        }

        addEmployeeBtn.addEventListener('click', function () {
            employeeForm.reset();
            employeeId.value = '';
            employeePasswordGroup.style.display = 'block';
            employeeResetGroup.style.display = 'none';
            employeeModalTitle.textContent = 'Tambah Staff';
            openModal('employeeModal');
        });

        saveEmployee.addEventListener('click', async function () {
            const id = employeeId.value;
            const body = {
                name: document.getElementById('employeeName').value.trim(),
                email: document.getElementById('employeeEmail').value.trim(),
            };
            const password = document.getElementById('employeePassword').value;
            if (!id && !password) { showToast('Password wajib diisi', 'warning'); return; }
            if (password) body.password = password;
            try {
                if (id) {
                    await api(`/api/employees/${id}`, { method: 'PATCH', body });
                    showToast('Staff diperbarui', 'success');
                } else {
                    await api('/api/employees', { method: 'POST', body });
                    showToast('Staff ditambahkan', 'success');
                }
                closeModal('employeeModal');
                loadEmployees();
            } catch (err) {
                showToast(err.message, 'error');
            }
        });

        resetPasswordBtn.addEventListener('click', async function () {
            if (!confirm('Reset password staff ini?')) return;
            try {
                await api(`/api/employees/${employeeId.value}/reset-password`, { method: 'POST' });
                showToast('Password direset', 'success');
            } catch (err) {
                showToast(err.message, 'error');
            }
        });

        loadEmployees();
    }

    function initExpensesPage() {
        let page = 1;
        const expensesBody = document.getElementById('expensesBody');
        const expensesPagination = document.getElementById('expensesPagination');
        const addExpenseBtn = document.getElementById('addExpenseBtn');
        const expenseModal = document.getElementById('expenseModal');
        const expenseModalTitle = document.getElementById('expenseModalTitle');
        const expenseForm = document.getElementById('expenseForm');
        const expenseId = document.getElementById('expenseId');
        const saveExpense = document.getElementById('saveExpense');

        async function loadExpenses() {
            try {
                const startDate = document.getElementById('expenseStartDate').value;
                const endDate = document.getElementById('expenseEndDate').value;
                let url = `/api/expenses?page=${page}&limit=20`;
                if (startDate) url += `&start_date=${startDate}`;
                if (endDate) url += `&end_date=${endDate}`;
                const data = await api(url);
                const expenses = data.data.expenses || [];
                const total = data.data.total || 0;
                renderExpenses(expenses);
                renderExpensesPagination(total);
            } catch (err) {
                showToast(err.message, 'error');
            }
        }

        function renderExpenses(expenses) {
            if (!expenses.length) {
                expensesBody.innerHTML = `<tr><td colspan="5"><div class="empty-state"><p>Belum ada pengeluaran</p><span>Catat pengeluaran toko Anda</span></div></td></tr>`;
                return;
            }
            expensesBody.innerHTML = expenses.map(e => `
                <tr>
                    <td>${formatDate(e.expense_date)}</td>
                    <td><span class="badge badge-info">${e.category}</span></td>
                    <td>${e.description}</td>
                    <td>${formatCurrency(e.amount)}</td>
                    <td>
                        <button class="btn-icon edit-expense" data-id="${e.id}" aria-label="Edit pengeluaran">
                            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/></svg>
                        </button>
                        <button class="btn-icon delete-expense" data-id="${e.id}" aria-label="Hapus pengeluaran">
                            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="3 6 5 6 21 6"/><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/></svg>
                        </button>
                    </td>
                </tr>
            `).join('');

            expensesBody.querySelectorAll('.edit-expense').forEach(btn => {
                btn.addEventListener('click', async function () {
                    const id = this.dataset.id;
                    try {
                        const data = await api(`/api/expenses/${id}`);
                        const e = data.data;
                        expenseId.value = e.id;
                        document.getElementById('expenseCategory').value = e.category;
                        document.getElementById('expenseAmount').value = e.amount;
                        document.getElementById('expenseDescription').value = e.description;
                        document.getElementById('expenseDate').value = e.expense_date.split('T')[0];
                        expenseModalTitle.textContent = 'Edit Pengeluaran';
                        openModal('expenseModal');
                    } catch (err) {
                        showToast(err.message, 'error');
                    }
                });
            });

            expensesBody.querySelectorAll('.delete-expense').forEach(btn => {
                btn.addEventListener('click', async function () {
                    if (!confirm('Hapus pengeluaran ini?')) return;
                    try {
                        await api(`/api/expenses/${this.dataset.id}`, { method: 'DELETE' });
                        showToast('Pengeluaran dihapus', 'success');
                        loadExpenses();
                    } catch (err) {
                        showToast(err.message, 'error');
                    }
                });
            });
        }

        function renderExpensesPagination(total) {
            const totalPages = Math.ceil(total / 20);
            if (totalPages <= 1) { expensesPagination.innerHTML = ''; return; }
            let html = `<button ${page === 1 ? 'disabled' : ''} data-page="${page - 1}">←</button>`;
            for (let i = 1; i <= totalPages; i++) {
                html += `<button class="${i === page ? 'active' : ''}" data-page="${i}">${i}</button>`;
            }
            html += `<button ${page === totalPages ? 'disabled' : ''} data-page="${page + 1}">→</button>`;
            expensesPagination.innerHTML = html;
            expensesPagination.querySelectorAll('button').forEach(btn => {
                btn.addEventListener('click', function () {
                    const p = parseInt(this.dataset.page);
                    if (p >= 1 && p <= totalPages) { page = p; loadExpenses(); }
                });
            });
        }

        addExpenseBtn.addEventListener('click', function () {
            expenseForm.reset();
            expenseId.value = '';
            document.getElementById('expenseDate').value = new Date().toISOString().split('T')[0];
            expenseModalTitle.textContent = 'Tambah Pengeluaran';
            openModal('expenseModal');
        });

        saveExpense.addEventListener('click', async function () {
            const body = {
                category: document.getElementById('expenseCategory').value,
                amount: parseFloat(document.getElementById('expenseAmount').value),
                description: document.getElementById('expenseDescription').value.trim(),
                expense_date: document.getElementById('expenseDate').value,
            };
            const id = expenseId.value;
            try {
                if (id) {
                    await api(`/api/expenses/${id}`, { method: 'PATCH', body });
                    showToast('Pengeluaran diperbarui', 'success');
                } else {
                    await api('/api/expenses', { method: 'POST', body });
                    showToast('Pengeluaran ditambahkan', 'success');
                }
                closeModal('expenseModal');
                loadExpenses();
            } catch (err) {
                showToast(err.message, 'error');
            }
        });

        document.getElementById('applyExpenseFilter').addEventListener('click', function () {
            page = 1;
            loadExpenses();
        });

        loadExpenses();
    }

    function debounce(fn, delay) {
        let timer;
        return function (...args) {
            clearTimeout(timer);
            timer = setTimeout(() => fn.apply(this, args), delay);
        };
    }
})();