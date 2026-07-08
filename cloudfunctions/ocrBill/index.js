// cloudfunctions/ocrBill/index.js
// 截图 OCR 识别记账
// 支持：支付宝、云闪付、银行 App 账单截图
// 说明：云开发环境无内置通用 OCR，这里提供正则提取框架。
//       生产环境建议接入「腾讯云 OCR」或「微信OCR插件」以提升识别准确率。
const cloud = require('wx-server-sdk');
cloud.init({ env: cloud.DYNAMIC_CURRENT_ENV });

exports.main = async (event, context) => {
  const { OPENID } = cloud.getWXContext();
  const { fileId, platform } = event;

  if (!fileId) {
    return { code: -1, message: '缺少图片' };
  }

  try {
    // 1. 下载图片（用于后续 OCR，此处预留）
    // const fileRes = await cloud.downloadFile({ fileID: fileId });
    // const imageBuffer = fileRes.fileContent;

    // 2. 调用 OCR 识别（此处为框架，实际请接入腾讯云OCR）
    //    示例：
    //    const ocrResult = await callTencentOCR(imageBuffer, platform);
    //    const rawText = ocrResult.TextDetections.map(t => t.DetectedText).join('\n');
    const rawText = await mockOCR(fileId, platform);

    // 3. 正则提取金额、时间、商户等信息
    const items = extractBillInfo(rawText, platform);

    // 4. 保存为待补记提醒（用户可确认后记账）
    for (const item of items) {
      await cloud.database().collection('reminders').add({
        data: {
          _openid: OPENID,
          platform: item.platform,
          amount: item.amount,
          time: item.time,
          merchant: item.merchant,
          rawText,
          fileId,
          status: 'pending',
          createdAt: cloud.database().serverDate()
        }
      });
    }

    return {
      code: 0,
      data: {
        items,
        confidence: items.length > 0 ? 0.85 : 0.3,
        rawText
      }
    };
  } catch (err) {
    console.error('[ocrBill] error', err);
    return { code: -1, message: err.message || '识别失败' };
  }
};

// 从文本中提取账单信息
function extractBillInfo(text, platform) {
  const items = [];
  const lines = text.split('\n').map(l => l.trim()).filter(Boolean);

  // 金额正则：匹配 ¥12.34 / 12.34元 / 1,234.56 等
  const amountRegex = /[¥￥]?\s*([1-9]\d{0,2}(?:,\d{3})*(?:\.\d{1,2})|[1-9]\d*(?:\.\d{1,2})|0\.\d{1,2})\s*[元]?/;

  // 时间正则：匹配 2024-01-01 12:00 / 01-01 12:00 / 12:00
  const timeRegex = /(\d{4}[-/]\d{1,2}[-/]\d{1,2}[\s\d:]*|\d{1,2}[-/]\d{1,2}[\s\d:]*)/;

  for (const line of lines) {
    const amountMatch = line.match(amountRegex);
    if (amountMatch) {
      const amount = parseFloat(amountMatch[1].replace(/,/g, ''));
      if (amount > 0 && amount < 1000000) {
        const timeMatch = line.match(timeRegex) || (lines.find(l => l.match(timeRegex)) || '').match(timeRegex);
        // 商户名通常在金额附近
        const merchant = extractMerchant(line, lines);

        items.push({
          amount,
          time: timeMatch ? timeMatch[1] : '',
          date: timeMatch ? parseDate(timeMatch[1]) : '',
          merchant,
          platform: platform === 'auto' ? detectPlatform(text) : platformName(platform)
        });
      }
    }
  }

  // 去重（同一金额只保留一个）
  const seen = new Set();
  return items.filter(item => {
    const key = item.amount + '_' + item.time;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

// 提取商户名
function extractMerchant(line, allLines) {
  // 商户名通常包含"商户"、"收款"、"支付给"等关键词
  const idx = allLines.indexOf(line);
  // 检查前后行
  for (let i = Math.max(0, idx - 2); i <= Math.min(allLines.length - 1, idx + 2); i++) {
    const l = allLines[i];
    if (/商户|收款方|支付给|对方|订单/.test(l) && l.length < 30) {
      return l.replace(/商户[:：]?|收款方[:：]?|支付给|对方[:：]?|订单[:：]?/g, '').trim();
    }
  }
  return '';
}

// 解析日期
function parseDate(timeStr) {
  const now = new Date();
  const fullMatch = timeStr.match(/(\d{4})[-/](\d{1,2})[-/](\d{1,2})/);
  if (fullMatch) {
    return fullMatch[1] + '-' + fullMatch[2].padStart(2, '0') + '-' + fullMatch[3].padStart(2, '0');
  }
  const shortMatch = timeStr.match(/(\d{1,2})[-/](\d{1,2})/);
  if (shortMatch) {
    return now.getFullYear() + '-' + shortMatch[1].padStart(2, '0') + '-' + shortMatch[2].padStart(2, '0');
  }
  return now.toISOString().slice(0, 10);
}

// 检测平台
function detectPlatform(text) {
  if (/支付宝|alipay|蚂蚁|花呗|余额宝/i.test(text)) return '支付宝';
  if (/云闪付|银联|unionpay/i.test(text)) return '云闪付';
  if (/招商|工商|建设|农业|中国银行|交通|邮储|中信|民生|光大/i.test(text)) return '银行App';
  if (/微信支付|wechatpay/i.test(text)) return '微信支付';
  return '未知平台';
}

function platformName(p) {
  return { alipay: '支付宝', unionpay: '云闪付', bank: '银行App', auto: '自动识别' }[p] || p;
}

// 模拟 OCR（开发阶段用，实际应替换为真实OCR调用）
async function mockOCR(fileId, platform) {
  // 返回模拟的账单文本，便于前端调试
  const now = new Date();
  const dateStr = now.toISOString().slice(0, 10);
  const timeStr = dateStr + ' ' + String(now.getHours()).padStart(2, '0') + ':' + String(now.getMinutes()).padStart(2, '0');
  return [
    platformName(platform) + ' 账单详情',
    '商户：星巴克咖啡',
    '支付金额 ¥38.50',
    '时间 ' + timeStr,
    '订单已 completed'
  ].join('\n');
}
