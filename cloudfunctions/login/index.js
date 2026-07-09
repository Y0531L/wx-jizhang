// cloudfunctions/login/index.js
// 登录、用户信息、提醒设置、分类管理、清空数据
const cloud = require('wx-server-sdk');
cloud.init({ env: cloud.DYNAMIC_CURRENT_ENV });
const db = cloud.database();
const _ = db.command;

exports.main = async (event, context) => {
  const { OPENID } = cloud.getWXContext();
  const action = event.action || 'login';

  try {
    switch (action) {
      case 'login':
        return handleLogin(OPENID);
      case 'saveProfile':
        return saveProfile(OPENID, event.userInfo);
      case 'setRemind':
        return setRemind(OPENID, event.enabled);
      case 'setRemindTime':
        return setRemindTime(OPENID, event.time);
      case 'addCategory':
        return addCategory(OPENID, event);
      case 'deleteCategory':
        return deleteCategory(OPENID, event);
      case 'clearData':
        return clearData(OPENID);
      default:
        return handleLogin(OPENID);
    }
  } catch (err) {
    console.error('[login] error', err);
    return { code: -1, message: err.message || '操作失败' };
  }
};

// 登录：获取或创建用户记录
async function handleLogin(openid) {
  const users = db.collection('users');
  const res = await users.where({ _openid: openid }).get();
  if (res.data.length > 0) {
    // 更新最后登录时间
    await users.doc(res.data[0]._id).update({
      data: { lastLoginAt: db.serverDate() }
    });
    return { code: 0, data: { openid, userInfo: res.data[0] } };
  }
  // 新用户
  // 注意：云函数内 db.add() 不会自动注入 _openid，必须手动写入，
  // 否则后续所有 where({_openid}) 查询都找不到该用户（导致「用户不存在」）
  const newUser = {
    _openid: openid,
    nickName: '',
    avatarUrl: '',
    level: 1,
    exp: 0,
    remindEnabled: false,
    remindTime: '20:00',
    customCategories: { expense: [], income: [] },
    createdAt: db.serverDate(),
    lastLoginAt: db.serverDate()
  };
  const addRes = await users.add({ data: newUser });
  return { code: 0, data: { openid, userInfo: { _id: addRes._id, ...newUser } } };
}

// 保存用户资料
async function saveProfile(openid, userInfo) {
  const users = db.collection('users');
  const res = await users.where({ _openid: openid }).get();
  if (res.data.length === 0) {
    return { code: -1, message: '用户不存在' };
  }
  await users.doc(res.data[0]._id).update({
    data: {
      nickName: userInfo.nickName || '',
      avatarUrl: userInfo.avatarUrl || ''
    }
  });
  return { code: 0, data: { userInfo } };
}

// 设置提醒开关
async function setRemind(openid, enabled) {
  await db.collection('users').where({ _openid: openid }).update({
    data: { remindEnabled: !!enabled }
  });
  return { code: 0, data: { enabled: !!enabled } };
}

// 设置提醒时间
async function setRemindTime(openid, time) {
  await db.collection('users').where({ _openid: openid }).update({
    data: { remindTime: time }
  });
  return { code: 0, data: { time } };
}

// 添加自定义分类
async function addCategory(openid, { type, id, name, icon }) {
  await db.collection('users').where({ _openid: openid }).update({
    data: {
      [`customCategories.${type}`]: _.push({ id, name, icon })
    }
  });
  return { code: 0, data: { id, name, icon } };
}

// 删除自定义分类
async function deleteCategory(openid, { type, id }) {
  const res = await db.collection('users').where({ _openid: openid }).get();
  if (res.data.length === 0) return { code: -1, message: '用户不存在' };
  const user = res.data[0];
  const customs = (user.customCategories && user.customCategories[type]) || [];
  const filtered = customs.filter(c => c.id !== id);
  await db.collection('users').doc(user._id).update({
    data: { [`customCategories.${type}`]: filtered }
  });
  return { code: 0, data: { id } };
}

// 清空用户数据
async function clearData(openid) {
  // 删除所有账单
  const billsRes = await db.collection('bills').where({ _openid: openid }).get();
  const deletePromises = billsRes.data.map(b => db.collection('bills').doc(b._id).remove());
  await Promise.all(deletePromises);
  // 删除成就记录
  const achRes = await db.collection('achievements').where({ _openid: openid }).get();
  await Promise.all(achRes.data.map(a => db.collection('achievements').doc(a._id).remove()));
  // 重置用户等级
  await db.collection('users').where({ _openid: openid }).update({
    data: { level: 1, exp: 0 }
  });
  return { code: 0, data: { deleted: billsRes.data.length } };
}
