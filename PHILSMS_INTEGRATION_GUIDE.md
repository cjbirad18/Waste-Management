# PhilSMS Integration Guide for Track the Truck

## Overview

This system now uses PhilSMS for sending SMS notifications to residents and staff about truck arrivals, schedules, and incidents.

## 1. Get PhilSMS API Credentials

### Sign Up for PhilSMS

1. Go to https://www.philsms.com/
2. Register for an account
3. Verify your account
4. Top up your account with SMS credits

### Get API Token

1. Login to PhilSMS dashboard
2. Go to **API Settings** or **Developer** section
3. Copy your **API Token**
4. (Optional) Register a **Sender ID** for branded SMS

## 2. Configure Environment Variables

Add these to your `.env.local` file:

```env
# PhilSMS Configuration
PHILSMS_API_TOKEN=your_api_token_here
PHILSMS_SENDER_ID=TrackTruck

# App URL (for API callbacks)
NEXT_PUBLIC_APP_URL=http://localhost:3000  # Change to your production URL
```

## 3. Database Setup

Create a table to log SMS notifications (optional but recommended):

```sql
CREATE TABLE sms_notifications (
  id SERIAL PRIMARY KEY,
  user_id UUID REFERENCES users(user_id),
  notification_type VARCHAR(50) NOT NULL,
  message TEXT NOT NULL,
  phone_number VARCHAR(20) NOT NULL,
  sent_at TIMESTAMP DEFAULT NOW(),
  status VARCHAR(20) DEFAULT 'sent',
  error_message TEXT,
  created_at TIMESTAMP DEFAULT NOW()
);

-- Add index for faster queries
CREATE INDEX idx_sms_notifications_user_id ON sms_notifications(user_id);
CREATE INDEX idx_sms_notifications_sent_at ON sms_notifications(sent_at);
CREATE INDEX idx_sms_notifications_type ON sms_notifications(notification_type);
```

Add notification preference to users table:

```sql
ALTER TABLE users
ADD COLUMN notification_enabled BOOLEAN DEFAULT true;
```

## 4. Available Notification Types

### 4.1 Truck Arrival Notifications

Automatically notify residents when a truck is nearby (within 500m).

**API Endpoint:** `POST /api/notifications/truck-arrival`

**Usage in GCP Dashboard:**

```typescript
// When truck location updates
const response = await fetch("/api/notifications/truck-arrival", {
  method: "POST",
  headers: { "Content-Type": "application/json" },
  body: JSON.stringify({
    truckId: 1,
    latitude: 9.6556,
    longitude: 123.8521,
  }),
});
```

### 4.2 Collection Schedule Notifications

Notify residents about upcoming collection schedules.

**Usage in Secretary Dashboard:**

```typescript
import { notifyCollectionSchedule } from "@/lib/smsNotifications";

await notifyCollectionSchedule(
  { name: "Juan Dela Cruz", phoneNumber: "09171234567" },
  "Dampas",
  "2026-02-15",
  "8:00 AM",
);
```

### 4.3 Incident Report Acknowledgment

Send confirmation when incident reports are received.

**Usage in Resident Dashboard:**

```typescript
import { notifyIncidentAcknowledged } from "@/lib/smsNotifications";

await notifyIncidentAcknowledged(
  { name: "Maria Santos", phoneNumber: "09181234567" },
  "INC-001",
  "acknowledged",
);
```

### 4.4 Emergency Alerts

Send urgent notifications to SWMO staff.

**Usage in System:**

```typescript
import { notifyEmergencyIncident } from "@/lib/smsNotifications";

await notifyEmergencyIncident(
  { name: "SWMO Head", phoneNumber: "09191234567" },
  "Dampas, Tagbilaran",
  "Overflowing garbage near market area",
);
```

## 5. Send SMS Manually

### Basic Usage

```typescript
// In any component or API route
const response = await fetch("/api/send-sms", {
  method: "POST",
  headers: { "Content-Type": "application/json" },
  body: JSON.stringify({
    to: "09171234567", // or '639171234567'
    message: "Hello from Track the Truck!",
  }),
});

const result = await response.json();
if (result.success) {
  console.log("SMS sent successfully!");
}
```

### Using Helper Functions

```typescript
import { sendSMS } from "@/lib/sms";

try {
  await sendSMS("09171234567", "Your custom message here");
  console.log("SMS sent!");
} catch (error) {
  console.error("Failed to send SMS:", error);
}
```

## 6. Phone Number Validation

Use the built-in validators:

```typescript
import { formatPhoneNumber, isValidPhoneNumber } from "@/lib/smsNotifications";

const phone = formatPhoneNumber("917-123-4567"); // Returns: 09171234567
const isValid = isValidPhoneNumber("09171234567"); // Returns: true
```

## 7. Testing

### Test SMS Sending

```bash
# Using curl
curl -X POST http://localhost:3000/api/send-sms \
  -H "Content-Type: application/json" \
  -d '{"to":"09171234567","message":"Test message"}'
```

### Check Response

Successful response:

```json
{
  "success": true,
  "message": "SMS sent successfully",
  "data": {
    "message_id": "xxx",
    "status": "queued"
  }
}
```

Error response:

```json
{
  "success": false,
  "error": "Invalid phone number"
}
```

## 8. Cost Considerations

- PhilSMS charges per SMS sent
- Each SMS is typically 160 characters (longer messages are split)
- Monitor your credit balance in the PhilSMS dashboard
- Set up low balance alerts

## 9. Best Practices

1. **Avoid Spam:** Don't send the same notification multiple times within 30 minutes
2. **Validate Numbers:** Always validate phone numbers before sending
3. **Keep Messages Short:** Stay within 160 characters when possible
4. **Add Sender ID:** Use a recognizable sender name
5. **Log Notifications:** Track all sent notifications in the database
6. **Error Handling:** Always wrap SMS calls in try-catch blocks
7. **Rate Limiting:** Implement rate limiting for API endpoints
8. **User Preferences:** Respect user's notification preferences

## 10. Troubleshooting

### SMS Not Sending

1. Check if `PHILSMS_API_TOKEN` is set correctly
2. Verify phone number format (09XXXXXXXXX or 639XXXXXXXXX)
3. Check PhilSMS dashboard for error logs
4. Ensure you have sufficient credits

### Invalid Credentials

- Double-check your API token in .env.local
- Regenerate token from PhilSMS dashboard if needed

### Rate Limiting

- PhilSMS may have rate limits
- Implement delays between bulk messages
- Use the `sendBulkNotifications` function for better handling

## 11. Production Deployment

Before going live:

1. ✅ Replace `NEXT_PUBLIC_APP_URL` with your production domain
2. ✅ Test all notification types thoroughly
3. ✅ Set up database tables for logging
4. ✅ Configure proper error monitoring
5. ✅ Add SMS credit balance monitoring
6. ✅ Review and optimize message content
7. ✅ Set up user notification preferences UI

## 12. Example Integration Points

### In Resident Dashboard (when truck is near)

```typescript
// app/dashboard/resident/page.tsx
useEffect(() => {
  if (etaMinutes && etaMinutes <= 5 && !notificationSent) {
    // Send notification once when ETA is 5 minutes or less
    fetch("/api/notifications/truck-arrival", {
      method: "POST",
      body: JSON.stringify({ truckId: 1, latitude, longitude }),
    });
    setNotificationSent(true);
  }
}, [etaMinutes]);
```

### In Incident Report Form

```typescript
const handleSubmitIncident = async (formData) => {
  // Submit incident
  const incident = await submitIncident(formData);

  // Send confirmation SMS
  await fetch("/api/send-sms", {
    method: "POST",
    body: JSON.stringify({
      to: userPhone,
      message: `Your incident report #${incident.id} has been received. Thank you!`,
    }),
  });
};
```

## Support

For PhilSMS support:

- Website: https://www.philsms.com/
- Email: support@philsms.com
- Documentation: https://www.philsms.com/api-docs

For system integration issues:

- Check application logs
- Review API response errors
- Verify database connectivity
