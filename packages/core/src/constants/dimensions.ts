export interface DimensionDef {
  id: string;
  name: string;
  nameZh: string;
  category: 'A' | 'B' | 'C' | 'D';
  categoryName: string;
  description: string;
}

export const DIMENSIONS: DimensionDef[] = [
  // [A] Financial Leading Indicators
  { id: 'A1', name: 'RPO/Deferred Revenue Surge', nameZh: 'RPO/递延收入激增', category: 'A', categoryName: 'Financial Leading Indicators', description: 'Remaining performance obligations or deferred revenue showing acceleration, indicating future revenue locked in.' },
  { id: 'A2', name: 'FCF Conversion Inflection', nameZh: 'FCF转化率拐点', category: 'A', categoryName: 'Financial Leading Indicators', description: 'Free cash flow conversion rate showing step-change improvement, signaling operating leverage kicking in.' },
  { id: 'A3', name: 'Gross Margin Step-up', nameZh: '毛利率阶跃', category: 'A', categoryName: 'Financial Leading Indicators', description: 'Gross margin expanding beyond historical range, indicating pricing power or mix shift to higher-margin products.' },

  // [B] Hardware/Semiconductor Deep-dive
  { id: 'B1', name: 'Supply Chain Bottleneck Resolution', nameZh: '供应链瓶颈解除', category: 'B', categoryName: 'Hardware/Semiconductor', description: 'Key supply constraints being resolved, enabling revenue recognition of pent-up demand.' },
  { id: 'B2', name: 'Hyperscaler CAPEX Lock-in', nameZh: '大厂CAPEX绑定', category: 'B', categoryName: 'Hardware/Semiconductor', description: 'Major cloud/tech companies committing large capital expenditures that directly benefit this company.' },
  { id: 'B3', name: 'ASP/Unit Value Uplift', nameZh: '单机价值量提升', category: 'B', categoryName: 'Hardware/Semiconductor', description: 'Average selling price or per-unit value increasing due to product mix, attach rates, or platform transitions.' },

  // [C] Software/SaaS Deep-dive
  { id: 'C1', name: 'Customer ROI Validation', nameZh: '客户ROI验证', category: 'C', categoryName: 'Software/SaaS', description: 'Concrete evidence that customers are seeing measurable ROI from the product, driving expansion and referrals.' },
  { id: 'C2', name: 'Compute Economics Inflection', nameZh: '算力经济学拐点', category: 'C', categoryName: 'Software/SaaS', description: 'Cost of AI inference/training dropping to a level that unlocks new use cases or makes unit economics viable.' },
  { id: 'C3', name: 'Legacy Business Cannibalization Defense', nameZh: '旧业务蚕食防御', category: 'C', categoryName: 'Software/SaaS', description: 'Evidence that AI products are additive rather than cannibalizing existing revenue streams.' },

  // [D] Sentiment & Game Theory
  { id: 'D1', name: 'Management Defensive Evasion', nameZh: '管理层防御闪躲', category: 'D', categoryName: 'Sentiment & Game Theory', description: 'Management dodging or deflecting tough questions, potentially hiding deteriorating fundamentals.' },
  { id: 'D2', name: 'Guidance Unusual Confidence', nameZh: '指引异常自信', category: 'D', categoryName: 'Sentiment & Game Theory', description: 'Management providing unusually specific or confident forward guidance, signaling strong visibility.' },
  { id: 'D3', name: 'Analyst Tone Reversal', nameZh: '分析师语气反转', category: 'D', categoryName: 'Sentiment & Game Theory', description: 'Sell-side analysts shifting from bearish to bullish (or vice versa) in Q&A tone and follow-up questions.' },
];

export const DIMENSION_MAP = new Map(DIMENSIONS.map(d => [d.id, d]));
