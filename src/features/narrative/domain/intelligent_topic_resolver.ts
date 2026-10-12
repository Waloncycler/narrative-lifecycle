import type { EvidenceCandidate } from '@/features/intake/types/intake';
import type { TopicRegistry, TopicResolution } from '@/features/narrative/types/topic_resolution';

export interface FrontierEcosystemDefinition {
  topic_id: string;
  display_name_zh: string;
  display_name_en: string;
  domain: 'energy' | 'ai' | 'robotics' | 'biotech' | 'quantum' | 'aerospace' | 'semiconductor' | 'advanced_manufacturing' | 'financial' | 'cross_industry';
  /** Leading enterprises, research labs, institutional authorities in this domain (Bilingual) */
  key_entities: string[];
  /** Core technological routes, materials, bottleneck components, mechanisms, chemical formulas (Bilingual) */
  core_technologies: string[];
  /** High-salience milestone and official action indicators (FDA, CAAC, SEC, NMPA, Patent, CAICT) */
  action_milestones: string[];
  /** Negative filtering keywords for context disambiguation */
  negative_filters: string[];
  /** Sub-branch classification taxonomy */
  branches: Array<{
    branch_id: string;
    branch_name_zh: string;
    branch_name_en: string;
    keywords: string[];
  }>;
}

export const FRONTIER_ECOSYSTEM_REGISTRY: FrontierEcosystemDefinition[] = [
  // ==================== 1. 固态电池 (Solid-State Battery) ====================
  {
    topic_id: 'solid_state_battery',
    display_name_zh: '固态电池',
    display_name_en: 'Solid-State Battery',
    domain: 'energy',
    key_entities: [
      '清陶能源', '清陶', '卫蓝新能源', '卫蓝', '辉能科技', '辉能', '恩力动力', '太蓝新能源', '高能时代', '领新新能源',
      'QuantumScape', 'Solid Power', 'SES AI', 'Factorial Energy', 'StoreDot', 'ProLogium', 'Blue Solutions', 'Sakuu',
      '宁德时代', 'CATL', '比亚迪', 'BYD', '中创新航', '国轩高科', '赣锋锂业', '天齐锂业', '当升科技', '容百科技', '厦钨新能',
      '上汽智己', '广汽埃安', '蔚来汽车', 'NIO', '丰田', 'Toyota Solid State', '本田', '日产', 'Panasonic', 'LG Energy Solution',
      '中科院物理所', '中科院青岛能源所', 'CAS Institute of Physics',
    ],
    core_technologies: [
      '固态电池', '全固态', '半固态', 'solid-state', 'solid state battery', 'all-solid-state', 'semi-solid', 'solid electrolyte',
      '硫化物电解质', '硫化物固态', 'sulfide electrolyte', 'li10gep2s12', 'lgps', 'li6ps5cl', 'argyrodite', '硫化锂', 'li2s',
      '氧化物电解质', '氧化物陶瓷', 'oxide electrolyte', 'llzo', 'latp', 'lagp', '石榴石型', 'garnet type', 'nasicon',
      '聚合物固态', 'polymer electrolyte', 'peo', '有机无机复合', '凝胶复合固态',
      '卤化物电解质', 'halide electrolyte', 'li3incl6', 'li3ycl6',
      '锂金属负极', 'lithium metal anode', '硅碳负极', 'silicon-carbon anode', '无负极固态', 'anode-free solid-state',
      '界面阻抗', 'interface impedance', '固固界面', 'solid-solid interface', '原位固化', 'in-situ solidification',
      '复合集流体', 'composite current collector', '超薄锂箔', '干法电极', 'dry electrode coating', '等静压', 'cold isostatic pressing',
      '能量密度500wh', '400wh/kg', '500wh/kg', '1000wh/l', 'dendrite suppression', '枝晶抑制',
    ],
    action_milestones: [
      '装车验证', 'vehicle validation', '中试线', 'pilot line', '量产线', 'mass production line', '产线动工', '通线',
      '样件交付', 'a样交付', 'b样测试', 'c样验证', '循环寿命', 'cycle life', '针刺测试', 'nail penetration test',
      '能量密度突破', '定点合作', '首发搭载', '1000km续航', 'ctc集成',
    ],
    negative_filters: [
      '手机电池续航', '普通充电宝', '铅酸蓄电池', '常规三元铁锂', '普通磷酸铁锂', '手机耗电', '数码配件', '电动车充电器插头',
    ],
    branches: [
      {
        branch_id: 'solid_state_sulfide',
        branch_name_zh: '硫化物技术路线',
        branch_name_en: 'Sulfide-based Electrolyte',
        keywords: ['硫化物', 'sulfide', '硫化物电解质', 'li10gep2s12', 'lgps', 'argyrodite', '硫化锂', 'li2s', '丰田路线'],
      },
      {
        branch_id: 'solid_state_oxide',
        branch_name_zh: '氧化物技术路线',
        branch_name_en: 'Oxide-based Electrolyte',
        keywords: ['氧化物', 'oxide', 'llzo', 'latp', 'lagp', '石榴石', 'garnet', '陶瓷隔膜', '原位固化半固态', '卫蓝路线'],
      },
      {
        branch_id: 'solid_state_polymer',
        branch_name_zh: '聚合物与复合电解质',
        branch_name_en: 'Polymer & Composite Route',
        keywords: ['聚合物', 'polymer', 'peo', '有机无机复合', '凝胶复合', '聚碳酸亚乙酯'],
      },
      {
        branch_id: 'solid_state_equipment',
        branch_name_zh: '制造设备与关键材料',
        branch_name_en: 'Manufacturing Equipment & Materials',
        keywords: ['等静压设备', 'isostatic press', '干法电极设备', 'dry electrode', '固态涂布机', '复合铜箔', '锂带', '超薄锂箔'],
      },
      {
        branch_id: 'solid_state_vehicle_integration',
        branch_name_zh: '整车装车与系统集成',
        branch_name_en: 'Vehicle Integration & Testing',
        keywords: ['装车测试', '上车示范', '搭载固态', '能量包集成', 'ctc技术', '1000公里续航', 'pack能量密度'],
      },
    ],
  },

  // ==================== 2. 钠离子电池 (Sodium-Ion Battery) ====================
  {
    topic_id: 'sodium_ion_battery',
    display_name_zh: '钠离子电池',
    display_name_en: 'Sodium-Ion Battery',
    domain: 'energy',
    key_entities: [
      '中科海钠', '钠创新能源', '众钠能源', '传艺科技', '维科技术', '华阳股份', '珈钠能源',
      '宁德时代钠电', '比亚迪钠电', '亿纬锂能', '鹏辉能源', '孚能科技', 'Natron Energy', 'Faradion', 'Northvolt',
    ],
    core_technologies: [
      '钠离子电池', '钠电池', 'sodium-ion battery', 'na-ion battery', 'sodium battery',
      '层状氧化物', 'layered oxide', '普鲁士蓝', '普鲁士白', 'prussian blue', '聚阴离子', 'polyanion', 'na3v2(po4)3', 'nsvp',
      '硬碳负极', 'hard carbon', '无烟煤前驱体', '六氟磷酸钠', 'nafp6', '高低温性能', '-40℃放电',
    ],
    action_milestones: [
      '钠电装车', '两轮车量产', '钠电储能电站并网', 'gwh量产线交付', '低温性能认证',
    ],
    negative_filters: ['食用盐', '小苏打', '氯化钠化工工业原料常规运输'],
    branches: [
      {
        branch_id: 'sodium_layered_oxide',
        branch_name_zh: '层状氧化物正极路线',
        branch_name_en: 'Layered Oxide Cathode',
        keywords: ['层状氧化物', 'layered oxide', 'o3相', 'p2相', '能量密度优势'],
      },
      {
        branch_id: 'sodium_polyanion_storage',
        branch_name_zh: '聚阴离子与大储能应用',
        branch_name_en: 'Polyanion for Energy Storage',
        keywords: ['聚阴离子', 'polyanion', '硫酸钒钠', '磷酸钒钠', '长循环储能'],
      },
      {
        branch_id: 'sodium_hard_carbon',
        branch_name_zh: '硬碳负极材料',
        branch_name_en: 'Hard Carbon Anode',
        keywords: ['硬碳', 'hard carbon', '生物质硬碳', '树脂前驱体', '首效提升'],
      },
    ],
  },

  // ==================== 3. 脑机接口 (Brain-Computer Interface) ====================
  {
    topic_id: 'bci',
    display_name_zh: '脑机接口',
    display_name_en: 'Brain-Computer Interface',
    domain: 'biotech',
    key_entities: [
      'Neuralink', 'Synchron', 'Precision Neuroscience', 'Blackrock Neurotech', 'Paradromics', 'Onward Medical', 'Motional',
      '脑虎科技', 'NeuroXess', '傲意科技', '阶梯医疗', '脑陆科技', '微灵医疗', '博睿康', '脑动极光',
      '华山医院', '天坛医院', '宣武医院', '清华大学医学院', '浙江大学双脑中心', 'CAS Shanghai Institute of Microsystem',
    ],
    core_technologies: [
      '脑机接口', 'bci', 'brain-computer interface', 'brain-machine interface', 'bmi',
      '侵入式脑机', 'invasive bci', '非侵入式脑机', 'non-invasive bci', '半侵入式', 'semi-invasive',
      '皮层脑电', 'ecog', 'eeg', 'local field potentials', 'lfp', '神经探针', 'neural probe', '微丝电极', 'micro-wire array',
      '柔性电极', 'flexible neural electrode', '血管支架电极', 'stentrode', '闭环神经调控', 'closed-loop neuromodulation',
      '运动意图解码', 'motor intent decoding', '神经假体', 'neural prosthesis', '脑脊接口', 'brain-spine interface',
      '语音脑电解码', 'speech neuroprosthesis', '视神经电刺激', 'visual cortex stimulation',
    ],
    action_milestones: [
      '临床试验批准', 'ind approval', 'ide approval', '人体植入', 'first human implant', '受试者招募',
      'fda breakthrough device', 'fda突破性医疗器械', 'nct0', 'clinicaltrials.gov', '意念打字', '意念控制机械臂',
    ],
    negative_filters: ['普通蓝牙耳机', '常规降噪耳塞', '普通VR头显', '常规心理体检量表'],
    branches: [
      {
        branch_id: 'bci_medical_rehab',
        branch_name_zh: '医疗与神经功能康复',
        branch_name_en: 'Medical Rehabilitation & Neuro-restoration',
        keywords: ['偏瘫康复', '卒中康复', '脊髓损伤', 'sci', '渐冻症', 'als', '失语症解码', '抑郁症调控', '癫痫闭环治疗', 'quadriplegia', 'paralysis', 'rehabilitation', 'feasibility study', 'stentrode'],
      },
      {
        branch_id: 'bci_implantable',
        branch_name_zh: '植入式电极硬件与芯片',
        branch_name_en: 'Implantable Electrodes & ASIC Hardware',
        keywords: ['植入式芯片', 'neural asic', '柔性微电极阵列', '高通道神经探针', '无线能量传输遥测', '血管介入脑机', 'micro-wire', 'probe'],
      },
      {
        branch_id: 'bci_decoding_algorithm',
        branch_name_zh: '神经信号AI解码与大模型',
        branch_name_en: 'Neural Signal AI Decoding & Models',
        keywords: ['神经解码大模型', 'neural foundation model', '运动皮层意图解码', '连续语音重建', '离散字符生成', 'motor intent', 'decoding'],
      },
    ],
  },

  // ==================== 4. 具身智能与人形机器人 (Humanoid Robotics & Embodied AI) ====================
  {
    topic_id: 'humanoid_robotics',
    display_name_zh: '人形机器人与具身智能',
    display_name_en: 'Humanoid Robotics & Embodied AI',
    domain: 'robotics',
    key_entities: [
      '智元机器人', 'Agibot', '宇树科技', 'Unitree', '优必选', 'UBTECH', '银河通用', 'Galbot', '逐际动力', 'LimX Dynamics',
      '傅利叶智能', 'Fourier Intelligence', '乐聚机器人', '星动纪元', '加速进化', '跨维智能',
      'Tesla Optimus', 'Optimus', 'Figure AI', 'Boston Dynamics', '1X Technologies', 'Apptronik', 'Agility Robotics', 'Sanctuary AI',
      '绿的谐波', '三花智控', '鸣志电器', '拓普集团', '中大力德', '双环传动', '步科股份', '柯力传感',
    ],
    core_technologies: [
      '人形机器人', 'humanoid robot', 'humanoid robotics', 'bipedal robot', '具身智能', 'embodied ai', 'embodied intelligence',
      '行星滚柱丝杠', 'planetary roller screw', '梯形丝杠', '谐波减速器', 'harmonic drive', 'rv减速器',
      '无框力矩电机', 'frameless torque motor', '空心杯电机', 'coreless motor', '准直驱执行器', 'qdd actuator',
      '灵巧手', 'dexterous hand', '多指灵巧操作', '六维力传感器', '6-axis force torque sensor', '电子皮肤', 'tactile sensor array',
      '全身动力学控制', 'whole-body control', 'wbc', '模型预测控制', 'mpc', '强化学习运控', 'sim2real',
      '视觉语言动作大模型', 'vla model', 'vision-language-action', 'rt-2', 'pi0', '端到端具身操作',
    ],
    action_milestones: [
      '进厂实训', 'factory deployment', '汽车产线装配', '量产下线', 'mass production rollout', '万台订单协议',
      '全自主物料搬运', '灵巧螺丝装配', '复杂地形双足越障',
    ],
    negative_filters: ['扫地机器人', '儿童陪伴玩具', '普通agv仓储平板车', '常规四轴工业机械臂焊接'],
    branches: [
      {
        branch_id: 'humanoid_embodied_ai',
        branch_name_zh: '具身大脑与VLA端到端模型',
        branch_name_en: 'Embodied AI Brain & VLA Models',
        keywords: ['具身大模型', 'vla模型', '视觉语言动作模型', '端到端自主操作', '多模态任务规划', '具身模仿学习', 'vision-language-action'],
      },
      {
        branch_id: 'humanoid_actuators_hardware',
        branch_name_zh: '核心关节执行器与减速传动',
        branch_name_en: 'Joint Actuators & Transmission',
        keywords: ['行星滚柱丝杠', 'roller screw', 'planetary roller', '谐波减速器', 'harmonic', '旋转执行器', '线性执行器', '力矩电机', '空心杯电机', '关节模组', 'tactile sensor', '6-axis force'],
      },
      {
        branch_id: 'humanoid_dexterous_hands',
        branch_name_zh: '灵巧手与高精触觉传感',
        branch_name_en: 'Dexterous Hands & Tactile Sensing',
        keywords: ['灵巧手', 'dexterous hand', '多指操作', '腱绳驱动', '微型伺服舵机', '六维力矩传感器', '阵列触觉传感器'],
      },
      {
        branch_id: 'humanoid_industrial_deployment',
        branch_name_zh: '汽车与高端制造工业实训',
        branch_name_en: 'Industrial & Automotive Deployment',
        keywords: ['工厂实训', 'factory pilot', '汽车产线装配', '3c精密组装', '物料配送分拣', '量产示范工厂'],
      },
    ],
  },

  // ==================== 5. 可控核聚变与先进核能 (Nuclear Fusion) ====================
  {
    topic_id: 'provisional_nuclear_fusion_advanced_nuclear',
    display_name_zh: '可控核聚变与先进核能',
    display_name_en: 'Nuclear Fusion & Advanced Nuclear',
    domain: 'energy',
    key_entities: [
      '能量奇点', 'Energy Singularity', '新奥聚变', 'ENN Fusion', '星环聚能', 'Startorus Fusion', '聚变新能', '瀚海聚能',
      'Tokamak Energy', 'Commonwealth Fusion Systems', 'CFS', 'Helion Energy', 'TAE Technologies', 'Zap Energy', 'Type One Energy',
      '中核集团', 'CNNC', '中广核', 'CGN', '中科院等离子体物理所', 'ASIPP', '合肥物质院', 'EAST', 'CFETR', 'HL-3', 'ITER',
    ],
    core_technologies: [
      '可控核聚变', 'nuclear fusion', 'controlled fusion', '托卡马克', 'tokamak', '球形托卡马克', 'spherical tokamak',
      '磁约束聚变', 'magnetic confinement fusion', 'mcf', '惯性约束聚变', 'inertial confinement', 'icf', '场反转构型', 'frc', '仿星器', 'stellarator',
      '高温超导磁体', 'high-temperature superconducting magnet', 'hts magnet', 'rebco带材', '20t强磁场', 'superconducting magnet',
      '稳态等离子体放电', 'steady-state plasma', 'lawson criterion', '劳森判据', 'q值突破', 'q>1', '净能量增益', 'net energy gain',
      '氘氚聚变', 'd-t fusion', '质子硼聚变', 'p-b11 fusion', '第一壁材料', 'plasma-facing components', '氚增殖包层',
    ],
    action_milestones: [
      '等离子体点火', 'plasma ignition', '百秒级高约束放电', '强超导磁场测试', '主机装置总装交付', '聚变发电并网路线图',
    ],
    negative_filters: ['普通核酸检测', '三代核电常规换料大修', '常规核医学同位素检查'],
    branches: [
      {
        branch_id: 'fusion_magnetic_confinement',
        branch_name_zh: '托卡马克与磁约束主机装置',
        branch_name_en: 'Tokamak & Magnetic Host Facility',
        keywords: ['托卡马克主机', '超导托卡马克', '球形环', '等离子体平衡控制', '磁通注入', 'spherical tokamak'],
      },
      {
        branch_id: 'fusion_hightemp_superconducting',
        branch_name_zh: '高温超导磁体与强磁场系统',
        branch_name_en: 'HTS Magnets & Extreme Fields',
        keywords: ['高温超导磁体', 'superconducting magnet', 'hts magnet', 'rebco', '20 tesla', '20t', '强磁体线圈'],
      },
      {
        branch_id: 'fusion_commercial_power',
        branch_name_zh: '聚变电站工程与发电并网',
        branch_name_en: 'Fusion Power Plant & Grid Delivery',
        keywords: ['聚变示范堆', 'q>1实现', '净能量输出', '聚变热电转换', '商业聚变堆概念设计', 'sparc'],
      },
    ],
  },

  // ==================== 6. 低空经济与 eVTOL (Low-Altitude Economy) ====================
  {
    topic_id: 'provisional_low_altitude_economy',
    display_name_zh: '低空经济与 eVTOL',
    display_name_en: 'Low-Altitude Economy & eVTOL',
    domain: 'aerospace',
    key_entities: [
      '亿航智能', 'EHang', '峰飞航空', 'AutoFlight', '沃兰特', 'Volant', '小鹏汇天', 'XPENG AEROHT', '御风未来', '时的科技', 'TCab Tech', '沃飞长空',
      'Joby Aviation', 'Archer Aviation', 'Lilium', 'Volocopter', 'Vertical Aerospace', 'Beta Technologies', 'Eve Air Mobility',
      '中国民用航空局', '民航局', 'CAAC', '美国联邦航空局', 'FAA', '欧洲航空安全局', 'EASA', '中信海直', '顺丰丰翼', '美团无人机',
    ],
    core_technologies: [
      '低空经济', 'low-altitude economy', 'evtol', 'electric vertical takeoff and landing', '电动垂直起降', '飞行汽车', 'flying car',
      '倾转旋翼', 'tiltrotor', '复合翼', 'lift-plus-cruise', '多旋翼evtol', '分布式电推进', 'dep',
      '适航取证', 'airworthiness certification', '型号合格证', 'type certificate', 'tc证', '生产许可证', 'production certificate', 'pc证', '单机适航证', 'ac证',
      '低空空域管理', 'airspace management', '城市空中交通', 'urban air mobility', 'uam', '低空智联网', '5g-a通感一体', '起降场', 'vertiport',
    ],
    action_milestones: [
      '取得TC证', 'tc certificate issued', '取得PC证', '生产许可证颁发', '跨海载人首飞', '商业航线试运营', '空域低空开放批复', '百架批量采购协议',
    ],
    negative_filters: ['常规波音空客客机准点率', '大型军用战略运输机', '民用消费级航拍无人机新手教程'],
    branches: [
      {
        branch_id: 'evtol_aircraft_certification',
        branch_name_zh: 'eVTOL整机研发与适航审定',
        branch_name_en: 'eVTOL Aircraft & Airworthiness Certification',
        keywords: ['适航取证', 'tc证获批', '型号合格审定', '倾转旋翼试飞', '整机适航取证', '民航局审查报告', '型号合格证', 'tc证', 'type certificate', 'airworthiness'],
      },
      {
        branch_id: 'low_altitude_infrastructure',
        branch_name_zh: '垂直起降场与低空通感空管',
        branch_name_en: 'Vertiports & Low-Altitude Air Traffic Network',
        keywords: ['起降枢纽', 'vertiport', '低空雷达监控', '低空航路网', '5g-a通感一体', '空管调度系统'],
      },
      {
        branch_id: 'low_altitude_logistics_urban',
        branch_name_zh: '城市载人出行与低空物流运营',
        branch_name_en: 'Urban Air Mobility & Cargo Logistics',
        keywords: ['城市空中交通', '空中观光航线', '城际低空快线', '医疗急救低空运输', '无人机即时配送'],
      },
    ],
  },

  // ==================== 7. 算力芯片与光互连基础设施 (Computing Infrastructure & Optics) ====================
  {
    topic_id: 'provisional_computing_infrastructure',
    display_name_zh: '算力基础设施与智算硬件',
    display_name_en: 'Computing Infrastructure & Optical Interconnect',
    domain: 'semiconductor',
    key_entities: [
      'Nvidia', 'AMD', 'Intel', 'Broadcom', 'Marvell', 'TSMC',
      '华为昇腾', '寒武纪', 'Cambricon', '海光信息', 'Hygon', '摩尔线程', 'Moore Threads', '壁仞科技', 'Biren', '燧原科技',
      '中际旭创', 'Innolight', '新易盛', 'Eoptolink', '天孚通信', 'TFC', '工业富联', 'Foxconn Industrial Internet', '浪潮信息', '中科曙光',
    ],
    core_technologies: [
      '智算中心', 'ai computing center', '万卡集群', '10k gpu cluster', '算力集群', 'ai算力调度',
      '800g光模块', '800g transceivers', '1.6t光模块', '1.6t optics', '光电共封装', 'cpo', 'co-packaged optics', '硅光芯片', 'silicon photonics',
      '液冷服务器', 'liquid cooling server', '浸没式液冷', 'immersion cooling', '冷板式液冷', 'cold plate cooling', 'pue指标',
      'rdma网络', 'roce v2', 'infiniband', 'nvlink', 'pcie 6.0', 'pcie 7.0', '高带宽内存', 'hbm3e', 'hbm4', '存算一体',
    ],
    action_milestones: [
      '智算中心点亮通电', '万卡集群上线满载运行', '1.6T光模块批量出货', 'CPO交换机量产验证', '液冷PUE达到1.1以下',
    ],
    negative_filters: ['家用组装电脑显卡跑分', '网吧配置升级方案', '普通企业办公路由器配置'],
    branches: [
      {
        branch_id: 'ai_accelerator_chips',
        branch_name_zh: 'AI算力芯片与HBM高带宽存储',
        branch_name_en: 'AI Accelerators & HBM Memory',
        keywords: ['gpu加速卡', 'npu架构', 'hbm3e', 'hbm4', '2.5d先进封装算力卡', '训推一体芯片'],
      },
      {
        branch_id: 'optical_networking_cpo',
        branch_name_zh: '800G/1.6T光模块与CPO硅光互联',
        branch_name_en: '800G/1.6T Optics & CPO Interconnect',
        keywords: ['800g', '1.6t', 'cpo', 'co-packaged optics', '光模块', '硅光', 'osfp', 'rdma', 'transceivers'],
      },
      {
        branch_id: 'liquid_cooling_datacenter',
        branch_name_zh: '绿色全液冷与数据中心基础设施',
        branch_name_en: 'Immersion Liquid Cooling & Green DC',
        keywords: ['浸没式液冷', '冷板液冷系统', 'pue<1.15', '智算中心并网点亮', 'cdus冷量分配单元', 'immersion liquid cooling'],
      },
    ],
  },

  // ==================== 8. AI 智能体与 Agentic 架构 (AI Agents) ====================
  {
    topic_id: 'provisional_ai_agents',
    display_name_zh: 'AI 智能体与 Agentic 架构',
    display_name_en: 'AI Agents & Agentic Workflows',
    domain: 'ai',
    key_entities: [
      'OpenAI Operator', 'Anthropic Computer Use', 'Google Project Jarvis', 'DeepMind AlphaCode', 'AutoGPT', 'CrewAI', 'LangChain', 'Devin', 'Cognition',
      '智谱AI', 'GLM-PC', 'MiniMax', '月之暗面', 'Kimi', '百川智能', '商汤日日新', '阿里通义智能体', '字节豆包智能体平台',
    ],
    core_technologies: [
      'ai agent', '智能体', 'agentic', 'agentic workflow', '多智能体系统', 'multi-agent system', '自主智能体', 'autonomous agent',
      '工具调用', 'tool use', 'function calling', '长程规划', 'task decomposition', '自我反思', 'reflexion', '自适应纠错',
      '计算机操作智能体', 'computer use', 'gui agent', 'os agent', '端到端软件工程智能体', 'autonomous coding agent',
    ],
    action_milestones: [
      'swe-bench测试突破', '企业级智能体自动化产线投产', '多智能体协作协议发布', '长程复杂工作流全自动达成',
    ],
    negative_filters: ['传统固定问答客服菜单', '简单的正则表达式抓取工具'],
    branches: [
      {
        branch_id: 'agentic_workflow_frameworks',
        branch_name_zh: '多智能体协作与复杂工作流编排',
        branch_name_en: 'Multi-Agent Collaboration & Orchestration',
        keywords: ['多智能体协同', 'agent编排框架', '复杂工作流自治', '长程任务拆解与验证', 'multi-agent', 'orchestration'],
      },
      {
        branch_id: 'os_gui_agent_interaction',
        branch_name_zh: '系统级GUI操作与自动化智能体',
        branch_name_en: 'OS & GUI Operating Autonomous Agents',
        keywords: ['computer use', 'gui操作', '屏幕视觉解析', '跨桌面软件自主执行', '移动端自动化智能体', 'os agent'],
      },
    ],
  },

  // ==================== 9. 抗体偶联药物 (Antibody-Drug Conjugates, ADC) ====================
  {
    topic_id: 'provisional_antibody_drug_conjugates',
    display_name_zh: '抗体偶联药物 (ADC)',
    display_name_en: 'Antibody-Drug Conjugates (ADC)',
    domain: 'biotech',
    key_entities: [
      '科伦博泰', '荣昌生物', '百利天恒', '恒瑞医药', '信达生物', '翰森制药', '迈威生物',
      'AstraZeneca', 'Daiichi Sankyo', '第一三共', 'Gilead', 'Seagen', 'Pfizer', 'Roche', 'Merck',
      'NMPA', 'FDA', 'CDE', 'ASCO', 'ESMO',
    ],
    core_technologies: [
      'adc', 'antibody-drug conjugate', '抗体偶联药物', '双抗adc', 'bispecific adc', '双靶点adc',
      '有效载荷', 'payload', '拓扑异构酶抑制剂', 'topoisomerase i inhibitor', 'deruxtecan', 't-dxd', 'mmae', 'mmaf',
      '连接子', 'linker', '可裂解连接子', 'cleavable linker', '定点偶联技术', 'site-specific conjugation', 'dar值', 'drug-to-antibody ratio',
      'her2 adc', 'trop2 adc', 'claudin18.2 adc', 'egfr adc', 'her3 adc', 'b7-h3 adc',
      '旁观者效应', 'bystander effect', '耐药克服', '无进展生存期', 'pfs', '总生存期', 'os', '客观缓解率', 'orr',
    ],
    action_milestones: [
      'fda突破性疗法认定', 'btd', 'nmpa附条件批准上市', '全球对外授权license-out', '数十亿美元交易总额', '临床3期头对头优效达到终点',
    ],
    negative_filters: ['普通抗生素软膏说明书', '常规体检血常规化验单'],
    branches: [
      {
        branch_id: 'adc_nextgen_platforms',
        branch_name_zh: '双抗ADC与下一代偶联平台',
        branch_name_en: 'Bispecific ADC & Next-Gen Linker Platform',
        keywords: ['双抗adc', '双特异性adc', '创新连接子', '新型亲水多肽payload', '定点酶促偶联', 'topoisomerase', 'payload', 'linker'],
      },
      {
        branch_id: 'adc_clinical_milestones',
        branch_name_zh: '重磅临床数据读出与全球获批',
        branch_name_en: 'Pivotal Clinical Readout & Global Approvals',
        keywords: ['phase 3临床优效', 'fda获批新适应症', 'nmpa上市申请受审', '一线疗法突破', 'pfs显著延长', 'clinical trial'],
      },
      {
        branch_id: 'adc_global_license_out',
        branch_name_zh: '跨国药企重磅BD与对外授权',
        branch_name_en: 'Global License-Out & BD Deals',
        keywords: ['跨国药企授权合作', '首付款首期付款', '里程碑付款', '全球独家开发权', '数十亿美元bd大单', 'licensing transaction'],
      },
    ],
  },

  // ==================== 10. 放射性核素药物 (Radiopharmaceuticals) ====================
  {
    topic_id: 'provisional_radiopharmaceuticals',
    display_name_zh: '放射性核药与核医学',
    display_name_en: 'Radiopharmaceuticals & Targeted Radionuclide Therapy',
    domain: 'biotech',
    key_entities: [
      '中国同辐', '东诚药业', '远大医药', '先通医药', '智核生物', '辐联医药', '核欣医药',
      'Novartis', '诺华', 'Point Biopharma', 'Eli Lilly', 'BMS', 'RayzeBio', 'AstraZeneca Fusion Pharma',
      '国家原子能机构', 'CAEA', 'NMPA', 'FDA',
    ],
    core_technologies: [
      '核药', '放射性药物', 'radiopharmaceutical', '靶向放射性核素治疗', 'trt', 'targeted radionuclide therapy',
      '诊疗一体化', 'theranostics', '同位素配对', '医用同位素', 'medical isotopes',
      '镥-177', '177lu', '锕-225', '225ac', '镓-68', '68ga', '氟-18', '18f', '钇-90', '90y', '铅-212', '212pb',
      'psma靶向', 'sstr靶向', 'fap靶向', '螯合剂', 'chelator', 'dota', '放射化学纯度', '前列腺癌核药', '神经内分泌瘤核药',
    ],
    action_milestones: [
      '医用回旋加速器投产', '医用反应堆提取堆照靶件', 'fda快速通道认定', 'fast track designation', '放射性药品生产许可证颁发', '临床3期数据达标',
    ],
    negative_filters: ['工业探伤放射源废弃记录', '地质放射性矿产普查测绘'],
    branches: [
      {
        branch_id: 'radio_targeted_therapy',
        branch_name_zh: '靶向治疗性核药 (177Lu / 225Ac)',
        branch_name_en: 'Targeted Alpha/Beta Therapy',
        keywords: ['177lu', '225ac', 'psma', '神经内分泌瘤', 'prostate cancer', 'radiopharmaceutical', 'targeted therapy'],
      },
      {
        branch_id: 'radio_isotope_supply_chain',
        branch_name_zh: '医用同位素堆照提取与供应链',
        branch_name_en: 'Medical Isotope Production & Supply',
        keywords: ['医用同位素自主化', '商用堆生产同位素', '无载体镥-177提取', '回旋加速器制备', '同位素供应链保障', 'cyclotron'],
      },
    ],
  },

  // ==================== 11. 量子计算与量子科技 (Quantum Computing) ====================
  {
    topic_id: 'provisional_quantum_computing',
    display_name_zh: '量子计算与量子科技',
    display_name_en: 'Quantum Computing & Quantum Tech',
    domain: 'quantum',
    key_entities: [
      '国盾量子', '本源量子', '国仪量子', '问天量子', '玻色量子', '华翊量子', '启科量子',
      'IBM Quantum', 'Google Quantum AI', 'Quantinuum', 'IonQ', 'Rigetti', 'D-Wave', 'PsiQuantum', 'QuEra',
      '中科大潘建伟团队', '合肥国家实验室', '清华大学量子信息中心',
    ],
    core_technologies: [
      '量子计算', 'quantum computing', '量子处理器', 'qpu', '量子比特', 'qubit',
      '超导量子计算', 'superconducting qubit', 'superconducting physical qubits', '离子阱量子计算', 'trapped-ion', '光量子计算', 'photonic quantum', '中性原子量子计算', 'neutral atom',
      '量子优越性', 'quantum supremacy', 'quantum advantage', '量子纠错', 'quantum error correction', 'qec', '表面码', 'surface code', '逻辑量子比特', 'logical qubit',
      '量子密钥分发', 'qkd', '量子精密测量', 'quantum sensing', '金刚石nv色心', '量子重力仪', '稀释制冷机', 'dilution refrigerator', '毫开尔文温区',
    ],
    action_milestones: [
      '破千物理量子比特QPU发布', '逻辑量子比特容错纠错实验成功', '量子优越性新算法达成', '国产稀释制冷机商用交付',
    ],
    negative_filters: ['量子鞋垫', '量子防辐射贴纸', '量子力学哲学读物书评'],
    branches: [
      {
        branch_id: 'quantum_superconducting_hardware',
        branch_name_zh: '超导量子芯片与稀释制冷主机',
        branch_name_en: 'Superconducting QPU & Cryogenics',
        keywords: ['超导量子芯片', 'transmon', 'superconducting', '稀释制冷机', '微波测控系统', 'qubit'],
      },
      {
        branch_id: 'quantum_error_correction',
        branch_name_zh: '量子容错纠错与逻辑量子比特',
        branch_name_en: 'Quantum Error Correction & Logical Qubits',
        keywords: ['量子纠错', '表面码', 'surface code', 'quantum error correction', 'logical qubit', '保真度'],
      },
      {
        branch_id: 'quantum_sensing_metrology',
        branch_name_zh: '量子精密测量与量子传感器',
        branch_name_en: 'Quantum Sensing & Metrology',
        keywords: ['金刚石nv色心', '量子重力仪', '量子磁力计', '原子钟', '超高灵敏度量子传感', 'quantum sensing'],
      },
    ],
  },

  // ==================== 12. 先进半导体封装与 Chiplet (Advanced Packaging) ====================
  {
    topic_id: 'provisional_advanced_packaging',
    display_name_zh: '半导体先进封装与 Chiplet',
    display_name_en: 'Advanced Packaging & Chiplet',
    domain: 'semiconductor',
    key_entities: [
      '长电科技', 'JCET', '通富微电', 'TFME', '华天科技', '长川科技', '盛美上海', '拓荆科技', '兴森科技',
      'TSMC', '台积电CoWoS', 'ASE Group', '日月光', 'Amkor', 'Intel Foveros', 'Samsung I-Cube',
    ],
    core_technologies: [
      '先进封装', 'advanced packaging', 'chiplet', '芯粒', '2.5d封装', '3d封装', 'cowos', 'cowos-s', 'cowos-l', 'info封装', 'foveros',
      '硅中介层', 'silicon interposer', '硅通孔', 'tsv', '混合键合', 'hybrid bonding', '微凸点', 'micro-bump', '无凸点键合',
      '重布线层', 'rdl', '扇出型封装', 'fan-out', 'fcbga大型封装基板', 'abf载板', '玻璃基板', 'glass substrate',
    ],
    action_milestones: [
      'cowos产能扩产竣工', '晶圆级混合键合良率达标', '大型高层数玻璃基板打样', '高性能chiplet互联协议落地',
    ],
    negative_filters: ['快递纸箱打包胶带', '普通食品真空包装机'],
    branches: [
      {
        branch_id: 'packaging_25d_cowos',
        branch_name_zh: '2.5D/3D晶圆级封装与硅中介层',
        branch_name_en: '2.5D/3D Wafer-Level Packaging & Interposer',
        keywords: ['cowos', 'cowos-l', 'cowos-s', '硅中介层', 'silicon interposer', 'tsv', '3d堆叠', 'wafer-level advanced packaging'],
      },
      {
        branch_id: 'packaging_hybrid_bonding',
        branch_name_zh: '超高密度混合键合与玻璃基板',
        branch_name_en: 'Hybrid Bonding & Glass Substrates',
        keywords: ['直接键合', '混合键合', 'hybrid bonding', '玻璃基板', 'glass substrate', '超高密度互联间距'],
      },
    ],
  },
];

export interface IntelligentResolutionMatch {
  topic_id: string;
  branch_id: string | null;
  confidence: 'high' | 'medium' | 'low';
  score: number;
  matched_entities: string[];
  matched_technologies: string[];
  matched_milestones: string[];
  reason: string;
}

function escapeRegExp(str: string): string {
  return str.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

function matchesTerm(normalizedText: string, term: string): boolean {
  const cleanTerm = term.toLowerCase().trim();
  if (!cleanTerm) return false;
  // If short ASCII keyword (<= 4 chars like 'cpo', 'tc证', 'ase', 'fda'), enforce word boundary to avoid substring collisions
  if (/^[a-z0-9_-]+$/i.test(cleanTerm) && cleanTerm.length <= 4) {
    const regex = new RegExp(`\\b${escapeRegExp(cleanTerm)}\\b`, 'i');
    return regex.test(normalizedText);
  }
  return normalizedText.includes(cleanTerm);
}

/**
 * Universal multi-lingual & multi-source deep thematic matcher.
 * Matches entities, chemical formulas, technological bottleneck terms,
 * official regulatory milestone markers, and performs negative context disambiguation.
 */
export function matchFrontierEcosystem(text: string): IntelligentResolutionMatch | null {
  const normalizedText = text.toLowerCase();

  let bestMatch: IntelligentResolutionMatch | null = null;
  let highestScore = 0;

  for (const ecosystem of FRONTIER_ECOSYSTEM_REGISTRY) {
    // 1. Negative filtering check: if text clearly contains negative context, skip
    const negativeHit = ecosystem.negative_filters.some((neg) => matchesTerm(normalizedText, neg));
    if (negativeHit) continue;

    const matchedEntities = ecosystem.key_entities.filter((entity) => matchesTerm(normalizedText, entity));
    const matchedTechs = ecosystem.core_technologies.filter((tech) => matchesTerm(normalizedText, tech));
    const matchedMilestones = ecosystem.action_milestones.filter((milestone) => matchesTerm(normalizedText, milestone));

    // Scoring weights
    let score = 0;
    // Entity weight: 35 per entity (max 70)
    score += Math.min(70, matchedEntities.length * 35);
    // Core technology route & chemical formula: 25 per term (max 75)
    score += Math.min(75, matchedTechs.length * 25);
    // Milestone / official certification metric: 15 per term (max 30)
    score += Math.min(30, matchedMilestones.length * 15);

    // Minimum threshold for recognition
    if (score < 25) continue;

    // Sub-branch disambiguation
    let bestBranchId: string | null = null;
    let maxBranchHits = 0;
    for (const branch of ecosystem.branches) {
      const hits = branch.keywords.filter((kw) => matchesTerm(normalizedText, kw)).length;
      if (hits > maxBranchHits) {
        maxBranchHits = hits;
        bestBranchId = branch.branch_id;
      }
    }

    if (score > highestScore) {
      highestScore = score;
      const confidence: 'high' | 'medium' | 'low' = score >= 70 ? 'high' : score >= 40 ? 'medium' : 'low';
      const reasonDetails: string[] = [];
      if (matchedEntities.length) reasonDetails.push(`Entities: [${matchedEntities.join(', ')}]`);
      if (matchedTechs.length) reasonDetails.push(`Tech: [${matchedTechs.join(', ')}]`);
      if (matchedMilestones.length) reasonDetails.push(`Milestones: [${matchedMilestones.join(', ')}]`);

      bestMatch = {
        topic_id: ecosystem.topic_id,
        branch_id: bestBranchId,
        confidence,
        score,
        matched_entities: matchedEntities,
        matched_technologies: matchedTechs,
        matched_milestones: matchedMilestones,
        reason: `Intelligent ecosystem match on ${ecosystem.display_name_zh} (${ecosystem.topic_id}): ${reasonDetails.join('; ')}`,
      };
    }
  }

  return bestMatch;
}

/**
 * Enhances standard TopicResolution with universal multi-tier ontology graph resolution.
 */
export function resolveWithIntelligentEcosystem(
  candidate: EvidenceCandidate,
  registry: TopicRegistry,
): TopicResolution | null {
  const evidence = candidate.suggested_evidence;
  const fullText = `${candidate.original_quote} ${evidence.event_title} ${evidence.event_summary} ${candidate.suggested_reason ?? ''} ${evidence.interpretation ?? ''}`;

  const match = matchFrontierEcosystem(fullText);
  if (!match) return null;

  const targetTopicId = match.topic_id;
  const registeredCanonical = registry.canonical_topics.find(
    (t) => t.topic_id === targetTopicId || t.topic_id === `provisional_${targetTopicId}`,
  );

  const effectiveTopicId = registeredCanonical ? registeredCanonical.topic_id : targetTopicId;
  const effectiveBranchId = match.branch_id;

  const branchExists = effectiveBranchId && registry.branches.some(
    (b) => b.branch_id === effectiveBranchId && b.topic_id === effectiveTopicId,
  );

  return {
    candidate_id: candidate.candidate_id,
    status: registeredCanonical ? (effectiveBranchId && !branchExists ? 'new_branch' : 'existing_topic') : 'new_provisional_topic',
    resolved_topic_id: registeredCanonical ? effectiveTopicId : null,
    resolved_branch_id: effectiveBranchId,
    provisional_topic_id: registeredCanonical ? null : effectiveTopicId,
    reason: match.reason,
    confidence: match.confidence,
    audit_required: !registeredCanonical || (Boolean(effectiveBranchId) && !branchExists),
    alternatives: registeredCanonical
      ? [{ status: 'existing_topic', topic_id: effectiveTopicId, reason: 'Matched via intelligent ontology ecosystem graph.' }]
      : [{ status: 'unresolved', reason: 'Awaiting operator audit to register as new provisional topic.' }],
  };
}
