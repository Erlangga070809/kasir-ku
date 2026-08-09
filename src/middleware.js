const jwt = require('jsonwebtoken');
const config = require('../config');

function authenticate(req, res, next) {
    const token = req.cookies[config.cookie.name] || req.cookies['token'];

    if (!token) {
        return res.status(401).json({ success: false, message: 'Silakan login terlebih dahulu' });
    }

    try {
        const decoded = jwt.verify(token, config.jwt.secret);
        req.user = decoded;
        next();
    } catch (err) {
        res.clearCookie(config.cookie.name);
        return res.status(401).json({ success: false, message: 'Sesi telah berakhir, silakan login kembali' });
    }
}

function authorize(...roles) {
    return (req, res, next) => {
        if (!req.user) {
            return res.status(401).json({ success: false, message: 'Silakan login terlebih dahulu' });
        }
        if (!roles.includes(req.user.role)) {
            return res.status(403).json({ success: false, message: 'Anda tidak memiliki akses' });
        }
        next();
    };
}

function requireStore(req, res, next) {
    if (!req.user || !req.user.store_id) {
        return res.status(400).json({ success: false, message: 'Data toko tidak ditemukan' });
    }
    next();
}

function validateBody(fields) {
    return (req, res, next) => {
        const missing = [];
        for (const field of fields) {
            if (req.body[field] === undefined || req.body[field] === null || req.body[field] === '') {
                missing.push(field);
            }
        }
        if (missing.length > 0) {
            return res.status(400).json({
                success: false,
                message: `Field wajib diisi: ${missing.join(', ')}`,
            });
        }
        next();
    };
}

function errorHandler(err, req, res, next) {
    console.error('Server error:', err.message);
    if (config.nodeEnv === 'development') {
        console.error(err.stack);
    }

    if (err.code === '23505') {
        return res.status(409).json({ success: false, message: 'Data sudah ada' });
    }
    if (err.code === '23503') {
        return res.status(400).json({ success: false, message: 'Data terkait tidak ditemukan' });
    }
    if (err.code === '22P02') {
        return res.status(400).json({ success: false, message: 'Format data tidak valid' });
    }

    res.status(err.status || 500).json({
        success: false,
        message: err.message || 'Terjadi kesalahan internal',
    });
}

function rateLimit(maxRequests, windowMs) {
    const requests = new Map();
    return (req, res, next) => {
        const key = req.ip;
        const now = Date.now();
        if (!requests.has(key)) {
            requests.set(key, []);
        }
        const timestamps = requests.get(key).filter(t => now - t < windowMs);
        if (timestamps.length >= maxRequests) {
            return res.status(429).json({ success: false, message: 'Terlalu banyak permintaan, coba lagi nanti' });
        }
        timestamps.push(now);
        requests.set(key, timestamps);
        next();
    };
}

module.exports = { authenticate, authorize, requireStore, validateBody, errorHandler, rateLimit };
