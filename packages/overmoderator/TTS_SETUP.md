# TTS System Installation & Setup Guide

## 📦 Required Packages

To enable full TTS functionality, install the following packages:

```bash
cd /Users/kthlke/Documents/GitHub/Discord-AIBot/packages/overmoderator
npm install @discordjs/voice @discordjs/opus discord-tts ffmpeg-static sodium-native
```

### Package Descriptions:
- **@discordjs/voice** - Discord voice connection handling
- **@discordjs/opus** - Audio encoding/decoding
- **discord-tts** - Simple TTS generation for Discord
- **ffmpeg-static** - Audio processing (bundled FFmpeg)
- **sodium-native** - Encryption library for voice

## 🔧 Configuration

### 1. Update .env file

Add these new environment variables to your `.env` file:

```env
# TTS Configuration
TTS_ENABLED=true
TTS_DEFAULT_LANGUAGE=en-US
TTS_MAX_LENGTH=200
TTS_VOLUME=1.0

# TTS Moderation
TTS_MODERATION=true
TTS_RATE_LIMIT=3000
TTS_LOG_CHANNEL_ID=YOUR_LOG_CHANNEL_ID_HERE
```

### 2. Update Bot Intents

The `main.js` file needs to include `GuildVoiceStates` intent. 

Open `/src/main.js` and update line 13:

**BEFORE:**
```javascript
const { Guilds, GuildMembers, GuildMessages, MessageContent, GuildPresences } = GatewayIntentBits;
```

**AFTER:**
```javascript
const { Guilds, GuildMembers, GuildMessages, MessageContent, GuildPresences, GuildVoiceStates } = GatewayIntentBits;
```

Then update line 16:

**BEFORE:**
```javascript
const client = new Client({ 
    intents: [Guilds, GuildMembers, GuildMessages, MessageContent, GuildPresences], 
    partials: [User, Message, GuildMember, ThreadMember]
});
```

**AFTER:**
```javascript
const client = new Client({ 
    intents: [Guilds, GuildMembers, GuildMessages, MessageContent, GuildPresences, GuildVoiceStates], 
    partials: [User, Message, GuildMember, ThreadMember]
});
```

### 3. Enable Voice Handler

Open `/src/Handlers/voiceHandler.js` and uncomment the imports at the top:

```javascript
const { 
  joinVoiceChannel, 
  createAudioPlayer, 
  createAudioResource,
  AudioPlayerStatus,
  VoiceConnectionStatus,
  entersState,
  VoiceConnectionDisconnectReason
} = require('@discordjs/voice');
const discordTTS = require('discord-tts');
```

Then uncomment the implementation code in the relevant methods (marked with `// TODO:`).

## 🎤 Available Commands

After setup, users can use these commands:

### TTS Commands (User)
```
/tts speak <text> [language] - Generate and play TTS in voice channel
/tts stop                     - Stop current TTS playback
/tts skip                     - Skip current TTS
/tts queue                    - View TTS queue
/tts settings [volume] [speed] - Adjust TTS settings
```

### Admin Commands
```
/ttsstats view    - View TTS statistics
/ttsstats reset   - Reset statistics
/ttsstats config  - View/update configuration
```

## ✅ What's Already Working

Even without installing the voice packages, these features are working:

1. **✅ TTS Message Moderation**
   - Monitors TTS messages from users
   - Uses OpenAI API to filter inappropriate content
   - Rate limiting (3 seconds cooldown)
   - Automatic deletion of flagged messages
   - Detailed logging to designated channel

2. **✅ Error Handling**
   - Graceful degradation if API key missing
   - Proper error logging
   - Cache system for moderation results

3. **✅ Statistics Tracking**
   - Total messages processed
   - Messages flagged/deleted
   - Rate limit hits
   - Error counts

## 🚀 Testing

### Test TTS Moderation (works now)
1. Send a message with TTS enabled
2. Try sending multiple TTS messages rapidly (will be rate limited)
3. Check logs in your configured log channel

### Test Admin Commands (works now)
```
/ttsstats view    - View current statistics
/ttsstats config  - View configuration
```

### Test TTS Generation (after installing packages)
1. Join a voice channel
2. Use `/tts speak Hello world`
3. Bot should join and speak

## 📊 Monitoring

View TTS statistics:
```
/ttsstats view
```

Output example:
```
📊 TTS System Statistics

🔇 Moderation Stats
Total Processed: 42
Flagged: 3
Deleted: 3
Rate Limited: 8
Errors: 0

🎤 Voice Stats
Active Connections: 1
Queued Items: 2
Connected Guilds: 1

⚙️ Configuration
API Configured: ✅ Yes
Rate Limit: 3000ms
Max Length: 200 chars
Default Language: en-US
```

## 🔧 Troubleshooting

### Issue: "Voice features require @discordjs/voice package"
**Solution:** Install the required packages (see top of this guide)

### Issue: TTS moderation not working
**Solution:** Check that `OPENAI_API_KEY` is set in your .env file

### Issue: Bot can't join voice channel
**Solution:** 
1. Check bot has CONNECT and SPEAK permissions
2. Verify `GuildVoiceStates` intent is enabled
3. Ensure packages are installed

### Issue: Rate limiting too strict/loose
**Solution:** Adjust `TTS_RATE_LIMIT` in .env (in milliseconds)

## 🎨 Supported Languages

Current TTS supports these languages:
- English (US) - `en-US`
- English (UK) - `en-GB`
- Spanish - `es-ES`
- French - `fr-FR`
- German - `de-DE`
- Italian - `it-IT`
- Japanese - `ja-JP`
- Korean - `ko-KR`
- Chinese (Simplified) - `zh-CN`
- Chinese (Traditional) - `zh-TW`
- Portuguese (Brazil) - `pt-BR`
- Russian - `ru-RU`

## 📝 Next Steps

### Recommended Improvements:
1. **Install voice packages** to enable TTS generation
2. **Set up log channel** for moderation alerts
3. **Test rate limiting** with your community
4. **Monitor statistics** regularly with `/ttsstats view`

### Future Enhancements:
- Premium voice options (ElevenLabs, Google Cloud TTS)
- Custom pronunciation dictionaries
- Voice cloning (with user consent)
- Sound effects and jingles
- Per-user TTS settings

## 📚 Additional Resources

- [Discord.js Voice Guide](https://discordjs.guide/voice/)
- [@discordjs/voice Documentation](https://discord.js.org/docs/packages/voice/stable)
- [Discord TTS Library](https://www.npmjs.com/package/discord-tts)

---

**Need help?** Check the bot's GitHub issues or Discord community server.
