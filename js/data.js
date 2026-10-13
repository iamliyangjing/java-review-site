// Graph structure data for the Java interview review site.
// Node ids are stable English slugs; notes files reference them by id.

window.NODES = [
  // ---- 基础 (basic) ----
  { id: "basic", name: "Java 基础", level: 1, parent: null, core: false },
  { id: "basic-syntax", name: "基础语法与程序设计结构", level: 2, parent: "basic", core: false },
  { id: "oop", name: "面向对象编程", level: 2, parent: "basic", core: true },
  { id: "oop-principles", name: "封装、继承与多态", level: 3, parent: "oop", core: true },
  { id: "design-patterns", name: "设计模式", level: 3, parent: "oop", core: false },
  { id: "design-principles", name: "SOLID 设计原则", level: 3, parent: "oop", core: false },
  { id: "core-lib", name: "集合与核心类库", level: 2, parent: "basic", core: false },
  { id: "stream", name: "Stream 流水线与并行执行", level: 3, parent: "core-lib", core: true },
  { id: "advanced-features", name: "高级特性与机制", level: 2, parent: "basic", core: false },
  { id: "new-features", name: "版本特性与升级", level: 2, parent: "basic", core: false },
  { id: "java8", name: "Java 8", level: 3, parent: "new-features", core: true },
  { id: "java8-lambda", name: "Lambda 表达式", level: 4, parent: "java8", core: true },
  { id: "java8-stream", name: "Stream 分组与聚合实战", level: 4, parent: "java8", core: true },
  { id: "java8-datetime", name: "新的日期时间 API", level: 4, parent: "java8", core: false },
  { id: "java8-optional", name: "Optional 类", level: 4, parent: "java8", core: false },
  { id: "java17", name: "Java 17", level: 3, parent: "new-features", core: false },

  // ---- 多线程 (multithreading) ----
  { id: "multithreading", name: "多线程", level: 1, parent: null, core: true },
  { id: "thread-intro", name: "线程简介", level: 2, parent: "multithreading", core: true },
  { id: "jmm", name: "Java 内存模型（JMM）", level: 2, parent: "multithreading", core: true },
  { id: "volatile", name: "volatile 与内存可见性", level: 2, parent: "multithreading", core: true },
  { id: "synchronized", name: "synchronized 与对象监视器", level: 2, parent: "multithreading", core: true },
  { id: "cas-atomic", name: "CAS 与原子类", level: 2, parent: "multithreading", core: true },
  { id: "aqs-reentrantlock", name: "AQS、ReentrantLock 与 Condition", level: 2, parent: "multithreading", core: true },
  { id: "aqs-shared", name: "Semaphore 与 CountDownLatch", level: 2, parent: "multithreading", core: true },
  { id: "threadlocal", name: "ThreadLocal 与上下文传递", level: 2, parent: "multithreading", core: true },
  { id: "futuretask", name: "Future 与异步编排", level: 2, parent: "multithreading", core: true },

  // ---- JVM ----
  { id: "jvm", name: "JVM", level: 1, parent: null, core: true },
  { id: "jvm-types", name: "JVM虚拟机类型", level: 2, parent: "jvm", core: false },
  { id: "jvm-memory", name: "JVM内存划分", level: 2, parent: "jvm", core: true },
  { id: "classloader", name: "类加载子系统", level: 2, parent: "jvm", core: true },
  { id: "classloader-process", name: "类加载过程", level: 3, parent: "classloader", core: true },
  { id: "classloader-parents", name: "双亲委派机制", level: 3, parent: "classloader", core: true },
  { id: "classloader-context", name: "线程上下文类加载器", level: 3, parent: "classloader", core: false },
  { id: "execution-engine", name: "执行引擎子系统", level: 2, parent: "jvm", core: false },
  { id: "jit", name: "JIT即时编译原理", level: 3, parent: "execution-engine", core: true },
  { id: "dispatch", name: "分派实现", level: 3, parent: "execution-engine", core: false },
  { id: "gc", name: "垃圾回收子系统", level: 2, parent: "jvm", core: true },
  { id: "gc-algorithms", name: "垃圾回收算法", level: 3, parent: "gc", core: true },
  { id: "gc-collectors", name: "垃圾回收器", level: 3, parent: "gc", core: true },
  { id: "gc-tuning", name: "GC调优", level: 3, parent: "gc", core: false },
  { id: "runtime-data-area", name: "运行时数据区", level: 2, parent: "jvm", core: true },
  { id: "oom", name: "内存溢出", level: 3, parent: "runtime-data-area", core: true },
  { id: "memory-leak", name: "内存泄漏剖析", level: 3, parent: "runtime-data-area", core: false },
  { id: "object-layout", name: "对象内存布局", level: 2, parent: "jvm", core: false },
  { id: "object-allocation", name: "分配过程", level: 3, parent: "object-layout", core: false },
  { id: "references", name: "强弱虚引用", level: 3, parent: "object-layout", core: true },

  // ---- 数据库 (database) ----
  { id: "database", name: "数据库", level: 1, parent: null, core: true },
  { id: "mysql", name: "关系型数据库 MySQL", level: 2, parent: "database", core: true },
  { id: "mysql-basic", name: "MySQL 基础", level: 3, parent: "mysql", core: false },
  { id: "mysql-select", name: "SQL 查询执行流程", level: 4, parent: "mysql-basic", core: true },
  { id: "mysql-row-storage", name: "MySQL一行记录是怎么存储的？", level: 4, parent: "mysql-basic", core: false },
  { id: "mysql-index", name: "索引", level: 3, parent: "mysql", core: true },
  { id: "mysql-btree", name: "B+树", level: 4, parent: "mysql-index", core: true },
  { id: "mysql-transaction", name: "事务", level: 3, parent: "mysql", core: true },
  { id: "mysql-isolation", name: "隔离级别（脏读/不可重复读/幻读）", level: 4, parent: "mysql-transaction", core: true },
  { id: "mysql-lock", name: "锁", level: 3, parent: "mysql", core: true },
  { id: "mysql-log", name: "日志（undo/redo/binlog）", level: 3, parent: "mysql", core: true },
  { id: "mysql-bufferpool", name: "Buffer Pool", level: 3, parent: "mysql", core: false },
  { id: "pg", name: "PostgreSQL", level: 2, parent: "database", core: false },
  { id: "redis", name: "非关系数据库 Redis", level: 2, parent: "database", core: true },
  { id: "redis-types", name: "数据类型和应用场景", level: 3, parent: "redis", core: true },
  { id: "redis-datastruct", name: "数据结构", level: 3, parent: "redis", core: true },
  { id: "redis-arch", name: "Redis架构（单实例/高可用/集群）", level: 3, parent: "redis", core: true },
  { id: "redis-persistence", name: "持久化（RDB/AOF）", level: 3, parent: "redis", core: true },
  { id: "redis-bigkey", name: "Redis大Key问题", level: 3, parent: "redis", core: false },

  // ---- 框架 (framework) ----
  { id: "framework", name: "框架", level: 1, parent: null, core: true },
  { id: "springboot", name: "Spring Boot 自动配置", level: 2, parent: "framework", core: true },
  { id: "mybatis", name: "MyBatis", level: 2, parent: "framework", core: true },
  { id: "springcloud", name: "Spring Cloud 服务治理", level: 2, parent: "framework", core: true },

  // ---- 中间件 (middleware) ----
  { id: "middleware", name: "中间件", level: 1, parent: null, core: false },
  { id: "kafka", name: "Kafka", level: 2, parent: "middleware", core: true },
  { id: "rabbitmq", name: "RabbitMQ", level: 2, parent: "middleware", core: false },
  { id: "rocketmq", name: "RocketMQ", level: 2, parent: "middleware", core: false },

  // ---- 微服务 (microservice) ----
  { id: "microservice", name: "微服务", level: 1, parent: null, core: true },
  { id: "service-discovery", name: "服务注册发现", level: 2, parent: "microservice", core: true },
  { id: "config-center", name: "配置中心", level: 2, parent: "microservice", core: false },
  { id: "load-balance", name: "负载均衡", level: 2, parent: "microservice", core: false },
  { id: "rate-limit", name: "限流熔断", level: 2, parent: "microservice", core: true },
  { id: "distributed-tx", name: "分布式事务", level: 2, parent: "microservice", core: true },
  { id: "distributed-lock", name: "分布式锁", level: 2, parent: "microservice", core: true },
  { id: "tracing", name: "链路追踪", level: 2, parent: "microservice", core: false },
  { id: "logging", name: "日志管理", level: 2, parent: "microservice", core: false },

  // ---- 算法 (algorithm) ----
  { id: "algorithm", name: "算法", level: 1, parent: null, core: false },
  { id: "leetcode", name: "高频题复习路线", level: 2, parent: "algorithm", core: false },
  { id: "sorting", name: "排序算法", level: 2, parent: "algorithm", core: true },

  // ---- 计算机网络 (network) ----
  { id: "network", name: "计算机网络", level: 1, parent: null, core: true },

  // ---- 操作系统 (os) ----
  { id: "os", name: "操作系统", level: 1, parent: null, core: false },

  // ---- AI ----
  { id: "ai", name: "AI", level: 1, parent: null, core: false },
  { id: "ai-basics", name: "基础认知", level: 2, parent: "ai", core: true },
  { id: "ai-models", name: "模型 API 集成与选型", level: 2, parent: "ai", core: false },
  { id: "ai-mcp", name: "MCP", level: 2, parent: "ai", core: true },
  { id: "ai-rag", name: "RAG", level: 2, parent: "ai", core: true },
  { id: "ai-finetune", name: "Fine-tuning 微调", level: 2, parent: "ai", core: false },
  { id: "ai-frameworks", name: "框架（LangChain/LlamaIndex）", level: 2, parent: "ai", core: false },
  { id: "ai-agent", name: "AI Agent", level: 2, parent: "ai", core: true },
  { id: "ai-tools", name: "AI 编程工具与工程实践", level: 2, parent: "ai", core: false },

  // Interview-focused additions retain all original node IDs.
  { id: "arraylist", name: "ArrayList 与 LinkedList", level: 3, parent: "core-lib", core: true },
  { id: "hashmap", name: "HashMap 原理与扩容", level: 3, parent: "core-lib", core: true },
  { id: "concurrenthashmap", name: "ConcurrentHashMap", level: 3, parent: "core-lib", core: true },
  { id: "equals-hashcode", name: "equals、hashCode 与集合契约", level: 3, parent: "core-lib", core: true },
  { id: "java-string", name: "String 与字符串处理", level: 3, parent: "core-lib", core: true },
  { id: "bigdecimal", name: "BigDecimal 与数值精度", level: 3, parent: "core-lib", core: false },
  { id: "exceptions", name: "异常与资源关闭", level: 3, parent: "basic-syntax", core: true },
  { id: "generics", name: "泛型、类型擦除与 PECS", level: 3, parent: "advanced-features", core: true },
  { id: "reflection-spi", name: "反射、注解与 SPI", level: 3, parent: "advanced-features", core: false },
  { id: "java-io", name: "BIO、NIO 与 AIO", level: 2, parent: "basic", core: true },
  { id: "java21", name: "Java 21", level: 3, parent: "new-features", core: false },
  { id: "virtual-threads", name: "虚拟线程与适用边界", level: 4, parent: "java21", core: true },
  { id: "java25", name: "Java 25 与升级评估", level: 3, parent: "new-features", core: false },
  { id: "thread-pool", name: "线程池参数与执行流程", level: 2, parent: "multithreading", core: true },
  { id: "thread-pool-tuning", name: "线程池容量与故障排查", level: 3, parent: "thread-pool", core: true },
  { id: "concurrency-deadlock", name: "死锁、中断与并发协作", level: 2, parent: "multithreading", core: true },
  { id: "jvm-troubleshooting", name: "JFR、线程转储与 JVM 排障", level: 2, parent: "jvm", core: true },
  { id: "mysql-mvcc", name: "MVCC 与 ReadView", level: 4, parent: "mysql-transaction", core: true },
  { id: "mysql-explain", name: "EXPLAIN 与慢 SQL 优化", level: 4, parent: "mysql-index", core: true },
  { id: "redis-cache", name: "缓存一致性与缓存故障", level: 3, parent: "redis", core: true },
  { id: "redis-eviction", name: "过期、淘汰与热点 Key", level: 3, parent: "redis", core: true },
  { id: "spring", name: "Spring 核心机制", level: 2, parent: "framework", core: true },
  { id: "spring-bean", name: "IoC、Bean 生命周期与循环依赖", level: 3, parent: "spring", core: true },
  { id: "spring-aop", name: "AOP 与代理机制", level: 3, parent: "spring", core: true },
  { id: "spring-transaction", name: "事务传播与失效场景", level: 3, parent: "spring", core: true },
  { id: "spring-mvc", name: "Spring MVC 请求处理", level: 3, parent: "spring", core: true },
  { id: "mybatis-cache", name: "MyBatis 缓存与批量查询", level: 3, parent: "mybatis", core: false },
  { id: "mq-reliability", name: "消息可靠性与投递语义", level: 2, parent: "middleware", core: true },
  { id: "mq-idempotency", name: "消费幂等与消息积压", level: 3, parent: "mq-reliability", core: true },
  { id: "api-idempotency", name: "接口幂等与重复提交", level: 2, parent: "microservice", core: true },
  { id: "distributed-id", name: "分布式 ID 与时钟回拨", level: 2, parent: "microservice", core: false },
  { id: "algorithm-array-hash", name: "数组、哈希与滑动窗口", level: 2, parent: "algorithm", core: true },
  { id: "algorithm-linked-list", name: "链表与双指针", level: 2, parent: "algorithm", core: true },
  { id: "algorithm-tree-graph", name: "树、图与 BFS / DFS", level: 2, parent: "algorithm", core: true },
  { id: "algorithm-dp", name: "动态规划与状态设计", level: 2, parent: "algorithm", core: true },
  { id: "network-tcp", name: "TCP 连接与可靠传输", level: 2, parent: "network", core: true },
  { id: "network-http", name: "HTTP 语义、缓存与版本", level: 2, parent: "network", core: true },
  { id: "network-tls", name: "HTTPS 与 TLS 握手", level: 2, parent: "network", core: true },
  { id: "network-dns", name: "DNS 与一次请求的链路", level: 2, parent: "network", core: false },
  { id: "os-process", name: "进程、线程与调度", level: 2, parent: "os", core: true },
  { id: "os-memory", name: "虚拟内存与缺页", level: 2, parent: "os", core: true },
  { id: "os-io", name: "阻塞、非阻塞与 IO 多路复用", level: 2, parent: "os", core: true },
  { id: "linux-troubleshooting", name: "Linux CPU、内存与网络排障", level: 2, parent: "os", core: true },

  // OS curriculum additions follow the hardware -> memory -> process -> IO route.
  { id: "os-hardware", name: "CPU、缓存与软中断", level: 2, parent: "os", core: true },
  { id: "os-cpu-cache", name: "CPU 执行与缓存局部性", level: 3, parent: "os-hardware", core: true },
  { id: "os-cache-coherence", name: "CPU 缓存一致性与伪共享", level: 3, parent: "os-hardware", core: true },
  { id: "os-system-structure", name: "Linux 与 Windows 内核", level: 2, parent: "os", core: false },
  { id: "os-memory-allocation", name: "malloc 与内存分配", level: 2, parent: "os", core: true },
  { id: "os-memory-pressure", name: "内存回收与 OOM", level: 2, parent: "os", core: true },
  { id: "os-cache-lru", name: "预读、缓存与 LRU", level: 2, parent: "os", core: false },
  { id: "os-process-ipc", name: "进程间通信", level: 3, parent: "os-process", core: true },
  { id: "os-thread-sync", name: "多线程同步与竞态", level: 3, parent: "os-process", core: true },
  { id: "os-deadlock", name: "死锁与避免策略", level: 3, parent: "os-process", core: true },
  { id: "os-locks", name: "悲观锁与乐观锁", level: 3, parent: "os-process", core: true },
  { id: "os-scheduling", name: "进程、页面与磁盘调度", level: 2, parent: "os", core: true },
  { id: "os-file-system", name: "文件系统与 inode", level: 2, parent: "os", core: true },
  { id: "os-page-cache", name: "Page Cache 与数据落盘", level: 3, parent: "os-file-system", core: true },
  { id: "os-device", name: "设备管理与键盘输入", level: 2, parent: "os", core: false },
  { id: "os-zero-copy", name: "零拷贝", level: 2, parent: "os", core: true },
  { id: "os-reactor", name: "Reactor 与 Proactor", level: 2, parent: "os", core: true },
  { id: "os-consistent-hash", name: "一致性哈希", level: 2, parent: "os", core: false },
  { id: "linux-network-metrics", name: "网络性能指标", level: 3, parent: "linux-troubleshooting", core: true },
  { id: "linux-log-analysis", name: "日志 PV、UV 与请求分析", level: 3, parent: "linux-troubleshooting", core: false },

  // Network curriculum additions follow the TCP/IP -> HTTP -> TCP -> IP route.
  { id: "network-basics", name: "TCP/IP 分层模型", level: 2, parent: "network", core: true },
  { id: "network-request-flow", name: "从输入网址到页面显示", level: 2, parent: "network", core: true },
  { id: "network-linux-packet", name: "Linux 收发网络包", level: 2, parent: "network", core: false },
  { id: "network-http-interview", name: "HTTP 常见面试题", level: 2, parent: "network", core: true },
  { id: "network-http-optimization", name: "HTTP/1.1 性能优化", level: 2, parent: "network", core: true },
  { id: "network-https-rsa", name: "HTTPS RSA 握手", level: 2, parent: "network", core: false },
  { id: "network-https-ecdhe", name: "HTTPS ECDHE 握手", level: 2, parent: "network", core: true },
  { id: "network-https-optimization", name: "HTTPS 性能优化", level: 2, parent: "network", core: false },
  { id: "network-http2", name: "HTTP/2 多路复用", level: 2, parent: "network", core: true },
  { id: "network-http3", name: "HTTP/3 与 QUIC", level: 2, parent: "network", core: true },
  { id: "network-rpc", name: "RPC 与 HTTP 的取舍", level: 2, parent: "network", core: true },
  { id: "network-websocket", name: "WebSocket 双向通信", level: 2, parent: "network", core: false },
  { id: "network-tcp-handshake", name: "TCP 三次握手与四次挥手", level: 3, parent: "network-tcp", core: true },
  { id: "network-tcp-control", name: "TCP 重传、窗口与拥塞控制", level: 3, parent: "network-tcp", core: true },
  { id: "network-tcp-capture", name: "TCP 抓包与分段分析", level: 3, parent: "network-tcp", core: false },
  { id: "network-tcp-queues", name: "TCP 半连接与全连接队列", level: 3, parent: "network-tcp", core: true },
  { id: "network-tcp-tuning", name: "TCP 参数与性能调优", level: 3, parent: "network-tcp", core: false },
  { id: "network-tcp-stream", name: "TCP 字节流与分帧", level: 3, parent: "network-tcp", core: true },
  { id: "network-tcp-failure", name: "断电、断网与进程崩溃", level: 3, parent: "network-tcp", core: true },
  { id: "network-tcp-keepalive", name: "TCP Keepalive 与 HTTP Keep-Alive", level: 3, parent: "network-tcp", core: false },
  { id: "network-udp-reliable", name: "UDP 可靠传输与 QUIC", level: 3, parent: "network-tcp", core: true },
  { id: "network-ip-basics", name: "IP 地址、路由与分片", level: 2, parent: "network", core: true },
  { id: "network-ping", name: "ping 与 ICMP", level: 2, parent: "network", core: false },
  { id: "network-loopback", name: "127.0.0.1 与回环接口", level: 2, parent: "network", core: false }
];

// Present each module in learning order without changing identity or ownership.
(function () {
  const orderByParent = {
    basic: ["basic-syntax", "oop", "core-lib", "advanced-features", "java-io", "new-features"],
    "core-lib": ["equals-hashcode", "java-string", "bigdecimal", "arraylist", "hashmap", "concurrenthashmap", "stream"],
    multithreading: ["thread-intro", "jmm", "volatile", "synchronized", "cas-atomic", "aqs-reentrantlock", "aqs-shared", "thread-pool", "threadlocal", "futuretask", "concurrency-deadlock"],
    framework: ["spring", "springboot", "mybatis", "springcloud"],
    database: ["mysql", "redis", "pg"],
    middleware: ["mq-reliability", "kafka", "rabbitmq", "rocketmq"],
    algorithm: ["algorithm-array-hash", "algorithm-linked-list", "algorithm-tree-graph", "algorithm-dp", "sorting", "leetcode"],
    network: ["network-basics", "network-request-flow", "network-linux-packet", "network-dns", "network-http-interview", "network-http-optimization", "network-https-rsa", "network-https-ecdhe", "network-https-optimization", "network-http2", "network-http3", "network-rpc", "network-websocket", "network-tcp", "network-ip-basics", "network-ping", "network-loopback"],
    "network-tcp": ["network-tcp-handshake", "network-tcp-control", "network-tcp-capture", "network-tcp-queues", "network-tcp-tuning", "network-tcp-stream", "network-tcp-failure", "network-tcp-keepalive", "network-udp-reliable"],
    os: ["os-hardware", "os-system-structure", "os-memory", "os-memory-allocation", "os-memory-pressure", "os-cache-lru", "os-process", "os-scheduling", "os-file-system", "os-device", "os-io", "os-zero-copy", "os-reactor", "os-consistent-hash", "linux-troubleshooting"],
    "os-hardware": ["os-cpu-cache", "os-cache-coherence"],
    "os-process": ["os-process-ipc", "os-thread-sync", "os-deadlock", "os-locks"],
    "os-file-system": ["os-page-cache"],
    "linux-troubleshooting": ["linux-network-metrics", "linux-log-analysis"]
  };
  const children = new Map();
  for (const node of window.NODES) {
    if (!children.has(node.parent)) children.set(node.parent, []);
    children.get(node.parent).push(node);
  }
  const ordered = [];
  function visit(parentId) {
    const group = children.get(parentId) || [];
    const order = orderByParent[parentId] || [];
    const rank = node => order.includes(node.id) ? order.indexOf(node.id) : order.length;
    group.sort((left, right) => rank(left) - rank(right));
    for (const node of group) {
      ordered.push(node);
      visit(node.id);
    }
  }
  visit(null);
  window.NODES = ordered;
})();

// Build edge list from parent relationships.
window.EDGES = [];
window.NODE_MAP = {};
for (const node of window.NODES) {
  window.NODE_MAP[node.id] = node;
  if (node.parent) {
    window.EDGES.push({ source: node.parent, target: node.id });
  }
}
