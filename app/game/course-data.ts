export type KnowledgeCard = {
  definition: string;
  reason: string;
  visibleResult: string;
  stateChange: string;
  checkBeforeAction: string;
};

export type ChallengeQuestion = {
  id: string;
  kind: "choice" | "order";
  scene: string;
  prompt: string;
  options: { id: string; label: string }[];
  answer: string;
  success: string;
  failure: string;
};

export type Chapter = {
  id: "account" | "transaction" | "security" | "monad-evm" | "monad-rpc" | "monad-testnet" | "contract-state" | "contract-abi" | "contract-receipt";
  number: number;
  title: string;
  pace: string;
  objective: string;
  body: string;
  terms: string[];
  example: string;
  caution: string;
  safety: boolean;
  knowledge: KnowledgeCard;
  challenges: ChallengeQuestion[];
};

export type FinalQuestion = {
  id: string;
  prompt: string;
  options: { id: string; label: string }[];
  answer: string;
};

export const courseRoute = [
  {
    id: "web3",
    order: 1,
    title: "Web3 通识",
    seed: "账本星种",
    crop: "守护浆果",
    status: "available",
    description: "理解账户、钱包、交易和基础安全，能够判断常见风险。",
  },
  {
    id: "monad",
    order: 2,
    title: "Monad 基础",
    seed: "并行紫藤种",
    crop: "Monad 紫藤果",
    status: "locked",
    description: "认识 Monad、RPC、区块浏览器与测试环境。",
  },
  {
    id: "contract",
    order: 3,
    title: "智能合约",
    seed: "合约卷轴种",
    crop: "合约晶果",
    status: "locked",
    description: "理解合约状态、函数、ABI、事件与权限风险。",
  },
] as const;

export const web3Chapters: Chapter[] = [
  {
    id: "account",
    number: 1,
    title: "区块链、账户与地址",
    pace: "认识 / 破冰",
    objective: "学完你会知道，链上的账本为什么改不了、钱包地址是不是秘密。",
    body:
      "区块链可以理解成一本所有人都能看、但没人能私自涂改的账本。每一笔交易被确认后，会通过密码学哈希和前一笔记录锁在一起。改动其中一笔，后面所有记录都会对不上，这就是不可篡改的来源。钱包地址像账本上的身份编号，任何人都可以查到它的历史交易；真正决定谁能操作这个地址的，是只有你自己保管的私钥和助记词。",
    terms: ["区块链", "钱包地址", "不可篡改"],
    example:
      "你可以把钱包地址发给朋友收款，就像告诉别人银行卡号；别人能看到号码，但不能因此拿走资产。",
    caution:
      "地址公开不等于什么都能分享。私钥和助记词必须始终保密。",
    safety: false,
    knowledge: {
      definition: "区块链是一本公开、不可篡改的账本。",
      reason: "理解公开可查和资产安全是两回事，是后续安全判断的基础。",
      visibleResult: "区块浏览器上任意地址的历史交易记录。",
      stateChange: "只有发起交易的写入操作会改变账本，单纯查看不会。",
      checkBeforeAction: "本章无需操作，只需理解概念。",
    },
    challenges: [
      {
        id: "account-confirmed-record",
        kind: "choice",
        scene: "农场的老邻居问你：听说链上的账本，谁都改不了？",
        prompt: "区块链上的交易记录一旦被网络确认，任何单方都无法私自修改。",
        options: [
          { id: "true", label: "正确" },
          { id: "false", label: "错误" },
        ],
        answer: "true",
        success: "没错，这片地的账本，谁也偷偷改不了。",
        failure: "如果账本能被一个人偷偷改，大家还会信这本账吗？再看一眼知识卡。",
      },
    ],
  },
  {
    id: "transaction",
    number: 2,
    title: "读取、签名与交易",
    pace: "熟练 / 巩固",
    objective: "学完你会分辨哪些操作不用签名，以及一笔交易怎样从发起走到确认。",
    body:
      "链上操作分为读取和写入。查询余额、查看交易记录只是读取账本中已有内容，不会改变任何东西，因此不需要签名，也不花 Gas。转账等会改变账本状态的操作属于写入，必须由用户签名授权。一笔写入交易依次经历：用户签名、交易广播、打包进区块、网络确认。签名代表你同意这件事发生。",
    terms: ["读取操作", "写入操作", "签名", "Gas"],
    example:
      "查看钱包里的 USDC 是读取；把 100 USDC 转给朋友是写入，需要签名确认。",
    caution: "签名意味着授权，不要在没有看清内容时随手确认。",
    safety: false,
    knowledge: {
      definition: "读取是查看链上数据，写入是改变链上数据并需要签名授权。",
      reason: "分清两者，才能判断当前步骤是否应该请求你的确认。",
      visibleResult: "读取时直接显示结果；写入时钱包会弹出签名请求。",
      stateChange: "转账等写入操作会改变链上状态，查询不会。",
      checkBeforeAction: "签名前确认操作内容和对象正是你想做的事。",
    },
    challenges: [
      {
        id: "transaction-read-signature",
        kind: "choice",
        scene: "你在仓库门口，只想看看还有多少 USDC。",
        prompt: "只是查看余额，需要签名确认吗？",
        options: [
          { id: "a", label: "A. 需要" },
          { id: "b", label: "B. 不需要" },
        ],
        answer: "b",
        success: "对，看看货架不用签字，仓库也不会因为看一眼而变化。",
        failure: "这一步有没有真的改变钱包里的东西？读取不会改变状态。",
      },
      {
        id: "transaction-order",
        kind: "order",
        scene: "你要给隔壁农场寄一批货，需要按正确顺序完成手续。",
        prompt: "选择正确的交易流程顺序。",
        options: [
          { id: "2-3-1-4", label: "签名 → 广播 → 打包进区块 → 网络确认" },
          { id: "3-2-4-1", label: "广播 → 签名 → 网络确认 → 打包进区块" },
          { id: "1-2-3-4", label: "打包进区块 → 签名 → 广播 → 网络确认" },
        ],
        answer: "2-3-1-4",
        success: "顺序正确，这就是一笔交易从发起到完成的旅程。",
        failure: "先有人签名表示我要发起，消息才能广播并等待网络打包确认。",
      },
    ],
  },
  {
    id: "security",
    number: 3,
    title: "私钥、助记词与签名风险",
    pace: "认真收尾 / 风险判断",
    objective: "学完你会知道什么绝对不能分享，以及哪些签名请求必须拒绝。",
    body:
      "钱包地址是公开的门牌号，但私钥和助记词是控制地址中全部资产的万能钥匙。一旦泄露，任何人都可以直接转走资产，而且无法撤销。任何自称官方的活动、客服或空投，只要要求输入助记词或私钥，都必须立即判定为风险。签名请求也要看清内容；看不懂就确认的盲签，是另一类常见风险。",
    terms: ["私钥", "助记词", "盲签"],
    example:
      "银行不会询问银行卡密码；同样，任何 Web3 项目方都不需要你的助记词才能发放奖励。",
    caution:
      "交出助记词等于交出全部控制权。签名前必须看清授权内容。",
    safety: true,
    knowledge: {
      definition: "私钥和助记词代表完全控制权，签名代表对单次操作的授权。",
      reason: "泄露密钥和盲签是链上资产被盗的主要原因。",
      visibleResult: "钓鱼信息常伪装成官方活动；风险签名常来自陌生 DApp。",
      stateChange: "交出助记词会失去控制权；盲签可能授权他人转走资产。",
      checkBeforeAction: "索要助记词的请求直接拒绝；签名前看清授权内容。",
    },
    challenges: [
      {
        id: "security-seed-phrase",
        kind: "choice",
        scene: "你收到一条自称官方空投活动的私信。",
        prompt: "对方要求输入助记词领取奖励，你应该怎么做？",
        options: [
          { id: "a", label: "A. 输入助记词，尽快领取" },
          { id: "b", label: "B. 拒绝提供，正规渠道不会索要助记词" },
        ],
        answer: "b",
        success: "守住了。这是最常见的骗术之一，你的判断是对的。",
        failure:
          "交出助记词等于把资产的完全控制权交给对方，而且无法撤销。任何索要助记词的请求都必须拒绝。",
      },
      {
        id: "security-blind-sign",
        kind: "choice",
        scene: "陌生网站弹出看不懂的签名请求，并不断催促你尽快确认。",
        prompt: "你应该如何处理？",
        options: [
          { id: "a", label: "A. 先签了看看，之后还能后悔" },
          { id: "b", label: "B. 不确认，先弄清授权内容，必要时关闭页面" },
        ],
        answer: "b",
        success: "对。看不懂就不签，催促操作本身也是常见的施压信号。",
        failure:
          "签名一旦确认就无法撤销。看不懂授权内容时必须拒绝，而不是先试试看。",
      },
    ],
  },
];

export const finalQuiz: FinalQuestion[] = [
  {
    id: "confirmed-record",
    prompt: "区块链上的交易一旦确认，无法被单方面修改。",
    options: [
      { id: "true", label: "正确" },
      { id: "false", label: "错误" },
    ],
    answer: "true",
  },
  {
    id: "public-address",
    prompt: "钱包地址属于公开信息，任何人都可以查询其历史交易。",
    options: [
      { id: "true", label: "正确" },
      { id: "false", label: "错误" },
    ],
    answer: "true",
  },
  {
    id: "read-signature",
    prompt: "查询余额是否需要签名？",
    options: [
      { id: "a", label: "A. 需要" },
      { id: "b", label: "B. 不需要" },
    ],
    answer: "b",
  },
  {
    id: "shareable",
    prompt: "以下哪个可以放心分享？",
    options: [
      { id: "a", label: "A. 钱包地址" },
      { id: "b", label: "B. 助记词" },
    ],
    answer: "a",
  },
  {
    id: "official-message",
    prompt: "收到索要助记词的官方活动私信，应该怎么做？",
    options: [
      { id: "a", label: "A. 按要求提供" },
      { id: "b", label: "B. 拒绝提供" },
    ],
    answer: "b",
  },
];

export const agentQuestions = [
  "钱包地址发给陌生人，会直接导致资产被盗吗？",
  "为什么查看余额不用签名，但转账需要签名？",
  "有人索要助记词领取空投时，你会如何判断？",
] as const;

export const monadChapters: Chapter[] = [
  {
    id: "monad-evm",
    number: 1,
    title: "Monad 与 EVM",
    pace: "认识 / 破冰",
    objective: "学完你会知道，Monad 和以太坊的开发生态是什么关系。",
    body: "Monad 兼容 EVM（以太坊虚拟机），这意味着原本部署在以太坊上的智能合约，通常只需少量甚至无需修改就能部署到 Monad 上，开发者熟悉的工具和代码可以直接复用。这也是 Monad 生态能够快速积累应用的关键原因之一。但“兼容”不代表“完全相同”——网络地址、RPC 节点、浏览器都是 Monad 独立的一套，不能和以太坊的混用。",
    terms: ["EVM 兼容", "RPC"],
    example: "一个原本跑在以太坊上的兑换合约，开发者稍作调整就能部署到 Monad，这也是为什么 Monad 上很快就出现了很多熟悉的应用类型。",
    caution: "“兼容”只是开发层面的便利，操作时依然要核对自己连接的是不是 Monad 网络。",
    safety: false,
    knowledge: {
      definition: "Monad 是一条兼容 EVM 的高性能公链。",
      reason: "理解这一点能解释为什么 Monad 生态发展得很快。",
      visibleResult: "熟悉的 DApp 类型，例如 Swap、质押，在 Monad 上也能找到对应版本。",
      stateChange: "本章为概念章节，不涉及具体操作。",
      checkBeforeAction: "操作前确认钱包连接的网络确实是 Monad，而不是以太坊或其他链。",
    },
    challenges: [{
      id: "monad-evm-compatible",
      kind: "choice",
      scene: "你发现隔壁以太坊农场的种植工具，好像稍微改改就能直接在 Monad 农场用。",
      prompt: "Monad 兼容 EVM，意味着原本部署在以太坊上的智能合约，通常只需少量甚至无需修改就能部署到 Monad 上。",
      options: [{ id: "true", label: "正确" }, { id: "false", label: "错误" }],
      answer: "true",
      success: "对，这也是为什么 Monad 农场能这么快就热闹起来——很多好用的工具直接就能搬过来用。",
      failure: "再想想：如果两条链的底层规则差不多，那开发者是不是就不用从零重写代码了？",
    }],
  },
  {
    id: "monad-rpc",
    number: 2,
    title: "RPC、区块与浏览器",
    pace: "熟练 / 巩固",
    objective: "学完你会用区块浏览器查一笔交易，并知道 Gas 不能说明交易是否成功。",
    body: "区块浏览器是查看链上一切公开信息的窗口——每个网络都有自己独立的浏览器，Monad 上的交易要用 Monad 对应的浏览器查询，不能拿以太坊浏览器去查。想确认一笔交易到底成功没有，不能只看 Gas 花了多少钱，Gas 只能说明“花费了多少”，真正判断成败的依据是交易回执（Receipt）里的状态字段。区块高度则代表账本增长到了哪一页，越新的区块高度越靠后。",
    terms: ["区块浏览器", "交易回执", "区块高度"],
    example: "把交易哈希粘贴进 Monad 区块浏览器搜索框，就能看到这笔交易的完整状态和详情。",
    caution: "查交易时认准官方或可信的区块浏览器地址，避免打开仿冒页面。",
    safety: false,
    knowledge: {
      definition: "区块浏览器是查询链上公开数据的窗口，回执是判断交易成败的依据。",
      reason: "能自己核实一笔交易，而不是只听别人说。",
      visibleResult: "交易哈希、状态字段、区块高度和 Gas 消耗。",
      stateChange: "查询是读取操作，不改变任何状态。",
      checkBeforeAction: "确认打开的是官方或可信的区块浏览器地址，而不是仿冒页面。",
    },
    challenges: [
      {
        id: "monad-receipt-status",
        kind: "choice",
        scene: "你想确认一笔货有没有真的送到。",
        prompt: "想知道一笔 Monad 交易到底成功了没有，该看什么？",
        options: [{ id: "a", label: "A. Gas 价格" }, { id: "b", label: "B. 交易回执的状态" }],
        answer: "b",
        success: "运费只能说明花了多少钱，回执才能告诉你东西到底送到没有。",
        failure: "再想想：花了钱和东西送没送到，是一回事吗？",
      },
      {
        id: "monad-explorer-order",
        kind: "order",
        scene: "你想弄清楚朋友发给你的那笔交易到底是什么情况。",
        prompt: "选择使用区块浏览器查询交易的正确顺序。",
        options: [
          { id: "2-1-3-4", label: "② 复制交易哈希 → ① 打开 Monad 区块浏览器 → ③ 粘贴查询 → ④ 查看状态和区块高度" },
          { id: "1-2-4-3", label: "① 打开浏览器 → ② 复制交易哈希 → ④ 查看状态 → ③ 粘贴查询" },
          { id: "3-1-2-4", label: "③ 粘贴查询 → ① 打开浏览器 → ② 复制交易哈希 → ④ 查看状态" },
        ],
        answer: "2-1-3-4",
        success: "对，这就是核实一笔交易最基本的步骤。",
        failure: "先准备交易哈希，再打开对应浏览器、粘贴查询，最后查看状态和区块高度。",
      },
    ],
  },
  {
    id: "monad-testnet",
    number: 3,
    title: "测试环境与资产安全",
    pace: "认真收尾 / 严肃模式",
    objective: "学完你会分清测试网和主网、能识别围绕测试资产展开的骗局。",
    body: "测试网络上的资产（包括测试用的 MON）本身没有真实价值，唯一作用是让你在不花真钱的情况下练习操作。任何围绕“用真钱换测试币”或“测试币换真钱”展开的交易，背后往往是诈骗话术。操作前一定要核对自己连接的网络是不是预期的那一个，陌生网络的切换请求也是常见的风险来源之一。",
    terms: ["测试网", "主网", "网络核对"],
    example: "朋友说想用 100 元人民币收购你测试网里的 1000 个测试 MON，这类交易应该被直接拒绝。",
    caution: "测试资产没有真实价值；涉及真钱或陌生网络切换的请求必须先核实。",
    safety: true,
    knowledge: {
      definition: "测试网资产没有真实价值，仅用于练习。",
      reason: "能识别测试币变现类骗局。",
      visibleResult: "钱包界面通常会标注当前所在网络是测试网还是主网。",
      stateChange: "切换到陌生网络后进行的操作可能涉及真实资产风险。",
      checkBeforeAction: "确认当前网络符合预期，拒绝任何测试币换真钱的交易请求。",
    },
    challenges: [
      {
        id: "monad-test-token-sale",
        kind: "choice",
        scene: "朋友想用 100 元人民币收购你测试网钱包里的 1000 个测试 MON。",
        prompt: "你应该怎么做？",
        options: [{ id: "a", label: "A. 可以卖，反正是测试代币" }, { id: "b", label: "B. 不参与；测试资产没有真实价值，这很可能是骗局" }],
        answer: "b",
        success: "守住了。练习用的资产一旦有人想用真钱换，就要多留个心眼。",
        failure: "测试资产本身没有真实价值，这类交易背后往往是诈骗话术，不要参与。",
      },
      {
        id: "monad-unknown-network",
        kind: "choice",
        scene: "钱包突然要求你切换到一个从没见过的陌生网络才能完成操作。",
        prompt: "你应该怎么处理？",
        options: [{ id: "a", label: "A. 先切换过去再说" }, { id: "b", label: "B. 先核实网络来源和切换原因" }],
        answer: "b",
        success: "对。网络切换请求背后可能涉及资产风险，先核实没有错。",
        failure: "陌生网络切换请求是常见风险来源，不清楚来源和目的前不要直接同意。",
      },
    ],
  },
];

export const monadFinalQuiz: FinalQuestion[] = [
  { id: "monad-evm-migration", prompt: "Monad 兼容 EVM，意味着大部分以太坊合约代码可以较快迁移过来。", options: [{ id: "true", label: "正确" }, { id: "false", label: "错误" }], answer: "true" },
  { id: "monad-independent-explorer", prompt: "不同链有各自独立的区块浏览器，一般不能直接用来查另一条链的交易。", options: [{ id: "true", label: "正确" }, { id: "false", label: "错误" }], answer: "true" },
  { id: "monad-receipt", prompt: "判断一笔 Monad 交易是否成功，应该看什么？", options: [{ id: "a", label: "A. Gas 价格" }, { id: "b", label: "B. 交易回执的状态字段" }], answer: "b" },
  { id: "monad-test-value", prompt: "测试网络里的 MON 代币是否有真实价值？", options: [{ id: "a", label: "A. 没有真实价值，仅用于测试" }, { id: "b", label: "B. 和主网 MON 等值" }], answer: "a" },
  { id: "monad-test-sale", prompt: "有人想用真钱收购你测试网里的代币，你应该？", options: [{ id: "a", label: "A. 谨慎对待，这很可能是骗局" }, { id: "b", label: "B. 可以卖，反正是测试币" }], answer: "a" },
];

export const monadAgentQuestions = [
  "为什么原本在以太坊上的合约能很快部署到 Monad 上？",
  "怎么确认一笔 Monad 交易到底成功了没有？",
  "朋友想用真钱换你测试网里的 MON，你会怎么判断？",
] as const;

export const contractChapters: Chapter[] = [
  {
    id: "contract-state",
    number: 1,
    title: "合约、状态与函数",
    pace: "认识 / 破冰",
    objective: "学完你会知道，智能合约是什么、部署之后能不能被随意改动。",
    body: "智能合约可以理解为部署在链上、按固定规则自动执行的程序。它有自己的“状态”，比如记录了谁存了多少钱；也有可以被调用的“函数”，比如存款、取款、查询余额。合约一旦部署，代码本身默认不能被随意修改。这既是规则透明、不能被人为篡改的来源，也意味着如果代码本身有漏洞，通常无法事后偷偷改掉，因此安全审计非常重要。",
    terms: ["智能合约", "状态", "函数"],
    example: "一个存款合约的状态记录着每个地址存了多少钱，调用它的存款函数会改变这个状态。",
    caution: "合约代码公开可查，但普通用户不需要自己读代码；后续章节会说明如何通过回执判断结果。",
    safety: false,
    knowledge: {
      definition: "智能合约是部署在链上、按固定规则自动执行的程序。",
      reason: "理解“规则写在代码里”是链上应用和普通网站的重要区别。",
      visibleResult: "与合约交互的存款、兑换或查询按钮，背后调用的就是合约函数。",
      stateChange: "调用写入类函数会改变合约记录的状态。",
      checkBeforeAction: "本章是概念章节，重点建立“合约等于自动执行规则”的认知。",
    },
    challenges: [{
      id: "contract-code-fixed",
      kind: "choice",
      scene: "仓库的自动分拣机器设定好规则后，会一直按这个规则运转。",
      prompt: "智能合约部署后，代码本身默认不能被随意修改。",
      options: [{ id: "true", label: "正确" }, { id: "false", label: "错误" }],
      answer: "true",
      success: "对，规则写在代码里，这也是智能合约公平透明的来源。",
      failure: "再想想：如果合约代码可以被人偷偷改，大家还敢把资产放进去吗？",
    }],
  },
  {
    id: "contract-abi",
    number: 2,
    title: "读取、写入与 ABI",
    pace: "熟练 / 巩固",
    objective: "学完你会知道，只读函数为什么不用付 Gas、ABI 到底是干什么的。",
    body: "合约里的函数分两类：标记为 view / pure 的只读函数，只是在本地节点上查询当前状态，不会改变链上数据，因此不需要广播交易，也不用付 Gas；会改变合约状态的写入函数，则需要签名、广播、上链，会消耗 Gas。前端和钱包要知道怎样调用函数、怎样解析返回数据，靠的是 ABI。可以把 ABI 理解成合约的说明书，没有它，前端就不知道该怎样和合约对话。",
    terms: ["只读函数", "写入函数", "ABI"],
    example: "查询某个地址存了多少钱是只读函数调用，不花 Gas；往里存钱是写入函数调用，需要签名并花 Gas。",
    caution: "调用写入函数前，核对界面展示的金额、地址等参数是否是你真正想操作的内容。",
    safety: false,
    knowledge: {
      definition: "ABI 是合约与前端应用之间怎样对话的说明书。",
      reason: "理解界面背后其实是在按 ABI 规则调用合约函数。",
      visibleResult: "只读查询即时返回结果，写入调用会弹出签名请求。",
      stateChange: "只有写入函数调用会改变合约记录的状态。",
      checkBeforeAction: "写入操作前核对金额、地址等参数是否正确。",
    },
    challenges: [
      {
        id: "contract-view-gas",
        kind: "choice",
        scene: "仓库说明书上的一些按钮只能查看，一些按钮会真的改变库存。",
        prompt: "调用合约里标记为 view / pure 的只读函数，通常需要付 Gas 吗？",
        options: [{ id: "a", label: "A. 需要" }, { id: "b", label: "B. 不需要" }],
        answer: "b",
        success: "对，只是查询当前状态，不用付 Gas；真正写入链上时才需要。",
        failure: "再想想：只是查询时，链上的数据有没有被真的改动？",
      },
      {
        id: "contract-write-order",
        kind: "order",
        scene: "你准备调用一个存款合约的写入函数。",
        prompt: "选择一次写入调用的正确顺序。",
        options: [
          { id: "2-3-4-1", label: "② 前端输入参数并点击调用 → ③ 钱包签名 → ④ 交易广播上链 → ① 合约执行并更新状态" },
          { id: "1-2-3-4", label: "① 合约先更新状态 → ② 输入参数 → ③ 钱包签名 → ④ 广播上链" },
          { id: "3-4-2-1", label: "③ 钱包先签名 → ④ 广播上链 → ② 再输入参数 → ① 更新状态" },
        ],
        answer: "2-3-4-1",
        success: "对，这就是前端、钱包和合约配合完成一次写入操作的完整顺序。",
        failure: "先在前端说明要做什么，再签名、广播，最后由合约执行并更新状态。",
      },
    ],
  },
  {
    id: "contract-receipt",
    number: 3,
    title: "回执、事件与权限风险",
    pace: "认真收尾 / 严肃模式",
    objective: "学完你会知道，怎么通过回执判断交易是否成功、什么样的授权请求要提高警惕。",
    body: "一笔与合约的交互是否真正成功，不能只看前端界面的提示文字，要看链上交易回执里的状态字段，这是唯一可信的依据。另外要特别警惕“无限额度批准”这类授权请求：一旦同意，对方合约未来可能在你不知情的情况下转走全部被授权的资产。“方便以后操作”常被风险合约用来降低警惕，遇到陌生 DApp 的这类请求，应该先核实合约来源再决定。",
    terms: ["交易回执", "事件", "无限额度批准"],
    example: "一个陌生 DApp 弹窗请求无限额度批准你的 USDC，这类请求需要先核实来源。",
    caution: "授权前确认额度是否合理、来源是否可信；交易后以链上回执状态为准，不轻信前端文案。",
    safety: true,
    knowledge: {
      definition: "回执是判断交易成败的可信依据；无限额度批准是一类高风险授权。",
      reason: "这是链上交互中常见的两类被误导风险。",
      visibleResult: "钱包弹出的授权额度请求，通常显示为具体数字或“无限”。",
      stateChange: "同意无限额度批准后，对方合约可在未来转走被授权资产，无需再次确认。",
      checkBeforeAction: "确认授权额度和合约来源，交易后核对链上回执状态。",
    },
    challenges: [
      {
        id: "contract-infinite-approval",
        kind: "choice",
        scene: "一个陌生 DApp 弹窗请求无限额度批准你的 USDC。",
        prompt: "你应该怎么处理？",
        options: [{ id: "a", label: "A. 直接同意，方便以后操作" }, { id: "b", label: "B. 谨慎处理，先核实合约来源和授权额度" }],
        answer: "b",
        success: "守住了。无限额度批准这件事，值得每次都认真对待。",
        failure: "无限额度批准意味着对方未来可能不经过你再次确认就转走资产，务必先核实来源。",
      },
      {
        id: "contract-receipt-check",
        kind: "choice",
        scene: "DApp 提示交易已完成，但区块浏览器里还没有回执确认，对方催促你继续下一步。",
        prompt: "你应该怎么做？",
        options: [{ id: "a", label: "A. 相信提示文字，直接继续" }, { id: "b", label: "B. 先核实链上回执状态，确认成功后再继续" }],
        answer: "b",
        success: "对，前端提示文字可以出错，链上回执才是判断结果的依据。",
        failure: "界面文字不能作为交易成功的依据，先核实链上回执状态再继续。",
      },
    ],
  },
];

export const contractFinalQuiz: FinalQuestion[] = [
  { id: "contract-deployed-code", prompt: "智能合约一旦部署，代码本身默认不能被随意修改。", options: [{ id: "true", label: "正确" }, { id: "false", label: "错误" }], answer: "true" },
  { id: "contract-abi-purpose", prompt: "ABI 的作用是让钱包和前端知道如何编码调用合约、解析返回结果。", options: [{ id: "true", label: "正确" }, { id: "false", label: "错误" }], answer: "true" },
  { id: "contract-view-gas-final", prompt: "调用 view / pure 只读函数是否需要付 Gas？", options: [{ id: "a", label: "A. 需要" }, { id: "b", label: "B. 不需要" }], answer: "b" },
  { id: "contract-receipt-final", prompt: "判断一笔合约调用是否成功，应该依据什么？", options: [{ id: "a", label: "A. 前端页面的提示文字" }, { id: "b", label: "B. 链上交易回执的状态字段" }], answer: "b" },
  { id: "contract-approval-final", prompt: "陌生 DApp 请求无限额度批准你的资产，你应该？", options: [{ id: "a", label: "A. 直接同意，方便以后操作" }, { id: "b", label: "B. 谨慎处理，先核实来源" }], answer: "b" },
];

export const contractAgentQuestions = [
  "只是查看合约里的公开信息，需要花 Gas 吗？为什么？",
  "ABI 是干什么用的，为什么前端需要它？",
  "陌生 DApp 请求无限额度批准你的资产时，你会怎么处理？",
] as const;
