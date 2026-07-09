// pages/profile/profile.js
const app = getApp();
const { call } = require('../../utils/cloud.js');

const LEVEL_TITLES = ['记账小白', '记账新手', '记账达人', '记账专家', '记账大师', '账本王者', '财务宗师', '财神转世'];

const DEFAULT_AVATAR = '/images/default-avatar.png';
const DEFAULT_NICKNAME = '记账小助手';

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
      let userInfo = app.globalData.userInfo;
      // 兜底显示
      if (userInfo) {
        if (!userInfo.nickName) userInfo.nickName = DEFAULT_NICKNAME;
        if (!userInfo.avatarUrl) userInfo.avatarUrl = DEFAULT_AVATAR;
      }
      this.setData({
        userInfo,
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

  // 点击用户头像区域，选择头像
  chooseAvatar() {
    if (!this.data.userInfo) {
      this.loginIfNeeded();
      return;
    }
    wx.showActionSheet({
      itemList: ['使用默认头像', '使用微信头像', '从相册选择'],
      success: (res) => {
        if (res.tapIndex === 0) {
          this.updateAvatar(DEFAULT_AVATAR);
        } else if (res.tapIndex === 1) {
          this.useWechatAvatar();
        } else if (res.tapIndex === 2) {
          this.chooseFromAlbum();
        }
      }
    });
  },

  // 使用微信头像
  useWechatAvatar() {
    wx.getUserProfile({
      desc: '用于设置头像',
      success: (res) => {
        const avatarUrl = res.userInfo && res.userInfo.avatarUrl;
        if (avatarUrl) {
          this.updateAvatar(avatarUrl);
        } else {
          wx.showToast({ title: '未获取到头像', icon: 'none' });
        }
      },
      fail: () => {
        wx.showToast({ title: '请授权或使用相册选择', icon: 'none' });
      }
    });
  },

  // 从相册选择并上传云存储
  chooseFromAlbum() {
    wx.chooseMedia({
      count: 1,
      mediaType: ['image'],
      sourceType: ['album', 'camera'],
      success: (res) => {
        const tempFilePath = res.tempFiles[0].tempFilePath;
        wx.showLoading({ title: '上传中' });
        const cloudPath = `avatars/${app.globalData.openid}_${Date.now()}.jpg`;
        wx.cloud.uploadFile({
          cloudPath,
          filePath: tempFilePath,
          success: (uploadRes) => {
            this.updateAvatar(uploadRes.fileID);
          },
          fail: (err) => {
            wx.hideLoading();
            console.error('上传头像失败', err);
            wx.showToast({ title: '上传失败', icon: 'none' });
          }
        });
      }
    });
  },

  // 更新头像到数据库和本地状态
  async updateAvatar(avatarUrl) {
    wx.showLoading({ title: '保存中' });
    try {
      await call('login', { action: 'saveProfile', userInfo: { avatarUrl } });
      const userInfo = this.data.userInfo || {};
      userInfo.avatarUrl = avatarUrl;
      app.globalData.userInfo = userInfo;
      this.setData({ userInfo });
      wx.hideLoading();
      wx.showToast({ title: '头像已更新', icon: 'success' });
    } catch (e) {
      wx.hideLoading();
      wx.showToast({ title: '保存失败', icon: 'none' });
    }
  },

  // 修改昵称
  editNickname() {
    if (!this.data.userInfo) {
      this.loginIfNeeded();
      return;
    }
    wx.showModal({
      title: '修改昵称',
      editable: true,
      placeholderText: '请输入昵称',
      content: this.data.userInfo.nickName || '',
      success: async (res) => {
        if (res.confirm && res.content) {
          const nickName = res.content.trim();
          if (!nickName) return;
          wx.showLoading({ title: '保存中' });
          try {
            await call('login', { action: 'saveProfile', userInfo: { nickName } });
            const userInfo = this.data.userInfo || {};
            userInfo.nickName = nickName;
            app.globalData.userInfo = userInfo;
            this.setData({ userInfo });
            wx.hideLoading();
            wx.showToast({ title: '昵称已更新', icon: 'success' });
          } catch (e) {
            wx.hideLoading();
            wx.showToast({ title: '保存失败', icon: 'none' });
          }
        }
      }
    });
  },

  loginIfNeeded() {
    if (this.data.userInfo) return;
    wx.getUserProfile({
      desc: '用于完善个人资料',
      success: (res) => {
        const userInfo = res.userInfo;
        app.globalData.userInfo = userInfo;
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
