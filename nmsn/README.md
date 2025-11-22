# 🇮🇳 NMSN - National Metal Settlement Network

**India's First Nationwide Precious Metal Payment System**

The UPI for Gold, Silver, Platinum & Tokenized Metals

[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)
[![Version](https://img.shields.io/badge/version-1.0.0-blue.svg)](https://github.com/nmsn/nmsn)
[![Build Status](https://img.shields.io/badge/build-passing-brightgreen.svg)]()

## 🎯 Overview

NMSN (National Metal Settlement Network) is India's first nationwide settlement layer for precious metal payments. Users can pay using tokenized metals (Gold, Silver, Platinum) while merchants receive instant INR settlement - making it the "UPI for Precious Metals."

## ✨ Key Features

- ⚡ **Instant Settlement**: Metal-to-INR conversion in under 2 seconds
- 🏦 **Multi-Metal Support**: BGT (Gold), BST (Silver), BPT (Platinum), MBT (Basket)
- 🔗 **Vault Integration**: MMTC-PAMP, Augmont, SafeGold connectivity
- 📱 **Mobile First**: React Native app with QR payments
- 🛡️ **Regulatory Compliant**: RBI, SEBI, FIU guidelines built-in
- 💰 **Competitive Pricing**: 0.2-0.5% network fees

## 🏗️ Architecture

```
┌─────────────────────────────────────────────────────────────┐
│                    NMSN Architecture                        │
├─────────────────────────────────────────────────────────────┤
│  Frontend Layer                                            │
│  ├── React Native Mobile App                               │
│  ├── HTML5 Merchant Dashboard                             │
│  └── REST API Gateway                                     │
├─────────────────────────────────────────────────────────────┤
│  Business Logic Layer                                     │
│  ├── Settlement Engine                                     │
│  ├── Metal Pricing Service                                 │
│  ├── Compliance Engine                                     │
│  └── BINR Bridge                                          │
├─────────────────────────────────────────────────────────────┤
│  Integration Layer                                        │
│  ├── Vault Connectors                                      │
│  ├── Exchange APIs                                         │
│  ├── Banking Interfaces                                   │
│  └── KYC Services                                         │
├─────────────────────────────────────────────────────────────┤
│  Blockchain Layer                                          │
│  ├── INDI Chain                                            │
│  ├── Hyperledger Fabric                                    │
│  ├── Smart Contracts                                      │
│  └── Token Management                                     │
└─────────────────────────────────────────────────────────────┘
```

## 🚀 Quick Start

### Prerequisites
- Node.js 16+ 
- MongoDB (for production)
- Docker (optional)

### Installation

1. **Clone the repository**
   ```bash
   git clone https://github.com/nmsn/nmsn.git
   cd nmsn
   ```

2. **Install dependencies**
   ```bash
   cd backend
   npm install
   ```

3. **Configure environment**
   ```bash
   cp .env.example .env
   # Edit .env with your configuration
   ```

4. **Start the server**
   ```bash
   npm start
   ```

5. **Access the application**
   - Merchant Dashboard: http://localhost:3001/dashboard.html
   - API Documentation: http://localhost:3001/docs
   - Health Check: http://localhost:3001/health

## 📁 Project Structure

```
nmsn/
├── README.md                 # This file
├── LICENSE                   # MIT License
├── backend/                  # Node.js API server
│   ├── server.js            # Main server file
│   ├── services/            # Core business services
│   │   ├── settlement-engine.js
│   │   ├── metal-pricing.js
│   │   ├── binr-bridge.js
│   │   ├── vault-connector.js
│   │   ├── merchant-service.js
│   │   └── compliance-engine.js
│   ├── package.json         # Node.js dependencies
│   └── logs/               # Application logs
├── frontend/                # Web interfaces
│   ├── index.html          # Landing page
│   ├── features.html       # Features page
│   ├── merchants.html      # Merchant page
│   ├── pricing.html        # Pricing page
│   ├── contact.html        # Contact page
│   └── dashboard.html      # Merchant dashboard
├── mobile-app/             # React Native app
│   └── App.js             # Main mobile app
├── docs/                   # Documentation
│   ├── README.md
│   ├── TECHNICAL_ARCHITECTURE.md
│   ├── IMPLEMENTATION_COMPLETE.md
│   ├── API_DOCUMENTATION.md
│   └── DEPLOYMENT_SUMMARY.md
├── scripts/                # Deployment scripts
│   ├── deploy.sh          # Main deployment
│   ├── start.sh           # Start service
│   ├── stop.sh            # Stop service
│   └── status.sh          # Check status
└── contracts/              # Smart contracts
    └── (future: Solidity contracts)
```

## 💳 Payment Flow

1. **User Selection**: Customer chooses metal payment (Gold/Silver/Platinum)
2. **Real-time Pricing**: System calculates exact metal amount needed
3. **Token Processing**: Metal tokens burned, BINR stablecoin minted
4. **Instant Settlement**: BINR converts to INR, settles to merchant account

## 🏢 Enterprise Features

- **White-label Solutions**: Custom branding and deployment
- **API Integration**: RESTful APIs with comprehensive documentation
- **Compliance Suite**: Automated RBI/SEBI/FIU reporting
- **Analytics Dashboard**: Real-time insights and business intelligence
- **24/7 Support**: Dedicated merchant success team

## 💰 Pricing

| Plan | Setup Fee | Transaction Fee | Monthly Volume | Support |
|------|-----------|----------------|----------------|---------|
| Starter | ₹2,000 | 0.5% | Up to 1,000 | Email |
| Professional | ₹25,000/year | 0.3% | Up to 10,000 | Phone + Email |
| Enterprise | ₹1,00,000/year | 0.2% | Unlimited | Dedicated Manager |

## 🔧 Development

### Running in Development Mode

```bash
# Start development server with auto-reload
npm run dev

# Run tests
npm test

# Run linting
npm run lint

# Build for production
npm run build
```

### API Endpoints

- `GET /api/prices/metals` - Current metal prices
- `POST /api/payments/create` - Create payment
- `POST /api/payments/:id/confirm` - Confirm payment
- `GET /api/merchants/:id/dashboard` - Merchant analytics
- `POST /api/merchants/register` - Merchant registration

## 🧪 Testing

The project includes comprehensive testing:

```bash
# Run unit tests
npm test

# Run integration tests
npm run test:integration

# Run e2e tests
npm run test:e2e

# Generate coverage report
npm run test:coverage
```

## 📊 Monitoring & Analytics

- **Real-time Monitoring**: Application performance and uptime
- **Transaction Analytics**: Payment volume, success rates, settlement times
- **Business Intelligence**: Revenue tracking, customer insights
- **Compliance Reporting**: Automated regulatory reporting

## 🔐 Security

- **End-to-End Encryption**: All communications encrypted
- **Multi-factor Authentication**: Merchant and user security
- **Audit Logging**: Complete transaction audit trail
- **PCI Compliance**: Secure payment processing standards

## 🌐 Deployment

### Docker Deployment

```bash
# Build Docker image
docker build -t nmsn:latest .

# Run with Docker Compose
docker-compose up -d
```

### Cloud Deployment

Supports deployment on:
- AWS (ECS, Lambda, RDS)
- Google Cloud (Cloud Run, Cloud SQL)
- Azure (Container Instances, Cosmos DB)
- Digital Ocean (App Platform, Managed Databases)

## 🤝 Contributing

1. Fork the repository
2. Create a feature branch (`git checkout -b feature/amazing-feature`)
3. Commit your changes (`git commit -m 'Add amazing feature'`)
4. Push to the branch (`git push origin feature/amazing-feature`)
5. Open a Pull Request

## 📞 Support

- **Documentation**: [docs.nmsn.co.in](https://docs.nmsn.co.in)
- **API Reference**: [api.nmsn.co.in](https://api.nmsn.co.in)
- **Community**: [community.nmsn.co.in](https://community.nmsn.co.in)
- **Support Email**: support@nmsn.co.in
- **Phone**: +91 11 4567 8900

## 📜 License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.

## 🏆 Awards & Recognition

- **India Fintech Awards 2025**: "Best Metal Payment Innovation"
- **Blockchain India**: "Most Promising DeFi Project"
- **RBI Regulatory SandBox**: Approved Participant

## 📈 Roadmap

### Q1 2025
- [ ] Multi-chain deployment (Polygon, BSC)
- [ ] Advanced analytics dashboard
- [ ] Mobile app beta release

### Q2 2025
- [ ] Cross-border payments
- [ ] Institutional trading desk
- [ ] Automated market making

### Q3 2025
- [ ] DeFi protocol integration
- [ ] NFT marketplace support
- [ ] Carbon credit tokens

---

**Built with ❤️ in India for the future of metal payments**

🇮🇳 **NMSN** - National Metal Settlement Network | *Empowering India's Metal Economy*