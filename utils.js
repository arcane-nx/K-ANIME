const fs = require('fs');
const path = require('path');
const os = require('os');
const chalk = require('chalk');
const figlet = require('figlet');
const gradient = require('gradient-string');

// --- Configuration ---
const API_DOMAIN = 'https://arcane-nx-cipher-pol.hf.space/api';
const SEARCH_API = `${API_DOMAIN}/anime/search`;
const INFO_API = `${API_DOMAIN}/anime/info`;
const DOWNLOAD_API = `${API_DOMAIN}/anime/download`;
const USER_AGENT = 'Mozilla/5.0 (Linux; Android 10; K) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/143.0.0.0 Mobile Safari/537.36';
const CONFIG_PATH = path.join(os.homedir(), '.k-anime-config.json');

// --- Helpers ---
const sleep = (ms) => new Promise(resolve => setTimeout(resolve, ms));

const loadConfig = () => {
    if (fs.existsSync(CONFIG_PATH)) {
        try {
            return JSON.parse(fs.readFileSync(CONFIG_PATH, 'utf8'));
        } catch (e) {
            return {};
        }
    }
    return {};
};

const saveConfig = (config) => {
    fs.writeFileSync(CONFIG_PATH, JSON.stringify(config, null, 2));
};

const showBanner = () => {
    console.log(gradient.pastel.multiline(figlet.textSync('K-ANIME', { font: 'Slant' })));
    console.log(chalk.cyan(' — Bulk Downloader & Search — \n'));
};

const checkForUpdates = async (currentVersion) => {
    try {
        const res = await fetch('https://registry.npmjs.org/@arcane_nx/kanime/latest');
        if (res.ok) {
            const data = await res.json();
            const latestVersion = data.version;
            if (latestVersion !== currentVersion) {
                console.log(chalk.yellow(`\n🔔 New update available: ${chalk.bold(latestVersion)} (Current: ${currentVersion})`));
                console.log(chalk.yellow(`👉 Run: ${chalk.cyan('npm install -g @arcane_nx/kanime')} to update!\n`));
                await sleep(1500); // Give user time to see the message
            }
        }
    } catch (e) {
        // Silently fail if update check fails
    }
};

const formatBytes = (bytes, decimals = 2) => {
    if (!+bytes) return '0 Bytes';
    const k = 1024;
    const dm = decimals < 0 ? 0 : decimals;
    const sizes = ['Bytes', 'KB', 'MB', 'GB', 'TB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return `${parseFloat((bytes / Math.pow(k, i)).toFixed(dm))} ${sizes[i]}`;
};

// --- Download Logic ---
async function downloadFile(url, filename, folder, multiBar, episode) {
    const filePath = path.join(folder, filename);
    let downloadedBytes = 0;
    let fileExists = false;

    if (fs.existsSync(filePath)) {
        downloadedBytes = fs.statSync(filePath).size;
        fileExists = true;
    }

    const progressBar = multiBar.create(100, 0, {
        episode: episode,
        speed: '0 B/s',
        value_formatted: formatBytes(downloadedBytes),
        total_formatted: 'Unknown'
    });

    try {
        const headers = {
            'User-Agent': USER_AGENT,
            'Referer': 'https://kwik.cx/'
        };

        if (fileExists) headers['Range'] = `bytes=${downloadedBytes}-`;

        const response = await fetch(url, { headers });

        if (response.status === 416) {
            progressBar.update(100, { 
                episode: episode,
                value_formatted: 'Complete', 
                total_formatted: 'Complete', 
                speed: '0 B/s' 
            });
            progressBar.stop();
            return true;
        }

        if (!response.ok && response.status !== 206) {
            throw new Error(`HTTP ${response.status}`);
        }

        const isResuming = response.status === 206;
        const contentLength = parseInt(response.headers.get('content-length'), 10);
        const totalBytes = isResuming ? downloadedBytes + contentLength : contentLength;

        progressBar.setTotal(totalBytes);
        progressBar.update(downloadedBytes, {
            episode: episode,
            total_formatted: formatBytes(totalBytes)
        });

        const fileStream = fs.createWriteStream(filePath, { flags: isResuming ? 'a' : 'w' });
        const reader = response.body.getReader();
        let currentProgress = downloadedBytes;
        let startTime = Date.now();

        while (true) {
            const { done, value } = await reader.read();
            if (done) break;
            
            fileStream.write(Buffer.from(value));
            currentProgress += value.length;
            
            const now = Date.now();
            const elapsed = (now - startTime) / 1000;
            const speed = elapsed > 0 ? (currentProgress - downloadedBytes) / elapsed : 0;

            progressBar.update(currentProgress, {
                episode: episode,
                value_formatted: formatBytes(currentProgress),
                speed: formatBytes(speed) + '/s'
            });
        }

        fileStream.end();
        progressBar.stop();
        return true;

    } catch (err) {
        progressBar.stop();
        throw err;
    }
}

module.exports = {
    SEARCH_API,
    INFO_API,
    DOWNLOAD_API,
    USER_AGENT,
    sleep,
    loadConfig,
    saveConfig,
    showBanner,
    checkForUpdates,
    formatBytes,
    downloadFile
};
