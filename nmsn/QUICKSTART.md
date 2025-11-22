# 🚀 NMSN Quick Start Guide

Get NMSN up and running in minutes!

## Prerequisites

- **Node.js** 16+ ([Download here](https://nodejs.org/))
- **MongoDB** (for production) or use in-memory storage for development
- **Git** ([Download here](https://git-scm.com/))

## ⚡ Quick Setup (Development)

### 1. Navigate to project
```bash
cd nmsn
```

### 2. Install dependencies
```bash
cd backend
npm install
```

### 3. Start the server
```bash
npm start
```

### 4. Access the application
- **Main Website**: http://localhost:3001/
- **Merchant Dashboard**: http://localhost:3001/dashboard.html
- **API Health Check**: http://localhost:3001/health
- **Metal Prices**: http://localhost:3001/api/prices/metals

## 🏗️ Architecture Overview

```
Frontend (Port 3001)
├── index.html - Landing page
├── features.html - Product features
├── merchants.html - Merchant info
├── pricing.html - Pricing plans
├── contact.html - Contact form
└── dashboard.html - Merchant dashboard

Backend Services
├── Settlement Engine - Core payment processing
├── Metal Pricing - Real-time price feeds
├── BINR Bridge - Stablecoin integration
├── Vault Connector - Physical vault APIs
├── Merchant Service - Merchant management
└── Compliance Engine - Regulatory compliance
```

## 📱 Mobile App Setup

```bash
cd mobile-app

# Install React Native dependencies
npm install

# Run on Android (requires Android Studio)
npx react-native run-android

# Run on iOS (requires Xcode)
npx react-native run-ios
```

## 🔧 Configuration

### Environment Variables
Create a `.env` file in the `backend/` directory:

```bash
# Server Configuration
PORT=3001
NODE_ENV=development

# Database (Production)
MONGODB_URI=mongodb://localhost:27017/nmsn

# Metal Exchange APIs
LBMA_API_KEY=your_lbma_key
MCX_API_KEY=your_mcx_key

# Vault Integration
MMTC_PAMP_API_KEY=your_mmtc_key
AUGMONT_API_KEY=your_augmont_key
SAFEGOLD_API_KEY=your_safegold_key

# BINR Integration
BINR_RPC_URL=https://api.binr.co.in
BINR_API_KEY=your_binr_key

# Compliance
RBI_API_KEY=your_rbi_key
SEBI_API_KEY=your_sebi_key
FIU_API_KEY=your_fiu_key
```

## 🧪 Testing the System

### 1. Check Server Health
```bash
curl http://localhost:3001/health
```

### 2. Test Metal Pricing
```bash
curl http://localhost:3001/api/prices/metals
```

### 3. Create Test Payment (via API)
```bash
curl -X POST http://localhost:3001/api/payments/create \
  -H "Content-Type: application/json" \
  -d '{
    "amount": 1000,
    "currency": "INR",
    "metalType": "gold",
    "merchantId": "test_merchant_001"
  }'
```

## 🎯 Sample Use Cases

### For Merchants
1. **Register as Merchant**: Visit `/contact.html` and fill the form
2. **Get API Keys**: Contact support@nmsn.co.in
3. **Integrate**: Use our API documentation to add metal payments
4. **Start Earning**: Accept gold/silver/platinum payments

### For Developers
1. **Explore API**: Check `backend/API_DOCUMENTATION.md`
2. **Test Integration**: Use our sandbox environment
3. **Build Apps**: Use our React Native mobile app as reference
4. **Extend Features**: Add new metals or integrations

## 📊 Monitoring

### View Logs
```bash
cd backend
tail -f logs/app.log
```

### Monitor Performance
- Dashboard: http://localhost:3001/dashboard.html
- API Status: http://localhost:3001/health
- Metrics: http://localhost:3001/api/metrics

## 🚀 Production Deployment

### Using Docker
```bash
# Build image
docker build -t nmsn:latest .

# Run container
docker run -p 3001:3001 -e NODE_ENV=production nmsn:latest
```

### Using PM2
```bash
npm install -g pm2
pm2 start backend/server.js --name nmsn
pm2 save
pm2 startup
```

### Cloud Deployment
- **AWS**: Deploy on ECS or Lambda
- **Google Cloud**: Use Cloud Run
- **Azure**: Deploy on Container Instances
- **Digital Ocean**: Use App Platform

## 🔐 Security Notes

- Change default API keys in production
- Use HTTPS in production
- Enable MongoDB authentication
- Set up proper firewall rules
- Use environment variables for secrets

## 📞 Support

- **Email**: support@nmsn.co.in
- **Phone**: +91 11 4567 8900
- **Documentation**: See `/docs/` folder
- **API Reference**: http://localhost:3001/docs

## 🎉 You're Ready!

Your NMSN instance is now running! 

- Visit http://localhost:3001 to see the landing page
- Check http://localhost:3001/dashboard.html for the merchant dashboard
- Explore the API at http://localhost:3001/api/

**Next Steps:**
1. Explore the merchant dashboard
2. Test payment flows
3. Read the full documentation in `/docs/`
4. Customize the frontend for your needs
5. Deploy to production when ready

---

🇮🇳 **Welcome to the Future of Metal Payments!**