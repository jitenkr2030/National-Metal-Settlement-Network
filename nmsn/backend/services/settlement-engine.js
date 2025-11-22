/**
 * Settlement Engine
 * Handles metal-to-BINR-to-INR settlement process
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
        new winston.transports.File({ filename: 'logs/settlement-engine.log' }),
        new winston.transports.Console()
    ]
});

class SettlementEngine {
    constructor() {
        this.activeSettlements = new Map();
        this.settlementHistory = new Map();
        this.processingQueue = [];
        
        // Service dependencies
        this.binrBridge = require('./binr-bridge');
        this.vaultConnector = require('./vault-connector');
        this.complianceEngine = require('./compliance-engine');
        
        // Settlement configuration
        this.config = {
            settlementTimeout: 30000, // 30 seconds
            maxRetries: 3,
            networkFeePercent: 0.002, // 0.2%
            binrConversionFeePercent: 0.001, // 0.1%
            instantSettlementEnabled: true
        };
    }

    /**
     * Initiate settlement for a payment
     */
    async initiateSettlement(payment) {
        try {
            const settlementId = `sett_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
            
            logger.info(`Initiating settlement ${settlementId} for payment ${payment.id}`);

            const settlement = {
                id: settlementId,
                paymentId: payment.id,
                merchantId: payment.merchantId,
                customerId: payment.customerId,
                metalType: payment.metalType,
                metalQuantity: payment.metalQuantity,
                originalAmount: payment.amount,
                currency: payment.currency,
                status: 'initiated',
                createdAt: new Date().toISOString(),
                steps: [],
                fees: {
                    networkFee: 0,
                    conversionFee: 0,
                    totalFees: 0
                },
                timestamps: {
                    initiated: new Date().toISOString()
                }
            };

            // Calculate fees
            settlement.fees.networkFee = payment.amount * this.config.networkFeePercent;
            settlement.fees.conversionFee = payment.amount * this.config.binrConversionFeePercent;
            settlement.fees.totalFees = settlement.fees.networkFee + settlement.fees.conversionFee;

            // Add to active settlements
            this.activeSettlements.set(settlementId, settlement);
            this.processingQueue.push(settlementId);

            // Start settlement process
            this.processSettlement(settlementId);

            return {
                id: settlementId,
                status: 'initiated',
                estimatedTime: '< 2 seconds',
                fees: settlement.fees
            };

        } catch (error) {
            logger.error('Settlement initiation failed:', error);
            throw new Error(`Failed to initiate settlement: ${error.message}`);
        }
    }

    /**
     * Process settlement through the pipeline
     */
    async processSettlement(settlementId) {
        const settlement = this.activeSettlements.get(settlementId);
        if (!settlement) {
            throw new Error(`Settlement ${settlementId} not found`);
        }

        try {
            logger.info(`Processing settlement ${settlementId}`);

            // Step 1: Metal Token Validation & Burning
            await this.step1MetalTokenValidation(settlement);
            
            // Step 2: BINR Minting
            await this.step2BinrMinting(settlement);
            
            // Step 3: Vault Reconciliation
            await this.step3VaultReconciliation(settlement);
            
            // Step 4: Merchant Wallet Credit
            await this.step4MerchantWalletCredit(settlement);
            
            // Step 5: INR Settlement (if instant settlement enabled)
            if (this.config.instantSettlementEnabled) {
                await this.step5INRSettlement(settlement);
            } else {
                settlement.status = 'completed';
                settlement.timestamps.completed = new Date().toISOString();
            }

            // Move to history
            this.settlementHistory.set(settlementId, settlement);
            this.activeSettlements.delete(settlementId);

            // Remove from processing queue
            this.processingQueue = this.processingQueue.filter(id => id !== settlementId);

            logger.info(`Settlement ${settlementId} completed successfully`);

        } catch (error) {
            logger.error(`Settlement ${settlementId} failed:`, error);
            await this.handleSettlementFailure(settlement, error);
        }
    }

    /**
     * Step 1: Validate and burn metal tokens
     */
    async step1MetalTokenValidation(settlement) {
        logger.info(`Step 1: Validating ${settlement.metalType} tokens for settlement ${settlement.id}`);

        try {
            // Validate customer has sufficient metal tokens
            const validation = await this.validateMetalTokens(settlement);
            
            if (!validation.isValid) {
                throw new Error(`Metal token validation failed: ${validation.reason}`);
            }

            // Burn metal tokens from customer's wallet
            const burnResult = await this.burnMetalTokens(settlement);
            
            settlement.steps.push({
                step: 1,
                name: 'Metal Token Validation',
                status: 'completed',
                result: burnResult,
                timestamp: new Date().toISOString()
            });

            settlement.tokensBurned = burnResult.transactionHash;

            logger.info(`Step 1 completed for settlement ${settlement.id}`);

        } catch (error) {
            settlement.steps.push({
                step: 1,
                name: 'Metal Token Validation',
                status: 'failed',
                error: error.message,
                timestamp: new Date().toISOString()
            });
            throw error;
        }
    }

    /**
     * Step 2: Mint equivalent BINR tokens
     */
    async step2BinrMinting(settlement) {
        logger.info(`Step 2: Minting BINR tokens for settlement ${settlement.id}`);

        try {
            const binrAmount = settlement.originalAmount - settlement.fees.totalFees;
            
            const mintResult = await this.binrBridge.mintBinr({
                amount: binrAmount,
                currency: settlement.currency,
                purpose: `settlement_${settlement.id}`,
                metadata: {
                    settlementId: settlement.id,
                    paymentId: settlement.paymentId,
                    metalType: settlement.metalType,
                    metalQuantity: settlement.metalQuantity
                }
            });

            settlement.steps.push({
                step: 2,
                name: 'BINR Minting',
                status: 'completed',
                result: mintResult,
                timestamp: new Date().toISOString()
            });

            settlement.binrMinted = mintResult.amount;
            settlement.binrTransactionHash = mintResult.transactionHash;

            logger.info(`Step 2 completed for settlement ${settlement.id}`);

        } catch (error) {
            settlement.steps.push({
                step: 2,
                name: 'BINR Minting',
                status: 'failed',
                error: error.message,
                timestamp: new Date().toISOString()
            });
            throw error;
        }
    }

    /**
     * Step 3: Reconcile with vault systems
     */
    async step3VaultReconciliation(settlement) {
        logger.info(`Step 3: Vault reconciliation for settlement ${settlement.id}`);

        try {
            const reconciliation = await this.vaultConnector.reconcileSettlement({
                settlementId: settlement.id,
                metalType: settlement.metalType,
                metalQuantity: settlement.metalQuantity,
                binrAmount: settlement.binrMinted,
                timestamp: new Date().toISOString()
            });

            settlement.steps.push({
                step: 3,
                name: 'Vault Reconciliation',
                status: 'completed',
                result: reconciliation,
                timestamp: new Date().toISOString()
            });

            settlement.vaultReconciliationId = reconciliation.id;

            logger.info(`Step 3 completed for settlement ${settlement.id}`);

        } catch (error) {
            settlement.steps.push({
                step: 3,
                name: 'Vault Reconciliation',
                status: 'failed',
                error: error.message,
                timestamp: new Date().toISOString()
            });
            throw error;
        }
    }

    /**
     * Step 4: Credit merchant wallet with BINR
     */
    async step4MerchantWalletCredit(settlement) {
        logger.info(`Step 4: Crediting merchant wallet for settlement ${settlement.id}`);

        try {
            const creditResult = await this.binrBridge.transferBinr({
                from: 'nmsn_system',
                to: settlement.merchantId,
                amount: settlement.binrMinted,
                purpose: `merchant_settlement_${settlement.id}`,
                metadata: {
                    settlementId: settlement.id,
                    paymentId: settlement.paymentId
                }
            });

            settlement.steps.push({
                step: 4,
                name: 'Merchant Wallet Credit',
                status: 'completed',
                result: creditResult,
                timestamp: new Date().toISOString()
            });

            settlement.merchantCreditTransaction = creditResult.transactionHash;

            logger.info(`Step 4 completed for settlement ${settlement.id}`);

        } catch (error) {
            settlement.steps.push({
                step: 4,
                name: 'Merchant Wallet Credit',
                status: 'failed',
                error: error.message,
                timestamp: new Date().toISOString()
            });
            throw error;
        }
    }

    /**
     * Step 5: Settle to INR (instant settlement)
     */
    async step5INRSettlement(settlement) {
        logger.info(`Step 5: INR settlement for settlement ${settlement.id}`);

        try {
            // Get merchant's bank details
            const merchantBankDetails = await this.getMerchantBankDetails(settlement.merchantId);
            
            const inrSettlement = await this.settleToINR({
                merchantId: settlement.merchantId,
                amount: settlement.binrMinted,
                bankAccount: merchantBankDetails,
                reference: `NMSN_SETTLEMENT_${settlement.id}`,
                purpose: 'Merchant Settlement'
            });

            settlement.steps.push({
                step: 5,
                name: 'INR Settlement',
                status: 'completed',
                result: inrSettlement,
                timestamp: new Date().toISOString()
            });

            settlement.inrSettlement = inrSettlement;
            settlement.status = 'completed';
            settlement.timestamps.completed = new Date().toISOString();

            logger.info(`Step 5 completed for settlement ${settlement.id}`);

        } catch (error) {
            settlement.steps.push({
                step: 5,
                name: 'INR Settlement',
                status: 'failed',
                error: error.message,
                timestamp: new Date().toISOString()
            });
            throw error;
        }
    }

    /**
     * Validate metal tokens
     */
    async validateMetalTokens(settlement) {
        try {
            // This would integrate with BGT, BST, BPT APIs
            // For now, return mock validation
            return {
                isValid: true,
                customerBalance: settlement.metalQuantity,
                requiredAmount: settlement.metalQuantity,
                tokenContract: this.getMetalContractAddress(settlement.metalType)
            };

        } catch (error) {
            return {
                isValid: false,
                reason: error.message
            };
        }
    }

    /**
     * Burn metal tokens
     */
    async burnMetalTokens(settlement) {
        try {
            // This would call the actual token burning function
            // Integration with BGT, BST, BPT smart contracts
            return {
                transactionHash: `burn_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
                amountBurned: settlement.metalQuantity,
                metalType: settlement.metalType,
                blockNumber: Math.floor(Math.random() * 1000000) + 18000000
            };

        } catch (error) {
            throw new Error(`Failed to burn ${settlement.metalType} tokens: ${error.message}`);
        }
    }

    /**
     * Get metal token contract address
     */
    getMetalContractAddress(metalType) {
        const contracts = {
            gold: process.env.BGT_CONTRACT_ADDRESS || '0x123...gold',
            silver: process.env.BST_CONTRACT_ADDRESS || '0x456...silver',
            platinum: process.env.BPT_CONTRACT_ADDRESS || '0x789...platinum',
            basket: process.env.MBT_CONTRACT_ADDRESS || '0xabc...basket'
        };
        return contracts[metalType] || contracts.gold;
    }

    /**
     * Get merchant bank details
     */
    async getMerchantBankDetails(merchantId) {
        // This would fetch from merchant database
        return {
            accountNumber: '1234567890',
            ifscCode: 'HDFC0001234',
            bankName: 'HDFC Bank',
            accountHolderName: `Merchant ${merchantId}`
        };
    }

    /**
     * Settle to INR through banking system
     */
    async settleToINR({ merchantId, amount, bankAccount, reference, purpose }) {
        try {
            // This would integrate with actual banking APIs
            // For demonstration, return mock settlement
            return {
                transactionId: `TXN_${Date.now()}`,
                utr: `UTR${Date.now()}${Math.random().toString(36).substr(2, 5)}`,
                amount: amount,
                status: 'completed',
                bankReference: bankAccount.ifscCode,
                settlementTime: new Date().toISOString(),
                fees: amount * 0.001, // 0.1% bank fee
                netAmount: amount - (amount * 0.001)
            };

        } catch (error) {
            throw new Error(`INR settlement failed: ${error.message}`);
        }
    }

    /**
     * Handle settlement failure
     */
    async handleSettlementFailure(settlement, error) {
        settlement.status = 'failed';
        settlement.error = error.message;
        settlement.timestamps.failed = new Date().toISOString();

        // Implement retry logic here
        if (!settlement.retryCount || settlement.retryCount < this.config.maxRetries) {
            settlement.retryCount = (settlement.retryCount || 0) + 1;
            settlement.status = 'retrying';
            
            // Retry after delay
            setTimeout(() => {
                if (this.activeSettlements.has(settlement.id)) {
                    this.processSettlement(settlement.id);
                }
            }, this.config.settlementTimeout);
        } else {
            // Move to history after max retries
            this.settlementHistory.set(settlement.id, settlement);
            this.activeSettlements.delete(settlement.id);
        }

        // Log failure for monitoring
        logger.error(`Settlement failed: ${settlement.id}`, {
            error: error.message,
            retryCount: settlement.retryCount,
            maxRetries: this.config.maxRetries
        });
    }

    /**
     * Get settlement status
     */
    getSettlement(settlementId) {
        return this.activeSettlements.get(settlementId) || this.settlementHistory.get(settlementId);
    }

    /**
     * Get settlement statistics
     */
    getSettlementStats() {
        const active = Array.from(this.activeSettlements.values());
        const history = Array.from(this.settlementHistory.values());
        const completed = history.filter(s => s.status === 'completed');
        const failed = history.filter(s => s.status === 'failed');
        const processing = history.filter(s => s.status === 'retrying');

        return {
            active: active.length,
            completed: completed.length,
            failed: failed.length,
            retrying: processing.length,
            totalVolume: completed.reduce((sum, s) => sum + s.originalAmount, 0),
            averageSettlementTime: this.calculateAverageSettlementTime(completed),
            queueSize: this.processingQueue.length
        };
    }

    /**
     * Calculate average settlement time
     */
    calculateAverageSettlementTime(settlements) {
        if (settlements.length === 0) return 0;
        
        const totalTime = settlements.reduce((sum, settlement) => {
            const start = new Date(settlement.timestamps.initiated);
            const end = new Date(settlement.timestamps.completed);
            return sum + (end - start);
        }, 0);
        
        return Math.round(totalTime / settlements.length / 1000); // Return in seconds
    }

    /**
     * Health check for settlement engine
     */
    async healthCheck() {
        const stats = this.getSettlementStats();
        const issues = [];

        if (stats.active > 100) {
            issues.push('High number of active settlements');
        }

        if (stats.failed > stats.completed * 0.1) {
            issues.push('High settlement failure rate');
        }

        return {
            status: issues.length === 0 ? 'healthy' : 'degraded',
            stats,
            issues,
            timestamp: new Date().toISOString()
        };
    }
}

module.exports = new SettlementEngine();