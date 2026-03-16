console.log('✅ dashboard.js 読み込み完了');

function displayRecentDraws() {
    const tbody = document.getElementById('recentDrawsTable');
    if (!tbody) return;

    tbody.innerHTML = '';

    const history = Array.isArray(Loto6Data?.history) ? Loto6Data.history : [];
    const latest = Array.isArray(Loto6Data?.latest) ? Loto6Data.latest : [];
    const source = history.length > 0 ? history : latest;

    const recentDraws = [...source]
        .filter(draw => draw && typeof draw.drawNumber !== 'undefined')
        .sort((a, b) => Number(b.drawNumber) - Number(a.drawNumber))
        .slice(0, 10);

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
