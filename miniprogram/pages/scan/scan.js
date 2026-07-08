// pages/scan/scan.js
const { call } = require('../../utils/cloud.js');
const { formatMoney } = require('../../utils/format.js');

Page({
  data: {
    platform: 'auto',
    platformText: '自动识别',
    imageUrl: '',
    fileId: '',
    loading: false,
    result: null
  },

  setPlatform(e) {
    const p = e.currentTarget.dataset.p;
    const text = { alipay: '支付宝', unionpay: '云闪付', bank: '银行App', auto: '自动识别' }[p];
    this.setData({ platform: p, platformText: text, result: null });
  },

  chooseImage() {
    wx.chooseMedia({
      count: 1,
      mediaType: ['image'],
      sourceType: ['album', 'camera'],
      success: (res) => {
        const tempPath = res.tempFiles[0].tempFilePath;
        this.setData({ imageUrl: tempPath, result: null });
        this.uploadImage(tempPath);
      }
    });
  },

  async uploadImage(tempPath) {
    wx.showLoading({ title: '上传中' });
    try {
      const cloudPath = 'ocr/' + Date.now() + '-' + Math.floor(Math.random() * 10000) + '.png';
      const uploadRes = await wx.cloud.uploadFile({
        cloudPath,
        filePath: tempPath
      });
      this.setData({ fileId: uploadRes.fileID });
      wx.hideLoading();
    } catch (e) {
      wx.hideLoading();
      wx.showToast({ title: '上传失败', icon: 'none' });
    }
  },

  async startOCR() {
    if (!this.data.fileId) {
      wx.showToast({ title: '图片未上传', icon: 'none' });
      return;
    }
    this.setData({ loading: true });
    try {
      const data = await call('ocrBill', {
        fileId: this.data.fileId,
        platform: this.data.platform
      });
      const items = (data.items || []).map(item => ({
        ...item,
        amountText: formatMoney(item.amount || 0),
        timeText: item.time || ''
      }));
      this.setData({
        loading: false,
        result: { items, confidence: data.confidence || 0.5 }
      });
    } catch (e) {
      this.setData({ loading: false });
      wx.showToast({ title: '识别失败，请重试', icon: 'none' });
    }
  },

  confirmItem(e) {
    const item = e.currentTarget.dataset.item;
    // 直接记账
    this.createBillFromItem(item, true);
  },

  editItem(e) {
    const item = e.currentTarget.dataset.item;
    // 跳转到记账页编辑
    const params = {
      amount: item.amount,
      note: (item.platform || '') + (item.merchant ? ' ' + item.merchant : ''),
      source: 'ocr',
      sourceTag: '截图识别 · ' + (item.platform || this.data.platformText)
    };
    wx.navigateTo({
      url: '/pages/add/add?reminder=' + encodeURIComponent(JSON.stringify(params))
    });
  },

  async createBillFromItem(item, navigateBack) {
    wx.showLoading({ title: '记账中' });
    try {
      await call('addBill', {
        type: 'expense',
        amount: item.amount,
        category: 'other_expense',
        categoryName: '其他',
        categoryIcon: '📝',
        note: (item.platform || '') + (item.merchant ? ' ' + item.merchant : ''),
        date: item.date || '',
        time: item.time || '',
        source: 'ocr'
      });
      wx.hideLoading();
      wx.showToast({ title: '已记账 ¥' + formatMoney(item.amount), icon: 'success' });
      if (navigateBack) {
        setTimeout(() => wx.navigateBack(), 1000);
      }
    } catch (e) {
      wx.hideLoading();
    }
  }
});
