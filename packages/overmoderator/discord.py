import discord
from discord.ext import commands
import sqlite3

# --- Database Setup ---
conn = sqlite3.connect('leveling.db')
c = conn.cursor()
c.execute('''
    CREATE TABLE IF NOT EXISTS users (
        user_id INTEGER PRIMARY KEY,
        xp INTEGER DEFAULT 0,
        level INTEGER DEFAULT 1
    )
''')
conn.commit()

# --- Bot Setup ---
intents = discord.Intents.default()
intents.messages = True
intents.guilds = True
intents.message_content = True

bot = commands.Bot(command_prefix='!', intents=intents)

@bot.event
async def on_ready():
    print(f'Logged in as {bot.user}')

@bot.event
async def on_message(message):
    if message.author.bot:
        return

    user_id = message.author.id
    c.execute("SELECT * FROM users WHERE user_id = ?", (user_id,))
    user = c.fetchone()

    if not user:
        c.execute("INSERT INTO users (user_id) VALUES (?)", (user_id,))
        conn.commit()
        user = (user_id, 0, 1)

    xp = user[1] + 5  # Award 5 XP per message
    level = user[2]
    xp_for_next_level = level * 100

    if xp >= xp_for_next_level:
        level += 1
        await message.channel.send(f'{message.author.mention} has leveled up to level {level}!')

    c.execute("UPDATE users SET xp = ?, level = ? WHERE user_id = ?", (xp, level, user_id))
    conn.commit()

    await bot.process_commands(message)

@bot.command()
async def rank(ctx):
    c.execute("SELECT * FROM users WHERE user_id = ?", (ctx.author.id,))
    user = c.fetchone()
    if user:
        await ctx.send(f'{ctx.author.mention} is at level {user[2]} with {user[1]} XP.')
    else:
        await ctx.send(f'{ctx.author.mention}, you have not earned any XP yet.')

# Replace 'YOUR_BOT_TOKEN' with your actual bot token
bot.run('YOUR_BOT_TOKEN')
