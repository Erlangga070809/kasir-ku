const config = {
    port: process.env.PORT || 3000,
    nodeEnv: process.env.NODE_ENV || 'development',
    database: {
        url: process.env.DATABASE_URL,
        ssl: process.env.DATABASE_SSL === 'true' || process.env.NODE_ENV === 'production',
    },
    jwt: {
        secret: process.env.JWT_SECRET || 'kasir-digital-jwt-secret-change-in-production',
        expiresIn: process.env.JWT_EXPIRES_IN || '7d',
    },
    cookie: {
        name: process.env.COOKIE_NAME || 'kasir_digital_token',
        maxAge: parseInt(process.env.COOKIE_MAX_AGE) || 7 * 24 * 60 * 60 * 1000,
    },
    cors: {
        origin: process.env.CORS_ORIGIN || 'http://localhost:3000',
    },
};

module.exports = config;
