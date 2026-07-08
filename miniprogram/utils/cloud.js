// utils/cloud.js - 云函数调用封装
const call = (name, data = {}) => {
  return new Promise((resolve, reject) => {
    wx.cloud.callFunction({
      name,
      data,
      success: res => {
        if (res.result && res.result.code === 0) {
          resolve(res.result.data);
        } else {
          const msg = (res.result && res.result.message) || '请求失败';
          wx.showToast({ title: msg, icon: 'none' });
          reject(new Error(msg));
        }
      },
      fail: err => {
        wx.showToast({ title: '网络异常', icon: 'none' });
        reject(err);
      }
    });
  });
};

module.exports = { call };
