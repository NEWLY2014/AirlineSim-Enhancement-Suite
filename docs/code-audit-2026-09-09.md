# AES 全量代码审计报告

审计日期：2026-09-09。版本：0.8.13。基线提交：`9ab14162a5eea4f56a8a15ce32da56b897cf4721`。

本轮审计发现 **10 项可复现问题：4 项 P1、6 项 P2**。用户批准修复后，已于 2026-09-10 完成全部 10 项的代码修复与回归验证。下文“发现”保留基线问题和验收要求，其位置行号对应审计基线；当前修复状态见下表。

## 修复状态（2026-09-10）

| 发现 | 已实施修复 | 验证 |
| --- | --- | --- |
| F01 | 普通文本使用 text/val；表头、筛选项、提取时间安全构造；Inventory 使用显式链接节点 | 注入文本不生成额外元素，正常链接保留 |
| F02 | 不可用时间/缺失控件立即失败；提交前校验日期、航班与航段时间，提交后核对实际时间 | 不可选时间、保存期间控件消失零提交；正常排班测试通过 |
| F03 | 后台串行协调任务，令牌绑定标签页、文档和任务 ID；关闭标签页可恢复 | 同时启动、异页清理、后台重启、页面刷新撤销旧令牌均覆盖 |
| F04 | 合并旧记录与 owner 记录，日期冲突保留已有记录，保留未知字段 | 新旧历史及现有元数据保留 |
| F05 | Pricing Data 导出和统计同时识别 routeAnalysis 与历史 pricing | 真实库存类型进入备份 |
| F06 | 替换前保存恢复副本，写入并读回验证后删除多余键；页面提供恢复入口 | 写入失败、删除失败、重载后恢复及恢复失败副本保留 |
| F07 | 设置更新走后台串行 compare-and-set，冲突后重读并重试 | 并发独立字段修改均保留 |
| F08 | 零金额正常显示，聚合读取原始数据 | 零收益计入平均值 |
| F09 | HUB 摘要使用 map/join 拼接 | 多 HUB 名称和计数正确 |
| F10 | 设置读取/写入错误终止成功回调，提供错误回调并记录错误 | 读失败不写入，写失败不报告成功 |

P1 表示应优先修复的安全边界、错误业务提交或历史数据覆盖问题；P2 表示需要修复的功能、异常处理或统计问题。未将纯代码风格、重复代码和假设性风险计入发现数。

## 审计范围与方法

以整个仓库为范围，梳理了 80 个已跟踪文件。重点审阅第一方运行时代码、Manifest、类型与存储模型、构建和发布脚本，并结合现有测试和新增专项复现验证。静态资源检查侧重引用、外部资源和打包边界；未对图片、压缩 jQuery 做逐字节语义审计。

| 范围 | 审查重点 | 结果与边界 |
| --- | --- | --- |
| `background.ts`、`modules/page-queue.ts`、Manifest | 权限、发送者身份、目的地址、持久化队列、服务工作线程重启 | 现有队列测试通过；任务所有权校验不等于跨页面业务任务互斥 |
| `helpers.ts` | 航司身份、服务器时间、设置写入、页面所有权、日志 | F07、F10；日志也采用读改写模式，存在同类并发风险，未单独计数 |
| `content_inventory.ts`、库存验证模块 | 舱位解析、价格建议、原生表单队列、提交确认、历史数据 | 追踪实际数据类型并确认 F05；未向真实游戏提交价格 |
| `content_aircraftFlightPlan.ts` | 模板、星期偏移、恢复执行、取消、表单校验 | F02、F03 |
| `content_aircraftFlights.ts`、`content_fleetManagement.ts` | 收益汇总、HUB、机队合并、筛选、异步回调 | 检查数据进入通用 Dashboard 的路径；F01、F08 涉及其输出 |
| `content_dashboard.ts` | 通用表格、筛选、删除、迁移、航线与竞争对手统计 | F01、F04、F08、F09 |
| `content_enterpriseOverview.ts`、`content_flightSchedule.ts` | 历史记录、跟踪索引、自动提取与导航 | 追踪迁移兼容路径和共享存储写入；索引读改写有同类并发风险 |
| `content_settings.ts`、`content_personnelManagement.ts` | 输入处理、持久化、工资表单提交 | F01、F07、F10 涉及共享设置路径 |
| FlightInfo、ORS、菜单、通知、About、Release Notes | DOM 输出、生命周期、存储、链接 | 现有模块测试通过；不等于覆盖所有线上页面布局 |
| `options.ts/html`、popup | 导入导出、替换恢复、清理、错误提示 | F05、F06 |
| `scripts/`、`.github/`、package/tsconfig | 构建边界、版本一致性、发布步骤、依赖 | 构建和 ZIP 检查通过；未执行商店上传、发布或远端凭证验证 |

## 验证结果

| 检查 | 结果 |
| --- | --- |
| `npm run typecheck` | 通过 |
| `npm test` | 171/171 通过（原 150 项与新增 21 项） |
| `npm run test:browser` | 最终 1/1 通过，使用本地 HTTPS 游戏页面夹具及隔离 Chromium；一次复跑触发原有价格请求间隔断言，后续复跑通过，保留为时序稳定性验证限制 |
| `npm audit --json` | 本次查询报告 0 个已知依赖漏洞；范围为 npm 依赖图，不包含独立 vendored jQuery 文件的完整漏洞评估 |
| `npm run package` | 通过，生成 `dist/AES-v0.8.13.zip` |
| `unzip -t dist/AES-v0.8.13.zip` | 通过 |
| `node --test test/audit-regressions.test.js test/storage-coordinator.test.js` | 21/21 通过，断言修复后的正确行为，已包含在 npm test 中 |

回归代码位于 `test/audit-regressions.test.js` 和 `test/storage-coordinator.test.js`，直接加载构建后的运行时代码；存储错误和回调交错由测试桩注入。原 `docs/audit-2026-09-09.repro.cjs` 现为回归测试入口，不再断言错误行为。浏览器验证使用真实扩展后台和 Chrome 存储。

## 发现

### F01 · P1 · 外部或持久化文本被重新解释为 HTML

位置：[content_dashboard.ts:465](/Users/xuyunhao/Documents/GitHub/AirlineSim-Enhancement-Suite/extension/content_dashboard.ts:465)、[content_settings.ts:225](/Users/xuyunhao/Documents/GitHub/AirlineSim-Enhancement-Suite/extension/content_settings.ts:225)。同类输出还见 Dashboard 表头/列选择器、航司日程标题，以及 Fleet 的提取时间 HTML。

Dashboard 将普通字符串传入 jQuery `.append()`，因此航司名称、机队备注等存储文本可以成为实际 DOM。设置编辑器直接把 `step.name` 拼进 `value="..."`，带双引号的名称可以逃逸属性。备份导入只校验外层对象，能够把此类字符串送入上述路径；航司名称和备注也来自页面提取。

**复现：**竞争对手名称设为包含 `img` 的文本后，表格出现实际图片元素，`onerror` 属性原样保留；定价步骤名使用 `"><img ...>` 后，设置页面也出现额外元素。

**影响：**确认存在持久化 HTML 注入和界面篡改能力。是否可进一步执行脚本取决于实际页面 CSP 和输入可控性；本次没有验证线上游戏允许的名称字符、线上 CSP 或扩展权限突破，不将这些推断当作已证实的远程利用。

**修复：**默认用 `.text()`、`textContent`、`.val()` 写文本。业务按钮和链接使用显式 DOM 构造，不再依赖通用表格解释 HTML 字符串。导入校验作为第二层防护，不能替代输出边界处理。

**验收：**名称、备注、步骤名包含引号或标签时原样显示；不产生额外元素或事件属性，现有 Inventory 链接仍可正常点击。

### F02 · P1 · 排班时间设置失败后仍提交错误计划

位置：[content_aircraftFlightPlan.ts:1197](/Users/xuyunhao/Documents/GitHub/AirlineSim-Enhancement-Suite/extension/content_aircraftFlightPlan.ts:1197)、[content_aircraftFlightPlan.ts:1214](/Users/xuyunhao/Documents/GitHub/AirlineSim-Enhancement-Suite/extension/content_aircraftFlightPlan.ts:1214)。

目标值不在下拉选项中时，`afp_setSelectValue()` 返回 false，调用方直接返回。缺少控件也直接返回；重试后的等待结果没有检查。上层把这些情况当成正常完成，保存 `waitForApply` 并点击提交按钮。确认步骤只检查对应日期是否出现航班代码，没有检查到达时间。

**复现：**模板要求 09:30，目标表单只有 08:30 选项。助手仍提交一次，存储状态为 `waitForApply`，实际控件保持 08:30。

**影响：**模板复制可能提交与用户预期不同的航班时间，且后续可能被标记完成。

**修复：**必需控件缺失、目标值不可选或最终读回不一致时抛错并阻止提交。提交前检查所有目标日期和每个航段时间；提交后确认不能只依赖航班代码。

**验收：**不可选时间、控件消失、Ajax 恢复旧值三类场景均零提交；完整正常路径仍可完成。

### F03 · P1 · 多标签页可互相覆盖正在执行的排班任务

位置：[content_aircraftFlightPlan.ts:848](/Users/xuyunhao/Documents/GitHub/AirlineSim-Enhancement-Suite/extension/content_aircraftFlightPlan.ts:848)、[content_aircraftFlightPlan.ts:883](/Users/xuyunhao/Documents/GitHub/AirlineSim-Enhancement-Suite/extension/content_aircraftFlightPlan.ts:883)。

排班任务键按服务器和航司共享，但启动检查只查看当前页面初始化时读入的 `aircraftFlightPlanState.job`。`startingJob`、`processingJob` 和 `activeRun` 均属于单页面；没有跨页面锁或任务令牌，也没有在执行前核对存储中的任务归属。

**复现：**先打开同航司飞机 123、456 两个空计划页面，再依次点击开始。两个页面都提交；第二个页面把共享任务的 `targetAircraftId` 改为 456，即使第一个任务仍等待确认。

**影响：**丢失首个任务的恢复状态；进一步的保存或清理可能覆盖、删除另一个页面的任务。“另一架飞机正在排班”的保护对已打开的标签页失效。

**修复：**由后台串行创建/更新任务，分配唯一任务 ID 和拥有者令牌，修改与清理必须校验令牌。刷新页面需要明确的恢复/接管规则；只增加一次前置读取仍不能消除竞态。

**验收：**两个已打开页面和同时点击场景下只允许一个活动任务；非拥有者不能提交、清理或覆盖该任务。

### F04 · P1 · 旧数据迁移覆盖已存在的新数据

位置：[content_dashboard.ts:2231](/Users/xuyunhao/Documents/GitHub/AirlineSim-Enhancement-Suite/extension/content_dashboard.ts:2231)。

迁移无 owner 的竞争对手记录时，代码直接构造 `migratedCompetitorData[newKey]`，没有合并或优先保留 `items[newKey]`。随后写入新键并删除旧键。缺失/失效索引、旧备份合并等情况下，旧键和 owner 键可能同时存在，这不是“仅首次安装”的路径。

**复现：**旧键包含 9 月 1 日历史，新键包含 9 月 8 日历史及额外元数据，索引缺失。打开竞争对手面板触发迁移后，9 月 8 日历史和额外元数据消失，旧键也被删除。

**影响：**仅打开页面就可能永久覆盖较新的历史数据。

**修复：**目标键已存在时按日期合并 `tab0`/`tab2`，冲突以已存在的 owner 记录为准，保留未知字段；确认写入成功后再清理旧键。考虑并发迁移的串行化与幂等性。

**验收：**旧键、新键同时存在时，两边非冲突历史均保留；重复迁移不改变结果，故障时原记录可恢复。

### F05 · P2 · Pricing Data 备份遗漏真实库存历史

位置：[options.ts:231](/Users/xuyunhao/Documents/GitHub/AirlineSim-Enhancement-Suite/extension/options.ts:231)，实际写入类型见 [content_inventory.ts:1587](/Users/xuyunhao/Documents/GitHub/AirlineSim-Enhancement-Suite/extension/content_inventory.ts:1587)。

备份筛选只接受 `type === 'pricing'`，当前库存模块保存的是 `type: 'routeAnalysis'`。统计分类也使用旧类型，因此库存历史不会计入 Pricing Data。

**复现：**存储有一条真实结构的 `routeAnalysis` 记录，选择 Pricing Data 导出，得到 `itemCount: 0`。现有备份测试构造的是 `pricing` 假数据，因而无法发现类型错配。

**影响：**用户以为已经备份的价格/客座率历史实际未导出；之后清理或重装时无法恢复。全量 `all` 备份不受此筛选问题影响。

**修复：**统一存储类型定义，备份与统计同时兼容当前 `routeAnalysis` 和确有需要的旧 `pricing` 类型。

**验收：**将库存模块实际保存的记录交给备份模块，导出再恢复后逐字段一致。

### F06 · P2 · 替换恢复写入失败时原数据已被清空

位置：[options.ts:331](/Users/xuyunhao/Documents/GitHub/AirlineSim-Enhancement-Suite/extension/options.ts:331)。

替换模式先 `clear()`，再 `set(backup.data)`；写入失败只显示错误，没有保留旧快照或提供恢复路径。

**复现：**已有历史数据，导入合法外层结构的备份，并模拟 set 写入失败。最终 storage 为空，原记录丢失。

**影响：**一次恢复操作失败反而毁掉恢复前的数据；清空后页面中断也存在相同窗口。

**修复：**恢复前保留可恢复快照；优先写入并确认备份内容，再删除不属于目标快照的旧键，并用恢复标记处理跨步骤中断。不能把这一串非事务操作宣称为原子恢复。

**验收：**写入失败、删除失败、步骤间中断均能保留或恢复原状态，且 UI 区分完整成功与部分完成。

### F07 · P2 · 并发设置读改写丢失独立修改

位置：[helpers.ts:119](/Users/xuyunhao/Documents/GitHub/AirlineSim-Enhancement-Suite/extension/helpers.ts:119)、[content_dashboard.ts:3561](/Users/xuyunhao/Documents/GitHub/AirlineSim-Enhancement-Suite/extension/content_dashboard.ts:3561)。

“读取最新快照”并不保证原子更新：两个请求都读到旧对象，然后各自整对象写回，后写者覆盖先写者对其他字段的修改。快速连续设置或多个游戏标签页均可触发。

**复现：**初始 `{a:0,b:0}`，两个更新分别设置 a、b，延迟两次读取使其读取同一快照。最终为 `{a:0,b:1}`，而非 `{a:1,b:1}`。

**影响：**自动调价开关、显示设置和人员设置等独立操作互相回退。机队、日志和竞争对手索引也有同型读改写结构，修复时应统一检查，未把未单独复现的每个位置拆成发现。

**修复：**把设置更新集中到后台串行处理，或使用具备事务的存储层；仅在一个内容脚本中加锁不解决跨标签页冲突。

**验收：**异步、交错和跨页面执行至少两个独立字段更新，最终均保留；测试桩不能全部同步回调。

### F08 · P2 · 零利润被当作缺失值，平均利润偏高

位置：[content_dashboard.ts:310](/Users/xuyunhao/Documents/GitHub/AirlineSim-Enhancement-Suite/extension/content_dashboard.ts:310)，汇总见 [content_dashboard.ts:544](/Users/xuyunhao/Documents/GitHub/AirlineSim-Enhancement-Suite/extension/content_dashboard.ts:544)。

money 格式化使用 `if (!value)` 将合法的 0 输出为空；页脚再从显示文本计算平均值，把该空格排除。

**复现：**两架飞机都有有效收益记录，利润分别为 0 和 100。页脚显示平均 100，而正确值应为 50。

**修复：**只对缺失值输出空白，0 正常格式化。汇总宜读取原始数值，避免展示格式、语言和空白影响计算。

**验收：**0/100 平均为 50，-100/100 平均为 0，缺失记录不当作 0，筛选后仍只汇总可见记录。

### F09 · P2 · 竞争对手多 HUB 摘要出现 NaN 并丢失前项

位置：[content_dashboard.ts:2077](/Users/xuyunhao/Documents/GitHub/AirlineSim-Enhancement-Suite/extension/content_dashboard.ts:2077)。

`scheduleHubs` 本应拼接字符串，却在每轮执行 `Number(data.scheduleHubs || 0)`。单 HUB 出现多余的 0 前缀；从第二个 HUB 开始，已拼接文本被转换为 NaN。

**复现：**竞争对手日程有 AAA、CCC 两个 HUB，显示的 HUB 摘要包含 NaN，不能保留完整列表。

**修复：**使用 `hubArray.map(...).join(', ')`，不对累计文本作数值转换。

**验收：**一个及多个 HUB 均准确显示名称和计数，无 0 前缀和 NaN。

### F10 · P2 · 设置存储失败仍继续写入并报告成功

位置：[helpers.ts:120](/Users/xuyunhao/Documents/GitHub/AirlineSim-Enhancement-Suite/extension/helpers.ts:120)。

与 F07 的并发问题不同，此处是错误分支缺失：共享 `updateSettings()` 在 get/set 回调均未检查 `chrome.runtime.lastError`。读取失败时若返回空结果，会以 `{}` 为基础覆盖原设置；写入失败也会执行成功回调。人员管理还用这个回调继续业务操作。

**复现：**模拟读取报错且返回空对象，更新一个偏好。原设置被新对象替换，成功回调仍执行。

**修复：**读取失败立即停止；写入成功才更新内存、提示成功或继续业务操作。提供可被调用者处理的失败结果，建议统一 Promise 包装。

**验收：**读失败零写入，写失败零成功提示、零后续业务提交；恢复后允许用户明确重试。

## 修复顺序和验证缺口

1. F01、F02、F03、F04：先修输出边界、排班提交与任务归属、迁移覆盖。
2. F05、F06、F07、F10：完成真实数据结构的备份往返、可恢复导入和统一存储写入/错误处理。
3. F08、F09：修复统计和摘要，并增加零值、多个 HUB 用例。

原有测试主要缺口是：备份夹具未采用库存真实类型、存储测试桩通常同步完成、排班只覆盖可用的时间选项、迁移缺少新旧键同时存在的情况，以及统计缺少零收益样本。这些已确认场景已转为正确行为断言并纳入常规测试；新增故障与任务所有权用例补充了异常分支。

## 限制与交付

本次为仓库范围的代码审阅与隔离环境验证，不是线上渗透测试。没有操作用户游戏账户，没有提交实际价格、工资或排班，没有验证 Chrome Web Store 的在线发布状态。没有测得分支覆盖率，不能把 171 项测试解释为 100% 路径覆盖。

依赖审计的 0 漏洞仅反映查询时 npm 依赖图中的已知公告。游戏 DOM、CSP、语言布局及实际网络失败行为仍需在授权的验收环境复核。以上限制不影响报告中已经独立复现的错误行为。

已修改生产源码、增加后台存储协调模块和回归测试。修复按审计编号拆分为独立 Git 提交，推送记录以 Git 历史为准；未发布扩展商店版本。构建及打包产物位于项目原有输出目录。恢复副本保护替换失败前的数据，但不是整个产品的全局存储事务；日志与跟踪索引等其他读改写路径不属于 F07 本次设置协调的覆盖范围。
