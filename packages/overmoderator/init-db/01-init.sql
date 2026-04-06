-- Discord Bot Database Initialization Script
-- This script runs automatically when the PostgreSQL container starts for the first time

-- Enable required extensions
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pg_trgm";  -- For text search

-- Create schema for bot data
CREATE SCHEMA IF NOT EXISTS bot;

-- Grant permissions
GRANT ALL PRIVILEGES ON SCHEMA bot TO discord_bot;
GRANT ALL PRIVILEGES ON ALL TABLES IN SCHEMA bot TO discord_bot;
GRANT ALL PRIVILEGES ON ALL SEQUENCES IN SCHEMA bot TO discord_bot;

-- Set default schema
ALTER USER discord_bot SET search_path TO bot, public;

-- Users table for storing Discord user data
CREATE TABLE IF NOT EXISTS bot.users (
    id SERIAL PRIMARY KEY,
    discord_id VARCHAR(20) UNIQUE NOT NULL,
    username VARCHAR(100),
    discriminator VARCHAR(10),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Guilds table for storing server configurations
CREATE TABLE IF NOT EXISTS bot.guilds (
    id SERIAL PRIMARY KEY,
    guild_id VARCHAR(20) UNIQUE NOT NULL,
    guild_name VARCHAR(100),
    prefix VARCHAR(10) DEFAULT '!',
    settings JSONB DEFAULT '{}',
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- User settings for storing per-user preferences/feature flags
CREATE TABLE IF NOT EXISTS bot.user_settings (
    user_id VARCHAR(20) PRIMARY KEY,
    model VARCHAR(50) DEFAULT 'default',
    net_search_enabled BOOLEAN DEFAULT FALSE,
    deep_thinking_enabled BOOLEAN DEFAULT FALSE,
    language VARCHAR(10),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Moderation logs table
CREATE TABLE IF NOT EXISTS bot.moderation_logs (
    id SERIAL PRIMARY KEY,
    guild_id VARCHAR(20) NOT NULL,
    user_id VARCHAR(20) NOT NULL,
    moderator_id VARCHAR(20) NOT NULL,
    action VARCHAR(50) NOT NULL,
    reason TEXT,
    details JSONB DEFAULT '{}',
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Voice activity logs
CREATE TABLE IF NOT EXISTS bot.voice_logs (
    id SERIAL PRIMARY KEY,
    guild_id VARCHAR(20) NOT NULL,
    user_id VARCHAR(20) NOT NULL,
    channel_id VARCHAR(20) NOT NULL,
    action VARCHAR(20) NOT NULL,  -- 'join', 'leave', 'move'
    duration_seconds INTEGER,
    metadata JSONB DEFAULT '{}',
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- AI conversation history
CREATE TABLE IF NOT EXISTS bot.conversations (
    id SERIAL PRIMARY KEY,
    guild_id VARCHAR(20),
    channel_id VARCHAR(20),
    user_id VARCHAR(20) NOT NULL,
    role VARCHAR(20) NOT NULL,  -- 'user', 'assistant', 'system'
    content JSONB NOT NULL,
    tokens_used INTEGER,
    model VARCHAR(50),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Create indexes for better query performance
CREATE INDEX IF NOT EXISTS idx_users_discord_id ON bot.users(discord_id);
CREATE INDEX IF NOT EXISTS idx_guilds_guild_id ON bot.guilds(guild_id);
CREATE INDEX IF NOT EXISTS idx_moderation_logs_guild ON bot.moderation_logs(guild_id);
CREATE INDEX IF NOT EXISTS idx_moderation_logs_user ON bot.moderation_logs(user_id);
CREATE INDEX IF NOT EXISTS idx_moderation_logs_created ON bot.moderation_logs(created_at);
CREATE INDEX IF NOT EXISTS idx_voice_logs_guild ON bot.voice_logs(guild_id);
CREATE INDEX IF NOT EXISTS idx_voice_logs_user ON bot.voice_logs(user_id);
CREATE INDEX IF NOT EXISTS idx_conversations_channel ON bot.conversations(channel_id);
CREATE INDEX IF NOT EXISTS idx_conversations_user ON bot.conversations(user_id);
CREATE INDEX IF NOT EXISTS idx_conversations_created ON bot.conversations(created_at);

-- Function to update updated_at timestamp
CREATE OR REPLACE FUNCTION bot.update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = CURRENT_TIMESTAMP;
    RETURN NEW;
END;
$$ language 'plpgsql';

-- Triggers for auto-updating timestamps
DROP TRIGGER IF EXISTS update_users_updated_at ON bot.users;
CREATE TRIGGER update_users_updated_at
    BEFORE UPDATE ON bot.users
    FOR EACH ROW
    EXECUTE FUNCTION bot.update_updated_at_column();

DROP TRIGGER IF EXISTS update_guilds_updated_at ON bot.guilds;
CREATE TRIGGER update_guilds_updated_at
    BEFORE UPDATE ON bot.guilds
    FOR EACH ROW
    EXECUTE FUNCTION bot.update_updated_at_column();

DROP TRIGGER IF EXISTS update_user_settings_updated_at ON bot.user_settings;
CREATE TRIGGER update_user_settings_updated_at
    BEFORE UPDATE ON bot.user_settings
    FOR EACH ROW
    EXECUTE FUNCTION bot.update_updated_at_column();

-- Log successful initialization
DO $$
BEGIN
    RAISE NOTICE 'Discord bot database initialized successfully!';
END $$;
