# SMS Notification System - Complete Guide

## Overview

This system uses PhilSMS to send SMS notifications for all use cases in the Track the Truck system. All 14 notification endpoints are fully implemented and ready for integration.

---

## Complete Notification Endpoints

### 1. Account Created Notification

**Endpoint:** `/api/notifications/account-created`  
**Method:** POST  
**Use Case:** Manage Account - When SWMO Head or TCEMO Head creates staff accounts  
**Recipients:** Newly created user (TCEMO Head, BWMC, Secretary, GCP)

**Request Body:**

```json
{
  "userId": "uuid",
  "role": "BWMC" | "TCEMO Head" | "SWMO/TCEMO Secretary" | "GCP",
  "createdBy": "SWMO Head" | "TCEMO Head",
  "tempPassword": "temp123" // optional
}
```

**Message Example:**

```
Welcome to Track the Truck! Your account has been created by SWMO Head.

Role: Barangay Waste Management Committee member
Username: 09171234567
Temporary Password: temp123

Please login and change your password immediately for security.
```

**Integration Points:**

- SWMO Head dashboard when creating accounts
- Account management forms

---

### 2. Admin Transfer Notification

**Endpoint:** `/api/notifications/admin-transfer`  
**Method:** POST  
**Use Case:** Manage Account - When TCEMO Head appoints new SWMO Head  
**Recipients:** New admin AND previous admin (both notified)

**Request Body:**

```json
{
  "newAdminId": "uuid",
  "previousAdminId": "uuid",
  "transferredBy": "TCEMO Head",
  "tempPassword": "temp123"
}
```

**Message Example (New Admin):**

```
Track the Truck - Admin Account Created

Dear Juan Dela Cruz,

You have been appointed as the new SWMO Head (Administrator) by TCEMO Head.

Login Credentials:
Username: 09171234567
Temporary Password: temp123

Please login immediately and change your password.

You now have full administrative access to manage user accounts, schedules, and system operations.
```

**Message Example (Previous Admin):**

```
Track the Truck - Admin Transfer Notice

Dear Maria Santos,

Your SWMO Head (Administrator) account has been transferred to a new administrator.

New Admin: Juan Dela Cruz
Transferred by: TCEMO Head

Your previous account has been deactivated. Thank you for your service.

If you have any questions, please contact the TCEMO Head.
```

**Integration Points:**

- TCEMO Head dashboard when creating new admin
- Admin transfer forms

---

### 3. Account Deactivation Notification

**Endpoint:** `/api/notifications/account-deactivated`  
**Method:** POST  
**Use Case:** Manage Account - When admin account is deactivated  
**Recipients:** Deactivated user

**Request Body:**

```json
{
  "userId": "uuid",
  "reason": "Admin transfer completed", // optional
  "deactivatedBy": "TCEMO Head"
}
```

**Message Example:**

```
Track the Truck - Account Deactivation Notice

Dear Maria Santos,

Your account has been deactivated by TCEMO Head.

Reason: Admin transfer completed

You will no longer have access to the system. If you believe this is an error, please contact the administrator.
```

**Integration Points:**

- Admin transfer process (automatic)
- Account management when deactivating users

---

### 4. Registration Status Notification

**Endpoint:** `/api/notifications/registration-status`  
**Method:** POST  
**Use Case:** Manage Account - When BWMC approves/rejects resident registration  
**Recipients:** Resident

**Request Body:**

```json
{
  "userId": "uuid",
  "status": "approved" | "rejected",
  "reason": "Incomplete address" // optional, for rejections
}
```

**Message Example (Approved):**

```
Welcome to Track the Truck, Juan Dela Cruz! Your account has been approved by BWMC.

You can now login to view garbage collection schedules, track trucks in real-time, and report incidents.

Login at: http://localhost:3000/login
```

**Message Example (Rejected):**

```
Your registration for Track the Truck has been reviewed.

Reason: Incomplete address

Please register again with complete and accurate information.
```

**Integration Points:**

- ✅ BWMC dashboard (already integrated in `handleApproveReject()`)

---

### 5. Resident Registration Notification

**Endpoint:** `/api/notifications/resident-registration`  
**Method:** POST  
**Use Case:** Manage Account - When resident registers  
**Recipients:** BWMC of the resident's barangay

**Request Body:**

```json
{
  "userId": "uuid",
  "barangayId": "uuid"
}
```

**Message Example:**

```
New resident registration pending approval:

Name: Juan Dela Cruz
Address: Purok 1, Barangay Cogon
Phone: 09171234567
Email: juan@example.com

Please review and validate this registration in your BWMC dashboard.
```

**Integration Points:**

- Registration form submission
- After resident completes registration

---

### 6. Schedule Approval Notification

**Endpoint:** `/api/notifications/schedule-approval`  
**Method:** POST  
**Use Case:** Manage Schedule - When SWMO Head approves/rejects schedule  
**Recipients:** SWMO/TCEMO Secretary (schedule creator)

**Request Body:**

```json
{
  "scheduleId": "uuid",
  "approvedBy": "SWMO Head",
  "status": "approved" | "rejected",
  "remarks": "Please assign backup driver" // optional
}
```

**Message Example (Approved):**

```
Track the Truck - Schedule Approved

Dear Maria Santos,

The garbage collection schedule you submitted has been approved by SWMO Head.

Schedule Details:
- Barangay: Cogon
- Date: January 15, 2026
- Schedule ID: abc-123

The schedule is now active and visible to GCP and residents.
```

**Message Example (Rejected):**

```
Track the Truck - Schedule Rejected

Dear Maria Santos,

The garbage collection schedule you submitted has been rejected by SWMO Head.

Schedule Details:
- Barangay: Cogon
- Date: January 15, 2026
- Schedule ID: abc-123

Remarks: Please assign backup driver

Please review and resubmit the schedule with necessary corrections.
```

**Integration Points:**

- SWMO Head dashboard when approving schedules
- Schedule review forms

---

### 7. Schedule Update Notification

**Endpoint:** `/api/notifications/schedule-update`  
**Method:** POST  
**Use Case:** Manage Schedule - When schedule is created/updated/archived  
**Recipients:** Assigned GCP + All residents in barangay

**Request Body:**

```json
{
  "scheduleId": "uuid",
  "action": "created" | "updated" | "archived",
  "barangayId": "uuid"
}
```

**Message Example (Created):**

```
Track the Truck - New Schedule

A new garbage collection schedule has been created for your barangay.

Barangay: Cogon
Date: January 15, 2026
Assigned Personnel: 3 collectors, 2 drivers

Login to view full details and track the truck on collection day.
```

**Message Example (Updated):**

```
Track the Truck - Schedule Updated

The garbage collection schedule for your barangay has been updated.

Barangay: Cogon
Date: January 15, 2026

Please check the system for updated details.
```

**Message Example (Archived):**

```
Track the Truck - Schedule Archived

The garbage collection schedule for January 15, 2026 in Barangay Cogon has been archived.

Reason: Emergency rescheduling

Please check the system for the new schedule.
```

**Integration Points:**

- Secretary dashboard when creating/updating schedules
- Schedule management forms
- Archive schedule functionality

---

### 8. GCP Assignment Notification

**Endpoint:** `/api/notifications/gcp-assignment`  
**Method:** POST  
**Use Case:** Manage Schedule - When GCP is assigned to schedule  
**Recipients:** Assigned GCP (drivers and collectors)

**Request Body:**

```json
{
  "scheduleId": "uuid",
  "gcpId": "uuid"
}
```

**Message Example:**

```
You have been assigned to a garbage collection schedule.

Barangay: Cogon
Date: January 15, 2026, 6:00 AM
Role: Driver

Please check the system for route details and prepare for the collection.
```

**Integration Points:**

- Secretary dashboard when assigning GCP
- Schedule creation/update forms

---

### 9. Truck Arrival Notification

**Endpoint:** `/api/notifications/truck-arrival`  
**Method:** POST  
**Use Case:** Manage Collection - When truck is within 500m of resident  
**Recipients:** Residents near truck location

**Request Body:**

```json
{
  "scheduleId": "uuid",
  "barangayId": "uuid",
  "truckLocation": {
    "latitude": 9.6411,
    "longitude": 123.8498
  }
}
```

**Message Example:**

```
Track the Truck Alert!

The garbage collection truck is approaching your location (within 500 meters).

Estimated arrival: 5-10 minutes

Please prepare your garbage for collection.
```

**Integration Points:**

- ✅ leafletmap.tsx GPS tracking (automatic based on distance)
- Haversine calculation triggers when truck < 500m from resident

---

### 10. Collection Status Notification

**Endpoint:** `/api/notifications/collection-status`  
**Method:** POST  
**Use Case:** Manage Collection - Status updates during collection  
**Recipients:** All residents in barangay

**Request Body:**

```json
{
  "scheduleId": "uuid",
  "barangayId": "uuid",
  "status": "started" | "ongoing" | "delayed" | "completed",
  "reason": "Heavy traffic" // optional, for delays
}
```

**Message Examples:**

**Started:**

```
Garbage collection has started in your area!

The truck is on its way to Barangay Cogon.

Track the truck's real-time location in the app.
```

**Ongoing:**

```
Garbage collection is now ongoing in your barangay!

Track the truck's location in real-time and prepare your garbage for pickup.
```

**Delayed:**

```
The garbage collection truck is delayed.

Reason: Heavy traffic

We apologize for the inconvenience. Please stand by.
```

**Completed:**

```
Garbage collection in your barangay has been completed.

Thank you for your cooperation! Next schedule: January 22, 2026
```

**Integration Points:**

- ✅ leafletmap.tsx GPS tracking (already integrated)
  - Ongoing: When truck enters barangay
  - Completed: When truck exits barangay (after 20 min)
- GCP dashboard when updating delay reasons

---

### 11. Collection Missed Notification

**Endpoint:** `/api/notifications/collection-missed`  
**Method:** POST  
**Use Case:** Manage Collection - When truck misses scheduled collection  
**Recipients:** SWMO/TCEMO Secretary, BWMC, all residents

**Request Body:**

```json
{
  "scheduleId": "uuid",
  "barangayId": "uuid",
  "reason": "Truck breakdown"
}
```

**Message Example (Staff):**

```
URGENT: Missed Collection Alert

Schedule ID: abc-123
Barangay: Cogon
Scheduled Date: January 15, 2026
Reason: Truck breakdown

Action Required: Reschedule and notify residents.
```

**Message Example (Residents):**

```
Track the Truck - Collection Missed

We apologize, but the scheduled garbage collection for your barangay could not be completed today.

Reason: Truck breakdown

A new schedule will be announced soon. Thank you for your understanding.
```

**Integration Points:**

- leafletmap.tsx GPS monitoring (automatic detection)
- System checks if truck enters barangay during scheduled window
- Triggers if truck doesn't enter or enters but leaves without starting

---

### 12. Incident Report Notification

**Endpoint:** `/api/notifications/incident-report`  
**Method:** POST  
**Use Case:** Manage Incidents - When resident submits incident report  
**Recipients:** BWMC of the barangay

**Request Body:**

```json
{
  "incidentId": "uuid",
  "reportedBy": "uuid",
  "barangayId": "uuid"
}
```

**Message Example:**

```
New incident report submitted by Juan Dela Cruz.

Location: Purok 1, Cogon
Report ID: #12345

Description: Uncollected garbage for 2 weeks

Please review and validate this report in your BWMC dashboard.
```

**Integration Points:**

- Resident dashboard when submitting incident report
- Incident report form submission

---

### 13. Incident Action Notification

**Endpoint:** `/api/notifications/incident-action`  
**Method:** POST  
**Use Case:** Manage Incidents - When BWMC validates and forwards to SWMO  
**Recipients:** Assigned GCP

**Request Body:**

```json
{
  "incidentId": "uuid",
  "gcpId": "uuid"
}
```

**Message Example:**

```
Incident Report #12345 requires your action.

Location: Purok 1, Cogon
Type: Uncollected Waste

Description: Uncollected garbage for 2 weeks

Please proceed to the location and take appropriate action. Update the status after completion.
```

**Integration Points:**

- BWMC dashboard when validating and forwarding incidents
- SWMO Secretary dashboard when assigning GCP

---

### 14. Incident Status Notification

**Endpoint:** `/api/notifications/incident-status`  
**Method:** POST  
**Use Case:** Manage Incidents - Status updates on incident reports  
**Recipients:** Resident who submitted the report

**Request Body:**

```json
{
  "incidentId": "uuid",
  "status": "acknowledged" | "needs_action" | "ongoing" | "resolved" | "rejected",
  "reason": "Duplicate report", // optional, for rejections
  "actionTaken": "Collected 10 bags of waste" // optional, for resolutions
}
```

**Message Examples:**

**Acknowledged:**

```
Your incident report #12345 has been acknowledged by BWMC.

The report is under review. You will receive updates as progress is made.
```

**Needs Action:**

```
Your incident report #12345 has been validated by BWMC.

The issue requires action from the SWMO. A garbage collection team will be assigned shortly.
```

**Ongoing:**

```
Your incident report #12345 is now being addressed.

Garbage collection personnel are on-site taking action.
```

**Resolved:**

```
Your incident report #12345 has been resolved.

Action Taken: Collected 10 bags of waste

Thank you for reporting this issue!
```

**Rejected:**

```
Your incident report #12345 has been rejected.

Reason: Duplicate report

If you believe this is an error, please contact your BWMC.
```

**Integration Points:**

- BWMC dashboard when validating reports
- GCP dashboard when updating incident status
- SWMO Secretary dashboard when resolving city-level incidents

---

## Database Schema

Ensure this table exists in your Supabase database:

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

-- Add index for faster queries
CREATE INDEX idx_sms_notifications_user_id ON sms_notifications(user_id);
CREATE INDEX idx_sms_notifications_type ON sms_notifications(notification_type);
CREATE INDEX idx_sms_notifications_sent_at ON sms_notifications(sent_at DESC);
```

---

## Integration Checklist

### ✅ Already Integrated:

1. **Truck Arrival** - leafletmap.tsx (GPS-based, automatic)
2. **Collection Status** - leafletmap.tsx (ongoing/completed, automatic)
3. **Registration Status** - BWMC dashboard (approval/rejection)

### 📋 Need Integration:

#### SWMO Head Dashboard:

- [ ] Account creation → Call `/api/notifications/account-created`
- [ ] Schedule approval → Call `/api/notifications/schedule-approval`

#### TCEMO Head Dashboard:

- [ ] Admin transfer → Call `/api/notifications/admin-transfer`
- [ ] Account creation → Call `/api/notifications/account-created`

#### SWMO/TCEMO Secretary Dashboard:

- [ ] Schedule creation → Call `/api/notifications/schedule-update` (action: "created")
- [ ] Schedule update → Call `/api/notifications/schedule-update` (action: "updated")
- [ ] Schedule archive → Call `/api/notifications/schedule-update` (action: "archived")
- [ ] GCP assignment → Call `/api/notifications/gcp-assignment`
- [ ] Incident assignment → Call `/api/notifications/incident-action`

#### BWMC Dashboard:

- [ ] Incident validation → Call `/api/notifications/incident-status` (status: "needs_action")
- [ ] Incident rejection → Call `/api/notifications/incident-status` (status: "rejected")
- [ ] Incident resolution → Call `/api/notifications/incident-status` (status: "resolved")

#### GCP Dashboard:

- [ ] Incident status update → Call `/api/notifications/incident-status` (status: "ongoing"/"resolved")
- [ ] Delay reason → Call `/api/notifications/collection-status` (status: "delayed")

#### Resident Dashboard:

- [ ] Registration submission → Call `/api/notifications/resident-registration`
- [ ] Incident submission → Call `/api/notifications/incident-report`

---

## Testing Guide

### 1. Test Individual Endpoint

```bash
curl -X POST http://localhost:3000/api/notifications/account-created \
  -H "Content-Type: application/json" \
  -d '{
    "userId": "user-uuid-here",
    "role": "BWMC",
    "createdBy": "SWMO Head",
    "tempPassword": "temp123"
  }'
```

### 2. Check SMS Logs

```sql
SELECT * FROM sms_notifications
ORDER BY sent_at DESC
LIMIT 10;
```

### 3. Test PhilSMS Balance

```bash
curl -X GET https://app.philsms.com/api/v3/balance \
  -H "Authorization: Bearer YOUR_TOKEN_HERE"
```

---

## Message Character Limits

- **PhilSMS Single SMS**: 160 characters
- **Multi-part SMS**: 153 characters per part
- **Current Implementation**: Messages are 200-400 characters (2-3 parts)
- **Cost Impact**: Multi-part messages cost 2-3 credits per send

**Optimization Tips:**

- Keep messages under 160 characters when possible
- Use abbreviations: "Brgy" instead of "Barangay"
- Remove unnecessary spacing and formatting
- Prioritize critical information first

---

## Notification Flow Summary

### Manage Account Use Case

```
1. SWMO Head creates account → account-created
2. TCEMO Head creates new admin → admin-transfer (2 notifications)
3. Previous admin deactivated → account-deactivated
4. Resident registers → resident-registration (to BWMC)
5. BWMC approves/rejects → registration-status (to resident)
```

### Manage Schedule Use Case

```
1. Secretary creates schedule → schedule-update (created)
2. SWMO Head approves → schedule-approval (to Secretary)
3. GCP assigned → gcp-assignment (to GCP)
4. Schedule updated → schedule-update (updated)
5. Schedule archived → schedule-update (archived)
```

### Manage Collection Use Case

```
1. Collection starts → collection-status (started)
2. Truck approaching (GPS) → truck-arrival (within 500m)
3. Truck enters barangay (GPS) → collection-status (ongoing)
4. Truck delayed → collection-status (delayed)
5. Truck exits barangay (GPS) → collection-status (completed)
6. Collection missed (GPS) → collection-missed (3 recipients)
```

### Manage Incidents Use Case

```
1. Resident submits → incident-report (to BWMC)
2. BWMC acknowledges → incident-status (acknowledged)
3. BWMC validates → incident-status (needs_action)
4. GCP assigned → incident-action (to GCP)
5. GCP acts → incident-status (ongoing)
6. Issue resolved → incident-status (resolved)
7. Report rejected → incident-status (rejected)
```

---

## Best Practices

1. **Always Check User Preferences**
   - Respect `notification_enabled` flag in user settings
   - Don't send if user opted out

2. **Prevent Duplicates**
   - Check last notification timestamp
   - Use 30-minute cooldown for recurring notifications (e.g., truck arrival)

3. **Error Handling**
   - Log all failed SMS attempts
   - Monitor error patterns
   - Set up alerts for high failure rates

4. **Cost Management**
   - Monitor daily SMS usage
   - Set budget alerts in PhilSMS dashboard
   - Optimize message length to reduce multi-part SMS

5. **Testing**
   - Test with your own phone number first
   - Verify message formatting on actual devices
   - Check delivery during peak/off-peak hours

6. **Performance**
   - Use bulk sending for mass notifications
   - Implement queue system for high-volume sends
   - Avoid blocking API responses waiting for SMS

---

## Support & Troubleshooting

### Common Issues:

**1. SMS not received**

- Check PhilSMS balance
- Verify phone number format (+63XXXXXXXXXX)
- Check `sms_notifications` table for error messages
- Verify sender ID is active in PhilSMS dashboard

**2. Duplicate SMS**

- Implement duplicate prevention logic
- Check for multiple API calls from frontend
- Add unique request IDs

**3. High costs**

- Audit message lengths
- Reduce unnecessary notifications
- Optimize message content

**4. Slow delivery**

- Check PhilSMS status page
- Consider priority routing (if available)
- Test at different times of day

---

## System Requirements Mapping

All 14 notification endpoints fully cover:

✅ **Manage Account (5 notifications)**

- Account created
- Admin transfer (new + previous)
- Account deactivated
- Registration status (approved/rejected)
- Resident registration (to BWMC)

✅ **Manage Schedule (3 notifications)**

- Schedule approval
- Schedule update (created/updated/archived)
- GCP assignment

✅ **Manage Collection (3 notifications)**

- Truck arrival (GPS-triggered)
- Collection status (started/ongoing/delayed/completed)
- Collection missed (automatic detection)

✅ **Manage Incidents (3 notifications)**

- Incident report (to BWMC)
- Incident action (to GCP)
- Incident status (to resident)

---

**Last Updated:** February 3, 2026  
**Version:** 2.0  
**Total Endpoints:** 14
