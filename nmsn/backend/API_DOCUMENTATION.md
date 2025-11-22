# NMSN API Documentation

## Overview
National Metal Settlement Network (NMSN) API provides endpoints for metal payments, settlements, and merchant management.

## Base URL
```
http://localhost:3001/api
```

## Authentication
All endpoints require JWT authentication except health check and pricing endpoints.

```
Authorization: Bearer <your-jwt-token>
```

## Endpoints

### Health Check
- **GET** `/health`
- **Description**: System health check
- **Response**:
```json
{
  "status": "healthy",
  "timestamp": "2024-11-21T14:24:47.000Z",
  "service": "NMSN - National Metal Settlement Network",
  "version": "1.0.0"
}
```

### Payments

#### Create Payment
- **POST** `/payments/create`
- **Description**: Create a new metal payment
- **Body**:
```json
{
  "amount": 25000,
  "currency": "INR",
  "metalType": "gold",
  "merchantId": "merchant_001",
  "customerId": "user_001",
  "description": "Purchase payment"
}
```
- **Response**:
```json
{
  "success": true,
  "data": {
    "paymentId": "pay_1640995200000_abc123def",
    "amount": 25000,
    "currency": "INR",
    "metalType": "gold",
    "metalQuantity": 3.59,
    "status": "pending",
    "expiresAt": "2024-11-21T14:29:47.000Z"
  }
}
```

#### Confirm Payment
- **POST** `/payments/{paymentId}/confirm`
- **Description**: Confirm payment and initiate settlement
- **Response**:
```json
{
  "success": true,
  "data": {
    "paymentId": "pay_1640995200000_abc123def",
    "status": "confirmed",
    "settlementId": "sett_1640995200000_xyz789ghi",
    "estimatedSettlementTime": "2 seconds"
  }
}
```

#### Get Payment Status
- **GET** `/payments/{paymentId}/status`
- **Description**: Get payment status
- **Response**:
```json
{
  "success": true,
  "data": {
    "paymentId": "pay_1640995200000_abc123def",
    "status": "confirmed",
    "settlementStatus": "completed",
    "amount": 25000,
    "currency": "INR",
    "metalType": "gold"
  }
}
```

### Pricing

#### Get Metal Prices
- **GET** `/prices/metals`
- **Description**: Get current metal prices
- **Response**:
```json
{
  "success": true,
  "data": {
    "gold": {
      "price": 6956.50,
      "currency": "INR",
      "unit": "gram",
      "timestamp": "2024-11-21T14:24:47.000Z"
    },
    "silver": {
      "price": 82.75,
      "currency": "INR",
      "unit": "gram",
      "timestamp": "2024-11-21T14:24:47.000Z"
    }
  }
}
```

### Analytics

#### Network Statistics
- **GET** `/analytics/network`
- **Description**: Get network analytics
- **Response**:
```json
{
  "success": true,
  "data": {
    "totalTransactions": 1250,
    "totalVolume": 45000000,
    "averageTransactionSize": 36000,
    "metalDistribution": {
      "gold": 780,
      "silver": 300,
      "platinum": 120,
      "basket": 50
    },
    "activeMerchants": 150
  }
}
```

## Error Responses

All endpoints return consistent error responses:

```json
{
  "error": {
    "code": "ERROR_CODE",
    "message": "Human readable error message",
    "details": "Additional error details"
  }
}
```

## Rate Limiting

- General endpoints: 1000 requests per 15 minutes
- Payment endpoints: 100 requests per minute

## Status Codes

- `200` - Success
- `201` - Created
- `400` - Bad Request
- `401` - Unauthorized
- `403` - Forbidden
- `404` - Not Found
- `429` - Too Many Requests
- `500` - Internal Server Error
