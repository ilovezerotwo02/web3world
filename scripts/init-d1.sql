-- =============================================================================
-- 初始化本地 D1 数据库：建表 + 种子数据
-- 运行方式: wrangler d1 execute monad-pixel-farm-db --local --file=scripts/init-d1.sql
-- =============================================================================

-- ---------------------------------------------------------------------------
-- 1. 删除旧表（如存在）
-- ---------------------------------------------------------------------------
DROP TABLE IF EXISTS audit_sessions;
DROP TABLE IF EXISTS system_config;
DROP TABLE IF EXISTS system_logs;
DROP TABLE IF EXISTS nft_minting;
DROP TABLE IF EXISTS nft_qualifications;
DROP TABLE IF EXISTS achievements;
DROP TABLE IF EXISTS exp_ledger;
DROP TABLE IF EXISTS final_quiz_attempts;
DROP TABLE IF EXISTS challenge_attempts;
DROP TABLE IF EXISTS course_progress;
DROP TABLE IF EXISTS final_quiz_questions;
DROP TABLE IF EXISTS challenge_questions;
DROP TABLE IF EXISTS chapters;
DROP TABLE IF EXISTS courses;
DROP TABLE IF EXISTS wallet_challenges;
DROP TABLE IF EXISTS sessions;
DROP TABLE IF EXISTS users;

-- ---------------------------------------------------------------------------
-- 2. 建表
-- ---------------------------------------------------------------------------

CREATE TABLE users (
  id TEXT PRIMARY KEY NOT NULL,
  username TEXT NOT NULL UNIQUE,
  avatar_url TEXT,
  wallet_address TEXT UNIQUE,
  role TEXT NOT NULL DEFAULT 'user',
  exp INTEGER NOT NULL DEFAULT 0,
  level INTEGER NOT NULL DEFAULT 1,
  created_at TEXT NOT NULL DEFAULT (CURRENT_TIMESTAMP),
  updated_at TEXT NOT NULL DEFAULT (CURRENT_TIMESTAMP),
  status TEXT NOT NULL DEFAULT 'active'
);

CREATE TABLE sessions (
  id TEXT PRIMARY KEY NOT NULL,
  user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  token TEXT NOT NULL UNIQUE,
  created_at TEXT NOT NULL DEFAULT (CURRENT_TIMESTAMP),
  expires_at TEXT
);

CREATE TABLE wallet_challenges (
  id TEXT PRIMARY KEY NOT NULL,
  address TEXT NOT NULL,
  message TEXT NOT NULL,
  expires_at TEXT NOT NULL,
  used_at TEXT,
  created_at TEXT NOT NULL DEFAULT (CURRENT_TIMESTAMP)
);
CREATE INDEX wallet_challenges_address_idx ON wallet_challenges (address);

CREATE TABLE courses (
  id TEXT PRIMARY KEY NOT NULL,
  slug TEXT NOT NULL UNIQUE,
  title TEXT NOT NULL,
  seed_type TEXT NOT NULL,
  crop_type TEXT NOT NULL,
  description TEXT NOT NULL,
  "order" INTEGER NOT NULL,
  prerequisites TEXT NOT NULL DEFAULT '[]',
  version TEXT NOT NULL DEFAULT '1.0.0',
  status TEXT NOT NULL DEFAULT 'available',
  created_at TEXT NOT NULL DEFAULT (CURRENT_TIMESTAMP)
);

CREATE TABLE chapters (
  id TEXT PRIMARY KEY NOT NULL,
  course_id TEXT NOT NULL REFERENCES courses(id) ON DELETE CASCADE,
  number INTEGER NOT NULL,
  title TEXT NOT NULL,
  pace TEXT NOT NULL,
  objective TEXT NOT NULL,
  body TEXT NOT NULL,
  terms TEXT NOT NULL DEFAULT '[]',
  example TEXT NOT NULL,
  caution TEXT NOT NULL,
  is_safety INTEGER NOT NULL DEFAULT 0,
  knowledge_card TEXT NOT NULL,
  created_at TEXT NOT NULL DEFAULT (CURRENT_TIMESTAMP)
);

CREATE TABLE challenge_questions (
  id TEXT PRIMARY KEY NOT NULL,
  chapter_id TEXT NOT NULL REFERENCES chapters(id) ON DELETE CASCADE,
  type TEXT NOT NULL,
  question_blob TEXT NOT NULL,
  success_msg TEXT NOT NULL,
  failure_msg TEXT NOT NULL
);

CREATE TABLE final_quiz_questions (
  id TEXT PRIMARY KEY NOT NULL,
  course_id TEXT NOT NULL REFERENCES courses(id) ON DELETE CASCADE,
  question_blob TEXT NOT NULL
);

CREATE TABLE course_progress (
  user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  course_id TEXT NOT NULL REFERENCES courses(id) ON DELETE CASCADE,
  started INTEGER NOT NULL DEFAULT 0,
  seed_granted INTEGER NOT NULL DEFAULT 0,
  land_cleared INTEGER NOT NULL DEFAULT 0,
  planted INTEGER NOT NULL DEFAULT 0,
  chapters_read TEXT NOT NULL DEFAULT '[]',
  challenge_passed TEXT NOT NULL DEFAULT '[]',
  challenge_mistakes TEXT NOT NULL DEFAULT '[]',
  verification TEXT NOT NULL DEFAULT 'none',
  harvested INTEGER NOT NULL DEFAULT 0,
  recent_activity TEXT NOT NULL DEFAULT '[]',
  completed_at TEXT,
  created_at TEXT NOT NULL DEFAULT (CURRENT_TIMESTAMP),
  updated_at TEXT NOT NULL DEFAULT (CURRENT_TIMESTAMP),
  PRIMARY KEY (user_id, course_id)
);

CREATE TABLE challenge_attempts (
  id TEXT PRIMARY KEY NOT NULL,
  user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  course_id TEXT NOT NULL,
  chapter_number INTEGER NOT NULL,
  attempt_number INTEGER NOT NULL,
  answers_blob TEXT NOT NULL,
  passed INTEGER NOT NULL DEFAULT 0,
  created_at TEXT NOT NULL DEFAULT (CURRENT_TIMESTAMP)
);

CREATE TABLE final_quiz_attempts (
  id TEXT PRIMARY KEY NOT NULL,
  user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  course_id TEXT NOT NULL,
  answers_blob TEXT NOT NULL,
  passed INTEGER NOT NULL DEFAULT 0,
  created_at TEXT NOT NULL DEFAULT (CURRENT_TIMESTAMP)
);

CREATE TABLE exp_ledger (
  id TEXT PRIMARY KEY NOT NULL,
  user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  amount INTEGER NOT NULL,
  source TEXT NOT NULL,
  reference_id TEXT NOT NULL,
  created_at TEXT NOT NULL DEFAULT (CURRENT_TIMESTAMP)
);

CREATE TABLE achievements (
  id TEXT PRIMARY KEY NOT NULL,
  user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  type TEXT NOT NULL,
  course_id TEXT REFERENCES courses(id) ON DELETE SET NULL,
  data_blob TEXT,
  earned_at TEXT NOT NULL DEFAULT (CURRENT_TIMESTAMP)
);
CREATE UNIQUE INDEX unique_achievement_idx ON achievements (user_id, type);

CREATE TABLE nft_qualifications (
  id TEXT PRIMARY KEY NOT NULL,
  user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  course_id TEXT NOT NULL REFERENCES courses(id) ON DELETE CASCADE,
  status TEXT NOT NULL DEFAULT 'eligible',
  created_at TEXT NOT NULL DEFAULT (CURRENT_TIMESTAMP)
);
CREATE UNIQUE INDEX unique_nft_qualification_idx ON nft_qualifications (user_id, course_id);

CREATE TABLE nft_minting (
  id TEXT PRIMARY KEY NOT NULL,
  qualification_id TEXT NOT NULL REFERENCES nft_qualifications(id) ON DELETE CASCADE,
  user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  wallet_address TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'pending',
  tx_hash TEXT,
  token_id TEXT,
  contract_address TEXT,
  chain_id INTEGER,
  created_at TEXT NOT NULL DEFAULT (CURRENT_TIMESTAMP),
  minted_at TEXT
);

CREATE TABLE system_logs (
  id TEXT PRIMARY KEY NOT NULL,
  actor_id TEXT,
  action TEXT NOT NULL,
  target_type TEXT,
  target_id TEXT,
  before_state TEXT,
  after_state TEXT,
  reason TEXT,
  created_at TEXT NOT NULL DEFAULT (CURRENT_TIMESTAMP)
);

CREATE TABLE audit_sessions (
  id TEXT PRIMARY KEY NOT NULL,
  user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  course_id TEXT NOT NULL REFERENCES courses(id) ON DELETE CASCADE,
  audit_type TEXT NOT NULL DEFAULT 'manual',
  status TEXT NOT NULL DEFAULT 'pending',
  items_json TEXT NOT NULL DEFAULT '[]',
  started_at TEXT,
  completed_at TEXT,
  created_at TEXT NOT NULL DEFAULT (CURRENT_TIMESTAMP)
);

CREATE TABLE system_config (
  key TEXT PRIMARY KEY NOT NULL,
  value TEXT NOT NULL,
  updated_at TEXT NOT NULL DEFAULT (CURRENT_TIMESTAMP)
);

-- ---------------------------------------------------------------------------
-- 3. 种子数据
-- ---------------------------------------------------------------------------

-- 课程
INSERT OR IGNORE INTO courses (id, slug, title, seed_type, crop_type, description, "order", prerequisites, version, status)
VALUES ('web3', 'web3', 'Web3 通识', '账本星种', '守护浆果', '理解账户、钱包、交易和基础安全，能够判断常见风险。', 1, '[]', '1.0.0', 'available');

INSERT OR IGNORE INTO courses (id, slug, title, seed_type, crop_type, description, "order", prerequisites, version, status)
VALUES ('monad', 'monad', 'Monad 基础', '并行紫藤种', 'Monad 紫藤果', '认识 Monad、RPC、区块浏览器与测试环境。', 2, '["web3"]', '1.0.0', 'available');

INSERT OR IGNORE INTO courses (id, slug, title, seed_type, crop_type, description, "order", prerequisites, version, status)
VALUES ('contract', 'contract', '智能合约', '合约卷轴种', '合约晶果', '理解合约状态、函数、ABI、事件与权限风险。', 3, '["monad"]', '1.0.0', 'locked');

-- Web3 章节
INSERT OR IGNORE INTO chapters (id, course_id, number, title, pace, objective, body, terms, example, caution, is_safety, knowledge_card)
VALUES ('account', 'web3', 1, '区块链、账户与地址', '认识 / 破冰', '学完你会知道，链上的账本为什么改不了、钱包地址是不是秘密。', '区块链可以理解成一本所有人都能看、但没人能私自涂改的账本。', '["区块链","钱包地址","不可篡改"]', '你可以把钱包地址发给朋友收款，就像告诉别人银行卡号。', '地址公开不等于什么都能分享。私钥和助记词必须始终保密。', 0, '{"definition":"区块链是一本公开、不可篡改的账本。","reason":"理解公开可查和资产安全是两回事。","visibleResult":"区块浏览器上任意地址的历史交易记录。","stateChange":"只有发起交易的写入操作会改变账本。","checkBeforeAction":"本章无需操作，只需理解概念。"}');

INSERT OR IGNORE INTO chapters (id, course_id, number, title, pace, objective, body, terms, example, caution, is_safety, knowledge_card)
VALUES ('transaction', 'web3', 2, '读取、签名与交易', '熟练 / 巩固', '学完你会分辨哪些操作不用签名，以及一笔交易怎样从发起走到确认。', '链上操作分为读取和写入。查询余额等是读取；转账等是写入，需要签名。', '["读取操作","写入操作","签名","Gas"]', '查看钱包里的 USDC 是读取；把 100 USDC 转给朋友是写入。', '签名意味着授权，不要在没有看清内容时随手确认。', 0, '{"definition":"读取是查看链上数据，写入是改变链上数据并需要签名授权。","reason":"分清两者，才能判断当前步骤是否应该请求确认。","visibleResult":"读取时直接显示结果；写入时钱包会弹出签名请求。","stateChange":"转账等写入操作会改变链上状态，查询不会。","checkBeforeAction":"签名前确认操作内容和对象正是你想做的事。"}');

INSERT OR IGNORE INTO chapters (id, course_id, number, title, pace, objective, body, terms, example, caution, is_safety, knowledge_card)
VALUES ('security', 'web3', 3, '私钥、助记词与签名风险', '认真收尾 / 风险判断', '学完你会知道什么绝对不能分享，以及哪些签名请求必须拒绝。', '钱包地址是公开的门牌号，但私钥和助记词是控制地址中全部资产的万能钥匙。', '["私钥","助记词","盲签"]', '银行不会询问银行卡密码；同样，任何 Web3 项目方都不需要你的助记词。', '交出助记词等于交出全部控制权。签名前必须看清授权内容。', 1, '{"definition":"私钥和助记词代表完全控制权，签名代表对单次操作的授权。","reason":"泄露密钥和盲签是链上资产被盗的主要原因。","visibleResult":"钓鱼信息常伪装成官方活动；风险签名常来自陌生 DApp。","stateChange":"交出助记词会失去控制权；盲签可能授权他人转走资产。","checkBeforeAction":"索要助记词的请求直接拒绝；签名前看清授权内容。"}');

-- Web3 挑战题
INSERT OR IGNORE INTO challenge_questions (id, chapter_id, type, question_blob, success_msg, failure_msg)
VALUES ('account-confirmed-record', 'account', 'choice', '{"scene":"农场的老邻居问你","prompt":"区块链上的交易记录一旦被网络确认，任何单方都无法私自修改。","options":[{"id":"true","label":"正确"},{"id":"false","label":"错误"}],"answer":"true"}', '没错，这片地的账本，谁也偷偷改不了。', '如果账本能被一个人偷偷改，大家还会信这本账吗？');

INSERT OR IGNORE INTO challenge_questions (id, chapter_id, type, question_blob, success_msg, failure_msg)
VALUES ('transaction-read-signature', 'transaction', 'choice', '{"scene":"你在仓库门口，只想看看还有多少 USDC。","prompt":"只是查看余额，需要签名确认吗？","options":[{"id":"a","label":"A. 需要"},{"id":"b","label":"B. 不需要"}],"answer":"b"}', '对，看看货架不用签字。', '这一步有没有真的改变钱包里的东西？');

INSERT OR IGNORE INTO challenge_questions (id, chapter_id, type, question_blob, success_msg, failure_msg)
VALUES ('transaction-order', 'transaction', 'order', '{"scene":"你要给隔壁农场寄一批货。","prompt":"选择正确的交易流程顺序。","options":[{"id":"2-3-1-4","label":"签名→广播→打包进区块→网络确认"},{"id":"3-2-4-1","label":"广播→签名→网络确认→打包进区块"},{"id":"1-2-3-4","label":"打包进区块→签名→广播→网络确认"}],"answer":"2-3-1-4"}', '顺序正确，这就是一笔交易从发起到完成的旅程。', '先有人签名表示我要发起，消息才能广播并等待网络打包确认。');

INSERT OR IGNORE INTO challenge_questions (id, chapter_id, type, question_blob, success_msg, failure_msg)
VALUES ('security-seed-phrase', 'security', 'choice', '{"scene":"你收到一条自称官方空投活动的私信。","prompt":"对方要求输入助记词领取奖励，你应该怎么做？","options":[{"id":"a","label":"A. 输入助记词，尽快领取"},{"id":"b","label":"B. 拒绝提供，正规渠道不会索要助记词"}],"answer":"b"}', '守住了。这是最常见的骗术之一。', '交出助记词等于把资产的完全控制权交给对方，而且无法撤销。');

INSERT OR IGNORE INTO challenge_questions (id, chapter_id, type, question_blob, success_msg, failure_msg)
VALUES ('security-blind-sign', 'security', 'choice', '{"scene":"陌生网站弹出看不懂的签名请求，并不断催促你尽快确认。","prompt":"你应该如何处理？","options":[{"id":"a","label":"A. 先签了看看，之后还能后悔"},{"id":"b","label":"B. 不确认，先弄清授权内容，必要时关闭页面"}],"answer":"b"}', '对。看不懂就不签，催促操作本身也是常见的施压信号。', '签名一旦确认就无法撤销。看不懂授权内容时必须拒绝。');

-- Web3 结课小测
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

-- Monad 章节
INSERT OR IGNORE INTO chapters (id, course_id, number, title, pace, objective, body, terms, example, caution, is_safety, knowledge_card)
VALUES ('monad-evm', 'monad', 1, 'Monad 与 EVM', '认识 / 破冰', '学完你会知道，Monad 和以太坊的开发生态是什么关系。', 'Monad 兼容 EVM（以太坊虚拟机），这意味着原本部署在以太坊上的智能合约通常只需少量修改就能部署到 Monad 上。', '["EVM 兼容","RPC"]', '一个原本跑在以太坊上的兑换合约，开发者稍作调整就能部署到 Monad。', '"兼容"只是开发层面的便利，操作时依然要核对自己连接的是不是 Monad 网络。', 0, '{"definition":"Monad 是一条兼容 EVM 的高性能公链。","reason":"理解这一点能解释为什么 Monad 生态发展得很快。","visibleResult":"熟悉的 DApp 类型在 Monad 上也能找到对应版本。","stateChange":"本章为概念章节，不涉及具体操作。","checkBeforeAction":"操作前确认钱包连接的网络确实是 Monad。"}');

INSERT OR IGNORE INTO chapters (id, course_id, number, title, pace, objective, body, terms, example, caution, is_safety, knowledge_card)
VALUES ('monad-rpc', 'monad', 2, 'RPC、区块与浏览器', '熟练 / 巩固', '学完你会用区块浏览器查一笔交易，并知道 Gas 不能说明交易是否成功。', '区块浏览器是查看链上一切公开信息的窗口，每个网络都有自己独立的浏览器。', '["区块浏览器","交易回执","区块高度"]', '把交易哈希粘贴进 Monad 区块浏览器搜索框，就能看到这笔交易的完整状态。', '查交易时认准官方或可信的区块浏览器地址，避免打开仿冒页面。', 0, '{"definition":"区块浏览器是查询链上公开数据的窗口，回执是判断交易成败的依据。","reason":"能自己核实一笔交易，而不是只听别人说。","visibleResult":"交易哈希、状态字段、区块高度和 Gas 消耗。","stateChange":"查询是读取操作，不改变任何状态。","checkBeforeAction":"确认打开的是官方或可信的区块浏览器地址。"}');

INSERT OR IGNORE INTO chapters (id, course_id, number, title, pace, objective, body, terms, example, caution, is_safety, knowledge_card)
VALUES ('monad-testnet', 'monad', 3, '测试环境与资产安全', '认真收尾 / 严肃模式', '学完你会分清测试网和主网、能识别围绕测试资产展开的骗局。', '测试网络上的资产本身没有真实价值，唯一作用是让你在不花真钱的情况下练习操作。', '["测试网","主网","网络核对"]', '朋友说想用 100 元人民币收购你测试网里的 1000 个测试 MON，这类交易应该被直接拒绝。', '测试资产没有真实价值；涉及真钱或陌生网络切换的请求必须先核实。', 1, '{"definition":"测试网资产没有真实价值，仅用于练习。","reason":"能识别测试币变现类骗局。","visibleResult":"钱包界面通常会标注当前所在网络是测试网还是主网。","stateChange":"切换到陌生网络后进行的操作可能涉及真实资产风险。","checkBeforeAction":"确认当前网络符合预期，拒绝任何测试币换真钱的交易请求。"}');

-- Monad 挑战题
INSERT OR IGNORE INTO challenge_questions (id, chapter_id, type, question_blob, success_msg, failure_msg)
VALUES ('monad-evm-compatible', 'monad-evm', 'choice', '{"scene":"你发现隔壁以太坊农场的种植工具，好像稍微改改就能直接在 Monad 农场用。","prompt":"Monad 兼容 EVM，意味着原本部署在以太坊上的智能合约，通常只需少量修改就能部署到 Monad 上。","options":[{"id":"true","label":"正确"},{"id":"false","label":"错误"}],"answer":"true"}', '对，这也是为什么 Monad 农场能这么快就热闹起来。', '再想想：如果两条链的底层规则差不多，那开发者是不是就不用从零重写代码了？');

INSERT OR IGNORE INTO challenge_questions (id, chapter_id, type, question_blob, success_msg, failure_msg)
VALUES ('monad-receipt-status', 'monad-rpc', 'choice', '{"scene":"你想确认一笔货有没有真的送到。","prompt":"想知道一笔 Monad 交易到底成功了没有，该看什么？","options":[{"id":"a","label":"A. Gas 价格"},{"id":"b","label":"B. 交易回执的状态"}],"answer":"b"}', '运费只能说明花了多少钱，回执才能告诉你东西到底送到没有。', '花了钱和东西送没送到，是一回事吗？');

INSERT OR IGNORE INTO challenge_questions (id, chapter_id, type, question_blob, success_msg, failure_msg)
VALUES ('monad-explorer-order', 'monad-rpc', 'order', '{"scene":"你想弄清楚朋友发给你的那笔交易到底是什么情况。","prompt":"选择使用区块浏览器查询交易的正确顺序。","options":[{"id":"2-1-3-4","label":"复制哈希→打开浏览器→粘贴查询→查看状态"},{"id":"1-2-4-3","label":"打开浏览器→复制哈希→查看状态→粘贴查询"},{"id":"3-1-2-4","label":"粘贴查询→打开浏览器→复制哈希→查看状态"}],"answer":"2-1-3-4"}', '对，这就是核实一笔交易最基本的步骤。', '先准备交易哈希，再打开对应浏览器、粘贴查询，最后查看状态和区块高度。');

INSERT OR IGNORE INTO challenge_questions (id, chapter_id, type, question_blob, success_msg, failure_msg)
VALUES ('monad-test-token-sale', 'monad-testnet', 'choice', '{"scene":"朋友想用 100 元人民币收购你测试网钱包里的 1000 个测试 MON。","prompt":"你应该怎么做？","options":[{"id":"a","label":"A. 可以卖，反正是测试代币"},{"id":"b","label":"B. 不参与；测试资产没有真实价值，这很可能是骗局"}],"answer":"b"}', '守住了。练习用的资产一旦有人想用真钱换，就要多留个心眼。', '测试资产本身没有真实价值，这类交易背后往往是诈骗话术，不要参与。');

INSERT OR IGNORE INTO challenge_questions (id, chapter_id, type, question_blob, success_msg, failure_msg)
VALUES ('monad-unknown-network', 'monad-testnet', 'choice', '{"scene":"钱包突然要求你切换到一个从没见过的陌生网络才能完成操作。","prompt":"你应该怎么处理？","options":[{"id":"a","label":"A. 先切换过去再说"},{"id":"b","label":"B. 先核实网络来源和切换原因"}],"answer":"b"}', '对。网络切换请求背后可能涉及资产风险，先核实没有错。', '陌生网络切换请求是常见风险来源，不清楚来源和目的前不要直接同意。');

-- Monad 结课小测
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
