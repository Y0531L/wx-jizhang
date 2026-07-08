// pages/stats/stats.js
const { call } = require('../../utils/cloud.js');
const { formatMoney } = require('../../utils/format.js');

const PIE_COLORS = ['#ff6b35', '#ff3b30', '#ffb300', '#34c759', '#1a73e8', '#9c27b0', '#00bcd4', '#795548', '#607d8b', '#e91e63', '#8bc34a', '#ffc107'];

Page({
  data: {
    statType: 'expense',
    trend: [],
    categoryStats: [],
    pieGradient: '',
    totalShort: '0',
    compareData: []
  },

  onShow() {
    this.loadData();
  },

  switchStatType(e) {
    this.setData({ statType: e.currentTarget.dataset.type }, () => this.loadData());
  },

  async loadData() {
    this.loadTrend();
    this.loadCategory();
    this.loadCompare();
  },

  // 近6月趋势
  async loadTrend() {
    try {
      const data = await call('stats', { action: 'trend', type: this.data.statType });
      const list = data.trend || [];
      const max = Math.max(...list.map(i => i.amount), 1);
      const trend = list.map(i => ({
        month: i.month,
        label: i.month,
        short: this.shortMoney(i.amount),
        percent: Math.round((i.amount / max) * 100)
      }));
      this.setData({ trend });
    } catch (e) {}
  },

  // 分类占比
  async loadCategory() {
    try {
      const data = await call('stats', { action: 'category', type: this.data.statType });
      const list = data.categories || [];
      const total = list.reduce((s, i) => s + i.amount, 0) || 1;
      let acc = 0;
      const categoryStats = list.map((c, idx) => {
        const color = PIE_COLORS[idx % PIE_COLORS.length];
        const percent = Math.round((c.amount / total) * 100);
        const start = acc;
        acc += percent;
        return {
          ...c,
          color,
          percent,
          amountText: formatMoney(c.amount),
          _start: start,
          _end: acc
        };
      });
      // 构建 conic-gradient
      const stops = categoryStats.map(c => `${c.color} ${c._start}% ${c._end}%`).join(', ');
      this.setData({
        categoryStats,
        pieGradient: stops || '#e0e0e0 0% 100%',
        totalShort: this.shortMoney(total)
      });
    } catch (e) {}
  },

  // 收支对比
  async loadCompare() {
    try {
      const data = await call('stats', { action: 'compare' });
      const list = data.compare || [];
      const max = Math.max(...list.map(i => Math.max(i.expense, i.income)), 1);
      const compareData = list.map(i => ({
        label: i.month,
        expenseText: this.shortMoney(i.expense),
        incomeText: this.shortMoney(i.income),
        expensePercent: Math.round((i.expense / max) * 100),
        incomePercent: Math.round((i.income / max) * 100)
      }));
      this.setData({ compareData });
    } catch (e) {}
  },

  shortMoney(num) {
    if (num >= 10000) return (num / 10000).toFixed(1) + 'w';
    if (num >= 1000) return (num / 1000).toFixed(1) + 'k';
    return formatMoney(num);
  }
});
