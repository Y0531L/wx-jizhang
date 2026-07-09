// pages/ledger-detail/ledger-detail.js
const app = getApp();
const { call } = require('../../utils/cloud.js');
const { formatMoney } = require('../../utils/format.js');
const { formatFriendly } = require('../../utils/date.js');

Page({
  data: {
    ledgerId: '',
    ledger: {},
    members: [],
    bills: [],
    totalExpense: '0.00',
    isOwner: false,
    showInviteModal: false,
    inviteTip: ''
  },

  onLoad(options) {
    this.setData({ ledgerId: options.id });
  },

  onShow() {
    if (this.data.ledgerId) this.loadData();
  },

  async loadData() {
    try {
      const data = await call('ledger', { action: 'detail', id: this.data.ledgerId });
      const myOpenid = app.globalData.openid;
      const members = (data.members || []).map(m => ({
        ...m,
        isMe: m.openid === myOpenid
      }));
      const bills = (data.bills || []).map(b => ({
        ...b,
        amountText: formatMoney(b.amount),
        timeText: formatFriendly(b.date)
      }));
      this.setData({
        ledger: data.ledger || {},
        members,
        bills,
        totalExpense: formatMoney(data.totalExpense || 0),
        isOwner: (data.ledger && data.ledger.ownerOpenid) === myOpenid
      });
    } catch (e) {
      console.error('加载账本详情失败', e);
    }
  },

  showInvite() {
    const code = this.data.ledger.code || '';
    if (!code) return;
    this.setData({
      showInviteModal: true,
      inviteTip: '邀请好友加入「' + (this.data.ledger.name || '共享账本') + '」，一起记账吧！'
    });
  },

  closeInviteModal() {
    this.setData({ showInviteModal: false });
  },

  noop() {
    // 阻止邀请弹窗点击冒泡关闭
    return;
  },

  copyCode() {
    const code = this.data.ledger.code || '';
    wx.setClipboardData({
      data: code,
      success: () => {
        wx.showToast({ title: '邀请码已复制', icon: 'success' });
      }
    });
  },

  onShareAppMessage() {
    const code = this.data.ledger.code || '';
    const name = this.data.ledger.name || '共享账本';
    return {
      title: '邀请你加入「' + name + '」',
      desc: '一起记账、共享账单，让每一笔支出都有迹可循',
      path: '/pages/ledger/ledger?code=' + code,
      imageUrl: '/images/default-avatar.png'
    };
  }

  removeMember(e) {
    const openid = e.currentTarget.dataset.openid;
    wx.showModal({
      title: '移除成员',
      content: '确定将该成员移出账本吗？',
      confirmColor: '#ff3b30',
      success: async (r) => {
        if (r.confirm) {
          wx.showLoading({ title: '处理中' });
          try {
            await call('ledger', { action: 'removeMember', id: this.data.ledgerId, openid });
            wx.hideLoading();
            wx.showToast({ title: '已移除', icon: 'success' });
            this.loadData();
          } catch (e) {
            wx.hideLoading();
          }
        }
      }
    });
  },

  rename() {
    wx.showModal({
      title: '重命名',
      editable: true,
      placeholderText: this.data.ledger.name,
      success: async (r) => {
        if (r.confirm && r.content) {
          await call('ledger', { action: 'rename', id: this.data.ledgerId, name: r.content.trim() });
          wx.showToast({ title: '已修改', icon: 'success' });
          this.loadData();
        }
      }
    });
  },

  exitLedger() {
    wx.showModal({
      title: '退出账本',
      content: '退出后将无法查看该账本的账单，确定退出吗？',
      confirmColor: '#ff3b30',
      success: async (r) => {
        if (r.confirm) {
          await call('ledger', { action: 'exit', id: this.data.ledgerId });
          wx.showToast({ title: '已退出', icon: 'success' });
          setTimeout(() => wx.navigateBack(), 800);
        }
      }
    });
  },

  dissolveLedger() {
    wx.showModal({
      title: '解散账本',
      content: '解散后账本内所有账单将无法恢复，确定解散吗？',
      confirmColor: '#ff3b30',
      success: async (r) => {
        if (r.confirm) {
          await call('ledger', { action: 'dissolve', id: this.data.ledgerId });
          wx.showToast({ title: '已解散', icon: 'success' });
          setTimeout(() => wx.navigateBack(), 800);
        }
      }
    });
  }
});
