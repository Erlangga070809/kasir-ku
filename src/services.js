const { v4: uuidv4 } = require('uuid');
const bcrypt = require('bcrypt');
const db = require('./db');
const utils = require('./utils');

async function getDashboard(storeId, period) {
    const dateRange = utils.getDateRange(period);
    const startDate = dateRange.start;
    const endDate = dateRange.end;

    const todayRange = utils.getDateRange('today');

    const todaySalesResult = await db.query(
        `SELECT COALESCE(SUM(total), 0) as total FROM transactions
         WHERE store_id = $1 AND status = 'completed' AND created_at >= $2 AND created_at <= $3`,
        [storeId, todayRange.start, todayRange.end]
    );

    const transactionCountResult = await db.query(
        `SELECT COUNT(*) as count FROM transactions
         WHERE store_id = $1 AND status = 'completed' AND created_at >= $2 AND created_at <= $3`,
        [storeId, todayRange.start, todayRange.end]
    );

    const itemsSoldResult = await db.query(
        `SELECT COALESCE(SUM(ti.quantity), 0) as total FROM transaction_items ti
         JOIN transactions t ON ti.transaction_id = t.id
         WHERE t.store_id = $1 AND t.status = 'completed' AND t.created_at >= $2 AND t.created_at <= $3`,
        [storeId, todayRange.start, todayRange.end]
    );

    const profitResult = await db.query(
        `SELECT COALESCE(SUM((ti.price - COALESCE(p.cost_price, 0)) * ti.quantity), 0) as total
         FROM transaction_items ti
         JOIN transactions t ON ti.transaction_id = t.id
         JOIN products p ON ti.product_id = p.id
         WHERE t.store_id = $1 AND t.status = 'completed' AND t.created_at >= $2 AND t.created_at <= $3`,
        [storeId, todayRange.start, todayRange.end]
    );

    const expensesResult = await db.query(
        `SELECT COALESCE(SUM(amount), 0) as total FROM expenses
         WHERE store_id = $1 AND expense_date >= $2 AND expense_date <= $3`,
        [storeId, todayRange.start, todayRange.end]
    );

    const todaySales = parseFloat(todaySalesResult.rows[0].total);
    const estimatedProfit = parseFloat(profitResult.rows[0].total);
    const expenses = parseFloat(expensesResult.rows[0].total);
    const netIncome = estimatedProfit - expenses;

    const salesChart = await getSalesChart(storeId, period, startDate, endDate);

    const topProducts = await db.query(
        `SELECT p.name, SUM(ti.quantity) as total_sold
         FROM transaction_items ti
         JOIN transactions t ON ti.transaction_id = t.id
         JOIN products p ON ti.product_id = p.id
         WHERE t.store_id = $1 AND t.status = 'completed' AND t.created_at >= $2 AND t.created_at <= $3
         GROUP BY p.id, p.name ORDER BY total_sold DESC LIMIT 5`,
        [storeId, startDate, endDate]
    );

    const lowStock = await db.query(
        `SELECT name, stock FROM products WHERE store_id = $1 AND is_active = true AND stock <= low_stock_threshold ORDER BY stock ASC LIMIT 10`,
        [storeId]
    );

    const storeResult = await db.query('SELECT name FROM stores WHERE id = $1', [storeId]);

    return {
        store_name: storeResult.rows[0]?.name || '',
        today_sales: todaySales,
        transaction_count: parseInt(transactionCountResult.rows[0].count),
        items_sold: parseInt(itemsSoldResult.rows[0].total),
        estimated_profit: estimatedProfit,
        expenses: expenses,
        net_income: netIncome,
        sales_chart: salesChart,
        top_products: topProducts.rows,
        low_stock: lowStock.rows,
    };
}

async function getSalesChart(storeId, period, startDate, endDate) {
    let groupBy;
    if (period === 'today') {
        groupBy = "DATE_TRUNC('hour', created_at)";
    } else if (period === '7days' || period === '30days') {
        groupBy = "DATE_TRUNC('day', created_at)";
    } else {
        groupBy = "DATE_TRUNC('day', created_at)";
    }

    const result = await db.query(
        `SELECT ${groupBy} as date_label, COALESCE(SUM(total), 0) as total
         FROM transactions
         WHERE store_id = $1 AND status = 'completed' AND created_at >= $2 AND created_at <= $3
         GROUP BY date_label ORDER BY date_label`,
        [storeId, startDate, endDate]
    );

    return result.rows.map(r => ({
        label: utils.formatChartLabel(r.date_label, period),
        total: parseFloat(r.total),
    }));
}

async function getProducts(storeId, query) {
    const { search, category_id, status, page = 1, limit = 20 } = query;
    const offset = (parseInt(page) - 1) * parseInt(limit);
    let whereClause = 'WHERE p.store_id = $1';
    const params = [storeId];
    let paramIndex = 2;

    if (search) {
        whereClause += ` AND (p.name ILIKE $${paramIndex} OR p.sku ILIKE $${paramIndex})`;
        params.push(`%${search}%`);
        paramIndex++;
    }
    if (category_id) {
        whereClause += ` AND p.category_id = $${paramIndex}`;
        params.push(category_id);
        paramIndex++;
    }
    if (status === 'active') {
        whereClause += ' AND p.is_active = true';
    } else if (status === 'inactive') {
        whereClause += ' AND p.is_active = false';
    }

    const countResult = await db.query(
        `SELECT COUNT(*) FROM products p ${whereClause}`,
        params
    );

    const result = await db.query(
        `SELECT p.*, c.name as category_name FROM products p
         LEFT JOIN categories c ON p.category_id = c.id
         ${whereClause} ORDER BY p.created_at DESC LIMIT $${paramIndex} OFFSET $${paramIndex + 1}`,
        [...params, parseInt(limit), offset]
    );

    return {
        products: result.rows,
        total: parseInt(countResult.rows[0].count),
        page: parseInt(page),
        limit: parseInt(limit),
    };
}

async function getProduct(storeId, productId) {
    const result = await db.query(
        `SELECT p.*, c.name as category_name FROM products p
         LEFT JOIN categories c ON p.category_id = c.id
         WHERE p.id = $1 AND p.store_id = $2`,
        [productId, storeId]
    );
    if (result.rows.length === 0) {
        throw Object.assign(new Error('Produk tidak ditemukan'), { status: 404 });
    }
    return result.rows[0];
}

async function createProduct(storeId, userId, data) {
    const id = uuidv4();
    const result = await db.query(
        `INSERT INTO products (id, store_id, name, sku, category_id, cost_price, selling_price, stock, unit, low_stock_threshold, is_active)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11) RETURNING *`,
        [id, storeId, data.name, data.sku || utils.generateSKU(), data.category_id || null,
         data.cost_price || 0, data.selling_price || 0, data.stock || 0, data.unit || 'pcs',
         data.low_stock_threshold || 10, data.is_active !== false]
    );

    if (data.stock > 0) {
        await db.query(
            `INSERT INTO stock_movements (id, store_id, product_id, user_id, movement_type, quantity, stock_after, reference)
             VALUES ($1, $2, $3, $4, $5, $6, $7, $8)`,
            [uuidv4(), storeId, id, userId, 'restock', data.stock, data.stock, 'initial_stock']
        );
    }

    await db.query(
        'INSERT INTO activity_logs (id, store_id, user_id, action, description) VALUES ($1, $2, $3, $4, $5)',
        [uuidv4(), storeId, userId, 'create_product', `Menambahkan produk: ${data.name}`]
    );

    return result.rows[0];
}

async function updateProduct(storeId, userId, productId, data) {
    const existing = await getProduct(storeId, productId);
    const changes = [];

    const updates = [];
    const params = [];
    let paramIndex = 1;

    for (const [key, value] of Object.entries(data)) {
        const dbKey = utils.toSnakeCase(key);
        if (['name', 'sku', 'category_id', 'cost_price', 'selling_price', 'stock', 'unit', 'low_stock_threshold', 'is_active'].includes(dbKey)) {
            if (value !== undefined && value !== existing[dbKey]) {
                updates.push(`${dbKey} = $${paramIndex}`);
                params.push(value);
                paramIndex++;
                changes.push(`${dbKey}: ${existing[dbKey]} → ${value}`);
            }
        }
    }

    if (updates.length === 0) return existing;

    updates.push(`updated_at = NOW()`);
    params.push(productId);
    params.push(storeId);

    const result = await db.query(
        `UPDATE products SET ${updates.join(', ')} WHERE id = $${paramIndex} AND store_id = $${paramIndex + 1} RETURNING *`,
        params
    );

    if (changes.length > 0) {
        await db.query(
            'INSERT INTO activity_logs (id, store_id, user_id, action, description) VALUES ($1, $2, $3, $4, $5)',
            [uuidv4(), storeId, userId, 'update_product', `Mengubah produk ${existing.name}: ${changes.join(', ')}`]
        );
    }

    return result.rows[0];
}

async function deleteProduct(storeId, productId) {
    const existing = await getProduct(storeId, productId);
    await db.query('DELETE FROM products WHERE id = $1 AND store_id = $2', [productId, storeId]);
}

async function getCategories(storeId) {
    const result = await db.query(
        'SELECT * FROM categories WHERE store_id = $1 ORDER BY name ASC',
        [storeId]
    );
    return result.rows;
}

async function createCategory(storeId, userId, data) {
    const id = uuidv4();
    const result = await db.query(
        'INSERT INTO categories (id, store_id, name) VALUES ($1, $2, $3) RETURNING *',
        [id, storeId, data.name]
    );
    await db.query(
        'INSERT INTO activity_logs (id, store_id, user_id, action, description) VALUES ($1, $2, $3, $4, $5)',
        [uuidv4(), storeId, userId, 'create_category', `Menambahkan kategori: ${data.name}`]
    );
    return result.rows[0];
}

async function updateCategory(storeId, categoryId, data) {
    const result = await db.query(
        'UPDATE categories SET name = $1, updated_at = NOW() WHERE id = $2 AND store_id = $3 RETURNING *',
        [data.name, categoryId, storeId]
    );
    if (result.rows.length === 0) {
        throw Object.assign(new Error('Kategori tidak ditemukan'), { status: 404 });
    }
    return result.rows[0];
}

async function deleteCategory(storeId, categoryId) {
    await db.query(
        'UPDATE products SET category_id = NULL WHERE category_id = $1 AND store_id = $2',
        [categoryId, storeId]
    );
    await db.query('DELETE FROM categories WHERE id = $1 AND store_id = $2', [categoryId, storeId]);
}

async function createTransaction(storeId, userId, data) {
    const { items, payment_method, payment_amount } = data;
    if (!items || items.length === 0) {
        throw Object.assign(new Error('Keranjang kosong'), { status: 400 });
    }

    const result = await db.transaction(async (client) => {
        let total = 0;
        const transactionItems = [];

        for (const item of items) {
            const productResult = await client.query(
                'SELECT * FROM products WHERE id = $1 AND store_id = $2 FOR UPDATE',
                [item.product_id, storeId]
            );
            if (productResult.rows.length === 0) {
                throw Object.assign(new Error(`Produk tidak ditemukan`), { status: 404 });
            }
            const product = productResult.rows[0];
            if (!product.is_active) {
                throw Object.assign(new Error(`Produk ${product.name} tidak aktif`), { status: 400 });
            }
            if (product.stock < item.quantity) {
                throw Object.assign(new Error(`Stok ${product.name} tidak mencukupi (tersedia: ${product.stock})`), { status: 400 });
            }
            const subtotal = product.selling_price * item.quantity;
            total += subtotal;
            transactionItems.push({ product, quantity: item.quantity, price: product.selling_price, subtotal });
        }

        const paymentAmount = payment_method === 'cash' ? payment_amount : total;
        const changeAmount = payment_method === 'cash' ? paymentAmount - total : 0;

        if (payment_method === 'cash' && paymentAmount < total) {
            throw Object.assign(new Error('Jumlah pembayaran kurang'), { status: 400 });
        }

        const transactionId = uuidv4();
        const transactionNumber = utils.generateTransactionNumber();

        await client.query(
            `INSERT INTO transactions (id, store_id, user_id, transaction_id, total, payment_method, payment_amount, change_amount, status)
             VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)`,
            [transactionId, storeId, userId, transactionNumber, total, payment_method, paymentAmount, changeAmount, 'completed']
        );

        for (const item of transactionItems) {
            await client.query(
                'INSERT INTO transaction_items (id, transaction_id, product_id, product_name, quantity, price) VALUES ($1, $2, $3, $4, $5, $6)',
                [uuidv4(), transactionId, item.product.id, item.product.name, item.quantity, item.price]
            );

            const newStock = item.product.stock - item.quantity;
            await client.query('UPDATE products SET stock = $1, updated_at = NOW() WHERE id = $2', [newStock, item.product.id]);

            await client.query(
                `INSERT INTO stock_movements (id, store_id, product_id, user_id, movement_type, quantity, stock_after, reference)
                 VALUES ($1, $2, $3, $4, $5, $6, $7, $8)`,
                [uuidv4(), storeId, item.product.id, userId, 'sale', -item.quantity, newStock, transactionNumber]
            );
        }

        await client.query(
            'INSERT INTO activity_logs (id, store_id, user_id, action, description) VALUES ($1, $2, $3, $4, $5)',
            [uuidv4(), storeId, userId, 'create_transaction', `Mencatat penjualan: ${transactionNumber} (${formatCurrency(total)})`]
        );

        const storeResult = await client.query('SELECT name, receipt_footer FROM stores WHERE id = $1', [storeId]);
        const staffResult = await client.query('SELECT name FROM users WHERE id = $1', [userId]);

        return {
            id: transactionId,
            transaction_id: transactionNumber,
            total,
            payment_method,
            payment_amount: paymentAmount,
            change_amount: changeAmount,
            status: 'completed',
            created_at: new Date().toISOString(),
            store_name: storeResult.rows[0].name,
            receipt_footer: storeResult.rows[0].receipt_footer,
            staff_name: staffResult.rows[0].name,
            items: transactionItems.map(i => ({
                product_name: i.product.name,
                quantity: i.quantity,
                price: i.price,
            })),
        };
    });

    return result;
}

async function getTransactions(storeId, query) {
    const { search, date, payment_method, status, page = 1, limit = 20 } = query;
    const offset = (parseInt(page) - 1) * parseInt(limit);
    let whereClause = 'WHERE t.store_id = $1';
    const params = [storeId];
    let paramIndex = 2;

    if (search) {
        whereClause += ` AND t.transaction_id ILIKE $${paramIndex}`;
        params.push(`%${search}%`);
        paramIndex++;
    }
    if (date) {
        whereClause += ` AND DATE(t.created_at) = $${paramIndex}`;
        params.push(date);
        paramIndex++;
    }
    if (payment_method) {
        whereClause += ` AND t.payment_method = $${paramIndex}`;
        params.push(payment_method);
        paramIndex++;
    }
    if (status) {
        whereClause += ` AND t.status = $${paramIndex}`;
        params.push(status);
        paramIndex++;
    }

    const countResult = await db.query(`SELECT COUNT(*) FROM transactions t ${whereClause}`, params);
    const result = await db.query(
        `SELECT t.*, u.name as staff_name FROM transactions t
         LEFT JOIN users u ON t.user_id = u.id
         ${whereClause} ORDER BY t.created_at DESC LIMIT $${paramIndex} OFFSET $${paramIndex + 1}`,
        [...params, parseInt(limit), offset]
    );

    return {
        transactions: result.rows,
        total: parseInt(countResult.rows[0].count),
        page: parseInt(page),
        limit: parseInt(limit),
    };
}

async function getTransaction(storeId, transactionId) {
    const result = await db.query(
        `SELECT t.*, u.name as staff_name FROM transactions t
         LEFT JOIN users u ON t.user_id = u.id
         WHERE t.id = $1 AND t.store_id = $2`,
        [transactionId, storeId]
    );
    if (result.rows.length === 0) {
        throw Object.assign(new Error('Transaksi tidak ditemukan'), { status: 404 });
    }

    const itemsResult = await db.query(
        'SELECT * FROM transaction_items WHERE transaction_id = $1',
        [transactionId]
    );

    return { ...result.rows[0], items: itemsResult.rows };
}

async function cancelTransaction(storeId, userId, transactionId) {
    const tx = await getTransaction(storeId, transactionId);
    if (tx.status !== 'completed') {
        throw Object.assign(new Error('Transaksi sudah dibatalkan'), { status: 400 });
    }

    const result = await db.transaction(async (client) => {
        const items = await client.query('SELECT * FROM transaction_items WHERE transaction_id = $1', [transactionId]);

        for (const item of items.rows) {
            const product = await client.query(
                'SELECT * FROM products WHERE id = $1 AND store_id = $2 FOR UPDATE',
                [item.product_id, storeId]
            );
            if (product.rows.length > 0) {
                const newStock = product.rows[0].stock + item.quantity;
                await client.query('UPDATE products SET stock = $1, updated_at = NOW() WHERE id = $2', [newStock, item.product_id]);
                await client.query(
                    `INSERT INTO stock_movements (id, store_id, product_id, user_id, movement_type, quantity, stock_after, reference)
                     VALUES ($1, $2, $3, $4, $5, $6, $7, $8)`,
                    [uuidv4(), storeId, item.product_id, userId, 'cancelled_sale', item.quantity, newStock, tx.transaction_id]
                );
            }
        }

        await client.query(
            'UPDATE transactions SET status = $1, updated_at = NOW() WHERE id = $2',
            ['cancelled', transactionId]
        );

        await client.query(
            'INSERT INTO activity_logs (id, store_id, user_id, action, description) VALUES ($1, $2, $3, $4, $5)',
            [uuidv4(), storeId, userId, 'cancel_transaction', `Membatalkan transaksi: ${tx.transaction_id}`]
        );

        return { ...tx, status: 'cancelled' };
    });

    return result;
}

async function getInventory(storeId, query) {
    const { page = 1, limit = 20 } = query;
    const offset = (parseInt(page) - 1) * parseInt(limit);

    const countResult = await db.query(
        'SELECT COUNT(*) FROM stock_movements WHERE store_id = $1',
        [storeId]
    );
    const result = await db.query(
        `SELECT sm.*, p.name as product_name FROM stock_movements sm
         LEFT JOIN products p ON sm.product_id = p.id
         WHERE sm.store_id = $1 ORDER BY sm.created_at DESC LIMIT $2 OFFSET $3`,
        [storeId, parseInt(limit), offset]
    );

    return {
        movements: result.rows,
        total: parseInt(countResult.rows[0].count),
        page: parseInt(page),
        limit: parseInt(limit),
    };
}

async function restockProduct(storeId, userId, data) {
    const product = await getProduct(storeId, data.product_id);
    const newStock = product.stock + data.quantity;

    const result = await db.transaction(async (client) => {
        await client.query('UPDATE products SET stock = $1, cost_price = $2, updated_at = NOW() WHERE id = $3',
            [newStock, data.cost || product.cost_price, data.product_id]);

        await client.query(
            `INSERT INTO stock_movements (id, store_id, product_id, user_id, movement_type, quantity, stock_after, reference, note)
             VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)`,
            [uuidv4(), storeId, data.product_id, userId, 'restock', data.quantity, newStock,
             data.supplier || 'manual_restock', data.note || '']
        );

        await client.query(
            'INSERT INTO activity_logs (id, store_id, user_id, action, description) VALUES ($1, $2, $3, $4, $5)',
            [uuidv4(), storeId, userId, 'restock', `Restock ${product.name}: +${data.quantity} (stok: ${newStock})`]
        );

        return { product: { ...product, stock: newStock }, quantity: data.quantity };
    });

    return result;
}

async function adjustStock(storeId, userId, data) {
    const product = await getProduct(storeId, data.product_id);
    const difference = data.actual_stock - product.stock;

    if (difference === 0) {
        throw Object.assign(new Error('Tidak ada perubahan stok'), { status: 400 });
    }

    const result = await db.transaction(async (client) => {
        await client.query('UPDATE products SET stock = $1, updated_at = NOW() WHERE id = $2',
            [data.actual_stock, data.product_id]);

        await client.query(
            `INSERT INTO stock_movements (id, store_id, product_id, user_id, movement_type, quantity, stock_after, reference, note)
             VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)`,
            [uuidv4(), storeId, data.product_id, userId, 'adjustment', difference, data.actual_stock,
             'adjustment', `Adjustment: ${data.reason} (${product.stock} → ${data.actual_stock})`]
        );

        await client.query(
            'INSERT INTO activity_logs (id, store_id, user_id, action, description) VALUES ($1, $2, $3, $4, $5)',
            [uuidv4(), storeId, userId, 'adjust_stock',
             `Adjustment stok ${product.name}: ${product.stock} → ${data.actual_stock} (${data.reason})`]
        );

        return { product: { ...product, stock: data.actual_stock }, difference };
    });

    return result;
}

async function getExpenses(storeId, query) {
    const { start_date, end_date, page = 1, limit = 20 } = query;
    const offset = (parseInt(page) - 1) * parseInt(limit);
    let whereClause = 'WHERE store_id = $1';
    const params = [storeId];
    let paramIndex = 2;

    if (start_date) {
        whereClause += ` AND expense_date >= $${paramIndex}`;
        params.push(start_date);
        paramIndex++;
    }
    if (end_date) {
        whereClause += ` AND expense_date <= $${paramIndex}`;
        params.push(end_date);
        paramIndex++;
    }

    const countResult = await db.query(`SELECT COUNT(*) FROM expenses ${whereClause}`, params);
    const result = await db.query(
        `SELECT * FROM expenses ${whereClause} ORDER BY expense_date DESC LIMIT $${paramIndex} OFFSET $${paramIndex + 1}`,
        [...params, parseInt(limit), offset]
    );

    return {
        expenses: result.rows,
        total: parseInt(countResult.rows[0].count),
        page: parseInt(page),
        limit: parseInt(limit),
    };
}

async function getExpense(storeId, expenseId) {
    const result = await db.query('SELECT * FROM expenses WHERE id = $1 AND store_id = $2', [expenseId, storeId]);
    if (result.rows.length === 0) {
        throw Object.assign(new Error('Pengeluaran tidak ditemukan'), { status: 404 });
    }
    return result.rows[0];
}

async function createExpense(storeId, userId, data) {
    const id = uuidv4();
    const result = await db.query(
        'INSERT INTO expenses (id, store_id, category, amount, description, expense_date) VALUES ($1, $2, $3, $4, $5, $6) RETURNING *',
        [id, storeId, data.category, data.amount, data.description || '', data.expense_date]
    );
    await db.query(
        'INSERT INTO activity_logs (id, store_id, user_id, action, description) VALUES ($1, $2, $3, $4, $5)',
        [uuidv4(), storeId, userId, 'create_expense', `Menambahkan pengeluaran: ${data.category} (${formatCurrency(data.amount)})`]
    );
    return result.rows[0];
}

async function updateExpense(storeId, expenseId, data) {
    const result = await db.query(
        `UPDATE expenses SET category = $1, amount = $2, description = $3, expense_date = $4, updated_at = NOW()
         WHERE id = $5 AND store_id = $6 RETURNING *`,
        [data.category, data.amount, data.description || '', data.expense_date, expenseId, storeId]
    );
    if (result.rows.length === 0) {
        throw Object.assign(new Error('Pengeluaran tidak ditemukan'), { status: 404 });
    }
    return result.rows[0];
}

async function deleteExpense(storeId, expenseId) {
    await db.query('DELETE FROM expenses WHERE id = $1 AND store_id = $2', [expenseId, storeId]);
}

async function getEmployees(storeId) {
    const result = await db.query(
        'SELECT id, store_id, name, email, role, is_active, created_at, last_active FROM users WHERE store_id = $1 ORDER BY created_at ASC',
        [storeId]
    );
    return result.rows;
}

async function getEmployee(storeId, employeeId) {
    const result = await db.query(
        'SELECT id, store_id, name, email, role, is_active, created_at, last_active FROM users WHERE id = $1 AND store_id = $2',
        [employeeId, storeId]
    );
    if (result.rows.length === 0) {
        throw Object.assign(new Error('Staff tidak ditemukan'), { status: 404 });
    }
    return result.rows[0];
}

async function createEmployee(storeId, userId, data) {
    const existing = await db.query('SELECT id FROM users WHERE email = $1', [data.email.toLowerCase().trim()]);
    if (existing.rows.length > 0) {
        throw Object.assign(new Error('Email sudah terdaftar'), { status: 409 });
    }

    const hashedPassword = await bcrypt.hash(data.password, 12);
    const id = uuidv4();
    const result = await db.query(
        `INSERT INTO users (id, store_id, name, email, password, role, is_active)
         VALUES ($1, $2, $3, $4, $5, $6, $7) RETURNING id, store_id, name, email, role, is_active, created_at`,
        [id, storeId, data.name.trim(), data.email.toLowerCase().trim(), hashedPassword, 'staff', true]
    );

    await db.query(
        'INSERT INTO activity_logs (id, store_id, user_id, action, description) VALUES ($1, $2, $3, $4, $5)',
        [uuidv4(), storeId, userId, 'create_employee', `Menambahkan staff: ${data.name}`]
    );

    return result.rows[0];
}

async function updateEmployee(storeId, employeeId, data) {
    const updates = [];
    const params = [];
    let paramIndex = 1;

    if (data.name) {
        updates.push(`name = $${paramIndex}`);
        params.push(data.name.trim());
        paramIndex++;
    }
    if (data.email) {
        updates.push(`email = $${paramIndex}`);
        params.push(data.email.toLowerCase().trim());
        paramIndex++;
    }
    if (data.is_active !== undefined) {
        updates.push(`is_active = $${paramIndex}`);
        params.push(data.is_active);
        paramIndex++;
    }
    if (data.password) {
        const hashedPassword = await bcrypt.hash(data.password, 12);
        updates.push(`password = $${paramIndex}`);
        params.push(hashedPassword);
        paramIndex++;
    }

    if (updates.length === 0) return null;

    updates.push(`updated_at = NOW()`);
    params.push(employeeId);
    params.push(storeId);

    const result = await db.query(
        `UPDATE users SET ${updates.join(', ')} WHERE id = $${paramIndex} AND store_id = $${paramIndex + 1} AND role = 'staff'
         RETURNING id, store_id, name, email, role, is_active, created_at`,
        params
    );
    if (result.rows.length === 0) {
        throw Object.assign(new Error('Staff tidak ditemukan'), { status: 404 });
    }
    return result.rows[0];
}

async function resetEmployeePassword(storeId, employeeId) {
    const defaultPassword = 'staff123456';
    const hashedPassword = await bcrypt.hash(defaultPassword, 12);
    await db.query(
        `UPDATE users SET password = $1, updated_at = NOW() WHERE id = $2 AND store_id = $3 AND role = 'staff'`,
        [hashedPassword, employeeId, storeId]
    );
    return { default_password: defaultPassword };
}

async function getReport(storeId, type, query) {
    const { start_date, end_date } = query;
    const startDate = start_date || new Date(new Date().getFullYear(), new Date().getMonth(), 1).toISOString().split('T')[0];
    const endDate = end_date || new Date().toISOString().split('T')[0];

    if (type === 'sales') {
        const revenue = await db.query(
            `SELECT COALESCE(SUM(total), 0) as total FROM transactions
             WHERE store_id = $1 AND status = 'completed' AND DATE(created_at) >= $2 AND DATE(created_at) <= $3`,
            [storeId, startDate, endDate]
        );
        const txCount = await db.query(
            `SELECT COUNT(*) as count FROM transactions
             WHERE store_id = $1 AND status = 'completed' AND DATE(created_at) >= $2 AND DATE(created_at) <= $3`,
            [storeId, startDate, endDate]
        );
        const itemsCount = await db.query(
            `SELECT COALESCE(SUM(ti.quantity), 0) as total FROM transaction_items ti
             JOIN transactions t ON ti.transaction_id = t.id
             WHERE t.store_id = $1 AND t.status = 'completed' AND DATE(t.created_at) >= $2 AND DATE(t.created_at) <= $3`,
            [storeId, startDate, endDate]
        );
        const totalRevenue = parseFloat(revenue.rows[0].total);
        const totalTx = parseInt(txCount.rows[0].count);
        const avgTx = totalTx > 0 ? totalRevenue / totalTx : 0;

        const chartData = await db.query(
            `SELECT DATE(created_at) as date_label, COALESCE(SUM(total), 0) as total
             FROM transactions WHERE store_id = $1 AND status = 'completed' AND DATE(created_at) >= $2 AND DATE(created_at) <= $3
             GROUP BY DATE(created_at) ORDER BY date_label`,
            [storeId, startDate, endDate]
        );

        return {
            total_revenue: totalRevenue,
            total_transactions: totalTx,
            total_items: parseInt(itemsCount.rows[0].total),
            avg_transaction: avgTx,
            chart_data: chartData.rows.map(r => ({ label: r.date_label ? r.date_label.toISOString().split('T')[0] : '', revenue: parseFloat(r.total) })),
        };
    }

    if (type === 'profit') {
        const revenueResult = await db.query(
            `SELECT COALESCE(SUM(total), 0) as total FROM transactions
             WHERE store_id = $1 AND status = 'completed' AND DATE(created_at) >= $2 AND DATE(created_at) <= $3`,
            [storeId, startDate, endDate]
        );
        const cogsResult = await db.query(
            `SELECT COALESCE(SUM(p.cost_price * ti.quantity), 0) as total FROM transaction_items ti
             JOIN transactions t ON ti.transaction_id = t.id
             JOIN products p ON ti.product_id = p.id
             WHERE t.store_id = $1 AND t.status = 'completed' AND DATE(t.created_at) >= $2 AND DATE(t.created_at) <= $3`,
            [storeId, startDate, endDate]
        );
        const expensesResult = await db.query(
            `SELECT COALESCE(SUM(amount), 0) as total FROM expenses
             WHERE store_id = $1 AND expense_date >= $2 AND expense_date <= $3`,
            [storeId, startDate, endDate]
        );

        const revenue = parseFloat(revenueResult.rows[0].total);
        const cogs = parseFloat(cogsResult.rows[0].total);
        const grossProfit = revenue - cogs;
        const expenses = parseFloat(expensesResult.rows[0].total);
        const netIncome = grossProfit - expenses;

        return { revenue, cogs, gross_profit: grossProfit, expenses, net_income: netIncome };
    }

    if (type === 'products') {
        const result = await db.query(
            `SELECT p.name, SUM(ti.quantity) as total_sold, SUM(ti.quantity * ti.price) as revenue,
                    SUM((ti.price - p.cost_price) * ti.quantity) as profit
             FROM transaction_items ti
             JOIN transactions t ON ti.transaction_id = t.id
             JOIN products p ON ti.product_id = p.id
             WHERE t.store_id = $1 AND t.status = 'completed' AND DATE(t.created_at) >= $2 AND DATE(t.created_at) <= $3
             GROUP BY p.id, p.name ORDER BY total_sold DESC`,
            [storeId, startDate, endDate]
        );
        return { products: result.rows };
    }

    if (type === 'staff') {
        const result = await db.query(
            `SELECT u.name, COUNT(t.id) as transaction_count, COALESCE(SUM(t.total), 0) as total_sales,
                    CASE WHEN COUNT(t.id) > 0 THEN COALESCE(SUM(t.total), 0) / COUNT(t.id) ELSE 0 END as avg_transaction
             FROM users u
             LEFT JOIN transactions t ON u.id = t.user_id AND t.status = 'completed' AND DATE(t.created_at) >= $2 AND DATE(t.created_at) <= $3
             WHERE u.store_id = $1 AND u.role = 'staff'
             GROUP BY u.id, u.name ORDER BY total_sales DESC`,
            [storeId, startDate, endDate]
        );
        return { staff: result.rows };
    }

    return {};
}

async function exportReport(storeId, type, query) {
    const report = await getReport(storeId, type, query);
    const { start_date, end_date } = query;
    let csv = '';

    if (type === 'sales') {
        csv = 'Metric,Value\n';
        csv += `Total Revenue,${report.total_revenue}\n`;
        csv += `Total Transaksi,${report.total_transactions}\n`;
        csv += `Item Terjual,${report.total_items}\n`;
        csv += `Rata-rata Transaksi,${report.avg_transaction}\n`;
    } else if (type === 'profit') {
        csv = 'Metric,Value\n';
        csv += `Revenue,${report.revenue}\n`;
        csv += `COGS,${report.cogs}\n`;
        csv += `Gross Profit,${report.gross_profit}\n`;
        csv += `Expenses,${report.expenses}\n`;
        csv += `Net Income,${report.net_income}\n`;
    } else if (type === 'products') {
        csv = 'Produk,Terjual,Revenue,Profit\n';
        (report.products || []).forEach(p => {
            csv += `"${p.name}",${p.total_sold},${p.revenue},${p.profit}\n`;
        });
    } else if (type === 'staff') {
        csv = 'Staff,Transaksi,Total Sales,Rata-rata\n';
        (report.staff || []).forEach(s => {
            csv += `"${s.name}",${s.transaction_count},${s.total_sales},${s.avg_transaction}\n`;
        });
    }

    return csv;
}

async function getActivities(storeId, query) {
    const { page = 1, limit = 50 } = query;
    const offset = (parseInt(page) - 1) * parseInt(limit);
    const result = await db.query(
        `SELECT al.*, u.name as user_name FROM activity_logs al
         LEFT JOIN users u ON al.user_id = u.id
         WHERE al.store_id = $1 ORDER BY al.created_at DESC LIMIT $2 OFFSET $3`,
        [storeId, parseInt(limit), offset]
    );
    const countResult = await db.query('SELECT COUNT(*) FROM activity_logs WHERE store_id = $1', [storeId]);
    return {
        activities: result.rows,
        total: parseInt(countResult.rows[0].count),
    };
}

async function updatePaymentMethods(storeId, methods) {
    await db.query('UPDATE stores SET payment_methods = $1, updated_at = NOW() WHERE id = $2',
        [JSON.stringify(methods), storeId]);
}

async function updateStoreSettings(storeId, data) {
    const updates = [];
    const params = [];
    let paramIndex = 1;

    const mapping = {
        store_name: 'name',
        currency: 'currency',
        timezone: 'timezone',
        low_stock_threshold: 'low_stock_threshold',
        receipt_footer: 'receipt_footer',
    };

    for (const [key, dbKey] of Object.entries(mapping)) {
        if (data[key] !== undefined) {
            updates.push(`${dbKey} = $${paramIndex}`);
            params.push(data[key]);
            paramIndex++;
        }
    }

    if (updates.length === 0) return;
    updates.push('updated_at = NOW()');
    params.push(storeId);

    await db.query(`UPDATE stores SET ${updates.join(', ')} WHERE id = $${paramIndex}`, params);
}

async function updateProfile(userId, data) {
    const updates = [];
    const params = [];
    let paramIndex = 1;

    if (data.name) {
        updates.push(`name = $${paramIndex}`);
        params.push(data.name.trim());
        paramIndex++;
    }
    if (data.email) {
        updates.push(`email = $${paramIndex}`);
        params.push(data.email.toLowerCase().trim());
        paramIndex++;
    }
    if (data.password) {
        const hashedPassword = await bcrypt.hash(data.password, 12);
        updates.push(`password = $${paramIndex}`);
        params.push(hashedPassword);
        paramIndex++;
    }

    if (updates.length === 0) return null;
    updates.push('updated_at = NOW()');
    params.push(userId);

    const result = await db.query(
        `UPDATE users SET ${updates.join(', ')} WHERE id = $${paramIndex} RETURNING id, name, email, role`,
        params
    );
    return result.rows[0];
}

function formatCurrency(amount) {
    return 'Rp' + Number(amount).toLocaleString('id-ID');
}

module.exports = {
    getDashboard, getProducts, getProduct, createProduct, updateProduct, deleteProduct,
    getCategories, createCategory, updateCategory, deleteCategory,
    createTransaction, getTransactions, getTransaction, cancelTransaction,
    getInventory, restockProduct, adjustStock,
    getExpenses, getExpense, createExpense, updateExpense, deleteExpense,
    getEmployees, getEmployee, createEmployee, updateEmployee, resetEmployeePassword,
    getReport, exportReport, getActivities,
    updatePaymentMethods, updateStoreSettings, updateProfile,
};