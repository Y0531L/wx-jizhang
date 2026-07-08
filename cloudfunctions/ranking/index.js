// cloudfunctions/ranking/index.js
// 好友排行榜
const cloud = require('wx-server-sdk');
cloud.init({ env: cloud.DYNAMIC_CURRENT_ENV });
const db = cloud.database();
const _ = db.command;

exports.main = async (event, context) => {
  const { OPENID } = cloud.getWXContext();
  const { period, dim } = event;

  try {
    // 获取好友列表（通过共享账本关联的用户 + 互相添加的好友）
    const friendOpenids = await getFriendOpenids(OPENID);
    const allOpenids = [OPENID, ...friendOpenids];

    // 计算时间范围
    const { start, end } = getPeriodRange(period);

    // 汇总每个用户的数据
    const stats = [];
    for (const oid of allOpenids) {
      const query = {
        _openid: oid,
        date: _.gte(start).and(_.lte(end))
      };
      if (dim !== 'count') query.type = (dim === 'income' ? 'income' : 'expense');

      const res = await db.collection('bills').where(query).get();
      let value = 0;
      if (dim === 'count') {
        value = res.data.length;
      } else if (dim === 'expense' || dim === 'income') {
        value = res.data.reduce((s, b) => s + b.amount, 0);
      } else if (dim === 'save') {
        const exp = res.data.filter(b => b.type === 'expense').reduce((s, b) => s + b.amount, 0);
        const incRes = await db.collection('bills').where({
          _openid: oid, type: 'income',
          date: _.gte(start).and(_.lte(end))
        }).get();
        const inc = incRes.data.reduce((s, b) => s + b.amount, 0);
        value = inc - exp;
      }

      // 获取用户信息
      const userRes = await db.collection('users').where({ _openid: oid }).get();
      const user = userRes.data[0] || {};

      stats.push({
        openid: oid,
        nickName: user.nickName || '匿名用户',
        avatarUrl: user.avatarUrl || '',
        value: Math.max(0, value),
        billCount: res.data.length
      });
    }

    // 排序
    stats.sort((a, b) => b.value - a.value);

    // 找到我的排名
    const myIndex = stats.findIndex(s => s.openid === OPENID);
    const mine = {
      rank: myIndex + 1,
      value: myIndex >= 0 ? stats[myIndex].value : 0
    };

    return { code: 0, data: { list: stats, mine } };
  } catch (err) {
    console.error('[ranking] error', err);
    return { code: -1, message: err.message };
  }
};

// 获取好友 openid 列表（通过好友关系集合）
async function getFriendOpenids(openid) {
  // 好友关系：双向记录
  const res = await db.collection('friends').where({
    _openid: openid,
    status: 'accepted'
  }).get();
  return res.data.map(f => f.friendOpenid);
}

// 获取周期范围
function getPeriodRange(period) {
  const now = new Date();
  let start, end;
  if (period === 'week') {
    const day = now.getDay() || 7;
    start = new Date(now.getFullYear(), now.getMonth(), now.getDate() - day + 1);
    end = now;
  } else if (period === 'month') {
    start = new Date(now.getFullYear(), now.getMonth(), 1);
    end = now;
  } else {
    // total
    start = new Date(2020, 0, 1);
    end = now;
  }
  return {
    start: start.toISOString().slice(0, 10),
    end: end.toISOString().slice(0, 10)
  };
}
