(function () {
    let currentTab = 'sales';
    let reportChart = null;

    const reportContent = document.getElementById('reportContent');
    const reportStartDate = document.getElementById('reportStartDate');
    const reportEndDate = document.getElementById('reportEndDate');
    const applyReportFilter = document.getElementById('applyReportFilter');
    const exportReport = document.getElementById('exportReport');

    document.querySelectorAll('.report-tab').forEach(tab => {
        tab.addEventListener('click', function () {
            document.querySelectorAll('.report-tab').forEach(t => t.classList.remove('active'));
            this.classList.add('active');
            currentTab = this.dataset.tab;
            loadReport();
        });
    });

    applyReportFilter.addEventListener('click', loadReport);

    exportReport.addEventListener('click', async function () {
        const startDate = reportStartDate.value;
        const endDate = reportEndDate.value;
        let url = `/api/reports/${currentTab}/export?`;
        if (startDate) url += `start_date=${startDate}&`;
        if (endDate) url += `end_date=${endDate}`;
        try {
            const data = await api(url);
            if (data.data && data.data.csv) {
                const blob = new Blob([data.data.csv], { type: 'text/csv;charset=utf-8;' });
                const link = document.createElement('a');
                link.href = URL.createObjectURL(blob);
                link.download = `${currentTab}_report.csv`;
                link.click();
                showToast('Laporan diunduh', 'success');
            }
        } catch (err) {
            showToast(err.message, 'error');
        }
    });

    async function loadReport() {
        const startDate = reportStartDate.value;
        const endDate = reportEndDate.value;
        try {
            let url = `/api/reports/${currentTab}?`;
            if (startDate) url += `start_date=${startDate}&`;
            if (endDate) url += `end_date=${endDate}`;
            const data = await api(url);
            const report = data.data;
            renderReport(report);
        } catch (err) {
            reportContent.innerHTML = `<div class="empty-state"><p>Gagal memuat laporan</p><span>${err.message}</span></div>`;
        }
    }

    function renderReport(report) {
        if (currentTab === 'sales') renderSalesReport(report);
        else if (currentTab === 'profit') renderProfitReport(report);
        else if (currentTab === 'products') renderProductsReport(report);
        else if (currentTab === 'staff') renderStaffReport(report);
    }

    function renderSalesReport(report) {
        let html = `<div class="report-summary">
            <div class="report-summary-card"><div class="summary-label">Total Revenue</div><div class="summary-value">${formatCurrency(report.total_revenue || 0)}</div></div>
            <div class="report-summary-card"><div class="summary-label">Total Transaksi</div><div class="summary-value">${report.total_transactions || 0}</div></div>
            <div class="report-summary-card"><div class="summary-label">Item Terjual</div><div class="summary-value">${report.total_items || 0}</div></div>
            <div class="report-summary-card"><div class="summary-label">Rata-rata Transaksi</div><div class="summary-value">${formatCurrency(report.avg_transaction || 0)}</div></div>
        </div>`;
        if (report.chart_data && report.chart_data.length) {
            html += `<div class="report-chart-container"><canvas id="reportChart"></canvas></div>`;
        }
        reportContent.innerHTML = html;

        if (report.chart_data && report.chart_data.length) {
            setTimeout(() => {
                const ctx = document.getElementById('reportChart').getContext('2d');
                if (reportChart) reportChart.destroy();
                reportChart = new Chart(ctx, {
                    type: 'bar',
                    data: {
                        labels: report.chart_data.map(c => c.label),
                        datasets: [{
                            label: 'Revenue',
                            data: report.chart_data.map(c => c.revenue || c.total || 0),
                            backgroundColor: '#2563eb',
                            borderRadius: 6,
                        }],
                    },
                    options: {
                        responsive: true,
                        maintainAspectRatio: false,
                        plugins: { legend: { display: false } },
                        scales: {
                            y: {
                                ticks: { callback: v => formatCurrency(v) }
                            }
                        }
                    },
                });
            }, 100);
        }
    }

    function renderProfitReport(report) {
        reportContent.innerHTML = `<div class="report-summary">
            <div class="report-summary-card"><div class="summary-label">Revenue</div><div class="summary-value">${formatCurrency(report.revenue || 0)}</div></div>
            <div class="report-summary-card"><div class="summary-label">COGS</div><div class="summary-value">${formatCurrency(report.cogs || 0)}</div></div>
            <div class="report-summary-card"><div class="summary-label">Gross Profit</div><div class="summary-value">${formatCurrency(report.gross_profit || 0)}</div></div>
            <div class="report-summary-card"><div class="summary-label">Expenses</div><div class="summary-value">${formatCurrency(report.expenses || 0)}</div></div>
            <div class="report-summary-card"><div class="summary-label">Net Income</div><div class="summary-value">${formatCurrency(report.net_income || 0)}</div></div>
        </div>`;
    }

    function renderProductsReport(report) {
        const products = report.products || [];
        let html = `<div class="table-container"><table class="data-table">
            <thead><tr><th>Produk</th><th>Terjual</th><th>Revenue</th><th>Profit</th></tr></thead>
            <tbody>`;
        if (!products.length) {
            html += `<tr><td colspan="4"><div class="empty-state"><p>Tidak ada data</p></div></td></tr>`;
        } else {
            products.forEach(p => {
                html += `<tr><td>${p.name}</td><td>${p.total_sold || 0}</td><td>${formatCurrency(p.revenue || 0)}</td><td>${formatCurrency(p.profit || 0)}</td></tr>`;
            });
        }
        html += `</tbody></table></div>`;
        reportContent.innerHTML = html;
    }

    function renderStaffReport(report) {
        const staff = report.staff || [];
        let html = `<div class="table-container"><table class="data-table">
            <thead><tr><th>Staff</th><th>Transaksi</th><th>Total Sales</th><th>Rata-rata</th></tr></thead>
            <tbody>`;
        if (!staff.length) {
            html += `<tr><td colspan="4"><div class="empty-state"><p>Tidak ada data</p></div></td></tr>`;
        } else {
            staff.forEach(s => {
                html += `<tr><td>${s.name}</td><td>${s.transaction_count || 0}</td><td>${formatCurrency(s.total_sales || 0)}</td><td>${formatCurrency(s.avg_transaction || 0)}</td></tr>`;
            });
        }
        html += `</tbody></table></div>`;
        reportContent.innerHTML = html;
    }

    const now = new Date();
    reportStartDate.value = new Date(now.getFullYear(), now.getMonth(), 1).toISOString().split('T')[0];
    reportEndDate.value = now.toISOString().split('T')[0];
    loadReport();
})();
