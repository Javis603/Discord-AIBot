<!-- markdownlint-disable MD041 -->
# Overmoderator TTS Quick Reference

## 🚀 Quick Start (5 Minutes)

### What's Already Working

✅ TTS Moderation with rate limiting  
✅ Statistics tracking  
✅ Admin monitoring tools  

### Test It Now

```bash
/ttsstats view    → See current statistics
/ttsstats config  → View configuration
```

---

## 📦 Enable Full TTS (15 Minutes)

```bash
# 1. Install packages (5 min)
cd /Users/kthlke/Documents/GitHub/Discord-AIBot/packages/overmoderator
npm install @discordjs/voice @discordjs/opus discord-tts ffmpeg-static sodium-native

# 2. Update main.js (2 min)
# Add GuildVoiceStates to intents on lines 13 and 16

# 3. Enable voice handler (5 min)
# Uncomment imports in src/Handlers/voiceHandler.js

# 4. Update .env (2 min)
TTS_ENABLED=true
TTS_DEFAULT_LANGUAGE=en-US
TTS_LOG_CHANNEL_ID=your_channel_id

# 5. Restart bot (1 min)
npm start
```

---

## 🎮 User Commands

### TTS Generation

```bash
/tts speak <text> [language]   # Say something in voice channel
/tts stop                      # Stop speaking
/tts skip                      # Skip current message
/tts queue                     # See what's queued
/tts settings [volume] [speed] # Adjust playback
```

### Admin Commands

```bash
/ttsstats view    # View statistics
/ttsstats reset   # Reset counters
/ttsstats config  # Manage settings
```

---

## 🌍 Supported Languages

```text
en-US  English (US)          ja-JP  Japanese
en-GB  English (UK)          ko-KR  Korean
es-ES  Spanish               zh-CN  Chinese (Simplified)
fr-FR  French                zh-TW  Chinese (Traditional)
de-DE  German                pt-BR  Portuguese
it-IT  Italian               ru-RU  Russian
```

---

## ⚙️ Configuration (.env)

```env
# Required for moderation (already working)
OPENAI_API_KEY=sk-...

# TTS Settings
TTS_ENABLED=true
TTS_DEFAULT_LANGUAGE=en-US
TTS_MAX_LENGTH=200
TTS_VOLUME=1.0

# Moderation Settings
TTS_MODERATION=true
TTS_RATE_LIMIT=3000
TTS_LOG_CHANNEL_ID=123456789
```

---

## 📊 Statistics Example

```text
📊 TTS System Statistics

🔇 Moderation Stats
Total Processed: 156
Flagged: 7
Deleted: 7
Rate Limited: 23
Errors: 0

🎤 Voice Stats
Active Connections: 2
Queued Items: 5
Connected Guilds: 2

⚙️ Configuration
API Configured: ✅ Yes
Rate Limit: 3000ms
Max Length: 200 chars
Default Language: en-US
```

---

## 🐛 Common Issues

### "Voice features require @discordjs/voice"

→ Install packages: `npm install @discordjs/voice ...`

### TTS not moderating

→ Check `.env` has `OPENAI_API_KEY`

### Bot won't join voice

→ Check permissions: CONNECT + SPEAK  
→ Verify GuildVoiceStates intent

### Rate limiting too strict

→ Adjust `TTS_RATE_LIMIT` in .env

---

## 📁 Important Files

```text
src/
├── Events/Moderation/
│   └── ttsModeration.js       ← Enhanced moderation
├── Commands/
│   ├── Voice/
│   │   └── tts.js             ← TTS commands
│   └── Moderation/
│       └── ttsstats.js        ← Admin stats
└── Handlers/
    └── voiceHandler.js        ← Voice manager

Documentation:
├── TTS_SETUP.md               ← Full setup guide
├── TTS_IMPROVEMENTS.md        ← Technical details
└── IMPLEMENTATION_SUMMARY.md  ← Complete overview
```

---

## 🔑 Key Features

### Security

✅ Content moderation  
✅ Rate limiting (3s cooldown)  
✅ Permission checks  
✅ API validation  

### Performance

✅ Result caching (60s)  
✅ Queue management  
✅ Auto-cleanup  
✅ Efficient logging  

### Monitoring

✅ Real-time statistics  
✅ Detailed logs  
✅ Admin dashboard  
✅ Error tracking  

---

## 💡 Pro Tips

1. **Set up log channel** for moderation alerts
2. **Monitor stats regularly** with `/ttsstats view`
3. **Adjust rate limit** based on your community
4. **Use language option** for non-English servers
5. **Test permissions** before going live

---

## 📚 Learn More

- **Full Setup Guide**: `TTS_SETUP.md`
- **Technical Details**: `TTS_IMPROVEMENTS.md`
- **Complete Overview**: `IMPLEMENTATION_SUMMARY.md`

---

## ✅ Quick Health Check

```bash
# 1. Check moderation is working
→ Send a TTS message
→ Check rate limiting

# 2. View statistics
→ /ttsstats view

# 3. Check configuration
→ /ttsstats config

# 4. Test TTS (if packages installed)
→ Join voice channel
→ /tts speak test
```

---

## 🎉 What's Working Now

Without any installation:

- ✅ TTS message moderation
- ✅ Rate limiting
- ✅ Statistics tracking
- ✅ Admin commands
- ✅ Error handling
- ✅ Logging

With packages installed:

- ✅ All of the above PLUS
- ✅ TTS generation in voice
- ✅ Multi-language support
- ✅ Queue system
- ✅ Volume/speed control

---

**Status**: 🟢 Production Ready  
**Setup Time**: 15 minutes to full functionality  
**Difficulty**: 🟢 Easy  

Need help? Check `TTS_SETUP.md`!
