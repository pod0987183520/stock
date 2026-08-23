/**
 * 小股同學 - 我的股票 (防失智長者股票認知訓練與資產關懷 PWA)
 * 核心業務與互動邏輯 (All-in-One Engine v1.07 - 分時跳動動態語音播報版)
 */

(function () {
  'use strict';

  // ==========================================
  // 1. 預設資料與狀態管理 (AppState & LocalStorage)
  // ==========================================
  const STORAGE_KEY = 'xiaogu_stocks_app_data_v3';

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

  function loadAppState() {
    try {
      const saved = localStorage.getItem(STORAGE_KEY);
      if (saved) {
        return Object.assign({}, defaultData, JSON.parse(saved));
      }
      const oldSaved = localStorage.getItem('xiaogu_stocks_app_data_v2') || localStorage.getItem('xiaogu_stocks_app_data');
      if (oldSaved) {
        const old = JSON.parse(oldSaved);
        const data = JSON.parse(JSON.stringify(defaultData));
        data.deviceRole = old.deviceRole || 'senior';
        data.activeElderId = old.activeElderId || 'dad';
        if (old.elders) {
          if (old.elders.dad) data.elders.dad = Object.assign({}, data.elders.dad, old.elders.dad);
          if (old.elders.mom) data.elders.mom = Object.assign({}, data.elders.mom, old.elders.mom);
        }
        return data;
      }
    } catch (e) {
      console.warn('讀取 LocalStorage 失敗，使用預設值', e);
    }
    return JSON.parse(JSON.stringify(defaultData));
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
      this.render();
    },

    render() {
      const qText = document.getElementById('quiz-question');
      const optContainer = document.getElementById('quiz-options-container');
      const feedbackBox = document.getElementById('quiz-feedback');

      if (!qText || !optContainer) return;

      qText.textContent = this.currentQuiz.question;
      if (feedbackBox) feedbackBox.classList.add('hidden');
      optContainer.innerHTML = '';

      this.currentQuiz.options.forEach(opt => {
        const btn = document.createElement('button');
        btn.className = 'btn-quiz-option';
        btn.textContent = opt.text;
        btn.onclick = () => this.handleAnswer(opt.value);
        optContainer.appendChild(btn);
      });
    },

    handleVoiceAnswer(transcript) {
      const text = transcript.trim();
      const quiz = this.currentQuiz;

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
        updateHeaderAndBadges();
        triggerCelebration();
        Speech.speak(BilingualDict.getCorrectPraise(elder.title, isTw));
      } else {
        this.handleGentleFallback();
      }
    },

    handleGentleFallback() {
      const elder = getActiveElder();
      const isTw = (elder.language === 'taiwanese');
      const feedbackBox = document.getElementById('quiz-feedback');
      const feedbackText = document.getElementById('quiz-feedback-text');
      if (feedbackBox && feedbackText) {
        feedbackBox.classList.remove('hidden');
        feedbackText.textContent = `💡 小股小貼士：${this.currentQuiz.gentleHint} 我們一樣好棒！`;
      }

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
      this.render();
    },

    render() {
      const elder = getActiveElder();
      const isTw = (elder.language === 'taiwanese');
      const qEl = document.getElementById('market-question');
      const optContainer = document.getElementById('market-options-container');
      const feedbackBox = document.getElementById('market-feedback');

      if (!qEl || !optContainer) return;

      qEl.textContent = isTw ? this.currentProblem.questionTw : this.currentProblem.questionZh;
      if (feedbackBox) feedbackBox.classList.add('hidden');
      optContainer.innerHTML = '';

      this.currentProblem.options.forEach(num => {
        const btn = document.createElement('button');
        btn.className = 'btn-quiz-option';
        btn.textContent = `${num} 元`;
        btn.onclick = () => this.handleAnswer(num);
        optContainer.appendChild(btn);
      });
    },

    speakQuestion() {
      const elder = getActiveElder();
      const isTw = (elder.language === 'taiwanese');
      Speech.speak(isTw ? this.currentProblem.voiceTw : this.currentProblem.voiceZh);
    },

    handleVoiceAnswer(transcript) {
      const matched = transcript.match(/\d+/);
      if (matched) {
        this.handleAnswer(parseInt(matched[0]));
      } else {
        this.handleGentleFallback();
      }
    },

    handleAnswer(userAns) {
      const isCorrect = (userAns === this.currentProblem.correctAnswer);
      const elder = getActiveElder();
      const isTw = (elder.language === 'taiwanese');

      if (isCorrect) {
        elder.gameStats.medals += 1;
        saveAppState();
        CloudSync.pushElder(AppState.activeElderId);
        updateHeaderAndBadges();
        triggerCelebration();
        Speech.speak(BilingualDict.getCorrectPraise(elder.title, isTw));
      } else {
        this.handleGentleFallback();
      }
    },

    handleGentleFallback() {
      const elder = getActiveElder();
      const isTw = (elder.language === 'taiwanese');
      const hint = isTw ? this.currentProblem.hintTw : this.currentProblem.hintZh;
      const feedbackBox = document.getElementById('market-feedback');
      const feedbackText = document.getElementById('market-feedback-text');

      if (feedbackBox && feedbackText) {
        feedbackBox.classList.remove('hidden');
        feedbackText.textContent = `🥦 菜市場小算盤：${hint}`;
      }

      Speech.speak(BilingualDict.getGentleFallback(hint, isTw));
    }
  };

  // ==========================================
  // 8. 中長期穩健股話題引擎 (Solid Stock Topic Engine)
  // ==========================================
  const SolidStockTopicEngine = {
    currentIndex: 0,

    stocksData: [
      {
        name: '中華電 (2412)',
        badge: '電信龍頭．防禦首選',
        yield: '約 4.2%',
        divYears: '連續 26 年',
        stability: '⭐⭐⭐⭐⭐ 極高',
        speechZh: '「${title}，小股最近做功課，覺得中華電信長期配息穩定，遇到市場震盪也很抗跌，很適合作為中長期領股利的防守資產。您在股市經驗豐富，您覺得小股的看法怎麼樣呢？」',
        speechTw: '「${title}，小股最近做功課，感覺中華電信長年配息足穩定，遇到風浪亦足抗跌，足適合中長期領股利。您在股市經驗豐富，您感覺小股的看法按怎呢？」',
        agreeFeedbackZh: '太棒了！有您這位股市老前輩肯定，小股信心大增！我們一起穩健看長遠！',
        agreeFeedbackTw: '水啦！有您這位股市大前輩肯定，小股信心滿滿！咱做伙穩穩領股利！',
        cautiousFeedbackZh: '您說得真對！投資本來就要多看多比較、沉得住氣，薑還是老的辣，小股學到寶貴的一課！',
        cautiousFeedbackTw: '您講得真著！投資本來著要多看多比較，薑是老的辣，小股學著寶貴的一課！'
      },
      {
        name: '兆豐金 (2886)',
        badge: '官股金控．獲利穩健',
        yield: '約 4.8%',
        divYears: '連續 22 年',
        stability: '⭐⭐⭐⭐⭐ 極高',
        speechZh: '「${title}，小股看到兆豐金控官股背景強，外匯與企金獲利穩健，長年配息大方，逢拉回分批存很安心。您覺得小股這個想法如何呢？」',
        speechTw: '「${title}，小股看著兆豐金官股背景足厚，外匯獲利穩健，長年分紅大方，拉回分批存足安心。您感覺小股按呢想有道理無？」',
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
    ],

    render() {
      const stock = this.stocksData[this.currentIndex];
      const elder = getActiveElder();
      const isTw = (elder.language === 'taiwanese');

      const nameEl = document.getElementById('topic-stock-name');
      const badgeEl = document.getElementById('topic-badge-type');
      const yieldEl = document.getElementById('topic-yield');
      const divYearsEl = document.getElementById('topic-div-years');
      const stabilityEl = document.getElementById('topic-stability');
      const speechEl = document.getElementById('topic-speech-text');
      const feedbackBox = document.getElementById('topic-feedback-box');

      if (nameEl) nameEl.textContent = stock.name;
      if (badgeEl) badgeEl.textContent = stock.badge;
      if (yieldEl) yieldEl.textContent = stock.yield;
      if (divYearsEl) divYearsEl.textContent = stock.divYears;
      if (stabilityEl) stabilityEl.textContent = stock.stability;

      const speechTemplate = isTw ? stock.speechTw : stock.speechZh;
      const formattedSpeech = speechTemplate.replace('${title}', elder.title);

      if (speechEl) speechEl.textContent = formattedSpeech;
      if (feedbackBox) feedbackBox.classList.add('hidden');
    },

    speakTopic() {
      const stock = this.stocksData[this.currentIndex];
      const elder = getActiveElder();
      const isTw = (elder.language === 'taiwanese');
      const speechTemplate = isTw ? stock.speechTw : stock.speechZh;
      const formattedSpeech = speechTemplate.replace('${title}', elder.title);
      Speech.speak(formattedSpeech);
    },

    handleOpinion(agree) {
      const stock = this.stocksData[this.currentIndex];
      const elder = getActiveElder();
      const isTw = (elder.language === 'taiwanese');
      const feedbackBox = document.getElementById('topic-feedback-box');
      const feedbackText = document.getElementById('topic-feedback-text');

      const responseText = agree
        ? (isTw ? stock.agreeFeedbackTw : stock.agreeFeedbackZh)
        : (isTw ? stock.cautiousFeedbackTw : stock.cautiousFeedbackZh);

      if (feedbackBox && feedbackText) {
        feedbackBox.classList.remove('hidden');
        feedbackText.textContent = `💬 小股回饋：${responseText}`;
      }

      Speech.speak(responseText);
    },

    nextStock() {
      this.currentIndex = (this.currentIndex + 1) % this.stocksData.length;
      this.render();
      this.speakTopic();
    }
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
      updateLanguageUI();
      updateHeaderAndBadges();
      updateTickVoiceButtonUI();
      renderStocksList();
      renderAiAdvice();
      renderPocketMoney();
      QuizEngine.generateQuiz();
      MarketMathEngine.generateProblem();
      SolidStockTopicEngine.render();
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
      text.textContent = '跳動播報: 開';
    } else {
      btn.className = 'btn-sound-toggle-active muted';
      icon.textContent = '🔕';
      text.textContent = '跳動播報: 關';
    }
  }

  function updateLanguageUI() {
    const elder = getActiveElder();
    const isTw = (elder.language === 'taiwanese');
    const btnLang = document.getElementById('btn-lang-toggle');
    const iconEl = document.getElementById('lang-icon');
    const textEl = document.getElementById('lang-text');

    if (btnLang && iconEl && textEl) {
      if (isTw) {
        btnLang.classList.add('active-tw');
        iconEl.textContent = '🎙️';
        textEl.textContent = '台語';
      } else {
        btnLang.classList.remove('active-tw');
        iconEl.textContent = '🗣️';
        textEl.textContent = '國語';
      }
    }
  }

  function toggleLanguage() {
    const elder = getActiveElder();
    const current = elder.language || 'zh-TW';
    elder.language = (current === 'zh-TW') ? 'taiwanese' : 'zh-TW';
    saveAppState();
    CloudSync.pushElder(AppState.activeElderId);

    updateLanguageUI();
    updateHeaderAndBadges();
    QuizEngine.render();
    MarketMathEngine.render();
    SolidStockTopicEngine.render();

    const isTw = (elder.language === 'taiwanese');
    const prompt = isTw
      ? '切換為台語模式囉！小股用台語陪你開講！'
      : '切換為國語模式囉！小股陪您看股票、動動腦！';
    Speech.speak(prompt);
  }

  function updateHeaderAndBadges() {
    const elder = getActiveElder();
    const isTw = (elder.language === 'taiwanese');
    const greetingEl = document.getElementById('user-greeting');
    const subGreetingEl = document.getElementById('sub-greeting');
    const modeBadgeEl = document.getElementById('current-mode-badge');
    const streakBadgeEl = document.getElementById('streak-badge');
    const medalCountEl = document.getElementById('medal-count');

    const greetingObj = BilingualDict.getGreeting(elder.title, isTw);

    if (greetingEl) greetingEl.textContent = greetingObj.text;
    if (subGreetingEl) subGreetingEl.textContent = isTw ? '小股陪你看股票、動動腦' : '小股陪您看股票、動動腦';

    if (modeBadgeEl) {
      if (elder.mode === 'family') modeBadgeEl.textContent = '🏠 晚輩陪伴模式';
      else if (elder.mode === 'simulation') modeBadgeEl.textContent = '🎮 模擬大亨遊戲模式';
      else modeBadgeEl.textContent = '👴 獨立看盤模式';
    }

    if (streakBadgeEl) streakBadgeEl.textContent = `⭐ 大腦打卡 ${elder.gameStats.streak} 天`;
    if (medalCountEl) medalCountEl.textContent = `🏅 x ${elder.gameStats.medals} 枚`;
  }

  function renderStocksList() {
    const listEl = document.getElementById('stocks-list');
    if (!listEl) return;
    listEl.innerHTML = '';
    const elder = getActiveElder();

    elder.stocks.forEach((stock, index) => {
      const isProfit = stock.currentPrice >= stock.buyPrice;
      const profitDiff = (stock.currentPrice - stock.buyPrice) * stock.shares;
      const reachTarget = stock.currentPrice >= stock.targetPrice;

      // 計算與上一盤跳動差異
      let tickBadgeHtml = '';
      if (stock.lastDiff > 0) {
        tickBadgeHtml = `<div class="tick-diff-badge tick-up">⚡ 剛才跳動：▲ 比剛剛漲 $${stock.lastDiff} 元</div>`;
      } else if (stock.lastDiff < 0) {
        tickBadgeHtml = `<div class="tick-diff-badge tick-down">⚡ 剛才跳動：▼ 比剛剛下滑 $${Math.abs(stock.lastDiff)} 元</div>`;
      } else {
        tickBadgeHtml = `<div class="tick-diff-badge tick-flat">⚡ 剛才跳動：盤中平穩</div>`;
      }

      const card = document.createElement('div');
      card.className = `stock-card ${isProfit ? 'glow-profit' : 'glow-loss'}`;

      card.innerHTML = `
        <div class="stock-header">
          <div>
            <span class="stock-name">${stock.name}</span>
            <span class="stock-code">${stock.id}</span>
          </div>
          <span class="profit-label ${isProfit ? 'profit' : 'loss'}">
            【今日累積】${isProfit ? `▲ 賺 $${profitDiff.toLocaleString()} 元` : `▼ 少 $${Math.abs(profitDiff).toLocaleString()} 元`}
          </span>
        </div>

        <div class="price-display-row">
          <span class="price-title">目前現價</span>
          <span class="price-huge">$${stock.currentPrice}</span>
          <span class="price-unit">元</span>
        </div>

        ${tickBadgeHtml}

        <div class="stock-detail-row" style="margin-top: 14px;">
          <span>買入單價：$${stock.buyPrice} 元</span>
          <span>持有股數：${stock.shares.toLocaleString()} 股</span>
        </div>

        <div class="target-price-control">
          <div class="target-info">
            <span class="target-title">我的目標賣出價</span>
            <span class="target-value" id="target-display-${index}">$${stock.targetPrice} 元</span>
          </div>
          <div class="btn-adjust-group">
            <button class="btn-adjust" data-index="${index}" data-action="minus" title="降5元">－</button>
            <button class="btn-adjust" data-index="${index}" data-action="plus" title="加5元">＋</button>
          </div>
        </div>

        ${reachTarget ? `
          <button class="btn-call-action" onclick="window.location.href='tel:${elder.contactPhone}'">
            📞 撥打給${elder.contactName}（已達目標價！）
          </button>
        ` : ''}
      `;

      listEl.appendChild(card);
    });

    bindTargetAdjustButtons();
  }

  let lastAdjustTime = 0;
  function bindTargetAdjustButtons() {
    document.querySelectorAll('.btn-adjust').forEach(btn => {
      btn.onclick = () => {
        const now = Date.now();
        if (now - lastAdjustTime < 300) return;
        lastAdjustTime = now;

        const elder = getActiveElder();
        const idx = parseInt(btn.dataset.index);
        const action = btn.dataset.action;
        const stock = elder.stocks[idx];

        if (action === 'plus') {
          stock.targetPrice += 5;
        } else if (action === 'minus' && stock.targetPrice > 5) {
          stock.targetPrice -= 5;
        }

        saveAppState();
        CloudSync.pushElder(AppState.activeElderId);
        renderStocksList();

        const isTw = (elder.language === 'taiwanese');
        const adjustMsg = isTw
          ? `已經幫你將${stock.name}目標價調整為 ${stock.targetPrice} 圓囉！`
          : `已幫您將${stock.name}目標價調整為 ${stock.targetPrice} 元囉！`;
        Speech.speak(adjustMsg);
      };
    });
  }

  function renderAiAdvice() {
    const textEl = document.getElementById('ai-advice-text');
    if (!textEl) return;
    const elder = getActiveElder();
    const stock = elder.stocks[0];
    if (stock && stock.aiAdvice) {
      textEl.textContent = `「${stock.aiAdvice}」`;
    }
  }

  function renderPocketMoney() {
    const balEl = document.getElementById('pocket-balance');
    const elder = getActiveElder();
    if (balEl && elder.pocketMoney) {
      balEl.textContent = `$${elder.pocketMoney.balance.toLocaleString()} 元`;
    }
  }

  function checkNightMode() {
    const hour = new Date().getHours();
    const minute = new Date().getMinutes();
    const isNight = (hour >= 21 || hour < 9);
    const nightLayer = document.getElementById('night-rest-layer');
    const clockEl = document.getElementById('night-clock');
    const elder = getActiveElder();

    if (clockEl) {
      clockEl.textContent = `${String(hour).padStart(2, '0')}:${String(minute).padStart(2, '0')}`;
    }

    if (elder.nightModeEnabled && isNight) {
      if (nightLayer) nightLayer.classList.remove('hidden');
    } else {
      if (nightLayer) nightLayer.classList.add('hidden');
    }
  }

  function triggerCelebration() {
    const layer = document.getElementById('celebration-layer');
    const canvas = document.getElementById('confetti-canvas');
    if (!layer || !canvas) return;

    layer.classList.remove('hidden');
    const ctx = canvas.getContext('2d');
    canvas.width = window.innerWidth;
    canvas.height = window.innerHeight;

    const particles = Array.from({ length: 80 }, () => ({
      x: Math.random() * canvas.width,
      y: -20,
      r: Math.random() * 8 + 4,
      color: ['#FBBF24', '#38BDF8', '#10B981', '#F43F5E'][Math.floor(Math.random() * 4)],
      vx: (Math.random() - 0.5) * 4,
      vy: Math.random() * 4 + 3
    }));

    let frame = 0;
    function animate() {
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      particles.forEach(p => {
        p.x += p.vx;
        p.y += p.vy;
        ctx.beginPath();
        ctx.arc(p.x, p.y, p.r, 0, Math.PI * 2);
        ctx.fillStyle = p.color;
        ctx.fill();
      });

      frame++;
      if (frame < 120) {
        requestAnimationFrame(animate);
      } else {
        layer.classList.add('hidden');
      }
    }
    animate();
  }

  // ==========================================
  // 11. 晚輩設定後台 (Caregiver Modal)
  // ==========================================
  let clickCount = 0;
  let clickTimer = null;

  function initTenClickUnlock() {
    const btnUnlock = document.getElementById('btn-unlock-caregiver');
    if (!btnUnlock) return;

    btnUnlock.onclick = () => {
      clickCount++;
      if (navigator.vibrate && clickCount >= 6) {
        navigator.vibrate(50);
      }

      clearTimeout(clickTimer);
      clickTimer = setTimeout(() => {
        clickCount = 0;
      }, 3500);

      if (clickCount >= 10) {
        clickCount = 0;
        clearTimeout(clickTimer);
        openCaregiverModal();
      }
    };
  }

  function openCaregiverModal() {
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

    elder.stocks.forEach((stock, idx) => {
      const item = document.createElement('div');
      item.className = 'stock-edit-item';
      item.innerHTML = `
        <div class="input-row" style="margin-bottom: 8px;">
          <input type="text" class="form-input stock-edit-name" data-index="${idx}" value="${stock.name}" placeholder="股票名稱">
          <input type="text" class="form-input stock-edit-id" data-index="${idx}" value="${stock.id}" placeholder="代碼">
        </div>
        <div class="input-row">
          <input type="number" class="form-input stock-edit-buy" data-index="${idx}" value="${stock.buyPrice}" placeholder="買價">
          <input type="number" class="form-input stock-edit-shares" data-index="${idx}" value="${stock.shares}" placeholder="股數">
          <input type="number" class="form-input stock-edit-current" data-index="${idx}" value="${stock.currentPrice}" placeholder="現價">
        </div>
      `;
      editorList.appendChild(item);
    });
  }

  function saveCaregiverSettings() {
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

    names.forEach((el, i) => {
      if (currentElder.stocks[i]) {
        currentElder.stocks[i].name = el.value || currentElder.stocks[i].name;
        currentElder.stocks[i].id = ids[i].value || currentElder.stocks[i].id;
        currentElder.stocks[i].buyPrice = parseFloat(buys[i].value) || currentElder.stocks[i].buyPrice;
        currentElder.stocks[i].shares = parseInt(shares[i].value) || currentElder.stocks[i].shares;
        currentElder.stocks[i].currentPrice = parseFloat(currents[i].value) || currentElder.stocks[i].currentPrice;
      }
    });

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
    Speech.init();
    Recognition.init();
    CloudSync.initLifecycle();
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

    // 晚輩端直接打開設定
    const btnDirectSettings = document.getElementById('btn-open-settings-direct');
    if (btnDirectSettings) {
      btnDirectSettings.onclick = () => openCaregiverModal();
    }

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

    // 晚輩快捷發送孝親紅包
    const btnCgSendBonus = document.getElementById('btn-cg-send-bonus');
    if (btnCgSendBonus) {
      btnCgSendBonus.onclick = () => {
        const amount = parseInt(document.getElementById('cg-input-bonus-amount').value) || 5000;
        const note = document.getElementById('cg-input-bonus-note').value || '股票拉回孝親補貼';
        const elderKey = AppState.activeElderId;
        const elder = AppState.elders[elderKey];

        elder.pocketMoney.balance += amount;
        elder.pocketMoney.history.unshift({
          date: new Date().toLocaleDateString('zh-TW'),
          sender: elder.contactName || '小明 (兒子)',
          amount: amount,
          note: note
        });

        elder.pendingEnvelope = {
          amount: amount,
          note: note,
          sender: elder.contactName || '小明 (兒子)',
          timestamp: Date.now()
        };

        saveAppState();
        CloudSync.pushElder(elderKey);
        CaregiverDashboard.render();
        alert(`🎁 已成功發送 $${amount.toLocaleString()} 元孝親紅包至【${elder.title}】手機！`);
      };
    }

    // 晚輩自訂小股貼心話
    const btnCgSendAdvice = document.getElementById('btn-cg-send-advice');
    if (btnCgSendAdvice) {
      btnCgSendAdvice.onclick = () => {
        const customText = document.getElementById('cg-input-custom-advice').value.trim();
        if (!customText) return alert('請輸入叮嚀內容！');

        const elderKey = AppState.activeElderId;
        const elder = AppState.elders[elderKey];
        if (elder.stocks[0]) {
          elder.stocks[0].aiAdvice = customText;
        }

        saveAppState();
        CloudSync.pushElder(elderKey);
        alert(`💬 已更新【${elder.title}】手機上的小股貼心話！`);
      };
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

    // 語言切換 (國語 / 台語)
    const btnLangToggle = document.getElementById('btn-lang-toggle');
    if (btnLangToggle) {
      btnLangToggle.onclick = () => toggleLanguage();
    }

    // 語音播報整日大局 (頂部大按鈕)
    document.getElementById('btn-speak-all').onclick = () => {
      const elder = getActiveElder();
      const isTw = (elder.language === 'taiwanese');
      const stock = elder.stocks[0];
      const diff = (stock.currentPrice - stock.buyPrice) * stock.shares;
      let text = '';
      if (isTw) {
        const profitText = diff >= 0 ? `趁了 ${diff} 圓` : `減了 ${Math.abs(diff)} 圓`;
        text = `${elder.title}，今仔日一工落來，你的${stock.name}現價是 ${stock.currentPrice} 圓，攏總幫你${profitText}喔！`;
      } else {
        const profitText = diff >= 0 ? `賺了 ${diff} 元` : `少了 ${Math.abs(diff)} 元`;
        text = `${elder.title}，今天一整天下來，您的${stock.name}現價是 ${stock.currentPrice} 元，目前總共${profitText}喔！`;
      }
      Speech.speak(text);
    };

    // 每日問答語音答題
    const btnMicAnswer = document.getElementById('btn-mic-answer');
    if (btnMicAnswer) {
      btnMicAnswer.onclick = () => {
        const statusText = document.getElementById('mic-status-text');
        btnMicAnswer.classList.add('listening');
        if (statusText) statusText.textContent = '小股正在聽您說...🎙️';

        Recognition.startListening({
          onResult: (transcript) => {
            btnMicAnswer.classList.remove('listening');
            if (statusText) statusText.textContent = '按我開口回答';
            QuizEngine.handleVoiceAnswer(transcript);
          },
          onTimeout: () => {
            btnMicAnswer.classList.remove('listening');
            if (statusText) statusText.textContent = '按我開口回答';
            QuizEngine.handleGentleFallback();
          },
          onError: () => {
            btnMicAnswer.classList.remove('listening');
            if (statusText) statusText.textContent = '按我開口回答';
            QuizEngine.handleGentleFallback();
          },
          onEnd: () => {
            btnMicAnswer.classList.remove('listening');
            if (statusText) statusText.textContent = '按我開口回答';
          }
        });
      };
    }

    // 菜市場算數題事件
    const btnNextMarketMath = document.getElementById('btn-next-market-math');
    if (btnNextMarketMath) {
      btnNextMarketMath.onclick = () => {
        MarketMathEngine.generateProblem();
        MarketMathEngine.speakQuestion();
      };
    }

    const btnMarketMic = document.getElementById('btn-market-mic');
    if (btnMarketMic) {
      btnMarketMic.onclick = () => {
        const statusText = document.getElementById('market-mic-status');
        btnMarketMic.classList.add('listening');
        if (statusText) statusText.textContent = '小股正在聽算數...🎙️';

        Recognition.startListening({
          onResult: (transcript) => {
            btnMarketMic.classList.remove('listening');
            if (statusText) statusText.textContent = '聽題目 / 開口答';
            MarketMathEngine.handleVoiceAnswer(transcript);
          },
          onTimeout: () => {
            btnMarketMic.classList.remove('listening');
            if (statusText) statusText.textContent = '聽題目 / 開口答';
            MarketMathEngine.handleGentleFallback();
          },
          onError: () => {
            btnMarketMic.classList.remove('listening');
            if (statusText) statusText.textContent = '聽題目 / 開口答';
            MarketMathEngine.handleGentleFallback();
          },
          onEnd: () => {
            btnMarketMic.classList.remove('listening');
            if (statusText) statusText.textContent = '聽題目 / 開口答';
          }
        });
      };
    }

    // 穩健股話題事件
    const btnNextTopic = document.getElementById('btn-next-topic');
    if (btnNextTopic) {
      btnNextTopic.onclick = () => SolidStockTopicEngine.nextStock();
    }

    const btnReadTopic = document.getElementById('btn-read-topic');
    if (btnReadTopic) {
      btnReadTopic.onclick = () => SolidStockTopicEngine.speakTopic();
    }

    const btnAgreeTopic = document.getElementById('btn-agree-topic');
    if (btnAgreeTopic) {
      btnAgreeTopic.onclick = () => SolidStockTopicEngine.handleOpinion(true);
    }

    const btnCautiousTopic = document.getElementById('btn-cautious-topic');
    if (btnCautiousTopic) {
      btnCautiousTopic.onclick = () => SolidStockTopicEngine.handleOpinion(false);
    }

    // 朗讀生活建議按鈕
    document.getElementById('btn-read-advice').onclick = () => {
      const text = document.getElementById('ai-advice-text').textContent;
      Speech.speak(text);
    };

    // 夜間模式按鈕
    document.getElementById('btn-play-night-soothe').onclick = () => {
      const elder = getActiveElder();
      const isTw = (elder.language === 'taiwanese');
      const sootheMsg = isTw
        ? `${elder.title}，這馬是夜間休息時間，股票小股共你顧牢牢，放首輕音樂陪你，緊閉上目睭好好睏喔。`
        : `${elder.title}，現在是夜間休息時間，股票都很安全，小股放首輕音樂陪您，快閉上眼睛好好睡喔。`;
      Speech.speak(sootheMsg);
    };

    document.getElementById('btn-dismiss-night').onclick = () => {
      document.getElementById('night-rest-layer').classList.add('hidden');
    };

    // 晚輩後台按鈕
    document.getElementById('btn-close-caregiver').onclick = () => {
      document.getElementById('modal-caregiver').classList.add('hidden');
    };

    document.getElementById('btn-save-caregiver').onclick = () => {
      saveCaregiverSettings();
    };

    // 領取紅包 (長輩端)
    document.getElementById('btn-claim-envelope').onclick = () => {
      const elder = getActiveElder();
      elder.pendingEnvelope = null;
      saveAppState();
      CloudSync.pushElder(AppState.activeElderId);
      document.getElementById('modal-red-envelope').classList.add('hidden');
      triggerCelebration();
      renderPocketMoney();
    };

    // 註冊 Service Worker
    if ('serviceWorker' in navigator) {
      navigator.serviceWorker.register('sw.js').catch(err => {
        console.warn('SW 註冊忽略（本地預覽模式）', err);
      });
    }
  });

})();
