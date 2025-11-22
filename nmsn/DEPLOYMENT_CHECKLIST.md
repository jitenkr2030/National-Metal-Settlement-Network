# 🚀 NMSN Deployment Checklist

Use this checklist to ensure your NMSN deployment is production-ready.

## Pre-Deployment Checklist

### ✅ Code & Configuration
- [ ] Review and update all API keys in `.env`
- [ ] Set `NODE_ENV=production` in production environment
- [ ] Configure MongoDB/Production database connection
- [ ] Set up proper JWT secrets (minimum 32 characters)
- [ ] Configure CORS origins for your domain
- [ ] Update all URLs to production endpoints
- [ ] Test all environment variables are properly loaded

### ✅ Security Configuration
- [ ] Generate strong JWT secrets
- [ ] Set up SSL/TLS certificates
- [ ] Configure firewall rules (only ports 80, 443, 22)
- [ ] Enable MongoDB authentication
- [ ] Set up proper database user permissions
- [ ] Configure rate limiting
- [ ] Set up fail2ban for server protection
- [ ] Enable audit logging

### ✅ Database Setup
- [ ] Set up MongoDB replica set (recommended)
- [ ] Configure database backup strategy
- [ ] Set up monitoring for database performance
- [ ] Configure database indexes for optimal query performance
- [ ] Set up database connection pooling

### ✅ External Integrations
- [ ] Configure metal exchange API keys (LBMA, MCX, COMEX)
- [ ] Set up vault provider connections (MMTC-PAMP, Augmont, SafeGold)
- [ ] Configure BINR stablecoin integration
- [ ] Set up regulatory API keys (RBI, SEBI, FIU)
- [ ] Configure KYC and AML service integrations
- [ ] Set up email/SMS notification services

### ✅ Monitoring & Logging
- [ ] Configure application logs (rotate, level, destination)
- [ ] Set up error tracking (Sentry or similar)
- [ ] Configure application performance monitoring
- [ ] Set up uptime monitoring
- [ ] Configure alerts for critical errors
- [ ] Set up log aggregation and analysis

## Deployment Steps

### 1. Server Preparation
```bash
# Update system
sudo apt update && sudo apt upgrade -y

# Install Node.js 16+
curl -fsSL https://deb.nodesource.com/setup_16.x | sudo -E bash -
sudo apt-get install -y nodejs

# Install PM2 for process management
npm install -g pm2

# Install MongoDB
wget -qO - https://www.mongodb.org/static/pgp/server-5.0.asc | sudo apt-key add -
echo "deb [ arch=amd64,arm64 ] https://repo.mongodb.org/apt/ubuntu focal/mongodb-org/5.0 multiverse" | sudo tee /etc/apt/sources.list.d/mongodb-org-5.0.list
sudo apt-get update
sudo apt-get install -y mongodb-org

# Install Nginx
sudo apt install nginx -y

# Install Certbot for SSL
sudo apt install certbot python3-certbot-nginx -y
```

### 2. Application Deployment
```bash
# Clone/download the NMSN codebase
git clone https://github.com/your-org/nmsn.git
cd nmsn

# Install dependencies
cd backend
npm install --production

# Set up environment
cp .env.example .env
# Edit .env with production values

# Start with PM2
pm2 start backend/server.js --name nmsn
pm2 save
pm2 startup
```

### 3. Nginx Configuration
```nginx
# /etc/nginx/sites-available/nmsn
server {
    listen 80;
    server_name your-domain.com;
    return 301 https://$server_name$request_uri;
}

server {
    listen 443 ssl http2;
    server_name your-domain.com;

    ssl_certificate /etc/letsencrypt/live/your-domain.com/fullchain.pem;
    ssl_certificate_key /etc/letsencrypt/live/your-domain.com/privkey.pem;

    location / {
        proxy_pass http://localhost:3001;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_cache_bypass $http_upgrade;
    }
}
```

### 4. SSL Certificate Setup
```bash
# Get SSL certificate
sudo certbot --nginx -d your-domain.com -d www.your-domain.com

# Auto-renewal setup
sudo crontab -e
# Add: 0 12 * * * /usr/bin/certbot renew --quiet
```

### 5. Database Setup
```bash
# Start MongoDB
sudo systemctl start mongod
sudo systemctl enable mongod

# Create database user
mongo
> use nmsn
> db.createUser({
    user: "nmsn_user",
    pwd: "secure_password",
    roles: [{ role: "readWrite", db: "nmsn" }]
  })
```

## Post-Deployment Verification

### ✅ Service Health Checks
- [ ] Server responds to health check: `curl https://your-domain.com/health`
- [ ] Metal prices API works: `curl https://your-domain.com/api/prices/metals`
- [ ] Database connections are established
- [ ] All services are running (PM2 status)
- [ ] SSL certificate is valid

### ✅ Functional Testing
- [ ] Landing page loads correctly
- [ ] Merchant dashboard is accessible
- [ ] Contact form submission works
- [ ] Payment simulation works (test mode)
- [ ] Email notifications are sent
- [ ] Mobile app can connect to API

### ✅ Performance Testing
- [ ] Server response time < 200ms
- [ ] Database queries are optimized
- [ ] Static assets are cached
- [ ] CDN is configured (if applicable)
- [ ] Rate limiting is working

### ✅ Security Testing
- [ ] All endpoints require proper authentication
- [ ] CORS is properly configured
- [ ] API rate limits are enforced
- [ ] No sensitive data in logs
- [ ] HTTPS redirects are working
- [ ] Security headers are set

## Monitoring Setup

### Application Monitoring
```bash
# PM2 monitoring
pm2 monit

# View logs
pm2 logs nmsn

# Restart if needed
pm2 restart nmsn
```

### System Monitoring
```bash
# Install monitoring tools
sudo apt install htop iotop nethogs -y

# Set up log rotation
sudo nano /etc/logrotate.d/nmsn
```

## Backup Strategy

### Database Backup
```bash
# Create backup script
#!/bin/bash
DATE=$(date +%Y%m%d_%H%M%S)
mongodump --db nmsn --out /backup/nmsn_$DATE
tar -czf /backup/nmsn_backup_$DATE.tar.gz /backup/nmsn_$DATE
# Upload to cloud storage
aws s3 cp /backup/nmsn_backup_$DATE.tar.gz s3://your-backup-bucket/
```

### Application Backup
```bash
# Backup configurations
cp -r /path/to/nmsn /backup/application_$(date +%Y%m%d)
```

## Disaster Recovery

### Recovery Steps
1. **Assess Impact**: Determine extent of outage
2. **Notify Users**: Send status page updates
3. **Activate Backup**: Switch to backup systems
4. **Data Recovery**: Restore from latest backup
5. **Service Restoration**: Bring services back online
6. **Post-Mortem**: Document and analyze incident

### Contact Information
- **Technical Lead**: technical@nmsn.co.in
- **Emergency Contact**: +91 XXXXX XXXXX
- **Status Page**: status.nmsn.co.in

## Maintenance

### Regular Tasks
- [ ] Update dependencies monthly
- [ ] Review security patches weekly
- [ ] Monitor disk space and database growth
- [ ] Review error logs daily
- [ ] Test backup restore quarterly
- [ ] Update SSL certificates before expiration

### Performance Tuning
- [ ] Monitor response times
- [ ] Optimize database queries
- [ ] Review and adjust rate limits
- [ ] Scale resources based on usage

---

**✅ Deployment Complete!**

Your NMSN instance is now live and ready to process metal payments!

For support: support@nmsn.co.in | +91 11 4567 8900