# Authentication Testing Guide

**Date**: October 16, 2025  
**Purpose**: Test Cognito authentication with automatic group assignment  
**Expected Outcome**: New users automatically added to "Users" group

---

## 🎯 Test Objectives

1. ✅ Verify signup flow works
2. ✅ Verify email confirmation works
3. ✅ Verify auto-assignment to "Users" group
4. ✅ Verify login works
5. ✅ Verify JWT token contains `cognito:groups`
6. ✅ Verify protected routes require authentication
7. ✅ Verify API authorization with JWT

---

## 🧪 Test Steps

### Step 1: Sign Up New User

**Action**: Navigate to signup page

**Browser**: http://localhost:5173/signup

**Fill in form**:
- Email: `test@example.com` (use a real email you can access)
- Password: `TestPass123!` (must meet Cognito requirements)

**Submit form**

**Expected behavior**:
- ✅ Form submits without errors
- ✅ You see "Check your email for confirmation code" message
- ✅ You receive confirmation email from AWS Cognito

**Troubleshooting**:
- If signup fails, check browser console (F12) for errors
- Verify `.env` file has correct Cognito credentials
- Password must be 8+ characters with uppercase, lowercase, and digit

---

### Step 2: Confirm Email

**Action**: Check email for confirmation code

**Option A: Confirmation Link** (if configured):
- Click the confirmation link in email

**Option B: Confirmation Code** (default):
- Copy the 6-digit code from email
- Enter code in frontend confirmation form

**Expected behavior**:
- ✅ Email confirmation succeeds
- ✅ You're redirected to login page
- ✅ **Post-Confirmation Lambda triggers** (behind the scenes)
- ✅ User is automatically added to "Users" group

---

### Step 3: Verify Auto-Assignment to Group

**Action**: Check if user was added to "Users" group

**Command**:
```bash
aws cognito-idp admin-list-groups-for-user \
  --user-pool-id us-east-1_khi9CtS4e \
  --username test@example.com \
  --region us-east-1 \
  --profile tyche-dev
```

**Expected output**:
```json
{
  "Groups": [
    {
      "GroupName": "Users",
      "UserPoolId": "us-east-1_khi9CtS4e",
      "Precedence": 3,
      "Description": "Standard users with access to their own financial data"
    }
  ]
}
```

**If no groups**:
- Check Lambda CloudWatch logs for errors:
```bash
aws logs tail /aws/lambda/tyche-post-confirmation \
  --follow \
  --profile tyche-dev \
  --region us-east-1
```

---

### Step 4: Login

**Action**: Login with confirmed user

**Browser**: http://localhost:5173/login

**Credentials**:
- Email: `test@example.com`
- Password: `TestPass123!`

**Expected behavior**:
- ✅ Login succeeds
- ✅ Redirected to `/dashboard`
- ✅ Dashboard shows user information
- ✅ No authentication errors

**Troubleshooting**:
- Check browser console for errors
- Verify AWS Cognito configuration
- Check Network tab (F12) for API errors

---

### Step 5: Verify JWT Token Contains Groups

**Action**: Inspect JWT token in browser

**Steps**:
1. Open browser DevTools (F12)
2. Go to **Application** tab (Chrome) or **Storage** tab (Firefox)
3. Navigate to **Local Storage** → `http://localhost:5173`
4. Find key containing "idToken" or "accessToken"
5. Copy the JWT token value

**Decode token**:
- Go to https://jwt.io
- Paste token in "Encoded" section
- Look at "Payload" section

**Expected claims**:
```json
{
  "sub": "user-id-here",
  "email": "test@example.com",
  "cognito:groups": ["Users"],  // ✅ THIS IS WHAT WE'RE TESTING!
  "cognito:username": "test@example.com",
  "custom:tenantId": "personal",
  "iss": "https://cognito-idp.us-east-1.amazonaws.com/us-east-1_khi9CtS4e",
  "exp": 1729123456
}
```

**Key verification**:
- ✅ `cognito:groups` array exists
- ✅ Contains `"Users"`
- ✅ Token not expired (`exp` > current timestamp)

---

### Step 6: Test Protected Routes

**Action**: Test that authentication is required

**Test A: Access protected route while logged in**:
1. Navigate to http://localhost:5173/dashboard
2. **Expected**: Dashboard loads successfully ✅

**Test B: Logout and try accessing protected route**:
1. Clear browser local storage (or logout if logout button exists)
2. Navigate to http://localhost:5173/dashboard
3. **Expected**: Redirected to `/login` ✅

**Test C: Access public routes while logged out**:
1. Navigate to http://localhost:5173/login
2. **Expected**: Login page loads ✅
3. Navigate to http://localhost:5173/signup
4. **Expected**: Signup page loads ✅

---

### Step 7: Test API Authorization

**Action**: Test that API accepts JWT token

**Test A: Call public endpoint (no auth required)**:
```bash
curl https://841dg6itk5.execute-api.us-east-1.amazonaws.com/public/health
```

**Expected response**:
```json
{
  "status": "healthy",
  "timestamp": "2025-10-16T14:30:00Z",
  "service": "Tyche Finance API"
}
```

**Test B: Call protected endpoint (auth required)**:

First, get your JWT token from browser (Step 5), then:

```bash
# Replace YOUR_JWT_TOKEN with actual token
curl -X GET \
  https://841dg6itk5.execute-api.us-east-1.amazonaws.com/v1/cards \
  -H "Authorization: Bearer YOUR_JWT_TOKEN"
```

**Expected response** (empty list if no cards):
```json
{
  "cards": []
}
```

**Test C: Call protected endpoint without token**:
```bash
curl -X GET \
  https://841dg6itk5.execute-api.us-east-1.amazonaws.com/v1/cards
```

**Expected response** (401 Unauthorized):
```json
{
  "message": "Unauthorized"
}
```

---

## ✅ Success Criteria

All of the following must pass:

- [x] User can sign up successfully
- [x] User receives confirmation email
- [x] Email confirmation succeeds
- [x] User automatically assigned to "Users" group (verified via AWS CLI)
- [x] User can login with credentials
- [x] JWT token contains `cognito:groups: ["Users"]`
- [x] Protected routes require authentication
- [x] Logged-in users can access dashboard
- [x] Logged-out users redirected to login
- [x] Public API endpoints work without auth
- [x] Protected API endpoints require valid JWT
- [x] Protected API endpoints reject requests without JWT

---

## 🐛 Common Issues & Fixes

### Issue 1: "User already exists"
**Cause**: Email already registered in Cognito  
**Fix**: Use a different email or delete user from Cognito:
```bash
aws cognito-idp admin-delete-user \
  --user-pool-id us-east-1_khi9CtS4e \
  --username test@example.com \
  --region us-east-1 \
  --profile tyche-dev
```

### Issue 2: "Invalid password"
**Cause**: Password doesn't meet Cognito requirements  
**Requirements**:
- Minimum 8 characters
- At least one uppercase letter
- At least one lowercase letter
- At least one digit
- Symbols optional

### Issue 3: User not in "Users" group
**Cause**: Post-Confirmation Lambda failed  
**Fix**: Check Lambda logs:
```bash
aws logs tail /aws/lambda/tyche-post-confirmation \
  --follow \
  --profile tyche-dev \
  --region us-east-1
```

**Manual workaround**:
```bash
aws cognito-idp admin-add-user-to-group \
  --user-pool-id us-east-1_khi9CtS4e \
  --username test@example.com \
  --group-name Users \
  --region us-east-1 \
  --profile tyche-dev
```

### Issue 4: JWT token missing `cognito:groups`
**Cause**: User needs to re-login after group assignment  
**Fix**: Logout and login again to get fresh JWT token

### Issue 5: API returns 401 Unauthorized
**Cause**: JWT token expired or invalid  
**Fix**: 
- Check token expiration at https://jwt.io
- Login again to get fresh token
- Verify Authorization header format: `Bearer TOKEN`

### Issue 6: CORS errors in browser
**Cause**: API CORS configuration  
**Fix**: Check CDK stack has CORS enabled (should be configured)

---

## 🎉 Next Steps After Testing

Once all tests pass:

1. **Test admin promotion**:
```bash
# Promote your test user to Admin
aws cognito-idp admin-add-user-to-group \
  --user-pool-id us-east-1_khi9CtS4e \
  --username test@example.com \
  --group-name Admins \
  --region us-east-1 \
  --profile tyche-dev

# Verify user now in both groups
aws cognito-idp admin-list-groups-for-user \
  --user-pool-id us-east-1_khi9CtS4e \
  --username test@example.com \
  --region us-east-1 \
  --profile tyche-dev
```

2. **Move to next todo**: Build Cards page (CRUD)

3. **Document any issues**: Add to BUGS_AND_FIXES.md

---

## 📊 Test Results Template

Copy this and fill in as you test:

```markdown
## Authentication Test Results - October 16, 2025

**Tester**: [Your Name]  
**Environment**: Development (localhost:5173)  
**User Pool**: us-east-1_khi9CtS4e

### Test Results

- [ ] Step 1: Sign Up - PASS / FAIL / NOTES: ___________
- [ ] Step 2: Email Confirmation - PASS / FAIL / NOTES: ___________
- [ ] Step 3: Auto-Assignment to Group - PASS / FAIL / NOTES: ___________
- [ ] Step 4: Login - PASS / FAIL / NOTES: ___________
- [ ] Step 5: JWT Groups Claim - PASS / FAIL / NOTES: ___________
- [ ] Step 6: Protected Routes - PASS / FAIL / NOTES: ___________
- [ ] Step 7: API Authorization - PASS / FAIL / NOTES: ___________

### Issues Found

1. [Describe any issues]

### Screenshots

[Attach screenshots if needed]

### Conclusion

All tests: PASSED ✅ / FAILED ❌  
Ready for next phase: YES / NO
```

---

**Happy Testing! 🚀**
