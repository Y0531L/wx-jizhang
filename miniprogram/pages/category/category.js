// pages/category/category.js
const app = getApp();
const { call } = require('../../utils/cloud.js');

const ICONS = ['🍜', '🚌', '🛍️', '🏠', '🎮', '💊', '📚', '🍻', '✈️', '📱', '🐱', '📝', '💰', '🎁', '📈', '🧧', '💼', '☕', '🎬', '👕'];

Page({
  data: {
    tab: 'expense',
    list: []
  },

  onShow() {
    this.loadList();
  },

  switchTab(e) {
    this.setData({ tab: e.currentTarget.dataset.t }, () => this.loadList());
  },

  loadList() {
    const defaults = app.globalData.categories[this.data.tab] || [];
    const customs = app.globalData.customCategories && app.globalData.customCategories[this.data.tab] || [];
    const list = [
      ...defaults.map(c => ({ ...c, custom: false })),
      ...customs.map(c => ({ ...c, custom: true }))
    ];
    this.setData({ list });
  },

  addCategory() {
    wx.showActionSheet({
      itemList: ICONS.slice(0, 12).map(i => i),
      success: (res) => {
        const icon = ICONS[res.tapIndex];
        wx.showModal({
          title: '添加分类',
          editable: true,
          placeholderText: '输入分类名称',
          success: async (r) => {
            if (r.confirm && r.content) {
              const name = r.content.trim();
              const id = 'custom_' + this.data.tab + '_' + Date.now();
              try {
                await call('login', { action: 'addCategory', type: this.data.tab, id, name, icon });
                wx.showToast({ title: '已添加', icon: 'success' });
                this.loadList();
              } catch (e) {}
            }
          }
        });
      }
    });
  },

  deleteCategory(e) {
    const id = e.currentTarget.dataset.id;
    wx.showModal({
      title: '删除分类',
      content: '确定删除该自定义分类吗？',
      confirmColor: '#ff3b30',
      success: async (r) => {
        if (r.confirm) {
          try {
            await call('login', { action: 'deleteCategory', type: this.data.tab, id });
            wx.showToast({ title: '已删除', icon: 'success' });
            this.loadList();
          } catch (e) {}
        }
      }
    });
  }
});
