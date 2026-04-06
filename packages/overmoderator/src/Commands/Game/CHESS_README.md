# ♟️ Mac Chess Game Encoder for Discord

Encode and broadcast Mac Chess games to Discord with AI analysis and voice control using OpenAI, Whisper, and DeepSpeech.

## Features

- **FEN/PGN Support**: Load positions from FEN notation or full PGN games
- **OpenAI Analysis**: Get AI-powered commentary on positions and moves
- **Voice Moves**: Speak your moves using Whisper or DeepSpeech
- **Unicode Board Display**: Beautiful chess board rendering in Discord
- **Multi-player**: Challenge other Discord users or play vs AI

## Commands

| Command | Description |
|---------|-------------|
| `/chess new [@opponent]` | Start a new game (vs user or AI) |
| `/chess fen <position>` | Load position from FEN string |
| `/chess move <notation>` | Make a move (e.g., `e4`, `Nf3`, `O-O`) |
| `/chess analyze` | Get AI analysis of current position |
| `/chess show` | Display current board |
| `/chess voice` | Info on voice move input |
| `/chess resign` | Resign the game |

## Voice Move Input

### Using Whisper (Default)
1. Record your move as audio (e.g., "knight to f3")
2. Attach the audio file to a message
3. Mention the bot with "chess" in your message

### Using DeepSpeech (Offline)
Set in `.env`:
```env
VOICE_ENGINE=deepspeech
VOICE_DS_MODEL_PATH=/path/to/deepspeech-model.pbmm
VOICE_DS_SCORER_PATH=/path/to/deepspeech-scorer.scorer
```

### Supported Voice Formats
- Natural language: "knight to f3", "bishop takes c6", "castle kingside"
- Algebraic notation: "e4", "Nf3", "Bxc6", "O-O"

## Configuration (.env)

```env
# Chess Game Encoder Settings
CHESS_VOICE_ENABLED=true
CHESS_ANALYSIS_MODEL=gpt-4  # Optional, uses DEFAULT_MODEL if not set

# Voice Recognition (Whisper)
VOICE_API_KEY=your_openai_key
VOICE_MODEL=whisper-1

# Voice Recognition (DeepSpeech - offline alternative)
VOICE_ENGINE=deepspeech
VOICE_DS_MODEL_PATH=/path/to/model.pbmm
VOICE_DS_SCORER_PATH=/path/to/scorer.scorer
```

## Integration Architecture

```
┌─────────────────────────────────────────────────────────────┐
│                    Discord Message                          │
└─────────────────────┬───────────────────────────────────────┘
                      │
                      ▼
┌─────────────────────────────────────────────────────────────┐
│              ai-chat.js (Message Handler)                   │
│  - Detects chess voice messages                             │
│  - Routes to chessMessageHandler                            │
└─────────────────────┬───────────────────────────────────────┘
                      │
          ┌───────────┴───────────┐
          ▼                       ▼
┌─────────────────┐     ┌─────────────────┐
│   Whisper API   │     │   DeepSpeech    │
│   (OpenAI)      │     │   (Offline)     │
└────────┬────────┘     └────────┬────────┘
         │                       │
         └───────────┬───────────┘
                     ▼
┌─────────────────────────────────────────────────────────────┐
│              chessVoice.js                                  │
│  - Transcribes audio to text                                │
│  - Parses natural language to algebraic notation            │
└─────────────────────┬───────────────────────────────────────┘
                      │
                      ▼
┌─────────────────────────────────────────────────────────────┐
│              chess.js (Game Command)                        │
│  - Manages game state (FEN/PGN)                             │
│  - Renders board to Discord                                 │
│  - Calls OpenAI for analysis                                │
└─────────────────────────────────────────────────────────────┘
```

## Files

- `src/Commands/Game/chess.js` - Main slash command
- `src/Events/AICore/chessVoice.js` - Voice transcription (Whisper/DeepSpeech)
- `src/Events/AICore/chessMessageHandler.js` - Voice message routing

## Example Usage

```
User: /chess new @opponent
Bot: ♟️ New Chess Game
     [Board display]
     White: @user | Black: @opponent

User: /chess move e4
Bot: ♟️ Move
     [Board display]
     Moves: e4

User: /chess analyze
Bot: 🔍 Analysis
     [Board display]
     🤖 AI: White opens with the King's Pawn, controlling the center...

User: [attaches audio "knight to f3"] @bot chess move
Bot: 🎤 Voice Move Recognized
     Heard: "knight to f3"
     Move: Nf3
     Engine: Whisper
```

## Dependencies

- `openai` - For Whisper transcription and AI analysis
- `deepspeech` (optional) - For offline voice recognition

## Mac Chess Integration

To capture games from Mac Chess:
1. Export game as PGN from Mac Chess (File → Export)
2. Use `/chess load <pgn>` to import
3. Or manually input FEN positions with `/chess fen <position>`
