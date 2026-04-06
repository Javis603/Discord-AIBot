const mongoose = require('mongoose');

const gameSessionSchema = new mongoose.Schema({
    userId: { type: String, required: true, unique: true },
    channelId: { type: String, required: true },
    playerLocation: {
        x: { type: Number, default: 0 },
        y: { type: Number, default: 0 }
    },
    playerHealth: { type: Number, default: 100 },
    playerInventory: { type: [String], default: [] },
    currentMission: { type: String, default: 'Outer Perimeter Infiltration' },
    mapState: { type: [[String]], default: [] }, // e.g., [['.', 'E'], ['P', '.']]
    enemyPositions: [{
        x: { type: Number },
        y: { type: Number },
        direction: { type: String }, // e.g., 'north', 'south', 'east', 'west'
        patrolPath: [{ x: Number, y: Number }], // Array of coordinates for patrolling
        visionRange: { type: Number, default: 3 } // How many tiles the enemy can 'see'
    }],
    detectionLevel: { type: Number, default: 0 },
    inCombat: { type: Boolean, default: false },
    currentEnemy: { type: Number, default: -1 }, // Index of the enemy in enemyPositions array
    enemyHealth: { type: [Number], default: [] }, // Health for each enemy in current combat
    turnOrder: { type: String, default: 'player' }, // 'player' or 'enemy'
    lastUpdated: { type: Date, default: Date.now }
});

module.exports = mongoose.model('GameSession', gameSessionSchema);