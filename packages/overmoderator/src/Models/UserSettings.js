/**
 * @file UserSettings.js
 * @description for saving user settings data
 * @author Javis
 * @license MIT
 * @copyright Copyright (c) 2025
 */
const mongoose = require('mongoose');

const userSettingsSchema = new mongoose.Schema({
    userId: { type: String, required: true, unique: true },
    model: { type: String, default: 'default' },
    netSearchEnabled: { type: Boolean, default: false },
    deepThinkingEnabled: { type: Boolean, default: false },
    language: { type: String },
    lastUpdated: { type: Date, default: Date.now }
});

module.exports = mongoose.model('UserSettings', userSettingsSchema);