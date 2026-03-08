# SMS Notification System - Implementation Guide

## Overview

This system implements SMS notifications for all key use cases in the Track the Truck application using PhilSMS.

## Notification Types Implemented

### 1. MANAGE ACCOUNT USE CASE

#### 1.1 Resident Registration Notification

**Endpoint:** `POST /api/notifications/resident-registration`

**When:** After a resident completes registration
**Recipient:** BWMC of the resident's barangay
**Message:** "New resident registration pending approval: [Name]. Please log in to the system to review and approve. - Track the Truck"

**Usage Example:**

```typescript
// After resident submits registration
await fetch("/api/notifications/resident-registration", {
  method: "POST",
  headers: { "Content-Type": "application/json" },
  body: JSON.stringify({
    userId: newUser.user_id,
    residentName: `${firstName} ${lastName}`,
    barangayId: selectedBarangay,
  }),
});
```

---

### 2. MANAGE GARBAGE COLLECTION SCHEDULE USE CASE

#### 2.1 Schedule Update/Archive Notification

**Endpoint:** `POST /api/notifications/schedule-update`

**When:** Secretary updates or archives a schedule
**Recipients:** Assigned GCP + All residents in the barangay
**Messages:**

- **Updated:** "UPDATE: Garbage collection schedule has been changed. New schedule: [Date] at [Time]. - Track the Truck"
- **Archived:** "NOTICE: The garbage collection schedule for [Date] has been cancelled. You will be notified of the new schedule. - Track the Truck"

**Usage Example:**

```typescript
// When secretary updates/archives schedule
await fetch("/api/notifications/schedule-update", {
  method: "POST",
  headers: { "Content-Type": "application/json" },
  body: JSON.stringify({
    scheduleId: schedule.schedule_id,
    barangayId: schedule.barangay_id,
    updateType: "updated", // or 'archived'
    scheduleDate: "2026-02-15",
    scheduleTime: "8:00 AM",
  }),
});
```

#### 2.2 GCP Assignment Notification

**Endpoint:** `POST /api/notifications/gcp-assignment`

**When:** Secretary assigns GCP to a collection schedule
**Recipient:** Assigned GCP
**Message:** "You have been assigned to a garbage collection schedule. Barangay: [Name], Date: [Date], Time: [Time]. Please check the system for details. - Track the Truck"

**Usage Example:**

```typescript
// After creating/updating schedule with GCP assignment
await fetch("/api/notifications/gcp-assignment", {
  method: "POST",
  headers: { "Content-Type": "application/json" },
  body: JSON.stringify({
    gcpId: selectedGCP,
    scheduleDate: "2026-02-15",
    scheduleTime: "8:00 AM",
    barangayName: "Dampas",
  }),
});
```

---

### 3. MANAGE GARBAGE COLLECTION USE CASE

#### 3.1 Collection Status Notification

**Endpoint:** `POST /api/notifications/collection-status`

**When:** Collection status changes
**Recipients:** All residents in the barangay
**Messages:**

- **Started:** "Garbage collection has started in your area! The truck is now in your barangay. Please prepare your waste. - Track the Truck"
- **Ongoing:** "Garbage collection is now ongoing in your barangay. You can track the truck's location in real-time through the app. - Track the Truck"
- **Delayed:** "The garbage collection truck is delayed. Reason: [Reason]. We apologize for the inconvenience. - Track the Truck"
- **Completed:** "Garbage collection in your barangay has been completed. Thank you for your cooperation! - Track the Truck"

**Usage Example:**

```typescript
// When collection status changes (auto-detected via GPS)
await fetch("/api/notifications/collection-status", {
  method: "POST",
  headers: { "Content-Type": "application/json" },
  body: JSON.stringify({
    scheduleId: schedule.schedule_id,
    status: "ongoing", // 'started', 'ongoing', 'delayed', 'completed'
    barangayId: schedule.barangay_id,
    reason: "Heavy traffic", // Optional, for delayed status
  }),
});
```

#### 3.2 Truck Arrival Notification (Already Implemented)

**Endpoint:** `POST /api/notifications/truck-arrival`

**When:** Truck is within 500m of resident
**Recipients:** Nearby residents
**Message:** "Hi [Name]! A garbage truck will arrive at your location in approximately [ETA] minutes. Please prepare your waste for collection. - Track the Truck"

**Usage Example:**

```typescript
// Called automatically when truck location updates
await fetch("/api/notifications/truck-arrival", {
  method: "POST",
  headers: { "Content-Type": "application/json" },
  body: JSON.stringify({
    truckId: 1,
    latitude: 9.6556,
    longitude: 123.8521,
  }),
});
```

#### 3.3 Missed Collection Notification

**Endpoint:** `POST /api/notifications/collection-missed`

**When:** Truck doesn't enter barangay or leaves without starting collection
**Recipients:** SWMO/TCEMO Secretary, BWMC, and all residents in the barangay
**Messages:**

- **Staff:** "ALERT: Garbage collection was MISSED in [Barangay]. The truck did not enter or complete the scheduled collection. Please review and reschedule. - Track the Truck"
- **Residents:** "NOTICE: The scheduled garbage collection for [Barangay] was missed today. We apologize for the inconvenience. You will be notified of the rescheduled collection. - Track the Truck"

**Usage Example:**

```typescript
// Auto-triggered by GPS monitoring system
await fetch("/api/notifications/collection-missed", {
  method: "POST",
  headers: { "Content-Type": "application/json" },
  body: JSON.stringify({
    scheduleId: schedule.schedule_id,
    barangayId: schedule.barangay_id,
    barangayName: "Dampas",
  }),
});
```

---

### 4. MANAGE GARBAGE-RELATED INCIDENTS USE CASE

#### 4.1 Incident Report Submission Notification

**Endpoint:** `POST /api/notifications/incident-report`

**When:** Resident submits an incident report
**Recipient:** BWMC of the barangay
**Message:** "New incident report submitted by [Name]. Location: [Location]. Report ID: #[ID]. Please review and take action. - Track the Truck"

**Usage Example:**

```typescript
// After resident submits incident report
await fetch("/api/notifications/incident-report", {
  method: "POST",
  headers: { "Content-Type": "application/json" },
  body: JSON.stringify({
    reportId: report.report_id,
    barangayId: report.barangay_id,
    location: report.location,
    reporterName: `${user.first_name} ${user.last_name}`,
  }),
});
```

#### 4.2 Incident Action Required Notification

**Endpoint:** `POST /api/notifications/incident-action`

**When:** BWMC validates report and forwards to SWMO/GCP
**Recipient:** Assigned GCP
**Message:** "Incident Report #[ID] requires your action. Location: [Location]. Description: [Description]. Please respond accordingly. - Track the Truck"

**Usage Example:**

```typescript
// When BWMC validates and forwards to GCP
await fetch("/api/notifications/incident-action", {
  method: "POST",
  headers: { "Content-Type": "application/json" },
  body: JSON.stringify({
    reportId: report.report_id,
    gcpId: assignedGCP,
    location: report.location,
    description: report.description,
  }),
});
```

#### 4.3 Incident Status Update Notification

**Endpoint:** `POST /api/notifications/incident-status`

**When:** Incident report status changes
**Recipient:** Resident who submitted the report
**Messages:**

- **Acknowledged:** "Your incident report #[ID] has been acknowledged and is under review. Thank you for reporting! - Track the Truck"
- **Needs Action:** "Your incident report #[ID] has been validated and forwarded to SWMO for action. You will be notified of updates. - Track the Truck"
- **Ongoing:** "Action is being taken on your incident report #[ID]. Our team is working to resolve the issue. - Track the Truck"
- **Resolved:** "Your incident report #[ID] has been resolved. Action taken: [Details]. Thank you for your report! - Track the Truck"
- **Rejected:** "Your incident report #[ID] has been reviewed. Reason: [Reason]. - Track the Truck"

**Usage Example:**

```typescript
// When status is updated by BWMC/Secretary/GCP
await fetch("/api/notifications/incident-status", {
  method: "POST",
  headers: { "Content-Type": "application/json" },
  body: JSON.stringify({
    reportId: report.report_id,
    userId: report.user_id,
    status: "resolved", // 'acknowledged', 'needs_action', 'ongoing', 'resolved', 'rejected'
    reason: "Lacks photo evidence", // Optional, for rejected
    actionTaken: "Area cleaned by barangay crew", // Optional, for resolved
  }),
});
```

---

## Integration Points by Dashboard

### Resident Dashboard

1. After registration → Call `resident-registration` endpoint
2. After submitting incident report → Call `incident-report` endpoint
3. Receive status updates on incidents via `incident-status`

### BWMC Dashboard

1. When approving/rejecting reports → Call `incident-status` endpoint
2. When forwarding to SWMO → Call `incident-action` endpoint

### Secretary Dashboard

1. When creating/updating schedules → Call `schedule-update` and `gcp-assignment` endpoints
2. When archiving schedules → Call `schedule-update` endpoint

### GCP Dashboard

1. Receives notifications from `gcp-assignment` and `incident-action`
2. When updating incident status → Call `incident-status` endpoint

### GPS Monitoring System (Automatic)

1. When truck enters barangay → Call `collection-status` with status='started'
2. When truck is within 500m of residents → Call `truck-arrival`
3. When truck is delayed → Call `collection-status` with status='delayed'
4. When truck exits barangay → Call `collection-status` with status='completed'
5. When collection is missed → Call `collection-missed`

---

## Database Requirements

Ensure the `sms_notifications` table exists:

```sql
CREATE TABLE IF NOT EXISTS sms_notifications (
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

CREATE INDEX idx_sms_notifications_user_id ON sms_notifications(user_id);
CREATE INDEX idx_sms_notifications_sent_at ON sms_notifications(sent_at);
CREATE INDEX idx_sms_notifications_type ON sms_notifications(notification_type);
```

Add notification preference to users:

```sql
ALTER TABLE users
ADD COLUMN IF NOT EXISTS notification_enabled BOOLEAN DEFAULT true;
```

---

## Testing Guide

### Test Each Notification Type

```bash
# 1. Test Resident Registration
curl -X POST http://localhost:3000/api/notifications/resident-registration \
  -H "Content-Type: application/json" \
  -d '{"userId":"user-123","residentName":"Juan Dela Cruz","barangayId":4}'

# 2. Test Schedule Update
curl -X POST http://localhost:3000/api/notifications/schedule-update \
  -H "Content-Type: application/json" \
  -d '{"scheduleId":1,"barangayId":4,"updateType":"updated","scheduleDate":"2026-02-15","scheduleTime":"8:00 AM"}'

# 3. Test Collection Status
curl -X POST http://localhost:3000/api/notifications/collection-status \
  -H "Content-Type: application/json" \
  -d '{"scheduleId":1,"status":"ongoing","barangayId":4}'

# 4. Test Missed Collection
curl -X POST http://localhost:3000/api/notifications/collection-missed \
  -H "Content-Type: application/json" \
  -d '{"scheduleId":1,"barangayId":4,"barangayName":"Dampas"}'

# 5. Test GCP Assignment
curl -X POST http://localhost:3000/api/notifications/gcp-assignment \
  -H "Content-Type: application/json" \
  -d '{"gcpId":"gcp-123","scheduleDate":"2026-02-15","scheduleTime":"8:00 AM","barangayName":"Dampas"}'

# 6. Test Incident Report
curl -X POST http://localhost:3000/api/notifications/incident-report \
  -H "Content-Type: application/json" \
  -d '{"reportId":"INC-001","barangayId":4,"location":"Dampas St.","reporterName":"Maria Santos"}'

# 7. Test Incident Action
curl -X POST http://localhost:3000/api/notifications/incident-action \
  -H "Content-Type: application/json" \
  -d '{"reportId":"INC-001","gcpId":"gcp-123","location":"Dampas St.","description":"Overflowing garbage"}'

# 8. Test Incident Status
curl -X POST http://localhost:3000/api/notifications/incident-status \
  -H "Content-Type: application/json" \
  -d '{"reportId":"INC-001","userId":"user-123","status":"resolved","actionTaken":"Area cleaned"}'
```

---

## Message Character Limits

PhilSMS charges per 160 characters. Current messages are optimized to stay within:

- Single SMS (≤160 chars): Most status updates
- Double SMS (161-320 chars): Detailed notifications with reasons

---

## Notification Flow Diagram

```
RESIDENT REGISTRATION
Resident → Register → System → SMS to BWMC → BWMC Reviews

SCHEDULE MANAGEMENT
Secretary → Create/Update → System → SMS to GCP & Residents

COLLECTION PROCESS
Truck GPS → System Detects Entry → SMS to Residents (Started)
         → System Monitors → SMS to Residents (Status Updates)
         → System Detects Exit → SMS to Residents (Completed)
         → No Entry Detected → SMS to Secretary, BWMC, Residents (Missed)

INCIDENT REPORTING
Resident → Submit Report → SMS to BWMC → BWMC Validates → SMS to GCP
                                                        → GCP Takes Action
                                                        → SMS to Resident (Updates)
```

---

## Best Practices

1. **Rate Limiting:** Avoid sending duplicate notifications within 30 minutes
2. **Error Handling:** Log failed SMS attempts for retry
3. **User Preferences:** Respect `notification_enabled` flag
4. **Testing:** Always test with real phone numbers before production
5. **Monitoring:** Track SMS delivery rates and costs
6. **Message Content:** Keep messages clear, concise, and action-oriented

---

## Support

For issues or questions:

- Check PhilSMS dashboard for delivery status
- Review `sms_notifications` table for sent messages
- Check application logs for API errors
