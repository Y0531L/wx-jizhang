// utils/format.js - 格式化工具
const formatMoney = (num) => {
  if (num === null || num === undefined || isNaN(num)) return '0.00';
  const n = Number(num);
  return n.toFixed(2);
};

// 带符号金额
const formatSignedMoney = (num, type) => {
  const m = formatMoney(num);
  if (type === 'income') return '+' + m;
  if (type === 'expense') return '-' + m;
  return m;
};

// 千分位
const formatWithComma = (num) => {
  const m = formatMoney(num);
  const [int, dec] = m.split('.');
  return int.replace(/\B(?=(\d{3})+(?!\d))/g, ',') + '.' + dec;
};

module.exports = { formatMoney, formatSignedMoney, formatWithComma };
