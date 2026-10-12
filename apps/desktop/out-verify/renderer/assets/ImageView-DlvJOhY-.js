import { Br as __toESM, Ct as Compress, F as Button, Fr as require_jsx_runtime, I as cn, Lr as require_react, Mr as ZoomOut, an as ImageIcon, jr as ZoomIn, t as SimpleTooltip } from "./tooltip-BbU-D7og.js";
import { rr as OVERLAY_SURFACE } from "./dist-BskwpHU1.js";
import { m as EmptyState } from "./pageKit-dgpHZ_9P.js";
//#region src/shared/imageFiles.ts
/**
* Which files the workspace shows as a picture instead of text, and the media type each one
* needs in a data URL. Only formats Chromium can actually paint are listed, so a .tif stays a
* plain binary file rather than opening into an empty viewer.
*/
var IMAGE_MIME_TYPES = {
	apng: "image/apng",
	avif: "image/avif",
	bmp: "image/bmp",
	gif: "image/gif",
	ico: "image/x-icon",
	jfif: "image/jpeg",
	jpeg: "image/jpeg",
	jpg: "image/jpeg",
	png: "image/png",
	svg: "image/svg+xml",
	webp: "image/webp"
};
/** The extension of a path, lowercased and without its dot. Empty for a name that has none. */
function extensionOf(path) {
	const name = path.replaceAll("\\", "/").split("/").pop() ?? "";
	const dot = name.lastIndexOf(".");
	return dot <= 0 ? "" : name.slice(dot + 1).toLowerCase();
}
/** The media type to show this path with, or null when it is not an image the viewer handles. */
function imageMimeType(path) {
	return IMAGE_MIME_TYPES[extensionOf(path)] ?? null;
}
function isImagePath(path) {
	return imageMimeType(path) !== null;
}
/** An image that is really text (SVG), so the viewer can offer to edit the source instead. */
function isTextImagePath(path) {
	return extensionOf(path) === "svg";
}
//#endregion
//#region src/renderer/src/components/editor/ImageView.tsx
var import_react = /* @__PURE__ */ __toESM(require_react());
var import_jsx_runtime = require_jsx_runtime();
/** The stops the zoom buttons walk through, the way an image editor does. */
var ZOOM_STEPS = [
	.05,
	.1,
	.25,
	.5,
	.75,
	1,
	1.5,
	2,
	3,
	4,
	6,
	8,
	12,
	16
];
var MIN_ZOOM = ZOOM_STEPS[0];
var MAX_ZOOM = ZOOM_STEPS[ZOOM_STEPS.length - 1];
/** Breathing room around an image that fits, so it never touches the edges of the pane. */
var FIT_PADDING = 24;
/** A light checkerboard, so a transparent PNG reads as transparent and not as white. */
var CHECKERBOARD = {
	backgroundImage: "repeating-conic-gradient(hsl(var(--foreground) / 0.07) 0% 25%, transparent 0% 50%)",
	backgroundSize: "16px 16px",
	backgroundPosition: "0 0"
};
function stepZoom(current, direction) {
	if (direction === 1) return ZOOM_STEPS.find((step) => step > current + .001) ?? MAX_ZOOM;
	return [...ZOOM_STEPS].reverse().find((step) => step < current - .001) ?? MIN_ZOOM;
}
function clamp(value, limit) {
	return Math.min(limit, Math.max(-limit, value));
}
/**
* An image on a checkerboard, with zoom and drag to pan. It starts fitted to the pane and stays
* that way while the pane is resized, until the zoom buttons or Ctrl+wheel pin a scale.
*/
function ImageView({ src, alt, onSize, className }) {
	const boxRef = (0, import_react.useRef)(null);
	const [box, setBox] = (0, import_react.useState)(null);
	const [natural, setNatural] = (0, import_react.useState)(null);
	/** null means "fit the pane", which is where every image starts. */
	const [zoom, setZoom] = (0, import_react.useState)(null);
	const [pan, setPan] = (0, import_react.useState)({
		x: 0,
		y: 0
	});
	const [broken, setBroken] = (0, import_react.useState)(false);
	const [dragging, setDragging] = (0, import_react.useState)(false);
	const drag = (0, import_react.useRef)(null);
	(0, import_react.useEffect)(() => {
		setNatural(null);
		setZoom(null);
		setPan({
			x: 0,
			y: 0
		});
		setBroken(false);
	}, [src]);
	(0, import_react.useEffect)(() => {
		const el = boxRef.current;
		if (!el) return;
		const observer = new ResizeObserver(([entry]) => {
			const rect = entry?.contentRect;
			if (rect) setBox({
				width: rect.width,
				height: rect.height
			});
		});
		observer.observe(el);
		return () => observer.disconnect();
	}, []);
	const fitScale = natural && box && natural.width > 0 && natural.height > 0 ? Math.min(1, Math.max(box.width - FIT_PADDING, 1) / natural.width, Math.max(box.height - FIT_PADDING, 1) / natural.height) : 1;
	const scale = zoom ?? fitScale;
	const width = natural ? natural.width * scale : 0;
	const height = natural ? natural.height * scale : 0;
	const slack = box ? {
		x: Math.max(0, (width - box.width) / 2),
		y: Math.max(0, (height - box.height) / 2)
	} : {
		x: 0,
		y: 0
	};
	const offset = {
		x: clamp(pan.x, slack.x),
		y: clamp(pan.y, slack.y)
	};
	const pannable = slack.x > 0 || slack.y > 0;
	function zoomBy(direction) {
		setZoom((current) => stepZoom(current ?? fitScale, direction));
	}
	function toggleActualSize() {
		setPan({
			x: 0,
			y: 0
		});
		setZoom((current) => current === null ? 1 : null);
	}
	return /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
		className: cn("relative flex min-h-0 flex-1 flex-col", className),
		children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
			ref: boxRef,
			style: CHECKERBOARD,
			className: cn("relative min-h-0 flex-1 overflow-hidden", pannable ? dragging ? "cursor-grabbing" : "cursor-grab" : "cursor-default"),
			onWheel: (event) => {
				if (event.ctrlKey || event.metaKey) {
					event.preventDefault();
					zoomBy(event.deltaY < 0 ? 1 : -1);
					return;
				}
				if (!pannable) return;
				event.preventDefault();
				setPan((current) => ({
					x: current.x - event.deltaX,
					y: current.y - event.deltaY
				}));
			},
			onPointerDown: (event) => {
				if (event.button !== 0 || !pannable) return;
				drag.current = {
					pointerId: event.pointerId,
					x: event.clientX,
					y: event.clientY
				};
				setDragging(true);
				event.currentTarget.setPointerCapture(event.pointerId);
			},
			onPointerMove: (event) => {
				const from = drag.current;
				if (!from || from.pointerId !== event.pointerId) return;
				const dx = event.clientX - from.x;
				const dy = event.clientY - from.y;
				drag.current = {
					pointerId: event.pointerId,
					x: event.clientX,
					y: event.clientY
				};
				setPan((current) => ({
					x: current.x + dx,
					y: current.y + dy
				}));
			},
			onPointerUp: (event) => {
				if (drag.current?.pointerId !== event.pointerId) return;
				drag.current = null;
				setDragging(false);
			},
			onPointerCancel: () => {
				drag.current = null;
				setDragging(false);
			},
			onDoubleClick: toggleActualSize,
			children: broken ? /* @__PURE__ */ (0, import_jsx_runtime.jsx)(EmptyState, {
				size: "sm",
				icon: ImageIcon,
				title: "This image could not be shown",
				description: "The file may be damaged, or saved in a format the viewer does not read.",
				className: "h-full"
			}) : /* @__PURE__ */ (0, import_jsx_runtime.jsx)("img", {
				src,
				alt,
				draggable: false,
				onLoad: (event) => {
					const size = {
						width: event.currentTarget.naturalWidth,
						height: event.currentTarget.naturalHeight
					};
					setNatural(size);
					onSize?.(size);
				},
				onError: () => setBroken(true),
				style: {
					width: natural ? `${width}px` : void 0,
					height: natural ? `${height}px` : void 0,
					transform: `translate(calc(-50% + ${offset.x}px), calc(-50% + ${offset.y}px))`,
					imageRendering: scale >= 3 ? "pixelated" : "auto"
				},
				className: "absolute left-1/2 top-1/2 max-w-none select-none"
			})
		}), natural && !broken ? /* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
			className: "pointer-events-none absolute inset-x-0 bottom-2 flex justify-center",
			children: /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
				className: cn(OVERLAY_SURFACE, "pointer-events-auto flex items-center gap-0.5 rounded-full! p-0.5"),
				children: [
					/* @__PURE__ */ (0, import_jsx_runtime.jsx)(SimpleTooltip, {
						label: "Zoom out",
						children: /* @__PURE__ */ (0, import_jsx_runtime.jsx)(Button, {
							type: "button",
							variant: "ghost",
							size: "icon-xs",
							"aria-label": "Zoom out",
							onClick: () => zoomBy(-1),
							disabled: scale <= MIN_ZOOM,
							className: "[&_svg]:size-2.5",
							children: /* @__PURE__ */ (0, import_jsx_runtime.jsx)(ZoomOut, {})
						})
					}),
					/* @__PURE__ */ (0, import_jsx_runtime.jsx)(SimpleTooltip, {
						label: zoom === null ? "Show at actual size" : "Fit to the pane",
						children: /* @__PURE__ */ (0, import_jsx_runtime.jsxs)(Button, {
							type: "button",
							variant: "ghost",
							size: "xs",
							onClick: toggleActualSize,
							className: "min-w-[3.25rem] px-1.5 tabular-nums text-muted-foreground hover:bg-foreground/[0.06] hover:text-foreground",
							children: [Math.round(scale * 100), "%"]
						})
					}),
					/* @__PURE__ */ (0, import_jsx_runtime.jsx)(SimpleTooltip, {
						label: "Zoom in",
						children: /* @__PURE__ */ (0, import_jsx_runtime.jsx)(Button, {
							type: "button",
							variant: "ghost",
							size: "icon-xs",
							"aria-label": "Zoom in",
							onClick: () => zoomBy(1),
							disabled: scale >= MAX_ZOOM,
							className: "[&_svg]:size-2.5",
							children: /* @__PURE__ */ (0, import_jsx_runtime.jsx)(ZoomIn, {})
						})
					}),
					/* @__PURE__ */ (0, import_jsx_runtime.jsx)(SimpleTooltip, {
						label: "Fit to the pane",
						children: /* @__PURE__ */ (0, import_jsx_runtime.jsx)(Button, {
							type: "button",
							variant: "ghost",
							size: "icon-xs",
							"aria-label": "Fit to the pane",
							onClick: () => {
								setZoom(null);
								setPan({
									x: 0,
									y: 0
								});
							},
							disabled: zoom === null,
							className: "[&_svg]:size-2.5",
							children: /* @__PURE__ */ (0, import_jsx_runtime.jsx)(Compress, {})
						})
					})
				]
			})
		}) : null]
	});
}
/** "1920 × 1080", for a header or a caption next to the file size. */
function formatImageSize(size) {
	return size ? `${size.width} × ${size.height}` : null;
}
//#endregion
export { isTextImagePath as i, formatImageSize as n, isImagePath as r, ImageView as t };
