console.log('✅ dashboard.js 読み込み完了');

function getSortedHistorySource() {
    const history = Array.isArray(Loto6Data?.history) ? Loto6Data.history : [];
    const latest = Array.isArray(Loto6Data?.latest) ? Loto6Data.latest : [];
    const source = history.length > 0 ? history : latest;

    return [...source]
        .filter(draw => draw && typeof draw.drawNumber !== 'undefined')
        .sort((a, b) => Number(b.drawNumber) - Number(a.drawNumber));
}

function renderLatestDrawFallback() {
    const latestDraw = getSortedHistorySource()[0];
    if (!latestDraw) return;

    const drawNumberEl = document.getElementById('latestDrawNumber');
    const drawDateEl = document.getElementById('latestDrawDate');
    const mainNumbersEl = document.getElementById('mainNumbers');
    const bonusNumberEl = document.getElementById('bonusNumber');
    const carryOverAlertEl = document.getElementById('carryOverAlert');
    const carryOverAmountEl = document.getElementById('carryOverAmount');

    if (drawNumberEl) drawNumberEl.textContent = latestDraw.drawNumber ?? '-';
    if (drawDateEl) {
        drawDateEl.textContent = typeof formatDate === 'function' ? formatDate(latestDraw.drawDate) : (latestDraw.drawDate || '-');
    }

    if (mainNumbersEl) {
        mainNumbersEl.innerHTML = '';
        if (Array.isArray(latestDraw.numbers)) {
            latestDraw.numbers.forEach(num => {
                const ball = document.createElement('div');
                ball.className = 'number-ball';
                ball.textContent = num;
                mainNumbersEl.appendChild(ball);
            });
        }
    }

    if (bonusNumberEl) {
        bonusNumberEl.textContent = latestDraw.bonusNumber ?? '-';
    }

    if (carryOverAlertEl) {
        if (Number(latestDraw.carryOver) > 0) {
            carryOverAlertEl.classList.remove('hidden');
            if (carryOverAmountEl) {
                carryOverAmountEl.textContent = typeof formatCurrency === 'function'
                    ? formatCurrency(Number(latestDraw.carryOver))
                    : `${latestDraw.carryOver}円`;
            }
        } else {
            carryOverAlertEl.classList.add('hidden');
        }
    }
}

function updateCountdownFallback() {
    const countdown = typeof calculateCountdown === 'function'
        ? calculateCountdown()
        : { days: 0, hours: 0, minutes: 0, seconds: 0 };

    const nextDraw = typeof getNextDrawDate === 'function' ? getNextDrawDate() : null;

    const map = {
        countdownDays: countdown.days,
        countdownHours: countdown.hours,
        countdownMinutes: countdown.minutes,
        countdownSeconds: countdown.seconds
    };

    Object.entries(map).forEach(([id, value]) => {
        const el = document.getElementById(id);
        if (el) el.textContent = value;
    });

    const nextDrawInfoEl = document.getElementById('nextDrawInfo');
    if (nextDrawInfoEl && nextDraw) {
        const yyyy = nextDraw.getFullYear();
        const mm = nextDraw.getMonth() + 1;
        const dd = nextDraw.getDate();
        const week = ['日', '月', '火', '水', '木', '金', '土'][nextDraw.getDay()];
        const hh = String(nextDraw.getHours()).padStart(2, '0');
        const mi = String(nextDraw.getMinutes()).padStart(2, '0');
        nextDrawInfoEl.textContent = `次回抽選予定: ${yyyy}年${mm}月${dd}日（${week}）${hh}:${mi}`;
    }
}

function renderQuickStatsFallback() {
    const history = getSortedHistorySource();
    const topFrequentEl = document.getElementById('topFrequentNumbers');
    const leastRecentEl = document.getElementById('leastRecentNumbers');

    if (!history.length) {
        if (topFrequentEl) topFrequentEl.textContent = 'データがありません';
        if (leastRecentEl) leastRecentEl.textContent = 'データがありません';
        return;
    }

    const frequency = {};
    for (let i = 1; i <= 43; i++) frequency[i] = 0;

    history.forEach(draw => {
        if (Array.isArray(draw.numbers)) {
            draw.numbers.forEach(num => {
                if (frequency[num] !== undefined) frequency[num] += 1;
            });
        }
    });

    const topFrequent = Object.entries(frequency)
        .map(([num, count]) => ({ num: Number(num), count }))
        .sort((a, b) => b.count - a.count || a.num - b.num)
        .slice(0, 5);

    const seenOrder = [];
    history.forEach(draw => {
        if (Array.isArray(draw.numbers)) {
            draw.numbers.forEach(num => {
                if (!seenOrder.includes(num)) seenOrder.push(num);
            });
        }
    });

    const leastRecent = [];
    for (let i = 1; i <= 43; i++) {
        const index = seenOrder.indexOf(i);
        leastRecent.push({ num: i, gap: index === -1 ? history.length : index });
    }
    leastRecent.sort((a, b) => b.gap - a.gap || a.num - b.num);

    if (topFrequentEl) {
        topFrequentEl.innerHTML = topFrequent.map(item =>
            `<div class="stat-item"><span class="stat-number">${item.num}</span><span class="stat-count">${item.count}回</span></div>`
        ).join('');
    }

    if (leastRecentEl) {
        leastRecentEl.innerHTML = leastRecent.slice(0, 5).map(item =>
            `<div class="stat-item"><span class="stat-number">${item.num}</span><span class="stat-count">${item.gap}回未出</span></div>`
        ).join('');
    }
}

function displayRecentDraws() {
    const tbody = document.getElementById('recentDrawsTable');
    if (!tbody) return;

    tbody.innerHTML = '';

    const recentDraws = getSortedHistorySource().slice(0, 10);

    if (recentDraws.length === 0) {
        tbody.innerHTML = '<tr><td colspan="5" style="text-align:center;color:var(--text-secondary);">データがありません</td></tr>';
        return;
    }

    recentDraws.forEach((draw, index) => {
        const row = document.createElement('tr');
        row.style.animationDelay = `${index * 0.05}s`;
        row.className = 'fade-in-row';

        const cellNumber = document.createElement('td');
        cellNumber.textContent = `第${draw.drawNumber}回`;
        cellNumber.style.fontWeight = '700';
        row.appendChild(cellNumber);

        const cellDate = document.createElement('td');
        cellDate.textContent = typeof formatDate === 'function' ? formatDate(draw.drawDate) : (draw.drawDate || '-');
        row.appendChild(cellDate);

        const cellNumbers = document.createElement('td');
        if (Array.isArray(draw.numbers) && draw.numbers.length > 0) {
            cellNumbers.innerHTML = draw.numbers.map(num =>
                `<span style="color:var(--primary);font-weight:700;">${num}</span>`
            ).join(', ');
        } else {
            cellNumbers.textContent = '-';
        }
        row.appendChild(cellNumbers);

        const cellBonus = document.createElement('td');
        cellBonus.innerHTML = `<span style="color:var(--accent-dark);font-weight:700;">${draw.bonusNumber ?? '-'}</span>`;
        row.appendChild(cellBonus);

        const prize1 = draw.prizes?.['1'] ?? draw.prizes?.[1] ?? null;
        const cellWinners = document.createElement('td');
        if (prize1 && typeof prize1.winners !== 'undefined') {
            const winners = Number(prize1.winners);
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

document.addEventListener('DOMContentLoaded', async () => {
    console.log('✅ dashboard.js 初期化開始');

    try {
        await loadLoto6Data();

        console.log('✅ データ読込後', {
            latest: Array.isArray(Loto6Data.latest) ? Loto6Data.latest.length : 0,
            history: Array.isArray(Loto6Data.history) ? Loto6Data.history.length : 0
        });

        if (typeof displayLatestDraw === 'function') {
            displayLatestDraw();
        } else {
            renderLatestDrawFallback();
        }

        if (typeof displayCountdown === 'function') {
            displayCountdown();
        } else {
            updateCountdownFallback();
            setInterval(updateCountdownFallback, 1000);
        }

        if (typeof displayQuickStats === 'function') {
            displayQuickStats();
        } else {
            renderQuickStatsFallback();
        }

        displayRecentDraws();
    } catch (error) {
        console.error('❌ dashboard.js 初期化エラー:', error);
    }
});
