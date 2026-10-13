// Review notes for database module nodes. Detailed notes for core nodes,
// placeholders for secondary nodes (filled by the content task).
window.NOTES = Object.assign({}, window.NOTES, {
  "database": {
    core: true,
    summary: "数据库是后端面试核心板块，关系型（MySQL）与非关系型（Redis）两大体系需要成体系复习。",
    points: [
      "知识地图：MySQL 执行流程 → 索引（B+树）→ 事务/隔离级别 → 锁 → 日志 → Buffer Pool；Redis 数据类型 → 数据结构 → 持久化 → 高可用架构",
      "MySQL 高频：索引失效场景、为什么用 B+树、MVCC 原理、隔离级别如何解决并发问题",
      "Redis 高频：五大数据类型应用场景、为什么快（内存+单线程+IO 多路复用）、缓存穿透/击穿/雪崩",
      "面试话术：先答 MySQL 一条 SQL 执行流程建立全局观，再深入索引和事务；Redis 先讲数据类型再讲底层结构"
    ],
    status: "ready"
  },
  "mysql": {
    core: true,
    summary: "MySQL 是关系型数据库标杆，InnoDB 引擎的索引、事务、锁、日志与内存架构是面试核心。",
    points: [
      "存储引擎：InnoDB（默认，支持事务/行锁/外键）、MyISAM（表锁、不支持事务，已边缘化）",
      "InnoDB 架构：Buffer Pool（内存缓存）→ 磁盘；redo log 保证持久性，undo log 保证原子性",
      "行格式：COMPACT 等，记录头 + 变长字段长度列表 + NULL 值列表 + 数据；页默认 16KB",
      "一条 SQL 的旅程：连接器 → 查询缓存（已废弃）→ 解析器 → 优化器 → 执行器 → 存储引擎",
      "binlog（Server 层）vs redo log（InnoDB 层）：前者逻辑日志用于主从复制，后者物理日志用于崩溃恢复",
      "两阶段提交：redo log prepare → binlog → redo log commit，保证两份日志一致",
      "面试话术：先讲 SQL 执行流程，再讲 InnoDB 架构（Buffer Pool + 日志），重点说 redo/binlog 两阶段提交"
    ],
    status: "ready"
  },
  "mysql-select": {
    core: true,
    summary: "一条 SELECT 语句的执行链路贯穿连接器、解析器、优化器、执行器与存储引擎，是理解 MySQL 的总纲。",
    points: [
      "连接器：TCP 三次握手建立连接，校验用户名密码，管理连接与权限",
      "查询缓存：MySQL 8.0 已移除；命中即返回，但任何表更新都会失效，弊大于利",
      "解析器：词法分析拆 token，语法分析构建语法树，校验语法错误",
      "优化器：决定用哪个索引、多表连接顺序，生成执行计划（explain 看到的就是它）",
      "执行器：先判断权限，调用存储引擎接口逐行取数，返回结果集",
      "存储引擎层：InnoDB 通过索引树定位数据，读 Buffer Pool 缓存或磁盘",
      "面试话术：按\"连接器→解析器→优化器→执行器\"顺序讲，点明查询缓存已废弃，最后用 explain 验证执行计划"
    ],
    status: "ready"
  },
  "mysql-index": {
    core: true,
    summary: "索引是 MySQL 性能的核心，B+树索引的匹配规则与失效场景决定 SQL 能否走索引。",
    points: [
      "索引类型：主键索引（聚簇）、二级索引（非聚簇，叶子存主键值）、联合索引、覆盖索引",
      "聚簇 vs 非聚簇：聚簇索引叶子存整行数据，二级索引叶子存主键值，需回表查整行",
      "最左前缀原则：联合索引 (a,b,c) 可命中 a、a,b、a,b,c；跳过 a 直接查 b 则失效",
      "索引失效场景：对索引列用函数/计算、隐式类型转换、like '%xx'、OR 连接非索引列、范围查询右侧列",
      "覆盖索引优化：查询列全部在索引中，避免回表，是常用优化手段",
      "索引下推（ICP）：联合索引条件在存储引擎层提前过滤，减少回表次数（MySQL 5.6+）",
      "面试话术：先讲聚簇/二级索引结构，再背最左前缀和失效场景，最后举覆盖索引优化例子"
    ],
    status: "ready"
  },
  "mysql-btree": {
    core: true,
    summary: "InnoDB 用 B+树作为索引结构，矮胖多路、叶子有序链表，兼顾范围查询与磁盘 IO 效率。",
    points: [
      "B+树特征：多路平衡树，非叶子节点只存索引键，叶子节点存数据且用链表串联",
      "为什么不用 B 树：B 树非叶子也存数据，导致单节点容纳键更少、树更高、IO 更多；且无叶子链表范围查询慢",
      "为什么不用哈希索引：哈希等值查询 O(1) 但无法范围查询、无法排序，适合内存场景（Redis）",
      "为什么不用二叉搜索树/红黑树：树太高，磁盘 IO 次数多；红黑树适合内存（TreeMap）不适合磁盘",
      "扇出（fanout）：16KB 页内键越多树越矮，一般 3-4 层即可支撑千万级数据",
      "页结构：页是磁盘与内存交互的最小单位（16KB），B+树节点对应页",
      "面试话术：答\"矮胖 + 叶子链表\"两个核心特征，再对比 B 树/哈希/二叉树说明磁盘 IO 视角的取舍"
    ],
    status: "ready"
  },
  "mysql-transaction": {
    core: true,
    summary: "事务保证 ACID 四大特性，InnoDB 通过 undo log、redo log 与锁/MVCC 分别支撑原子性、持久性与隔离性。",
    points: [
      "ACID：原子性（全部成功或全部回滚）、一致性（约束不被破坏）、隔离性（并发互不干扰）、持久性（提交后不丢失）",
      "原子性实现：undo log 记录修改前的数据，回滚时反向执行",
      "持久性实现：redo log 先落盘（WAL 预写日志），崩溃后重放恢复，保证已提交事务不丢",
      "隔离性实现：锁（悲观）+ MVCC（乐观多版本并发控制）",
      "一致性：由其余三性共同保证，是最终目标",
      "事务四大隔离级别：读未提交、读已提交、可重复读（MySQL 默认）、串行化",
      "面试话术：先答 ACID 定义，再逐个说明底层支撑（undo/redo/锁+MVCC），最后提隔离级别"
    ],
    status: "ready"
  },
  "mysql-isolation": {
    "core": true,
    "summary": "InnoDB 默认 REPEATABLE READ，需要结合一致性读和锁定读解释隔离。不能把 SQL 标准的隔离表直接当作所有实现的行为。",
    "points": [
      "知识地图：脏读 → 不可重复读 → 幻读 → 快照与锁。",
      "核心原理：RC 的一致性读可使用新快照，RR 通常复用首次一致性读的快照；事务读取自己的修改另有可见性规则。",
      "面试重点：RR 下范围锁定通常使用 next-key locking；唯一索引精确查找等情况可能仅锁记录，需看语句和索引。",
      "实战避坑：混合快照读、锁定读与写操作会得到不同时间点的视图，不能笼统宣称 RR 的当前读总有幻读或全部读法完全相同。",
      "模拟题：分别用两个事务执行普通 SELECT 和 SELECT FOR UPDATE，另一个事务插入范围内记录时会发生什么？",
      "面试话术：我先说明读类型和快照创建时机，再给出索引及锁范围，用具体时间线回答并发结果。"
    ],
    "status": "ready"
  },
  "mysql-lock": {
    "core": true,
    "summary": "InnoDB 锁分全局锁、表级锁、行级锁三类，行锁基于索引实现，是并发控制的关键。",
    "points": [
      "全局锁：FLUSH TABLES WITH READ LOCK，全库只读，用于备份一致性",
      "表级锁：表锁、元数据锁（MDL）、意向锁（IS/IX 辅助行锁与表锁的兼容判断）",
      "行级锁：记录锁（Record Lock）、间隙锁（Gap Lock）、临键锁（Next-Key Lock，默认 RR 下范围扫描加锁）",
      "InnoDB 记录锁作用于索引记录；缺少合适索引时可能扫描并锁定大量记录，不能简单说行锁自动升级成表锁。",
      "共享 S 与排他 X 的兼容要按同一资源判断；意向锁也有兼容矩阵，例如 IX 与表级 S 不兼容，不能一概说意向锁之间都兼容。",
      "死锁检测可选择牺牲事务回滚；锁等待超时的默认行为通常回滚当前语句，是否回滚整个事务要检查设置并由应用明确处理。",
      "模拟题：没有索引的 UPDATE 为什么影响大量并发请求？死锁重试时要重试哪一段业务？",
      "面试话术：按全局→表级→行级分类讲，强调行锁基于索引，最后答死锁成因与 innodb_lock_wait_timeout"
    ],
    "status": "ready"
  },
  "mysql-log": {
    "core": true,
    "summary": "MySQL 三大日志各司其职：undo log 保原子性、redo log 保持久性、binlog 做复制与恢复。",
    "points": [
      "undo log：逻辑日志，记录修改前状态，用于事务回滚和 MVCC 版本链（InnoDB 层）",
      "redo log：物理日志，记录页的物理修改，WAL 机制先写日志后刷盘，崩溃恢复用（InnoDB 层）",
      "binlog 位于 Server 层，可按语句、行或混合形式记录变更，不能把所有 binlog 统一描述为原始 SQL 文本。",
      "WAL（Write-Ahead Logging）：先写 redo log 再刷数据页，顺序写日志远快于随机写磁盘",
      "两阶段提交：redo log prepare → 写 binlog → redo log commit，保证 crash 后两份日志一致",
      "刷盘策略：innodb_flush_log_at_trx_commit=0/1/2（1 最安全每次提交落盘）",
      "实战避坑：结合 innodb_flush_log_at_trx_commit、sync_binlog 与故障模型解释持久性，区分本地恢复与异步副本故障转移。",
      "模拟题：数据库确认提交后数据是否绝不丢失，依赖哪些刷盘和复制配置？",
      "面试话术：三日志各一句定位（回滚/崩溃恢复/复制），重点讲 WAL 与两阶段提交，最后说刷盘参数"
    ],
    "status": "ready"
  },
  "redis": {
    "core": true,
    "summary": "Redis 是内存键值数据库，单线程 + IO 多路复用 + 高效数据结构造就高性能，面试聚焦数据类型与可靠性。",
    "points": [
      "为什么快：纯内存 + 单线程（避免锁竞争）+ IO 多路复用（epoll）+ 高效数据结构（SDS/跳表等）",
      "Redis 常见命令执行路径以主线程为核心，但网络 IO、后台持久化、异步释放等随版本采用不同并发机制；后台机制也不代表完全没有暂停或主线程工作。",
      "数据类型：String/Hash/List/Set/Zset + BitMap/HyperLogLog/GEO/Stream",
      "可靠性：持久化（RDB/AOF）+ 主从复制 + 哨兵/集群高可用",
      "缓存三大问题：穿透（查不存在数据）、击穿（热点 key 过期）、雪崩（大量 key 同时过期）",
      "部署架构演进：单机 → 主从复制 → 哨兵（自动故障转移）→ Cluster 集群（分片）",
      "实战避坑：慢命令、大 Key、fork 和事件循环阻塞都需观察；不要把内存数据库误认为任何操作都很快。",
      "模拟题：Redis 命令仍主要由主线程执行，为什么 IO 线程可能改善吞吐？",
      "面试话术：先答高性能三原因，再答数据类型应用场景，最后讲持久化与高可用架构"
    ],
    "status": "ready"
  },
  "redis-types": {
    "core": true,
    "summary": "Redis 数据类型各有典型场景，String 缓存计数、Zset 排行榜、HyperLogLog 去重统计等是高频应用题。",
    "points": [
      "String 可做缓存、计数器、Session 和锁；锁应使用单条 SET key token NX EX/PX 原子设置条件及过期，不拆成 SETNX 再 EXPIRE。",
      "Hash：对象存储（用户信息字段级更新）、购物车",
      "List：消息队列（LPUSH/BRPOP）、关注列表时间线",
      "Set：去重、共同关注（sinter 交集）、抽奖随机",
      "Zset：排行榜（score 排序）、延迟队列（score=时间戳）、限流滑动窗口",
      "BitMap：签到统计、在线用户位图；HyperLogLog：UV 去重统计（误差 0.81%）；GEO：附近的人；Stream：专业消息队列",
      "模拟题：业务任务超过锁租约时，仅依赖 Redis 锁为什么可能出现并发执行？",
      "面试话术：按类型讲结构特点 + 经典场景 + 复杂度（如 Zset 跳表 O(logN)），尽量举业务例子"
    ],
    "status": "ready"
  },
  "redis-datastruct": {
    "core": true,
    "summary": "Redis 底层数据结构决定性能：SDS、压缩列表、跳表、quicklist、listpack 等适配不同数据规模。",
    "points": [
      "SDS（简单动态字符串）：O(1) 取长度、二进制安全、预分配减少扩容次数（String 底层）",
      "跳表（skiplist）：多层索引链表，O(logN) 查询，Zset 底层（配合 dict）",
      "哈希表（dict）：渐进式 rehash 分多次迁移，避免一次性阻塞（Hash 底层）",
      "编码随版本和元素规模改变；现代版本的小集合常见 listpack，旧版 ziplist 用于历史对比，应结合 OBJECT ENCODING 和目标版本分析。",
      "quicklist：双向链表 + 每个节点是 ziplist，List 底层（3.2+）",
      "整数集合（intset）：元素全为整数且数量少时用，升级策略",
      "编码转换：元素数量/大小超过阈值（hash-max-ziplist-entries 等）时由压缩结构转为 dict/skiplist",
      "实战避坑：逻辑数据类型、内存编码与命令复杂度是三个层次，阈值可能随版本或配置变化。",
      "模拟题：相同 Redis 数据类型为什么可能采用不同编码？",
      "面试话术：按数据类型逐一对应底层结构，讲清\"小数据用紧凑编码，大数据转高级结构\"的转换阈值"
    ],
    "status": "ready"
  },
  "redis-arch": {
    "core": true,
    "summary": "Redis 主从、Sentinel 与 Cluster 分别侧重复制、故障转移和分片。高可用不能被解释为所有故障下都零数据丢失。",
    "points": [
      "知识地图：主从复制 → Sentinel → Cluster slots → 故障转移。",
      "核心原理：复制通常异步；Sentinel 协调监控与主从切换，Cluster 使用槽进行分片并维护节点故障转移。",
      "面试重点：全量与增量同步、复制 backlog、客户端重定向；跨槽多 key 操作需要了解命令与 hash tag 约束。",
      "实战避坑：已确认写可能在副本尚未接收时丢失；WAIT 等机制改善确认范围，也不能直接将 Redis 变为完整强一致事务系统。",
      "模拟题：为什么故障切换后分布式锁可能消失？Cluster 的多个 key 操作如何落入同一槽？",
      "面试话术：我把持久化、复制确认与故障转移分别说明，按业务容忍的丢失窗口选择架构。"
    ],
    "status": "ready"
  },
  "redis-persistence": {
    "core": true,
    "summary": "Redis 持久化两大机制 RDB（快照）与 AOF（追加日志），各有取舍，生产常二者结合。",
    "points": [
      "RDB：fork 子进程生成二进制快照文件 dump.rdb；文件紧凑恢复快，但可能丢失最后一次快照后的数据",
      "SAVE 同步执行，BGSAVE 通常使用后台子进程；fork 本身和写时复制开销仍可能造成延迟与额外内存，不能说完全不阻塞。",
      "AOF：追加写命令到文件，可配置 fsync 策略（always/everysec/no），数据丢失少但文件大恢复慢",
      "AOF 重写：压缩重复命令（bgrewriteaof），子进程重写 + 缓冲新增命令合并",
      "RDB vs AOF：RDB 恢复快易丢数据，AOF 丢数据少恢复慢；4.0+ 混合持久化（RDB 头 + AOF 增量）",
      "大 Key 对持久化的影响：fork 阻塞、RDB 快照大、AOF 重写耗内存、复制全量同步慢",
      "实战避坑：持久化保护本地恢复，异步复制保护的范围不同；压测时关注 fork 时长、COW 内存与磁盘延迟。",
      "模拟题：开启 AOF everysec 后，断电和主从切换分别还可能丢失什么数据？",
      "面试话术：对比两者机制与取舍，答触发时机和 COW，重点说 4.0 混合持久化与大 Key 影响"
    ],
    "status": "ready"
  },
  // ---- 次要节点（待补充） ----
  "mysql-basic": { core: false, summary: "", points: [], status: "pending" },
  "mysql-row-storage": { core: false, summary: "", points: [], status: "pending" },
  "mysql-bufferpool": { core: false, summary: "", points: [], status: "pending" },
  "pg": { core: false, summary: "", points: [], status: "pending" },
  "redis-bigkey": { core: false, summary: "", points: [], status: "pending" }
});