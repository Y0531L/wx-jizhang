// app.js
App({
  globalData: {
    openid: '',
    userInfo: null,
    cloudEnv: 'cloud1-d1g9bo85dcae54a60', // 云开发环境ID
    currentLedgerId: '', // 当前选中的账本（空表示个人账本）
    categories: {
      expense: [
        { id: 'food', name: '餐饮', icon: '🍜' },
        { id: 'transport', name: '交通', icon: '🚌' },
        { id: 'shopping', name: '购物', icon: '🛍️' },
        { id: 'housing', name: '住房', icon: '🏠' },
        { id: 'entertainment', name: '娱乐', icon: '🎮' },
        { id: 'medical', name: '医疗', icon: '💊' },
        { id: 'education', name: '教育', icon: '📚' },
        { id: 'social', name: '社交', icon: '🍻' },
        { id: 'travel', name: '旅行', icon: '✈️' },
        { id: 'digital', name: '数码', icon: '📱' },
        { id: 'pet', name: '宠物', icon: '🐱' },
        { id: 'other_expense', name: '其他', icon: '📝' }
      ],
      income: [
        { id: 'salary', name: '工资', icon: '💰' },
        { id: 'bonus', name: '奖金', icon: '🎁' },
        { id: 'investment', name: '理财', icon: '📈' },
        { id: 'redpacket', name: '红包', icon: '🧧' },
        { id: 'parttime', name: '兼职', icon: '💼' },
        { id: 'refund', name: '退款', icon: '↩️' },
        { id: 'other_income', name: '其他', icon: '📝' }
      ]
    }
  },

  onLaunch() {
    if (!wx.cloud) {
      console.error('请使用 2.2.3 或以上的基础库以使用云开发能力');
      return;
    }
    wx.cloud.init({
      env: this.globalData.cloudEnv,
      traceUser: true
    });
    this.login();
  },

  // 登录获取 openid
  login() {
    wx.cloud.callFunction({
      name: 'login',
      data: {}
    }).then(res => {
      if (res.result && res.result.openid) {
        this.globalData.openid = res.result.openid;
        this.loadUserInfo();
      }
    }).catch(err => {
      console.error('登录失败', err);
    });
  },

  // 加载用户信息
  loadUserInfo() {
    const db = wx.cloud.database();
    db.collection('users').where({
      _openid: this.globalData.openid
    }).get().then(res => {
      if (res.data.length > 0) {
        this.globalData.userInfo = res.data[0];
        if (this.userReadyCallback) {
          this.userReadyCallback(res.data[0]);
        }
      }
    });
  }
});
