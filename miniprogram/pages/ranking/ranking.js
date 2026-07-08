// pages/ranking/ranking.js
const app = getApp();
const { call } = require('../../utils/cloud.js');
const { formatMoney } = require('../../utils/format.js');

Page({
  data: {
    period: 'week',
    dim: 'expense',
    rankList: [],
    myInfo: {},
    myRank: 0,
    myValueText: '0.00'
  },

  onShow() {
    this.loadRanking();
  },

  switchPeriod(e) {
    this.setData({ period: e.currentTarget.dataset.p }, () => this.loadRanking());
  },

  switchDim(e) {
    this.setData({ dim: e.currentTarget.dataset.d }, () => this.loadRanking());
  },

  async loadRanking() {
    try {
      const data = await call('ranking', { period: this.data.period, dim: this.data.dim });
      const list = data.list || [];
      const dimText = {
        expense: '支出',
        income: '收入',
        save: '结余',
        count: '记账笔数'
      }[this.data.dim];
      const rankList = list.map(item => {
        const val = item.value || 0;
        return {
          ...item,
          valueText: this.data.dim === 'count' ? val + '笔' : '¥' + formatMoney(val),
          subText: dimText + ' · ' + (item.billCount || 0) + '笔'
        };
      });
      const mine = data.mine || {};
      const myVal = mine.value || 0;
      this.setData({
        rankList,
        myInfo: app.globalData.userInfo || {},
        myRank: mine.rank || 0,
        myValueText: this.data.dim === 'count' ? myVal + '笔' : '¥' + formatMoney(myVal)
      });
    } catch (e) {
      console.error('加载排行失败', e);
    }
  },

  inviteFriend() {
    wx.showShareMenu({ withShareTicket: true });
    wx.showToast({ title: '点击右上角分享给好友', icon: 'none', duration: 2000 });
  },

  onShareAppMessage() {
    return {
      title: '来一起记账，看看谁更能攒钱！',
      path: '/pages/index/index',
      imageUrl: ''
    };
  }
});
