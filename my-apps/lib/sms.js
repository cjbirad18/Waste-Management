// PhilSMS Integration
export const sendSMS = async (to, message) => {
  const apiToken = process.env.PHILSMS_API_TOKEN;
  const senderId = process.env.PHILSMS_SENDER_ID || "Track the Truck";

  if (!apiToken) {
    console.error("PhilSMS API Token not configured");
    throw new Error("SMS service not configured");
  }

  // Format phone number: Convert 09XXXXXXXXX to 639XXXXXXXXX
  let phoneNumber = to.trim();
  if (phoneNumber.startsWith("0")) {
    phoneNumber = "63" + phoneNumber.substring(1);
  } else if (!phoneNumber.startsWith("63")) {
    phoneNumber = "63" + phoneNumber;
  }

  const payload = {
    recipient: phoneNumber, // Format: 639XXXXXXXXX
    sender_id: senderId,
    message: message,
  };

  try {
    const response = await fetch(
      "https://dashboard.philsms.com/api/v3/sms/send",
      {
        method: "POST",
        headers: {
          Authorization: `Bearer ${apiToken}`,
          "Content-Type": "application/json",
          Accept: "application/json",
        },
        body: JSON.stringify(payload),
      },
    );

    const result = await response.json();

    if (!response.ok) {
      console.error("PhilSMS Error:", result);
      throw new Error(result.message || "Failed to send SMS");
    }

    console.log("SMS sent successfully:", result);
    return result;
  } catch (error) {
    console.error("Failed to send SMS:", error);
    throw error;
  }
};
