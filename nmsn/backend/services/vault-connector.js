/**
 * Vault Connector Service
 * Integration with certified vault systems (MMTC-PAMP, Augmont, SafeGold, etc.)
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
        new winston.transports.File({ filename: 'logs/vault-connector.log' }),
        new winston.transports.Console()
    ]
});

class VaultConnector {
    constructor() {
        this.connectedVaults = new Map();
        this.reconciliationRecords = new Map();
        this.vaultBalances = new Map();
        
        // Initialize vault connections
        this.initializeVaults();
        
        // Vault configuration
        this.config = {
            reconciliationInterval: 60000, // 1 minute
            timeout: 30000, // 30 seconds
            maxRetries: 3
        };
    }

    /**
     * Initialize connections to certified vaults
     */
    initializeVaults() {
        // MMTC-PAMP Vault
        this.connectedVaults.set('mmtc-pamp', {
            id: 'mmtc-pamp',
            name: 'MMTC-PAMP India Vault',
            type: 'LBMA',
            apiUrl: process.env.MMTC_PAMP_API_URL || 'https://api.mmtc-pamp.in',
            status: 'connected',
            supportedMetals: ['gold', 'silver'],
            certificate: 'LBMA Good Delivery',
            lastSync: null
        });

        // Augmont Vault
        this.connectedVaults.set('augmont', {
            id: 'augmont',
            name: 'Augmont Gold Vault',
            type: 'Certified',
            apiUrl: process.env.AUGMONT_API_URL || 'https://api.augmont.in',
            status: 'connected',
            supportedMetals: ['gold'],
            certificate: 'RBI Approved',
            lastSync: null
        });

        // SafeGold Vault
        this.connectedVaults.set('safegold', {
            id: 'safegold',
            name: 'SafeGold Digital Vault',
            type: 'Digital',
            apiUrl: process.env.SAFEGOLD_API_URL || 'https://api.safegold.in',
            status: 'connected',
            supportedMetals: ['gold'],
            certificate: 'RBI Compliant',
            lastSync: null
        });

        // Additional vaults can be added here
        logger.info(`Initialized ${this.connectedVaults.size} vault connections`);
    }

    /**
     * Get vault API client
     */
    getVaultClient(vaultId) {
        const vault = this.connectedVaults.get(vaultId);
        if (!vault) {
            throw new Error(`Vault ${vaultId} not found`);
        }

        const client = axios.create({
            baseURL: vault.apiUrl,
            timeout: this.config.timeout,
            headers: {
                'Content-Type': 'application/json',
                'X-NMSN-Client': 'nmsn-settlement-engine',
                'X-API-Key': this.getVaultApiKey(vaultId)
            }
        });

        // Add response interceptor for logging
        client.interceptors.response.use(
            response => response,
            error => {
                logger.error(`Vault API error (${vaultId}):`, {
                    status: error.response?.status,
                    message: error.message,
                    url: error.config?.url
                });
                throw error;
            }
        );

        return client;
    }

    /**
     * Get API key for vault
     */
    getVaultApiKey(vaultId) {
        const keyMap = {
            'mmtc-pamp': process.env.MMTC_PAMP_API_KEY || 'mock-mmtc-key',
            'augmont': process.env.AUGMONT_API_KEY || 'mock-augmont-key',
            'safegold': process.env.SAFEGOLD_API_KEY || 'mock-safegold-key'
        };
        return keyMap[vaultId] || 'mock-vault-key';
    }

    /**
     * Get vault balance for a user
     */
    async getVaultBalance(userId, metalType) {
        try {
            const balances = {};
            
            for (const [vaultId, vault] of this.connectedVaults) {
                if (!vault.supportedMetals.includes(metalType)) continue;
                
                try {
                    const client = this.getVaultClient(vaultId);
                    const response = await client.get(`/balances/${userId}`, {
                        params: { metal: metalType }
                    });
                    
                    if (response.data.success) {
                        balances[vaultId] = {
                            vaultId,
                            vaultName: vault.name,
                            metalType,
                            balance: parseFloat(response.data.balance),
                            unit: response.data.unit || 'gram',
                            lastUpdated: response.data.lastUpdated,
                            certificate: vault.certificate
                        };
                    }
                } catch (error) {
                    logger.warn(`Failed to get balance from ${vaultId}:`, error.message);
                }
            }

            return balances;

        } catch (error) {
            logger.error('Get vault balance failed:', error);
            throw new Error(`Failed to get vault balance: ${error.message}`);
        }
    }

    /**
     * Reconcile settlement with vault systems
     */
    async reconcileSettlement(settlementData) {
        try {
            const reconciliationId = `recon_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
            
            logger.info(`Starting vault reconciliation: ${reconciliationId}`);

            const reconciliation = {
                id: reconciliationId,
                settlementId: settlementData.settlementId,
                metalType: settlementData.metalType,
                metalQuantity: settlementData.metalQuantity,
                binrAmount: settlementData.binrAmount,
                status: 'pending',
                vaultUpdates: [],
                createdAt: new Date().toISOString()
            };

            // Get appropriate vault for the metal type
            const vaultId = this.getBestVaultForMetal(settlementData.metalType);
            const vault = this.connectedVaults.get(vaultId);

            if (!vault) {
                throw new Error(`No suitable vault found for ${settlementData.metalType}`);
            }

            // Update vault records
            const vaultUpdate = await this.updateVaultRecord({
                vaultId,
                userId: settlementData.customerId,
                metalType: settlementData.metalType,
                quantityChange: -settlementData.metalQuantity,
                reason: 'settlement',
                settlementId: settlementData.settlementId,
                metadata: {
                    reconciliationId,
                    binrAmount: settlementData.binrAmount,
                    timestamp: new Date().toISOString()
                }
            });

            reconciliation.vaultUpdates.push(vaultUpdate);
            reconciliation.status = 'completed';
            reconciliation.completedAt = new Date().toISOString();

            // Store reconciliation record
            this.reconciliationRecords.set(reconciliationId, reconciliation);

            logger.info(`Vault reconciliation completed: ${reconciliationId}`);

            return {
                id: reconciliationId,
                status: 'completed',
                vaultId,
                vaultName: vault.name,
                metalQuantity: settlementData.metalQuantity,
                binrAmount: settlementData.binrAmount,
                updatedAt: new Date().toISOString()
            };

        } catch (error) {
            logger.error('Vault reconciliation failed:', error);
            throw new Error(`Vault reconciliation failed: ${error.message}`);
        }
    }

    /**
     * Update vault record
     */
    async updateVaultRecord({ vaultId, userId, metalType, quantityChange, reason, settlementId, metadata }) {
        try {
            const client = this.getVaultClient(vaultId);
            
            const updateRequest = {
                userId,
                metalType,
                quantityChange: parseFloat(quantityChange),
                reason,
                reference: settlementId,
                metadata,
                timestamp: new Date().toISOString()
            };

            const response = await client.post('/transactions', updateRequest);

            if (!response.data.success) {
                throw new Error(response.data.error?.message || 'Vault update failed');
            }

            return {
                transactionId: response.data.transactionId,
                vaultId,
                metalType,
                quantityChange,
                newBalance: response.data.newBalance,
                timestamp: response.data.timestamp
            };

        } catch (error) {
            logger.error(`Vault record update failed (${vaultId}):`, error);
            throw new Error(`Vault update failed: ${error.message}`);
        }
    }

    /**
     * Get best vault for metal type
     */
    getBestVaultForMetal(metalType) {
        // Priority order based on metal type and vault capabilities
        const vaultPriority = {
            gold: ['mmtc-pamp', 'augmont', 'safegold'],
            silver: ['mmtc-pamp'],
            platinum: ['mmtc-pamp'],
            basket: ['mmtc-pamp', 'augmont']
        };

        const priority = vaultPriority[metalType] || ['mmtc-pamp'];

        for (const vaultId of priority) {
            const vault = this.connectedVaults.get(vaultId);
            if (vault && vault.supportedMetals.includes(metalType) && vault.status === 'connected') {
                return vaultId;
            }
        }

        // Fallback to first available vault
        for (const [id, vault] of this.connectedVaults) {
            if (vault.supportedMetals.includes(metalType) && vault.status === 'connected') {
                return id;
            }
        }

        throw new Error(`No connected vault available for ${metalType}`);
    }

    /**
     * Get physical metal location info
     */
    async getMetalLocationInfo(vaultId, metalType, quantity) {
        try {
            const client = this.getVaultClient(vaultId);
            const response = await client.get('/location-info', {
                params: {
                    metal: metalType,
                    quantity: parseFloat(quantity)
                }
            });

            if (!response.data.success) {
                throw new Error(response.data.error?.message || 'Failed to get location info');
            }

            return {
                vaultId,
                vaultName: this.connectedVaults.get(vaultId)?.name,
                metalType,
                quantity: parseFloat(quantity),
                locations: response.data.locations,
                totalWeight: response.data.totalWeight,
                averagePurity: response.data.averagePurity,
                certificates: response.data.certificates,
                lastAuditDate: response.data.lastAuditDate
            };

        } catch (error) {
            logger.error(`Failed to get location info from ${vaultId}:`, error);
            throw new Error(`Failed to get location info: ${error.message}`);
        }
    }

    /**
     * Audit vault holdings
     */
    async auditVaultHoldings(vaultId) {
        try {
            const client = this.getVaultClient(vaultId);
            const response = await client.get('/audit/holdings');

            if (!response.data.success) {
                throw new Error(response.data.error?.message || 'Vault audit failed');
            }

            const auditResult = {
                vaultId,
                vaultName: this.connectedVaults.get(vaultId)?.name,
                auditId: response.data.auditId,
                auditDate: response.data.auditDate,
                holdings: {},
                discrepancies: response.data.discrepancies || [],
                complianceStatus: response.data.complianceStatus,
                auditor: response.data.auditor,
                certificate: response.data.certificate
            };

            // Process holdings by metal type
            Object.entries(response.data.holdings).forEach(([metal, data]) => {
                auditResult.holdings[metal] = {
                    physicalWeight: parseFloat(data.physicalWeight),
                    tokenizedWeight: parseFloat(data.tokenizedWeight),
                    difference: parseFloat(data.difference),
                    variance: parseFloat(data.variance)
                };
            });

            logger.info(`Vault audit completed: ${vaultId}`);
            return auditResult;

        } catch (error) {
            logger.error(`Vault audit failed (${vaultId}):`, error);
            throw new Error(`Vault audit failed: ${error.message}`);
        }
    }

    /**
     * Get vault statistics
     */
    async getVaultStatistics() {
        try {
            const stats = {
                totalVaults: this.connectedVaults.size,
                connectedVaults: 0,
                totalHoldings: {
                    gold: 0,
                    silver: 0,
                    platinum: 0,
                    basket: 0
                },
                vaultStatus: {}
            };

            for (const [vaultId, vault] of this.connectedVaults) {
                try {
                    const client = this.getVaultClient(vaultId);
                    const response = await client.get('/statistics');

                    if (response.data.success) {
                        stats.connectedVaults++;
                        stats.vaultStatus[vaultId] = 'connected';

                        // Aggregate holdings
                        Object.entries(response.data.holdings).forEach(([metal, amount]) => {
                            stats.totalHoldings[metal] += parseFloat(amount);
                        });
                    } else {
                        stats.vaultStatus[vaultId] = 'disconnected';
                    }
                } catch (error) {
                    stats.vaultStatus[vaultId] = 'error';
                    logger.warn(`Failed to get stats from ${vaultId}:`, error.message);
                }
            }

            return stats;

        } catch (error) {
            logger.error('Failed to get vault statistics:', error);
            throw new Error(`Failed to get vault statistics: ${error.message}`);
        }
    }

    /**
     * Synchronize vault data
     */
    async syncVaultData(vaultId) {
        try {
            const vault = this.connectedVaults.get(vaultId);
            if (!vault) {
                throw new Error(`Vault ${vaultId} not found`);
            }

            const client = this.getVaultClient(vaultId);
            const response = await client.post('/sync', {
                lastSync: vault.lastSync,
                timestamp: new Date().toISOString()
            });

            if (!response.data.success) {
                throw new Error(response.data.error?.message || 'Vault sync failed');
            }

            // Update last sync time
            vault.lastSync = new Date().toISOString();
            
            // Update local cache
            if (response.data.balances) {
                Object.entries(response.data.balances).forEach(([userId, balance]) => {
                    this.vaultBalances.set(`${vaultId}_${userId}`, balance);
                });
            }

            logger.info(`Vault sync completed: ${vaultId}`);
            return {
                vaultId,
                vaultName: vault.name,
                syncedAt: vault.lastSync,
                recordsUpdated: response.data.recordsUpdated || 0
            };

        } catch (error) {
            logger.error(`Vault sync failed (${vaultId}):`, error);
            throw new Error(`Vault sync failed: ${error.message}`);
        }
    }

    /**
     * Validate metal authenticity
     */
    async validateMetalAuthenticity(vaultId, metalType, serialNumbers) {
        try {
            const client = this.getVaultClient(vaultId);
            const response = await client.post('/validate', {
                metalType,
                serialNumbers
            });

            if (!response.data.success) {
                throw new Error(response.data.error?.message || 'Validation failed');
            }

            return {
                vaultId,
                metalType,
                totalItems: serialNumbers.length,
                validItems: response.data.validItems,
                invalidItems: response.data.invalidItems || [],
                certificates: response.data.certificates,
                validationDate: response.data.validationDate
            };

        } catch (error) {
            logger.error(`Metal validation failed (${vaultId}):`, error);
            throw new Error(`Metal validation failed: ${error.message}`);
        }
    }

    /**
     * Health check for vault connector
     */
    async healthCheck() {
        try {
            const health = {
                status: 'healthy',
                connectedVaults: 0,
                totalVaults: this.connectedVaults.size,
                vaultHealth: {},
                lastCheck: new Date().toISOString(),
                issues: []
            };

            for (const [vaultId, vault] of this.connectedVaults) {
                try {
                    const client = this.getVaultClient(vaultId);
                    await client.get('/health');
                    
                    health.connectedVaults++;
                    health.vaultHealth[vaultId] = {
                        status: 'connected',
                        lastCheck: new Date().toISOString()
                    };
                } catch (error) {
                    health.vaultHealth[vaultId] = {
                        status: 'disconnected',
                        error: error.message,
                        lastCheck: new Date().toISOString()
                    };
                    health.issues.push(`${vaultId}: ${error.message}`);
                }
            }

            if (health.connectedVaults === 0) {
                health.status = 'critical';
            } else if (health.issues.length > 0) {
                health.status = 'degraded';
            }

            return health;

        } catch (error) {
            return {
                status: 'unhealthy',
                error: error.message,
                lastCheck: new Date().toISOString()
            };
        }
    }
}

module.exports = new VaultConnector();