const express = require('express');
const router = express.Router();
const { authenticate, authorize, requireStore, validateBody } = require('./middleware');
const auth = require('./auth');
const services = require('./services');

router.post('/api/auth/register', validateBody(['name', 'email', 'password', 'store_name']), async (req, res, next) => {
    try {
        const result = await auth.register(req.body);
        auth.setCookie(res, result.token);
        res.status(201).json({ success: true, data: result.user });
    } catch (err) { next(err); }
});

router.post('/api/auth/login', validateBody(['email', 'password']), async (req, res, next) => {
    try {
        const result = await auth.login(req.body);
        auth.setCookie(res, result.token);
        res.json({ success: true, data: result.user });
    } catch (err) { next(err); }
});

router.post('/api/auth/logout', (req, res) => {
    auth.clearCookie(res);
    res.json({ success: true, message: 'Berhasil logout' });
});

router.get('/api/auth/me', authenticate, async (req, res, next) => {
    try {
        const user = await auth.getCurrentUser(req.user.id);
        res.json({ success: true, data: user });
    } catch (err) { next(err); }
});

router.patch('/api/auth/profile', authenticate, async (req, res, next) => {
    try {
        const user = await services.updateProfile(req.user.id, req.body);
        res.json({ success: true, data: user });
    } catch (err) { next(err); }
});

router.get('/api/dashboard', authenticate, requireStore, async (req, res, next) => {
    try {
        const period = req.query.period || 'today';
        const data = await services.getDashboard(req.user.store_id, period);
        res.json({ success: true, data });
    } catch (err) { next(err); }
});

router.get('/api/products', authenticate, requireStore, async (req, res, next) => {
    try {
        const result = await services.getProducts(req.user.store_id, req.query);
        res.json({ success: true, data: result });
    } catch (err) { next(err); }
});

router.get('/api/products/:id', authenticate, requireStore, async (req, res, next) => {
    try {
        const product = await services.getProduct(req.user.store_id, req.params.id);
        res.json({ success: true, data: product });
    } catch (err) { next(err); }
});

router.post('/api/products', authenticate, authorize('owner'), requireStore, validateBody(['name', 'selling_price']), async (req, res, next) => {
    try {
        const product = await services.createProduct(req.user.store_id, req.user.id, req.body);
        res.status(201).json({ success: true, data: product });
    } catch (err) { next(err); }
});

router.patch('/api/products/:id', authenticate, authorize('owner'), requireStore, async (req, res, next) => {
    try {
        const product = await services.updateProduct(req.user.store_id, req.user.id, req.params.id, req.body);
        res.json({ success: true, data: product });
    } catch (err) { next(err); }
});

router.delete('/api/products/:id', authenticate, authorize('owner'), requireStore, async (req, res, next) => {
    try {
        await services.deleteProduct(req.user.store_id, req.params.id);
        res.json({ success: true, message: 'Produk dihapus' });
    } catch (err) { next(err); }
});

router.get('/api/categories', authenticate, requireStore, async (req, res, next) => {
    try {
        const categories = await services.getCategories(req.user.store_id);
        res.json({ success: true, data: { categories } });
    } catch (err) { next(err); }
});

router.post('/api/categories', authenticate, authorize('owner'), requireStore, validateBody(['name']), async (req, res, next) => {
    try {
        const category = await services.createCategory(req.user.store_id, req.user.id, req.body);
        res.status(201).json({ success: true, data: category });
    } catch (err) { next(err); }
});

router.patch('/api/categories/:id', authenticate, authorize('owner'), requireStore, async (req, res, next) => {
    try {
        const category = await services.updateCategory(req.user.store_id, req.params.id, req.body);
        res.json({ success: true, data: category });
    } catch (err) { next(err); }
});

router.delete('/api/categories/:id', authenticate, authorize('owner'), requireStore, async (req, res, next) => {
    try {
        await services.deleteCategory(req.user.store_id, req.params.id);
        res.json({ success: true, message: 'Kategori dihapus' });
    } catch (err) { next(err); }
});

router.post('/api/transactions', authenticate, requireStore, validateBody(['items', 'payment_method']), async (req, res, next) => {
    try {
        const transaction = await services.createTransaction(req.user.store_id, req.user.id, req.body);
        res.status(201).json({ success: true, data: transaction });
    } catch (err) { next(err); }
});

router.get('/api/transactions', authenticate, requireStore, async (req, res, next) => {
    try {
        const result = await services.getTransactions(req.user.store_id, req.query);
        res.json({ success: true, data: result });
    } catch (err) { next(err); }
});

router.get('/api/transactions/:id', authenticate, requireStore, async (req, res, next) => {
    try {
        const transaction = await services.getTransaction(req.user.store_id, req.params.id);
        res.json({ success: true, data: transaction });
    } catch (err) { next(err); }
});

router.post('/api/transactions/:id/cancel', authenticate, authorize('owner'), requireStore, async (req, res, next) => {
    try {
        const result = await services.cancelTransaction(req.user.store_id, req.user.id, req.params.id);
        res.json({ success: true, data: result });
    } catch (err) { next(err); }
});

router.get('/api/inventory', authenticate, requireStore, async (req, res, next) => {
    try {
        const result = await services.getInventory(req.user.store_id, req.query);
        res.json({ success: true, data: result });
    } catch (err) { next(err); }
});

router.post('/api/inventory/restock', authenticate, authorize('owner'), requireStore, validateBody(['product_id', 'quantity']), async (req, res, next) => {
    try {
        const result = await services.restockProduct(req.user.store_id, req.user.id, req.body);
        res.json({ success: true, data: result });
    } catch (err) { next(err); }
});

router.post('/api/inventory/adjust', authenticate, authorize('owner'), requireStore, validateBody(['product_id', 'actual_stock', 'reason']), async (req, res, next) => {
    try {
        const result = await services.adjustStock(req.user.store_id, req.user.id, req.body);
        res.json({ success: true, data: result });
    } catch (err) { next(err); }
});

router.get('/api/expenses', authenticate, requireStore, async (req, res, next) => {
    try {
        const result = await services.getExpenses(req.user.store_id, req.query);
        res.json({ success: true, data: result });
    } catch (err) { next(err); }
});

router.get('/api/expenses/:id', authenticate, requireStore, async (req, res, next) => {
    try {
        const expense = await services.getExpense(req.user.store_id, req.params.id);
        res.json({ success: true, data: expense });
    } catch (err) { next(err); }
});

router.post('/api/expenses', authenticate, authorize('owner'), requireStore, validateBody(['category', 'amount', 'expense_date']), async (req, res, next) => {
    try {
        const expense = await services.createExpense(req.user.store_id, req.user.id, req.body);
        res.status(201).json({ success: true, data: expense });
    } catch (err) { next(err); }
});

router.patch('/api/expenses/:id', authenticate, authorize('owner'), requireStore, async (req, res, next) => {
    try {
        const expense = await services.updateExpense(req.user.store_id, req.params.id, req.body);
        res.json({ success: true, data: expense });
    } catch (err) { next(err); }
});

router.delete('/api/expenses/:id', authenticate, authorize('owner'), requireStore, async (req, res, next) => {
    try {
        await services.deleteExpense(req.user.store_id, req.params.id);
        res.json({ success: true, message: 'Pengeluaran dihapus' });
    } catch (err) { next(err); }
});

router.get('/api/employees', authenticate, authorize('owner'), requireStore, async (req, res, next) => {
    try {
        const employees = await services.getEmployees(req.user.store_id);
        res.json({ success: true, data: { employees } });
    } catch (err) { next(err); }
});

router.get('/api/employees/:id', authenticate, authorize('owner'), requireStore, async (req, res, next) => {
    try {
        const employee = await services.getEmployee(req.user.store_id, req.params.id);
        res.json({ success: true, data: employee });
    } catch (err) { next(err); }
});

router.post('/api/employees', authenticate, authorize('owner'), requireStore, validateBody(['name', 'email', 'password']), async (req, res, next) => {
    try {
        const employee = await services.createEmployee(req.user.store_id, req.user.id, req.body);
        res.status(201).json({ success: true, data: employee });
    } catch (err) { next(err); }
});

router.patch('/api/employees/:id', authenticate, authorize('owner'), requireStore, async (req, res, next) => {
    try {
        const employee = await services.updateEmployee(req.user.store_id, req.params.id, req.body);
        res.json({ success: true, data: employee });
    } catch (err) { next(err); }
});

router.post('/api/employees/:id/reset-password', authenticate, authorize('owner'), requireStore, async (req, res, next) => {
    try {
        await services.resetEmployeePassword(req.user.store_id, req.params.id);
        res.json({ success: true, message: 'Password direset' });
    } catch (err) { next(err); }
});

router.get('/api/reports/:type', authenticate, authorize('owner'), requireStore, async (req, res, next) => {
    try {
        const report = await services.getReport(req.user.store_id, req.params.type, req.query);
        res.json({ success: true, data: report });
    } catch (err) { next(err); }
});

router.get('/api/reports/:type/export', authenticate, authorize('owner'), requireStore, async (req, res, next) => {
    try {
        const csv = await services.exportReport(req.user.store_id, req.params.type, req.query);
        res.setHeader('Content-Type', 'text/csv; charset=utf-8');
        res.setHeader('Content-Disposition', `attachment; filename="${req.params.type}_report.csv"`);
        res.send(csv);
    } catch (err) { next(err); }
});

router.get('/api/activity', authenticate, requireStore, async (req, res, next) => {
    try {
        const result = await services.getActivities(req.user.store_id, req.query);
        res.json({ success: true, data: result });
    } catch (err) { next(err); }
});

router.patch('/api/settings/payment-methods', authenticate, authorize('owner'), requireStore, async (req, res, next) => {
    try {
        await services.updatePaymentMethods(req.user.store_id, req.body.payment_methods);
        res.json({ success: true, message: 'Metode pembayaran diperbarui' });
    } catch (err) { next(err); }
});

router.patch('/api/settings/store', authenticate, authorize('owner'), requireStore, async (req, res, next) => {
    try {
        await services.updateStoreSettings(req.user.store_id, req.body);
        res.json({ success: true, message: 'Pengaturan toko diperbarui' });
    } catch (err) { next(err); }
});

module.exports = router;
