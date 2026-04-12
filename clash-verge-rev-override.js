// Clash Verge Rev - 奶昔机场 Script Override
// 功能：
// 1. 添加 usa-fixed-ip 节点（Socks5 固定美国 IP，Claude 专用）
// 2. Auto 自动选优组（url-test，坏节点自动踢）
// 3. 地区分组（HK/US/JP）
// 4. Claude/Anthropic 域名走 usa-fixed-ip

function main(config) {
  // ====== 1. 添加 usa-fixed-ip 节点 ======
  if (!config.proxies) config.proxies = [];

  // usa-fixed-ip 需要通过订阅节点中转才能连上（境外 Socks5）
  // Shadowrocket 里「代理通过」配的是 HK 04，这里用 dialer-proxy 实现相同效果
  // 先建一个中转选择组，回退到 HK-Auto
  config.proxies.push({
    name: "usa-fixed-ip",
    type: "socks5",
    server: "89.47.126.212",
    port: 12324,
    username: "hcmcloud",
    password: "hcmcloud",
    udp: true,
    "dialer-proxy": "USA-Relay",
  });

  // ====== 2. 收集真实节点名（排除信息行和 usa-fixed-ip） ======
  const infoPattern = /Traffic Reset|Expire Date|^\d+\.\d+ G/;
  const realProxies = config.proxies
    .map((p) => p.name)
    .filter((name) => !infoPattern.test(name) && name !== "usa-fixed-ip");

  const hkNodes = realProxies.filter((n) => n.includes("Hong Kong"));
  const usNodes = realProxies.filter((n) => n.includes("USA"));
  const jpNodes = realProxies.filter((n) => n.includes("Japan"));

  // ====== 3. 添加自定义代理组（插到最前面） ======
  const customGroups = [
    {
      name: "Auto",
      type: "url-test",
      url: "http://www.gstatic.com/generate_204",
      interval: 300,
      tolerance: 50,
      proxies: realProxies,
    },
    {
      name: "HK-Auto",
      type: "url-test",
      url: "http://www.gstatic.com/generate_204",
      interval: 300,
      tolerance: 50,
      proxies: hkNodes.length > 0 ? hkNodes : ["DIRECT"],
    },
    {
      name: "US-Auto",
      type: "url-test",
      url: "http://www.gstatic.com/generate_204",
      interval: 300,
      tolerance: 50,
      proxies: usNodes.length > 0 ? usNodes : ["DIRECT"],
    },
    {
      name: "JP-Auto",
      type: "url-test",
      url: "http://www.gstatic.com/generate_204",
      interval: 300,
      tolerance: 50,
      proxies: jpNodes.length > 0 ? jpNodes : ["DIRECT"],
    },
    {
      name: "Claude",
      type: "select",
      proxies: ["usa-fixed-ip", "US-Auto", "Auto", "Proxies"],
    },
    // usa-fixed-ip 的中转节点组（默认 HK 04，可手动切其他）
    {
      name: "USA-Relay",
      type: "select",
      url: "http://www.gstatic.com/generate_204",
      interval: 300,
      proxies: hkNodes.length > 0
        ? ["HK-Auto", ...hkNodes, ...usNodes, ...jpNodes]
        : realProxies,
    },
  ];

  if (!config["proxy-groups"]) config["proxy-groups"] = [];
  config["proxy-groups"] = [...customGroups, ...config["proxy-groups"]];

  // 在原 Proxies 组头部加入 Auto 和地区组
  const proxiesGroup = config["proxy-groups"].find((g) => g.name === "Proxies");
  if (proxiesGroup && proxiesGroup.proxies) {
    const extra = ["Auto", "HK-Auto", "US-Auto", "JP-Auto"];
    proxiesGroup.proxies = [
      ...extra,
      ...proxiesGroup.proxies.filter((p) => !extra.includes(p)),
    ];
  }

  // Final 组也加上 Auto
  const finalGroup = config["proxy-groups"].find((g) => g.name === "✈️Final");
  if (finalGroup && finalGroup.proxies) {
    finalGroup.proxies = [
      "Auto",
      "Proxies",
      ...finalGroup.proxies.filter((p) => p !== "Auto" && p !== "Proxies"),
    ];
  }

  // ====== 4. Claude 分流规则（插到所有规则最前面，优先级最高） ======
  const claudeRules = [
    "DOMAIN-SUFFIX,anthropic.com,Claude",
    "DOMAIN-SUFFIX,claude.ai,Claude",
    "DOMAIN-SUFFIX,claude.com,Claude",
    "DOMAIN-SUFFIX,claudeusercontent.com,Claude",
    "DOMAIN-SUFFIX,oaistatic.com,Claude",
  ];

  if (!config.rules) config.rules = [];

  // 保留 DNS 直连规则在最前
  const dnsHosts = ["ping0.cc", "durable0762", "delirium9599", "wrecking7857", "carrousel6917", "simmering3378"];
  const dnsRules = config.rules.filter((r) => dnsHosts.some((h) => r.includes(h)));
  const otherRules = config.rules.filter((r) => !dnsHosts.some((h) => r.includes(h)));

  config.rules = [...dnsRules, ...claudeRules, ...otherRules];

  return config;
}
