/**
 * @file Conversation.js
 * @description for saving user conversation data
 * @author Javis
 * @license MIT
 * @copyright Copyright (c) 2025
 */
const mongoose = require('mongoose');

const conversationSchema = new mongoose.Schema({
    userId: { 
        type: String, 
        required: true, 
        unique: true 
    },
    conversations: [{
        role: { 
            type: String, 
            required: true 
        },
        content: mongoose.Schema.Types.Mixed,
        timestamp: { 
            type: Date, 
            default: Date.now 
        }
    }],
    lastUpdated: { 
        type: Date, 
        default: Date.now 
    }
});

module.exports = mongoose.model('Conversation', conversationSchema);