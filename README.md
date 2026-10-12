# smstest

A small Bootstrap web UI for sending SMS through either:

- a **local gateway** — the BNet.Mobile.SMS app on your phone (LAN IP or an ngrok tunnel), or
- an **online gateway** — a Convex deployment (BYO-SMS-GATEWAY) with your own URL and API key.

## Requirements

- [Node.js](https://nodejs.org) (only needed for the local tunnel relay; LAN sending works without it)
- A modern browser

No `npm install` is required — everything is vendored.

## Running locally

1. Double-click **`run.bat`** (or run it from a terminal).

   It starts the relay on `http://127.0.0.1:3000` and opens `index.html` in your browser.

2. In the app, open the **Settings** tab and fill in an endpoint:

   - **Local Endpoint** — e.g. `192.168.123.51:8030` (LAN) or
     `https://your-name.ngrok-free.dev` (tunnel). Accepts `ip:port` or a full URL.
   - **Online Endpoint (Convex)** — your Convex URL (e.g.
     `https://your-project.convex.site`) and API key (`sms_live_...`).

3. For **Online** (Convex): click **Test Connection** — if it passes (401/400 checks), it will
   automatically **Fetch Devices**. Or click **Fetch Devices** manually. That loads your paired
   phones/SIMs so you can pick which one to send from in the Send SMS tab.

4. Click **Save Settings**.

5. Go to the **Send SMS** tab, pick **Local** or **Online**, enter recipients and a
   message, and send. For Online, you can choose a specific Device/SIM (or leave as "Default").

To stop the relay, press `Ctrl+C` in the black window, or just close it.

### Running the relay manually

Instead of `run.bat`:

```bash
node proxy.js
```

Then open `index.html` in your browser (another way: `start index.html`).

### Why the relay exists

ngrok's free tier answers **browser** requests with a warning page instead of your
gateway's JSON. A native client (the Flutter app, `curl`) isn't affected, but a
web page is, and the browser can't send the required skip header past the gateway's
CORS policy. `proxy.js` runs on your PC, adds that header, and returns plain CORS so
the page can talk to the tunnel.

- **LAN / `ip:port`** → called directly, relay not used.
- **Tunnel (domain name)** → routed through the relay at `127.0.0.1:3000`.

### How device fetching works (Online/Convex)

When using Online, the app fetches your paired devices/SIMs directly from your Convex deployment
using your API key:

1. `GET {ConvexURL}/v1/devices` with `Authorization: Bearer <API key>` — returns the list of
   paired devices for that account (`id`, `name`, `status`, `ready`, `isDefault`). This is called
   automatically after a successful Test Connection, or when you click **Fetch Devices**.
2. When you pick a device, the app calls `GET {ConvexURL}/v1/devices/:id/sims` to load its SIMs
   (enabled SIMs; shows `(default)` for the device/SIM defaults).
3. On send, it includes `deviceId` and `simId` (if selected) in `POST /v1/messages/send`. If left
   empty, the backend uses the account's **default device** and that device's **default SIM**.

This is all API-key authenticated (same auth as sending messages) and requires the BYO backend
endpoints added above.

## Deploying

This is a static site — deploy the repo root to Vercel/Netlify as-is (framework
preset **Other**, no build command, no output directory).

Note: a hosted copy can use the **Online** endpoint from anywhere. The **Local**
endpoint only works on a machine that can reach the gateway (same Wi-Fi, or with
`run.bat` running for a tunnel).
