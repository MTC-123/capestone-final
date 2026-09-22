# Security Policy

## Supported Versions

We release security updates for the following versions of the RICER Platform:

| Version | Supported          |
| ------- | ------------------ |
| 2.x.x   | :white_check_mark: |
| 1.x.x   | :x:                |

**Note:** We recommend always using the latest version from the `main` branch for the most up-to-date security fixes.

---

## Reporting a Vulnerability

We take the security of the RICER Platform seriously. If you discover a security vulnerability, please follow these steps:

### 1. DO NOT Create a Public Issue

Please **do not** report security vulnerabilities through public GitHub issues, discussions, or pull requests.

### 2. Report Privately

Send a detailed report to the maintainers via one of these methods:

- **GitHub Security Advisory:** Use the ["Report a vulnerability"](https://github.com/MTC-123/FireDetectionPlatform/security/advisories/new) feature
- **Email:** Contact the repository owner through their GitHub profile

### 3. Include in Your Report

Please include as much information as possible:

- **Type of vulnerability** (e.g., SQL injection, XSS, authentication bypass)
- **Location** of the affected code (file path, line numbers)
- **Step-by-step instructions** to reproduce the issue
- **Proof of concept** (if possible, without causing harm)
- **Potential impact** of the vulnerability
- **Suggested fix** (if you have one)

**Example Report:**
```
Title: SQL Injection in Report API Endpoint

Description:
The /api/reports endpoint is vulnerable to SQL injection through
the 'status' query parameter.

Steps to Reproduce:
1. Navigate to /api/reports?status='; DROP TABLE reports; --
2. Observe unauthorized database operation

Impact:
Attacker could delete or modify database records

Suggested Fix:
Use parameterized queries with Prisma ORM instead of raw SQL
```

---

## Security Measures

### Current Security Features

The RICER Platform implements the following security measures:

#### Authentication & Authorization
- ✅ **JWT tokens** with httpOnly cookies
- ✅ **bcrypt password hashing** (10 rounds)
- ✅ **Role-based access control** (Civilian/Official)
- ✅ **Protected API routes** with middleware
- ✅ **Session expiration** and refresh mechanisms

#### Input Validation
- ✅ **Server-side validation** for all user inputs
- ✅ **Type checking** with TypeScript
- ✅ **SQL injection protection** via Prisma ORM
- ✅ **XSS prevention** through React's built-in escaping

#### Data Protection
- ✅ **Environment variables** for secrets
- ✅ **Secure database connections** (MongoDB Atlas)
- ✅ **HTTPS enforcement** in production
- ✅ **CORS configuration** for API endpoints

#### API Security
- ✅ **Rate limiting** (planned)
- ✅ **Request validation** with Zod schemas
- ✅ **Error handling** without information leakage
- ✅ **Secure headers** (Content-Security-Policy, etc.)

---

## Known Security Considerations

### Development Environment

**Warning:** The following apply to development mode only:

- Test accounts with known passwords (`password123`)
- Open network access in MongoDB (development only)
- Non-production JWT secrets
- Debug mode enabled

**Action Required:** Always use strong credentials and secure configuration in production.

### Production Deployment

When deploying to production:

1. **Use strong JWT secret** (64+ random characters)
2. **Restrict MongoDB network access** to your server's IP
3. **Enable HTTPS** (required for httpOnly cookies)
4. **Set `NODE_ENV=production`**
5. **Remove test accounts** or change their passwords
6. **Review and restrict CORS** origins
7. **Enable rate limiting** on API routes
8. **Regular dependency updates** (`npm audit`)

---

## Security Best Practices for Contributors

If you're contributing to the project:

### Do's ✅

- ✅ **Validate all inputs** on the server side
- ✅ **Use Prisma ORM** instead of raw database queries
- ✅ **Sanitize user-generated content** before display
- ✅ **Check authentication** in protected routes
- ✅ **Use environment variables** for sensitive data
- ✅ **Review dependencies** for known vulnerabilities
- ✅ **Test security features** thoroughly

### Don'ts ❌

- ❌ **Never commit secrets** (passwords, API keys, tokens)
- ❌ **Don't trust client-side validation** alone
- ❌ **Avoid raw SQL queries** when Prisma is available
- ❌ **Don't expose error details** to end users
- ❌ **Never disable security features** without good reason
- ❌ **Don't use `eval()` or `dangerouslySetInnerHTML`** without sanitization

### Code Review Checklist

Before submitting a PR, verify:

- [ ] No hardcoded credentials or secrets
- [ ] Input validation on all user data
- [ ] Authentication checks on protected routes
- [ ] No SQL injection vulnerabilities
- [ ] No XSS vulnerabilities
- [ ] Error messages don't leak sensitive info
- [ ] Dependencies are up to date (`npm audit`)

---

## Vulnerability Disclosure Timeline

When you report a vulnerability:

1. **Acknowledgment:** Within 48 hours
2. **Initial Assessment:** Within 1 week
3. **Fix Development:** Depends on severity
   - Critical: 1-7 days
   - High: 1-2 weeks
   - Medium: 2-4 weeks
   - Low: 4-8 weeks
4. **Security Release:** After testing the fix
5. **Public Disclosure:** 90 days after fix release (or earlier if agreed)

---

## Security Updates

### Receiving Security Notifications

To stay informed about security updates:

- **Watch this repository** on GitHub (Settings → Watch → Custom → Security alerts)
- **Enable GitHub security advisories** for notifications
- **Check releases** for security-related updates
- **Follow the changelog** for security fixes

### Security-Related Releases

Security releases will be tagged with:
- Version bump (e.g., `2.1.1` → `2.1.2` for patches)
- `[SECURITY]` prefix in release notes
- CVE identifier (if applicable)
- Affected versions and severity rating

---

## Responsible Disclosure

We believe in responsible disclosure and will:

- **Acknowledge** your report promptly
- **Keep you informed** of our progress
- **Credit you** in security advisories (if you wish)
- **Work with you** to understand and verify the issue
- **Not take legal action** against good-faith security researchers

### Researcher Guidelines

As a security researcher, please:

- **Give us reasonable time** to fix the issue before public disclosure
- **Avoid accessing or modifying** other users' data
- **Don't perform DoS attacks** or disruptive testing
- **Use a test instance** when possible
- **Report findings ethically** and confidentially

---

## Security Resources

### For Developers

- [OWASP Top 10](https://owasp.org/www-project-top-ten/)
- [OWASP Cheat Sheet Series](https://cheatsheetseries.owasp.org/)
- [Next.js Security Documentation](https://nextjs.org/docs/pages/building-your-application/configuring/security-headers)
- [MongoDB Security Checklist](https://www.mongodb.com/docs/manual/administration/security-checklist/)

### For Security Researchers

- [GitHub Security Advisories](https://github.com/MTC-123/FireDetectionPlatform/security/advisories)
- [CVE Details](https://www.cvedetails.com/)
- [National Vulnerability Database](https://nvd.nist.gov/)

---

## Contact

For security-related inquiries:

- **Security Advisories:** [GitHub Security Tab](https://github.com/MTC-123/FireDetectionPlatform/security)
- **General Questions:** Create a private security advisory or contact via GitHub

---

## Acknowledgments

We would like to thank the following security researchers for their responsible disclosure:

*(Currently no public disclosures)*

If you've reported a vulnerability, we'll list you here (with your permission) after the fix is released.

---

**Thank you for helping keep the RICER Platform secure!** 🔒
