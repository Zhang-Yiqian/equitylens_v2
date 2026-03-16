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

/**
 * 8-Dimension Cross-Validation Matrix (PRD v1.0)
 * Categories: A (10-K竞争格局), B (财务异动), C (新闻事件)
 */
export interface CrossDimensionDef {
  id: string;
  name: string;
  nameZh: string;
  category: 'A' | 'B' | 'C';
  categoryName: string;
  description: string;
}

export const CROSS_DIMENSIONS: CrossDimensionDef[] = [
  // [A] 10-K 竞争格局基线
  { id: 'A1', name: '10-K Moat Verification', nameZh: '护城河有效性验证', category: 'A', categoryName: '10-K竞争格局基线', description: '10-K Business 描述的竞争优势是否在财务数据中得到验证（毛利率/市场份额稳定性）' },
  { id: 'A2', name: 'Risk Factor Falsification', nameZh: '风险因子证伪', category: 'A', categoryName: '10-K竞争格局基线', description: '10-K Risk Factors 中列出的风险，当前是否已有实质性恶化证据，还是依然可控' },

  // [B] 财务异动侦测
  { id: 'B1', name: 'Operating Leverage Release', nameZh: '经营杠杆释放', category: 'B', categoryName: '财务异动侦测', description: '收入增速是否开始超越成本增速，经营杠杆是否进入正向释放阶段' },
  { id: 'B2', name: 'Cash Flow / CAPEX Scissors', nameZh: '现金流/CAPEX剪刀差', category: 'B', categoryName: '财务异动侦测', description: '经营现金流增长同时CAPEX趋稳/下降，FCF加速改善的剪刀差效应' },
  { id: 'B3', name: 'Margin Step Change', nameZh: '利润率阶跃', category: 'B', categoryName: '财务异动侦测', description: '毛利率/净利率出现超越历史区间的阶跃式改善，而非线性渐进' },

  // [C] 新闻事件验证
  { id: 'C1', name: 'Large Order & Product Delivery', nameZh: '大单与新品兑现', category: 'C', categoryName: '新闻事件验证', description: '近期新闻中大订单/新产品发布是否与财务数据的增长拐点相互印证' },
  { id: 'C2', name: 'Industry Chain Resonance', nameZh: '产业链共振', category: 'C', categoryName: '新闻事件验证', description: '上下游产业链伙伴（客户/供应商）的新闻动态是否与本公司逻辑共振' },
  { id: 'C3', name: 'Cost Reduction Execution', nameZh: '降本增效落地', category: 'C', categoryName: '新闻事件验证', description: '管理层曾承诺的降本举措是否在财务数据和新闻事件中看到落地证据' },
];

export const CROSS_DIMENSION_MAP = new Map(CROSS_DIMENSIONS.map(d => [d.id, d]));
