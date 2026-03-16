// analysis.js
(() => {
  'use strict';

  const DATA_PATH = '../assets/data/history.json';
  const NUMBER_MIN = 1;
  const NUMBER_MAX = 43;

  const state = {
    rawData: [],
    filteredData: [],
    currentPeriod: 'all',
    charts: {
      frequency: null,
      interval: null,
      oddEven: null,
      highLow: null
    }
  };

  document.addEventListener('DOMContentLoaded', init);

  async function init() {
    try {
      const data = await loadHistoryData();
      state.rawData = normalizeAndSortData(data);
      setupPeriodButtons();
      applyPeriod('all');
    } catch (error) {
      console.error('分析データの読み込みに失敗しました:', error);
      showError('抽選データの読み込みに失敗しました。history.json の配置と内容を確認してください。');
    }
  }

  async function loadHistoryData() {
    const response = await fetch(DATA_PATH, { cache: 'no-store' });

    if (!response.ok) {
      throw new Error(`history.json の取得に失敗しました: ${response.status}`);
    }

    const json = await response.json();

    if (!Array.isArray(json)) {
      throw new Error('history.json の形式が不正です。配列形式を想定しています。');
    }

    return json;
  }

  function normalizeAndSortData(data) {
    return data
      .map((item) => ({
        drawNumber: Number(item.drawNumber),
        drawDate: item.drawDate || '',
        numbers: Array.isArray(item.numbers)
          ? item.numbers.map(Number).filter(isValidNumber)
          : [],
        bonusNumber: isValidNumber(Number(item.bonusNumber)) ? Number(item.bonusNumber) : null,
        prizes: item.prizes || {},
        carryOver: Number(item.carryOver || 0)
      }))
      .filter((item) => item.numbers.length === 6)
      .sort((a, b) => a.drawNumber - b.drawNumber);
  }

  function isValidNumber(num) {
    return Number.isInteger(num) && num >= NUMBER_MIN && num <= NUMBER_MAX;
  }

  function setupPeriodButtons() {
    const buttons = document.querySelectorAll('.period-btn');
    buttons.forEach((button) => {
      button.addEventListener('click', () => {
        buttons.forEach((btn) => btn.classList.remove('active'));
        button.classList.add('active');
        applyPeriod(button.dataset.period);
      });
    });
  }

  function applyPeriod(period) {
    state.currentPeriod = period;
    state.filteredData = getFilteredData(period);
    updateAnalysisInfo();
    renderAll();
  }

  function getFilteredData(period) {
    const all = [...state.rawData];

    if (period === 'all') return all;

    const count = Number(period);
    if (!Number.isFinite(count) || count <= 0) return all;

    return all.slice(-count);
  }

  function updateAnalysisInfo() {
    const periodTextEl = document.getElementById('analysisPeriodText');
    const countEl = document.getElementById('analysisCount');

    if (!periodTextEl || !countEl) return;

    const data = state.filteredData;
    const total = data.length;

    let label = '全期間';
    if (state.currentPeriod === '100') label = '直近100回';
    if (state.currentPeriod === '50') label = '直近50回';

    if (total > 0) {
      const first = data[0];
      const last = data[data.length - 1];
      const rangeText = `${label}（第${first.drawNumber}回〜第${last.drawNumber}回 / ${formatDate(first.drawDate)}〜${formatDate(last.drawDate)}）`;
      periodTextEl.textContent = rangeText;
    } else {
      periodTextEl.textContent = `${label}（データなし）`;
    }

    countEl.textContent = String(total);
  }

  function formatDate(dateStr) {
    if (!dateStr) return '-';
    const d = new Date(dateStr);
    if (Number.isNaN(d.getTime())) return dateStr;
    return `${d.getFullYear()}/${String(d.getMonth() + 1).padStart(2, '0')}/${String(d.getDate()).padStart(2, '0')}`;
  }

  function renderAll() {
    const stats = calculateStats(state.filteredData);
    renderFrequencyChart(stats);
    renderFrequencyStats(stats);
    renderIntervalChart(stats);
    renderOddEvenChart(stats);
    renderHighLowChart(stats);
    renderHeatmap(stats);
    renderCorrelationList(stats);
  }

  function calculateStats(data) {
    const frequencies = Array(NUMBER_MAX + 1).fill(0);
    const lastSeenIndex = Array(NUMBER_MAX + 1).fill(null);
    const pairMap = new Map();

    let oddCount = 0;
    let evenCount = 0;
    let lowCount = 0;
    let highCount = 0;

    data.forEach((draw, index) => {
      const nums = [...draw.numbers].sort((a, b) => a - b);

      nums.forEach((num) => {
        frequencies[num] += 1;
        lastSeenIndex[num] = index;

        if (num % 2 === 0) {
          evenCount += 1;
        } else {
          oddCount += 1;
        }

        if (num <= 22) {
          lowCount += 1;
        } else {
          highCount += 1;
        }
      });

      for (let i = 0; i < nums.length; i++) {
        for (let j = i + 1; j < nums.length; j++) {
          const key = `${nums[i]}-${nums[j]}`;
          pairMap.set(key, (pairMap.get(key) || 0) + 1);
        }
      }
    });

    const intervals = Array(NUMBER_MAX + 1).fill(data.length);
    for (let n = NUMBER_MIN; n <= NUMBER_MAX; n++) {
      if (lastSeenIndex[n] !== null) {
        intervals[n] = data.length - 1 - lastSeenIndex[n];
      }
    }

    const pairRanking = Array.from(pairMap.entries())
      .map(([key, count]) => {
        const [a, b] = key.split('-').map(Number);
        return { a, b, count };
      })
      .sort((x, y) => {
        if (y.count !== x.count) return y.count - x.count;
        if (x.a !== y.a) return x.a - y.a;
        return x.b - y.b;
      })
      .slice(0, 10);

    const totalPicks = data.length * 6;
    const theory = data.length > 0 ? (data.length * 6) / 43 : 0;

    return {
      totalDraws: data.length,
      totalPicks,
      frequencies,
      intervals,
      pairRanking,
      oddCount,
      evenCount,
      lowCount,
      highCount,
      theory,
      maxFrequency: Math.max(...frequencies.slice(1)),
      minFrequency: Math.min(...frequencies.slice(1)),
      hotNumbers: getTopNumbers(frequencies, 5, 'desc'),
      coldNumbers: getTopNumbers(frequencies, 5, 'asc'),
      overdueNumbers: getTopNumbers(intervals, 5, 'desc')
    };
  }

  function getTopNumbers(arr, count, direction = 'desc') {
    const list = [];
    for (let i = NUMBER_MIN; i <= NUMBER_MAX; i++) {
      list.push({ number: i, value: arr[i] });
    }

    list.sort((a, b) => {
      if (direction === 'asc') {
        if (a.value !== b.value) return a.value - b.value;
        return a.number - b.number;
      }
      if (a.value !== b.value) return b.value - a.value;
      return a.number - b.number;
    });

    return list.slice(0, count);
  }

  function destroyChart(key) {
    if (state.charts[key]) {
      state.charts[key].destroy();
      state.charts[key] = null;
    }
  }

  function commonChartOptions() {
    return {
      responsive: true,
      maintainAspectRatio: false,
      animation: {
        duration: 500
      },
      plugins: {
        legend: {
          labels: {
            font: {
              family: "'Noto Sans JP', sans-serif"
            }
          }
        },
        tooltip: {
          titleFont: {
            family: "'Noto Sans JP', sans-serif"
          },
          bodyFont: {
            family: "'Noto Sans JP', sans-serif"
          }
        }
      },
      scales: {
        x: {
          ticks: {
            font: {
              family: "'Noto Sans JP', sans-serif"
            }
          }
        },
        y: {
          beginAtZero: true,
          ticks: {
            font: {
              family: "'Noto Sans JP', sans-serif"
            }
          }
        }
      }
    };
  }

  function renderFrequencyChart(stats) {
    const canvas = document.getElementById('frequencyChart');
    if (!canvas) return;

    destroyChart('frequency');

    const labels = [];
    const values = [];
    const theoryValues = [];

    for (let i = NUMBER_MIN; i <= NUMBER_MAX; i++) {
      labels.push(String(i));
      values.push(stats.frequencies[i]);
      theoryValues.push(stats.theory);
    }

    state.charts.frequency = new Chart(canvas, {
      type: 'bar',
      data: {
        labels,
        datasets: [
          {
            type: 'bar',
            label: '出現回数',
            data: values,
            backgroundColor: 'rgba(25, 118, 210, 0.75)',
            borderColor: 'rgba(25, 118, 210, 1)',
            borderWidth: 1,
            borderRadius: 6
          },
          {
            type: 'line',
            label: '理論値',
            data: theoryValues,
            borderColor: 'rgba(255, 152, 0, 1)',
            backgroundColor: 'rgba(255, 152, 0, 0.2)',
            borderWidth: 2,
            borderDash: [6, 6],
            pointRadius: 0,
            tension: 0
          }
        ]
      },
      options: {
        ...commonChartOptions(),
        plugins: {
          ...commonChartOptions().plugins,
          tooltip: {
            ...commonChartOptions().plugins.tooltip,
            callbacks: {
              label(context) {
                const value = context.raw;
                if (context.dataset.label === '理論値') {
                  return `理論値: ${Number(value).toFixed(2)}回`;
                }
                const diff = value - stats.theory;
                const sign = diff >= 0 ? '+' : '';
                return `出現回数: ${value}回（理論値差 ${sign}${diff.toFixed(2)}）`;
              }
            }
          }
        }
      }
    });
  }

  function renderFrequencyStats(stats) {
    const el = document.getElementById('frequencyStats');
    if (!el) return;

    const hot = stats.hotNumbers.map((x) => `${x.number}（${x.value}回）`).join(' / ');
    const cold = stats.coldNumbers.map((x) => `${x.number}（${x.value}回）`).join(' / ');
    const avg = stats.theory.toFixed(2);

    el.innerHTML = `
      <div class="stat-box">
        <strong>理論上の平均出現回数</strong><br>
        ${avg}回
      </div>
      <div class="stat-box">
        <strong>最多出現</strong><br>
        ${hot}
      </div>
      <div class="stat-box">
        <strong>最少出現</strong><br>
        ${cold}
      </div>
      <div class="stat-box">
        <strong>最大値 / 最小値</strong><br>
        ${stats.maxFrequency}回 / ${stats.minFrequency}回
      </div>
    `;
  }

  function renderIntervalChart(stats) {
    const canvas = document.getElementById('intervalChart');
    if (!canvas) return;

    destroyChart('interval');

    const labels = [];
    const values = [];
    const colors = [];

    const maxInterval = Math.max(...stats.intervals.slice(1), 1);

    for (let i = NUMBER_MIN; i <= NUMBER_MAX; i++) {
      labels.push(String(i));
      values.push(stats.intervals[i]);

      const ratio = stats.intervals[i] / maxInterval;
      const alpha = 0.25 + ratio * 0.75;
      colors.push(`rgba(220, 53, 69, ${alpha.toFixed(3)})`);
    }

    state.charts.interval = new Chart(canvas, {
      type: 'bar',
      data: {
        labels,
        datasets: [
          {
            label: '経過回数',
            data: values,
            backgroundColor: colors,
            borderColor: 'rgba(220, 53, 69, 1)',
            borderWidth: 1,
            borderRadius: 6
          }
        ]
      },
      options: {
        ...commonChartOptions(),
        plugins: {
          ...commonChartOptions().plugins,
          tooltip: {
            ...commonChartOptions().plugins.tooltip,
            callbacks: {
              label(context) {
                return `最後の出現から ${context.raw}回経過`;
              }
            }
          }
        }
      }
    });
  }

  function renderOddEvenChart(stats) {
    const canvas = document.getElementById('oddEvenChart');
    const statsEl = document.getElementById('oddEvenStats');
    if (!canvas) return;

    destroyChart('oddEven');

    state.charts.oddEven = new Chart(canvas, {
      type: 'doughnut',
      data: {
        labels: ['奇数', '偶数'],
        datasets: [
          {
            data: [stats.oddCount, stats.evenCount],
            backgroundColor: [
              'rgba(255, 99, 132, 0.85)',
              'rgba(54, 162, 235, 0.85)'
            ],
            borderColor: '#fff',
            borderWidth: 3
          }
        ]
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        plugins: {
          legend: {
            position: 'bottom',
            labels: {
              font: {
                family: "'Noto Sans JP', sans-serif"
              }
            }
          }
        }
      }
    });

    if (statsEl) {
      const oddRate = stats.totalPicks ? ((stats.oddCount / stats.totalPicks) * 100).toFixed(1) : '0.0';
      const evenRate = stats.totalPicks ? ((stats.evenCount / stats.totalPicks) * 100).toFixed(1) : '0.0';

      statsEl.innerHTML = `
        <div class="ratio-stat-item">
          <span class="ratio-stat-label">奇数</span>
          <span class="ratio-stat-value">${oddRate}%</span>
        </div>
        <div class="ratio-stat-item">
          <span class="ratio-stat-label">偶数</span>
          <span class="ratio-stat-value">${evenRate}%</span>
        </div>
      `;
    }
  }

  function renderHighLowChart(stats) {
    const canvas = document.getElementById('highLowChart');
    const statsEl = document.getElementById('highLowStats');
    if (!canvas) return;

    destroyChart('highLow');

    state.charts.highLow = new Chart(canvas, {
      type: 'doughnut',
      data: {
        labels: ['小（1-22）', '大（23-43）'],
        datasets: [
          {
            data: [stats.lowCount, stats.highCount],
            backgroundColor: [
              'rgba(76, 175, 80, 0.85)',
              'rgba(255, 193, 7, 0.85)'
            ],
            borderColor: '#fff',
            borderWidth: 3
          }
        ]
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        plugins: {
          legend: {
            position: 'bottom',
            labels: {
              font: {
                family: "'Noto Sans JP', sans-serif"
              }
            }
          }
        }
      }
    });

    if (statsEl) {
      const lowRate = stats.totalPicks ? ((stats.lowCount / stats.totalPicks) * 100).toFixed(1) : '0.0';
      const highRate = stats.totalPicks ? ((stats.highCount / stats.totalPicks) * 100).toFixed(1) : '0.0';

      statsEl.innerHTML = `
        <div class="ratio-stat-item">
          <span class="ratio-stat-label">小</span>
          <span class="ratio-stat-value">${lowRate}%</span>
        </div>
        <div class="ratio-stat-item">
          <span class="ratio-stat-label">大</span>
          <span class="ratio-stat-value">${highRate}%</span>
        </div>
      `;
    }
  }

  function renderHeatmap(stats) {
    const grid = document.getElementById('heatmapGrid');
    if (!grid) return;

    grid.innerHTML = '';

    const max = Math.max(...stats.frequencies.slice(1), 1);
    const min = Math.min(...stats.frequencies.slice(1), 0);

    for (let i = NUMBER_MIN; i <= NUMBER_MAX; i++) {
      const value = stats.frequencies[i];
      const ratio = max === min ? 1 : (value - min) / (max - min);

      const bg = getHeatmapColor(ratio);
      const textColor = ratio > 0.55 ? '#fff' : '#1a1a1a';

      const cell = document.createElement('button');
      cell.type = 'button';
      cell.className = 'heatmap-cell';
      cell.textContent = String(i);
      cell.style.background = bg;
      cell.style.color = textColor;
      cell.title = `数字 ${i}\n出現回数: ${value}回\n最後の出現から: ${stats.intervals[i]}回経過`;

      cell.addEventListener('click', () => {
        alert(
          `数字 ${i}\n` +
          `出現回数: ${value}回\n` +
          `理論値との差: ${(value - stats.theory).toFixed(2)}\n` +
          `最後の出現から: ${stats.intervals[i]}回経過`
        );
      });

      grid.appendChild(cell);
    }
  }

  function getHeatmapColor(ratio) {
    const start = { r: 227, g: 242, b: 253 };
    const end = { r: 25, g: 118, b: 210 };

    const r = Math.round(start.r + (end.r - start.r) * ratio);
    const g = Math.round(start.g + (end.g - start.g) * ratio);
    const b = Math.round(start.b + (end.b - start.b) * ratio);

    return `rgb(${r}, ${g}, ${b})`;
  }

  function renderCorrelationList(stats) {
    const list = document.getElementById('correlationList');
    if (!list) return;

    list.innerHTML = '';

    if (!stats.pairRanking.length) {
      list.innerHTML = '<p>相関データがありません。</p>';
      return;
    }

    stats.pairRanking.forEach((item, index) => {
      const row = document.createElement('div');
      row.className = 'correlation-item';
      row.innerHTML = `
        <div class="correlation-pair">
          <span class="correlation-rank">${index + 1}</span>
          <div class="correlation-numbers">
            <span>${item.a}</span>
            <span>×</span>
            <span>${item.b}</span>
          </div>
        </div>
        <div class="correlation-count">${item.count}回</div>
      `;
      list.appendChild(row);
    });
  }

  function showError(message) {
    const main = document.querySelector('.main-content .container');
    if (!main) return;

    main.innerHTML = `
      <section class="page-header">
        <h1 class="page-title">📊 統計分析</h1>
        <p class="page-description">データの読み込みに失敗しました</p>
      </section>
      <section class="chart-section">
        <div class="card" style="padding: 2rem; text-align: center;">
          <p style="font-size: 1.1rem; color: #c62828; font-weight: 700;">${escapeHtml(message)}</p>
        </div>
      </section>
    `;
  }

  function escapeHtml(str) {
    return String(str)
      .replaceAll('&', '&amp;')
      .replaceAll('<', '&lt;')
      .replaceAll('>', '&gt;')
      .replaceAll('"', '&quot;')
      .replaceAll("'", '&#39;');
  }
})();
