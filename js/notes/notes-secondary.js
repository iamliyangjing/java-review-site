// Review notes for all non-core (secondary) nodes. Concise points for each topic.
window.NOTES = Object.assign({}, window.NOTES, {
  "basic": {
    "core": false,
    "summary": "Java 基础是后端复习的起点，重点建立语言语义、集合和 IO 的使用边界。版本特性应结合项目实际复习。",
    "points": [
      "知识地图：语言与异常 → 面向对象 → 集合/字符串 → 泛型/SPI → IO → Java 8/17/21/25。",
      "复习优先级：先讲清 equals/hashCode、HashMap、ConcurrentHashMap 和异常关闭，再复习泛型和版本迁移。",
      "实战避坑：区分 API 契约、OpenJDK 实现细节与目标版本，不把实现参数当成语言保证。",
      "模拟题：为什么可变 key 会破坏 HashMap 查询？从 Java 8 升级时先检查哪些依赖？"
    ],
    "status": "ready"
  },
  "basic-syntax": {
    core: false,
    summary: "基础语法覆盖数据类型、运算符、流程控制与异常处理。",
    points: [
      "8 种基本类型：byte/short/int/long/float/double/char/boolean，包装类型缓存（Integer -128~127）",
      "== vs equals：基本类型比值，引用类型比地址；equals 需重写 hashCode",
      "异常体系：Throwable → Error（不处理）与 Exception（受检/非受检）"
    ],
    status: "ready"
  },
  "design-patterns": {
    core: false,
    summary: "设计模式是面向对象设计的经典方案，单例、工厂、代理、模板方法是高频考察点。",
    points: [
      "创建型：单例（DCL 双重检查）、工厂（简单/工厂方法/抽象工厂）、建造者（Builder）",
      "结构型：代理（JDK/CGLIB 动态代理）、装饰器、适配器",
      "行为型：策略、模板方法、观察者、责任链",
      "Spring 中的应用：单例 Bean、动态代理 AOP、模板方法 JdbcTemplate"
    ],
    status: "ready"
  },
  "design-principles": {
    core: false,
    summary: "SOLID 五大设计原则是代码设计的指导思想。",
    points: [
      "单一职责、开闭原则、里氏替换、接口隔离、依赖倒置",
      "举例：策略模式体现开闭原则，Spring IoC 体现依赖倒置"
    ],
    status: "ready"
  },
  "core-lib": {
    "core": false,
    "summary": "核心类库复习应将集合、字符串与数值类型分别展开，建立选型与正确性意识。实现细节需要注明 JDK 版本。",
    "points": [
      "知识地图：ArrayList/LinkedList → HashMap → ConcurrentHashMap → equals/hashCode → String/BigDecimal → Stream。",
      "面试重点：操作复杂度、扩容、碰撞、并发复合操作、相等契约与精度，不只背类名。",
      "实战避坑：线程安全容器不保证一组操作整体原子；集合性能要结合数据量和真实访问模式。",
      "模拟题：如何选择列表和映射容器？为什么不同集合对同一组 BigDecimal 的去重结果可能不同？"
    ],
    "status": "ready"
  },
  "advanced-features": {
    "core": false,
    "summary": "泛型、反射、注解与 SPI 支撑类型约束和框架扩展。复习时区分编译期信息、运行时元数据和类加载边界。",
    "points": [
      "知识地图：类型擦除/PECS → 反射/注解 → ServiceLoader → 模块开放。",
      "面试重点：泛型擦除与桥方法、运行时注解、插件发现、类加载器对类型身份的影响。",
      "实战避坑：泛型签名可以保留在类文件中；现代 JDK 的模块约束可能限制反射访问。",
      "模拟题：List<Integer> 为什么不能赋给 List<Number>？SPI 如何找到应用层实现？"
    ],
    "status": "ready"
  },
  "new-features": {
    "core": false,
    "summary": "版本复习以正式交付的特性和项目迁移为主。长期支持、预览状态和发行商支持策略需要分别确认。",
    "points": [
      "知识地图：Java 8 函数式 API → Java 17 语言增强 → Java 21 虚拟线程 → Java 25 升级评估。",
      "版本边界：records 在 Java 16 正式交付，sealed classes 在 Java 17 正式交付；Java 17 的 switch 模式匹配仍是预览。",
      "版本边界：SecurityManager 在 Java 17 被标记弃用待移除，Java 24 永久禁用，不是 Java 17 已移除。",
      "实战避坑：正式特性与预览特性分开使用；升级同时验证框架、驱动、Agent、GC 参数和回滚能力。",
      "模拟题：如何解释团队使用 Java 17 而未立即升级？怎样判断一个新特性可以用于生产？"
    ],
    "status": "ready"
  },
  "java8-datetime": {
    core: false,
    summary: "新日期时间 API 解决旧 Date/SimpleDateFormat 的线程安全问题。",
    points: [
      "LocalDate/LocalDateTime/LocalTime 不可变线程安全",
      "DateTimeFormatter 替代 SimpleDateFormat（后者线程不安全），Instant 表示时间戳",
      "Duration/Period 计算时间差，时间调整 TemporalAdjusters"
    ],
    status: "ready"
  },
  "java8-optional": {
    core: false,
    summary: "Optional 容器类用于优雅处理空值，减少 NPE。",
    points: [
      "ofNullable 包装可能为 null 的值，orElse/orElseGet 提供兜底",
      "map/flatMap 链式取值，isPresent/ifPresent 条件消费",
      "注意：Optional 不建议作为方法参数或类字段，序列化不友好"
    ],
    status: "ready"
  },
  "java17": {
    "core": false,
    "summary": "Java 17 的复习重点是密封类与升级后的强封装边界。它同时包含此前已交付的 records 和文本块等能力。",
    "points": [
      "知识地图：sealed → records/文本块 → 模块封装 → 升级兼容。",
      "核心原理：sealed 限制允许的子类集合；records 表达数据载体，但成员引用的对象不因此自动深度不可变。",
      "面试重点：文本块在 Java 15、records 在 Java 16 正式交付；switch 模式匹配在 Java 17 是预览，Java 21 才正式交付。",
      "版本边界：SecurityManager 在 Java 17 弃用待移除；不能在面试中说它已经在 Java 17 移除。",
      "实战避坑：强封装可能影响依赖内部 API 的代码，先检查依赖版本与模块开放要求。",
      "模拟题：record 为什么不等于深度不可变对象？旧项目升级后反射访问失败如何排查？"
    ],
    "status": "ready"
  },
  "jvm-types": {
    core: false,
    summary: "主流 JVM 实现与 HotSpot 的统治地位。",
    points: [
      "HotSpot：Oracle JDK 默认，JIT 分层编译 + 分代 GC",
      "OpenJ9：IBM 贡献，低内存占用；GraalVM：支持 AOT 提前编译与多语言"
    ],
    status: "ready"
  },
  "classloader-context": {
    core: false,
    summary: "线程上下文类加载器（TCCL）用于打破双亲委派，服务 SPI 场景。",
    points: [
      "场景：JDBC 驱动、JNDI 等 SPI 由启动类加载器加载接口但实现类在 classpath",
      "Thread.currentThread().getContextClassLoader() 获取，JDK 默认是 AppClassLoader"
    ],
    status: "ready"
  },
  "execution-engine": {
    core: false,
    summary: "执行引擎负责解释执行字节码，含解释器与 JIT 编译器。",
    points: [
      "解释器逐行翻译字节码，JIT 编译热点方法为机器码",
      "字节码指令：iconst/iload/invokevirtual 等，操作数栈与局部变量表协作"
    ],
    status: "ready"
  },
  "dispatch": {
    core: false,
    summary: "方法分派分为静态分派（重载）与动态分派（重写）。",
    points: [
      "静态分派：编译期按参数静态类型决定，即重载",
      "动态分派：运行期按实际类型决定，即重写，通过虚方法表（vtable）实现"
    ],
    status: "ready"
  },
  "gc-tuning": {
    core: false,
    summary: "GC 调优目标是降低停顿与提升吞吐，核心是合理设置堆参数。",
    points: [
      "常用参数：-Xms/-Xmx 等值、-XX:NewRatio（默认 2）、-XX:SurvivorRatio=8、-XX:MaxGCPauseMillis",
      "调优步骤：观察 GC 日志（-Xlog:gc*）→ 定位 Full GC 频率 → 调整堆与收集器",
      "G1 调优关注 Region 大小、IHOP（混合回收阈值）"
    ],
    status: "ready"
  },
  "memory-leak": {
    core: false,
    summary: "内存泄漏是对象无法被 GC 但仍被引用，常见于静态集合、监听器、ThreadLocal。",
    points: [
      "常见场景：静态 Map 缓存无限增长、未注销监听器、ThreadLocal 未 remove、连接未关闭",
      "排查：jmap -histo 看对象数，MAT 查 GC Roots 引用链"
    ],
    status: "ready"
  },
  "object-layout": {
    core: false,
    summary: "对象在内存中由对象头、实例数据、对齐填充组成。",
    points: [
      "对象头：Mark Word（锁状态/GC 年龄/hashCode）+ 类型指针（Klass Pointer，压缩后 4 字节）",
      "数组对象额外 4 字节长度字段；64 位 JVM 默认开启压缩指针（-XX:+UseCompressedOops）"
    ],
    status: "ready"
  },
  "object-allocation": {
    core: false,
    summary: "对象分配优先在 Eden 区，大对象直接进老年代，TLAB 加速分配。",
    points: [
      "分配路径：TLAB（线程本地分配缓冲）→ Eden → 大对象（-XX:PretenureSizeThreshold）直接老年代",
      "Minor GC 后存活对象进 Survivor，年龄到 15（-XX:MaxTenuringThreshold）晋升老年代"
    ],
    status: "ready"
  },
  "mysql-basic": {
    core: false,
    summary: "MySQL 基础包含存储引擎与架构分层。",
    points: [
      "分层：连接层（连接管理）→ Server 层（解析/优化/执行）→ 存储引擎层（InnoDB）",
      "InnoDB 默认引擎：支持事务、行锁、外键；MyISAM 表锁不支持事务"
    ],
    status: "ready"
  },
  "mysql-row-storage": {
    core: false,
    summary: "InnoDB 行记录在磁盘上的存储格式（COMPACT 行格式）。",
    points: [
      "COMPACT 结构：变长字段长度列表 + NULL 值列表 + 记录头信息 + 真实数据",
      "隐藏列：row_id、trx_id（事务 ID）、roll_pointer（回滚指针指向 undo log）",
      "页 16KB，行溢出时大字段存溢出页"
    ],
    status: "ready"
  },
  "mysql-bufferpool": {
    core: false,
    summary: "Buffer Pool 是 InnoDB 的内存缓存层，缓存数据页与索引页。",
    points: [
      "缓存页 + 控制块，通过 LRU 链表淘汰（改进版 LRU 分热/冷区防全表扫描污染）",
      "change buffer 缓存二级索引写操作减少随机 IO",
      "参数：innodb_buffer_pool_size 建议物理内存 50-70%"
    ],
    status: "ready"
  },
  "pg": {
    core: false,
    summary: "PostgreSQL 是功能强大的开源关系型数据库，与 MySQL 风格不同。",
    points: [
      "支持更丰富的数据类型（JSONB/数组/几何）与窗口函数、物化视图",
      "MVCC 实现基于行版本（不产生 undo log），适合复杂查询与数据仓库场景",
      "扩展能力：PostGIS（地理）、pgvector（向量检索，AI 场景常用）"
    ],
    status: "ready"
  },
  "redis-bigkey": {
    core: false,
    summary: "大 Key 指单个 key 的 value 过大（如大 String 或超大集合），是 Redis 运维常见问题。",
    points: [
      "危害：阻塞命令执行、网络传输慢、删除阻塞（需异步删除）、内存不均（集群）",
      "识别：redis-cli --bigkeys 扫描，或 debug object 查看",
      "处理：拆分大 key、压缩、渐进式删除（scan 分批）或 UNLINK 异步删除"
    ],
    status: "ready"
  },
  "middleware": {
    "core": false,
    "summary": "消息系统选型应根据吞吐、延迟、顺序、路由和可靠性需求判断。产品能力还需要注明版本及配置。",
    "points": [
      "知识地图：Kafka 日志流 → RabbitMQ 路由 → RocketMQ 业务消息 → 投递语义。",
      "面试重点：先比较分区/队列模型、消费模式与故障恢复，再结合真实工作负载验证吞吐。",
      "实战避坑：不以万亿级等口号代替容量指标；可靠性来自确认、持久化、复制及消费幂等的整体设计。",
      "模拟题：订单事件要求按订单有序和可重试处理，你会比较哪些能力与故障窗口？"
    ],
    "status": "ready"
  },
  "rabbitmq": {
    core: false,
    summary: "RabbitMQ 基于 AMQP 协议，Exchange 路由模型灵活。",
    points: [
      "核心概念：Exchange（direct/topic/fanout/headers）+ Queue + Binding",
      "消息可靠性：生产者 confirm 机制 + 消费者手动 ack + 死信队列（DLX）",
      "场景：延迟队列（TTL+DLX）、限流（prefetch）、优先级队列"
    ],
    status: "ready"
  },
  "rocketmq": {
    "core": false,
    "summary": "RocketMQ 的业务消息能力包括顺序、事务和延迟投递。架构和延迟机制要结合 4.x/5.x 等具体版本。",
    "points": [
      "知识地图：生产/消费 → 顺序 → 半消息/回查 → 延迟。",
      "核心原理：事务消息通过半消息与事务状态检查衔接本地事务结果，不会自动让消费者业务获得强一致事务。",
      "版本边界：旧版常见固定延迟级别；5.x 的定时/延迟消息采用新的投递时间机制，不能一概说只有 18 个级别。",
      "实战避坑：顺序保证需明确队列/消息组范围；仍需消费幂等、失败重试和积压治理。",
      "模拟题：事务回查重复发生时，如何稳定判断本地事务结果？"
    ],
    "status": "ready"
  },
  "config-center": {
    core: false,
    summary: "配置中心统一管理多环境配置并支持动态刷新，主流是 Nacos 与 Apollo。",
    points: [
      "Nacos Config：dataId + group + 命名空间隔离环境，@RefreshScope + Nacos 监听自动刷新",
      "Apollo：携程开源，四层命名空间、灰度发布、权限管理完善",
      "对比：Nacos 集成度高（注册+配置一体），Apollo 功能更细（多环境/回滚/审计）"
    ],
    status: "ready"
  },
  "load-balance": {
    "core": false,
    "summary": "负载均衡分为网关层（Nginx）与服务调用层（Ribbon/LoadBalancer）。",
    "points": [
      "Nginx：7 层反向代理，策略（轮询/权重/ip_hash/least_conn），LVS 是 4 层",
      "版本边界：Ribbon 是旧技术栈中的客户端负载均衡方案；现代 Spring Cloud 项目通常评估 Spring Cloud LoadBalancer，并核对实际兼容版本。",
      "Spring Cloud LoadBalancer：官方替代 Ribbon，支持自定义负载均衡策略",
      "实战避坑：结合健康检查、缓存更新、连接复用与重试策略分析，避免把重试当作所有请求都安全的补救。",
      "模拟题：有负载均衡为什么仍可能把故障请求重复打到不可用实例？"
    ],
    "status": "ready"
  },
  "tracing": {
    core: false,
    summary: "链路追踪通过 traceId 串联一次请求的全链路调用，主流 SkyWalking 与 Zipkin。",
    points: [
      "核心概念：traceId（一次请求全链路 ID）+ spanId（每个调用节点）+ parentId",
      "实现：字节码增强埋点（SkyWalking agent），数据上报（gRPC/HTTP）",
      "用途：故障定位、慢调用分析、调用拓扑可视化"
    ],
    status: "ready"
  },
  "logging": {
    core: false,
    summary: "日志管理统一收集、检索与分析，主流 ELK 与 Loki 栈。",
    points: [
      "ELK：Filebeat（采集）→ Logstash（过滤）→ Elasticsearch（存储）→ Kibana（可视化）",
      "Loki：轻量级，只索引标签不索引内容，配合 Grafana，适合 K8s 环境",
      "生产实践：日志格式统一（traceId 关联链路）、分级、按天/按大小滚动"
    ],
    status: "ready"
  },
  "algorithm": {
    core: false,
    summary: "算法板块核心是 LeetCode 高频题与排序算法，考察数据结构与思维。",
    points: [
      "高频题型：数组双指针、链表、二叉树（遍历/递归）、动态规划、滑动窗口、回溯",
      "数据结构掌握：数组/链表/栈/队列/哈希/树/图",
      "建议：按题型分类刷题，总结模板（如二分查找、BFS/DFS 模板）"
    ],
    status: "ready"
  },
  "leetcode": {
    core: false,
    summary: "LeetCode 一百题计划，覆盖面试最高频的 100 道题。",
    points: [
      "必刷类别：Hot 100（热度榜）、剑指 Offer、Top 面试题",
      "策略：每天 2-3 题，先掌握模板再刷变体，错题反复复习",
      "重点题型：两数之和、LRU、反转链表、二叉树层序遍历、最长子串等"
    ],
    status: "ready"
  },
  "os": {
    "core": false,
    "summary": "操作系统考察进程线程、内存管理、文件系统与 IO 模型。",
    "points": [
      "进程 vs 线程：资源分配与调度单位，PCB；线程共享进程地址空间",
      "内存管理：虚拟内存、分页（页表/缺页中断）、LRU 页面置换",
      "IO 模型：阻塞/非阻塞、就绪通知与异步完成；Java Selector 的底层机制随平台和 JDK 变化，Linux 中常见 epoll，不能推广到所有系统。",
      "进程通信：管道、消息队列、共享内存、信号量、Socket",
      "模拟题：进程内存占用和 Java 堆占用不同，排查时各看哪些指标？"
    ],
    "status": "ready"
  },
  "ai": {
    core: false,
    summary: "AI 板块覆盖 LLM 认知、模型 API、RAG、微调与 Agent，是加分项。",
    points: [
      "知识地图：LLM 原理 → 模型 API 使用 → RAG/微调 → Agent/MCP",
      "加分点：用过 Claude Code/Cursor 等 AI 编程工具，做过 RAG 知识库项目"
    ],
    status: "ready"
  },
  "ai-models": {
    "core": false,
    "summary": "模型 API 选型要围绕任务质量、延迟、成本与数据边界验证。具体型号和配额变化较快，应查各服务的当前文档。",
    "points": [
      "知识地图：任务数据集 → 文本/多模态 → 上下文 → 调用协议 → 评测。",
      "面试重点：输出格式、流式响应、超时、限额与工具调用；用代表性样本比较质量和尾延迟。",
      "实战避坑：一个统一网关不能消除厂商 API 语义差异；处理重试、限流、响应校验和敏感数据最小化。",
      "模拟题：同一业务更换模型供应方，你会验证哪些行为兼容性和回归指标？"
    ],
    "status": "ready"
  },
  "ai-finetune": {
    core: false,
    summary: "微调让模型适配特定领域，LoRA/QLoRA 是低成本主流方案。",
    points: [
      "微调场景：行业术语（保险/法律）、特定风格、指令遵循",
      "LoRA：只训练低秩适配矩阵，参数量 1% 以内，成本低效果好",
      "QLoRA：4bit 量化 + LoRA，单卡即可微调 70B 级模型",
      "微调 vs RAG：微调改变能力，RAG 注入知识，常结合使用"
    ],
    status: "ready"
  },
  "ai-frameworks": {
    core: false,
    summary: "AI 应用开发框架，LangChain/LlamaIndex 是主流。",
    points: [
      "LangChain：链式编排 LLM 调用（Chain、Agent、Memory、Retrieval），Python/JS",
      "LlamaIndex：专注信息检索与知识库（索引/检索/问答）",
      "后端集成：FastAPI（Python）或 Spring Boot 直接调模型 API，Java 侧可用 LangChain4j"
    ],
    status: "ready"
  },
  "ai-tools": {
    "core": false,
    "summary": "AI 编程工具的复习重点是工程流程和验证能力，实际完成的任务比工具名称列表更有说服力。",
    "points": [
      "知识地图：需求上下文 → 修改范围 → 评审 → 测试 → 交付。",
      "面试重点：描述如何复现问题、提供约束、审查差异并验证结果；评估效率时也计入返工和审查成本。",
      "实战避坑：代码、日志或网页中的指令可能是不可信输入；限制权限，不把未验证输出直接作为发布依据。",
      "模拟题：AI 生成了看似能运行的修复，你会用什么证据判断是否可以合入？"
    ],
    "status": "ready"
  }
});