#!/usr/bin/env node

const fs = require('fs');
const path = require('path');
const inquirer = require('inquirer');
const chalk = require('chalk');
const ora = require('ora');
const cliProgress = require('cli-progress');

inquirer.registerPrompt('autocomplete', require('inquirer-autocomplete-prompt'));

const {
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
} = require('./utils');

const { version } = require('./package.json');

// --- Main App ---
async function main() {
    showBanner();
    await checkForUpdates(version);
    const config = loadConfig();

    try {
        // 1. Search Anime (Real-time)
        const { selectedAnime } = await inquirer.prompt([{
            type: 'autocomplete',
            name: 'selectedAnime',
            message: 'Search for Anime:',
            source: async (answers, input) => {
                if (!input || input.length < 2) return [];
                try {
                    const searchUrl = `${SEARCH_API}?q=${encodeURIComponent(input)}`;
                    const res = await fetch(searchUrl, { headers: { 'User-Agent': USER_AGENT } });
                    if (!res.ok) return [];
                    const data = await res.json();
                    return (data.results || []).map(a => ({
                        name: `${a.title} (${a.year}) - ${a.episodes} Ep${a.episodes !== 1 ? 's' : ''}`,
                        value: a
                    }));
                } catch (e) {
                    return [];
                }
            }
        }]);

        const animeId = selectedAnime.session;
        const selectedTitle = selectedAnime.title;

        // --- Smart Resume Logic ---
        const safeTitle = selectedTitle.replace(/[^a-z0-9]/gi, '_').toLowerCase();
        const outputDir = path.join(process.cwd(), safeTitle);
        
        let lastEpisodeFound = 0;
        if (fs.existsSync(outputDir)) {
            const files = fs.readdirSync(outputDir);
            const episodeRegex = new RegExp(`\\[K-ANIME\\]_${safeTitle}_Episode_(\\d+)\\.mp4`);
            files.forEach(file => {
                const match = file.match(episodeRegex);
                if (match) {
                    const epNum = parseInt(match[1], 10);
                    if (epNum > lastEpisodeFound) lastEpisodeFound = epNum;
                }
            });
        }

        // 2. Fetch Anime Info (Episodes)
        const spinner = ora('Fetching episode list...').start();
        const infoRes = await fetch(`${INFO_API}?id=${animeId}`, { headers: { 'User-Agent': USER_AGENT } });
        if (!infoRes.ok) throw new Error('Failed to fetch anime info');
        const infoData = await infoRes.json();
        const allEpisodes = infoData.results?.episodes || [];
        spinner.stop();

        if (!allEpisodes.length) {
            console.log(chalk.yellow('No episodes found for this anime.'));
            return;
        }

        const maxEpAvailable = Math.max(...allEpisodes.map(ep => ep.episode));
        const suggestedStart = (lastEpisodeFound > 0 && lastEpisodeFound < maxEpAvailable) 
            ? (lastEpisodeFound + 1).toString() 
            : '1';

        if (lastEpisodeFound > 0) {
            console.log(chalk.blue(`ℹ Detected local files up to Episode ${lastEpisodeFound}. Suggesting Episode ${suggestedStart}.`));
        }

        // 3. Fetch Available Quality/Language from a sample episode
        spinner.text = 'Detecting available qualities and languages...';
        spinner.start();
        const sampleEp = allEpisodes[allEpisodes.length - 1];
        const dlRes = await fetch(`${DOWNLOAD_API}?animeId=${animeId}&episodeId=${sampleEp.session}`, { 
            headers: { 'User-Agent': USER_AGENT } 
        });
        
        if (!dlRes.ok) throw new Error('Failed to detect options');
        const dlData = await dlRes.json();
        const availableLinks = dlData.results?.downloadLinks || [];
        spinner.stop();

        if (!availableLinks.length) {
            console.log(chalk.yellow('Could not detect download options.'));
            return;
        }

        const uniqueResolutions = [...new Set(availableLinks.map(l => l.resolution))];
        const uniqueLanguages = [...new Set(availableLinks.map(l => l.audio))];

        // 4. Configure Range, Quality, Language & Concurrency
        let settings;
        let targetEpisodes;
        let confirmed = false;

        while (!confirmed) {
            const questions = [
                {
                    type: 'list',
                    name: 'quality',
                    message: 'Select Quality:',
                    choices: uniqueResolutions,
                    default: settings?.quality || (config.quality && uniqueResolutions.includes(config.quality) ? config.quality : uniqueResolutions[0])
                },
                {
                    type: 'list',
                    name: 'language',
                    message: 'Select Audio Language:',
                    choices: uniqueLanguages,
                    default: settings?.language || (config.language && uniqueLanguages.includes(config.language) ? config.language : uniqueLanguages[0])
                }
            ];
            
            if (allEpisodes.length > 1) {
                questions.unshift(
                    { 
                        type: 'input', 
                        name: 'startEp', 
                        message: 'From Episode:', 
                        default: settings?.startEp || suggestedStart,
                        validate: (val) => {
                            const num = parseInt(val);
                            if (isNaN(num) || num <= 0) return 'Please enter a valid episode number';
                            if (num > maxEpAvailable) return `From Episode cannot be greater than available episodes (${maxEpAvailable})`;
                            return true;
                        }
                    },
                    { 
                        type: 'input', 
                        name: 'endEp', 
                        message: 'To Episode:', 
                        default: settings?.endEp || maxEpAvailable.toString(),
                        validate: (val, answers) => {
                            const end = parseInt(val);
                            const start = parseInt(answers.startEp);
                            if (isNaN(end)) return 'Please enter a valid episode number';
                            if (end > maxEpAvailable) return `To Episode cannot be greater than available episodes (${maxEpAvailable})`;
                            if (end < start) return `To Episode cannot be lower than From Episode (${start})`;
                            if (end - start + 1 > 50) return `You can only download up to 50 episodes at once (selected: ${end - start + 1})`;
                            return true;
                        }
                    }
                );
                questions.push({
                    type: 'number',
                    name: 'concurrency',
                    message: 'Parallel Downloads (1-50):',
                    default: settings?.concurrency || config.concurrency || 1,
                    validate: (val) => val >= 1 && val <= 50 ? true : 'Please enter a number between 1 and 50'
                });
            }

            questions.push({
                type: 'confirm',
                name: 'saveDefaults',
                message: 'Save quality, language and concurrency as default?',
                default: false
            });

            settings = await inquirer.prompt(questions);

            if (settings.saveDefaults) {
                saveConfig({
                    quality: settings.quality,
                    language: settings.language,
                    concurrency: settings.concurrency || config.concurrency || 1
                });
            }

            const start = allEpisodes.length === 1 ? allEpisodes[0].episode : parseInt(settings.startEp, 10);
            const end = allEpisodes.length === 1 ? allEpisodes[0].episode : parseInt(settings.endEp, 10);
            targetEpisodes = allEpisodes.filter(ep => ep.episode >= start && ep.episode <= end).reverse();

            if (!targetEpisodes.length) {
                console.log(chalk.yellow('No episodes found in the specified range.'));
                continue;
            }

            // 5.5 Calculate Estimated Size
            const sizeSpinner = ora('Calculating estimated total size...').start();
            let totalSizeBytes = 0;
            let fetchedCount = 0;
            
            const sizeQueue = [...targetEpisodes];
            const sizeWorkers = Array(Math.min(10, sizeQueue.length)).fill(0).map(async () => {
                while (sizeQueue.length > 0) {
                    const epTask = sizeQueue.shift();
                    try {
                        const dlResEp = await fetch(`${DOWNLOAD_API}?animeId=${animeId}&episodeId=${epTask.session}`, { 
                            headers: { 'User-Agent': USER_AGENT } 
                        });
                        if (dlResEp.ok) {
                            const dlDataEp = await dlResEp.json();
                            const links = dlDataEp.results?.downloadLinks || [];
                            const targetLink = links.find(l => l.resolution === settings.quality && l.audio === settings.language) 
                                            || links.find(l => l.resolution === settings.quality)
                                            || links[0];

                            if (targetLink && targetLink.mp4Url) {
                                epTask.preFetchedUrl = targetLink.mp4Url;
                                const headRes = await fetch(targetLink.mp4Url, { 
                                    method: 'HEAD', 
                                    headers: { 'User-Agent': USER_AGENT, 'Referer': 'https://kwik.cx/' } 
                                });
                                totalSizeBytes += parseInt(headRes.headers.get('content-length'), 10) || 0;
                                fetchedCount++;
                            }
                        }
                    } catch (e) {}
                }
            });

            await Promise.all(sizeWorkers);
            sizeSpinner.stop();

            if (fetchedCount > 0) {
                console.log(chalk.cyan(`\nEstimated Total Size: ${chalk.bold(formatBytes(totalSizeBytes))}`));
                const { action } = await inquirer.prompt([{
                    type: 'list',
                    name: 'action',
                    message: 'What would you like to do?',
                    choices: [
                        { name: '🚀 Start Download', value: 'start' },
                        { name: '⚙️  Adjust Range / Settings', value: 'adjust' },
                        { name: '❌ Cancel', value: 'cancel' }
                    ]
                }]);
                if (action === 'cancel') return;
                if (action === 'start') confirmed = true;
            } else {
                console.log(chalk.red('\nCould not estimate file sizes.'));
                const { retry } = await inquirer.prompt([{ type: 'confirm', name: 'retry', message: 'Retry?', default: true }]);
                if (!retry) return;
            }
        }

        console.log(chalk.cyan(`\nPreparing to download ${targetEpisodes.length} episodes for: ${chalk.bold(selectedTitle)}`));

        // 6. Setup Output Directory
        if (!fs.existsSync(outputDir)) {
            fs.mkdirSync(outputDir, { recursive: true });
        }

        // 7. Download
        const multiBar = new cliProgress.MultiBar({
            clearOnDone: false,
            hideCursor: true,
            format: `${chalk.blue('{bar}')} {percentage}% | {value_formatted}/{total_formatted} | ${chalk.green('{speed}')} | EP: ${chalk.yellow('{episode}')}`,
            barCompleteChar: '\u2588',
            barIncompleteChar: '\u2591',
        }, cliProgress.Presets.shades_classic);

        const queue = [...targetEpisodes];
        const results = { success: [], failed: [] };
        const MAX_RETRIES = 3;
        const concurrency = settings.concurrency || 1;

        const workers = Array(Math.min(concurrency, queue.length)).fill(0).map(async () => {
            while (queue.length > 0) {
                const epTask = queue.shift();
                let success = false;
                let attempts = 0;

                while (!success && attempts < MAX_RETRIES) {
                    try {
                        attempts++;
                        let downloadUrl = epTask.preFetchedUrl;
                        if (!downloadUrl) {
                            const dlResEp = await fetch(`${DOWNLOAD_API}?animeId=${animeId}&episodeId=${epTask.session}`, { 
                                headers: { 'User-Agent': USER_AGENT } 
                            });
                            const dlDataEp = await dlResEp.json();
                            const links = dlDataEp.results?.downloadLinks || [];
                            const targetLink = links.find(l => l.resolution === settings.quality && l.audio === settings.language) 
                                             || links.find(l => l.resolution === settings.quality)
                                             || links[0];
                            downloadUrl = targetLink.mp4Url;
                        }
                        const filename = `[K-ANIME]_${safeTitle}_Episode_${epTask.episode}.mp4`;
                        await downloadFile(downloadUrl, filename, outputDir, multiBar, epTask.episode);
                        success = true;
                        results.success.push({ episode: epTask.episode });
                    } catch (err) {
                        if (attempts >= MAX_RETRIES) results.failed.push({ episode: epTask.episode, error: err.message });
                        else await sleep(2000);
                    }
                }
            }
        });

        await Promise.all(workers);
        multiBar.stop();

        console.log(chalk.bold.green('\n✨ All tasks completed! ✨'));
        console.log(chalk.cyan(`Total: ${targetEpisodes.length} | Success: ${chalk.green(results.success.length)} | Failed: ${chalk.red(results.failed.length)}`));
        console.log(chalk.bold.magenta('Created by ARCANE'));

    } catch (error) {
        console.error(chalk.red('\n[CRITICAL ERROR]'), error.message);
    }
}

main();
