// pages/achievement/achievement.js
const { call } = require('../../utils/cloud.js');

const LEVEL_TITLES = [
  '记账小白', '记账新手', '记账达人', '记账专家', '记账大师',
  '账本王者', '财务宗师', '财神转世'
];

Page({
  data: {
    level: 1,
    levelTitle: '记账小白',
    streakDays: 0,
    totalBills: 0,
    achievementCount: 0,
    expPercent: 0,
    expToNext: 100,
    groups: []
  },

  onShow() {
    this.loadData();
  },

  async loadData() {
    try {
      const data = await call('achievement', { action: 'status' });
      const groups = this.mergeAchievement(data.achievements || [], data.unlocked || {});
      const total = (data.achievements || []).length;
      const unlockedCount = Object.keys(data.unlocked || {}).length;
      const level = data.level || 1;
      this.setData({
        level,
        levelTitle: LEVEL_TITLES[Math.min(level - 1, LEVEL_TITLES.length - 1)],
        streakDays: data.streakDays || 0,
        totalBills: data.totalBills || 0,
        achievementCount: unlockedCount,
        expPercent: data.expPercent || 0,
        expToNext: data.expToNext || 100,
        groups
      });
    } catch (e) {
      console.error('加载成就失败', e);
    }
  },

  mergeAchievement(defs, unlocked) {
    const groupMap = {};
    defs.forEach(def => {
      const g = def.group || '其他';
      if (!groupMap[g]) groupMap[g] = { key: g, title: g, items: [] };
      const u = unlocked[def.code];
      groupMap[g].items.push({
        ...def,
        unlocked: !!u,
        progress: def.maxValue ? Math.round(((def.currentValue || 0) / def.maxValue) * 100) : 0
      });
    });
    return Object.values(groupMap);
  },

  showDetail(e) {
    const item = e.currentTarget.dataset.item;
    const title = item.unlocked ? '🎉 ' + item.name : '🔒 ' + item.name;
    const content = item.unlocked
      ? item.desc + '\n解锁时间：' + (item.unlockedAt || '')
      : (item.hint || item.desc) + '\n进度：' + (item.progress || 0) + '%';
    wx.showModal({ title, content, showCancel: false, confirmText: '知道了' });
  }
});
