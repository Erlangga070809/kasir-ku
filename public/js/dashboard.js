(function () {
    let salesChart = null;
    let currentPeriod = 'today';

    async function loadDashboard(period) {
        try {
            const data = await api(`/api/dashboard?period=${period}`);
            const d = data.data;
            renderStats(d);
            renderChart(d.sales_chart || []);
            renderTopProducts(d.top_products || []);
            renderLowStock(d.low_stock || []);
            updateGreeting(d);
        } catch (err) {
            showToast(err.message, 'error');
        }
    }

    function renderStats(d) {
        const statsGrid = document.getElementById('statsGrid');
        const stats = [
            { label: 'Penjualan Hari Ini', value: formatCurrency(d.today_sales || 0), change: '' },
            { label: 'Transaksi', value: (d.transaction_count || 0).toString(), change: '' },
            { label: 'Item Terjual', value: (d.items_sold || 0).toString(), change: '' },
            { label: 'Estimasi Keuntungan', value: formatCurrency(d.estimated_profit || 0), change: '' },
            { label: 'Pengeluaran', value: formatCurrency(d.expenses || 0), change: '' },
            { label: 'Pendapatan Bersih', value: formatCurrency(d.net_income || 0), change: '' },
        ];
        statsGrid.innerHTML = stats.map(s => `
            <div class="stat-card">
                <div class="stat-label">${s.label}</div>
                <div class="stat-value">${s.value}</div>
                ${s.change ? `<div class="stat-change">${s.change}</div>` : ''}
            </div>
        `).join('');
    }

    function renderChart(chartData) {
        const ctx = document.getElementById('salesChart').getContext('2d');
        if (salesChart) salesChart.destroy();
        const labels = chartData.map(c => c.label || c.date || '');
        const values = chartData.map(c => c.total || c.value || 0);
        salesChart = new Chart(ctx, {
            type: 'line',
            data: {
                labels,
                datasets: [{
                    label: 'Penjualan',
                    data: values,
                    borderColor: '#2563eb',
                    backgroundColor: 'rgba(37,99,235,0.08)',
                    fill: true,
                    tension: 0.4,
                    pointRadius: 3,
                    pointHoverRadius: 6,
                    borderWidth: 2,
                }],
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                plugins: { legend: { display: false } },
                scales: {
                    x: { grid: { display: false }, ticks: { font: { size: 11 } } },
                    y: { 
                        grid: { color: 'rgba(0,0,0,0.05)' },
                        ticks: { 
                            font: { size: 11 },
                            callback: function(v) { return 'Rp' + v.toLocaleString('id-ID'); }
                        }
                    },
                },
            },
        });
    }

    function renderTopProducts(products) {
        const container = document.getElementById('topProducts');
        if (!products.length) {
            container.innerHTML = '<div class="empty-state"><p>Tidak ada data produk</p></div>';
            return;
        }
        container.innerHTML = products.map((p, i) => `
            <div class="top-product-item">
                <div class="top-product-name">${i + 1}. ${p.name}</div>
                <div class="top-product-qty">${p.total_sold || 0} terjual</div>
            </div>
        `).join('');
    }

    function renderLowStock(products) {
        const container = document.getElementById('lowStock');
        if (!products.length) {
            container.innerHTML = '<div style="padding:12px;color:var(--text-secondary);font-size:0.875rem;">Semua stok aman</div>';
            return;
        }
        container.innerHTML = products.map(p => `
            <div class="low-stock-item">
                <span>${p.name}</span>
                <span class="stock-count">Stok: ${p.stock}</span>
            </div>
        `).join('');
    }

    function updateGreeting(d) {
        const greetingEl = document.getElementById('dashboardGreeting');
        const metaEl = document.getElementById('dashboardMeta');
        if (d.store_name && greetingEl) {
            const hour = new Date().getHours();
            let greeting = 'Selamat pagi';
            if (hour >= 12 && hour < 15) greeting = 'Selamat siang';
            else if (hour >= 15 && hour < 18) greeting = 'Selamat sore';
            else if (hour >= 18) greeting = 'Selamat malam';
            greetingEl.textContent = `${greeting}, ${d.store_name}`;
        }
        if (metaEl) {
            const now = new Date();
            const days = ['Minggu', 'Senin', 'Selasa', 'Rabu', 'Kamis', 'Jumat', 'Sabtu'];
            const months = ['Januari', 'Februari', 'Maret', 'April', 'Mei', 'Juni', 'Juli', 'Agustus', 'September', 'Oktober', 'November', 'Desember'];
            metaEl.textContent = `${days[now.getDay()]}, ${now.getDate()} ${months[now.getMonth()]}`;
        }
    }

    document.querySelectorAll('.period-btn').forEach(btn => {
        btn.addEventListener('click', function () {
            document.querySelectorAll('.period-btn').forEach(b => b.classList.remove('active'));
            this.classList.add('active');
            currentPeriod = this.dataset.period;
            loadDashboard(currentPeriod);
        });
    });

    loadDashboard(currentPeriod);
})();
