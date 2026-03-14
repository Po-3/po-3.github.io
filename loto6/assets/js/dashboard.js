// ダッシュボード機能

document.addEventListener('DOMContentLoaded', async () => {
    await loadData();
    initDashboard();
});

function initDashboard() {
    displayLatestDraw();
    displayRecentDraws();
    displayQuickStats();
    startCountdown();
}

// 最新抽選結果表示
function displayLatestDraw() {
    if (AppData.latest.length === 0) return;
    
    const latest = AppData.latest[0];
    
    // 回号と日付
    const drawNumberEl = document.getElementById('drawNumber');
    const drawDateEl = document.getElementById('drawDate');
    
    if (drawNumberEl) drawNumberEl.textContent = latest.drawNumber;
    if (drawDateEl) drawDateEl.textContent = formatDate(latest.drawDate);
    
    // 当選番号
    const numbersContainer = document.getElementById('latestNumbers');
    if (numbersContainer) {
        numbersContainer.innerHTML = '';
        latest.numbers.forEach((num, index) => {
            const ball = document.createElement('div');
            ball.className = 'number-ball';
            ball.textContent = num;
            ball.style.animationDelay = `${index * 0.1}s`;
            numbersContainer.appendChild(ball);
        });
    }
    
    // ボーナス数字
    const bonusEl = document.getElementById('bonusNumber');
    if (bonusEl) bonusEl.textContent = latest.bonusNumber;
    
    // キャリーオーバー
    const carryOverContainer = document.getElementById('carryOverInfo');
    if (carryOverContainer) {
        if (latest.carryOver > 0) {
            carryOverContainer.innerHTML = `
                🎉 キャリーオーバー発生中！
                <br>
                <strong>${formatNumber(latest.carryOver)}円</strong>
            `;
            carryOverContainer.classList.remove('hidden');
        } else {
            carryOverContainer.classList.add('hidden');
        }
    }
}

// 直近10回の結果表示
function displayRecentDraws() {
    const tbody = document.querySelector('#recentDrawsTable tbody');
    if (!tbody) return;
    
    tbody.innerHTML = '';
    
    const recent = AppData.latest.slice(0, 10);
    
    recent.forEach(draw => {
        const row = document.createElement('tr');
        
        // 回号
        const cellNumber = document.createElement('td');
        cellNumber.textContent = `第${draw.drawNumber}回`;
        row.appendChild(cellNumber);
        
        // 抽選日
        const cellDate = document.createElement('td');
        cellDate.textContent = formatDate(draw.drawDate);
        row.appendChild(cellDate);
        
        // 当選番号
        const cellNumbers = document.createElement('td');
        cellNumbers.textContent = draw.numbers.join(', ');
        row.appendChild(cellNumbers);
        
        // ボーナス
        const cellBonus = document.createElement('td');
        cellBonus.textContent = draw.bonusNumber;
        row.appendChild(cellBonus);
        
        tbody.appendChild(row);
    });
}

// クイック統計表示
function displayQuickStats() {
    // 全データから統計計算
    const allDraws = AppData.history.length > 0 ? AppData.history : AppData.latest;
    
    // 各数字の出現回数カウント
    const frequency = {};
    for (let i = 1; i <= 43; i++) {
        frequency[i] = 0;
    }
    
    allDraws.forEach(draw => {
        draw.numbers.forEach(num => {
            frequency[num]++;
        });
    });
    
    // 頻出数字TOP5
    const sortedByFrequency = Object.entries(frequency)
        .sort((a, b) => b[1] - a[1])
        .slice(0, 5);
    
    const topFrequentContainer = document.getElementById('topFrequent');
    if (topFrequentContainer) {
        topFrequentContainer.innerHTML = '';
        sortedByFrequency.forEach(([num, count]) => {
            const item = document.createElement('div');
            item.className = 'stat-item';
            item.innerHTML = `
                <span class="stat-number">${num}</span>
                <span class="stat-count">${count}回</span>
            `;
            topFrequentContainer.appendChild(item);
        });
    }
    
    // 最近出ていない数字（最後の出現からの経過回数）
    const lastAppearance = {};
    for (let i = 1; i <= 43; i++) {
        lastAppearance[i] = allDraws.length;
    }
    
    allDraws.forEach((draw, index) => {
        draw.numbers.forEach(num => {
            if (lastAppearance[num] === allDraws.length) {
                lastAppearance[num] = index;
            }
        });
    });
    
    const sortedByRecency = Object.entries(lastAppearance)
        .sort((a, b) => b[1] - a[1])
        .slice(0, 5);
    
    const leastRecentContainer = document.getElementById('leastRecent');
    if (leastRecentContainer) {
        leastRecentContainer.innerHTML = '';
        sortedByRecency.forEach(([num, draws]) => {
            const item = document.createElement('div');
            item.className = 'stat-item';
            item.innerHTML = `
                <span class="stat-number">${num}</span>
                <span class="stat-count">${draws}回前</span>
            `;
            leastRecentContainer.appendChild(item);
        });
    }
}

// カウントダウン開始
function startCountdown() {
    const nextDraw = getNextDrawDate();
    const nextDrawDateEl = document.getElementById('nextDrawDate');
    if (nextDrawDateEl) {
        nextDrawDateEl.textContent = 
            `次回抽選: ${formatDate(nextDraw.toISOString().split('T')[0])} 18:30`;
    }
    
    function update() {
        const { days, hours, minutes, seconds } = updateCountdown();
        
        const daysEl = document.getElementById('days');
        const hoursEl = document.getElementById('hours');
        const minutesEl = document.getElementById('minutes');
        const secondsEl = document.getElementById('seconds');
        
        if (daysEl) daysEl.textContent = days;
        if (hoursEl) hoursEl.textContent = hours;
        if (minutesEl) minutesEl.textContent = minutes;
        if (secondsEl) secondsEl.textContent = seconds;
    }
    
    update();
    setInterval(update, 1000);
}
