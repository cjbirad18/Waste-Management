// SMS Notification Templates and Helper Functions
import { sendSMS } from "./sms";

export interface NotificationRecipient {
  name: string;
  phoneNumber: string;
}

/**
 * Send truck arrival notification to resident
 */
export async function notifyTruckArrival(
  recipient: NotificationRecipient,
  etaMinutes: number,
) {
  const message = `Hi ${recipient.name}! A garbage truck will arrive at your location in approximately ${etaMinutes} minutes. Please prepare your waste for collection. - Track the Truck`;

  try {
    await sendSMS(recipient.phoneNumber, message);
    console.log(`Arrival notification sent to ${recipient.name}`);
  } catch (error) {
    console.error(`Failed to notify ${recipient.name}:`, error);
    throw error;
  }
}

/**
 * Send collection schedule notification
 */
export async function notifyCollectionSchedule(
  recipient: NotificationRecipient,
  barangay: string,
  date: string,
  time: string,
) {
  const message = `Garbage collection schedule for ${barangay}: ${date} at ${time}. Please prepare your waste ahead of time. - Track the Truck`;

  try {
    await sendSMS(recipient.phoneNumber, message);
    console.log(`Schedule notification sent to ${recipient.name}`);
  } catch (error) {
    console.error(`Failed to notify ${recipient.name}:`, error);
    throw error;
  }
}

/**
 * Send incident report acknowledgment
 */
export async function notifyIncidentAcknowledged(
  recipient: NotificationRecipient,
  reportId: string,
  status: string,
) {
  const message = `Your incident report #${reportId} has been ${status}. Our team will respond shortly. Thank you for reporting! - Track the Truck`;

  try {
    await sendSMS(recipient.phoneNumber, message);
    console.log(`Incident acknowledgment sent to ${recipient.name}`);
  } catch (error) {
    console.error(`Failed to notify ${recipient.name}:`, error);
    throw error;
  }
}

/**
 * Send missed collection notification
 */
export async function notifyMissedCollection(
  recipient: NotificationRecipient,
  nextSchedule: string,
) {
  const message = `We missed your collection today. Our team will return on ${nextSchedule}. We apologize for the inconvenience. - Track the Truck`;

  try {
    await sendSMS(recipient.phoneNumber, message);
    console.log(`Missed collection notification sent to ${recipient.name}`);
  } catch (error) {
    console.error(`Failed to notify ${recipient.name}:`, error);
    throw error;
  }
}

/**
 * Send emergency/critical incident alert to SWMO
 */
export async function notifyEmergencyIncident(
  recipient: NotificationRecipient,
  location: string,
  description: string,
) {
  const message = `URGENT: Critical incident reported at ${location}. Details: ${description}. Please respond immediately. - Track the Truck`;

  try {
    await sendSMS(recipient.phoneNumber, message);
    console.log(`Emergency alert sent to ${recipient.name}`);
  } catch (error) {
    console.error(`Failed to notify ${recipient.name}:`, error);
    throw error;
  }
}

/**
 * Send bulk notifications to multiple recipients
 */
export async function sendBulkNotifications(
  recipients: NotificationRecipient[],
  message: string,
) {
  const results = await Promise.allSettled(
    recipients.map((recipient) => sendSMS(recipient.phoneNumber, message)),
  );

  const successful = results.filter((r) => r.status === "fulfilled").length;
  const failed = results.filter((r) => r.status === "rejected").length;

  console.log(`Bulk SMS: ${successful} sent, ${failed} failed`);

  return { successful, failed, total: recipients.length };
}

/**
 * Format phone number to Philippine format (09XXXXXXXXX or 639XXXXXXXXX)
 */
export function formatPhoneNumber(phone: string): string {
  // Remove all non-digit characters
  const cleaned = phone.replace(/\D/g, "");

  // If starts with 63, ensure it's 12 digits
  if (cleaned.startsWith("63")) {
    return cleaned.length === 12 ? cleaned : cleaned.substring(0, 12);
  }

  // If starts with 0, ensure it's 11 digits
  if (cleaned.startsWith("0")) {
    return cleaned.length === 11 ? cleaned : cleaned.substring(0, 11);
  }

  // If starts with 9, add 0 prefix
  if (cleaned.startsWith("9") && cleaned.length === 10) {
    return "0" + cleaned;
  }

  // Default: return as is
  return cleaned;
}

/**
 * Validate Philippine phone number
 */
export function isValidPhoneNumber(phone: string): boolean {
  const cleaned = phone.replace(/\D/g, "");

  // Check if it's 09XXXXXXXXX (11 digits starting with 09)
  if (/^09\d{9}$/.test(cleaned)) return true;

  // Check if it's 639XXXXXXXXX (12 digits starting with 639)
  if (/^639\d{9}$/.test(cleaned)) return true;

  return false;
}
