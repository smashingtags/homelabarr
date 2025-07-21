# HomelabARR Authentication System

## Overview

HomelabARR includes a comprehensive authentication system to secure your container management interface. The system uses JWT tokens for stateless authentication and bcrypt for secure password hashing.

## Features

### 🔐 Security Features
- **JWT-based authentication** - Stateless, secure token-based auth
- **Bcrypt password hashing** - Industry-standard password security
- **Role-based access control** - Admin and user roles
- **Automatic token validation** - Expired tokens are handled gracefully
- **Secure session management** - Automatic logout on token expiration

### 👤 User Management
- **Default admin account** - Created automatically on first run
- **Password management** - Users can change their own passwords
- **User profiles** - Username, email, role, last login tracking
- **Admin controls** - Admins can manage other users (future feature)

### 🛡️ Access Control
- **Protected endpoints** - All container operations require authentication
- **Optional authentication** - Can be disabled for development
- **Role-based permissions** - Different access levels for admin vs user
- **CORS protection** - Restricted origins in production

## Default Credentials

**⚠️ IMPORTANT: Change these immediately after first login!**

- **Username:** `admin`
- **Password:** `admin`

## Configuration

### Environment Variables

```bash
# Enable/disable authentication
AUTH_ENABLED=true

# JWT configuration
JWT_SECRET=your-super-secret-key-change-this
JWT_EXPIRES_IN=24h

# Default admin password (only used on first setup)
DEFAULT_ADMIN_PASSWORD=admin
```

### Docker Compose

```yaml
environment:
  - AUTH_ENABLED=true
  - JWT_SECRET=${JWT_SECRET:-homelabarr-change-this-secret}
  - JWT_EXPIRES_IN=24h
  - DEFAULT_ADMIN_PASSWORD=${DEFAULT_ADMIN_PASSWORD:-admin}
```

## API Endpoints

### Authentication Routes

- `POST /api/auth/login` - User login
- `GET /api/auth/me` - Get current user info
- `POST /api/auth/change-password` - Change user password
- `POST /api/auth/register` - Create new user (admin only)
- `GET /api/auth/users` - List all users (admin only)

### Protected Routes

All container management endpoints require authentication when `AUTH_ENABLED=true`:

- `/api/containers/*` - Container operations
- `/api/deploy` - Application deployment
- `/api/ports/*` - Port management

## Frontend Components

### Authentication UI
- **LoginModal** - Secure login form with validation
- **UserMenu** - User profile dropdown with logout
- **UserSettings** - Password change and user management
- **AuthStatus** - Authentication status indicator

### Security Features
- **Automatic token refresh** - Handles expired tokens gracefully
- **Secure storage** - Tokens stored in localStorage with validation
- **Error handling** - Clear feedback for authentication errors
- **Loading states** - Visual feedback during auth operations

## Security Best Practices

### Production Deployment
1. **Change default credentials** immediately
2. **Use strong JWT secret** (32+ random characters)
3. **Set secure CORS origins** (no wildcards)
4. **Use HTTPS** in production
5. **Regular password updates** for all users

### Password Requirements
- Minimum 6 characters (configurable)
- Bcrypt hashing with salt rounds: 12
- No password reuse validation (future feature)

### Token Security
- JWT tokens expire after 24 hours (configurable)
- Tokens include user ID, username, and role
- Automatic cleanup of expired tokens
- No refresh token implementation (stateless design)

## Troubleshooting

### Common Issues

1. **"Authentication required" errors**
   - Check if `AUTH_ENABLED=true` in environment
   - Verify JWT_SECRET is set
   - Ensure user is logged in

2. **"Invalid token" errors**
   - Token may have expired (24h default)
   - JWT_SECRET may have changed
   - Clear browser storage and re-login

3. **Default admin not created**
   - Check server logs for errors
   - Verify write permissions to `server/config/`
   - Ensure no existing users.json file

### Debug Commands

```bash
# Check authentication status
curl http://localhost:3001/health

# Test login
curl -X POST http://localhost:3001/auth/login \
  -H "Content-Type: application/json" \
  -d '{"username":"admin","password":"admin"}'

# Check user info (with token)
curl http://localhost:3001/auth/me \
  -H "Authorization: Bearer YOUR_TOKEN_HERE"
```

## Future Enhancements

- **Multi-factor authentication** (2FA/TOTP)
- **OAuth integration** (Google, GitHub, etc.)
- **Advanced user management** (admin UI)
- **Audit logging** (user actions tracking)
- **Password policies** (complexity requirements)
- **Session management** (active sessions, force logout)
- **API key authentication** (for automation)

## Development

### Disabling Authentication

For development, you can disable authentication:

```bash
AUTH_ENABLED=false
```

This allows unrestricted access to all endpoints.

### Testing Authentication

The system includes comprehensive error handling and validation. Test with:

- Invalid credentials
- Expired tokens
- Missing tokens
- Role-based access restrictions