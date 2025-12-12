import Semaphore from "node-semaphore-sms";

export const sendSMS = async (to, message) => {
  const apikey = process.env.SEMAPHORE_API_KEY;
  const sms = new Semaphore(apikey);

  const payload = {
    to: to,
    message: message,
    from: "TrackTruck", // Replace with your sender name
  };

  try {
    const result = await new Promise((resolve, reject) => {
      sms.sendsms(payload, (error, response) => {
        if (error) {
          reject(error);
        } else {
          resolve(response);
        }
      });
    });
    console.log("SMS sent:", result);
  } catch (error) {
    console.error("Failed to send SMS:", error);
  }
};
