// utils/date.js - 日期工具
const pad = (n) => (n < 10 ? '0' + n : '' + n);

const formatDate = (date) => {
  const d = new Date(date);
  return d.getFullYear() + '-' + pad(d.getMonth() + 1) + '-' + pad(d.getDate());
};

const formatTime = (date) => {
  const d = new Date(date);
  return formatDate(date) + ' ' + pad(d.getHours()) + ':' + pad(d.getMinutes());
};

// 当月第一天 ~ 当月最后一天
const getMonthRange = (year, month) => {
  const start = new Date(year, month - 1, 1);
  const end = new Date(year, month, 0, 23, 59, 59);
  return { start, end };
};

// 友好时间：刚刚/ x分钟前 / 今天 hh:mm / 昨天 / MM-DD
const formatFriendly = (date) => {
  const d = new Date(date);
  const now = new Date();
  const diff = now - d;
  if (diff < 60000) return '刚刚';
  if (diff < 3600000) return Math.floor(diff / 60000) + '分钟前';
  if (formatDate(now) === formatDate(d)) {
    return '今天 ' + pad(d.getHours()) + ':' + pad(d.getMinutes());
  }
  const yesterday = new Date(now);
  yesterday.setDate(now.getDate() - 1);
  if (formatDate(yesterday) === formatDate(d)) return '昨天';
  return (d.getMonth() + 1) + '月' + d.getDate() + '日';
};

module.exports = { pad, formatDate, formatTime, getMonthRange, formatFriendly };
