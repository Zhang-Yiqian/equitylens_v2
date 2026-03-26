// ── AI Chain Keyword Configuration ─────────────────────────────────────────────
// Used by L2 regex matcher and blacklist/whitelist.

export const AI_KEYWORD_CONFIG = {
  whitelistExact: [
    'NVDA', 'AMD', 'INTC', 'QCOM', 'TSM', 'AVGO', 'MRVL', 'AMAT',
    'AI', 'PLTR', 'CRWD', 'APP', 'DDOG', 'SNOW', 'NET', 'VEEV',
  ],

  categories: {
    gpu_accelerators: {
      label: 'GPU/加速器',
      keywords: [
        'AI', 'GPU', 'Graphics Processing Unit', 'HBM', 'high bandwidth memory',
        'AI accelerator', 'NPU', 'TPU', 'train', 'inference chip',
        'CUDA', 'ROCm', 'parallel compute',
      ],
    },
    memory_storage: {
      label: '存储',
      keywords: [
        'AI', 'memory', 'DRAM', 'SRAM', 'NAND', 'flash storage', 'SSD',
        'solid state drive', 'storage subsystem', 'HBM', 'NVM express',
        'data center memory',
      ],
    },
    optical_modules: {
      label: '光模块',
      keywords: [
        'AI', 'optical', 'photonics', '光模块', '光通信', '光互连',
        'co-packaged optics', 'CPO', 'optical transceiver', 'silicon photonics',
        'laser diode', 'VCSEL', 'LWDM', 'CWDM4',
      ],
    },
    semiconductors: {
      label: '半导体',
      keywords: [
        'AI', 'semiconductor', 'foundry', 'fabrication', 'wafer', 'chip',
        'AI chip', 'advanced node', '3nm', '5nm', '7nm', '14nm', '28nm',
        'SiGe', 'GaN', 'SiC', 'compound semiconductor',
      ],
    },
    eda_ip: {
      label: 'EDA/IP',
      keywords: [
        'AI', 'EDA', 'electronic design automation', 'IP core', 'semiconductor IP',
        'layout', 'tape-out', 'PDK', 'ARM architecture',
        'RISC-V', 'processor core',
      ],
    },
    servers_oem: {
      label: '服务器/OEM',
      keywords: [
        'AI', 'server', 'data center server', 'OEM', 'white-box server',
        'GPU server', 'AI server', 'rack server', 'blade server',
        'system integrator', 'Dell', 'HPE', 'Lenovo',
      ],
    },
    data_center: {
      label: '数据中心',
      keywords: [
        'AI', 'data center', 'hyperscale', 'colocation', 'edge compute',
        'data center infrastructure', 'cooling system', 'power distribution',
        'UPS', 'PDU', 'electrical infrastructure', 'AI compute',
      ],
    },
    cloud: {
      label: '云平台',
      keywords: [
        'AI', 'cloud', 'IaaS', 'PaaS', 'SaaS', 'cloud service',
        'AWS', 'Azure', 'Google Cloud', 'cloud provider', 'multi-cloud',
        'cloud infrastructure', 'region', 'availability zone',
      ],
    },
    llm_platforms: {
      label: 'LLM平台',
      keywords: [
        'AI', 'LLM', 'large language model', 'generative AI', 'GenAI',
        'foundation model', 'AI model', 'artificial intelligence',
        'machine learning', 'deep learning', 'neural network',
        'NLP', 'natural language processing', 'chatbot', 'AI assistant',
        'AI API', 'model serving', 'inference', 'AI platform',
      ],
    },
    ai_saas: {
      label: 'AI SaaS',
      keywords: [
        'AI', 'AI-powered', 'AI-enabled', 'AI-driven', 'intelligent automation',
        'AI application', 'enterprise AI', 'AI copilot', 'AI assistant',
        'conversational AI', 'AI analytics', 'AI cybersecurity',
        'AI software', 'AI solution',
      ],
    },
    networking: {
      label: '网络',
      keywords: [
        'AI', 'networking', 'ethernet', 'InfiniBand', 'network switch',
        'router', 'network fabric', 'CXL', 'PCIe', 'fabric interconnect',
        'top-of-rack', 'data center network',
      ],
    },
    power_thermal: {
      label: '电力/散热',
      keywords: [
        'AI', 'power', 'thermal', 'cooling', 'liquid cooling', 'immersion cooling',
        'data center power', 'energy efficiency', 'PUE', 'power delivery',
        'power management', 'heat dissipation',
      ],
    },
  },
};

export type AIKeywordCategory = keyof typeof AI_KEYWORD_CONFIG.categories;
