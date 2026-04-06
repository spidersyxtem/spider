const crypto = require("crypto");
const JSZip = require("jszip");

function generateKeypair() {
  const { publicKey, privateKey } = crypto.generateKeyPairSync("x25519");
  const pub = publicKey.export({ type: "spki", format: "der" }).slice(12).toString("base64");
  const priv = privateKey.export({ type: "pkcs8", format: "der" }).slice(16).toString("base64");
  return { publicKey: pub, privateKey: priv };
}

async function registerDevice(publicKey) {
  const res = await fetch("https://api.cloudflareclient.com/v0a2158/reg", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      key: publicKey,
      install_id: crypto.randomUUID(),
      fcm_token: "",
      tos: new Date().toISOString(),
      model: "PC",
      serial_number: crypto.randomUUID(),
      locale: "en_US",
    }),
  });
  return await res.json();
}

exports.handler = async () => {
  try {
    const endpoints = Array.from({ length: 20 }, (_, i) => `162.159.192.${i + 1}`);
    const shuffled = endpoints.sort(() => Math.random() - 0.5);

    const zip = new JSZip();

    for (let i = 0; i < 3; i++) {
      const endpoint = shuffled[i];
      const { publicKey, privateKey } = generateKeypair();
      const data = await registerDevice(publicKey);

      const peer = data.config.peers[0];
      const iface = data.config.interface;

      const conf = `[Interface]
PrivateKey = ${privateKey}
Address = ${iface.addresses.v4}/32, ${iface.addresses.v6}/128
DNS = 1.1.1.1, 1.0.0.1, 2606:4700:4700::1111, 2606:4700:4700::1001
MTU = 1280

[Peer]
PublicKey = ${peer.public_key}
AllowedIPs = 0.0.0.0/0, ::/0
Endpoint = ${endpoint}:500
PersistentKeepalive = 20
`;
      zip.file(`${endpoint}.conf`, conf);
    }

    const zipBuffer = await zip.generateAsync({ type: "nodebuffer" });

    return {
      statusCode: 200,
      headers: {
        "Content-Type": "application/zip",
        "Content-Disposition": "attachment; filename=warp.zip",
        "Access-Control-Allow-Origin": "*",
      },
      body: zipBuffer.toString("base64"),
      isBase64Encoded: true,
    };
  } catch (err) {
    return {
      statusCode: 500,
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ error: err.message }),
    };
  }
};
