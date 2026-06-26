interface McpToolDefinition {
  name: string;
  description: string;
  inputSchema: {
    type: 'object';
    properties: Record<string, unknown>;
    required?: string[];
  };
}

interface McpToolExport {
  tools: McpToolDefinition[];
  callTool: (name: string, args: Record<string, unknown>) => Promise<unknown>;
  meter?: { credits: number };
  cost?: Record<string, unknown>;
  provider?: string;
}

/**
 * DART — Korea's Data Analysis, Retrieval and Transfer System.
 *
 * The Korean equivalent of SEC EDGAR. Run by the FSC/FSS (Financial
 * Services Commission), DART receives every corporate disclosure filed
 * by KOSPI/KOSDAQ-listed and other reporting companies: periodic
 * reports (annual / quarterly / half-year), material events, ownership
 * changes, insider trading, fair-disclosure announcements.
 *
 * BYO key — free signup at https://opendart.fss.or.kr/uss/umt/cmm/EgovMberInsertView.do
 * (20,000 calls/day per key). Pass via _apiKey; gateway forwards it
 * as the crtfc_key DART expects.
 *
 * corp_code (8-digit DART-internal identifier) is the primary key
 * across all endpoints. Different from KRX stock_code (6-digit ticker).
 * Well-known corp_codes for major Korean companies:
 *   Samsung Electronics  00126380  (KRX 005930)
 *   SK Hynix             00164779  (KRX 000660)
 *   Hyundai Motor        00164742  (KRX 005380)
 *   LG Electronics       00401731  (KRX 066570)
 *   NAVER                00266961  (KRX 035420)
 *   Kakao                00918114  (KRX 035720)
 *   POSCO Holdings       00434003  (KRX 005490)
 *
 * Pairs with ecos-kr (Bank of Korea macro data) — completes Pipeworx's
 * Korean trio of macro + micro market intelligence.
 */


const BASE_URL = 'https://opendart.fss.or.kr/api';
const UA = 'pipeworx-mcp-dart-kr/1.0 (+https://pipeworx.io)';

const tools: McpToolExport['tools'] = [
  {
    name: 'dart_search_filings',
    description:
      'AUTHORITATIVE list of recent Korean corporate disclosures filed to DART (Korea\'s SEC equivalent). Returns rcept_no (receipt ID), rcept_dt (filing date), corp_name, report_nm (disclosure title), corp_code. Filter by company via corp_code (e.g., "00126380" Samsung Electronics; see pack docstring for major chaebol codes), filing date range, or filing type. Use for "what did Samsung file last week", "recent KOSPI material events", "this quarter\'s ownership changes".',
    inputSchema: {
      type: 'object' as const,
      properties: {
        corp_code: { type: 'string', description: '8-digit DART corp identifier (Samsung 00126380, SK Hynix 00164779, etc.). Omit to list filings across ALL companies in the date range.' },
        bgn_de: { type: 'string', description: 'Filing date start (YYYYMMDD). Defaults to 30 days ago when omitted.' },
        end_de: { type: 'string', description: 'Filing date end (YYYYMMDD). Defaults to today when omitted.' },
        pblntf_ty: { type: 'string', description: 'Disclosure category: A (periodic report), B (major events), C (issuance), D (ownership change), E (audit), F (fund), G (asset-backed securities), H (foreign), I (subscriber). Omit for all.' },
        page_no: { type: 'number', description: 'Page number (1-based, default 1).' },
        page_count: { type: 'number', description: 'Results per page (1-100, default 10).' },
      },
    },
  },
  {
    name: 'dart_company_info',
    description:
      'Basic profile for a Korean DART-registered company: corp_name (Korean + English), KRX stock_code if listed, CEO name, market tier (KOSPI/KOSDAQ/KONEX/etc.), industry code, address, founding date, fiscal-year-end month, homepage. Use after dart_search_filings to enrich a corp_code into a readable entity, or as the first lookup when an agent is given a corp_code with no other context.',
    inputSchema: {
      type: 'object' as const,
      properties: {
        corp_code: { type: 'string', description: 'Required 8-digit DART corp identifier.' },
      },
      required: ['corp_code'],
    },
  },
  {
    name: 'dart_financials',
    description:
      'Key annual / interim financial line items for a Korean company\'s periodic report. Returns income statement, balance sheet, cash flow items with current-period (thstrm) and prior-period (frmtrm / bfefrmtrm) amounts. Use for fundamental analysis (revenue, operating profit, net income, total assets, liabilities, equity, operating cash flow) on KOSPI/KOSDAQ filers. Pair with ecos_get_series for macro context.',
    inputSchema: {
      type: 'object' as const,
      properties: {
        corp_code: { type: 'string', description: 'Required 8-digit DART corp identifier.' },
        bsns_year: { type: 'string', description: 'Required 4-digit business year (e.g., "2024"). DART historical data goes back to 2015.' },
        reprt_code: { type: 'string', description: 'Required report type: 11011 (annual), 11012 (half-year/Q2), 11013 (Q1), 11014 (Q3).' },
        fs_div: { type: 'string', description: 'Statement basis: "CFS" (consolidated, default) or "OFS" (separate / parent-only).' },
      },
      required: ['corp_code', 'bsns_year', 'reprt_code'],
    },
  },
  {
    name: 'dart_major_shareholders',
    description:
      'Korean 5%-rule (대량보유) disclosures for a company — every shareholder who has crossed the 5% beneficial-ownership threshold, with subsequent 1%+ changes. Returns shareholder name, holding type, shares held, stake percentage, change reason, report date. Equivalent to US 13D/13G but with a lower trigger threshold. Use for "who owns big stakes in $KR_COMPANY", activism tracking, follow-the-money on KOSPI filings.',
    inputSchema: {
      type: 'object' as const,
      properties: {
        corp_code: { type: 'string', description: 'Required 8-digit DART corp identifier.' },
      },
      required: ['corp_code'],
    },
  },
  {
    name: 'dart_insider_holdings',
    description:
      'Korean executive + 10%-shareholder equity-holding disclosures (임원·주요주주 소유보고). Returns name, role (executive/director/major shareholder), shares held, shares changed since prior report, change reason (buy/sell/grant/exercise), report date. Equivalent to US Form 4 insider transactions but reported via DART. Use for insider-trading signal, executive compensation analysis, founder/family ownership tracking.',
    inputSchema: {
      type: 'object' as const,
      properties: {
        corp_code: { type: 'string', description: 'Required 8-digit DART corp identifier.' },
      },
      required: ['corp_code'],
    },
  },
];

interface DartEnvelope<T> {
  status: string;
  message?: string;
  list?: T[];
  page_no?: number;
  page_count?: number;
  total_count?: number;
  total_page?: number;
}

function authKey(args: Record<string, unknown>): string {
  const k = (args._apiKey as string | undefined)?.trim();
  if (!k) throw new Error(
    'DART requires an API key. Free signup at https://opendart.fss.or.kr/uss/umt/cmm/EgovMberInsertView.do (20,000 calls/day). ' +
    'Pass via _apiKey; gateway forwards it as the crtfc_key DART expects.'
  );
  return k;
}

async function dartGet<T>(path: string, params: Record<string, string | number | undefined>): Promise<DartEnvelope<T> & Record<string, unknown>> {
  const qs = new URLSearchParams();
  for (const [k, v] of Object.entries(params)) {
    if (v !== undefined && v !== null && String(v).length > 0) qs.set(k, String(v));
  }
  const url = `${BASE_URL}/${path}?${qs}`;
  const res = await fetch(url, { headers: { Accept: 'application/json', 'User-Agent': UA } });
  if (!res.ok) throw new Error(`DART error: HTTP ${res.status}`);
  const env = (await res.json()) as DartEnvelope<T> & Record<string, unknown>;
  // DART status codes: 000=ok, 010=invalid key, 011=no permission, 013=no data,
  // 020=rate limited, 100=missing field, 800=service down.
  if (env.status === '000') return env;
  if (env.status === '013') return { ...env, list: [] }; // no-data is not an error
  const msgs: Record<string, string> = {
    '010': 'API key not registered. Verify the key at https://opendart.fss.or.kr/.',
    '011': 'API key lacks permission for this endpoint.',
    '020': 'DART rate limit exceeded (20,000 calls/day per key). Try again tomorrow or use a different key.',
    '100': 'Required field is missing or malformed. Check corp_code (8 digits) + date format (YYYYMMDD).',
    '800': 'DART service is currently down on the upstream side.',
  };
  const hint = msgs[env.status] ?? '';
  throw new Error(`DART error (${env.status}): ${env.message ?? '(no message)'}${hint ? ' — ' + hint : ''}`);
}

function defaultDate(daysBack: number): string {
  const d = new Date(Date.now() - daysBack * 24 * 60 * 60 * 1000);
  return `${d.getUTCFullYear()}${String(d.getUTCMonth() + 1).padStart(2, '0')}${String(d.getUTCDate()).padStart(2, '0')}`;
}

async function callTool(name: string, args: Record<string, unknown>): Promise<unknown> {
  const crtfc_key = authKey(args);

  switch (name) {
    case 'dart_search_filings': {
      type Row = {
        corp_code: string; corp_name: string; stock_code: string;
        report_nm: string; rcept_no: string; rcept_dt: string; flr_nm: string;
      };
      const env = await dartGet<Row>('list.json', {
        crtfc_key,
        corp_code: args.corp_code as string | undefined,
        bgn_de: (args.bgn_de as string | undefined) ?? defaultDate(30),
        end_de: (args.end_de as string | undefined) ?? defaultDate(0),
        pblntf_ty: args.pblntf_ty as string | undefined,
        page_no: (args.page_no as number | undefined) ?? 1,
        page_count: Math.min(100, Math.max(1, (args.page_count as number | undefined) ?? 10)),
      });
      const list = (env.list as Row[] | undefined) ?? [];
      return {
        count: list.length,
        page_no: env.page_no,
        page_count: env.page_count,
        total_count: env.total_count,
        total_page: env.total_page,
        filings: list.map((r) => ({
          rcept_no: r.rcept_no,
          rcept_dt: r.rcept_dt,
          corp_code: r.corp_code,
          corp_name: r.corp_name,
          stock_code: r.stock_code,
          report_name: r.report_nm,
          filer_name: r.flr_nm,
          url: `https://dart.fss.or.kr/dsaf001/main.do?rcpNo=${r.rcept_no}`,
        })),
      };
    }

    case 'dart_company_info': {
      const corp_code = (args.corp_code as string | undefined)?.trim();
      if (!corp_code) throw new Error(
        'Required argument "corp_code" is missing. ' +
        'Try one of: dart_company_info({corp_code: "00126380"}) for Samsung Electronics, ' +
        'or "00164779" for SK Hynix. DART corp_codes differ from KRX tickers.'
      );
      const env = await dartGet<never>('company.json', { crtfc_key, corp_code });
      // company.json returns fields at the envelope root, not in `list`.
      const e = env as unknown as Record<string, string | undefined>;
      return {
        corp_code: e.corp_code,
        corp_name: e.corp_name,
        corp_name_eng: e.corp_name_eng,
        stock_name: e.stock_name,
        stock_code: e.stock_code,
        ceo_name: e.ceo_nm,
        corp_class: e.corp_cls, // Y=KOSPI, K=KOSDAQ, N=KONEX, E=else
        industry_code: e.induty_code,
        establishment_date: e.est_dt,
        fiscal_year_end_month: e.acc_mt,
        address: e.adres,
        phone: e.phn_no,
        homepage: e.hm_url,
        ir_url: e.ir_url,
      };
    }

    case 'dart_financials': {
      const corp_code = (args.corp_code as string | undefined)?.trim();
      const bsns_year = (args.bsns_year as string | undefined)?.trim();
      const reprt_code = (args.reprt_code as string | undefined)?.trim();
      if (!corp_code || !bsns_year || !reprt_code) throw new Error(
        'Required arguments: corp_code, bsns_year, reprt_code. ' +
        'Try: dart_financials({corp_code: "00126380", bsns_year: "2024", reprt_code: "11011"}) for Samsung\'s 2024 annual report. ' +
        'reprt_code: 11011 (annual), 11012 (H1), 11013 (Q1), 11014 (Q3).'
      );
      type Row = {
        account_nm: string; sj_div: string; sj_nm: string;
        thstrm_nm: string; thstrm_amount: string;
        frmtrm_nm: string; frmtrm_amount: string;
        bfefrmtrm_nm: string; bfefrmtrm_amount: string;
        currency: string;
      };
      const fs_div = (args.fs_div as string | undefined) ?? 'CFS';
      const env = await dartGet<Row>('fnlttSinglAcnt.json', {
        crtfc_key, corp_code, bsns_year, reprt_code, fs_div,
      });
      const list = (env.list as Row[] | undefined) ?? [];
      return {
        corp_code, bsns_year, reprt_code, fs_div,
        count: list.length,
        statements: list.map((r) => ({
          statement_division: r.sj_div, // BS / IS / CIS / CF / SCE
          statement_name: r.sj_nm,
          account_name: r.account_nm,
          current_period_label: r.thstrm_nm,
          current_period_amount: r.thstrm_amount,
          prior_period_label: r.frmtrm_nm,
          prior_period_amount: r.frmtrm_amount,
          two_years_ago_label: r.bfefrmtrm_nm,
          two_years_ago_amount: r.bfefrmtrm_amount,
          currency: r.currency,
        })),
      };
    }

    case 'dart_major_shareholders': {
      const corp_code = (args.corp_code as string | undefined)?.trim();
      if (!corp_code) throw new Error('Required argument "corp_code" is missing. Pass an 8-digit DART corp identifier (e.g., "00126380" for Samsung).');
      type Row = {
        rcept_no: string; rcept_dt: string; report_tp: string;
        repror: string; stkqy: string; stkqy_irds: string;
        stkrt: string; stkrt_irds: string;
        ctr_stkqy: string; ctr_stkrt: string;
        report_resn: string;
      };
      const env = await dartGet<Row>('majorstock.json', { crtfc_key, corp_code });
      const list = (env.list as Row[] | undefined) ?? [];
      return {
        corp_code,
        count: list.length,
        disclosures: list.map((r) => ({
          rcept_no: r.rcept_no,
          rcept_dt: r.rcept_dt,
          report_type: r.report_tp,
          reporter: r.repror,
          shares: r.stkqy,
          shares_change: r.stkqy_irds,
          stake_pct: r.stkrt,
          stake_pct_change: r.stkrt_irds,
          contractual_shares: r.ctr_stkqy,
          contractual_pct: r.ctr_stkrt,
          report_reason: r.report_resn,
          url: `https://dart.fss.or.kr/dsaf001/main.do?rcpNo=${r.rcept_no}`,
        })),
      };
    }

    case 'dart_insider_holdings': {
      const corp_code = (args.corp_code as string | undefined)?.trim();
      if (!corp_code) throw new Error('Required argument "corp_code" is missing. Pass an 8-digit DART corp identifier (e.g., "00126380" for Samsung).');
      type Row = {
        rcept_no: string; rcept_dt: string; repror: string;
        isu_exctv_rgist_at: string; isu_exctv_ofcps: string;
        isu_main_shrholdr: string;
        sp_stock_lmp_cnt: string; sp_stock_lmp_irds_cnt: string;
        sp_stock_lmp_rate: string; sp_stock_lmp_irds_rate: string;
      };
      const env = await dartGet<Row>('elestock.json', { crtfc_key, corp_code });
      const list = (env.list as Row[] | undefined) ?? [];
      return {
        corp_code,
        count: list.length,
        disclosures: list.map((r) => ({
          rcept_no: r.rcept_no,
          rcept_dt: r.rcept_dt,
          reporter: r.repror,
          is_registered_executive: r.isu_exctv_rgist_at,
          executive_role: r.isu_exctv_ofcps,
          is_major_shareholder: r.isu_main_shrholdr,
          shares: r.sp_stock_lmp_cnt,
          shares_change: r.sp_stock_lmp_irds_cnt,
          stake_pct: r.sp_stock_lmp_rate,
          stake_pct_change: r.sp_stock_lmp_irds_rate,
          url: `https://dart.fss.or.kr/dsaf001/main.do?rcpNo=${r.rcept_no}`,
        })),
      };
    }

    default:
      throw new Error(`Unknown tool: ${name}`);
  }
}

export default { tools, callTool, meter: { credits: 1 } } satisfies McpToolExport;
