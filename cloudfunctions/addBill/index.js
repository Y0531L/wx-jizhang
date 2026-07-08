// cloudfunctions/addBill/index.js
// 账单增删改、微信支付自动记账
const cloud = require('wx-server-sdk');
cloud.init({ env: cloud.DYNAMIC_CURRENT_ENV });
const db = cloud.database();
const _ = db.command;

exports.main = async (event, context) => {
  const { OPENID } = cloud.getWXContext();
  const action = event.action || 'add';

  try {
    switch (action) {
      case 'add':
      case 'update':
        return saveBill(OPENID, event);
      case 'delete':
        return deleteBill(OPENID, event.id);
      case 'wxpayAutoRecord':
        // 微信支付回调自动记账（由支付回调云函数调用）
        return wxpayAutoRecord(event);
      default:
        return saveBill(OPENID, event);
    }
  } catch (err) {
    console.error('[addBill] error', err);
    return { code: -1, message: err.message || '保存失败' };
  }
};

// 保存（新增/编辑）账单
async function saveBill(openid, event) {
  const {
    id, type, amount, category, categoryName, categoryIcon,
    note, date, time, ledgerId, source
  } = event;

  if (!amount || amount <= 0) {
    return { code: -1, message: '金额无效' };
  }

  const billData = {
    type: type || 'expense',
    amount: Number(amount),
    category: category || 'other_expense',
    categoryName: categoryName || '其他',
    categoryIcon: categoryIcon || '📝',
    note: note || '',
    date: date || new Date().toISOString().slice(0, 10),
    time: time || '',
    ledgerId: ledgerId || '',
    source: source || 'manual',
    updatedAt: db.serverDate()
  };

  if (id) {
    // 编辑
    await db.collection('bills').doc(id).update({ data: billData });
    return { code: 0, data: { id } };
  }

  // 新增
  billData._openid = openid;
  billData.authorOpenid = openid;
  billData.createdAt = db.serverDate();
  // 获取作者昵称（用于共享账本显示）
  const userRes = await db.collection('users').where({ _openid: openid }).get();
  if (userRes.data.length > 0) {
    billData.authorName = userRes.data[0].nickName || '匿名';
  }

  const addRes = await db.collection('bills').add({ data: billData });

  // 异步更新成就（不阻塞返回）
  updateAchievementProgress(openid).catch(e => console.error('成就更新失败', e));

  return { code: 0, data: { id: addRes._id } };
}

// 删除账单
async function deleteBill(openid, id) {
  // 校验权限
  const billRes = await db.collection('bills').doc(id).get();
  if (!billRes.data) {
    return { code: -1, message: '账单不存在' };
  }
  // 个人账单或账本成员可删除
  if (billRes.data._openid !== openid && billRes.data.authorOpenid !== openid) {
    // 检查是否是账本成员
    if (billRes.data.ledgerId) {
      const ledgerRes = await db.collection('ledgers').doc(billRes.data.ledgerId).get();
      const ledger = ledgerRes.data;
      if (!ledger || !ledger.members.includes(openid)) {
        return { code: -1, message: '无权删除' };
      }
    } else {
      return { code: -1, message: '无权删除' };
    }
  }
  await db.collection('bills').doc(id).remove();
  return { code: 0, data: { id } };
}

// 微信支付自动记账
// 当用户在小程序内完成微信支付后，支付回调云函数调用此方法自动创建账单
async function wxpayAutoRecord(event) {
  const {
    openid, amount, outTradeNo, description,
    category, categoryName, categoryIcon, ledgerId
  } = event;

  // 检查是否已记录（避免重复）
  const existRes = await db.collection('bills').where({
    source: 'wxpay',
    wxpayTradeNo: outTradeNo
  }).get();

  if (existRes.data.length > 0) {
    return { code: 0, data: { id: existRes.data[0]._id, duplicated: true } };
  }

  const now = new Date();
  const billData = {
    _openid: openid,
    authorOpenid: openid,
    type: 'expense',
    amount: Number(amount),
    category: category || 'other_expense',
    categoryName: categoryName || '微信支付',
    categoryIcon: categoryIcon || '💚',
    note: description || '微信支付',
    date: now.toISOString().slice(0, 10),
    time: String(now.getHours()).padStart(2, '0') + ':' + String(now.getMinutes()).padStart(2, '0'),
    ledgerId: ledgerId || '',
    source: 'wxpay',
    wxpayTradeNo: outTradeNo,
    createdAt: db.serverDate(),
    updatedAt: db.serverDate()
  };

  const userRes = await db.collection('users').where({ _openid: openid }).get();
  if (userRes.data.length > 0) {
    billData.authorName = userRes.data[0].nickName || '匿名';
  }

  const addRes = await db.collection('bills').add({ data: billData });
  updateAchievementProgress(openid).catch(() => {});
  return { code: 0, data: { id: addRes._id } };
}

// 更新成就进度（简化版，详细逻辑在 achievement 云函数）
async function updateAchievementProgress(openid) {
  const billsRes = await db.collection('bills').where({ _openid: openid }).count();
  const totalBills = billsRes.total;
  // 每10笔账单 +10 经验
  const exp = Math.floor(totalBills / 10) * 10;
  const level = Math.floor(exp / 100) + 1;
  await db.collection('users').where({ _openid: openid }).update({
    data: { exp, level }
  });
}
