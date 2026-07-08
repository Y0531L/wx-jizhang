// cloudfunctions/achievement/index.js
// 成就系统
const cloud = require('wx-server-sdk');
cloud.init({ env: cloud.DYNAMIC_CURRENT_ENV });
const db = cloud.database();
const _ = db.command;

// 成就定义
const ACHIEVEMENT_DEFS = [
  // 记账基础
  { code: 'first_bill', group: '记账基础', icon: '🌱', name: '记账入门', desc: '记下第一笔账单', hint: '记下第一笔账单', maxValue: 1 },
  { code: 'bill_10', group: '记账基础', icon: '📝', name: '勤奋小记', desc: '累计记账10笔', hint: '累计记账10笔', maxValue: 10 },
  { code: 'bill_100', group: '记账基础', icon: '📚', name: '账本达人', desc: '累计记账100笔', hint: '累计记账100笔', maxValue: 100 },
  { code: 'bill_500', group: '记账基础', icon: '🏆', name: '账本王者', desc: '累计记账500笔', hint: '累计记账500笔', maxValue: 500 },
  // 连续记账
  { code: 'streak_7', group: '坚持打卡', icon: '🔥', name: '一周不落', desc: '连续记账7天', hint: '连续记账7天', maxValue: 7 },
  { code: 'streak_30', group: '坚持打卡', icon: '⚡', name: '坚持一月', desc: '连续记账30天', hint: '连续记账30天', maxValue: 30 },
  { code: 'streak_100', group: '坚持打卡', icon: '💎', name: '百日不辍', desc: '连续记账100天', hint: '连续记账100天', maxValue: 100 },
  // 理财
  { code: 'first_income', group: '理财成就', icon: '💰', name: '开源节流', desc: '记录第一笔收入', hint: '记录第一笔收入', maxValue: 1 },
  { code: 'save_1000', group: '理财成就', icon: '🐷', name: '小有结余', desc: '单月结余超1000元', hint: '单月结余超1000元', maxValue: 1 },
  { code: 'save_5000', group: '理财成就', icon: '🏦', name: '储蓄达人', desc: '单月结余超5000元', hint: '单月结余超5000元', maxValue: 1 },
  { code: 'frugal_month', group: '理财成就', icon: '🍃', name: '精打细算', desc: '单月支出低于1000元', hint: '单月支出低于1000元', maxValue: 1 },
  // 社交
  { code: 'join_ledger', group: '社交互动', icon: '👥', name: '共建账本', desc: '加入一个共享账本', hint: '加入一个共享账本', maxValue: 1 },
  { code: 'create_ledger', group: '社交互动', icon: '🏠', name: '一家之主', desc: '创建一个共享账本', hint: '创建一个共享账本', maxValue: 1 },
  { code: 'friend_pk', group: '社交互动', icon: '🤝', name: '好友PK', desc: '与好友进行一次排行PK', hint: '与好友进行一次排行PK', maxValue: 1 },
  { code: 'invite_3', group: '社交互动', icon: '🎉', name: '呼朋唤友', desc: '邀请3位好友一起记账', hint: '邀请3位好友一起记账', maxValue: 3 },
  // 特殊
  { code: 'big_expense', group: '特殊时刻', icon: '💸', name: '大手笔', desc: '单笔支出超5000元', hint: '单笔支出超5000元', maxValue: 1 },
  { code: 'category_8', group: '特殊时刻', icon: '🌈', name: '面面俱到', desc: '使用8种以上分类', hint: '使用8种以上分类', maxValue: 8 },
  { code: 'month_full', group: '特殊时刻', icon: '📅', name: '全勤奖', desc: '某月每天都记账', hint: '某月每天都记账', maxValue: 1 }
];

exports.main = async (event, context) => {
  const { OPENID } = cloud.getWXContext();
  const action = event.action || 'status';

  try {
    switch (action) {
      case 'status':
        return getStatus(OPENID);
      case 'check':
        return checkAchievements(OPENID);
      default:
        return getStatus(OPENID);
    }
  } catch (err) {
    console.error('[achievement] error', err);
    return { code: -1, message: err.message };
  }
};

// 获取成就状态
async function getStatus(openid) {
  // 获取已解锁成就
  const unlockedRes = await db.collection('achievements').where({ _openid: openid }).get();
  const unlocked = {};
  unlockedRes.data.forEach(a => {
    unlocked[a.code] = { unlockedAt: a.unlockedAt, ...a };
  });

  // 计算各项进度
  const progress = await calcProgress(openid);

  // 合并成就定义与进度
  const achievements = ACHIEVEMENT_DEFS.map(def => {
    const currentValue = progress[def.code] || 0;
    return {
      ...def,
      currentValue,
      unlocked: !!unlocked[def.code]
    };
  });

  // 等级与经验
  const userRes = await db.collection('users').where({ _openid: openid }).get();
  const user = userRes.data[0] || {};
  const exp = user.exp || 0;
  const level = user.level || 1;
  const expInLevel = exp % 100;
  const expToNext = 100 - expInLevel;
  const expPercent = expInLevel;

  return {
    code: 0,
    data: {
      achievements,
      unlocked,
      level,
      exp,
      expPercent,
      expToNext,
      streakDays: progress.streakDays || 0,
      totalBills: progress.totalBills || 0,
      achievementCount: Object.keys(unlocked).length,
      ledgerCount: progress.ledgerCount || 0,
      remindEnabled: user.remindEnabled || false
    }
  };
}

// 计算各项进度
async function calcProgress(openid) {
  const billsRes = await db.collection('bills').where({ _openid: openid }).orderBy('date', 'desc').limit(1000).get();
  const bills = billsRes.data;
  const totalBills = bills.length;

  // 连续记账天数
  const streakDays = calcStreak(bills);

  // 首笔收入
  const hasIncome = bills.some(b => b.type === 'income');

  // 月度数据
  const now = new Date();
  const monthStart = new Date(now.getFullYear(), now.getMonth(), 1).toISOString().slice(0, 10);
  const monthBills = bills.filter(b => b.date >= monthStart);
  const monthExpense = monthBills.filter(b => b.type === 'expense').reduce((s, b) => s + b.amount, 0);
  const monthIncome = monthBills.filter(b => b.type === 'income').reduce((s, b) => s + b.amount, 0);
  const monthSave = monthIncome - monthExpense;

  // 大额支出
  const hasBigExpense = bills.some(b => b.type === 'expense' && b.amount >= 5000);

  // 分类数
  const categories = new Set(bills.map(b => b.category));

  // 账本
  const ledgerRes = await db.collection('ledgers').where({ members: openid }).get();
  const ownedLedgerRes = await db.collection('ledgers').where({ ownerOpenid: openid }).get();
  const ledgerCount = ledgerRes.data.length;

  // 好友数
  const friendRes = await db.collection('friends').where({
    _openid: openid, status: 'accepted'
  }).get();
  const friendCount = friendRes.data.length;

  // 全勤
  const monthFull = checkMonthFull(monthBills, now);

  return {
    totalBills,
    streakDays,
    first_bill: totalBills,
    bill_10: totalBills,
    bill_100: totalBills,
    bill_500: totalBills,
    streak_7: streakDays,
    streak_30: streakDays,
    streak_100: streakDays,
    first_income: hasIncome ? 1 : 0,
    save_1000: monthSave >= 1000 ? 1 : 0,
    save_5000: monthSave >= 5000 ? 1 : 0,
    frugal_month: (monthExpense > 0 && monthExpense < 1000) ? 1 : 0,
    join_ledger: ledgerCount > 0 ? 1 : 0,
    create_ledger: ownedLedgerRes.data.length > 0 ? 1 : 0,
    invite_3: friendCount,
    big_expense: hasBigExpense ? 1 : 0,
    category_8: categories.size,
    month_full: monthFull ? 1 : 0,
    ledgerCount
  };
}

// 计算连续记账天数
function calcStreak(bills) {
  if (bills.length === 0) return 0;
  const dates = new Set(bills.map(b => b.date));
  let streak = 0;
  const today = new Date();
  for (let i = 0; i < 365; i++) {
    const d = new Date(today);
    d.setDate(today.getDate() - i);
    const ds = d.toISOString().slice(0, 10);
    if (dates.has(ds)) {
      streak++;
    } else if (i > 0) {
      break;
    }
  }
  return streak;
}

// 检查本月是否全勤
function checkMonthFull(monthBills, now) {
  const dates = new Set(monthBills.map(b => b.date));
  const daysInMonth = new Date(now.getFullYear(), now.getMonth() + 1, 0).getDate();
  const today = now.getDate();
  for (let d = 1; d <= today; d++) {
    const ds = new Date(now.getFullYear(), now.getMonth(), d).toISOString().slice(0, 10);
    if (!dates.has(ds)) return false;
  }
  return today === daysInMonth || today >= 28;
}

// 检查并解锁成就
async function checkAchievements(openid) {
  const progress = await calcProgress(openid);
  const unlockedRes = await db.collection('achievements').where({ _openid: openid }).get();
  const existing = new Set(unlockedRes.data.map(a => a.code));

  const newlyUnlocked = [];
  for (const def of ACHIEVEMENT_DEFS) {
    if (existing.has(def.code)) continue;
    const currentValue = progress[def.code] || 0;
    if (currentValue >= def.maxValue) {
      await db.collection('achievements').add({
        data: {
          _openid: openid,
          code: def.code,
          name: def.name,
          unlockedAt: db.serverDate()
        }
      });
      newlyUnlocked.push(def);
    }
  }

  return { code: 0, data: { newlyUnlocked, progress } };
}
