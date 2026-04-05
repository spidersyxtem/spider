const crypto = require("crypto");
const initSqlJs = require("sql.js");

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

async function buildDb(tunnels) {
  const SQL = await initSqlJs();
  const db = new SQL.Database();

  db.run("PRAGMA user_version = 29;");

  db.run(`CREATE TABLE android_metadata (locale TEXT);`);
  db.run(`INSERT INTO android_metadata VALUES ('en_US');`);

  db.run(`CREATE TABLE room_master_table (id INTEGER PRIMARY KEY, identity_hash TEXT);`);
  db.run(`INSERT INTO room_master_table VALUES (42,'345471c118dee1b7688afa81d835e62c');`);

  db.run(`CREATE TABLE \`proxy_settings\` (
    \`id\` INTEGER PRIMARY KEY AUTOINCREMENT NOT NULL,
    \`socks5_proxy_enabled\` INTEGER NOT NULL DEFAULT 0,
    \`socks5_proxy_bind_address\` TEXT,
    \`http_proxy_enable\` INTEGER NOT NULL DEFAULT 0,
    \`http_proxy_bind_address\` TEXT,
    \`proxy_username\` TEXT,
    \`proxy_password\` TEXT
  );`);
  db.run(`INSERT INTO \`proxy_settings\` VALUES (1,0,null,0,null,null,null);`);

  db.run(`CREATE TABLE \`general_settings\` (
    \`id\` INTEGER PRIMARY KEY AUTOINCREMENT NOT NULL,
    \`is_shortcuts_enabled\` INTEGER NOT NULL DEFAULT 0,
    \`is_restore_on_boot_enabled\` INTEGER NOT NULL DEFAULT 0,
    \`is_multi_tunnel_enabled\` INTEGER NOT NULL DEFAULT 0,
    \`global_split_tunnel_enabled\` INTEGER NOT NULL DEFAULT 0,
    \`app_mode\` INTEGER NOT NULL DEFAULT 0,
    \`theme\` TEXT NOT NULL DEFAULT 'AUTOMATIC',
    \`locale\` TEXT,
    \`remote_key\` TEXT,
    \`is_remote_control_enabled\` INTEGER NOT NULL DEFAULT 0,
    \`is_pin_lock_enabled\` INTEGER NOT NULL DEFAULT 0,
    \`is_always_on_vpn_enabled\` INTEGER NOT NULL DEFAULT 0,
    \`already_donated\` INTEGER NOT NULL DEFAULT 0
  );`);
  db.run(`INSERT INTO \`general_settings\` VALUES (1,0,0,0,0,0,'AUTOMATIC',null,null,0,0,0,0);`);

  db.run(`CREATE TABLE \`auto_tunnel_settings\` (
    \`id\` INTEGER PRIMARY KEY AUTOINCREMENT NOT NULL,
    \`is_tunnel_enabled\` INTEGER NOT NULL DEFAULT 0,
    \`is_tunnel_on_mobile_data_enabled\` INTEGER NOT NULL DEFAULT 0,
    \`trusted_network_ssids\` TEXT NOT NULL DEFAULT '',
    \`is_tunnel_on_ethernet_enabled\` INTEGER NOT NULL DEFAULT 0,
    \`is_tunnel_on_wifi_enabled\` INTEGER NOT NULL DEFAULT 0,
    \`is_wildcards_enabled\` INTEGER NOT NULL DEFAULT 0,
    \`is_stop_on_no_internet_enabled\` INTEGER NOT NULL DEFAULT 0,
    \`debounce_delay_seconds\` INTEGER NOT NULL DEFAULT 3,
    \`is_tunnel_on_unsecure_enabled\` INTEGER NOT NULL DEFAULT 0,
    \`wifi_detection_method\` INTEGER NOT NULL DEFAULT 0,
    \`start_on_boot\` INTEGER NOT NULL DEFAULT 0
  );`);
  // သင့် backup အတိုင်း: is_tunnel_on_ethernet_enabled=0, is_tunnel_on_wifi_enabled=1, start_on_boot=0
  db.run(`INSERT INTO \`auto_tunnel_settings\` VALUES (1,0,1,'[]',0,1,0,1,2,0,0,0);`);

  db.run(`CREATE TABLE \`monitoring_settings\` (
    \`id\` INTEGER PRIMARY KEY AUTOINCREMENT NOT NULL,
    \`is_ping_enabled\` INTEGER NOT NULL DEFAULT 0,
    \`is_ping_monitoring_enabled\` INTEGER NOT NULL DEFAULT 1,
    \`tunnel_ping_interval_sec\` INTEGER NOT NULL DEFAULT 30,
    \`tunnel_ping_attempts\` INTEGER NOT NULL DEFAULT 3,
    \`tunnel_ping_timeout_sec\` INTEGER,
    \`show_detailed_ping_stats\` INTEGER NOT NULL DEFAULT 0,
    \`is_local_logs_enabled\` INTEGER NOT NULL DEFAULT 0
  );`);
  db.run(`INSERT INTO \`monitoring_settings\` VALUES (1,0,1,30,3,null,0,0);`);

  db.run(`CREATE TABLE \`dns_settings\` (
    \`id\` INTEGER PRIMARY KEY AUTOINCREMENT NOT NULL,
    \`dns_protocol\` INTEGER NOT NULL DEFAULT 0,
    \`dns_endpoint\` TEXT,
    \`global_tunnel_dns_enabled\` INTEGER NOT NULL DEFAULT 0
  );`);
  db.run(`INSERT INTO \`dns_settings\` VALUES (1,1,null,1);`);

  db.run(`CREATE TABLE \`lockdown_settings\` (
    \`id\` INTEGER PRIMARY KEY AUTOINCREMENT NOT NULL,
    \`bypass_lan\` INTEGER NOT NULL DEFAULT 0,
    \`metered\` INTEGER NOT NULL DEFAULT 0,
    \`dual_stack\` INTEGER NOT NULL DEFAULT 0
  );`);

  db.run(`CREATE TABLE \`tunnel_config\` (
    \`id\` INTEGER PRIMARY KEY AUTOINCREMENT NOT NULL,
    \`name\` TEXT NOT NULL,
    \`wg_quick\` TEXT NOT NULL,
    \`tunnel_networks\` TEXT NOT NULL DEFAULT '',
    \`is_mobile_data_tunnel\` INTEGER NOT NULL DEFAULT false,
    \`is_primary_tunnel\` INTEGER NOT NULL DEFAULT false,
    \`am_quick\` TEXT NOT NULL DEFAULT '',
    \`is_Active\` INTEGER NOT NULL DEFAULT false,
    \`restart_on_ping_failure\` INTEGER NOT NULL DEFAULT false,
    \`ping_target\` TEXT DEFAULT null,
    \`is_ethernet_tunnel\` INTEGER NOT NULL DEFAULT false,
    \`is_ipv4_preferred\` INTEGER NOT NULL DEFAULT true,
    \`position\` INTEGER NOT NULL DEFAULT 0,
    \`auto_tunnel_apps\` TEXT NOT NULL DEFAULT '[]',
    \`is_metered\` INTEGER NOT NULL DEFAULT false
  );`);

  const stmt = db.prepare(`
    INSERT INTO \`tunnel_config\`
    (\`name\`, \`wg_quick\`, \`tunnel_networks\`, \`is_mobile_data_tunnel\`, \`is_primary_tunnel\`,
     \`am_quick\`, \`is_Active\`, \`restart_on_ping_failure\`, \`ping_target\`, \`is_ethernet_tunnel\`,
     \`is_ipv4_preferred\`, \`position\`, \`auto_tunnel_apps\`, \`is_metered\`)
    VALUES (?, ?, '[]', 0, 0, ?, 0, 0, null, 0, 1, 0, '[]', 0)
  `);

  tunnels.forEach((t) => {
    stmt.run([t.name, t.wg_quick, t.am_quick]);
  });
  stmt.free();

  const data = db.export();
  db.close();
  return Buffer.from(data);
}

exports.handler = async () => {
  try {
    const endpoints = Array.from({ length: 20 }, (_, i) => `162.159.192.${i + 1}`);
    const shuffled = endpoints.sort(() => Math.random() - 0.5);
    const tunnels = [];

    for (let i = 0; i < 3; i++) {
      const endpoint = shuffled[i];
      const { publicKey, privateKey } = generateKeypair();
      const data = await registerDevice(publicKey);

      const peer = data.config.peers[0];
      const iface = data.config.interface;

      const name = endpoint;

      const wg_quick = `[Interface]\nAddress = ${iface.addresses.v4}/32, ${iface.addresses.v6}/128\nDNS = 1.1.1.1, 1.0.0.1, 2606:4700:4700::1111, 2606:4700:4700::1001\nMTU = 1280\nPrivateKey = ${privateKey}\n\n[Peer]\nAllowedIPs = 0.0.0.0/0, ::/0\nEndpoint = ${endpoint}:500\nPersistentKeepalive = 20\nPublicKey = ${peer.public_key}\n`;

      const am_quick = `[Interface]\nPrivateKey = ${privateKey}\nAddress = ${iface.addresses.v4}/32, ${iface.addresses.v6}/128\nDNS = 1.1.1.1, 1.0.0.1, 2606:4700:4700::1111, 2606:4700:4700::1001\nMTU = 1280\n\n[Peer]\nPublicKey = ${peer.public_key}\nAllowedIPs = 0.0.0.0/0, ::/0\nEndpoint = ${endpoint}:500\nPersistentKeepalive = 20\n`;

      tunnels.push({ name, wg_quick, am_quick });
    }

    const dbBuffer = await buildDb(tunnels);
    const filename = "wg-tunnel-db-2026-04-05-15_22_43.sqlite3";

    return {
      statusCode: 200,
      headers: {
        "Content-Type": "application/octet-stream",
        "Content-Disposition": `attachment; filename=${filename}`,
        "Access-Control-Allow-Origin": "*",
      },
      body: dbBuffer.toString("base64"),
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
