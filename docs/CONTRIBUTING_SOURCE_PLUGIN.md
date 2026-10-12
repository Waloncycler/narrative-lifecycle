# 🔌 数据源插件开发与贡献指南 (Source Plugin Contribution Guide)

欢迎为 **Narrative Lifecycle (市场叙事生命周期系统)** 贡献新的全球权威数据源插件！

本项目采用高度解耦的 **Pluggable Source Architecture (可插拔数据源架构)**。新增一个数据源（如美国 FDA 审批库、欧洲央行决议、GitHub 趋势库、或者特定垂直行业招投标网），**只需在 `src/features/worldmonitor/plugins/` 下编写 1 个自包含的 TypeScript 文件**即可完成接入。

---

## 一、插件核心契约 (The SourcePlugin Interface)

所有数据源插件都必须实现 [`SourcePlugin<TRawItem>`](file:///Users/walox/Documents/narrative-lifecycle/src/features/worldmonitor/plugins/source_plugin.interface.ts) 接口：

```typescript
import type { 
  SourcePlugin, 
  PluginExecutionContext, 
  PluginNormalizedFact 
} from './source_plugin.interface';

export interface MyRawDataStructure {
  // 定义上游返回的原始数据结构
  title: string;
  url: string;
  publish_time: string;
}

export class MyCustomSourcePlugin implements SourcePlugin<MyRawDataStructure> {
  // 1. 插件唯一标识符 (snake_case)
  readonly id = 'my_custom_source';
  
  // 2. 插件中文规范全称
  readonly name = '某某权威官方数据库';
  
  // 3. 分类目录: 'official' | 'financial' | 'technology' | 'research' | 'geopolitics'
  readonly category = 'official' as const;
  
  // 4. 领域归属
  readonly domain = 'official';
  
  // 5. 默认证据等级: 'E1' (观测) | 'E2' (研报/披露) | 'E3' (法定红头/批件) | 'E4' (国家级法规)
  readonly defaultEvidenceStrength = 'E3' as const;
  
  // 6. 默认影响层级: 'reality' | 'capital' | 'pricing' | 'friction' | 'name'
  readonly defaultTargetLayers = ['reality', 'capital'] as const;

  /**
   * 抓取阶段：负责网络 I/O，具备超时与错误隔离保护
   */
  async fetchRaw(ctx: PluginExecutionContext): Promise<MyRawDataStructure[]> {
    const timeoutMs = ctx.timeoutMs ?? 5000;
    // 执行 HTTP fetch 或 API 调用
    return [];
  }

  /**
   * 清洗阶段：将原始数据清洗并映射为系统通用的统一事实候选 (PluginNormalizedFact)
   */
  normalize(item: MyRawDataStructure, ctx: PluginExecutionContext): PluginNormalizedFact | null {
    if (!item.title) return null;
    return {
      source_id: this.id,
      source_name: this.name,
      source_url: item.url,
      source_kind: 'MINISTRY_POLICY',
      title: item.title,
      summary: '事实摘要...',
      event_date: item.publish_time,
      evidence_strength: this.defaultEvidenceStrength,
      event_type: 'OFFICIAL_POLICY',
      affected_layers: [...this.defaultTargetLayers],
      remote_pdf_url: item.url.endsWith('.pdf') ? item.url : null, // 若包含PDF附件，系统会自动反编译解析
    };
  }
}
```

---

## 二、开发一个新插件的 3 个步骤

### 步骤 1：在 `plugins/` 目录下创建插件文件
在 `src/features/worldmonitor/plugins/` 目录下新建 `[source_name]_plugin.ts`，实现 `SourcePlugin` 接口。

### 步骤 2：在 `PluginRegistry` 中注册插件
打开 [`src/features/worldmonitor/plugins/plugin_registry.ts`](file:///Users/walox/Documents/narrative-lifecycle/src/features/worldmonitor/plugins/plugin_registry.ts)，在 `registerDefaultPlugins()` 方法中添加一行注册代码：

```typescript
import { MyCustomSourcePlugin } from './my_custom_source_plugin';

private registerDefaultPlugins(): void {
  // ... 其他插件
  this.registerPlugin(new MyCustomSourcePlugin());
}
```

### 步骤 3：编写单元测试并运行验证
在 `tests/test_source_plugin_registry.ts` 中添加该插件的输出格式与断言测试：

```bash
# 运行单元测试
npm run test tests/test_source_plugin_registry.ts

# 运行全链路闭环流水线测试
npm run narrative run
```

---

## 三、插件开发最佳实践与质量红线

1. **零崩溃保证 (Graceful Degradation)**：
   * `fetchRaw` 中必须包裹 `try...catch`，遇到网络超时或目标站点 5xx 错误时返回 `[]`，严禁抛出未捕获异常阻塞整条流水线；
2. **遵守人类可读链接原则 (User-Friendly URLs)**：
   * `source_url` 应尽可能提供人类浏览器可直接点击阅读的官方网页地址；
3. **支持远端 PDF 自动提纯 (Remote PDF Extraction)**：
   * 如果上游返回的数据携带官方 PDF 报告/公告附件（如 `.pdf` 结尾），请务必将其赋值给 `remote_pdf_url`。系统底层会自动调用多引擎解析器提取深层原文底表！
4. **恪守事实客观性 (No Trading Advice)**：
   * 插件抓取的标题与摘要必须保持客观中立，严禁引入任何第三方荐股或主观投资建议。

---

## 四、提交 Pull Request 检查清单

在向官方仓库提交 PR 前，请确保完成以下自检：
- [ ] 插件已实现 `SourcePlugin` 接口并通过 TypeScript 类型检查（`npm run typecheck`）；
- [ ] 单元测试与现有测试套件全部通过（`npm run test`）；
- [ ] 插件在 `npm run narrative run` 中能够正常拉取并入库规范证据；
- [ ] 未向代码库提交任何敏感凭证（如私人 API Keys）。
