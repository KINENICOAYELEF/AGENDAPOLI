exports.handler = async function(event, context) {
  const privateKey = "XNLSvEGgU7XKRFZGONvMFkgiX9E="; // Tu clave privada de ImageKit
  const token = Math.random().toString(36).substring(2);
  const expire = Math.floor(Date.now()/1000) + 1200; // 20 minutos
  
  const crypto = require('crypto');
  const hmac = crypto.createHmac('sha1', privateKey);
  const signature = hmac.update(token + expire).digest('hex');
  
  return {
    statusCode: 200,
    headers: {
      "Access-Control-Allow-Origin": "*",
      "Access-Control-Allow-Headers": "Content-Type"
    },
    body: JSON.stringify({
      token: token,
      expire: expire,
      signature: signature
    })
  };
};
