<p align="center">
<pre>
███████████                      █████████                      █████     █████                       
▒▒███▒▒▒▒▒███                    ███▒▒▒▒▒███                    ▒▒███     ▒▒███                        
 ▒███    ▒███  ██████   ██████  ███     ▒▒▒  ████████   ██████   ▒███████  ▒███████   ██████  ████████ 
 ▒██████████  ███▒▒███ ███▒▒███▒███         ▒▒███▒▒███ ▒▒▒▒▒███  ▒███▒▒███ ▒███▒▒███ ███▒▒███▒▒███▒▒███
 ▒███▒▒▒▒▒███▒███ ▒███▒███ ▒███▒███    █████ ▒███ ▒▒▒   ███████  ▒███ ▒███ ▒███ ▒███▒███████  ▒███ ▒▒▒ 
 ▒███    ▒███▒███ ▒███▒███ ▒███▒▒███  ▒▒███  ▒███      ███▒▒███  ▒███ ▒███ ▒███ ▒███▒███▒▒▒   ▒███     
 ███████████ ▒▒██████ ▒▒██████  ▒▒█████████  █████    ▒▒████████ ████████  ████████ ▒▒██████  █████    
▒▒▒▒▒▒▒▒▒▒▒   ▒▒▒▒▒▒   ▒▒▒▒▒▒    ▒▒▒▒▒▒▒▒▒  ▒▒▒▒▒      ▒▒▒▒▒▒▒▒ ▒▒▒▒▒▒▒▒  ▒▒▒▒▒▒▒▒   ▒▒▒▒▒▒  ▒▒▒▒▒     
                                  extension
</pre>
</p>

<p align="center">
  <a href="#">
    <img src="https://img.shields.io/badge/version-1.7.0-ghost?labelColor=0a0a0a&color=4a9&style=for-the-badge" alt="Version"/>
  </a>
  <a href="https://github.com/xammen/gif">
    <img src="https://img.shields.io/badge/website-hiii.boo/gif-ghost?labelColor=0a0a0a&color=888&style=for-the-badge" alt="Website"/>
  </a>
  <a href="#">
    <img src="https://img.shields.io/badge/manifest-v3-ghost?labelColor=0a0a0a&color=666&style=for-the-badge&logo=googlechrome&logoColor=888" alt="Manifest V3"/>
  </a>
</p>

<p align="center">
  <i>chrome extension to download twitter/x gifs & videos with one click</i>
  <br/>
  <i>because right-click > save doesn't work on "gifs" that are actually mp4s</i>
</p>

---

## ✨ what does it do?

adds a `GIF` button to gifs, and a `MP4` button to videos.

```
  ╭──────────────────────────────────────────╮
  │   tweet with a gif                       │
  │   ┌────────────────────────────────┐     │
  │   │         [looping gif]          │     │
  │   └────────────────────────────────┘     │
  │   💬  🔁  ❤️  📊  [GIF]                  │
  ╰──────────────────────────────────────────╯

  ╭──────────────────────────────────────────╮
  │   tweet with a video                     │
  │   ┌────────────────────────────────┐     │
  │   │    [video with ▶ controls]     │     │
  │   └────────────────────────────────┘     │
  │   💬  🔁  ❤️  📊  [MP4]                  │
  ╰──────────────────────────────────────────╯
```

---

## 🔮 features

| feature | |
|---------|---|
| one-click gif download | ✓ |
| **one-click mp4 download** | ✓ **NEW** |
| copy mp4 link | ✓ |
| copy gif link (auto-uploads) | ✓ |
| **separate history & downloads tabs** | ✓ **NEW** |
| **auto-upload on download** | ✓ **NEW** |
| works on twitter.com & x.com | ✓ |
| configurable quality/fps/size | ✓ |
| dark minimal ui | ✓ |

---

## 🆕 what's new in v1.7

### MP4 button for videos

real videos (with audio/controls) now get a dedicated `MP4` button for quick download or link copy.

```
  ╭─────────────────╮
  │  download mp4   │  ← saves .mp4 directly
  ├─────────────────┤
  │  copy mp4 link  │  ← copies direct url
  ╰─────────────────╯
```

### separate history & downloads

- **history tab**: copied links with preview (shareable urls)
- **downloads tab**: local downloads (gif & mp4 files)

```
  ┌──────────────────────────────────────┐
  │  [History]  [Downloads]  [Settings]  │
  └──────────────────────────────────────┘
```

### auto-upload on download

enable in settings to automatically upload gifs when downloading, so you get both:
- the file saved locally
- a shareable link in your history

---

## 📦 installation

```
  ┌────────────────────────────────────────────────────┐
  │                                                    │
  │   1. clone this repo                               │
  │      git clone https://github.com/xammen/          │
  │                 boograbber-extension               │
  │                                                    │
  │   2. go to chrome://extensions                     │
  │                                                    │
  │   3. enable "developer mode" (top right)           │
  │                                                    │
  │   4. click "load unpacked"                         │
  │                                                    │
  │   5. select the cloned folder                      │
  │                                                    │
  │   6. pin the extension for easy access             │
  │                                                    │
  ╰────────────────────────────────────────────────────╯
```

---

## 🖱️ usage

### download a gif

1. find a tweet with a gif/video
2. click the `gif` button in the tweet actions
3. select from dropdown:

```
  ╭─────────────────╮
  │   ↓ download gif │  ← saves .gif to downloads
  ├─────────────────┤
  │   ⎘ copy link  › │──► mp4  ← direct video url
  ╰─────────────────╯    gif  ← uploads & copies link
```

### settings

click the extension icon to configure:

| setting | default | description |
|---------|---------|-------------|
| quality | 10 | 1-20 (higher = better) |
| max width | 480px | 320-640 or original |
| fps | 15 | 10-20 frames per second |
| auto-download | on | skip save dialog |
| auto-upload on download | off | get shareable link when downloading |
| auto-play gifs | off | animate previews in history |

---

## 📁 structure

```
boograbber-extension/
├── manifest.json          # v3 manifest
├── background/
│   └── service-worker.js  # handles conversion & downloads
├── content/
│   ├── content.js         # injects gif button into tweets
│   └── content.css        # button styles
├── popup/
│   ├── popup.html         # settings ui
│   ├── popup.js           # settings logic
│   └── popup.css          # popup styles
├── lib/
│   ├── gif.js             # gif.js library
│   ├── gif.worker.js      # gif.js web worker
│   ├── offscreen.html     # offscreen document
│   └── offscreen.js       # canvas/conversion logic
└── icons/                 # extension icons
```

---

## 🔒 privacy

```
  ┌─────────────────────────────────────────────────────┐
  │                                                     │
  │   ✓  conversion happens locally in your browser    │
  │   ✓  no account required                           │
  │   ✓  no tracking                                   │
  │                                                     │
  │   ☁️  "copy gif link" uploads to i.ibb.co          │
  │                                                     │
  └─────────────────────────────────────────────────────┘
```

| data | stored where |
|------|--------------|
| settings | chrome.storage.local (your browser) |
| history | chrome.storage.local (your browser) |
| uploaded gifs | i.ibb.co (if you use "copy gif link") |

---

## 🛠️ tech

| | |
|---|---|
| manifest | v3 |
| gif encoding | gif.js |
| image hosting | imgbb |
| video proxy | hiii.boo/api |

---

## 🔗 related

- [hiii.boo/gif](https://hiii.boo/gif) - web version (no extension needed)
- [xammen/gif](https://github.com/xammen/gif) - website source code

---

## 📜 license

do whatever you want with it.

---

<p align="center">
  <br/>
  <code>༼ つ ╹ ╹ ༽つ</code>
  <br/>
  <br/>
  <i>made with boredom</i>
  <br/>
  <br/>
</p>
