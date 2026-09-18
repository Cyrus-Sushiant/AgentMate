/**
 * Cut-down SARIF logs shaped the way each tool really emits them. Typed as `unknown` on purpose:
 * `parseSarif` takes `unknown`, and a fixture that has been forced into the parser's own private
 * interfaces could not express the malformed cases that matter most.
 */

/** Semgrep: dotted rule ids, a shortDescription that only restates the id, tags for CWE/OWASP. */
export const SEMGREP_SARIF: unknown = {
  version: '2.1.0',
  runs: [
    {
      tool: {
        driver: {
          name: 'semgrep',
          semanticVersion: '1.86.0',
          rules: [
            {
              id: 'javascript.express.security.audit.xss.direct-response-write',
              name: 'direct-response-write',
              shortDescription: {
                text: 'Semgrep Finding: javascript.express.security.audit.xss.direct-response-write',
              },
              fullDescription: { text: 'Detected directly writing to a response.' },
              help: { text: 'Use a template engine that escapes by default.' },
              helpUri: 'https://semgrep.dev/r/xss.direct-response-write',
              defaultConfiguration: { level: 'warning' },
              properties: {
                tags: ['CWE-79', 'OWASP-A03:2021', 'security'],
              },
            },
          ],
        },
      },
      results: [
        {
          ruleId: 'javascript.express.security.audit.xss.direct-response-write',
          level: 'error',
          message: { text: 'Detected directly writing to a response. Use a template engine.' },
          locations: [
            {
              physicalLocation: {
                artifactLocation: { uri: 'src/routes/home.ts' },
                region: {
                  startLine: 42,
                  endLine: 43,
                  snippet: { text: '  res.send(req.query.name)\r' },
                },
              },
            },
          ],
        },
      ],
    },
  ],
};

/** CodeQL: rule metadata under tool.extensions, real severity in a numeric property. */
export const CODEQL_SARIF: unknown = {
  version: '2.1.0',
  runs: [
    {
      tool: {
        driver: { name: 'CodeQL', semanticVersion: '2.26.4+202509' },
        extensions: [
          {
            name: 'codeql/javascript-queries',
            version: '1.3.0',
            rules: [
              {
                id: 'js/sql-injection',
                name: 'js/sql-injection',
                shortDescription: { text: 'Database query built from user-controlled sources' },
                fullDescription: {
                  text: 'Building a database query from user-controlled sources is vulnerable to insertion of malicious code.',
                },
                help: { markdown: '# SQL injection\n\nUse parameterized queries.' },
                helpUri: 'https://codeql.github.com/codeql-query-help/javascript/js-sql-injection/',
                defaultConfiguration: { level: 'error' },
                properties: {
                  tags: ['security', 'external/cwe/cwe-089'],
                  'security-severity': '9.8',
                  precision: 'high',
                },
              },
            ],
          },
        ],
      },
      originalUriBaseIds: { '%SRCROOT%': { uri: 'file:///E:/work/app/' } },
      results: [
        {
          ruleId: 'js/sql-injection',
          rule: { id: 'js/sql-injection', index: 0, toolComponent: { index: 1 } },
          // CodeQL stamps almost everything "warning"; the numeric property is the real signal.
          level: 'warning',
          message: { text: 'This query depends on a user-provided value.' },
          locations: [
            {
              physicalLocation: {
                artifactLocation: { uri: 'server/db.js', uriBaseId: '%SRCROOT%' },
                region: { startLine: 7 },
              },
            },
          ],
        },
      ],
    },
  ],
};

/** Trivy: severity word as a bare tag, structured data as labelled prose, markdown-table help. */
export const TRIVY_SARIF: unknown = {
  version: '2.1.0',
  runs: [
    {
      tool: {
        driver: {
          name: 'Trivy',
          version: '0.58.1',
          rules: [
            {
              id: 'CVE-2021-23337',
              name: 'OsPackageVulnerability',
              shortDescription: { text: 'lodash: command injection via template' },
              fullDescription: { text: 'lodash versions prior to 4.17.21 are vulnerable.' },
              help: {
                markdown:
                  '**Vulnerability CVE-2021-23337**\n| Package | Severity |\n| --- | --- |\n| lodash | HIGH |\n\nUpgrade lodash to 4.17.21 or later.',
              },
              helpUri: 'https://avd.aquasec.com/nvd/cve-2021-23337',
              defaultConfiguration: { level: 'error' },
              properties: { tags: ['vulnerability', 'security', 'HIGH'] },
            },
          ],
        },
      },
      results: [
        {
          ruleId: 'CVE-2021-23337',
          ruleIndex: 0,
          level: 'error',
          message: {
            text: [
              'Package: lodash',
              'Installed Version: 4.17.20',
              'Vulnerability CVE-2021-23337',
              'Severity: HIGH',
              'Fixed Version: 4.17.21',
              'Link: [CVE-2021-23337](https://avd.aquasec.com/nvd/cve-2021-23337)',
              '',
              'lodash template allows command injection.',
            ].join('\n'),
          },
          locations: [
            {
              physicalLocation: {
                artifactLocation: { uri: '/tmp/scan/package-lock.json' },
                region: { startLine: 118 },
              },
            },
          ],
        },
      ],
    },
  ],
};
