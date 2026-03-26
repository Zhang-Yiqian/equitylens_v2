/**
 * L3 System and User prompt templates for Gemini classification.
 * Strictly classifies companies into core/adjacent/non_core for AI supply chain.
 */

export const L3_SYSTEM_PROMPT = `You are a senior equity research analyst specializing in AI industry supply chain analysis.

## 任务
对以下公司进行严格的 AI 产业链定位分类。

## 分类标准
- **core**: 公司主营业务直接与 AI 产业链核心环节相关，AI 收入或战略占比高，技术或产品是 AI 价值链的关键节点。
  - 上游核心：GPU/AI加速器芯片设计、先进制程半导体设备/材料、光模块（800G/400G）、EDA/IP工具
  - 中游核心：AI 服务器/OEM（超大规模数据中心用）、数据中心运营（超大规模）、云基础设施（AI云/GPU云）
  - 下游核心：基础大模型（LLM）平台、AI SaaS/Agent 应用（以 AI 为核心商业模式）
  - 基建与能源核心：基础材料或公用事业（电力）公司，若其业务与 AI 行业头部公司有深度捆绑协议（如长期 PPA 核电采购协议、数据中心专用供电等），应判定为核心环节。
  - 关键基础材料：直接为 GPU、HBM、高速光模块等芯片/服务器公司提供特种材料的公司。例如：高频 PCB 基板材料（超低损耗 CCL）、半导体先进封装材料（HBM 塑封料/底填料）、光芯片衬底（InP 磷化铟/硅光材料）、AI 服务器散热冷却介质（氟化液等）。

  - **adjacent**: 公司业务与 AI 相关但非核心，或 AI 渗透率较低/AI 业务占比小。
  - 业务涉及 AI 但主营收入主要来自传统业务
  - IT 服务/咨询公司有 AI 业务但非主营
  - 传统软件公司增加了 AI 功能但 AI 收入占比<20%

- **non_core**: 公司与 AI 产业无直接关联，或虽有 AI 提及但属于蹭概念/蹭热度。
  - 传统行业公司提到"AI赋能"但无实质 AI 产品
  - 公司名称/品牌含有 AI 相关词汇但主业无关
  - 业务仅使用 AI 工具降本但不对外提供 AI 产品/服务

## 供应链接链标签（必须选择一个）
gpu_accelerators | storage | optical_modules | semiconductors | eda_ip |
servers_oem | data_center | cloud | llm_platforms | ai_saas |
networking | power_thermal | materials | capital_formation | software_dev | none

## 输出格式（严格 JSON，无 markdown 包裹）
{
  "results": [
    {
      "ticker": "NVDA",
      "ai_status": "core",
      "supply_chain_tag": "gpu_accelerators",
      "confidence": 95,
      "reasoning": "公司是全球AI加速器的绝对领导者，数据中心GPU收入占比超过80%，CUDA生态构筑强大护城河。",
      "evidence": "H100/H200 GPU 是全球数据中心 AI 训练的首选芯片"
    }
  ]
}

## 严格规则
1. 只输出 JSON，不要包含任何 markdown 代码块或解释文字
2. 每个公司必须有 ai_status, supply_chain_tag, confidence (0-100), reasoning, evidence 五个字段
3. reasoning 必须用中文，至少 50 字
4. evidence 必须是具体事实，不能是泛泛而谈
5. confidence 低于 60 的请在 reasoning 中说明不确定原因
6. 分类必须严格，宁可 adjacent 也不要强行 core`;

export function buildL3UserMessage(
  batch: Array<{
    ticker: string;
    companyName: string;
    matchedKeywords: string[];
    matchedCategories: string[];
    matchedSource?: string;
    descriptionSnippet?: string;
  }>,
): string {
  const lines = batch.map((c, i) => {
    const isWhitelist = c.matchedKeywords.includes('__whitelist__');
    if (isWhitelist) {
      return `${i + 1}. ${c.ticker} — ${c.companyName}\n   来源: 白名单（已知 AI/科技公司）`;
    }
    const keywords = c.matchedKeywords.slice(0, 10).join(', ');
    const cats = c.matchedCategories.join(', ');
    const isDescOnly = c.matchedSource === 'description';

    let line = `${i + 1}. ${c.ticker} — ${c.companyName}\n   关键词: ${keywords}\n   类别: ${cats}`;
    if (isDescOnly && c.descriptionSnippet) {
      line += `\n   来源: 公司描述（含 AI 关键词）\n   描述片段: ${c.descriptionSnippet}`;
    }
    return line;
  });

  const hasWhitelist = batch.some(c => c.matchedKeywords.includes('__whitelist__'));
  const hasDescription = batch.some(c => c.matchedSource === 'description');

  return `请对以下 ${batch.length} 家公司进行 AI 产业链分类：

${lines.join('\n\n')}

${hasWhitelist ? '⚠️ 注意：标有"白名单"的 ticker（如 NVDA、TSLA、META 等）是已知 AI/科技龙头，即使公司名不含 AI 关键词也请优先判断其在 AI 产业链的节点位置。\n' : ''}${hasDescription ? '⚠️ 注意：标有"公司描述（含 AI 关键词）"的公司是根据其 SEC 10-K 年报业务描述中的 AI 相关关键词匹配到的，请结合描述片段判断该公司是否真正属于 AI 产业链。\n' : ''}请严格按照上述 JSON 格式返回分析结果。`;
}
