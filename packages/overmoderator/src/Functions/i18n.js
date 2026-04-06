const envLocale = process.env.BOT_LANG || process.env.APP_LOCALE || 'en-US';

// Keep a very lightweight i18n layer in this package so Docker doesn't depend on workspace-only packages.
function getText(key, language, variables) {
  void language;
  void variables;
  return key;
}

function setDefaultLanguage(lang) {
  if (lang && typeof lang === 'string') {
    process.env.BOT_LANG = lang;
  }
}

async function loadUserLanguagePreferences() {
  // In this package, user language preferences are optional.
  // If MongoDB models are available, let them populate any caches elsewhere.
  try {
    const UserSettings = require('../Models/UserSettings');
    if (UserSettings && typeof UserSettings.find === 'function') {
      await UserSettings.find({});
    }
  } catch {
    // ignore
  }

  // Ensure env locale is at least set so calls can use it.
  process.env.BOT_LANG = process.env.BOT_LANG || envLocale;
}

module.exports = { getText, setDefaultLanguage, loadUserLanguagePreferences };
