AI 美股产业拐点挖掘与决策 SaaS PRD (v1.6 绝对数据底座版)
0. 文档信息
产品代号：MVPify-AlphaTracker (EquityLens v1.6)

文档版本：v1.6 (全量漏斗 + 绝对数据底座与全景校验架构)

核心目标：从美股全市场（10,000+ 标的）中筛出真正的 AI 产业链公司后，在本地构建 100% 完整、高精度的财务、事件与定性文稿时间序列数据库，作为 LLM 拐点预测的 Ground Truth。彻底消灭数据静默缺失，并提供可视化全景校验页面。

1. 核心边界与生死假设
数据精度至上：宁可拉取速度慢，绝不允许数据静默缺失（Silent Missing）。所有的 NaN 或 Null 必须被捕获、告警并触发降级补全机制。

双源交叉验证：以 Yahoo Finance (YF) 为高频捷径，但必须引入权威级 API（如 FMP/Polygon）与 SEC EDGAR (XBRL 格式) 作为终极容灾托底，确保财务表无死角。

低成本高召回：通过“正则扫雷 + LLM 纯度清洗 + 状态缓存”三级漏斗，解决全市场覆盖的成本问题。

生死假设：大语言模型只有在摄入 100% 无死角的硬核财务指标 + 护城河指标 + 10-K 定性解释 + 新闻事件 时，才能准确推演并识别出真实的利润阶跃拐点。基础数据断层会导致预测体系全面崩溃。

2. 模块零：全市场 AI 标的漏斗过滤引擎 (The Universe Funnel)
[Level 1] 全量底座与增量缓存

数据源：Nasdaq Trader (nasdaqlisted.txt, otherlisted.txt)，过滤 ETF、基金、权证、优先股。

缓存策略：建立本地 Ticker 状态表。判定为“非 AI”的公司标记 False，后续仅对新上市或 10-K 更新的公司进行增量判定。

[Level 2] 零成本文本扫雷 (关键词匹配)

对公司业务摘要进行正则检索，命中算力硬件、网络基础、云/数据、大模型算法、端侧应用等核心关键词库即进入下一级。

[Level 3] 纯度清洗与硬性门槛

调用 gemini-3.1-flash-preview，执行严苛的 L3 Prompt，区分“真 AI 核心”与“传统蹭概念”，并打上精准的产业链标签（如 materials, gpu_accelerators, power_thermal 等）。

3. 核心数据字典 (The Ground Truth Matrix)
为支撑大模型深度推演，核心池标的必须按季度 (Quarterly) 和 年度 (Annual) 双频次落库以下维度：

3.1 基础利润表 (Income Statement) - 造血与经营杠杆
Total Revenue: 总营收（核心增长锚点）。

Cost of Revenue & Gross Profit: 营业成本与毛利润。

Research and Development (R&D): 研发费用（AI 浓度核心指标）。

SG&A: 销售及管理费用。

Operating Income & Net Income: 营业利润与净利润。

EBITDA & EPS (Basic/Diluted): 息税折旧摊销前利润与每股收益。

3.2 基础资产负债表 (Balance Sheet) - 抗风险与扩张潜力
Total Cash & Short Term Investments: 现金及等价物（能烧多久）。

Accounts Receivable & Inventory: 应收账款与存货（排雷压货/坏账风险）。

Total Current Assets & Total Current Liabilities: 流动资产与流动负债。

Property, Plant & Equipment (PP&E), Net: 厂房及设备净值（AI 基建核心指标，观察算力重资产投入）。

Total Assets, Long Term Debt, Total Liabilities, Stockholders' Equity。

3.3 基础现金流量表 (Cash Flow) - 真金白银流转
Operating Cash Flow: 经营现金流。

Capital Expenditure (CapEx): 资本支出（AI 算力产业链最重要的前置指标）。

Investing Cash Flow & Financing Cash Flow: 投资与筹资现金流（监控发债/增发）。

Free Cash Flow (FCF): 自由现金流。

3.4 华尔街交易员衍生指标 (Pro-Trader Advanced Metrics)
Share-Based Compensation (SBC): 股权激励费用（极其致命，剔除利润粉饰）。

Remaining Performance Obligations (RPO) / Backlog: 剩余履约义务/在手订单（AI 云与软件的核心先行指标）。

Gross Margin % & Operating Margin %: 毛利率与营业利润率（判断产业链定价权）。

R&D as a % of Revenue: 研发费用率（真 AI 拐点前夕通常维持 15%-30%+）。

Days Sales Outstanding (DSO): 应收账款周转天数（硬件防雷，排查赊销刷单）。

Inventory Turnover: 存货周转率（监控半导体/光模块的上游砍单或旧产品积压）。

FCF Margin: 自由现金流利润率（烧钱期生存能力核心）。

3.5 价值投资与护城河指标 (Buffett & Munger Moat Metrics)
Return on Invested Capital (ROIC): 投入资本回报率（检验资本开支是否转化为高效利润，排查“毁灭价值”的伪巨头）。

Return on Equity (ROE) 结合 Debt-to-Equity: 真实净资产收益率（剔除高杠杆水分）。

Owner's Earnings: 所有者盈余（净利润 + D&A - 维持性 CapEx，看透折旧极快的 AI 硬件公司真实盈余）。

CapEx as a % of Operating Cash Flow: 资本支出占经营现金流比例（>100% 意味着需不断融资的“糟糕生意”）。

SG&A as a % of Gross Profit: 销售费用占毛利比例（SaaS 公司的照妖镜，检验产品自然垄断力）。

Retained Earnings to Market Value Created: 留存收益创造价值比（测试管理层效能，防雷“All in AI”却不见成效的传统公司）。

Gross Margin Consistency: 毛利率 10 年标准差（波动率越低，护城河越深）。

3.6 新闻与事件时序流 (News Event Feed)
Publish_Time (精确到分钟), Source, Title, Summary (前500字), URL, Event_Tag (由 LLM 自动打标，如产品发布、财报、并购)。

3.7 SEC 原始文稿库 (SEC Filings Archive) - 定性弹药库
10-K / 20-F (年度报告)：切片提取 Item 1 (Business)、Item 1A (Risk Factors)、Item 7 (MD&A)。

10-Q / 6-K (季度报告)：重点提取 Part I, Item 2 (MD&A) 捕捉短期业务指引。

8-K (重大事件)：捕获非财报季的突发订单/人事变动。

Earnings Call Transcripts (财报电话会实录)：捕获 Q&A 环节管理层对 AI 资本开支、毛利率的口径指引。

4. 致命缺失解决方案与重试机制 (Zero-Tolerance Protocol)
4.1 异步指数级重试队列 (Exponential Backoff Retry Queue)
触发：网络超时、API 限频 (HTTP 429) 或临时空数据。

策略：延迟 1m, 5m, 30m, 2h, 12h 重试，禁止死循环。

动态代理池 (Proxy Rotation)：连续 3 次失败自动切换备用 IP。

4.2 降级补全漏斗 (Fallback Waterfall)
Primary Fetch: Yahoo Finance (yfinance)。

Missing Detection: 核心指标（如 Revenue, CapEx, R&D）为 NaN 触发熔断。

Fallback 1: 权威付费 API 托底（如 FMP / Polygon.io）。

Fallback 2: 调用 SEC EDGAR 官方 API，直接解析 XBRL 财务原始标签。

Human-in-the-Loop: 24小时内所有机制失败，标记 Data_Corrupted 并在后台标红，交由人工录入。坚决禁止系统自动填 0。

4.3 SEC 文本边缘 Case 容错
中概股/海外股：自动识别并拉取对应的 20-F 和 6-K。

文本清洗熔断：若 EDGAR HTML 解析乱码，系统回退保存完整原始 HTML，UI 标记 Raw_Only，提示交由大模型重新清洗提取。

5. SaaS Web UI 极简交互与全景校验
5.1 前台交互模块
全市场扫描大盘：展示漏斗实时状态（总数 -> 命中数 -> 入池数）及产业链分布。

全景自选股看板（默认首页）：展示核心池标的最新价、AI 评级 (Buy/Watch/Avoid) 与核心财务快照。

单标的深度卡片：Markdown 研判报告（结论、催化剂、风险）。

5.2 单标的底层全景检验看板 (The Master Data View)
此页面为高阶开发者、分析师的数据审计中心。

视图 A - 财务透视矩阵：表格平铺展示过去 8 季度全量财务与衍生指标，高亮环比异动（如 CapEx 突增 50%）。Fallback 补全的数据带有特殊来源标识（如 *SEC）。

视图 B - 催化剂时间线：新闻时间轴与财报发布日叠加显示，直观展示“新闻事件驱动业绩拐点”的关联。

视图 C - 缺失熔断日志：展示拉取报错与自动化修复记录。

视图 D - 财报与研报原文库 (Document Center)：双屏对比模式。左侧看财务异动，右侧支持直接调取 10-K/10-Q MD&A 原文；支持全文关键词检索；LLM 生成的结论必须能点击溯源并高亮右侧原文。

视图 E - 数据质量热力图与熔断大盘 (Data Quality Command Center)：

全局热力图：X轴为核心指标，Y轴为公司 Ticker。

颜色编码：🟩 完整且校验通过；🟨 重试队列中；🟧 降级补全成功；🟥 绝对缺失。

归因仪表盘：统计数据来源占比（YF vs FMP vs SEC）。

一键阻击 (Manual Override)：针对红灯格子提供“强制重试”或“人工覆写”功能。

6. 演进路线图
V1.5：全市场自动漏斗与 Gemini 纯度清洗。

V1.6 (当前)：构建 100% 完整的底层财务字典、护城河指标与 SEC 语料库，加入多级重试容灾机制，上线全景数据校验大盘。

V2.0：基于无死角的 V1.6 绝对底座，正式接入大语言模型执行深度的“财务横评 + 竞品博弈 + 产业链拐点推演”。