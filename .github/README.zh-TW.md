# 你爸 AI Bot

**繁** | [简](./README.zh-CN.md) | [EN](./README.md)

## ![你爸 AI Bot Logo](assets/image/niba-icon.png) 你爸 AI Bot

![Stars](https://img.shields.io/github/stars/Javis603/Discord-AIBot?style=social) ![Forks](https://img.shields.io/github/forks/Javis603/Discord-AIBot?style=social) ![Issues](https://img.shields.io/github/issues/Javis603/Discord-AIBot) ![License](https://img.shields.io/github/license/Javis603/Discord-AIBot) [![Discord](https://img.shields.io/discord/1344259784219689031?color=5865F2&label=Discord&logo=discord&logoColor=white&style=flat-square)](https://discord.gg/HmdNVVvw5P)

## 📖 關於本專案

這是一個專為 Discord 設計的多功能 AI 助手，整合 OpenAI、Gemini、Claude、DeepSeek 等頂尖 AI 模型，支持智能對話、多模態互動、圖片生成、聯網搜尋和深度思考功能，為您的伺服器帶來前所未有的智能體驗：

[![邀請機器人](https://img.shields.io/badge/邀請機器人-7289DA?style=for-the-badge&logo=discord&logoColor=white)](https://discord.com/oauth2/authorize?client_id=1341946222994526359) [![Discord 社群體驗](https://img.shields.io/badge/加入社群體驗-5865F2?style=for-the-badge&logo=discord&logoColor=white)](https://discord.gg/HmdNVVvw5P)

![AI 智慧預測三個最相關的回應選項，提升對話效率](https://github.com/Javis603/Discord-AIBot/blob/main/.github/assets/screenshots/zh/ai-chat.gif)

### 🌟 主要特點

- **多模型支援**：整合 OpenAI、Google AI、DeepSeek 等頂級 AI 模型，靈活切換不同模型  
- **即時互動**：支援串流式回應，實現流暢的即時對話體驗  
- **智慧預測**：AI 驅動的對話預測系統，自動提供三個最相關的回應建議  
- **多模態能力**：支援文字、圖片、PDF、語音等多種輸入方式，全方位互動  
- **高度客製化**：彈性的角色設定和模型切換功能，打造專屬 AI 助手  

### 🌐 多語言支援

- 完整支援四種語言：  
  - 繁體中文 (zh-TW)  
  - 簡體中文 (zh-CN)  
  - 英文 (en-US)  
  - 日文 (ja-JP)  
- 所有系統訊息、指令說明和錯誤提示均已本地化  
- 支援使用者個人語言設定  
- 支援伺服器全局語言設定  
- 使用標準語言代碼，便於擴展  

### 🛠️ 技術特色

- 模組化架構設計，易於維護和擴展  
- 完整的多語言本地化系統  
- MongoDB 資料持久化，確保資料安全  
- 即時事件監控和日誌記錄  
- 智能進程管理與自動錯誤恢復機制  

### 💬 AI 聊天功能

- 支援多種 AI 模型靈活切換  
- 即時串流回應顯示  
- 智慧對話記憶功能  
- 智慧對話預測與互動按鈕  
- 多輪對話上下文理解  
- 編輯對話以重新回應 (Coming Soon)  

### 🧠 多模態互動

- 語音輸入與辨識  
- 圖像理解與分析  
- PDF 文件解析與摘要  
- 深度思考模式  
- 網路搜尋增強  
- AI 圖像生成  

### 🎨 AI 繪圖功能

- 支援多種繪圖風格  
- 自動優化提示詞  
- 多尺寸圖像生成  

### 📊 LLM 模型支援

| 模型 | 狀態 | Base URL (僅支持 OpenAI 接口格式) |
| --- | --- | --- |
| [OpenAI](https://platform.openai.com/) | ✅ | <https://api.openai.com/v1> |
| [DeepSeek](https://www.deepseek.com/) | ✅ | <https://api.deepseek.com/v1> |
| [Google AI](https://ai.google.dev/) | ✅ | <https://generativelanguage.googleapis.com/v1beta/openai/> |
| [xAI](https://x.ai/) | ✅ | <https://api.x.ai/v1> |
| [Anthropic](https://www.anthropic.com/) | ✅ | 需使用中轉 API |
| 中轉 API | ✅ | 推薦使用中轉 API 把所有模型轉成至 OpenAI SDK 格式 (e.g. one-api, new-api) |

### 🔧 實用工具

- 訊息回收與管理  
- 對話紀錄管理（刪除/編輯）  
- 角色設定管理  
- 模型切換功能  
- 自動舊對話清理  

### ⚙️ 管理功能

- 完整的指令重載系統  
- 用戶設定管理系統  
- MongoDB 資料庫整合  
- 詳細的事件日誌記錄  
- 權限管理系統  
- 頻道管理功能  

## 🚀 開始使用

### 前置需求

- Node.js 16.9.0 或更高版本  
- MongoDB 資料庫  
- [Discord Bot Token](https://discord.com/developers/applications)  
- AI API Keys（支援多種服務商）  
- Tavily API Key（可選，用於網絡搜尋）  

### 安裝步驟

1. **克隆專案**

   ```bash
   git clone https://github.com/Javis603/Discord-AIBot.git
   cd Discord-AIBot
   ```

2. **安裝依賴**

   ```bash
   npm install
   ```

3. **設定環境變數**

   - 複製 `.env.example` 為 `.env`  
   - 填入必要的設定值：  
     - Discord Bot Token  
     - MongoDB URI  
     - API Keys  
     - 其他可選設定  

4. **啟動機器人**

   ```bash
   # 正式環境
   npm start

   # 開發環境
   npm run dev
   ```

## ⚙️ 配置說明

### 主要配置文件

- `.env`：環境變數配置  
- `config.json`：機器人表情符號設定  
- `roles.yaml`：AI 角色設定（可自定義）  
- `models.json`：開發人員用的 AI 模型配置  
- `models-user.json`：用戶使用的 AI 模型配置  

### 自訂表情符號設定

1. 複製 `config.json.example` 為 `config.json`  
2. 在 `.github/assets/emojis` 中查看可用的表情符號  
3. 在 Discord 伺服器中新增需要的表情符號  
4. 取得表情符號 ID（在 Discord 中輸入 `\:表情符號:`）  
5. 在 `config.json` 中更新對應的 ID  

如果沒有設定自訂表情符號，機器人會自動使用 fallback 的通用表情符號。  

需要的表情符號：  

- memory (預設: 💾)  
- clock (預設: ⏰)  
- update (預設: 🔄)  
- newchat (預設: 🆕)  
- cross (預設: ❌)  
- generating (預設: ⚙️)  
- search (預設: 🔍)  
- delete (預設: 🗑️)  

## 🛠️ 指令列表

| 指令                                     | 說明     | 權限     |
| ---------------------------------------- | -------- | -------- |
| `@bot`, `↰回覆bot`, `/chat`              | 與 AI 對話 | 一般用戶 |
| `/ai role`                               | 設定 AI 角色 | 一般用戶 |
| `/ai model`                              | 切換 AI 模型 | 一般用戶 |
| `/ai chat clear`                         | 清除對話記錄 | 一般用戶 |
| `/imagine`                               | 生成 AI 圖片 | 一般用戶 |
| `/lang`                                  | 個人語言設定 | 一般用戶 |
| `/snipe`, `.snipe`                       | 查看刪除訊息 | 一般用戶 |
| `/info`                                  | 查看機器人資訊 | 一般用戶 |
| `/help`                                  | 查看指令列表 | 一般用戶 |
| `/clear`                                 | 清除訊息  | 管理員   |
| `/restart`                               | 重啟機器人 | 開發者   |
| `/reload command`, `/reload event`       | 重載指令/事件 | 開發者   |
| `/ai-admin model global`                 | 全局模型設定 | 管理員   |
| `/ai-admin model user`                   | 用戶模型設定 | 管理員   |
| `/ai-admin role user`                    | 用戶角色設定 | 管理員   |

### 📸 更多截圖

| 描述                   | 圖片                                                                 |
| ---------------------- | -------------------------------------------------------------------- |
| 深度思考功能展示         | ![深度思考功能展示](assets/screenshots/zh/deepthink.png) *深度思考功能展示* |
| AI 圖像生成功能          | ![AI 圖像生成功能](assets/screenshots/zh/generate_image.png) *AI 圖像生成功能* |
| 聯網搜尋功能             | ![聯網搜尋功能](assets/screenshots/zh/net_search.png) *聯網搜尋功能* |
| lang & ai 指令          | ![lang&ai指令](assets/screenshots/zh/ai_command.png) *lang&ai指令* |
| /clear、/info、/ping 指令 | ![clear&info&ping指令](assets/screenshots/zh/info_command.png) */clear、/info、/ping 指令* |
| /snipe、.snipe 指令      | ![snipe指令](assets/screenshots/zh/snipe_command.png) */snipe、.snipe* |

## 🤝 支援與反饋

如果您有任何問題或建議，歡迎：  

- [提交 Issues](https://github.com/Javis603/Discord-AIBot/issues)  
- [加入 Discord 社群](https://discord.gg/HmdNVVvw5P)  

## 📝 授權條款

此專案使用 MIT 授權條款 - 查看 [LICENSE](LICENSE) 文件了解更多

## 📜 更新日誌

請查看 [CHANGELOG.md](CHANGELOG.md) 了解詳細更新記錄
