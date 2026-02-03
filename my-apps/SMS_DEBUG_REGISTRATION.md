# SMS Notification Debug Guide - Registration Status

**Issue:** Resident not receiving SMS when BWMC approves/rejects registration

**Status:** 🔍 INVESTIGATING

---

## Diagnostic Checklist

### 1. ✅ Code Implementation

- [x] `handleApproveReject` calls `/api/notifications/registration-status` ✓
- [x] `registration-status/route.ts` calls `/api/send-sms` ✓
- [x] `send-sms/route.ts` has PhilSMS configuration ✓
- [x] Environment variables set in `.env.local` ✓

### 2. 🔴 Potential Issues to Check

#### Issue A: Phone Number Format

**Problem:** PhilSMS requires specific phone formats

- ✓ Expected: `09XXXXXXXXX` (11 digits) OR `639XXXXXXXXX` (12 digits)
- ❌ Common mistake: `+639XXXXXXXXX` (with +63)

**Check in Supabase:**

```sql
SELECT user_id, first_name, contact_number, status
FROM users
WHERE status IN ('approved', 'rejected')
LIMIT 5;
```

**What to look for:**

- Phone numbers starting with `09` (Philippine)
- Or `63` (without +)
- NOT `+63` or `+6309`

---

#### Issue B: SMS Service Not Running

**Problem:** PhilSMS API token might be invalid or out of credit

**Check PhilSMS Dashboard:**

1. Log in to https://app.philsms.com
2. Go to Dashboard → Check balance
3. Look for recent SMS logs
4. Verify API token hasn't changed

**If token is invalid:**

- Generate new token from PhilSMS dashboard
- Update `.env.local` with new token
- Restart Next.js development server

---

#### Issue C: Missing Notifications Table

**Problem:** SMS log is failing silently, but SMS might have been sent

**Check if table exists:**

```sql
SELECT * FROM sms_notifications LIMIT 10;
```

**If table doesn't exist, create it:**

```sql
CREATE TABLE IF NOT EXISTS sms_notifications (
  id SERIAL PRIMARY KEY,
  user_id UUID REFERENCES users(user_id),
  notification_type VARCHAR(50) NOT NULL,
  message TEXT NOT NULL,
  phone_number VARCHAR(20) NOT NULL,
  sent_at TIMESTAMP DEFAULT NOW(),
  status VARCHAR(20) DEFAULT 'sent',
  error_message TEXT
);

CREATE INDEX idx_sms_notifications_user_id ON sms_notifications(user_id);
CREATE INDEX idx_sms_notifications_sent_at ON sms_notifications(sent_at DESC);
```

---

#### Issue D: Browser Console Errors

**Steps to check:**

1. Open browser Developer Tools (F12)
2. Go to Console tab
3. Approve/reject a registration
4. Look for red errors or warnings
5. Check Network tab for API response

**What to look for:**

```
// GOOD response:
{success: true, message: "Resident notified successfully"}

// BAD responses:
{success: false, error: "..."}
404 Not Found
500 Internal Server Error
```

---

### 3. Test SMS Manually

**Using cURL (replace with actual values):**

```bash
curl -X POST http://localhost:3000/api/send-sms \
  -H "Content-Type: application/json" \
  -d '{
    "to": "09171234567",
    "message": "Test message from Track the Truck"
  }'
```

**Expected response:**

```json
{
  "success": true,
  "message": "SMS sent successfully",
  "data": { ... }
}
```

**If error, check response for:**

- `"SMS service not configured"` → Missing API token
- `"Invalid phone number"` → Wrong format
- `"Invalid or expired token"` → Token issue
- `"Insufficient balance"` → Out of credits

---

## Common Fixes

### Fix 1: Format Phone Numbers

If residents are entering `+63` format, strip it:

```javascript
// In registration-status/route.ts, after getting resident:
let phoneNumber = resident.contact_number;

// Remove +63 and add 0
if (phoneNumber.startsWith("+63")) {
  phoneNumber = "0" + phoneNumber.slice(3);
}

// Or standardize to 63 format
if (phoneNumber.startsWith("0")) {
  phoneNumber = "63" + phoneNumber.slice(1);
}
```

### Fix 2: Add Error Logging

Modify [app/api/notifications/registration-status/route.ts](app/api/notifications/registration-status/route.ts):

```typescript
// After SMS response
const smsResult = await smsResponse.json();

// ADD THIS:
console.log("SMS Response Status:", smsResponse.status);
console.log("SMS Result:", smsResult);

if (!smsResult.success) {
  console.error("SMS Failed for", resident.contact_number, smsResult.error);
}
```

### Fix 3: Check Environment Variables

Restart Next.js if env vars were recently changed:

```bash
# Stop the server (Ctrl+C)
# Then restart
npm run dev
```

---

## Step-by-Step Troubleshooting

### Step 1: Verify Environment Configuration

```bash
# In terminal where you run Next.js, check if you see:
# No errors about missing PHILSMS_API_TOKEN
```

### Step 2: Create Test Account

1. Register a new resident account
2. Use phone: `09171234567` (test format)
3. BWMC approves it
4. Check if SMS received

### Step 3: Check Supabase Logs

```sql
-- See if SMS notification was recorded
SELECT * FROM sms_notifications
ORDER BY sent_at DESC
LIMIT 5;

-- See what phone was attempted
SELECT contact_number, status, first_name, last_name
FROM users
WHERE created_at > NOW() - INTERVAL '1 day'
ORDER BY created_at DESC;
```

### Step 4: Check PhilSMS Dashboard

1. Log in to https://app.philsms.com
2. Go to SMS Logs
3. Look for recent messages
4. Check status (Sent, Failed, Pending)
5. Note any error codes

### Step 5: Check Browser Console

1. Open F12 Developer Tools
2. Go to Console tab
3. Try approving/rejecting again
4. Copy any error messages
5. Note Network tab responses

---

## Possible Root Causes & Solutions

| Issue                                 | Cause                     | Solution                                     |
| ------------------------------------- | ------------------------- | -------------------------------------------- |
| **No SMS received**                   | Phone format wrong        | Verify format: `09XXXXXXXXX`                 |
| **No SMS received**                   | Out of PhilSMS credits    | Top up account at https://app.philsms.com    |
| **No SMS received**                   | Invalid API token         | Generate new token and update `.env.local`   |
| **No SMS received**                   | Endpoint not called       | Check browser console for errors             |
| **SMS shows "Sent" but not received** | PhilSMS provider issue    | Check PhilSMS status page or contact support |
| **API returns 500 error**             | Supabase connection issue | Check if table exists, credentials valid     |
| **Endpoint returns 404**              | File not found            | Ensure route.ts file exists at correct path  |

---

## Files to Review

1. **[app/dashboard/bwmc/page.tsx](app/dashboard/bwmc/page.tsx#L290-L340)**
   - `handleApproveReject` function
   - Calls notification endpoint

2. **[app/api/notifications/registration-status/route.ts](app/api/notifications/registration-status/route.ts)**
   - Gets resident details
   - Calls send-sms endpoint
   - Logs to sms_notifications table

3. **[app/api/send-sms/route.ts](app/api/send-sms/route.ts)**
   - Sends to PhilSMS API
   - Returns success/error

4. **[lib/sms.js](lib/sms.js)**
   - Helper function used by other endpoints
   - Direct PhilSMS integration

5. **[.env.local](.env.local)**
   - `PHILSMS_API_TOKEN` - Must be set
   - `PHILSMS_SENDER_ID` - Should be "PhilSMS"

---

## Database Query to Find Issues

```sql
-- Find recent registration approvals with SMS status
SELECT
  u.user_id,
  u.first_name,
  u.last_name,
  u.contact_number,
  u.status,
  s.notification_type,
  s.status as sms_status,
  s.error_message,
  s.sent_at
FROM users u
LEFT JOIN sms_notifications s ON u.user_id = s.user_id
WHERE u.status IN ('approved', 'rejected')
  AND u.created_at > NOW() - INTERVAL '7 days'
ORDER BY s.sent_at DESC NULLS LAST;
```

---

## Next Steps

1. **Immediate:** Check browser console F12 when approving/rejecting
2. **Then:** Verify phone number format in Supabase
3. **Then:** Check PhilSMS dashboard for SMS logs
4. **Finally:** Check SMS notifications table in Supabase

**Please share:**

- Phone number format being used (with example)
- Browser console error messages (if any)
- PhilSMS dashboard SMS logs (if visible)
- Response from manual SMS test (see section above)

This will help identify the exact issue!
