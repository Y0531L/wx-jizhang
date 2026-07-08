# 部署指南

## 一、环境准备

### 1. 注册小程序
- 前往 [微信公众平台](https://mp.weixin.qq.com/) 注册小程序
- 获取 AppID

### 2. 开通云开发
- 在微信开发者工具中打开项目
- 点击「云开发」按钮，开通云开发环境
- 记下环境ID，填入 `miniprogram/app.js` 的 `globalData.cloudEnv`

### 3. 替换 AppID
- 打开 `project.config.json`
- 将 `"appid": "touristappid"` 替换为你的真实 AppID

## 二、数据库初始化

详见 [DATABASE.md](./DATABASE.md)

1. 在云开发控制台 → 数据库，创建以下集合：
   - users、bills、ledgers、achievements、reminders、friends、pay_orders

2. 设置集合权限为「仅创建者可读写」

## 三、部署云函数

在微信开发者工具中，右键 `cloudfunctions` 目录下每个云函数文件夹，选择「上传并部署：云端安装依赖」。

需要部署的云函数：
- login
- addBill
- listBills
- stats
- ranking
- achievement
- ledger
- ocrBill
- remindCheck
- wxpayCallback

## 四、配置订阅消息（记账提醒）

1. 在微信公众平台 → 订阅消息 → 添加模板
2. 选择「记账提醒」类模板
3. 复制模板ID
4. 替换以下文件中的 `REMIND_TEMPLATE_ID`：
   - `cloudfunctions/remindCheck/index.js`
   - `miniprogram/pages/profile/profile.js`

## 五、配置微信支付自动记账（可选）

> 此功能需要微信支付商户号

1. 开通微信支付，绑定小程序
2. 在云开发控制台 → 设置 → 全局设置 → 微信支付配置，绑定商户号
3. 小程序内发起支付时，将订单信息存入 `pay_orders` 集合
4. 支付成功后，`wxpayCallback` 云函数会自动创建账单

## 六、配置截图识别 OCR（可选）

当前 `ocrBill` 云函数提供框架和正则提取。

如需提升准确率，建议接入：
- [腾讯云 OCR](https://cloud.tencent.com/product/ocr)
- 或使用微信小程序 OCR 插件

接入方式见 `cloudfunctions/ocrBill/index.js` 中的注释。

## 七、配置定时提醒触发器

`remindCheck` 云函数已配置定时触发器（每天 8:00、20:00）。

部署后需在云开发控制台确认触发器已生效：
- 云开发控制台 → 云函数 → remindCheck → 触发器

## 八、添加默认头像

在 `miniprogram/images/` 目录下添加 `default-avatar.png`（任意尺寸 PNG）。

如不添加，用户头像加载失败时会显示空白，不影响功能。

## 九、真机预览

1. 在微信开发者工具点击「预览」
2. 用手机微信扫码体验
3. 确认云函数调用正常、数据库读写正常

## 常见问题

**Q: 云函数调用报错？**
A: 检查云开发环境ID是否正确，云函数是否已部署。

**Q: 订阅消息收不到？**
A: 用户需主动授权订阅消息，且模板ID需替换为真实值。

**Q: 共享账本成员看不到账单？**
A: 确认 ledgers 集合的 members 字段包含该用户 openid，且云函数正确查询。

## 十、推送到 GitHub

项目已用 Git 初始化并完成首次提交。推送到 GitHub 步骤：

### 1. 在 GitHub 创建空仓库
- 登录 [GitHub](https://github.com/) → New repository
- 仓库名如 `wx-jizhang`，**不要**勾选 README / .gitignore / license（项目已有）
- 创建后复制仓库地址，形如 `https://github.com/你的用户名/wx-jizhang.git`

### 2. 配置 git 身份（可选，如已配置全局可跳过）
```bash
cd wx记账小程序
git config user.name "你的名字"
git config user.email "你的邮箱"
```

### 3. 添加远程仓库并推送
```bash
git remote add origin https://github.com/你的用户名/wx-jizhang.git
git push -u origin main
```

首次推送需输入 GitHub 用户名和 Personal Access Token（不是密码）。
Token 在 GitHub → Settings → Developer settings → Personal access tokens 创建，需勾选 `repo` 权限。

### 4. 后续更新
```bash
git add -A
git commit -m "描述本次改动"
git push
```
