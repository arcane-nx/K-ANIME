# K-ANIME 🚀

[![npm version](https://img.shields.io/badge/npm-v2.0.3-blue.svg)](https://www.npmjs.com/)
[![License: ISC](https://img.shields.io/badge/License-ISC-blue.svg)](https://opensource.org/licenses/ISC)
[![Node.js](https://img.shields.io/badge/Node.js-v18+-green.svg)](https://nodejs.org/)

**K-ANIME** is a high-performance, bulk anime downloader CLI. Designed for speed and ease of use, it allows you to search, filter, and download entire series in parallel with a modern interactive interface.

## 📸 Preview

![K-ANIME UI](https://huggingface.co/datasets/arcane-nx/uploads/resolve/main/k-ANIME-UI.png)

---

## ✨ Features

- 🔍 **Real-time Search:** Search for any anime and see instant suggestions as you type.
- 📦 **Bulk & Range Downloads:** Download a single episode, a specific range, or an entire series (up to 50 episodes per batch).
- ⚡ **Multi-threaded Engine:** Configure up to 50 parallel downloads to maximize your bandwidth.
- 🔄 **Smart Resume:** 
  - **Interrupted Downloads:** Automatically resumes partial files where they left off.
  - **Smart Series Logic:** Detects already downloaded episodes in your folder and suggests starting the next batch from the next missing episode.
- 🛠️ **Configurable Defaults:** Saves your preferred quality (360p, 480p, 720p, 1080p), audio language (Sub/Dub), and concurrency settings.
- 📊 **Rich UI:** Beautiful progress bars, estimated total size calculation, and a clean pastel aesthetic.

---

## 🚀 Quick Start

### Prerequisites
- [Node.js](https://nodejs.org/) (v18.0.0 or higher)

### Installation

```bash
npm install -g @arcane_nx/kanime
```

---

## 🛠 Usage

Simply run the command from any directory where you whttps://huggingface.co/datasets/arcane-nx/uploads/resolve/main/k-ANIME-UI.pngant to save your anime:

```bash
kanime
```

### Interactive Workflow:
1. **Search:** Start typing the anime name. Use arrow keys to select from the results.
2. **Auto-Detect:** If you've downloaded episodes of this anime before, K-ANIME will notify you and suggest the next episode.
3. **Configure:**
   - **Range:** Enter the `From` and `To` episode numbers.
   - **Quality:** Select your preferred resolution.
   - **Audio:** Choose between Subbed or Dubbed (if available).
   - **Concurrency:** Choose how many parallel downloads to run (1–50).
4. **Confirm:** Review the estimated total file size and start the download!

---

## 📁 Project Structure

```text
k-anime/
├── K-ANIME.js      # Main CLI entry point & interactive logic
├── utils.js        # Core engine, API handlers, & download logic
├── package.json    # Metadata & dependencies
└── README.md       # Documentation
```

---

## ⚙️ Configuration
The tool stores your preferences in `~/.k-anime-config.json`. You can choose to update these defaults every time you start a download.

---

## 🤝 Contributing

1. Fork the Project
2. Create your Feature Branch (`git checkout -b feature/AmazingFeature`)
3. Commit your Changes (`git commit -m 'Add some AmazingFeature'`)
4. Push to the Branch (`git push origin feature/AmazingFeature`)
5. Open a Pull Request

---

## 📜 License
Distributed under the ISC License. See `package.json` for details.

## 👤 Author
**Arcane** - [GitHub Profile](https://github.com/yourusername)

---
*Disclaimer: This tool is for educational purposes only. Please support the official releases of the anime you watch.*
