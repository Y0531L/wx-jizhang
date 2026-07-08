// cloudfunctions/ledger/index.js
// 共享账本管理
const cloud = require('wx-server-sdk');
cloud.init({ env: cloud.DYNAMIC_CURRENT_ENV });
const db = cloud.database();
const _ = db.command;

exports.main = async (event, context) => {
  const { OPENID } = cloud.getWXContext();
  const action = event.action || 'list';

  try {
    switch (action) {
      case 'list':
        return getMyLedgers(OPENID);
      case 'myList':
        return getMyLedgers(OPENID);
      case 'create':
        return createLedger(OPENID, event);
      case 'join':
        return joinLedger(OPENID, event.code);
      case 'detail':
        return getDetail(OPENID, event.id);
      case 'removeMember':
        return removeMember(OPENID, event.id, event.openid);
      case 'rename':
        return rename(OPENID, event.id, event.name);
      case 'exit':
        return exitLedger(OPENID, event.id);
      case 'dissolve':
        return dissolveLedger(OPENID, event.id);
      default:
        return getMyLedgers(OPENID);
    }
  } catch (err) {
    console.error('[ledger] error', err);
    return { code: -1, message: err.message };
  }
};

// 我的账本列表
async function getMyLedgers(openid) {
  // 我创建的 + 我加入的
  const res = await db.collection('ledgers').where({
    members: openid
  }).get();

  // 个人账单数
  const personalCountRes = await db.collection('bills').where({
    _openid: openid, ledgerId: ''
  }).count();

  const ledgers = [];
  for (const l of res.data) {
    const billCountRes = await db.collection('bills').where({ ledgerId: l._id }).count();
    ledgers.push({
      ...l,
      billCount: billCountRes.total,
      memberCount: (l.members || []).length,
      role: l.ownerOpenid === openid ? 'owner' : 'member'
    });
  }

  return { code: 0, data: { ledgers, personalCount: personalCountRes.total } };
}

// 创建账本
async function createLedger(openid, { name, icon }) {
  const code = generateCode();
  const ledgerData = {
    name: name || '共享账本',
    icon: icon || '👥',
    ownerOpenid: openid,
    members: [openid],
    memberInfo: [{ openid, role: 'owner', joinedAt: new Date() }],
    code,
    createdAt: db.serverDate(),
    updatedAt: db.serverDate()
  };
  const res = await db.collection('ledgers').add({ data: ledgerData });

  // 获取创建者信息
  const userRes = await db.collection('users').where({ _openid: openid }).get();
  const user = userRes.data[0] || {};
  const members = [{
    openid,
    nickName: user.nickName || '匿名',
    avatarUrl: user.avatarUrl || '',
    role: 'owner',
    isMe: true,
    billCount: 0
  }];

  return { code: 0, data: { id: res._id, code, members } };
}

// 通过邀请码加入
async function joinLedger(openid, code) {
  const res = await db.collection('ledgers').where({ code }).get();
  if (res.data.length === 0) {
    return { code: -1, message: '邀请码无效' };
  }
  const ledger = res.data[0];
  if (ledger.members.includes(openid)) {
    return { code: -1, message: '你已是该账本成员' };
  }

  await db.collection('ledgers').doc(ledger._id).update({
    data: {
      members: _.push(openid),
      memberInfo: _.push({ openid, role: 'member', joinedAt: new Date() })
    }
  });

  return { code: 0, data: { id: ledger._id } };
}

// 账本详情
async function getDetail(openid, id) {
  const ledgerRes = await db.collection('ledgers').doc(id).get();
  const ledger = ledgerRes.data;

  if (!ledger) return { code: -1, message: '账本不存在' };
  if (!ledger.members.includes(openid)) {
    return { code: -1, message: '无权访问该账本' };
  }

  // 成员信息（带昵称头像和记账数）
  const members = [];
  for (const m of (ledger.memberInfo || [])) {
    const userRes = await db.collection('users').where({ _openid: m.openid }).get();
    const user = userRes.data[0] || {};
    const billCountRes = await db.collection('bills').where({
      ledgerId: id, authorOpenid: m.openid
    }).count();
    members.push({
      openid: m.openid,
      nickName: user.nickName || '匿名',
      avatarUrl: user.avatarUrl || '',
      role: m.role,
      billCount: billCountRes.total,
      isMe: m.openid === openid
    });
  }

  // 最近账单
  const billsRes = await db.collection('bills').where({ ledgerId: id })
    .orderBy('date', 'desc').orderBy('createdAt', 'desc').limit(20).get();

  // 总支出
  const expenseRes = await db.collection('bills').where({
    ledgerId: id, type: 'expense'
  }).get();
  const totalExpense = expenseRes.data.reduce((s, b) => s + b.amount, 0);

  const billCountRes = await db.collection('bills').where({ ledgerId: id }).count();

  return {
    code: 0,
    data: {
      ledger: { ...ledger, memberCount: ledger.members.length, billCount: billCountRes.total },
      members,
      bills: billsRes.data,
      totalExpense
    }
  };
}

// 移除成员
async function removeMember(openid, id, targetOpenid) {
  const ledgerRes = await db.collection('ledgers').doc(id).get();
  const ledger = ledgerRes.data;
  if (ledger.ownerOpenid !== openid) {
    return { code: -1, message: '只有创建者可以移除成员' };
  }
  const newMembers = ledger.members.filter(m => m !== targetOpenid);
  const newMemberInfo = (ledger.memberInfo || []).filter(m => m.openid !== targetOpenid);
  await db.collection('ledgers').doc(id).update({
    data: { members: newMembers, memberInfo: newMemberInfo }
  });
  return { code: 0, data: {} };
}

// 重命名
async function rename(openid, id, name) {
  const ledgerRes = await db.collection('ledgers').doc(id).get();
  if (ledgerRes.data.ownerOpenid !== openid) {
    return { code: -1, message: '只有创建者可以重命名' };
  }
  await db.collection('ledgers').doc(id).update({ data: { name } });
  return { code: 0, data: { name } };
}

// 退出账本
async function exitLedger(openid, id) {
  const ledgerRes = await db.collection('ledgers').doc(id).get();
  const ledger = ledgerRes.data;
  if (ledger.ownerOpenid === openid) {
    return { code: -1, message: '创建者请使用解散账本' };
  }
  const newMembers = ledger.members.filter(m => m !== openid);
  const newMemberInfo = (ledger.memberInfo || []).filter(m => m.openid !== openid);
  await db.collection('ledgers').doc(id).update({
    data: { members: newMembers, memberInfo: newMemberInfo }
  });
  return { code: 0, data: {} };
}

// 解散账本
async function dissolveLedger(openid, id) {
  const ledgerRes = await db.collection('ledgers').doc(id).get();
  if (ledgerRes.data.ownerOpenid !== openid) {
    return { code: -1, message: '只有创建者可以解散账本' };
  }
  // 删除账本内账单
  const billsRes = await db.collection('bills').where({ ledgerId: id }).get();
  await Promise.all(billsRes.data.map(b => db.collection('bills').doc(b._id).remove()));
  await db.collection('ledgers').doc(id).remove();
  return { code: 0, data: {} };
}

// 生成6位邀请码
function generateCode() {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  let code = '';
  for (let i = 0; i < 6; i++) {
    code += chars[Math.floor(Math.random() * chars.length)];
  }
  return code;
}
