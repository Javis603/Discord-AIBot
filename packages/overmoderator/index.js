/**
 * @file index.js
 * @description Discord-AIBot starter file
 * @author Javis
 * @see https://github.com/Javis603/Discord-AIBot
 * @license MIT
 * @copyright Copyright (c) 2025
 */
const { Client, GatewayIntentBits, Partials, Collection, TextInputStyle, AttachmentBuilder, EmbedBuilder, WebhookClient, ButtonBuilder, ActionRowBuilder, ButtonStyle, InteractionType } = require("discord.js");

const { exec } = require('child_process');
const axios = require('axios');
const chokidar = require('chokidar');
require('dotenv/config');

const { setDefaultLanguage, getText } = require('./src/Functions/i18n');
const defaultLanguage = process.env.BOT_LANG || 'zh-TW';
setDefaultLanguage(defaultLanguage);
console.log(getText('system.defaultLang', defaultLanguage, { lang: defaultLanguage }));

let webhookClient = null;
if (process.env.LOG_WEBHOOK_URL) {
    const url = String(process.env.LOG_WEBHOOK_URL || '').trim();
    const looksLikeDiscordWebhook = /^https?:\/\/[^\s]+\/api\/webhooks\//.test(url);

    if (!looksLikeDiscordWebhook) {
        console.error(getText('events.webhookError', defaultLanguage, { error: 'Invalid LOG_WEBHOOK_URL (skipping webhook logging)' }));
    } else {
        try {
            webhookClient = new WebhookClient({ url });
        } catch (error) {
            console.error(getText('events.webhookError', defaultLanguage, { error: error.message }));
            webhookClient = null;
        }
    }
}

let childProcess = null;

function cleanup() {
    console.log(getText('events.shuttingDown', defaultLanguage));

    if (watcher) {
        console.log(getText('system.stopFileWatch', defaultLanguage));
        watcher.close();
    }

    if (childProcess) {
        console.log(getText('system.terminatingProcess', defaultLanguage));
        try {
            if (process.platform === 'win32') {
                exec(`taskkill /pid ${childProcess.pid} /T /F`, (error) => {
                    if (error) console.error(getText('system.cantTerminate', defaultLanguage, { error }));
                    process.exit(0);
                });
            } else {
                childProcess.kill('SIGTERM');

                setTimeout(() => {
                    try {
                        childProcess.kill('SIGKILL');
                    } catch (e) { }
                    process.exit(0);
                }, 5000);
            }
        } catch (e) {
            console.error(getText('system.terminateError', defaultLanguage, { error: e }));
            process.exit(1);
        }
    } else {
        process.exit(0);
    }
}

process.on('SIGINT', cleanup);
process.on('SIGTERM', cleanup);
process.on('SIGHUP', cleanup);

process.on('uncaughtException', (error) => {
    console.error(getText('system.uncaughtException', defaultLanguage, { error }));
    cleanup();
});

process.on('unhandledRejection', (reason, promise) => {
    console.error(getText('system.unhandledRejection', defaultLanguage, { reason }));
    cleanup();
});

async function sendWebhookMessage(content) {
    if (!webhookClient) return;

    try {
        await new Promise(resolve => setTimeout(resolve, 100));
        await webhookClient.send(content);
    } catch (error) {
        console.error(getText('events.webhookError', defaultLanguage, { error: error.message }));
    }
}

function sendRestartRequest(fileList) {
    if (!webhookClient) return;

    const restartLabel = getText('components.buttons.restart', defaultLanguage);
    const reloadCommandLabel = getText('components.buttons.reload', defaultLanguage) + " " + getText('commands.command', defaultLanguage, { command: '' });
    const reloadEventLabel = getText('components.buttons.reload', defaultLanguage) + " " + getText('events.event', defaultLanguage, { event: '' });
    const fileChangedTitle = getText('events.fileChanged', defaultLanguage, { files: fileList });

    const row = new ActionRowBuilder()
        .addComponents(
            new ButtonBuilder()
                .setCustomId('restartBot')
                .setLabel(restartLabel)
                .setStyle(ButtonStyle.Danger),
            new ButtonBuilder()
                .setCustomId('confirm_reload_command')
                .setLabel(reloadCommandLabel)
                .setStyle(ButtonStyle.Primary),
            new ButtonBuilder()
                .setCustomId('confirm_reload_event')
                .setLabel(reloadEventLabel)
                .setStyle(ButtonStyle.Primary),
        );

    const em = new EmbedBuilder()
        .setTitle(fileChangedTitle);

    webhookClient.send({
        embeds: [em],
        components: [row]
    }).catch(console.error);
}

let debounceTimer;
const debounceDelay = 5000; // 5 second debounce
const changedFiles = new Set();

const watchConfig = {
    ignored: [
        ///(^|[\/\\])\../,
        /node_modules/,
        /logs/,
        /\.git/,
        /Commands\/Tools\/pdf2zh-env/,
        /Commands\/General\/temp/,
        ///\.env/,
        /\.(jpg|jpeg|png|gif|mp4|mp3)$/,
        /\.DS_Store$/
    ],
    persistent: true,
    ignoreInitial: true,
    awaitWriteFinish: {
        stabilityThreshold: 2000,
        pollInterval: 100
    },
    depth: 5
};

function getChangeType(path) {
    if (path.includes('Commands')) return 'commands';
    if (path.includes('Events')) return 'events';
    if (path.includes('src')) return 'source';
    return 'other';
}

const changes = {
    commands: new Set(),
    events: new Set(),
    source: new Set(),
    other: new Set()
};

const watcher = chokidar.watch('.', watchConfig);

watcher.on('change', (path) => {
    console.log(getText('events.fileChanged', defaultLanguage, { files: path }));
    const changeType = getChangeType(path);
    changes[changeType].add(path);

    if (debounceTimer) clearTimeout(debounceTimer);

    debounceTimer = setTimeout(() => {
        const summary = [];

        if (changes.commands.size) summary.push(`Commands: ${Array.from(changes.commands).map(p => `\`${p}\``).join(', ')}`);
        if (changes.events.size) summary.push(`Events: ${Array.from(changes.events).map(p => `\`${p}\``).join(', ')}`);
        if (changes.source.size) summary.push(`Source: ${Array.from(changes.source).map(p => `\`${p}\``).join(', ')}`);
        if (changes.other.size) summary.push(`Other: ${Array.from(changes.other).map(p => `\`${p}\``).join(', ')}`);

        const buttons = [];
        if (changes.commands.size) {
            buttons.push(
                new ButtonBuilder()
                    .setCustomId('confirm_reload_command')
                    .setLabel(getText('components.buttons.reload', defaultLanguage) + getText('commands.command', defaultLanguage, { command: '' }))
                    .setStyle(ButtonStyle.Primary)
            );
        }
        if (changes.events.size) {
            buttons.push(
                new ButtonBuilder()
                    .setCustomId('confirm_reload_event')
                    .setLabel(getText('components.buttons.reload', defaultLanguage) + getText('events.event', defaultLanguage, { event: '' }))
                    .setStyle(ButtonStyle.Primary)
            );
        }
        if (changes.source.size || changes.other.size) {
            buttons.push(
                new ButtonBuilder()
                    .setCustomId('restartBot')
                    .setLabel(getText('components.buttons.restart', defaultLanguage))
                    .setStyle(ButtonStyle.Danger)
            );
        }

        const embed = new EmbedBuilder()
            .setTitle(getText('events.fileChangeNotification', defaultLanguage))
            .setDescription(summary.join('\n'))
            .setTimestamp();

        if (webhookClient) {
            webhookClient.send({
                embeds: [embed],
                components: buttons.length ? [new ActionRowBuilder().addComponents(buttons)] : []
            }).catch(console.error);
        }

        Object.keys(changes).forEach(key => changes[key].clear());
    }, debounceDelay);
});

watcher.on('error', error => {
    console.error(getText('events.fileWatchError', defaultLanguage, { error: error.message }));

    if (webhookClient) {
        webhookClient.send({
            embeds: [
                new EmbedBuilder()
                    .setColor('Red')
                    .setTitle(getText('events.fileWatchError', defaultLanguage))
                    .setDescription(`\`\`\`${error.message}\`\`\``)
            ]
        }).catch(console.error);
    }
});

function runChildProcess() {
    childProcess = exec('node src/main.js');
    let messageQueue = [];
    let isProcessing = false;

    async function processMessageQueue() {
        if (!webhookClient || isProcessing || messageQueue.length === 0) return;

        isProcessing = true;
        while (messageQueue.length > 0) {
            const { content, type } = messageQueue.shift();
            await sendWebhookMessage(`\`\`\`${type === 'error' ? 'diff\n- ' : '\n'}${content}\`\`\``);
        }
        isProcessing = false;
    }

    childProcess.stdout.on('data', (data) => {
        process.stdout.write(data);

        let message = data.toString();
        while (message.length > 0) {
            const chunk = message.slice(0, 1990);
            messageQueue.push({ content: chunk, type: 'info' });
            message = message.slice(1990);
        }
        processMessageQueue();
    });

    childProcess.stderr.on('data', (data) => {
        process.stderr.write(data);

        let errorMessage = data.toString();
        while (errorMessage.length > 0) {
            const chunk = errorMessage.slice(0, 1985);
            messageQueue.push({ content: chunk, type: 'error' });
            errorMessage = errorMessage.slice(1985);
        }
        processMessageQueue();
    });

    childProcess.on('exit', async (code) => {
        const exitMessage = getText('events.processExit', defaultLanguage, { code: code });
        messageQueue.push({
            content: exitMessage,
            type: code === 0 ? 'info' : 'error'
        });
        await processMessageQueue();

        // Restart logic
        if (code === 990) {
            console.log(getText('system.receivedRestartSignal', defaultLanguage));
            setTimeout(() => runChildProcess(), 1000);
        } else if (code !== 0 && code !== null) {
            console.log(getText('system.abnormalExit', defaultLanguage, { code }));
            setTimeout(() => runChildProcess(), 5000);
        }

        childProcess = null;
    });

    childProcess.on('error', (error) => {
        console.error(getText('system.childProcessError', defaultLanguage, { error }));
        messageQueue.push({
            content: getText('system.childProcessError', defaultLanguage, { message: error.message }),
            type: 'error'
        });
        processMessageQueue();
    });
}

runChildProcess();