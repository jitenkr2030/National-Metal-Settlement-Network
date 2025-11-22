/**
 * Metal Pricing Service
 * Integrates with BGT, BST, BPT infrastructure and external price feeds
 */

const axios = require('axios');
const winston = require('winston');

const logger = winston.createLogger({
    level: 'info',
    format: winston.format.combine(
        winston.format.timestamp(),
        winston.format.json()
    ),
    transports: [
        new winston.transports.File({ filename: 'logs/metal-pricing.log' }),
        new winston.transports.Console()
    ]
});

class MetalPricingService {
    constructor() {
        this.priceCache = new Map();
        this.lastUpdate = new Map();
        this.cacheTimeout = 30000; // 30 seconds
        
        // Price feed sources
        this.priceSources = {
            gold: [
                'https://api.metals.live/v1/spot/gold', // Metals Live API
                'https://api.coingecko.com/api/v3/simple/price?ids=tether-gold&vs_currencies=inr', // CoinGecko backup
            ],
            silver: [
                'https://api.metals.live/v1/spot/silver',
                'https://api.coingecko.com/api/v3/simple/price?ids=silver&vs_currencies=inr',
            ],
            platinum: [
                'https://api.metals.live/v1/spot/platinum',
                'https://api.coingecko.com/api/v3/simple/price?ids=platinum&vs_currencies=inr',
            ]
        };

        // Default prices (fallback values)
        this.defaultPrices = {
            gold: {
                price: 6956.50, // INR per gram
                currency: 'INR',
                unit: 'gram',
                lastUpdated: new Date().toISOString(),
                source: 'default'
            },
            silver: {
                price: 82.75, // INR per gram
                currency: 'INR',
                unit: 'gram',
                lastUpdated: new Date().toISOString(),
                source: 'default'
            },
            platinum: {
                price: 2845.20, // INR per gram
                currency: 'INR',
                unit: 'gram',
                lastUpdated: new Date().toISOString(),
                source: 'default'
            },
            basket: {
                price: 2800.00, // INR per unit (weighted basket)
                currency: 'INR',
                unit: 'unit',
                lastUpdated: new Date().toISOString(),
                source: 'calculated'
            }
        };
    }

    /**
     * Get current price for a specific metal
     */
    async getMetalPrice(metalType) {
        try {
            // Check cache first
            const cached = this.priceCache.get(metalType);
            const lastUpdate = this.lastUpdate.get(metalType);
            
            if (cached && lastUpdate && (Date.now() - lastUpdate) < this.cacheTimeout) {
                return cached;
            }

            // Fetch fresh price
            let priceData = await this.fetchMetalPrice(metalType);
            
            // Update cache
            this.priceCache.set(metalType, priceData);
            this.lastUpdate.set(metalType, Date.now());
            
            logger.info(`Updated ${metalType} price: ₹${priceData.price}`);
            return priceData;

        } catch (error) {
            logger.error(`Failed to fetch ${metalType} price:`, error);
            
            // Return cached price or default
            const cached = this.priceCache.get(metalType);
            if (cached) {
                logger.warn(`Using cached ${metalType} price`);
                return cached;
            }
            
            // Use default price as fallback
            logger.warn(`Using default ${metalType} price`);
            return this.defaultPrices[metalType] || null;
        }
    }

    /**
     * Fetch metal price from multiple sources
     */
    async fetchMetalPrice(metalType) {
        const sources = this.priceSources[metalType];
        if (!sources) {
            throw new Error(`No price sources available for ${metalType}`);
        }

        for (const sourceUrl of sources) {
            try {
                const response = await axios.get(sourceUrl, {
                    timeout: 5000,
                    headers: {
                        'User-Agent': 'NMSN/1.0'
                    }
                });

                const price = this.parsePriceResponse(metalType, response.data);
                if (price && price.price > 0) {
                    return {
                        ...price,
                        source: sourceUrl,
                        timestamp: new Date().toISOString()
                    };
                }
            } catch (error) {
                logger.warn(`Price source failed for ${metalType}:`, error.message);
                continue;
            }
        }

        throw new Error(`All price sources failed for ${metalType}`);
    }

    /**
     * Parse price response from different APIs
     */
    parsePriceResponse(metalType, data) {
        try {
            // Handle Metals Live API format
            if (data.rates && data.rates.INR) {
                const price = data.rates.INR;
                return {
                    price: price,
                    currency: 'INR',
                    unit: 'gram',
                    timestamp: new Date().toISOString(),
                    source: 'metals.live'
                };
            }

            // Handle CoinGecko format
            if (data[`tether-gold`] && data[`tether-gold`].inr) {
                return {
                    price: data[`tether-gold`].inr,
                    currency: 'INR',
                    unit: 'gram',
                    timestamp: new Date().toISOString(),
                    source: 'coingecko'
                };
            }

            if (data.silver && data.silver.inr) {
                return {
                    price: data.silver.inr,
                    currency: 'INR',
                    unit: 'gram',
                    timestamp: new Date().toISOString(),
                    source: 'coingecko'
                };
            }

            if (data.platinum && data.platinum.inr) {
                return {
                    price: data.platinum.inr,
                    currency: 'INR',
                    unit: 'gram',
                    timestamp: new Date().toISOString(),
                    source: 'coingecko'
                };
            }

            // Handle direct price format
            if (typeof data === 'number') {
                return {
                    price: data,
                    currency: 'INR',
                    unit: 'gram',
                    timestamp: new Date().toISOString(),
                    source: 'direct'
                };
            }

            return null;

        } catch (error) {
            logger.error('Error parsing price response:', error);
            return null;
        }
    }

    /**
     * Get prices for all metals
     */
    async getAllMetalPrices() {
        const metals = ['gold', 'silver', 'platinum', 'basket'];
        const prices = {};

        for (const metal of metals) {
            try {
                prices[metal] = await this.getMetalPrice(metal);
            } catch (error) {
                logger.error(`Failed to get ${metal} price:`, error);
                prices[metal] = this.defaultPrices[metal];
            }
        }

        return prices;
    }

    /**
     * Calculate metal quantity from amount
     */
    calculateMetalQuantity(amount, metalType, metalPrice) {
        if (!amount || !metalPrice || metalPrice.price <= 0) {
            throw new Error('Invalid amount or metal price');
        }

        return amount / metalPrice.price;
    }

    /**
     * Calculate amount from metal quantity
     */
    calculateAmount(metalQuantity, metalType, metalPrice) {
        if (!metalQuantity || !metalPrice || metalPrice.price <= 0) {
            throw new Error('Invalid metal quantity or price');
        }

        return metalQuantity * metalPrice.price;
    }

    /**
     * Get price history (mock implementation)
     */
    async getPriceHistory(metalType, period = '24h') {
        // This would typically fetch from a time-series database
        // For now, return mock data
        const basePrice = this.defaultPrices[metalType].price;
        const now = Date.now();
        const interval = 3600000; // 1 hour in ms
        
        const history = [];
        for (let i = 23; i >= 0; i--) {
            const timestamp = new Date(now - (i * interval)).toISOString();
            const variation = (Math.random() - 0.5) * 0.02; // ±1% variation
            const price = basePrice * (1 + variation);
            
            history.push({
                timestamp,
                price: Math.round(price * 100) / 100,
                currency: 'INR'
            });
        }

        return {
            metalType,
            period,
            history
        };
    }

    /**
     * Convert between different metals
     */
    async convertMetal(fromMetal, toMetal, quantity) {
        try {
            const fromPrice = await this.getMetalPrice(fromMetal);
            const toPrice = await this.getMetalPrice(toMetal);

            if (!fromPrice || !toPrice) {
                throw new Error('Price data not available for conversion');
            }

            // Convert to INR first, then to target metal
            const inrValue = quantity * fromPrice.price;
            const convertedQuantity = inrValue / toPrice.price;

            return {
                fromMetal,
                toMetal,
                fromQuantity: quantity,
                toQuantity: Math.round(convertedQuantity * 1000) / 1000,
                conversionRate: toPrice.price / fromPrice.price,
                timestamp: new Date().toISOString()
            };

        } catch (error) {
            logger.error('Metal conversion error:', error);
            throw error;
        }
    }

    /**
     * Calculate basket price based on weighted metals
     */
    async calculateBasketPrice(weights = { gold: 0.7, silver: 0.2, platinum: 0.1 }) {
        try {
            const prices = await this.getAllMetalPrices();
            let totalPrice = 0;

            Object.entries(weights).forEach(([metal, weight]) => {
                if (prices[metal]) {
                    totalPrice += prices[metal].price * weight;
                }
            });

            return {
                price: Math.round(totalPrice * 100) / 100,
                currency: 'INR',
                unit: 'unit',
                weights,
                composition: {
                    gold: `${Math.round(weights.gold * 100)}%`,
                    silver: `${Math.round(weights.silver * 100)}%`,
                    platinum: `${Math.round(weights.platinum * 100)}%`
                },
                timestamp: new Date().toISOString(),
                source: 'calculated'
            };

        } catch (error) {
            logger.error('Basket price calculation error:', error);
            return this.defaultPrices.basket;
        }
    }

    /**
     * Health check for pricing service
     */
    async healthCheck() {
        try {
            const prices = await this.getAllMetalPrices();
            const issues = [];

            Object.entries(prices).forEach(([metal, price]) => {
                if (!price || price.price <= 0) {
                    issues.push(`${metal}: Invalid price data`);
                }
                
                if (price.source === 'default') {
                    issues.push(`${metal}: Using default/fallback price`);
                }
            });

            return {
                status: issues.length === 0 ? 'healthy' : 'degraded',
                issues,
                lastUpdate: new Date().toISOString(),
                cacheSize: this.priceCache.size
            };

        } catch (error) {
            return {
                status: 'unhealthy',
                error: error.message,
                timestamp: new Date().toISOString()
            };
        }
    }
}

module.exports = new MetalPricingService();