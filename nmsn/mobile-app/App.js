import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, ScrollView, Alert } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import AsyncStorage from '@react-native-async-storage/async-storage';

const NMSNMobileApp = () => {
  const [user, setUser] = useState(null);
  const [balance, setBalance] = useState({
    gold: 0,
    silver: 0,
    platinum: 0,
    basket: 0
  });
  const [recentTransactions, setRecentTransactions] = useState([]);
  const [metalPrices, setMetalPrices] = useState({});
  const [activeTab, setActiveTab] = useState('wallet');

  // Sample user data
  const sampleUser = {
    id: 'user_001',
    name: 'Rahul Sharma',
    phone: '+91-9876543210',
    kycStatus: 'verified',
    memberSince: '2024-01-15'
  };

  useEffect(() => {
    initializeApp();
    loadMetalPrices();
    loadUserBalance();
  }, []);

  const initializeApp = async () => {
    setUser(sampleUser);
    await loadRecentTransactions();
  };

  const loadMetalPrices = async () => {
    // Mock metal prices - in production, fetch from API
    const prices = {
      gold: { price: 6956.50, change: '+0.8%', trend: 'up' },
      silver: { price: 82.75, change: '-0.3%', trend: 'down' },
      platinum: { price: 2845.20, change: '+1.2%', trend: 'up' },
      basket: { price: 2800.00, change: '+0.5%', trend: 'up' }
    };
    setMetalPrices(prices);
  };

  const loadUserBalance = async () => {
    // Mock user balance - in production, fetch from API
    const userBalance = {
      gold: 2.456,
      silver: 45.78,
      platinum: 0.234,
      basket: 5.12
    };
    setBalance(userBalance);
  };

  const loadRecentTransactions = async () => {
    // Mock transactions - in production, fetch from API
    const transactions = [
      {
        id: 'TXN_001',
        type: 'payment',
        amount: 25000,
        metalType: 'gold',
        metalQuantity: 3.59,
        merchant: 'Tanishq Store',
        status: 'completed',
        timestamp: new Date(Date.now() - 1800000).toISOString()
      },
      {
        id: 'TXN_002',
        type: 'purchase',
        amount: 15000,
        metalType: 'silver',
        metalQuantity: 181.27,
        status: 'completed',
        timestamp: new Date(Date.now() - 3600000).toISOString()
      }
    ];
    setRecentTransactions(transactions);
  };

  const createPayment = async (amount, metalType) => {
    try {
      const paymentData = {
        amount,
        currency: 'INR',
        metalType,
        merchantId: 'merchant_001',
        customerId: user.id,
        description: 'Mobile payment via NMSN'
      };

      // Mock payment creation
      Alert.alert('Payment Created', `Payment of ₹${amount} using ${metalType} created successfully!`);
      
      // Refresh balance and transactions
      await loadUserBalance();
      await loadRecentTransactions();
      
    } catch (error) {
      Alert.alert('Error', 'Payment creation failed. Please try again.');
    }
  };

  const renderWalletTab = () => (
    <ScrollView style={styles.tabContent}>
      {/* Balance Cards */}
      <View style={styles.balanceSection}>
        <Text style={styles.sectionTitle}>Metal Portfolio</Text>
        {Object.entries(balance).map(([metal, amount]) => (
          <View key={metal} style={styles.balanceCard}>
            <View style={styles.balanceInfo}>
              <Ionicons 
                name={metal === 'gold' ? 'cash' : metal === 'silver' ? 'ellipse' : 'diamond'} 
                size={24} 
                color={getMetalColor(metal)} 
              />
              <View style={styles.balanceText}>
                <Text style={styles.balanceMetal}>
                  {metal.charAt(0).toUpperCase() + metal.slice(1)}
                </Text>
                <Text style={styles.balanceAmount}>
                  {amount.toFixed(3)} {metal === 'basket' ? 'units' : 'grams'}
                </Text>
              </View>
            </View>
            <View style={styles.balanceValue}>
              <Text style={styles.balanceValueText}>
                ₹{(amount * (metalPrices[metal]?.price || 0)).toLocaleString()}
              </Text>
              <Text style={[
                styles.priceChange,
                { color: metalPrices[metal]?.trend === 'up' ? '#10B981' : '#EF4444' }
              ]}>
                {metalPrices[metal]?.change || '0%'}
              </Text>
            </View>
          </View>
        ))}
      </View>

      {/* Quick Actions */}
      <View style={styles.quickActionsSection}>
        <Text style={styles.sectionTitle}>Quick Actions</Text>
        <View style={styles.actionGrid}>
          <TouchableOpacity 
            style={styles.actionButton}
            onPress={() => setActiveTab('buy')}
          >
            <Ionicons name="add-circle" size={24} color="#10B981" />
            <Text style={styles.actionText}>Buy Metal</Text>
          </TouchableOpacity>
          <TouchableOpacity 
            style={styles.actionButton}
            onPress={() => setActiveTab('send')}
          >
            <Ionicons name="send" size={24} color="#3B82F6" />
            <Text style={styles.actionText}>Send Metal</Text>
          </TouchableOpacity>
          <TouchableOpacity 
            style={styles.actionButton}
            onPress={() => setActiveTab('pay')}
          >
            <Ionicons name="card" size={24} color="#F59E0B" />
            <Text style={styles.actionText}>Pay Merchant</Text>
          </TouchableOpacity>
          <TouchableOpacity 
            style={styles.actionButton}
            onPress={() => setActiveTab('redeem')}
          >
            <Ionicons name="gift" size={24} color="#8B5CF6" />
            <Text style={styles.actionText}>Redeem</Text>
          </TouchableOpacity>
        </View>
      </View>
    </ScrollView>
  );

  const renderPayTab = () => (
    <ScrollView style={styles.tabContent}>
      <View style={styles.paySection}>
        <Text style={styles.sectionTitle}>Pay with Metal</Text>
        
        {/* Amount Input */}
        <View style={styles.inputGroup}>
          <Text style={styles.inputLabel}>Amount (INR)</Text>
          <Text style={styles.input}>₹0</Text>
        </View>

        {/* Metal Selection */}
        <View style={styles.metalSelection}>
          <Text style={styles.inputLabel}>Choose Metal</Text>
          <View style={styles.metalOptions}>
            {Object.entries(metalPrices).map(([metal, data]) => (
              <TouchableOpacity
                key={metal}
                style={styles.metalOption}
                onPress={() => createPayment(25000, metal)}
              >
                <View style={[styles.metalIcon, { backgroundColor: getMetalColor(metal) + '20' }]}>
                  <Ionicons 
                    name={metal === 'gold' ? 'cash' : metal === 'silver' ? 'ellipse' : 'diamond'} 
                    size={20} 
                    color={getMetalColor(metal)} 
                  />
                </View>
                <Text style={styles.metalName}>
                  {metal.charAt(0).toUpperCase() + metal.slice(1)}
                </Text>
                <Text style={styles.metalPrice}>₹{data.price}/g</Text>
              </TouchableOpacity>
            ))}
          </View>
        </View>

        {/* Quick Amounts */}
        <View style={styles.quickAmounts}>
          <Text style={styles.inputLabel}>Quick Amounts</Text>
          <View style={styles.amountButtons}>
            {[500, 1000, 2500, 5000, 10000].map(amount => (
              <TouchableOpacity
                key={amount}
                style={styles.amountButton}
                onPress={() => createPayment(amount, 'gold')}
              >
                <Text style={styles.amountButtonText}>₹{amount}</Text>
              </TouchableOpacity>
            ))}
          </View>
        </View>
      </View>
    </ScrollView>
  );

  const renderHistoryTab = () => (
    <ScrollView style={styles.tabContent}>
      <View style={styles.historySection}>
        <Text style={styles.sectionTitle}>Recent Transactions</Text>
        {recentTransactions.map(transaction => (
          <View key={transaction.id} style={styles.transactionCard}>
            <View style={styles.transactionInfo}>
              <View style={[styles.transactionIcon, { backgroundColor: getMetalColor(transaction.metalType) + '20' }]}>
                <Ionicons 
                  name={transaction.metalType === 'gold' ? 'cash' : 'ellipse'} 
                  size={16} 
                  color={getMetalColor(transaction.metalType)} 
                />
              </View>
              <View style={styles.transactionDetails}>
                <Text style={styles.transactionTitle}>
                  {transaction.type === 'payment' ? 'Payment to' : 'Purchase of'} {transaction.metalType}
                </Text>
                <Text style={styles.transactionSubtitle}>
                  {transaction.merchant || 'Metal Purchase'} • {formatTimeAgo(transaction.timestamp)}
                </Text>
                <Text style={styles.transactionAmount}>
                  ₹{transaction.amount.toLocaleString()}
                </Text>
              </View>
            </View>
            <View style={styles.transactionStatus}>
              <Text style={[
                styles.statusText,
                { color: transaction.status === 'completed' ? '#10B981' : '#F59E0B' }
              ]}>
                {transaction.status}
              </Text>
            </View>
          </View>
        ))}
      </View>
    </ScrollView>
  );

  const renderTab = () => {
    switch (activeTab) {
      case 'wallet':
        return renderWalletTab();
      case 'pay':
        return renderPayTab();
      case 'history':
        return renderHistoryTab();
      default:
        return renderWalletTab();
    }
  };

  return (
    <View style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <View style={styles.headerContent}>
          <View>
            <Text style={styles.headerTitle}>NMSN</Text>
            <Text style={styles.headerSubtitle}>National Metal Settlement</Text>
          </View>
          <View style={styles.headerRight}>
            <View style={styles.networkStatus}>
              <View style={styles.statusDot} />
              <Text style={styles.statusText}>Online</Text>
            </View>
          </View>
        </View>
      </View>

      {/* User Info */}
      {user && (
        <View style={styles.userInfo}>
          <View style={styles.userAvatar}>
            <Text style={styles.avatarText}>
              {user.name.split(' ').map(n => n[0]).join('')}
            </Text>
          </View>
          <View style={styles.userDetails}>
            <Text style={styles.userName}>{user.name}</Text>
            <Text style={styles.userStatus}>
              {user.kycStatus === 'verified' ? '✓ Verified' : '⏳ Verification Pending'}
            </Text>
          </View>
          <TouchableOpacity style={styles.settingsButton}>
            <Ionicons name="settings-outline" size={20} color="#6B7280" />
          </TouchableOpacity>
        </View>
      )}

      {/* Tab Content */}
      <View style={styles.tabContentContainer}>
        {renderTab()}
      </View>

      {/* Bottom Navigation */}
      <View style={styles.bottomNav}>
        <TouchableOpacity 
          style={[styles.navItem, activeTab === 'wallet' && styles.navItemActive]}
          onPress={() => setActiveTab('wallet')}
        >
          <Ionicons 
            name="wallet" 
            size={20} 
            color={activeTab === 'wallet' ? '#F59E0B' : '#6B7280'} 
          />
          <Text style={[styles.navText, activeTab === 'wallet' && styles.navTextActive]}>
            Wallet
          </Text>
        </TouchableOpacity>
        
        <TouchableOpacity 
          style={[styles.navItem, activeTab === 'pay' && styles.navItemActive]}
          onPress={() => setActiveTab('pay')}
        >
          <Ionicons 
            name="card" 
            size={20} 
            color={activeTab === 'pay' ? '#F59E0B' : '#6B7280'} 
          />
          <Text style={[styles.navText, activeTab === 'pay' && styles.navTextActive]}>
            Pay
          </Text>
        </TouchableOpacity>
        
        <TouchableOpacity 
          style={[styles.navItem, activeTab === 'history' && styles.navItemActive]}
          onPress={() => setActiveTab('history')}
        >
          <Ionicons 
            name="time" 
            size={20} 
            color={activeTab === 'history' ? '#F59E0B' : '#6B7280'} 
          />
          <Text style={[styles.navText, activeTab === 'history' && styles.navTextActive]}>
            History
          </Text>
        </TouchableOpacity>
      </View>
    </View>
  );
};

const getMetalColor = (metal) => {
  const colors = {
    gold: '#F59E0B',
    silver: '#6B7280',
    platinum: '#3B82F6',
    basket: '#8B5CF6'
  };
  return colors[metal] || '#6B7280';
};

const formatTimeAgo = (timestamp) => {
  const now = new Date();
  const time = new Date(timestamp);
  const diffInMinutes = Math.floor((now - time) / 60000);
  
  if (diffInMinutes < 1) return 'Just now';
  if (diffInMinutes < 60) return `${diffInMinutes}m ago`;
  if (diffInMinutes < 1440) return `${Math.floor(diffInMinutes / 60)}h ago`;
  return `${Math.floor(diffInMinutes / 1440)}d ago`;
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F9FAFB',
  },
  header: {
    backgroundColor: '#FFFFFF',
    paddingTop: 50,
    paddingHorizontal: 20,
    paddingBottom: 20,
    borderBottomWidth: 1,
    borderBottomColor: '#E5E7EB',
  },
  headerContent: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  headerTitle: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#F59E0B',
  },
  headerSubtitle: {
    fontSize: 12,
    color: '#6B7280',
    marginTop: 2,
  },
  headerRight: {
    alignItems: 'flex-end',
  },
  networkStatus: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  statusDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: '#10B981',
    marginRight: 6,
  },
  statusText: {
    fontSize: 12,
    color: '#6B7280',
  },
  userInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FFFFFF',
    paddingHorizontal: 20,
    paddingVertical: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#E5E7EB',
  },
  userAvatar: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: '#F59E0B',
    justifyContent: 'center',
    alignItems: 'center',
  },
  avatarText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: 'bold',
  },
  userDetails: {
    flex: 1,
    marginLeft: 12,
  },
  userName: {
    fontSize: 16,
    fontWeight: '600',
    color: '#111827',
  },
  userStatus: {
    fontSize: 12,
    color: '#10B981',
    marginTop: 2,
  },
  settingsButton: {
    padding: 8,
  },
  tabContentContainer: {
    flex: 1,
  },
  tabContent: {
    flex: 1,
    padding: 20,
  },
  balanceSection: {
    marginBottom: 24,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#111827',
    marginBottom: 12,
  },
  balanceCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    padding: 16,
    marginBottom: 8,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 3,
    elevation: 2,
  },
  balanceInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
  },
  balanceText: {
    marginLeft: 12,
  },
  balanceMetal: {
    fontSize: 16,
    fontWeight: '600',
    color: '#111827',
  },
  balanceAmount: {
    fontSize: 12,
    color: '#6B7280',
    marginTop: 2,
  },
  balanceValue: {
    alignItems: 'flex-end',
  },
  balanceValueText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#111827',
  },
  priceChange: {
    fontSize: 12,
    marginTop: 2,
  },
  quickActionsSection: {
    marginBottom: 24,
  },
  actionGrid: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  actionButton: {
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    padding: 16,
    alignItems: 'center',
    flex: 1,
    marginHorizontal: 4,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 3,
    elevation: 2,
  },
  actionText: {
    fontSize: 12,
    color: '#6B7280',
    marginTop: 8,
    textAlign: 'center',
  },
  inputGroup: {
    marginBottom: 20,
  },
  inputLabel: {
    fontSize: 14,
    fontWeight: '500',
    color: '#374151',
    marginBottom: 8,
  },
  input: {
    backgroundColor: '#FFFFFF',
    borderRadius: 8,
    padding: 16,
    fontSize: 18,
    fontWeight: '600',
    color: '#111827',
    textAlign: 'center',
  },
  metalSelection: {
    marginBottom: 20,
  },
  metalOptions: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  metalOption: {
    backgroundColor: '#FFFFFF',
    borderRadius: 8,
    padding: 12,
    alignItems: 'center',
    flex: 1,
    marginHorizontal: 4,
  },
  metalIcon: {
    width: 40,
    height: 40,
    borderRadius: 20,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 8,
  },
  metalName: {
    fontSize: 12,
    fontWeight: '500',
    color: '#111827',
    marginBottom: 4,
  },
  metalPrice: {
    fontSize: 10,
    color: '#6B7280',
  },
  quickAmounts: {
    marginBottom: 20,
  },
  amountButtons: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'space-between',
  },
  amountButton: {
    backgroundColor: '#FFFFFF',
    borderRadius: 8,
    paddingVertical: 12,
    paddingHorizontal: 16,
    marginBottom: 8,
    width: '48%',
    alignItems: 'center',
  },
  amountButtonText: {
    fontSize: 14,
    fontWeight: '500',
    color: '#111827',
  },
  historySection: {
    marginBottom: 20,
  },
  transactionCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    padding: 16,
    marginBottom: 8,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  transactionInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
  },
  transactionIcon: {
    width: 32,
    height: 32,
    borderRadius: 16,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
  },
  transactionDetails: {
    flex: 1,
  },
  transactionTitle: {
    fontSize: 14,
    fontWeight: '500',
    color: '#111827',
  },
  transactionSubtitle: {
    fontSize: 12,
    color: '#6B7280',
    marginTop: 2,
  },
  transactionAmount: {
    fontSize: 14,
    fontWeight: '600',
    color: '#111827',
    marginTop: 4,
  },
  transactionStatus: {
    alignItems: 'flex-end',
  },
  bottomNav: {
    flexDirection: 'row',
    backgroundColor: '#FFFFFF',
    borderTopWidth: 1,
    borderTopColor: '#E5E7EB',
    paddingTop: 8,
    paddingBottom: 8,
  },
  navItem: {
    flex: 1,
    alignItems: 'center',
    paddingVertical: 8,
  },
  navItemActive: {
    backgroundColor: '#FEF3C7',
    borderRadius: 8,
    marginHorizontal: 8,
  },
  navText: {
    fontSize: 10,
    color: '#6B7280',
    marginTop: 4,
  },
  navTextActive: {
    color: '#F59E0B',
    fontWeight: '500',
  },
});

export default NMSNMobileApp;