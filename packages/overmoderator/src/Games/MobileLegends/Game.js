const fetch = require('node-fetch');
const Jimp = require('jimp');

class Game {
    constructor() {
        this.players = [];
        this.heroes = [];
        this.hero = null;
        this.scores = new Map();
    }

    async fetchHeroes() {
        try {
            const response = await fetch('https://api.dazelpro.com/mobile-legends/hero');
            const data = await response.json();
            this.heroes = data.hero;
        } catch (error) {
            console.error('Error fetching heroes:', error);
        }
    }

    getRandomHero() {
        if (this.heroes.length === 0) {
            return null;
        }
        const randomIndex = Math.floor(Math.random() * this.heroes.length);
        return this.heroes[randomIndex];
    }

    async getHeroSilhouette() {
        if (!this.hero) {
            return null;
        }

        try {
            const image = await Jimp.read(this.hero.hero_avatar);
            image.scan(0, 0, image.bitmap.width, image.bitmap.height, function (x, y, idx) {
                const alpha = this.bitmap.data[idx + 3];
                if (alpha > 0) {
                    this.bitmap.data[idx] = 0;     // Red
                    this.bitmap.data[idx + 1] = 0; // Green
                    this.bitmap.data[idx + 2] = 0; // Blue
                    this.bitmap.data[idx + 3] = 255; // Alpha
                }
            });
            return await image.getBufferAsync(Jimp.MIME_PNG);
        } catch (error) {
            console.error('Error creating silhouette:', error);
            return null;
        }
    }

    addPlayer(playerId) {
        if (!this.players.includes(playerId)) {
            this.players.push(playerId);
            this.scores.set(playerId, 0);
        }
    }

    checkGuess(guess) {
        if (!this.hero) {
            return false;
        }
        return guess.toLowerCase() === this.hero.name.toLowerCase();
    }

    // More game logic will be added here
}

module.exports = Game;