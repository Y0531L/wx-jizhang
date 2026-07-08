// pages/profile/profile.js
const app = getApp();
const { call } = require('../../utils/cloud.js');

const LEVEL_TITLES = ['记账小白', '记账新手', '记账达人', '记账专家', '记账大师', '账本王者', '财务宗师', '财神转世'];

Page({
  data: {
    userInfo: null,
    level: 1,
    levelTitle: '记账小白',
    achievementCount: 0,
    totalBills: 0,
    streakDays: 0,
    ledgerCount: 0,
    remindText: '未开启'
  },

  onShow() {
    this.loadProfile();
  },

  async loadProfile() {
    if (!app.globalData.openid) {
      app.userReadyCallback = () => this.loadProfile();
      return;
    }
    try {
      const data = await call('achievement', { action: 'status' });
      this.setData({
        userInfo: app.globalData.userInfo,
        level: data.level || 1,
        levelTitle: LEVEL_TITLES[Math.min((data.level || 1) - 1, LEVEL_TITLES.length - 1)],
        achievementCount: data.achievementCount || 0,
        totalBills: data.totalBills || 0,
        streakDays: data.streakDays || 0,
        ledgerCount: data.ledgerCount || 0,
        remindText: data.remindEnabled ? '已开启' : '未开启'
      });
    } catch (e) {
      console.error('加载个人数据失败', e);
    }
  },

  loginIfNeeded() {
    if (this.data.userInfo) return;
    wx.getUserProfile({
      desc: '用于完善个人资料',
      success: (res) => {
        const userInfo = res.userInfo;
        app.globalData.userInfo = userInfo;
        // 保存到云数据库
        call('login', { action: 'saveProfile', userInfo }).then(() => {
          this.setData({ userInfo });
        });
      }
    });
  },

  goRemind() {
    wx.showActionSheet({
      itemList: ['开启每日提醒', '关闭提醒', '设置提醒时间'],
      success: (res) => {
        if (res.tapIndex === 0) {
          this.subscribeRemind();
        } else if (res.tapIndex === 1) {
          this.toggleRemind(false);
        } else if (res.tapIndex === 2) {
          this.pickRemindTime();
        }
      }
    });
  },

  subscribeRemind() {
    // 请求订阅消息
    wx.requestSubscribeMessage({
      tmplIds: ['-8T7_AtBaeBRDhkyOGL2ADRPFy_jHy6qw-8Tf_ffVzA'], // 订阅消息模板ID
      success: () => {
        this.toggleRemind(true);
      },
      fail: () => {
        wx.showToast({ title: '需要授权才能提醒', icon: 'none' });
      }
    });
  },

  async toggleRemind(enabled) {
    try {
      await call('login', { action: 'setRemind', enabled });
      this.setData({ remindText: enabled ? '已开启' : '未开启' });
      wx.showToast({ title: enabled ? '已开启提醒' : '已关闭提醒', icon: 'success' });
    } catch (e) {}
  },

  pickRemindTime() {
    wx.showActionSheet({
      itemList: ['08:00 早安记账', '12:00 午间记账', '20:00 晚间记账', '22:00 睡前记账'],
      success: async (res) => {
        const times = ['08:00', '12:00', '20:00', '22:00'];
        const time = times[res.tapIndex];
        await call('login', { action: 'setRemindTime', time });
        wx.showToast({ title: '已设置 ' + time, icon: 'success' });
      }
    });
  },

  goLedger() { wx.navigateTo({ url: '/pages/ledger/ledger' }); },
  goAchievement() { wx.navigateTo({ url: '/pages/achievement/achievement' }); },
  goCategory() { wx.navigateTo({ url: '/pages/category/category' }); },

  async exportData() {
    wx.showLoading({ title: '生成中' });
    try {
      const data = await call('listBills', { action: 'export' });
      wx.hideLoading();
      wx.setClipboardData({
        data: data.csv,
        success: () => {
          wx.showModal({
            title: '导出成功',
            content: '账单已复制到剪贴板（CSV格式），可粘贴到 Excel/表格中查看。',
            showCancel: false
          });
        }
      });
    } catch (e) {
      wx.hideLoading();
    }
  },

  clearData() {
    wx.showModal({
      title: '⚠️ 清空数据',
      content: '此操作将删除你的所有账单、成就数据，且不可恢复！确定继续吗？',
      confirmText: '我确定',
      confirmColor: '#ff3b30',
      success: async (r) => {
        if (r.confirm) {
          wx.showModal({
            title: '再次确认',
            content: '真的要清空所有数据吗？这是最后一步，无法撤销！',
            confirmText: '清空',
            confirmColor: '#ff3b30',
            success: async (r2) => {
              if (r2.confirm) {
                wx.showLoading({ title: '清空中' });
                try {
                  await call('login', { action: 'clearData' });
                  wx.hideLoading();
                  wx.showToast({ title: '已清空', icon: 'success' });
                  this.loadProfile();
                } catch (e) {
                  wx.hideLoading();
                }
              }
            }
          });
        }
      }
    });
  },

  showAbout() {
    wx.showModal({
      title: '关于记账小程序',
      content: '一个支持微信支付自动记账、多平台提醒、好友排行、成就系统、多人协同的记账工具。\n\nv1.0.0',
      showCancel: false,
      confirmText: '知道了'
    });
  }
});
