//#region ../../node_modules/.pnpm/monaco-editor@0.56.0/node_modules/monaco-editor/esm/vs/languages/definitions/ini/ini.js
var conf = {
	comments: { lineComment: "#" },
	brackets: [
		["{", "}"],
		["[", "]"],
		["(", ")"]
	],
	autoClosingPairs: [
		{
			open: "{",
			close: "}"
		},
		{
			open: "[",
			close: "]"
		},
		{
			open: "(",
			close: ")"
		},
		{
			open: "\"",
			close: "\""
		},
		{
			open: "'",
			close: "'"
		}
	],
	surroundingPairs: [
		{
			open: "{",
			close: "}"
		},
		{
			open: "[",
			close: "]"
		},
		{
			open: "(",
			close: ")"
		},
		{
			open: "\"",
			close: "\""
		},
		{
			open: "'",
			close: "'"
		}
	]
};
var language = {
	defaultToken: "",
	tokenPostfix: ".ini",
	escapes: /\\(?:[abfnrtv\\"']|x[0-9A-Fa-f]{1,4}|u[0-9A-Fa-f]{4}|U[0-9A-Fa-f]{8})/,
	tokenizer: {
		root: [
			[/^\[[^\]]*\]/, "metatag"],
			[/(^\w+)(\s*)(\=)/, [
				"key",
				"",
				"delimiter"
			]],
			{ include: "@whitespace" },
			[/\d+/, "number"],
			[/"([^"\\]|\\.)*$/, "string.invalid"],
			[/'([^'\\]|\\.)*$/, "string.invalid"],
			[
				/"/,
				"string",
				"@string.\""
			],
			[
				/'/,
				"string",
				"@string.'"
			]
		],
		whitespace: [[/[ \t\r\n]+/, ""], [/^\s*[#;].*$/, "comment"]],
		string: [
			[/[^\\"']+/, "string"],
			[/@escapes/, "string.escape"],
			[/\\./, "string.escape.invalid"],
			[/["']/, { cases: {
				"$#==$S2": {
					token: "string",
					next: "@pop"
				},
				"@default": "string"
			} }]
		]
	}
};
//#endregion
export { conf, language };
