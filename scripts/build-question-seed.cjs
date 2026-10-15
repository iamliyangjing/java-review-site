const fs = require("node:fs");
const path = require("node:path");

const ROOT = path.resolve(__dirname, "..");
const CATEGORIES_PATH = path.join(ROOT, "data", "questions.json");
const OUTPUT_PATH = CATEGORIES_PATH;
const REFERENCE = Object.freeze({
  java: { title: "Java SE 官方规范与 API 文档", url: "https://docs.oracle.com/en/java/javase/25/" },
  jvm: { title: "Java 虚拟机规范", url: "https://docs.oracle.com/javase/specs/jvms/se25/html/" },
  mysql: { title: "MySQL 8.4 Reference Manual", url: "https://dev.mysql.com/doc/refman/8.4/en/" },
  redis: { title: "Redis 官方文档", url: "https://redis.io/docs/latest/" },
  postgres: { title: "PostgreSQL 官方文档", url: "https://www.postgresql.org/docs/current/" },
  spring: { title: "Spring Framework Reference", url: "https://docs.spring.io/spring-framework/reference/" },
  springBoot: { title: "Spring Boot Reference", url: "https://docs.spring.io/spring-boot/reference/" },
  mybatis: { title: "MyBatis 3 官方文档", url: "https://mybatis.org/mybatis-3/" },
  kafka: { title: "Apache Kafka 官方文档", url: "https://kafka.apache.org/documentation/" },
  rabbit: { title: "RabbitMQ 官方文档", url: "https://www.rabbitmq.com/docs" },
  rocket: { title: "Apache RocketMQ 官方文档", url: "https://rocketmq.apache.org/docs/" },
  algorithm: { title: "NIST Dictionary of Algorithms and Data Structures", url: "https://xlinux.nist.gov/dads/" },
  tcp: { title: "RFC 9293: Transmission Control Protocol", url: "https://www.rfc-editor.org/rfc/rfc9293" },
  http: { title: "RFC 9110: HTTP Semantics", url: "https://www.rfc-editor.org/rfc/rfc9110" },
  tls: { title: "RFC 8446: TLS 1.3", url: "https://www.rfc-editor.org/rfc/rfc8446" },
  quic: { title: "RFC 9000: QUIC", url: "https://www.rfc-editor.org/rfc/rfc9000" },
  dns: { title: "RFC 1034: Domain Names", url: "https://www.rfc-editor.org/rfc/rfc1034" },
  linux: { title: "Linux Kernel Documentation", url: "https://docs.kernel.org/" },
  linuxMan: { title: "Linux man-pages project", url: "https://www.kernel.org/doc/man-pages/" },
  openai: { title: "OpenAI API 官方文档", url: "https://platform.openai.com/docs/" },
  mcp: { title: "Model Context Protocol 规范", url: "https://modelcontextprotocol.io/specification/" },
  huggingface: { title: "Hugging Face 文档", url: "https://huggingface.co/docs" },
  langchain: { title: "LangChain 官方文档", url: "https://docs.langchain.com/" }
});

function referenceFor(id) {
  if (id.startsWith("mysql")) return REFERENCE.mysql;
  if (id === "pg") return REFERENCE.postgres;
  if (id.startsWith("redis")) return REFERENCE.redis;
  if (id.startsWith("springboot")) return REFERENCE.springBoot;
  if (id.startsWith("mybatis")) return REFERENCE.mybatis;
  if (id.startsWith("spring") || id === "framework") return REFERENCE.spring;
  if (id === "kafka") return REFERENCE.kafka;
  if (id === "rabbitmq") return REFERENCE.rabbit;
  if (id === "rocketmq") return REFERENCE.rocket;
  if (id.startsWith("algorithm") || id === "algorithm" || id === "sorting" || id === "leetcode") return REFERENCE.algorithm;
  if (id.includes("dns")) return REFERENCE.dns;
  if (id.includes("https") || id.includes("tls")) return REFERENCE.tls;
  if (id.includes("http3") || id.includes("udp-reliable")) return REFERENCE.quic;
  if (id.includes("http") || id.includes("websocket") || id.includes("rpc")) return REFERENCE.http;
  if (id.includes("tcp") || id.includes("network")) return REFERENCE.tcp;
  if (id.startsWith("linux-") && id.includes("metrics")) return REFERENCE.linuxMan;
  if (id.startsWith("linux-") || id.startsWith("os-")) return REFERENCE.linux;
  if (id === "ai-mcp") return REFERENCE.mcp;
  if (id === "ai-finetune") return REFERENCE.huggingface;
  if (id === "ai-frameworks") return REFERENCE.langchain;
  if (id.startsWith("ai")) return REFERENCE.openai;
  if (id.startsWith("jvm") || id.startsWith("gc-") || id.startsWith("classloader") || id === "gc" || id === "oom" || id === "memory-leak" || id === "object-layout" || id === "runtime-data-area") return REFERENCE.jvm;
  if (id.startsWith("thread") || id.startsWith("jmm") || id.startsWith("volatile") || id.startsWith("synchronized") || id.startsWith("cas") || id.startsWith("aqs") || id.startsWith("concurrency") || id.startsWith("future") || id.startsWith("virtual")) return { title: "Java Concurrency API", url: "https://docs.oracle.com/en/java/javase/25/docs/api/java.base/java/util/concurrent/package-summary.html" };
  return REFERENCE.java;
}

function topicFamily(id) {
  if (/^(multithreading|thread|jmm|volatile|synchronized|cas|aqs|concurrency|future|virtual)/.test(id)) return "concurrency";
  if (/^(jvm|gc-|gc$|classloader|runtime-data|oom|memory-leak|object-)/.test(id)) return "jvm";
  if (/^(mysql|pg|database)/.test(id)) return "database";
  if (/^redis/.test(id)) return "cache";
  if (/^(spring|framework|mybatis)/.test(id)) return "framework";
  if (/^(middleware|mq-|kafka|rabbitmq|rocketmq)/.test(id)) return "messaging";
  if (/^(microservice|service-discovery|config-center|load-balance|rate-limit|distributed-|tracing|logging|api-idempotency)/.test(id)) return "distributed";
  if (/^(algorithm|sorting|leetcode)/.test(id)) return "algorithm";
  if (/^(network|tcp)/.test(id)) return "network";
  if (/^(os-|linux-)/.test(id) || id === "os") return "operating-system";
  if (/^ai/.test(id)) return "ai";
  return "java";
}

const ANSWER_GUIDES = Object.freeze({
  java: "先用 Java 语言或标准库的契约给出定义，再说明调用方可观察到的行为；区分语言规范保证与某个 JDK 实现细节。结合最小示例解释边界、异常和复杂度，并指出升级时要查对应版本的 API/规范。",
  concurrency: "先明确共享状态与并发目标，再沿线程间的读写顺序解释同步机制。重点说明 happens-before、原子性/可见性/有序性中本题涉及的部分；给出竞争、取消、中断或资源耗尽时的边界，并用线程转储或并发测试验证。",
  jvm: "按类加载、运行时数据区、执行与回收的阶段定位问题，说明对象或线程状态如何变化。区分规范语义与 HotSpot 的实现选择；结合 GC 日志、线程转储、JFR 或堆分析说明证据，最后给出先测量再调参的诊断路径。",
  database: "从 SQL/事务进入存储引擎的执行路径讲起，结合索引、锁或版本可见性说明数据如何被定位和保护。明确隔离级别、数据分布与执行计划对结果的影响；用 EXPLAIN、锁等待和慢查询证据验证，避免只背口诀。",
  cache: "说明所选数据结构和缓存策略如何满足访问模式，然后讨论过期、淘汰、持久化和故障切换。重点分析缓存与源数据的更新顺序、热点及大 Key 风险；给出可观测指标与降级/回源策略，不能把缓存当作天然强一致存储。",
  framework: "从容器或请求入口沿调用链解释框架如何创建对象、选择扩展点并完成调用。区分代理/反射等机制的生效条件与失效场景；结合事务边界、线程切换和异常传播说明行为，并给出可验证的日志或测试。",
  messaging: "按生产、持久化、投递、消费和确认的链路拆解语义，说明每一段可能丢失、重复或延迟的条件。将 broker 的保证与业务端幂等/重试/死信策略分开；通过消息状态、消费位点和积压指标验证恢复过程。",
  distributed: "先明确跨进程边界和故障模型，再区分安全性、活性与可用性目标。说明超时、重试、并发写入和部分失败如何影响状态；使用幂等键、版本/租约或补偿等机制控制重复副作用，并列出可观测与演练方式。",
  algorithm: "先定义输入约束、输出和不变量，再逐步说明状态或指针如何变化。证明边界情形不会漏解/重复处理，分析时间与空间复杂度；用极小、重复、空值及最大规模样例验证，不以代码通过样例代替正确性论证。",
  network: "沿应用层到传输层再到 IP/链路层画出请求与响应路径，说明每层提供的语义及状态变化。区分可靠性、顺序、流控、拥塞控制和加密责任；结合抓包字段、超时点与重传现象定位问题，避免把协议行为混为一谈。",
  "operating-system": "从用户态/内核态边界出发解释资源如何分配、调度或回收，再说明系统调用和并发对可见行为的影响。区分机制与策略，联系 CPU/内存/IO 的指标说明瓶颈；用进程状态、系统调用、/proc 或性能工具验证。",
  ai: "明确模型、提示、检索/工具和应用编排各自的职责，再描述数据从输入到输出的路径。分析质量、延迟、成本、隐私和安全边界；用固定评测集、引用核验、权限控制和失败回退验证效果，不能把概率输出当作确定事实。"
});

const SPECIFIC_ANSWERS = Object.freeze({
  basic: "Java 源码先经编译成为与平台无关的 class 字节码，再由目标 JVM 加载执行；可移植性来自字节码与标准库契约，不代表所有运行时实现完全相同。",
  "basic-syntax": "局部变量必须先明确初始化再读取；基本类型保存值，引用类型变量保存对象引用。控制流分析、作用域和异常路径都要纳入初始化判断。",
  exceptions: "try-with-resources 按声明的逆序自动关闭 AutoCloseable 资源，关闭异常可作为 suppressed exception 保留；业务异常应表达可处理的失败，不能用吞异常掩盖故障。",
  oop: "对象封装状态与行为，接口定义可替换契约，组合通常比继承更容易控制耦合；多态调用由运行时接收者类型决定实际覆写实现。",
  "oop-principles": "封装保护不变量，继承表达稳定的 is-a 关系，多态支持面向接口替换；若子类破坏父类承诺，就违反可替换性，应优先拆分接口或组合。",
  "design-patterns": "模式是重复设计问题的可沟通方案，不是固定套用的类图；先识别变化点和耦合，再比较模式带来的扩展收益与额外抽象成本。",
  "design-principles": "SOLID 的落点是让变化局部化：依赖抽象、保持替换契约、按客户端拆接口，并让模块围绕单一变化原因组织。",
  "core-lib": "Java 集合接口区分有序、去重、键值和并发语义；选择结构要匹配查询/更新复杂度、顺序要求及线程安全边界。",
  "equals-hashcode": "若两个对象 equals 为 true，它们的 hashCode 必须相同；反向不成立。作为 HashMap 键时，参与相等判断的字段应保持稳定。",
  "java-string": "String 不可变，拼接会创建新值；循环累加应使用 StringBuilder。常量池是运行时优化机制，不能替代对对象身份与内容相等的区分。",
  bigdecimal: "BigDecimal 用十进制表示避免二进制浮点误差；金额计算应明确 scale 与舍入模式，比较数值用 compareTo，避免依赖 scale 敏感的 equals。",
  arraylist: "ArrayList 以连续数组支持 O(1) 随机访问、尾部摊还 O(1) 添加，中间插入/删除需移动元素；LinkedList 按索引访问仍为 O(n)，不能仅凭链表插删复杂度判断更快。",
  hashmap: "HashMap 将 hash 扰动后映射到容量为 2 的幂的桶，冲突通过链表或满足条件时的红黑树处理；扩容重分桶，非线程安全。",
  concurrenthashmap: "ConcurrentHashMap 以 CAS 与桶级同步协调并发更新，读取通常不加全表锁；复合业务操作仍需原子 API 或外部事务，迭代器为弱一致。",
  stream: "Stream 是惰性流水线：中间操作描述转换，终端操作触发执行；流通常不可复用，副作用和共享可变状态会破坏并行语义。",
  "advanced-features": "注解、反射、代理等高级机制应通过明确扩展点使用；它们增加动态能力，也带来可读性、启动成本和封装边界方面的代价。",
  generics: "Java 泛型主要通过类型擦除实现；PECS 规则是生产者用 extends、消费者用 super。泛型数组和原始类型会受擦除限制，应优先使用类型安全集合。",
  "reflection-spi": "反射允许运行时发现类型成员，SPI 以服务接口和提供者解耦实现选择；线程上下文类加载器常用于跨容器加载提供者，需控制可见性和权限。",
  "java-io": "BIO 通常一连接一线程阻塞处理，NIO 用 Channel/Buffer/Selector 管理就绪事件，异步 IO 则以完成通知交付结果；模型选择要看连接规模与处理方式。",
  "new-features": "升级 Java 应核对语言/API 变化、默认 GC 与启动参数、依赖兼容和运行镜像；先用目标 JDK 跑测试及性能基线，再灰度观察。",
  java8: "Java 8 引入 Lambda、Stream、默认方法和 java.time 等能力；升级迁移要特别检查时区处理、接口默认方法冲突及并行流共享状态。",
  "java8-lambda": "Lambda 是函数式接口的实例表达式；捕获的局部变量须为 final 或 effectively final。方法引用只是 Lambda 的简写，不自动带来并行或异步。",
  "java8-stream": "Collectors.groupingBy 可按键分组，downstream collector 可继续计数、求和或映射；并行收集器的合并成本和线程安全必须一并评估。",
  "java8-datetime": "java.time 用不可变类型区分 LocalDate、LocalDateTime、Instant 与 ZonedDateTime；跨时区时间点应存 Instant 并明确业务时区。",
  "java8-optional": "Optional 适合表达可能缺失的返回值，不应普遍作为字段、参数或集合包装；orElse 会立即求值，昂贵默认值应使用 orElseGet。",
  java17: "Java 17 是 LTS 版本，包含 sealed classes、records 等正式能力；迁移需检查强封装对深反射的影响并评估依赖兼容。",
  java21: "Java 21 是 LTS 版本，虚拟线程、记录模式和结构化并发等能力需按正式状态区分；并发代码迁移仍需审视阻塞资源与 pinning。",
  "virtual-threads": "虚拟线程让大量阻塞任务更轻量，但不会加速 CPU 密集任务；应每个任务创建虚拟线程并限制数据库连接等稀缺资源，而非池化虚拟线程。",
  java25: "Java 25 的版本特性与兼容结论必须按正式发行说明确认；生产升级要锁定目标发行版、检查弃用/移除项并以应用基准测试验证。",
  multithreading: "线程共享进程地址空间，提升并发能力也引入竞态；正确性依赖同步建立的 happens-before，而非依赖调度时序或 sleep。",
  "thread-intro": "Java Thread 可承载执行，Runnable/Callable 描述任务；线程创建、调度与阻塞都有成本，服务端通常通过受控执行器管理任务生命周期。",
  jmm: "JMM 定义线程间变量读写及 happens-before 关系；同一监视器解锁到后续加锁、volatile 写到后续读等规则可建立可见性与有序性。",
  volatile: "volatile 保证单次读写的可见性和特定顺序，不使 i++ 这类读改写复合操作原子化；计数应改用原子类或锁。",
  synchronized: "synchronized 进入监视器前后建立同步语义，并保证同一锁上的互斥与可见性；锁对象必须稳定且不能泄漏给无关调用方。",
  "cas-atomic": "CAS 比较内存位置当前值与期望值并尝试更新；循环重试可能产生竞争与 ABA，版本戳或更高层锁可解决特定问题。",
  "aqs-reentrantlock": "AQS 以同步状态和 FIFO 等待队列构建锁；ReentrantLock 提供可中断、可限时及公平策略，Condition 可为不同条件队列分别唤醒。",
  "aqs-shared": "CountDownLatch 等待计数归零后放行且不可复位；Semaphore 控制并发许可并可释放归还，二者分别适用于一次性阶段同步与资源并发上限。",
  "thread-pool": "线程池任务依次经历核心线程、队列、最大线程和拒绝策略；有界队列与明确拒绝处理可防止流量高峰时任务无限堆积。",
  "thread-pool-tuning": "线程池大小应结合 CPU/阻塞比例、队列等待和下游容量测量；监控活跃数、排队、拒绝、完成延迟，并设置超时及隔离。",
  threadlocal: "ThreadLocal 隔离线程内变量，但在线程池中线程会复用；请求结束必须 remove，跨异步线程需显式传递上下文。",
  futuretask: "Future 表示异步结果，get 会阻塞且应设置超时；取消需配合中断语义。CompletableFuture 组合任务时要显式选择执行器并传播异常。",
  "concurrency-deadlock": "死锁要求互斥、占有并等待、不可抢占和循环等待同时成立；统一锁顺序可破坏循环等待，处理中断则应恢复或传播中断状态。",
  jvm: "JVM 规范定义字节码执行环境，具体 HotSpot 的内存布局、GC 与 JIT 属于实现；排障结论应标注发行版和参数。",
  "jvm-types": "HotSpot、OpenJ9 等实现均遵循 JVM 规范但优化策略不同；比较虚拟机需用相同应用、版本、硬件和负载测试。",
  "jvm-memory": "Java 堆存对象，线程私有栈保存栈帧，元空间保存类元数据；直接内存和本地资源也可能耗尽进程内存但不计入 Java 堆。",
  classloader: "类加载器用类名和定义加载器共同标识类型；同名类由不同加载器定义仍不兼容，资源释放需避免类加载器被长生命周期对象引用。",
  "classloader-process": "类生命周期包含加载、验证、准备、解析和初始化；主动使用触发初始化，准备阶段先为静态字段分配默认值。",
  "classloader-parents": "双亲委派让加载器先请求父加载器，以保护核心类并避免重复定义；模块容器或应用服务器可因隔离需求采用受控例外。",
  "classloader-context": "线程上下文类加载器允许框架代码按调用线程上下文发现应用提供者；线程池需设置与清理上下文，避免跨应用泄漏。",
  "execution-engine": "执行引擎解释执行字节码并可将热点编译为机器码；性能由工作负载、预热、编译阈值和运行时优化共同决定。",
  jit: "JIT 根据运行时热点画像编译优化代码，去优化会在假设失效时退回解释执行；微基准必须预热并防止死代码消除。",
  dispatch: "重载在编译期按声明类型选择，覆写在运行期按接收者实际类型分派；静态方法隐藏而非覆写。",
  gc: "GC 回收不可达对象，降低手动内存管理负担但不保证及时释放；文件、连接等外部资源应显式关闭。",
  "gc-algorithms": "标记清除易产生碎片，复制算法以空间换整理速度，标记整理避免碎片但需移动对象；分代回收利用多数对象早死的经验假设。",
  "gc-collectors": "收集器在吞吐量、停顿时间、堆大小和并发开销之间取舍；选择应根据服务 SLO 与目标 JDK 实测，而非只按名字判断。",
  "gc-tuning": "GC 调优先确认分配速率、存活集和停顿分布，再检查堆、晋升及引用持有；先修对象分配/生命周期问题，再调整收集器参数。",
  "runtime-data-area": "程序计数器、Java 栈和本地方法栈线程私有，堆和方法区逻辑上共享；规范中的方法区不等同于 HotSpot 的具体元空间实现。",
  oom: "OOM 是具体内存区域或本地资源耗尽的结果；结合异常类型、堆转储、Native Memory Tracking 和容器限制定位，不要只盲目增大 -Xmx。",
  "memory-leak": "Java 内存泄漏表现为对象仍可达却不再需要；比较堆转储的支配树与 GC 后存活对象，并沿 GC Root 引用链找到长期持有者。",
  "object-layout": "HotSpot 对象通常包括对象头、实例字段与对齐填充，压缩指针和锁状态会改变实际占用；布局是实现细节，应用测量应使用匹配版本工具。",
  "object-allocation": "对象通常在线程本地分配缓冲区快速分配，缓冲不足时走共享分配路径；逃逸分析可能消除分配，不能假定每个 new 都必然落入堆。",
  references: "强引用可达对象不会被 GC 回收；软引用、弱引用和虚引用表达不同可回收/通知语义。缓存宜使用有界策略，不能单靠 SoftReference 控容量。",
  "jvm-troubleshooting": "线程转储看阻塞与死锁，JFR 采集 CPU、分配和锁事件，堆转储看对象保留；先统一时间线、负载和版本再关联证据。",
  database: "关系数据库通过事务和约束维护数据一致性；设计需结合访问模式、索引成本、隔离级别与恢复要求评估。",
  mysql: "MySQL 的 SQL 层负责连接、解析和优化，InnoDB 提供事务、行级锁、缓冲池与崩溃恢复；优化需由执行计划及存储引擎证据支撑。",
  "mysql-basic": "InnoDB 是常用事务引擎并以聚簇索引组织主键数据；字符集、排序规则、NULL 语义和隐式类型转换都会影响查询结果及索引使用。",
  "mysql-select": "MySQL 查询大致经过连接、解析、优化和执行；EXPLAIN 显示访问路径估计，实际耗时还需结合实际行数、等待和慢日志判断。",
  "mysql-row-storage": "InnoDB 聚簇索引叶子页存完整行记录，二级索引叶子记录二级键及主键值；长字段可能溢出页，行格式影响空间与 IO。",
  "mysql-index": "B+Tree 索引按键排序并利用页扇出降低磁盘访问；联合索引遵循最左前缀，回表、选择性、写入成本和覆盖查询都需权衡。",
  "mysql-btree": "B+Tree 内部节点保存分隔键、叶子保存记录定位并按序链接；高扇出让树高较低，范围扫描能顺序遍历相邻叶页。",
  "mysql-explain": "EXPLAIN 的 type、key、rows、filtered、Extra 用于判断访问方式和估算成本；用 ANALYZE 对照实际行数，并验证统计信息与参数类型。",
  "mysql-transaction": "事务通过原子性、一致性、隔离性和持久性定义边界；InnoDB 借助 undo、redo、锁和提交协议实现，长事务会扩大锁与版本保留压力。",
  "mysql-isolation": "隔离级别控制并发事务可见性；InnoDB 常见 RR 通过 MVCC 快照读和锁定读组合降低异常，锁定读仍可能加锁并受索引范围影响。",
  "mysql-mvcc": "ReadView 记录活跃事务边界，按事务 ID 判断版本可见性，undo 链提供旧版本；长事务会阻碍 purge 清理历史版本。",
  "mysql-lock": "InnoDB 锁作用于索引记录及可能的间隙范围；缺少合适索引会扩大扫描和锁范围。通过事务状态、锁等待表和执行计划定位阻塞。",
  "mysql-log": "undo 支持回滚与 MVCC，redo 保障页修改崩溃恢复，binlog 记录逻辑变更用于复制和时间点恢复；刷盘与提交顺序影响持久性保证。",
  "mysql-bufferpool": "Buffer Pool 缓存数据页和索引页并以近似 LRU 管理；脏页由后台刷盘，容量与命中率要和工作集、内存及写入压力共同衡量。",
  redis: "Redis 常将热数据保存在内存中并提供丰富原子命令；高可用和持久化是配置及架构选择，必须评估内存上限、数据丢失窗口和恢复时间。",
  "redis-types": "String、Hash、List、Set、ZSet、Stream 等类型带有不同操作复杂度与原子语义；数据结构应直接表达业务操作并控制单次命令规模。",
  "redis-datastruct": "Redis 按数据规模和操作选择 listpack、hashtable、skiplist 等编码；编码转换阈值是版本实现细节，超大集合需关注 CPU 与内存放大。",
  "redis-arch": "主从复制通常为异步，Sentinel 负责监控和故障转移，Cluster 通过槽分片扩展；切换期间仍可能有写入丢失或短暂不可用。",
  "redis-persistence": "RDB 是时间点快照，AOF 记录写命令且按策略 fsync；二者可组合但会增加磁盘、恢复时间和写放大，应演练真实恢复。",
  "redis-bigkey": "大 Key 会增加单命令延迟、复制和删除开销；用扫描式工具分批发现，拆分数据并采用 UNLINK 或分批处理降低阻塞。",
  "redis-cache": "Cache Aside 常由应用先更新数据库再删除缓存；并发和失败仍可能短暂不一致，需结合 TTL、重试/消息补偿及热点击穿保护。",
  "redis-eviction": "过期时间决定逻辑有效期，淘汰策略在内存达到 maxmemory 时选择牺牲对象；热点 Key 可造成单分片压力，应监控命中率、过期与淘汰量。",
  pg: "PostgreSQL 使用 MVCC 版本可见性并通过 WAL 支撑崩溃恢复；VACUUM 清理死元组，索引、锁和执行计划需按 PostgreSQL 版本验证。",
  framework: "框架通过约定和扩展点管理通用流程；理解生命周期、调用链和默认配置后才能正确覆写行为，避免隐藏的自动化副作用。",
  spring: "Spring 容器通过 BeanDefinition 创建并管理对象，依赖注入连接协作关系；代理、作用域和生命周期回调决定运行时行为。",
  "spring-bean": "Bean 创建包含实例化、属性填充、Aware 回调、初始化和后置处理；构造器循环依赖无法靠早期单例引用化解，应重构依赖方向。",
  "spring-aop": "Spring AOP 通常基于 JDK 动态代理或 CGLIB 子类代理；同类自调用绕过代理，final 类/方法等限制会影响代理方式和增强生效。",
  "spring-transaction": "声明式事务由代理拦截调用；默认运行时异常触发回滚，自调用、非代理入口、错误事务管理器或线程切换都可能导致事务不生效。",
  "spring-mvc": "DispatcherServlet 通过 HandlerMapping 选处理器，再经参数解析、执行、返回值处理和消息转换生成响应；异常解析器处理错误映射。",
  springboot: "自动配置依据 classpath、属性和已有 Bean 等条件装配默认组件；通过条件评估报告与配置覆盖点排查装配差异，而非猜测启动顺序。",
  mybatis: "MyBatis 将 Mapper 调用映射到 SQL 执行及结果映射；动态 SQL 仍须参数化，分页和批量操作要检查生成 SQL 与 JDBC 参数限制。",
  "mybatis-cache": "一级缓存默认与 SqlSession 生命周期关联，二级缓存按 Mapper namespace 配置；跨事务更新可能失效，批量写应控制批次、事务和内存。",
  springcloud: "Spring Cloud 提供服务发现、配置及客户端治理组件；版本需与 Spring Boot release train 匹配，并避免重复实现平台已提供的能力。",
  middleware: "中间件解耦应用并提供消息、缓存或协调能力，但增加独立故障域；设计需明确持久性、容量、升级和故障演练责任。",
  "mq-reliability": "端到端可靠投递需覆盖生产确认、持久化、路由、消费确认和重试；通常依赖至少一次投递加业务幂等，而非假设全链路恰好一次。",
  "mq-idempotency": "以业务唯一键记录消费结果可抑制重复副作用；积压治理要结合生产速率、消费并发、下游限流和毒消息隔离，扩容不应压垮依赖方。",
  kafka: "Kafka 以分区日志和消费者位点扩展吞吐；分区内有序，副本 ISR 与提交策略影响可靠性，消费者并发受分区数限制。",
  rabbitmq: "RabbitMQ 通过 exchange、binding、queue 路由消息；publisher confirm 与 consumer ack 分别确认生产和消费阶段，重投可能导致重复。",
  rocketmq: "RocketMQ 提供主题队列、消费重试和事务消息等机制；顺序范围通常受队列限制，最终一致性仍需检查本地事务和消息状态。",
  microservice: "微服务按独立演进和部署边界拆分，不是按类或表机械拆分；网络调用带来超时、重复和部分失败，领域边界与数据归属是核心。",
  "service-discovery": "服务发现将逻辑服务名解析为健康实例；注册心跳和摘除存在延迟，客户端还需处理缓存过期、连接池更新及摘除期间的失败。",
  "config-center": "配置中心分发带版本的动态配置；关键配置应校验、灰度并支持回滚，密钥使用专门密钥管理并避免明文进入日志。",
  "load-balance": "负载均衡算法需匹配请求成本、会话状态和实例健康；客户端重试应避免跨故障导致放大流量，并设置总超时预算。",
  "rate-limit": "限流限制单位时间内请求量，熔断依据失败信号暂时停止调用；恢复探测需渐进，指标阈值要结合延迟与下游饱和度。",
  "distributed-tx": "分布式事务在一致性与可用性之间取舍；Saga 通过本地事务及补偿推进最终一致，TCC 需实现幂等的 Try/Confirm/Cancel。",
  "distributed-lock": "分布式锁需唯一持有者标识、租约过期和安全释放；暂停客户端可能让过期持有者继续写，关键资源还需 fencing token 防旧持有者。",
  tracing: "Trace/Span 通过上下文传播关联跨服务调用；采样、时钟偏差和异步上下文会影响完整性，追踪数据不应携带敏感信息。",
  logging: "结构化日志使用统一时间、级别、请求关联 ID 和字段；脱敏、采样、保留周期及访问控制共同决定日志的隐私和排障价值。",
  "api-idempotency": "接口幂等键需绑定用户、操作和请求摘要，并对处理中与已完成状态做原子协调；相同键不同请求体应拒绝而非复用结果。",
  "distributed-id": "分布式 ID 方案要权衡趋势递增、唯一性、排序与协调成本；Snowflake 类方案需处理时钟回拨、节点 ID 冲突及序列耗尽。",
  algorithm: "算法题先定义状态与不变量，再证明终止和正确性；复杂度要说明输入规模参数及最坏/均摊口径。",
  "algorithm-array-hash": "哈希表平均 O(1) 查找但消耗额外空间；滑动窗口维护满足条件的最小/最大区间，每次移动都需证明元素不会被错误丢弃。",
  "algorithm-linked-list": "链表双指针可用快慢指针找中点或环；删除节点常需保留前驱，空链表、单节点和环入口是关键边界。",
  "algorithm-tree-graph": "树 DFS 适合递归子结构，BFS 用队列按层遍历；图遍历须用 visited 防环，并区分有向/无向及边权。",
  "algorithm-dp": "动态规划由状态定义、转移方程、初始条件和遍历顺序构成；压缩维度时确认读写方向不会覆盖仍需使用的旧状态。",
  sorting: "稳定排序保持相等元素原始相对次序；比较排序下界为 O(n log n)，快排平均快但最坏 O(n²)，归并排序稳定但需额外空间。",
  leetcode: "高频题复习应按模式归纳并复述正确性证明；重做错题时记录失败边界和复杂度，不能只记题号或背代码。",
  network: "网络分层用于分离语义：应用定义协议交互，传输层处理端到端传输，IP 负责跨网寻址转发，链路层负责本地传送。",
  "network-basics": "TCP/IP 模型按链路、网际、传输和应用组织协议；分层是分析模型，实际封装和协议边界应以抓包为准。",
  "network-request-flow": "输入网址后依次涉及解析 URL、DNS、连接建立、TLS、HTTP 请求响应及浏览器资源处理；缓存、代理与连接复用会改变实际链路。",
  "network-linux-packet": "Linux 收包从网卡 DMA 与中断/NAPI进入协议栈、路由和 socket 队列，发包反向经路由、队列规则和网卡发送；抓包位置会影响观察。",
  "network-dns": "DNS 解析器按缓存和记录类型查询递归/权威服务器；TTL 控制缓存时长，CNAME、负缓存及不同网络视图会改变最终地址。",
  "network-http-interview": "HTTP 是无状态请求响应协议，方法、安全性、幂等性、状态码和缓存语义由规范定义；连接复用不改变应用层请求语义。",
  "network-http-optimization": "HTTP/1.1 性能可用持久连接、压缩、缓存和请求合并改善；浏览器域名分片可能反而增加 DNS/TLS 连接成本。",
  "network-https-rsa": "传统 RSA 密钥交换由客户端加密预主密钥，服务器私钥解密；静态 RSA 不提供前向保密，TLS 1.3 已移除此类套件。",
  "network-https-ecdhe": "ECDHE 双方交换临时椭圆曲线公钥并各自计算共享密钥，服务器用证书签名认证握手；临时密钥支持前向保密。",
  "network-https-optimization": "HTTPS 优化重点是复用连接、合理证书链、TLS 会话恢复和边缘终止；必须保留协议安全配置并测量握手延迟。",
  "network-http2": "HTTP/2 在一个 TCP 连接上多路复用独立流并压缩头部；TCP 丢包会阻塞连接内所有流，协议并不等同于消除队头阻塞。",
  "network-http3": "HTTP/3 将 HTTP 映射到 QUIC，使用 UDP 上的加密多路流减少跨流传输阻塞；部署仍需检查 UDP 可达性与回退路径。",
  "network-rpc": "RPC 将远程调用包装成接口，但网络失败使超时结果可能未知；契约、版本兼容、序列化、幂等与截止时间比传输格式更关键。",
  "network-websocket": "WebSocket 经 HTTP Upgrade 握手后建立全双工帧连接；心跳、背压、重连、鉴权过期和代理超时需由应用管理。",
  "network-tcp": "TCP 提供可靠有序字节流和双向连接，不保留应用消息边界；连接成功也不保证对端业务已处理请求。",
  "network-tcp-handshake": "三次握手交换初始序列号并确认双向可达，挥手分别关闭两个方向；TIME_WAIT 保证旧报文消退并允许最后 ACK 重传。",
  "network-tcp-control": "超时/快速重传处理丢包，接收窗口控制流量，拥塞窗口控制网络负载；发送速率受两者较小值约束。",
  "network-tcp-capture": "抓包按五元组、序列号和 ACK 还原字节流；本机卸载可能造成伪大包，需结合接口位置、TCP 重传和应用日志解释。",
  "network-tcp-queues": "半连接队列保存握手未完成项，全连接队列保存已完成待 accept 项；SYN/accept 队列溢出需分别看内核计数器和应用接收速度。",
  "network-tcp-tuning": "TCP 调优需先确认瓶颈在带宽时延、丢包、socket 缓冲还是应用消费；盲目增大 backlog/缓冲无法替代服务端容量治理。",
  "network-tcp-stream": "TCP read/write 可返回部分字节且一次写不对应一次读；应用协议必须用长度前缀、分隔符或固定长度实现粘包拆包。",
  "network-tcp-failure": "断网或对端崩溃不会让 TCP 瞬间知晓，连接状态可能暂时保持；应用需超时、心跳、幂等重试和请求截止时间。",
  "network-tcp-keepalive": "TCP Keepalive 是内核层空闲连接探测，HTTP Keep-Alive 指连接复用；二者目标、定时器和配置层次不同。",
  "network-udp-reliable": "UDP 只提供数据报传送而不保证到达、顺序或去重；QUIC 在 UDP 上实现加密、可靠流和拥塞控制，不能把 UDP 本身称作可靠。",
  "network-ip-basics": "IP 按路由表逐跳转发数据报，TTL/Hop Limit 防环；MTU 影响分片或路径 MTU 发现，NAT 会改写地址/端口。",
  "network-ping": "ping 用 ICMP Echo 探测往返可达性和时延；过滤 ICMP 不等于目标服务不可用，响应也不代表应用端口健康。",
  "network-loopback": "127.0.0.0/8 与 ::1 在本机协议栈回环，不经过物理网卡；绑定回环地址的服务不会被远端访问。",
  "network-http": "HTTP 方法与状态码具有安全/幂等语义，缓存由 Cache-Control、验证器等控制；HTTP/2、HTTP/3 保留核心语义但改变传输映射。",
  "network-tls": "TLS 通过证书验证服务身份，握手协商密钥和算法，再用对称加密保护记录；证书链、主机名和有效期都需验证。",
  os: "操作系统通过系统调用在用户程序与内核之间提供进程、内存、文件和设备抽象；机制实现能力，策略决定资源分配方式。",
  "os-hardware": "CPU 缓存降低访存延迟，硬件中断通知异步事件，软中断延后处理部分内核工作；高负载需分辨硬中断、软中断与线程上下文。",
  "os-cpu-cache": "时间局部性和空间局部性让缓存行提升访问效率；连续访问通常利于预取，工作集超过缓存时会出现容量与冲突缺失。",
  "os-cache-coherence": "缓存一致性协议协调多核对同一缓存行的状态，但不同变量共享一行会产生伪共享；填充/隔离热点字段可减少失效通信。",
  "os-system-structure": "Linux 采用单体内核加模块化扩展，Windows NT 使用混合内核结构；比较应看调度、驱动、权限和 API 契约而非简单标签。",
  "os-memory": "虚拟地址经页表映射到物理页，缺页异常可按需分配或从存储调入；TLB 缓存地址转换，权限位保护隔离。",
  "os-memory-allocation": "malloc 管理用户态堆并可能向内核申请/映射页；释放给分配器不等于立刻归还 OS，碎片和分配器策略影响 RSS。",
  "os-memory-pressure": "内存压力时内核回收页缓存、换出匿名页或触发 OOM；容器 cgroup 限额可能先于主机内存耗尽，需看 PSI 与 cgroup 指标。",
  "os-cache-lru": "LRU 根据最近访问估计未来热度，真实缓存会用近似算法降低维护开销；预读能改善顺序 IO，也可能污染工作集。",
  "os-process": "进程提供资源隔离，线程共享进程地址空间；调度器按策略分配 CPU 时间片，阻塞、可运行和运行状态要由工具证据判断。",
  "os-process-ipc": "管道、共享内存、消息队列和 socket 提供不同 IPC 语义；共享内存吞吐高但需自行同步，socket 可跨主机但有协议开销。",
  "os-thread-sync": "互斥锁保护临界区，条件变量需在循环中检查谓词并与锁配合；原子操作适合小状态，竞态可由 ThreadSanitizer 等工具发现。",
  "os-deadlock": "死锁可用资源分配图和锁顺序分析；统一加锁顺序或减少嵌套能预防循环等待，超时与监控帮助发现但不自动保证安全。",
  "os-locks": "悲观锁先互斥再操作，乐观锁先执行并在提交时校验冲突；冲突率高时自旋/重试成本可能超过阻塞锁。",
  "os-scheduling": "CPU 调度优化公平性和响应性，页面置换平衡缺页与内存使用，磁盘调度兼顾吞吐和等待；各策略目标不可混为一种算法。",
  "os-file-system": "目录将名称映射到 inode，inode 保存元数据和数据块引用；硬链接共享 inode，文件名删除后只在链接数及打开引用归零时释放。",
  "os-page-cache": "Page Cache 缓存文件数据，写入通常先进入缓存再异步回写；fsync 提供持久化请求语义，仍受文件系统和设备保证影响。",
  "os-device": "设备驱动将统一内核接口映射为硬件操作；中断、轮询和 DMA 协作完成输入输出，权限与设备节点控制用户访问。",
  "os-io": "阻塞 IO 等待操作完成，非阻塞 IO 立即返回状态，IO 多路复用等待多个描述符就绪；就绪通知后读写仍可能部分完成。",
  "os-zero-copy": "零拷贝减少用户态与内核态之间复制次数，但页引用、协议栈和设备能力决定具体效果；需测 CPU、吞吐和延迟。",
  "os-reactor": "Reactor 在 IO 就绪时分发事件并由应用执行读写，Proactor 通知已完成操作；语言运行时/系统 API 的实际模型需看平台实现。",
  "os-consistent-hash": "一致性哈希把节点和键映射到环上，节点变化主要影响邻近区间；虚拟节点改善负载均衡，但扩容迁移仍需控制成本。",
  "linux-troubleshooting": "Linux 排障先用 CPU、内存、IO、网络四类饱和度指标定位，再关联进程、容器和请求时间线；采样工具与指标需匹配问题层级。",
  "linux-network-metrics": "网络排障看吞吐、丢包、重传、RTT、连接队列和 socket 内存；接口总量无法替代按连接、进程与时间段分解。",
  "linux-log-analysis": "PV 统计页面/请求次数，UV 统计去重访客标识；口径、时区、机器人过滤和采样规则必须明确，不能将匿名 ID 直接等同真实用户。",
  ai: "AI 应用由模型能力、数据上下文和产品约束共同决定；效果要用目标任务评测集衡量，并为不确定输出设置核验与人工接管路径。",
  "ai-basics": "语言模型根据上下文生成概率分布下的后续 token，不具备天然事实保证；提示、采样参数和上下文都会影响输出。",
  "ai-models": "模型选型比较任务质量、上下文长度、延迟、成本、数据驻留与工具能力；用代表性测试集实测，并为超时和配额失败设计降级。",
  "ai-mcp": "MCP 定义客户端与服务器间发现工具/资源及调用的协议；工具调用需要显式授权、参数校验和最小权限，协议连接本身不代表可信。",
  "ai-rag": "RAG 检索相关片段注入上下文以提升可追溯性；切分、召回、重排和引用核验共同影响效果，检索失败仍需允许拒答。",
  "ai-finetune": "微调更新模型参数以适配行为或格式，不等同于可靠注入新事实；应先评估提示/检索方案，再使用高质量数据验证泛化和遗忘。",
  "ai-frameworks": "编排框架提供模型、检索器和工具适配抽象；生产系统应观察生成的提示、重试和网络调用，并防止框架默认行为隐藏成本。",
  "ai-agent": "Agent 通过模型决策循环选择工具并观察结果；需限制步数、权限、预算和副作用，关键操作采用人工确认与可审计执行。",
  "ai-tools": "AI 编程工具输出需像外部贡献一样经过代码审查、测试和依赖/许可证检查；不得向未批准服务发送密钥或敏感源代码。"
});

function createQuestion(category) {
  const reference = referenceFor(category.id);
  const family = topicFamily(category.id);
  return {
    id: "seed-" + category.id + "-1",
    categoryId: category.id,
    sourceNodeId: category.id,
    question: `请围绕「${category.name}」说明核心概念、工作机制、适用边界，并给出一种验证或排障方法。`,
    answer: `【核心结论】${SPECIFIC_ANSWERS[category.id] || "先明确核心对象、输入输出与适用边界，再用官方规范或实现文档核实版本相关细节。"}\n\n【考察范围】本题围绕「${category.name}」。说明它在上级知识域中的位置、要解决的问题和关键输入/状态；不要只报 API 或工具名称。\n\n【回答主线】${ANSWER_GUIDES[family]}\n\n【面试表达】先给结论，再按“问题定义 → 机制/执行路径 → 代价与边界 → 验证证据”展开。针对具体项目补充版本、数据规模、并发量和故障现象；若实现会因版本或配置变化，应明确前提并查阅下方规范。\n\n【复习自检】能否画出关键状态变化？能否给出一个失败案例？能否说明用什么指标或测试验证？`,
    tags: [category.name, category.core ? "核心考点" : "复习"],
    sources: [{ title: reference.title, url: reference.url }],
    origin: "builtin"
  };
}

function main() {
  const previous = JSON.parse(fs.readFileSync(CATEGORIES_PATH, "utf8"));
  if (previous.version !== 1 || !Array.isArray(previous.categories) || previous.categories.length !== 183) {
    throw new Error("Expected the established set of 183 category IDs.");
  }
  const missingAnswers = previous.categories.filter(category => !SPECIFIC_ANSWERS[category.id]);
  if (missingAnswers.length) throw new Error(`Missing topic-specific answers: ${missingAnswers.map(category => category.id).join(", ")}`);
  const questions = previous.categories.map(createQuestion);
  const output = {
    version: 1,
    contentLicense: "CC-BY-4.0",
    categories: previous.categories,
    questions
  };
  fs.writeFileSync(OUTPUT_PATH, JSON.stringify(output, null, 2) + "\n", "utf8");
  process.stdout.write(JSON.stringify({ categories: output.categories.length, questions: questions.length, outputPath: OUTPUT_PATH }) + "\n");
}

main();
