/**
 * Compliance Engine
 * Handles regulatory compliance, KYC/AML, and reporting
 */

const { v4: uuidv4 } = require('uuid');
const winston = require('winston');
const crypto = require('crypto');

const logger = winston.createLogger({
    level: 'info',
    format: winston.format.combine(
        winston.format.timestamp(),
        winston.format.json()
    ),
    transports: [
        new winston.transports.File({ filename: 'logs/compliance-engine.log' }),
        new winston.transports.Console()
    ]
});

class ComplianceEngine {
    constructor() {
        this.complianceRecords = new Map();
        this.kycRecords = new Map();
        this.amlAlerts = new Map();
        this.regulatoryReports = new Map();
        
        // Compliance thresholds
        this.thresholds = {
            dailyTransactionLimit: 1000000, // ₹10 lakhs per day
            monthlyTransactionLimit: 10000000, // ₹1 crore per month
            highValueThreshold: 50000, // ₹50,000 single transaction
            suspiciousPatternThreshold: 10, // Number of transactions
            velocityThreshold: 50 // Transactions per hour
        };

        // Regulatory requirements
        this.regulations = {
            rbi: {
                name: 'Reserve Bank of India',
                requirements: ['KYC', 'AML', 'Transaction Reporting'],
                reportingFrequency: 'daily'
            },
            sebi: {
                name: 'Securities and Exchange Board of India',
                requirements: ['Investor Protection', 'Market Surveillance'],
                reportingFrequency: 'weekly'
            },
            fiu: {
                name: 'Financial Intelligence Unit',
                requirements: ['STR', 'CTR', 'AML'],
                reportingFrequency: 'monthly'
            }
        };
    }

    /**
     * Validate transaction compliance
     */
    async validateTransaction(transaction) {
        try {
            const validationId = `compliance_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
            
            logger.info(`Starting compliance validation: ${validationId}`);

            const validation = {
                id: validationId,
                transactionId: transaction.id,
                userId: transaction.customerId,
                merchantId: transaction.merchantId,
                amount: transaction.amount,
                metalType: transaction.metalType,
                status: 'pending',
                checks: [],
                riskScore: 0,
                createdAt: new Date().toISOString()
            };

            // Run all compliance checks
            const checks = [
                await this.checkKycCompliance(transaction),
                await this.checkAmlCompliance(transaction),
                await this.checkVelocityLimits(transaction),
                await this.checkHighValueTransaction(transaction),
                await this.checkPatternAnalysis(transaction),
                await this.checkRegulatoryCompliance(transaction)
            ];

            validation.checks = checks;
            validation.riskScore = this.calculateRiskScore(checks);
            validation.status = validation.riskScore > 70 ? 'blocked' : 'approved';
            validation.completedAt = new Date().toISOString();

            // Store compliance record
            this.complianceRecords.set(validationId, validation);

            // Handle blocking
            if (validation.status === 'blocked') {
                await this.handleBlockedTransaction(transaction, validation);
            }

            logger.info(`Compliance validation completed: ${validationId} - ${validation.status}`);

            return {
                validationId,
                status: validation.status,
                riskScore: validation.riskScore,
                approvedAmount: validation.status === 'approved' ? transaction.amount : 0,
                checks: validation.checks
            };

        } catch (error) {
            logger.error('Transaction compliance validation failed:', error);
            throw new Error(`Compliance validation failed: ${error.message}`);
        }
    }

    /**
     * Check KYC compliance
     */
    async checkKycCompliance(transaction) {
        try {
            const kycRecord = this.kycRecords.get(transaction.customerId);
            
            if (!kycRecord) {
                return {
                    check: 'kyc_compliance',
                    status: 'failed',
                    reason: 'KYC record not found',
                    riskLevel: 'high'
                };
            }

            const isValid = kycRecord.status === 'verified' && 
                           new Date(kycRecord.expiryDate) > new Date();

            return {
                check: 'kyc_compliance',
                status: isValid ? 'passed' : 'failed',
                reason: isValid ? 'KYC verified and valid' : 'KYC expired or invalid',
                kycLevel: kycRecord.level || 'basic',
                riskLevel: isValid ? 'low' : 'high'
            };

        } catch (error) {
            return {
                check: 'kyc_compliance',
                status: 'error',
                reason: error.message,
                riskLevel: 'high'
            };
        }
    }

    /**
     * Check AML compliance
     */
    async checkAmlCompliance(transaction) {
        try {
            // Check against sanctions list
            const sanctionsCheck = await this.checkSanctionsList(transaction);
            
            // Check for unusual patterns
            const patternCheck = await this.checkUnusualPatterns(transaction);
            
            // Check source of funds (simplified)
            const sourceCheck = await this.checkSourceOfFunds(transaction);

            const failedChecks = [sanctionsCheck, patternCheck, sourceCheck]
                .filter(check => check.status === 'failed');

            return {
                check: 'aml_compliance',
                status: failedChecks.length === 0 ? 'passed' : 'failed',
                reason: failedChecks.length === 0 ? 'No AML violations detected' : 
                       failedChecks.map(c => c.reason).join('; '),
                riskLevel: failedChecks.length === 0 ? 'low' : 
                          failedChecks.length > 1 ? 'high' : 'medium',
                details: {
                    sanctions: sanctionsCheck,
                    patterns: patternCheck,
                    sourceOfFunds: sourceCheck
                }
            };

        } catch (error) {
            return {
                check: 'aml_compliance',
                status: 'error',
                reason: error.message,
                riskLevel: 'high'
            };
        }
    }

    /**
     * Check sanctions list
     */
    async checkSanctionsList(transaction) {
        // Simplified sanctions check
        // In production, this would check against official sanctions lists
        const isSanctioned = false; // Mock check
        
        return {
            check: 'sanctions_list',
            status: isSanctioned ? 'failed' : 'passed',
            reason: isSanctioned ? 'Entity found in sanctions list' : 'Not in sanctions list',
            riskLevel: isSanctioned ? 'critical' : 'low'
        };
    }

    /**
     * Check unusual patterns
     */
    async checkUnusualPatterns(transaction) {
        // Check for unusual transaction patterns
        const patterns = [
            this.checkRapidTransactions(transaction),
            this.checkRoundAmounts(transaction),
            this.checkGeographicAnomalies(transaction),
            this.checkTimeAnomalies(transaction)
        ];

        const suspiciousPatterns = patterns.filter(p => p.suspicious);

        return {
            check: 'unusual_patterns',
            status: suspiciousPatterns.length === 0 ? 'passed' : 'flagged',
            reason: suspiciousPatterns.length === 0 ? 'No unusual patterns detected' :
                   suspiciousPatterns.map(p => p.reason).join('; '),
            riskLevel: suspiciousPatterns.length === 0 ? 'low' : 'medium',
            patterns: suspiciousPatterns
        };
    }

    /**
     * Check rapid transactions
     */
    checkRapidTransactions(transaction) {
        // Mock implementation - would check transaction history
        return {
            type: 'rapid_transactions',
            suspicious: false,
            reason: 'No rapid transaction pattern detected'
        };
    }

    /**
     * Check round amounts
     */
    checkRoundAmounts(transaction) {
        const isRound = transaction.amount % 1000 === 0;
        return {
            type: 'round_amounts',
            suspicious: isRound && transaction.amount >= 10000,
            reason: isRound ? 'Round amount transaction' : 'Normal amount'
        };
    }

    /**
     * Check geographic anomalies
     */
    checkGeographicAnomalies(transaction) {
        // Mock implementation - would check IP/location data
        return {
            type: 'geographic',
            suspicious: false,
            reason: 'Geographic pattern normal'
        };
    }

    /**
     * Check time anomalies
     */
    checkTimeAnomalies(transaction) {
        const hour = new Date(transaction.createdAt).getHours();
        const isUnusualHour = hour < 6 || hour > 23;
        
        return {
            type: 'time_anomaly',
            suspicious: isUnusualHour,
            reason: isUnusualHour ? 'Transaction at unusual hour' : 'Normal timing'
        };
    }

    /**
     * Check source of funds
     */
    async checkSourceOfFunds(transaction) {
        // Mock implementation - would verify source of funds
        return {
            check: 'source_of_funds',
            status: 'passed',
            reason: 'Source of funds verified',
            riskLevel: 'low'
        };
    }

    /**
     * Check velocity limits
     */
    async checkVelocityLimits(transaction) {
        try {
            // Mock velocity check
            // In production, this would query transaction history
            const dailyVolume = 500000; // Mock daily volume
            const monthlyVolume = 8000000; // Mock monthly volume
            const hourlyCount = 15; // Mock hourly count

            const violations = [];

            if (dailyVolume > this.thresholds.dailyTransactionLimit) {
                violations.push('Daily transaction limit exceeded');
            }

            if (monthlyVolume > this.thresholds.monthlyTransactionLimit) {
                violations.push('Monthly transaction limit exceeded');
            }

            if (hourlyCount > this.thresholds.velocityThreshold) {
                violations.push('Velocity threshold exceeded');
            }

            return {
                check: 'velocity_limits',
                status: violations.length === 0 ? 'passed' : 'failed',
                reason: violations.length === 0 ? 'Within velocity limits' : violations.join('; '),
                riskLevel: violations.length === 0 ? 'low' : 'high',
                details: {
                    dailyVolume,
                    monthlyVolume,
                    hourlyCount,
                    thresholds: this.thresholds
                }
            };

        } catch (error) {
            return {
                check: 'velocity_limits',
                status: 'error',
                reason: error.message,
                riskLevel: 'medium'
            };
        }
    }

    /**
     * Check high value transaction
     */
    async checkHighValueTransaction(transaction) {
        const isHighValue = transaction.amount > this.thresholds.highValueThreshold;
        
        return {
            check: 'high_value_transaction',
            status: 'passed', // High value is allowed but flagged
            reason: isHighValue ? 'High value transaction - additional checks applied' : 'Normal value transaction',
            riskLevel: isHighValue ? 'medium' : 'low',
            flagged: isHighValue,
            threshold: this.thresholds.highValueThreshold
        };
    }

    /**
     * Check pattern analysis
     */
    async checkPatternAnalysis(transaction) {
        try {
            // Mock pattern analysis
            const patterns = [
                this.checkStructuringPattern(transaction),
                this.checkSmurfingPattern(transaction),
                this.checkCircularPattern(transaction)
            ];

            const suspiciousPatterns = patterns.filter(p => p.suspicious);

            return {
                check: 'pattern_analysis',
                status: suspiciousPatterns.length === 0 ? 'passed' : 'flagged',
                reason: suspiciousPatterns.length === 0 ? 'No suspicious patterns' :
                       suspiciousPatterns.map(p => p.reason).join('; '),
                riskLevel: suspiciousPatterns.length === 0 ? 'low' : 'medium',
                patterns: suspiciousPatterns
            };

        } catch (error) {
            return {
                check: 'pattern_analysis',
                status: 'error',
                reason: error.message,
                riskLevel: 'medium'
            };
        }
    }

    /**
     * Check structuring pattern
     */
    checkStructuringPattern(transaction) {
        // Mock structuring check
        return {
            type: 'structuring',
            suspicious: false,
            reason: 'No structuring pattern detected'
        };
    }

    /**
     * Check smurfing pattern
     */
    checkSmurfingPattern(transaction) {
        // Mock smurfing check
        return {
            type: 'smurfing',
            suspicious: false,
            reason: 'No smurfing pattern detected'
        };
    }

    /**
     * Check circular pattern
     */
    checkCircularPattern(transaction) {
        // Mock circular transaction check
        return {
            type: 'circular',
            suspicious: false,
            reason: 'No circular transaction pattern'
        };
    }

    /**
     * Check regulatory compliance
     */
    async checkRegulatoryCompliance(transaction) {
        try {
            const regulations = ['rbi', 'sebi', 'fiu'];
            const checks = {};

            regulations.forEach(reg => {
                checks[reg] = {
                    applicable: this.isRegulationApplicable(reg, transaction),
                    status: 'compliant',
                    requirements: this.regulations[reg].requirements
                };
            });

            const nonCompliant = Object.entries(checks)
                .filter(([_, check]) => check.applicable && check.status !== 'compliant');

            return {
                check: 'regulatory_compliance',
                status: nonCompliant.length === 0 ? 'passed' : 'failed',
                reason: nonCompliant.length === 0 ? 'Compliant with all applicable regulations' :
                       `${nonCompliant.length} regulatory violations`,
                riskLevel: nonCompliant.length === 0 ? 'low' : 'high',
                details: checks
            };

        } catch (error) {
            return {
                check: 'regulatory_compliance',
                status: 'error',
                reason: error.message,
                riskLevel: 'high'
            };
        }
    }

    /**
     * Check if regulation is applicable
     */
    isRegulationApplicable(regulation, transaction) {
        // Simplified logic - in production this would be more sophisticated
        switch (regulation) {
            case 'rbi':
                return true; // All transactions are subject to RBI regulations
            case 'sebi':
                return transaction.amount > 100000; // High value transactions
            case 'fui':
                return transaction.amount > 50000; // Suspicious transaction reporting
            default:
                return false;
        }
    }

    /**
     * Calculate overall risk score
     */
    calculateRiskScore(checks) {
        let totalScore = 0;
        let weightSum = 0;

        const weights = {
            'kyc_compliance': 25,
            'aml_compliance': 30,
            'velocity_limits': 15,
            'high_value_transaction': 10,
            'pattern_analysis': 15,
            'regulatory_compliance': 5
        };

        checks.forEach(check => {
            const weight = weights[check.check] || 10;
            let score = 0;

            switch (check.status) {
                case 'passed':
                    score = 0;
                    break;
                case 'failed':
                    score = check.riskLevel === 'high' ? 100 : 
                           check.riskLevel === 'medium' ? 60 : 30;
                    break;
                case 'flagged':
                    score = check.riskLevel === 'high' ? 80 : 50;
                    break;
                case 'error':
                    score = 70;
                    break;
            }

            totalScore += score * weight;
            weightSum += weight;
        });

        return weightSum > 0 ? Math.round(totalScore / weightSum) : 0;
    }

    /**
     * Handle blocked transaction
     */
    async handleBlockedTransaction(transaction, validation) {
        // Create AML alert
        const alertId = `aml_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
        
        this.amlAlerts.set(alertId, {
            id: alertId,
            type: 'blocked_transaction',
            severity: 'high',
            transactionId: transaction.id,
            userId: transaction.customerId,
            reason: 'Compliance check failed',
            validationId: validation.id,
            riskScore: validation.riskScore,
            status: 'open',
            createdAt: new Date().toISOString(),
            assignedTo: null
        });

        logger.warn(`Transaction blocked due to compliance: ${transaction.id}`, {
            riskScore: validation.riskScore,
            alertId: alertId
        });
    }

    /**
     * Generate regulatory report
     */
    async generateRegulatoryReport(type, period) {
        try {
            const reportId = `report_${type}_${Date.now()}`;
            
            let report = {
                id: reportId,
                type: type,
                period: period,
                generatedAt: new Date().toISOString(),
                status: 'generating'
            };

            switch (type) {
                case 'daily_transaction_report':
                    report.data = await this.generateDailyTransactionReport(period);
                    break;
                case 'suspicious_activity_report':
                    report.data = await this.generateSuspiciousActivityReport(period);
                    break;
                case 'compliance_summary':
                    report.data = await this.generateComplianceSummary(period);
                    break;
                default:
                    throw new Error(`Unknown report type: ${type}`);
            }

            report.status = 'completed';
            this.regulatoryReports.set(reportId, report);

            logger.info(`Regulatory report generated: ${reportId}`);

            return report;

        } catch (error) {
            logger.error('Regulatory report generation failed:', error);
            throw error;
        }
    }

    /**
     * Generate daily transaction report
     */
    async generateDailyTransactionReport(period) {
        // Mock implementation
        return {
            totalTransactions: 1250,
            totalVolume: 45000000, // ₹4.5 crores
            byMetalType: {
                gold: 800,
                silver: 300,
                platinum: 100,
                basket: 50
            },
            byCategory: {
                jewelry: 600,
                electronics: 400,
                other: 250
            },
            highValueTransactions: 45,
            blockedTransactions: 3
        };
    }

    /**
     * Generate suspicious activity report
     */
    async generateSuspiciousActivityReport(period) {
        const alerts = Array.from(this.amlAlerts.values())
            .filter(alert => alert.status === 'open');

        return {
            totalAlerts: alerts.length,
            alertsByType: {
                blocked_transaction: alerts.filter(a => a.type === 'blocked_transaction').length,
                unusual_pattern: alerts.filter(a => a.type === 'unusual_pattern').length,
                velocity_violation: alerts.filter(a => a.type === 'velocity_violation').length
            },
            alertsBySeverity: {
                high: alerts.filter(a => a.severity === 'high').length,
                medium: alerts.filter(a => a.severity === 'medium').length,
                low: alerts.filter(a => a.severity === 'low').length
            },
            averageRiskScore: alerts.reduce((sum, a) => sum + a.riskScore, 0) / alerts.length
        };
    }

    /**
     * Generate compliance summary
     */
    async generateComplianceSummary(period) {
        const validations = Array.from(this.complianceRecords.values());
        
        return {
            totalValidations: validations.length,
            approvedTransactions: validations.filter(v => v.status === 'approved').length,
            blockedTransactions: validations.filter(v => v.status === 'blocked').length,
            approvalRate: (validations.filter(v => v.status === 'approved').length / validations.length) * 100,
            averageRiskScore: validations.reduce((sum, v) => sum + v.riskScore, 0) / validations.length,
            kycCompliance: 98.5, // Mock percentage
            amlCompliance: 97.2, // Mock percentage
            regulatoryCompliance: 99.1 // Mock percentage
        };
    }

    /**
     * Health check for compliance engine
     */
    async healthCheck() {
        try {
            const alerts = Array.from(this.amlAlerts.values())
                .filter(a => a.status === 'open');
            
            const issues = [];

            if (alerts.length > 100) {
                issues.push('High number of open AML alerts');
            }

            const recentValidations = Array.from(this.complianceRecords.values())
                .filter(v => new Date(v.createdAt) > new Date(Date.now() - 24 * 60 * 60 * 1000));
            
            const blockedRate = (recentValidations.filter(v => v.status === 'blocked').length / recentValidations.length) * 100;
            
            if (blockedRate > 5) {
                issues.push(`High transaction blocking rate: ${blockedRate.toFixed(1)}%`);
            }

            return {
                status: issues.length === 0 ? 'healthy' : 'degraded',
                openAlerts: alerts.length,
                recentBlockRate: blockedRate,
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

module.exports = new ComplianceEngine();