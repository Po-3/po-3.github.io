/**
 * ロト6ポータル - ダッシュボードモジュール
 * メインページの動的コンテンツ生成とリアルタイム更新
 */

let countdownInterval = null;
let animationQueue = [];

/**
 * ダッシュボード初期化
 */
async function initializeDashboard() {
    console.log('ダッシュボード初期化開始');
    
    try {
        // データ読み込み
        await loadLoto6Data();
        
        // 各セクション表示（順次アニメーション）
        await displayLatestDraw();
        displayRecentDraws();
        displayQuickStats();
        startCountdownTimer();
        
        console.log('ダッシュボード初期化完了');
    } catch (error) {
        console.error('ダッシュボード初期化エラー:', error);
        showErrorMessage('データの読み込みに失敗しました。しばらくしてから再度お試しください。');
    }
}

/**
 * 最新抽選結果表示（アニメーション付き）
 */
async function displayLatestDraw() {
    if (!Loto6Data.latest || Loto6Data.latest.length === 0) {
        console.warn('最新データがありません');
        return;
    }
    
    const latest = Loto6Data.latest[0];
    
    // 回号と日付の表示
    const drawNumberEl = document.getElementById('latestDrawNumber');
    const drawDateEl = document.getElementById('latestDrawDate');
    
    if (drawNumberEl) drawNumberEl.textContent = latest.drawNumber || '-';
    if (drawDateEl) drawDateEl.textContent = formatDate(latest.drawDate);
    
    // 当選番号のアニメーション表示
    await displayNumberBalls(latest.numbers);
    
    // ボーナス数字の表示
    const bonusNumberEl = document.getElementById('bonusNumber');
    if (bonusNumberEl) {
        bonusNumberEl.textContent = latest.bonusNumber || '-';
    }
    
    // キャリーオーバー表示
    displayCarryOver(latest.carryOver);
}

/**
 * 数字ボールのアニメーション表示
 */
async function displayNumberBalls(numbers) {
    const mainNumbersEl = document.getElementById('mainNumbers');
    if (!mainNumbersEl || !numbers) return;
    
    mainNumbersEl.innerHTML = '';
    
    // 各ボールを順次アニメーション表示
    for (let i = 0; i < numbers.length; i++) {
        await new Promise(resolve => {
            setTimeout(() => {
                const ball = document.createElement('div');
                ball.className = 'number-ball';
                ball.textContent = numbers[i];
                ball.style.animationDelay = `${i * 0.1}s`;
                
                // 数字の大きさに応じた色分け
                const hue = (numbers[i] / 43) * 240; // 青から紫のグラデーション
                ball.style.background = `linear-gradient(135deg, hsl(${hue}, 70%, 60%), hsl(${hue}, 70%, 40%))`;
                
                mainNumbersEl.appendChild(ball);
                resolve();
            }, i * 200); // 200ms間隔で表示
        });
    }
}

/**
 * キャリーオーバー表示
 */
function displayCarryOver(amount) {
    const carryOverAlert = document.getElementById('carryOverAlert');
    const carryOverAmount = document.getElementById('carryOverAmount');
    
    if (!carryOverAlert) return;
    
    if (amount && amount > 0) {
        if (carryOverAmount) {
            carryOverAmount.textContent = formatCurrency(amount);
        }
        carryOverAlert.classList.remove('hidden');
        
        // パルスアニメーション追加
        carryOverAlert.style.animation = 'pulse 2s infinite';
    } else {
        carryOverAlert.classList.add('hidden');
    }
}

/**
 * 直近10回の抽選結果テーブル表示
 */
function displayRecentDraws() {
    const tbody = document.getElementById('recentDrawsTable');
    if (!tbody) return;
    
    tbody.innerHTML = '';
    
    const recentDraws = Loto6Data.latest.slice(0, 10);
    
    if (recentDraws.length === 0) {
        tbody.innerHTML = '<tr><td colspan="5" style="text-align:center;color:var(--text-secondary);">データがありません</td></tr>';
        return;
    }
    
    recentDraws.forEach((draw, index) => {
        const row = document.createElement('tr');
        row.style.animationDelay = `${index * 0.05}s`;
        row.className = 'fade-in-row';
        
        // 回号
        const cellNumber = document.createElement('td');
        cellNumber.textContent = `第${draw.drawNumber}回`;
        cellNumber.style.fontWeight = '700';
        row.appendChild(cellNumber);
        
        // 抽選日
        const cellDate = document.createElement('td');
        cellDate.textContent = formatDate(draw.drawDate);
        row.appendChild(cellDate);
        
        // 当選番号
        const cellNumbers = document.createElement('td');
        if (draw.numbers) {
            cellNumbers.innerHTML = draw.numbers.map(num => 
                `<span style="color:var(--primary);font-weight:700;">${num}</span>`
            ).join(', ');
        } else {
            cellNumbers.textContent = '-';
        }
        row.appendChild(cellNumbers);
        
        // ボーナス数字
        const cellBonus = document.createElement('td');
        cellBonus.innerHTML = `<span style="color:var(--accent-dark);font-weight:700;">${draw.bonusNumber || '-'}</span>`;
        row.appendChild(cellBonus);
        
        // 1等当選者数
        const cellWinners = document.createElement('td');
        if (draw.prizes && draw.prizes[1]) {
            const winners = draw.prizes[1].winners;
            cellWinners.textContent = winners > 0 ? `${winners}名` : '該当なし';
            cellWinners.style.fontWeight = winners > 0 ? '700' : 'normal';
            cellWinners.style.color = winners > 0 ? 'var(--success)' : 'var(--text-secondary)';
        } else {
            cellWinners.textContent = '-';
        }
        row.appendChild(cellWinners);
        
        tbody.appendChild(row);
    });
}

/**
 * クイック統計表示（改良版）
 */
function displayQuickStats() {
    const allDraws = Loto6Data.history.length > 0 ? Loto6Data.history : Loto6Data.latest;
    
    if (allDraws.length === 0) {
        console.warn('統計データがありません');
        return;
    }
    
    // 出現頻度計算
    const frequency = calculateNumberFrequency(allDraws);
    
    // 頻出数字TOP5（アニメーション付き）
    const sortedByFrequency = Object.entries(frequency)
        .sort((a, b) => b[1] - a[1])
        .slice(0, 5);
    
    displayStatList('topFrequentNumbers', sortedByFrequency, (num, count) => {
        return `${count}回出現`;
    }, 'hot');
    
    // 最近出ていない数字TOP5
    const lastAppearance = calculateLastAppearance(allDraws);
    const sortedByRecency = Object.entries(lastAppearance)
        .sort((a, b) => b[1] - a[1])
        .slice(0, 5);
    
    displayStatList('leastRecentNumbers', sortedByRecency, (num, draws) => {
        return draws >= allDraws.length ? '未出現' : `${draws}回前`;
    }, 'cold');
}

/**
 * 統計リスト表示ヘルパー（改良版）
 */
function displayStatList(elementId, data, formatFunc, type) {
    const container = document.getElementById(elementId);
    if (!container) return;
    
    container.innerHTML = '';
    
    if (data.length === 0) {
        container.innerHTML = '<p style="text-align:center;color:var(--text-secondary);">データがありません</p>';
        return;
    }
    
    data.forEach(([num, value], index) => {
        setTimeout(() => {
            const item = document.createElement('div');
            item.className = 'stat-item';
            
            // タイプに応じたスタイリング
            if (type === 'hot') {
                item.style.borderLeft = '4px solid var(--danger)';
                item.style.background = 'linear-gradient(90deg, rgba(244,67,54,0.1), transparent)';
            } else if (type === 'cold') {
                item.style.borderLeft = '4px solid var(--primary)';
                item.style.background = 'linear-gradient(90deg, rgba(26,35,126,0.1), transparent)';
            }
            
            const numberSpan = document.createElement('span');
            numberSpan.className = 'stat-number';
            numberSpan.textContent = num;
            
            const countSpan = document.createElement('span');
            countSpan.className = 'stat-count';
            countSpan.textContent = formatFunc(num, value);
            
            item.appendChild(numberSpan);
            item.appendChild(countSpan);
            
            // アニメーション追加
            item.style.opacity = '0';
            item.style.transform = 'translateX(-20px)';
            container.appendChild(item);
            
            // フェードイン
            requestAnimationFrame(() => {
                item.style.transition = 'all 0.5s ease';
                item.style.opacity = '1';
                item.style.transform = 'translateX(0)';
            });
        }, index * 100);
    });
}

/**
 * カウントダウンタイマー開始
 */
function startCountdownTimer() {
    // 次回抽選日表示
    const nextDraw = getNextDrawDate();
    const nextDrawInfo = document.getElementById('nextDrawInfo');
    if (nextDrawInfo) {
        const dayOfWeek = ['日', '月', '火', '水', '木', '金', '土'][nextDraw.getDay()];
        nextDrawInfo.textContent = `${formatDate(nextDraw.toISOString().split('T')[0])}（${dayOfWeek}）18:30`;
    }
    
    // カウントダウン更新関数
    function updateCountdown() {
        const { days, hours, minutes, seconds } = calculateCountdown();
        
        const elements = {
            days: document.getElementById('countdownDays'),
            hours: document.getElementById('countdownHours'),
            minutes: document.getElementById('countdownMinutes'),
            seconds: document.getElementById('countdownSeconds')
        };
        
        // 数字が変わった時にアニメーション
        Object.entries(elements).forEach(([key, el]) => {
            if (!el) return;
            
            const newValue = String(eval(key)).padStart(2, '0');
            if (el.textContent !== newValue) {
                el.style.transform = 'scale(1.2)';
                el.style.color = 'var(--accent)';
                setTimeout(() => {
                    el.style.transform = 'scale(1)';
                    el.style.color = '';
                }, 200);
            }
            el.textContent = newValue;
        });
    }
    
    // 初回実行
    updateCountdown();
    
    // 1秒ごとに更新
    if (countdownInterval) {
        clearInterval(countdownInterval);
    }
    countdownInterval = setInterval(updateCountdown, 1000);
}

/**
 * エラーメッセージ表示
 */
function showErrorMessage(message) {
    const main = document.querySelector('.main-content .container');
    if (!main) return;
    
    const errorDiv = document.createElement('div');
    errorDiv.style.cssText = `
        background: linear-gradient(135deg, #f44336, #e91e63);
        color: white;
        padding: 1.5rem;
        border-radius: 12px;
        margin-bottom: 2rem;
        text-align: center;
        font-weight: 500;
        animation: slideDown 0.5s ease-out;
    `;
    errorDiv.innerHTML = `
        <div style="font-size: 2rem; margin-bottom: 0.5rem;">⚠️</div>
        <div>${message}</div>
    `;
    
    main.insertBefore(errorDiv, main.firstChild);
    
    // 10秒後に自動削除
    setTimeout(() => {
        errorDiv.style.animation = 'slideUp 0.5s ease-out forwards';
        setTimeout(() => errorDiv.remove(), 500);
    }, 10000);
}

/**
 * ページ離脱時のクリーンアップ
 */
window.addEventListener('beforeunload', () => {
    if (countdownInterval) {
        clearInterval(countdownInterval);
    }
});

// CSS アニメーション追加
const style = document.createElement('style');
style.textContent = `
    @keyframes slideDown {
        from { opacity: 0; transform: translateY(-20px); }
        to { opacity: 1; transform: translateY(0); }
    }
    
    @keyframes slideUp {
        from { opacity: 1; transform: translateY(0); }
        to { opacity: 0; transform: translateY(-20px); }
    }
    
    @keyframes pulse {
        0%, 100% { transform: scale(1); }
        50% { transform: scale(1.05); }
    }
    
    .fade-in-row {
        animation: fadeInUp 0.6s ease-out backwards;
    }
    
    @keyframes fadeInUp {
        from {
            opacity: 0;
            transform: translateY(20px);
        }
        to {
            opacity: 1;
            transform: translateY(0);
        }
    }
`;
document.head.appendChild(style);

// ページ読み込み時に初期化
document.addEventListener('DOMContentLoaded', () => {
    initializeDashboard();
});
