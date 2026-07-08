// cloudfunctions/remindCheck/index.js
// 定时提醒检查（云函数定时触发器）
// 每天早8点、晚8点检查需要提醒的用户，发送订阅消息
const cloud = require('wx-server-sdk');
cloud.init({ env: cloud.DYNAMIC_CURRENT_ENV });
const db = cloud.database();
const _ = db.command;

// 订阅消息模板ID（替换为实际模板）
const REMIND_TEMPLATE_ID = '-8T7_AtBaeBRDhkyOGL2ADRPFy_jHy6qw-8Tf_ffVzA';

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

    // 今日日期字符串（用于查询今日账单）
    const todayStr = now.toISOString().slice(0, 10);

    // 获取今日已记账数与金额合计
    const todayBillsRes = await db.collection('bills').where({
      _openid: user._openid,
      date: todayStr
    }).get();
    const todayAmount = todayBillsRes.data.reduce((s, b) => s + (Number(b.amount) || 0), 0);
    const todayAmountStr = todayAmount.toFixed(2);

    // 发送订阅消息（模板仅 time1/amount2 两个字段）
    await sendSubscribeMessage(user._openid, todayAmountStr, formatBJ(now));
    sentCount++;
  }

  return { code: 0, data: { sent: sentCount, total: usersRes.data.length } };
};

// 格式化北京时间为 YYYY-MM-DD HH:mm
function formatBJ(now) {
  const utc = now.getTime() + now.getTimezoneOffset() * 60000;
  const bj = new Date(utc + 8 * 3600000);
  const pad = (n) => String(n).padStart(2, '0');
  return `${bj.getFullYear()}-${pad(bj.getMonth() + 1)}-${pad(bj.getDate())} ${pad(bj.getHours())}:${pad(bj.getMinutes())}`;
}

// 发送订阅消息
// 模板字段映射（仅2个字段）：time1=记账时间, amount2=记账金额
async function sendSubscribeMessage(openid, todayAmountStr, nowStr) {
  try {
    await cloud.openapi.subscribeMessage.send({
      touser: openid,
      page: 'pages/index/index',
      data: {
        time1: { value: nowStr },
        amount2: { value: todayAmountStr }
      },
      templateId: REMIND_TEMPLATE_ID,
      miniprogramState: 'developer'
    });
  } catch (err) {
    // 用户未授权订阅消息会失败，忽略
    console.log('订阅消息发送失败（可能未授权）:', openid);
  }
}
