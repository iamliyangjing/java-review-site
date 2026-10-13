// Review notes for multithreading + JVM nodes. Detailed notes for core nodes,
// placeholders for secondary nodes (filled by the content task).
window.NOTES = Object.assign({}, window.NOTES, {
  // ---- 多线程 ----
  "multithreading": {
    "core": true,
    "summary": "Java 并发编程的核心模块，覆盖线程模型、内存模型、锁机制与并发工具类，是 Java 面试最高频考点。",
    "points": [
      "知识地图：线程/JMM → volatile/锁 → CAS/AQS → ThreadLocal → 线程池 → 异步编排与虚拟线程。",
      "核心问题：可见性（volatile）、原子性（synchronized/CAS/Atomic）、有序性（happens-before）三大特性如何保证",
      "机制边界：内置监视器、显式锁与 CAS 各有用途，不能画成必须依次替换的路线；偏向锁是有版本限制的历史优化。",
      "并发工具分类：锁（ReentrantLock）、同步器（Semaphore/CountDownLatch/CyclicBarrier）、容器（ConcurrentHashMap）、线程池",
      "线程池参数：corePoolSize、maximumPoolSize、keepAliveTime、unit、workQueue、threadFactory、handler，共七项。",
      "生产常见坑：线程池队列满导致拒绝、ThreadLocal 内存泄漏、ConcurrentHashMap 在 JDK7/8 的差异",
      "模拟题：volatile、原子类和锁怎样选择？线程池队列满时应如何保护下游？",
      "面试话术：先讲并发三大特性，再按\"锁 → 同步器 → 容器 → 线程池\"主线展开，最后结合项目中的线程池和并发容器实践"
    ],
    "status": "ready"
  },
  "thread-intro": {
    core: true,
    summary: "线程是操作系统调度的最小单元，Java 中通过 Thread 类实现，理解生命周期与创建方式是最基础的要求。",
    points: [
      "线程与进程：进程是资源分配最小单元，线程是 CPU 调度最小单元，同进程线程共享堆和方法区",
      "创建方式：继承 Thread、实现 Runnable、实现 Callable（有返回值）、线程池 ExecutorService",
      "生命周期 6 态：NEW → RUNNABLE（含 RUNNING+READY）→ BLOCKED → WAITING → TIMED_WAITING → TERMINATED",
      "wait/notify vs sleep：wait 释放锁且需在同步块中，sleep 不释放锁",
      "start() vs run()：start 创建新线程执行 run，直接调 run 是当前线程执行",
      "线程安全三要素：原子性、可见性、有序性；volatile 解决可见性和有序性，不保证原子性",
      "面试话术：先答 6 态转换图，再对比创建方式和 wait/sleep 区别，强调 start 与 run 的差异"
    ],
    status: "ready"
  },
  "jmm": {
    "core": true,
    "summary": "Java 内存模型规定共享变量访问与同步的可见性规则。它是语言规范中的抽象，不等同于 JVM 的堆栈划分。",
    "points": [
      "知识地图：共享变量 → 数据竞争 → happens-before → 安全发布。",
      "核心原理：happens-before 关系建立时，前面的写入结果对后续相关操作可见；没有同步关系时不能靠时间先后推断可见性。",
      "面试重点：程序顺序、同一监视器解锁到后续加锁、volatile 写到后续读、线程 start/join 与传递性。",
      "实战避坑：共享字段与局部变量不能混为一谈；sleep 没有同步语义，final 的构造语义也不代表对象全部状态永远线程安全。",
      "模拟题：一个线程写普通布尔字段，另一个线程循环 sleep 读取，为什么可能一直看不到更新？",
      "面试话术：我以共享字段和 happens-before 解释可见性，再用安全发布或锁建立明确的同步关系。"
    ],
    "status": "ready"
  },
  "volatile": {
    "core": true,
    "summary": "volatile 建立特定的可见性与顺序约束，但不能把一组读改写变成原子操作。选择它需要分析状态更新的完整过程。",
    "points": [
      "知识地图：volatile 读写 → happens-before → 重排约束 → 复合操作。",
      "核心原理：对 volatile 字段的写与后续相关读建立同步关系，使写之前的操作结果按内存模型规则可见。",
      "面试重点：i++ 涉及读、计算和写，多线程仍可丢失更新；DCL 单例需要 volatile 配合正确构造与发布。",
      "实战避坑：硬件实现因平台而异，不能说所有 volatile 都依靠同一条 lock 指令；也不能概括为仅适用于单写多读。",
      "模拟题：一个 volatile 引用指向普通 ArrayList，列表操作是否因此线程安全？",
      "面试话术：我先解释发布和可见性，再分析有没有复合更新与对象内部可变状态，决定是否需要原子类或锁。"
    ],
    "status": "ready"
  },
  "synchronized": {
    "core": true,
    "summary": "synchronized 提供可重入互斥与监视器同步语义。对象头、轻量级路径等实现随 HotSpot 版本演进。",
    "points": [
      "知识地图：锁对象 → monitor → wait/notify → 版本差异。",
      "核心原理：实例方法锁 this，静态方法锁对应 Class 对象，代码块锁指定对象；同一监视器解锁与后续加锁建立同步关系。",
      "面试重点：wait 释放持有的监视器并进入等待，notify 不会立即释放锁，被通知线程仍需重新竞争。",
      "版本边界：JDK 15 起默认禁用偏向锁；旧版的偏向/轻量/重量锁路线不应被当成现代 JDK 必然发生的固定过程。",
      "实战避坑：可重入不会阻止多个锁形成死锁；wait 放入条件循环，避免锁可变引用、公共字符串或范围过大的对象。",
      "模拟题：两个 synchronized 实例方法为何不一定互斥？notify 后等待线程为何不能立刻继续？",
      "面试话术：我先确定是否锁同一个对象，再说明监视器和条件等待，最后标明实现细节所对应的 JDK 版本。"
    ],
    "status": "ready"
  },
  "cas-atomic": {
    core: true,
    summary: "CAS（Compare And Swap）是无锁并发的基础，通过 Unsafe 的底层原子指令实现，Atomic 包基于它构建。",
    points: [
      "CAS 原理：比较内存值是否等于期望值，相等则更新为新值，不相等则自旋重试（乐观锁思想）",
      "Unsafe 魔法类：sun.misc.Unsafe 提供 compareAndSwapInt 等 native 方法，直接操作内存地址",
      "Atomic 包：AtomicInteger/AtomicLong/AtomicReference/AtomicStampedReference 等基于 CAS 封装",
      "ABA 问题：值被改为 A→B→A，CAS 无法察觉；解决用 AtomicStampedReference（版本号）",
      "自旋开销：高竞争下 CAS 自旋浪费 CPU，LongAdder 通过分段累加降低竞争",
      "CAS vs synchronized：CAS 无锁无阻塞适合短临界区，synchronized 适合长临界区或复杂操作",
      "面试话术：讲 CAS 三步原理，提 ABA 问题及解决方案，对比乐观锁/悲观锁，最后说 LongAdder 优化"
    ],
    status: "ready"
  },
  "aqs-reentrantlock": {
    core: true,
    summary: "AQS（AbstractQueuedSynchronizer）是 JUC 锁的基石，ReentrantLock 通过 state + CLH 队列实现独占锁。",
    points: [
      "AQS 核心：volatile int state + FIFO 双向队列（CLH 变体），子类通过 tryAcquire/tryRelease 定义获取/释放逻辑",
      "ReentrantLock 结构：继承 AQS，内部 Sync 分 FairSync（公平）和 NonfairSync（非公平），默认非公平",
      "可重入实现：state 累加计数，同线程重入 state+1，释放 state-1，减到 0 才真正释放",
      "lock 流程：CAS 尝试 state 0→1 成功则持有；失败入队（enq 自旋 CAS 建队），前驱释放后 unpark 唤醒",
      "Condition 实现：ConditionObject 维护条件队列，await 释放锁入条件队列，signal 移到同步队列",
      "synchronized vs ReentrantLock：可中断、可超时、公平锁、多个 Condition、更细粒度控制",
      "面试话术：画 AQS 结构图（state + 队列），讲获取/释放流程，再对比 ReentrantLock 与 synchronized 五处差异"
    ],
    status: "ready"
  },
  "aqs-shared": {
    "core": true,
    "summary": "AQS 共享模式通过 state 允许多个线程同时获取，Semaphore 与 CountDownLatch 是典型实现。",
    "points": [
      "共享/独占描述获取协议，并不规定 state 只能取什么值；ReentrantLock 的 state 可表示重入次数，Semaphore 表示许可数，Latch 表示剩余计数。",
      "Semaphore 原理：state 初始为许可数，acquire 时 CAS state-1（不足则入队等待），release 时 state+1 唤醒",
      "CountDownLatch 原理：state 初始为计数 N，countDown 使 state-1，减到 0 时唤醒所有 await 线程",
      "tryAcquireShared 返回值：正数=成功且还有剩余，0=成功但无剩余，负数=失败需入队",
      "公平/非公平：Semaphore 支持 FairSync 与 NonfairSync，公平模式先检查队列是否有等待者",
      "CountDownLatch vs CyclicBarrier：前者一次性不可复用，后者可循环复用且可带回调",
      "实战避坑：释放许可放在成功获取后的 finally 路径，避免误释放或许可泄漏。",
      "模拟题：Semaphore 与 CountDownLatch 的 state 为什么含义不同？",
      "面试话术：讲共享模式 state 语义，分别说明 Semaphore 和 CountDownLatch 的 acquire/release 流程"
    ],
    "status": "ready"
  },
  "threadlocal": {
    core: true,
    summary: "ThreadLocal 为每个线程提供独立的变量副本，通过 Thread 内部 ThreadLocalMap 实现线程隔离。",
    points: [
      "原理：每个 Thread 持有 ThreadLocalMap，key 是 ThreadLocal 弱引用，value 是线程私有副本",
      "get/set 流程：Thread.currentThread() 取 ThreadLocalMap，以当前 ThreadLocal 为 key 存取",
      "内存泄漏问题：key 是弱引用会被回收，value 强引用残留导致泄漏；ThreadLocal 用完必须 remove()",
      "线程池场景：线程复用导致 ThreadLocal 值串用，使用后务必 remove 清理",
      "继承问题：子线程默认不继承父线程值；InheritableThreadLocal 可传递（创建子线程时拷贝）",
      "应用场景：保存用户上下文、数据库连接、SimpleDateFormat 线程安全化",
      "面试话术：画 ThreadLocalMap 结构，讲弱引用 key 与内存泄漏原理，强调 remove 和线程池清理"
    ],
    status: "ready"
  },
  "futuretask": {
    "core": true,
    "summary": "FutureTask 包装 Callable/Runnable 实现异步结果获取，CompletableFuture 提供更强大的异步编排能力。",
    "points": [
      "Runnable.run 无返回值且不声明受检异常，但仍可抛出 RuntimeException/Error；Callable.call 有返回值且可声明受检异常。",
      "FutureTask 原理：内部用 CAS 维护 state（NEW→COMPLETING→NORMAL/CANCELLED），get() 阻塞等待结果",
      "Future.get() 阻塞问题：会阻塞调用线程，需用 get(timeout) 或轮询 isDone 避免无限等待",
      "CompletableFuture 优势：链式回调（thenApply/thenAccept）、组合（thenCombine）、异常处理（exceptionally）",
      "CompletableFuture 默认线程池 ForkJoinPool.commonPool，可显式传入线程池避免饥饿",
      "异步编排案例：并行调多个接口后聚合结果，thenCombine 或 allOf + join",
      "实战避坑：超时完成或 CompletableFuture.cancel 不代表所有底层业务必然停止；显式传入合适执行器并设计下游超时。",
      "模拟题：使用 submit 后任务异常如何观察？allOf 后某个子任务失败时如何处理？",
      "面试话术：对比 Runnable/Callable/Future，说 FutureTask 状态机，重点讲 CompletableFuture 的 thenApply/thenCombine/exceptionally"
    ],
    "status": "ready"
  },
  // ---- JVM ----
  "jvm": {
    core: true,
    summary: "JVM 是 Java 跨平台的基石，面试重点覆盖内存划分、类加载、执行引擎与垃圾回收四大子系统。",
    points: [
      "四大子系统：类加载子系统、运行时数据区、执行引擎、垃圾回收子系统",
      "跨平台原理：字节码 + JVM 屏蔽操作系统差异，一次编译到处运行",
      "主流虚拟机：HotSpot（默认）、OpenJ9、GraalVM（支持 AOT 编译）",
      "调优入口：-Xms/-Xmx 堆大小、-XX:NewRatio 新生代比例、-XX:+UseG1GC 选择收集器",
      "面试话术：按\"内存划分 → 类加载 → GC\"三段式回答，配合线上 JVM 调优经验"
    ],
    status: "ready"
  },
  "jvm-memory": {
    "core": true,
    "summary": "运行时数据区分为线程共享的堆与方法区，线程私有的虚拟机栈、本地方法栈与程序计数器。",
    "points": [
      "堆存放对象实例；具体的分代和分区模型依收集器及 JDK 版本而定，不是所有配置都固定采用 Eden/Survivor/老年代布局。",
      "方法区是规范概念；HotSpot JDK 8+ 使用本地内存元空间存放类元数据，Class 镜像及静态引用等还涉及堆内对象。",
      "虚拟机栈（VM Stack）：每线程一个，栈帧含局部变量表、操作数栈、动态链接、返回地址",
      "本地方法栈（Native Method Stack）：服务 native 方法",
      "程序计数器描述当前执行位置；执行 native 方法时该值按规范为未定义，此区域没有规范定义的 OutOfMemoryError 条件。",
      "运行时常量池与字符串常量池应区分；前者属于方法区概念，HotSpot JDK 7 起字符串池位于堆，并非整个运行时常量池都搬到堆。",
      "模拟题：元空间位于堆外，为什么增加 Xmx 不一定解决 Metaspace OOM？",
      "面试话术：画内存分区图，区分线程共享/私有，说明各区域 OOM 场景（栈溢出 StackOverflowError 等）"
    ],
    "status": "ready"
  },
  "classloader": {
    "core": true,
    "summary": "类加载子系统负责将字节码加载到 JVM，包含加载、连接、初始化等阶段与双亲委派机制。",
    "points": [
      "加载过程五阶段：加载 → 验证 → 准备 → 解析 → 初始化（连接=验证+准备+解析）",
      "加载阶段获取字节码并创建运行时类型表示；HotSpot 的类元数据与代表该类型的堆内 Class 对象应区分。",
      "验证（Verification）：校验字节码格式、语义正确性，防止恶意代码",
      "准备（Preparation）：为类变量（static）分配内存并设默认值，final 常量直接赋值",
      "解析（Resolution）：将符号引用替换为直接引用（类、字段、方法、接口等）",
      "初始化（Initialization）：执行静态代码块和 static 变量赋值，触发条件：new、反射、静态访问等 6 种",
      "模拟题：同名类被两个不同加载器定义，为什么可能出现无法转换类型？",
      "面试话术：按加载→验证→准备→解析→初始化顺序讲，重点区分准备阶段默认值与初始化阶段赋值"
    ],
    "status": "ready"
  },
  "classloader-process": {
    "core": true,
    "summary": "类加载过程是类从字节码到可执行 Class 对象的完整生命周期，初始化时机由主动引用触发。",
    "points": [
      "加载方式：启动类加载器加载 JDK 核心类，也可通过自定义 ClassLoader.findClass/defineClass",
      "验证细节：文件格式验证（魔数 CAFEBABE）、元数据验证、字节码验证、符号引用验证",
      "准备 vs 初始化：static int x = 10 在准备阶段 x=0，初始化阶段才赋值为 10",
      "初始化由规范规定的主动使用触发，如 new、访问声明该字段/方法的类的静态成员、特定反射操作和初始化子类；常量、数组引用等有不同规则，不应把重复列举当作固定六项。",
      "被动引用不初始化：访问 final 常量、通过数组引用类、引用父类静态字段只初始化父类",
      "卸载：类加载器和类的 Class 对象都可被回收，需满足无引用且无实例（自定义加载器场景）",
      "模拟题：子类引用父类的静态字段时，到底初始化哪一个类？",
      "面试话术：先答五阶段，再用 static 变量例子区分准备/初始化，最后答主动 vs 被动引用"
    ],
    "status": "ready"
  },
  "classloader-parents": {
    "core": true,
    "summary": "双亲委派机制保证类加载的唯一性与安全性，自底向上委派、自顶向下加载。",
    "points": [
      "版本边界：JDK 8 常见 Bootstrap/Ext/App；JDK 9+ 引入模块与 PlatformClassLoader，rt.jar 与扩展目录模型不能直接套用。",
      "委派流程：先问父加载器能否加载，父不能才自己加载；避免重复加载与核心类被篡改",
      "保证核心类安全：java.lang.String 一定由 Bootstrap 加载，防止自定义 String 混入",
      "破坏场景一：JDBC 的 ServiceLoader 需要反向委派，用线程上下文类加载器（SPI）解决",
      "破坏场景二：热部署/OSGi 自定义加载器按需隔离",
      "Class.forName vs loadClass：前者默认初始化类，后者默认不初始化（延迟加载）",
      "实战避坑：双亲委派是常见加载器实现策略，应结合具体加载器和模块规则分析，不把它当作全部加载器必须遵守的语言规则。",
      "模拟题：为什么类名相同仍不一定是同一个类型？",
      "面试话术：画委派流程图，讲 3 个加载器职责，重点说 JDBC SPI 为什么破坏双亲委派"
    ],
    "status": "ready"
  },
  "jit": {
    "core": true,
    "summary": "JIT 即时编译将热点代码编译为本地机器码，结合分层编译与逃逸分析提升执行性能。",
    "points": [
      "解释执行 vs JIT：解释器逐行翻译慢启动快，JIT 编译热点代码后快启动慢",
      "热点检测：基于计数器（方法调用计数器 + 回边计数器），达到阈值触发编译（默认 -XX:CompileThreshold）",
      "分层编译（C1/C2）：C1 客户端编译器快速优化，C2 服务端编译器激进优化，HotSpot 默认分层",
      "逃逸分析可支持标量替换、锁消除等优化；HotSpot 中不应把对象不逃逸直接等同于对象实体一定在栈上分配。",
      "AOT（GraalVM）：提前编译为机器码，启动更快但牺牲动态优化",
      "CodeCache 存放编译代码；接近容量上限可能影响后续编译和执行表现，排查需结合编译、去优化与代码缓存指标。",
      "实战避坑：先通过 JFR、编译日志或基准测试验证热点，避免以微基准推断全部业务场景。",
      "模拟题：为什么不能从源码中一个 new 判断最终是否存在对应堆对象？",
      "面试话术：讲解释器 vs JIT 取舍，热点检测与分层编译，提逃逸分析三种优化"
    ],
    "status": "ready"
  },
  "gc": {
    "core": true,
    "summary": "垃圾回收子系统自动管理堆内存，核心是对象存活判定、回收算法与收集器选择。",
    "points": [
      "对象存活判定：可达性分析（GC Roots 遍历），引用计数法有循环引用缺陷已被放弃",
      "GC Roots：虚拟机栈局部变量、静态变量、常量引用、本地方法栈引用、JNI 引用、同步锁对象",
      "回收算法：标记-清除（碎片）、复制（新生代）、标记-整理（老年代）、分代收集",
      "版本边界：CMS/ParNew 主要用于旧版知识对比，CMS 在 JDK 14 移除；现代复习重点是 Parallel、G1 与适用版本的 ZGC。",
      "STW（Stop The World）：GC 时暂停业务线程，任何收集器都无法完全避免，目标是缩短停顿",
      "调优目标：按业务吞吐、停顿与内存预算权衡；先检查分配速率、存活对象和日志，不统一套用新生代比例或只追求减少 Full GC。",
      "模拟题：服务延迟变高但没有 Full GC，可能与哪些分配、年轻代或并发周期指标有关？",
      "面试话术：先答存活判定，再答三种基础算法优缺点，最后按收集器组合讲并提 G1 与 STW"
    ],
    "status": "ready"
  },
  "gc-algorithms": {
    "core": true,
    "summary": "三种基础回收算法各有优劣，分代收集是 HotSpot 的实践组合，G1/ZGC 引入分区与并发回收。",
    "points": [
      "标记-清除（Mark-Sweep）：标记存活对象后清除未标记的，产生内存碎片，适合老年代",
      "复制（Copying）：将存活对象复制到另一半，无碎片但浪费一半空间，适合存活率低的新生代",
      "标记-整理（Mark-Compact）：标记后向一端移动存活对象，无碎片但移动成本高，适合老年代",
      "分代收集：新生代对象朝生夕灭用复制，老年代存活率高用标记-整理/CMS 标记-清除",
      "传统分代配置中的 Eden/Survivor 比例是实现及参数选择；不能把 8:1:1 视为所有现代收集器的固定内存布局。",
      "G1 分区：堆划分为多个 Region，按 Region 回收，可达预期停顿（-XX:MaxGCPauseMillis）",
      "模拟题：为什么一个存在大量长寿命对象的系统，不能仅靠放大新生代解决停顿？",
      "面试话术：讲三种算法优缺点对比表，说明为何新生代用复制老年代用整理，最后提 G1 Region 与停顿模型"
    ],
    "status": "ready"
  },
  "gc-collectors": {
    "core": true,
    "summary": "收集器选型是在吞吐、停顿与内存开销之间权衡。需要先注明目标 JDK 和业务指标。",
    "points": [
      "知识地图：Serial/Parallel → G1 → ZGC → 历史 CMS。",
      "核心原理：Parallel 侧重吞吐，G1 使用 Region 与回收收益选择，ZGC 通过并发机制降低停顿；各自仍有资源与暂停成本。",
      "版本边界：CMS 在 JDK 14 移除；不同版本的 ZGC 分代实现和可用开关需要查目标版本文档。",
      "面试重点：G1 的停顿目标是目标值而非硬性实时保证；混合回收与 Full GC 的触发和成本应区分。",
      "实战避坑：不能只凭堆大小或一句低延迟决定收集器；在相同负载下比较尾延迟、CPU、占用与分配表现。",
      "模拟题：为延迟敏感服务选择 G1 或 ZGC，你需要采集什么数据？",
      "面试话术：我先明确服务目标和 JDK 版本，再比较吞吐、停顿与内存代价，用压测验证选择。"
    ],
    "status": "ready"
  },
  "runtime-data-area": {
    core: true,
    summary: "运行时数据区是 JMM 的具体实现，五块区域的分工与异常场景（OOM/StackOverflow）是高频考点。",
    points: [
      "堆 OOM：-Xmx 设置过小或内存泄漏，报 java.lang.OutOfMemoryError: Java heap space",
      "栈溢出：递归过深或栈帧过大，报 StackOverflowError（-Xss 调栈大小）",
      "方法区/元空间 OOM：动态生成类过多（如 CGLIB 代理），元空间默认无上限受本地内存约束",
      "线程私有 vs 共享：栈/PC/本地方法栈私有，堆/方法区共享",
      "堆内存监控：jstat/jmap/jvisualvm 定位 OOM，MAT 分析堆转储（-XX:+HeapDumpOnOutOfMemoryError）",
      "字符串常量池：JDK7 移到堆，大量 intern() 调用可能导致堆 OOM",
      "面试话术：画五区图，逐个说 OOM 场景与排查命令（jps/jmap/jstack），强调 HeapDump 分析"
    ],
    status: "ready"
  },
  "oom": {
    "core": true,
    "summary": "OOM 需要按实际报错区域和进程资源约束定位。StackOverflowError、Java 内存不足与容器 OOM kill 不能混为一谈。",
    "points": [
      "知识地图：堆 → 元空间 → 直接内存 → 线程/本地内存 → 容器限制。",
      "核心原理：heap space、Metaspace、Direct buffer memory 等错误指向不同容量与生命周期；无法创建 native thread 还可能涉及系统限制。",
      "面试重点：区分正常业务容量增长与泄漏；分析存活对象、保留大小及 GC Roots，而不是只看对象数量。",
      "实战避坑：优先使用目标 JDK 支持的 jcmd 子命令和监控；增大 Xmx 可能挤压本地内存，转储还需评估暂停与磁盘成本。",
      "模拟题：堆占用低而容器被杀，如何排查？内存泄漏与业务缓存增长怎样区别？",
      "面试话术：我先定位报错及资源边界，再用指标与转储寻找保留路径，验证容量或生命周期修复。"
    ],
    "status": "ready"
  },
  "references": {
    "core": true,
    "summary": "强、软、弱、虚引用影响对象可达性与引用处理。回收和通知发生时机不能当作业务确定性保证。",
    "points": [
      "知识地图：强可达 → 软/弱可达 → 虚引用 → ReferenceQueue。",
      "核心原理：对象只有仍被强引用链从 GC Roots 可达时才不会因不可达而回收；拥有过强引用不意味着永远不回收。",
      "面试重点：软引用可在内存压力下清除，弱引用在对象仅弱可达时可被清除；虚引用的 get 返回 null，需配合队列处理。",
      "实战避坑：GC 不一定扫描或处理你关心的对象，不能保证下一次任意 GC 就清除弱引用；队列通知不是外部资源已释放的证明。",
      "模拟题：ThreadLocal 的 key 是弱引用，为什么 value 仍可能造成内存泄漏？",
      "面试话术：我以可达性层次解释引用处理，再强调资源应显式关闭，不能靠 GC 时机保证业务逻辑。"
    ],
    "status": "ready"
  },
  // ---- JVM 次要节点（待补充） ----
  "jvm-types": { core: false, summary: "", points: [], status: "pending" },
  "classloader-context": { core: false, summary: "", points: [], status: "pending" },
  "execution-engine": { core: false, summary: "", points: [], status: "pending" },
  "dispatch": { core: false, summary: "", points: [], status: "pending" },
  "gc-tuning": { core: false, summary: "", points: [], status: "pending" },
  "memory-leak": { core: false, summary: "", points: [], status: "pending" },
  "object-layout": { core: false, summary: "", points: [], status: "pending" },
  "object-allocation": { core: false, summary: "", points: [], status: "pending" }
});