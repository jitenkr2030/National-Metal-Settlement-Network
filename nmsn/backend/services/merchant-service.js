/**
 * Merchant Service
 * Manages merchant onboarding, dashboard data, and settlements
 */

const { v4: uuidv4 } = require('uuid');
const winston = require('winston');
const axios = require('axios');

const logger = winston.createLogger({
    level: 'info',
    format: winston.format.combine(
        winston.format.timestamp(),
        winston.format.json()
    ),
    transports: [
        new winston.transports.File({ filename: 'logs/merchant-service.log' }),
        new winston.transports.Console()
    ]
});

class MerchantService {
    constructor() {
        this.merchants = new Map();
        this.settlements = new Map();
        this.dailyReports = new Map();
        
        // Initialize with sample merchant data
        this.initializeSampleData();
    }

    /**
     * Initialize sample merchant data for testing
     */
    initializeSampleData() {
        const sampleMerchants = [
            {
                id: 'merchant_001',
                name: 'Tanishq Store - MG Road',
                email: 'tanishq.mgrow@jewellery.com',
                phone: '+91-9876543210',
                category: 'Jewelry',
                kycStatus: 'verified',
                settlementPreference: 'instant',
                bankDetails: {
                    accountNumber: '12345678901234',
                    ifscCode: 'HDFC0001234',
                    bankName: 'HDFC Bank'
                },
                metalWallets: {
                    binr: '0x123...merchant001',
                    gold: '0x456...gold001',
                    silver: '0x789...silver001'
                },
                createdAt: '2024-01-15T00:00:00Z',
                lastActive: new Date().toISOString()
            },
            {
                id: 'merchant_002',
                name: 'Kalyan Jewellers - Chennai',
                email: 'kalyan.chennai@jewellery.com',
                phone: '+91-8765432109',
                category: 'Jewelry',
                kycStatus: 'verified',
                settlementPreference: 'daily',
                bankDetails: {
                    accountNumber: '98765432109876',
                    ifscCode: 'ICIC0001234',
                    bankName: 'ICICI Bank'
                },
                metalWallets: {
                    binr: '0xabc...merchant002',
                    gold: '0xdef...gold002',
                    silver: '0xghi...silver002'
                },
                createdAt: '2024-02-10T00:00:00Z',
                lastActive: new Date().toISOString()
            },
            {
                id: 'merchant_003',
                name: 'Digital Electronics Store',
                email: 'sales@digitalelectronics.com',
                phone: '+91-7654321098',
                category: 'Electronics',
                kycStatus: 'verified',
                settlementPreference: 'instant',
                bankDetails: {
                    accountNumber: '54321098765432',
                    ifscCode: 'SBIN0001234',
                    bankName: 'State Bank of India'
                },
                metalWallets: {
                    binr: '0xjkl...merchant003',
                    gold: '0xmno...gold003',
                    silver: '0xpqr...silver003'
                },
                createdAt: '2024-03-05T00:00:00Z',
                lastActive: new Date().toISOString()
            }
        ];

        sampleMerchants.forEach(merchant => {
            this.merchants.set(merchant.id, merchant);
        });

        logger.info(`Initialized ${this.merchants.size} sample merchants`);
    }

    /**
     * Get merchant dashboard data
     */
    async getDashboardData(merchantId) {
        try {
            const merchant = this.merchants.get(merchantId);
            if (!merchant) {
                throw new Error('Merchant not found');
            }

            // Get settlement data
            const merchantSettlements = Array.from(this.settlements.values())
                .filter(s => s.merchantId === merchantId);

            // Calculate metrics
            const today = new Date();
            const startOfDay = new Date(today.getFullYear(), today.getMonth(), today.getDate());
            
            const todaySettlements = merchantSettlements.filter(s => 
                new Date(s.createdAt) >= startOfDay
            );

            const thisMonth = new Date(today.getFullYear(), today.getMonth(), 1);
            const monthSettlements = merchantSettlements.filter(s => 
                new Date(s.createdAt) >= thisMonth
            );

            const dashboardData = {
                merchant: {
                    id: merchant.id,
                    name: merchant.name,
                    category: merchant.category,
                    kycStatus: merchant.kycStatus,
                    settlementPreference: merchant.settlementPreference,
                    memberSince: merchant.createdAt,
                    lastActive: merchant.lastActive
                },
                summary: {
                    totalTransactions: merchantSettlements.length,
                    todayTransactions: todaySettlements.length,
                    monthTransactions: monthSettlements.length,
                    totalVolume: this.calculateTotalVolume(merchantSettlements),
                    todayVolume: this.calculateTotalVolume(todaySettlements),
                    monthVolume: this.calculateTotalVolume(monthSettlements),
                    totalFees: this.calculateTotalFees(merchantSettlements)
                },
                recentTransactions: this.getRecentTransactions(merchantSettlements, 10),
                settlements: {
                    pending: this.getPendingSettlements(merchantId),
                    completed: this.getCompletedSettlements(merchantId, 5),
                    scheduled: this.getScheduledSettlements(merchantId)
                },
                analytics: {
                    metalDistribution: this.getMetalDistribution(monthSettlements),
                    dailyVolume: this.getDailyVolume(monthSettlements),
                    averageTransactionSize: this.getAverageTransactionSize(monthSettlements),
                    growthRate: this.calculateGrowthRate(merchantSettlements)
                },
                alerts: this.getMerchantAlerts(merchantId),
                lastUpdated: new Date().toISOString()
            };

            return dashboardData;

        } catch (error) {
            logger.error(`Failed to get dashboard data for merchant ${merchantId}:`, error);
            throw error;
        }
    }

    /**
     * Calculate total volume for settlements
     */
    calculateTotalVolume(settlements) {
        return settlements.reduce((sum, settlement) => sum + settlement.originalAmount, 0);
    }

    /**
     * Calculate total fees for settlements
     */
    calculateTotalFees(settlements) {
        return settlements.reduce((sum, settlement) => sum + (settlement.fees?.totalFees || 0), 0);
    }

    /**
     * Get recent transactions
     */
    getRecentTransactions(settlements, limit) {
        return settlements
            .sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt))
            .slice(0, limit)
            .map(settlement => ({
                id: settlement.id,
                type: 'payment',
                amount: settlement.originalAmount,
                currency: settlement.currency,
                metalType: settlement.metalType,
                metalQuantity: settlement.metalQuantity,
                status: settlement.status,
                fees: settlement.fees,
                createdAt: settlement.createdAt,
                customerId: settlement.customerId
            }));
    }

    /**
     * Get pending settlements
     */
    getPendingSettlements(merchantId) {
        return Array.from(this.settlements.values())
            .filter(s => s.merchantId === merchantId && s.status === 'pending')
            .map(settlement => ({
                id: settlement.id,
                amount: settlement.originalAmount,
                currency: settlement.currency,
                metalType: settlement.metalType,
                createdAt: settlement.createdAt,
                estimatedSettlement: this.calculateEstimatedSettlement(settlement)
            }));
    }

    /**
     * Get completed settlements
     */
    getCompletedSettlements(merchantId, limit) {
        return Array.from(this.settlements.values())
            .filter(s => s.merchantId === merchantId && s.status === 'completed')
            .sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt))
            .slice(0, limit)
            .map(settlement => ({
                id: settlement.id,
                amount: settlement.originalAmount,
                currency: settlement.currency,
                netAmount: settlement.originalAmount - (settlement.fees?.totalFees || 0),
                metalType: settlement.metalType,
                completedAt: settlement.timestamps?.completed,
                utr: settlement.inrSettlement?.utr
            }));
    }

    /**
     * Get scheduled settlements
     */
    getScheduledSettlements(merchantId) {
        // This would typically come from a scheduling system
        return [
            {
                id: 'scheduled_001',
                type: 'daily_settlement',
                amount: 150000,
                currency: 'INR',
                scheduledAt: new Date(Date.now() + 86400000).toISOString(), // Tomorrow
                status: 'scheduled'
            },
            {
                id: 'scheduled_002',
                type: 'weekly_settlement',
                amount: 750000,
                currency: 'INR',
                scheduledAt: new Date(Date.now() + 7 * 86400000).toISOString(), // Next week
                status: 'scheduled'
            }
        ];
    }

    /**
     * Calculate estimated settlement time
     */
    calculateEstimatedSettlement(settlement) {
        // Simple estimation based on settlement type
        if (settlement.settlementType === 'instant') {
            return new Date(Date.now() + 2000).toISOString(); // 2 seconds
        } else if (settlement.settlementType === 'daily') {
            return new Date(Date.now() + 86400000).toISOString(); // 24 hours
        } else {
            return new Date(Date.now() + 3600000).toISOString(); // 1 hour default
        }
    }

    /**
     * Get metal distribution
     */
    getMetalDistribution(settlements) {
        const distribution = {};
        const total = settlements.length;

        settlements.forEach(settlement => {
            distribution[settlement.metalType] = (distribution[settlement.metalType] || 0) + 1;
        });

        // Convert to percentages
        Object.keys(distribution).forEach(metal => {
            distribution[metal] = {
                count: distribution[metal],
                percentage: total > 0 ? Math.round((distribution[metal] / total) * 100) : 0
            };
        });

        return distribution;
    }

    /**
     * Get daily volume data
     */
    getDailyVolume(settlements) {
        const dailyData = {};
        
        settlements.forEach(settlement => {
            const date = new Date(settlement.createdAt).toISOString().split('T')[0];
            dailyData[date] = (dailyData[date] || 0) + settlement.originalAmount;
        });

        return Object.entries(dailyData)
            .map(([date, volume]) => ({ date, volume }))
            .sort((a, b) => new Date(a.date) - new Date(b.date));
    }

    /**
     * Calculate average transaction size
     */
    getAverageTransactionSize(settlements) {
        if (settlements.length === 0) return 0;
        
        const totalVolume = settlements.reduce((sum, s) => sum + s.originalAmount, 0);
        return totalVolume / settlements.length;
    }

    /**
     * Calculate growth rate
     */
    calculateGrowthRate(settlements) {
        const now = new Date();
        const thirtyDaysAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
        const sixtyDaysAgo = new Date(now.getTime() - 60 * 24 * 60 * 60 * 1000);

        const currentPeriod = settlements.filter(s => new Date(s.createdAt) >= thirtyDaysAgo);
        const previousPeriod = settlements.filter(s => 
            new Date(s.createdAt) >= sixtyDaysAgo && new Date(s.createdAt) < thirtyDaysAgo
        );

        const currentVolume = this.calculateTotalVolume(currentPeriod);
        const previousVolume = this.calculateTotalVolume(previousPeriod);

        if (previousVolume === 0) return 100; // 100% growth from zero

        return ((currentVolume - previousVolume) / previousVolume) * 100;
    }

    /**
     * Get merchant alerts
     */
    getMerchantAlerts(merchantId) {
        const alerts = [];
        const merchant = this.merchants.get(merchantId);
        
        if (!merchant) return alerts;

        // Check for settlement delays
        const pendingSettlements = this.getPendingSettlements(merchantId);
        if (pendingSettlements.length > 5) {
            alerts.push({
                type: 'warning',
                title: 'Multiple Pending Settlements',
                message: `You have ${pendingSettlements.length} pending settlements`,
                timestamp: new Date().toISOString()
            });
        }

        // Check for KYC renewal
        const kycExpiryDate = new Date(merchant.createdAt);
        kycExpiryDate.setFullYear(kycExpiryDate.getFullYear() + 1);
        
        if (kycExpiryDate < new Date()) {
            alerts.push({
                type: 'error',
                title: 'KYC Renewal Required',
                message: 'Your KYC documents need renewal',
                timestamp: new Date().toISOString()
            });
        }

        // Check for high transaction volume
        const today = new Date();
        const startOfDay = new Date(today.getFullYear(), today.getMonth(), today.getDate());
        const todaySettlements = Array.from(this.settlements.values())
            .filter(s => s.merchantId === merchantId && new Date(s.createdAt) >= startOfDay);
        
        const todayVolume = this.calculateTotalVolume(todaySettlements);
        if (todayVolume > 1000000) { // ₹10 lakhs
            alerts.push({
                type: 'success',
                title: 'High Transaction Volume',
                message: `Great performance! ₹${(todayVolume / 100000).toFixed(1)}L transactions today`,
                timestamp: new Date().toISOString()
            });
        }

        return alerts;
    }

    /**
     * Register new merchant
     */
    async registerMerchant(merchantData) {
        try {
            const merchantId = `merchant_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
            
            const merchant = {
                id: merchantId,
                ...merchantData,
                kycStatus: 'pending',
                createdAt: new Date().toISOString(),
                lastActive: new Date().toISOString(),
                settlementPreference: 'daily',
                metalWallets: {}
            };

            this.merchants.set(merchantId, merchant);

            logger.info(`New merchant registered: ${merchantId}`);

            return {
                merchantId,
                status: 'registered',
                kycRequired: true,
                onboardingSteps: [
                    'Complete KYC documentation',
                    'Verify bank account',
                    'Setup metal wallets',
                    'Test transaction'
                ]
            };

        } catch (error) {
            logger.error('Merchant registration failed:', error);
            throw error;
        }
    }

    /**
     * Update merchant profile
     */
    async updateMerchant(merchantId, updates) {
        try {
            const merchant = this.merchants.get(merchantId);
            if (!merchant) {
                throw new Error('Merchant not found');
            }

            // Update allowed fields
            const allowedUpdates = ['name', 'email', 'phone', 'category', 'settlementPreference', 'bankDetails'];
            allowedUpdates.forEach(field => {
                if (updates[field] !== undefined) {
                    merchant[field] = updates[field];
                }
            });

            merchant.lastActive = new Date().toISOString();
            this.merchants.set(merchantId, merchant);

            logger.info(`Merchant updated: ${merchantId}`);

            return {
                success: true,
                merchant: merchant,
                updatedAt: merchant.lastActive
            };

        } catch (error) {
            logger.error(`Failed to update merchant ${merchantId}:`, error);
            throw error;
        }
    }

    /**
     * Get merchant list with filters
     */
    getMerchants(filters = {}) {
        let merchants = Array.from(this.merchants.values());

        // Apply filters
        if (filters.category) {
            merchants = merchants.filter(m => m.category === filters.category);
        }

        if (filters.kycStatus) {
            merchants = merchants.filter(m => m.kycStatus === filters.kycStatus);
        }

        if (filters.search) {
            const search = filters.search.toLowerCase();
            merchants = merchants.filter(m => 
                m.name.toLowerCase().includes(search) ||
                m.email.toLowerCase().includes(search) ||
                m.id.toLowerCase().includes(search)
            );
        }

        // Pagination
        const limit = parseInt(filters.limit) || 50;
        const offset = parseInt(filters.offset) || 0;

        return {
            merchants: merchants.slice(offset, offset + limit),
            total: merchants.length,
            limit,
            offset
        };
    }

    /**
     * Get merchant statistics
     */
    getMerchantStatistics() {
        const merchants = Array.from(this.merchants.values());
        
        const stats = {
            total: merchants.length,
            byCategory: {},
            byKycStatus: {},
            bySettlementPreference: {},
            active: 0,
            inactive: 0
        };

        merchants.forEach(merchant => {
            // Category distribution
            stats.byCategory[merchant.category] = (stats.byCategory[merchant.category] || 0) + 1;
            
            // KYC status distribution
            stats.byKycStatus[merchant.kycStatus] = (stats.byKycStatus[merchant.kycStatus] || 0) + 1;
            
            // Settlement preference distribution
            stats.bySettlementPreference[merchant.settlementPreference] = 
                (stats.bySettlementPreference[merchant.settlementPreference] || 0) + 1;
            
            // Activity status
            const lastActive = new Date(merchant.lastActive);
            const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);
            
            if (lastActive >= sevenDaysAgo) {
                stats.active++;
            } else {
                stats.inactive++;
            }
        });

        return stats;
    }

    /**
     * Health check for merchant service
     */
    async healthCheck() {
        try {
            const stats = this.getMerchantStatistics();
            const merchants = Array.from(this.merchants.values());
            const settlements = Array.from(this.settlements.values());

            const issues = [];

            if (stats.total === 0) {
                issues.push('No merchants registered');
            }

            if (stats.byKycStatus.pending > stats.total * 0.5) {
                issues.push('High number of pending KYC verifications');
            }

            return {
                status: issues.length === 0 ? 'healthy' : 'degraded',
                statistics: stats,
                issues,
                lastCheck: new Date().toISOString()
            };

        } catch (error) {
            return {
                status: 'unhealthy',
                error: error.message,
                lastCheck: new Date().toISOString()
            };
        }
    }
}

module.exports = new MerchantService();