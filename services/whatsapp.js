// services/whatsapp.js

const twilio = require('twilio');

const client = twilio(
  process.env.TWILIO_SID,
  process.env.TWILIO_TOKEN
);

async function sendWhatsApp(to, message) {
  return client.messages.create({
    from: 'whatsapp:+14155238886',
    to: 'whatsapp:' + to,
    body: message
  });
}

module.exports = { sendWhatsApp };