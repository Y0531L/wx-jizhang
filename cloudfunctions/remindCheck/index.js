// cloudfunctions/remindCheck/index.js
// 定时提醒检查（云函数定时触发器）
// 每天早8点、晚8点检查需要提醒的用户，发送订阅消息
const cloud = require('wx-server-sdk');
cloud.init({ env: cloud.DYNAMIC_CURRENT_ENV });
const db = cloud.database();
const _ = db.command;

// 订阅消息模板ID（替换为实际模板）
const REMIND_TEMPLATE_ID = 'REMIND_TEMPLATE_ID';

exports.main = async (event, context) => {
  const now = new Date();
  const hour = now.getUTCHours() + 8; // 北京时间
  const currentHour = hour >= 24 ? hour - 24 : hour;

  // 查询开启了提醒的用户
  const usersRes = await db.collection('users').where({
    remindEnabled: true
  }).get();

  let sentCount = 0;
  for (const user of usersRes.data) {
    // 检查是否到了用户的提醒时间
    const remindTime = user.remindTime || '20:00';
    const remindHour = parseInt(remindTime.split(':')[0], 10);

    // 容差2小时内都发送
    if (Math.abs(currentHour - remindHour) > 2 && Math.abs(currentHour - remindHour) < 22) {
      continue;
    }

    // 获取今日待补记提醒数
    const todayStr = now.toISOString().slice(0, 10);
    const pendingRes = await db.collection('reminders').where({
      _openid: user._openid,
      status: 'pending'
    }).count();

    // 获取今日已记账数
    const todayBillsRes = await db.collection('bills').where({
      _openid: user._openid,
      date: todayStr
    }).count();

    const remindContent = pendingRes.total > 0
      ? '你有 ' + pendingRes.total + ' 笔待补记账单，快去处理吧！'
      : (todayBillsRes.total === 0
        ? '今天还没有记账哦，记得记一笔～'
        : '今天已记 ' + todayBillsRes.total + ' 笔，继续保持！');

    // 发送订阅消息
    await sendSubscribeMessage(user._openid, remindContent, pendingRes.total);
    sentCount++;
  }

  return { code: 0, data: { sent: sentCount, total: usersRes.data.length } };
};

// 发送订阅消息
async function sendSubscribeMessage(openid, content, pendingCount) {
  try {
    await cloud.openapi.subscribeMessage.send({
      touser: openid,
      page: 'pages/index/index',
      data: {
        thing1: { value: '记账提醒' },
        thing2: { value: content.substring(0, 20) },
        number3: { value: pendingCount }
      },
      templateId: REMIND_TEMPLATE_ID,
      miniprogramState: 'developer'
    });
  } catch (err) {
    // 用户未授权订阅消息会失败，忽略
    console.log('订阅消息发送失败（可能未授权）:', openid);
  }
}
