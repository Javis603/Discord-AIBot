const { Pool } = require('pg');

const pool = process.env.DATABASE_URL
  ? new Pool({ connectionString: process.env.DATABASE_URL })
  : new Pool({
    host: process.env.PGHOST,
    port: process.env.PGPORT ? Number(process.env.PGPORT) : undefined,
    user: process.env.PGUSER,
    password: process.env.PGPASSWORD,
    database: process.env.PGDATABASE,
  });

async function checkConnection() {
  try {
    const client = await pool.connect();
    client.release();
    return true;
  } catch {
    return false;
  }
}

async function getAllUserSettings() {
  const { rows } = await pool.query('SELECT * FROM bot.user_settings');
  return rows;
}

async function getAllConversations() {
  const { rows } = await pool.query(
    'SELECT guild_id, channel_id, user_id, role, content, tokens_used, model, created_at FROM bot.conversations ORDER BY user_id, created_at'
  );
  return rows;
}

async function upsertSystemPromptConversation(userId, systemPrompt) {
  // Keep exactly one system prompt per user
  await pool.query('DELETE FROM bot.conversations WHERE user_id = $1 AND role = $2', [userId, 'system']);
  await pool.query(
    'INSERT INTO bot.conversations (user_id, role, content) VALUES ($1, $2, $3::jsonb)',
    [userId, systemPrompt.role, JSON.stringify(systemPrompt)]
  );
}

async function deleteOldConversations(cutoffDate) {
  await pool.query('DELETE FROM bot.conversations WHERE created_at < $1', [cutoffDate]);
}

module.exports = {
  pool,
  checkConnection,
  getAllUserSettings,
  getAllConversations,
  upsertSystemPromptConversation,
  deleteOldConversations,
};
