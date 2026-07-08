// cloudfunctions/stats/index.js
// 统计：趋势、分类占比、收支对比
const cloud = require('wx-server-sdk');
cloud.init({ env: cloud.DYNAMIC_CURRENT_ENV });
const db = cloud.database();
const _ = db.command;

exports.main = async (event, context) => {
  const { OPENID } = cloud.getWXContext();
  const action = event.action || 'trend';

  try {
    switch (action) {
      case 'trend':
        return getTrend(OPENID, event.type);
      case 'category':
        return getCategoryStats(OPENID, event.type);
      case 'compare':
        return getCompare(OPENID);
      default:
        return getTrend(OPENID, 'expense');
    }
  } catch (err) {
    console.error('[stats] error', err);
    return { code: -1, message: err.message };
  }
};

// 近6个月趋势
async function getTrend(openid, type) {
  const now = new Date();
  const trend = [];
  for (let i = 5; i >= 0; i--) {
    const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
    const year = d.getFullYear();
    const month = d.getMonth() + 1;
    const start = new Date(year, month - 1, 1);
    const end = new Date(year, month, 0, 23, 59, 59);
    const startDate = start.toISOString().slice(0, 10);
    const endDate = end.toISOString().slice(0, 10);

    const res = await db.collection('bills').where({
      _openid: openid,
      type,
      date: _.gte(startDate).and(_.lte(endDate))
    }).get();

    const amount = res.data.reduce((s, b) => s + b.amount, 0);
    trend.push({ month: month + '月', amount });
  }
  return { code: 0, data: { trend } };
}

// 分类占比
async function getCategoryStats(openid, type) {
  const now = new Date();
  const start = new Date(now.getFullYear(), now.getMonth(), 1);
  const end = new Date(now.getFullYear(), now.getMonth() + 1, 0, 23, 59, 59);
  const startDate = start.toISOString().slice(0, 10);
  const endDate = end.toISOString().slice(0, 10);

  const res = await db.collection('bills').where({
    _openid: openid,
    type,
    date: _.gte(startDate).and(_.lte(endDate))
  }).get();

  const map = {};
  res.data.forEach(b => {
    const key = b.category || 'other';
    if (!map[key]) {
      map[key] = { id: key, name: b.categoryName || '其他', amount: 0 };
    }
    map[key].amount += b.amount;
  });

  const categories = Object.values(map).sort((a, b) => b.amount - a.amount);
  return { code: 0, data: { categories } };
}

// 近3个月收支对比
async function getCompare(openid) {
  const now = new Date();
  const compare = [];
  for (let i = 2; i >= 0; i--) {
    const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
    const year = d.getFullYear();
    const month = d.getMonth() + 1;
    const start = new Date(year, month - 1, 1);
    const end = new Date(year, month, 0, 23, 59, 59);
    const startDate = start.toISOString().slice(0, 10);
    const endDate = end.toISOString().slice(0, 10);

    const expenseRes = await db.collection('bills').where({
      _openid: openid, type: 'expense',
      date: _.gte(startDate).and(_.lte(endDate))
    }).get();
    const incomeRes = await db.collection('bills').where({
      _openid: openid, type: 'income',
      date: _.gte(startDate).and(_.lte(endDate))
    }).get();

    compare.push({
      month: month + '月',
      expense: expenseRes.data.reduce((s, b) => s + b.amount, 0),
      income: incomeRes.data.reduce((s, b) => s + b.amount, 0)
    });
  }
  return { code: 0, data: { compare } };
}
