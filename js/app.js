/**
 * 小股同學 - 我的股票 (防失智長者股票認知訓練與資產關懷 PWA)
 * 核心業務與互動邏輯 (All-in-One Engine)
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
      nightModeEnabled: true
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
  // 2. 語音合成模組 (TTS - SpeechSynthesis)
  // ==========================================
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
      // 優先選取 zh-TW 台灣繁體中文自然語音庫
      this.currentVoice = voices.find(v => v.lang === 'zh-TW') ||
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

    init(onResultCallback, onTimeoutCallback) {
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
        updateMicUI(true);
        // 6 秒未辨識自動給予溫柔台階
        this.timer = setTimeout(() => {
          if (this.isListening) {
            this.stop();
            if (onTimeoutCallback) onTimeoutCallback();
          }
        }, 6000);
      };

      this.engine.onresult = (event) => {
        clearTimeout(this.timer);
        this.isListening = false;
        updateMicUI(false);
        const transcript = event.results[0][0].transcript;
        if (onResultCallback) onResultCallback(transcript);
      };

      this.engine.onerror = () => {
        clearTimeout(this.timer);
        this.isListening = false;
        updateMicUI(false);
        if (onTimeoutCallback) onTimeoutCallback();
      };

      this.engine.onend = () => {
        clearTimeout(this.timer);
        this.isListening = false;
        updateMicUI(false);
      };
    },

    start() {
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

  function updateMicUI(listening) {
    const btnMic = document.getElementById('btn-mic-answer');
    const statusText = document.getElementById('mic-status-text');
    if (!btnMic || !statusText) return;

    if (listening) {
      btnMic.classList.add('listening');
      statusText.textContent = '小股正在聽您說...🎙️';
    } else {
      btnMic.classList.remove('listening');
      statusText.textContent = '按我開口回答';
    }
  }

  // ==========================================
  // 4. 認知題庫與問答引擎 (Daily Brain Quiz)
  // ==========================================
  const QuizEngine = {
    currentQuiz: null,

    generateQuiz() {
      const stock = AppState.stocks[0] || { name: '台積電', buyPrice: 850, currentPrice: 980 };
      const isProfit = stock.currentPrice >= stock.buyPrice;

      const quizList = [
        // 題型 1：賺賠直覺二選一
        {
          type: 'profit_judgment',
          question: `${AppState.profile.title}，${stock.name}現在是 ${stock.currentPrice} 元，當初買 ${stock.buyPrice} 元，現在是賺錢還是少錢呢？`,
          voicePrompt: `${AppState.profile.title}，${stock.name}現在是 ${stock.currentPrice} 元，當初買 ${stock.buyPrice} 元，您覺得現在是賺錢還是少錢呢？`,
          correctKey: isProfit ? 'profit' : 'loss',
          options: [
            { text: '🌟 賺錢囉！', value: 'profit' },
            { text: '☕ 稍微少一點', value: 'loss' }
          ],
          gentleHint: isProfit ? '是賺錢喔！' : '目前稍微休息一下喔！'
        },
        // 題型 2：買價記憶題
        {
          type: 'buy_price_recall',
          question: `${AppState.profile.title}，您還記得這檔【${stock.name}】當初買多少錢嗎？`,
          voicePrompt: `${AppState.profile.title}，您還記得【${stock.name}】當初買多少錢嗎？`,
          correctKey: String(stock.buyPrice),
          options: [
            { text: `${stock.buyPrice - 50} 元`, value: String(stock.buyPrice - 50) },
            { text: `${stock.buyPrice} 元`, value: String(stock.buyPrice) },
            { text: `${stock.buyPrice + 50} 元`, value: String(stock.buyPrice + 50) }
          ],
          gentleHint: `當初是買 ${stock.buyPrice} 元喔！`
        },
        // 題型 3：產業常識題
        {
          type: 'industry_fact',
          question: `${AppState.profile.title}，請問【中華電信】主要是提供什麼服務呢？`,
          voicePrompt: `${AppState.profile.title}，請問中華電信主要是提供什麼服務呢？電話網路還是賣餅乾呢？`,
          correctKey: 'telecom',
          options: [
            { text: '📞 電話與網路', value: 'telecom' },
            { text: '🍪 烘焙賣餅乾', value: 'cookie' }
          ],
          gentleHint: '是打電話與網路服務喔！'
        }
      ];

      // 隨機選一題
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
      feedbackBox.classList.add('hidden');
      optContainer.innerHTML = '';

      this.currentQuiz.options.forEach(opt => {
        const btn = document.createElement('button');
        btn.className = 'btn-quiz-option';
        btn.textContent = opt.text;
        btn.onclick = () => this.handleAnswer(opt.value);
        optContainer.appendChild(btn);
      });
    },

    // 模糊語音匹配
    handleVoiceAnswer(transcript) {
      const text = transcript.trim();
      const quiz = this.currentQuiz;

      let answer = null;
      if (quiz.type === 'profit_judgment') {
        if (/賺|多|好|漲|高|加/.test(text)) answer = 'profit';
        else if (/賠|少|跌|低|拉回/.test(text)) answer = 'loss';
      } else if (quiz.type === 'buy_price_recall') {
        const matched = text.match(/\d+/);
        if (matched) answer = matched[0];
      } else if (quiz.type === 'industry_fact') {
        if (/電話|網路|通訊|手機/.test(text)) answer = 'telecom';
      }

      if (/不知道|忘記|忘了|記不得/.test(text)) {
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

      if (isCorrect) {
        AppState.gameStats.medals += 1;
        AppState.gameStats.todayAnswered = true;
        saveAppState();
        updateHeaderAndBadges();
        triggerCelebration();
        Speech.speak(`哇！答對了！${AppState.profile.title}記性真棒，送您一枚大金牌！`);
      } else {
        this.handleGentleFallback();
      }
    },

    handleGentleFallback() {
      const feedbackBox = document.getElementById('quiz-feedback');
      const feedbackText = document.getElementById('quiz-feedback-text');
      feedbackBox.classList.remove('hidden');
      feedbackText.textContent = `💡 小股小貼士：${this.currentQuiz.gentleHint} 我們一樣好棒！`;

      Speech.speak(`沒關係沒關係！小股幫您記著呢，${this.currentQuiz.gentleHint} 我們一起繼續加油！`);
    }
  };

  // ==========================================
  // 5. 連續點擊 10 下防誤觸解鎖 (10-Click Unlock)
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
  // 6. UI 渲染與互動邏輯
  // ==========================================
  function renderAll() {
    updateHeaderAndBadges();
    renderStocksList();
    renderAiAdvice();
    renderPocketMoney();
    QuizEngine.generateQuiz();
    checkNightMode();
  }

  function updateHeaderAndBadges() {
    const greetingEl = document.getElementById('user-greeting');
    const subGreetingEl = document.getElementById('sub-greeting');
    const modeBadgeEl = document.getElementById('current-mode-badge');
    const streakBadgeEl = document.getElementById('streak-badge');
    const medalCountEl = document.getElementById('medal-count');

    const hour = new Date().getHours();
    let timeGreeting = '早安';
    if (hour >= 12 && hour < 18) timeGreeting = '午安';
    else if (hour >= 18) timeGreeting = '晚安';

    if (greetingEl) greetingEl.textContent = `${AppState.profile.title}，${timeGreeting}！`;
    if (subGreetingEl) subGreetingEl.textContent = '小股陪您看股票、動動腦';

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

    // 綁定防手震目標價調整
    bindTargetAdjustButtons();
  }

  let lastAdjustTime = 0;
  function bindTargetAdjustButtons() {
    document.querySelectorAll('.btn-adjust').forEach(btn => {
      btn.onclick = (e) => {
        const now = Date.now();
        if (now - lastAdjustTime < 300) return; // 300ms 防手震防抖
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
        Speech.speak(`已幫您將${stock.name}目標價調整為 ${stock.targetPrice} 元囉！`);
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
  // 7. 夜間沉睡模式 (Sundowning Mode)
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
      nightLayer.classList.remove('hidden');
    } else {
      nightLayer.classList.add('hidden');
    }
  }

  // ==========================================
  // 8. 答對慶祝動效 (Confetti & Medal)
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
  // 9. 晚輩控制台 (Caregiver Panel)
  // ==========================================
  function openCaregiverModal() {
    const modal = document.getElementById('modal-caregiver');
    if (!modal) return;

    // 填入既有數值
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

    // 讀取股票編輯內容
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
  // 10. 事件綁定與初始化
  // ==========================================
  document.addEventListener('DOMContentLoaded', () => {
    Speech.init();
    Recognition.init(
      (transcript) => QuizEngine.handleVoiceAnswer(transcript),
      () => QuizEngine.handleGentleFallback()
    );

    initTenClickUnlock();
    renderAll();

    // 語音播報全部
    document.getElementById('btn-speak-all').onclick = () => {
      const stock = AppState.stocks[0];
      const diff = (stock.currentPrice - stock.buyPrice) * stock.shares;
      const profitText = diff >= 0 ? `賺了 ${diff} 元` : `少了 ${Math.abs(diff)} 元`;
      const text = `${AppState.profile.title}，今天您的${stock.name}現價是 ${stock.currentPrice} 元，目前${profitText}喔！`;
      Speech.speak(text);
    };

    // 語音聆聽按鈕
    document.getElementById('btn-mic-answer').onclick = () => {
      Recognition.start();
    };

    // 朗讀建議按鈕
    document.getElementById('btn-read-advice').onclick = () => {
      const text = document.getElementById('ai-advice-text').textContent;
      Speech.speak(text);
    };

    // 夜間模式按鈕
    document.getElementById('btn-play-night-soothe').onclick = () => {
      Speech.speak(`${AppState.profile.title}，現在是夜間休息時間，股票都很安全，小股放首輕音樂陪您，快閉上眼睛好好睡喔。`);
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

      // 關閉後台並跳出長輩端紅包彈窗
      document.getElementById('modal-caregiver').classList.add('hidden');
      renderPocketMoney();

      // 顯示紅包彈窗
      document.getElementById('envelope-amount').textContent = `+ $${amount.toLocaleString()} 元`;
      document.getElementById('envelope-note').textContent = `「${note}」`;
      document.getElementById('modal-red-envelope').classList.remove('hidden');
      Speech.speak(`恭喜！收到${AppState.profile.contactName}送來的紅包 ${amount} 元囉！`);
    };

    // 領取紅包
    document.getElementById('btn-claim-envelope').onclick = () => {
      document.getElementById('modal-red-envelope').classList.add('hidden');
      triggerCelebration();
    };

    // ==========================================
    // 11. PWA 安裝提示機制 (Android / iOS)
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

    // Android / 支援 beforeinstallprompt 的瀏覽器
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

    // 右下角懸浮按鈕點擊
    if (btnFloatingInstall) {
      // 若是 iOS 且尚未加入桌面，常態顯示懸浮按鈕
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
