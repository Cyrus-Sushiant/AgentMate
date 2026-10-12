import { createRequire } from "node:module";
import { delimiter, dirname, isAbsolute, join } from "node:path";
import { createHash } from "node:crypto";
import { accessSync, chmodSync, constants, copyFileSync, existsSync, mkdtempSync, renameSync, rmSync, statSync, writeFileSync } from "node:fs";
import { constants as constants$1, getPriority, homedir, release, setPriority, tmpdir } from "node:os";
import { execFile, spawn } from "node:child_process";
import { StringDecoder } from "node:string_decoder";
import * as pty from "node-pty";
function ptyHostPaths(userDataDir) {
	const runtimeDir = join(userDataDir, "pty-host");
	const suffix = createHash("sha256").update(userDataDir).digest("hex").slice(0, 12);
	let endpoint;
	if (process.platform === "win32") endpoint = `\\\\.\\pipe\\agentmate-pty-host-${suffix}`;
	else {
		const preferred = join(runtimeDir, "host.sock");
		endpoint = Buffer.byteLength(preferred) < 100 ? preferred : join(tmpdir(), `agentmate-pty-${suffix}.sock`);
	}
	return {
		runtimeDir,
		endpoint,
		tokenFile: join(runtimeDir, "token"),
		logFile: join(runtimeDir, "host.log")
	};
}
/** Splits a byte stream into newline-delimited JSON messages. */
function createLineReader(onMessage, onOverflow) {
	let buffered = "";
	const decoder = new StringDecoder("utf8");
	return (chunk) => {
		buffered += typeof chunk === "string" ? chunk : decoder.write(chunk);
		let newline = buffered.indexOf("\n");
		while (newline !== -1) {
			const line = buffered.slice(0, newline);
			buffered = buffered.slice(newline + 1);
			if (line.trim()) try {
				onMessage(JSON.parse(line));
			} catch {}
			newline = buffered.indexOf("\n");
		}
		if (buffered.length > 16777216) {
			buffered = "";
			onOverflow();
		}
	};
}
function encodeLine(message) {
	return `${JSON.stringify(message)}\n`;
}
//#endregion
//#region ../../node_modules/.pnpm/@xterm+addon-serialize@0.14.0/node_modules/@xterm/addon-serialize/lib/addon-serialize.mjs
/**
* Copyright (c) 2014-2024 The xterm.js authors. All rights reserved.
* @license MIT
*
* Copyright (c) 2012-2013, Christopher Jeffrey (MIT License)
* @license MIT
*
* Originally forked from (with the author's permission):
*   Fabrice Bellard's javascript vt100 for jslinux:
*   http://bellard.org/jslinux/
*   Copyright (c) 2011 Fabrice Bellard
*/
var m = 0;
var p = 0;
var g = 0;
var b = 0;
var I;
((r) => {
	function u(t, a, s, i) {
		return i !== void 0 ? `#${B$1(t)}${B$1(a)}${B$1(s)}${B$1(i)}` : `#${B$1(t)}${B$1(a)}${B$1(s)}`;
	}
	r.toCss = u;
	function o(t, a, s, i = 255) {
		return (t << 24 | a << 16 | s << 8 | i) >>> 0;
	}
	r.toRgba = o;
	function e(t, a, s, i) {
		return {
			css: r.toCss(t, a, s, i),
			rgba: r.toRgba(t, a, s, i)
		};
	}
	r.toColor = e;
})(I ||= {});
var $$1;
((i) => {
	function u(n, l) {
		if (b = (l.rgba & 255) / 255, b === 1) return {
			css: l.css,
			rgba: l.rgba
		};
		let f = l.rgba >> 24 & 255, d = l.rgba >> 16 & 255, c = l.rgba >> 8 & 255, C = n.rgba >> 24 & 255, h = n.rgba >> 16 & 255, x = n.rgba >> 8 & 255;
		m = C + Math.round((f - C) * b), p = h + Math.round((d - h) * b), g = x + Math.round((c - x) * b);
		return {
			css: I.toCss(m, p, g),
			rgba: I.toRgba(m, p, g)
		};
	}
	i.blend = u;
	function o(n) {
		return (n.rgba & 255) === 255;
	}
	i.isOpaque = o;
	function e(n, l, f) {
		let d = y.ensureContrastRatio(n.rgba, l.rgba, f);
		if (d) return I.toColor(d >> 24 & 255, d >> 16 & 255, d >> 8 & 255);
	}
	i.ensureContrastRatio = e;
	function r(n) {
		let l = (n.rgba | 255) >>> 0;
		return [m, p, g] = y.toChannels(l), {
			css: I.toCss(m, p, g),
			rgba: l
		};
	}
	i.opaque = r;
	function t(n, l) {
		return b = Math.round(l * 255), [m, p, g] = y.toChannels(n.rgba), {
			css: I.toCss(m, p, g, b),
			rgba: I.toRgba(m, p, g, b)
		};
	}
	i.opacity = t;
	function a(n, l) {
		return b = n.rgba & 255, t(n, b * l / 255);
	}
	i.multiplyOpacity = a;
	function s(n) {
		return [
			n.rgba >> 24 & 255,
			n.rgba >> 16 & 255,
			n.rgba >> 8 & 255
		];
	}
	i.toColorRGB = s;
})($$1 ||= {});
var _;
((r) => {
	let u, o;
	try {
		let t = document.createElement("canvas");
		t.width = 1, t.height = 1;
		let a = t.getContext("2d", { willReadFrequently: !0 });
		a && (u = a, u.globalCompositeOperation = "copy", o = u.createLinearGradient(0, 0, 1, 1));
	} catch {}
	function e(t) {
		if (t.match(/#[\da-f]{3,8}/i)) switch (t.length) {
			case 4: return m = parseInt(t.slice(1, 2).repeat(2), 16), p = parseInt(t.slice(2, 3).repeat(2), 16), g = parseInt(t.slice(3, 4).repeat(2), 16), I.toColor(m, p, g);
			case 5: return m = parseInt(t.slice(1, 2).repeat(2), 16), p = parseInt(t.slice(2, 3).repeat(2), 16), g = parseInt(t.slice(3, 4).repeat(2), 16), b = parseInt(t.slice(4, 5).repeat(2), 16), I.toColor(m, p, g, b);
			case 7: return {
				css: t,
				rgba: (parseInt(t.slice(1), 16) << 8 | 255) >>> 0
			};
			case 9: return {
				css: t,
				rgba: parseInt(t.slice(1), 16) >>> 0
			};
		}
		let a = t.match(/rgba?\(\s*(\d{1,3})\s*,\s*(\d{1,3})\s*,\s*(\d{1,3})\s*(,\s*(0|1|\d?\.(\d+))\s*)?\)/);
		if (a) return m = parseInt(a[1]), p = parseInt(a[2]), g = parseInt(a[3]), b = Math.round((a[5] === void 0 ? 1 : parseFloat(a[5])) * 255), I.toColor(m, p, g, b);
		if (!u || !o) throw new Error("css.toColor: Unsupported css format");
		if (u.fillStyle = o, u.fillStyle = t, typeof u.fillStyle != "string") throw new Error("css.toColor: Unsupported css format");
		if (u.fillRect(0, 0, 1, 1), [m, p, g, b] = u.getImageData(0, 0, 1, 1).data, b !== 255) throw new Error("css.toColor: Unsupported css format");
		return {
			rgba: I.toRgba(m, p, g, b),
			css: t
		};
	}
	r.toColor = e;
})(_ ||= {});
var v;
((e) => {
	function u(r) {
		return o(r >> 16 & 255, r >> 8 & 255, r & 255);
	}
	e.relativeLuminance = u;
	function o(r, t, a) {
		let s = r / 255, i = t / 255, n = a / 255, l = s <= .03928 ? s / 12.92 : Math.pow((s + .055) / 1.055, 2.4), f = i <= .03928 ? i / 12.92 : Math.pow((i + .055) / 1.055, 2.4), d = n <= .03928 ? n / 12.92 : Math.pow((n + .055) / 1.055, 2.4);
		return l * .2126 + f * .7152 + d * .0722;
	}
	e.relativeLuminance2 = o;
})(v ||= {});
var y;
((a) => {
	function u(s, i) {
		if (b = (i & 255) / 255, b === 1) return i;
		let n = i >> 24 & 255, l = i >> 16 & 255, f = i >> 8 & 255, d = s >> 24 & 255, c = s >> 16 & 255, C = s >> 8 & 255;
		return m = d + Math.round((n - d) * b), p = c + Math.round((l - c) * b), g = C + Math.round((f - C) * b), I.toRgba(m, p, g);
	}
	a.blend = u;
	function o(s, i, n) {
		let l = v.relativeLuminance(s >> 8), f = v.relativeLuminance(i >> 8);
		if (F$1(l, f) < n) {
			if (f < l) {
				let h = e(s, i, n), x = F$1(l, v.relativeLuminance(h >> 8));
				if (x < n) {
					let R = r(s, i, n);
					return x > F$1(l, v.relativeLuminance(R >> 8)) ? h : R;
				}
				return h;
			}
			let c = r(s, i, n), C = F$1(l, v.relativeLuminance(c >> 8));
			if (C < n) {
				let h = e(s, i, n);
				return C > F$1(l, v.relativeLuminance(h >> 8)) ? c : h;
			}
			return c;
		}
	}
	a.ensureContrastRatio = o;
	function e(s, i, n) {
		let l = s >> 24 & 255, f = s >> 16 & 255, d = s >> 8 & 255, c = i >> 24 & 255, C = i >> 16 & 255, h = i >> 8 & 255, x = F$1(v.relativeLuminance2(c, C, h), v.relativeLuminance2(l, f, d));
		for (; x < n && (c > 0 || C > 0 || h > 0);) c -= Math.max(0, Math.ceil(c * .1)), C -= Math.max(0, Math.ceil(C * .1)), h -= Math.max(0, Math.ceil(h * .1)), x = F$1(v.relativeLuminance2(c, C, h), v.relativeLuminance2(l, f, d));
		return (c << 24 | C << 16 | h << 8 | 255) >>> 0;
	}
	a.reduceLuminance = e;
	function r(s, i, n) {
		let l = s >> 24 & 255, f = s >> 16 & 255, d = s >> 8 & 255, c = i >> 24 & 255, C = i >> 16 & 255, h = i >> 8 & 255, x = F$1(v.relativeLuminance2(c, C, h), v.relativeLuminance2(l, f, d));
		for (; x < n && (c < 255 || C < 255 || h < 255);) c = Math.min(255, c + Math.ceil((255 - c) * .1)), C = Math.min(255, C + Math.ceil((255 - C) * .1)), h = Math.min(255, h + Math.ceil((255 - h) * .1)), x = F$1(v.relativeLuminance2(c, C, h), v.relativeLuminance2(l, f, d));
		return (c << 24 | C << 16 | h << 8 | 255) >>> 0;
	}
	a.increaseLuminance = r;
	function t(s) {
		return [
			s >> 24 & 255,
			s >> 16 & 255,
			s >> 8 & 255,
			s & 255
		];
	}
	a.toChannels = t;
})(y ||= {});
function B$1(u) {
	let o = u.toString(16);
	return o.length < 2 ? "0" + o : o;
}
function F$1(u, o) {
	return u < o ? (o + .05) / (u + .05) : (u + .05) / (o + .05);
}
var E = Object.freeze((() => {
	let u = [
		_.toColor("#2e3436"),
		_.toColor("#cc0000"),
		_.toColor("#4e9a06"),
		_.toColor("#c4a000"),
		_.toColor("#3465a4"),
		_.toColor("#75507b"),
		_.toColor("#06989a"),
		_.toColor("#d3d7cf"),
		_.toColor("#555753"),
		_.toColor("#ef2929"),
		_.toColor("#8ae234"),
		_.toColor("#fce94f"),
		_.toColor("#729fcf"),
		_.toColor("#ad7fa8"),
		_.toColor("#34e2e2"),
		_.toColor("#eeeeec")
	], o = [
		0,
		95,
		135,
		175,
		215,
		255
	];
	for (let e = 0; e < 216; e++) {
		let r = o[e / 36 % 6 | 0], t = o[e / 6 % 6 | 0], a = o[e % 6];
		u.push({
			css: I.toCss(r, t, a),
			rgba: I.toRgba(r, t, a)
		});
	}
	for (let e = 0; e < 24; e++) {
		let r = 8 + e * 10;
		u.push({
			css: I.toCss(r, r, r),
			rgba: I.toRgba(r, r, r)
		});
	}
	return u;
})());
function A$1(u, o, e) {
	return Math.max(o, Math.min(u, e));
}
function O(u) {
	switch (u) {
		case "&": return "&amp;";
		case "<": return "&lt;";
	}
	return u;
}
var S$1 = class {
	constructor(o) {
		this._buffer = o;
	}
	serialize(o, e) {
		let r = this._buffer.getNullCell(), t = this._buffer.getNullCell(), a = r, s = o.start.y, i = o.end.y, n = o.start.x, l = o.end.x;
		this._beforeSerialize(i - s, s, i);
		for (let f = s; f <= i; f++) {
			let d = this._buffer.getLine(f);
			if (d) {
				let c = f === o.start.y ? n : 0, C = f === o.end.y ? l : d.length;
				for (let h = c; h < C; h++) {
					let x = d.getCell(h, a === r ? t : r);
					if (!x) {
						console.warn(`Can't get cell at row=${f}, col=${h}`);
						continue;
					}
					this._nextCell(x, a, f, h), a = x;
				}
			}
			this._rowEnd(f, f === i);
		}
		return this._afterSerialize(), this._serializeString(e);
	}
	_nextCell(o, e, r, t) {}
	_rowEnd(o, e) {}
	_beforeSerialize(o, e, r) {}
	_afterSerialize() {}
	_serializeString(o) {
		return "";
	}
};
function T(u, o) {
	return u.getFgColorMode() === o.getFgColorMode() && u.getFgColor() === o.getFgColor();
}
function w(u, o) {
	return u.getBgColorMode() === o.getBgColorMode() && u.getBgColor() === o.getBgColor();
}
function z$1(u, o) {
	return u.isInverse() === o.isInverse() && u.isBold() === o.isBold() && u.isUnderline() === o.isUnderline() && u.isOverline() === o.isOverline() && u.isBlink() === o.isBlink() && u.isInvisible() === o.isInvisible() && u.isItalic() === o.isItalic() && u.isDim() === o.isDim() && u.isStrikethrough() === o.isStrikethrough();
}
var k$1 = class extends S$1 {
	constructor(e, r) {
		super(e);
		this._terminal = r;
		this._rowIndex = 0;
		this._allRows = new Array();
		this._allRowSeparators = new Array();
		this._currentRow = "";
		this._nullCellCount = 0;
		this._cursorStyle = this._buffer.getNullCell();
		this._cursorStyleRow = 0;
		this._cursorStyleCol = 0;
		this._backgroundCell = this._buffer.getNullCell();
		this._firstRow = 0;
		this._lastCursorRow = 0;
		this._lastCursorCol = 0;
		this._lastContentCursorRow = 0;
		this._lastContentCursorCol = 0;
		this._thisRowLastChar = this._buffer.getNullCell();
		this._thisRowLastSecondChar = this._buffer.getNullCell();
		this._nextRowFirstChar = this._buffer.getNullCell();
	}
	_beforeSerialize(e, r, t) {
		this._allRows = new Array(e), this._lastContentCursorRow = r, this._lastCursorRow = r, this._firstRow = r;
	}
	_rowEnd(e, r) {
		this._nullCellCount > 0 && !w(this._cursorStyle, this._backgroundCell) && (this._currentRow += `\x1B[${this._nullCellCount}X`);
		let t = "";
		if (!r) {
			e - this._firstRow >= this._terminal.rows && this._buffer.getLine(this._cursorStyleRow)?.getCell(this._cursorStyleCol, this._backgroundCell);
			let a = this._buffer.getLine(e), s = this._buffer.getLine(e + 1);
			if (!s.isWrapped) t = `\r
`, this._lastCursorRow = e + 1, this._lastCursorCol = 0;
			else {
				t = "";
				let i = a.getCell(a.length - 1, this._thisRowLastChar), n = a.getCell(a.length - 2, this._thisRowLastSecondChar), l = s.getCell(0, this._nextRowFirstChar), f = l.getWidth() > 1, d = !1;
				(l.getChars() && f ? this._nullCellCount <= 1 : this._nullCellCount <= 0) && ((i.getChars() || i.getWidth() === 0) && w(i, l) && (d = !0), f && (n.getChars() || n.getWidth() === 0) && w(i, l) && w(n, l) && (d = !0)), d || (t = "-".repeat(this._nullCellCount + 1), t += "\x1B[1D\x1B[1X", this._nullCellCount > 0 && (t += "\x1B[A", t += `\x1B[${a.length - this._nullCellCount}C`, t += `\x1B[${this._nullCellCount}X`, t += `\x1B[${a.length - this._nullCellCount}D`, t += "\x1B[B"), this._lastContentCursorRow = e + 1, this._lastContentCursorCol = 0, this._lastCursorRow = e + 1, this._lastCursorCol = 0);
			}
		}
		this._allRows[this._rowIndex] = this._currentRow, this._allRowSeparators[this._rowIndex++] = t, this._currentRow = "", this._nullCellCount = 0;
	}
	_diffStyle(e, r) {
		let t = [], a = !T(e, r), s = !w(e, r), i = !z$1(e, r);
		if (a || s || i) if (e.isAttributeDefault()) r.isAttributeDefault() || t.push(0);
		else {
			if (a) {
				let n = e.getFgColor();
				e.isFgRGB() ? t.push(38, 2, n >>> 16 & 255, n >>> 8 & 255, n & 255) : e.isFgPalette() ? n >= 16 ? t.push(38, 5, n) : t.push(n & 8 ? 90 + (n & 7) : 30 + (n & 7)) : t.push(39);
			}
			if (s) {
				let n = e.getBgColor();
				e.isBgRGB() ? t.push(48, 2, n >>> 16 & 255, n >>> 8 & 255, n & 255) : e.isBgPalette() ? n >= 16 ? t.push(48, 5, n) : t.push(n & 8 ? 100 + (n & 7) : 40 + (n & 7)) : t.push(49);
			}
			i && (e.isInverse() !== r.isInverse() && t.push(e.isInverse() ? 7 : 27), e.isBold() !== r.isBold() && t.push(e.isBold() ? 1 : 22), e.isUnderline() !== r.isUnderline() && t.push(e.isUnderline() ? 4 : 24), e.isOverline() !== r.isOverline() && t.push(e.isOverline() ? 53 : 55), e.isBlink() !== r.isBlink() && t.push(e.isBlink() ? 5 : 25), e.isInvisible() !== r.isInvisible() && t.push(e.isInvisible() ? 8 : 28), e.isItalic() !== r.isItalic() && t.push(e.isItalic() ? 3 : 23), e.isDim() !== r.isDim() && t.push(e.isDim() ? 2 : 22), e.isStrikethrough() !== r.isStrikethrough() && t.push(e.isStrikethrough() ? 9 : 29));
		}
		return t;
	}
	_nextCell(e, r, t, a) {
		if (e.getWidth() === 0) return;
		let i = e.getChars() === "", n = this._diffStyle(e, this._cursorStyle);
		if (i ? !w(this._cursorStyle, e) : n.length > 0) {
			this._nullCellCount > 0 && (w(this._cursorStyle, this._backgroundCell) || (this._currentRow += `\x1B[${this._nullCellCount}X`), this._currentRow += `\x1B[${this._nullCellCount}C`, this._nullCellCount = 0), this._lastContentCursorRow = this._lastCursorRow = t, this._lastContentCursorCol = this._lastCursorCol = a, this._currentRow += `\x1B[${n.join(";")}m`;
			let f = this._buffer.getLine(t);
			f !== void 0 && (f.getCell(a, this._cursorStyle), this._cursorStyleRow = t, this._cursorStyleCol = a);
		}
		i ? this._nullCellCount += e.getWidth() : (this._nullCellCount > 0 && (w(this._cursorStyle, this._backgroundCell) ? this._currentRow += `\x1B[${this._nullCellCount}C` : (this._currentRow += `\x1B[${this._nullCellCount}X`, this._currentRow += `\x1B[${this._nullCellCount}C`), this._nullCellCount = 0), this._currentRow += e.getChars(), this._lastContentCursorRow = this._lastCursorRow = t, this._lastContentCursorCol = this._lastCursorCol = a + e.getWidth());
	}
	_serializeString(e) {
		let r = this._allRows.length;
		this._buffer.length - this._firstRow <= this._terminal.rows && (r = this._lastContentCursorRow + 1 - this._firstRow, this._lastCursorCol = this._lastContentCursorCol, this._lastCursorRow = this._lastContentCursorRow);
		let t = "";
		for (let i = 0; i < r; i++) t += this._allRows[i], i + 1 < r && (t += this._allRowSeparators[i]);
		if (!e) {
			let i = this._buffer.baseY + this._buffer.cursorY, n = this._buffer.cursorX, l = i !== this._lastCursorRow || n !== this._lastCursorCol, f = (c) => {
				c > 0 ? t += `\x1B[${c}C` : c < 0 && (t += `\x1B[${-c}D`);
			};
			l && (((c) => {
				c > 0 ? t += `\x1B[${c}B` : c < 0 && (t += `\x1B[${-c}A`);
			})(i - this._lastCursorRow), f(n - this._lastCursorCol));
		}
		let a = this._terminal._core._inputHandler._curAttrData, s = this._diffStyle(a, this._cursorStyle);
		return s.length > 0 && (t += `\x1B[${s.join(";")}m`), t;
	}
};
var D = class {
	activate(o) {
		this._terminal = o;
	}
	_serializeBufferByScrollback(o, e, r) {
		let t = e.length, a = r === void 0 ? t : A$1(r + o.rows, 0, t);
		return this._serializeBufferByRange(o, e, {
			start: t - a,
			end: t - 1
		}, !1);
	}
	_serializeBufferByRange(o, e, r, t) {
		return new k$1(e, o).serialize({
			start: {
				x: 0,
				y: typeof r.start == "number" ? r.start : r.start.line
			},
			end: {
				x: o.cols,
				y: typeof r.end == "number" ? r.end : r.end.line
			}
		}, t);
	}
	_serializeBufferAsHTML(o, e) {
		let r = o.buffer.active, t = new M$1(r, o, e), a = e.onlySelection ?? !1, s = e.range;
		if (s) return t.serialize({
			start: {
				x: s.startCol,
				y: (s.startLine, s.startLine)
			},
			end: {
				x: o.cols,
				y: (s.endLine, s.endLine)
			}
		});
		if (!a) {
			let n = r.length, l = e.scrollback, f = l === void 0 ? n : A$1(l + o.rows, 0, n);
			return t.serialize({
				start: {
					x: 0,
					y: n - f
				},
				end: {
					x: o.cols,
					y: n - 1
				}
			});
		}
		let i = this._terminal?.getSelectionPosition();
		return i !== void 0 ? t.serialize({
			start: {
				x: i.start.x,
				y: i.start.y
			},
			end: {
				x: i.end.x,
				y: i.end.y
			}
		}) : "";
	}
	_serializeModes(o) {
		let e = "", r = o.modes;
		if (r.applicationCursorKeysMode && (e += "\x1B[?1h"), r.applicationKeypadMode && (e += "\x1B[?66h"), r.bracketedPasteMode && (e += "\x1B[?2004h"), r.insertMode && (e += "\x1B[4h"), r.originMode && (e += "\x1B[?6h"), r.reverseWraparoundMode && (e += "\x1B[?45h"), r.sendFocusMode && (e += "\x1B[?1004h"), r.wraparoundMode === !1 && (e += "\x1B[?7l"), r.mouseTrackingMode !== "none") switch (r.mouseTrackingMode) {
			case "x10":
				e += "\x1B[?9h";
				break;
			case "vt200":
				e += "\x1B[?1000h";
				break;
			case "drag":
				e += "\x1B[?1002h";
				break;
			case "any":
				e += "\x1B[?1003h";
				break;
		}
		return e;
	}
	serialize(o) {
		if (!this._terminal) throw new Error("Cannot use addon until it has been loaded");
		let e = o?.range ? this._serializeBufferByRange(this._terminal, this._terminal.buffer.normal, o.range, !0) : this._serializeBufferByScrollback(this._terminal, this._terminal.buffer.normal, o?.scrollback);
		if (!o?.excludeAltBuffer && this._terminal.buffer.active.type === "alternate") {
			let r = this._serializeBufferByScrollback(this._terminal, this._terminal.buffer.alternate, void 0);
			e += `\x1B[?1049h\x1B[H${r}`;
		}
		return o?.excludeModes || (e += this._serializeModes(this._terminal)), e;
	}
	serializeAsHTML(o) {
		if (!this._terminal) throw new Error("Cannot use addon until it has been loaded");
		return this._serializeBufferAsHTML(this._terminal, o || {});
	}
	dispose() {}
};
var M$1 = class extends S$1 {
	constructor(e, r, t) {
		super(e);
		this._terminal = r;
		this._options = t;
		this._currentRow = "";
		this._htmlContent = "";
		r._core._themeService ? this._ansiColors = r._core._themeService.colors.ansi : this._ansiColors = E;
	}
	_padStart(e, r, t) {
		return r = r >> 0, t = t ?? " ", e.length > r ? e : (r -= e.length, r > t.length && (t += t.repeat(r / t.length)), t.slice(0, r) + e);
	}
	_beforeSerialize(e, r, t) {
		this._htmlContent += "<html><body><!--StartFragment--><pre>";
		let a = "#000000", s = "#ffffff";
		(this._options.includeGlobalBackground ?? !1) && (a = this._terminal.options.theme?.foreground ?? "#ffffff", s = this._terminal.options.theme?.background ?? "#000000");
		let i = [];
		i.push("color: " + a + ";"), i.push("background-color: " + s + ";"), i.push("font-family: " + this._terminal.options.fontFamily + ";"), i.push("font-size: " + this._terminal.options.fontSize + "px;"), this._htmlContent += "<div style='" + i.join(" ") + "'>";
	}
	_afterSerialize() {
		this._htmlContent += "</div>", this._htmlContent += "</pre><!--EndFragment--></body></html>";
	}
	_rowEnd(e, r) {
		this._htmlContent += "<div><span>" + this._currentRow + "</span></div>", this._currentRow = "";
	}
	_getHexColor(e, r) {
		let t = r ? e.getFgColor() : e.getBgColor();
		if (r ? e.isFgRGB() : e.isBgRGB()) return "#" + [
			t >> 16 & 255,
			t >> 8 & 255,
			t & 255
		].map((s) => this._padStart(s.toString(16), 2, "0")).join("");
		if (r ? e.isFgPalette() : e.isBgPalette()) return this._ansiColors[t].css;
	}
	_diffStyle(e, r) {
		let t = [], a = !T(e, r), s = !w(e, r), i = !z$1(e, r);
		if (a || s || i) {
			let n = this._getHexColor(e, !0);
			n && t.push("color: " + n + ";");
			let l = this._getHexColor(e, !1);
			return l && t.push("background-color: " + l + ";"), e.isInverse() && t.push("color: #000000; background-color: #BFBFBF;"), e.isBold() && t.push("font-weight: bold;"), e.isUnderline() && e.isOverline() ? t.push("text-decoration: overline underline;") : e.isUnderline() ? t.push("text-decoration: underline;") : e.isOverline() && t.push("text-decoration: overline;"), e.isBlink() && t.push("text-decoration: blink;"), e.isInvisible() && t.push("visibility: hidden;"), e.isItalic() && t.push("font-style: italic;"), e.isDim() && t.push("opacity: 0.5;"), e.isStrikethrough() && t.push("text-decoration: line-through;"), t;
		}
	}
	_nextCell(e, r, t, a) {
		if (e.getWidth() === 0) return;
		let i = e.getChars() === "", n = this._diffStyle(e, r);
		n && (this._currentRow += n.length === 0 ? "</span><span>" : "</span><span style='" + n.join(" ") + "'>"), i ? this._currentRow += " " : this._currentRow += O(e.getChars());
	}
	_serializeString() {
		return this._htmlContent;
	}
};
//#endregion
//#region ../../node_modules/.pnpm/@xterm+headless@6.0.0/node_modules/@xterm/headless/lib-headless/xterm-headless.mjs
/**
* Copyright (c) 2014-2024 The xterm.js authors. All rights reserved.
* @license MIT
*
* Copyright (c) 2012-2013, Christopher Jeffrey (MIT License)
* @license MIT
*
* Originally forked from (with the author's permission):
*   Fabrice Bellard's javascript vt100 for jslinux:
*   http://bellard.org/jslinux/
*   Copyright (c) 2011 Fabrice Bellard
*/
var ti = Object.defineProperty;
var ri = Object.getOwnPropertyDescriptor;
var K = (n, t, e, r) => {
	for (var i = r > 1 ? void 0 : r ? ri(t, e) : t, s = n.length - 1, a; s >= 0; s--) (a = n[s]) && (i = (r ? a(t, e, i) : a(i)) || i);
	return r && i && ti(t, e, i), i;
};
var F = (n, t) => (e, r) => t(e, r, n);
function $(n) {
	return n > 65535 ? (n -= 65536, String.fromCharCode((n >> 10) + 55296) + String.fromCharCode(n % 1024 + 56320)) : String.fromCharCode(n);
}
function le(n, t = 0, e = n.length) {
	let r = "";
	for (let i = t; i < e; ++i) {
		let s = n[i];
		s > 65535 ? (s -= 65536, r += String.fromCharCode((s >> 10) + 55296) + String.fromCharCode(s % 1024 + 56320)) : r += String.fromCharCode(s);
	}
	return r;
}
var Ge = class {
	constructor() {
		this._interim = 0;
	}
	clear() {
		this._interim = 0;
	}
	decode(t, e) {
		let r = t.length;
		if (!r) return 0;
		let i = 0, s = 0;
		if (this._interim) {
			let a = t.charCodeAt(s++);
			56320 <= a && a <= 57343 ? e[i++] = (this._interim - 55296) * 1024 + a - 56320 + 65536 : (e[i++] = this._interim, e[i++] = a), this._interim = 0;
		}
		for (let a = s; a < r; ++a) {
			let l = t.charCodeAt(a);
			if (55296 <= l && l <= 56319) {
				if (++a >= r) return this._interim = l, i;
				let c = t.charCodeAt(a);
				56320 <= c && c <= 57343 ? e[i++] = (l - 55296) * 1024 + c - 56320 + 65536 : (e[i++] = l, e[i++] = c);
				continue;
			}
			l !== 65279 && (e[i++] = l);
		}
		return i;
	}
};
var Ke = class {
	constructor() {
		this.interim = /* @__PURE__ */ new Uint8Array(3);
	}
	clear() {
		this.interim.fill(0);
	}
	decode(t, e) {
		let r = t.length;
		if (!r) return 0;
		let i = 0, s, a, l, c, u = 0, m = 0;
		if (this.interim[0]) {
			let x = !1, v = this.interim[0];
			v &= (v & 224) === 192 ? 31 : (v & 240) === 224 ? 15 : 7;
			let _ = 0, d;
			for (; (d = this.interim[++_] & 63) && _ < 4;) v <<= 6, v |= d;
			let R = (this.interim[0] & 224) === 192 ? 2 : (this.interim[0] & 240) === 224 ? 3 : 4, w = R - _;
			for (; m < w;) {
				if (m >= r) return 0;
				if (d = t[m++], (d & 192) !== 128) {
					m--, x = !0;
					break;
				} else this.interim[_++] = d, v <<= 6, v |= d & 63;
			}
			x || (R === 2 ? v < 128 ? m-- : e[i++] = v : R === 3 ? v < 2048 || v >= 55296 && v <= 57343 || v === 65279 || (e[i++] = v) : v < 65536 || v > 1114111 || (e[i++] = v)), this.interim.fill(0);
		}
		let o = r - 4, h = m;
		for (; h < r;) {
			for (; h < o && !((s = t[h]) & 128) && !((a = t[h + 1]) & 128) && !((l = t[h + 2]) & 128) && !((c = t[h + 3]) & 128);) e[i++] = s, e[i++] = a, e[i++] = l, e[i++] = c, h += 4;
			if (s = t[h++], s < 128) e[i++] = s;
			else if ((s & 224) === 192) {
				if (h >= r) return this.interim[0] = s, i;
				if (a = t[h++], (a & 192) !== 128) {
					h--;
					continue;
				}
				if (u = (s & 31) << 6 | a & 63, u < 128) {
					h--;
					continue;
				}
				e[i++] = u;
			} else if ((s & 240) === 224) {
				if (h >= r) return this.interim[0] = s, i;
				if (a = t[h++], (a & 192) !== 128) {
					h--;
					continue;
				}
				if (h >= r) return this.interim[0] = s, this.interim[1] = a, i;
				if (l = t[h++], (l & 192) !== 128) {
					h--;
					continue;
				}
				if (u = (s & 15) << 12 | (a & 63) << 6 | l & 63, u < 2048 || u >= 55296 && u <= 57343 || u === 65279) continue;
				e[i++] = u;
			} else if ((s & 248) === 240) {
				if (h >= r) return this.interim[0] = s, i;
				if (a = t[h++], (a & 192) !== 128) {
					h--;
					continue;
				}
				if (h >= r) return this.interim[0] = s, this.interim[1] = a, i;
				if (l = t[h++], (l & 192) !== 128) {
					h--;
					continue;
				}
				if (h >= r) return this.interim[0] = s, this.interim[1] = a, this.interim[2] = l, i;
				if (c = t[h++], (c & 192) !== 128) {
					h--;
					continue;
				}
				if (u = (s & 7) << 18 | (a & 63) << 12 | (l & 63) << 6 | c & 63, u < 65536 || u > 1114111) continue;
				e[i++] = u;
			}
		}
		return i;
	}
};
var Ve = "";
var ze = " ";
var te = class n {
	constructor() {
		this.fg = 0;
		this.bg = 0;
		this.extended = new re();
	}
	static toColorRGB(t) {
		return [
			t >>> 16 & 255,
			t >>> 8 & 255,
			t & 255
		];
	}
	static fromColorRGB(t) {
		return (t[0] & 255) << 16 | (t[1] & 255) << 8 | t[2] & 255;
	}
	clone() {
		let t = new n();
		return t.fg = this.fg, t.bg = this.bg, t.extended = this.extended.clone(), t;
	}
	isInverse() {
		return this.fg & 67108864;
	}
	isBold() {
		return this.fg & 134217728;
	}
	isUnderline() {
		return this.hasExtendedAttrs() && this.extended.underlineStyle !== 0 ? 1 : this.fg & 268435456;
	}
	isBlink() {
		return this.fg & 536870912;
	}
	isInvisible() {
		return this.fg & 1073741824;
	}
	isItalic() {
		return this.bg & 67108864;
	}
	isDim() {
		return this.bg & 134217728;
	}
	isStrikethrough() {
		return this.fg & 2147483648;
	}
	isProtected() {
		return this.bg & 536870912;
	}
	isOverline() {
		return this.bg & 1073741824;
	}
	getFgColorMode() {
		return this.fg & 50331648;
	}
	getBgColorMode() {
		return this.bg & 50331648;
	}
	isFgRGB() {
		return (this.fg & 50331648) === 50331648;
	}
	isBgRGB() {
		return (this.bg & 50331648) === 50331648;
	}
	isFgPalette() {
		return (this.fg & 50331648) === 16777216 || (this.fg & 50331648) === 33554432;
	}
	isBgPalette() {
		return (this.bg & 50331648) === 16777216 || (this.bg & 50331648) === 33554432;
	}
	isFgDefault() {
		return (this.fg & 50331648) === 0;
	}
	isBgDefault() {
		return (this.bg & 50331648) === 0;
	}
	isAttributeDefault() {
		return this.fg === 0 && this.bg === 0;
	}
	getFgColor() {
		switch (this.fg & 50331648) {
			case 16777216:
			case 33554432: return this.fg & 255;
			case 50331648: return this.fg & 16777215;
			default: return -1;
		}
	}
	getBgColor() {
		switch (this.bg & 50331648) {
			case 16777216:
			case 33554432: return this.bg & 255;
			case 50331648: return this.bg & 16777215;
			default: return -1;
		}
	}
	hasExtendedAttrs() {
		return this.bg & 268435456;
	}
	updateExtended() {
		this.extended.isEmpty() ? this.bg &= -268435457 : this.bg |= 268435456;
	}
	getUnderlineColor() {
		if (this.bg & 268435456 && ~this.extended.underlineColor) switch (this.extended.underlineColor & 50331648) {
			case 16777216:
			case 33554432: return this.extended.underlineColor & 255;
			case 50331648: return this.extended.underlineColor & 16777215;
			default: return this.getFgColor();
		}
		return this.getFgColor();
	}
	getUnderlineColorMode() {
		return this.bg & 268435456 && ~this.extended.underlineColor ? this.extended.underlineColor & 50331648 : this.getFgColorMode();
	}
	isUnderlineColorRGB() {
		return this.bg & 268435456 && ~this.extended.underlineColor ? (this.extended.underlineColor & 50331648) === 50331648 : this.isFgRGB();
	}
	isUnderlineColorPalette() {
		return this.bg & 268435456 && ~this.extended.underlineColor ? (this.extended.underlineColor & 50331648) === 16777216 || (this.extended.underlineColor & 50331648) === 33554432 : this.isFgPalette();
	}
	isUnderlineColorDefault() {
		return this.bg & 268435456 && ~this.extended.underlineColor ? (this.extended.underlineColor & 50331648) === 0 : this.isFgDefault();
	}
	getUnderlineStyle() {
		return this.fg & 268435456 ? this.bg & 268435456 ? this.extended.underlineStyle : 1 : 0;
	}
	getUnderlineVariantOffset() {
		return this.extended.underlineVariantOffset;
	}
};
var re = class n {
	constructor(t = 0, e = 0) {
		this._ext = 0;
		this._urlId = 0;
		this._ext = t, this._urlId = e;
	}
	get ext() {
		return this._urlId ? this._ext & -469762049 | this.underlineStyle << 26 : this._ext;
	}
	set ext(t) {
		this._ext = t;
	}
	get underlineStyle() {
		return this._urlId ? 5 : (this._ext & 469762048) >> 26;
	}
	set underlineStyle(t) {
		this._ext &= -469762049, this._ext |= t << 26 & 469762048;
	}
	get underlineColor() {
		return this._ext & 67108863;
	}
	set underlineColor(t) {
		this._ext &= -67108864, this._ext |= t & 67108863;
	}
	get urlId() {
		return this._urlId;
	}
	set urlId(t) {
		this._urlId = t;
	}
	get underlineVariantOffset() {
		let t = (this._ext & 3758096384) >> 29;
		return t < 0 ? t ^ 4294967288 : t;
	}
	set underlineVariantOffset(t) {
		this._ext &= 536870911, this._ext |= t << 29 & 3758096384;
	}
	clone() {
		return new n(this._ext, this._urlId);
	}
	isEmpty() {
		return this.underlineStyle === 0 && this._urlId === 0;
	}
};
var G = class n extends te {
	constructor() {
		super(...arguments);
		this.content = 0;
		this.fg = 0;
		this.bg = 0;
		this.extended = new re();
		this.combinedData = "";
	}
	static fromCharData(e) {
		let r = new n();
		return r.setFromCharData(e), r;
	}
	isCombined() {
		return this.content & 2097152;
	}
	getWidth() {
		return this.content >> 22;
	}
	getChars() {
		return this.content & 2097152 ? this.combinedData : this.content & 2097151 ? $(this.content & 2097151) : "";
	}
	getCode() {
		return this.isCombined() ? this.combinedData.charCodeAt(this.combinedData.length - 1) : this.content & 2097151;
	}
	setFromCharData(e) {
		this.fg = e[0], this.bg = 0;
		let r = !1;
		if (e[1].length > 2) r = !0;
		else if (e[1].length === 2) {
			let i = e[1].charCodeAt(0);
			if (55296 <= i && i <= 56319) {
				let s = e[1].charCodeAt(1);
				56320 <= s && s <= 57343 ? this.content = (i - 55296) * 1024 + s - 56320 + 65536 | e[2] << 22 : r = !0;
			} else r = !0;
		} else this.content = e[1].charCodeAt(0) | e[2] << 22;
		r && (this.combinedData = e[1], this.content = 2097152 | e[2] << 22);
	}
	getAsCharData() {
		return [
			this.fg,
			this.getChars(),
			this.getWidth(),
			this.getCode()
		];
	}
};
var qe = class {
	constructor(t) {
		this._line = t;
	}
	get isWrapped() {
		return this._line.isWrapped;
	}
	get length() {
		return this._line.length;
	}
	getCell(t, e) {
		if (!(t < 0 || t >= this._line.length)) return e ? (this._line.loadCell(t, e), e) : this._line.loadCell(t, new G());
	}
	translateToString(t, e, r) {
		return this._line.translateToString(t, e, r);
	}
};
var De = class {
	constructor(t, e) {
		this._buffer = t;
		this.type = e;
	}
	init(t) {
		return this._buffer = t, this;
	}
	get cursorY() {
		return this._buffer.y;
	}
	get cursorX() {
		return this._buffer.x;
	}
	get viewportY() {
		return this._buffer.ydisp;
	}
	get baseY() {
		return this._buffer.ybase;
	}
	get length() {
		return this._buffer.lines.length;
	}
	getLine(t) {
		let e = this._buffer.lines.get(t);
		if (e) return new qe(e);
	}
	getNullCell() {
		return new G();
	}
};
var kt = class {
	constructor() {
		this.listeners = [], this.unexpectedErrorHandler = function(t) {
			setTimeout(() => {
				throw t.stack ? je.isErrorNoTelemetry(t) ? new je(t.message + `

` + t.stack) : /* @__PURE__ */ new Error(t.message + `

` + t.stack) : t;
			}, 0);
		};
	}
	addListener(t) {
		return this.listeners.push(t), () => {
			this._removeListener(t);
		};
	}
	emit(t) {
		this.listeners.forEach((e) => {
			e(t);
		});
	}
	_removeListener(t) {
		this.listeners.splice(this.listeners.indexOf(t), 1);
	}
	setUnexpectedErrorHandler(t) {
		this.unexpectedErrorHandler = t;
	}
	getUnexpectedErrorHandler() {
		return this.unexpectedErrorHandler;
	}
	onUnexpectedError(t) {
		this.unexpectedErrorHandler(t), this.emit(t);
	}
	onUnexpectedExternalError(t) {
		this.unexpectedErrorHandler(t);
	}
};
var ni = new kt();
function Xe(n) {
	oi(n) || ni.onUnexpectedError(n);
}
var Bt = "Canceled";
function oi(n) {
	return n instanceof $e ? !0 : n instanceof Error && n.name === Bt && n.message === Bt;
}
var $e = class extends Error {
	constructor() {
		super(Bt), this.name = this.message;
	}
};
var je = class n extends Error {
	constructor(t) {
		super(t), this.name = "CodeExpectedError";
	}
	static fromError(t) {
		if (t instanceof n) return t;
		let e = new n();
		return e.message = t.message, e.stack = t.stack, e;
	}
	static isErrorNoTelemetry(t) {
		return t.name === "CodeExpectedError";
	}
};
function ai(n, t, e = 0, r = n.length) {
	let i = e, s = r;
	for (; i < s;) {
		let a = Math.floor((i + s) / 2);
		t(n[a]) ? i = a + 1 : s = a;
	}
	return i - 1;
}
var Ye = class Ye {
	constructor(t) {
		this._array = t;
		this._findLastMonotonousLastIdx = 0;
	}
	findLastMonotonous(t) {
		if (Ye.assertInvariants) {
			if (this._prevFindLastPredicate) {
				for (let r of this._array) if (this._prevFindLastPredicate(r) && !t(r)) throw new Error("MonotonousArray: current predicate must be weaker than (or equal to) the previous predicate.");
			}
			this._prevFindLastPredicate = t;
		}
		let e = ai(this._array, t, this._findLastMonotonousLastIdx);
		return this._findLastMonotonousLastIdx = e + 1, e === -1 ? void 0 : this._array[e];
	}
};
Ye.assertInvariants = !1;
var fr;
((l) => {
	function n(c) {
		return c < 0;
	}
	l.isLessThan = n;
	function t(c) {
		return c <= 0;
	}
	l.isLessThanOrEqual = t;
	function e(c) {
		return c > 0;
	}
	l.isGreaterThan = e;
	function r(c) {
		return c === 0;
	}
	l.isNeitherLessOrGreaterThan = r, l.greaterThan = 1, l.lessThan = -1, l.neitherLessOrGreaterThan = 0;
})(fr ||= {});
function pr(n, t) {
	return (e, r) => t(n(e), n(r));
}
var br = (n, t) => n - t;
var ue = class ue {
	constructor(t) {
		this.iterate = t;
	}
	forEach(t) {
		this.iterate((e) => (t(e), !0));
	}
	toArray() {
		let t = [];
		return this.iterate((e) => (t.push(e), !0)), t;
	}
	filter(t) {
		return new ue((e) => this.iterate((r) => t(r) ? e(r) : !0));
	}
	map(t) {
		return new ue((e) => this.iterate((r) => e(t(r))));
	}
	some(t) {
		let e = !1;
		return this.iterate((r) => (e = t(r), !e)), e;
	}
	findFirst(t) {
		let e;
		return this.iterate((r) => t(r) ? (e = r, !1) : !0), e;
	}
	findLast(t) {
		let e;
		return this.iterate((r) => (t(r) && (e = r), !0)), e;
	}
	findLastMaxBy(t) {
		let e, r = !0;
		return this.iterate((i) => ((r || fr.isGreaterThan(t(i, e))) && (r = !1, e = i), !0)), e;
	}
};
ue.empty = new ue((t) => {});
function gr(n, t) {
	let e = Object.create(null);
	for (let r of n) {
		let i = t(r), s = e[i];
		s || (s = e[i] = []), s.push(r);
	}
	return e;
}
var Qe = class {
	constructor() {
		this.map = /* @__PURE__ */ new Map();
	}
	add(t, e) {
		let r = this.map.get(t);
		r || (r = /* @__PURE__ */ new Set(), this.map.set(t, r)), r.add(e);
	}
	delete(t, e) {
		let r = this.map.get(t);
		r && (r.delete(e), r.size === 0 && this.map.delete(t));
	}
	forEach(t, e) {
		let r = this.map.get(t);
		r && r.forEach(e);
	}
	get(t) {
		return this.map.get(t) || /* @__PURE__ */ new Set();
	}
};
function Lt(n, t) {
	let e = this, r = !1, i;
	return function() {
		if (r) return i;
		if (r = !0, t) try {
			i = n.apply(e, arguments);
		} finally {
			t();
		}
		else i = n.apply(e, arguments);
		return i;
	};
}
var Mt;
((L) => {
	function n(g) {
		return g && typeof g == "object" && typeof g[Symbol.iterator] == "function";
	}
	L.is = n;
	let t = Object.freeze([]);
	function e() {
		return t;
	}
	L.empty = e;
	function* r(g) {
		yield g;
	}
	L.single = r;
	function i(g) {
		return n(g) ? g : r(g);
	}
	L.wrap = i;
	function s(g) {
		return g || t;
	}
	L.from = s;
	function* a(g) {
		for (let D = g.length - 1; D >= 0; D--) yield g[D];
	}
	L.reverse = a;
	function l(g) {
		return !g || g[Symbol.iterator]().next().done === !0;
	}
	L.isEmpty = l;
	function c(g) {
		return g[Symbol.iterator]().next().value;
	}
	L.first = c;
	function u(g, D) {
		let E = 0;
		for (let W of g) if (D(W, E++)) return !0;
		return !1;
	}
	L.some = u;
	function m(g, D) {
		for (let E of g) if (D(E)) return E;
	}
	L.find = m;
	function* o(g, D) {
		for (let E of g) D(E) && (yield E);
	}
	L.filter = o;
	function* h(g, D) {
		let E = 0;
		for (let W of g) yield D(W, E++);
	}
	L.map = h;
	function* x(g, D) {
		let E = 0;
		for (let W of g) yield* D(W, E++);
	}
	L.flatMap = x;
	function* v(...g) {
		for (let D of g) yield* D;
	}
	L.concat = v;
	function _(g, D, E) {
		let W = E;
		for (let se of g) W = D(W, se);
		return W;
	}
	L.reduce = _;
	function* d(g, D, E = g.length) {
		for (D < 0 && (D += g.length), E < 0 ? E += g.length : E > g.length && (E = g.length); D < E; D++) yield g[D];
	}
	L.slice = d;
	function R(g, D = Number.POSITIVE_INFINITY) {
		let E = [];
		if (D === 0) return [E, g];
		let W = g[Symbol.iterator]();
		for (let se = 0; se < D; se++) {
			let ye = W.next();
			if (ye.done) return [E, L.empty()];
			E.push(ye.value);
		}
		return [E, { [Symbol.iterator]() {
			return W;
		} }];
	}
	L.consume = R;
	async function w(g) {
		let D = [];
		for await (let E of g) D.push(E);
		return Promise.resolve(D);
	}
	L.asyncToArray = w;
})(Mt ||= {});
var li = !1;
var de = null;
var Ze = class Ze {
	constructor() {
		this.livingDisposables = /* @__PURE__ */ new Map();
	}
	getDisposableData(t) {
		let e = this.livingDisposables.get(t);
		return e || (e = {
			parent: null,
			source: null,
			isSingleton: !1,
			value: t,
			idx: Ze.idx++
		}, this.livingDisposables.set(t, e)), e;
	}
	trackDisposable(t) {
		let e = this.getDisposableData(t);
		e.source || (e.source = (/* @__PURE__ */ new Error()).stack);
	}
	setParent(t, e) {
		let r = this.getDisposableData(t);
		r.parent = e;
	}
	markAsDisposed(t) {
		this.livingDisposables.delete(t);
	}
	markAsSingleton(t) {
		this.getDisposableData(t).isSingleton = !0;
	}
	getRootParent(t, e) {
		let r = e.get(t);
		if (r) return r;
		let i = t.parent ? this.getRootParent(this.getDisposableData(t.parent), e) : t;
		return e.set(t, i), i;
	}
	getTrackedDisposables() {
		let t = /* @__PURE__ */ new Map();
		return [...this.livingDisposables.entries()].filter(([, r]) => r.source !== null && !this.getRootParent(r, t).isSingleton).flatMap(([r]) => r);
	}
	computeLeakingDisposables(t = 10, e) {
		let r;
		if (e) r = e;
		else {
			let c = /* @__PURE__ */ new Map(), u = [...this.livingDisposables.values()].filter((o) => o.source !== null && !this.getRootParent(o, c).isSingleton);
			if (u.length === 0) return;
			let m = new Set(u.map((o) => o.value));
			if (r = u.filter((o) => !(o.parent && m.has(o.parent))), r.length === 0) throw new Error("There are cyclic diposable chains!");
		}
		if (!r) return;
		function i(c) {
			function u(o, h) {
				for (; o.length > 0 && h.some((x) => typeof x == "string" ? x === o[0] : o[0].match(x));) o.shift();
			}
			let m = c.source.split(`
`).map((o) => o.trim().replace("at ", "")).filter((o) => o !== "");
			return u(m, [
				"Error",
				/^trackDisposable \(.*\)$/,
				/^DisposableTracker.trackDisposable \(.*\)$/
			]), m.reverse();
		}
		let s = new Qe();
		for (let c of r) {
			let u = i(c);
			for (let m = 0; m <= u.length; m++) s.add(u.slice(0, m).join(`
`), c);
		}
		r.sort(pr((c) => c.idx, br));
		let a = "", l = 0;
		for (let c of r.slice(0, t)) {
			l++;
			let u = i(c), m = [];
			for (let o = 0; o < u.length; o++) {
				let h = u[o];
				h = `(shared with ${s.get(u.slice(0, o + 1).join(`
`)).size}/${r.length} leaks) at ${h}`;
				let _ = gr([...s.get(u.slice(0, o).join(`
`))].map((d) => i(d)[o]), (d) => d);
				delete _[u[o]];
				for (let [d, R] of Object.entries(_)) m.unshift(`    - stacktraces of ${R.length} other leaks continue with ${d}`);
				m.unshift(h);
			}
			a += `


==================== Leaking disposable ${l}/${r.length}: ${c.value.constructor.name} ====================
${m.join(`
`)}
============================================================

`;
		}
		return r.length > t && (a += `


... and ${r.length - t} more leaking disposables

`), {
			leaks: r,
			details: a
		};
	}
};
Ze.idx = 0;
function ci(n) {
	de = n;
}
if (li) {
	let n = "__is_disposable_tracked__";
	ci(new class {
		trackDisposable(t) {
			let e = (/* @__PURE__ */ new Error("Potentially leaked disposable")).stack;
			setTimeout(() => {
				t[n] || console.log(e);
			}, 3e3);
		}
		setParent(t, e) {
			if (t && t !== A.None) try {
				t[n] = !0;
			} catch {}
		}
		markAsDisposed(t) {
			if (t && t !== A.None) try {
				t[n] = !0;
			} catch {}
		}
		markAsSingleton(t) {}
	}());
}
function tt(n) {
	return de?.trackDisposable(n), n;
}
function rt(n) {
	de?.markAsDisposed(n);
}
function Ae(n, t) {
	de?.setParent(n, t);
}
function ui(n, t) {
	if (de) for (let e of n) de.setParent(e, t);
}
function it(n) {
	if (Mt.is(n)) {
		let t = [];
		for (let e of n) if (e) try {
			e.dispose();
		} catch (r) {
			t.push(r);
		}
		if (t.length === 1) throw t[0];
		if (t.length > 1) throw new AggregateError(t, "Encountered errors while disposing of store");
		return Array.isArray(n) ? [] : n;
	} else if (n) return n.dispose(), n;
}
function xr(...n) {
	let t = J(() => it(n));
	return ui(n, t), t;
}
function J(n) {
	let t = tt({ dispose: Lt(() => {
		rt(t), n();
	}) });
	return t;
}
var et = class et {
	constructor() {
		this._toDispose = /* @__PURE__ */ new Set();
		this._isDisposed = !1;
		tt(this);
	}
	dispose() {
		this._isDisposed || (rt(this), this._isDisposed = !0, this.clear());
	}
	get isDisposed() {
		return this._isDisposed;
	}
	clear() {
		if (this._toDispose.size !== 0) try {
			it(this._toDispose);
		} finally {
			this._toDispose.clear();
		}
	}
	add(t) {
		if (!t) return t;
		if (t === this) throw new Error("Cannot register a disposable on itself!");
		return Ae(t, this), this._isDisposed ? et.DISABLE_DISPOSED_WARNING || console.warn((/* @__PURE__ */ new Error("Trying to add a disposable to a DisposableStore that has already been disposed of. The added object will be leaked!")).stack) : this._toDispose.add(t), t;
	}
	delete(t) {
		if (t) {
			if (t === this) throw new Error("Cannot dispose a disposable on itself!");
			this._toDispose.delete(t), t.dispose();
		}
	}
	deleteAndLeak(t) {
		t && this._toDispose.has(t) && (this._toDispose.delete(t), Ae(t, null));
	}
};
et.DISABLE_DISPOSED_WARNING = !1;
var he = et;
var A = class {
	constructor() {
		this._store = new he();
		tt(this), Ae(this._store, this);
	}
	dispose() {
		rt(this), this._store.dispose();
	}
	_register(t) {
		if (t === this) throw new Error("Cannot register a disposable on itself!");
		return this._store.add(t);
	}
};
A.None = Object.freeze({ dispose() {} });
var Je = class {
	constructor() {
		this._isDisposed = !1;
		tt(this);
	}
	get value() {
		return this._isDisposed ? void 0 : this._value;
	}
	set value(t) {
		this._isDisposed || t === this._value || (this._value?.dispose(), t && Ae(t, this), this._value = t);
	}
	clear() {
		this.value = void 0;
	}
	dispose() {
		this._isDisposed = !0, rt(this), this._value?.dispose(), this._value = void 0;
	}
	clearAndLeak() {
		let t = this._value;
		return this._value = void 0, t && Ae(t, null), t;
	}
};
var fe = class fe {
	constructor(t) {
		this.element = t, this.next = fe.Undefined, this.prev = fe.Undefined;
	}
};
fe.Undefined = new fe(void 0);
var di = globalThis.performance && typeof globalThis.performance.now == "function";
var st = class n {
	static create(t) {
		return new n(t);
	}
	constructor(t) {
		this._now = di && t === !1 ? Date.now : globalThis.performance.now.bind(globalThis.performance), this._startTime = this._now(), this._stopTime = -1;
	}
	stop() {
		this._stopTime = this._now();
	}
	reset() {
		this._startTime = this._now(), this._stopTime = -1;
	}
	elapsed() {
		return this._stopTime !== -1 ? this._stopTime - this._startTime : this._now() - this._startTime;
	}
};
var hi = !1;
var Sr = !1;
var fi = !1;
var V;
((oe) => {
	oe.None = () => A.None;
	function t(T) {
		if (fi) {
			let { onDidAddListener: b } = T, f = Oe.create(), I = 0;
			T.onDidAddListener = () => {
				++I === 2 && (console.warn("snapshotted emitter LIKELY used public and SHOULD HAVE BEEN created with DisposableStore. snapshotted here"), f.print()), b?.();
			};
		}
	}
	function e(T, b) {
		return h(T, () => {}, 0, void 0, !0, void 0, b);
	}
	oe.defer = e;
	function r(T) {
		return (b, f = null, I) => {
			let p = !1, y;
			return y = T((O) => {
				if (!p) return y ? y.dispose() : p = !0, b.call(f, O);
			}, null, I), p && y.dispose(), y;
		};
	}
	oe.once = r;
	function i(T, b, f) {
		return m((I, p = null, y) => T((O) => I.call(p, b(O)), null, y), f);
	}
	oe.map = i;
	function s(T, b, f) {
		return m((I, p = null, y) => T((O) => {
			b(O), I.call(p, O);
		}, null, y), f);
	}
	oe.forEach = s;
	function a(T, b, f) {
		return m((I, p = null, y) => T((O) => b(O) && I.call(p, O), null, y), f);
	}
	oe.filter = a;
	function l(T) {
		return T;
	}
	oe.signal = l;
	function c(...T) {
		return (b, f = null, I) => {
			return o(xr(...T.map((y) => y((O) => b.call(f, O)))), I);
		};
	}
	oe.any = c;
	function u(T, b, f, I) {
		let p = f;
		return i(T, (y) => (p = b(p, y), p), I);
	}
	oe.reduce = u;
	function m(T, b) {
		let f, I = {
			onWillAddFirstListener() {
				f = T(p.fire, p);
			},
			onDidRemoveLastListener() {
				f?.dispose();
			}
		};
		b || t(I);
		let p = new S(I);
		return b?.add(p), p.event;
	}
	function o(T, b) {
		return b instanceof Array ? b.push(T) : b && b.add(T), T;
	}
	function h(T, b, f = 100, I = !1, p = !1, y, O) {
		let N, H, ae, Ue = 0, Ce, ar = {
			leakWarningThreshold: y,
			onWillAddFirstListener() {
				N = T((Zr) => {
					Ue++, H = b(H, Zr), I && !ae && (We.fire(H), H = void 0), Ce = () => {
						let ei = H;
						H = void 0, ae = void 0, (!I || Ue > 1) && We.fire(ei), Ue = 0;
					}, typeof f == "number" ? (clearTimeout(ae), ae = setTimeout(Ce, f)) : ae === void 0 && (ae = 0, queueMicrotask(Ce));
				});
			},
			onWillRemoveListener() {
				p && Ue > 0 && Ce?.();
			},
			onDidRemoveLastListener() {
				Ce = void 0, N.dispose();
			}
		};
		O || t(ar);
		let We = new S(ar);
		return O?.add(We), We.event;
	}
	oe.debounce = h;
	function x(T, b = 0, f) {
		return oe.debounce(T, (I, p) => I ? (I.push(p), I) : [p], b, void 0, !0, void 0, f);
	}
	oe.accumulate = x;
	function v(T, b = (I, p) => I === p, f) {
		let I = !0, p;
		return a(T, (y) => {
			let O = I || !b(y, p);
			return I = !1, p = y, O;
		}, f);
	}
	oe.latch = v;
	function _(T, b, f) {
		return [oe.filter(T, b, f), oe.filter(T, (I) => !b(I), f)];
	}
	oe.split = _;
	function d(T, b = !1, f = [], I) {
		let p = f.slice(), y = T((H) => {
			p ? p.push(H) : N.fire(H);
		});
		I && I.add(y);
		let O = () => {
			p?.forEach((H) => N.fire(H)), p = null;
		}, N = new S({
			onWillAddFirstListener() {
				y || (y = T((H) => N.fire(H)), I && I.add(y));
			},
			onDidAddFirstListener() {
				p && (b ? setTimeout(O) : O());
			},
			onDidRemoveLastListener() {
				y && y.dispose(), y = null;
			}
		});
		return I && I.add(N), N.event;
	}
	oe.buffer = d;
	function R(T, b) {
		return (I, p, y) => {
			let O = b(new L());
			return T(function(N) {
				let H = O.evaluate(N);
				H !== w && I.call(p, H);
			}, void 0, y);
		};
	}
	oe.chain = R;
	let w = Symbol("HaltChainable");
	class L {
		constructor() {
			this.steps = [];
		}
		map(b) {
			return this.steps.push(b), this;
		}
		forEach(b) {
			return this.steps.push((f) => (b(f), f)), this;
		}
		filter(b) {
			return this.steps.push((f) => b(f) ? f : w), this;
		}
		reduce(b, f) {
			let I = f;
			return this.steps.push((p) => (I = b(I, p), I)), this;
		}
		latch(b = (f, I) => f === I) {
			let f = !0, I;
			return this.steps.push((p) => {
				let y = f || !b(p, I);
				return f = !1, I = p, y ? p : w;
			}), this;
		}
		evaluate(b) {
			for (let f of this.steps) if (b = f(b), b === w) break;
			return b;
		}
	}
	function g(T, b, f = (I) => I) {
		let I = (...N) => O.fire(f(...N)), p = () => T.on(b, I), y = () => T.removeListener(b, I), O = new S({
			onWillAddFirstListener: p,
			onDidRemoveLastListener: y
		});
		return O.event;
	}
	oe.fromNodeEventEmitter = g;
	function D(T, b, f = (I) => I) {
		let I = (...N) => O.fire(f(...N)), p = () => T.addEventListener(b, I), y = () => T.removeEventListener(b, I), O = new S({
			onWillAddFirstListener: p,
			onDidRemoveLastListener: y
		});
		return O.event;
	}
	oe.fromDOMEventEmitter = D;
	function E(T) {
		return new Promise((b) => r(T)(b));
	}
	oe.toPromise = E;
	function W(T) {
		let b = new S();
		return T.then((f) => {
			b.fire(f);
		}, () => {
			b.fire(void 0);
		}).finally(() => {
			b.dispose();
		}), b.event;
	}
	oe.fromPromise = W;
	function se(T, b) {
		return T((f) => b.fire(f));
	}
	oe.forward = se;
	function ye(T, b, f) {
		return b(f), T((I) => b(I));
	}
	oe.runAndSubscribe = ye;
	class wt {
		constructor(b, f) {
			this._observable = b;
			this._counter = 0;
			this._hasChanged = !1;
			let I = {
				onWillAddFirstListener: () => {
					b.addObserver(this);
				},
				onDidRemoveLastListener: () => {
					b.removeObserver(this);
				}
			};
			f || t(I), this.emitter = new S(I), f && f.add(this.emitter);
		}
		beginUpdate(b) {
			this._counter++;
		}
		handlePossibleChange(b) {}
		handleChange(b, f) {
			this._hasChanged = !0;
		}
		endUpdate(b) {
			this._counter--, this._counter === 0 && (this._observable.reportChanges(), this._hasChanged && (this._hasChanged = !1, this.emitter.fire(this._observable.get())));
		}
	}
	function nr(T, b) {
		return new wt(T, b).emitter.event;
	}
	oe.fromObservable = nr;
	function or(T) {
		return (b, f, I) => {
			let p = 0, y = !1, O = {
				beginUpdate() {
					p++;
				},
				endUpdate() {
					p--, p === 0 && (T.reportChanges(), y && (y = !1, b.call(f)));
				},
				handlePossibleChange() {},
				handleChange() {
					y = !0;
				}
			};
			T.addObserver(O), T.reportChanges();
			let N = { dispose() {
				T.removeObserver(O);
			} };
			return I instanceof he ? I.add(N) : Array.isArray(I) && I.push(N), N;
		};
	}
	oe.fromObservableLight = or;
})(V ||= {});
var pe = class pe {
	constructor(t) {
		this.listenerCount = 0;
		this.invocationCount = 0;
		this.elapsedOverall = 0;
		this.durations = [];
		this.name = `${t}_${pe._idPool++}`, pe.all.add(this);
	}
	start(t) {
		this._stopWatch = new st(), this.listenerCount = t;
	}
	stop() {
		if (this._stopWatch) {
			let t = this._stopWatch.elapsed();
			this.durations.push(t), this.elapsedOverall += t, this.invocationCount += 1, this._stopWatch = void 0;
		}
	}
};
pe.all = /* @__PURE__ */ new Set(), pe._idPool = 0;
var Nt = pe;
var Er = -1;
var ot = class ot {
	constructor(t, e, r = (ot._idPool++).toString(16).padStart(3, "0")) {
		this._errorHandler = t;
		this.threshold = e;
		this.name = r;
		this._warnCountdown = 0;
	}
	dispose() {
		this._stacks?.clear();
	}
	check(t, e) {
		let r = this.threshold;
		if (r <= 0 || e < r) return;
		this._stacks || (this._stacks = /* @__PURE__ */ new Map());
		let i = this._stacks.get(t.value) || 0;
		if (this._stacks.set(t.value, i + 1), this._warnCountdown -= 1, this._warnCountdown <= 0) {
			this._warnCountdown = r * .5;
			let [s, a] = this.getMostFrequentStack(), l = `[${this.name}] potential listener LEAK detected, having ${e} listeners already. MOST frequent listener (${a}):`;
			console.warn(l), console.warn(s);
			let c = new Ft(l, s);
			this._errorHandler(c);
		}
		return () => {
			let s = this._stacks.get(t.value) || 0;
			this._stacks.set(t.value, s - 1);
		};
	}
	getMostFrequentStack() {
		if (!this._stacks) return;
		let t, e = 0;
		for (let [r, i] of this._stacks) (!t || e < i) && (t = [r, i], e = i);
		return t;
	}
};
ot._idPool = 1;
var Ht = ot;
var Oe = class n {
	constructor(t) {
		this.value = t;
	}
	static create() {
		return new n((/* @__PURE__ */ new Error()).stack ?? "");
	}
	print() {
		console.warn(this.value.split(`
`).slice(2).join(`
`));
	}
};
var Ft = class extends Error {
	constructor(t, e) {
		super(t), this.name = "ListenerLeakError", this.stack = e;
	}
};
var Ut = class extends Error {
	constructor(t, e) {
		super(t), this.name = "ListenerRefusalError", this.stack = e;
	}
};
var pi = 0;
var be = class {
	constructor(t) {
		this.value = t;
		this.id = pi++;
	}
};
var bi = 2;
var _i = (n, t) => {
	if (n instanceof be) t(n);
	else for (let e = 0; e < n.length; e++) {
		let r = n[e];
		r && t(r);
	}
};
var nt;
if (hi) {
	let n = [];
	setInterval(() => {
		n.length !== 0 && (console.warn("[LEAKING LISTENERS] GC'ed these listeners that were NOT yet disposed:"), console.warn(n.join(`
`)), n.length = 0);
	}, 3e3), nt = new FinalizationRegistry((t) => {
		typeof t == "string" && n.push(t);
	});
}
var S = class {
	constructor(t) {
		this._size = 0;
		this._options = t, this._leakageMon = Er > 0 || this._options?.leakWarningThreshold ? new Ht(t?.onListenerError ?? Xe, this._options?.leakWarningThreshold ?? Er) : void 0, this._perfMon = this._options?._profName ? new Nt(this._options._profName) : void 0, this._deliveryQueue = this._options?.deliveryQueue;
	}
	dispose() {
		if (!this._disposed) {
			if (this._disposed = !0, this._deliveryQueue?.current === this && this._deliveryQueue.reset(), this._listeners) {
				if (Sr) {
					let t = this._listeners;
					queueMicrotask(() => {
						_i(t, (e) => e.stack?.print());
					});
				}
				this._listeners = void 0, this._size = 0;
			}
			this._options?.onDidRemoveLastListener?.(), this._leakageMon?.dispose();
		}
	}
	get event() {
		return this._event ??= (t, e, r) => {
			if (this._leakageMon && this._size > this._leakageMon.threshold ** 2) {
				let c = `[${this._leakageMon.name}] REFUSES to accept new listeners because it exceeded its threshold by far (${this._size} vs ${this._leakageMon.threshold})`;
				console.warn(c);
				let u = this._leakageMon.getMostFrequentStack() ?? ["UNKNOWN stack", -1], m = new Ut(`${c}. HINT: Stack shows most frequent listener (${u[1]}-times)`, u[0]);
				return (this._options?.onListenerError || Xe)(m), A.None;
			}
			if (this._disposed) return A.None;
			e && (t = t.bind(e));
			let i = new be(t), s;
			this._leakageMon && this._size >= Math.ceil(this._leakageMon.threshold * .2) && (i.stack = Oe.create(), s = this._leakageMon.check(i.stack, this._size + 1)), this._listeners ? this._listeners instanceof be ? (this._deliveryQueue ??= new Wt(), this._listeners = [this._listeners, i]) : this._listeners.push(i) : (this._options?.onWillAddFirstListener?.(this), this._listeners = i, this._options?.onDidAddFirstListener?.(this)), this._size++;
			let l = J(() => {
				nt?.unregister(l), s?.(), this._removeListener(i);
			});
			if (r instanceof he ? r.add(l) : Array.isArray(r) && r.push(l), nt) {
				let c = (/* @__PURE__ */ new Error()).stack.split(`
`).slice(2, 3).join(`
`).trim(), u = /(file:|vscode-file:\/\/vscode-app)?(\/[^:]*:\d+:\d+)/.exec(c);
				nt.register(l, u?.[2] ?? c, l);
			}
			return l;
		}, this._event;
	}
	_removeListener(t) {
		if (this._options?.onWillRemoveListener?.(this), !this._listeners) return;
		if (this._size === 1) {
			this._listeners = void 0, this._options?.onDidRemoveLastListener?.(this), this._size = 0;
			return;
		}
		let e = this._listeners, r = e.indexOf(t);
		if (r === -1) throw console.log("disposed?", this._disposed), console.log("size?", this._size), console.log("arr?", JSON.stringify(this._listeners)), /* @__PURE__ */ new Error("Attempted to dispose unknown listener");
		this._size--, e[r] = void 0;
		let i = this._deliveryQueue.current === this;
		if (this._size * bi <= e.length) {
			let s = 0;
			for (let a = 0; a < e.length; a++) e[a] ? e[s++] = e[a] : i && (this._deliveryQueue.end--, s < this._deliveryQueue.i && this._deliveryQueue.i--);
			e.length = s;
		}
	}
	_deliver(t, e) {
		if (!t) return;
		let r = this._options?.onListenerError || Xe;
		if (!r) {
			t.value(e);
			return;
		}
		try {
			t.value(e);
		} catch (i) {
			r(i);
		}
	}
	_deliverQueue(t) {
		let e = t.current._listeners;
		for (; t.i < t.end;) this._deliver(e[t.i++], t.value);
		t.reset();
	}
	fire(t) {
		if (this._deliveryQueue?.current && (this._deliverQueue(this._deliveryQueue), this._perfMon?.stop()), this._perfMon?.start(this._size), this._listeners) if (this._listeners instanceof be) this._deliver(this._listeners, t);
		else {
			let e = this._deliveryQueue;
			e.enqueue(this, t, this._listeners.length), this._deliverQueue(e);
		}
		this._perfMon?.stop();
	}
	hasListeners() {
		return this._size > 0;
	}
};
var Wt = class {
	constructor() {
		this.i = -1;
		this.end = 0;
	}
	enqueue(t, e, r) {
		this.i = 0, this.end = r, this.current = t, this.value = e;
	}
	reset() {
		this.i = this.end, this.current = void 0, this.value = void 0;
	}
};
var at = class extends A {
	constructor(e) {
		super();
		this._core = e;
		this._onBufferChange = this._register(new S());
		this.onBufferChange = this._onBufferChange.event;
		this._normal = new De(this._core.buffers.normal, "normal"), this._alternate = new De(this._core.buffers.alt, "alternate"), this._core.buffers.onBufferActivate(() => this._onBufferChange.fire(this.active));
	}
	get active() {
		if (this._core.buffers.active === this._core.buffers.normal) return this.normal;
		if (this._core.buffers.active === this._core.buffers.alt) return this.alternate;
		throw new Error("Active buffer is neither normal nor alternate");
	}
	get normal() {
		return this._normal.init(this._core.buffers.normal);
	}
	get alternate() {
		return this._alternate.init(this._core.buffers.alt);
	}
};
var lt = class {
	constructor(t) {
		this._core = t;
	}
	registerCsiHandler(t, e) {
		return this._core.registerCsiHandler(t, (r) => e(r.toArray()));
	}
	addCsiHandler(t, e) {
		return this.registerCsiHandler(t, e);
	}
	registerDcsHandler(t, e) {
		return this._core.registerDcsHandler(t, (r, i) => e(r, i.toArray()));
	}
	addDcsHandler(t, e) {
		return this.registerDcsHandler(t, e);
	}
	registerEscHandler(t, e) {
		return this._core.registerEscHandler(t, e);
	}
	addEscHandler(t, e) {
		return this.registerEscHandler(t, e);
	}
	registerOscHandler(t, e) {
		return this._core.registerOscHandler(t, e);
	}
	addOscHandler(t, e) {
		return this.registerOscHandler(t, e);
	}
};
var ct = class {
	constructor(t) {
		this._core = t;
	}
	register(t) {
		this._core.unicodeService.register(t);
	}
	get versions() {
		return this._core.unicodeService.versions;
	}
	get activeVersion() {
		return this._core.unicodeService.activeVersion;
	}
	set activeVersion(t) {
		this._core.unicodeService.activeVersion = t;
	}
};
var C = 3;
var k = Object.freeze(new te());
var ut = 0;
var Gt = 2;
var Z = class n {
	constructor(t, e, r = !1) {
		this.isWrapped = r;
		this._combined = {};
		this._extendedAttrs = {};
		this._data = new Uint32Array(t * C);
		let i = e || G.fromCharData([
			0,
			Ve,
			1,
			0
		]);
		for (let s = 0; s < t; ++s) this.setCell(s, i);
		this.length = t;
	}
	get(t) {
		let e = this._data[t * C + 0], r = e & 2097151;
		return [
			this._data[t * C + 1],
			e & 2097152 ? this._combined[t] : r ? $(r) : "",
			e >> 22,
			e & 2097152 ? this._combined[t].charCodeAt(this._combined[t].length - 1) : r
		];
	}
	set(t, e) {
		this._data[t * C + 1] = e[0], e[1].length > 1 ? (this._combined[t] = e[1], this._data[t * C + 0] = t | 2097152 | e[2] << 22) : this._data[t * C + 0] = e[1].charCodeAt(0) | e[2] << 22;
	}
	getWidth(t) {
		return this._data[t * C + 0] >> 22;
	}
	hasWidth(t) {
		return this._data[t * C + 0] & 12582912;
	}
	getFg(t) {
		return this._data[t * C + 1];
	}
	getBg(t) {
		return this._data[t * C + 2];
	}
	hasContent(t) {
		return this._data[t * C + 0] & 4194303;
	}
	getCodePoint(t) {
		let e = this._data[t * C + 0];
		return e & 2097152 ? this._combined[t].charCodeAt(this._combined[t].length - 1) : e & 2097151;
	}
	isCombined(t) {
		return this._data[t * C + 0] & 2097152;
	}
	getString(t) {
		let e = this._data[t * C + 0];
		return e & 2097152 ? this._combined[t] : e & 2097151 ? $(e & 2097151) : "";
	}
	isProtected(t) {
		return this._data[t * C + 2] & 536870912;
	}
	loadCell(t, e) {
		return ut = t * C, e.content = this._data[ut + 0], e.fg = this._data[ut + 1], e.bg = this._data[ut + 2], e.content & 2097152 && (e.combinedData = this._combined[t]), e.bg & 268435456 && (e.extended = this._extendedAttrs[t]), e;
	}
	setCell(t, e) {
		e.content & 2097152 && (this._combined[t] = e.combinedData), e.bg & 268435456 && (this._extendedAttrs[t] = e.extended), this._data[t * C + 0] = e.content, this._data[t * C + 1] = e.fg, this._data[t * C + 2] = e.bg;
	}
	setCellFromCodepoint(t, e, r, i) {
		i.bg & 268435456 && (this._extendedAttrs[t] = i.extended), this._data[t * C + 0] = e | r << 22, this._data[t * C + 1] = i.fg, this._data[t * C + 2] = i.bg;
	}
	addCodepointToCell(t, e, r) {
		let i = this._data[t * C + 0];
		i & 2097152 ? this._combined[t] += $(e) : i & 2097151 ? (this._combined[t] = $(i & 2097151) + $(e), i &= -2097152, i |= 2097152) : i = e | 1 << 22, r && (i &= -12582913, i |= r << 22), this._data[t * C + 0] = i;
	}
	insertCells(t, e, r) {
		if (t %= this.length, t && this.getWidth(t - 1) === 2 && this.setCellFromCodepoint(t - 1, 0, 1, r), e < this.length - t) {
			let i = new G();
			for (let s = this.length - t - e - 1; s >= 0; --s) this.setCell(t + e + s, this.loadCell(t + s, i));
			for (let s = 0; s < e; ++s) this.setCell(t + s, r);
		} else for (let i = t; i < this.length; ++i) this.setCell(i, r);
		this.getWidth(this.length - 1) === 2 && this.setCellFromCodepoint(this.length - 1, 0, 1, r);
	}
	deleteCells(t, e, r) {
		if (t %= this.length, e < this.length - t) {
			let i = new G();
			for (let s = 0; s < this.length - t - e; ++s) this.setCell(t + s, this.loadCell(t + e + s, i));
			for (let s = this.length - e; s < this.length; ++s) this.setCell(s, r);
		} else for (let i = t; i < this.length; ++i) this.setCell(i, r);
		t && this.getWidth(t - 1) === 2 && this.setCellFromCodepoint(t - 1, 0, 1, r), this.getWidth(t) === 0 && !this.hasContent(t) && this.setCellFromCodepoint(t, 0, 1, r);
	}
	replaceCells(t, e, r, i = !1) {
		if (i) {
			for (t && this.getWidth(t - 1) === 2 && !this.isProtected(t - 1) && this.setCellFromCodepoint(t - 1, 0, 1, r), e < this.length && this.getWidth(e - 1) === 2 && !this.isProtected(e) && this.setCellFromCodepoint(e, 0, 1, r); t < e && t < this.length;) this.isProtected(t) || this.setCell(t, r), t++;
			return;
		}
		for (t && this.getWidth(t - 1) === 2 && this.setCellFromCodepoint(t - 1, 0, 1, r), e < this.length && this.getWidth(e - 1) === 2 && this.setCellFromCodepoint(e, 0, 1, r); t < e && t < this.length;) this.setCell(t++, r);
	}
	resize(t, e) {
		if (t === this.length) return this._data.length * 4 * Gt < this._data.buffer.byteLength;
		let r = t * C;
		if (t > this.length) {
			if (this._data.buffer.byteLength >= r * 4) this._data = new Uint32Array(this._data.buffer, 0, r);
			else {
				let i = new Uint32Array(r);
				i.set(this._data), this._data = i;
			}
			for (let i = this.length; i < t; ++i) this.setCell(i, e);
		} else {
			this._data = this._data.subarray(0, r);
			let i = Object.keys(this._combined);
			for (let a = 0; a < i.length; a++) {
				let l = parseInt(i[a], 10);
				l >= t && delete this._combined[l];
			}
			let s = Object.keys(this._extendedAttrs);
			for (let a = 0; a < s.length; a++) {
				let l = parseInt(s[a], 10);
				l >= t && delete this._extendedAttrs[l];
			}
		}
		return this.length = t, r * 4 * Gt < this._data.buffer.byteLength;
	}
	cleanupMemory() {
		if (this._data.length * 4 * Gt < this._data.buffer.byteLength) {
			let t = new Uint32Array(this._data.length);
			return t.set(this._data), this._data = t, 1;
		}
		return 0;
	}
	fill(t, e = !1) {
		if (e) {
			for (let r = 0; r < this.length; ++r) this.isProtected(r) || this.setCell(r, t);
			return;
		}
		this._combined = {}, this._extendedAttrs = {};
		for (let r = 0; r < this.length; ++r) this.setCell(r, t);
	}
	copyFrom(t) {
		this.length !== t.length ? this._data = new Uint32Array(t._data) : this._data.set(t._data), this.length = t.length, this._combined = {};
		for (let e in t._combined) this._combined[e] = t._combined[e];
		this._extendedAttrs = {};
		for (let e in t._extendedAttrs) this._extendedAttrs[e] = t._extendedAttrs[e];
		this.isWrapped = t.isWrapped;
	}
	clone() {
		let t = new n(0);
		t._data = new Uint32Array(this._data), t.length = this.length;
		for (let e in this._combined) t._combined[e] = this._combined[e];
		for (let e in this._extendedAttrs) t._extendedAttrs[e] = this._extendedAttrs[e];
		return t.isWrapped = this.isWrapped, t;
	}
	getTrimmedLength() {
		for (let t = this.length - 1; t >= 0; --t) if (this._data[t * C + 0] & 4194303) return t + (this._data[t * C + 0] >> 22);
		return 0;
	}
	getNoBgTrimmedLength() {
		for (let t = this.length - 1; t >= 0; --t) if (this._data[t * C + 0] & 4194303 || this._data[t * C + 2] & 50331648) return t + (this._data[t * C + 0] >> 22);
		return 0;
	}
	copyCellsFrom(t, e, r, i, s) {
		let a = t._data;
		if (s) for (let c = i - 1; c >= 0; c--) {
			for (let u = 0; u < C; u++) this._data[(r + c) * C + u] = a[(e + c) * C + u];
			a[(e + c) * C + 2] & 268435456 && (this._extendedAttrs[r + c] = t._extendedAttrs[e + c]);
		}
		else for (let c = 0; c < i; c++) {
			for (let u = 0; u < C; u++) this._data[(r + c) * C + u] = a[(e + c) * C + u];
			a[(e + c) * C + 2] & 268435456 && (this._extendedAttrs[r + c] = t._extendedAttrs[e + c]);
		}
		let l = Object.keys(t._combined);
		for (let c = 0; c < l.length; c++) {
			let u = parseInt(l[c], 10);
			u >= e && (this._combined[u - e + r] = t._combined[u]);
		}
	}
	translateToString(t, e, r, i) {
		e = e ?? 0, r = r ?? this.length, t && (r = Math.min(r, this.getTrimmedLength())), i && (i.length = 0);
		let s = "";
		for (; e < r;) {
			let a = this._data[e * C + 0], l = a & 2097151, c = a & 2097152 ? this._combined[e] : l ? $(l) : ze;
			if (s += c, i) for (let u = 0; u < c.length; ++u) i.push(e);
			e += a >> 22 || 1;
		}
		return i && i.push(e), s;
	}
};
var yr = "di$target";
var Vt = "di$dependencies";
var Kt = /* @__PURE__ */ new Map();
function Cr(n) {
	return n[Vt] || [];
}
function j(n) {
	if (Kt.has(n)) return Kt.get(n);
	let t = function(e, r, i) {
		if (arguments.length !== 3) throw new Error("@IServiceName-decorator can only be used to decorate a parameter");
		mi(t, e, i);
	};
	return t._id = n, Kt.set(n, t), t;
}
function mi(n, t, e) {
	t[yr] === t ? t[Vt].push({
		id: n,
		index: e
	}) : (t[Vt] = [{
		id: n,
		index: e
	}], t[yr] = t);
}
var X = j("BufferService");
var Dr = j("CoreMouseService");
var dt = j("CoreService");
var Ar = j("CharsetService");
var Or = j("InstantiationService");
var ht = j("LogService");
var Y = j("OptionsService");
var Rr = j("OscLinkService");
var wr = j("UnicodeService");
j("DecorationService");
var zt = class {
	constructor(...t) {
		this._entries = /* @__PURE__ */ new Map();
		for (let [e, r] of t) this.set(e, r);
	}
	set(t, e) {
		let r = this._entries.get(t);
		return this._entries.set(t, e), r;
	}
	forEach(t) {
		for (let [e, r] of this._entries.entries()) t(e, r);
	}
	has(t) {
		return this._entries.has(t);
	}
	get(t) {
		return this._entries.get(t);
	}
};
var ft = class {
	constructor() {
		this._services = new zt();
		this._services.set(Or, this);
	}
	setService(t, e) {
		this._services.set(t, e);
	}
	getService(t) {
		return this._services.get(t);
	}
	createInstance(t, ...e) {
		let r = Cr(t).sort((a, l) => a.index - l.index), i = [];
		for (let a of r) {
			let l = this._services.get(a.id);
			if (!l) throw new Error(`[createInstance] ${t.name} depends on UNKNOWN service ${a.id._id}.`);
			i.push(l);
		}
		let s = r.length > 0 ? r[0].index : e.length;
		if (e.length !== s) throw new Error(`[createInstance] First service dependency of ${t.name} at position ${s + 1} conflicts with ${e.length} static arguments`);
		return new t(...e, ...i);
	}
};
var vi = {
	trace: 0,
	debug: 1,
	info: 2,
	warn: 3,
	error: 4,
	off: 5
};
var gi = "xterm.js: ";
var _e = class extends A {
	constructor(e) {
		super();
		this._optionsService = e;
		this._logLevel = 5;
		this._updateLogLevel(), this._register(this._optionsService.onSpecificOptionChange("logLevel", () => this._updateLogLevel())), Ii = this;
	}
	get logLevel() {
		return this._logLevel;
	}
	_updateLogLevel() {
		this._logLevel = vi[this._optionsService.rawOptions.logLevel];
	}
	_evalLazyOptionalParams(e) {
		for (let r = 0; r < e.length; r++) typeof e[r] == "function" && (e[r] = e[r]());
	}
	_log(e, r, i) {
		this._evalLazyOptionalParams(i), e.call(console, (this._optionsService.options.logger ? "" : gi) + r, ...i);
	}
	trace(e, ...r) {
		this._logLevel <= 0 && this._log(this._optionsService.options.logger?.trace.bind(this._optionsService.options.logger) ?? console.log, e, r);
	}
	debug(e, ...r) {
		this._logLevel <= 1 && this._log(this._optionsService.options.logger?.debug.bind(this._optionsService.options.logger) ?? console.log, e, r);
	}
	info(e, ...r) {
		this._logLevel <= 2 && this._log(this._optionsService.options.logger?.info.bind(this._optionsService.options.logger) ?? console.info, e, r);
	}
	warn(e, ...r) {
		this._logLevel <= 3 && this._log(this._optionsService.options.logger?.warn.bind(this._optionsService.options.logger) ?? console.warn, e, r);
	}
	error(e, ...r) {
		this._logLevel <= 4 && this._log(this._optionsService.options.logger?.error.bind(this._optionsService.options.logger) ?? console.error, e, r);
	}
};
_e = K([F(0, Y)], _e);
var Ii;
var we = class extends A {
	constructor(e) {
		super();
		this._maxLength = e;
		this.onDeleteEmitter = this._register(new S());
		this.onDelete = this.onDeleteEmitter.event;
		this.onInsertEmitter = this._register(new S());
		this.onInsert = this.onInsertEmitter.event;
		this.onTrimEmitter = this._register(new S());
		this.onTrim = this.onTrimEmitter.event;
		this._array = new Array(this._maxLength), this._startIndex = 0, this._length = 0;
	}
	get maxLength() {
		return this._maxLength;
	}
	set maxLength(e) {
		if (this._maxLength === e) return;
		let r = new Array(e);
		for (let i = 0; i < Math.min(e, this.length); i++) r[i] = this._array[this._getCyclicIndex(i)];
		this._array = r, this._maxLength = e, this._startIndex = 0;
	}
	get length() {
		return this._length;
	}
	set length(e) {
		if (e > this._length) for (let r = this._length; r < e; r++) this._array[r] = void 0;
		this._length = e;
	}
	get(e) {
		return this._array[this._getCyclicIndex(e)];
	}
	set(e, r) {
		this._array[this._getCyclicIndex(e)] = r;
	}
	push(e) {
		this._array[this._getCyclicIndex(this._length)] = e, this._length === this._maxLength ? (this._startIndex = ++this._startIndex % this._maxLength, this.onTrimEmitter.fire(1)) : this._length++;
	}
	recycle() {
		if (this._length !== this._maxLength) throw new Error("Can only recycle when the buffer is full");
		return this._startIndex = ++this._startIndex % this._maxLength, this.onTrimEmitter.fire(1), this._array[this._getCyclicIndex(this._length - 1)];
	}
	get isFull() {
		return this._length === this._maxLength;
	}
	pop() {
		return this._array[this._getCyclicIndex(this._length-- - 1)];
	}
	splice(e, r, ...i) {
		if (r) {
			for (let s = e; s < this._length - r; s++) this._array[this._getCyclicIndex(s)] = this._array[this._getCyclicIndex(s + r)];
			this._length -= r, this.onDeleteEmitter.fire({
				index: e,
				amount: r
			});
		}
		for (let s = this._length - 1; s >= e; s--) this._array[this._getCyclicIndex(s + i.length)] = this._array[this._getCyclicIndex(s)];
		for (let s = 0; s < i.length; s++) this._array[this._getCyclicIndex(e + s)] = i[s];
		if (i.length && this.onInsertEmitter.fire({
			index: e,
			amount: i.length
		}), this._length + i.length > this._maxLength) {
			let s = this._length + i.length - this._maxLength;
			this._startIndex += s, this._length = this._maxLength, this.onTrimEmitter.fire(s);
		} else this._length += i.length;
	}
	trimStart(e) {
		e > this._length && (e = this._length), this._startIndex += e, this._length -= e, this.onTrimEmitter.fire(e);
	}
	shiftElements(e, r, i) {
		if (!(r <= 0)) {
			if (e < 0 || e >= this._length) throw new Error("start argument out of range");
			if (e + i < 0) throw new Error("Cannot shift elements in list beyond index 0");
			if (i > 0) {
				for (let a = r - 1; a >= 0; a--) this.set(e + a + i, this.get(e + a));
				let s = e + r + i - this._length;
				if (s > 0) for (this._length += s; this._length > this._maxLength;) this._length--, this._startIndex++, this.onTrimEmitter.fire(1);
			} else for (let s = 0; s < r; s++) this.set(e + s + i, this.get(e + s));
		}
	}
	_getCyclicIndex(e) {
		return (this._startIndex + e) % this._maxLength;
	}
};
var pt = typeof process < "u" && "title" in process;
var bt = pt ? "node" : navigator.userAgent;
var qt = pt ? "node" : navigator.platform;
bt.includes("Firefox");
bt.includes("Edge");
/^((?!chrome|android).)*safari/i.test(bt);
var kr = [
	"Macintosh",
	"MacIntel",
	"MacPPC",
	"Mac68K"
].includes(qt);
[
	"Windows",
	"Win16",
	"Win32",
	"WinCE"
].includes(qt);
qt.indexOf("Linux");
/\bCrOS\b/.test(bt);
var _t = class {
	constructor() {
		this._tasks = [];
		this._i = 0;
	}
	enqueue(t) {
		this._tasks.push(t), this._start();
	}
	flush() {
		for (; this._i < this._tasks.length;) this._tasks[this._i]() || this._i++;
		this.clear();
	}
	clear() {
		this._idleCallback && (this._cancelCallback(this._idleCallback), this._idleCallback = void 0), this._i = 0, this._tasks.length = 0;
	}
	_start() {
		this._idleCallback || (this._idleCallback = this._requestCallback(this._process.bind(this)));
	}
	_process(t) {
		this._idleCallback = void 0;
		let e = 0, r = 0, i = t.timeRemaining(), s = 0;
		for (; this._i < this._tasks.length;) {
			if (e = performance.now(), this._tasks[this._i]() || this._i++, e = Math.max(1, performance.now() - e), r = Math.max(e, r), s = t.timeRemaining(), r * 1.5 > s) {
				i - e < -20 && console.warn(`task queue exceeded allotted deadline by ${Math.abs(Math.round(i - e))}ms`), this._start();
				return;
			}
			i = s;
		}
		this.clear();
	}
};
var $t = class extends _t {
	_requestCallback(t) {
		return setTimeout(() => t(this._createDeadline(16)));
	}
	_cancelCallback(t) {
		clearTimeout(t);
	}
	_createDeadline(t) {
		let e = performance.now() + t;
		return { timeRemaining: () => Math.max(0, e - performance.now()) };
	}
};
var jt = class extends _t {
	_requestCallback(t) {
		return requestIdleCallback(t);
	}
	_cancelCallback(t) {
		cancelIdleCallback(t);
	}
};
var Br$1 = !pt && "requestIdleCallback" in window ? jt : $t;
function Lr(n, t, e, r, i, s) {
	let a = [];
	for (let l = 0; l < n.length - 1; l++) {
		let c = l, u = n.get(++c);
		if (!u.isWrapped) continue;
		let m = [n.get(l)];
		for (; c < n.length && u.isWrapped;) m.push(u), u = n.get(++c);
		if (!s && r >= l && r < c) {
			l += m.length - 1;
			continue;
		}
		let o = 0, h = me(m, o, t), x = 1, v = 0;
		for (; x < m.length;) {
			let d = me(m, x, t), R = d - v, w = e - h, L = Math.min(R, w);
			m[o].copyCellsFrom(m[x], v, h, L, !1), h += L, h === e && (o++, h = 0), v += L, v === d && (x++, v = 0), h === 0 && o !== 0 && m[o - 1].getWidth(e - 1) === 2 && (m[o].copyCellsFrom(m[o - 1], e - 1, h++, 1, !1), m[o - 1].setCell(e - 1, i));
		}
		m[o].replaceCells(h, e, i);
		let _ = 0;
		for (let d = m.length - 1; d > 0 && (d > o || m[d].getTrimmedLength() === 0); d--) _++;
		_ > 0 && (a.push(l + m.length - _), a.push(_)), l += m.length - 1;
	}
	return a;
}
function Mr(n, t) {
	let e = [], r = 0, i = t[r], s = 0;
	for (let a = 0; a < n.length; a++) if (i === a) {
		let l = t[++r];
		n.onDeleteEmitter.fire({
			index: a - s,
			amount: l
		}), a += l - 1, s += l, i = t[++r];
	} else e.push(a);
	return {
		layout: e,
		countRemoved: s
	};
}
function Nr(n, t) {
	let e = [];
	for (let r = 0; r < t.length; r++) e.push(n.get(t[r]));
	for (let r = 0; r < e.length; r++) n.set(r, e[r]);
	n.length = t.length;
}
function Hr(n, t, e) {
	let r = [], i = n.map((c, u) => me(n, u, t)).reduce((c, u) => c + u), s = 0, a = 0, l = 0;
	for (; l < i;) {
		if (i - l < e) {
			r.push(i - l);
			break;
		}
		s += e;
		let c = me(n, a, t);
		s > c && (s -= c, a++);
		let u = n[a].getWidth(s - 1) === 2;
		u && s--;
		let m = u ? e - 1 : e;
		r.push(m), l += m;
	}
	return r;
}
function me(n, t, e) {
	if (t === n.length - 1) return n[t].getTrimmedLength();
	let r = !n[t].hasContent(e - 1) && n[t].getWidth(e - 1) === 1, i = n[t + 1].getWidth(0) === 2;
	return r && i ? e - 1 : e;
}
var vt = class vt {
	constructor(t) {
		this.line = t;
		this.isDisposed = !1;
		this._disposables = [];
		this._id = vt._nextId++;
		this._onDispose = this.register(new S());
		this.onDispose = this._onDispose.event;
	}
	get id() {
		return this._id;
	}
	dispose() {
		this.isDisposed || (this.isDisposed = !0, this.line = -1, this._onDispose.fire(), it(this._disposables), this._disposables.length = 0);
	}
	register(t) {
		return this._disposables.push(t), t;
	}
};
vt._nextId = 1;
var mt = vt;
var B = {};
var ee = B.B;
B[0] = {
	"`": "◆",
	a: "▒",
	b: "␉",
	c: "␌",
	d: "␍",
	e: "␊",
	f: "°",
	g: "±",
	h: "␤",
	i: "␋",
	j: "┘",
	k: "┐",
	l: "┌",
	m: "└",
	n: "┼",
	o: "⎺",
	p: "⎻",
	q: "─",
	r: "⎼",
	s: "⎽",
	t: "├",
	u: "┤",
	v: "┴",
	w: "┬",
	x: "│",
	y: "≤",
	z: "≥",
	"{": "π",
	"|": "≠",
	"}": "£",
	"~": "·"
};
B.A = { "#": "£" };
B.B = void 0;
B[4] = {
	"#": "£",
	"@": "¾",
	"[": "ij",
	"\\": "½",
	"]": "|",
	"{": "¨",
	"|": "f",
	"}": "¼",
	"~": "´"
};
B.C = B[5] = {
	"[": "Ä",
	"\\": "Ö",
	"]": "Å",
	"^": "Ü",
	"`": "é",
	"{": "ä",
	"|": "ö",
	"}": "å",
	"~": "ü"
};
B.R = {
	"#": "£",
	"@": "à",
	"[": "°",
	"\\": "ç",
	"]": "§",
	"{": "é",
	"|": "ù",
	"}": "è",
	"~": "¨"
};
B.Q = {
	"@": "à",
	"[": "â",
	"\\": "ç",
	"]": "ê",
	"^": "î",
	"`": "ô",
	"{": "é",
	"|": "ù",
	"}": "è",
	"~": "û"
};
B.K = {
	"@": "§",
	"[": "Ä",
	"\\": "Ö",
	"]": "Ü",
	"{": "ä",
	"|": "ö",
	"}": "ü",
	"~": "ß"
};
B.Y = {
	"#": "£",
	"@": "§",
	"[": "°",
	"\\": "ç",
	"]": "é",
	"`": "ù",
	"{": "à",
	"|": "ò",
	"}": "è",
	"~": "ì"
};
B.E = B[6] = {
	"@": "Ä",
	"[": "Æ",
	"\\": "Ø",
	"]": "Å",
	"^": "Ü",
	"`": "ä",
	"{": "æ",
	"|": "ø",
	"}": "å",
	"~": "ü"
};
B.Z = {
	"#": "£",
	"@": "§",
	"[": "¡",
	"\\": "Ñ",
	"]": "¿",
	"{": "°",
	"|": "ñ",
	"}": "ç"
};
B.H = B[7] = {
	"@": "É",
	"[": "Ä",
	"\\": "Ö",
	"]": "Å",
	"^": "Ü",
	"`": "é",
	"{": "ä",
	"|": "ö",
	"}": "å",
	"~": "ü"
};
B["="] = {
	"#": "ù",
	"@": "à",
	"[": "é",
	"\\": "ç",
	"]": "ê",
	"^": "î",
	_: "è",
	"`": "ô",
	"{": "ä",
	"|": "ö",
	"}": "ü",
	"~": "û"
};
var Fr = 4294967295;
var Pe = class {
	constructor(t, e, r) {
		this._hasScrollback = t;
		this._optionsService = e;
		this._bufferService = r;
		this.ydisp = 0;
		this.ybase = 0;
		this.y = 0;
		this.x = 0;
		this.tabs = {};
		this.savedY = 0;
		this.savedX = 0;
		this.savedCurAttrData = k.clone();
		this.savedCharset = ee;
		this.markers = [];
		this._nullCell = G.fromCharData([
			0,
			Ve,
			1,
			0
		]);
		this._whitespaceCell = G.fromCharData([
			0,
			ze,
			1,
			32
		]);
		this._isClearing = !1;
		this._memoryCleanupQueue = new Br$1();
		this._memoryCleanupPosition = 0;
		this._cols = this._bufferService.cols, this._rows = this._bufferService.rows, this.lines = new we(this._getCorrectBufferLength(this._rows)), this.scrollTop = 0, this.scrollBottom = this._rows - 1, this.setupTabStops();
	}
	getNullCell(t) {
		return t ? (this._nullCell.fg = t.fg, this._nullCell.bg = t.bg, this._nullCell.extended = t.extended) : (this._nullCell.fg = 0, this._nullCell.bg = 0, this._nullCell.extended = new re()), this._nullCell;
	}
	getWhitespaceCell(t) {
		return t ? (this._whitespaceCell.fg = t.fg, this._whitespaceCell.bg = t.bg, this._whitespaceCell.extended = t.extended) : (this._whitespaceCell.fg = 0, this._whitespaceCell.bg = 0, this._whitespaceCell.extended = new re()), this._whitespaceCell;
	}
	getBlankLine(t, e) {
		return new Z(this._bufferService.cols, this.getNullCell(t), e);
	}
	get hasScrollback() {
		return this._hasScrollback && this.lines.maxLength > this._rows;
	}
	get isCursorInViewport() {
		let e = this.ybase + this.y - this.ydisp;
		return e >= 0 && e < this._rows;
	}
	_getCorrectBufferLength(t) {
		if (!this._hasScrollback) return t;
		let e = t + this._optionsService.rawOptions.scrollback;
		return e > Fr ? Fr : e;
	}
	fillViewportRows(t) {
		if (this.lines.length === 0) {
			t === void 0 && (t = k);
			let e = this._rows;
			for (; e--;) this.lines.push(this.getBlankLine(t));
		}
	}
	clear() {
		this.ydisp = 0, this.ybase = 0, this.y = 0, this.x = 0, this.lines = new we(this._getCorrectBufferLength(this._rows)), this.scrollTop = 0, this.scrollBottom = this._rows - 1, this.setupTabStops();
	}
	resize(t, e) {
		let r = this.getNullCell(k), i = 0, s = this._getCorrectBufferLength(e);
		if (s > this.lines.maxLength && (this.lines.maxLength = s), this.lines.length > 0) {
			if (this._cols < t) for (let l = 0; l < this.lines.length; l++) i += +this.lines.get(l).resize(t, r);
			let a = 0;
			if (this._rows < e) for (let l = this._rows; l < e; l++) this.lines.length < e + this.ybase && (this._optionsService.rawOptions.windowsMode || this._optionsService.rawOptions.windowsPty.backend !== void 0 || this._optionsService.rawOptions.windowsPty.buildNumber !== void 0 ? this.lines.push(new Z(t, r)) : this.ybase > 0 && this.lines.length <= this.ybase + this.y + a + 1 ? (this.ybase--, a++, this.ydisp > 0 && this.ydisp--) : this.lines.push(new Z(t, r)));
			else for (let l = this._rows; l > e; l--) this.lines.length > e + this.ybase && (this.lines.length > this.ybase + this.y + 1 ? this.lines.pop() : (this.ybase++, this.ydisp++));
			if (s < this.lines.maxLength) {
				let l = this.lines.length - s;
				l > 0 && (this.lines.trimStart(l), this.ybase = Math.max(this.ybase - l, 0), this.ydisp = Math.max(this.ydisp - l, 0), this.savedY = Math.max(this.savedY - l, 0)), this.lines.maxLength = s;
			}
			this.x = Math.min(this.x, t - 1), this.y = Math.min(this.y, e - 1), a && (this.y += a), this.savedX = Math.min(this.savedX, t - 1), this.scrollTop = 0;
		}
		if (this.scrollBottom = e - 1, this._isReflowEnabled && (this._reflow(t, e), this._cols > t)) for (let a = 0; a < this.lines.length; a++) i += +this.lines.get(a).resize(t, r);
		this._cols = t, this._rows = e, this._memoryCleanupQueue.clear(), i > .1 * this.lines.length && (this._memoryCleanupPosition = 0, this._memoryCleanupQueue.enqueue(() => this._batchedMemoryCleanup()));
	}
	_batchedMemoryCleanup() {
		let t = !0;
		this._memoryCleanupPosition >= this.lines.length && (this._memoryCleanupPosition = 0, t = !1);
		let e = 0;
		for (; this._memoryCleanupPosition < this.lines.length;) if (e += this.lines.get(this._memoryCleanupPosition++).cleanupMemory(), e > 100) return !0;
		return t;
	}
	get _isReflowEnabled() {
		let t = this._optionsService.rawOptions.windowsPty;
		return t && t.buildNumber ? this._hasScrollback && t.backend === "conpty" && t.buildNumber >= 21376 : this._hasScrollback && !this._optionsService.rawOptions.windowsMode;
	}
	_reflow(t, e) {
		this._cols !== t && (t > this._cols ? this._reflowLarger(t, e) : this._reflowSmaller(t, e));
	}
	_reflowLarger(t, e) {
		let r = this._optionsService.rawOptions.reflowCursorLine, i = Lr(this.lines, this._cols, t, this.ybase + this.y, this.getNullCell(k), r);
		if (i.length > 0) {
			let s = Mr(this.lines, i);
			Nr(this.lines, s.layout), this._reflowLargerAdjustViewport(t, e, s.countRemoved);
		}
	}
	_reflowLargerAdjustViewport(t, e, r) {
		let i = this.getNullCell(k), s = r;
		for (; s-- > 0;) this.ybase === 0 ? (this.y > 0 && this.y--, this.lines.length < e && this.lines.push(new Z(t, i))) : (this.ydisp === this.ybase && this.ydisp--, this.ybase--);
		this.savedY = Math.max(this.savedY - r, 0);
	}
	_reflowSmaller(t, e) {
		let r = this._optionsService.rawOptions.reflowCursorLine, i = this.getNullCell(k), s = [], a = 0;
		for (let l = this.lines.length - 1; l >= 0; l--) {
			let c = this.lines.get(l);
			if (!c || !c.isWrapped && c.getTrimmedLength() <= t) continue;
			let u = [c];
			for (; c.isWrapped && l > 0;) c = this.lines.get(--l), u.unshift(c);
			if (!r) {
				let g = this.ybase + this.y;
				if (g >= l && g < l + u.length) continue;
			}
			let m = u[u.length - 1].getTrimmedLength(), o = Hr(u, this._cols, t), h = o.length - u.length, x;
			this.ybase === 0 && this.y !== this.lines.length - 1 ? x = Math.max(0, this.y - this.lines.maxLength + h) : x = Math.max(0, this.lines.length - this.lines.maxLength + h);
			let v = [];
			for (let g = 0; g < h; g++) {
				let D = this.getBlankLine(k, !0);
				v.push(D);
			}
			v.length > 0 && (s.push({
				start: l + u.length + a,
				newLines: v
			}), a += v.length), u.push(...v);
			let _ = o.length - 1, d = o[_];
			d === 0 && (_--, d = o[_]);
			let R = u.length - h - 1, w = m;
			for (; R >= 0;) {
				let g = Math.min(w, d);
				if (u[_] === void 0) break;
				if (u[_].copyCellsFrom(u[R], w - g, d - g, g, !0), d -= g, d === 0 && (_--, d = o[_]), w -= g, w === 0) {
					R--;
					w = me(u, Math.max(R, 0), this._cols);
				}
			}
			for (let g = 0; g < u.length; g++) o[g] < t && u[g].setCell(o[g], i);
			let L = h - x;
			for (; L-- > 0;) this.ybase === 0 ? this.y < e - 1 ? (this.y++, this.lines.pop()) : (this.ybase++, this.ydisp++) : this.ybase < Math.min(this.lines.maxLength, this.lines.length + a) - e && (this.ybase === this.ydisp && this.ydisp++, this.ybase++);
			this.savedY = Math.min(this.savedY + h, this.ybase + e - 1);
		}
		if (s.length > 0) {
			let l = [], c = [];
			for (let d = 0; d < this.lines.length; d++) c.push(this.lines.get(d));
			let u = this.lines.length, m = u - 1, o = 0, h = s[o];
			this.lines.length = Math.min(this.lines.maxLength, this.lines.length + a);
			let x = 0;
			for (let d = Math.min(this.lines.maxLength - 1, u + a - 1); d >= 0; d--) if (h && h.start > m + x) {
				for (let R = h.newLines.length - 1; R >= 0; R--) this.lines.set(d--, h.newLines[R]);
				d++, l.push({
					index: m + 1,
					amount: h.newLines.length
				}), x += h.newLines.length, h = s[++o];
			} else this.lines.set(d, c[m--]);
			let v = 0;
			for (let d = l.length - 1; d >= 0; d--) l[d].index += v, this.lines.onInsertEmitter.fire(l[d]), v += l[d].amount;
			let _ = Math.max(0, u + a - this.lines.maxLength);
			_ > 0 && this.lines.onTrimEmitter.fire(_);
		}
	}
	translateBufferLineToString(t, e, r = 0, i) {
		let s = this.lines.get(t);
		return s ? s.translateToString(e, r, i) : "";
	}
	getWrappedRangeForLine(t) {
		let e = t, r = t;
		for (; e > 0 && this.lines.get(e).isWrapped;) e--;
		for (; r + 1 < this.lines.length && this.lines.get(r + 1).isWrapped;) r++;
		return {
			first: e,
			last: r
		};
	}
	setupTabStops(t) {
		for (t != null ? this.tabs[t] || (t = this.prevStop(t)) : (this.tabs = {}, t = 0); t < this._cols; t += this._optionsService.rawOptions.tabStopWidth) this.tabs[t] = !0;
	}
	prevStop(t) {
		for (t ??= this.x; !this.tabs[--t] && t > 0;);
		return t >= this._cols ? this._cols - 1 : t < 0 ? 0 : t;
	}
	nextStop(t) {
		for (t ??= this.x; !this.tabs[++t] && t < this._cols;);
		return t >= this._cols ? this._cols - 1 : t < 0 ? 0 : t;
	}
	clearMarkers(t) {
		this._isClearing = !0;
		for (let e = 0; e < this.markers.length; e++) this.markers[e].line === t && (this.markers[e].dispose(), this.markers.splice(e--, 1));
		this._isClearing = !1;
	}
	clearAllMarkers() {
		this._isClearing = !0;
		for (let t = 0; t < this.markers.length; t++) this.markers[t].dispose();
		this.markers.length = 0, this._isClearing = !1;
	}
	addMarker(t) {
		let e = new mt(t);
		return this.markers.push(e), e.register(this.lines.onTrim((r) => {
			e.line -= r, e.line < 0 && e.dispose();
		})), e.register(this.lines.onInsert((r) => {
			e.line >= r.index && (e.line += r.amount);
		})), e.register(this.lines.onDelete((r) => {
			e.line >= r.index && e.line < r.index + r.amount && e.dispose(), e.line > r.index && (e.line -= r.amount);
		})), e.register(e.onDispose(() => this._removeMarker(e))), e;
	}
	_removeMarker(t) {
		this._isClearing || this.markers.splice(this.markers.indexOf(t), 1);
	}
};
var gt = class extends A {
	constructor(e, r) {
		super();
		this._optionsService = e;
		this._bufferService = r;
		this._onBufferActivate = this._register(new S());
		this.onBufferActivate = this._onBufferActivate.event;
		this.reset(), this._register(this._optionsService.onSpecificOptionChange("scrollback", () => this.resize(this._bufferService.cols, this._bufferService.rows))), this._register(this._optionsService.onSpecificOptionChange("tabStopWidth", () => this.setupTabStops()));
	}
	reset() {
		this._normal = new Pe(!0, this._optionsService, this._bufferService), this._normal.fillViewportRows(), this._alt = new Pe(!1, this._optionsService, this._bufferService), this._activeBuffer = this._normal, this._onBufferActivate.fire({
			activeBuffer: this._normal,
			inactiveBuffer: this._alt
		}), this.setupTabStops();
	}
	get alt() {
		return this._alt;
	}
	get active() {
		return this._activeBuffer;
	}
	get normal() {
		return this._normal;
	}
	activateNormalBuffer() {
		this._activeBuffer !== this._normal && (this._normal.x = this._alt.x, this._normal.y = this._alt.y, this._alt.clearAllMarkers(), this._alt.clear(), this._activeBuffer = this._normal, this._onBufferActivate.fire({
			activeBuffer: this._normal,
			inactiveBuffer: this._alt
		}));
	}
	activateAltBuffer(e) {
		this._activeBuffer !== this._alt && (this._alt.fillViewportRows(e), this._alt.x = this._normal.x, this._alt.y = this._normal.y, this._activeBuffer = this._alt, this._onBufferActivate.fire({
			activeBuffer: this._alt,
			inactiveBuffer: this._normal
		}));
	}
	resize(e, r) {
		this._normal.resize(e, r), this._alt.resize(e, r), this.setupTabStops(e);
	}
	setupTabStops(e) {
		this._normal.setupTabStops(e), this._alt.setupTabStops(e);
	}
};
var Yt = 2;
var Qt = 1;
var ve = class extends A {
	constructor(e) {
		super();
		this.isUserScrolling = !1;
		this._onResize = this._register(new S());
		this.onResize = this._onResize.event;
		this._onScroll = this._register(new S());
		this.onScroll = this._onScroll.event;
		this.cols = Math.max(e.rawOptions.cols || 0, Yt), this.rows = Math.max(e.rawOptions.rows || 0, Qt), this.buffers = this._register(new gt(e, this)), this._register(this.buffers.onBufferActivate((r) => {
			this._onScroll.fire(r.activeBuffer.ydisp);
		}));
	}
	get buffer() {
		return this.buffers.active;
	}
	resize(e, r) {
		let i = this.cols !== e, s = this.rows !== r;
		this.cols = e, this.rows = r, this.buffers.resize(e, r), this._onResize.fire({
			cols: e,
			rows: r,
			colsChanged: i,
			rowsChanged: s
		});
	}
	reset() {
		this.buffers.reset(), this.isUserScrolling = !1;
	}
	scroll(e, r = !1) {
		let i = this.buffer, s;
		s = this._cachedBlankLine, (!s || s.length !== this.cols || s.getFg(0) !== e.fg || s.getBg(0) !== e.bg) && (s = i.getBlankLine(e, r), this._cachedBlankLine = s), s.isWrapped = r;
		let a = i.ybase + i.scrollTop, l = i.ybase + i.scrollBottom;
		if (i.scrollTop === 0) {
			let c = i.lines.isFull;
			l === i.lines.length - 1 ? c ? i.lines.recycle().copyFrom(s) : i.lines.push(s.clone()) : i.lines.splice(l + 1, 0, s.clone()), c ? this.isUserScrolling && (i.ydisp = Math.max(i.ydisp - 1, 0)) : (i.ybase++, this.isUserScrolling || i.ydisp++);
		} else {
			let c = l - a + 1;
			i.lines.shiftElements(a + 1, c - 1, -1), i.lines.set(l, s.clone());
		}
		this.isUserScrolling || (i.ydisp = i.ybase), this._onScroll.fire(i.ydisp);
	}
	scrollLines(e, r) {
		let i = this.buffer;
		if (e < 0) {
			if (i.ydisp === 0) return;
			this.isUserScrolling = !0;
		} else e + i.ydisp >= i.ybase && (this.isUserScrolling = !1);
		let s = i.ydisp;
		i.ydisp = Math.max(Math.min(i.ydisp + e, i.ybase), 0), s !== i.ydisp && (r || this._onScroll.fire(i.ydisp));
	}
};
ve = K([F(0, Y)], ve);
var ge = {
	cols: 80,
	rows: 24,
	cursorBlink: !1,
	cursorStyle: "block",
	cursorWidth: 1,
	cursorInactiveStyle: "outline",
	customGlyphs: !0,
	drawBoldTextInBrightColors: !0,
	documentOverride: null,
	fastScrollModifier: "alt",
	fastScrollSensitivity: 5,
	fontFamily: "monospace",
	fontSize: 15,
	fontWeight: "normal",
	fontWeightBold: "bold",
	ignoreBracketedPasteMode: !1,
	lineHeight: 1,
	letterSpacing: 0,
	linkHandler: null,
	logLevel: "info",
	logger: null,
	scrollback: 1e3,
	scrollOnEraseInDisplay: !1,
	scrollOnUserInput: !0,
	scrollSensitivity: 1,
	screenReaderMode: !1,
	smoothScrollDuration: 0,
	macOptionIsMeta: !1,
	macOptionClickForcesSelection: !1,
	minimumContrastRatio: 1,
	disableStdin: !1,
	allowProposedApi: !1,
	allowTransparency: !1,
	tabStopWidth: 8,
	theme: {},
	reflowCursorLine: !1,
	rescaleOverlappingGlyphs: !1,
	rightClickSelectsWord: kr,
	windowOptions: {},
	windowsMode: !1,
	windowsPty: {},
	wordSeparator: " ()[]{}',\"`",
	altClickMovesCursor: !0,
	convertEol: !1,
	termName: "xterm",
	cancelEvents: !1,
	overviewRuler: {}
};
var Ti = [
	"normal",
	"bold",
	"100",
	"200",
	"300",
	"400",
	"500",
	"600",
	"700",
	"800",
	"900"
];
var It = class extends A {
	constructor(e) {
		super();
		this._onOptionChange = this._register(new S());
		this.onOptionChange = this._onOptionChange.event;
		let r = { ...ge };
		for (let i in e) if (i in r) try {
			let s = e[i];
			r[i] = this._sanitizeAndValidateOption(i, s);
		} catch (s) {
			console.error(s);
		}
		this.rawOptions = r, this.options = { ...r }, this._setupOptions(), this._register(J(() => {
			this.rawOptions.linkHandler = null, this.rawOptions.documentOverride = null;
		}));
	}
	onSpecificOptionChange(e, r) {
		return this.onOptionChange((i) => {
			i === e && r(this.rawOptions[e]);
		});
	}
	onMultipleOptionChange(e, r) {
		return this.onOptionChange((i) => {
			e.indexOf(i) !== -1 && r();
		});
	}
	_setupOptions() {
		let e = (i) => {
			if (!(i in ge)) throw new Error(`No option with key "${i}"`);
			return this.rawOptions[i];
		}, r = (i, s) => {
			if (!(i in ge)) throw new Error(`No option with key "${i}"`);
			s = this._sanitizeAndValidateOption(i, s), this.rawOptions[i] !== s && (this.rawOptions[i] = s, this._onOptionChange.fire(i));
		};
		for (let i in this.rawOptions) {
			let s = {
				get: e.bind(this, i),
				set: r.bind(this, i)
			};
			Object.defineProperty(this.options, i, s);
		}
	}
	_sanitizeAndValidateOption(e, r) {
		switch (e) {
			case "cursorStyle":
				if (r || (r = ge[e]), !Si(r)) throw new Error(`"${r}" is not a valid value for ${e}`);
				break;
			case "wordSeparator":
				r || (r = ge[e]);
				break;
			case "fontWeight":
			case "fontWeightBold":
				if (typeof r == "number" && 1 <= r && r <= 1e3) break;
				r = Ti.includes(r) ? r : ge[e];
				break;
			case "cursorWidth": r = Math.floor(r);
			case "lineHeight":
			case "tabStopWidth":
				if (r < 1) throw new Error(`${e} cannot be less than 1, value: ${r}`);
				break;
			case "minimumContrastRatio":
				r = Math.max(1, Math.min(21, Math.round(r * 10) / 10));
				break;
			case "scrollback":
				if (r = Math.min(r, 4294967295), r < 0) throw new Error(`${e} cannot be less than 0, value: ${r}`);
				break;
			case "fastScrollSensitivity":
			case "scrollSensitivity":
				if (r <= 0) throw new Error(`${e} cannot be less than or equal to 0, value: ${r}`);
				break;
			case "rows":
			case "cols":
				if (!r && r !== 0) throw new Error(`${e} must be numeric, value: ${r}`);
				break;
			case "windowsPty": r = r ?? {};
		}
		return r;
	}
};
function Si(n) {
	return n === "block" || n === "underline" || n === "bar";
}
function Ie(n, t = 5) {
	if (typeof n != "object") return n;
	let e = Array.isArray(n) ? [] : {};
	for (let r in n) e[r] = t <= 1 ? n[r] : n[r] && Ie(n[r], t - 1);
	return e;
}
var Ur = Object.freeze({ insertMode: !1 });
var Wr = Object.freeze({
	applicationCursorKeys: !1,
	applicationKeypad: !1,
	bracketedPasteMode: !1,
	cursorBlink: void 0,
	cursorStyle: void 0,
	origin: !1,
	reverseWraparound: !1,
	sendFocus: !1,
	synchronizedOutput: !1,
	wraparound: !0
});
var xe = class extends A {
	constructor(e, r, i) {
		super();
		this._bufferService = e;
		this._logService = r;
		this._optionsService = i;
		this.isCursorInitialized = !1;
		this.isCursorHidden = !1;
		this._onData = this._register(new S());
		this.onData = this._onData.event;
		this._onUserInput = this._register(new S());
		this.onUserInput = this._onUserInput.event;
		this._onBinary = this._register(new S());
		this.onBinary = this._onBinary.event;
		this._onRequestScrollToBottom = this._register(new S());
		this.onRequestScrollToBottom = this._onRequestScrollToBottom.event;
		this.modes = Ie(Ur), this.decPrivateModes = Ie(Wr);
	}
	reset() {
		this.modes = Ie(Ur), this.decPrivateModes = Ie(Wr);
	}
	triggerDataEvent(e, r = !1) {
		if (this._optionsService.rawOptions.disableStdin) return;
		let i = this._bufferService.buffer;
		r && this._optionsService.rawOptions.scrollOnUserInput && i.ybase !== i.ydisp && this._onRequestScrollToBottom.fire(), r && this._onUserInput.fire(), this._logService.debug(`sending data "${e}"`), this._logService.trace("sending data (codes)", () => e.split("").map((s) => s.charCodeAt(0))), this._onData.fire(e);
	}
	triggerBinaryEvent(e) {
		this._optionsService.rawOptions.disableStdin || (this._logService.debug(`sending binary "${e}"`), this._logService.trace("sending binary (codes)", () => e.split("").map((r) => r.charCodeAt(0))), this._onBinary.fire(e));
	}
};
xe = K([
	F(0, X),
	F(1, ht),
	F(2, Y)
], xe);
var Gr = {
	NONE: {
		events: 0,
		restrict: () => !1
	},
	X10: {
		events: 1,
		restrict: (n) => n.button === 4 || n.action !== 1 ? !1 : (n.ctrl = !1, n.alt = !1, n.shift = !1, !0)
	},
	VT200: {
		events: 19,
		restrict: (n) => n.action !== 32
	},
	DRAG: {
		events: 23,
		restrict: (n) => !(n.action === 32 && n.button === 3)
	},
	ANY: {
		events: 31,
		restrict: (n) => !0
	}
};
function Jt(n, t) {
	let e = (n.ctrl ? 16 : 0) | (n.shift ? 4 : 0) | (n.alt ? 8 : 0);
	return n.button === 4 ? (e |= 64, e |= n.action) : (e |= n.button & 3, n.button & 4 && (e |= 64), n.button & 8 && (e |= 128), n.action === 32 ? e |= 32 : n.action === 0 && !t && (e |= 3)), e;
}
var Zt = String.fromCharCode;
var Kr = {
	DEFAULT: (n) => {
		let t = [
			Jt(n, !1) + 32,
			n.col + 32,
			n.row + 32
		];
		return t[0] > 255 || t[1] > 255 || t[2] > 255 ? "" : `\x1B[M${Zt(t[0])}${Zt(t[1])}${Zt(t[2])}`;
	},
	SGR: (n) => {
		let t = n.action === 0 && n.button !== 4 ? "m" : "M";
		return `\x1B[<${Jt(n, !0)};${n.col};${n.row}${t}`;
	},
	SGR_PIXELS: (n) => {
		let t = n.action === 0 && n.button !== 4 ? "m" : "M";
		return `\x1B[<${Jt(n, !0)};${n.x};${n.y}${t}`;
	}
};
var Te = class extends A {
	constructor(e, r, i) {
		super();
		this._bufferService = e;
		this._coreService = r;
		this._optionsService = i;
		this._protocols = {};
		this._encodings = {};
		this._activeProtocol = "";
		this._activeEncoding = "";
		this._lastEvent = null;
		this._wheelPartialScroll = 0;
		this._onProtocolChange = this._register(new S());
		this.onProtocolChange = this._onProtocolChange.event;
		for (let s of Object.keys(Gr)) this.addProtocol(s, Gr[s]);
		for (let s of Object.keys(Kr)) this.addEncoding(s, Kr[s]);
		this.reset();
	}
	addProtocol(e, r) {
		this._protocols[e] = r;
	}
	addEncoding(e, r) {
		this._encodings[e] = r;
	}
	get activeProtocol() {
		return this._activeProtocol;
	}
	get areMouseEventsActive() {
		return this._protocols[this._activeProtocol].events !== 0;
	}
	set activeProtocol(e) {
		if (!this._protocols[e]) throw new Error(`unknown protocol "${e}"`);
		this._activeProtocol = e, this._onProtocolChange.fire(this._protocols[e].events);
	}
	get activeEncoding() {
		return this._activeEncoding;
	}
	set activeEncoding(e) {
		if (!this._encodings[e]) throw new Error(`unknown encoding "${e}"`);
		this._activeEncoding = e;
	}
	reset() {
		this.activeProtocol = "NONE", this.activeEncoding = "DEFAULT", this._lastEvent = null, this._wheelPartialScroll = 0;
	}
	consumeWheelEvent(e, r, i) {
		if (e.deltaY === 0 || e.shiftKey || r === void 0 || i === void 0) return 0;
		let s = r / i, a = this._applyScrollModifier(e.deltaY, e);
		return e.deltaMode === WheelEvent.DOM_DELTA_PIXEL ? (a /= s + 0, Math.abs(e.deltaY) < 50 && (a *= .3), this._wheelPartialScroll += a, a = Math.floor(Math.abs(this._wheelPartialScroll)) * (this._wheelPartialScroll > 0 ? 1 : -1), this._wheelPartialScroll %= 1) : e.deltaMode === WheelEvent.DOM_DELTA_PAGE && (a *= this._bufferService.rows), a;
	}
	_applyScrollModifier(e, r) {
		return r.altKey || r.ctrlKey || r.shiftKey ? e * this._optionsService.rawOptions.fastScrollSensitivity * this._optionsService.rawOptions.scrollSensitivity : e * this._optionsService.rawOptions.scrollSensitivity;
	}
	triggerMouseEvent(e) {
		if (e.col < 0 || e.col >= this._bufferService.cols || e.row < 0 || e.row >= this._bufferService.rows || e.button === 4 && e.action === 32 || e.button === 3 && e.action !== 32 || e.button !== 4 && (e.action === 2 || e.action === 3) || (e.col++, e.row++, e.action === 32 && this._lastEvent && this._equalEvents(this._lastEvent, e, this._activeEncoding === "SGR_PIXELS")) || !this._protocols[this._activeProtocol].restrict(e)) return !1;
		let r = this._encodings[this._activeEncoding](e);
		return r && (this._activeEncoding === "DEFAULT" ? this._coreService.triggerBinaryEvent(r) : this._coreService.triggerDataEvent(r, !0)), this._lastEvent = e, !0;
	}
	explainEvents(e) {
		return {
			down: !!(e & 1),
			up: !!(e & 2),
			drag: !!(e & 4),
			move: !!(e & 8),
			wheel: !!(e & 16)
		};
	}
	_equalEvents(e, r, i) {
		if (i) {
			if (e.x !== r.x || e.y !== r.y) return !1;
		} else if (e.col !== r.col || e.row !== r.row) return !1;
		return !(e.button !== r.button || e.action !== r.action || e.ctrl !== r.ctrl || e.alt !== r.alt || e.shift !== r.shift);
	}
};
Te = K([
	F(0, X),
	F(1, dt),
	F(2, Y)
], Te);
var er = [
	[768, 879],
	[1155, 1158],
	[1160, 1161],
	[1425, 1469],
	[1471, 1471],
	[1473, 1474],
	[1476, 1477],
	[1479, 1479],
	[1536, 1539],
	[1552, 1557],
	[1611, 1630],
	[1648, 1648],
	[1750, 1764],
	[1767, 1768],
	[1770, 1773],
	[1807, 1807],
	[1809, 1809],
	[1840, 1866],
	[1958, 1968],
	[2027, 2035],
	[2305, 2306],
	[2364, 2364],
	[2369, 2376],
	[2381, 2381],
	[2385, 2388],
	[2402, 2403],
	[2433, 2433],
	[2492, 2492],
	[2497, 2500],
	[2509, 2509],
	[2530, 2531],
	[2561, 2562],
	[2620, 2620],
	[2625, 2626],
	[2631, 2632],
	[2635, 2637],
	[2672, 2673],
	[2689, 2690],
	[2748, 2748],
	[2753, 2757],
	[2759, 2760],
	[2765, 2765],
	[2786, 2787],
	[2817, 2817],
	[2876, 2876],
	[2879, 2879],
	[2881, 2883],
	[2893, 2893],
	[2902, 2902],
	[2946, 2946],
	[3008, 3008],
	[3021, 3021],
	[3134, 3136],
	[3142, 3144],
	[3146, 3149],
	[3157, 3158],
	[3260, 3260],
	[3263, 3263],
	[3270, 3270],
	[3276, 3277],
	[3298, 3299],
	[3393, 3395],
	[3405, 3405],
	[3530, 3530],
	[3538, 3540],
	[3542, 3542],
	[3633, 3633],
	[3636, 3642],
	[3655, 3662],
	[3761, 3761],
	[3764, 3769],
	[3771, 3772],
	[3784, 3789],
	[3864, 3865],
	[3893, 3893],
	[3895, 3895],
	[3897, 3897],
	[3953, 3966],
	[3968, 3972],
	[3974, 3975],
	[3984, 3991],
	[3993, 4028],
	[4038, 4038],
	[4141, 4144],
	[4146, 4146],
	[4150, 4151],
	[4153, 4153],
	[4184, 4185],
	[4448, 4607],
	[4959, 4959],
	[5906, 5908],
	[5938, 5940],
	[5970, 5971],
	[6002, 6003],
	[6068, 6069],
	[6071, 6077],
	[6086, 6086],
	[6089, 6099],
	[6109, 6109],
	[6155, 6157],
	[6313, 6313],
	[6432, 6434],
	[6439, 6440],
	[6450, 6450],
	[6457, 6459],
	[6679, 6680],
	[6912, 6915],
	[6964, 6964],
	[6966, 6970],
	[6972, 6972],
	[6978, 6978],
	[7019, 7027],
	[7616, 7626],
	[7678, 7679],
	[8203, 8207],
	[8234, 8238],
	[8288, 8291],
	[8298, 8303],
	[8400, 8431],
	[12330, 12335],
	[12441, 12442],
	[43014, 43014],
	[43019, 43019],
	[43045, 43046],
	[64286, 64286],
	[65024, 65039],
	[65056, 65059],
	[65279, 65279],
	[65529, 65531]
];
var Ei = [
	[68097, 68099],
	[68101, 68102],
	[68108, 68111],
	[68152, 68154],
	[68159, 68159],
	[119143, 119145],
	[119155, 119170],
	[119173, 119179],
	[119210, 119213],
	[119362, 119364],
	[917505, 917505],
	[917536, 917631],
	[917760, 917999]
];
var M;
function yi(n, t) {
	let e = 0, r = t.length - 1, i;
	if (n < t[0][0] || n > t[r][1]) return !1;
	for (; r >= e;) if (i = e + r >> 1, n > t[i][1]) e = i + 1;
	else if (n < t[i][0]) r = i - 1;
	else return !0;
	return !1;
}
var xt = class {
	constructor() {
		this.version = "6";
		if (!M) {
			M = /* @__PURE__ */ new Uint8Array(65536), M.fill(1), M[0] = 0, M.fill(0, 1, 32), M.fill(0, 127, 160), M.fill(2, 4352, 4448), M[9001] = 2, M[9002] = 2, M.fill(2, 11904, 42192), M[12351] = 1, M.fill(2, 44032, 55204), M.fill(2, 63744, 64256), M.fill(2, 65040, 65050), M.fill(2, 65072, 65136), M.fill(2, 65280, 65377), M.fill(2, 65504, 65511);
			for (let t = 0; t < er.length; ++t) M.fill(0, er[t][0], er[t][1] + 1);
		}
	}
	wcwidth(t) {
		return t < 32 ? 0 : t < 127 ? 1 : t < 65536 ? M[t] : yi(t, Ei) ? 0 : t >= 131072 && t <= 196605 || t >= 196608 && t <= 262141 ? 2 : 1;
	}
	charProperties(t, e) {
		let r = this.wcwidth(t), i = r === 0 && e !== 0;
		if (i) {
			let s = z.extractWidth(e);
			s === 0 ? i = !1 : s > r && (r = s);
		}
		return z.createPropertyValue(0, r, i);
	}
};
var z = class n {
	constructor() {
		this._providers = Object.create(null);
		this._active = "";
		this._onChange = new S();
		this.onChange = this._onChange.event;
		let t = new xt();
		this.register(t), this._active = t.version, this._activeProvider = t;
	}
	static extractShouldJoin(t) {
		return (t & 1) !== 0;
	}
	static extractWidth(t) {
		return t >> 1 & 3;
	}
	static extractCharKind(t) {
		return t >> 3;
	}
	static createPropertyValue(t, e, r = !1) {
		return (t & 16777215) << 3 | (e & 3) << 1 | (r ? 1 : 0);
	}
	dispose() {
		this._onChange.dispose();
	}
	get versions() {
		return Object.keys(this._providers);
	}
	get activeVersion() {
		return this._active;
	}
	set activeVersion(t) {
		if (!this._providers[t]) throw new Error(`unknown Unicode version "${t}"`);
		this._active = t, this._activeProvider = this._providers[t], this._onChange.fire(t);
	}
	register(t) {
		this._providers[t.version] = t;
	}
	wcwidth(t) {
		return this._activeProvider.wcwidth(t);
	}
	getStringCellWidth(t) {
		let e = 0, r = 0, i = t.length;
		for (let s = 0; s < i; ++s) {
			let a = t.charCodeAt(s);
			if (55296 <= a && a <= 56319) {
				if (++s >= i) return e + this.wcwidth(a);
				let u = t.charCodeAt(s);
				56320 <= u && u <= 57343 ? a = (a - 55296) * 1024 + u - 56320 + 65536 : e += this.wcwidth(u);
			}
			let l = this.charProperties(a, r), c = n.extractWidth(l);
			n.extractShouldJoin(l) && (c -= n.extractWidth(r)), e += c, r = l;
		}
		return e;
	}
	charProperties(t, e) {
		return this._activeProvider.charProperties(t, e);
	}
};
var Tt = class {
	constructor() {
		this.glevel = 0;
		this._charsets = [];
	}
	reset() {
		this.charset = void 0, this._charsets = [], this.glevel = 0;
	}
	setgLevel(t) {
		this.glevel = t, this.charset = this._charsets[t];
	}
	setgCharset(t, e) {
		this._charsets[t] = e, this.glevel === t && (this.charset = e);
	}
};
function tr(n) {
	let e = n.buffer.lines.get(n.buffer.ybase + n.buffer.y - 1)?.get(n.cols - 1), r = n.buffer.lines.get(n.buffer.ybase + n.buffer.y);
	r && e && (r.isWrapped = e[3] !== 0 && e[3] !== 32);
}
var P;
((p) => (p.NUL = "\0", p.SOH = "", p.STX = "", p.ETX = "", p.EOT = "", p.ENQ = "", p.ACK = "", p.BEL = "\x07", p.BS = "\b", p.HT = "	", p.LF = `
`, p.VT = "\v", p.FF = "\f", p.CR = "\r", p.SO = "", p.SI = "", p.DLE = "", p.DC1 = "", p.DC2 = "", p.DC3 = "", p.DC4 = "", p.NAK = "", p.SYN = "", p.ETB = "", p.CAN = "", p.EM = "", p.SUB = "", p.ESC = "\x1B", p.FS = "", p.GS = "", p.RS = "", p.US = "", p.SP = " ", p.DEL = ""))(P ||= {});
var ke;
((f) => (f.PAD = "", f.HOP = "", f.BPH = "", f.NBH = "", f.IND = "", f.NEL = "", f.SSA = "", f.ESA = "", f.HTS = "", f.HTJ = "", f.VTS = "", f.PLD = "", f.PLU = "", f.RI = "", f.SS2 = "", f.SS3 = "", f.DCS = "", f.PU1 = "", f.PU2 = "", f.STS = "", f.CCH = "", f.MW = "", f.SPA = "", f.EPA = "", f.SOS = "", f.SGCI = "", f.SCI = "", f.CSI = "", f.ST = "", f.OSC = "", f.PM = "", f.APC = ""))(ke ||= {});
var Ci;
((t) => t.ST = `${P.ESC}\\`)(Ci ||= {});
var Be = 2147483647;
var Di = 256;
var Se = class n {
	constructor(t = 32, e = 32) {
		this.maxLength = t;
		this.maxSubParamsLength = e;
		if (e > Di) throw new Error("maxSubParamsLength must not be greater than 256");
		this.params = new Int32Array(t), this.length = 0, this._subParams = new Int32Array(e), this._subParamsLength = 0, this._subParamsIdx = new Uint16Array(t), this._rejectDigits = !1, this._rejectSubDigits = !1, this._digitIsSub = !1;
	}
	static fromArray(t) {
		let e = new n();
		if (!t.length) return e;
		for (let r = Array.isArray(t[0]) ? 1 : 0; r < t.length; ++r) {
			let i = t[r];
			if (Array.isArray(i)) for (let s = 0; s < i.length; ++s) e.addSubParam(i[s]);
			else e.addParam(i);
		}
		return e;
	}
	clone() {
		let t = new n(this.maxLength, this.maxSubParamsLength);
		return t.params.set(this.params), t.length = this.length, t._subParams.set(this._subParams), t._subParamsLength = this._subParamsLength, t._subParamsIdx.set(this._subParamsIdx), t._rejectDigits = this._rejectDigits, t._rejectSubDigits = this._rejectSubDigits, t._digitIsSub = this._digitIsSub, t;
	}
	toArray() {
		let t = [];
		for (let e = 0; e < this.length; ++e) {
			t.push(this.params[e]);
			let r = this._subParamsIdx[e] >> 8, i = this._subParamsIdx[e] & 255;
			i - r > 0 && t.push(Array.prototype.slice.call(this._subParams, r, i));
		}
		return t;
	}
	reset() {
		this.length = 0, this._subParamsLength = 0, this._rejectDigits = !1, this._rejectSubDigits = !1, this._digitIsSub = !1;
	}
	addParam(t) {
		if (this._digitIsSub = !1, this.length >= this.maxLength) {
			this._rejectDigits = !0;
			return;
		}
		if (t < -1) throw new Error("values lesser than -1 are not allowed");
		this._subParamsIdx[this.length] = this._subParamsLength << 8 | this._subParamsLength, this.params[this.length++] = t > Be ? Be : t;
	}
	addSubParam(t) {
		if (this._digitIsSub = !0, !!this.length) {
			if (this._rejectDigits || this._subParamsLength >= this.maxSubParamsLength) {
				this._rejectSubDigits = !0;
				return;
			}
			if (t < -1) throw new Error("values lesser than -1 are not allowed");
			this._subParams[this._subParamsLength++] = t > Be ? Be : t, this._subParamsIdx[this.length - 1]++;
		}
	}
	hasSubParams(t) {
		return (this._subParamsIdx[t] & 255) - (this._subParamsIdx[t] >> 8) > 0;
	}
	getSubParams(t) {
		let e = this._subParamsIdx[t] >> 8, r = this._subParamsIdx[t] & 255;
		return r - e > 0 ? this._subParams.subarray(e, r) : null;
	}
	getSubParamsAll() {
		let t = {};
		for (let e = 0; e < this.length; ++e) {
			let r = this._subParamsIdx[e] >> 8, i = this._subParamsIdx[e] & 255;
			i - r > 0 && (t[e] = this._subParams.slice(r, i));
		}
		return t;
	}
	addDigit(t) {
		let e;
		if (this._rejectDigits || !(e = this._digitIsSub ? this._subParamsLength : this.length) || this._digitIsSub && this._rejectSubDigits) return;
		let r = this._digitIsSub ? this._subParams : this.params, i = r[e - 1];
		r[e - 1] = ~i ? Math.min(i * 10 + t, Be) : t;
	}
};
var Le = [];
var St = class {
	constructor() {
		this._state = 0;
		this._active = Le;
		this._id = -1;
		this._handlers = Object.create(null);
		this._handlerFb = () => {};
		this._stack = {
			paused: !1,
			loopPosition: 0,
			fallThrough: !1
		};
	}
	registerHandler(t, e) {
		this._handlers[t] === void 0 && (this._handlers[t] = []);
		let r = this._handlers[t];
		return r.push(e), { dispose: () => {
			let i = r.indexOf(e);
			i !== -1 && r.splice(i, 1);
		} };
	}
	clearHandler(t) {
		this._handlers[t] && delete this._handlers[t];
	}
	setHandlerFallback(t) {
		this._handlerFb = t;
	}
	dispose() {
		this._handlers = Object.create(null), this._handlerFb = () => {}, this._active = Le;
	}
	reset() {
		if (this._state === 2) for (let t = this._stack.paused ? this._stack.loopPosition - 1 : this._active.length - 1; t >= 0; --t) this._active[t].end(!1);
		this._stack.paused = !1, this._active = Le, this._id = -1, this._state = 0;
	}
	_start() {
		if (this._active = this._handlers[this._id] || Le, !this._active.length) this._handlerFb(this._id, "START");
		else for (let t = this._active.length - 1; t >= 0; t--) this._active[t].start();
	}
	_put(t, e, r) {
		if (!this._active.length) this._handlerFb(this._id, "PUT", le(t, e, r));
		else for (let i = this._active.length - 1; i >= 0; i--) this._active[i].put(t, e, r);
	}
	start() {
		this.reset(), this._state = 1;
	}
	put(t, e, r) {
		if (this._state !== 3) {
			if (this._state === 1) for (; e < r;) {
				let i = t[e++];
				if (i === 59) {
					this._state = 2, this._start();
					break;
				}
				if (i < 48 || 57 < i) {
					this._state = 3;
					return;
				}
				this._id === -1 && (this._id = 0), this._id = this._id * 10 + i - 48;
			}
			this._state === 2 && r - e > 0 && this._put(t, e, r);
		}
	}
	end(t, e = !0) {
		if (this._state !== 0) {
			if (this._state !== 3) if (this._state === 1 && this._start(), !this._active.length) this._handlerFb(this._id, "END", t);
			else {
				let r = !1, i = this._active.length - 1, s = !1;
				if (this._stack.paused && (i = this._stack.loopPosition - 1, r = e, s = this._stack.fallThrough, this._stack.paused = !1), !s && r === !1) {
					for (; i >= 0 && (r = this._active[i].end(t), r !== !0); i--) if (r instanceof Promise) return this._stack.paused = !0, this._stack.loopPosition = i, this._stack.fallThrough = !1, r;
					i--;
				}
				for (; i >= 0; i--) if (r = this._active[i].end(!1), r instanceof Promise) return this._stack.paused = !0, this._stack.loopPosition = i, this._stack.fallThrough = !0, r;
			}
			this._active = Le, this._id = -1, this._state = 0;
		}
	}
};
var U = class {
	constructor(t) {
		this._handler = t;
		this._data = "";
		this._hitLimit = !1;
	}
	start() {
		this._data = "", this._hitLimit = !1;
	}
	put(t, e, r) {
		this._hitLimit || (this._data += le(t, e, r), this._data.length > 1e7 && (this._data = "", this._hitLimit = !0));
	}
	end(t) {
		let e = !1;
		if (this._hitLimit) e = !1;
		else if (t && (e = this._handler(this._data), e instanceof Promise)) return e.then((r) => (this._data = "", this._hitLimit = !1, r));
		return this._data = "", this._hitLimit = !1, e;
	}
};
var Me = [];
var Et = class {
	constructor() {
		this._handlers = Object.create(null);
		this._active = Me;
		this._ident = 0;
		this._handlerFb = () => {};
		this._stack = {
			paused: !1,
			loopPosition: 0,
			fallThrough: !1
		};
	}
	dispose() {
		this._handlers = Object.create(null), this._handlerFb = () => {}, this._active = Me;
	}
	registerHandler(t, e) {
		this._handlers[t] === void 0 && (this._handlers[t] = []);
		let r = this._handlers[t];
		return r.push(e), { dispose: () => {
			let i = r.indexOf(e);
			i !== -1 && r.splice(i, 1);
		} };
	}
	clearHandler(t) {
		this._handlers[t] && delete this._handlers[t];
	}
	setHandlerFallback(t) {
		this._handlerFb = t;
	}
	reset() {
		if (this._active.length) for (let t = this._stack.paused ? this._stack.loopPosition - 1 : this._active.length - 1; t >= 0; --t) this._active[t].unhook(!1);
		this._stack.paused = !1, this._active = Me, this._ident = 0;
	}
	hook(t, e) {
		if (this.reset(), this._ident = t, this._active = this._handlers[t] || Me, !this._active.length) this._handlerFb(this._ident, "HOOK", e);
		else for (let r = this._active.length - 1; r >= 0; r--) this._active[r].hook(e);
	}
	put(t, e, r) {
		if (!this._active.length) this._handlerFb(this._ident, "PUT", le(t, e, r));
		else for (let i = this._active.length - 1; i >= 0; i--) this._active[i].put(t, e, r);
	}
	unhook(t, e = !0) {
		if (!this._active.length) this._handlerFb(this._ident, "UNHOOK", t);
		else {
			let r = !1, i = this._active.length - 1, s = !1;
			if (this._stack.paused && (i = this._stack.loopPosition - 1, r = e, s = this._stack.fallThrough, this._stack.paused = !1), !s && r === !1) {
				for (; i >= 0 && (r = this._active[i].unhook(t), r !== !0); i--) if (r instanceof Promise) return this._stack.paused = !0, this._stack.loopPosition = i, this._stack.fallThrough = !1, r;
				i--;
			}
			for (; i >= 0; i--) if (r = this._active[i].unhook(!1), r instanceof Promise) return this._stack.paused = !0, this._stack.loopPosition = i, this._stack.fallThrough = !0, r;
		}
		this._active = Me, this._ident = 0;
	}
};
var Ne = new Se();
Ne.addParam(0);
var He = class {
	constructor(t) {
		this._handler = t;
		this._data = "";
		this._params = Ne;
		this._hitLimit = !1;
	}
	hook(t) {
		this._params = t.length > 1 || t.params[0] ? t.clone() : Ne, this._data = "", this._hitLimit = !1;
	}
	put(t, e, r) {
		this._hitLimit || (this._data += le(t, e, r), this._data.length > 1e7 && (this._data = "", this._hitLimit = !0));
	}
	unhook(t) {
		let e = !1;
		if (this._hitLimit) e = !1;
		else if (t && (e = this._handler(this._data, this._params), e instanceof Promise)) return e.then((r) => (this._params = Ne, this._data = "", this._hitLimit = !1, r));
		return this._params = Ne, this._data = "", this._hitLimit = !1, e;
	}
};
var ir = class {
	constructor(t) {
		this.table = new Uint8Array(t);
	}
	setDefault(t, e) {
		this.table.fill(t << 4 | e);
	}
	add(t, e, r, i) {
		this.table[e << 8 | t] = r << 4 | i;
	}
	addMany(t, e, r, i) {
		for (let s = 0; s < t.length; s++) this.table[e << 8 | t[s]] = r << 4 | i;
	}
};
var q = 160;
var Ai = function() {
	let n = new ir(4095), e = Array.apply(null, Array(256)).map((c, u) => u), r = (c, u) => e.slice(c, u), i = r(32, 127), s = r(0, 24);
	s.push(25), s.push.apply(s, r(28, 32));
	let a = r(0, 14), l;
	n.setDefault(1, 0), n.addMany(i, 0, 2, 0);
	for (l in a) n.addMany([
		24,
		26,
		153,
		154
	], l, 3, 0), n.addMany(r(128, 144), l, 3, 0), n.addMany(r(144, 152), l, 3, 0), n.add(156, l, 0, 0), n.add(27, l, 11, 1), n.add(157, l, 4, 8), n.addMany([
		152,
		158,
		159
	], l, 0, 7), n.add(155, l, 11, 3), n.add(144, l, 11, 9);
	return n.addMany(s, 0, 3, 0), n.addMany(s, 1, 3, 1), n.add(127, 1, 0, 1), n.addMany(s, 8, 0, 8), n.addMany(s, 3, 3, 3), n.add(127, 3, 0, 3), n.addMany(s, 4, 3, 4), n.add(127, 4, 0, 4), n.addMany(s, 6, 3, 6), n.addMany(s, 5, 3, 5), n.add(127, 5, 0, 5), n.addMany(s, 2, 3, 2), n.add(127, 2, 0, 2), n.add(93, 1, 4, 8), n.addMany(i, 8, 5, 8), n.add(127, 8, 5, 8), n.addMany([
		156,
		27,
		24,
		26,
		7
	], 8, 6, 0), n.addMany(r(28, 32), 8, 0, 8), n.addMany([
		88,
		94,
		95
	], 1, 0, 7), n.addMany(i, 7, 0, 7), n.addMany(s, 7, 0, 7), n.add(156, 7, 0, 0), n.add(127, 7, 0, 7), n.add(91, 1, 11, 3), n.addMany(r(64, 127), 3, 7, 0), n.addMany(r(48, 60), 3, 8, 4), n.addMany([
		60,
		61,
		62,
		63
	], 3, 9, 4), n.addMany(r(48, 60), 4, 8, 4), n.addMany(r(64, 127), 4, 7, 0), n.addMany([
		60,
		61,
		62,
		63
	], 4, 0, 6), n.addMany(r(32, 64), 6, 0, 6), n.add(127, 6, 0, 6), n.addMany(r(64, 127), 6, 0, 0), n.addMany(r(32, 48), 3, 9, 5), n.addMany(r(32, 48), 5, 9, 5), n.addMany(r(48, 64), 5, 0, 6), n.addMany(r(64, 127), 5, 7, 0), n.addMany(r(32, 48), 4, 9, 5), n.addMany(r(32, 48), 1, 9, 2), n.addMany(r(32, 48), 2, 9, 2), n.addMany(r(48, 127), 2, 10, 0), n.addMany(r(48, 80), 1, 10, 0), n.addMany(r(81, 88), 1, 10, 0), n.addMany([
		89,
		90,
		92
	], 1, 10, 0), n.addMany(r(96, 127), 1, 10, 0), n.add(80, 1, 11, 9), n.addMany(s, 9, 0, 9), n.add(127, 9, 0, 9), n.addMany(r(28, 32), 9, 0, 9), n.addMany(r(32, 48), 9, 9, 12), n.addMany(r(48, 60), 9, 8, 10), n.addMany([
		60,
		61,
		62,
		63
	], 9, 9, 10), n.addMany(s, 11, 0, 11), n.addMany(r(32, 128), 11, 0, 11), n.addMany(r(28, 32), 11, 0, 11), n.addMany(s, 10, 0, 10), n.add(127, 10, 0, 10), n.addMany(r(28, 32), 10, 0, 10), n.addMany(r(48, 60), 10, 8, 10), n.addMany([
		60,
		61,
		62,
		63
	], 10, 0, 11), n.addMany(r(32, 48), 10, 9, 12), n.addMany(s, 12, 0, 12), n.add(127, 12, 0, 12), n.addMany(r(28, 32), 12, 0, 12), n.addMany(r(32, 48), 12, 9, 12), n.addMany(r(48, 64), 12, 0, 11), n.addMany(r(64, 127), 12, 12, 13), n.addMany(r(64, 127), 10, 12, 13), n.addMany(r(64, 127), 9, 12, 13), n.addMany(s, 13, 13, 13), n.addMany(i, 13, 13, 13), n.add(127, 13, 0, 13), n.addMany([
		27,
		156,
		24,
		26
	], 13, 14, 0), n.add(q, 0, 2, 0), n.add(q, 8, 5, 8), n.add(q, 6, 0, 6), n.add(q, 11, 0, 11), n.add(q, 13, 13, 13), n;
}();
var yt = class extends A {
	constructor(e = Ai) {
		super();
		this._transitions = e;
		this._parseStack = {
			state: 0,
			handlers: [],
			handlerPos: 0,
			transition: 0,
			chunkPos: 0
		};
		this.initialState = 0, this.currentState = this.initialState, this._params = new Se(), this._params.addParam(0), this._collect = 0, this.precedingJoinState = 0, this._printHandlerFb = (r, i, s) => {}, this._executeHandlerFb = (r) => {}, this._csiHandlerFb = (r, i) => {}, this._escHandlerFb = (r) => {}, this._errorHandlerFb = (r) => r, this._printHandler = this._printHandlerFb, this._executeHandlers = Object.create(null), this._csiHandlers = Object.create(null), this._escHandlers = Object.create(null), this._register(J(() => {
			this._csiHandlers = Object.create(null), this._executeHandlers = Object.create(null), this._escHandlers = Object.create(null);
		})), this._oscParser = this._register(new St()), this._dcsParser = this._register(new Et()), this._errorHandler = this._errorHandlerFb, this.registerEscHandler({ final: "\\" }, () => !0);
	}
	_identifier(e, r = [64, 126]) {
		let i = 0;
		if (e.prefix) {
			if (e.prefix.length > 1) throw new Error("only one byte as prefix supported");
			if (i = e.prefix.charCodeAt(0), i && 60 > i || i > 63) throw new Error("prefix must be in range 0x3c .. 0x3f");
		}
		if (e.intermediates) {
			if (e.intermediates.length > 2) throw new Error("only two bytes as intermediates are supported");
			for (let a = 0; a < e.intermediates.length; ++a) {
				let l = e.intermediates.charCodeAt(a);
				if (32 > l || l > 47) throw new Error("intermediate must be in range 0x20 .. 0x2f");
				i <<= 8, i |= l;
			}
		}
		if (e.final.length !== 1) throw new Error("final must be a single byte");
		let s = e.final.charCodeAt(0);
		if (r[0] > s || s > r[1]) throw new Error(`final must be in range ${r[0]} .. ${r[1]}`);
		return i <<= 8, i |= s, i;
	}
	identToString(e) {
		let r = [];
		for (; e;) r.push(String.fromCharCode(e & 255)), e >>= 8;
		return r.reverse().join("");
	}
	setPrintHandler(e) {
		this._printHandler = e;
	}
	clearPrintHandler() {
		this._printHandler = this._printHandlerFb;
	}
	registerEscHandler(e, r) {
		let i = this._identifier(e, [48, 126]);
		this._escHandlers[i] === void 0 && (this._escHandlers[i] = []);
		let s = this._escHandlers[i];
		return s.push(r), { dispose: () => {
			let a = s.indexOf(r);
			a !== -1 && s.splice(a, 1);
		} };
	}
	clearEscHandler(e) {
		this._escHandlers[this._identifier(e, [48, 126])] && delete this._escHandlers[this._identifier(e, [48, 126])];
	}
	setEscHandlerFallback(e) {
		this._escHandlerFb = e;
	}
	setExecuteHandler(e, r) {
		this._executeHandlers[e.charCodeAt(0)] = r;
	}
	clearExecuteHandler(e) {
		this._executeHandlers[e.charCodeAt(0)] && delete this._executeHandlers[e.charCodeAt(0)];
	}
	setExecuteHandlerFallback(e) {
		this._executeHandlerFb = e;
	}
	registerCsiHandler(e, r) {
		let i = this._identifier(e);
		this._csiHandlers[i] === void 0 && (this._csiHandlers[i] = []);
		let s = this._csiHandlers[i];
		return s.push(r), { dispose: () => {
			let a = s.indexOf(r);
			a !== -1 && s.splice(a, 1);
		} };
	}
	clearCsiHandler(e) {
		this._csiHandlers[this._identifier(e)] && delete this._csiHandlers[this._identifier(e)];
	}
	setCsiHandlerFallback(e) {
		this._csiHandlerFb = e;
	}
	registerDcsHandler(e, r) {
		return this._dcsParser.registerHandler(this._identifier(e), r);
	}
	clearDcsHandler(e) {
		this._dcsParser.clearHandler(this._identifier(e));
	}
	setDcsHandlerFallback(e) {
		this._dcsParser.setHandlerFallback(e);
	}
	registerOscHandler(e, r) {
		return this._oscParser.registerHandler(e, r);
	}
	clearOscHandler(e) {
		this._oscParser.clearHandler(e);
	}
	setOscHandlerFallback(e) {
		this._oscParser.setHandlerFallback(e);
	}
	setErrorHandler(e) {
		this._errorHandler = e;
	}
	clearErrorHandler() {
		this._errorHandler = this._errorHandlerFb;
	}
	reset() {
		this.currentState = this.initialState, this._oscParser.reset(), this._dcsParser.reset(), this._params.reset(), this._params.addParam(0), this._collect = 0, this.precedingJoinState = 0, this._parseStack.state !== 0 && (this._parseStack.state = 2, this._parseStack.handlers = []);
	}
	_preserveStack(e, r, i, s, a) {
		this._parseStack.state = e, this._parseStack.handlers = r, this._parseStack.handlerPos = i, this._parseStack.transition = s, this._parseStack.chunkPos = a;
	}
	parse(e, r, i) {
		let s = 0, a = 0, l = 0, c;
		if (this._parseStack.state) if (this._parseStack.state === 2) this._parseStack.state = 0, l = this._parseStack.chunkPos + 1;
		else {
			if (i === void 0 || this._parseStack.state === 1) throw this._parseStack.state = 1, /* @__PURE__ */ new Error("improper continuation due to previous async handler, giving up parsing");
			let u = this._parseStack.handlers, m = this._parseStack.handlerPos - 1;
			switch (this._parseStack.state) {
				case 3:
					if (i === !1 && m > -1) {
						for (; m >= 0 && (c = u[m](this._params), c !== !0); m--) if (c instanceof Promise) return this._parseStack.handlerPos = m, c;
					}
					this._parseStack.handlers = [];
					break;
				case 4:
					if (i === !1 && m > -1) {
						for (; m >= 0 && (c = u[m](), c !== !0); m--) if (c instanceof Promise) return this._parseStack.handlerPos = m, c;
					}
					this._parseStack.handlers = [];
					break;
				case 6:
					if (s = e[this._parseStack.chunkPos], c = this._dcsParser.unhook(s !== 24 && s !== 26, i), c) return c;
					s === 27 && (this._parseStack.transition |= 1), this._params.reset(), this._params.addParam(0), this._collect = 0;
					break;
				case 5:
					if (s = e[this._parseStack.chunkPos], c = this._oscParser.end(s !== 24 && s !== 26, i), c) return c;
					s === 27 && (this._parseStack.transition |= 1), this._params.reset(), this._params.addParam(0), this._collect = 0;
			}
			this._parseStack.state = 0, l = this._parseStack.chunkPos + 1, this.precedingJoinState = 0, this.currentState = this._parseStack.transition & 15;
		}
		for (let u = l; u < r; ++u) {
			switch (s = e[u], a = this._transitions.table[this.currentState << 8 | (s < 160 ? s : q)], a >> 4) {
				case 2:
					for (let _ = u + 1;; ++_) {
						if (_ >= r || (s = e[_]) < 32 || s > 126 && s < q) {
							this._printHandler(e, u, _), u = _ - 1;
							break;
						}
						if (++_ >= r || (s = e[_]) < 32 || s > 126 && s < q) {
							this._printHandler(e, u, _), u = _ - 1;
							break;
						}
						if (++_ >= r || (s = e[_]) < 32 || s > 126 && s < q) {
							this._printHandler(e, u, _), u = _ - 1;
							break;
						}
						if (++_ >= r || (s = e[_]) < 32 || s > 126 && s < q) {
							this._printHandler(e, u, _), u = _ - 1;
							break;
						}
					}
					break;
				case 3:
					this._executeHandlers[s] ? this._executeHandlers[s]() : this._executeHandlerFb(s), this.precedingJoinState = 0;
					break;
				case 0: break;
				case 1:
					if (this._errorHandler({
						position: u,
						code: s,
						currentState: this.currentState,
						collect: this._collect,
						params: this._params,
						abort: !1
					}).abort) return;
					break;
				case 7:
					let o = this._csiHandlers[this._collect << 8 | s], h = o ? o.length - 1 : -1;
					for (; h >= 0 && (c = o[h](this._params), c !== !0); h--) if (c instanceof Promise) return this._preserveStack(3, o, h, a, u), c;
					h < 0 && this._csiHandlerFb(this._collect << 8 | s, this._params), this.precedingJoinState = 0;
					break;
				case 8:
					do
						switch (s) {
							case 59:
								this._params.addParam(0);
								break;
							case 58:
								this._params.addSubParam(-1);
								break;
							default: this._params.addDigit(s - 48);
						}
					while (++u < r && (s = e[u]) > 47 && s < 60);
					u--;
					break;
				case 9:
					this._collect <<= 8, this._collect |= s;
					break;
				case 10:
					let x = this._escHandlers[this._collect << 8 | s], v = x ? x.length - 1 : -1;
					for (; v >= 0 && (c = x[v](), c !== !0); v--) if (c instanceof Promise) return this._preserveStack(4, x, v, a, u), c;
					v < 0 && this._escHandlerFb(this._collect << 8 | s), this.precedingJoinState = 0;
					break;
				case 11:
					this._params.reset(), this._params.addParam(0), this._collect = 0;
					break;
				case 12:
					this._dcsParser.hook(this._collect << 8 | s, this._params);
					break;
				case 13:
					for (let _ = u + 1;; ++_) if (_ >= r || (s = e[_]) === 24 || s === 26 || s === 27 || s > 127 && s < q) {
						this._dcsParser.put(e, u, _), u = _ - 1;
						break;
					}
					break;
				case 14:
					if (c = this._dcsParser.unhook(s !== 24 && s !== 26), c) return this._preserveStack(6, [], 0, a, u), c;
					s === 27 && (a |= 1), this._params.reset(), this._params.addParam(0), this._collect = 0, this.precedingJoinState = 0;
					break;
				case 4:
					this._oscParser.start();
					break;
				case 5:
					for (let _ = u + 1;; _++) if (_ >= r || (s = e[_]) < 32 || s > 127 && s < q) {
						this._oscParser.put(e, u, _), u = _ - 1;
						break;
					}
					break;
				case 6:
					if (c = this._oscParser.end(s !== 24 && s !== 26), c) return this._preserveStack(5, [], 0, a, u), c;
					s === 27 && (a |= 1), this._params.reset(), this._params.addParam(0), this._collect = 0, this.precedingJoinState = 0;
			}
			this.currentState = a & 15;
		}
	}
};
var Oi = /^([\da-f])\/([\da-f])\/([\da-f])$|^([\da-f]{2})\/([\da-f]{2})\/([\da-f]{2})$|^([\da-f]{3})\/([\da-f]{3})\/([\da-f]{3})$|^([\da-f]{4})\/([\da-f]{4})\/([\da-f]{4})$/;
var Ri = /^[\da-f]+$/;
function sr(n) {
	if (!n) return;
	let t = n.toLowerCase();
	if (t.indexOf("rgb:") === 0) {
		t = t.slice(4);
		let e = Oi.exec(t);
		if (e) {
			let r = e[1] ? 15 : e[4] ? 255 : e[7] ? 4095 : 65535;
			return [
				Math.round(parseInt(e[1] || e[4] || e[7] || e[10], 16) / r * 255),
				Math.round(parseInt(e[2] || e[5] || e[8] || e[11], 16) / r * 255),
				Math.round(parseInt(e[3] || e[6] || e[9] || e[12], 16) / r * 255)
			];
		}
	} else if (t.indexOf("#") === 0 && (t = t.slice(1), Ri.exec(t) && [
		3,
		6,
		9,
		12
	].includes(t.length))) {
		let e = t.length / 3, r = [
			0,
			0,
			0
		];
		for (let i = 0; i < 3; ++i) {
			let s = parseInt(t.slice(e * i, e * i + e), 16);
			r[i] = e === 1 ? s << 4 : e === 2 ? s : e === 3 ? s >> 4 : s >> 8;
		}
		return r;
	}
}
var wi = {
	"(": 0,
	")": 1,
	"*": 2,
	"+": 3,
	"-": 1,
	".": 2
};
var ie = 131072;
var zr = 10;
function qr(n, t) {
	if (n > 24) return t.setWinLines || !1;
	switch (n) {
		case 1: return !!t.restoreWin;
		case 2: return !!t.minimizeWin;
		case 3: return !!t.setWinPosition;
		case 4: return !!t.setWinSizePixels;
		case 5: return !!t.raiseWin;
		case 6: return !!t.lowerWin;
		case 7: return !!t.refreshWin;
		case 8: return !!t.setWinSizeChars;
		case 9: return !!t.maximizeWin;
		case 10: return !!t.fullscreenWin;
		case 11: return !!t.getWinState;
		case 13: return !!t.getWinPosition;
		case 14: return !!t.getWinSizePixels;
		case 15: return !!t.getScreenSizePixels;
		case 16: return !!t.getCellSizePixels;
		case 18: return !!t.getWinSizeChars;
		case 19: return !!t.getScreenSizeChars;
		case 20: return !!t.getIconTitle;
		case 21: return !!t.getWinTitle;
		case 22: return !!t.pushTitle;
		case 23: return !!t.popTitle;
		case 24: return !!t.setWinLines;
	}
	return !1;
}
var $r = 5e3;
var jr = 0;
var Ct = class extends A {
	constructor(e, r, i, s, a, l, c, u, m = new yt()) {
		super();
		this._bufferService = e;
		this._charsetService = r;
		this._coreService = i;
		this._logService = s;
		this._optionsService = a;
		this._oscLinkService = l;
		this._coreMouseService = c;
		this._unicodeService = u;
		this._parser = m;
		this._parseBuffer = /* @__PURE__ */ new Uint32Array(4096);
		this._stringDecoder = new Ge();
		this._utf8Decoder = new Ke();
		this._windowTitle = "";
		this._iconName = "";
		this._windowTitleStack = [];
		this._iconNameStack = [];
		this._curAttrData = k.clone();
		this._eraseAttrDataInternal = k.clone();
		this._onRequestBell = this._register(new S());
		this.onRequestBell = this._onRequestBell.event;
		this._onRequestRefreshRows = this._register(new S());
		this.onRequestRefreshRows = this._onRequestRefreshRows.event;
		this._onRequestReset = this._register(new S());
		this.onRequestReset = this._onRequestReset.event;
		this._onRequestSendFocus = this._register(new S());
		this.onRequestSendFocus = this._onRequestSendFocus.event;
		this._onRequestSyncScrollBar = this._register(new S());
		this.onRequestSyncScrollBar = this._onRequestSyncScrollBar.event;
		this._onRequestWindowsOptionsReport = this._register(new S());
		this.onRequestWindowsOptionsReport = this._onRequestWindowsOptionsReport.event;
		this._onA11yChar = this._register(new S());
		this.onA11yChar = this._onA11yChar.event;
		this._onA11yTab = this._register(new S());
		this.onA11yTab = this._onA11yTab.event;
		this._onCursorMove = this._register(new S());
		this.onCursorMove = this._onCursorMove.event;
		this._onLineFeed = this._register(new S());
		this.onLineFeed = this._onLineFeed.event;
		this._onScroll = this._register(new S());
		this.onScroll = this._onScroll.event;
		this._onTitleChange = this._register(new S());
		this.onTitleChange = this._onTitleChange.event;
		this._onColor = this._register(new S());
		this.onColor = this._onColor.event;
		this._parseStack = {
			paused: !1,
			cursorStartX: 0,
			cursorStartY: 0,
			decodedLength: 0,
			position: 0
		};
		this._specialColors = [
			256,
			257,
			258
		];
		this._register(this._parser), this._dirtyRowTracker = new Fe(this._bufferService), this._activeBuffer = this._bufferService.buffer, this._register(this._bufferService.buffers.onBufferActivate((o) => this._activeBuffer = o.activeBuffer)), this._parser.setCsiHandlerFallback((o, h) => {
			this._logService.debug("Unknown CSI code: ", {
				identifier: this._parser.identToString(o),
				params: h.toArray()
			});
		}), this._parser.setEscHandlerFallback((o) => {
			this._logService.debug("Unknown ESC code: ", { identifier: this._parser.identToString(o) });
		}), this._parser.setExecuteHandlerFallback((o) => {
			this._logService.debug("Unknown EXECUTE code: ", { code: o });
		}), this._parser.setOscHandlerFallback((o, h, x) => {
			this._logService.debug("Unknown OSC code: ", {
				identifier: o,
				action: h,
				data: x
			});
		}), this._parser.setDcsHandlerFallback((o, h, x) => {
			h === "HOOK" && (x = x.toArray()), this._logService.debug("Unknown DCS code: ", {
				identifier: this._parser.identToString(o),
				action: h,
				payload: x
			});
		}), this._parser.setPrintHandler((o, h, x) => this.print(o, h, x)), this._parser.registerCsiHandler({ final: "@" }, (o) => this.insertChars(o)), this._parser.registerCsiHandler({
			intermediates: " ",
			final: "@"
		}, (o) => this.scrollLeft(o)), this._parser.registerCsiHandler({ final: "A" }, (o) => this.cursorUp(o)), this._parser.registerCsiHandler({
			intermediates: " ",
			final: "A"
		}, (o) => this.scrollRight(o)), this._parser.registerCsiHandler({ final: "B" }, (o) => this.cursorDown(o)), this._parser.registerCsiHandler({ final: "C" }, (o) => this.cursorForward(o)), this._parser.registerCsiHandler({ final: "D" }, (o) => this.cursorBackward(o)), this._parser.registerCsiHandler({ final: "E" }, (o) => this.cursorNextLine(o)), this._parser.registerCsiHandler({ final: "F" }, (o) => this.cursorPrecedingLine(o)), this._parser.registerCsiHandler({ final: "G" }, (o) => this.cursorCharAbsolute(o)), this._parser.registerCsiHandler({ final: "H" }, (o) => this.cursorPosition(o)), this._parser.registerCsiHandler({ final: "I" }, (o) => this.cursorForwardTab(o)), this._parser.registerCsiHandler({ final: "J" }, (o) => this.eraseInDisplay(o, !1)), this._parser.registerCsiHandler({
			prefix: "?",
			final: "J"
		}, (o) => this.eraseInDisplay(o, !0)), this._parser.registerCsiHandler({ final: "K" }, (o) => this.eraseInLine(o, !1)), this._parser.registerCsiHandler({
			prefix: "?",
			final: "K"
		}, (o) => this.eraseInLine(o, !0)), this._parser.registerCsiHandler({ final: "L" }, (o) => this.insertLines(o)), this._parser.registerCsiHandler({ final: "M" }, (o) => this.deleteLines(o)), this._parser.registerCsiHandler({ final: "P" }, (o) => this.deleteChars(o)), this._parser.registerCsiHandler({ final: "S" }, (o) => this.scrollUp(o)), this._parser.registerCsiHandler({ final: "T" }, (o) => this.scrollDown(o)), this._parser.registerCsiHandler({ final: "X" }, (o) => this.eraseChars(o)), this._parser.registerCsiHandler({ final: "Z" }, (o) => this.cursorBackwardTab(o)), this._parser.registerCsiHandler({ final: "`" }, (o) => this.charPosAbsolute(o)), this._parser.registerCsiHandler({ final: "a" }, (o) => this.hPositionRelative(o)), this._parser.registerCsiHandler({ final: "b" }, (o) => this.repeatPrecedingCharacter(o)), this._parser.registerCsiHandler({ final: "c" }, (o) => this.sendDeviceAttributesPrimary(o)), this._parser.registerCsiHandler({
			prefix: ">",
			final: "c"
		}, (o) => this.sendDeviceAttributesSecondary(o)), this._parser.registerCsiHandler({ final: "d" }, (o) => this.linePosAbsolute(o)), this._parser.registerCsiHandler({ final: "e" }, (o) => this.vPositionRelative(o)), this._parser.registerCsiHandler({ final: "f" }, (o) => this.hVPosition(o)), this._parser.registerCsiHandler({ final: "g" }, (o) => this.tabClear(o)), this._parser.registerCsiHandler({ final: "h" }, (o) => this.setMode(o)), this._parser.registerCsiHandler({
			prefix: "?",
			final: "h"
		}, (o) => this.setModePrivate(o)), this._parser.registerCsiHandler({ final: "l" }, (o) => this.resetMode(o)), this._parser.registerCsiHandler({
			prefix: "?",
			final: "l"
		}, (o) => this.resetModePrivate(o)), this._parser.registerCsiHandler({ final: "m" }, (o) => this.charAttributes(o)), this._parser.registerCsiHandler({ final: "n" }, (o) => this.deviceStatus(o)), this._parser.registerCsiHandler({
			prefix: "?",
			final: "n"
		}, (o) => this.deviceStatusPrivate(o)), this._parser.registerCsiHandler({
			intermediates: "!",
			final: "p"
		}, (o) => this.softReset(o)), this._parser.registerCsiHandler({
			intermediates: " ",
			final: "q"
		}, (o) => this.setCursorStyle(o)), this._parser.registerCsiHandler({ final: "r" }, (o) => this.setScrollRegion(o)), this._parser.registerCsiHandler({ final: "s" }, (o) => this.saveCursor(o)), this._parser.registerCsiHandler({ final: "t" }, (o) => this.windowOptions(o)), this._parser.registerCsiHandler({ final: "u" }, (o) => this.restoreCursor(o)), this._parser.registerCsiHandler({
			intermediates: "'",
			final: "}"
		}, (o) => this.insertColumns(o)), this._parser.registerCsiHandler({
			intermediates: "'",
			final: "~"
		}, (o) => this.deleteColumns(o)), this._parser.registerCsiHandler({
			intermediates: "\"",
			final: "q"
		}, (o) => this.selectProtected(o)), this._parser.registerCsiHandler({
			intermediates: "$",
			final: "p"
		}, (o) => this.requestMode(o, !0)), this._parser.registerCsiHandler({
			prefix: "?",
			intermediates: "$",
			final: "p"
		}, (o) => this.requestMode(o, !1)), this._parser.setExecuteHandler(P.BEL, () => this.bell()), this._parser.setExecuteHandler(P.LF, () => this.lineFeed()), this._parser.setExecuteHandler(P.VT, () => this.lineFeed()), this._parser.setExecuteHandler(P.FF, () => this.lineFeed()), this._parser.setExecuteHandler(P.CR, () => this.carriageReturn()), this._parser.setExecuteHandler(P.BS, () => this.backspace()), this._parser.setExecuteHandler(P.HT, () => this.tab()), this._parser.setExecuteHandler(P.SO, () => this.shiftOut()), this._parser.setExecuteHandler(P.SI, () => this.shiftIn()), this._parser.setExecuteHandler(ke.IND, () => this.index()), this._parser.setExecuteHandler(ke.NEL, () => this.nextLine()), this._parser.setExecuteHandler(ke.HTS, () => this.tabSet()), this._parser.registerOscHandler(0, new U((o) => (this.setTitle(o), this.setIconName(o), !0))), this._parser.registerOscHandler(1, new U((o) => this.setIconName(o))), this._parser.registerOscHandler(2, new U((o) => this.setTitle(o))), this._parser.registerOscHandler(4, new U((o) => this.setOrReportIndexedColor(o))), this._parser.registerOscHandler(8, new U((o) => this.setHyperlink(o))), this._parser.registerOscHandler(10, new U((o) => this.setOrReportFgColor(o))), this._parser.registerOscHandler(11, new U((o) => this.setOrReportBgColor(o))), this._parser.registerOscHandler(12, new U((o) => this.setOrReportCursorColor(o))), this._parser.registerOscHandler(104, new U((o) => this.restoreIndexedColor(o))), this._parser.registerOscHandler(110, new U((o) => this.restoreFgColor(o))), this._parser.registerOscHandler(111, new U((o) => this.restoreBgColor(o))), this._parser.registerOscHandler(112, new U((o) => this.restoreCursorColor(o))), this._parser.registerEscHandler({ final: "7" }, () => this.saveCursor()), this._parser.registerEscHandler({ final: "8" }, () => this.restoreCursor()), this._parser.registerEscHandler({ final: "D" }, () => this.index()), this._parser.registerEscHandler({ final: "E" }, () => this.nextLine()), this._parser.registerEscHandler({ final: "H" }, () => this.tabSet()), this._parser.registerEscHandler({ final: "M" }, () => this.reverseIndex()), this._parser.registerEscHandler({ final: "=" }, () => this.keypadApplicationMode()), this._parser.registerEscHandler({ final: ">" }, () => this.keypadNumericMode()), this._parser.registerEscHandler({ final: "c" }, () => this.fullReset()), this._parser.registerEscHandler({ final: "n" }, () => this.setgLevel(2)), this._parser.registerEscHandler({ final: "o" }, () => this.setgLevel(3)), this._parser.registerEscHandler({ final: "|" }, () => this.setgLevel(3)), this._parser.registerEscHandler({ final: "}" }, () => this.setgLevel(2)), this._parser.registerEscHandler({ final: "~" }, () => this.setgLevel(1)), this._parser.registerEscHandler({
			intermediates: "%",
			final: "@"
		}, () => this.selectDefaultCharset()), this._parser.registerEscHandler({
			intermediates: "%",
			final: "G"
		}, () => this.selectDefaultCharset());
		for (let o in B) this._parser.registerEscHandler({
			intermediates: "(",
			final: o
		}, () => this.selectCharset("(" + o)), this._parser.registerEscHandler({
			intermediates: ")",
			final: o
		}, () => this.selectCharset(")" + o)), this._parser.registerEscHandler({
			intermediates: "*",
			final: o
		}, () => this.selectCharset("*" + o)), this._parser.registerEscHandler({
			intermediates: "+",
			final: o
		}, () => this.selectCharset("+" + o)), this._parser.registerEscHandler({
			intermediates: "-",
			final: o
		}, () => this.selectCharset("-" + o)), this._parser.registerEscHandler({
			intermediates: ".",
			final: o
		}, () => this.selectCharset("." + o)), this._parser.registerEscHandler({
			intermediates: "/",
			final: o
		}, () => this.selectCharset("/" + o));
		this._parser.registerEscHandler({
			intermediates: "#",
			final: "8"
		}, () => this.screenAlignmentPattern()), this._parser.setErrorHandler((o) => (this._logService.error("Parsing error: ", o), o)), this._parser.registerDcsHandler({
			intermediates: "$",
			final: "q"
		}, new He((o, h) => this.requestStatusString(o, h)));
	}
	getAttrData() {
		return this._curAttrData;
	}
	_preserveStack(e, r, i, s) {
		this._parseStack.paused = !0, this._parseStack.cursorStartX = e, this._parseStack.cursorStartY = r, this._parseStack.decodedLength = i, this._parseStack.position = s;
	}
	_logSlowResolvingAsync(e) {
		this._logService.logLevel <= 3 && Promise.race([e, new Promise((r, i) => setTimeout(() => i("#SLOW_TIMEOUT"), $r))]).catch((r) => {
			if (r !== "#SLOW_TIMEOUT") throw r;
			console.warn(`async parser handler taking longer than ${$r} ms`);
		});
	}
	_getCurrentLinkId() {
		return this._curAttrData.extended.urlId;
	}
	parse(e, r) {
		let i, s = this._activeBuffer.x, a = this._activeBuffer.y, l = 0, c = this._parseStack.paused;
		if (c) {
			if (i = this._parser.parse(this._parseBuffer, this._parseStack.decodedLength, r)) return this._logSlowResolvingAsync(i), i;
			s = this._parseStack.cursorStartX, a = this._parseStack.cursorStartY, this._parseStack.paused = !1, e.length > ie && (l = this._parseStack.position + ie);
		}
		if (this._logService.logLevel <= 1 && this._logService.debug(`parsing data ${typeof e == "string" ? ` "${e}"` : ` "${Array.prototype.map.call(e, (o) => String.fromCharCode(o)).join("")}"`}`), this._logService.logLevel === 0 && this._logService.trace("parsing data (codes)", typeof e == "string" ? e.split("").map((o) => o.charCodeAt(0)) : e), this._parseBuffer.length < e.length && this._parseBuffer.length < ie && (this._parseBuffer = new Uint32Array(Math.min(e.length, ie))), c || this._dirtyRowTracker.clearRange(), e.length > ie) for (let o = l; o < e.length; o += ie) {
			let h = o + ie < e.length ? o + ie : e.length, x = typeof e == "string" ? this._stringDecoder.decode(e.substring(o, h), this._parseBuffer) : this._utf8Decoder.decode(e.subarray(o, h), this._parseBuffer);
			if (i = this._parser.parse(this._parseBuffer, x)) return this._preserveStack(s, a, x, o), this._logSlowResolvingAsync(i), i;
		}
		else if (!c) {
			let o = typeof e == "string" ? this._stringDecoder.decode(e, this._parseBuffer) : this._utf8Decoder.decode(e, this._parseBuffer);
			if (i = this._parser.parse(this._parseBuffer, o)) return this._preserveStack(s, a, o, 0), this._logSlowResolvingAsync(i), i;
		}
		(this._activeBuffer.x !== s || this._activeBuffer.y !== a) && this._onCursorMove.fire();
		let u = this._dirtyRowTracker.end + (this._bufferService.buffer.ybase - this._bufferService.buffer.ydisp), m = this._dirtyRowTracker.start + (this._bufferService.buffer.ybase - this._bufferService.buffer.ydisp);
		m < this._bufferService.rows && this._onRequestRefreshRows.fire({
			start: Math.min(m, this._bufferService.rows - 1),
			end: Math.min(u, this._bufferService.rows - 1)
		});
	}
	print(e, r, i) {
		let s, a, l = this._charsetService.charset, c = this._optionsService.rawOptions.screenReaderMode, u = this._bufferService.cols, m = this._coreService.decPrivateModes.wraparound, o = this._coreService.modes.insertMode, h = this._curAttrData, x = this._activeBuffer.lines.get(this._activeBuffer.ybase + this._activeBuffer.y);
		this._dirtyRowTracker.markDirty(this._activeBuffer.y), this._activeBuffer.x && i - r > 0 && x.getWidth(this._activeBuffer.x - 1) === 2 && x.setCellFromCodepoint(this._activeBuffer.x - 1, 0, 1, h);
		let v = this._parser.precedingJoinState;
		for (let _ = r; _ < i; ++_) {
			if (s = e[_], s < 127 && l) {
				let L = l[String.fromCharCode(s)];
				L && (s = L.charCodeAt(0));
			}
			let d = this._unicodeService.charProperties(s, v);
			a = z.extractWidth(d);
			let R = z.extractShouldJoin(d), w = R ? z.extractWidth(v) : 0;
			if (v = d, c && this._onA11yChar.fire($(s)), this._getCurrentLinkId() && this._oscLinkService.addLineToLink(this._getCurrentLinkId(), this._activeBuffer.ybase + this._activeBuffer.y), this._activeBuffer.x + a - w > u) {
				if (m) {
					let L = x, g = this._activeBuffer.x - w;
					for (this._activeBuffer.x = w, this._activeBuffer.y++, this._activeBuffer.y === this._activeBuffer.scrollBottom + 1 ? (this._activeBuffer.y--, this._bufferService.scroll(this._eraseAttrData(), !0)) : (this._activeBuffer.y >= this._bufferService.rows && (this._activeBuffer.y = this._bufferService.rows - 1), this._activeBuffer.lines.get(this._activeBuffer.ybase + this._activeBuffer.y).isWrapped = !0), x = this._activeBuffer.lines.get(this._activeBuffer.ybase + this._activeBuffer.y), w > 0 && x instanceof Z && x.copyCellsFrom(L, g, 0, w, !1); g < u;) L.setCellFromCodepoint(g++, 0, 1, h);
				} else if (this._activeBuffer.x = u - 1, a === 2) continue;
			}
			if (R && this._activeBuffer.x) {
				let L = x.getWidth(this._activeBuffer.x - 1) ? 1 : 2;
				x.addCodepointToCell(this._activeBuffer.x - L, s, a);
				for (let g = a - w; --g >= 0;) x.setCellFromCodepoint(this._activeBuffer.x++, 0, 0, h);
				continue;
			}
			if (o && (x.insertCells(this._activeBuffer.x, a - w, this._activeBuffer.getNullCell(h)), x.getWidth(u - 1) === 2 && x.setCellFromCodepoint(u - 1, 0, 1, h)), x.setCellFromCodepoint(this._activeBuffer.x++, s, a, h), a > 0) for (; --a;) x.setCellFromCodepoint(this._activeBuffer.x++, 0, 0, h);
		}
		this._parser.precedingJoinState = v, this._activeBuffer.x < u && i - r > 0 && x.getWidth(this._activeBuffer.x) === 0 && !x.hasContent(this._activeBuffer.x) && x.setCellFromCodepoint(this._activeBuffer.x, 0, 1, h), this._dirtyRowTracker.markDirty(this._activeBuffer.y);
	}
	registerCsiHandler(e, r) {
		return e.final === "t" && !e.prefix && !e.intermediates ? this._parser.registerCsiHandler(e, (i) => qr(i.params[0], this._optionsService.rawOptions.windowOptions) ? r(i) : !0) : this._parser.registerCsiHandler(e, r);
	}
	registerDcsHandler(e, r) {
		return this._parser.registerDcsHandler(e, new He(r));
	}
	registerEscHandler(e, r) {
		return this._parser.registerEscHandler(e, r);
	}
	registerOscHandler(e, r) {
		return this._parser.registerOscHandler(e, new U(r));
	}
	bell() {
		return this._onRequestBell.fire(), !0;
	}
	lineFeed() {
		return this._dirtyRowTracker.markDirty(this._activeBuffer.y), this._optionsService.rawOptions.convertEol && (this._activeBuffer.x = 0), this._activeBuffer.y++, this._activeBuffer.y === this._activeBuffer.scrollBottom + 1 ? (this._activeBuffer.y--, this._bufferService.scroll(this._eraseAttrData())) : this._activeBuffer.y >= this._bufferService.rows ? this._activeBuffer.y = this._bufferService.rows - 1 : this._activeBuffer.lines.get(this._activeBuffer.ybase + this._activeBuffer.y).isWrapped = !1, this._activeBuffer.x >= this._bufferService.cols && this._activeBuffer.x--, this._dirtyRowTracker.markDirty(this._activeBuffer.y), this._onLineFeed.fire(), !0;
	}
	carriageReturn() {
		return this._activeBuffer.x = 0, !0;
	}
	backspace() {
		if (!this._coreService.decPrivateModes.reverseWraparound) return this._restrictCursor(), this._activeBuffer.x > 0 && this._activeBuffer.x--, !0;
		if (this._restrictCursor(this._bufferService.cols), this._activeBuffer.x > 0) this._activeBuffer.x--;
		else if (this._activeBuffer.x === 0 && this._activeBuffer.y > this._activeBuffer.scrollTop && this._activeBuffer.y <= this._activeBuffer.scrollBottom && this._activeBuffer.lines.get(this._activeBuffer.ybase + this._activeBuffer.y)?.isWrapped) {
			this._activeBuffer.lines.get(this._activeBuffer.ybase + this._activeBuffer.y).isWrapped = !1, this._activeBuffer.y--, this._activeBuffer.x = this._bufferService.cols - 1;
			let e = this._activeBuffer.lines.get(this._activeBuffer.ybase + this._activeBuffer.y);
			e.hasWidth(this._activeBuffer.x) && !e.hasContent(this._activeBuffer.x) && this._activeBuffer.x--;
		}
		return this._restrictCursor(), !0;
	}
	tab() {
		if (this._activeBuffer.x >= this._bufferService.cols) return !0;
		let e = this._activeBuffer.x;
		return this._activeBuffer.x = this._activeBuffer.nextStop(), this._optionsService.rawOptions.screenReaderMode && this._onA11yTab.fire(this._activeBuffer.x - e), !0;
	}
	shiftOut() {
		return this._charsetService.setgLevel(1), !0;
	}
	shiftIn() {
		return this._charsetService.setgLevel(0), !0;
	}
	_restrictCursor(e = this._bufferService.cols - 1) {
		this._activeBuffer.x = Math.min(e, Math.max(0, this._activeBuffer.x)), this._activeBuffer.y = this._coreService.decPrivateModes.origin ? Math.min(this._activeBuffer.scrollBottom, Math.max(this._activeBuffer.scrollTop, this._activeBuffer.y)) : Math.min(this._bufferService.rows - 1, Math.max(0, this._activeBuffer.y)), this._dirtyRowTracker.markDirty(this._activeBuffer.y);
	}
	_setCursor(e, r) {
		this._dirtyRowTracker.markDirty(this._activeBuffer.y), this._coreService.decPrivateModes.origin ? (this._activeBuffer.x = e, this._activeBuffer.y = this._activeBuffer.scrollTop + r) : (this._activeBuffer.x = e, this._activeBuffer.y = r), this._restrictCursor(), this._dirtyRowTracker.markDirty(this._activeBuffer.y);
	}
	_moveCursor(e, r) {
		this._restrictCursor(), this._setCursor(this._activeBuffer.x + e, this._activeBuffer.y + r);
	}
	cursorUp(e) {
		let r = this._activeBuffer.y - this._activeBuffer.scrollTop;
		return r >= 0 ? this._moveCursor(0, -Math.min(r, e.params[0] || 1)) : this._moveCursor(0, -(e.params[0] || 1)), !0;
	}
	cursorDown(e) {
		let r = this._activeBuffer.scrollBottom - this._activeBuffer.y;
		return r >= 0 ? this._moveCursor(0, Math.min(r, e.params[0] || 1)) : this._moveCursor(0, e.params[0] || 1), !0;
	}
	cursorForward(e) {
		return this._moveCursor(e.params[0] || 1, 0), !0;
	}
	cursorBackward(e) {
		return this._moveCursor(-(e.params[0] || 1), 0), !0;
	}
	cursorNextLine(e) {
		return this.cursorDown(e), this._activeBuffer.x = 0, !0;
	}
	cursorPrecedingLine(e) {
		return this.cursorUp(e), this._activeBuffer.x = 0, !0;
	}
	cursorCharAbsolute(e) {
		return this._setCursor((e.params[0] || 1) - 1, this._activeBuffer.y), !0;
	}
	cursorPosition(e) {
		return this._setCursor(e.length >= 2 ? (e.params[1] || 1) - 1 : 0, (e.params[0] || 1) - 1), !0;
	}
	charPosAbsolute(e) {
		return this._setCursor((e.params[0] || 1) - 1, this._activeBuffer.y), !0;
	}
	hPositionRelative(e) {
		return this._moveCursor(e.params[0] || 1, 0), !0;
	}
	linePosAbsolute(e) {
		return this._setCursor(this._activeBuffer.x, (e.params[0] || 1) - 1), !0;
	}
	vPositionRelative(e) {
		return this._moveCursor(0, e.params[0] || 1), !0;
	}
	hVPosition(e) {
		return this.cursorPosition(e), !0;
	}
	tabClear(e) {
		let r = e.params[0];
		return r === 0 ? delete this._activeBuffer.tabs[this._activeBuffer.x] : r === 3 && (this._activeBuffer.tabs = {}), !0;
	}
	cursorForwardTab(e) {
		if (this._activeBuffer.x >= this._bufferService.cols) return !0;
		let r = e.params[0] || 1;
		for (; r--;) this._activeBuffer.x = this._activeBuffer.nextStop();
		return !0;
	}
	cursorBackwardTab(e) {
		if (this._activeBuffer.x >= this._bufferService.cols) return !0;
		let r = e.params[0] || 1;
		for (; r--;) this._activeBuffer.x = this._activeBuffer.prevStop();
		return !0;
	}
	selectProtected(e) {
		let r = e.params[0];
		return r === 1 && (this._curAttrData.bg |= 536870912), (r === 2 || r === 0) && (this._curAttrData.bg &= -536870913), !0;
	}
	_eraseInBufferLine(e, r, i, s = !1, a = !1) {
		let l = this._activeBuffer.lines.get(this._activeBuffer.ybase + e);
		l.replaceCells(r, i, this._activeBuffer.getNullCell(this._eraseAttrData()), a), s && (l.isWrapped = !1);
	}
	_resetBufferLine(e, r = !1) {
		let i = this._activeBuffer.lines.get(this._activeBuffer.ybase + e);
		i && (i.fill(this._activeBuffer.getNullCell(this._eraseAttrData()), r), this._bufferService.buffer.clearMarkers(this._activeBuffer.ybase + e), i.isWrapped = !1);
	}
	eraseInDisplay(e, r = !1) {
		this._restrictCursor(this._bufferService.cols);
		let i;
		switch (e.params[0]) {
			case 0:
				for (i = this._activeBuffer.y, this._dirtyRowTracker.markDirty(i), this._eraseInBufferLine(i++, this._activeBuffer.x, this._bufferService.cols, this._activeBuffer.x === 0, r); i < this._bufferService.rows; i++) this._resetBufferLine(i, r);
				this._dirtyRowTracker.markDirty(i);
				break;
			case 1:
				for (i = this._activeBuffer.y, this._dirtyRowTracker.markDirty(i), this._eraseInBufferLine(i, 0, this._activeBuffer.x + 1, !0, r), this._activeBuffer.x + 1 >= this._bufferService.cols && (this._activeBuffer.lines.get(i + 1).isWrapped = !1); i--;) this._resetBufferLine(i, r);
				this._dirtyRowTracker.markDirty(0);
				break;
			case 2:
				if (this._optionsService.rawOptions.scrollOnEraseInDisplay) {
					for (i = this._bufferService.rows, this._dirtyRowTracker.markRangeDirty(0, i - 1); i-- && !this._activeBuffer.lines.get(this._activeBuffer.ybase + i)?.getTrimmedLength(););
					for (; i >= 0; i--) this._bufferService.scroll(this._eraseAttrData());
				} else {
					for (i = this._bufferService.rows, this._dirtyRowTracker.markDirty(i - 1); i--;) this._resetBufferLine(i, r);
					this._dirtyRowTracker.markDirty(0);
				}
				break;
			case 3:
				let s = this._activeBuffer.lines.length - this._bufferService.rows;
				s > 0 && (this._activeBuffer.lines.trimStart(s), this._activeBuffer.ybase = Math.max(this._activeBuffer.ybase - s, 0), this._activeBuffer.ydisp = Math.max(this._activeBuffer.ydisp - s, 0), this._onScroll.fire(0));
		}
		return !0;
	}
	eraseInLine(e, r = !1) {
		switch (this._restrictCursor(this._bufferService.cols), e.params[0]) {
			case 0:
				this._eraseInBufferLine(this._activeBuffer.y, this._activeBuffer.x, this._bufferService.cols, this._activeBuffer.x === 0, r);
				break;
			case 1:
				this._eraseInBufferLine(this._activeBuffer.y, 0, this._activeBuffer.x + 1, !1, r);
				break;
			case 2: this._eraseInBufferLine(this._activeBuffer.y, 0, this._bufferService.cols, !0, r);
		}
		return this._dirtyRowTracker.markDirty(this._activeBuffer.y), !0;
	}
	insertLines(e) {
		this._restrictCursor();
		let r = e.params[0] || 1;
		if (this._activeBuffer.y > this._activeBuffer.scrollBottom || this._activeBuffer.y < this._activeBuffer.scrollTop) return !0;
		let i = this._activeBuffer.ybase + this._activeBuffer.y, s = this._bufferService.rows - 1 - this._activeBuffer.scrollBottom, a = this._bufferService.rows - 1 + this._activeBuffer.ybase - s + 1;
		for (; r--;) this._activeBuffer.lines.splice(a - 1, 1), this._activeBuffer.lines.splice(i, 0, this._activeBuffer.getBlankLine(this._eraseAttrData()));
		return this._dirtyRowTracker.markRangeDirty(this._activeBuffer.y, this._activeBuffer.scrollBottom), this._activeBuffer.x = 0, !0;
	}
	deleteLines(e) {
		this._restrictCursor();
		let r = e.params[0] || 1;
		if (this._activeBuffer.y > this._activeBuffer.scrollBottom || this._activeBuffer.y < this._activeBuffer.scrollTop) return !0;
		let i = this._activeBuffer.ybase + this._activeBuffer.y, s;
		for (s = this._bufferService.rows - 1 - this._activeBuffer.scrollBottom, s = this._bufferService.rows - 1 + this._activeBuffer.ybase - s; r--;) this._activeBuffer.lines.splice(i, 1), this._activeBuffer.lines.splice(s, 0, this._activeBuffer.getBlankLine(this._eraseAttrData()));
		return this._dirtyRowTracker.markRangeDirty(this._activeBuffer.y, this._activeBuffer.scrollBottom), this._activeBuffer.x = 0, !0;
	}
	insertChars(e) {
		this._restrictCursor();
		let r = this._activeBuffer.lines.get(this._activeBuffer.ybase + this._activeBuffer.y);
		return r && (r.insertCells(this._activeBuffer.x, e.params[0] || 1, this._activeBuffer.getNullCell(this._eraseAttrData())), this._dirtyRowTracker.markDirty(this._activeBuffer.y)), !0;
	}
	deleteChars(e) {
		this._restrictCursor();
		let r = this._activeBuffer.lines.get(this._activeBuffer.ybase + this._activeBuffer.y);
		return r && (r.deleteCells(this._activeBuffer.x, e.params[0] || 1, this._activeBuffer.getNullCell(this._eraseAttrData())), this._dirtyRowTracker.markDirty(this._activeBuffer.y)), !0;
	}
	scrollUp(e) {
		let r = e.params[0] || 1;
		for (; r--;) this._activeBuffer.lines.splice(this._activeBuffer.ybase + this._activeBuffer.scrollTop, 1), this._activeBuffer.lines.splice(this._activeBuffer.ybase + this._activeBuffer.scrollBottom, 0, this._activeBuffer.getBlankLine(this._eraseAttrData()));
		return this._dirtyRowTracker.markRangeDirty(this._activeBuffer.scrollTop, this._activeBuffer.scrollBottom), !0;
	}
	scrollDown(e) {
		let r = e.params[0] || 1;
		for (; r--;) this._activeBuffer.lines.splice(this._activeBuffer.ybase + this._activeBuffer.scrollBottom, 1), this._activeBuffer.lines.splice(this._activeBuffer.ybase + this._activeBuffer.scrollTop, 0, this._activeBuffer.getBlankLine(k));
		return this._dirtyRowTracker.markRangeDirty(this._activeBuffer.scrollTop, this._activeBuffer.scrollBottom), !0;
	}
	scrollLeft(e) {
		if (this._activeBuffer.y > this._activeBuffer.scrollBottom || this._activeBuffer.y < this._activeBuffer.scrollTop) return !0;
		let r = e.params[0] || 1;
		for (let i = this._activeBuffer.scrollTop; i <= this._activeBuffer.scrollBottom; ++i) {
			let s = this._activeBuffer.lines.get(this._activeBuffer.ybase + i);
			s.deleteCells(0, r, this._activeBuffer.getNullCell(this._eraseAttrData())), s.isWrapped = !1;
		}
		return this._dirtyRowTracker.markRangeDirty(this._activeBuffer.scrollTop, this._activeBuffer.scrollBottom), !0;
	}
	scrollRight(e) {
		if (this._activeBuffer.y > this._activeBuffer.scrollBottom || this._activeBuffer.y < this._activeBuffer.scrollTop) return !0;
		let r = e.params[0] || 1;
		for (let i = this._activeBuffer.scrollTop; i <= this._activeBuffer.scrollBottom; ++i) {
			let s = this._activeBuffer.lines.get(this._activeBuffer.ybase + i);
			s.insertCells(0, r, this._activeBuffer.getNullCell(this._eraseAttrData())), s.isWrapped = !1;
		}
		return this._dirtyRowTracker.markRangeDirty(this._activeBuffer.scrollTop, this._activeBuffer.scrollBottom), !0;
	}
	insertColumns(e) {
		if (this._activeBuffer.y > this._activeBuffer.scrollBottom || this._activeBuffer.y < this._activeBuffer.scrollTop) return !0;
		let r = e.params[0] || 1;
		for (let i = this._activeBuffer.scrollTop; i <= this._activeBuffer.scrollBottom; ++i) {
			let s = this._activeBuffer.lines.get(this._activeBuffer.ybase + i);
			s.insertCells(this._activeBuffer.x, r, this._activeBuffer.getNullCell(this._eraseAttrData())), s.isWrapped = !1;
		}
		return this._dirtyRowTracker.markRangeDirty(this._activeBuffer.scrollTop, this._activeBuffer.scrollBottom), !0;
	}
	deleteColumns(e) {
		if (this._activeBuffer.y > this._activeBuffer.scrollBottom || this._activeBuffer.y < this._activeBuffer.scrollTop) return !0;
		let r = e.params[0] || 1;
		for (let i = this._activeBuffer.scrollTop; i <= this._activeBuffer.scrollBottom; ++i) {
			let s = this._activeBuffer.lines.get(this._activeBuffer.ybase + i);
			s.deleteCells(this._activeBuffer.x, r, this._activeBuffer.getNullCell(this._eraseAttrData())), s.isWrapped = !1;
		}
		return this._dirtyRowTracker.markRangeDirty(this._activeBuffer.scrollTop, this._activeBuffer.scrollBottom), !0;
	}
	eraseChars(e) {
		this._restrictCursor();
		let r = this._activeBuffer.lines.get(this._activeBuffer.ybase + this._activeBuffer.y);
		return r && (r.replaceCells(this._activeBuffer.x, this._activeBuffer.x + (e.params[0] || 1), this._activeBuffer.getNullCell(this._eraseAttrData())), this._dirtyRowTracker.markDirty(this._activeBuffer.y)), !0;
	}
	repeatPrecedingCharacter(e) {
		let r = this._parser.precedingJoinState;
		if (!r) return !0;
		let i = e.params[0] || 1, s = z.extractWidth(r), a = this._activeBuffer.x - s, c = this._activeBuffer.lines.get(this._activeBuffer.ybase + this._activeBuffer.y).getString(a), u = new Uint32Array(c.length * i), m = 0;
		for (let h = 0; h < c.length;) {
			let x = c.codePointAt(h) || 0;
			u[m++] = x, h += x > 65535 ? 2 : 1;
		}
		let o = m;
		for (let h = 1; h < i; ++h) u.copyWithin(o, 0, m), o += m;
		return this.print(u, 0, o), !0;
	}
	sendDeviceAttributesPrimary(e) {
		return e.params[0] > 0 || (this._is("xterm") || this._is("rxvt-unicode") || this._is("screen") ? this._coreService.triggerDataEvent(P.ESC + "[?1;2c") : this._is("linux") && this._coreService.triggerDataEvent(P.ESC + "[?6c")), !0;
	}
	sendDeviceAttributesSecondary(e) {
		return e.params[0] > 0 || (this._is("xterm") ? this._coreService.triggerDataEvent(P.ESC + "[>0;276;0c") : this._is("rxvt-unicode") ? this._coreService.triggerDataEvent(P.ESC + "[>85;95;0c") : this._is("linux") ? this._coreService.triggerDataEvent(e.params[0] + "c") : this._is("screen") && this._coreService.triggerDataEvent(P.ESC + "[>83;40003;0c")), !0;
	}
	_is(e) {
		return (this._optionsService.rawOptions.termName + "").indexOf(e) === 0;
	}
	setMode(e) {
		for (let r = 0; r < e.length; r++) switch (e.params[r]) {
			case 4:
				this._coreService.modes.insertMode = !0;
				break;
			case 20:
				this._optionsService.options.convertEol = !0;
				break;
		}
		return !0;
	}
	setModePrivate(e) {
		for (let r = 0; r < e.length; r++) switch (e.params[r]) {
			case 1:
				this._coreService.decPrivateModes.applicationCursorKeys = !0;
				break;
			case 2:
				this._charsetService.setgCharset(0, ee), this._charsetService.setgCharset(1, ee), this._charsetService.setgCharset(2, ee), this._charsetService.setgCharset(3, ee);
				break;
			case 3:
				this._optionsService.rawOptions.windowOptions.setWinLines && (this._bufferService.resize(132, this._bufferService.rows), this._onRequestReset.fire());
				break;
			case 6:
				this._coreService.decPrivateModes.origin = !0, this._setCursor(0, 0);
				break;
			case 7:
				this._coreService.decPrivateModes.wraparound = !0;
				break;
			case 12:
				this._optionsService.options.cursorBlink = !0;
				break;
			case 45:
				this._coreService.decPrivateModes.reverseWraparound = !0;
				break;
			case 66:
				this._logService.debug("Serial port requested application keypad."), this._coreService.decPrivateModes.applicationKeypad = !0, this._onRequestSyncScrollBar.fire();
				break;
			case 9:
				this._coreMouseService.activeProtocol = "X10";
				break;
			case 1e3:
				this._coreMouseService.activeProtocol = "VT200";
				break;
			case 1002:
				this._coreMouseService.activeProtocol = "DRAG";
				break;
			case 1003:
				this._coreMouseService.activeProtocol = "ANY";
				break;
			case 1004:
				this._coreService.decPrivateModes.sendFocus = !0, this._onRequestSendFocus.fire();
				break;
			case 1005:
				this._logService.debug("DECSET 1005 not supported (see #2507)");
				break;
			case 1006:
				this._coreMouseService.activeEncoding = "SGR";
				break;
			case 1015:
				this._logService.debug("DECSET 1015 not supported (see #2507)");
				break;
			case 1016:
				this._coreMouseService.activeEncoding = "SGR_PIXELS";
				break;
			case 25:
				this._coreService.isCursorHidden = !1;
				break;
			case 1048:
				this.saveCursor();
				break;
			case 1049: this.saveCursor();
			case 47:
			case 1047:
				this._bufferService.buffers.activateAltBuffer(this._eraseAttrData()), this._coreService.isCursorInitialized = !0, this._onRequestRefreshRows.fire(void 0), this._onRequestSyncScrollBar.fire();
				break;
			case 2004:
				this._coreService.decPrivateModes.bracketedPasteMode = !0;
				break;
			case 2026:
				this._coreService.decPrivateModes.synchronizedOutput = !0;
				break;
		}
		return !0;
	}
	resetMode(e) {
		for (let r = 0; r < e.length; r++) switch (e.params[r]) {
			case 4:
				this._coreService.modes.insertMode = !1;
				break;
			case 20:
				this._optionsService.options.convertEol = !1;
				break;
		}
		return !0;
	}
	resetModePrivate(e) {
		for (let r = 0; r < e.length; r++) switch (e.params[r]) {
			case 1:
				this._coreService.decPrivateModes.applicationCursorKeys = !1;
				break;
			case 3:
				this._optionsService.rawOptions.windowOptions.setWinLines && (this._bufferService.resize(80, this._bufferService.rows), this._onRequestReset.fire());
				break;
			case 6:
				this._coreService.decPrivateModes.origin = !1, this._setCursor(0, 0);
				break;
			case 7:
				this._coreService.decPrivateModes.wraparound = !1;
				break;
			case 12:
				this._optionsService.options.cursorBlink = !1;
				break;
			case 45:
				this._coreService.decPrivateModes.reverseWraparound = !1;
				break;
			case 66:
				this._logService.debug("Switching back to normal keypad."), this._coreService.decPrivateModes.applicationKeypad = !1, this._onRequestSyncScrollBar.fire();
				break;
			case 9:
			case 1e3:
			case 1002:
			case 1003:
				this._coreMouseService.activeProtocol = "NONE";
				break;
			case 1004:
				this._coreService.decPrivateModes.sendFocus = !1;
				break;
			case 1005:
				this._logService.debug("DECRST 1005 not supported (see #2507)");
				break;
			case 1006:
				this._coreMouseService.activeEncoding = "DEFAULT";
				break;
			case 1015:
				this._logService.debug("DECRST 1015 not supported (see #2507)");
				break;
			case 1016:
				this._coreMouseService.activeEncoding = "DEFAULT";
				break;
			case 25:
				this._coreService.isCursorHidden = !0;
				break;
			case 1048:
				this.restoreCursor();
				break;
			case 1049:
			case 47:
			case 1047:
				this._bufferService.buffers.activateNormalBuffer(), e.params[r] === 1049 && this.restoreCursor(), this._coreService.isCursorInitialized = !0, this._onRequestRefreshRows.fire(void 0), this._onRequestSyncScrollBar.fire();
				break;
			case 2004:
				this._coreService.decPrivateModes.bracketedPasteMode = !1;
				break;
			case 2026:
				this._coreService.decPrivateModes.synchronizedOutput = !1, this._onRequestRefreshRows.fire(void 0);
				break;
		}
		return !0;
	}
	requestMode(e, r) {
		let i;
		((E) => (E[E.NOT_RECOGNIZED = 0] = "NOT_RECOGNIZED", E[E.SET = 1] = "SET", E[E.RESET = 2] = "RESET", E[E.PERMANENTLY_SET = 3] = "PERMANENTLY_SET", E[E.PERMANENTLY_RESET = 4] = "PERMANENTLY_RESET"))(i ||= {});
		let s = this._coreService.decPrivateModes, { activeProtocol: a, activeEncoding: l } = this._coreMouseService, c = this._coreService, { buffers: u, cols: m } = this._bufferService, { active: o, alt: h } = u, x = this._optionsService.rawOptions, v = (R, w) => (c.triggerDataEvent(`${P.ESC}[${r ? "" : "?"}${R};${w}$y`), !0), _ = (R) => R ? 1 : 2, d = e.params[0];
		return r ? d === 2 ? v(d, 4) : d === 4 ? v(d, _(c.modes.insertMode)) : d === 12 ? v(d, 3) : d === 20 ? v(d, _(x.convertEol)) : v(d, 0) : d === 1 ? v(d, _(s.applicationCursorKeys)) : d === 3 ? v(d, x.windowOptions.setWinLines ? m === 80 ? 2 : m === 132 ? 1 : 0 : 0) : d === 6 ? v(d, _(s.origin)) : d === 7 ? v(d, _(s.wraparound)) : d === 8 ? v(d, 3) : d === 9 ? v(d, _(a === "X10")) : d === 12 ? v(d, _(x.cursorBlink)) : d === 25 ? v(d, _(!c.isCursorHidden)) : d === 45 ? v(d, _(s.reverseWraparound)) : d === 66 ? v(d, _(s.applicationKeypad)) : d === 67 ? v(d, 4) : d === 1e3 ? v(d, _(a === "VT200")) : d === 1002 ? v(d, _(a === "DRAG")) : d === 1003 ? v(d, _(a === "ANY")) : d === 1004 ? v(d, _(s.sendFocus)) : d === 1005 ? v(d, 4) : d === 1006 ? v(d, _(l === "SGR")) : d === 1015 ? v(d, 4) : d === 1016 ? v(d, _(l === "SGR_PIXELS")) : d === 1048 ? v(d, 1) : d === 47 || d === 1047 || d === 1049 ? v(d, _(o === h)) : d === 2004 ? v(d, _(s.bracketedPasteMode)) : d === 2026 ? v(d, _(s.synchronizedOutput)) : v(d, 0);
	}
	_updateAttrColor(e, r, i, s, a) {
		return r === 2 ? (e |= 50331648, e &= -16777216, e |= te.fromColorRGB([
			i,
			s,
			a
		])) : r === 5 && (e &= -50331904, e |= 33554432 | i & 255), e;
	}
	_extractColor(e, r, i) {
		let s = [
			0,
			0,
			-1,
			0,
			0,
			0
		], a = 0, l = 0;
		do {
			if (s[l + a] = e.params[r + l], e.hasSubParams(r + l)) {
				let c = e.getSubParams(r + l), u = 0;
				do
					s[1] === 5 && (a = 1), s[l + u + 1 + a] = c[u];
				while (++u < c.length && u + l + 1 + a < s.length);
				break;
			}
			if (s[1] === 5 && l + a >= 2 || s[1] === 2 && l + a >= 5) break;
			s[1] && (a = 1);
		} while (++l + r < e.length && l + a < s.length);
		for (let c = 2; c < s.length; ++c) s[c] === -1 && (s[c] = 0);
		switch (s[0]) {
			case 38:
				i.fg = this._updateAttrColor(i.fg, s[1], s[3], s[4], s[5]);
				break;
			case 48:
				i.bg = this._updateAttrColor(i.bg, s[1], s[3], s[4], s[5]);
				break;
			case 58: i.extended = i.extended.clone(), i.extended.underlineColor = this._updateAttrColor(i.extended.underlineColor, s[1], s[3], s[4], s[5]);
		}
		return l;
	}
	_processUnderline(e, r) {
		r.extended = r.extended.clone(), (!~e || e > 5) && (e = 1), r.extended.underlineStyle = e, r.fg |= 268435456, e === 0 && (r.fg &= -268435457), r.updateExtended();
	}
	_processSGR0(e) {
		e.fg = k.fg, e.bg = k.bg, e.extended = e.extended.clone(), e.extended.underlineStyle = 0, e.extended.underlineColor &= -67108864, e.updateExtended();
	}
	charAttributes(e) {
		if (e.length === 1 && e.params[0] === 0) return this._processSGR0(this._curAttrData), !0;
		let r = e.length, i, s = this._curAttrData;
		for (let a = 0; a < r; a++) i = e.params[a], i >= 30 && i <= 37 ? (s.fg &= -50331904, s.fg |= 16777216 | i - 30) : i >= 40 && i <= 47 ? (s.bg &= -50331904, s.bg |= 16777216 | i - 40) : i >= 90 && i <= 97 ? (s.fg &= -50331904, s.fg |= i - 90 | 16777224) : i >= 100 && i <= 107 ? (s.bg &= -50331904, s.bg |= i - 100 | 16777224) : i === 0 ? this._processSGR0(s) : i === 1 ? s.fg |= 134217728 : i === 3 ? s.bg |= 67108864 : i === 4 ? (s.fg |= 268435456, this._processUnderline(e.hasSubParams(a) ? e.getSubParams(a)[0] : 1, s)) : i === 5 ? s.fg |= 536870912 : i === 7 ? s.fg |= 67108864 : i === 8 ? s.fg |= 1073741824 : i === 9 ? s.fg |= 2147483648 : i === 2 ? s.bg |= 134217728 : i === 21 ? this._processUnderline(2, s) : i === 22 ? (s.fg &= -134217729, s.bg &= -134217729) : i === 23 ? s.bg &= -67108865 : i === 24 ? (s.fg &= -268435457, this._processUnderline(0, s)) : i === 25 ? s.fg &= -536870913 : i === 27 ? s.fg &= -67108865 : i === 28 ? s.fg &= -1073741825 : i === 29 ? s.fg &= 2147483647 : i === 39 ? (s.fg &= -67108864, s.fg |= k.fg & 16777215) : i === 49 ? (s.bg &= -67108864, s.bg |= k.bg & 16777215) : i === 38 || i === 48 || i === 58 ? a += this._extractColor(e, a, s) : i === 53 ? s.bg |= 1073741824 : i === 55 ? s.bg &= -1073741825 : i === 59 ? (s.extended = s.extended.clone(), s.extended.underlineColor = -1, s.updateExtended()) : i === 100 ? (s.fg &= -67108864, s.fg |= k.fg & 16777215, s.bg &= -67108864, s.bg |= k.bg & 16777215) : this._logService.debug("Unknown SGR attribute: %d.", i);
		return !0;
	}
	deviceStatus(e) {
		switch (e.params[0]) {
			case 5:
				this._coreService.triggerDataEvent(`${P.ESC}[0n`);
				break;
			case 6:
				let r = this._activeBuffer.y + 1, i = this._activeBuffer.x + 1;
				this._coreService.triggerDataEvent(`${P.ESC}[${r};${i}R`);
		}
		return !0;
	}
	deviceStatusPrivate(e) {
		switch (e.params[0]) {
			case 6:
				let r = this._activeBuffer.y + 1, i = this._activeBuffer.x + 1;
				this._coreService.triggerDataEvent(`${P.ESC}[?${r};${i}R`);
		}
		return !0;
	}
	softReset(e) {
		return this._coreService.isCursorHidden = !1, this._onRequestSyncScrollBar.fire(), this._activeBuffer.scrollTop = 0, this._activeBuffer.scrollBottom = this._bufferService.rows - 1, this._curAttrData = k.clone(), this._coreService.reset(), this._charsetService.reset(), this._activeBuffer.savedX = 0, this._activeBuffer.savedY = this._activeBuffer.ybase, this._activeBuffer.savedCurAttrData.fg = this._curAttrData.fg, this._activeBuffer.savedCurAttrData.bg = this._curAttrData.bg, this._activeBuffer.savedCharset = this._charsetService.charset, this._coreService.decPrivateModes.origin = !1, !0;
	}
	setCursorStyle(e) {
		let r = e.length === 0 ? 1 : e.params[0];
		if (r === 0) this._coreService.decPrivateModes.cursorStyle = void 0, this._coreService.decPrivateModes.cursorBlink = void 0;
		else {
			switch (r) {
				case 1:
				case 2:
					this._coreService.decPrivateModes.cursorStyle = "block";
					break;
				case 3:
				case 4:
					this._coreService.decPrivateModes.cursorStyle = "underline";
					break;
				case 5:
				case 6: this._coreService.decPrivateModes.cursorStyle = "bar";
			}
			let i = r % 2 === 1;
			this._coreService.decPrivateModes.cursorBlink = i;
		}
		return !0;
	}
	setScrollRegion(e) {
		let r = e.params[0] || 1, i;
		return (e.length < 2 || (i = e.params[1]) > this._bufferService.rows || i === 0) && (i = this._bufferService.rows), i > r && (this._activeBuffer.scrollTop = r - 1, this._activeBuffer.scrollBottom = i - 1, this._setCursor(0, 0)), !0;
	}
	windowOptions(e) {
		if (!qr(e.params[0], this._optionsService.rawOptions.windowOptions)) return !0;
		let r = e.length > 1 ? e.params[1] : 0;
		switch (e.params[0]) {
			case 14:
				r !== 2 && this._onRequestWindowsOptionsReport.fire(0);
				break;
			case 16:
				this._onRequestWindowsOptionsReport.fire(1);
				break;
			case 18:
				this._bufferService && this._coreService.triggerDataEvent(`${P.ESC}[8;${this._bufferService.rows};${this._bufferService.cols}t`);
				break;
			case 22:
				(r === 0 || r === 2) && (this._windowTitleStack.push(this._windowTitle), this._windowTitleStack.length > zr && this._windowTitleStack.shift()), (r === 0 || r === 1) && (this._iconNameStack.push(this._iconName), this._iconNameStack.length > zr && this._iconNameStack.shift());
				break;
			case 23: (r === 0 || r === 2) && this._windowTitleStack.length && this.setTitle(this._windowTitleStack.pop()), (r === 0 || r === 1) && this._iconNameStack.length && this.setIconName(this._iconNameStack.pop());
		}
		return !0;
	}
	saveCursor(e) {
		return this._activeBuffer.savedX = this._activeBuffer.x, this._activeBuffer.savedY = this._activeBuffer.ybase + this._activeBuffer.y, this._activeBuffer.savedCurAttrData.fg = this._curAttrData.fg, this._activeBuffer.savedCurAttrData.bg = this._curAttrData.bg, this._activeBuffer.savedCharset = this._charsetService.charset, !0;
	}
	restoreCursor(e) {
		return this._activeBuffer.x = this._activeBuffer.savedX || 0, this._activeBuffer.y = Math.max(this._activeBuffer.savedY - this._activeBuffer.ybase, 0), this._curAttrData.fg = this._activeBuffer.savedCurAttrData.fg, this._curAttrData.bg = this._activeBuffer.savedCurAttrData.bg, this._charsetService.charset = this._savedCharset, this._activeBuffer.savedCharset && (this._charsetService.charset = this._activeBuffer.savedCharset), this._restrictCursor(), !0;
	}
	setTitle(e) {
		return this._windowTitle = e, this._onTitleChange.fire(e), !0;
	}
	setIconName(e) {
		return this._iconName = e, !0;
	}
	setOrReportIndexedColor(e) {
		let r = [], i = e.split(";");
		for (; i.length > 1;) {
			let s = i.shift(), a = i.shift();
			if (/^\d+$/.exec(s)) {
				let l = parseInt(s);
				if (Xr(l)) if (a === "?") r.push({
					type: 0,
					index: l
				});
				else {
					let c = sr(a);
					c && r.push({
						type: 1,
						index: l,
						color: c
					});
				}
			}
		}
		return r.length && this._onColor.fire(r), !0;
	}
	setHyperlink(e) {
		let r = e.indexOf(";");
		if (r === -1) return !0;
		let i = e.slice(0, r).trim(), s = e.slice(r + 1);
		return s ? this._createHyperlink(i, s) : i.trim() ? !1 : this._finishHyperlink();
	}
	_createHyperlink(e, r) {
		this._getCurrentLinkId() && this._finishHyperlink();
		let i = e.split(":"), s, a = i.findIndex((l) => l.startsWith("id="));
		return a !== -1 && (s = i[a].slice(3) || void 0), this._curAttrData.extended = this._curAttrData.extended.clone(), this._curAttrData.extended.urlId = this._oscLinkService.registerLink({
			id: s,
			uri: r
		}), this._curAttrData.updateExtended(), !0;
	}
	_finishHyperlink() {
		return this._curAttrData.extended = this._curAttrData.extended.clone(), this._curAttrData.extended.urlId = 0, this._curAttrData.updateExtended(), !0;
	}
	_setOrReportSpecialColor(e, r) {
		let i = e.split(";");
		for (let s = 0; s < i.length && !(r >= this._specialColors.length); ++s, ++r) if (i[s] === "?") this._onColor.fire([{
			type: 0,
			index: this._specialColors[r]
		}]);
		else {
			let a = sr(i[s]);
			a && this._onColor.fire([{
				type: 1,
				index: this._specialColors[r],
				color: a
			}]);
		}
		return !0;
	}
	setOrReportFgColor(e) {
		return this._setOrReportSpecialColor(e, 0);
	}
	setOrReportBgColor(e) {
		return this._setOrReportSpecialColor(e, 1);
	}
	setOrReportCursorColor(e) {
		return this._setOrReportSpecialColor(e, 2);
	}
	restoreIndexedColor(e) {
		if (!e) return this._onColor.fire([{ type: 2 }]), !0;
		let r = [], i = e.split(";");
		for (let s = 0; s < i.length; ++s) if (/^\d+$/.exec(i[s])) {
			let a = parseInt(i[s]);
			Xr(a) && r.push({
				type: 2,
				index: a
			});
		}
		return r.length && this._onColor.fire(r), !0;
	}
	restoreFgColor(e) {
		return this._onColor.fire([{
			type: 2,
			index: 256
		}]), !0;
	}
	restoreBgColor(e) {
		return this._onColor.fire([{
			type: 2,
			index: 257
		}]), !0;
	}
	restoreCursorColor(e) {
		return this._onColor.fire([{
			type: 2,
			index: 258
		}]), !0;
	}
	nextLine() {
		return this._activeBuffer.x = 0, this.index(), !0;
	}
	keypadApplicationMode() {
		return this._logService.debug("Serial port requested application keypad."), this._coreService.decPrivateModes.applicationKeypad = !0, this._onRequestSyncScrollBar.fire(), !0;
	}
	keypadNumericMode() {
		return this._logService.debug("Switching back to normal keypad."), this._coreService.decPrivateModes.applicationKeypad = !1, this._onRequestSyncScrollBar.fire(), !0;
	}
	selectDefaultCharset() {
		return this._charsetService.setgLevel(0), this._charsetService.setgCharset(0, ee), !0;
	}
	selectCharset(e) {
		return e.length !== 2 ? (this.selectDefaultCharset(), !0) : (e[0] === "/" || this._charsetService.setgCharset(wi[e[0]], B[e[1]] || ee), !0);
	}
	index() {
		return this._restrictCursor(), this._activeBuffer.y++, this._activeBuffer.y === this._activeBuffer.scrollBottom + 1 ? (this._activeBuffer.y--, this._bufferService.scroll(this._eraseAttrData())) : this._activeBuffer.y >= this._bufferService.rows && (this._activeBuffer.y = this._bufferService.rows - 1), this._restrictCursor(), !0;
	}
	tabSet() {
		return this._activeBuffer.tabs[this._activeBuffer.x] = !0, !0;
	}
	reverseIndex() {
		if (this._restrictCursor(), this._activeBuffer.y === this._activeBuffer.scrollTop) {
			let e = this._activeBuffer.scrollBottom - this._activeBuffer.scrollTop;
			this._activeBuffer.lines.shiftElements(this._activeBuffer.ybase + this._activeBuffer.y, e, 1), this._activeBuffer.lines.set(this._activeBuffer.ybase + this._activeBuffer.y, this._activeBuffer.getBlankLine(this._eraseAttrData())), this._dirtyRowTracker.markRangeDirty(this._activeBuffer.scrollTop, this._activeBuffer.scrollBottom);
		} else this._activeBuffer.y--, this._restrictCursor();
		return !0;
	}
	fullReset() {
		return this._parser.reset(), this._onRequestReset.fire(), !0;
	}
	reset() {
		this._curAttrData = k.clone(), this._eraseAttrDataInternal = k.clone();
	}
	_eraseAttrData() {
		return this._eraseAttrDataInternal.bg &= -67108864, this._eraseAttrDataInternal.bg |= this._curAttrData.bg & 67108863, this._eraseAttrDataInternal;
	}
	setgLevel(e) {
		return this._charsetService.setgLevel(e), !0;
	}
	screenAlignmentPattern() {
		let e = new G();
		e.content = 4194373, e.fg = this._curAttrData.fg, e.bg = this._curAttrData.bg, this._setCursor(0, 0);
		for (let r = 0; r < this._bufferService.rows; ++r) {
			let i = this._activeBuffer.ybase + this._activeBuffer.y + r, s = this._activeBuffer.lines.get(i);
			s && (s.fill(e), s.isWrapped = !1);
		}
		return this._dirtyRowTracker.markAllDirty(), this._setCursor(0, 0), !0;
	}
	requestStatusString(e, r) {
		let i = (c) => (this._coreService.triggerDataEvent(`${P.ESC}${c}${P.ESC}\\`), !0), s = this._bufferService.buffer, a = this._optionsService.rawOptions;
		return i(e === "\"q" ? `P1$r${this._curAttrData.isProtected() ? 1 : 0}"q` : e === "\"p" ? "P1$r61;1\"p" : e === "r" ? `P1$r${s.scrollTop + 1};${s.scrollBottom + 1}r` : e === "m" ? "P1$r0m" : e === " q" ? `P1$r${{
			block: 2,
			underline: 4,
			bar: 6
		}[a.cursorStyle] - (a.cursorBlink ? 1 : 0)} q` : "P0$r");
	}
	markRangeDirty(e, r) {
		this._dirtyRowTracker.markRangeDirty(e, r);
	}
};
var Fe = class {
	constructor(t) {
		this._bufferService = t;
		this.clearRange();
	}
	clearRange() {
		this.start = this._bufferService.buffer.y, this.end = this._bufferService.buffer.y;
	}
	markDirty(t) {
		t < this.start ? this.start = t : t > this.end && (this.end = t);
	}
	markRangeDirty(t, e) {
		t > e && (jr = t, t = e, e = jr), t < this.start && (this.start = t), e > this.end && (this.end = e);
	}
	markAllDirty() {
		this.markRangeDirty(0, this._bufferService.rows - 1);
	}
};
Fe = K([F(0, X)], Fe);
function Xr(n) {
	return 0 <= n && n < 256;
}
var Pi = 5e7;
var Yr = 12;
var ki = 50;
var Dt = class extends A {
	constructor(e) {
		super();
		this._action = e;
		this._writeBuffer = [];
		this._callbacks = [];
		this._pendingData = 0;
		this._bufferOffset = 0;
		this._isSyncWriting = !1;
		this._syncCalls = 0;
		this._didUserInput = !1;
		this._onWriteParsed = this._register(new S());
		this.onWriteParsed = this._onWriteParsed.event;
	}
	handleUserInput() {
		this._didUserInput = !0;
	}
	writeSync(e, r) {
		if (r !== void 0 && this._syncCalls > r) {
			this._syncCalls = 0;
			return;
		}
		if (this._pendingData += e.length, this._writeBuffer.push(e), this._callbacks.push(void 0), this._syncCalls++, this._isSyncWriting) return;
		this._isSyncWriting = !0;
		let i;
		for (; i = this._writeBuffer.shift();) {
			this._action(i);
			let s = this._callbacks.shift();
			s && s();
		}
		this._pendingData = 0, this._bufferOffset = 2147483647, this._isSyncWriting = !1, this._syncCalls = 0;
	}
	write(e, r) {
		if (this._pendingData > Pi) throw new Error("write data discarded, use flow control to avoid losing data");
		if (!this._writeBuffer.length) {
			if (this._bufferOffset = 0, this._didUserInput) {
				this._didUserInput = !1, this._pendingData += e.length, this._writeBuffer.push(e), this._callbacks.push(r), this._innerWrite();
				return;
			}
			setTimeout(() => this._innerWrite());
		}
		this._pendingData += e.length, this._writeBuffer.push(e), this._callbacks.push(r);
	}
	_innerWrite(e = 0, r = !0) {
		let i = e || performance.now();
		for (; this._writeBuffer.length > this._bufferOffset;) {
			let s = this._writeBuffer[this._bufferOffset], a = this._action(s, r);
			if (a) {
				let c = (u) => performance.now() - i >= Yr ? setTimeout(() => this._innerWrite(0, u)) : this._innerWrite(i, u);
				a.catch((u) => (queueMicrotask(() => {
					throw u;
				}), Promise.resolve(!1))).then(c);
				return;
			}
			let l = this._callbacks[this._bufferOffset];
			if (l && l(), this._bufferOffset++, this._pendingData -= s.length, performance.now() - i >= Yr) break;
		}
		this._writeBuffer.length > this._bufferOffset ? (this._bufferOffset > ki && (this._writeBuffer = this._writeBuffer.slice(this._bufferOffset), this._callbacks = this._callbacks.slice(this._bufferOffset), this._bufferOffset = 0), setTimeout(() => this._innerWrite())) : (this._writeBuffer.length = 0, this._callbacks.length = 0, this._pendingData = 0, this._bufferOffset = 0), this._onWriteParsed.fire();
	}
};
var Ee = class {
	constructor(t) {
		this._bufferService = t;
		this._nextId = 1;
		this._entriesWithId = /* @__PURE__ */ new Map();
		this._dataByLinkId = /* @__PURE__ */ new Map();
	}
	registerLink(t) {
		let e = this._bufferService.buffer;
		if (t.id === void 0) {
			let c = e.addMarker(e.ybase + e.y), u = {
				data: t,
				id: this._nextId++,
				lines: [c]
			};
			return c.onDispose(() => this._removeMarkerFromLink(u, c)), this._dataByLinkId.set(u.id, u), u.id;
		}
		let r = t, i = this._getEntryIdKey(r), s = this._entriesWithId.get(i);
		if (s) return this.addLineToLink(s.id, e.ybase + e.y), s.id;
		let a = e.addMarker(e.ybase + e.y), l = {
			id: this._nextId++,
			key: this._getEntryIdKey(r),
			data: r,
			lines: [a]
		};
		return a.onDispose(() => this._removeMarkerFromLink(l, a)), this._entriesWithId.set(l.key, l), this._dataByLinkId.set(l.id, l), l.id;
	}
	addLineToLink(t, e) {
		let r = this._dataByLinkId.get(t);
		if (r && r.lines.every((i) => i.line !== e)) {
			let i = this._bufferService.buffer.addMarker(e);
			r.lines.push(i), i.onDispose(() => this._removeMarkerFromLink(r, i));
		}
	}
	getLinkData(t) {
		return this._dataByLinkId.get(t)?.data;
	}
	_getEntryIdKey(t) {
		return `${t.id};;${t.uri}`;
	}
	_removeMarkerFromLink(t, e) {
		let r = t.lines.indexOf(e);
		r !== -1 && (t.lines.splice(r, 1), t.lines.length === 0 && (t.data.id !== void 0 && this._entriesWithId.delete(t.key), this._dataByLinkId.delete(t.id)));
	}
};
Ee = K([F(0, X)], Ee);
var Qr = !1;
var At = class extends A {
	constructor(e) {
		super();
		this._windowsWrappingHeuristics = this._register(new Je());
		this._onBinary = this._register(new S());
		this.onBinary = this._onBinary.event;
		this._onData = this._register(new S());
		this.onData = this._onData.event;
		this._onLineFeed = this._register(new S());
		this.onLineFeed = this._onLineFeed.event;
		this._onResize = this._register(new S());
		this.onResize = this._onResize.event;
		this._onWriteParsed = this._register(new S());
		this.onWriteParsed = this._onWriteParsed.event;
		this._onScroll = this._register(new S());
		this._instantiationService = new ft(), this.optionsService = this._register(new It(e)), this._instantiationService.setService(Y, this.optionsService), this._bufferService = this._register(this._instantiationService.createInstance(ve)), this._instantiationService.setService(X, this._bufferService), this._logService = this._register(this._instantiationService.createInstance(_e)), this._instantiationService.setService(ht, this._logService), this.coreService = this._register(this._instantiationService.createInstance(xe)), this._instantiationService.setService(dt, this.coreService), this.coreMouseService = this._register(this._instantiationService.createInstance(Te)), this._instantiationService.setService(Dr, this.coreMouseService), this.unicodeService = this._register(this._instantiationService.createInstance(z)), this._instantiationService.setService(wr, this.unicodeService), this._charsetService = this._instantiationService.createInstance(Tt), this._instantiationService.setService(Ar, this._charsetService), this._oscLinkService = this._instantiationService.createInstance(Ee), this._instantiationService.setService(Rr, this._oscLinkService), this._inputHandler = this._register(new Ct(this._bufferService, this._charsetService, this.coreService, this._logService, this.optionsService, this._oscLinkService, this.coreMouseService, this.unicodeService)), this._register(V.forward(this._inputHandler.onLineFeed, this._onLineFeed)), this._register(this._inputHandler), this._register(V.forward(this._bufferService.onResize, this._onResize)), this._register(V.forward(this.coreService.onData, this._onData)), this._register(V.forward(this.coreService.onBinary, this._onBinary)), this._register(this.coreService.onRequestScrollToBottom(() => this.scrollToBottom(!0))), this._register(this.coreService.onUserInput(() => this._writeBuffer.handleUserInput())), this._register(this.optionsService.onMultipleOptionChange(["windowsMode", "windowsPty"], () => this._handleWindowsPtyOptionChange())), this._register(this._bufferService.onScroll(() => {
			this._onScroll.fire({ position: this._bufferService.buffer.ydisp }), this._inputHandler.markRangeDirty(this._bufferService.buffer.scrollTop, this._bufferService.buffer.scrollBottom);
		})), this._writeBuffer = this._register(new Dt((r, i) => this._inputHandler.parse(r, i))), this._register(V.forward(this._writeBuffer.onWriteParsed, this._onWriteParsed));
	}
	get onScroll() {
		return this._onScrollApi || (this._onScrollApi = this._register(new S()), this._onScroll.event((e) => {
			this._onScrollApi?.fire(e.position);
		})), this._onScrollApi.event;
	}
	get cols() {
		return this._bufferService.cols;
	}
	get rows() {
		return this._bufferService.rows;
	}
	get buffers() {
		return this._bufferService.buffers;
	}
	get options() {
		return this.optionsService.options;
	}
	set options(e) {
		for (let r in e) this.optionsService.options[r] = e[r];
	}
	write(e, r) {
		this._writeBuffer.write(e, r);
	}
	writeSync(e, r) {
		this._logService.logLevel <= 3 && !Qr && (this._logService.warn("writeSync is unreliable and will be removed soon."), Qr = !0), this._writeBuffer.writeSync(e, r);
	}
	input(e, r = !0) {
		this.coreService.triggerDataEvent(e, r);
	}
	resize(e, r) {
		isNaN(e) || isNaN(r) || (e = Math.max(e, Yt), r = Math.max(r, Qt), this._bufferService.resize(e, r));
	}
	scroll(e, r = !1) {
		this._bufferService.scroll(e, r);
	}
	scrollLines(e, r) {
		this._bufferService.scrollLines(e, r);
	}
	scrollPages(e) {
		this.scrollLines(e * (this.rows - 1));
	}
	scrollToTop() {
		this.scrollLines(-this._bufferService.buffer.ydisp);
	}
	scrollToBottom(e) {
		this.scrollLines(this._bufferService.buffer.ybase - this._bufferService.buffer.ydisp);
	}
	scrollToLine(e) {
		let r = e - this._bufferService.buffer.ydisp;
		r !== 0 && this.scrollLines(r);
	}
	registerEscHandler(e, r) {
		return this._inputHandler.registerEscHandler(e, r);
	}
	registerDcsHandler(e, r) {
		return this._inputHandler.registerDcsHandler(e, r);
	}
	registerCsiHandler(e, r) {
		return this._inputHandler.registerCsiHandler(e, r);
	}
	registerOscHandler(e, r) {
		return this._inputHandler.registerOscHandler(e, r);
	}
	_setup() {
		this._handleWindowsPtyOptionChange();
	}
	reset() {
		this._inputHandler.reset(), this._bufferService.reset(), this._charsetService.reset(), this.coreService.reset(), this.coreMouseService.reset();
	}
	_handleWindowsPtyOptionChange() {
		let e = !1, r = this.optionsService.rawOptions.windowsPty;
		r && r.buildNumber !== void 0 && r.buildNumber !== void 0 ? e = r.backend === "conpty" && r.buildNumber < 21376 : this.optionsService.rawOptions.windowsMode && (e = !0), e ? this._enableWindowsWrappingHeuristics() : this._windowsWrappingHeuristics.clear();
	}
	_enableWindowsWrappingHeuristics() {
		if (!this._windowsWrappingHeuristics.value) {
			let e = [];
			e.push(this.onLineFeed(tr.bind(null, this._bufferService))), e.push(this.registerCsiHandler({ final: "H" }, () => (tr(this._bufferService), !1))), this._windowsWrappingHeuristics.value = J(() => {
				for (let r of e) r.dispose();
			});
		}
	}
};
var Ot = class extends At {
	constructor(e = {}) {
		super(e);
		this._onBell = this._register(new S());
		this.onBell = this._onBell.event;
		this._onCursorMove = this._register(new S());
		this.onCursorMove = this._onCursorMove.event;
		this._onTitleChange = this._register(new S());
		this.onTitleChange = this._onTitleChange.event;
		this._onA11yCharEmitter = this._register(new S());
		this.onA11yChar = this._onA11yCharEmitter.event;
		this._onA11yTabEmitter = this._register(new S());
		this.onA11yTab = this._onA11yTabEmitter.event;
		this._setup(), this._register(this._inputHandler.onRequestBell(() => this.bell())), this._register(this._inputHandler.onRequestReset(() => this.reset())), this._register(V.forward(this._inputHandler.onCursorMove, this._onCursorMove)), this._register(V.forward(this._inputHandler.onTitleChange, this._onTitleChange)), this._register(V.forward(this._inputHandler.onA11yChar, this._onA11yCharEmitter)), this._register(V.forward(this._inputHandler.onA11yTab, this._onA11yTabEmitter));
	}
	get buffer() {
		return this.buffers.active;
	}
	get markers() {
		return this.buffer.markers;
	}
	addMarker(e) {
		if (this.buffer === this.buffers.normal) return this.buffer.addMarker(this.buffer.ybase + this.buffer.y + e);
	}
	bell() {
		this._onBell.fire();
	}
	input(e, r = !0) {
		this.coreService.triggerDataEvent(e, r);
	}
	resize(e, r) {
		e === this.cols && r === this.rows || super.resize(e, r);
	}
	clear() {
		if (!(this.buffer.ybase === 0 && this.buffer.y === 0)) {
			this.buffer.lines.set(0, this.buffer.lines.get(this.buffer.ybase + this.buffer.y)), this.buffer.lines.length = 1, this.buffer.ydisp = 0, this.buffer.ybase = 0, this.buffer.y = 0;
			for (let e = 1; e < this.rows; e++) this.buffer.lines.push(this.buffer.getBlankLine(k));
			this._onScroll.fire({ position: this.buffer.ydisp });
		}
	}
	reset() {
		this.options.rows = this.rows, this.options.cols = this.cols, this._setup(), super.reset();
	}
};
var Rt = class {
	constructor() {
		this._addons = [];
	}
	dispose() {
		for (let t = this._addons.length - 1; t >= 0; t--) this._addons[t].instance.dispose();
	}
	loadAddon(t, e) {
		let r = {
			instance: e,
			dispose: e.dispose,
			isDisposed: !1
		};
		this._addons.push(r), e.dispose = () => this._wrappedAddonDispose(r), e.activate(t);
	}
	_wrappedAddonDispose(t) {
		if (t.isDisposed) return;
		let e = -1;
		for (let r = 0; r < this._addons.length; r++) if (this._addons[r] === t) {
			e = r;
			break;
		}
		if (e === -1) throw new Error("Could not dispose an addon that has not been loaded");
		t.isDisposed = !0, t.dispose.apply(t.instance), this._addons.splice(e, 1);
	}
};
var Bi = ["cols", "rows"];
var Jr = class extends A {
	constructor(t) {
		super(), this._core = this._register(new Ot(t)), this._addonManager = this._register(new Rt()), this._publicOptions = { ...this._core.options };
		let e = (i) => this._core.options[i], r = (i, s) => {
			this._checkReadonlyOptions(i), this._core.options[i] = s;
		};
		for (let i in this._core.options) {
			Object.defineProperty(this._publicOptions, i, {
				get: () => this._core.options[i],
				set: (a) => {
					this._checkReadonlyOptions(i), this._core.options[i] = a;
				}
			});
			let s = {
				get: e.bind(this, i),
				set: r.bind(this, i)
			};
			Object.defineProperty(this._publicOptions, i, s);
		}
	}
	_checkReadonlyOptions(t) {
		if (Bi.includes(t)) throw new Error(`Option "${t}" can only be set in the constructor`);
	}
	_checkProposedApi() {
		if (!this._core.optionsService.options.allowProposedApi) throw new Error("You must set the allowProposedApi option to true to use proposed API");
	}
	get onBell() {
		return this._core.onBell;
	}
	get onBinary() {
		return this._core.onBinary;
	}
	get onCursorMove() {
		return this._core.onCursorMove;
	}
	get onData() {
		return this._core.onData;
	}
	get onLineFeed() {
		return this._core.onLineFeed;
	}
	get onResize() {
		return this._core.onResize;
	}
	get onScroll() {
		return this._core.onScroll;
	}
	get onTitleChange() {
		return this._core.onTitleChange;
	}
	get onWriteParsed() {
		return this._core.onWriteParsed;
	}
	get parser() {
		return this._checkProposedApi(), this._parser || (this._parser = new lt(this._core)), this._parser;
	}
	get unicode() {
		return this._checkProposedApi(), new ct(this._core);
	}
	get rows() {
		return this._core.rows;
	}
	get cols() {
		return this._core.cols;
	}
	get buffer() {
		return this._checkProposedApi(), this._buffer || (this._buffer = this._register(new at(this._core))), this._buffer;
	}
	get markers() {
		return this._checkProposedApi(), this._core.markers;
	}
	get modes() {
		let t = this._core.coreService.decPrivateModes, e = "none";
		switch (this._core.coreMouseService.activeProtocol) {
			case "X10":
				e = "x10";
				break;
			case "VT200":
				e = "vt200";
				break;
			case "DRAG":
				e = "drag";
				break;
			case "ANY": e = "any";
		}
		return {
			applicationCursorKeysMode: t.applicationCursorKeys,
			applicationKeypadMode: t.applicationKeypad,
			bracketedPasteMode: t.bracketedPasteMode,
			insertMode: this._core.coreService.modes.insertMode,
			mouseTrackingMode: e,
			originMode: t.origin,
			reverseWraparoundMode: t.reverseWraparound,
			sendFocusMode: t.sendFocus,
			synchronizedOutputMode: t.synchronizedOutput,
			wraparoundMode: t.wraparound
		};
	}
	get options() {
		return this._publicOptions;
	}
	set options(t) {
		for (let e in t) this._publicOptions[e] = t[e];
	}
	input(t, e = !0) {
		this._core.input(t, e);
	}
	resize(t, e) {
		this._verifyIntegers(t, e), this._core.resize(t, e);
	}
	registerMarker(t = 0) {
		return this._checkProposedApi(), this._verifyIntegers(t), this._core.addMarker(t);
	}
	addMarker(t) {
		return this.registerMarker(t);
	}
	dispose() {
		super.dispose();
	}
	scrollLines(t) {
		this._verifyIntegers(t), this._core.scrollLines(t);
	}
	scrollPages(t) {
		this._verifyIntegers(t), this._core.scrollPages(t);
	}
	scrollToTop() {
		this._core.scrollToTop();
	}
	scrollToBottom() {
		this._core.scrollToBottom();
	}
	scrollToLine(t) {
		this._verifyIntegers(t), this._core.scrollToLine(t);
	}
	clear() {
		this._core.clear();
	}
	write(t, e) {
		this._core.write(t, e);
	}
	writeln(t, e) {
		this._core.write(t), this._core.write(`\r
`, e);
	}
	reset() {
		this._core.reset();
	}
	loadAddon(t) {
		this._addonManager.loadAddon(this, t);
	}
	_verifyIntegers(...t) {
		for (let e of t) if (e === 1 / 0 || isNaN(e) || e % 1 !== 0) throw new Error("This API only accepts integers");
	}
};
//#endregion
//#region src/main/ptyHost/killTree.ts
/** How long a shell is given to have its tree taken down before it is killed regardless. */
var TREE_KILL_TIMEOUT_MS = 3e3;
/**
* Ends a shell and everything it started. Killing just the shell leaves a dev server, Gradle or
* Flutter it launched running on Windows, with nothing left to stop them from the app.
*
* On Windows taskkill /T has to run while the shell is still alive: it finds children by their
* parent pid, and once the shell is gone they no longer lead back to it. So the shell itself is
* only killed after taskkill finishes (or fails, or takes too long). taskkill runs detached so it
* still completes when the pty host exits right after a shutdown.
*
* Elsewhere the shell leads its own process group; hanging that up reaches the foreground job.
* `killPty` is called exactly once either way.
*/
function killShellTree(pid, killPty, platform = process.platform) {
	let done = false;
	const finish = () => {
		if (done) return;
		done = true;
		clearTimeout(timer);
		try {
			killPty();
		} catch {}
	};
	const timer = setTimeout(finish, TREE_KILL_TIMEOUT_MS);
	timer.unref?.();
	if (!Number.isInteger(pid) || pid <= 0) {
		finish();
		return;
	}
	if (platform === "win32") {
		try {
			const child = spawn("taskkill", [
				"/pid",
				String(pid),
				"/T",
				"/F"
			], {
				detached: true,
				stdio: "ignore",
				windowsHide: true
			});
			child.once("exit", finish);
			child.once("error", finish);
			child.unref();
		} catch {
			finish();
		}
		return;
	}
	try {
		process.kill(-pid, "SIGHUP");
	} catch {}
	finish();
}
//#endregion
//#region src/main/ptyHost/pasteBoost.ts
var RAISED = constants$1.priority.PRIORITY_ABOVE_NORMAL;
/** How long a paste keeps its processes raised. Nothing reports when the program has read all
* of it (a CLI holds a bracketed paste until the end marker and prints nothing meanwhile), so
* this is a generous estimate: a 200 KB paste reads in about 7 seconds once raised. */
function boostHoldMs(chars) {
	return Math.min(12e4, 1e4 + Math.ceil(chars / 1e4) * 1e3);
}
var osPriority = {
	get: (pid) => getPriority(pid),
	set: (pid, priority) => setPriority(pid, priority)
};
function createPasteBoost(options = {}) {
	const priority = options.priority ?? osPriority;
	const listHosts = options.consoleHosts ?? conhostChildren;
	const raised = /* @__PURE__ */ new Map();
	/** Sessions with a process lookup under way, and the longest hold asked for meanwhile. */
	const looking = /* @__PURE__ */ new Map();
	let hosts = null;
	let timer = null;
	function raise(pid, until) {
		const known = raised.get(pid);
		if (known) {
			known.until = Math.max(known.until, until);
			return;
		}
		try {
			const original = priority.get(pid);
			if (original <= RAISED) return;
			priority.set(pid, RAISED);
			raised.set(pid, {
				original,
				until
			});
		} catch {}
	}
	function restore(pid, entry) {
		raised.delete(pid);
		try {
			if (priority.get(pid) === RAISED) priority.set(pid, entry.original);
		} catch {}
	}
	function schedule() {
		if (timer) clearTimeout(timer);
		timer = null;
		if (raised.size === 0) return;
		const next = Math.min(...[...raised.values()].map((entry) => entry.until));
		timer = setTimeout(expire, Math.max(0, next - Date.now()));
	}
	function expire() {
		timer = null;
		const now = Date.now();
		for (const [pid, entry] of [...raised]) if (entry.until <= now) restore(pid, entry);
		schedule();
	}
	return {
		boost(sessionId, clients, chars) {
			const hold = boostHoldMs(chars);
			const pending = looking.get(sessionId);
			if (pending !== void 0) {
				looking.set(sessionId, Math.max(pending, hold));
				return;
			}
			looking.set(sessionId, hold);
			if (!hosts) {
				const lookup = listHosts().catch(() => []).then((pids) => {
					if (pids.length === 0 && hosts === lookup) hosts = null;
					return pids;
				});
				hosts = lookup;
			}
			const lookups = [hosts, clients().catch(() => [])];
			let left = lookups.length;
			for (const lookup of lookups) lookup.then((pids) => {
				const until = Date.now() + (looking.get(sessionId) ?? hold);
				for (const pid of pids) raise(pid, until);
				left -= 1;
				if (left === 0) looking.delete(sessionId);
				schedule();
			});
		},
		consolesChanged() {
			hosts = null;
		},
		dispose() {
			if (timer) clearTimeout(timer);
			timer = null;
			for (const [pid, entry] of [...raised]) restore(pid, entry);
			looking.clear();
		}
	};
}
/**
* Every process attached to a session's console: the shell and whatever it started. node-pty
* keeps the lookup it uses for `kill` private, so fall back to the shell alone without it.
*/
function consoleClients(ptyProcess) {
	const agent = ptyProcess._agent;
	if (typeof agent?._getConsoleProcessList === "function") return agent._getConsoleProcessList();
	return Promise.resolve([ptyProcess.pid]);
}
/** The conhost (or bundled OpenConsole) processes this process started for its pseudoconsoles. */
function conhostChildren() {
	const query = `Get-CimInstance Win32_Process -Filter "ParentProcessId=${process.pid} and (Name='conhost.exe' or Name='OpenConsole.exe')" | ForEach-Object { $_.ProcessId }`;
	return new Promise((resolve) => {
		execFile("powershell.exe", [
			"-NoProfile",
			"-NonInteractive",
			"-Command",
			query
		], {
			windowsHide: true,
			timeout: 2e4
		}, (error, stdout) => {
			if (error) {
				resolve([]);
				return;
			}
			resolve(stdout.split(/\s+/).map(Number).filter((pid) => Number.isInteger(pid) && pid > 0));
		});
	});
}
//#endregion
//#region src/main/ptyHost/shellIntegration.ts
/**
* Makes a freshly spawned shell report, on its own, whenever a fresh prompt is ready for input.
* The terminal renderer listens for that marker (an OSC 7750 sequence) to know it can safely take
* over the current input line, e.g. to show a pasted file as a short chip instead of its whole
* path. Each hook chains onto whatever prompt hook the shell (or the user's own dotfiles, or a
* prompt framework like Starship) already has, rather than replacing it, so a custom prompt keeps
* working exactly as it did before.
*
* The hook goes in through the shell's launch arguments or environment, never by typing it into
* the shell. Typed input gets echoed back, so the user would see the whole snippet printed at the
* top of every new terminal.
*/
var MARKER = "\\033]7750;AgentMate:PromptReady:1\\007";
function basename$1(shell) {
	return shell.toLowerCase().replace(/\\/g, "/").split("/").pop() ?? "";
}
var integrationDir = null;
/**
* A private folder (mode 0700, unique name) for the rc files bash and zsh are pointed at. A fixed
* path under a shared /tmp could be created first by another user, who would then get to run code
* in every terminal. Made again if something cleans the temp folder while the host is running.
*/
function writeIntegrationFile(name, content) {
	if (!integrationDir || !existsSync(integrationDir)) {
		integrationDir = mkdtempSync(join(tmpdir(), "agentmate-shell-"));
		const dir = integrationDir;
		process.once("exit", () => {
			try {
				rmSync(dir, {
					recursive: true,
					force: true
				});
			} catch {}
		});
	}
	const path = join(integrationDir, name);
	writeFileSync(path, content, { mode: 384 });
	return path;
}
var BASH_HOOK = `PROMPT_COMMAND="\${PROMPT_COMMAND:+$PROMPT_COMMAND$'\\n'}printf '${MARKER}'"`;
/** An interactive non-login bash reads only ~/.bashrc, so the rc file does that first. */
function bashLaunch() {
	return {
		args: ["--rcfile", writeIntegrationFile("bashrc", `if [ -f ~/.bashrc ]; then . ~/.bashrc; fi\n${BASH_HOOK}\n`)],
		env: {}
	};
}
/**
* zsh has no --rcfile, so ZDOTDIR points it at a folder whose .zshenv and .zshrc load the user's
* real ones. ZDOTDIR is swapped back to the user's value while their files run (and left there once
* .zshrc is done), so anything that reads it, including a .zshenv that moves it, sees what it
* would outside AgentMate.
*/
function zshLaunch(env) {
	writeIntegrationFile(".zshenv", [
		"__agentmate_zdotdir=$ZDOTDIR",
		"ZDOTDIR=${AGENTMATE_USER_ZDOTDIR:-$HOME}",
		"[[ -f $ZDOTDIR/.zshenv ]] && . $ZDOTDIR/.zshenv",
		"AGENTMATE_USER_ZDOTDIR=$ZDOTDIR",
		"ZDOTDIR=$__agentmate_zdotdir",
		"unset __agentmate_zdotdir",
		""
	].join("\n"));
	writeIntegrationFile(".zshrc", [
		"ZDOTDIR=$AGENTMATE_USER_ZDOTDIR",
		"unset AGENTMATE_USER_ZDOTDIR",
		"[[ -f $ZDOTDIR/.zshrc ]] && . $ZDOTDIR/.zshrc",
		"(( ${+precmd_functions} )) || typeset -ga precmd_functions",
		`agentmate_precmd() { printf '${MARKER}' }`,
		"precmd_functions+=(agentmate_precmd)",
		""
	].join("\n"));
	const userZdotdir = env?.ZDOTDIR ?? process.env.ZDOTDIR;
	return {
		args: [],
		env: {
			ZDOTDIR: integrationDir,
			...userZdotdir ? { AGENTMATE_USER_ZDOTDIR: userZdotdir } : {}
		}
	};
}
/** fish runs --init-command after its own config, right before the first prompt. */
function fishLaunch() {
	return {
		args: ["--init-command", `function __agentmate_marker --on-event fish_prompt; printf '${MARKER}'; end`],
		env: {}
	};
}
var POWERSHELL_HOOK = "$global:__agentmatePrevPrompt = $function:prompt; function prompt { Write-Host -NoNewline ([char]27 + ']7750;AgentMate:PromptReady:1' + [char]7); & $global:__agentmatePrevPrompt }";
function powershellLaunch() {
	return {
		args: [
			"-NoLogo",
			"-NoExit",
			"-Command",
			POWERSHELL_HOOK
		],
		env: {}
	};
}
/** cmd reads PROMPT from its environment. `$E` is cmd's own escape macro, expanded when the prompt
* is drawn. Terminated with ST (`$E\`) since cmd has no BEL macro. Existing `PROMPT` (the user's
* own, or cmd's `$P$G` default) is kept, just prefixed. */
function cmdLaunch(env) {
	return {
		args: [],
		env: { PROMPT: `$E]7750;AgentMate:PromptReady:1$E\\${env?.PROMPT ?? process.env.PROMPT ?? "$P$G"}` }
	};
}
/**
* How to start this shell so it emits the marker. A shell with no reliable prompt hook (plain
* `sh`) or one that isn't recognized starts as is and simply never emits it, which is a safe
* no-op: whatever depends on the marker just stays off, exactly like it does for an SSH session.
*/
function buildShellLaunch(shell, platform, env) {
	const name = basename$1(shell);
	try {
		if (name === "bash") return bashLaunch();
		if (name === "zsh") return zshLaunch(env);
	} catch {
		return {
			args: [],
			env: {}
		};
	}
	if (name === "fish") return fishLaunch();
	if (name === "powershell.exe" || name === "pwsh.exe" || name === "pwsh" || name === "powershell") return powershellLaunch();
	if (name === "cmd.exe" || name === "cmd") return cmdLaunch(env);
	if (platform === "win32" && name === "") return powershellLaunch();
	return {
		args: [],
		env: {}
	};
}
//#endregion
//#region src/main/ptyHost/shellResolve.ts
/**
* Finding a shell to spawn and a folder to start it in, without ever throwing the generic
* failure the terminal pane reports as "Could not start this terminal."
*
* macOS GUI launches are the reason this exists: an app started from the Finder inherits a
* minimal environment (a bare PATH, sometimes no SHELL at all), and a user can also point SHELL
* at something they later uninstalled or pass a project folder that has since been deleted.
* Every lookup below degrades to the next candidate instead of failing, and says what it tried
* so a bug report has something to go on. Pure and free of node-pty, so it is unit-testable.
*/
var ALLOWED_SHELLS = [
	"powershell.exe",
	"pwsh.exe",
	"cmd.exe",
	"bash",
	"zsh",
	"fish"
];
/** The fallback shells per platform, most familiar first. The requested shell leads the chain. */
function platformFallbacks(platform) {
	if (platform === "win32") return [
		"powershell.exe",
		"pwsh.exe",
		"cmd.exe"
	];
	if (platform === "darwin") return [
		"zsh",
		"bash",
		"sh"
	];
	return ["bash", "sh"];
}
/**
* The shell a new terminal runs when the renderer did not name a usable one. The SHELL variable
* is only trusted when it names a shell the app knows how to start; anything else (an exotic
* shell, an empty string from a stripped GUI environment) falls back to the platform default
* rather than being handed to the pty, which would fail to start it.
*/
function defaultShellName(platform, env = process.env) {
	if (platform === "win32") return "powershell.exe";
	const base = env.SHELL?.split("/").pop()?.trim();
	if (base && ALLOWED_SHELLS.includes(base)) return base;
	return platform === "darwin" ? "zsh" : "bash";
}
/** The shells to try in order: what was asked for, then the platform fallbacks behind it. */
function shellFallbackChain(shell, platform) {
	const chain = [shell.trim()].filter((name) => name.length > 0);
	for (const fallback of platformFallbacks(platform)) if (!chain.includes(fallback)) chain.push(fallback);
	return chain;
}
function isFile(path) {
	try {
		return statSync(path).isFile();
	} catch {
		return false;
	}
}
/** Absolute paths on Windows may use either separator; node-pty needs no normalization. */
function isExplicitPath(shell) {
	return isAbsolute(shell) || shell.includes("/") || shell.includes("\\");
}
/** Well-known folders a shell lives in even when a GUI launch left PATH bare. */
function wellKnownDirs(platform) {
	if (platform === "win32") {
		const systemRoot = process.env.SystemRoot ?? "C:\\Windows";
		return [
			join(systemRoot, "System32"),
			join(systemRoot, "System32", "WindowsPowerShell", "v1.0"),
			"C:\\Program Files\\PowerShell\\7"
		];
	}
	const dirs = [
		"/bin",
		"/usr/bin",
		"/usr/local/bin"
	];
	if (platform === "darwin") dirs.push("/opt/homebrew/bin", "/opt/local/bin");
	return dirs;
}
function pathDirs(env) {
	return (env.PATH ?? env.Path ?? "").split(delimiter).filter((dir) => dir.length > 0);
}
/**
* Where this shell would be spawned from: itself when it is an existing absolute path, the
* first PATH or well-known hit for a bare name, or null when it is not installed. A bare name
* with no hit is still returned as-is on Windows, where CreateProcess resolves more than PATH
* (App Paths, the current directory); everywhere else null means "try the next candidate".
*/
function resolveShellFile(shell, platform, env = process.env) {
	const name = shell.trim();
	if (!name) return null;
	if (isExplicitPath(name)) return isFile(name) ? name : null;
	const candidates = platform === "win32" && !name.includes(".") ? [name, `${name}.exe`] : [name];
	const dirs = [...pathDirs(env), ...wellKnownDirs(platform)];
	for (const dir of dirs) for (const candidate of candidates) {
		const full = join(dir, candidate);
		if (isFile(full)) return full;
	}
	return platform === "win32" ? name : null;
}
/**
* Picks a working (shell, folder) pair for a spawn. Never throws: when nothing resolves it
* returns the best effort with notes explaining why, and the spawn's own try/catch turns a
* remaining failure into a descriptive error instead of a blank pane.
*/
function resolveSpawnTarget(options) {
	const platform = options.platform ?? process.platform;
	const env = options.env ?? process.env;
	const notes = [];
	let shell = options.shell.trim() || defaultShellName(platform, env);
	let file = resolveShellFile(shell, platform, env);
	if (!file) {
		notes.push(`shell "${shell}" was not found, trying the platform fallbacks`);
		for (const candidate of shellFallbackChain(shell, platform).slice(1)) {
			const hit = resolveShellFile(candidate, platform, env);
			if (hit) {
				shell = candidate;
				file = hit;
				notes.push(`falling back to ${candidate}`);
				break;
			}
		}
	}
	if (!file) {
		notes.push(`no fallback shell was found, spawning "${shell}" anyway for its error`);
		file = shell;
	}
	const cwd = resolveSpawnCwd(options.cwd, env, notes);
	return {
		shell,
		file,
		cwd,
		notes
	};
}
function isDirectory(path) {
	try {
		return statSync(path).isDirectory();
	} catch {
		return false;
	}
}
/**
* The folder a shell starts in. A project folder deleted or moved since the tab was created
* must not cost the user their terminal: HOME (then the temp folder) takes over, and the
* fallback is noted for the log.
*/
function resolveSpawnCwd(cwd, env = process.env, notes = []) {
	const home = env.HOME ?? env.USERPROFILE ?? homedir();
	if (cwd && cwd.trim().length > 0) {
		if (isDirectory(cwd)) return cwd;
		notes.push(`folder "${cwd}" is gone, starting in the home folder instead`);
	}
	if (home && isDirectory(home)) return home;
	const temp = tmpdir();
	if (temp !== home) notes.push(`home folder "${home}" is unusable, starting in "${temp}" instead`);
	return temp;
}
//#endregion
//#region src/main/ptyHost/spawnHelper.ts
/**
* Keeping node-pty's macOS spawn-helper executable at runtime.
*
* node-pty starts every terminal on macOS through a small program, spawn-helper, that lives
* next to its native binding. Version 1.1.0 publishes it without the execute bit, and then
* every shell fails with the cryptic "posix_spawnp failed" no matter which shell or folder
* was asked for.
*
* The desktop package's postinstall sets the bit for local development, but that only covers
* the install it ran in. A packaged app whose copy lost the bit along the way fails at runtime
* with no hint of the cause, so the pty host checks the helper before every spawn and repairs
* it when it can (a fresh copy plus chmod, never a chmod in place, since pnpm hard links
* package files to its shared store). When the bit cannot be restored the spawn fails fast
* with the helper's path and the reason, instead of the cryptic posix_spawnp line.
*
* The same line also shows up when node-pty spawns through a helper path that does not exist.
* Stock 1.1.0 did that in every packaged pty host, because it rewrote the app.asar.unpacked path
* the host loads it from to app.asar.unpacked.unpacked. patches/node-pty@1.1.0.patch fixes that.
*
* Only macOS spawns through the helper (other platforms use forkpty or ConPTY), so everywhere
* else this is a no-op. Pure apart from the default filesystem probes, which tests inject, the
* same way resolveRipgrepPath takes its `resolve` and `exists`.
*/
function defaultExists(path) {
	try {
		statSync(path);
		return true;
	} catch {
		return false;
	}
}
function defaultIsExecutable(path) {
	try {
		accessSync(path, constants.X_OK);
		return true;
	} catch {
		return false;
	}
}
function defaultRepair(path) {
	try {
		const copy = `${path}.agentmate-tmp`;
		copyFileSync(path, copy);
		chmodSync(copy, 493);
		renameSync(copy, path);
		return defaultIsExecutable(path) ? null : "still not executable after the repair";
	} catch (error) {
		return error instanceof Error ? error.message : String(error);
	}
}
function defaultNodePtyDir() {
	try {
		return dirname(createRequire(import.meta.url).resolve("node-pty/package.json"));
	} catch {
		return null;
	}
}
/**
* The helpers node-pty could spawn through, in the order it prefers its bindings: a source
* build first, then the prebuilt one for this platform. Every existing one is checked, since
* whichever binding loads takes the helper beside it.
*/
function spawnHelperCandidates(nodePtyDir, platform, arch) {
	return [
		join(nodePtyDir, "build", "Release", "spawn-helper"),
		join(nodePtyDir, "build", "Debug", "spawn-helper"),
		join(nodePtyDir, "prebuilds", `${platform}-${arch}`, "spawn-helper")
	];
}
/**
* Makes sure a spawn-helper node-pty would use is executable, repairing the bit when it is
* missing. Never throws: the check reports, and the spawn fails fast on the report.
*/
function ensureSpawnHelper(env = {}) {
	const platform = env.platform ?? process.platform;
	if (platform !== "darwin") return {
		ok: true,
		path: "",
		detail: ""
	};
	const arch = env.arch ?? process.arch;
	const exists = env.exists ?? defaultExists;
	const isExecutable = env.isExecutable ?? defaultIsExecutable;
	const repair = env.repair ?? defaultRepair;
	const nodePtyDir = env.nodePtyDir !== void 0 ? env.nodePtyDir : defaultNodePtyDir();
	if (!nodePtyDir) return {
		ok: false,
		path: "",
		detail: "could not locate the node-pty package"
	};
	const unpackedDir = nodePtyDir.replace(/([\\/])app\.asar([\\/])/, "$1app.asar.unpacked$2");
	const candidates = [...new Set((unpackedDir === nodePtyDir ? [nodePtyDir] : [nodePtyDir, unpackedDir]).flatMap((dir) => spawnHelperCandidates(dir, platform, arch)))];
	const helpers = candidates.filter((candidate) => exists(candidate));
	if (helpers.length === 0) return {
		ok: false,
		path: "",
		detail: `no node-pty spawn-helper found (looked in ${candidates.join(", ")})`
	};
	const repaired = [];
	for (const helper of helpers) {
		if (isExecutable(helper)) continue;
		const failure = repair(helper);
		if (failure) return {
			ok: false,
			path: helper,
			detail: `node-pty spawn-helper at ${helper} is not executable and could not be repaired (${failure}); terminals cannot start until it is executable`
		};
		repaired.push(helper);
	}
	return {
		ok: true,
		path: helpers[0],
		detail: repaired.length > 0 ? `spawn-helper execute bit repaired at ${repaired.join(", ")}` : ""
	};
}
//#endregion
//#region src/main/ptyHost/sessionManager.ts
/**
* Lines of history kept per session for repainting a terminal after the app reconnects.
* Every session holds its own emulator, so this is a memory trade-off, not a UI one.
*/
var SNAPSHOT_SCROLLBACK = 3e3;
/** A shell gone sooner than this never reached a prompt, which is worth a line in the log. */
var IMMEDIATE_EXIT_MS = 1e3;
/** Same ConPTY hint the app's own terminals get, so the snapshot grows and shrinks like they do. */
var WINDOWS_PTY = process.platform === "win32" ? {
	backend: "conpty",
	buildNumber: Number(release().split(".")[2]) || void 0
} : void 0;
function shellEnv(env) {
	const result = { ...env ?? process.env };
	delete result.ELECTRON_RUN_AS_NODE;
	return result;
}
/**
* Owns the running shells. The same class backs both the background host process and the
* in-process fallback, so a terminal behaves the same whichever one ends up running it.
*/
var PtySessionManager = class {
	onSessionsChanged;
	log;
	pasteBoost;
	sessions = /* @__PURE__ */ new Map();
	constructor(onSessionsChanged = () => void 0, log = () => void 0, pasteBoost = process.platform === "win32" ? createPasteBoost() : null) {
		this.onSessionsChanged = onSessionsChanged;
		this.log = log;
		this.pasteBoost = pasteBoost;
	}
	get size() {
		return this.sessions.size;
	}
	list() {
		return [...this.sessions.values()].map((session) => ({
			sessionId: session.id,
			projectId: session.projectId,
			createdAt: session.createdAt,
			pid: session.pty.pid
		}));
	}
	async createOrAttach(payload, listener) {
		const existing = this.sessions.get(payload.sessionId);
		if (existing) return this.attach(existing, payload, listener);
		if (payload.attachOnly) return null;
		this.spawn(payload, listener);
		return {
			isNew: true,
			snapshot: null
		};
	}
	write(sessionId, data) {
		const session = this.sessions.get(sessionId);
		if (!session || session.exitCode !== null) return;
		try {
			session.pty.write(data);
		} catch {
			return;
		}
		if (data.length >= 512) this.pasteBoost?.boost(sessionId, () => consoleClients(session.pty), data.length);
	}
	resize(sessionId, cols, rows) {
		const session = this.sessions.get(sessionId);
		if (session) this.resizeSession(session, cols, rows);
	}
	kill(sessionId) {
		const session = this.sessions.get(sessionId);
		if (!session) return;
		this.sessions.delete(sessionId);
		session.listener = null;
		const { pty: shell } = session;
		killShellTree(shell.pid, () => shell.kill());
		session.emulator.dispose();
		this.pasteBoost?.consolesChanged();
		this.onSessionsChanged();
	}
	killAll() {
		for (const id of [...this.sessions.keys()]) this.kill(id);
		this.pasteBoost?.dispose();
	}
	/** Stops sending output to this listener. The shells keep running. */
	detachListener(listener) {
		for (const session of this.sessions.values()) if (session.listener === listener) session.listener = null;
	}
	spawn(options, listener) {
		const cols = options.cols ?? 80;
		const rows = options.rows ?? 24;
		const helper = ensureSpawnHelper();
		if (helper.detail) this.log(helper.detail);
		if (!helper.ok) throw new Error(helper.detail);
		const target = resolveSpawnTarget({
			shell: options.shell,
			cwd: options.cwd,
			env: options.env
		});
		for (const note of target.notes) this.log(note);
		const launch = buildShellLaunch(target.shell, process.platform, options.env);
		let ptyProcess;
		try {
			ptyProcess = pty.spawn(target.file, launch.args, {
				name: "xterm-256color",
				cols,
				rows,
				cwd: target.cwd,
				env: {
					...shellEnv(options.env),
					...launch.env
				}
			});
		} catch (error) {
			const detail = error instanceof Error ? error.message : String(error);
			this.log(`could not start ${target.shell} in ${target.cwd}: ${detail}`);
			throw new Error(`${target.shell} could not be started in ${target.cwd}: ${detail}`);
		}
		const emulator = new Jr({
			cols,
			rows,
			scrollback: SNAPSHOT_SCROLLBACK,
			allowProposedApi: true,
			windowsPty: WINDOWS_PTY
		});
		const serializer = new D();
		emulator.loadAddon(serializer);
		const session = {
			id: options.sessionId,
			pty: ptyProcess,
			emulator,
			serializer,
			cols,
			rows,
			projectId: options.projectId,
			createdAt: Date.now(),
			listener,
			attaching: [],
			exitCode: null
		};
		this.sessions.set(session.id, session);
		ptyProcess.onData((data) => {
			emulator.write(data);
			for (const pending of session.attaching) pending.held.push(data);
			session.listener?.onData(session.id, data);
		});
		ptyProcess.onExit(({ exitCode }) => {
			session.exitCode = exitCode;
			if (Date.now() - session.createdAt < IMMEDIATE_EXIT_MS) this.log(`${target.shell} exited immediately with code ${exitCode}`);
			if (session.attaching.length === 0) this.finish(session);
		});
		if (options.initialInput) ptyProcess.write(options.initialInput);
		this.pasteBoost?.consolesChanged();
		this.onSessionsChanged();
	}
	attach(session, payload, listener) {
		if (payload.cols && payload.rows) this.resizeSession(session, payload.cols, payload.rows);
		session.listener = null;
		const pending = {
			listener,
			held: []
		};
		session.attaching.push(pending);
		return new Promise((resolve) => {
			session.emulator.write("", () => {
				resolve({
					isNew: false,
					snapshot: {
						data: session.serializer.serialize({ scrollback: SNAPSHOT_SCROLLBACK }),
						cols: session.emulator.cols,
						rows: session.emulator.rows
					}
				});
				setImmediate(() => {
					const index = session.attaching.indexOf(pending);
					if (index !== -1) session.attaching.splice(index, 1);
					if (session.attaching.length > 0 || this.sessions.get(session.id) !== session) return;
					session.listener = listener;
					for (const chunk of pending.held) listener.onData(session.id, chunk);
					if (session.exitCode !== null) this.finish(session);
				});
			});
		});
	}
	resizeSession(session, cols, rows) {
		if (cols < 1 || rows < 1) return;
		if (session.cols === cols && session.rows === rows) return;
		try {
			session.pty.resize(cols, rows);
		} catch {
			return;
		}
		session.cols = cols;
		session.rows = rows;
		session.emulator.write("", () => {
			if (this.sessions.get(session.id) !== session) return;
			session.emulator.resize(cols, rows);
		});
	}
	finish(session) {
		if (this.sessions.get(session.id) !== session) return;
		this.sessions.delete(session.id);
		session.listener?.onExit(session.id, session.exitCode ?? 0);
		session.listener = null;
		session.emulator.dispose();
		this.pasteBoost?.consolesChanged();
		this.onSessionsChanged();
	}
};
//#endregion
export { encodeLine as a, createLineReader as i, ALLOWED_SHELLS as n, ptyHostPaths as o, defaultShellName as r, PtySessionManager as t };
