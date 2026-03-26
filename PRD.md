# AI 美股产业拐点挖掘与决策 SaaS PRD (v1.5 全量漏斗版)

## 0. 文档信息
* **产品代号**：MVPify-AlphaTracker (EquityLens v2)
* **文档版本**：v1.5 (全市场扫描与动态漏斗架构)
* **核心目标**：从美股全市场（10,000+ 标的）中自动化筛出真正的 AI 产业链公司，利用 LLM 将“基础财务表”、“公司新闻流”与“SEC 10-K 官方画像”进行交叉验证，挖掘 6-12 个月维度的业绩催化剂。

## 1. 核心边界与生死假设
* **数据极简主义**：底层动态数据锁死在 **Yahoo Finance**，静态宏观数据锁死在 **SEC EDGAR**。
* **低成本高召回**：通过“正则扫雷 + LLM 纯度清洗 + 状态缓存”三级漏斗，解决全市场覆盖的成本问题。
* **生死假设**：大语言模型能否在 10-K 划定的竞争格局内，准确推理出“财务异动 + 新闻事件”背后的利润阶跃拐点？

## 2. 核心架构与模块说明

### 模块零：全市场 AI 标的漏斗过滤引擎 (The Universe Funnel)
**[Level 1] 全量底座与增量缓存**
* **数据源**：Nasdaq Trader (`nasdaqlisted.txt`, `otherlisted.txt`)。
* **清洗**：过滤 ETF、基金、权证、优先股。
* **缓存策略**：建立本地 Ticker 状态表。被判定为“非 AI 产业链”的公司永久标记为 `False`，后续仅对新上市或业务变更（10-K 更新）的公司进行增量判定。

**[Level 2] 零成本文本扫雷 (关键词匹配)**
* **匹配逻辑**：对公司业务摘要进行正则表达式检索。命中以下任一词库即进入下一级：
    * **算力硬件**：`AI Chip`, `AI Accelerator`, `GPU`, `TPU`, `NPU`, `DPU`, `ASIC`, `FPGA`, `High Performance Computing`, `HPC`, `HBM`, `High Bandwidth Memory`, `Advanced Packaging`, `CoWoS`, `EDA`, `Semiconductor IP`, `Custom Silicon`, `AI`。
    * **网络、基础设施与散热**：`Data Center`, `Optical Transceiver`, `Optical Module`, `Silicon Photonics`, `800G`, `1.6T`, `DSP`, `Liquid Cooling`, `Immersion Cooling`, `Smart Grid`, `Power Management IC`, `PMIC`, `AI`.
    * **云、数据与底座框架**：`Cloud Computing`, `Hyperscaler`, `Vector Database`, `Data Annotation`, `Data Labeling`, `RAG`, `MLOps`, `ModelOps`, `Compute Infrastructure`, `AI`.
    * **模型与算法核心**：`Large Language Model`, `LLM`, `Generative AI`, `GenAI`, `Machine Learning`, `Deep Learning`, `Neural Network`, `NLP`, `Natural Language Processing`, `Computer Vision`, `Transformer`, `Foundation Model`, `Multimodal`, `AI`.
    * **应用与端侧 AI**：`AI Agent`, `Copilot`, `Autonomous Driving`, `Robotaxi`, `Humanoid Robot`, `RPA`, `AI PC`, `AI Smartphone`, `Edge AI`, `Predictive Analytics`, `AI`.

**[Level 3] 纯度清洗与硬性门槛**
* **Gemini 判定**：通过 OpenRouter 调用 **`gemini-3.1-flash-lite-preview`**。
    * **任务**：区分“真 AI 核心”与“传统蹭概念”。非核心公司触发永久黑名单。判定后打上具体的产业链标签（如“上游-光模块”）。
* **财务初筛 (Hard Filters)**：
    1. **市值**：`> 3亿美元`（防操纵）。
    2. **流动性**：`30日均成交额 > 200万美元`。
    3. **营收**：`TTM 营收 > 1000万美元`（确保商业化落地）。
    4. **股价**：`> 1美元`（避开仙股）。
* **合规熔断**：若 10-K 提及“持续经营存疑”或审计师辞职，直接标记 `Avoid`。

### 模块一：三位一体数据馈送器 (Tri-Core Feeder)
1. **财务 Hard Truth (YF)**：拉取近 4-8 季度营收、毛利、OpEx、现金流、CAPEX。
2. **事件 News Feed (YF)**：抓取近 15-30 天新闻标题及摘要。
3. **官方宏观底座 (SEC)**：提取最新 10-K 的 `Item 1 (Business)` 与 `Item 1A (Risk)`。

### 模块二：宏观锚定下的交叉验证引擎
AI 读取 10-K 建立基线后，扫描以下矩阵：
* **[A] 竞争格局**：识别对手，判断是全行业红利还是份额掠夺。
* **[B] 财务异动**：寻找“营收增+费用降”的经营杠杆释放，或利润率环比阶跃。
* **[C] 事件验证**：验证新闻中的大单是否支撑财务表的研发转化。

### 模块三：SaaS Web UI 极简交互
1. **全市场扫描大盘**：展示漏斗实时状态（总数 -> 命中数 -> 入池数）及产业链分布。
2. **全景自选股看板**：展示核心池标的的最新价与 AI 评级（Buy/Watch/Avoid）。这个是核心页面，作为默认首页
3. **单标的深度卡片**：Markdown 研判报告（结论、催化剂、风险）+ 财务趋势图。

## 3. 演进路线图
* **V1.5 (当前)**：全市场自动漏斗与 Gemini 纯度清洗。
* **V2.0 (同业对标)**：基于 10-K 提取竞品并自动生成财务横评。
* **V2.5 (商业化)**：多租户体系、自定义词库与 Stripe 计费。