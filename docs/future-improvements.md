# Future Improvements

This document lists potential enhancements and optimizations for future releases.

## Security Enhancements

### 1. AWS Secrets Manager Integration
**Priority**: High  
**Current**: JWT_SECRET stored in environment variables  
**Recommended**: Use AWS Secrets Manager or Parameter Store

```typescript
// Example implementation
import { SecretsManager } from '@aws-sdk/client-secrets-manager';

async function getJWTSecret(): Promise<string> {
  const client = new SecretsManager({ region: process.env.AWS_REGION });
  const response = await client.getSecretValue({ SecretId: 'jwt-secret' });
  return response.SecretString!;
}
```

**Benefits**:
- Automatic rotation support
- Audit logging
- Centralized secret management
- Better security compliance

### 2. Environment-Specific Database Migrations
**Priority**: Medium  
**Current**: Seed data with demo user in single migration file  
**Recommended**: Separate migrations for dev/staging/prod

```bash
backend/migrations/
  001_initial_schema.sql       # Core schema only
  002_dev_seed_data.sql        # Development data
  002_prod_initial_users.sql   # Production users (no demo account)
```

## Performance Optimizations

### 3. WebSocket User Information Caching
**Priority**: High  
**Current**: Individual DB queries for each WebSocket message  
**Recommended**: Cache user information to reduce database load

```typescript
// Add user_name to connections table
ALTER TABLE connections ADD COLUMN user_name VARCHAR(255);

// Update on connect
INSERT INTO connections (connection_id, project_id, user_id, user_name, ...)
SELECT $1, $2, $3, u.name, ...
FROM users u WHERE u.id = $3;
```

**Benefits**:
- Reduced database queries (up to 90% for high-frequency operations)
- Lower latency for real-time updates
- Better scalability for concurrent users

### 4. AWS SDK v3 Migration
**Priority**: Medium  
**Current**: Using AWS SDK v2 (in maintenance mode)  
**Recommended**: Migrate to AWS SDK v3

```bash
npm uninstall aws-sdk
npm install @aws-sdk/client-apigatewaymanagementapi @aws-sdk/client-s3
```

```typescript
// Before (v2)
import { ApiGatewayManagementApi } from 'aws-sdk';

// After (v3)
import { ApiGatewayManagementApiClient, PostToConnectionCommand } from '@aws-sdk/client-apigatewaymanagementapi';
```

**Benefits**:
- Smaller bundle sizes (modular imports)
- Better TypeScript support
- Active development and support
- Improved performance

### 5. User Information Pre-loading
**Priority**: Medium  
**Current**: Fetching user names on each message  
**Recommended**: Pre-load and cache user information

```typescript
interface CachedUser {
  id: string;
  name: string;
  lastUpdated: number;
}

class UserCache {
  private cache: Map<string, CachedUser> = new Map();
  private TTL = 3600000; // 1 hour

  async getUserName(userId: string): Promise<string> {
    const cached = this.cache.get(userId);
    if (cached && Date.now() - cached.lastUpdated < this.TTL) {
      return cached.name;
    }
    
    // Fetch from DB and update cache
    const user = await queryOne<User>('SELECT name FROM users WHERE id = $1', [userId]);
    if (user) {
      this.cache.set(userId, { id: userId, name: user.name, lastUpdated: Date.now() });
      return user.name;
    }
    
    return 'Unknown User';
  }
}
```

## User Experience Improvements

### 6. WebSocket Disconnection UI Feedback
**Priority**: Medium  
**Current**: Console logging only  
**Recommended**: Visual feedback and user actions

```typescript
// Add callback for max attempts reached
class WebSocketService {
  private onMaxReconnectAttempts?: () => void;
  
  setMaxReconnectAttemptsHandler(handler: () => void) {
    this.onMaxReconnectAttempts = handler;
  }
  
  // In onclose handler
  if (this.reconnectAttempts >= this.maxReconnectAttempts) {
    if (this.onMaxReconnectAttempts) {
      this.onMaxReconnectAttempts();
    }
  }
}

// In React component
wsService.setMaxReconnectAttemptsHandler(() => {
  // Show modal to user
  setShowReconnectError(true);
});
```

### 7. AI Response Streaming
**Priority**: Low  
**Current**: Wait for complete AI response  
**Recommended**: Stream AI responses for better UX

```typescript
async function* streamAIResponse(request: AIAssistRequest) {
  // Stream from AI API
  for await (const chunk of aiApiStream(request)) {
    yield chunk;
  }
}
```

## Infrastructure Improvements

### 8. CloudFront Distribution ID Output
**Priority**: Low  
**Current**: Must query to find distribution ID  
**Recommended**: Add distribution ID to CloudFormation outputs

```yaml
Outputs:
  CloudFrontDistributionId:
    Description: CloudFront Distribution ID
    Value: !Ref CloudFrontDistribution
    Export:
      Name: !Sub ${AWS::StackName}-CloudFrontDistributionId
```

### 9. Lambda Layers for Dependencies
**Priority**: Medium  
**Current**: Package all dependencies with each function  
**Recommended**: Use Lambda Layers for common dependencies

```yaml
Resources:
  CommonDependenciesLayer:
    Type: AWS::Lambda::LayerVersion
    Properties:
      LayerName: requirements-maker-common-deps
      Content:
        S3Bucket: my-layers-bucket
        S3Key: common-deps.zip
      CompatibleRuntimes:
        - nodejs18.x
```

### 10. API Gateway Request Validation
**Priority**: Medium  
**Current**: Validation in Lambda handlers  
**Recommended**: Add API Gateway request validators

```yaml
Resources:
  RequestValidator:
    Type: AWS::ApiGateway::RequestValidator
    Properties:
      RestApiId: !Ref RestApi
      ValidateRequestBody: true
      ValidateRequestParameters: true
```

## Monitoring & Observability

### 11. X-Ray Tracing
**Priority**: Medium  
**Recommended**: Enable AWS X-Ray for distributed tracing

```typescript
import AWSXRay from 'aws-xray-sdk-core';
const AWS = AWSXRay.captureAWS(require('aws-sdk'));
```

### 12. Custom CloudWatch Metrics
**Priority**: Medium  
**Recommended**: Add business metrics

```typescript
import { CloudWatch } from 'aws-sdk';

async function recordMetric(metricName: string, value: number) {
  const cloudwatch = new CloudWatch();
  await cloudwatch.putMetricData({
    Namespace: 'RequirementsMaker',
    MetricData: [{
      MetricName: metricName,
      Value: value,
      Unit: 'Count',
      Timestamp: new Date()
    }]
  }).promise();
}

// Track phase completions, AI requests, concurrent users, etc.
```

## Testing

### 13. Unit Tests
**Priority**: High  
**Recommended**: Add comprehensive unit tests

```bash
backend/src/services/__tests__/
  projectService.test.ts
  phaseService.test.ts
  aiService.test.ts
```

### 14. Integration Tests
**Priority**: High  
**Recommended**: Add API integration tests

```bash
backend/tests/integration/
  api.test.ts
  websocket.test.ts
```

### 15. E2E Tests
**Priority**: Medium  
**Recommended**: Add end-to-end tests with Playwright or Cypress

```bash
tests/e2e/
  project-creation.spec.ts
  phase-transitions.spec.ts
  collaboration.spec.ts
```

## Documentation

### 16. API Examples
**Priority**: Low  
**Recommended**: Add Postman collection or OpenAPI spec

### 17. Deployment Automation
**Priority**: Medium  
**Recommended**: Add CI/CD pipeline with GitHub Actions

```yaml
# .github/workflows/deploy.yml
name: Deploy
on:
  push:
    branches: [main]
jobs:
  deploy:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v2
      - name: Deploy Infrastructure
        run: |
          aws cloudformation deploy ...
      - name: Deploy Backend
        run: |
          cd backend && npm run deploy
      - name: Deploy Frontend
        run: |
          cd frontend && npm run build && aws s3 sync ...
```

## Priority Legend
- **High**: Should be implemented in next release
- **Medium**: Nice to have, implement when time permits
- **Low**: Future consideration
