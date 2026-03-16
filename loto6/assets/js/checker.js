/**
 * ロト6ポータル - 当選チェッカー機能
 */

let selectedNumbers = [];
const MAX_NUMBERS = 6;

document.addEventListener('DOMContentLoaded', async () => {
    await loadLoto6Data();
    initializeChecker();
    loadMySets();
});

function initializeChecker() {
    // 数字ボタン生成（1-43）
    const selector = document.getElementById('numberSelector');
    for (let i = 1; i <= 43; i++) {
        const btn = document.createElement('button');
        btn.className = 'number-btn';
        btn.textContent = i;
        btn.dataset.number = i;
        btn.addEventListener('click', () => toggleNumber(i));
        selector.appendChild(btn);
    }

    // イベントリスナー設定
    document.getElementById('checkBtn').addEventListener('click', checkNumbers);
    document.getElementById('clearBtn').addEventListener('click', clearSelection);
    document.getElementById('randomBtn').addEventListener('click', randomSelection);
    document.getElementById('saveSetBtn').addEventListener('click', saveMySet);
}

function toggleNumber(num) {
    const index = selectedNumbers.indexOf(num);
    
    if (index > -1) {
        selectedNumbers.splice(index, 1);
    } else {
        if (selectedNumbers.length < MAX_NUMBERS) {
            selectedNumbers.push(num);
        } else {
            return;
        }
    }
    
    selectedNumbers.sort((a, b) => a - b);
    updateDisplay();
}

function updateDisplay() {
    // ボタンの状態更新
    document.querySelectorAll('.number-btn').forEach(btn => {
        const num = parseInt(btn.dataset.number);
        btn.classList.toggle('selected', selectedNumbers.includes(num));
    });

    // 選択中の数字表示
    const display = document.getElementById('selectedDisplay');
    if (selectedNumbers.length === 0) {
        display.innerHTML = '<span class="empty-message">数字を6つ選択してください</span>';
    } else {
        display.innerHTML = selectedNumbers.map(num => 
            `<div class="selected-ball">${num}</div>`
        ).join('');
    }

    // チェックボタン有効化
    document.getElementById('checkBtn').disabled = selectedNumbers.length !== MAX_NUMBERS;
}

function clearSelection() {
    selectedNumbers = [];
    updateDisplay();
    document.getElementById('resultsSection').classList.add('hidden');
}

function randomSelection() {
    selectedNumbers = [];
    while (selectedNumbers.length < MAX_NUMBERS) {
        const num = Math.floor(Math.random() * 43) + 1;
        if (!selectedNumbers.includes(num)) {
            selectedNumbers.push(num);
        }
    }
    selectedNumbers.sort((a, b) => a - b);
    updateDisplay();
}

function checkNumbers() {
    if (selectedNumbers.length !== MAX_NUMBERS) return;

    const history = Loto6Data.history.length > 0 ? Loto6Data.history : Loto6Data.latest;
    const results = [];
    const rankCounts = {1: 0, 2: 0, 3: 0, 4: 0, 5: 0};

    history.forEach(draw => {
        const result = checkWinning(selectedNumbers, draw.numbers, draw.bonusNumber);
        if (result.rank > 0) {
            rankCounts[result.rank]++;
            results.push({
                draw: draw,
                result: result
            });
        }
    });

    displayResults(results, rankCounts, history.length);
}

function displayResults(results, rankCounts, totalDraws) {
    const summaryEl = document.getElementById('resultSummary');
    const tableBody = document.getElementById('resultTableBody');
    const section = document.getElementById('resultsSection');

    // サマリー表示
    const totalWins = Object.values(rankCounts).reduce((a, b) => a + b, 0);
    summaryEl.innerHTML = `
        <h3>🎯 チェック結果</h3>
        <p><strong>選択した数字:</strong> ${selectedNumbers.join(', ')}</p>
        <div class="summary-stats">
            <div class="stat-item">
                <span class="stat-value">${totalDraws}</span>
                <span class="stat-label">総チェック回数</span>
            </div>
            <div class="stat-item">
                <span class="stat-value">${totalWins}</span>
                <span class="stat-label">当選回数</span>
            </div>
            <div class="stat-item">
                <span class="stat-value">${rankCounts[1]}</span>
                <span class="stat-label">1等</span>
            </div>
            <div class="stat-item">
                <span class="stat-value">${rankCounts[2]}</span>
                <span class="stat-label">2等</span>
            </div>
            <div class="stat-item">
                <span class="stat-value">${rankCounts[3]}</span>
                <span class="stat-label">3等</span>
            </div>
        </div>
    `;

    // 詳細テーブル表示
    tableBody.innerHTML = '';
    if (results.length === 0) {
        tableBody.innerHTML = '<tr><td colspan="6" style="text-align:center;color:var(--text-secondary);">当選履歴はありません</td></tr>';
    } else {
        results.forEach(r => {
            const row = document.createElement('tr');
            row.innerHTML = `
                <td>第${r.draw.drawNumber}回</td>
                <td>${formatDate(r.draw.drawDate)}</td>
                <td>${r.draw.numbers.join(', ')}</td>
                <td>${r.draw.bonusNumber}</td>
                <td>${r.result.matches}個${r.result.bonusMatch ? '+B' : ''}</td>
                <td style="font-weight:700;color:var(--success)">${r.result.rank}等</td>
            `;
            tableBody.appendChild(row);
        });
    }

    section.classList.remove('hidden');
    section.scrollIntoView({ behavior: 'smooth' });
}

function saveMySet() {
    if (selectedNumbers.length !== MAX_NUMBERS) {
        alert('6つの数字を選択してください');
        return;
    }

    const nameInput = document.getElementById('setName');
    const name = nameInput.value.trim() || `セット${Date.now()}`;

    const mySets = Storage.load('mySets') || [];
    
    // 重複チェック
    const numStr = selectedNumbers.join(',');
    if (mySets.some(set => set.numbers.join(',') === numStr)) {
        alert('この組み合わせは既に保存されています');
        return;
    }

    mySets.push({
        id: Date.now(),
        name: name,
        numbers: [...selectedNumbers],
        created: new Date().toISOString()
    });

    Storage.save('mySets', mySets);
    nameInput.value = '';
    loadMySets();
    alert(`「${name}」を保存しました`);
}

function loadMySets() {
    const container = document.getElementById('mysetsList');
    const mySets = Storage.load('mySets') || [];

    if (mySets.length === 0) {
        container.innerHTML = '<p style="text-align:center;color:var(--text-secondary);">保存されたセットはありません</p>';
        return;
    }

    container.innerHTML = mySets.map(set => `
        <div class="myset-item" onclick="loadSet(${set.id})">
            <div>
                <strong>${set.name}</strong>
                <div class="myset-numbers">
                    ${set.numbers.map(n => `<div class="myset-ball">${n}</div>`).join('')}
                </div>
            </div>
            <div class="myset-actions-btn">
                <button class="btn btn-secondary" onclick="event.stopPropagation(); deleteSet(${set.id})">削除</button>
            </div>
        </div>
    `).join('');
}

function loadSet(id) {
    const mySets = Storage.load('mySets') || [];
    const set = mySets.find(s => s.id === id);
    if (set) {
        selectedNumbers = [...set.numbers];
        updateDisplay();
        window.scrollTo({ top: 0, behavior: 'smooth' });
    }
}

function deleteSet(id) {
    if (!confirm('このセットを削除しますか？')) return;
    
    const mySets = Storage.load('mySets') || [];
    const filtered = mySets.filter(s => s.id !== id);
    Storage.save('mySets', filtered);
    loadMySets();
}
