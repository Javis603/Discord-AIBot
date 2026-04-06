const mongoose = require('mongoose');

const wordFuddleSchema = new mongoose.Schema({
    channelId: { type: String, required: true, index: true },
    guildId: { type: String, required: true, index: true },
    messageId: { type: String, unique: true },
    players: [{
        userId: { type: String, required: true },
        score: { type: Number, default: 0 },
        lastGuess: { type: Date, default: Date.now }
    }],
    currentWord: {
        original: { type: String },
        scrambled: { type: String }
    },
    previousWords: [{ type: String }],
    status: {
        type: String,
        enum: ['waiting', 'playing', 'round_over', 'finished'],
        default: 'waiting'
    },
    round: { type: Number, default: 1 },
    maxRounds: { type: Number, default: 10 },
    hintLevel: { type: Number, default: 0 }, // 0 = no hint, 1 = first letter, 2 = first 2 letters, etc.
    hintGivenAt: { type: Date },
    hintCooldown: { type: Number, default: 30000 }, // 30 seconds
    roundEndsAt: { type: Date },
    roundDuration: { type: Number, default: 300000 }, // 5 minutes per round
    createdAt: { type: Date, default: Date.now, expires: 86400 } // Auto-delete after 24h
}, { timestamps: true });

// Common words dictionary (you can expand this list)
const WORD_LIST = [
    'elephant', 'computer', 'keyboard', 'mountain', 'ocean', 'giraffe',
    'umbrella', 'butterfly', 'sunshine', 'waterfall', 'dolphin', 'telescope',
    'adventure', 'basketball', 'chocolate', 'dictionary', 'elephant', 'fireworks'
];

// Helper function to scramble a word
function scrambleWord(word) {
    const arr = word.split('');
    for (let i = arr.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [arr[i], arr[j]] = [arr[j], arr[i]];
    }
    // Make sure the word is actually scrambled
    if (arr.join('') === word) return scrambleWord(word);
    return arr.join('');
}

// Static methods
wordFuddleSchema.statics.createNewGame = async function (channelId, guildId, userId) {
    const game = new this({
        channelId,
        guildId,
        players: [{ userId, score: 0 }]
    });

    await game.newRound();
    return game.save();
};

// Instance methods
wordFuddleSchema.methods.addPlayer = function (userId) {
    if (this.players.some(p => p.userId === userId)) {
        throw new Error('You are already in the game!');
    }

    if (this.status !== 'waiting') {
        throw new Error('Cannot join a game that has already started');
    }

    this.players.push({ userId, score: 0 });
    return this.save();
};

wordFuddleSchema.methods.startGame = function () {
    if (this.status !== 'waiting') {
        throw new Error('Game has already started');
    }

    if (this.players.length < 1) {
        throw new Error('Need at least 1 player to start');
    }

    this.status = 'playing';
    this.round = 1;
    this.roundEndsAt = new Date(Date.now() + this.roundDuration);
    return this.save();
};

wordFuddleSchema.methods.newRound = function () {
    if (this.status === 'finished') {
        throw new Error('Game is already finished');
    }

    // Get a new word that hasn't been used yet
    let newWord;
    do {
        newWord = WORD_LIST[Math.floor(Math.random() * WORD_LIST.length)];
    } while (this.previousWords.includes(newWord));

    this.currentWord = {
        original: newWord,
        scrambled: scrambleWord(newWord)
    };

    this.previousWords.push(newWord);
    this.hintLevel = 0;
    this.hintGivenAt = null;
    this.status = 'playing';
    this.roundEndsAt = new Date(Date.now() + this.roundDuration);

    return this.save();
};

wordFuddleSchema.methods.giveHint = function () {
    if (this.status !== 'playing') {
        throw new Error('No active round to give a hint for');
    }

    const now = new Date();
    if (this.hintGivenAt && (now - this.hintGivenAt) < this.hintCooldown) {
        const timeLeft = Math.ceil((this.hintCooldown - (now - this.hintGivenAt)) / 1000);
        throw new Error(`Please wait ${timeLeft} seconds before requesting another hint`);
    }

    this.hintLevel = Math.min(this.hintLevel + 1, this.currentWord.original.length - 1);
    this.hintGivenAt = now;

    return this.save();
};

wordFuddleSchema.methods.makeGuess = function (userId, guess) {
    if (this.status !== 'playing') {
        throw new Error('No active round to guess');
    }

    const player = this.players.find(p => p.userId === userId);
    if (!player) {
        throw new Error('You are not in this game');
    }

    if (guess.toLowerCase() === this.currentWord.original.toLowerCase()) {
        // Calculate score based on time left and hint level
        const timeLeft = (this.roundEndsAt - new Date()) / 1000; // in seconds
        const timeScore = Math.max(100, Math.floor(timeLeft / 10));
        const hintPenalty = this.hintLevel * 20;
        const roundScore = timeScore - hintPenalty;

        player.score += roundScore;
        player.lastGuess = new Date();

        if (this.round >= this.maxRounds) {
            this.status = 'finished';
        } else {
            this.status = 'round_over';
        }

        return this.save().then(updatedGame => ({
            correct: true,
            score: roundScore,
            game: updatedGame
        }));
    }

    return Promise.resolve({ correct: false });
};

wordFuddleSchema.methods.skipWord = function () {
    if (this.status !== 'playing') {
        throw new Error('No active round to skip');
    }

    this.status = 'round_over';
    return this.save();
};

wordFuddleSchema.methods.getHint = function () {
    if (!this.currentWord) return '';
    return this.currentWord.original
        .substring(0, this.hintLevel + 1)
        .padEnd(this.currentWord.original.length, '_');
};

module.exports = mongoose.model('WordFuddleGame', wordFuddleSchema);
