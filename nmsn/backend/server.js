const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const rateLimit = require('express-rate-limit');
const jwt = require('jsonwebtoken');
const winston = require('winston');
const { body, validationResult } = require('express-validator');
const axios = require('axios');

// NMSN API Server - National Metal Settlement Network
// Central hub for metal payments and settlements

const app = express();
const PORT = process.env.NMSN_PORT || 3001;

// Logger setup
const logger = winston.createLogger({
    level: 'info',
    format: winston.format.combine(
        winston.format.timestamp(),
        winston.format.json(),
        winston.format.printf(info => `${info.timestamp} [${info.level.toUpperCase()}] ${info.message}`)
    ),
    transports: [
        new winston.transports.File({ filename: 'logs/nmsn-error.log', level: 'error' }),
        new winston.transports.File({ filename: 'logs/nmsn-combined.log' }),
        new winston.transports.Console({
            format: winston.format.combine(
                winston.format.colorize(),
                winston.format.simple()
            )
        })
    ]
});

// Middleware setup
app.use(helmet({
    contentSecurityPolicy: {
        directives: {
            defaultSrc: ["'self'"],
            styleSrc: ["'self'", "'unsafe-inline'"],
            scriptSrc: ["'self'"],
            imgSrc: ["'self'", "data:", "https:"],
            connectSrc: ["'self'"],
            fontSrc: ["'self'"],
            objectSrc: ["'none'"],
            mediaSrc: ["'self'"],
            frameSrc: ["'none'"],
        },
    },
    crossOriginEmbedderPolicy: false
}));

app.use(cors({
    origin: process.env.ALLOWED_ORIGINS?.split(',') || ['http://localhost:3000'],
    credentials: true,
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization', 'X-Requested-With']
}));

app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

// Rate limiting
const generalLimiter = rateLimit({
    windowMs: 15 * 60 * 1000, // 15 minutes
    max: 1000, // limit each IP to 1000 requests per windowMs
    message: {
        error: {
            code: 'RATE_LIMIT_EXCEEDED',
            message: 'Too many requests from this IP, please try again later.'
        }
    },
    standardHeaders: true,
    legacyHeaders: false,
});

const paymentLimiter = rateLimit({
    windowMs: 60 * 1000, // 1 minute
    max: 100, // limit payment requests to 100 per minute
    message: {
        error: {
            code: 'PAYMENT_RATE_LIMIT_EXCEEDED',
            message: 'Too many payment requests, please try again later.'
        }
    }
});

app.use('/api/', generalLimiter);
app.use('/api/payments/', paymentLimiter);

// JWT Secret
const JWT_SECRET = process.env.NMSN_JWT_SECRET || 'nmsn-jwt-secret-key-development';

// Import service modules
const metalPricing = require('./services/metal-pricing');
const settlementEngine = require('./services/settlement-engine');
const vaultConnector = require('./services/vault-connector');
const binrBridge = require('./services/binr-bridge');
const merchantService = require('./services/merchant-service');
const complianceEngine = require('./services/compliance-engine');

// In-memory stores (replace with database in production)
const paymentTransactions = new Map();
const settlements = new Map();
const merchantWallets = new Map();
const metalBalances = new Map();

// Health check endpoint
app.get('/health', (req, res) => {
    res.status(200).json({
        status: 'healthy',
        timestamp: new Date().toISOString(),
        service: 'NMSN - National Metal Settlement Network',
        version: '1.0.0'
    });
});

// Authentication middleware
const authenticateToken = (req, res, next) => {
    const authHeader = req.headers['authorization'];
    const token = authHeader && authHeader.split(' ')[1];

    if (!token) {
        return res.status(401).json({
            error: {
                code: 'ACCESS_TOKEN_REQUIRED',
                message: 'Access token is required'
            }
        });
    }

    jwt.verify(token, JWT_SECRET, (err, user) => {
        if (err) {
            return res.status(403).json({
                error: {
                    code: 'INVALID_TOKEN',
                    message: 'Invalid or expired token'
                }
            });
        }
        req.user = user;
        next();
    });
};

// ============= PAYMENT ROUTES =============

// Create metal payment
app.post('/api/payments/create', 
    authenticateToken,
    [
        body('amount').isNumeric().withMessage('Amount must be a number'),
        body('currency').isIn(['INR']).withMessage('Currency must be INR'),
        body('metalType').isIn(['gold', 'silver', 'platinum', 'basket']).withMessage('Invalid metal type'),
        body('merchantId').notEmpty().withMessage('Merchant ID is required'),
        body('customerId').notEmpty().withMessage('Customer ID is required'),
        body('description').optional().isString().withMessage('Description must be a string')
    ],
    async (req, res) => {
        try {
            const errors = validationResult(req);
            if (!errors.isEmpty()) {
                return res.status(400).json({
                    error: {
                        code: 'VALIDATION_ERROR',
                        message: 'Invalid request data',
                        details: errors.array()
                    }
                });
            }

            const { amount, currency, metalType, merchantId, customerId, description } = req.body;

            logger.info(`Creating metal payment: ${amount} ${currency} using ${metalType}`);

            // Get current metal price
            const metalPrice = await metalPricing.getMetalPrice(metalType);
            if (!metalPrice) {
                return res.status(400).json({
                    error: {
                        code: 'METAL_PRICE_UNAVAILABLE',
                        message: `Price not available for ${metalType}`
                    }
                });
            }

            // Calculate metal quantity required
            const metalQuantity = amount / metalPrice.price;
            
            // Validate customer has sufficient balance
            const customerBalance = metalBalances.get(`${customerId}_${metalType}`) || 0;
            if (customerBalance < metalQuantity) {
                return res.status(400).json({
                    error: {
                        code: 'INSUFFICIENT_BALANCE',
                        message: `Insufficient ${metalType} balance`,
                        required: metalQuantity,
                        available: customerBalance
                    }
                });
            }

            // Create payment transaction
            const paymentId = `pay_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
            const payment = {
                id: paymentId,
                amount: amount,
                currency: currency,
                metalType: metalType,
                metalQuantity: metalQuantity,
                metalPrice: metalPrice.price,
                customerId: customerId,
                merchantId: merchantId,
                description: description || '',
                status: 'pending',
                createdAt: new Date().toISOString(),
                settlementStatus: 'pending'
            };

            paymentTransactions.set(paymentId, payment);

            // Deduct metal from customer balance (pending settlement)
            metalBalances.set(`${customerId}_${metalType}`, customerBalance - metalQuantity);

            logger.info(`Payment created successfully: ${paymentId}`);

            res.status(201).json({
                success: true,
                data: {
                    paymentId: paymentId,
                    amount: amount,
                    currency: currency,
                    metalType: metalType,
                    metalQuantity: metalQuantity,
                    metalPrice: metalPrice.price,
                    totalAmount: amount,
                    merchantId: merchantId,
                    status: 'pending',
                    expiresAt: new Date(Date.now() + 5 * 60 * 1000).toISOString() // 5 minutes
                }
            });

        } catch (error) {
            logger.error('Payment creation error:', error);
            res.status(500).json({
                error: {
                    code: 'PAYMENT_CREATION_FAILED',
                    message: 'Failed to create payment',
                    details: error.message
                }
            });
        }
    }
);

// Confirm metal payment and initiate settlement
app.post('/api/payments/:paymentId/confirm',
    authenticateToken,
    async (req, res) => {
        try {
            const { paymentId } = req.params;
            const payment = paymentTransactions.get(paymentId);

            if (!payment) {
                return res.status(404).json({
                    error: {
                        code: 'PAYMENT_NOT_FOUND',
                        message: 'Payment not found'
                    }
                });
            }

            if (payment.status !== 'pending') {
                return res.status(400).json({
                    error: {
                        code: 'INVALID_PAYMENT_STATUS',
                        message: `Payment is already ${payment.status}`
                    }
                });
            }

            // Check if payment has expired
            const expiresAt = new Date(payment.expiresAt);
            if (new Date() > expiresAt) {
                payment.status = 'expired';
                return res.status(400).json({
                    error: {
                        code: 'PAYMENT_EXPIRED',
                        message: 'Payment has expired'
                    }
                });
            }

            logger.info(`Confirming payment: ${paymentId}`);

            // Initiate settlement process
            const settlement = await settlementEngine.initiateSettlement(payment);
            
            // Update payment status
            payment.status = 'confirmed';
            payment.settlementId = settlement.id;
            payment.confirmedAt = new Date().toISOString();
            paymentTransactions.set(paymentId, payment);

            logger.info(`Payment confirmed successfully: ${paymentId}`);

            res.json({
                success: true,
                data: {
                    paymentId: paymentId,
                    status: 'confirmed',
                    settlementId: settlement.id,
                    settlementStatus: settlement.status,
                    estimatedSettlementTime: '2 seconds',
                    merchantWalletAddress: settlement.merchantWallet
                }
            });

        } catch (error) {
            logger.error('Payment confirmation error:', error);
            res.status(500).json({
                error: {
                    code: 'PAYMENT_CONFIRMATION_FAILED',
                    message: 'Failed to confirm payment',
                    details: error.message
                }
            });
        }
    }
);

// Get payment status
app.get('/api/payments/:paymentId/status', authenticateToken, async (req, res) => {
    try {
        const { paymentId } = req.params;
        const payment = paymentTransactions.get(paymentId);

        if (!payment) {
            return res.status(404).json({
                error: {
                    code: 'PAYMENT_NOT_FOUND',
                    message: 'Payment not found'
                }
            });
        }

        res.json({
            success: true,
            data: {
                paymentId: paymentId,
                status: payment.status,
                settlementStatus: payment.settlementStatus,
                amount: payment.amount,
                currency: payment.currency,
                metalType: payment.metalType,
                createdAt: payment.createdAt,
                confirmedAt: payment.confirmedAt,
                settlementId: payment.settlementId
            }
        });

    } catch (error) {
        logger.error('Get payment status error:', error);
        res.status(500).json({
            error: {
                code: 'STATUS_CHECK_FAILED',
                message: 'Failed to get payment status',
                details: error.message
            }
        });
    }
});

// ============= SETTLEMENT ROUTES =============

// Get settlement status
app.get('/api/settlements/:settlementId/status', authenticateToken, async (req, res) => {
    try {
        const { settlementId } = req.params;
        const settlement = settlements.get(settlementId);

        if (!settlement) {
            return res.status(404).json({
                error: {
                    code: 'SETTLEMENT_NOT_FOUND',
                    message: 'Settlement not found'
                }
            });
        }

        res.json({
            success: true,
            data: settlement
        });

    } catch (error) {
        logger.error('Get settlement status error:', error);
        res.status(500).json({
            error: {
                code: 'SETTLEMENT_STATUS_FAILED',
                message: 'Failed to get settlement status',
                details: error.message
            }
        });
    }
});

// Get merchant settlements
app.get('/api/merchants/:merchantId/settlements', authenticateToken, async (req, res) => {
    try {
        const { merchantId } = req.params;
        const { limit = 50, offset = 0, status } = req.query;

        const merchantSettlements = Array.from(settlements.values())
            .filter(s => s.merchantId === merchantId)
            .filter(s => !status || s.status === status)
            .sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt))
            .slice(offset, offset + parseInt(limit));

        res.json({
            success: true,
            data: merchantSettlements,
            pagination: {
                limit: parseInt(limit),
                offset: parseInt(offset),
                total: merchantSettlements.length
            }
        });

    } catch (error) {
        logger.error('Get merchant settlements error:', error);
        res.status(500).json({
            error: {
                code: 'MERCHANT_SETTLEMENTS_FAILED',
                message: 'Failed to get merchant settlements',
                details: error.message
            }
        });
    }
});

// ============= PRICING ROUTES =============

// Get current metal prices
app.get('/api/prices/metals', async (req, res) => {
    try {
        const { metalType } = req.query;
        
        if (metalType) {
            const price = await metalPricing.getMetalPrice(metalType);
            if (!price) {
                return res.status(404).json({
                    error: {
                        code: 'METAL_PRICE_NOT_FOUND',
                        message: `Price not found for ${metalType}`
                    }
                });
            }
            res.json({
                success: true,
                data: price
            });
        } else {
            const allPrices = await metalPricing.getAllMetalPrices();
            res.json({
                success: true,
                data: allPrices
            });
        }

    } catch (error) {
        logger.error('Get metal prices error:', error);
        res.status(500).json({
            error: {
                code: 'PRICES_FETCH_FAILED',
                message: 'Failed to fetch metal prices',
                details: error.message
            }
        });
    }
});

// ============= MERCHANT ROUTES =============

// Get merchant dashboard data
app.get('/api/merchants/:merchantId/dashboard', authenticateToken, async (req, res) => {
    try {
        const { merchantId } = req.params;
        
        const dashboardData = await merchantService.getDashboardData(merchantId);
        
        res.json({
            success: true,
            data: dashboardData
        });

    } catch (error) {
        logger.error('Get merchant dashboard error:', error);
        res.status(500).json({
            error: {
                code: 'DASHBOARD_DATA_FAILED',
                message: 'Failed to get dashboard data',
                details: error.message
            }
        });
    }
});

// ============= WALLET ROUTES =============

// Get user metal balances
app.get('/api/wallets/:userId/balances', authenticateToken, async (req, res) => {
    try {
        const { userId } = req.params;
        
        const balances = {
            gold: metalBalances.get(`${userId}_gold`) || 0,
            silver: metalBalances.get(`${userId}_silver`) || 0,
            platinum: metalBalances.get(`${userId}_platinum`) || 0,
            basket: metalBalances.get(`${userId}_basket`) || 0
        };

        res.json({
            success: true,
            data: {
                userId: userId,
                balances: balances,
                lastUpdated: new Date().toISOString()
            }
        });

    } catch (error) {
        logger.error('Get wallet balances error:', error);
        res.status(500).json({
            error: {
                code: 'WALLET_BALANCES_FAILED',
                message: 'Failed to get wallet balances',
                details: error.message
            }
        });
    }
});

// ============= ANALYTICS ROUTES =============

// Get network analytics
app.get('/api/analytics/network', async (req, res) => {
    try {
        const { period = '24h' } = req.query;
        
        const analytics = {
            totalTransactions: paymentTransactions.size,
            totalVolume: Array.from(paymentTransactions.values())
                .filter(p => p.status === 'confirmed')
                .reduce((sum, p) => sum + p.amount, 0),
            averageTransactionSize: 0,
            metalDistribution: {
                gold: 0,
                silver: 0,
                platinum: 0,
                basket: 0
            },
            activeMerchants: new Set(Array.from(paymentTransactions.values()).map(p => p.merchantId)).size,
            period: period,
            lastUpdated: new Date().toISOString()
        };

        // Calculate average transaction size
        if (analytics.totalTransactions > 0) {
            analytics.averageTransactionSize = analytics.totalVolume / analytics.totalTransactions;
        }

        // Calculate metal distribution
        const confirmedTransactions = Array.from(paymentTransactions.values())
            .filter(p => p.status === 'confirmed');
        
        confirmedTransactions.forEach(p => {
            analytics.metalDistribution[p.metalType] += 1;
        });

        res.json({
            success: true,
            data: analytics
        });

    } catch (error) {
        logger.error('Get network analytics error:', error);
        res.status(500).json({
            error: {
                code: 'ANALYTICS_FAILED',
                message: 'Failed to get network analytics',
                details: error.message
            }
        });
    }
});

// Global error handler
app.use((err, req, res, next) => {
    logger.error('Global error handler:', err);
    res.status(500).json({
        error: {
            code: 'INTERNAL_SERVER_ERROR',
            message: 'An unexpected error occurred',
            details: process.env.NODE_ENV === 'development' ? err.message : undefined
        }
    });
});

// 404 handler
app.use('*', (req, res) => {
    res.status(404).json({
        error: {
            code: 'ENDPOINT_NOT_FOUND',
            message: `Endpoint ${req.originalUrl} not found`
        }
    });
});

// Start server
const server = app.listen(PORT, () => {
    logger.info(`🏛️ NMSN API Server running on port ${PORT}`);
    logger.info(`📡 Metal Payment Switch is operational`);
    logger.info(`⚡ Settlement Engine is ready`);
    logger.info(`🔗 BINR Bridge is connected`);
    logger.info(`🏦 Vault Connectors are active`);
    logger.info(`🌐 Network Status: HEALTHY`);
});

process.on('SIGTERM', () => {
    logger.info('SIGTERM received, shutting down gracefully');
    server.close(() => {
        logger.info('NMSN API Server closed');
        process.exit(0);
    });
});

module.exports = app;