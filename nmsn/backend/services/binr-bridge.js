/**
 * BINR Bridge Service
 * Integration with existing BINR stablecoin infrastructure
 */

const axios = require('axios');
const { v4: uuidv4 } = require('uuid');
const winston = require('winston');

const logger = winston.createLogger({
    level: 'info',
    format: winston.format.combine(
        winston.format.timestamp(),
        winston.format.json()
    ),
    transports: [
        new winston.transports.File({ filename: 'logs/binr-bridge.log' }),
        new winston.transports.Console()
    ]
});

class BinrBridge {
    constructor() {
        this.binrApiBaseUrl = process.env.BINR_API_URL || 'http://localhost:3002/api';
        this.networkId = process.env.BINR_NETWORK_ID || 'indi-chain';
        this.contractAddress = process.env.BINR_CONTRACT_ADDRESS || '0x1234567890123456789012345678901234567890';
        
        // Transaction tracking
        this.pendingTransactions = new Map();
        this.completedTransactions = new Map();
        
        // Rate limiting
        this.rateLimit = {
            maxRequests: 100,
            windowMs: 60000, // 1 minute
            requests: []
        };
    }

    /**
     * Check rate limit
     */
    checkRateLimit() {
        const now = Date.now();
        this.rateLimit.requests = this.rateLimit.requests.filter(
            time => now - time < this.rateLimit.windowMs
        );

        if (this.rateLimit.requests.length >= this.rateLimit.maxRequests) {
            throw new Error('Rate limit exceeded');
        }

        this.rateLimit.requests.push(now);
    }

    /**
     * Make authenticated request to BINR API
     */
    async makeBinrRequest(endpoint, method = 'GET', data = null) {
        this.checkRateLimit();

        try {
            const config = {
                method,
                url: `${this.binrApiBaseUrl}${endpoint}`,
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${this.getAuthToken()}`,
                    'X-NMSN-Client': 'nmsn-settlement-engine'
                },
                timeout: 30000
            };

            if (data) {
                config.data = data;
            }

            const response = await axios(config);
            return response.data;

        } catch (error) {
            logger.error(`BINR API request failed: ${endpoint}`, {
                status: error.response?.status,
                message: error.message,
                data: error.response?.data
            });

            if (error.response?.status === 401) {
                throw new Error('BINR API authentication failed');
            }

            throw new Error(`BINR API error: ${error.message}`);
        }
    }

    /**
     * Get authentication token for BINR API
     */
    getAuthToken() {
        // In production, this would fetch a valid JWT token
        // For development, return a mock token
        return process.env.BINR_API_TOKEN || 'mock-binr-token';
    }

    /**
     * Mint BINR tokens
     */
    async mintBinr({ amount, currency, purpose, metadata }) {
        try {
            logger.info(`Minting BINR tokens: ${amount} ${currency}`);

            const mintRequest = {
                amount: parseFloat(amount),
                currency: currency || 'INR',
                purpose: purpose || 'nmsn-settlement',
                metadata: {
                    ...metadata,
                    timestamp: new Date().toISOString(),
                    client: 'nmsn'
                },
                recipient: 'nmsn_system',
                networkId: this.networkId
            };

            // Make request to BINR minting endpoint
            const response = await this.makeBinrRequest('/binr/mint', 'POST', mintRequest);

            if (!response.success) {
                throw new Error(response.error?.message || 'BINR minting failed');
            }

            const result = {
                transactionHash: response.data.transactionHash,
                blockNumber: response.data.blockNumber,
                amount: response.data.amount,
                currency: response.data.currency,
                status: response.data.status,
                mintedAt: new Date().toISOString(),
                gasUsed: response.data.gasUsed,
                gasPrice: response.data.gasPrice
            };

            // Track transaction
            this.pendingTransactions.set(result.transactionHash, {
                ...result,
                type: 'mint',
                metadata: mintRequest
            });

            logger.info(`BINR minting successful: ${result.transactionHash}`);
            return result;

        } catch (error) {
            logger.error('BINR minting failed:', error);
            throw new Error(`Failed to mint BINR: ${error.message}`);
        }
    }

    /**
     * Transfer BINR tokens
     */
    async transferBinr({ from, to, amount, purpose, metadata }) {
        try {
            logger.info(`Transferring BINR: ${amount} from ${from} to ${to}`);

            const transferRequest = {
                from,
                to,
                amount: parseFloat(amount),
                purpose: purpose || 'nmsn-settlement',
                metadata: {
                    ...metadata,
                    timestamp: new Date().toISOString(),
                    client: 'nmsn'
                },
                networkId: this.networkId,
                gasPrice: 'auto'
            };

            // Make request to BINR transfer endpoint
            const response = await this.makeBinrRequest('/binr/transfer', 'POST', transferRequest);

            if (!response.success) {
                throw new Error(response.error?.message || 'BINR transfer failed');
            }

            const result = {
                transactionHash: response.data.transactionHash,
                blockNumber: response.data.blockNumber,
                from: response.data.from,
                to: response.data.to,
                amount: response.data.amount,
                status: response.data.status,
                transferredAt: new Date().toISOString(),
                gasUsed: response.data.gasUsed,
                gasPrice: response.data.gasPrice,
                confirmations: response.data.confirmations || 0
            };

            // Track transaction
            this.pendingTransactions.set(result.transactionHash, {
                ...result,
                type: 'transfer',
                metadata: transferRequest
            });

            logger.info(`BINR transfer successful: ${result.transactionHash}`);
            return result;

        } catch (error) {
            logger.error('BINR transfer failed:', error);
            throw new Error(`Failed to transfer BINR: ${error.message}`);
        }
    }

    /**
     * Get BINR balance for an address
     */
    async getBinrBalance(address) {
        try {
            const response = await this.makeBinrRequest(`/binr/balance/${address}`);

            if (!response.success) {
                throw new Error(response.error?.message || 'Failed to get BINR balance');
            }

            return {
                address,
                balance: parseFloat(response.data.balance),
                currency: response.data.currency,
                lastUpdated: response.data.lastUpdated,
                pendingTransactions: response.data.pending || 0
            };

        } catch (error) {
            logger.error(`Failed to get BINR balance for ${address}:`, error);
            throw new Error(`Failed to get balance: ${error.message}`);
        }
    }

    /**
     * Burn BINR tokens
     */
    async burnBinr({ amount, purpose, metadata, from = 'nmsn_system' }) {
        try {
            logger.info(`Burning BINR tokens: ${amount}`);

            const burnRequest = {
                from,
                amount: parseFloat(amount),
                purpose: purpose || 'nmsn-redemption',
                metadata: {
                    ...metadata,
                    timestamp: new Date().toISOString(),
                    client: 'nmsn'
                },
                networkId: this.networkId
            };

            // Make request to BINR burn endpoint
            const response = await this.makeBinrRequest('/binr/burn', 'POST', burnRequest);

            if (!response.success) {
                throw new Error(response.error?.message || 'BINR burn failed');
            }

            const result = {
                transactionHash: response.data.transactionHash,
                blockNumber: response.data.blockNumber,
                amount: response.data.amount,
                status: response.data.status,
                burnedAt: new Date().toISOString(),
                gasUsed: response.data.gasUsed,
                gasPrice: response.data.gasPrice
            };

            // Track transaction
            this.pendingTransactions.set(result.transactionHash, {
                ...result,
                type: 'burn',
                metadata: burnRequest
            });

            logger.info(`BINR burn successful: ${result.transactionHash}`);
            return result;

        } catch (error) {
            logger.error('BINR burn failed:', error);
            throw new Error(`Failed to burn BINR: ${error.message}`);
        }
    }

    /**
     * Get transaction status
     */
    async getTransactionStatus(transactionHash) {
        try {
            const response = await this.makeBinrRequest(`/binr/transaction/${transactionHash}`);

            if (!response.success) {
                throw new Error(response.error?.message || 'Transaction not found');
            }

            const transaction = response.data;

            // Move to completed if confirmed
            if (transaction.status === 'confirmed' || transaction.status === 'success') {
                this.completedTransactions.set(transactionHash, transaction);
                this.pendingTransactions.delete(transactionHash);
            }

            return transaction;

        } catch (error) {
            logger.error(`Failed to get transaction status: ${transactionHash}`, error);
            throw new Error(`Failed to get transaction status: ${error.message}`);
        }
    }

    /**
     * Convert BINR to INR (bank settlement)
     */
    async convertToINR({ binrAmount, bankAccount, purpose, reference }) {
        try {
            logger.info(`Converting BINR to INR: ${binrAmount}`);

            const conversionRequest = {
                amount: parseFloat(binrAmount),
                currency: 'INR',
                bankAccount,
                purpose: purpose || 'nmsn-settlement',
                reference: reference || `NMSN_CONV_${Date.now()}`,
                networkId: this.networkId,
                metadata: {
                    timestamp: new Date().toISOString(),
                    client: 'nmsn'
                }
            };

            // Make request to BINR- INR conversion endpoint
            const response = await this.makeBinrRequest('/binr/convert/inr', 'POST', conversionRequest);

            if (!response.success) {
                throw new Error(response.error?.message || 'BINR to INR conversion failed');
            }

            const result = {
                conversionId: response.data.conversionId,
                binrAmount: response.data.binrAmount,
                inrAmount: response.data.inrAmount,
                exchangeRate: response.data.exchangeRate,
                bankReference: response.data.bankReference,
                utr: response.data.utr,
                status: response.data.status,
                estimatedSettlement: response.data.estimatedSettlement,
                fees: response.data.fees
            };

            logger.info(`BINR to INR conversion successful: ${result.conversionId}`);
            return result;

        } catch (error) {
            logger.error('BINR to INR conversion failed:', error);
            throw new Error(`Failed to convert BINR to INR: ${error.message}`);
        }
    }

    /**
     * Get current BINR exchange rate
     */
    async getExchangeRate() {
        try {
            const response = await this.makeBinrRequest('/binr/exchange-rate');

            if (!response.success) {
                throw new Error(response.error?.message || 'Failed to get exchange rate');
            }

            return {
                binrToInr: parseFloat(response.data.binrToInr),
                lastUpdated: response.data.lastUpdated,
                source: response.data.source,
                spread: response.data.spread || 0.001
            };

        } catch (error) {
            logger.error('Failed to get BINR exchange rate:', error);
            // Return fallback rate
            return {
                binrToInr: 1.0,
                lastUpdated: new Date().toISOString(),
                source: 'fallback'
            };
        }
    }

    /**
     * Get network statistics
     */
    async getNetworkStats() {
        try {
            const response = await this.makeBinrRequest('/binr/network/stats');

            if (!response.success) {
                throw new Error(response.error?.message || 'Failed to get network stats');
            }

            return {
                totalSupply: parseFloat(response.data.totalSupply),
                circulatingSupply: parseFloat(response.data.circulatingSupply),
                activeAddresses: response.data.activeAddresses,
                transactionCount: response.data.transactionCount,
                lastBlockNumber: response.data.lastBlockNumber,
                gasPrice: response.data.gasPrice,
                networkHashRate: response.data.networkHashRate,
                blockTime: response.data.blockTime
            };

        } catch (error) {
            logger.error('Failed to get network stats:', error);
            throw new Error(`Failed to get network stats: ${error.message}`);
        }
    }

    /**
     * Validate address format
     */
    isValidAddress(address) {
        // Basic validation for INDI Chain addresses
        // In production, this would use proper address validation
        return /^0x[a-fA-F0-9]{40}$/.test(address) || 
               /^[a-zA-Z0-9]{10,50}$/.test(address);
    }

    /**
     * Get transaction history for an address
     */
    async getTransactionHistory(address, limit = 50, offset = 0) {
        try {
            const response = await this.makeBinrRequest(
                `/binr/transactions/${address}?limit=${limit}&offset=${offset}`
            );

            if (!response.success) {
                throw new Error(response.error?.message || 'Failed to get transaction history');
            }

            return {
                transactions: response.data.transactions.map(tx => ({
                    ...tx,
                    amount: parseFloat(tx.amount),
                    gasUsed: parseInt(tx.gasUsed),
                    gasPrice: parseInt(tx.gasPrice)
                })),
                pagination: response.data.pagination,
                total: response.data.total
            };

        } catch (error) {
            logger.error(`Failed to get transaction history for ${address}:`, error);
            throw new Error(`Failed to get transaction history: ${error.message}`);
        }
    }

    /**
     * Health check for BINR bridge
     */
    async healthCheck() {
        try {
            // Test basic connectivity
            const stats = await this.getNetworkStats();
            
            return {
                status: 'healthy',
                connected: true,
                networkStats: stats,
                pendingTransactions: this.pendingTransactions.size,
                lastCheck: new Date().toISOString()
            };

        } catch (error) {
            return {
                status: 'unhealthy',
                connected: false,
                error: error.message,
                lastCheck: new Date().toISOString()
            };
        }
    }
}

module.exports = new BinrBridge();