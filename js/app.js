/**
 * 小股同學 - 我的股票 (防失智長者股票認知訓練與資產關懷 PWA)
 * 核心業務與互動邏輯 (All-in-One Engine v1.05)
 */

(function () {
  'use strict';

  // ==========================================
  // 1. 預設資料與狀態管理 (AppState & LocalStorage)
  // ==========================================
  const STORAGE_KEY = 'xiaogu_stocks_app_data';

  const defaultData = {
    deviceRole: 'senior', // 'senior' (長輩端) | 'caregiver' (晚輩端)
    profile: {
      elderPhone: '0912345678',
      title: '伯伯',
      mode: 'family', // 'family' (晚輩陪伴) | 'simulation' (模擬100萬) | 'self' (獨立營業員)
      contactName: '小明 (兒子)',
      contactPhone: '0987654321',
      voiceRate: 0.85,
      nightModeEnabled: true,
      language: 'zh-TW' // 'zh-TW' (國語) | 'taiwanese' (台語)
    },
    stocks: [
      {
        id: '2330',
        name: '台積電',
        buyPrice: 850,
        shares: 1000,
        currentPrice: 980,
        targetPrice: 1000,
        marketTrend: '強勢上漲',
        newsSentiment: '正面',
        aiAdvice: '伯伯，台積電這幾天表現很亮眼，離您設定的目標價很近了喔！'
      },
      {
        id: '2412',
        name: '中華電',
        buyPrice: 120,
        shares: 3000,
        currentPrice: 125,
        targetPrice: 130,
        marketTrend: '盤整平穩',
        newsSentiment: '平淡',
        aiAdvice: '伯伯，中華電信走勢很穩健，領股息安心過日子最棒了！'
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
    }
  };

  let AppState = loadAppState();

  function loadAppState() {
    try {
      const saved = localStorage.getItem(STORAGE_KEY);
      if (saved) {
        return Object.assign({}, defaultData, JSON.parse(saved));
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

  // ==========================================
  // 2. 台語 / 國語雙聲道詞庫與語音合成 (TTS Engine)
  // ==========================================
  const BilingualDict = {
    // 依時段問候
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
    // 答對讚美
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
    // 溫柔容錯台階
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
      // 優先選取 zh-TW 台灣繁體中文/台語語音
      this.currentVoice = voices.find(v => v.lang === 'zh-TW') ||
                          voices.find(v => v.lang.includes('zh') && v.name.includes('Taiwan')) ||
                          voices.find(v => v.lang.includes('zh')) || null;
    },

    speak(text, onEnd) {
      if (!this.synthesizer) return;
      this.synthesizer.cancel(); // 停止先前的朗讀

      const utterance = new SpeechSynthesisUtterance(text);
      if (this.currentVoice) utterance.voice = this.currentVoice;
      utterance.rate = AppState.profile.voiceRate || 0.85; // 慢速清晰
      utterance.pitch = 1.05;

      if (onEnd) utterance.onend = onEnd;
      this.synthesizer.speak(utterance);
    },

    stop() {
      if (this.synthesizer) this.synthesizer.cancel();
    }
  };

  // ==========================================
  // 3. 語音辨識模組 (ASR - webkitSpeechRecognition)
  // ==========================================
  const Recognition = {
    engine: null,
    isListening: false,
    timer: null,
    currentHandler: null,

    init() {
      const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition || null;
      if (!SpeechRecognition) {
        console.warn('此瀏覽器未支援 SpeechRecognition，採用卡片點選雙軌降級');
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
  // 4. 每日大腦認知問答引擎 (Daily Brain Quiz)
  // ==========================================
  const QuizEngine = {
    currentQuiz: null,

    generateQuiz() {
      const stock = AppState.stocks[0] || { name: '台積電', buyPrice: 850, currentPrice: 980 };
      const isProfit = stock.currentPrice >= stock.buyPrice;
      const isTw = (AppState.profile.language === 'taiwanese');

      const quizList = [
        // 題型 1：賺賠直覺二選一
        {
          type: 'profit_judgment',
          question: isTw
            ? `${AppState.profile.title}，${stock.name}這馬是 ${stock.currentPrice} 元，當初買 ${stock.buyPrice} 元，是趁錢還是減錢呢？`
            : `${AppState.profile.title}，${stock.name}現在是 ${stock.currentPrice} 元，當初買 ${stock.buyPrice} 元，現在是賺錢還是少錢呢？`,
          voicePrompt: isTw
            ? `${AppState.profile.title}，${stock.name}這馬是 ${stock.currentPrice} 元，當初買 ${stock.buyPrice} 元，你感覺是趁錢還是減錢呢？`
            : `${AppState.profile.title}，${stock.name}現在是 ${stock.currentPrice} 元，當初買 ${stock.buyPrice} 元，您覺得現在是賺錢還是少錢呢？`,
          correctKey: isProfit ? 'profit' : 'loss',
          options: [
            { text: isTw ? '🌟 趁錢囉！（賺錢）' : '🌟 賺錢囉！', value: 'profit' },
            { text: isTw ? '☕ 稍微減一點（少錢）' : '☕ 稍微少一點', value: 'loss' }
          ],
          gentleHint: isProfit ? (isTw ? '是趁錢喔！' : '是賺錢喔！') : (isTw ? '這馬稍微歇睏一下喔！' : '目前稍微休息一下喔！')
        },
        // 題型 2：買價記憶題
        {
          type: 'buy_price_recall',
          question: isTw
            ? `${AppState.profile.title}，你甘記得【${stock.name}】當初買幾圓？`
            : `${AppState.profile.title}，您還記得這檔【${stock.name}】當初買多少錢嗎？`,
          voicePrompt: isTw
            ? `${AppState.profile.title}，你甘記得【${stock.name}】當初買幾圓嗎？`
            : `${AppState.profile.title}，您還記得【${stock.name}】當初買多少錢嗎？`,
          correctKey: String(stock.buyPrice),
          options: [
            { text: `${stock.buyPrice - 50} 元`, value: String(stock.buyPrice - 50) },
            { text: `${stock.buyPrice} 元`, value: String(stock.buyPrice) },
            { text: `${stock.buyPrice + 50} 元`, value: String(stock.buyPrice + 50) }
          ],
          gentleHint: isTw ? `當初是買 ${stock.buyPrice} 圓喔！` : `當初是買 ${stock.buyPrice} 元喔！`
        },
        // 題型 3：產業常識題
        {
          type: 'industry_fact',
          question: isTw
            ? `${AppState.profile.title}，請問【中華電信】主要是做啥米服務呢？`
            : `${AppState.profile.title}，請問【中華電信】主要是提供什麼服務呢？`,
          voicePrompt: isTw
            ? `${AppState.profile.title}，請問中華電信主要是做啥米服務？講電話牽網路、還是做餅乾？`
            : `${AppState.profile.title}，請問中華電信主要是提供什麼服務呢？電話網路還是賣餅乾呢？`,
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
      const isTw = (AppState.profile.language === 'taiwanese');

      if (isCorrect) {
        AppState.gameStats.medals += 1;
        AppState.gameStats.todayAnswered = true;
        saveAppState();
        updateHeaderAndBadges();
        triggerCelebration();
        Speech.speak(BilingualDict.getCorrectPraise(AppState.profile.title, isTw));
      } else {
        this.handleGentleFallback();
      }
    },

    handleGentleFallback() {
      const isTw = (AppState.profile.language === 'taiwanese');
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
  // 5. 🥦 菜市場生活趣味算數引擎 (Market Math Engine)
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
      const isTw = (AppState.profile.language === 'taiwanese');
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
      const isTw = (AppState.profile.language === 'taiwanese');
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
      const isTw = (AppState.profile.language === 'taiwanese');

      if (isCorrect) {
        AppState.gameStats.medals += 1;
        saveAppState();
        updateHeaderAndBadges();
        triggerCelebration();
        Speech.speak(BilingualDict.getCorrectPraise(AppState.profile.title, isTw));
      } else {
        this.handleGentleFallback();
      }
    },

    handleGentleFallback() {
      const isTw = (AppState.profile.language === 'taiwanese');
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
  // 6. 中長期穩健股話題與向長輩請教引擎 (Solid Stock Topic Engine)
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
      const isTw = (AppState.profile.language === 'taiwanese');

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
      const formattedSpeech = speechTemplate.replace('${title}', AppState.profile.title);

      if (speechEl) speechEl.textContent = formattedSpeech;
      if (feedbackBox) feedbackBox.classList.add('hidden');
    },

    speakTopic() {
      const stock = this.stocksData[this.currentIndex];
      const isTw = (AppState.profile.language === 'taiwanese');
      const speechTemplate = isTw ? stock.speechTw : stock.speechZh;
      const formattedSpeech = speechTemplate.replace('${title}', AppState.profile.title);
      Speech.speak(formattedSpeech);
    },

    handleOpinion(agree) {
      const stock = this.stocksData[this.currentIndex];
      const isTw = (AppState.profile.language === 'taiwanese');
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
  // 7. 連續點擊 10 下防誤觸解鎖 (10-Click Unlock)
  // ==========================================
  let clickCount = 0;
  let clickTimer = null;

  function initTenClickUnlock() {
    const btnUnlock = document.getElementById('btn-unlock-caregiver');
    if (!btnUnlock) return;

    btnUnlock.onclick = () => {
      clickCount++;

      // 手機震動微反饋 (若裝置支援)
      if (navigator.vibrate && clickCount >= 6) {
        navigator.vibrate(50);
      }

      clearTimeout(clickTimer);
      clickTimer = setTimeout(() => {
        clickCount = 0; // 超過 3.5 秒未連續點擊，計數歸零
      }, 3500);

      if (clickCount >= 10) {
        clickCount = 0;
        clearTimeout(clickTimer);
        openCaregiverModal();
      }
    };
  }

  // ==========================================
  // 8. UI 渲染與互動邏輯
  // ==========================================
  function renderAll() {
    updateLanguageUI();
    updateHeaderAndBadges();
    renderStocksList();
    renderAiAdvice();
    renderPocketMoney();
    QuizEngine.generateQuiz();
    MarketMathEngine.generateProblem();
    SolidStockTopicEngine.render();
    checkNightMode();
  }

  function updateLanguageUI() {
    const isTw = (AppState.profile.language === 'taiwanese');
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
    const current = AppState.profile.language || 'zh-TW';
    AppState.profile.language = (current === 'zh-TW') ? 'taiwanese' : 'zh-TW';
    saveAppState();

    const isTw = (AppState.profile.language === 'taiwanese');
    updateLanguageUI();
    updateHeaderAndBadges();
    QuizEngine.render();
    MarketMathEngine.render();
    SolidStockTopicEngine.render();

    const prompt = isTw
      ? '切換為台語模式囉！小股用台語陪你開講！'
      : '切換為國語模式囉！小股陪您看股票、動動腦！';
    Speech.speak(prompt);
  }

  function updateHeaderAndBadges() {
    const isTw = (AppState.profile.language === 'taiwanese');
    const greetingEl = document.getElementById('user-greeting');
    const subGreetingEl = document.getElementById('sub-greeting');
    const modeBadgeEl = document.getElementById('current-mode-badge');
    const streakBadgeEl = document.getElementById('streak-badge');
    const medalCountEl = document.getElementById('medal-count');

    const greetingObj = BilingualDict.getGreeting(AppState.profile.title, isTw);

    if (greetingEl) greetingEl.textContent = greetingObj.text;
    if (subGreetingEl) subGreetingEl.textContent = isTw ? '小股陪你看股票、動動腦' : '小股陪您看股票、動動腦';

    if (modeBadgeEl) {
      if (AppState.profile.mode === 'family') modeBadgeEl.textContent = '🏠 晚輩陪伴模式';
      else if (AppState.profile.mode === 'simulation') modeBadgeEl.textContent = '🎮 模擬大亨遊戲模式';
      else modeBadgeEl.textContent = '👴 獨立看盤模式';
    }

    if (streakBadgeEl) streakBadgeEl.textContent = `⭐ 大腦打卡 ${AppState.gameStats.streak} 天`;
    if (medalCountEl) medalCountEl.textContent = `🏅 x ${AppState.gameStats.medals} 枚`;
  }

  function renderStocksList() {
    const listEl = document.getElementById('stocks-list');
    if (!listEl) return;
    listEl.innerHTML = '';

    AppState.stocks.forEach((stock, index) => {
      const isProfit = stock.currentPrice >= stock.buyPrice;
      const profitDiff = (stock.currentPrice - stock.buyPrice) * stock.shares;
      const reachTarget = stock.currentPrice >= stock.targetPrice;

      const card = document.createElement('div');
      card.className = `stock-card ${isProfit ? 'glow-profit' : 'glow-loss'}`;

      card.innerHTML = `
        <div class="stock-header">
          <div>
            <span class="stock-name">${stock.name}</span>
            <span class="stock-code">${stock.id}</span>
          </div>
          <span class="profit-label ${isProfit ? 'profit' : 'loss'}">
            ${isProfit ? `▲ 賺 $${profitDiff.toLocaleString()} 元` : `▼ 少 $${Math.abs(profitDiff).toLocaleString()} 元`}
          </span>
        </div>

        <div class="price-display-row">
          <span class="price-title">目前現價</span>
          <span class="price-huge">$${stock.currentPrice}</span>
          <span class="price-unit">元</span>
        </div>

        <div class="stock-detail-row">
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
          <button class="btn-call-action" onclick="window.location.href='tel:${AppState.profile.contactPhone}'">
            📞 撥打給${AppState.profile.contactName}（已達目標價！）
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

        const idx = parseInt(btn.dataset.index);
        const action = btn.dataset.action;
        const stock = AppState.stocks[idx];

        if (action === 'plus') {
          stock.targetPrice += 5;
        } else if (action === 'minus' && stock.targetPrice > 5) {
          stock.targetPrice -= 5;
        }

        saveAppState();
        renderStocksList();
        const isTw = (AppState.profile.language === 'taiwanese');
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
    const stock = AppState.stocks[0];
    if (stock && stock.aiAdvice) {
      textEl.textContent = `「${stock.aiAdvice}」`;
    }
  }

  function renderPocketMoney() {
    const balEl = document.getElementById('pocket-balance');
    if (balEl) {
      balEl.textContent = `$${AppState.pocketMoney.balance.toLocaleString()} 元`;
    }
  }

  // ==========================================
  // 9. 夜間沉睡模式 (Sundowning Mode)
  // ==========================================
  function checkNightMode() {
    const hour = new Date().getHours();
    const minute = new Date().getMinutes();
    const isNight = (hour >= 21 || hour < 9);
    const nightLayer = document.getElementById('night-rest-layer');
    const clockEl = document.getElementById('night-clock');

    if (clockEl) {
      clockEl.textContent = `${String(hour).padStart(2, '0')}:${String(minute).padStart(2, '0')}`;
    }

    if (AppState.profile.nightModeEnabled && isNight) {
      if (nightLayer) nightLayer.classList.remove('hidden');
    } else {
      if (nightLayer) nightLayer.classList.add('hidden');
    }
  }

  // ==========================================
  // 10. 答對慶祝動效 (Confetti & Medal)
  // ==========================================
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
  // 11. 晚輩控制台 (Caregiver Panel)
  // ==========================================
  function openCaregiverModal() {
    const modal = document.getElementById('modal-caregiver');
    if (!modal) return;

    document.getElementById('setting-app-mode').value = AppState.profile.mode;
    document.getElementById('setting-elder-phone').value = AppState.profile.elderPhone;
    document.getElementById('setting-elder-title').value = AppState.profile.title;
    document.getElementById('setting-contact-name').value = AppState.profile.contactName;
    document.getElementById('setting-contact-phone').value = AppState.profile.contactPhone;

    renderCaregiverStocksEditor();
    modal.classList.remove('hidden');
  }

  function renderCaregiverStocksEditor() {
    const editorList = document.getElementById('caregiver-stocks-editor');
    if (!editorList) return;
    editorList.innerHTML = '';

    AppState.stocks.forEach((stock, idx) => {
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
    AppState.profile.mode = document.getElementById('setting-app-mode').value;
    AppState.profile.elderPhone = document.getElementById('setting-elder-phone').value;
    AppState.profile.title = document.getElementById('setting-elder-title').value;
    AppState.profile.contactName = document.getElementById('setting-contact-name').value;
    AppState.profile.contactPhone = document.getElementById('setting-contact-phone').value;

    const names = document.querySelectorAll('.stock-edit-name');
    const ids = document.querySelectorAll('.stock-edit-id');
    const buys = document.querySelectorAll('.stock-edit-buy');
    const shares = document.querySelectorAll('.stock-edit-shares');
    const currents = document.querySelectorAll('.stock-edit-current');

    names.forEach((el, i) => {
      if (AppState.stocks[i]) {
        AppState.stocks[i].name = el.value || AppState.stocks[i].name;
        AppState.stocks[i].id = ids[i].value || AppState.stocks[i].id;
        AppState.stocks[i].buyPrice = parseFloat(buys[i].value) || AppState.stocks[i].buyPrice;
        AppState.stocks[i].shares = parseInt(shares[i].value) || AppState.stocks[i].shares;
        AppState.stocks[i].currentPrice = parseFloat(currents[i].value) || AppState.stocks[i].currentPrice;
      }
    });

    saveAppState();
    document.getElementById('modal-caregiver').classList.add('hidden');
    renderAll();
    alert('✅ 設定已儲存成功！');
  }

  // ==========================================
  // 12. 事件綁定與初始化
  // ==========================================
  document.addEventListener('DOMContentLoaded', () => {
    Speech.init();
    Recognition.init();
    initTenClickUnlock();
    renderAll();

    // 語言切換 (國語 / 台語)
    const btnLangToggle = document.getElementById('btn-lang-toggle');
    if (btnLangToggle) {
      btnLangToggle.onclick = () => toggleLanguage();
    }

    // 語音播報全部 (頂部大按鈕)
    document.getElementById('btn-speak-all').onclick = () => {
      const isTw = (AppState.profile.language === 'taiwanese');
      const stock = AppState.stocks[0];
      const diff = (stock.currentPrice - stock.buyPrice) * stock.shares;
      let text = '';
      if (isTw) {
        const profitText = diff >= 0 ? `趁了 ${diff} 圓` : `減了 ${Math.abs(diff)} 圓`;
        text = `${AppState.profile.title}，今仔日你的${stock.name}現價是 ${stock.currentPrice} 圓，這馬${profitText}喔！`;
      } else {
        const profitText = diff >= 0 ? `賺了 ${diff} 元` : `少了 ${Math.abs(diff)} 元`;
        text = `${AppState.profile.title}，今天您的${stock.name}現價是 ${stock.currentPrice} 元，目前${profitText}喔！`;
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
      const isTw = (AppState.profile.language === 'taiwanese');
      const sootheMsg = isTw
        ? `${AppState.profile.title}，這馬是夜間休息時間，股票小股共你顧牢牢，放首輕音樂陪你，緊閉上目睭好好睏喔。`
        : `${AppState.profile.title}，現在是夜間休息時間，股票都很安全，小股放首輕音樂陪您，快閉上眼睛好好睡喔。`;
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

    // 晚輩發送紅包
    document.getElementById('btn-send-bonus').onclick = () => {
      const amount = parseInt(document.getElementById('input-bonus-amount').value) || 5000;
      const note = document.getElementById('input-bonus-note').value || '孝親補貼';
      
      AppState.pocketMoney.balance += amount;
      AppState.pocketMoney.history.unshift({
        date: new Date().toLocaleDateString('zh-TW'),
        sender: AppState.profile.contactName,
        amount: amount,
        note: note
      });
      saveAppState();

      document.getElementById('modal-caregiver').classList.add('hidden');
      renderPocketMoney();

      document.getElementById('envelope-amount').textContent = `+ $${amount.toLocaleString()} 元`;
      document.getElementById('envelope-note').textContent = `「${note}」`;
      document.getElementById('modal-red-envelope').classList.remove('hidden');
      
      const isTw = (AppState.profile.language === 'taiwanese');
      const bonusSpeech = isTw
        ? `恭喜！收到${AppState.profile.contactName}送來的紅包 ${amount} 圓囉！`
        : `恭喜！收到${AppState.profile.contactName}送來的紅包 ${amount} 元囉！`;
      Speech.speak(bonusSpeech);
    };

    // 領取紅包
    document.getElementById('btn-claim-envelope').onclick = () => {
      document.getElementById('modal-red-envelope').classList.add('hidden');
      triggerCelebration();
    };

    // ==========================================
    // 13. PWA 安裝提示機制 (Android / iOS)
    // ==========================================
    let deferredPrompt = null;
    const isIOS = /iPad|iPhone|iPod/.test(navigator.userAgent) && !window.MSStream;
    const isStandalone = window.matchMedia('(display-mode: standalone)').matches || window.navigator.standalone;

    const banner = document.getElementById('androidInstallBanner');
    const btnBannerInstall = document.getElementById('btn-banner-install');
    const btnBannerDismiss = document.getElementById('btn-banner-dismiss');
    const btnFloatingInstall = document.getElementById('btn-floating-install');
    const iosModal = document.getElementById('iosInstallModal');
    const btnCloseIosModal = document.getElementById('btn-close-ios-modal');

    window.addEventListener('beforeinstallprompt', (e) => {
      e.preventDefault();
      deferredPrompt = e;
      if (!isStandalone) {
        if (banner) banner.classList.remove('hidden');
        if (btnFloatingInstall) btnFloatingInstall.classList.remove('hidden');
      }
    });

    if (btnBannerInstall) {
      btnBannerInstall.onclick = async () => {
        if (deferredPrompt) {
          deferredPrompt.prompt();
          const { outcome } = await deferredPrompt.userChoice;
          if (outcome === 'accepted') {
            if (banner) banner.classList.add('hidden');
            if (btnFloatingInstall) btnFloatingInstall.classList.add('hidden');
          }
          deferredPrompt = null;
        }
      };
    }

    if (btnBannerDismiss) {
      btnBannerDismiss.onclick = () => {
        if (banner) banner.classList.add('hidden');
      };
    }

    if (btnFloatingInstall) {
      if (isIOS && !isStandalone) {
        btnFloatingInstall.classList.remove('hidden');
      }

      btnFloatingInstall.onclick = () => {
        if (deferredPrompt) {
          btnBannerInstall.click();
        } else if (isIOS) {
          if (iosModal) iosModal.classList.remove('hidden');
        } else {
          alert('請點擊瀏覽器右上角選單（三個點）➔ 選擇「加到主螢幕」即可安裝！');
        }
      };
    }

    if (btnCloseIosModal) {
      btnCloseIosModal.onclick = () => {
        if (iosModal) iosModal.classList.add('hidden');
      };
    }

    // 註冊 Service Worker (PWA)
    if ('serviceWorker' in navigator) {
      navigator.serviceWorker.register('sw.js').catch(err => {
        console.warn('SW 註冊忽略（本地預覽模式）', err);
      });
    }
  });

})();
