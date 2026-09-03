<!-- ───────────────────────────── HERO ───────────────────────────── -->
<div align="center">

<img src="assets/mascot.png" alt="4CHMG2 Mascot" width="360">

<h1>
  <samp>4CHMG2</samp>
</h1>

<p>
  <b>4chan Media Gallery 2.0 — a cross-imageboard media aggregator and gallery viewer.</b><br>
  <i>Search one keyword. Get every matching image and video from every board, merged into one fast gallery.</i>
</p>

<p>
  <img src="https://img.shields.io/badge/version-1.6.0-E445FF?style=for-the-badge" alt="Version">
  <img src="https://img.shields.io/badge/next.js-16-000000?style=for-the-badge&logo=next.js&logoColor=white" alt="Next.js 16">
  <img src="https://img.shields.io/badge/license-MIT-3B82F6?style=for-the-badge" alt="License: MIT">
</p>

<p>
  <img src="https://img.shields.io/badge/React-19-61DAFB?style=flat-square&logo=react&logoColor=white" alt="React 19">
  <img src="https://img.shields.io/badge/TypeScript-strict-3178C6?style=flat-square&logo=typescript&logoColor=white" alt="TypeScript">
  <img src="https://img.shields.io/badge/Tailwind-v4-06B6D4?style=flat-square&logo=tailwindcss&logoColor=white" alt="Tailwind CSS v4">
  <img src="https://img.shields.io/badge/self--hosted-pm2_%2B_nginx-1F2937?style=flat-square" alt="Self-hosted">
</p>

<img src="assets/screenshots/homepage.webp" alt="4CHMG2 homepage" width="720">

<sub><i>The redesigned "deep space utility" homepage — live source-status panel, neon accents, and a single search box.</i></sub>

</div>

---

> [!NOTE]
> **v1.6.0.** New this release: archive searches now return **every thread you asked for** instead of quietly dropping the ones the archive rate-limited away — the same query that rendered 786 media items now returns 1692. Results **fill in thread by thread** as they arrive, the thread count is **accurate past 15**, and archive mode swaps live polling for a **"Load more posts"** check that picks up threads archived since you searched. K-pop-oriented by default, general-purpose by design.

<!-- ───────────────────────────── TOC ───────────────────────────── -->
<details>
<summary><b>📖 Table of contents</b></summary>

- [Why 4CHMG2](#-why-4chmg2)
- [What's new in 1.6.0](#-whats-new-in-160)
- [Features](#-features)
- [Showcase](#-showcase)
- [Supported boards](#-supported-boards)
- [Lightbox hotkeys](#-lightbox-hotkeys)
- [Quick start](#-quick-start)
- [Usage](#-usage)
- [Tech stack](#-tech-stack)
- [Deployment](#-deployment)
- [Roadmap](#-roadmap)
- [License](#-license)

</details>

## ✨ Why 4CHMG2

Imageboards scatter the same media across a dozen boards and archives. Finding everything on a topic means opening tab after tab, scrolling thread after thread, and re-running the same search by hand. **4CHMG2 collapses that into one query.**

| | Principle | What it means |
|:--:|:--|:--|
| 🔎 | **Search once, see everything** | One keyword fans out across 4chan, 2ch.org, Mokachan, and Desuarchive in parallel. |
| 🖼️ | **One unified gallery** | All hits merge into a single grid, ordered by post timestamp with the newest at the bottom. |
| ⚡ | **Fast by default** | A self-hosted proxy with aggressive thumbnail caching keeps scrolling smooth — no skeleton flashes. |
| 🎛️ | **Yours to configure** | Add, hide, or remove boards right in the browser — no source edits required. |

## 🚀 What's new in 1.6.0

- 🗄️ **Archive searches return the whole result set** — opening every thread at once made the archive rate-limit the batch, and each rejected fetch was silently treated as a thread with no media. Half your results could disappear with nothing to indicate it: the same `/trash/` search at 11 threads rendered **786 media items where it should have rendered 1692**. Archive requests now share one queue that paces and retries them, so a wide batch takes a few seconds longer instead of arriving half-empty.
- ⏳ **Results fill in as they arrive** — media appears thread by thread with a running `Loading 4/11 threads` count, rather than waiting on the slowest fetch. A thread that genuinely can't be loaded is now reported instead of vanishing.
- 🔢 **Thread counts above ~15 are honoured** — archive search read only the first page of results and then discarded threads still live on 4chan, so asking for 30 quietly gave you fewer. It now pages until it has what you asked for.
- 🕑 **"Load more posts" in archive mode** — archived threads are dead, so polling them for new posts is pointless and auto-refresh is hidden. The button instead catches the one thing that can change while you're reading: a thread that was still live when you searched has since been archived. It appends at the bottom, where it belongs chronologically, and a toast tells you either what arrived or that there's nothing new.
- 📌 **Your place in the grid is kept** — threads land in time order, so a late arrival can slot in above what you're looking at. Inserts are compensated for against the tile you're reading, and the grid opts out of the browser's own scroll anchoring so the two corrections can't stack and send the view lurching.

## 🧰 Features

<details open>
<summary><b>Feature checklist</b></summary>

- [x] **Multi-board search** — query 4chan, 2ch.org, Mokachan, and Desuarchive simultaneously
- [x] **Unified gallery grid** — all results merged and sorted by timestamp
- [x] **Batch ZIP downloads** — select gallery results and export them as a single archive
- [x] **Quick save** — hover a result and press <kbd>S</kbd> to download it in place
- [x] **Full-featured lightbox** — keyboard nav, zoom/pan, slideshow, flip, rotate, download, hotkeys
- [x] **OR search** — separate keywords with <kbd>|</kbd> for multi-term matching
- [x] **Auto-refresh** — toggleable live polling with a "new posts" divider that merges in smoothly when you reach the bottom
- [x] **Download toasts** — slide-in "saved" confirmations that stack and fade
- [x] **Locate-on-exit** — smooth-scroll + highlight returns you to your place after closing the lightbox
- [x] **Touch-friendly** — drag-to-pan, pinch-to-zoom, double-tap reset
- [x] **Fast self-hosted proxy** — aggressive thumbnail caching for smooth, flash-free scrolling
- [x] **In-browser Board Configurator** — add / hide / delete boards, persisted per-browser
- [x] **Relative-time scrollbar** — scrub a result set by post time
- [x] **Dock-style lightbox thumbnails** — cursor-following magnification

</details>

## 🖼️ Showcase

<table>
  <tr>
    <td align="center" width="50%">
      <img src="assets/screenshots/search.webp" alt="Search results gallery" width="100%"><br>
      <sub><b>Unified search gallery</b> — every board's hits in one timeline-sorted grid.</sub>
    </td>
    <td align="center" width="50%">
      <img src="assets/screenshots/lightbox.webp" alt="Lightbox viewer" width="100%"><br>
      <sub><b>Lightbox viewer</b> — zoom, pan, slideshow, and a magnifying dock.</sub>
    </td>
  </tr>
</table>

<details>
<summary><b>🎛️ In-browser Board Configurator</b></summary>

<p align="center">
  <img src="assets/screenshots/configurator.webp" alt="Board Configurator" width="720"><br>
  <sub>Add your own boards by id + label, hide ones you don't use, or delete them — all without editing source code.</sub>
</p>

</details>

## 🌐 Supported boards

| Source | Board(s) | Cloudflare | Format |
|:--|:--|:--:|:--|
| **4chan** | /mu/, /trash/, /gif/ | No | 4chan API |
| **2ch.org** (Dvach) | /kpop/ | No | Dvach / Vichan |
| **Mokachan** | /kr/ | No | Meguca |
| **Desuarchive** | /mu/, /trash/ | No | Foolfuuka |
| ~~Easychan (defunct)~~ | ~~/kr/~~ | ~~Yes~~ | ~~Meguca~~ |

> [!TIP]
> Users can add their own boards on the supported sites via the in-app **Board Configurator** — no source edits needed. Adding a new *built-in default* is still a single entry in [`src/lib/boards.ts`](src/lib/boards.ts).

<details>
<summary><b>A note on Cloudflare</b></summary>

Cloudflare-bypass support (FlareSolverr) is **retained in code** for future Cloudflare-fronted boards, but is **not deployed in production** — the only board that ever needed it, Easychan, is defunct. It is dormant, not a headline feature.

</details>

## 🎮 Lightbox hotkeys

| Key | Action |
|:--|:--|
| <kbd>←</kbd> / <kbd>→</kbd> | Navigate between media |
| <kbd>Space</kbd> | Toggle slideshow |
| <kbd>F</kbd> | Toggle fullscreen |
| <kbd>H</kbd> | Flip image horizontally |
| <kbd>R</kbd> | Rotate |
| <kbd>S</kbd> | Download current media |
| <kbd>T</kbd> | Toggle thumbnail strip |
| <kbd>M</kbd> | Mute / unmute video |
| <kbd>Esc</kbd> | Close lightbox |

## 🚀 Quick start

### Local development

Run the app directly without pm2 — ideal for development or quick testing:

```bash
git clone https://github.com/kpg-anon/4chmg2.git
cd 4chmg2
cp .env.example .env
nano .env                    # set your port, etc.
npm install
npm run build
npm start
```

### Persistent server (pm2 + gulp)

Use pm2 for process management with automatic restarts and zero-downtime reloads:

```bash
git clone https://github.com/kpg-anon/4chmg2.git
cd 4chmg2
cp .env.example .env
nano .env                    # set your domain, port, etc.
npm install
npx gulp reset               # install, build, and start under pm2
```

### VPS deployment (Debian 12)

For a full production setup with nginx, SSL (certbot), and pm2 autostart:

```bash
sudo ./install.sh
```

See **[docs/INSTALLATION.md](docs/INSTALLATION.md)** for the complete walkthrough.

## 🧑‍💻 Usage

After making changes to the code:

```bash
npx gulp                     # build + reload (everyday command)
```

| Command | Description |
|:--|:--|
| `npx gulp` | Build and reload the server |
| `npx gulp build` | Build only |
| `npx gulp restart` | Reload pm2 only |
| `npx gulp reset` | Full setup from scratch (install + build + start) |
| `npx gulp logs` | View application logs |
| `npx gulp status` | Check pm2 process status |

## 🛠️ Tech stack

| Layer | Technology |
|:--|:--|
| Framework | Next.js 16 (App Router) |
| Runtime | React 19 |
| Language | TypeScript |
| Styling | Tailwind CSS v4 |
| Process manager | pm2 |
| Build runner | gulp |
| Reverse proxy | nginx + certbot |

<sub>Cloudflare-bypass (FlareSolverr) support is retained in code for future Cloudflare-fronted boards, but is dormant and not deployed in production.</sub>

## 📦 Deployment

4CHMG2 is designed to be self-hosted. Instance-specific configuration (domain, ports, etc.) lives in `.env`, which is gitignored. For full VPS deployment details, see **[docs/INSTALLATION.md](docs/INSTALLATION.md)**.

## 🗺️ Roadmap

- [ ] Additional imageboard sources
- [ ] Media deduplication via perceptual hash
- [ ] Gallery sharing via URL
- [ ] Expanded settings (grid density, accent color)

## 📜 License

[MIT](LICENSE)

---

<div align="center">
<sub>Built with <a href="https://nextjs.org">Next.js</a>, <a href="https://react.dev">React</a>, and <a href="https://tailwindcss.com">Tailwind CSS</a>.</sub>
</div>
