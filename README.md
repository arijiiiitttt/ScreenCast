<p align="center">
  <a>
    <img alt="screen cast logo" src="/client/logo/tv.png" height="150">
  </a>
</p>
<p align="center">
 share your screen to any browser with a room code and a password 📡
</p>


<p align="center">
  <a href="#run-it"><img alt="Node" src="https://img.shields.io/badge/node-16%2B-339933?style=flat-square&logo=nodedotjs&logoColor=white" /></a>
  <a href="#architecture"><img alt="WebRTC" src="https://img.shields.io/badge/webrtc-peer--to--peer-4f8cff?style=flat-square&logo=webrtc&logoColor=white" /></a>
  <a href="#architecture"><img alt="WebSocket" src="https://img.shields.io/badge/websocket-signaling-010101?style=flat-square&logo=socketdotio&logoColor=white" /></a>
  <a href="#put-it-online"><img alt="Render" src="https://img.shields.io/badge/deploy-render-46E3B7?style=flat-square&logo=render&logoColor=black" /></a>
  <a href="#hardware-and-network-notes"><img alt="Viewer install" src="https://img.shields.io/badge/viewer%20install-none-7c5cff?style=flat-square" /></a>
</p>


> **⚠️ Honest framing.** Screen Cast is a small, self-hosted screen-sharing site, not a managed meeting platform. There are no accounts, no recordings and no chat. Rooms live in server memory and disappear when the host stops or the server restarts. Video goes directly from the host's browser to each viewer, so the host's upload speed limits how many people can watch. The 60 and 100 fps modes are requests to the browser: real speed is capped by the host screen's refresh rate (usually 60 Hz), the computer and the network, and on slow connections higher frame rates trade away sharpness. It has not been load-tested.


## Table of contents

1. [Run it](#run-it)
2. [Put it online](#put-it-online)
3. [Using Screen Cast](#using-screen-cast)
4. [Configuration](#configuration)
5. [Services](#services)
6. [Hardware and network notes](#hardware-and-network-notes)
7. [Architecture](#architecture)
8. [Design decisions](#design-decisions)
9. [Project layout](#project-layout)
10. [Testing](#testing)
11. [Local development](#local-development)
12. [Extending](#extending)
13. [Troubleshooting](#troubleshooting)
14. [Known limitations](#known-limitations)
15. [Credits](#credits)



## Run it

You need **Node.js 16 or newer**. There is no database. The project is two independent pieces: `server/` (signaling) and `client/` (static web page).

```bash
# terminal 1: signaling server on :3000
cd server && npm install && npm start

# terminal 2: web page on :5173
cd client && npm run dev
```

Open **http://localhost:5173**. With no server address configured, a page opened on `localhost` talks to `http://localhost:3000` automatically.

| Setup | Result |
| --- | --- |
| Host on `localhost` or an `https://` address | Screen capture is allowed |
| Host on plain `http://192.168.x.x` | Browser blocks screen capture (viewers still work) |
| Viewer, any modern browser on any OS | Watches with nothing to install |
| Host on a phone or tablet | Not possible, mobile browsers cannot share their screen |




## Put it online

Deploy the two folders as two separate projects. **Order matters: server first**, because the client needs the server's URL and the server needs the client's URL.

### 1. Server (needs a host that keeps a process running)

Render, Railway, Fly.io, a VPS: anything that runs Node and supports WebSockets. Vercel and Netlify functions do **not** work for this part.

| Setting | Value |
| --- | --- |
| Root directory | `server` |
| Build command | `npm install` |
| Start command | `npm start` |
| Health check path | `/health` |
| Env var (later) | `ALLOWED_ORIGINS` = the client URL |

Note the URL you get, e.g. `https://screencast-server.onrender.com`.

### 2. Client (any static host)

Vercel, Netlify, Cloudflare Pages, GitHub Pages, Render Static, S3: anything that serves files.

| Setting | Value |
| --- | --- |
| Root directory | `client` |
| Build command | `npm run build` |
| Output directory | `.` (the `client` folder itself) |
| Env var | `SCREENCAST_SERVER` = the server URL from step 1 |

Skipping the build step also works: put the URL in `client/config.js` by hand and publish the folder as is.

### 3. Connect them

Go back to the server and set `ALLOWED_ORIGINS` to the client's URL (no trailing slash; separate several with commas), then redeploy it. Open the client and start a room.

### Render shortcut

`render.yaml` at the repo root creates both services in one go. Fill in `SCREENCAST_SERVER` and `ALLOWED_ORIGINS` when prompted, or afterwards in each service's Environment tab.

### Good to know

- Use `https://` for the client. Browsers only allow screen capture there, and an HTTPS page can only open `wss://` connections, so the server must be HTTPS too (all hosts above do this by default).
- On free plans the server sleeps when idle. The page wakes it as soon as it loads, but the first connection can take up to about a minute.
- A change to either folder only needs that one project redeployed. Changing the server URL means rebuilding the client.



## Using Screen Cast

| Step | Who | What happens |
| --- | --- | --- |
| 1 | Host | Open the site and click **Start a room** in the **Share** row |
| 2 | Host | Set a room code and password (random ones are pre-filled, editable and re-rollable), pick a video quality, optionally switch on **share sound** |
| 3 | Host | Click **Choose a screen and go live** and pick a screen, window or tab in the browser prompt |
| 4 | Host | Share the room code, the password and the link shown on the live page |
| 5 | Viewer | Open the site (or the link), type the room code and password, use the **Watch** row and click **Watch** |
| 6 | Viewer | Watch live; use **Fullscreen**, **Mute/Unmute** and **Leave** from the top bar |

**Things to try**

- Click **Copy link with password**: viewers who open it join instantly, no typing
- Open the link on a projector PC and press **Fullscreen**
- Join from your phone as a second viewer to see the live viewer count change
- Click **Stop sharing** (or use the browser's own "Stop sharing" bar): viewers see "The host stopped sharing"

**Video quality**

| Mode | Frame rate asked for | Bitrate per viewer (min / max) | Best for |
| --- | --- | --- | --- |
| Sharp (default, recommended) | 30 fps | 1.5 / 8 Mbps | Slides, documents, code: keeps text crisp |
| Smooth | up to 60 fps | 2.5 / 12 Mbps | Video and animation on a fast connection |
| Maximum | up to 100 fps | 3 / 15 Mbps | 120/144 Hz screens only; heaviest on the host's internet |

Capture is limited to 2560x1440 so text stays sharp without overloading the host.



## Configuration

Settings are environment variables. All are optional locally; set the two marked **production** when you deploy.

**Server** (`server/`)

| Variable | Default | Why |
| --- | --- | --- |
| `PORT` | `3000` | Port the signaling server listens on (Render sets this itself) |
| `ALLOWED_ORIGINS` | any | **Production.** Comma-separated website URLs allowed to connect, e.g. `https://screencast.vercel.app`. Other sites get rejected |
| `MAX_VIEWERS` | `20` | Viewers per room; each one costs the host a separate upload stream |
| `MAX_ROOMS` | `200` | Rooms alive at once on this server |
| `ICE_SERVERS` | Google public STUN | JSON list of STUN/TURN servers, needed on strict networks |

**Client** (`client/`)

| Variable | Default | Why |
| --- | --- | --- |
| `SCREENCAST_SERVER` | empty | **Production.** Your server's URL, e.g. `https://screencast-server.onrender.com`. Written into `config.js` by `npm run build`. You can also edit `client/config.js` by hand |

`ICE_SERVERS` example (adds a relay):

```bash
ICE_SERVERS='[{"urls":"stun:stun.l.google.com:19302"},{"urls":"turn:HOST:3478","username":"user","credential":"pass"}]'
```

Host options on the setup screen:

| Option | Rules |
| --- | --- |
| Room code | 3-32 characters: lowercase letters, numbers, dashes. Must be unused |
| Password | Up to 64 characters. Leave empty for an open room |
| Video quality | Sharp, Smooth or Maximum (see above) |
| Share sound | Offered only if the browser and the chosen source support audio |

Invalid room codes and codes already in use are rejected before sharing starts.



## Services

| Path | Purpose |
| --- | --- |
| `/` | Plain text banner (the server no longer serves the page) |
| `/health` | Plain `ok` response for hosting health checks |
| `ws(s)://<server host>/` | WebSocket signaling used by the page |

The website is served separately from `client/`.



## Hardware and network notes

- **Host:** a desktop or laptop with Chrome, Edge, Firefox or Safari. Screen capture is not available on phones and tablets.
- **Frame rate:** most screens refresh at 60 Hz, so expect about 60 fps at best. Only 120/144 Hz screens can go higher, and most viewers' screens are 60 Hz anyway.
- **Sharpness:** each viewer is sent its own stream of up to 8 Mbps (Sharp) to 15 Mbps (Max). If the host's upload is slower than that times the number of viewers, the picture softens.
- **Upload speed:** the host sends one stream per viewer. As a rough guide, 5-10 viewers is comfortable on normal Wi-Fi in Sharp mode; for more, use a faster connection, or fewer viewers on slow connections.
- **Strict networks:** some school and office networks block direct peer-to-peer video. Viewers get stuck on "Connecting" or see "Could not connect directly". Add a TURN relay through `ICE_SERVERS`.
- **Viewers:** any modern browser, including phones and the browser on a projector PC.



## Architecture

```mermaid
flowchart LR
    HOST[Host browser<br/>captures screen] -->|WebSocket: host, sig| SRV[Node server<br/>rooms + passwords]
    V1[Viewer browser] -->|WebSocket: join, sig| SRV
    V2[Viewer browser] -->|WebSocket: join, sig| SRV
    SRV -->|viewer, gone, sig| HOST
    SRV -->|joined, sig, ended| V1
    HOST ==>|WebRTC video + audio| V1
    HOST ==>|WebRTC video + audio| V2
    STUN[STUN / TURN] -.->|find a route| HOST
    STUN -.-> V1
```


**Signaling messages**

| Direction | Message | Meaning |
| --- | --- | --- |
| client → server | `host` `{room, pass}` | Create a room |
| client → server | `join` `{room, pass}` | Join a room as a viewer |
| client → server | `sig` `{to?, data}` | Relay an offer, answer or network candidate |
| server → host | `hosting`, `viewer`, `gone`, `sig` | Room ready, viewer joined, viewer left, relayed signal |
| server → viewer | `joined`, `sig`, `ended` | Admitted, relayed signal, host stopped |
| server → client | `error` `{code, msg}` | `bad-request`, `busy`, `no-room`, `need-pass`, `bad-pass`, `full`, `blocked` |



## Design decisions

- **The server never touches video.** It only introduces browsers to each other, so it can run on a tiny free instance and your screen content never passes through it.
- **No accounts, no storage.** Rooms exist only in memory. Nothing is written to disk, nothing is logged about content.
- **Passwords are checked, not stored.** The server keeps a SHA-256 hash in memory and compares with `crypto.timingSafeEqual`. Over HTTPS the password travels inside a `wss://` connection.
- **Guessing is throttled.** After 10 wrong passwords or unknown room codes from one IP within 5 minutes, that IP is blocked for the rest of the window (`blocked`).
- **Password in the link stays out of the server.** "Copy link with password" puts it after a `#`, which browsers never send to the server. It is removed from the address bar right after auto-join. The server also sends `Referrer-Policy: no-referrer`.
- **Mesh, not a media server.** The host connects to every viewer directly. That is simple and free, but upload cost grows with the number of viewers; the cap is `MAX_VIEWERS`.
- **Sharp by default.** Sharp mode sets the video `contentHint` to `detail` so the browser keeps resolution instead of dropping it; Smooth and Max use `motion` (keep frame rate). All modes also ask the sending browser for a higher minimum and starting bitrate (through `x-google-*` codec parameters on the viewer's answer) so the picture does not begin blurry while the network estimate warms up.
- **Dead connections are cleaned up.** The server pings every 25 seconds and drops sockets that stop answering; this also keeps hosting platforms from closing idle connections.
- **A TV test pattern as the identity.** The color bars (the signal you see when a channel is waiting) run along the top of every page, appear in the logo, and fill the viewer's screen while it connects; the same pattern turns grey when the host stops. Buttons and room-code characters share one look: ink outline, hard bottom edge, and a press-down effect.
- **One file for the whole interface.** `client/index.html` has the page, styles and logic, so there is no frontend build.



## Project layout

```
screencast/
├── server/
│   ├── server.js          # Signaling: rooms, passwords, relays, origin check
│   ├── package.json       # Only dependency is "ws"
│   ├── package-lock.json
│   └── bun.lock
├── client/
│   ├── index.html         # Home, host setup, live host page and full-screen viewer
│   ├── config.js          # Sets window.SCREENCAST_SERVER (server address)
│   ├── logo/tv.png
│   ├── _headers           # Security/cache headers for Netlify / Cloudflare Pages
│   └── package.json       # `dev` and `build` (writes config.js from env)
├── render.yaml            # Optional Render Blueprint creating both services
├── README.md
└── .gitignore
```

| Path | Role |
| --- | --- |
| `server/server.js` | HTTP `/` and `/health`, WebSocket signaling, room table, throttling, heartbeat, origin allow-list |
| `client/index.html` | The entire interface and the WebRTC code for both host and viewer |
| `client/config.js` | The one place the client learns the server's address |

The two folders share nothing at runtime except the WebSocket messages listed under Architecture, so each can be deployed, scaled and redeployed on its own.



## Testing

There is no automated test suite yet. A quick manual check after any change:

1. Start the server and the client (see Local development), open `http://localhost:5173` in two browser windows.
2. Window A: **Start a room**, share a window. Window B: join with the code and password; the video should appear within a few seconds.
3. Join with a wrong password: you should see "Wrong password."
4. Join with an unknown code: you should see "Room not found."
5. Stop sharing in window A: window B should show "The host stopped sharing."
6. Join from a second device on the same Wi-Fi using the client's network address (see Local development) to check cross-device playback.

The signaling server (room creation, duplicate rooms, password checks, relaying, viewer leave, host end, `/health`) was checked with a scripted WebSocket client. Live video in real browsers should be verified on your own devices after deploying.



## Local development

```bash
cd server && npm install && PORT=4000 npm start     # another port if 3000 is busy
cd client && npm run dev
```

- Edit `client/index.html` and refresh: no restart needed, it is a static file.
- Restart the server after editing `server/server.js`.
- If you changed the server port, set `window.SCREENCAST_SERVER = 'http://localhost:4000'` in `client/config.js` (don't commit that).
- To test across devices on your network, put your machine's address in `client/config.js` and open the client from it. The **host** still needs `localhost` or HTTPS, so run the host window on the machine that runs the client, or deploy.
- Set `ICE_SERVERS` in your shell to try a TURN relay locally.



## Extending

- **Change the quality modes** — the `MODES` table at the top of the script in `client/index.html` holds frame rate, content hint and min/start/max bitrate (kbps) for each mode; the capture size limit is in the `getDisplayMedia` call.
- **Raise or lower limits** — set `MAX_VIEWERS` and `MAX_ROOMS`.
- **Rebrand** — colors are CSS variables at the top of `client/index.html` (`--yel` for buttons and room-code keys, `--ink`, `--paper`); the test-pattern colors are the `BARS` list in the script; the name is in the `<title>` and the brand blocks.
- **Viewer names** — add a `name` field to the `join` message in `onJoin` (`server/server.js`), pass it in the `viewer` message to the host, and show it in the host page.
- **Real accounts or per-room owners** — put your check in `onHost` and `onJoin` in `server/server.js`.
- **A TURN relay for strict networks** — run your own (for example coturn) or use a hosted one, then set `ICE_SERVERS`.
- **New message type** — handle it in the `message` switch in `server.js` and in the matching `onmessage` in `index.html`.



## Troubleshooting

| Problem | Fix |
| --- | --- |
| "This browser or device cannot share its screen" | Use Chrome, Edge, Firefox or Safari on a laptop/desktop, and open the `https://` (or `localhost`) address |
| Screen picker never appears | Allow screen capture for the site in the browser; on macOS enable Screen Recording for the browser in System Settings |
| "Room not found" | Check the code; the host must have started sharing, and the room ends when the host stops |
| "Wrong password" | Passwords are case-sensitive; ask the host to read it from their live page |
| "Too many wrong attempts" | Wait about 5 minutes, then try again |
| "That room code is already in use" | Pick another code on the setup screen |
| Viewer stuck on "Connecting" | Likely a network that blocks peer-to-peer video; add a TURN server via `ICE_SERVERS` |
| First visit is very slow | Free hosting was asleep; wait up to a minute and refresh |
| No sound for viewers | Tick **share sound**, and in the browser prompt choose a tab or source that offers audio; viewers tap **Unmute** |
| Text looks soft or blurry | Use **Sharp** mode, share a window instead of a huge screen, and check the host's upload speed (8 Mbps per viewer in Sharp mode); Smooth and Max favor frame rate over clarity |
| Choppy video | Fewer viewers, **Sharp** mode, or a faster connection for the host |
| Mirror-in-mirror tunnel on the host preview | Share a different window or screen than the one showing the Screen Cast page |
| Page loads but hosting or watching fails right away | `SCREENCAST_SERVER` not set or wrong, or the client URL is missing from the server's `ALLOWED_ORIGINS` |
| Port already in use locally | Start with another port: `PORT=4000 npm start` |



## Known limitations

- Rooms are in memory only; a server restart or sleep ends every room.
- Smooth and Max ask for up to 60 and 100 fps but deliver what the screen, computer and network allow (usually about 60).
- Each viewer adds upload load on the host; there is no media server to fan out streams.
- No TURN relay is included, so some strict networks will not connect.
- Screen sharing works only from desktop browsers; phones and tablets can watch, not share.
- Shares the primary capture choice the browser offers; there is no multi-screen layout or per-viewer control.
- No chat, recording, viewer names or host controls to remove a viewer (yet).
- No automated test suite; not load-tested.



## Credits

Built on [WebRTC](https://webrtc.org), [Node.js](https://nodejs.org), [ws](https://github.com/websockets/ws) and [Render](https://render.com) for hosting.
