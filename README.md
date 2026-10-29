# mcp-dart-kr

DART — Korea's Data Analysis, Retrieval and Transfer System. The Korean equivalent of SEC EDGAR. Works with no key: served on a platform key by Bruce's decision 2026-09-25 despite Article 19(2); see fleet #2439.

Part of [Pipeworx](https://pipeworx.io) — an MCP gateway connecting AI agents to 1856+ live data sources. This is an independent, unofficial integration — not affiliated with, endorsed by, or published by the upstream provider.

## Tools

| Tool | Description |
|------|-------------|
| `dart_search_filings` | AUTHORITATIVE list of recent Korean corporate disclosures filed to DART (Korea's SEC equivalent). Returns rcept_no (receipt ID), rcept_dt (filing date), corp_name, report_nm (disclosure title), corp_code. Filter by company via corp_code (e.g., "00126380" Samsung Electronics; see pack docstring for major chaebol codes), filing date range, or filing type. Use for "what did Samsung file last week", "recent KOSPI material events", "this quarter's ownership changes". |
| `dart_company_info` | Basic profile for a Korean DART-registered company: corp_name (Korean + English), KRX stock_code if listed, CEO name, market tier (KOSPI/KOSDAQ/KONEX/etc.), industry code, address, founding date, fiscal-year-end month, homepage. Use after dart_search_filings to enrich a corp_code into a readable entity, or as the first lookup when an agent is given a corp_code with no other context. |
| `dart_financials` | Key annual / interim financial line items for a Korean company's periodic report. Returns income statement, balance sheet, cash flow items with current-period (thstrm) and prior-period (frmtrm / bfefrmtrm) amounts. Use for fundamental analysis (revenue, operating profit, net income, total assets, liabilities, equity, operating cash flow) on KOSPI/KOSDAQ filers. Pair with ecos_get_series for macro context. |
| `dart_major_shareholders` | Korean 5%-rule (대량보유) disclosures for a company — every shareholder who has crossed the 5% beneficial-ownership threshold, with subsequent 1%+ changes. Returns shareholder name, holding type, shares held, stake percentage, change reason, report date. Equivalent to US 13D/13G but with a lower trigger threshold. Use for "who owns big stakes in $KR_COMPANY", activism tracking, follow-the-money on KOSPI filings. |
| `dart_insider_holdings` | Korean executive + 10%-shareholder equity-holding disclosures (임원·주요주주 소유보고). Returns name, role (executive/director/major shareholder), shares held, shares changed since prior report, change reason (buy/sell/grant/exercise), report date. Equivalent to US Form 4 insider transactions but reported via DART. Use for insider-trading signal, executive compensation analysis, founder/family ownership tracking. |

## Quick Start

Add to your MCP client (Claude Desktop, Cursor, Windsurf, etc.):

```json
{
  "mcpServers": {
    "dart-kr": {
      "url": "https://gateway.pipeworx.io/dart-kr/mcp"
    }
  }
}
```

### What this endpoint actually serves

`tools/list` at `https://gateway.pipeworx.io/dart-kr/mcp` returns the tools in the table
above **plus the shared Pipeworx meta-tools** — `ask_pipeworx`,
`discover_tools`, `search_within`, `remember`/`recall` and the rest of the
gateway-wide set. So the tool count you see is larger than this table: a
single-pack endpoint currently lists roughly 30 shared tools alongside the
pack's own. The connection's `initialize` response states its exact scope, and
is the authoritative answer for a given day.

This is deliberate, not multiplexing by accident. The meta-tools are what let a
scoped connection answer a question this pack does not cover — via
`ask_pipeworx`, which routes across the whole catalog — without you adding a
second MCP server. There is currently no way to mount a pack endpoint without
them; if the extra schemas cost you more context than the routing is worth,
connect to the full gateway once rather than to several pack endpoints.

Or connect to the full Pipeworx gateway to get every pack's tools listed
directly, instead of just this one's:

```json
{
  "mcpServers": {
    "pipeworx": {
      "url": "https://gateway.pipeworx.io/mcp"
    }
  }
}
```

Both URLs reach the same gateway and the same 1856+ data sources. The
only difference is which pack's tools are listed **directly**; `ask_pipeworx`
reaches all of them from either one.

## No MCP client? Call it over HTTP

```bash
curl -X POST https://gateway.pipeworx.io/v1/tools/dart_search_filings \
  -H 'Content-Type: application/json' \
  -d '{"corp_code":"00126380","bgn_de":"20240101","end_de":"20240131","pblntf_ty":"B"}'
```

No account needed for the first calls. Inspect any tool: `GET https://gateway.pipeworx.io/v1/tools/dart_search_filings`. Find one: `POST https://gateway.pipeworx.io/v1/tools/search_packs` with `{"query":"..."}`.

## Run it from npm

`@pipeworx/mcp-dart-kr` is a local stdio bridge to the Pipeworx gateway: your MCP client
starts it with `npx`, and it forwards every call to the same
`https://gateway.pipeworx.io/dart-kr/mcp` endpoint shown above. It needs network access;
there is no offline mode.

```json
{
  "mcpServers": {
    "dart-kr": {
      "command": "npx",
      "args": ["-y", "@pipeworx/mcp-dart-kr"]
    }
  }
}
```

Without a key it calls anonymously, capped at 50 calls a day. A free account
raises that to 200 a day: get a key at https://pipeworx.io/signup and add
`"env": { "PIPEWORX_API_KEY": "<your key>" }` to the server entry.
The key is sent as a Bearer token, the same way a hosted connection sends it,
so calls are metered and billed exactly as they are there.

It lists **only** this pack's tools by default. Set `PIPEWORX_META_TOOLS=1` to
also list `ask_pipeworx` and the other gateway-wide tools.

Behind an HTTPS proxy: Node's built-in `fetch` does not read `HTTPS_PROXY` by
default. Newer Node releases honour it when `NODE_USE_ENV_PROXY=1` is set; check
your Node version's documentation.

## Using with ask_pipeworx

Instead of calling tools directly, you can ask questions in plain English —
this works on the pack endpoint above as well as on the full gateway:

```
ask_pipeworx({ question: "your question about Dart Kr data" })
```

The gateway picks the right tool and fills the arguments automatically.

## More

- [Docs and guides](https://pipeworx.io/docs)
- [pipeworx.io](https://pipeworx.io)

## License

MIT
