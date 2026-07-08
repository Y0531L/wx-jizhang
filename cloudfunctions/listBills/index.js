// cloudfunctions/listBills/index.js
// 账单查询、概览、导出、待补记提醒
const cloud = require('wx-server-sdk');
cloud.init({ env: cloud.DYNAMIC_CURRENT_ENV });
const db = cloud.database();
const _ = db.command;

exports.main = async (event, context) => {
  const { OPENID } = cloud.getWXContext();
  const action = event.action || 'recent';

  try {
    switch (action) {
      case 'overview':
        return getOverview(OPENID, event);
      case 'recent':
        return getRecent(OPENID, event.limit || 10);
      case 'month':
        return getMonthList(OPENID, event);
      case 'detail':
        return getDetail(OPENID, event.id);
      case 'export':
        return exportData(OPENID);
      case 'pendingReminders':
        return getPendingReminders(OPENID);
      default:
        return getRecent(OPENID, 10);
    }
  } catch (err) {
    console.error('[listBills] error', err);
    return { code: -1, message: err.message || '查询失败' };
  }
};

// 本月概览
async function getOverview(openid, { year, month }) {
  const { start, end } = getMonthRange(year, month);
  // 查询个人账单 + 参与的共享账本账单
  const ledgersRes = await db.collection('ledgers').where({ members: openid }).get();
  const ledgerIds = ledgersRes.data.map(l => l._id);

  const query = _.or([
    { _openid: openid, date: _.gte(start).and(_.lte(end)) },
    { ledgerId: _.in(ledgerIds), date: _.gte(start).and(_.lte(end)) }
  ]);

  const expenseRes = await db.collection('bills').where(
    _.and([query, { type: 'expense' }])
  ).get();
  const incomeRes = await db.collection('bills').where(
    _.and([query, { type: 'income' }])
  ).get();

  const expense = expenseRes.data.reduce((s, b) => s + b.amount, 0);
  const income = incomeRes.data.reduce((s, b) => s + b.amount, 0);

  return { code: 0, data: { expense, income } };
}

// 最近账单
async function getRecent(openid, limit) {
  const ledgersRes = await db.collection('ledgers').where({ members: openid }).get();
  const ledgerIds = ledgersRes.data.map(l => l._id);

  const query = _.or([
    { _openid: openid },
    { ledgerId: _.in(ledgerIds) }
  ]);

  const res = await db.collection('bills').where(query)
    .orderBy('date', 'desc')
    .orderBy('createdAt', 'desc')
    .limit(limit)
    .get();

  return { code: 0, data: res.data };
}

// 按月列表
async function getMonthList(openid, { year, month, type }) {
  const { start, end } = getMonthRange(year, month);
  const ledgersRes = await db.collection('ledgers').where({ members: openid }).get();
  const ledgerIds = ledgersRes.data.map(l => l._id);

  let baseQuery = _.or([
    { _openid: openid, date: _.gte(start).and(_.lte(end)) },
    { ledgerId: _.in(ledgerIds), date: _.gte(start).and(_.lte(end)) }
  ]);

  if (type && type !== 'all') {
    baseQuery = _.and([baseQuery, { type }]);
  }

  const res = await db.collection('bills').where(baseQuery)
    .orderBy('date', 'desc')
    .orderBy('createdAt', 'desc')
    .limit(500)
    .get();

  const bills = res.data;
  const expense = bills.filter(b => b.type === 'expense').reduce((s, b) => s + b.amount, 0);
  const income = bills.filter(b => b.type === 'income').reduce((s, b) => s + b.amount, 0);

  return { code: 0, data: { bills, expense, income } };
}

// 详情
async function getDetail(openid, id) {
  const res = await db.collection('bills').doc(id).get();
  return { code: 0, data: res.data };
}

// 导出 CSV
async function exportData(openid) {
  const res = await db.collection('bills').where({ _openid: openid })
    .orderBy('date', 'desc')
    .limit(1000)
    .get();

  const header = '日期,时间,类型,分类,金额,备注,来源\n';
  const rows = res.data.map(b => {
    const t = b.type === 'expense' ? '支出' : '收入';
    const note = (b.note || '').replace(/,/g, '，').replace(/\n/g, ' ');
    const source = b.source === 'wxpay' ? '微信支付' : b.source === 'ocr' ? '截图识别' : '手动';
    return [b.date, b.time || '', t, b.categoryName || '', b.amount, note, source].join(',');
  }).join('\n');

  return { code: 0, data: { csv: header + rows } };
}

// 待补记提醒
// 来源：OCR 识别但未确认记账的项，或用户手动标记的待补记
async function getPendingReminders(openid) {
  const res = await db.collection('reminders').where({
    _openid: openid,
    status: 'pending'
  }).orderBy('time', 'desc').limit(20).get();

  return { code: 0, data: res.data };
}

// 工具：获取月份范围
function getMonthRange(year, month) {
  const start = new Date(year, month - 1, 1);
  const end = new Date(year, month, 0, 23, 59, 59);
  return {
    start: start.toISOString().slice(0, 10),
    end: end.toISOString().slice(0, 10)
  };
}
