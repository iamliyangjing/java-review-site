// Review notes for framework/middleware/microservice/algorithm/network/os/ai + basic modules.
// Detailed notes for core nodes, placeholders for secondary nodes.
window.NOTES = Object.assign({}, window.NOTES, {
  // ---- 基础 ----
  "basic": { core: false, summary: "", points: [], status: "pending" },
  "basic-syntax": { core: false, summary: "", points: [], status: "pending" },
  "oop": {
    core: true,
    summary: "面向对象三大特性（封装、继承、多态）是 Java 语言基础面试题，多态的实现依赖继承与方法重写。",
    points: [
      "封装：属性私有 + 方法公开，隐藏实现细节，通过访问控制符（private/default/protected/public）实现",
      "继承：子类复用父类成员，单继承（类）+ 多实现（接口）；is-a 关系",
      "多态：同一方法调用在不同对象上有不同表现；实现三条件：继承、方法重写、父类引用指向子类对象",
      "多态底层：方法重写由运行时动态分派（虚方法表 vtable）实现，重载是编译期静态分派",
      "重写 vs 重载：重写是父子类间运行时多态（同签名），重载是同类内编译期（不同参数列表）",
      "组合 vs 继承：组合优先于继承（复用灵活，避免破坏封装与脆弱的基类问题）",
      "面试话术：先答三大特性定义，重点讲多态的 3 个条件和虚方法表，最后提组合优于继承"
    ],
    status: "ready"
  },
  "oop-principles": {
    "core": true,
    "summary": "封装、继承与多态是面向对象的三大特性。多态的关键是运行时根据对象类型选择重写方法。",
    "points": [
      "知识地图：访问控制 → is-a 关系 → 重写/重载 → 组合设计。",
      "核心原理：父类型引用可指向子类对象，重写的实例方法按运行时类型分派；字段访问和静态方法不采用相同的动态分派语义。",
      "面试重点：重载在编译期根据参数等信息选择签名；重写要满足返回类型、访问范围及异常约束。",
      "实战避坑：不是所有复用关系都适合继承；当子类破坏父类语义时优先考虑组合与接口。",
      "模拟题：父类引用指向子类时，实例方法、静态方法和同名字段各使用哪一方？",
      "面试话术：我先解释三大特性，再用一段父子类调用说明动态分派，最后讨论组合与继承的边界。"
    ],
    "status": "ready"
  },
  "design-patterns": { core: false, summary: "", points: [], status: "pending" },
  "design-principles": { core: false, summary: "", points: [], status: "pending" },
  "core-lib": { core: false, summary: "", points: [], status: "pending" },
  "stream": {
    core: true,
    summary: "Stream API 是 Java8 处理集合的函数式编程方式，惰性求值 + 流水线操作 + 并行流是核心特性。",
    points: [
      "创建：集合.stream()/parallelStream()、Stream.of、Arrays.stream、Stream.iterate/generate",
      "中间操作（惰性）：filter/map/flatMap/distinct/sorted/limit/skip/peek，不触发执行",
      "终止操作（触发）：forEach/collect/count/reduce/match/findFirst，执行完整流水线",
      "惰性求值：中间操作延迟，只有终止操作才真正遍历，支持短路（limit/findFirst）",
      "collect 收集器：toList/toMap/groupingBy/partitioningBy/joining 等 Collectors 工具",
      "并行流：parallelStream 基于 ForkJoinPool（默认 commonPool），数据量大且有耗时操作才用",
      "与 for 循环对比：声明式、链式、易并行；注意装箱开销与可读性权衡",
      "面试话术：讲\"创建→中间→终止\"三阶段 + 惰性求值，举 groupingBy 分组统计例子，提并行流注意事项"
    ],
    status: "ready"
  },
  "advanced-features": { core: false, summary: "", points: [], status: "pending" },
  "new-features": { core: false, summary: "", points: [], status: "pending" },
  "java8": {
    core: true,
    summary: "Java 8 是版本分水岭，Lambda、Stream、Optional、新日期 API 与接口默认方法改变 Java 编程范式。",
    points: [
      "Lambda 表达式：函数式接口的实例，语法 (参数) -> 表达式/代码块，编译为 invokedynamic",
      "函数式接口：@FunctionalInterface 标注，只有一个抽象方法（Runnable、Consumer、Function、Predicate、Supplier）",
      "Stream API：集合处理流水线，声明式编程（见 stream 节点）",
      "Optional：显式处理空值，避免 NPE，orElse/orElseGet/map/flatMap 链式",
      "新日期时间 API：LocalDate/LocalDateTime（不可变线程安全）替代 Date/Calendar，DateTimeFormatter 替代 SimpleDateFormat",
      "接口默认方法/静态方法：default 方法解决接口演进兼容问题",
      "方法引用：类::方法 简化 Lambda（构造器引用、静态方法引用、实例方法引用）",
      "面试话术：答 Lambda + 函数式接口原理（invokedynamic），对比新旧日期 API 的线程安全性"
    ],
    status: "ready"
  },
  "java8-lambda": {
    core: true,
    summary: "Lambda 表达式让 Java 支持函数式编程，底层通过 invokedynamic 与函数式接口实现。",
    points: [
      "语法糖：参数类型可省略（类型推断）、单表达式可省略 return 与大括号",
      "函数式接口：Runnable/Callable/Comparator/Consumer/Function/Predicate/Supplier 及自定义 @FunctionalInterface",
      "变量捕获：Lambda 捕获局部变量要求 effectively final（不能修改）",
      "底层实现：invokedynamic 动态生成实现类，比匿名内部类减少类加载开销",
      "与匿名内部类区别：this 指向不同（Lambda 的 this 是外部类）、无独立作用域、无额外 class 文件",
      "常见坑：在循环中捕获循环变量需 effectively final，用临时变量包装",
      "面试话术：讲语法、捕获变量规则、invokedynamic 实现，对比匿名内部类差异"
    ],
    status: "ready"
  },
  "java8-stream": {
    "core": true,
    "summary": "这个节点关注 Stream 在业务中的分组与聚合应用；流水线原理与并行边界见核心类库中的 Stream 节点。",
    "points": [
      "知识地图：filter/map → groupingBy → reducing → toMap 冲突处理。",
      "核心原理：先把业务数据转换成需要的表示，再选择收集器，避免在中间操作里修改共享状态。",
      "面试重点：toMap 遇到重复键时应定义合并规则；groupingBy 可组合 downstream collector 进行分类统计。",
      "实战避坑：parallel 不保证更快；注意空值、装箱、排序成本和结果集合的可变性，不依赖不同收集方法具有相同契约。",
      "模拟题：按部门统计员工数量和薪资总和；相同订单号出现多条记录时怎样定义 toMap 的合并规则？",
      "面试话术：我从业务分组和聚合需求选择收集器，明确冲突与空值策略，再验证顺序和性能。"
    ],
    "status": "ready"
  },
  "java8-datetime": { core: false, summary: "", points: [], status: "pending" },
  "java8-optional": { core: false, summary: "", points: [], status: "pending" },
  "java17": { core: false, summary: "", points: [], status: "pending" },
  // ---- 框架 ----
  "framework": {
    core: true,
    summary: "框架板块核心是 SpringBoot 自动配置与启动原理、Mybatis 与 ORM 的映射机制、SpringCloud 微服务体系。",
    points: [
      "SpringBoot 核心：自动配置（@EnableAutoConfiguration + spring.factories）+ 起步依赖 + 内嵌容器",
      "Spring 核心：IoC（控制反转）与 AOP（面向切面），Bean 生命周期是高频考点",
      "Mybatis：动态 SQL、一级/二级缓存、Mapper 代理原理",
      "SpringCloud：注册发现（Nacos/Eureka）、配置中心、网关、熔断限流、分布式事务",
      "面试话术：按框架逐个建立\"核心机制 + 高频面试题\"两段式复习"
    ],
    status: "ready"
  },
  "springboot": {
    "core": true,
    "summary": "SpringBoot 通过自动配置、起步依赖与内嵌容器简化 Spring 开发，启动原理是核心面试题。",
    "points": [
      "自动配置原理：@SpringBootApplication（@SpringBootConfiguration + @EnableAutoConfiguration + @ComponentScan）",
      "版本边界：Boot 2.7 引入 AutoConfiguration.imports，Boot 3+ 自动配置类注册使用 META-INF/spring/org.springframework.boot.autoconfigure.AutoConfiguration.imports；spring.factories 仍可能用于其他扩展。",
      "条件注解：@ConditionalOnClass/@ConditionalOnMissingBean/@ConditionalOnProperty 等控制是否生效",
      "内嵌容器：默认 Tomcat，可切换 Jetty/Undertow；打成可执行 jar 内嵌容器启动",
      "起步依赖（Starter）：spring-boot-starter-web 等聚合依赖，约定优于配置",
      "配置文件：application.yml 优先级、@ConfigurationProperties 绑定、多环境 profile 切换",
      "SpringApplication.run 流程：环境准备 → 创建容器 → 刷新容器（Bean 创建/自动配置）→ 启动内嵌容器",
      "实战避坑：检查条件评估报告、依赖和已有 Bean，区分组件扫描、自动配置导入与配置绑定。",
      "模拟题：同一个自动配置为什么在两个项目中一个生效一个不生效？",
      "面试话术：讲启动流程六步 + 自动配置条件装配，举例说明如何自定义 starter 或覆盖自动配置"
    ],
    "status": "ready"
  },
  "mybatis": {
    core: true,
    summary: "Mybatis 是半自动 ORM 框架，Mapper 代理、动态 SQL 与一级/二级缓存是面试核心。",
    points: [
      "工作流程：加载配置 → SqlSessionFactory → SqlSession → Mapper 代理执行 SQL → 结果映射",
      "Mapper 代理原理：MapperProxy 通过 JDK 动态代理，解析 @Select 注解或 XML 中的 SQL",
      "#{} vs ${}：#{} 预编译占位符防 SQL 注入，${} 字符串拼接有注入风险（表名/排序字段场景谨慎用）",
      "动态 SQL：if/where/choose/foreach/set/trim 标签按条件拼接",
      "一级缓存：SqlSession 级别默认开启，同一会话内相同 SQL 命中缓存；二级缓存：namespace 级别需手动开启",
      "缓存问题：多表关联查询的缓存失效与脏读，业务上可关闭二级缓存",
      "与 JPA 对比：Mybatis SQL 灵活可控，JPA 面向对象自动映射，复杂查询 Mybatis 更合适",
      "面试话术：讲 Mapper 代理原理与 #{} 防注入，重点答一级/二级缓存机制与失效场景"
    ],
    status: "ready"
  },
  "springcloud": {
    "core": true,
    "summary": "SpringCloud 是微服务全家桶，注册发现、网关、熔断、配置、链路追踪组成完整微服务生态。",
    "points": [
      "核心组件演进：Netflix（Eureka/Ribbon/Hystrix）→ Spring Cloud Alibaba（Nacos/Sentinel）→ 原生（LoadBalancer/Resilience4j）",
      "注册发现：服务启动注册到注册中心，客户端拉取/订阅服务列表实现负载均衡调用",
      "Spring Cloud Gateway 有响应式 WebFlux 和 Server Web MVC 等分支，线程及阻塞边界要按具体模块判断。",
      "熔断限流：Sentinel 资源 + 规则（流控/熔断/系统保护），Hystrix 已停更",
      "配置中心：Nacos Config/Apollo 动态刷新配置，配置热更新",
      "版本边界：旧项目常见 Sleuth；现代 Boot 3+ 路径关注 Micrometer Observation/Tracing 及具体桥接实现，不机械照搬旧组件列表。",
      "分布式事务：Seata（AT/TCC/SAGA）解决跨服务数据一致性",
      "实战避坑：核对版本兼容矩阵，并按注册、调用、网关、容错和观测分别定位故障。",
      "模拟题：如何根据 Boot 版本选择匹配的 Cloud release train？",
      "面试话术：画微服务架构图（网关→服务→注册中心→配置中心→监控），讲透 1-2 个核心组件的原理"
    ],
    "status": "ready"
  },
  // ---- 中间件 ----
  "middleware": { core: false, summary: "", points: [], status: "pending" },
  "kafka": {
    "core": true,
    "summary": "Kafka 是分布式消息队列，基于分区 + 顺序写 + 页缓存实现高吞吐，消费组模型是核心设计。",
    "points": [
      "架构角色：Producer、Broker（多分区 Topic）、Consumer Group、ZooKeeper（元数据，新版用 KRaft）",
      "高吞吐原因：顺序写磁盘（append-only）+ Page Cache + 零拷贝（sendfile）+ 批量发送/压缩",
      "分区与副本：Topic 分区并行，分区内有序；副本 ISR 机制（同步副本集）保证高可用",
      "ISR/AR：AR 全副本，ISR 与 leader 保持同步的子集；HW/LEO 决定消息可见性",
      "消费模型：消费者组内分区分配（range/round-robin/sticky），组内竞争组间广播",
      "acks、重试、幂等生产者与事务分别改善不同环节；Kafka 的恰好一次语义有作用范围，外部数据库副作用仍需幂等或可靠协调。",
      "消息积压处理：扩容消费者 + 加大分区、临时转储、调整拉取参数",
      "实战避坑：按目标版本确认 KRaft 架构和消费协议；扩大分区或消费者要评估顺序、重平衡与下游容量。",
      "模拟题：消费写库成功、提交 offset 前崩溃，怎样避免重复业务副作用？",
      "面试话术：答高吞吐四原因 + 分区有序性 + ISR 机制，重点讲 acks 参数与消息不丢不重"
    ],
    "status": "ready"
  },
  "rabbitmq": { core: false, summary: "", points: [], status: "pending" },
  "rocketmq": { core: false, summary: "", points: [], status: "pending" },
  // ---- 微服务 ----
  "microservice": {
    core: true,
    summary: "微服务将单体拆分为独立部署的服务，核心挑战是服务治理：注册发现、配置、网关、熔断、分布式事务。",
    points: [
      "为什么微服务：独立部署、技术异构、团队自治、弹性伸缩；代价是分布式复杂度（网络、一致性、运维）",
      "服务注册发现：服务注册中心（Nacos/Eureka）+ 健康检查 + 负载均衡",
      "配置中心：统一管理各环境配置，动态刷新避免重启",
      "网关：统一入口做路由、鉴权、限流（Spring Cloud Gateway）",
      "熔断限流降级：Sentinel/Resilience4j 保护下游，避免雪崩",
      "分布式事务：Seata AT/TCC 等方案保证跨服务一致性",
      "可观测性：日志（ELK）、指标（Prometheus）、链路追踪（SkyWalking）",
      "面试话术：讲拆分原则 + 服务治理全景图，结合你项目里实际用到的注册中心/网关/链路追踪"
    ],
    status: "ready"
  },
  "service-discovery": {
    core: true,
    summary: "服务注册发现是微服务基础，Nacos 与 Eureka 的模型差异和自我保护机制是高频考点。",
    points: [
      "核心流程：服务启动注册（含 IP+端口+元数据）→ 定期心跳续约 → 消费者拉取/订阅服务列表 → 负载均衡调用",
      "Eureka：AP 模型（可用性优先），客户端缓存服务列表，无主节点对等复制；自我保护模式（85% 阈值）",
      "Nacos：支持 AP（临时实例，心跳）与 CP（持久实例，Raft 协议）两种模式",
      "健康检查：Eureka 靠客户端心跳（默认 30s），Nacos 支持心跳 + 主动探测（HTTP/TCP）",
      "服务下线与故障感知：心跳超时剔除 + 消费者本地缓存兜底",
      "负载均衡：Ribbon（已维护）→ Spring Cloud LoadBalancer；Nginx 是网关层负载均衡（7 层）",
      "面试话术：对比 Eureka（AP）与 Nacos（AP/CP 可选），讲清注册-心跳-摘除-发现全流程"
    ],
    status: "ready"
  },
  "config-center": { core: false, summary: "", points: [], status: "pending" },
  "load-balance": { core: false, summary: "", points: [], status: "pending" },
  "rate-limit": {
    core: true,
    summary: "限流熔断保护系统稳定性，Sentinel 提供流控、熔断降级与系统保护，核心算法有计数器、滑动窗口、令牌桶。",
    points: [
      "限流算法：固定窗口（临界突刺）、滑动窗口（改进）、漏桶（匀速）、令牌桶（允许突发，最常用）",
      "Sentinel 资源与规则：@SentinelResource 定义资源，FlowRule 流控（QPS/线程数）、DegradeRule 熔断",
      "熔断状态机：OPEN（熔断，直接失败）→ HALF_OPEN（半开探测）→ CLOSED（正常），失败比例/慢调用触发",
      "流控模式：直接、关联、链路；流控效果：快速失败、Warm Up（冷启动）、排队等待",
      "系统保护：自适应保护（Load/CPU/RT/线程数/入口 QPS）",
      "降级处理：@SentinelResource fallback/blockHandler 返回兜底结果，避免雪崩",
      "面试话术：对比四种限流算法（画时间轴），讲 Sentinel 熔断状态机三态转换，举业务降级例子"
    ],
    status: "ready"
  },
  "distributed-tx": {
    "core": true,
    "summary": "分布式事务解决跨库/跨服务一致性问题，Seata 的 AT/TCC/SAGA 模式与可靠消息是主流方案。",
    "points": [
      "为什么需要：本地事务只能保证单库，微服务跨库跨服务需要分布式事务",
      "2PC（两阶段提交）：准备阶段（各库锁定资源）+ 提交阶段；缺点：阻塞、协调者单点、数据不一致窗口",
      "3PC：引入超时机制解决协调者故障阻塞，但仍未完全解决一致性问题",
      "TCC：Try（预留资源）→ Confirm（确认）→ Cancel（回滚），业务侵入强但性能好",
      "SAGA：长事务拆多个本地事务 + 补偿，适合业务流程长、允许最终一致",
      "Seata AT 利用全局事务、分支事务、undo_log 与全局锁实现协调及补偿；需评估数据库、SQL 支持和隔离语义，不能不加前提地默认推荐。",
      "可靠消息最终一致：本地消息表 / RocketMQ 事务消息（半消息 + 回查）",
      "实战避坑：最终一致性方案必须有可重试、幂等、可观测的补偿流程，不把有补偿代码当作天然保证成功。",
      "模拟题：TCC 的空回滚、重复确认和悬挂如何通过状态设计处理？",
      "面试话术：按\"2PC/3PC → TCC/SAGA → Seata AT → 消息最终一致\"层级讲，说明各自适用场景"
    ],
    "status": "ready"
  },
  "distributed-lock": {
    "core": true,
    "summary": "分布式锁协调多个实例访问资源，可靠性取决于租约、故障模型和下游写入约束。任何方案都需要说明过期后的持有者行为。",
    "points": [
      "知识地图：互斥 → 租约 → 续期 → fencing 与故障模型。",
      "核心原理：Redis 可用 SET key uniqueToken NX PX 原子申请，释放时比较 token；唯一 token 用于避免误删他人的锁。",
      "面试重点：主从异步切换可能丢失锁；持有者长暂停超过租约后仍可能继续操作，续期不等于彻底消除此窗口。",
      "实战避坑：严格资源保护可评估单调 fencing token 并让下游拒绝旧 token；随机持有者标识不等同于 fencing token。",
      "模拟题：线程暂停超过锁租约、另一实例已获得锁后，如何阻止旧持有者继续覆盖数据？",
      "面试话术：我先定义可容忍的重复窗口，再解释申请、释放、续期与下游保护，不宣称某种锁在所有故障下最可靠。"
    ],
    "status": "ready"
  },
  "tracing": { core: false, summary: "", points: [], status: "pending" },
  "logging": { core: false, summary: "", points: [], status: "pending" },
  // ---- 算法 ----
  "algorithm": { core: false, summary: "", points: [], status: "pending" },
  "leetcode": { core: false, summary: "", points: [], status: "pending" },
  "sorting": {
    core: true,
    summary: "排序算法考察时间/空间复杂度与稳定性，快排、归并、堆排是高频手写题。",
    points: [
      "快排：分治 + 分区（partition），平均 O(nlogn) 最坏 O(n²)，不稳定，实际最常用（Arrays.sort 对基本类型）",
      "归并排序：分治合并，O(nlogn) 稳定，需 O(n) 额外空间，适合外部排序与链表排序",
      "堆排序：建堆 + 堆顶下沉，O(nlogn) 不稳定，原地排序适合 TopK 问题",
      "插入/冒泡/选择：O(n²)，插入排序在近乎有序数组接近 O(n)，希尔是插入改进",
      "计数/基数/桶排序：非比较排序，O(n+k)，对整数或有限范围数据快",
      "稳定性对比：稳定（归并/插入/冒泡/基数），不稳定（快排/堆排/选择/希尔）",
      "TopK 问题：堆 O(nlogk)、快排 partition 减治 O(n) 平均",
      "面试话术：手写快排 + 讲复杂度推导，背稳定性表格，能说出 Arrays.sort 的双轴快排与 TimSort"
    ],
    status: "ready"
  },
  // ---- 网络 / 操作系统 ----
  "network": {
    "core": true,
    "summary": "网络复习从一次请求展开，再深入连接、HTTP 语义、TLS 与 DNS。应把协议版本和应用语义区分开。",
    "points": [
      "知识地图：DNS → TCP/QUIC → TLS → HTTP → 代理/服务 → 响应。",
      "面试重点：连接建立与关闭、流量/拥塞控制、缓存与状态码、TLS 验证和连接复用。",
      "实战避坑：HTTP 传输版本不决定业务幂等；TLS 保护通信，也不能代替应用鉴权。",
      "模拟题：接口超时如何按 DNS、连接、TLS 和服务处理拆分？",
      "面试话术：我从请求链路说明协议协作，再根据实际指标定位具体阶段。"
    ],
    "status": "ready"
  },
  "os": { core: false, summary: "", points: [], status: "pending" },
  // ---- AI ----
  "ai": { core: false, summary: "", points: [], status: "pending" },
  "ai-basics": {
    "core": true,
    "summary": "LLM 基础知识是 AI 岗位面试门槛：Transformer 架构、token 与 embedding、Prompt 与参数调节。",
    "points": [
      "大语言模型（LLM）：基于海量文本预训练的参数化模型，核心是预测下一个 token（自回归生成）",
      "Transformer 架构：注意力机制（Self-Attention）+ 位置编码 + 多头注意力，解决长距离依赖",
      "token 是模型分词器使用的单位，不固定等于某个字数；embedding 是向量表示，计费与上下文估算需使用目标模型的实际分词方式。",
      "上下文（Context）：模型一次能处理的 token 窗口，超出需截断或摘要",
      "关键参数：Temperature（随机性）、Top-p/Top-k（采样范围）、max_tokens（输出长度）",
      "模型类型：文本模型（GPT/Claude/Qwen）、多模态（文+图）、Embedding 模型（向量检索）",
      "微调调整模型行为与任务表现，RAG 检索外部知识供生成使用；微调不能替代可靠知识更新，RAG 也不能保证答案不会出现错误。",
      "模拟题：知识库内容频繁变化时，怎样选择 RAG、微调和评测方案？",
      "面试话术：讲 Transformer 注意力 + 预测下一个 token 原理，分清 token/embedding/context，对比微调与 RAG"
    ],
    "status": "ready"
  },
  "ai-models": { core: false, summary: "", points: [], status: "pending" },
  "ai-mcp": {
    core: true,
    summary: "MCP（Model Context Protocol）是 AI 应用连接外部工具与数据的开放协议，核心是 Function Calling。",
    points: [
      "MCP 是什么：标准化协议，让 LLM 应用统一接入工具、数据源（类似 AI 的 USB-C 接口）",
      "核心概念：Client（宿主应用）+ Server（工具/资源提供方）+ 工具调用（tools）",
      "Function Calling：模型输出结构化调用参数，由应用执行真实函数并回传结果（函数即工具）",
      "工作流：用户提问 → 模型判断需要工具 → 返回 tool_call（函数名+参数）→ 应用执行 → 结果回传模型生成答案",
      "工具定义：JSON Schema 描述函数名、参数、描述，供模型选择",
      "典型应用：Claude Code / Cursor / 各种 Agent 通过 MCP 访问数据库、浏览器、文件系统",
      "面试话术：用\"AI 的 USB-C\"类比解释 MCP，讲清 Function Calling 的调用闭环，举例工具定义 Schema"
    ],
    status: "ready"
  },
  "ai-rag": {
    core: true,
    summary: "RAG（检索增强生成）通过外部知识检索为 LLM 注入领域知识，解决幻觉与知识时效问题。",
    points: [
      "RAG 流程：文档切分 → Embedding 向量化 → 存入向量数据库 → 检索 TopK → 拼接 Prompt → 生成回答",
      "向量数据库：Milvus/Redis/PostgreSQL(pgvector)/Chroma/Weaviate，存向量 + 相似度检索（余弦/内积）",
      "为什么用 RAG：知识更新快（无需重训）、可控溯源、成本低；解决 LLM 幻觉与领域知识缺失",
      "关键技术：文档切分策略（chunk size/overlap）、混合检索（向量+关键词）、重排（rerank）",
      "RAG vs 微调：RAG 注入外部知识库，微调改变行为风格；复杂推理场景可结合使用",
      "效果优化：query 改写、多路召回、引用标注降低幻觉",
      "面试话术：画 RAG 全流程图（切分→向量化→检索→生成），讲 Embedding 相似度原理，对比 RAG 与微调"
    ],
    status: "ready"
  },
  "ai-finetune": { core: false, summary: "", points: [], status: "pending" },
  "ai-frameworks": { core: false, summary: "", points: [], status: "pending" },
  "ai-agent": {
    core: true,
    summary: "AI Agent 让模型自主规划、调用工具、管理状态，核心能力是工具调用、任务规划、记忆与多智能体协作。",
    points: [
      "Agent 定义：LLM 作为大脑，感知环境、自主规划决策、调用工具执行任务（ReAct 模式：思考-行动-观察循环）",
      "四大能力：工具调用（Function Calling）、任务规划（Plan & Execute）、状态管理（Memory）、多 Agent 协作",
      "工具调用：模型输出结构化参数，执行外部函数（API/数据库/浏览器），Agent 的能力边界取决于工具",
      "任务规划：将复杂任务拆解为子步骤（Chain-of-Thought、ReAct、Plan-and-Execute 框架）",
      "状态管理（Memory）：短期记忆（对话上下文）+ 长期记忆（向量数据库存储历史）",
      "多 Agent 协作：AutoGen（对话式）、CrewAI（角色分工）、LangGraph（图状态编排）",
      "常见坑：Agent 循环失控（限制最大迭代）、工具调用失败重试、上下文超限",
      "面试话术：讲 ReAct 循环（Thought→Action→Observation），按\"工具/规划/记忆/协作\"四能力展开"
    ],
    status: "ready"
  },
  "ai-tools": { core: false, summary: "", points: [], status: "pending" }
});