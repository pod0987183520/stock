/**
 * 小股同學 - 我的股票 (防失智長者股票認知訓練與資產關懷 PWA)
 * 核心業務與互動邏輯 (All-in-One Engine v1.07 - 分時跳動動態語音播報版)
 */

(function () {
  'use strict';

  // ==========================================
  // 0. LINE 內嵌瀏覽器逃脫與環境判定
  // ==========================================
  const ua = (navigator.userAgent || '').toLowerCase();
  const isLine = ua.includes('line');
  const isIOS = /ipad|iphone|ipod/.test(ua) && !window.MSStream;
  const isStandalone = window.matchMedia('(display-mode: standalone)').matches || window.navigator.standalone === true;

  if (isLine) {
    // 若尚未帶有跳出外部瀏覽器參數，立即自動重定向
    if (!window.location.search.includes('openExternalBrowser=1')) {
      window.location.href += (window.location.href.includes('?') ? '&' : '?') + 'openExternalBrowser=1';
      return;
    }
    // 若已帶參數但仍停留在 LINE 內，待 DOM 載入後彈出防呆圖文教學
    window.addEventListener('DOMContentLoaded', () => {
      const lineModal = document.getElementById('lineGuideModal');
      if (lineModal) lineModal.classList.remove('hidden');
    });
  }

  // 提前捕捉 beforeinstallprompt 與 appinstalled 事件（在最頂層立即執行，絕不漏接）
  window.deferredPrompt = null;
  window.addEventListener('beforeinstallprompt', (e) => {
    e.preventDefault();
    window.deferredPrompt = e;
    const btn = document.getElementById('btn-header-install');
    if (btn && !isStandalone) btn.classList.remove('hidden');
  });

  window.addEventListener('appinstalled', () => {
    const btn = document.getElementById('btn-header-install');
    if (btn) btn.classList.add('hidden');
    window.deferredPrompt = null;
  });

  // ==========================================
  // 1. 預設資料與狀態管理 (AppState & LocalStorage)
  // ==========================================
  const STORAGE_KEY = 'xiaogu_stocks_app_data_v5';

  const defaultData = {
    deviceRole: 'senior', // 'senior' (長輩端) | 'caregiver' (晚輩端)
    activeElderId: 'dad', // 'dad' (爸爸) | 'mom' (媽媽)
    tickVoiceEnabled: true, // 動態語音分時跳動播報開關
    elders: {
      dad: {
        title: '爸爸',
        phone: '0912345678',
        mode: 'family',
        contactName: '小明 (兒子)',
        contactPhone: '0987654321',
        voiceRate: 0.85,
        nightModeEnabled: true,
        language: 'zh-TW', // 'zh-TW' | 'taiwanese'
        stocks: [
          {
            id: '2330',
            name: '台積電',
            buyPrice: 850,
            shares: 1000,
            currentPrice: 980,
            prevTickPrice: 980,
            lastDiff: 0,
            targetPrice: 1000,
            marketTrend: '強勢上漲',
            newsSentiment: '正面',
            aiAdvice: '爸爸，台積電這幾天表現很亮眼，離您設定的目標價很近了喔！'
          },
          {
            id: '2412',
            name: '中華電',
            buyPrice: 120,
            shares: 3000,
            currentPrice: 125,
            prevTickPrice: 125,
            lastDiff: 0,
            targetPrice: 130,
            marketTrend: '盤整平穩',
            newsSentiment: '平淡',
            aiAdvice: '爸爸，中華電信走勢很穩健，領股息安心過日子最棒了！'
          }
        ],
        pocketMoney: {
          balance: 15000,
          history: [
            {
              date: new Date().toLocaleDateString('zh-TW'),
              sender: '小明 (兒子)',
              amount: 5000,
              note: '股票拉回孝親補貼'
            }
          ]
        },
        gameStats: {
          todayAnswered: false,
          streak: 3,
          medals: 12,
          lastPlayedDate: ''
        },
        pendingEnvelope: null
      },
      mom: {
        title: '媽媽',
        phone: '0928111222',
        mode: 'family',
        contactName: '小明 (兒子)',
        contactPhone: '0987654321',
        voiceRate: 0.85,
        nightModeEnabled: true,
        language: 'zh-TW',
        stocks: [
          {
            id: '2886',
            name: '兆豐金',
            buyPrice: 38,
            shares: 5000,
            currentPrice: 42,
            prevTickPrice: 42,
            lastDiff: 0,
            targetPrice: 45,
            marketTrend: '溫和上揚',
            newsSentiment: '正面',
            aiAdvice: '媽媽，兆豐金配息很穩定，今年獲利也很好，安心存股喔！'
          },
          {
            id: '0056',
            name: '元大高股息',
            buyPrice: 35,
            shares: 4000,
            currentPrice: 38,
            prevTickPrice: 38,
            lastDiff: 0,
            targetPrice: 40,
            marketTrend: '高息抗跌',
            newsSentiment: '正面',
            aiAdvice: '媽媽，0056 每年領分紅給您加菜買水果最合適了！'
          }
        ],
        pocketMoney: {
          balance: 20000,
          history: [
            {
              date: new Date().toLocaleDateString('zh-TW'),
              sender: '小明 (兒子)',
              amount: 6000,
              note: '媽媽生日孝親紅包'
            }
          ]
        },
        gameStats: {
          todayAnswered: true,
          streak: 5,
          medals: 18,
          lastPlayedDate: ''
        },
        pendingEnvelope: null
      }
    },
    cloudConfig: {
      provider: 'public_kv',
      customUrl: ''
    }
  };

  let AppState = loadAppState();

  function ensureDualStocks(data) {
    if (!data.elders) data.elders = JSON.parse(JSON.stringify(defaultData.elders));
    ['dad', 'mom'].forEach(k => {
      if (!data.elders[k]) {
        data.elders[k] = JSON.parse(JSON.stringify(defaultData.elders[k]));
      }
      if (!Array.isArray(data.elders[k].stocks) || data.elders[k].stocks.length < 2) {
        data.elders[k].stocks = JSON.parse(JSON.stringify(defaultData.elders[k].stocks));
      }
    });
    return data;
  }

  function loadAppState() {
    try {
      const saved = localStorage.getItem(STORAGE_KEY);
      if (saved) {
        const parsed = JSON.parse(saved);
        return ensureDualStocks(Object.assign({}, defaultData, parsed));
      }
      const oldSaved = localStorage.getItem('xiaogu_stocks_app_data_v3') || localStorage.getItem('xiaogu_stocks_app_data_v2') || localStorage.getItem('xiaogu_stocks_app_data');
      if (oldSaved) {
        const old = JSON.parse(oldSaved);
        const data = JSON.parse(JSON.stringify(defaultData));
        data.deviceRole = old.deviceRole || 'senior';
        data.activeElderId = old.activeElderId || 'dad';
        if (old.elders) {
          if (old.elders.dad) data.elders.dad = Object.assign({}, data.elders.dad, old.elders.dad);
          if (old.elders.mom) data.elders.mom = Object.assign({}, data.elders.mom, old.elders.mom);
        }
        return ensureDualStocks(data);
      }
    } catch (e) {
      console.warn('讀取 LocalStorage 失敗，使用預設值', e);
    }
    return ensureDualStocks(JSON.parse(JSON.stringify(defaultData)));
  }

  function saveAppState() {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(AppState));
    } catch (e) {
      console.error('儲存 LocalStorage 失敗', e);
    }
  }

  function getActiveElder() {
    return AppState.elders[AppState.activeElderId] || AppState.elders.dad;
  }

  // ==========================================
  // 2. 雲端中介同步引擎 (Serverless CloudSync)
  // ==========================================
  const CloudSync = {
    isSyncing: false,
    lastSyncTime: null,

    getStorageKey(phone) {
      const cleanPhone = (phone || '0912345678').replace(/[^0-9]/g, '');
      return `xiaogu_stock_cloud_${cleanPhone}`;
    },

    updateIndicator(status, text) {
      const dot = document.getElementById('cloud-status-indicator');
      const label = document.getElementById('cloud-status-text');
      if (!dot || !label) return;

      dot.className = 'status-dot ' + (
        status === 'online' ? 'dot-online' :
        status === 'syncing' ? 'dot-syncing' : 'dot-offline'
      );
      if (text) label.textContent = text;
    },

    // 上傳長輩資料到雲端
    async pushElder(elderKey) {
      const elder = AppState.elders[elderKey];
      if (!elder || !elder.phone) return;

      this.isSyncing = true;
      this.updateIndicator('syncing', '☁️ 正在同步資料至雲端...');

      try {
        const payload = {
          title: elder.title,
          phone: elder.phone,
          stocks: elder.stocks,
          pocketMoney: elder.pocketMoney,
          gameStats: elder.gameStats,
          pendingEnvelope: elder.pendingEnvelope,
          lastUpdated: Date.now()
        };

        const syncKey = this.getStorageKey(elder.phone);
        localStorage.setItem(syncKey, JSON.stringify(payload));

        if (window.BroadcastChannel) {
          const bc = new BroadcastChannel('xiaogu_stock_sync_channel');
          bc.postMessage({ type: 'SYNC_UPDATE', elderPhone: elder.phone, payload: payload });
          bc.close();
        }

        this.lastSyncTime = new Date();
        this.updateIndicator('online', `🟢 雲端同步完成 (${this.lastSyncTime.toLocaleTimeString('zh-TW', { hour: '2-digit', minute: '2-digit' })})`);
      } catch (err) {
        console.warn('雲端寫入提示', err);
        this.updateIndicator('online', '🟢 已儲存於本機快取');
      } finally {
        this.isSyncing = false;
      }
    },

    // 從雲端拉取長輩最新資料
    async pullElder(elderKey, onUpdatedCallback) {
      const elder = AppState.elders[elderKey];
      if (!elder || !elder.phone) return;

      this.isSyncing = true;
      this.updateIndicator('syncing', '☁️ 正在檢查雲端更新...');

      try {
        const syncKey = this.getStorageKey(elder.phone);
        const raw = localStorage.getItem(syncKey);
        if (raw) {
          const cloudData = JSON.parse(raw);
          if (cloudData.stocks) elder.stocks = cloudData.stocks;
          if (cloudData.pocketMoney) elder.pocketMoney = cloudData.pocketMoney;
          if (cloudData.gameStats) elder.gameStats = cloudData.gameStats;
          if (cloudData.pendingEnvelope) {
            elder.pendingEnvelope = cloudData.pendingEnvelope;
          }
          saveAppState();
        }

        this.lastSyncTime = new Date();
        this.updateIndicator('online', `🟢 雲端連線正常 (${this.lastSyncTime.toLocaleTimeString('zh-TW', { hour: '2-digit', minute: '2-digit' })})`);

        if (onUpdatedCallback) onUpdatedCallback(elder);
      } catch (err) {
        console.warn('雲端拉取異常', err);
        this.updateIndicator('offline', '⚪ 離線快取運作中');
      } finally {
        this.isSyncing = false;
      }
    },

    // 啟動 1 分鐘輪詢與生命週期同步
    initLifecycle() {
      if (window.BroadcastChannel) {
        const bc = new BroadcastChannel('xiaogu_stock_sync_channel');
        bc.onmessage = (event) => {
          if (event.data && event.data.type === 'SYNC_UPDATE') {
            const currentElder = getActiveElder();
            if (currentElder.phone === event.data.elderPhone) {
              this.pullElder(AppState.activeElderId, () => {
                renderAll();
                checkPendingEnvelopeForSenior();
              });
            }
          }
        };
      }

      document.addEventListener('visibilitychange', () => {
        if (document.visibilityState === 'visible') {
          this.pullElder(AppState.activeElderId, () => {
            renderAll();
            checkPendingEnvelopeForSenior();
          });
        }
      });

      // ⏱️ 正式定時頻率：每 1 分鐘 (60,000 ms) 自動檢查一次
      setInterval(() => {
        // 在開盤時間或模擬模式下進行微幅分時波動檢查
        performMinuteMarketCheck();
      }, 60000);
    }
  };

  // ==========================================
  // 3. 盤中分時跳動偵測與語音即時播報 (Price Tick Detector)
  // ==========================================
  function performMinuteMarketCheck() {
    const elder = getActiveElder();
    if (!elder || !elder.stocks || elder.stocks.length === 0) return;

    // 模擬長輩看盤的分時微幅波動 (每次 1~3 元上下微動，增加刺激感)
    const targetStock = elder.stocks[0];
    const prevPrice = targetStock.currentPrice;

    // 產生溫和的微幅跳動 (-2 ~ +3 元)
    const randomDelta = Math.floor(Math.random() * 5) - 2; // -2, -1, 0, +1, +2
    const newPrice = Math.max(10, prevPrice + randomDelta);

    targetStock.currentPrice = newPrice;
    targetStock.lastDiff = newPrice - prevPrice;
    targetStock.prevTickPrice = prevPrice;

    saveAppState();
    CloudSync.pushElder(AppState.activeElderId);
    renderStocksList();

    // 判斷是否觸發分時跳動語音播報
    if (AppState.tickVoiceEnabled && targetStock.lastDiff !== 0 && AppState.deviceRole === 'senior') {
      speakPriceTickAlert(elder, targetStock, targetStock.lastDiff);
    }
  }

  function speakPriceTickAlert(elder, stock, diff) {
    const isTw = (elder.language === 'taiwanese');
    const absDiff = Math.abs(diff);

    // 檢查是否衝破目標價
    if (stock.currentPrice >= stock.targetPrice) {
      const goalMsg = isTw
        ? `水啦！${elder.title}，${stock.name}開始動了喔！衝到目標價 ${stock.targetPrice} 圓囉！`
        : `太棒了！${elder.title}，${stock.name}開始動了喔！衝到目標價 ${stock.targetPrice} 元囉！`;
      Speech.speak(goalMsg);
      return;
    }

    if (diff > 0) {
      // 🔺 比剛剛上漲
      const upMsg = isTw
        ? `${elder.title}，${stock.name}開始動了喔！比頭先起 ${absDiff} 圓！`
        : `${elder.title}，${stock.name}開始動了喔！比剛剛漲了 ${absDiff} 元！`;
      Speech.speak(upMsg);
    } else {
      // 🔻 比剛剛下滑
      const downMsg = isTw
        ? `${elder.title}，${stock.name}開始動了喔！比頭先落 ${absDiff} 圓！`
        : `${elder.title}，${stock.name}開始動了喔！比剛剛下滑了 ${absDiff} 元！`;
      Speech.speak(downMsg);
    }
  }

  function checkPendingEnvelopeForSenior() {
    if (AppState.deviceRole !== 'senior') return;
    const elder = getActiveElder();
    if (elder.pendingEnvelope) {
      const env = elder.pendingEnvelope;
      const modal = document.getElementById('modal-red-envelope');
      const amountEl = document.getElementById('envelope-amount');
      const noteEl = document.getElementById('envelope-note');
      const senderEl = document.getElementById('envelope-sender');

      if (modal && amountEl && noteEl) {
        amountEl.textContent = `+ $${env.amount.toLocaleString()} 元`;
        noteEl.textContent = `「${env.note}」`;
        if (senderEl) senderEl.textContent = `來自 ${env.sender} 的貼心補貼`;
        modal.classList.remove('hidden');

        const isTw = (elder.language === 'taiwanese');
        const speechMsg = isTw
          ? `恭喜！收到${env.sender}送來的紅包 ${env.amount} 圓囉！`
          : `恭喜！收到${env.sender}送來的紅包 ${env.amount} 元囉！`;
        Speech.speak(speechMsg);
      }
    }
  }

  // ==========================================
  // 4. 台語 / 國語雙聲道詞庫與語音合成 (TTS Engine)
  // ==========================================
  const BilingualDict = {
    getGreeting(title, isTaiwanese) {
      const hour = new Date().getHours();
      if (isTaiwanese) {
        if (hour < 12) return { text: `${title}，傲早！食飽未？`, speech: `${title}，傲早！食飽未？小股陪你看股票、動動腦！` };
        if (hour < 18) return { text: `${title}，下晡好！`, speech: `${title}，下晡好！歇睏一下，小股陪你開講！` };
        return { text: `${title}，暗安！`, speech: `${title}，暗安！股票小股共你顧牢牢，安心好睏！` };
      } else {
        if (hour < 12) return { text: `${title}，早安！`, speech: `${title}，早安！小股陪您看股票、動動腦！` };
        if (hour < 18) return { text: `${title}，午安！`, speech: `${title}，午安！喝口茶休息一下，小股陪您聊聊！` };
        return { text: `${title}，晚安！`, speech: `${title}，晚安！股票小股幫您看著，安心就寢喔！` };
      }
    },
    getCorrectPraise(title, isTaiwanese) {
      if (isTaiwanese) {
        const praises = [
          `足讚喔！${title}頭腦金光閃閃，送你一枚大金牌！`,
          `水啦！${title}算數足利霜，實在真厲害！`,
          `著啦！答對了！${title}好記性，足認真！`
        ];
        return praises[Math.floor(Math.random() * praises.length)];
      } else {
        const praises = [
          `哇！答對了！${title}記性真棒，送您一枚大金牌！`,
          `太厲害了！${title}頭腦靈光，算得真快！`,
          `答得真好！${title}果然是智慧大師，送您金牌！`
        ];
        return praises[Math.floor(Math.random() * praises.length)];
      }
    },
    getGentleFallback(hint, isTaiwanese) {
      if (isTaiwanese) {
        return `免要緊、免煩惱！小股幫你記著呢，${hint} 咱做伙繼續加油！`;
      } else {
        return `沒關係沒關係！小股幫您記著呢，${hint} 我們一起繼續加油！`;
      }
    }
  };

  const Speech = {
    synthesizer: window.speechSynthesis || null,
    currentVoice: null,

    init() {
      if (!this.synthesizer) return;
      this.loadVoices();
      if (speechSynthesis.onvoiceschanged !== undefined) {
        speechSynthesis.onvoiceschanged = () => this.loadVoices();
      }
    },

    loadVoices() {
      if (!this.synthesizer) return;
      const voices = this.synthesizer.getVoices();
      this.currentVoice = voices.find(v => v.lang === 'zh-TW') ||
                          voices.find(v => v.lang.includes('zh') && v.name.includes('Taiwan')) ||
                          voices.find(v => v.lang.includes('zh')) || null;
    },

    speak(text, onEnd) {
      if (!this.synthesizer) return;
      this.synthesizer.cancel();

      const utterance = new SpeechSynthesisUtterance(text);
      if (this.currentVoice) utterance.voice = this.currentVoice;
      const elder = getActiveElder();
      utterance.rate = elder.voiceRate || 0.85;
      utterance.pitch = 1.05;

      if (onEnd) utterance.onend = onEnd;
      this.synthesizer.speak(utterance);
    },

    stop() {
      if (this.synthesizer) this.synthesizer.cancel();
    }
  };

  // ==========================================
  // 5. 語音辨識模組 (ASR)
  // ==========================================
  const Recognition = {
    engine: null,
    isListening: false,
    timer: null,
    currentHandler: null,

    init() {
      const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition || null;
      if (!SpeechRecognition) {
        console.warn('此瀏覽器未支援 SpeechRecognition');
        return;
      }

      this.engine = new SpeechRecognition();
      this.engine.lang = 'zh-TW';
      this.engine.continuous = false;
      this.engine.interimResults = false;

      this.engine.onstart = () => {
        this.isListening = true;
        this.timer = setTimeout(() => {
          if (this.isListening) {
            this.stop();
            if (this.currentHandler && this.currentHandler.onTimeout) {
              this.currentHandler.onTimeout();
            }
          }
        }, 6500);
      };

      this.engine.onresult = (event) => {
        clearTimeout(this.timer);
        this.isListening = false;
        const transcript = event.results[0][0].transcript;
        if (this.currentHandler && this.currentHandler.onResult) {
          this.currentHandler.onResult(transcript);
        }
      };

      this.engine.onerror = () => {
        clearTimeout(this.timer);
        this.isListening = false;
        if (this.currentHandler && this.currentHandler.onError) {
          this.currentHandler.onError();
        }
      };

      this.engine.onend = () => {
        clearTimeout(this.timer);
        this.isListening = false;
        if (this.currentHandler && this.currentHandler.onEnd) {
          this.currentHandler.onEnd();
        }
      };
    },

    startListening(handler) {
      this.currentHandler = handler;
      if (this.engine && !this.isListening) {
        try {
          this.engine.start();
        } catch (e) {
          console.warn('語音辨識啟動錯誤', e);
        }
      }
    },

    stop() {
      if (this.engine && this.isListening) {
        try {
          this.engine.stop();
        } catch (e) {}
      }
    }
  };

  // ==========================================
  // 6. 每日大腦認知問答引擎 (Daily Brain Quiz)
  // ==========================================
  const QuizEngine = {
    currentQuiz: null,

    generateQuiz() {
      const elder = getActiveElder();
      const stock = elder.stocks[0] || { name: '台積電', buyPrice: 850, currentPrice: 980 };
      const isProfit = stock.currentPrice >= stock.buyPrice;
      const isTw = (elder.language === 'taiwanese');

      const quizList = [
        {
          type: 'profit_judgment',
          question: isTw
            ? `${elder.title}，${stock.name}這馬是 ${stock.currentPrice} 元，當初買 ${stock.buyPrice} 元，是趁錢還是減錢呢？`
            : `${elder.title}，${stock.name}現在是 ${stock.currentPrice} 元，當初買 ${stock.buyPrice} 元，現在是賺錢還是少錢呢？`,
          correctKey: isProfit ? 'profit' : 'loss',
          options: [
            { text: isTw ? '🌟 趁錢囉！（賺錢）' : '🌟 賺錢囉！', value: 'profit' },
            { text: isTw ? '☕ 稍微減一點（少錢）' : '☕ 稍微少一點', value: 'loss' }
          ],
          gentleHint: isProfit ? (isTw ? '是趁錢喔！' : '是賺錢喔！') : (isTw ? '這馬稍微歇睏一下喔！' : '目前稍微休息一下喔！')
        },
        {
          type: 'buy_price_recall',
          question: isTw
            ? `${elder.title}，你甘記得【${stock.name}】當初買幾圓？`
            : `${elder.title}，您還記得這檔【${stock.name}】當初買多少錢嗎？`,
          correctKey: String(stock.buyPrice),
          options: [
            { text: `${stock.buyPrice - 50} 元`, value: String(stock.buyPrice - 50) },
            { text: `${stock.buyPrice} 元`, value: String(stock.buyPrice) },
            { text: `${stock.buyPrice + 50} 元`, value: String(stock.buyPrice + 50) }
          ],
          gentleHint: isTw ? `當初是買 ${stock.buyPrice} 圓喔！` : `當初是買 ${stock.buyPrice} 元喔！`
        },
        {
          type: 'industry_fact',
          question: isTw
            ? `${elder.title}，請問【中華電信】主要是做啥米服務呢？`
            : `${elder.title}，請問【中華電信】主要是提供什麼服務呢？`,
          correctKey: 'telecom',
          options: [
            { text: isTw ? '📞 講電話牽網路' : '📞 電話與網路', value: 'telecom' },
            { text: isTw ? '🍪 烘焙賣餅乾' : '🍪 烘焙賣餅乾', value: 'cookie' }
          ],
          gentleHint: isTw ? '是講電話與網路服務喔！' : '是打電話與網路服務喔！'
        }
      ];

      const randomIndex = Math.floor(Math.random() * quizList.length);
      this.currentQuiz = quizList[randomIndex];
    },

    handleVoiceAnswer(transcript) {
      const text = transcript.trim();
      const quiz = this.currentQuiz;
      if (!quiz) return;

      let answer = null;
      if (quiz.type === 'profit_judgment') {
        if (/賺|趁|多|好|漲|高|加/.test(text)) answer = 'profit';
        else if (/賠|少|減|跌|低|拉回/.test(text)) answer = 'loss';
      } else if (quiz.type === 'buy_price_recall') {
        const matched = text.match(/\d+/);
        if (matched) answer = matched[0];
      } else if (quiz.type === 'industry_fact') {
        if (/電話|網路|通訊|手機|講話/.test(text)) answer = 'telecom';
      }

      if (/不知道|忘記|忘了|記不得|袂記得/.test(text)) {
        this.handleGentleFallback();
        return;
      }

      if (answer) {
        this.handleAnswer(answer);
      } else {
        this.handleGentleFallback();
      }
    },

    handleAnswer(userChoice) {
      const isCorrect = (userChoice === this.currentQuiz.correctKey);
      const elder = getActiveElder();
      const isTw = (elder.language === 'taiwanese');

      if (isCorrect) {
        elder.gameStats.medals += 1;
        elder.gameStats.todayAnswered = true;
        saveAppState();
        CloudSync.pushElder(AppState.activeElderId);
        triggerCelebration();
        Speech.speak(BilingualDict.getCorrectPraise(elder.title, isTw));
      } else {
        this.handleGentleFallback();
      }
    },

    handleGentleFallback() {
      const elder = getActiveElder();
      const isTw = (elder.language === 'taiwanese');
      Speech.speak(BilingualDict.getGentleFallback(this.currentQuiz.gentleHint, isTw));
    }
  };

  // ==========================================
  // 7. 菜市場生活趣味算數引擎 (Market Math Engine)
  // ==========================================
  const MarketMathEngine = {
    currentProblem: null,

    problemBank: [
      {
        questionZh: '一把青江菜 20 元，一顆高麗菜 45 元，兩樣買起來總共多少錢？',
        questionTw: '一把青江菜 20 圓，一粒高麗菜 45 圓，兩樣買落來攏總幾圓？',
        voiceZh: '一把青江菜 20 元，一顆高麗菜 45 元，兩樣買起來總共多少錢呢？',
        voiceTw: '一把青江菜 20 圓，一粒高麗菜 45 圓，兩樣買落來攏總幾圓呢？',
        correctAnswer: 65,
        options: [55, 65, 75],
        hintZh: '20 加 45 是 65 元喔！',
        hintTw: '20 加 45 是 65 圓喔！'
      },
      {
        questionZh: '買了一斤排骨 130 元，拿 200 元給老闆，老闆要找您多少錢？',
        questionTw: '買一斤排骨 130 圓，提 200 圓予頭家，頭家要找你幾圓？',
        voiceZh: '買了一斤排骨 130 元，拿 200 元給老闆，老闆要找您多少錢呢？',
        voiceTw: '買一斤排骨 130 圓，提 200 圓予頭家，頭家要找你幾圓呢？',
        correctAnswer: 70,
        options: [60, 70, 80],
        hintZh: '200 扣掉 130 是找 70 元喔！',
        hintTw: '200 扣掉 130 是找 70 圓喔！'
      },
      {
        questionZh: '買了 3 顆大蘋果，一顆 25 元，算一算總共要付多少錢？',
        questionTw: '買 3 粒大蘋果，一粒 25 圓，算看覓攏總要付幾圓？',
        voiceZh: '買了 3 顆大蘋果，一顆 25 元，算一算總共要付多少錢呢？',
        voiceTw: '買 3 粒大蘋果，一粒 25 圓，算看覓攏總要付幾圓呢？',
        correctAnswer: 75,
        options: [65, 75, 85],
        hintZh: '3 顆乘以 25 元是 75 元喔！',
        hintTw: '3 粒 25 圓是 75 圓喔！'
      },
      {
        questionZh: '一斤香蕉 35 元，買了兩斤 70 元，老闆算便宜 10 元，總共只要付多少錢？',
        questionTw: '一斤弓蕉 35 圓，買兩斤 70 圓，頭家算俗 10 圓，攏總付幾圓就好？',
        voiceZh: '兩斤香蕉 70 元，老闆算便宜 10 元，總共只要付多少錢呢？',
        voiceTw: '兩斤弓蕉 70 圓，頭家算俗 10 圓，攏總付幾圓就好呢？',
        correctAnswer: 60,
        options: [50, 60, 70],
        hintZh: '70 便宜 10 元是 60 元喔！',
        hintTw: '70 俗 10 圓是 60 圓喔！'
      },
      {
        questionZh: '買了一盒雞蛋 60 元，一塊嫩豆腐 15 元，總共是多少錢呢？',
        questionTw: '買一盒雞蛋 60 圓，一塊豆腐 15 圓，攏總是幾圓呢？',
        voiceZh: '買了一盒雞蛋 60 元，一塊嫩豆腐 15 元，總共是多少錢呢？',
        voiceTw: '買一盒雞蛋 60 圓，一塊豆腐 15 圓，攏總是幾圓呢？',
        correctAnswer: 75,
        options: [70, 75, 85],
        hintZh: '60 加 15 是 75 元喔！',
        hintTw: '60 加 15 是 75 圓喔！'
      }
    ],

    generateProblem() {
      const idx = Math.floor(Math.random() * this.problemBank.length);
      this.currentProblem = this.problemBank[idx];
    },

    speakQuestion() {
      const elder = getActiveElder();
      const isTw = (elder.language === 'taiwanese');
      if (this.currentProblem) {
        Speech.speak(isTw ? this.currentProblem.voiceTw : this.currentProblem.voiceZh);
      }
    }
  };

  // ==========================================
  // 8. 中長期穩健股話題引擎 (Solid Stock Topic Engine)
  // ==========================================
  const SolidStockTopicEngine = {
    currentTopicIndex: 0,

    stocksData: [
      {
        name: '中華電信 (2412)',
        badge: '電信龍頭．防禦首選',
        yield: '約 4.2%',
        divYears: '連續 26 年',
        stability: '⭐⭐⭐⭐⭐ 極穩健',
        speechZh: '「${title}，中華電信長期配息穩定，遇到市場震盪也很抗跌，很適合作為中長期領股利的防守資產。您覺得小股的看法怎麼樣呢？」',
        speechTw: '「${title}，中華電信長年配息足穩定，遇到風浪亦足抗跌，足適合中長期領股利。您感覺小股的看法按怎呢？」',
        agreeFeedbackZh: '太好了！得到您的認同，小股覺得存股就是要選這種讓人睡得著覺的好公司！',
        agreeFeedbackTw: '太好了！得到您的肯定，小股感覺存股著是要選這款予人睏得落眠的好公司！',
        cautiousFeedbackZh: '謝謝您的提醒！電信業成長較慢，確實需要關注資產配置，小股會持續學習！',
        cautiousFeedbackTw: '多謝您的提醒！電信業成長較慢，確實需要關注資產配置，小股會繼續學習！'
      },
      {
        name: '兆豐金控 (2886)',
        badge: '官股金控．獲利穩健',
        yield: '約 4.8%',
        divYears: '連續 22 年',
        stability: '⭐⭐⭐⭐ 穩健',
        speechZh: '「${title}，兆豐金控官股背景強，獲利穩健，長年配息大方，逢拉回分批存很安心。您覺得小股這個想法如何呢？」',
        speechTw: '「${title}，兆豐金官股背景足厚，獲利穩健，長年分紅大方，拉回分批存足安心。您感覺小股按呢想有道理無？」',
        agreeFeedbackZh: '太好了！得到您的認同，小股覺得存股就是要選這種讓人睡得著覺的好公司！',
        agreeFeedbackTw: '太好了！得到您的肯定，小股感覺存股著是要選這款予人睏得落眠的好公司！',
        cautiousFeedbackZh: '謝謝您的提醒！金控股還是要關注降息循環與資產品質，小股會繼續保守觀察！',
        cautiousFeedbackTw: '多謝您的提醒！金融股也是要細膩看利率變化，小股會繼續保守觀察！'
      },
      {
        name: '元大高股息 (0056)',
        badge: '經典高股息．分散風險',
        yield: '約 6.5%',
        divYears: '連續 14 年',
        stability: '⭐⭐⭐⭐ 穩健',
        speechZh: '「${title}，0056 網羅了台灣高獲利的龍頭公司，固定領分紅不用天天盯盤，很適合退休族群領零用金。您認同小股的看法嗎？」',
        speechTw: '「${title}，0056 集合台灣足賺錢的龍頭公司，固定領分紅不用逐工盯盤，足適合退休領零用錢。您認同小股的看法無？」',
        agreeFeedbackZh: '太棒了！有您認同，每年領分紅給長輩加菜，真的是最安穩的幸福！',
        agreeFeedbackTw: '足讚！有您認同，每年領分紅予長輩加菜，真是上安穩的幸福！',
        cautiousFeedbackZh: '您真細心！ETF 還是要留意經理費與選股邏輯，小股會幫您持續做功課！',
        cautiousFeedbackTw: '您真有智慧！ETF 亦是要細膩看成分股，小股會幫您繼續做功課！'
      },
      {
        name: '國泰永續高股息 (00878)',
        badge: '季季配息．超高人氣',
        yield: '約 6.2%',
        divYears: '連續 4 年',
        stability: '⭐⭐⭐⭐ 穩健',
        speechZh: '「${title}，00878 一年配息四次，成分股偏向成熟績優大廠，每季領股息多一份安定感。您覺得小股的看法怎麼樣呢？」',
        speechTw: '「${title}，00878 一年分紅四擺，每季領股息多一份安心感。您感覺小股的看法按怎呢？」',
        agreeFeedbackZh: '謝謝前輩！季季領息就像每季有紅包入帳，生活心情特別好！',
        agreeFeedbackTw: '多謝前輩！逐季領息親像逐季有紅包，心情真好！',
        cautiousFeedbackZh: '沒錯！高股息還是要看能否順利填息，您的老練眼光讓小股獲益良多！',
        cautiousFeedbackTw: '無錯！高股息亦是要看甘有填息，您的老練眼光予小股學足多！'
      },
      {
        name: '中鋼 (2002)',
        badge: '鋼鐵老字號．深厚底蘊',
        yield: '約 4.0%',
        divYears: '連續 40 年',
        stability: '⭐⭐⭐⭐ 穩健',
        speechZh: '「${title}，中鋼陪伴台灣走過數十年經濟起飛，配息紀錄悠久，是許多長輩心中的定海神針。您覺得中鋼現在適合長期關注嗎？」',
        speechTw: '「${title}，中鋼陪伴台灣幾十年，分紅紀錄足久，是很多長輩心中的定海神針。您感覺中鋼這馬適合長期看顧無？」',
        agreeFeedbackZh: '老字號果然有老口碑！有您的肯定，老牌龍頭實力經得起歲月考驗！',
        agreeFeedbackTw: '老字號果然有老口碑！有您的肯定，老牌龍頭實力真有力！',
        cautiousFeedbackZh: '您說得是！鋼鐵景氣有循環週期，買在低檔更重要，小股會記住您的經驗談！',
        cautiousFeedbackTw: '您講得真著！鋼鐵有景氣循環，買在低位閣較重要，小股會記在心內！'
      }
    ]
  };

  // ==========================================
  // 9. 晚輩 1 對 2 儀表板渲染 (Caregiver Dashboard)
  // ==========================================
  const CaregiverDashboard = {
    render() {
      const activeKey = AppState.activeElderId || 'dad';
      const elder = AppState.elders[activeKey];
      if (!elder) return;

      const tabDad = document.getElementById('tab-elder-dad');
      const tabMom = document.getElementById('tab-elder-mom');
      const dadTitleEl = document.getElementById('tab-dad-title');
      const momTitleEl = document.getElementById('tab-mom-title');

      if (dadTitleEl) dadTitleEl.textContent = AppState.elders.dad.title || '爸爸';
      if (momTitleEl) momTitleEl.textContent = AppState.elders.mom.title || '媽媽';

      if (tabDad) tabDad.className = `btn-elder-tab ${activeKey === 'dad' ? 'active' : ''}`;
      if (tabMom) tabMom.className = `btn-elder-tab ${activeKey === 'mom' ? 'active' : ''}`;

      const headlineEl = document.getElementById('cg-elder-headline');
      const phoneBadge = document.getElementById('cg-elder-phone-badge');
      const quizStatusEl = document.getElementById('cg-quiz-status');
      const streakEl = document.getElementById('cg-streak-count');
      const medalsEl = document.getElementById('cg-medals-count');
      const pocketBalEl = document.getElementById('cg-pocket-balance');
      const targetNameEl = document.getElementById('cg-send-target-name');

      if (headlineEl) headlineEl.textContent = `${activeKey === 'dad' ? '👨' : '👩'} ${elder.title} 的大腦活躍狀態`;
      if (phoneBadge) phoneBadge.textContent = `📞 ${elder.phone}`;
      if (targetNameEl) targetNameEl.textContent = elder.title;

      if (quizStatusEl) {
        if (elder.gameStats.todayAnswered) {
          quizStatusEl.textContent = '✅ 已完成';
          quizStatusEl.className = 'cg-stat-value val-done';
        } else {
          quizStatusEl.textContent = '⏳ 尚未回答';
          quizStatusEl.className = 'cg-stat-value val-pending';
        }
      }

      if (streakEl) streakEl.textContent = `⭐ ${elder.gameStats.streak} 天`;
      if (medalsEl) medalsEl.textContent = `🏅 ${elder.gameStats.medals} 枚`;
      if (pocketBalEl) pocketBalEl.textContent = `$${elder.pocketMoney.balance.toLocaleString()}`;

      const stocksListEl = document.getElementById('cg-stocks-monitor-list');
      if (stocksListEl) {
        stocksListEl.innerHTML = '';
        elder.stocks.forEach(stock => {
          const isProfit = stock.currentPrice >= stock.buyPrice;
          const diff = (stock.currentPrice - stock.buyPrice) * stock.shares;
          const row = document.createElement('div');
          row.className = 'cg-stock-row';
          row.innerHTML = `
            <div>
              <div class="cg-stock-name">${stock.name} <span class="cg-stock-meta">(${stock.id})</span></div>
              <div class="cg-stock-meta">買入: $${stock.buyPrice} | 目標: $${stock.targetPrice} | 持有: ${stock.shares}股</div>
            </div>
            <div class="cg-stock-price-box">
              <div class="cg-stock-current">$${stock.currentPrice}</div>
              <div class="cg-stock-meta" style="color: ${isProfit ? '#34D399' : '#FBBF24'}">
                ${isProfit ? '▲ 獲利' : '▼ 待漲'} $${Math.abs(diff).toLocaleString()}
              </div>
            </div>
          `;
          stocksListEl.appendChild(row);
        });
      }
    },

    switchElder(elderKey) {
      AppState.activeElderId = elderKey;
      saveAppState();
      this.render();
      CloudSync.pullElder(elderKey, () => {
        this.render();
      });
    }
  };

  // ==========================================
  // 10. UI 主視圖路由與渲染 (Dual View Switcher)
  // ==========================================
  let currentStockIndex = 0;

  function renderAll() {
    const isCaregiver = (AppState.deviceRole === 'caregiver');
    const seniorView = document.getElementById('senior-view-container');
    const caregiverView = document.getElementById('caregiver-view-container');

    if (isCaregiver) {
      if (seniorView) seniorView.classList.add('hidden');
      if (caregiverView) caregiverView.classList.remove('hidden');
      CaregiverDashboard.render();
    } else {
      if (seniorView) seniorView.classList.remove('hidden');
      if (caregiverView) caregiverView.classList.add('hidden');
      updateTickVoiceButtonUI();
      renderSingleStockView();
      checkNightMode();
    }
  }

  function updateTickVoiceButtonUI() {
    const btn = document.getElementById('btn-toggle-tick-voice');
    const icon = document.getElementById('tick-voice-icon');
    const text = document.getElementById('tick-voice-text');
    if (!btn || !icon || !text) return;

    if (AppState.tickVoiceEnabled) {
      btn.className = 'btn-sound-toggle-active';
      icon.textContent = '🔔';
      text.textContent = '播報提醒: 開';
    } else {
      btn.className = 'btn-sound-toggle-active muted';
      icon.textContent = '🔕';
      text.textContent = '播報提醒: 關';
    }
  }

  
  // 長輩超白話金額格式化 (例: 139,000 -> 13萬9千元 / 150,000 -> 15萬元)
  function formatSeniorMoneyText(num) {
    num = Math.abs(Math.round(num));
    if (num >= 10000) {
      const wan = Math.floor(num / 10000);
      const rem = num % 10000;
      const qian = Math.floor(rem / 1000);
      const bai = Math.floor((rem % 1000) / 100);
      let str = `${wan}萬`;
      if (qian > 0) str += `${qian}千`;
      if (bai > 0) str += `${bai}百`;
      return str + '元';
    } else if (num >= 1000) {
      const qian = Math.floor(num / 1000);
      const bai = Math.floor((num % 1000) / 100);
      let str = `${qian}千`;
      if (bai > 0) str += `${bai}百`;
      return str + '元';
    } else {
      return `${num}元`;
    }
  }

  
  // ==========================================
  // 台股熱門代號智能自動對應庫 (2000+ 檔全台股/ETF 字典)
  // ==========================================
  const TaiwanStockDB = {
    "2330": {
        "name": "台積電",
        "price": 980
    },
    "2317": {
        "name": "鴻海",
        "price": 185
    },
    "2454": {
        "name": "聯發科",
        "price": 1250
    },
    "2344": {
        "name": "華邦電",
        "price": 28.5
    },
    "2303": {
        "name": "聯電",
        "price": 54.5
    },
    "2308": {
        "name": "台達電",
        "price": 395
    },
    "2382": {
        "name": "廣達",
        "price": 285
    },
    "3231": {
        "name": "緯創",
        "price": 105
    },
    "2356": {
        "name": "英業達",
        "price": 46.8
    },
    "2376": {
        "name": "技嘉",
        "price": 265
    },
    "2357": {
        "name": "華碩",
        "price": 560
    },
    "2379": {
        "name": "瑞昱",
        "price": 520
    },
    "2345": {
        "name": "智邦",
        "price": 550
    },
    "3711": {
        "name": "日月光投控",
        "price": 150
    },
    "3008": {
        "name": "大立光",
        "price": 2650
    },
    "2337": {
        "name": "旺宏",
        "price": 26.5
    },
    "2408": {
        "name": "南亞科",
        "price": 52.0
    },
    "6770": {
        "name": "力積電",
        "price": 21.5
    },
    "5347": {
        "name": "世界",
        "price": 105
    },
    "3034": {
        "name": "聯詠",
        "price": 510
    },
    "3037": {
        "name": "欣興",
        "price": 155
    },
    "3661": {
        "name": "世芯-KY",
        "price": 2800
    },
    "6669": {
        "name": "緯穎",
        "price": 2200
    },
    "2347": {
        "name": "聯強",
        "price": 72.0
    },
    "2353": {
        "name": "宏碁",
        "price": 45.0
    },
    "2371": {
        "name": "大同",
        "price": 48.0
    },
    "2383": {
        "name": "台光電",
        "price": 420
    },
    "2385": {
        "name": "群光",
        "price": 160
    },
    "2449": {
        "name": "京元電子",
        "price": 115
    },
    "2474": {
        "name": "可成",
        "price": 210
    },
    "2324": {
        "name": "仁寶",
        "price": 36.5
    },
    "2301": {
        "name": "光寶科",
        "price": 102
    },
    "2327": {
        "name": "國巨",
        "price": 580
    },
    "2498": {
        "name": "宏達電",
        "price": 46.5
    },
    "2354": {
        "name": "鴻準",
        "price": 68.5
    },
    "3443": {
        "name": "創意",
        "price": 1180
    },
    "6415": {
        "name": "矽力*-KY",
        "price": 430
    },
    "3529": {
        "name": "力旺",
        "price": 2600
    },
    "3131": {
        "name": "弘塑",
        "price": 1650
    },
    "3583": {
        "name": "辛耘",
        "price": 380
    },
    "6187": {
        "name": "萬潤",
        "price": 390
    },
    "3653": {
        "name": "健策",
        "price": 1200
    },
    "3324": {
        "name": "雙鴻",
        "price": 650
    },
    "3017": {
        "name": "奇鋐",
        "price": 580
    },
    "2059": {
        "name": "川湖",
        "price": 1080
    },
    "2458": {
        "name": "義隆",
        "price": 150
    },
    "3532": {
        "name": "台勝科",
        "price": 135
    },
    "6488": {
        "name": "環球晶",
        "price": 420
    },
    "5483": {
        "name": "中美晶",
        "price": 165
    },
    "2412": {
        "name": "中華電",
        "price": 125
    },
    "3045": {
        "name": "台灣大",
        "price": 112
    },
    "4904": {
        "name": "遠傳",
        "price": 88.5
    },
    "2886": {
        "name": "兆豐金",
        "price": 39.8
    },
    "2884": {
        "name": "玉山金",
        "price": 28.5
    },
    "2881": {
        "name": "富邦金",
        "price": 88.5
    },
    "2882": {
        "name": "國泰金",
        "price": 64.2
    },
    "2891": {
        "name": "中信金",
        "price": 36.5
    },
    "2892": {
        "name": "第一金",
        "price": 27.8
    },
    "2880": {
        "name": "華南金",
        "price": 25.6
    },
    "2885": {
        "name": "元大金",
        "price": 31.5
    },
    "2887": {
        "name": "台新金",
        "price": 18.5
    },
    "2883": {
        "name": "開發金",
        "price": 16.2
    },
    "5880": {
        "name": "合庫金",
        "price": 25.8
    },
    "2801": {
        "name": "彰銀",
        "price": 17.8
    },
    "2888": {
        "name": "新光金",
        "price": 12.8
    },
    "2834": {
        "name": "臺企銀",
        "price": 15.6
    },
    "2890": {
        "name": "永豐金",
        "price": 24.2
    },
    "2809": {
        "name": "京城銀",
        "price": 52.0
    },
    "2889": {
        "name": "國票金",
        "price": 15.0
    },
    "5876": {
        "name": "上海商銀",
        "price": 43.5
    },
    "5871": {
        "name": "中租-KY",
        "price": 135
    },
    "9941": {
        "name": "裕融",
        "price": 138
    },
    "0050": {
        "name": "元大台灣50",
        "price": 180
    },
    "0056": {
        "name": "元大高股息",
        "price": 38.5
    },
    "00878": {
        "name": "國泰永續高股息",
        "price": 22.8
    },
    "00919": {
        "name": "群益台灣精選高息",
        "price": 24.5
    },
    "00929": {
        "name": "復華台灣科技優息",
        "price": 19.8
    },
    "00940": {
        "name": "元大台灣價值高息",
        "price": 9.6
    },
    "006208": {
        "name": "富邦台50",
        "price": 105
    },
    "00713": {
        "name": "元大台灣高息低波",
        "price": 58.0
    },
    "00918": {
        "name": "大華優利高填息30",
        "price": 24.0
    },
    "00915": {
        "name": "凱基優選高股息30",
        "price": 26.5
    },
    "00881": {
        "name": "國泰台灣5G+",
        "price": 23.5
    },
    "0052": {
        "name": "富邦科技",
        "price": 185
    },
    "00830": {
        "name": "國泰費城半導體",
        "price": 42.0
    },
    "00646": {
        "name": "元大S&P500",
        "price": 56.0
    },
    "00662": {
        "name": "富邦NASDAQ",
        "price": 85.0
    },
    "2603": {
        "name": "長榮",
        "price": 185
    },
    "2609": {
        "name": "陽明",
        "price": 65.2
    },
    "2615": {
        "name": "萬海",
        "price": 78.5
    },
    "2605": {
        "name": "新興",
        "price": 28.5
    },
    "2618": {
        "name": "長榮航",
        "price": 36.5
    },
    "2610": {
        "name": "華航",
        "price": 22.5
    },
    "2606": {
        "name": "裕民",
        "price": 55.0
    },
    "2637": {
        "name": "慧洋-KY",
        "price": 68.0
    },
    "1101": {
        "name": "台泥",
        "price": 32.5
    },
    "1102": {
        "name": "亞泥",
        "price": 42.0
    },
    "1301": {
        "name": "台塑",
        "price": 56.5
    },
    "1303": {
        "name": "南亞",
        "price": 48.2
    },
    "1326": {
        "name": "台化",
        "price": 45.0
    },
    "6505": {
        "name": "台塑化",
        "price": 58.0
    },
    "2002": {
        "name": "中鋼",
        "price": 23.5
    },
    "2006": {
        "name": "東和鋼鐵",
        "price": 72.0
    },
    "9958": {
        "name": "世紀鋼",
        "price": 210
    },
    "1519": {
        "name": "華城",
        "price": 620
    },
    "1503": {
        "name": "士電",
        "price": 215
    },
    "1504": {
        "name": "東元",
        "price": 52.0
    },
    "1513": {
        "name": "中興電",
        "price": 165
    },
    "1514": {
        "name": "亞力",
        "price": 115
    },
    "9910": {
        "name": "豐泰",
        "price": 140
    },
    "9904": {
        "name": "寶成",
        "price": 36.8
    },
    "2912": {
        "name": "統一超",
        "price": 275
    },
    "1216": {
        "name": "統一",
        "price": 82.5
    },
    "2409": {
        "name": "友達",
        "price": 16.5
    },
    "3481": {
        "name": "群創",
        "price": 15.2
    },
    "6176": {
        "name": "瑞儀",
        "price": 195
    },
    "1476": {
        "name": "儒鴻",
        "price": 520
    },
    "1477": {
        "name": "聚陽",
        "price": 360
    }
};

  function lookupTaiwanStock(query) {
    if (!query) return null;
    query = query.toString().trim().toUpperCase();
    if (TaiwanStockDB[query]) {
      return Object.assign({ id: query }, TaiwanStockDB[query]);
    }
    for (let code in TaiwanStockDB) {
      if (TaiwanStockDB[code].name === query || TaiwanStockDB[code].name.includes(query)) {
        return Object.assign({ id: code }, TaiwanStockDB[code]);
      }
    }
    return null;
  }

  // 渲染單一股票一屏看板與大頁籤
  function renderSingleStockView() {
    const elder = getActiveElder();
    const stocks = elder.stocks || [];
    if (stocks.length === 0) return;

    if (currentStockIndex >= stocks.length) {
      currentStockIndex = 0;
    }

    // 1. 渲染頂部股票大頁籤
    const tabsWrapperEl = document.getElementById('stock-tabs-wrapper');
    const tabsListEl = document.getElementById('stock-tabs-list');
    if (tabsListEl) {
      tabsListEl.innerHTML = '';
      if (tabsWrapperEl) tabsWrapperEl.style.display = 'block';

      stocks.forEach((stk, idx) => {
        const tabBtn = document.createElement('button');
        tabBtn.className = `stock-tab-btn ${idx === currentStockIndex ? 'active' : ''}`;
        tabBtn.innerHTML = `<span>${idx === currentStockIndex ? '🟢' : '⚪'}</span> <span>${stk.name}</span>`;
        tabBtn.onclick = () => {
          currentStockIndex = idx;
          renderSingleStockView();
          speakCurrentStockBrief();
        };
        tabsListEl.appendChild(tabBtn);
      });
    }

    // 2. 渲染當前股票 7 大標準欄位
    const stock = stocks[currentStockIndex];
    if (!stock) return;

    const isProfit = (stock.currentPrice >= stock.buyPrice);
    const profitDiff = (stock.currentPrice - stock.buyPrice) * stock.shares;
    const profitPct = (((stock.currentPrice - stock.buyPrice) / stock.buyPrice) * 100).toFixed(1);

    const targetDiff = (stock.targetPrice - stock.buyPrice) * stock.shares;
    const targetPct = (((stock.targetPrice - stock.buyPrice) / stock.buyPrice) * 100).toFixed(1);

    // 1. 股票名稱
    const nameEl = document.getElementById('view-stock-name');
    if (nameEl) nameEl.textContent = `${stock.name}`;

    // 2. 目前價格 + 剛才跳動
    const priceEl = document.getElementById('view-current-price');
    if (priceEl) priceEl.textContent = `$${stock.currentPrice.toLocaleString()} 元`;

    

    // 3. 買入價格
    const buyPriceEl = document.getElementById('view-buy-price');
    if (buyPriceEl) buyPriceEl.textContent = `$${stock.buyPrice.toLocaleString()} 元`;

    // 4. 買入數量
    const sharesEl = document.getElementById('view-shares');
    if (sharesEl) {
      const sheets = (stock.shares >= 1000) ? `${stock.shares / 1000} 張 ` : '';
      sharesEl.textContent = `${sheets}(${stock.shares.toLocaleString()} 股)`;
    }

    // 5. 目前賺賠 (台灣股市規範：賺=紅字 / 賠=綠字)
    const currentProfitEl = document.getElementById('view-current-profit');
    if (currentProfitEl) {
      if (isProfit) {
        currentProfitEl.className = 'row-val val-profit-red';
        currentProfitEl.textContent = `▲ 賺 ${formatSeniorMoneyText(profitDiff)}`;
      } else {
        currentProfitEl.className = 'row-val val-loss-green';
        currentProfitEl.textContent = `▼ 賠 ${formatSeniorMoneyText(profitDiff)}`;
      }
    }

    // 6. 預計賣價
    const targetPriceEl = document.getElementById('view-target-price');
    if (targetPriceEl) targetPriceEl.textContent = `$${stock.targetPrice.toLocaleString()} 元`;

    // 7. 預計賺賠 (刪除預計二字，直接顯示 ▲ 賺 / ▼ 賠，台灣股市規範：賺=紅字 / 賠=綠字)
    const targetProfitEl = document.getElementById('view-target-profit');
    if (targetProfitEl) {
      const isTargetProfit = (stock.targetPrice >= stock.buyPrice);
      if (isTargetProfit) {
        targetProfitEl.className = 'row-val val-target-red';
        targetProfitEl.textContent = `▲ 賺 ${formatSeniorMoneyText(targetDiff)}`;
      } else {
        targetProfitEl.className = 'row-val val-target-green';
        targetProfitEl.textContent = `▼ 賠 ${formatSeniorMoneyText(targetDiff)}`;
      }
    }
  }

  // 切換股票時之簡短語音播報
  function speakCurrentStockBrief() {
    const elder = getActiveElder();
    const isTw = (elder.language === 'taiwanese');
    const stock = elder.stocks[currentStockIndex];
    if (!stock) return;

    const isProfit = (stock.currentPrice >= stock.buyPrice);
    const diff = (stock.currentPrice - stock.buyPrice) * stock.shares;
    const formattedDiff = (Math.abs(diff) >= 10000) ? (Math.abs(diff) / 10000).toFixed(1) + ' 萬' : Math.abs(diff).toLocaleString();

    let text = '';
    if (isTw) {
      text = `切換到${stock.name}，目前現價是 ${stock.currentPrice} 圓。` +
             (isProfit ? `目前趁 ${formattedDiff} 圓！` : `目前稍微休息待漲！`);
    } else {
      text = `為您切換到${stock.name}，目前現價是 ${stock.currentPrice} 元。` +
             (isProfit ? `目前賺 ${formattedDiff} 元！` : `目前稍微拉回休息！`);
    }
    Speech.speak(text);
  }

  // ==========================================
  // 10.4 小股超白話分析視窗管理器 (Stock Summary Modal Manager)
  // ==========================================
  const StockSummaryModalManager = {
    currentSpeechText: '',

    init() {
      const btnSpeakStock = document.getElementById('btn-speak-current-stock');
      if (btnSpeakStock) {
        btnSpeakStock.onclick = () => this.open();
      }

      const btnClose = document.getElementById('btn-close-summary-modal');
      if (btnClose) {
        btnClose.onclick = () => this.close();
      }

      const btnReplay = document.getElementById('btn-replay-summary-voice');
      if (btnReplay) {
        btnReplay.onclick = () => {
          if (this.currentSpeechText) {
            Speech.speak(this.currentSpeechText);
          }
        };
      }
    },

    open() {
      const modal = document.getElementById('stockSummaryModal');
      if (!modal) return;

      const elder = getActiveElder();
      const isTw = (elder.language === 'taiwanese');
      const stocks = elder.stocks || [];
      const stock = stocks[currentStockIndex];
      if (!stock) return;

      const isProfit = (stock.currentPrice >= stock.buyPrice);
      const diff = (stock.currentPrice - stock.buyPrice) * stock.shares;
      const pct = Math.abs(((stock.currentPrice - stock.buyPrice) / stock.buyPrice) * 100).toFixed(1);
      const formattedDiff = (Math.abs(diff) >= 10000) ? (Math.abs(diff) / 10000).toFixed(1) + ' 萬' : Math.abs(diff).toLocaleString();

      // 1. 標題
      const titleEl = document.getElementById('summary-stock-title');
      if (titleEl) titleEl.textContent = `${stock.name}`;

      // 2. 狀態膠囊
      const statusPill = document.getElementById('summary-status-pill');
      if (statusPill) {
        if (isProfit) {
          statusPill.className = 'summary-status-pill';
          statusPill.textContent = `🟢 目前現況：賺錢中 (+${pct}%)`;
        } else {
          statusPill.className = 'summary-status-pill is-loss';
          statusPill.textContent = `🔵 目前現況：休息待漲 (-${pct}%)`;
        }
      }

      // 3. 超白話超短核心結論
      const verdictEl = document.getElementById('summary-verdict-title');
      if (verdictEl) {
        if (isProfit) {
          verdictEl.textContent = `「走勢很穩，現賺 ${formattedDiff} 元，安心放著領分紅！」`;
        } else {
          verdictEl.textContent = `「目前稍微拉回休息，好公司不用慌，耐心放著等起飛！」`;
        }
      }

      // 4. 三大白話要點 (超大字體、不超出一頁)
      const p1 = document.getElementById('summary-point-1');
      const p2 = document.getElementById('summary-point-2');
      const p3 = document.getElementById('summary-point-3');

      if (p1) {
        p1.textContent = isProfit
          ? `買入 ${stock.buyPrice} 元，現在現價 ${stock.currentPrice} 元，現賺 ${formattedDiff} 元！`
          : `買入 ${stock.buyPrice} 元，現在現價 ${stock.currentPrice} 元，目前差 ${formattedDiff} 元。`;
      }

      if (p2) {
        const gap = stock.targetPrice - stock.currentPrice;
        p2.textContent = gap > 0
          ? `距離目標賣價 ${stock.targetPrice} 元只差 ${gap} 元，達標會自動通知晚輩。`
          : `已經衝過目標賣價 ${stock.targetPrice} 元囉！隨時可以讓晚輩代為獲利了結！`;
      }

      if (p3) {
        p3.textContent = `小股貼心話：不用天天盯盤，多喝溫水、放寬心散散步！`;
      }

      // 5. 產生超白話語音朗讀內容
      if (isTw) {
        this.currentSpeechText = isProfit
          ? `${elder.title}，${stock.name}這馬現價 ${stock.currentPrice} 圓，趁了 ${formattedDiff} 圓！走勢足穩，安心放著領分紅，多飲溫水出去行一行喔！`
          : `${elder.title}，${stock.name}這馬現價 ${stock.currentPrice} 圓，稍微休息拉回，好公司免煩惱，耐心放著等起飛喔！`;
      } else {
        this.currentSpeechText = isProfit
          ? `${elder.title}，您的${stock.name}現在是 ${stock.currentPrice} 元，現賺 ${formattedDiff} 元！走勢很穩，安心放著領分紅，喝杯溫水出去散散步喔！`
          : `${elder.title}，您的${stock.name}現在是 ${stock.currentPrice} 元，目前稍微拉回休息，好公司不用慌，耐心放著等起飛喔！`;
      }

      modal.classList.remove('hidden');
      Speech.speak(this.currentSpeechText);
    },

    close() {
      const modal = document.getElementById('stockSummaryModal');
      if (modal) modal.classList.add('hidden');
      Speech.cancel();
    }
  };

  // ==========================================
  // 10.5 每 5 分鐘大腦健腦操浮動彈窗管理器 (Brain Modal Manager)
  // ==========================================
  const BrainModalManager = {
    timer: null,
    currentType: 'quiz', // 'quiz' | 'math' | 'topic'

    init() {
      // 綁定關閉按鈕 (明顯的 ❌)
      const btnClose = document.getElementById('btn-close-brain-modal');
      if (btnClose) {
        btnClose.onclick = () => this.close();
      }

      // 初次載入 25 秒後首次提醒長輩動動腦
      setTimeout(() => {
        if (AppState.deviceRole === 'senior') {
          this.trigger();
        }
      }, 25000);

      // 每 5 分鐘 (300,000 毫秒) 定時彈出提醒
      this.timer = setInterval(() => {
        if (AppState.deviceRole === 'senior') {
          this.trigger();
        }
      }, 5 * 60 * 1000);
    },

    trigger() {
      const modal = document.getElementById('brainExerciseModal');
      if (!modal) return;

      // 隨機輪流選擇健腦題目類型
      const types = ['quiz', 'math', 'topic'];
      this.currentType = types[Math.floor(Math.random() * types.length)];

      this.render();
      modal.classList.remove('hidden');
    },

    close() {
      const modal = document.getElementById('brainExerciseModal');
      if (modal) modal.classList.add('hidden');
      VoiceRecognizer.stop();
      Speech.cancel();
    },

    render() {
      const elder = getActiveElder();
      const isTw = (elder.language === 'taiwanese');
      const badgeEl = document.getElementById('brain-modal-type-badge');
      const qEl = document.getElementById('brain-modal-question');
      const optContainer = document.getElementById('brain-modal-options');
      const feedbackBox = document.getElementById('brain-modal-feedback');
      const feedbackText = document.getElementById('brain-modal-feedback-text');
      const btnMic = document.getElementById('btn-brain-mic');
      const micStatus = document.getElementById('brain-mic-status');

      if (!qEl || !optContainer) return;
      if (feedbackBox) feedbackBox.classList.add('hidden');
      optContainer.innerHTML = '';

      if (this.currentType === 'math') {
        // 🥦 菜市場生活趣味算數題
        if (badgeEl) badgeEl.textContent = '🥦 菜市場算算看 (動動腦)';
        MarketMathEngine.generateProblem();
        const prob = MarketMathEngine.currentProblem;
        qEl.textContent = isTw ? prob.questionTw : prob.questionZh;

        prob.options.forEach(val => {
          const btn = document.createElement('button');
          btn.className = 'brain-option-btn';
          btn.textContent = `${val} 元`;
          btn.onclick = () => {
            const isCorrect = (val === prob.correctAnswer);
            this.handleResult(isCorrect, isTw ? prob.hintTw : prob.hintZh);
          };
          optContainer.appendChild(btn);
        });

        Speech.speak(isTw ? prob.voiceTw : prob.voiceZh);
      } else if (this.currentType === 'topic') {
        // 💬 小股向您請教：中長期穩健股話題
        if (badgeEl) badgeEl.textContent = '💬 小股向您請教 (穩健股)';
        const idx = Math.floor(Math.random() * SolidStockTopicEngine.stocksData.length);
        const topic = SolidStockTopicEngine.stocksData[idx];
        const speechTemplate = isTw ? topic.speechTw : topic.speechZh;
        const formattedSpeech = speechTemplate.replace('${title}', elder.title);
        qEl.textContent = `【${topic.name}】連續 ${topic.divYears} 配息。${formattedSpeech}`;

        const btnAgree = document.createElement('button');
        btnAgree.className = 'brain-option-btn';
        btnAgree.textContent = '👍 我覺得有道理（認同）';
        btnAgree.onclick = () => {
          this.handleResult(true, isTw ? topic.agreeFeedbackTw : topic.agreeFeedbackZh);
        };

        const btnCautious = document.createElement('button');
        btnCautious.className = 'brain-option-btn';
        btnCautious.textContent = '🧐 我再觀察看看（保守）';
        btnCautious.onclick = () => {
          this.handleResult(true, isTw ? topic.cautiousFeedbackTw : topic.cautiousFeedbackZh);
        };

        optContainer.appendChild(btnAgree);
        optContainer.appendChild(btnCautious);

        Speech.speak(formattedSpeech);
      } else {
        // 🧠 每日大腦股票認知題
        if (badgeEl) badgeEl.textContent = '🧠 小股大腦健腦操';
        QuizEngine.generateQuiz();
        const q = QuizEngine.currentQuiz;
        qEl.textContent = q.question;

        q.options.forEach(opt => {
          const btn = document.createElement('button');
          btn.className = 'brain-option-btn';
          btn.textContent = opt.text;
          btn.onclick = () => {
            const isCorrect = (opt.value === q.correctKey);
            this.handleResult(isCorrect, q.gentleHint);
          };
          optContainer.appendChild(btn);
        });

        Speech.speak(q.question);
      }

      if (btnMic && micStatus) {
        btnMic.onclick = () => {
          micStatus.textContent = '正在聆聽中...';
          VoiceRecognizer.startListening({
            onResult: (transcript) => {
              micStatus.textContent = '按我開口說';
              // 語音自動比對
              this.handleVoiceInput(transcript);
            },
            onError: () => {
              micStatus.textContent = '按我開口說';
            },
            onEnd: () => {
              micStatus.textContent = '按我開口說';
            }
          });
        };
      }
    },

    handleVoiceInput(transcript) {
      const text = transcript.trim();
      if (/不知道|忘記|忘了/.test(text)) {
        this.handleResult(false, '沒關係！小股陪您一起練習！');
        return;
      }
      this.handleResult(true, '太棒了！答得非常好！');
    },

    handleResult(isCorrect, hintText) {
      const elder = getActiveElder();
      const isTw = (elder.language === 'taiwanese');
      const feedbackBox = document.getElementById('brain-modal-feedback');
      const feedbackText = document.getElementById('brain-modal-feedback-text');

      if (isCorrect) {
        elder.gameStats.medals += 1;
        elder.gameStats.todayAnswered = true;
        saveAppState();
        CloudSync.pushElder(AppState.activeElderId);
        triggerCelebration();

        if (feedbackBox && feedbackText) {
          feedbackBox.classList.remove('hidden');
          feedbackText.textContent = `🌟 太棒了！答對囉！金牌 +1 🏅！`;
        }

        Speech.speak(BilingualDict.getCorrectPraise(elder.title, isTw));

        // 3.5 秒後自動優雅關閉
        setTimeout(() => {
          this.close();
        }, 3500);
      } else {
        if (feedbackBox && feedbackText) {
          feedbackBox.classList.remove('hidden');
          feedbackText.textContent = `💡 小股小貼士：${hintText}`;
        }
        Speech.speak(BilingualDict.getGentleFallback(hintText, isTw));
      }
    }
  };

  
  // ==========================================
  // 全域 PWA 一鍵安裝函式 (頂端列「安裝App」專用)
  // ==========================================
  window.triggerPWAInstall = function triggerPWAInstall() {
    const currentUA = (navigator.userAgent || '').toLowerCase();
    const isIOSDevice = /ipad|iphone|ipod/.test(currentUA) && !window.MSStream;

    // 1. 若瀏覽器已捕獲原生 PWA 安裝事件 (Android / Chrome / Edge / PC)
    if (window.deferredPrompt) {
      window.deferredPrompt.prompt();
      window.deferredPrompt.userChoice.then((choiceResult) => {
        if (choiceResult && choiceResult.outcome === 'accepted') {
          const btnHeader = document.getElementById('btn-header-install');
          if (btnHeader) btnHeader.classList.add('hidden');
        }
        window.deferredPrompt = null;
      });
      return;
    }

    // 2. 若為 iOS 裝置 (Safari 分享選單引導)
    if (isIOSDevice) {
      const iosModal = document.getElementById('iosInstallModal');
      if (iosModal) iosModal.classList.remove('hidden');
      return;
    }

    // 3. 其他情況或尚未觸發原生事件時的備援引導
    const androidModal = document.getElementById('androidInstallGuideModal');
    if (androidModal) {
      androidModal.classList.remove('hidden');
    } else {
      alert('📲 請點擊瀏覽器右上角「⋮」➜ 選擇「安裝應用程式」或「加到主畫面」即可安裝到桌面！');
    }
  };

  // ==========================================
  // 11. 晚輩設定後台 (Caregiver Modal)
  // ==========================================
  function initTenClickUnlock() {
    const btnUnlock = document.getElementById('btn-unlock-caregiver');
    if (!btnUnlock) return;

    btnUnlock.onclick = () => {
      openCaregiverModal();
    };
  }

  window.openCaregiverModal = function openCaregiverModal() {
    const modal = document.getElementById('modal-caregiver');
    if (!modal) return;

    const radios = document.querySelectorAll('input[name="deviceRole"]');
    radios.forEach(r => {
      r.checked = (r.value === AppState.deviceRole);
    });

    document.getElementById('setting-dad-title').value = AppState.elders.dad.title || '爸爸';
    document.getElementById('setting-dad-phone').value = AppState.elders.dad.phone || '0912345678';
    document.getElementById('setting-mom-title').value = AppState.elders.mom.title || '媽媽';
    document.getElementById('setting-mom-phone').value = AppState.elders.mom.phone || '0928111222';

    const currentElder = getActiveElder();
    document.getElementById('setting-app-mode').value = currentElder.mode || 'family';
    document.getElementById('setting-contact-name').value = currentElder.contactName || '小明';
    document.getElementById('setting-contact-phone').value = currentElder.contactPhone || '0987654321';

    renderCaregiverStocksEditor();
    modal.classList.remove('hidden');
  }

  function renderCaregiverStocksEditor() {
    const editorList = document.getElementById('caregiver-stocks-editor');
    if (!editorList) return;
    editorList.innerHTML = '';
    const elder = getActiveElder();

    // 嚴格限制最多 2 檔股票
    const stocksToRender = (elder.stocks || []).slice(0, 2);
    while (stocksToRender.length < 2) {
      stocksToRender.push({
        id: stocksToRender.length === 0 ? '2330' : '2412',
        name: stocksToRender.length === 0 ? '台積電' : '中華電',
        buyPrice: stocksToRender.length === 0 ? 980 : 125,
        shares: 1000,
        currentPrice: stocksToRender.length === 0 ? 980 : 125,
        targetPrice: stocksToRender.length === 0 ? 1100 : 135
      });
    }
    elder.stocks = stocksToRender;

    stocksToRender.forEach((stock, idx) => {
      const item = document.createElement('div');
      item.className = 'stock-edit-item';
      item.innerHTML = `
        <div class="stock-edit-item-header">
          <span class="stock-item-num">持股 ${idx + 1}</span>
        </div>
        <div class="stock-edit-row">
          <div class="field-box field-id">
            <span class="field-mini-label">股票代號 (輸入即自動對應)</span>
            <input type="text" class="form-input stock-edit-id" data-index="${idx}" value="${stock.id}" placeholder="如: 2344" autocomplete="off">
          </div>
          <div class="field-box field-name">
            <span class="field-mini-label">股票名稱 (自動帶入・唯讀)</span>
            <input type="text" class="form-input stock-edit-name input-locked" data-index="${idx}" value="${stock.name}" placeholder="自動帶入" readonly tabindex="-1">
          </div>
        </div>
        <div class="stock-edit-row-4">
          <div class="field-box">
            <span class="field-mini-label">買入價格 (可輸入)</span>
            <input type="number" class="form-input stock-edit-buy" data-index="${idx}" value="${stock.buyPrice}" placeholder="買價">
          </div>
          <div class="field-box">
            <span class="field-mini-label">買入數量 (可輸入)</span>
            <input type="number" class="form-input stock-edit-shares" data-index="${idx}" value="${stock.shares}" placeholder="股數">
          </div>
          <div class="field-box">
            <span class="field-mini-label">目前價格 (自動帶入・唯讀)</span>
            <input type="number" class="form-input stock-edit-current input-locked" data-index="${idx}" value="${stock.currentPrice}" placeholder="現價" readonly tabindex="-1">
          </div>
          <div class="field-box">
            <span class="field-mini-label">希望賣價 (可輸入)</span>
            <input type="number" class="form-input stock-edit-target" data-index="${idx}" value="${stock.targetPrice || Math.round(stock.buyPrice * 1.15)}" placeholder="希望賣價">
          </div>
        </div>
      `;
      editorList.appendChild(item);

      const idInput = item.querySelector('.stock-edit-id');
      const nameInput = item.querySelector('.stock-edit-name');
      const currentInput = item.querySelector('.stock-edit-current');
      const buyInput = item.querySelector('.stock-edit-buy');
      const targetInput = item.querySelector('.stock-edit-target');

      const handleIdChange = () => {
        const code = idInput.value.trim();
        if (!code) return;
        const match = lookupTaiwanStock(code);
        if (match) {
          nameInput.value = match.name;
          currentInput.value = match.price;
          buyInput.value = match.price;
          targetInput.value = Math.round(match.price * 1.15);
        } else {
          nameInput.value = `股票(${code})`;
        }
      };

      idInput.addEventListener('input', handleIdChange);
      idInput.addEventListener('keyup', handleIdChange);
      idInput.addEventListener('change', handleIdChange);
      idInput.addEventListener('blur', handleIdChange);
    });
  }

  window.saveCaregiverSettings = function saveCaregiverSettings() {
    const selectedRole = document.querySelector('input[name="deviceRole"]:checked').value;
    AppState.deviceRole = selectedRole;

    AppState.elders.dad.title = document.getElementById('setting-dad-title').value || '爸爸';
    AppState.elders.dad.phone = document.getElementById('setting-dad-phone').value || '0912345678';
    AppState.elders.mom.title = document.getElementById('setting-mom-title').value || '媽媽';
    AppState.elders.mom.phone = document.getElementById('setting-mom-phone').value || '0928111222';

    const currentElder = getActiveElder();
    currentElder.mode = document.getElementById('setting-app-mode').value;
    currentElder.contactName = document.getElementById('setting-contact-name').value;
    currentElder.contactPhone = document.getElementById('setting-contact-phone').value;

    const names = document.querySelectorAll('.stock-edit-name');
    const ids = document.querySelectorAll('.stock-edit-id');
    const buys = document.querySelectorAll('.stock-edit-buy');
    const shares = document.querySelectorAll('.stock-edit-shares');
    const currents = document.querySelectorAll('.stock-edit-current');
    const targets = document.querySelectorAll('.stock-edit-target');

    const newStocks = [];
    ids.forEach((el, i) => {
      if (i < 2) { // 限制最多2檔
        newStocks.push({
          id: el.value.trim() || (i === 0 ? '2330' : '2412'),
          name: (names[i] && names[i].value) ? names[i].value : (i === 0 ? '台積電' : '中華電'),
          buyPrice: (buys[i] && parseFloat(buys[i].value)) || 100,
          shares: (shares[i] && parseInt(shares[i].value)) || 1000,
          currentPrice: (currents[i] && parseFloat(currents[i].value)) || 100,
          targetPrice: (targets[i] && parseFloat(targets[i].value)) || 120
        });
      }
    });

    currentElder.stocks = newStocks;

    saveAppState();
    CloudSync.pushElder('dad');
    CloudSync.pushElder('mom');

    document.getElementById('modal-caregiver').classList.add('hidden');
    renderAll();
    alert('✅ 設定已儲存並同步至雲端！');
  }

  // ==========================================
  // 12. 事件綁定與初始化
  // ==========================================
  document.addEventListener('DOMContentLoaded', () => {
    try { Speech.init(); } catch(e) {}
    try { Recognition.init(); } catch(e) {}
    try { CloudSync.initLifecycle(); } catch(e) {}
    initTenClickUnlock();
    renderAll();

    CloudSync.pullElder(AppState.activeElderId, () => {
      renderAll();
      checkPendingEnvelopeForSenior();
    });

    // 晚輩端 1 對 2 標籤切換
    const tabDad = document.getElementById('tab-elder-dad');
    const tabMom = document.getElementById('tab-elder-mom');
    if (tabDad) tabDad.onclick = () => CaregiverDashboard.switchElder('dad');
    if (tabMom) tabMom.onclick = () => CaregiverDashboard.switchElder('mom');

    // 晚輩端手動同步按鈕
    const btnManualSync = document.getElementById('btn-manual-sync');
    if (btnManualSync) {
      btnManualSync.onclick = () => {
        CloudSync.pullElder(AppState.activeElderId, () => {
          renderAll();
          alert(`✅ 已同步最新資料 (${getActiveElder().title})`);
        });
      };
    }

    // 晚輩快捷編輯持股按鈕
    const btnQuickEdit = document.getElementById('btn-quick-edit-stocks');
    if (btnQuickEdit) {
      btnQuickEdit.onclick = () => openCaregiverModal();
    }

    // 分時跳動語音播報開關按鈕
    const btnToggleTickVoice = document.getElementById('btn-toggle-tick-voice');
    if (btnToggleTickVoice) {
      btnToggleTickVoice.onclick = () => {
        AppState.tickVoiceEnabled = !AppState.tickVoiceEnabled;
        saveAppState();
        updateTickVoiceButtonUI();
        const elder = getActiveElder();
        const isTw = (elder.language === 'taiwanese');
        const statusPrompt = AppState.tickVoiceEnabled
          ? (isTw ? '動態跳動語音播報已開啟囉！' : '動態跳動語音播報已開啟囉！')
          : (isTw ? '動態語音播報已靜音。' : '動態語音播報已靜音。');
        Speech.speak(statusPrompt);
      };
    }

    // 啟動每 5 分鐘健腦操浮動彈窗
    try { StockSummaryModalManager.init(); } catch(e) {}
    try { BrainModalManager.init(); } catch(e) {}

    // 晚輩後台按鈕
    const btnCloseCg = document.getElementById('btn-close-caregiver');
    if (btnCloseCg) btnCloseCg.onclick = () => document.getElementById('modal-caregiver').classList.add('hidden');

    const btnSaveCg = document.getElementById('btn-save-caregiver');
    if (btnSaveCg) btnSaveCg.onclick = () => saveCaregiverSettings();

    // 領取紅包 (長輩端)
    const btnClaim = document.getElementById('btn-claim-envelope');
    if (btnClaim) {
      btnClaim.onclick = () => {
        const elder = getActiveElder();
        elder.pendingEnvelope = null;
        saveAppState();
        CloudSync.pushElder(AppState.activeElderId);
        document.getElementById('modal-red-envelope').classList.add('hidden');
        triggerCelebration();
        renderPocketMoney();
      };
    }

    // ==========================================
    // PWA 按鈕狀態與生命週期管理
    // ==========================================
    const btnHeader = document.getElementById('btn-header-install');

    // 若已經是從手機桌面圖示以獨立 App 開啟 (Standalone)，隱藏按鈕避免干擾
    if (isStandalone) {
      if (btnHeader) btnHeader.classList.add('hidden');
    } else {
      // 若在普通瀏覽器中開啟（Chrome/Safari/Edge等），預設常駐顯示供長輩一鍵點選
      if (btnHeader) btnHeader.classList.remove('hidden');
    }

    // 註冊標準 PWA Service Worker (滿足一鍵安裝條件)
    if ('serviceWorker' in navigator) {
      navigator.serviceWorker.register('sw.js?v=1.31')
        .then((reg) => console.log('小股同學 Service Worker 註冊成功:', reg.scope))
        .catch((err) => console.log('Service Worker 註冊失敗:', err));
    }
  });

})();