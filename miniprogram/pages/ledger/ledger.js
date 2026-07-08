// pages/ledger/ledger.js
const app = getApp();
const { call } = require('../../utils/cloud.js');

Page({
  data: {
    ledgers: [],
    personalCount: 0
  },

  onShow() {
    this.loadData();
  },

  async loadData() {
    try {
      const data = await call('ledger', { action: 'list' });
      this.setData({
        ledgers: data.ledgers || [],
        personalCount: data.personalCount || 0
      });
    } catch (e) {
      console.error('加载账本失败', e);
    }
  },

  openPersonal() {
    app.globalData.currentLedgerId = '';
    wx.navigateBack();
  },

  createLedger() {
    wx.showActionSheet({
      itemList: ['🏠 家庭账本', '🎓 室友账本', '💼 团队账本', '✈️ 旅行账本', '📝 自定义'],
      success: (res) => {
        const presets = [
          { icon: '🏠', name: '家庭账本' },
          { icon: '🎓', name: '室友账本' },
          { icon: '💼', name: '团队账本' },
          { icon: '✈️', name: '旅行账本' },
          { icon: '📝', name: '' }
        ];
        const p = presets[res.tapIndex];
        if (res.tapIndex === 4) {
          wx.showModal({
            title: '创建账本',
            editable: true,
            placeholderText: '输入账本名称',
            success: (r) => {
              if (r.confirm && r.content) {
                this.doCreate('📝', r.content.trim());
              }
            }
          });
        } else {
          this.doCreate(p.icon, p.name);
        }
      }
    });
  },

  async doCreate(icon, name) {
    wx.showLoading({ title: '创建中' });
    try {
      const res = await call('ledger', { action: 'create', name, icon });
      wx.hideLoading();
      wx.showToast({ title: '创建成功', icon: 'success' });
      this.loadData();
    } catch (e) {
      wx.hideLoading();
    }
  },

  openLedger(e) {
    const id = e.currentTarget.dataset.id;
    wx.navigateTo({ url: '/pages/ledger-detail/ledger-detail?id=' + id });
  },

  scanJoin() {
    wx.scanCode({
      onlyFromCamera: false,
      success: (res) => {
        if (res.result && res.result.startsWith('ledger:')) {
          const code = res.result.replace('ledger:', '');
          this.joinByCode(code);
        } else {
          wx.showToast({ title: '无效的邀请码', icon: 'none' });
        }
      }
    });
  },

  async joinByCode(code) {
    wx.showLoading({ title: '加入中' });
    try {
      await call('ledger', { action: 'join', code });
      wx.hideLoading();
      wx.showToast({ title: '加入成功', icon: 'success' });
      this.loadData();
    } catch (e) {
      wx.hideLoading();
    }
  }
});
