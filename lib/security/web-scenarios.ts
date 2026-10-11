export type WebSecurityScenario = {
  id: "xss-reflected" | "csrf-transfer" | "sqli-login" | "idor-profile" | "ssrf-fetch";
  title: string;
  category: string;
  severity: "HIGH" | "MEDIUM" | "CRITICAL";
  summary: string;
  goal: string;
  request: string;
  signal: string;
  rootCause: string;
  impact: string;
  fix: string;
  verify: string;
  codeBefore: string[];
  codeAfter: string[];
  question: string;
  options: Array<{
    id: string;
    label: string;
    correct: boolean;
    feedback: string;
  }>;
};

export const WEB_SECURITY_SCENARIOS: WebSecurityScenario[] = [
  {
    id: "xss-reflected",
    title: "反射型 XSS",
    category: "输入输出边界",
    severity: "HIGH",
    summary: "搜索结果页把用户输入直接拼回 HTML。",
    goal: "找出不可信输入进入 HTML 的位置，并选择上下文正确的输出编码方案。",
    request: "GET /search?q=[untrusted-input]",
    signal: "响应正文原样包含 q 参数，浏览器把它当作标记解析。",
    rootCause: "服务端把不可信字符串直接插入 HTML 上下文，没有进行上下文相关编码。",
    impact: "攻击者可以影响受害者浏览器中的页面行为，窃取页面可见数据或诱导用户操作。",
    fix: "默认使用模板引擎的自动转义；确需富文本时采用严格白名单清洗，不使用危险的 innerHTML。",
    verify: "输入被当作文本显示，标签不会被浏览器解析，CSP 作为纵深防御继续生效。",
    codeBefore: ["return `<h1>Search: ${query}</h1>`;"],
    codeAfter: ["return renderTemplate(\"search\", { query });", "// 模板默认 HTML 转义"],
    question: "搜索结果页应该优先做哪项修复？",
    options: [
      {
        id: "encode",
        label: "输出到 HTML 前做上下文相关编码，并保留自动转义",
        correct: true,
        feedback: "正确。输入校验不能替代输出编码，真正进入 HTML 的位置必须安全编码。",
      },
      {
        id: "strip-script",
        label: "只删除字符串中的 script 单词",
        correct: false,
        feedback: "不够。攻击语法不只有 script，黑名单容易被绕过，仍需上下文编码。",
      },
    ],
  },
  {
    id: "csrf-transfer",
    title: "CSRF 跨站请求伪造",
    category: "会话与请求",
    severity: "HIGH",
    summary: "转账接口只依赖浏览器自动携带的 Cookie。",
    goal: "识别状态变更请求缺少请求来源校验的问题。",
    request: "POST /api/transfer · Cookie: session=... · body: {to, amount}",
    signal: "跨站页面也能提交状态变更请求，服务端没有 CSRF token 或 Origin 校验。",
    rootCause: "服务端把“浏览器带了会话 Cookie”误认为“用户有意发起了这次操作”。",
    impact: "用户登录状态仍有效时，恶意页面可能诱导浏览器提交未经授权的操作。",
    fix: "状态变更请求使用 CSRF token，并校验 Origin/Referer；Cookie 配置 SameSite、Secure、HttpOnly。",
    verify: "缺少 token 或来源不可信的请求被拒绝；合法表单携带匹配 token 后才通过。",
    codeBefore: ["if (session && request.method === \"POST\") {", "  transfer(request.body);", "}"],
    codeAfter: ["assertSameOrigin(request);", "assertValidCsrfToken(request);", "transfer(request.body);"],
    question: "仅仅把接口改成 POST，能否解决 CSRF？",
    options: [
      {
        id: "no",
        label: "不能，还要做 CSRF token 或来源校验",
        correct: true,
        feedback: "正确。POST 也会被跨站表单提交，方法名不是 CSRF 防线。",
      },
      {
        id: "yes",
        label: "可以，GET 和 POST 的区别已经足够",
        correct: false,
        feedback: "不对。攻击者同样可以构造跨站 POST，请求仍可能自动带上 Cookie。",
      },
    ],
  },
  {
    id: "sqli-login",
    title: "SQL 注入",
    category: "数据查询边界",
    severity: "CRITICAL",
    summary: "登录查询用字符串拼接生成 SQL。",
    goal: "识别查询语句和用户输入混在一起的边界错误。",
    request: "POST /login · body: {username, password}",
    signal: "日志显示用户输入直接出现在 SQL 文本中，查询结构可以被输入改变。",
    rootCause: "把数据当成 SQL 语法拼接，数据库无法区分代码和参数。",
    impact: "可能绕过认证、读取不属于当前用户的数据，严重时影响整个数据库。",
    fix: "使用参数化查询或 ORM 绑定参数；数据库账号遵循最小权限并统一记录异常查询。",
    verify: "用户输入只作为参数值处理，查询结构保持固定，异常输入不会改变语义。",
    codeBefore: ["const sql = `SELECT * FROM users WHERE name='${name}'`;"],
    codeAfter: ["const sql = \"SELECT * FROM users WHERE name = ?\";", "db.prepare(sql).get(name);"],
    question: "防止 SQL 注入最可靠的基础措施是什么？",
    options: [
      {
        id: "parameterized",
        label: "参数化查询，并让数据库把输入当作数据",
        correct: true,
        feedback: "正确。参数化查询把 SQL 结构和用户数据分开，是首要防线。",
      },
      {
        id: "length",
        label: "把用户名限制为 20 个字符",
        correct: false,
        feedback: "不够。长度限制可以降低部分风险，但不能替代参数化查询。",
      },
    ],
  },
  {
    id: "idor-profile",
    title: "IDOR 越权读取",
    category: "对象级授权",
    severity: "HIGH",
    summary: "个人资料接口只检查用户是否登录，没有检查资源归属。",
    goal: "区分认证（是谁）和授权（能不能访问这个对象）。",
    request: "GET /api/profile?userId=other-user",
    signal: "登录用户修改 URL 中的 userId 后，可以读取另一个用户的资料。",
    rootCause: "服务端信任客户端提供的对象 ID，缺少资源级授权判断。",
    impact: "用户可以读取或修改不属于自己的订单、资料、报告或资产记录。",
    fix: "从服务端会话确定当前用户，并在每次对象访问时执行所有权或角色授权检查。",
    verify: "同一用户只能访问自己的对象；越权请求返回 403 或统一的不可见结果。",
    codeBefore: ["const profile = await getProfile(url.searchParams.get(\"userId\"));", "return json(profile);"],
    codeAfter: ["const auth = requireSession(request);", "assertOwnerOrAdmin(auth, resource);", "return json(resource);"],
    question: "最关键的授权依据应该来自哪里？",
    options: [
      {
        id: "session",
        label: "服务端验证过的会话身份，再结合资源所有权",
        correct: true,
        feedback: "正确。客户端参数只能定位对象，不能证明访问权限。",
      },
      {
        id: "query",
        label: "URL 中的 userId，只要格式合法就可以",
        correct: false,
        feedback: "不对。格式合法不代表有权访问，IDOR 正是利用了这种信任。",
      },
    ],
  },
  {
    id: "ssrf-fetch",
    title: "SSRF 服务端请求伪造",
    category: "出站网络边界",
    severity: "HIGH",
    summary: "预览接口允许用户提供任意 URL，由服务器代为抓取。",
    goal: "识别服务器出站请求成为攻击者跳板的风险。",
    request: "POST /api/preview · body: {url: userSuppliedUrl}",
    signal: "服务器直接 fetch 用户提供的地址，没有协议、域名、解析结果和内网范围限制。",
    rootCause: "把用户可控 URL 当作可信的服务器端资源地址。",
    impact: "攻击者可能探测内部服务、访问云环境元数据或借服务器访问受限网络。",
    fix: "使用目标域名白名单；只允许 HTTPS；解析后阻断 loopback、私网、链路本地和重定向到内网的地址。",
    verify: "仅允许白名单目标；私网地址、异常协议和重定向后的内网地址都被阻断并记录。",
    codeBefore: ["const response = await fetch(input.url);", "return response.text();"],
    codeAfter: ["const target = await validateOutboundUrl(input.url);", "const response = await fetch(target.href, { redirect: \"error\" });"],
    question: "SSRF 防护为什么不能只检查 URL 字符串是否以 https 开头？",
    options: [
      {
        id: "dns",
        label: "还要校验域名白名单、解析结果、私网范围和重定向",
        correct: true,
        feedback: "正确。协议安全不等于目标安全，DNS 和重定向都必须纳入边界检查。",
      },
      {
        id: "browser",
        label: "只要浏览器地址栏不显示内网地址就安全",
        correct: false,
        feedback: "不对。请求是服务器发出的，浏览器看不到服务器内部网络边界。",
      },
    ],
  },
];

export function getWebSecurityScenario(id: WebSecurityScenario["id"]) {
  return WEB_SECURITY_SCENARIOS.find((scenario) => scenario.id === id) ?? null;
}
