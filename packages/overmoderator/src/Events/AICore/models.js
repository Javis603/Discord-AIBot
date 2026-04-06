/**
 * @file models.js
 * @description AI model group and special user data
 * @author Javis
 * @license MIT
 * @copyright Copyright (c) 2025
 */
require('dotenv/config');

const specialUsers = {
    // e.g. 'userID': { role: 'roleID', username: 'username', relation: 'relation' }
    '679922500926308358': {
        role: 'default',
        username: 'Javis',
        relation: 'Developer'
    }
};

const specialModelsSet = new Set([
    // OpenAI Vision Models
    "gpt-4o",
    "gpt-4o-mini",
    "gpt-4-vision-preview",
    "gpt-4-turbo-vision",
    "gpt-4o-2024-05-13",
    
    // Anthropic Vision Models
    "claude-3-opus-20240229",
    "claude-3-sonnet-20240229",
    "claude-3-haiku-20240307",
    "claude-3-5-sonnet-20240620",
    "claude-3-opus",
    "claude-3-sonnet",
    "claude-3-haiku",
    "claude-3.5-sonnet",
    
    // Google AI Vision Models
    "gemini-1.5-flash",
    "gemini-2.0-flash",
    "gemini-1.5-pro",
    "gemini-2.0-pro-exp",
    "gemini-1.5-pro-vision",
    "gemini-1.0-pro-vision",
    
    // Meta AI Vision Models
    "llama-3.1-8b-vision",
    "llama-3.1-70b-vision",
    "llama-3.1-405b-vision",
    
    // Mistral Vision Models
    "mistral-large-2-vision",
    "mistral-large-vision",
    
    // Cohere Vision Models
    "command-r-vision",
    "command-r-plus-vision",
    
    // Other Vision Models
    "perplexity-online-vision",
    "qwen-vl-plus",
    "qwen-vl-max",
    "grok-2-vision",
]);

if (process.env.IMAGE_MODEL) {
    specialModelsSet.add(process.env.IMAGE_MODEL);
}

const specialModels = [...specialModelsSet];

const modelPrefixes = {
    openai: ["gpt-", "o1-", "o3-"], 
    anthropic: ["claude-"],
    googleAi: ["gemini-"],
    metaAi: ["llama-", "llama3-", "codellama-"],
    cohere: ["command-"],
    mistral: ["mistral-"],
    deepseek: ["deepseek-", "DeepSeek-"],
    xAI: ["grok-"]
};

const modelGroupIcons = {
    openai: 'https://cdn.discordapp.com/attachments/1231229589917794435/1231229618439196782/IMG_2043.PNG?ex=663632f0&is=6623bdf0&hm=1554a2ea81fcd0ef6fc202255d29fb7bb6eef573ba540571d7e971cf8036edc2&=&quality=lossless',
    anthropic: 'https://cdn.discordapp.com/attachments/1231229589917794435/1346009742241435738/IMG_6288.png?ex=67c6a0c2&is=67c54f42&hm=a7e3e09dc318c7459794481ea97cc82612a0a3b2ed55fce7a62e72f21771e304&=&quality=lossless',
    googleAi: 'https://cdn.discordapp.com/attachments/1231229589917794435/1231231968117784726/IMG_2047.PNG?ex=66363520&is=6623c020&hm=55396292b903cc9f8d83a940b897c92889aab790a37a6d2bacb01eaca28c9e64&=&quality=lossless',
    metaAi: 'https://cdn.discordapp.com/attachments/1231229589917794435/1234786379909697536/com-crop-unscreen.gif?ex=67b598ee&is=67b4476e&hm=88413a1f24bffc20a6cb7270e1aa78419d857fe8e3c4a2ba0e55930cb6c19cce&=&quality=lossless',
    cohere: 'https://cdn.discordapp.com/attachments/1231229589917794435/1234793607769096192/IMG_2275.png?ex=663206a9&is=6630b529&hm=e37a6d41fb8db5ec931c109b0bec4a3326b13aa085f90a8ded56e391abed918c&=&quality=lossless',
    mistral: 'https://cdn.discordapp.com/attachments/1231229589917794435/1234875067096371291/132372032.png?ex=6632fb46&is=6631a9c6&hm=10b1e2ea16a9c7202d0193d8db0e9e3800591b5765a78f5d1cd9c52119a353cd&=&quality=lossless',
    deepseek: 'https://cdn.discordapp.com/attachments/1231229589917794435/1326234991709130752/deepseek.png?ex=677eb016&is=677d5e96&hm=0a30164b2e00268748926146689c6d30e2f4bd9459a984ca99313c184a909ae7&=&quality=lossless',
    xAI: 'https://cdn.discordapp.com/attachments/1231229589917794435/1341445025132974101/IMG_0030.png?ex=67b60588&is=67b4b408&hm=05e79345268d7cbc80ed6e5df39d763174d7d915fc242b6fa83854d6d237a940&=&quality=lossless',
};

function getModelGroup(modelName) {
    for (const [groupName, prefixes] of Object.entries(modelPrefixes)) {
        for (const prefix of prefixes) {
            if (modelName.toLowerCase().startsWith(prefix.toLowerCase())) {
                return {
                    name: groupName,
                    iconURL: modelGroupIcons[groupName]
                };
            }
        }
    }
    return {
        name: 'unknown',
        iconURL: null
    };
}

module.exports = {
    specialUsers,
    specialModels,
    getModelGroup,
    get modelGroups() {
        return Object.entries(modelPrefixes).map(([group, prefixes]) => ({
            models: prefixes,
            iconURL: modelGroupIcons[group]
        }));
    }
};