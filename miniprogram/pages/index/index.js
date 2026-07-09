// pages/index/index.js
const app = getApp();
const { call } = require('../../utils/cloud.js');
const { formatMoney } = require('../../utils/format.js');
const { formatFriendly } = require('../../utils/date.js');

Page({
  data: {
    currentYear: 0,
    currentMonth: 0,
    monthExpense: '0.00',
    monthIncome: '0.00',
    monthNet: '0.00',
    recentBills: [],
    pendingReminders: []
  },

  onLoad() {
    const now = new Date();
    this.setData({
      currentYear: now.getFullYear(),
      currentMonth: now.getMonth() + 1
    });
    if (app.globalData.openid) {
      this.loadData();
    } else {
      app.userReadyCallback = () => this.loadData();
    }
  },

  onShow() {
    if (app.globalData.openid) {
      this.loadData();
      this.checkSubscribeReminder();
    }
  },

  // 主动引导用户开启订阅消息（一次性订阅需用户授权后才能推送）
  checkSubscribeReminder() {
    const userInfo = app.globalData.userInfo;
    if (!userInfo) return;
    // 已开启提醒的不重复打扰
    if (userInfo.remindEnabled) return;

    const today = new Date().toISOString().slice(0, 10);
    const last = wx.getStorageSync('lastSubscribeRequestDate');
    if (last === today) return; // 今天已经请求过

    wx.showModal({
      title: '开启记账提醒',
      content: '开启后，每天定时收到记账提醒、排行变化和成就达成通知，不错过每一笔记录。',
      confirmText: '开启提醒',
      cancelText: '暂不',
      success: (res) => {
        if (res.confirm) {
          this.requestSubscribeAndEnable();
        }
      },
      complete: () => {
        wx.setStorageSync('lastSubscribeRequestDate', today);
      }
    });
  },

  requestSubscribeAndEnable() {
    wx.requestSubscribeMessage({
      tmplIds: ['-8T7_AtBaeBRDhkyOGL2ADRPFy_jHy6qw-8Tf_ffVzA'],
      success: (res) => {
        const status = res['-8T7_AtBaeBRDhkyOGL2ADRPFy_jHy6qw-8Tf_ffVzA'];
        if (status === 'accept') {
          call('login', { action: 'setRemind', enabled: true }).then(() => {
            if (app.globalData.userInfo) {
              app.globalData.userInfo.remindEnabled = true;
            }
            wx.showToast({ title: '提醒已开启', icon: 'success' });
          });
        } else {
          wx.showToast({ title: '需要授权才能提醒', icon: 'none' });
        }
      },
      fail: () => {
        wx.showToast({ title: '授权失败', icon: 'none' });
      }
    });
  },

  async loadData() {
    this.loadOverview();
    this.loadRecentBills();
    this.loadReminders();
  },

  async loadOverview() {
    try {
      const data = await call('listBills', {
        action: 'overview',
        year: this.data.currentYear,
        month: this.data.currentMonth
      });
      const expense = data.expense || 0;
      const income = data.income || 0;
      this.setData({
        monthExpense: formatMoney(expense),
        monthIncome: formatMoney(income),
        monthNet: formatMoney(income - expense)
      });
    } catch (e) {
      console.error('加载概览失败', e);
    }
  },

  async loadRecentBills() {
    try {
      const list = await call('listBills', { action: 'recent', limit: 10 });
      const categories = this.getCategoryMap();
      const recentBills = (list || []).map(b => {
        const cat = categories[b.category] || { name: '其他', icon: '📝' };
        return {
          ...b,
          categoryName: cat.name,
          categoryIcon: cat.icon,
          amountText: formatMoney(b.amount),
          timeText: formatFriendly(b.date),
          sourceText: b.source === 'wxpay' ? '微信支付' :
                      b.source === 'ocr' ? '截图识别' : '手动记账'
        };
      });
      this.setData({ recentBills });
    } catch (e) {
      console.error('加载账单失败', e);
    }
  },

  async loadReminders() {
    try {
      const list = await call('listBills', { action: 'pendingReminders' });
      const reminders = (list || []).map(r => ({
        ...r,
        timeText: formatFriendly(r.time)
      }));
      this.setData({ pendingReminders: reminders });
    } catch (e) {
      console.error('加载提醒失败', e);
    }
  },

  getCategoryMap() {
    const map = {};
    const cats = app.globalData.categories;
    [...cats.expense, ...cats.income].forEach(c => { map[c.id] = c; });
    return map;
  },

  goAdd() { wx.navigateTo({ url: '/pages/add/add' }); },
  goBills() { wx.navigateTo({ url: '/pages/bills/bills' }); },
  goScan() { wx.navigateTo({ url: '/pages/scan/scan' }); },
  goLedger() { wx.navigateTo({ url: '/pages/ledger/ledger' }); },
  goAchievement() { wx.navigateTo({ url: '/pages/achievement/achievement' }); },
  goCategory() { wx.navigateTo({ url: '/pages/category/category' }); },

  onTapBill(e) {
    const id = e.currentTarget.dataset.id;
    wx.navigateTo({ url: '/pages/add/add?id=' + id });
  },

  onTapReminder(e) {
    const item = e.currentTarget.dataset.item;
    wx.navigateTo({
      url: '/pages/add/add?reminder=' + encodeURIComponent(JSON.stringify(item))
    });
  }
});
