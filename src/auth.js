const bcrypt = require('bcrypt');
const jwt = require('jsonwebtoken');
const { v4: uuidv4 } = require('uuid');
const db = require('./db');
const config = require('../config');

async function register({ name, email, password, store_name }) {
    const existingUser = await db.query('SELECT id FROM users WHERE email = $1', [email.toLowerCase().trim()]);
    if (existingUser.rows.length > 0) {
        throw Object.assign(new Error('Email sudah terdaftar'), { status: 409 });
    }

    const hashedPassword = await bcrypt.hash(password, 12);
    const userId = uuidv4();
    const storeId = uuidv4();

    const result = await db.transaction(async (client) => {
        const store = await client.query(
            'INSERT INTO stores (id, name, currency, timezone, low_stock_threshold, receipt_footer) VALUES ($1, $2, $3, $4, $5, $6) RETURNING id, name',
            [storeId, store_name.trim(), 'Rp', 'Asia/Jakarta', 10, 'Terima kasih telah berbelanja!']
        );

        const user = await client.query(
            'INSERT INTO users (id, store_id, name, email, password, role, is_active) VALUES ($1, $2, $3, $4, $5, $6, $7) RETURNING id, store_id, name, email, role',
            [userId, storeId, name.trim(), email.toLowerCase().trim(), hashedPassword, 'owner', true]
        );

        await client.query(
            'INSERT INTO activity_logs (id, store_id, user_id, action, description) VALUES ($1, $2, $3, $4, $5)',
            [uuidv4(), storeId, userId, 'register', 'Pemilik toko mendaftar']
        );

        return user.rows[0];
    });

    const token = generateToken(result);
    return { user: result, token };
}

async function login({ email, password }) {
    const result = await db.query(
        `SELECT u.id, u.store_id, u.name, u.email, u.password, u.role, u.is_active, s.name as store_name
         FROM users u JOIN stores s ON u.store_id = s.id
         WHERE u.email = $1`,
        [email.toLowerCase().trim()]
    );

    if (result.rows.length === 0) {
        throw Object.assign(new Error('Email atau password salah'), { status: 401 });
    }

    const user = result.rows[0];

    if (!user.is_active) {
        throw Object.assign(new Error('Akun dinonaktifkan, hubungi pemilik toko'), { status: 403 });
    }

    const validPassword = await bcrypt.compare(password, user.password);
    if (!validPassword) {
        throw Object.assign(new Error('Email atau password salah'), { status: 401 });
    }

    await db.query('UPDATE users SET last_active = NOW() WHERE id = $1', [user.id]);

    const { password: _, ...userData } = user;
    const token = generateToken(userData);
    return { user: userData, token };
}

async function getCurrentUser(userId) {
    const result = await db.query(
        `SELECT u.id, u.store_id, u.name, u.email, u.role, u.is_active, u.created_at, u.last_active,
                s.name as store_name, s.currency, s.timezone, s.low_stock_threshold, s.receipt_footer, s.payment_methods
         FROM users u JOIN stores s ON u.store_id = s.id
         WHERE u.id = $1`,
        [userId]
    );

    if (result.rows.length === 0) {
        throw Object.assign(new Error('User tidak ditemukan'), { status: 404 });
    }

    const user = result.rows[0];
    return {
        id: user.id,
        store_id: user.store_id,
        name: user.name,
        email: user.email,
        role: user.role,
        is_active: user.is_active,
        created_at: user.created_at,
        last_active: user.last_active,
        store: {
            name: user.store_name,
            currency: user.currency,
            timezone: user.timezone,
            low_stock_threshold: user.low_stock_threshold,
            receipt_footer: user.receipt_footer,
            payment_methods: user.payment_methods || ['cash', 'qris', 'transfer', 'other'],
        },
    };
}

function generateToken(user) {
    return jwt.sign(
        {
            id: user.id,
            store_id: user.store_id,
            email: user.email,
            role: user.role,
        },
        config.jwt.secret,
        { expiresIn: config.jwt.expiresIn }
    );
}

function setCookie(res, token) {
    res.cookie(config.cookie.name, token, {
        httpOnly: true,
        secure: config.nodeEnv === 'production',
        sameSite: 'lax',
        maxAge: config.cookie.maxAge,
        path: '/',
    });
}

function clearCookie(res) {
    res.clearCookie(config.cookie.name, { path: '/' });
}

module.exports = { register, login, getCurrentUser, setCookie, clearCookie };
