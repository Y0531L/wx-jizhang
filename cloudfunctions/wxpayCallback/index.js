// cloudfunctions/wxpayCallback/index.js
// 微信支付回调 - 支付成功后自动记账
// 需要在小程序内发起微信支付时，将 openid、账单信息与 outTradeNo 绑定
// 支付成功后微信会回调此云函数，自动创建账单
const cloud = require('wx-server-sdk');
cloud.init({ env: cloud.DYNAMIC_CURRENT_ENV });
const db = cloud.database();

exports.main = async (event, context) => {
  console.log('[wxpayCallback] event', JSON.stringify(event));

  // 微信支付回调数据结构
  const { outTradeNo, totalPrice, transactionId, userInfo } = event;

  if (!outTradeNo) {
    return { code: -1, message: '缺少订单号' };
  }

  try {
    // 查找预存的账单信息（在小程序发起支付时存入 pay_orders 集合）
    const orderRes = await db.collection('pay_orders').where({ outTradeNo }).get();
    if (orderRes.data.length === 0) {
      console.log('未找到预存订单信息，跳过自动记账');
      return { code: 0, message: 'no order info' };
    }

    const order = orderRes.data[0];

    // 调用 addBill 云函数自动记账
    const result = await cloud.callFunction({
      name: 'addBill',
      data: {
        action: 'wxpayAutoRecord',
        openid: order.openid,
        amount: totalPrice / 100, // 微信支付金额单位为分
        outTradeNo,
        description: order.description || '微信支付',
        category: order.category,
        categoryName: order.categoryName,
        categoryIcon: order.categoryIcon,
        ledgerId: order.ledgerId
      }
    });

    // 更新订单状态
    await db.collection('pay_orders').doc(order._id).update({
      data: {
        status: 'paid',
        transactionId,
        billId: result.result && result.result.data && result.result.data.id,
        paidAt: db.serverDate()
      }
    });

    return { code: 0, data: { billId: result.result && result.result.data && result.result.data.id } };
  } catch (err) {
    console.error('[wxpayCallback] error', err);
    return { code: -1, message: err.message };
  }
};
