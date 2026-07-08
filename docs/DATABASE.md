# 数据库设计

微信云开发使用 NoSQL 文档数据库，以下是各集合的结构设计。

## 集合一览

| 集合名 | 用途 | 权限 |
|--------|------|------|
| `users` | 用户信息 | 仅创建者可读写 |
| `bills` | 账单记录 | 仅创建者可读写（通过云函数访问共享账单） |
| `ledgers` | 共享账本 | 通过云函数管理权限 |
| `achievements` | 成就解锁记录 | 仅创建者可读写 |
| `reminders` | 待补记提醒 | 仅创建者可读写 |
| `friends` | 好友关系 | 仅创建者可读写 |
| `pay_orders` | 支付订单（用于支付回调） | 仅创建者可读写 |

## 1. users 用户集合

```json
{
  "_openid": "用户openid",
  "nickName": "昵称",
  "avatarUrl": "头像URL",
  "level": 1,
  "exp": 0,
  "remindEnabled": false,
  "remindTime": "20:00",
  "customCategories": {
    "expense": [{ "id": "custom_expense_xxx", "name": "自定义", "icon": "📝" }],
    "income": [{ "id": "custom_income_xxx", "name": "自定义", "icon": "💰" }]
  },
  "createdAt": "serverDate",
  "lastLoginAt": "serverDate"
}
```

## 2. bills 账单集合

```json
{
  "_openid": "创建者openid",
  "authorOpenid": "记账人openid（共享账本中可能不同）",
  "authorName": "记账人昵称",
  "type": "expense | income",
  "amount": 12.50,
  "category": "food",
  "categoryName": "餐饮",
  "categoryIcon": "🍜",
  "note": "备注",
  "date": "2026-07-08",
  "time": "12:30",
  "ledgerId": "共享账本ID（空表示个人账本）",
  "source": "manual | wxpay | ocr",
  "wxpayTradeNo": "微信支付订单号（仅wxpay来源）",
  "createdAt": "serverDate",
  "updatedAt": "serverDate"
}
```

## 3. ledgers 共享账本集合

```json
{
  "name": "家庭账本",
  "icon": "🏠",
  "ownerOpenid": "创建者openid",
  "members": ["openid1", "openid2"],
  "memberInfo": [
    { "openid": "xxx", "role": "owner", "joinedAt": "date" },
    { "openid": "yyy", "role": "member", "joinedAt": "date" }
  ],
  "code": "ABCDEF",
  "createdAt": "serverDate",
  "updatedAt": "serverDate"
}
```

## 4. achievements 成就集合

```json
{
  "_openid": "用户openid",
  "code": "first_bill",
  "name": "记账入门",
  "unlockedAt": "serverDate"
}
```

## 5. reminders 待补记提醒集合

```json
{
  "_openid": "用户openid",
  "platform": "支付宝",
  "amount": 38.50,
  "time": "2026-07-08 12:30",
  "merchant": "星巴克",
  "rawText": "OCR原始文本",
  "fileId": "云存储文件ID",
  "status": "pending | done",
  "createdAt": "serverDate"
}
```

## 6. friends 好友关系集合

```json
{
  "_openid": "发起者openid",
  "friendOpenid": "好友openid",
  "status": "pending | accepted",
  "createdAt": "serverDate"
}
```

## 7. pay_orders 支付订单集合

```json
{
  "_openid": "用户openid",
  "outTradeNo": "商户订单号",
  "description": "商品描述",
  "amount": 100,
  "category": "food",
  "categoryName": "餐饮",
  "categoryIcon": "🍜",
  "ledgerId": "账本ID",
  "status": "pending | paid",
  "transactionId": "微信支付交易号",
  "billId": "自动创建的账单ID",
  "createdAt": "serverDate",
  "paidAt": "serverDate"
}
```

## 初始化步骤

1. 在云开发控制台创建以上集合
2. 设置集合权限：
   - `users`、`bills`、`achievements`、`reminders`、`friends`、`pay_orders` → 仅创建者可读写
   - `ledgers` → 通过云函数管理（建议设为仅创建者可读写，成员通过云函数访问）
3. 部署所有云函数
4. 配置订阅消息模板（记账提醒）
