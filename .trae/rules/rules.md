
1. 始终使用中文对话
2. 我把一些关键信息保存在本地环境变量，你可以去查看，需要的时候获取使用，简单的方法是echo 某个变量获取到
3. 使用npx wrangler deploy命令部署后端服务，不会覆盖远程变量，不需要重新配置变量
4. 我让你记住的一些东西，或者经常需要使用的信息，你可以保存在规则文件里，并且进行加密
5. 涉及浏览器页面交互的操作，可以自动调用mcp工具，比如playwright，chrome devtools访问浏览器，查看相关页面了解页面信息
6. 更改完代码一定要执行npm run build确认不报错
7. 我是初学者，代码尽量加注释，尤其每次改动要加注释说明下
8. 代码仓库地址 https://github.com/ralph-wren/memoraid
9. 所有内容部署到cloudflare page
10. 本地已经安装和cloudflare的d1，r1数据库的交互命令
11. 任务完成后检查下是否符合要求
12. 使用 npx playwright codegen --channel=chrome --user-data-dir="C:\Users\ralph\AppData\Local\Chrome-Automation" https://mp.weixin.qq.com/ 这种命令打开浏览器查看相关页面操作
13. 需要时参考docs\REMOTE_DEBUG.md的调试步骤进行远程调试，需要我在浏览器生成验证码发给你进行调试
14. 生成所有临时文件、测试文件都统一放在跟目录的test目录下，用完删除
15. 每次执行npm run release前，更新一下版本信息
16. 需要遵守.cursor目录下的规则