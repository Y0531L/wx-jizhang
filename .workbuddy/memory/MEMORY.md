# 项目记忆 - 微信记账小程序

## 项目概要
微信记账小程序，支持微信支付自动记账、多平台账单识别、好友排行、成就系统、多人协同记账。

## 技术栈
- 前端：微信小程序原生
- 后端：微信云开发（CloudBase）
- 无需自建服务器，云函数 + 云数据库 + 云存储

## 目录结构
- `miniprogram/` - 小程序前端（11个页面）
- `cloudfunctions/` - 云函数（10个）
- `docs/` - 数据库设计 + 部署指南

## 关键配置进度
- ✅ `project.config.json` → `appid`：wx58bcdd78064ce14c（已配置）
- ✅ `miniprogram/app.js` → `globalData.cloudEnv`：cloud1-d1g9bo85dcae54a60（已配置）
- ✅ `cloudfunctions/remindCheck/index.js` → `REMIND_TEMPLATE_ID`：-8T7_AtBaeBRDhkyOGL2ADRPFy_jHy6qw-8Tf_ffVzA（已配置）
- ✅ `miniprogram/pages/profile/profile.js` → `REMIND_TEMPLATE_ID`：-8T7_AtBaeBRDhkyOGL2ADRPFy_jHy6qw-8Tf_ffVzA（已配置）

## Git 仓库
- GitHub：https://github.com/Y0531L/wx-jizhang.git
- 分支：main
- 凭证管理器：credential.helper manager（已配置全局）
- Git为便携版PortableGit，路径：C:\Users\Administrator\.workbuddy\vendor\PortableGit\mingw64\bin

## 部署状态（截至2026-07-09）
- ✅ 10个云函数已部署到环境 cloud1-d1g9bo85dcae54a60
- ✅ 7个数据库集合已创建：users/bills/ledgers/achievements/reminders/friends/pay_orders
- ✅ 本地git已push到GitHub（main分支同步，最新commit 9ea2732）
- ⚠️ 订阅消息为一次性订阅，需用户在小程序内授权后才能推送，无法强制推送（个人主体限制）
- ⚠️ 微信支付自动记账(wxpayCallback)需额外配置微信支付商户号才生效
- ⚠️ 本次新增默认头像与邀请弹窗后，需重新部署 `login`、`remindCheck` 云函数

## 集合一览
users / bills / ledgers / achievements / reminders / friends / pay_orders

## 配色规范
- 支出：红色 #ff3b30
- 收入：绿色 #34c759
- 主题色：橙色 #ff6b35
- 遵循中国股市习惯（涨红跌绿）

## 默认头像
- 路径：`miniprogram/images/default-avatar.png`
- 用途：新用户默认头像、成员列表/头像兜底
- 风格：机器人厨师猫（用户提供参考图）

## 注意事项
- 小程序无法监听系统通知，多平台提醒通过截图OCR + 定时订阅消息实现
- ocrBill 云函数当前为框架+正则提取，生产环境建议接入腾讯云OCR
- 微信支付自动记账需配置商户号
- 订阅消息模板仅 `time1`/`amount2` 两个字段，无法直接承载排行/成就长文本；如需单独推送，需额外申请模板并走企业主体长期订阅消息
