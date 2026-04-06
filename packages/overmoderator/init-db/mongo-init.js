// MongoDB Initialization Script for Overmoderator Discord Bot
// This script runs automatically when the MongoDB container starts for the first time

print('🚀 Initializing Overmoderator database...');

// Switch to the overmoderator database
db = db.getSiblingDB('overmoderator');

// Create collections with validation schemas
print('📦 Creating collections...');

// Users collection - Discord user data and preferences
db.createCollection('users', {
    validator: {
        $jsonSchema: {
            bsonType: 'object',
            required: ['discordId'],
            properties: {
                discordId: {
                    bsonType: 'string',
                    description: 'Discord user ID - required'
                },
                username: {
                    bsonType: 'string',
                    description: 'Discord username'
                },
                preferences: {
                    bsonType: 'object',
                    description: 'User preferences'
                },
                stats: {
                    bsonType: 'object',
                    description: 'User statistics'
                },
                createdAt: {
                    bsonType: 'date'
                },
                updatedAt: {
                    bsonType: 'date'
                }
            }
        }
    }
});

// Guilds collection - Server configurations
db.createCollection('guilds', {
    validator: {
        $jsonSchema: {
            bsonType: 'object',
            required: ['guildId'],
            properties: {
                guildId: {
                    bsonType: 'string',
                    description: 'Discord guild ID - required'
                },
                guildName: {
                    bsonType: 'string'
                },
                prefix: {
                    bsonType: 'string',
                    description: 'Command prefix'
                },
                settings: {
                    bsonType: 'object',
                    description: 'Guild settings'
                },
                features: {
                    bsonType: 'object',
                    description: 'Enabled features'
                },
                createdAt: {
                    bsonType: 'date'
                },
                updatedAt: {
                    bsonType: 'date'
                }
            }
        }
    }
});

// Conversations collection - AI conversation history
db.createCollection('conversations', {
    validator: {
        $jsonSchema: {
            bsonType: 'object',
            required: ['channelId', 'userId'],
            properties: {
                guildId: {
                    bsonType: 'string'
                },
                channelId: {
                    bsonType: 'string',
                    description: 'Discord channel ID - required'
                },
                userId: {
                    bsonType: 'string',
                    description: 'Discord user ID - required'
                },
                messages: {
                    bsonType: 'array',
                    description: 'Conversation messages'
                },
                model: {
                    bsonType: 'string',
                    description: 'AI model used'
                },
                tokensUsed: {
                    bsonType: 'int'
                },
                createdAt: {
                    bsonType: 'date'
                },
                updatedAt: {
                    bsonType: 'date'
                }
            }
        }
    }
});

// Moderation logs collection
db.createCollection('moderationLogs', {
    validator: {
        $jsonSchema: {
            bsonType: 'object',
            required: ['guildId', 'action'],
            properties: {
                guildId: {
                    bsonType: 'string'
                },
                userId: {
                    bsonType: 'string'
                },
                moderatorId: {
                    bsonType: 'string'
                },
                action: {
                    bsonType: 'string',
                    enum: ['warn', 'mute', 'kick', 'ban', 'unban', 'timeout', 'delete']
                },
                reason: {
                    bsonType: 'string'
                },
                details: {
                    bsonType: 'object'
                },
                createdAt: {
                    bsonType: 'date'
                }
            }
        }
    }
});

// Voice sessions collection - Voice activity tracking
db.createCollection('voiceSessions', {
    validator: {
        $jsonSchema: {
            bsonType: 'object',
            required: ['guildId', 'userId', 'channelId'],
            properties: {
                guildId: {
                    bsonType: 'string'
                },
                userId: {
                    bsonType: 'string'
                },
                channelId: {
                    bsonType: 'string'
                },
                startTime: {
                    bsonType: 'date'
                },
                endTime: {
                    bsonType: 'date'
                },
                duration: {
                    bsonType: 'int',
                    description: 'Duration in seconds'
                }
            }
        }
    }
});

// Create indexes for better query performance
print('📊 Creating indexes...');

// Users indexes
db.users.createIndex({ discordId: 1 }, { unique: true });
db.users.createIndex({ username: 1 });
db.users.createIndex({ createdAt: -1 });

// Guilds indexes
db.guilds.createIndex({ guildId: 1 }, { unique: true });
db.guilds.createIndex({ guildName: 1 });

// Conversations indexes
db.conversations.createIndex({ channelId: 1, userId: 1 });
db.conversations.createIndex({ guildId: 1 });
db.conversations.createIndex({ createdAt: -1 });
db.conversations.createIndex({ updatedAt: -1 });
// TTL index - auto-delete conversations older than 30 days
db.conversations.createIndex({ createdAt: 1 }, { expireAfterSeconds: 2592000 });

// Moderation logs indexes
db.moderationLogs.createIndex({ guildId: 1, createdAt: -1 });
db.moderationLogs.createIndex({ userId: 1 });
db.moderationLogs.createIndex({ moderatorId: 1 });
db.moderationLogs.createIndex({ action: 1 });

// Voice sessions indexes
db.voiceSessions.createIndex({ guildId: 1, userId: 1 });
db.voiceSessions.createIndex({ startTime: -1 });
// TTL index - auto-delete voice sessions older than 90 days
db.voiceSessions.createIndex({ startTime: 1 }, { expireAfterSeconds: 7776000 });

print('✅ Database initialization complete!');
print('📋 Collections created: users, guilds, conversations, moderationLogs, voiceSessions');
