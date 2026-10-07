-- =============================================================================
-- 课程种子数据
-- 运行方式:
--   本地开发: node -e "require('better-sqlite3');const db=new (require('better-sqlite3'))('local-dev.db');db.exec(require('fs').readFileSync('scripts/seed-courses.sql','utf8'));db.close();"
--   生产环境: wrangler d1 execute DB --file=scripts/seed-courses.sql
-- =============================================================================

-- ---------------------------------------------------------------------------
-- 1. 课程基础数据
-- ---------------------------------------------------------------------------

INSERT OR IGNORE INTO courses (id, slug, title, seed_type, crop_type, description, "order", prerequisites, version, status)
VALUES ('web3', 'web3', 'Web3 通识', '账本星种', '守护浆果', '理解账户、钱包、交易和基础安全，能够判断常见风险。', 1, '[]', '1.0.0', 'available');

INSERT OR IGNORE INTO courses (id, slug, title, seed_type, crop_type, description, "order", prerequisites, version, status)
VALUES ('monad', 'monad', 'Monad 基础', '并行紫藤种', 'Monad 紫藤果', '认识 Monad、RPC、区块浏览器与测试环境。', 2, '["web3"]', '1.0.0', 'available');

INSERT OR IGNORE INTO courses (id, slug, title, seed_type, crop_type, description, "order", prerequisites, version, status)
VALUES ('contract', 'contract', '智能合约', '合约卷轴种', '合约晶果', '理解合约状态、函数、ABI、事件与权限风险。', 3, '["monad"]', '1.0.0', 'locked');

-- ---------------------------------------------------------------------------
-- 2. Web3 通识 - 章节
-- ---------------------------------------------------------------------------

-- 第1章: 区块链、账户与地址
INSERT OR IGNORE INTO chapters (id, course_id, number, title, pace, objective, body, terms, example, caution, is_safety, knowledge_card)
VALUES (
  'account', 'web3', 1,
  '区块链、账户与地址',
  '认识 / 破冰',
  '学完你会知道，链上的账本为什么改不了、钱包地址是不是秘密。',
  '区块链可以理解成一本所有人都能看、但没人能私自涂改的账本。每一笔交易被确认后，会通过密码学哈希和前一笔记录锁在一起。改动其中一笔，后面所有记录都会对不上，这就是不可篡改的来源。钱包地址像账本上的身份编号，任何人都可以查到它的历史交易；真正决定谁能操作这个地址的，是只有你自己保管的私钥和助记词。',
  '["区块链","钱包地址","不可篡改"]',
  '你可以把钱包地址发给朋友收款，就像告诉别人银行卡号；别人能看到号码，但不能因此拿走资产。',
  '地址公开不等于什么都能分享。私钥和助记词必须始终保密。',
  0,
  '{"definition":"区块链是一本公开、不可篡改的账本。","reason":"理解公开可查和资产安全是两回事，是后续安全判断的基础。","visibleResult":"区块浏览器上任意地址的历史交易记录。","stateChange":"只有发起交易的写入操作会改变账本，单纯查看不会。","checkBeforeAction":"本章无需操作，只需理解概念。"}'
);

-- 第2章: 读取、签名与交易
INSERT OR IGNORE INTO chapters (id, course_id, number, title, pace, objective, body, terms, example, caution, is_safety, knowledge_card)
VALUES (
  'transaction', 'web3', 2,
  '读取、签名与交易',
  '熟练 / 巩固',
  '学完你会分辨哪些操作不用签名，以及一笔交易怎样从发起走到确认。',
  '链上操作分为读取和写入。查询余额、查看交易记录只是读取账本中已有内容，不会改变任何东西，因此不需要签名，也不花 Gas。转账等会改变账本状态的操作属于写入，必须由用户签名授权。一笔写入交易依次经历：用户签名、交易广播、打包进区块、网络确认。签名代表你同意这件事发生。',
  '["读取操作","写入操作","签名","Gas"]',
  '查看钱包里的 USDC 是读取；把 100 USDC 转给朋友是写入，需要签名确认。',
  '签名意味着授权，不要在没有看清内容时随手确认。',
  0,
  '{"definition":"读取是查看链上数据，写入是改变链上数据并需要签名授权。","reason":"分清两者，才能判断当前步骤是否应该请求你的确认。","visibleResult":"读取时直接显示结果；写入时钱包会弹出签名请求。","stateChange":"转账等写入操作会改变链上状态，查询不会。","checkBeforeAction":"签名前确认操作内容和对象正是你想做的事。"}'
);

-- 第3章: 私钥、助记词与签名风险
INSERT OR IGNORE INTO chapters (id, course_id, number, title, pace, objective, body, terms, example, caution, is_safety, knowledge_card)
VALUES (
  'security', 'web3', 3,
  '私钥、助记词与签名风险',
  '认真收尾 / 风险判断',
  '学完你会知道什么绝对不能分享，以及哪些签名请求必须拒绝。',
  '钱包地址是公开的门牌号，但私钥和助记词是控制地址中全部资产的万能钥匙。一旦泄露，任何人都可以直接转走资产，而且无法撤销。任何自称官方的活动、客服或空投，只要要求输入助记词或私钥，都必须立即判定为风险。签名请求也要看清内容；看不懂就确认的盲签，是另一类常见风险。',
  '["私钥","助记词","盲签"]',
  '银行不会询问银行卡密码；同样，任何 Web3 项目方都不需要你的助记词才能发放奖励。',
  '交出助记词等于交出全部控制权。签名前必须看清授权内容。',
  1,
  '{"definition":"私钥和助记词代表完全控制权，签名代表对单次操作的授权。","reason":"泄露密钥和盲签是链上资产被盗的主要原因。","visibleResult":"钓鱼信息常伪装成官方活动；风险签名常来自陌生 DApp。","stateChange":"交出助记词会失去控制权；盲签可能授权他人转走资产。","checkBeforeAction":"索要助记词的请求直接拒绝；签名前看清授权内容。"}'
);

-- ---------------------------------------------------------------------------
-- 3. Web3 通识 - 章节挑战题
-- ---------------------------------------------------------------------------

-- 第1章挑战: 判断题
INSERT OR IGNORE INTO challenge_questions (id, chapter_id, type, question_blob, success_msg, failure_msg)
VALUES (
  'account-confirmed-record', 'account', 'choice',
  '{"scene":"农场的老邻居问你：听说链上的账本，谁都改不了？","prompt":"区块链上的交易记录一旦被网络确认，任何单方都无法私自修改。","options":[{"id":"true","label":"正确"},{"id":"false","label":"错误"}],"answer":"true"}',
  '没错，这片地的账本，谁也偷偷改不了。',
  '如果账本能被一个人偷偷改，大家还会信这本账吗？再看一眼知识卡。'
);

-- 第2章挑战1: 读取 vs 写入
INSERT OR IGNORE INTO challenge_questions (id, chapter_id, type, question_blob, success_msg, failure_msg)
VALUES (
  'transaction-read-signature', 'transaction', 'choice',
  '{"scene":"你在仓库门口，只想看看还有多少 USDC。","prompt":"只是查看余额，需要签名确认吗？","options":[{"id":"a","label":"A. 需要"},{"id":"b","label":"B. 不需要"}],"answer":"b"}',
  '对，看看货架不用签字，仓库也不会因为看一眼而变化。',
  '这一步有没有真的改变钱包里的东西？读取不会改变状态。'
);

-- 第2章挑战2: 排序题
INSERT OR IGNORE INTO challenge_questions (id, chapter_id, type, question_blob, success_msg, failure_msg)
VALUES (
  'transaction-order', 'transaction', 'order',
  '{"scene":"你要给隔壁农场寄一批货，需要按正确顺序完成手续。","prompt":"选择正确的交易流程顺序。","options":[{"id":"2-3-1-4","label":"签名 → 广播 → 打包进区块 → 网络确认"},{"id":"3-2-4-1","label":"广播 → 签名 → 网络确认 → 打包进区块"},{"id":"1-2-3-4","label":"打包进区块 → 签名 → 广播 → 网络确认"}],"answer":"2-3-1-4"}',
  '顺序正确，这就是一笔交易从发起到完成的旅程。',
  '先有人签名表示我要发起，消息才能广播并等待网络打包确认。'
);

-- 第3章挑战1: 助记词安全
INSERT OR IGNORE INTO challenge_questions (id, chapter_id, type, question_blob, success_msg, failure_msg)
VALUES (
  'security-seed-phrase', 'security', 'choice',
  '{"scene":"你收到一条自称官方空投活动的私信。","prompt":"对方要求输入助记词领取奖励，你应该怎么做？","options":[{"id":"a","label":"A. 输入助记词，尽快领取"},{"id":"b","label":"B. 拒绝提供，正规渠道不会索要助记词"}],"answer":"b"}',
  '守住了。这是最常见的骗术之一，你的判断是对的。',
  '交出助记词等于把资产的完全控制权交给对方，而且无法撤销。任何索要助记词的请求都必须拒绝。'
);

-- 第3章挑战2: 盲签风险
INSERT OR IGNORE INTO challenge_questions (id, chapter_id, type, question_blob, success_msg, failure_msg)
VALUES (
  'security-blind-sign', 'security', 'choice',
  '{"scene":"陌生网站弹出看不懂的签名请求，并不断催促你尽快确认。","prompt":"你应该如何处理？","options":[{"id":"a","label":"A. 先签了看看，之后还能后悔"},{"id":"b","label":"B. 不确认，先弄清授权内容，必要时关闭页面"}],"answer":"b"}',
  '对。看不懂就不签，催促操作本身也是常见的施压信号。',
  '签名一旦确认就无法撤销。看不懂授权内容时必须拒绝，而不是先试试看。'
);

-- ---------------------------------------------------------------------------
-- 4. Web3 通识 - 结课小测
-- ---------------------------------------------------------------------------

INSERT OR IGNORE INTO final_quiz_questions (id, course_id, question_blob)
VALUES ('fq-web3-1', 'web3', '{"prompt":"区块链上的交易一旦确认，无法被单方面修改。","options":[{"id":"true","label":"正确"},{"id":"false","label":"错误"}],"answer":"true"}');

INSERT OR IGNORE INTO final_quiz_questions (id, course_id, question_blob)
VALUES ('fq-web3-2', 'web3', '{"prompt":"钱包地址属于公开信息，任何人都可以查询其历史交易。","options":[{"id":"true","label":"正确"},{"id":"false","label":"错误"}],"answer":"true"}');

INSERT OR IGNORE INTO final_quiz_questions (id, course_id, question_blob)
VALUES ('fq-web3-3', 'web3', '{"prompt":"查询余额是否需要签名？","options":[{"id":"a","label":"A. 需要"},{"id":"b","label":"B. 不需要"}],"answer":"b"}');

INSERT OR IGNORE INTO final_quiz_questions (id, course_id, question_blob)
VALUES ('fq-web3-4', 'web3', '{"prompt":"以下哪个可以放心分享？","options":[{"id":"a","label":"A. 钱包地址"},{"id":"b","label":"B. 助记词"}],"answer":"a"}');

INSERT OR IGNORE INTO final_quiz_questions (id, course_id, question_blob)
VALUES ('fq-web3-5', 'web3', '{"prompt":"收到索要助记词的官方活动私信，应该怎么做？","options":[{"id":"a","label":"A. 按要求提供"},{"id":"b","label":"B. 拒绝提供"}],"answer":"b"}');

-- ---------------------------------------------------------------------------
-- 5. Monad 基础 - 章节
-- ---------------------------------------------------------------------------

-- 第1章: Monad 与 EVM
INSERT OR IGNORE INTO chapters (id, course_id, number, title, pace, objective, body, terms, example, caution, is_safety, knowledge_card)
VALUES (
  'monad-evm', 'monad', 1,
  'Monad 与 EVM',
  '认识 / 破冰',
  '学完你会知道，Monad 和以太坊的开发生态是什么关系。',
  'Monad 兼容 EVM（以太坊虚拟机），这意味着原本部署在以太坊上的智能合约，通常只需少量甚至无需修改就能部署到 Monad 上，开发者熟悉的工具和代码可以直接复用。这也是 Monad 生态能够快速积累应用的关键原因之一。但"兼容"不代表"完全相同"——网络地址、RPC 节点、浏览器都是 Monad 独立的一套，不能和以太坊的混用。',
  '["EVM 兼容","RPC"]',
  '一个原本跑在以太坊上的兑换合约，开发者稍作调整就能部署到 Monad，这也是为什么 Monad 上很快就出现了很多熟悉的应用类型。',
  '"兼容"只是开发层面的便利，操作时依然要核对自己连接的是不是 Monad 网络。',
  0,
  '{"definition":"Monad 是一条兼容 EVM 的高性能公链。","reason":"理解这一点能解释为什么 Monad 生态发展得很快。","visibleResult":"熟悉的 DApp 类型，例如 Swap、质押，在 Monad 上也能找到对应版本。","stateChange":"本章为概念章节，不涉及具体操作。","checkBeforeAction":"操作前确认钱包连接的网络确实是 Monad，而不是以太坊或其他链。"}'
);

-- 第2章: RPC、区块与浏览器
INSERT OR IGNORE INTO chapters (id, course_id, number, title, pace, objective, body, terms, example, caution, is_safety, knowledge_card)
VALUES (
  'monad-rpc', 'monad', 2,
  'RPC、区块与浏览器',
  '熟练 / 巩固',
  '学完你会用区块浏览器查一笔交易，并知道 Gas 不能说明交易是否成功。',
  '区块浏览器是查看链上一切公开信息的窗口——每个网络都有自己独立的浏览器，Monad 上的交易要用 Monad 对应的浏览器查询，不能拿以太坊浏览器去查。想确认一笔交易到底成功没有，不能只看 Gas 花了多少钱，Gas 只能说明"花费了多少"，真正判断成败的依据是交易回执（Receipt）里的状态字段。区块高度则代表账本增长到了哪一页，越新的区块高度越靠后。',
  '["区块浏览器","交易回执","区块高度"]',
  '把交易哈希粘贴进 Monad 区块浏览器搜索框，就能看到这笔交易的完整状态和详情。',
  '查交易时认准官方或可信的区块浏览器地址，避免打开仿冒页面。',
  0,
  '{"definition":"区块浏览器是查询链上公开数据的窗口，回执是判断交易成败的依据。","reason":"能自己核实一笔交易，而不是只听别人说。","visibleResult":"交易哈希、状态字段、区块高度和 Gas 消耗。","stateChange":"查询是读取操作，不改变任何状态。","checkBeforeAction":"确认打开的是官方或可信的区块浏览器地址，而不是仿冒页面。"}'
);

-- 第3章: 测试环境与资产安全
INSERT OR IGNORE INTO chapters (id, course_id, number, title, pace, objective, body, terms, example, caution, is_safety, knowledge_card)
VALUES (
  'monad-testnet', 'monad', 3,
  '测试环境与资产安全',
  '认真收尾 / 严肃模式',
  '学完你会分清测试网和主网、能识别围绕测试资产展开的骗局。',
  '测试网络上的资产（包括测试用的 MON）本身没有真实价值，唯一作用是让你在不花真钱的情况下练习操作。任何围绕"用真钱换测试币"或"测试币换真钱"展开的交易，背后往往是诈骗话术。操作前一定要核对自己连接的网络是不是预期的那一个，陌生网络的切换请求也是常见的风险来源之一。',
  '["测试网","主网","网络核对"]',
  '朋友说想用 100 元人民币收购你测试网里的 1000 个测试 MON，这类交易应该被直接拒绝。',
  '测试资产没有真实价值；涉及真钱或陌生网络切换的请求必须先核实。',
  1,
  '{"definition":"测试网资产没有真实价值，仅用于练习。","reason":"能识别测试币变现类骗局。","visibleResult":"钱包界面通常会标注当前所在网络是测试网还是主网。","stateChange":"切换到陌生网络后进行的操作可能涉及真实资产风险。","checkBeforeAction":"确认当前网络符合预期，拒绝任何测试币换真钱的交易请求。"}'
);

-- ---------------------------------------------------------------------------
-- 6. Monad 基础 - 章节挑战题
-- ---------------------------------------------------------------------------

-- 第1章挑战: EVM 兼容
INSERT OR IGNORE INTO challenge_questions (id, chapter_id, type, question_blob, success_msg, failure_msg)
VALUES (
  'monad-evm-compatible', 'monad-evm', 'choice',
  '{"scene":"你发现隔壁以太坊农场的种植工具，好像稍微改改就能直接在 Monad 农场用。","prompt":"Monad 兼容 EVM，意味着原本部署在以太坊上的智能合约，通常只需少量甚至无需修改就能部署到 Monad 上。","options":[{"id":"true","label":"正确"},{"id":"false","label":"错误"}],"answer":"true"}',
  '对，这也是为什么 Monad 农场能这么快就热闹起来——很多好用的工具直接就能搬过来用。',
  '再想想：如果两条链的底层规则差不多，那开发者是不是就不用从零重写代码了？'
);

-- 第2章挑战1: 交易回执
INSERT OR IGNORE INTO challenge_questions (id, chapter_id, type, question_blob, success_msg, failure_msg)
VALUES (
  'monad-receipt-status', 'monad-rpc', 'choice',
  '{"scene":"你想确认一笔货有没有真的送到。","prompt":"想知道一笔 Monad 交易到底成功了没有，该看什么？","options":[{"id":"a","label":"A. Gas 价格"},{"id":"b","label":"B. 交易回执的状态"}],"answer":"b"}',
  '运费只能说明花了多少钱，回执才能告诉你东西到底送到没有。',
  '再想想：花了钱和东西送没送到，是一回事吗？'
);

-- 第2章挑战2: 浏览器查询顺序
INSERT OR IGNORE INTO challenge_questions (id, chapter_id, type, question_blob, success_msg, failure_msg)
VALUES (
  'monad-explorer-order', 'monad-rpc', 'order',
  '{"scene":"你想弄清楚朋友发给你的那笔交易到底是什么情况。","prompt":"选择使用区块浏览器查询交易的正确顺序。","options":[{"id":"2-1-3-4","label":"② 复制交易哈希 → ① 打开 Monad 区块浏览器 → ③ 粘贴查询 → ④ 查看状态和区块高度"},{"id":"1-2-4-3","label":"① 打开浏览器 → ② 复制交易哈希 → ④ 查看状态 → ③ 粘贴查询"},{"id":"3-1-2-4","label":"③ 粘贴查询 → ① 打开浏览器 → ② 复制交易哈希 → ④ 查看状态"}],"answer":"2-1-3-4"}',
  '对，这就是核实一笔交易最基本的步骤。',
  '先准备交易哈希，再打开对应浏览器、粘贴查询，最后查看状态和区块高度。'
);

-- 第3章挑战1: 测试币安全
INSERT OR IGNORE INTO challenge_questions (id, chapter_id, type, question_blob, success_msg, failure_msg)
VALUES (
  'monad-test-token-sale', 'monad-testnet', 'choice',
  '{"scene":"朋友想用 100 元人民币收购你测试网钱包里的 1000 个测试 MON。","prompt":"你应该怎么做？","options":[{"id":"a","label":"A. 可以卖，反正是测试代币"},{"id":"b","label":"B. 不参与；测试资产没有真实价值，这很可能是骗局"}],"answer":"b"}',
  '守住了。练习用的资产一旦有人想用真钱换，就要多留个心眼。',
  '测试资产本身没有真实价值，这类交易背后往往是诈骗话术，不要参与。'
);

-- 第3章挑战2: 陌生网络
INSERT OR IGNORE INTO challenge_questions (id, chapter_id, type, question_blob, success_msg, failure_msg)
VALUES (
  'monad-unknown-network', 'monad-testnet', 'choice',
  '{"scene":"钱包突然要求你切换到一个从没见过的陌生网络才能完成操作。","prompt":"你应该怎么处理？","options":[{"id":"a","label":"A. 先切换过去再说"},{"id":"b","label":"B. 先核实网络来源和切换原因"}],"answer":"b"}',
  '对。网络切换请求背后可能涉及资产风险，先核实没有错。',
  '陌生网络切换请求是常见风险来源，不清楚来源和目的前不要直接同意。'
);

-- ---------------------------------------------------------------------------
-- 7. Monad 基础 - 结课小测
-- ---------------------------------------------------------------------------

INSERT OR IGNORE INTO final_quiz_questions (id, course_id, question_blob)
VALUES ('fq-monad-1', 'monad', '{"prompt":"Monad 兼容 EVM，意味着大部分以太坊合约代码可以较快迁移过来。","options":[{"id":"true","label":"正确"},{"id":"false","label":"错误"}],"answer":"true"}');

INSERT OR IGNORE INTO final_quiz_questions (id, course_id, question_blob)
VALUES ('fq-monad-2', 'monad', '{"prompt":"不同链有各自独立的区块浏览器，一般不能直接用来查另一条链的交易。","options":[{"id":"true","label":"正确"},{"id":"false","label":"错误"}],"answer":"true"}');

INSERT OR IGNORE INTO final_quiz_questions (id, course_id, question_blob)
VALUES ('fq-monad-3', 'monad', '{"prompt":"判断一笔 Monad 交易是否成功，应该看什么？","options":[{"id":"a","label":"A. Gas 价格"},{"id":"b","label":"B. 交易回执的状态字段"}],"answer":"b"}');

INSERT OR IGNORE INTO final_quiz_questions (id, course_id, question_blob)
VALUES ('fq-monad-4', 'monad', '{"prompt":"测试网络里的 MON 代币是否有真实价值？","options":[{"id":"a","label":"A. 没有真实价值，仅用于测试"},{"id":"b","label":"B. 和主网 MON 等值"}],"answer":"a"}');

INSERT OR IGNORE INTO final_quiz_questions (id, course_id, question_blob)
VALUES ('fq-monad-5', 'monad', '{"prompt":"有人想用真钱收购你测试网里的代币，你应该？","options":[{"id":"a","label":"A. 谨慎对待，这很可能是骗局"},{"id":"b","label":"B. 可以卖，反正是测试币"}],"answer":"a"}');