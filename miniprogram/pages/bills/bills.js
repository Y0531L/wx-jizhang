// pages/bills/bills.js
const { call } = require('../../utils/cloud.js');
const { formatMoney } = require('../../utils/format.js');
const { formatDate, pad } = require('../../utils/date.js');

Page({
  data: {
    year: 0,
    month: 0,
    filterType: 'all',
    groupedBills: [],
    expenseTotal: '0.00',
    incomeTotal: '0.00',
    netTotal: '0.00'
  },

  onLoad() {
    const now = new Date();
    this.setData({ year: now.getFullYear(), month: now.getMonth() + 1 });
  },

  onShow() {
    this.loadBills();
  },

  prevMonth() {
    let { year, month } = this.data;
    month--;
    if (month < 1) { month = 12; year--; }
    this.setData({ year, month }, () => this.loadBills());
  },

  nextMonth() {
    let { year, month } = this.data;
    month++;
    if (month > 12) { month = 1; year++; }
    this.setData({ year, month }, () => this.loadBills());
  },

  pickMonth() {
    const years = [];
    const now = new Date();
    for (let y = now.getFullYear(); y >= now.getFullYear() - 3; y--) years.push(y + '年');
    const months = [];
    for (let m = 1; m <= 12; m++) months.push(m + '月');
    wx.showActionSheet({
      itemList: ['今年本月', '选择其他月份'],
      success: (res) => {
        if (res.tapIndex === 0) {
          this.setData({ year: now.getFullYear(), month: now.getMonth() + 1 }, () => this.loadBills());
        }
      }
    });
  },

  setFilter(e) {
    this.setData({ filterType: e.currentTarget.dataset.type }, () => this.loadBills());
  },

  async loadBills() {
    try {
      const data = await call('listBills', {
        action: 'month',
        year: this.data.year,
        month: this.data.month,
        type: this.data.filterType
      });
      const bills = data.bills || [];
      const expense = data.expense || 0;
      const income = data.income || 0;

      // 按日分组
      const groupMap = {};
      bills.forEach(b => {
        const day = formatDate(b.date);
        if (!groupMap[day]) {
          groupMap[day] = { date: day, dateText: this.formatDayText(day), bills: [], dayExpense: 0, dayIncome: 0 };
        }
        const amt = Number(b.amount) || 0;
        if (b.type === 'expense') groupMap[day].dayExpense += amt;
        else groupMap[day].dayIncome += amt;
        groupMap[day].bills.push({
          ...b,
          amountText: formatMoney(b.amount),
          sourceTag: b.source === 'wxpay' ? '微信' : b.source === 'ocr' ? '识别' : ''
        });
      });
      const groupedBills = Object.values(groupMap).sort((a, b) => b.date.localeCompare(a.date));
      groupedBills.forEach(g => {
        g.dayExpense = formatMoney(g.dayExpense);
        g.dayIncome = formatMoney(g.dayIncome);
      });

      this.setData({
        groupedBills,
        expenseTotal: formatMoney(expense),
        incomeTotal: formatMoney(income),
        netTotal: formatMoney(income - expense)
      });
    } catch (e) {
      console.error('加载账单失败', e);
    }
  },

  formatDayText(dateStr) {
    const d = new Date(dateStr);
    const now = new Date();
    if (formatDate(now) === dateStr) return '今天';
    const y = new Date(); y.setDate(now.getDate() - 1);
    if (formatDate(y) === dateStr) return '昨天';
    return (d.getMonth() + 1) + '月' + d.getDate() + '日';
  },

  onTapBill(e) {
    wx.navigateTo({ url: '/pages/add/add?id=' + e.currentTarget.dataset.id });
  }
});
