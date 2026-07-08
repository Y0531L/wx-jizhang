// pages/add/add.js
const app = getApp();
const { call } = require('../../utils/cloud.js');
const { formatMoney } = require('../../utils/format.js');
const { formatDate, pad } = require('../../utils/date.js');

Page({
  data: {
    type: 'expense',
    amount: '',
    amountFocus: true,
    category: '',
    categoryName: '',
    categoryIcon: '',
    note: '',
    date: '',
    dateText: '',
    time: '',
    timeText: '',
    showTime: false,
    ledgerId: '',
    ledgerName: '',
    ledgers: [],
    currentCategories: [],
    editId: '',
    source: 'manual',
    sourceTag: ''
  },

  onLoad(options) {
    const now = new Date();
    const date = formatDate(now);
    const time = pad(now.getHours()) + ':' + pad(now.getMinutes());
    this.setData({
      date,
      dateText: this.formatDateText(now),
      time,
      timeText,
      currentCategories: app.globalData.categories.expense,
      category: app.globalData.categories.expense[0].id,
      categoryName: app.globalData.categories.expense[0].name,
      categoryIcon: app.globalData.categories.expense[0].icon
    });

    // 编辑模式
    if (options.id) {
      this.loadBill(options.id);
    }

    // 从提醒进入，预填
    if (options.reminder) {
      try {
        const r = JSON.parse(decodeURIComponent(options.reminder));
        this.setData({
          type: 'expense',
          amount: String(r.amount || ''),
          note: r.platform + ' 待补记',
          source: 'manual',
          sourceTag: r.platform + ' · ' + formatMoney(r.amount)
        });
      } catch (e) {}
    }

    this.loadLedgers();
  },

  // 加载账单（编辑）
  async loadBill(id) {
    try {
      const bill = await call('listBills', { action: 'detail', id });
      if (bill) {
        const cats = app.globalData.categories[bill.type] || [];
        const cat = cats.find(c => c.id === bill.category) || cats[0] || {};
        this.setData({
          editId: id,
          type: bill.type,
          amount: String(bill.amount),
          category: bill.category,
          categoryName: cat.name,
          categoryIcon: cat.icon,
          note: bill.note || '',
          date: formatDate(bill.date),
          dateText: this.formatDateText(new Date(bill.date)),
          time: bill.time || '',
          timeText: bill.time || '',
          showTime: !!bill.time,
          ledgerId: bill.ledgerId || '',
          source: bill.source || 'manual',
          sourceTag: bill.source === 'wxpay' ? '微信支付自动记账' :
                     bill.source === 'ocr' ? '截图识别' : ''
        });
      }
    } catch (e) {
      console.error('加载账单失败', e);
    }
  },

  // 加载共享账本
  async loadLedgers() {
    try {
      const list = await call('ledger', { action: 'myList' });
      this.setData({ ledgers: list || [] });
    } catch (e) {}
  },

  switchType(e) {
    const type = e.currentTarget.dataset.type;
    const cats = app.globalData.categories[type];
    this.setData({
      type,
      currentCategories: cats,
      category: cats[0].id,
      categoryName: cats[0].name,
      categoryIcon: cats[0].icon
    });
  },

  onAmountInput(e) {
    this.setData({ amount: e.detail.value });
  },

  onNoteInput(e) {
    this.setData({ note: e.detail.value });
  },

  selectCategory(e) {
    const { id, name, icon } = e.currentTarget.dataset;
    this.setData({ category: id, categoryName: name, categoryIcon: icon });
  },

  pickDate() {
    const cur = this.data.date.split('-');
    wx.showActionSheet({
      itemList: ['今天', '昨天', '前天', '选择日期'],
      success: (res) => {
        const now = new Date();
        if (res.tapIndex === 0) {
          this.setDate(now);
        } else if (res.tapIndex === 1) {
          const d = new Date(); d.setDate(d.getDate() - 1);
          this.setDate(d);
        } else if (res.tapIndex === 2) {
          const d = new Date(); d.setDate(d.getDate() - 2);
          this.setDate(d);
        } else if (res.tapIndex === 3) {
          wx.showModal && null;
          // 使用 date picker
        }
      }
    });
    // 简化：直接弹出日期选择
    setTimeout(() => {
      this._pickDatePicker();
    }, 0);
  },

  _pickDatePicker() {
    wx.showToast({ title: '请选择日期', icon: 'none', duration: 600 });
  },

  setDate(d) {
    this.setData({
      date: formatDate(d),
      dateText: this.formatDateText(d)
    });
  },

  formatDateText(d) {
    const now = new Date();
    const today = formatDate(now);
    const yesterday = new Date(now); yesterday.setDate(now.getDate() - 1);
    const dayBefore = new Date(now); dayBefore.setDate(now.getDate() - 2);
    const ds = formatDate(d);
    if (ds === today) return '今天';
    if (ds === formatDate(yesterday)) return '昨天';
    if (ds === formatDate(dayBefore)) return '前天';
    return (d.getMonth() + 1) + '月' + d.getDate() + '日';
  },

  pickTime() {
    // 简化处理
    const now = new Date();
    const t = pad(now.getHours()) + ':' + pad(now.getMinutes());
    this.setData({ time: t, timeText: t, showTime: true });
  },

  pickLedger() {
    if (this.data.ledgers.length === 0) return;
    const items = ['个人账本', ...this.data.ledgers.map(l => l.name)];
    wx.showActionSheet({
      itemList: items,
      success: (res) => {
        if (res.tapIndex === 0) {
          this.setData({ ledgerId: '', ledgerName: '' });
        } else {
          const l = this.data.ledgers[res.tapIndex - 1];
          this.setData({ ledgerId: l._id, ledgerName: l.name });
        }
      }
    });
  },

  async save() {
    const { amount, type, category, categoryName, categoryIcon, note, date, time, ledgerId, editId, source } = this.data;
    const amt = parseFloat(amount);
    if (!amt || amt <= 0) {
      wx.showToast({ title: '请输入金额', icon: 'none' });
      return;
    }
    wx.showLoading({ title: '保存中' });
    try {
      await call('addBill', {
        id: editId || undefined,
        type,
        amount: amt,
        category,
        categoryName,
        categoryIcon,
        note,
        date,
        time,
        ledgerId,
        source
      });
      wx.hideLoading();
      wx.showToast({ title: '已保存', icon: 'success' });
      setTimeout(() => wx.navigateBack(), 800);
    } catch (e) {
      wx.hideLoading();
    }
  },

  deleteBill() {
    if (!this.data.editId) return;
    wx.showModal({
      title: '删除账单',
      content: '确定删除这笔账单吗？',
      confirmColor: '#ff3b30',
      success: async (res) => {
        if (res.confirm) {
          wx.showLoading({ title: '删除中' });
          try {
            await call('addBill', { action: 'delete', id: this.data.editId });
            wx.hideLoading();
            wx.showToast({ title: '已删除', icon: 'success' });
            setTimeout(() => wx.navigateBack(), 800);
          } catch (e) {
            wx.hideLoading();
          }
        }
      }
    });
  }
});
