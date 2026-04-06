const { EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle } = require('discord.js');

function clamp(n, min, max) {
    return Math.max(min, Math.min(max, n));
}

function randInt(min, max) {
    return Math.floor(Math.random() * (max - min + 1)) + min;
}

function bar(value, max, width = 10) {
    const v = clamp(value, 0, max);
    const filled = Math.round((v / max) * width);
    return `[${'█'.repeat(filled)}${'░'.repeat(width - filled)}] ${v}/${max}`;
}

function difficultyParams(difficulty) {
    switch ((difficulty || 'normal').toLowerCase()) {
        case 'easy':
            return { leakChance: 0.15, leakRateMin: 3, leakRateMax: 7, stormChance: 0.12, bailPower: 16 };
        case 'hard':
            return { leakChance: 0.3, leakRateMin: 6, leakRateMax: 12, stormChance: 0.22, bailPower: 12 };
        default:
            return { leakChance: 0.22, leakRateMin: 4, leakRateMax: 10, stormChance: 0.16, bailPower: 14 };
    }
}

function createGame({ channelId, guildId, captainId, difficulty }) {
    const params = difficultyParams(difficulty);

    return {
        gameType: 'sink',
        status: 'running',
        channelId,
        guildId,
        captainId,
        difficulty: (difficulty || 'normal').toLowerCase(),
        turn: 0,
        hull: 100,
        water: 0,
        pumps: 75,
        morale: 80,
        crew: [captainId],
        leaks: [
            { id: 1, location: 'Engine room', rate: randInt(params.leakRateMin, params.leakRateMin + 2), patched: false }
        ],
        log: ['A loud crack echoes through the hull. Water starts seeping in...'],
        messageId: null,
        params
    };
}

function isCrew(game, userId) {
    return Array.isArray(game.crew) && game.crew.includes(userId);
}

function summarizeLeaks(game) {
    const active = game.leaks.filter(l => !l.patched);
    if (active.length === 0) return 'None';
    return active
        .map(l => `#${l.id} ${l.location} (+${l.rate}/turn)`)
        .slice(0, 5)
        .join('\n');
}

function makeEmbed(game, client) {
    const title = game.status === 'ended'
        ? (game.hull <= 0 || game.water >= 100 ? 'Sink — Ship Lost' : 'Sink — Ship Saved')
        : 'Sink — Boat Sinking Simulator';

    const color = game.status === 'ended'
        ? (game.hull <= 0 || game.water >= 100 ? 0xCC3333 : 0x33CC66)
        : 0x3399FF;

    const captainName = client?.users?.cache?.get(game.captainId)?.username || 'Captain';
    const crewMentions = game.crew.map(id => `<@${id}>`).join(' ');

    const embed = new EmbedBuilder()
        .setTitle(title)
        .setColor(color)
        .addFields(
            { name: 'Captain', value: captainName, inline: true },
            { name: 'Difficulty', value: game.difficulty, inline: true },
            { name: 'Turn', value: String(game.turn), inline: true },
            { name: 'Hull', value: bar(game.hull, 100), inline: false },
            { name: 'Water', value: bar(game.water, 100), inline: false },
            { name: 'Pumps', value: bar(game.pumps, 100), inline: false },
            { name: 'Morale', value: bar(game.morale, 100), inline: false },
            { name: 'Active leaks', value: summarizeLeaks(game), inline: false },
            { name: 'Crew', value: crewMentions || 'None', inline: false },
        );

    const tail = game.log.slice(-4).join('\n');
    if (tail) embed.setDescription(tail);

    return embed;
}

function makeComponents(game) {
    if (game.status !== 'running') return [];

    const row1 = new ActionRowBuilder().addComponents(
        new ButtonBuilder().setCustomId('sink:patch').setLabel('Patch Leak').setStyle(ButtonStyle.Primary),
        new ButtonBuilder().setCustomId('sink:bail').setLabel('Bail Water').setStyle(ButtonStyle.Primary),
        new ButtonBuilder().setCustomId('sink:brace').setLabel('Brace').setStyle(ButtonStyle.Secondary),
        new ButtonBuilder().setCustomId('sink:tick').setLabel('Wait / Tick').setStyle(ButtonStyle.Secondary),
    );

    const row2 = new ActionRowBuilder().addComponents(
        new ButtonBuilder().setCustomId('sink:abandon').setLabel('Abandon Ship').setStyle(ButtonStyle.Danger),
    );

    return [row1, row2];
}

function maybeAddLeak(game) {
    const { leakChance, leakRateMin, leakRateMax } = game.params;
    if (Math.random() > leakChance) return;

    const id = (game.leaks.reduce((m, l) => Math.max(m, l.id), 0) || 0) + 1;
    const locations = ['Cargo hold', 'Galley', 'Cabin deck', 'Engine room', 'Starboard hull', 'Port hull'];
    const location = locations[randInt(0, locations.length - 1)];
    const rate = randInt(leakRateMin, leakRateMax);

    game.leaks.push({ id, location, rate, patched: false });
    game.hull = clamp(game.hull - randInt(1, 4), 0, 100);
    game.log.push(`A new leak opens in the ${location} (leak #${id}).`);
}

function maybeStorm(game) {
    const { stormChance } = game.params;
    if (Math.random() > stormChance) return;

    const hit = randInt(4, 10);
    game.hull = clamp(game.hull - hit, 0, 100);
    game.pumps = clamp(game.pumps - randInt(2, 8), 0, 100);
    game.morale = clamp(game.morale - randInt(3, 7), 0, 100);
    game.log.push(`A storm slams the ship (-${hit} hull).`);
}

function applyFlooding(game) {
    const leakInflow = game.leaks.filter(l => !l.patched).reduce((sum, l) => sum + l.rate, 0);
    const pumpEffect = Math.round((game.pumps / 100) * 10);

    game.water = clamp(game.water + leakInflow - pumpEffect, 0, 100);

    if (game.water >= 70) {
        game.morale = clamp(game.morale - 2, 0, 100);
    }

    if (game.water >= 85) {
        game.hull = clamp(game.hull - 2, 0, 100);
    }
}

function endIfNeeded(game) {
    if (game.status !== 'running') return;
    if (game.hull <= 0 || game.water >= 100 || game.morale <= 0) {
        game.status = 'ended';
        game.log.push('The ship is lost.');
        return;
    }

    if (game.turn >= 20 && game.water <= 15 && game.leaks.every(l => l.patched)) {
        game.status = 'ended';
        game.log.push('You stabilized the ship and limped into safe waters.');
    }
}

function tick(game) {
    game.turn += 1;

    maybeStorm(game);
    maybeAddLeak(game);
    applyFlooding(game);

    if (game.pumps > 0) {
        game.pumps = clamp(game.pumps - randInt(1, 3), 0, 100);
    }

    endIfNeeded(game);
}

function actionPatch(game, userId) {
    const target = game.leaks.find(l => !l.patched);
    if (!target) {
        game.log.push(`<@${userId}> searches for leaks... none remain.`);
        return;
    }

    const successChance = 0.65 + (game.morale / 400);
    if (Math.random() <= successChance) {
        target.patched = true;
        game.morale = clamp(game.morale + 2, 0, 100);
        game.log.push(`<@${userId}> patches leak #${target.id} in the ${target.location}.`);
    } else {
        game.morale = clamp(game.morale - 2, 0, 100);
        game.hull = clamp(game.hull - 1, 0, 100);
        game.log.push(`<@${userId}> fails to seal leak #${target.id}. The crack spreads.`);
    }
}

function actionBail(game, userId) {
    const bail = game.params.bailPower + randInt(-3, 3);
    game.water = clamp(game.water - bail, 0, 100);
    game.morale = clamp(game.morale - 1, 0, 100);
    game.pumps = clamp(game.pumps + randInt(0, 3), 0, 100);
    game.log.push(`<@${userId}> bails water (-${bail} water).`);
}

function actionBrace(game, userId) {
    game.morale = clamp(game.morale + 4, 0, 100);
    game.pumps = clamp(game.pumps + 2, 0, 100);
    game.log.push(`<@${userId}> rallies the crew. Everyone braces and keeps working.`);
}

function actionAbandon(game, userId) {
    game.status = 'ended';
    game.log.push(`<@${userId}> orders abandon ship.`);
}

function applyAction(game, action, userId) {
    if (game.status !== 'running') return { game, error: 'Game is not running.' };

    if (action !== 'tick' && action !== 'status' && !isCrew(game, userId)) {
        return { game, error: 'You are not part of the crew. Use /sink join first.' };
    }

    switch (action) {
        case 'patch':
            actionPatch(game, userId);
            tick(game);
            break;
        case 'bail':
            actionBail(game, userId);
            tick(game);
            break;
        case 'brace':
            actionBrace(game, userId);
            tick(game);
            break;
        case 'tick':
            game.log.push(`<@${userId}> waits...`);
            tick(game);
            break;
        case 'abandon':
            actionAbandon(game, userId);
            break;
        default:
            return { game, error: 'Unknown action.' };
    }

    endIfNeeded(game);
    return { game, error: null };
}

module.exports = {
    createGame,
    makeEmbed,
    makeComponents,
    applyAction,
    isCrew
};
