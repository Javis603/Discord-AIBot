/**
 * @file i18n.js
 * Lightweight i18n with safe fallbacks so other packages can require it.
 */
const fs = require('fs');
const path = require('path');

const envLocale = process.env.APP_LOCALE || 'en-US';

let localeData = {};
try {
  localeData = require(path.join(__dirname, '..', 'locales', envLocale, 'index.js'));
} catch (err) {
  console.warn(`Locale "${envLocale}" not found, using fallback (empty).`);
  localeData = {};
}

// defaults and runtime structures
let defaultLanguage = envLocale || 'en-US';
const languages = {};
languages[defaultLanguage] = localeData || {};

// in-memory caches
const userPreferences = new Map();
const guildPreferences = new Map();

// try to load real model, otherwise use stub
let UserSettings;
try {
  UserSettings = require(path.join(__dirname, '..', 'Models', 'UserSettings'));
} catch (err) {
  const _store = [];
  class UserSettingsStub {
    static async findOne(query) {
      return _store.find(s => s.userId === query.userId) || null;
    }
    static async find(query = {}) {
      return _store.slice();
    }
    static async findOneAndUpdate(filter, update, options = {}) {
      let rec = _store.find(s => s.userId === filter.userId);
      if (rec) Object.assign(rec, update);
      else { rec = Object.assign({}, update); _store.push(rec); }
      return rec;
    }
  }
  UserSettings = UserSettingsStub;
  console.warn('Using in-memory UserSettings stub (create Models/UserSettings.js to use real DB).');
}

/* exported functions */

function getText(key, language = defaultLanguage, variables = {}) {
  if (language && typeof language === 'object') {
    const ctx = language;
    const userLang = ctx.userLang || getUserLanguageSync(ctx.userId, ctx.guildId);
    language = userLang || defaultLanguage;
  }

  if (!languages[language]) language = defaultLanguage;

  const keys = key.split('.');
  let text = languages[language];

  for (const k of keys) {
    if (text && Object.prototype.hasOwnProperty.call(text, k)) text = text[k];
    else {
      if (language !== defaultLanguage) return getText(key, defaultLanguage, variables);
      if (variables && variables.default) return variables.default;
      return key;
    }
  }

  if (typeof text === 'string' && variables) {
    for (const [k, v] of Object.entries(variables)) {
      text = text.replace(new RegExp(`{${k}}`, 'g'), v ?? '');
    }
  }

  return text;
}

async function setUserLanguage(userId, language) {
  if (!language) return false;
  userPreferences.set(userId, language);
  try {
    await UserSettings.findOneAndUpdate(
      { userId },
      { userId, language, lastUpdated: Date.now() },
      { upsert: true, new: true }
    );
    return true;
  } catch (err) {
    console.error('setUserLanguage error:', err.message);
    return false;
  }
}

function setGuildLanguage(guildId, language) {
  if (!language) return false;
  guildPreferences.set(guildId, language);
  return true;
}

async function getUserLanguage(userId, guildId = null) {
  if (userPreferences.has(userId)) return userPreferences.get(userId);
  try {
    const settings = await UserSettings.findOne({ userId });
    if (settings && settings.language) {
      userPreferences.set(userId, settings.language);
      return settings.language;
    }
  } catch (err) {
    console.warn('getUserLanguage error:', err.message);
  }
  if (guildId && guildPreferences.has(guildId)) return guildPreferences.get(guildId);
  return defaultLanguage;
}

function getUserLanguageSync(userId, guildId) {
  if (userPreferences.has(userId)) return userPreferences.get(userId);
  if (guildId && guildPreferences.has(guildId)) return guildPreferences.get(guildId);
  return defaultLanguage;
}

async function getLanguageSafe(userId, guildId = null) {
  return getUserLanguage(userId, guildId);
}

function getAvailableLanguages() {
  return Object.keys(languages);
}

function setDefaultLanguage(lang) {
  if (lang && typeof lang === 'string') {
    try {
      const data = require(path.join(__dirname, '..', 'locales', lang, 'index.js'));
      languages[lang] = data || {};
    } catch (err) {
      languages[lang] = languages[lang] || {};
    }
    defaultLanguage = lang;
  }
}

async function loadUserLanguagePreferences() {
  try {
    userPreferences.clear();
    const all = await UserSettings.find({});
    for (const s of all) if (s.userId && s.language) userPreferences.set(s.userId, s.language);
    console.log(`Loaded ${userPreferences.size} user language prefs`);
  } catch (err) {
    console.error('loadUserLanguagePreferences error:', err.message);
  }
}

module.exports = {
  getText,
  setUserLanguage,
  setGuildLanguage,
  getUserLanguage,
  getUserLanguageSync,
  getLanguageSafe,
  getAvailableLanguages,
  setDefaultLanguage,
  loadUserLanguagePreferences
};