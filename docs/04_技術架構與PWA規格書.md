# 04. 技術架構與 PWA 規格書

## 一、 單一 App 角色切換與手機號碼串接

本系統採用「單一程式碼庫 (All-in-One PWA)」架構，長輩與晚輩安裝同一個 App，透過裝置本地角色狀態分離呈現：

```
┌─────────────────────────────────────────────────────────────┐
│                 單一 App 角色分流與同步架構                 │
│                                                             │
│  [同一套 PWA / 網址安裝]                                    │
│       │                                                     │
│       ├──► 本機角色 = "senior" (長輩模式，預設)              │
│       │    - 極簡大字體介面                                 │
│       │    - 小股語音問答、日落沉睡模式                     │
│       │    - 接收孝親紅包、一鍵撥號                         │
│       │                                                     │
│       └──► 本機角色 = "caregiver" (晚輩模式)                │
│            - 解鎖方式：連續快速點擊 Logo 10 下              │
│            - 輸入長輩手機號碼綁定                           │
│            - 遠端查看打卡狀態、發送孝親紅包                 │
│            - 設定股票庫存與 Email 提醒頻率                  │
└─────────────────────────────────────────────────────────────┘
```

---

## 二、 本地資料庫設計 (LocalStorage Schema)

```json
{
  "deviceRole": "senior", // "senior" (長輩端) | "caregiver" (晚輩端)
  "profile": {
    "elderPhone": "0912345678", // 雙端唯一綁定識別碼 (免簡訊驗證)
    "title": "伯伯",
    "mode": "family", // "family" (晚輩陪伴) | "simulation" (模擬100萬) | "self" (獨立營業員)
    "emergencyContact": {
      "name": "小明 (兒子)",
      "phone": "0987654321",
      "type": "family" // "family" | "broker"
    },
    "caregiverEmail": "ming@example.com",
    "emailRemindFrequencyDays": 7,
    "lastEmailSentDate": "2026-08-20",
    "voiceRate": 0.85,
    "nightModeEnabled": true,
    "nightStartTime": "21:00",
    "nightEndTime": "09:00"
  },
  "stocks": [
    {
      "id": "2330",
      "name": "台積電",
      "buyPrice": 850,
      "shares": 1000,
      "currentPrice": 980,
      "targetPrice": 1000,
      "marketTrend": "強勢上漲",
      "newsSentiment": "正面",
      "aiAdvice": "伯伯，台積電最近表現很亮眼，快要接近您的目標價囉！"
    }
  ],
  "pocketMoney": {
    "balance": 15000, // 累計收到的孝親紅包 / 虛擬股息
    "history": [
      {
        "date": "2026-08-22",
        "sender": "小明 (兒子)",
        "amount": 5000,
        "note": "股票拉回孝親補貼"
      }
    ]
  },
  "gameStats": {
    "todayAnswered": true,
    "currentStreak": 5,
    "totalMedals": 18,
    "lastPlayedDate": "2026-08-23"
  }
}
```

---

## 三、 Email 主動關懷提醒機制 (Caregiver Automation)

1. **定時互動提醒**：
   - 晚輩端可設定每 7 天或 14 天由系統自動發信給晚輩：
   - *「小明您好：爸爸本週已完成 5 次大腦股票打卡，表現很棒！週末記得打通電話陪爸爸聊聊台積電喔！」*
2. **股票拉回關懷觸發**：
   - 當長者真實持股單日回檔或浮虧達特定門檻（如 5,000 元）時：
   - 發送溫馨信件：*「爸爸的持股今天稍微拉回，您可以藉此機會撥電話給爸爸：『爸，今天股票少的那 5,000 算我的，我補紅包給你！』這會讓長輩非常安心與開心！」*

---

## 四、 跨平台相容性與 PWA 配置

1. **單一安裝 (`manifest.json`)**：
   - `display: standalone`，長輩與晚輩共用同一個 PWA 捷徑。
2. **純離線可用**：
   - Service Worker 快取所有資源，在無網路環境下長輩端各項功能依然完全順暢。
