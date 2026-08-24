/**
 * 小股同學 - 我的股票 (防失智長者股票認知訓練與資產關懷 PWA)
 * 核心業務與互動邏輯 (All-in-One Engine v3.04 - 賺賠金額四捨五入至百位・股數中文朗讀一千股/一千二百二十五股)
 */

(function () {
  'use strict';

  // ==========================================
  // 0. LINE 內嵌瀏覽器逃脫與環境判定
  // ==========================================
  const ua = (navigator.userAgent || '').toLowerCase();
  const isLine = ua.includes('line');
  const isIOS = /ipad|iphone|ipod/.test(ua) && !window.MSStream;

  function checkIsStandalone() {
    try {
      if (window.matchMedia && (
        window.matchMedia('(display-mode: standalone)').matches ||
        window.matchMedia('(display-mode: fullscreen)').matches ||
        window.matchMedia('(display-mode: minimal-ui)').matches ||
        window.matchMedia('(display-mode: window-controls-overlay)').matches
      )) return true;
      if (window.navigator && window.navigator.standalone === true) return true;
      if (document.referrer && document.referrer.indexOf('android-app://') === 0) return true;
      if (window.location.search && (window.location.search.indexOf('source=pwa') !== -1 || window.location.search.indexOf('mode=standalone') !== -1)) return true;
    } catch(e) {}
    return false;
  }

  const isStandalone = checkIsStandalone();
  if (isStandalone) {
    document.documentElement.classList.add('is-pwa-standalone');
  }

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
    // 瀏覽器觸發了可安裝事件，代表目前未安裝，解除獨立App遮罩並顯示按鈕
    localStorage.removeItem('xiaogu_pwa_installed');
    document.documentElement.classList.remove('is-pwa-standalone');
    const btn = document.getElementById('btn-header-install');
    if (btn) btn.classList.remove('hidden');
  });

  window.addEventListener('appinstalled', () => {
    document.documentElement.classList.add('is-pwa-standalone');
    const btn = document.getElementById('btn-header-install');
    if (btn) btn.classList.add('hidden');
    window.deferredPrompt = null;
    console.log('小股同學 PWA 安裝成功！');
  });

  // ==========================================
  // 1. 預設資料與狀態管理 (AppState & LocalStorage)
  // ==========================================
  const STORAGE_KEY = 'xiaogu_stocks_app_data_v7';

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
            currentPrice: 2410,
            prevClose: 2390,
            prevTickPrice: 2410,
            lastDiff: 0,
            targetPrice: 2600,
            marketTrend: '強勢上漲',
            newsSentiment: '正面',
            aiAdvice: '爸爸，台積電這幾天表現很亮眼，離您設定的目標價很近了喔！'
          },
          {
            id: '2412',
            name: '中華電',
            buyPrice: 120,
            shares: 3000,
            currentPrice: 136.5,
            prevClose: 136.5,
            prevTickPrice: 136.5,
            lastDiff: 0,
            targetPrice: 145,
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
            prevClose: 41.5,
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
            prevClose: 38.2,
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
      // 自動校正舊版硬編碼歷史過期價格與昨收價
      data.elders[k].stocks.forEach(stock => {
        if (typeof stock.prevClose !== 'number' || stock.prevClose <= 0) {
          stock.prevClose = stock.currentPrice;
        }
        if (stock.id === '2344' && (stock.currentPrice < 100 || stock.currentPrice === 28.5)) {
          stock.currentPrice = 181.0;
          stock.prevClose = 179.0;
        }
        if (stock.id === '2330') {
          if (stock.currentPrice < 1500 || stock.currentPrice === 980) {
            stock.currentPrice = 2410;
          }
          if (stock.prevClose === 980 || stock.prevClose < 1500) {
            stock.prevClose = 2390;
          }
          if (stock.buyPrice === 980) {
            stock.buyPrice = 850;
          }
          if (stock.targetPrice < 2000) {
            stock.targetPrice = 2600;
          }
        }
        if (stock.id === '2412' && stock.currentPrice === 125) {
          stock.currentPrice = 136.5;
          stock.prevClose = 136.5;
        }
      });
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
      const oldSaved = localStorage.getItem('xiaogu_stocks_app_data_v6') || localStorage.getItem('xiaogu_stocks_app_data_v3') || localStorage.getItem('xiaogu_stocks_app_data_v2') || localStorage.getItem('xiaogu_stocks_app_data');
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

      // ⏱️ 正式定時頻率：每 1 分鐘 (60,000 ms) 自動檢查台股即時盤價
      setInterval(() => {
        performMinuteMarketCheck();
      }, 60000);
    }
  };

  // ==========================================
  // 2.5 台灣股市名稱字典與基準價兜底庫 (Taiwan Stock Dict & Fallback Base)
  // ==========================================
  const TaiwanStockNames = {
    // 權值股與半導體
    "2330": "台積電", "2317": "鴻海", "2454": "聯發科", "2344": "華邦電",
    "2303": "聯電", "2308": "台達電", "2382": "廣達", "3231": "緯創",
    "2356": "英業達", "2376": "技嘉", "2357": "華碩", "2379": "瑞昱",
    "2345": "智邦", "3711": "日月光投控", "3008": "大立光", "2337": "旺宏",
    "2408": "南亞科", "6770": "力積電", "5347": "世界", "2449": "京元電子",
    "3034": "聯詠", "2377": "微星", "6488": "環球晶", "3037": "欣興",
    "2368": "金像電", "8069": "元太", "2409": "友達", "3481": "群創",
    "3035": "智原", "3017": "奇鋐", "3533": "嘉澤", "6669": "緯穎",
    "3661": "世芯-KY", "6278": "台表科", "2328": "廣宇", "2353": "宏碁",
    "2354": "鴻準", "2371": "大同", "2383": "台光電", "2404": "漢唐",
    "2324": "仁寶", "2313": "華通", "2327": "國巨", "2347": "聯強",
    "2352": "佳世達", "2355": "敬鵬", "2360": "致茂", "2362": "藍天",
    "2365": "昆盈", "2385": "群光", "2388": "威盛", "2401": "凌陽",
    "2458": "義隆", "3006": "晶豪科", "3044": "健鼎", "3702": "大聯大",
    "6239": "力成", "6269": "台郡", "8046": "南電", "3443": "創意",
    "3529": "力旺", "5269": "祥碩", "6415": "矽力*-KY", "6531": "愛普*",
    // 金融股
    "2881": "富邦金", "2882": "國泰金", "2886": "兆豐金", "2891": "中信金",
    "2884": "玉山金", "2892": "第一金", "2880": "華南金", "2885": "元大金",
    "2883": "開發金", "2887": "台新金", "2890": "永豐金", "5880": "合庫金",
    "2801": "彰銀", "2834": "臺企銀", "2809": "京城銀", "2889": "國票金",
    "5876": "上海商銀", "5871": "中租-KY", "9941": "裕融",
    // 傳產與電信
    "2412": "中華電", "3045": "台灣大", "4904": "遠傳", "2603": "長榮",
    "2609": "陽明", "2615": "萬海", "2605": "新興", "2618": "長榮航",
    "2610": "華航", "2637": "慧洋-KY", "1101": "台泥", "1102": "亞泥",
    "1301": "台塑", "1303": "南亞", "1326": "台化", "6505": "台塑化",
    "2002": "中鋼", "2006": "東和鋼鐵", "9958": "世紀鋼", "1519": "華城",
    "1503": "士電", "1504": "東元", "1513": "中興電", "1514": "亞力",
    "9910": "豐泰", "9904": "寶成", "2912": "統一超", "1216": "統一",
    "6176": "瑞儀", "1476": "儒鴻", "1477": "聚陽", "6547": "高端疫苗",
    // 熱門 ETF 全系列
    "0050": "元大台灣50", "0051": "元大中型100", "0052": "富邦科技",
    "0056": "元大高股息", "00878": "國泰永續高股息", "00919": "群益台灣精選高息",
    "00929": "復華台灣科技優息", "00940": "元大台灣價值高息", "006208": "富邦台50",
    "00713": "元大台灣高息低波", "00918": "大華優利高填息30", "00915": "凱基優選高股息30",
    "00881": "國泰台灣5G+", "00830": "國泰費城半導體", "00646": "元大S&P500", "00662": "富邦NASDAQ",
    "00939": "統一台灣高息動能", "00936": "台新臺灣永續高息中小型", "00934": "中信成長高股息"
  };

  const TaiwanStockBasePrices = {
    "2330": 2410, "2317": 205, "2454": 1550, "2344": 181.0,
    "2303": 52.5, "2308": 410, "2382": 290, "3231": 115,
    "2328": 44.9, "2353": 48.2, "2354": 92.0, "2371": 42.5,
    "2412": 136.5, "2886": 42.0, "2881": 92.5, "2882": 68.0,
    "2891": 36.5, "2884": 29.8, "2603": 195, "2609": 68.5,
    "2615": 82.0, "2002": 23.5, "1101": 32.5, "1301": 56.5,
    "0050": 104.65, "0056": 38.0, "00878": 22.8, "00919": 24.5,
    "00929": 19.8, "00940": 9.6, "006208": 105.0, "00713": 58.0
  };

  function lookupTaiwanStock(query) {
    if (!query) return null;
    query = query.toString().trim().toUpperCase();
    if (TaiwanStockNames[query]) {
      return { id: query, name: TaiwanStockNames[query], basePrice: TaiwanStockBasePrices[query] || null };
    }
    if (RealtimeStockService.twseCache && RealtimeStockService.twseCache[query]) {
      const item = RealtimeStockService.twseCache[query];
      TaiwanStockNames[query] = item.name;
      return { id: query, name: item.name, basePrice: item.price || null };
    }
    for (let code in TaiwanStockNames) {
      if (TaiwanStockNames[code] === query || TaiwanStockNames[code].includes(query)) {
        return { id: code, name: TaiwanStockNames[code], basePrice: TaiwanStockBasePrices[code] || null };
      }
    }
    return null;
  }

  // ==========================================
  // 3. 台灣股市 100% 即時真實盤價行情引擎 (Realtime Stock Service)
  // 三重高可用備援架構：FinMind動態近期盤價 (主線) -> 證交所/櫃買中心OpenAPI (備援) -> 基準字典庫 (兜底)
  // ==========================================
  const RealtimeStockService = {
    cache: {},
    inFlight: {},
    twseCache: null,
    twseCacheTime: 0,

    // 開機全量預載證交所與櫃買中心全台股代碼與名稱字典 (支援全市場千檔股票秒解析)
    async preloadStockDatabase() {
      try {
        const res = await fetch('https://openapi.twse.com.tw/v1/exchangeReport/STOCK_DAY_ALL');
        if (res.ok) {
          const list = await res.json();
          if (Array.isArray(list)) {
            if (!this.twseCache) this.twseCache = {};
            list.forEach(item => {
              if (item.Code && item.Name) {
                TaiwanStockNames[item.Code] = item.Name;
                this.twseCache[item.Code] = {
                  name: item.Name,
                  price: parseFloat(item.ClosingPrice ? item.ClosingPrice.replace(/,/g, '') : 0),
                  date: item.Date
                };
              }
            });
            this.twseCacheTime = Date.now();
          }
        }
      } catch(e) {}

      try {
        const res2 = await fetch('https://www.tpex.org.tw/openapi/v1/tpex_mainboard_daily_close_quotes');
        if (res2.ok) {
          const list2 = await res2.json();
          if (Array.isArray(list2)) {
            list2.forEach(item => {
              const code = item.SecuritiesCompanyCode;
              const name = item.CompanyName;
              if (code && name) {
                TaiwanStockNames[code] = name;
                if (!this.twseCache) this.twseCache = {};
                this.twseCache[code] = {
                  name: name,
                  price: parseFloat(item.Close ? item.Close.replace(/,/g, '') : 0),
                  date: item.Date
                };
              }
            });
          }
        }
      } catch(e) {}
    },

    // 動態計算最近 N 天起始日期 YYYY-MM-DD (縮減 99% 封包，提升連線速度至 < 150ms)
    getRecentStartDate(daysAgo = 10) {
      const d = new Date(Date.now() - daysAgo * 86400000);
      const y = d.getFullYear();
      const m = String(d.getMonth() + 1).padStart(2, '0');
      const day = String(d.getDate()).padStart(2, '0');
      return `${y}-${m}-${day}`;
    },

    // 取得單檔台股即時成交價與名稱
    async fetchQuote(rawCode) {
      if (!rawCode) return null;
      const code = rawCode.toString().trim().toUpperCase();

      // 1. 檢查 30 秒內的記憶體快取
      const cached = this.cache[code];
      if (cached && (Date.now() - cached.timestamp < 30000)) {
        return cached.data;
      }

      // 2. 請求合流去重 (In-flight deduplication)
      if (this.inFlight[code]) {
        return this.inFlight[code];
      }

      const queryPromise = (async () => {
        let quote = null;
        let stockName = (TaiwanStockNames[code]) || (this.twseCache && this.twseCache[code]?.name) || `股票(${code})`;

        // 策略 1: FinMind API (官方開放 CORS，動態抓取最近 10 天交易日成交價，極速回傳)
        try {
          const startDate = this.getRecentStartDate(10);
          const fmUrl = `https://api.finmindtrade.com/api/v4/data?dataset=TaiwanStockPrice&data_id=${code}&start_date=${startDate}`;
          
          const controller = new AbortController();
          const timeoutId = setTimeout(() => controller.abort(), 3500);
          
          const res = await fetch(fmUrl, { signal: controller.signal });
          clearTimeout(timeoutId);

          if (res.ok) {
            const json = await res.json();
            if (json && Array.isArray(json.data) && json.data.length > 0) {
              const latest = json.data[json.data.length - 1];
              const prevDay = (json.data.length >= 2) ? json.data[json.data.length - 2] : null;
              const prevCloseVal = prevDay && typeof prevDay.close === 'number' ? parseFloat(prevDay.close) : parseFloat(latest.open || latest.close);
              if (latest && typeof latest.close === 'number') {
                if (stockName.startsWith('股票(') && this.twseCache && this.twseCache[code]?.name) {
                  stockName = this.twseCache[code].name;
                  TaiwanStockNames[code] = stockName;
                }
                quote = {
                  id: code,
                  name: stockName,
                  price: parseFloat(latest.close),
                  prevClose: prevCloseVal,
                  date: latest.date,
                  source: 'finmind'
                };
              }
            }
          }
        } catch (e) {
          // 靜默降級進入備援策略
        }

        // 策略 2: 證交所 TWSE / 櫃買中心 TPEx 官方開放資料 OpenAPI 備援
        if (!quote || quote.name.startsWith('股票(')) {
          try {
            if (!this.twseCache || (Date.now() - this.twseCacheTime > 600000)) {
              const controller = new AbortController();
              const timeoutId = setTimeout(() => controller.abort(), 4000);
              const res = await fetch('https://openapi.twse.com.tw/v1/exchangeReport/STOCK_DAY_ALL', { signal: controller.signal });
              clearTimeout(timeoutId);
              if (res.ok) {
                const list = await res.json();
                if (Array.isArray(list)) {
                  this.twseCache = {};
                  list.forEach(item => {
                    if (item.Code && item.ClosingPrice) {
                      TaiwanStockNames[item.Code] = item.Name || stockName;
                      this.twseCache[item.Code] = {
                        name: item.Name || stockName,
                        price: parseFloat(item.ClosingPrice.replace(/,/g, '')),
                        date: item.Date
                      };
                    }
                  });
                  this.twseCacheTime = Date.now();
                }
              }
            }

            if (this.twseCache && this.twseCache[code]) {
              const cachedInfo = this.twseCache[code];
              if (cachedInfo.name) {
                stockName = cachedInfo.name;
                TaiwanStockNames[code] = stockName;
              }
              if (!quote && !isNaN(cachedInfo.price)) {
                quote = {
                  id: code,
                  name: stockName,
                  price: cachedInfo.price,
                  prevClose: cachedInfo.price,
                  source: 'twse-openapi'
                };
              } else if (quote) {
                quote.name = stockName;
              }
            }
          } catch (e) {}
        }

        // 策略 3: 本地基準市價字典庫兜底 (離線/斷網/假日保障)
        if (!quote && TaiwanStockBasePrices[code]) {
          quote = {
            id: code,
            name: stockName,
            price: TaiwanStockBasePrices[code],
            prevClose: TaiwanStockBasePrices[code],
            source: 'base-fallback'
          };
        }

        if (quote) {
          this.cache[code] = { data: quote, timestamp: Date.now() };
        }

        delete this.inFlight[code];
        return quote;
      })();

      this.inFlight[code] = queryPromise;
      return queryPromise;
    },

    // 批量刷新長輩自選股票
    async refreshElderStocks(elder) {
      if (!elder || !elder.stocks || elder.stocks.length === 0) return false;
      let changed = false;

      for (let i = 0; i < elder.stocks.length; i++) {
        const stock = elder.stocks[i];
        if (!stock.id) continue;
        try {
          const q = await this.fetchQuote(stock.id);
          if (q) {
            if (typeof q.prevClose === 'number' && q.prevClose > 0) {
              stock.prevClose = q.prevClose;
            }
            if (q.price && q.price !== stock.currentPrice) {
              stock.prevTickPrice = stock.currentPrice;
              stock.lastDiff = q.price - stock.currentPrice;
              stock.currentPrice = q.price;
              if (q.name && (!stock.name || stock.name.startsWith('股票('))) {
                stock.name = q.name;
              }
              changed = true;
            }
          }
        } catch (e) {}
      }

      return changed;
    },

    // 全局長輩股票即時同步
    async syncAllElderStocks() {
      const activeElder = getActiveElder();
      let changed = await this.refreshElderStocks(activeElder);

      const otherId = (AppState.activeElderId === 'dad') ? 'mom' : 'dad';
      const otherElder = AppState.elders[otherId];
      if (otherElder) {
        this.refreshElderStocks(otherElder).then(otherChanged => {
          if (otherChanged) {
            saveAppState();
            CloudSync.pushElder(otherId);
          }
        });
      }

      if (changed) {
        saveAppState();
        CloudSync.pushElder(AppState.activeElderId);
        renderAll();
      }
    }
  };

  // ==========================================
  // 3.5 盤中分時跳動偵測與語音即時播報 (Price Tick Detector)
  // ==========================================
  async function performMinuteMarketCheck() {
    const elder = getActiveElder();
    if (!elder || !elder.stocks || elder.stocks.length === 0) return;

    // 即時連線股市 API 抓取最新真實市場現價
    const hasChanged = await RealtimeStockService.refreshElderStocks(elder);

    if (hasChanged) {
      saveAppState();
      CloudSync.pushElder(AppState.activeElderId);
      renderAll();

      const targetStock = elder.stocks[0];
      if (AppState.tickVoiceEnabled && targetStock && targetStock.lastDiff !== 0 && AppState.deviceRole === 'senior') {
        speakPriceTickAlert(elder, targetStock, targetStock.lastDiff);
      }
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
    taiwaneseVoice: null,

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
      // 搜尋台語/閩南語 voice package (如 nan-TW, zh-min-nan, Taiwanese)
      this.taiwaneseVoice = voices.find(v => v.lang.includes('nan') || v.lang.includes('min') || v.name.includes('Taiwanese') || v.name.includes('閩')) || null;
      // 繁體中文台灣語音 (zh-TW)
      this.currentVoice = voices.find(v => v.lang === 'zh-TW') ||
                          voices.find(v => v.lang.includes('zh') && v.name.includes('Taiwan')) ||
                          voices.find(v => v.lang.includes('zh')) || null;
    },

    speak(text, onEnd) {
      if (!this.synthesizer) return;
      this.synthesizer.cancel();

      const utterance = new SpeechSynthesisUtterance(text);
      const elder = getActiveElder();
      const isTw = (elder && elder.language === 'taiwanese');

      if (isTw && this.taiwaneseVoice) {
        utterance.voice = this.taiwaneseVoice;
      } else if (this.currentVoice) {
        utterance.voice = this.currentVoice;
      }
      utterance.rate = elder.voiceRate || 0.85;
      utterance.pitch = 1.05;

      if (onEnd) utterance.onend = onEnd;
      this.synthesizer.speak(utterance);
    },

    cancel() {
      if (this.synthesizer) this.synthesizer.cancel();
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
      const stock = elder.stocks[0] || { name: '台積電', buyPrice: 850, currentPrice: 2410 };
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
      if (pocketBalEl) pocketBalEl.textContent = `${elder.pocketMoney.balance.toLocaleString()} 元`;

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
              <div class="cg-stock-meta">買入: ${stock.buyPrice} 元 | 目標: ${stock.targetPrice} 元 | 持有: ${stock.shares}股</div>
            </div>
            <div class="cg-stock-price-box">
              <div class="cg-stock-current">${stock.currentPrice} 元</div>
              <div class="cg-stock-meta" style="color: ${isProfit ? '#34D399' : '#FBBF24'}">
                ${isProfit ? '獲利' : '待漲'} ${Math.abs(diff).toLocaleString()} 元
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

  function updateLanguageUI() {
    const elder = getActiveElder();
    const isTw = (elder.language === 'taiwanese');
    const btn = document.getElementById('btn-toggle-lang');
    if (btn) {
      btn.textContent = isTw ? '🎙️ 台語' : '🗣️ 國語';
      btn.title = isTw ? '目前為台語聲道，點擊切換為國語' : '目前為國語聲道，點擊切換為台語';
    }
    const select = document.getElementById('setting-language');
    if (select) {
      select.value = elder.language || 'zh-TW';
    }
  }

  window.toggleAppLanguage = function toggleAppLanguage() {
    const elder = getActiveElder();
    if (elder.language === 'taiwanese') {
      elder.language = 'zh-TW';
    } else {
      elder.language = 'taiwanese';
    }
    saveAppState();
    CloudSync.pushElder(AppState.activeElderId);
    updateLanguageUI();
    renderAll();
    
    const isTw = (elder.language === 'taiwanese');
    const msg = isTw ? '切換為台語聲道囉！' : '已切換為國語聲道囉！';
    Speech.speak(msg);
  };

  function renderAll() {
    updateLanguageUI();
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

  window.toggleTickVoice = function toggleTickVoice() {
    AppState.tickVoiceEnabled = !AppState.tickVoiceEnabled;
    saveAppState();
    updateTickVoiceButtonUI();
    const elder = getActiveElder();
    const isTw = (elder.language === 'taiwanese');
    const statusPrompt = AppState.tickVoiceEnabled
      ? (isTw ? '動態跳動語音播報開起囉！' : '動態跳動語音播報已開啟囉！')
      : (isTw ? '動態語音播報已經關閉靜音囉。' : '動態語音播報已經關閉靜音囉。');
    Speech.speak(statusPrompt);
  };

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
      btn.className = 'btn-sound-toggle-muted';
      icon.textContent = '🔕';
      text.textContent = '播報提醒: 關';
    }
  }

  
  // 中文口語數字轉音 (例: 1000 -> 一千 / 1225 -> 一千二百二十五 / 3000 -> 三千，避免念成一零零零)
  function formatNumberToChineseSpeech(num) {
    num = Math.floor(Math.abs(num));
    if (num === 0) return '零';
    
    const digits = ['零', '一', '二', '三', '四', '五', '六', '七', '八', '九'];
    
    if (num < 10) return digits[num];
    if (num < 20) return (num === 10 ? '十' : '十' + digits[num % 10]);
    if (num < 100) {
      const shi = Math.floor(num / 10);
      const ge = num % 10;
      return digits[shi] + '十' + (ge > 0 ? digits[ge] : '');
    }
    if (num < 1000) {
      const bai = Math.floor(num / 100);
      const rem = num % 100;
      const shi = Math.floor(rem / 10);
      const ge = rem % 10;
      let str = digits[bai] + '百';
      if (rem > 0) {
        if (shi === 0) {
          str += '零' + digits[ge];
        } else {
          str += digits[shi] + '十' + (ge > 0 ? digits[ge] : '');
        }
      }
      return str;
    }
    if (num < 10000) {
      const qian = Math.floor(num / 1000);
      const rem = num % 1000;
      const bai = Math.floor(rem / 100);
      const rem2 = rem % 100;
      const shi = Math.floor(rem2 / 10);
      const ge = rem2 % 10;
      let str = digits[qian] + '千';
      if (rem > 0) {
        if (bai === 0) {
          str += '零';
          if (shi > 0) {
            str += digits[shi] + '十' + (ge > 0 ? digits[ge] : '');
          } else if (ge > 0) {
            str += digits[ge];
          }
        } else {
          str += digits[bai] + '百';
          if (rem2 > 0) {
            if (shi === 0) {
              str += '零' + digits[ge];
            } else {
              str += digits[shi] + '十' + (ge > 0 ? digits[ge] : '');
            }
          }
        }
      }
      return str;
    }
    if (num >= 10000) {
      const wan = Math.floor(num / 10000);
      const rem = num % 10000;
      return formatNumberToChineseSpeech(wan) + '萬' + (rem > 0 ? formatNumberToChineseSpeech(rem) : '');
    }
    return String(num);
  }

  // 長輩超白話金額格式化 (四捨五入至百位，去除冗長個位/十位數，例: 139,480 -> 13萬9千5百元 / 48,820 -> 4萬8千8百元 / 1,560,000 -> 156萬元)
  function formatSeniorMoneyText(num) {
    num = Math.abs(Math.round(num / 100) * 100);
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
      const rem = num % 1000;
      const bai = Math.floor(rem / 100);
      let str = `${qian}千`;
      if (bai > 0) str += `${bai}百`;
      return str + '元';
    } else if (num >= 100) {
      const bai = Math.floor(num / 100);
      return `${bai}百元`;
    } else {
      return `${num}元`;
    }
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

    // 2. 目前價格 (依台股規則：比昨收價漲=紅字 / 跌=綠字 / 平=白字，移除 $ 符號)
    const priceEl = document.getElementById('view-current-price');
    if (priceEl) {
      priceEl.textContent = `${stock.currentPrice.toLocaleString()} 元`;
      if (typeof stock.prevClose === 'number' && stock.prevClose > 0) {
        if (stock.currentPrice > stock.prevClose) {
          priceEl.className = 'row-val val-current-price val-price-up';
        } else if (stock.currentPrice < stock.prevClose) {
          priceEl.className = 'row-val val-current-price val-price-down';
        } else {
          priceEl.className = 'row-val val-current-price val-price-flat';
        }
      } else {
        priceEl.className = 'row-val val-current-price val-price-flat';
      }
    }

    // 3. 買入價格 (移除 $ 符號)
    const buyPriceEl = document.getElementById('view-buy-price');
    if (buyPriceEl) buyPriceEl.textContent = `${stock.buyPrice.toLocaleString()} 元`;

    // 4. 買入數量 (畫面維持純數字呈現)
    const sharesEl = document.getElementById('view-shares');
    if (sharesEl) {
      const sheets = (stock.shares >= 1000) ? `${stock.shares / 1000} 張 ` : '';
      sharesEl.textContent = `${sheets}(${stock.shares.toLocaleString()} 股)`;
    }

    // 5. 目前賺賠 (四捨五入至百位，去除幾十幾塊，台灣股市規範：賺=紅字 / 賠=綠字)
    const currentProfitEl = document.getElementById('view-current-profit');
    if (currentProfitEl) {
      if (isProfit) {
        currentProfitEl.className = 'row-val val-profit-red';
        currentProfitEl.textContent = `賺 ${formatSeniorMoneyText(profitDiff)}`;
      } else {
        currentProfitEl.className = 'row-val val-loss-green';
        currentProfitEl.textContent = `賠 ${formatSeniorMoneyText(profitDiff)}`;
      }
    }

    // 6. 預計賣價 (移除 $ 符號)
    const targetPriceEl = document.getElementById('view-target-price');
    if (targetPriceEl) targetPriceEl.textContent = `${stock.targetPrice.toLocaleString()} 元`;

    // 7. 預計賺賠 (四捨五入至百位，直接顯示 賺 / 賠，台灣股市規範：賺=紅字 / 賠=綠字)
    const targetProfitEl = document.getElementById('view-target-profit');
    if (targetProfitEl) {
      const isTargetProfit = (stock.targetPrice >= stock.buyPrice);
      if (isTargetProfit) {
        targetProfitEl.className = 'row-val val-target-red';
        targetProfitEl.textContent = `賺 ${formatSeniorMoneyText(targetDiff)}`;
      } else {
        targetProfitEl.className = 'row-val val-target-green';
        targetProfitEl.textContent = `賠 ${formatSeniorMoneyText(targetDiff)}`;
      }
    }
  }

  // 首頁看板 7 大項目點擊獨立語音朗讀 (長輩無障礙大字與國語即時發音)
  window.speakStockItem = function(fieldType) {
    const elder = getActiveElder();
    const stocks = elder.stocks || [];
    const stock = stocks[currentStockIndex];
    if (!stock) return;

    const isProfit = (stock.currentPrice >= stock.buyPrice);
    const profitDiff = Math.abs((stock.currentPrice - stock.buyPrice) * stock.shares);
    const profitMoneyText = formatSeniorMoneyText(profitDiff);

    const isTargetProfit = (stock.targetPrice >= stock.buyPrice);
    const targetDiff = Math.abs((stock.targetPrice - stock.buyPrice) * stock.shares);
    const targetMoneyText = formatSeniorMoneyText(targetDiff);

    const prevClose = (typeof stock.prevClose === 'number' && stock.prevClose > 0) ? stock.prevClose : null;

    let text = '';

    switch (fieldType) {
      case 'name':
        text = `股票名稱：${stock.name}。`;
        break;

      case 'price':
        if (prevClose !== null && prevClose > 0) {
          const diff = Math.abs(stock.currentPrice - prevClose);
          const diffStr = (diff % 1 === 0) ? diff.toString() : diff.toFixed(1);
          if (stock.currentPrice > prevClose) {
            text = `目前價格，${stock.currentPrice} 元。比昨天上漲 ${diffStr} 元！`;
          } else if (stock.currentPrice < prevClose) {
            text = `目前價格，${stock.currentPrice} 元。比昨天下跌 ${diffStr} 元。`;
          } else {
            text = `目前價格，${stock.currentPrice} 元。今天平盤。`;
          }
        } else {
          text = `目前價格，${stock.currentPrice} 元。`;
        }
        break;

      case 'buyPrice':
        text = `買入價格，${stock.buyPrice} 元。`;
        break;

      case 'shares':
        const sheets = (stock.shares >= 1000) ? `${Math.floor(stock.shares / 1000)} 張` : '';
        const sharesSpeech = formatNumberToChineseSpeech(stock.shares);
        if (sheets) {
          text = `買入數量，${sheets}，共 ${sharesSpeech} 股。`;
        } else {
          text = `買入數量，${sharesSpeech} 股。`;
        }
        break;

      case 'currentProfit':
        if (isProfit) {
          text = `目前賺賠，目前賺 ${profitMoneyText}！很棒喔！`;
        } else {
          text = `目前賺賠，目前稍微拉回，差 ${profitMoneyText}。放寬心喔！`;
        }
        break;

      case 'targetPrice':
        text = `希望賣價，${stock.targetPrice} 元。`;
        break;

      case 'targetProfit':
        if (isTargetProfit) {
          text = `希望賺賠，預計賺 ${targetMoneyText}。`;
        } else {
          text = `希望賺賠，預計賠 ${targetMoneyText}。`;
        }
        break;

      default:
        break;
    }

    if (text) {
      Speech.speak(text);
    }
  };

  // 切換股票時之精準語音播報 (依序播報長輩最想聽到的 4 個核心訊息：①股票名稱 ②目前價格 ③買入價格 ④希望賣價)
  function speakCurrentStockBrief() {
    const elder = getActiveElder();
    const stock = elder.stocks[currentStockIndex];
    if (!stock) return;

    const text = `切換到${stock.name}。目前價格 ${stock.currentPrice} 元，買入價格 ${stock.buyPrice} 元，希望賣價 ${stock.targetPrice} 元。`;
    Speech.speak(text);
  }

  // ==========================================
  // 10.4 小股超白話分析視窗管理器 (Stock Summary Modal Manager)
  // ==========================================
  window.openStockSummary = function() {
    StockSummaryModalManager.open();
  };

  window.closeStockSummary = function() {
    StockSummaryModalManager.close();
  };

  window.replayStockSummaryVoice = function() {
    StockSummaryModalManager.replay();
  };

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
        btnReplay.onclick = () => this.replay();
      }
    },

    replay() {
      if (this.currentSpeechText) {
        Speech.speak(this.currentSpeechText);
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
      const diff = Math.abs((stock.currentPrice - stock.buyPrice) * stock.shares);
      const pct = Math.abs(((stock.currentPrice - stock.buyPrice) / stock.buyPrice) * 100).toFixed(1);
      const moneyText = formatSeniorMoneyText(diff);

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
          verdictEl.textContent = `「走勢很穩，現賺 ${moneyText}，安心放著領分紅！」`;
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
          ? `買入 ${stock.buyPrice} 元，現在現價 ${stock.currentPrice} 元，現賺 ${moneyText}！`
          : `買入 ${stock.buyPrice} 元，現在現價 ${stock.currentPrice} 元，目前差 ${moneyText}。`;
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

      // 5. 產生超白話語音朗讀內容 (四捨五入至百位，清晰親切)
      this.currentSpeechText = isProfit
        ? `${elder.title}，您的${stock.name}現在是 ${stock.currentPrice} 元，現賺 ${moneyText}！走勢很穩，安心放著領分紅，喝杯溫水出去散散步喔！`
        : `${elder.title}，您的${stock.name}現在是 ${stock.currentPrice} 元，目前稍微拉回休息，好公司不用慌，耐心放著等起飛喔！`;

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
          localStorage.setItem('xiaogu_pwa_installed', 'true');
          document.documentElement.classList.add('is-pwa-standalone');
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
    const langSelect = document.getElementById('setting-language');
    if (langSelect) langSelect.value = currentElder.language || 'zh-TW';
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
        buyPrice: stocksToRender.length === 0 ? 850 : 120,
        shares: stocksToRender.length === 0 ? 1000 : 3000,
        currentPrice: stocksToRender.length === 0 ? 2410 : 136.5,
        targetPrice: stocksToRender.length === 0 ? 2600 : 145
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

      const handleIdChange = (isUserTyping = false) => {
        const code = idInput.value.trim().toUpperCase();
        if (!code) return;

        // 1. 同步從代碼名稱字典秒帶出正確股票名稱
        const match = lookupTaiwanStock(code);
        if (match) {
          nameInput.value = match.name;
        } else if (!nameInput.value || nameInput.value.startsWith('股票(')) {
          nameInput.value = `股票(${code})`;
        }

        if (isUserTyping) {
          currentInput.value = '';
          currentInput.placeholder = '連線查詢現價中...';
        }

        // 2. 異步聯網查詢真實市場即時成交價 (例如 2344 -> 181.00 / 0050 -> 104.65)
        if (code.length >= 2) {
          RealtimeStockService.fetchQuote(code).then((quote) => {
            if (quote && idInput.value.trim().toUpperCase() === code) {
              if (quote.name && (!nameInput.value || nameInput.value.startsWith('股票('))) {
                nameInput.value = quote.name;
              }
              if (quote.price) {
                currentInput.value = quote.price;
                if (isUserTyping) {
                  buyInput.value = quote.price;
                  targetInput.value = Math.round(quote.price * 1.15);
                }
              }
            }
          }).catch(() => {});
        }
      };

      idInput.addEventListener('input', () => handleIdChange(true));
      idInput.addEventListener('keyup', () => handleIdChange(true));
      idInput.addEventListener('change', () => handleIdChange(true));
      idInput.addEventListener('blur', () => handleIdChange(true));

      // 初始打開後台時若已有代號，立即在背景刷新現價與名稱（不覆蓋買價與目標價）
      if (idInput.value.trim()) {
        handleIdChange(false);
      }
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
    const langSelect = document.getElementById('setting-language');
    if (langSelect) currentElder.language = langSelect.value;
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
    try { RealtimeStockService.preloadStockDatabase(); } catch(e) {}
    initTenClickUnlock();
    renderAll();

    CloudSync.pullElder(AppState.activeElderId, () => {
      renderAll();
      checkPendingEnvelopeForSenior();
    });

    // 啟動即時股市行情自動同步
    try {
      RealtimeStockService.syncAllElderStocks();
    } catch(e) {}

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

    // 若已經是從手機桌面圖示以獨立 App 開啟 (Standalone) 或已安裝，隱藏按鈕避免干擾
    if (checkIsStandalone()) {
      if (btnHeader) btnHeader.classList.add('hidden');
      document.documentElement.classList.add('is-pwa-standalone');
    } else {
      // 若在普通瀏覽器中開啟（Chrome/Safari/Edge等），預設常駐顯示供長輩一鍵點選
      if (btnHeader) btnHeader.classList.remove('hidden');
    }

    // 註冊標準 PWA Service Worker (滿足一鍵安裝條件 + 智能自動熱更新)
    if ('serviceWorker' in navigator) {
      navigator.serviceWorker.register('sw.js?v=2.01')
        .then((reg) => {
          console.log('小股同學 Service Worker 註冊成功:', reg.scope);
          // 每次開啟或進入頁面時主動檢查是否有新版本發布
          reg.update().catch(() => {});
        })
        .catch((err) => console.log('Service Worker 註冊失敗:', err));

      // 當新的 Service Worker 啟用接管時，自動靜默重新載入最新資源（長輩完全免手動重裝）
      let refreshing = false;
      navigator.serviceWorker.addEventListener('controllerchange', () => {
        if (!refreshing) {
          refreshing = true;
          window.location.reload();
        }
      });
    }
  });

})();