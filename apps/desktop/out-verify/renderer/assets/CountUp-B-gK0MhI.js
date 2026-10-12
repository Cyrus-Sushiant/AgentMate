import { Ar as X, Bn as RefreshCw, Br as __toESM, Cr as Wand2, F as Button, Fr as require_jsx_runtime, I as cn, Ir as require_react_dom, It as FileCode, K as ArrowDown, Lr as require_react, Pr as toast, S as create, Y as ArrowUp, _ as SECTION_HEADING, ct as Check, et as Bolt, gn as Lock, gr as Undo, gt as CircleX, hr as TriangleAlert, kt as Download, lt as ChevronDown, m as FOOTER_HAIRLINE, mt as CircleInfo, or as StopCircle, pr as TerminalSquare, pt as CircleCheck, rr as Spinner, t as SimpleTooltip, tr as Sparkles, v as SECTION_WELL, vt as CloudDownload, wt as Copy, yt as CloudUpload } from "./tooltip-BbU-D7og.js";
import { _ as hasPreviousPage, g as hasNextPage, m as QueryObserver, n as useQuery, p as useQueryClient, r as useBaseQuery, t as queryKeys } from "./queryKeys-D7Kl9rJx.js";
import { u as useNavigate } from "./chunk-62JRHF6Z-B-4HXhjG.js";
import { r as Input } from "./input-yQ7bc-An.js";
import { a as DialogFooter, i as DialogDescription, n as Dialog, o as DialogHeader, r as DialogContent, s as DialogTitle, t as Label } from "./label-D49cSr88.js";
import { Ct as WP_HARD_DENY_FILES, Dt as wpMirrorPath, Ot as parseWpConnectionKey, St as WP_HARD_DENY_DIRS, Tn as targetAIForCliId, Tt as wpItemKey, an as defaultEffortFor, cn as runChoiceArgs, g as getModelPrice, in as EFFORT_LABELS, kt as wpKeyTransportSecurity, ln as runProfileForTargetAI, nr as OVERLAY_MOTION, on as recommendationFromAssessment, rr as OVERLAY_SURFACE, sn as relativeCostLevel, vn as DEFAULT_TARGET_AI, wt as WP_HARD_DENY_PREFIXES, xn as getCliDefinition } from "./dist-BskwpHU1.js";
import { n as useCliStore, w as useThemeStore } from "./cliStore-BEVHhLcE.js";
import { B as claimTerminalFocus, D as createXterm, E as attachTerminalContextMenu, F as createResizeSync, I as attachTerminalPaste, N as attachRtlRendering, O as resolveDrawerTerminalTheme, P as describeTerminalStartError, R as onFontsLoaded, T as attachFocusOnClick, V as releaseTerminalFocus, Y as findGroup, g as useWorkspaceStore, l as projectCliId, r as launchPromptTab, z as whenTerminalFontReady } from "./launch-OTu6P7aE.js";
import { $ as progress, A as SVGVisualElement, B as animateTarget, C as Skeleton, E as LayoutGroup, F as isSVGSVGElement, G as defaultOffset, I as isSVGElement, J as createGeneratorEasing, K as fillOffset, M as VisualElement, N as visualElementStore, O as MotionConfigContext, P as createBox, Q as secondsToMilliseconds, R as resolveElements, T as motion, U as motionValue, V as isMotionValue, W as isGenerator, X as isEasingArray, Y as mixNumber, Z as reverseEasing, a as SectionCard, at as useConstant, et as invariant, j as HTMLVisualElement, k as animateSingleValue, l as Notice, nt as removeItem, q as spring, tt as warning, u as Problem, w as useReducedMotion } from "./pageKit-dgpHZ_9P.js";
import { n as Textarea } from "./textarea-DVv9L3Er.js";
import { a as Root2, i as Portal, o as Trigger, r as Content2 } from "./dist-DNJYiH1d.js";
import { t as Checkbox } from "./checkbox-BFTqb7ac.js";
import { t as formatBytes } from "./format-CFqq7Rgx.js";
import { t as shortAge } from "./time-CvQnz64z.js";
import { d as siWordpress } from "./simple-icons-Dm7rcQrW.js";
import { t as CliLogo } from "./cliLogos-CoKhMURb.js";
import { i as sshErrorMessage, n as coreErrorMessage, r as sshErrorCode } from "./coreErrors-C93UH5Hm.js";
import { t as Switch } from "./switch-DmfrphOr.js";
import { n as SecretInput } from "./SshVaultUnlockDialog-D4cbT2HJ.js";
import { t as MonacoDiffEditor } from "./MonacoDiffEditor-B83KNjHv.js";
//#region ../../node_modules/.pnpm/@tanstack+query-core@5.101.4/node_modules/@tanstack/query-core/build/modern/infiniteQueryObserver.js
var InfiniteQueryObserver = class extends QueryObserver {
	constructor(client, options) {
		super(client, options);
	}
	bindMethods() {
		super.bindMethods();
		this.fetchNextPage = this.fetchNextPage.bind(this);
		this.fetchPreviousPage = this.fetchPreviousPage.bind(this);
	}
	setOptions(options) {
		options._type = "infinite";
		super.setOptions(options);
	}
	getOptimisticResult(options) {
		options._type = "infinite";
		return super.getOptimisticResult(options);
	}
	fetchNextPage(options) {
		return this.fetch({
			...options,
			meta: { fetchMore: { direction: "forward" } }
		});
	}
	fetchPreviousPage(options) {
		return this.fetch({
			...options,
			meta: { fetchMore: { direction: "backward" } }
		});
	}
	createResult(query, options) {
		const { state } = query;
		const parentResult = super.createResult(query, options);
		const { isFetching, isRefetching, isError, isRefetchError } = parentResult;
		const fetchDirection = state.fetchMeta?.fetchMore?.direction;
		const isFetchNextPageError = isError && fetchDirection === "forward";
		const isFetchingNextPage = isFetching && fetchDirection === "forward";
		const isFetchPreviousPageError = isError && fetchDirection === "backward";
		const isFetchingPreviousPage = isFetching && fetchDirection === "backward";
		return {
			...parentResult,
			fetchNextPage: this.fetchNextPage,
			fetchPreviousPage: this.fetchPreviousPage,
			hasNextPage: hasNextPage(options, state.data),
			hasPreviousPage: hasPreviousPage(options, state.data),
			isFetchNextPageError,
			isFetchingNextPage,
			isFetchPreviousPageError,
			isFetchingPreviousPage,
			isRefetchError: isRefetchError && !isFetchNextPageError && !isFetchPreviousPageError,
			isRefetching: isRefetching && !isFetchingNextPage && !isFetchingPreviousPage
		};
	}
};
//#endregion
//#region ../../node_modules/.pnpm/@tanstack+react-query@5.101.4_react@19.2.8/node_modules/@tanstack/react-query/build/modern/useInfiniteQuery.js
function useInfiniteQuery(options, queryClient) {
	return useBaseQuery(options, InfiniteQueryObserver, queryClient);
}
//#endregion
//#region ../../node_modules/.pnpm/motion-utils@13.0.0/node_modules/motion-utils/dist/es/wrap.mjs
var wrap = (min, max, v) => {
	const rangeSize = max - min;
	return ((v - min) % rangeSize + rangeSize) % rangeSize + min;
};
//#endregion
//#region ../../node_modules/.pnpm/motion-utils@13.0.0/node_modules/motion-utils/dist/es/easing/utils/get-easing-for-segment.mjs
/*#__NO_SIDE_EFFECTS__*/
function getEasingForSegment(easing, i) {
	return isEasingArray(easing) ? easing[wrap(0, easing.length, i)] : easing;
}
//#endregion
//#region ../../node_modules/.pnpm/motion-dom@13.0.0/node_modules/motion-dom/dist/es/animation/GroupAnimation.mjs
var GroupAnimation = class {
	constructor(animations) {
		this.stop = () => this.runAll("stop");
		this.animations = animations.filter(Boolean);
	}
	get finished() {
		return Promise.all(this.animations.map((animation) => animation.finished));
	}
	/**
	* TODO: Filter out cancelled or stopped animations before returning
	*/
	getAll(propName) {
		return this.animations[0][propName];
	}
	setAll(propName, newValue) {
		for (let i = 0; i < this.animations.length; i++) this.animations[i][propName] = newValue;
	}
	attachTimeline(timeline) {
		const subscriptions = this.animations.map((animation) => animation.attachTimeline(timeline));
		return () => {
			subscriptions.forEach((cancel, i) => {
				cancel && cancel();
				this.animations[i].stop();
			});
		};
	}
	get time() {
		return this.getAll("time");
	}
	set time(time) {
		this.setAll("time", time);
	}
	get speed() {
		return this.getAll("speed");
	}
	set speed(speed) {
		this.setAll("speed", speed);
	}
	get state() {
		return this.getAll("state");
	}
	get startTime() {
		return this.getAll("startTime");
	}
	get duration() {
		return getMax(this.animations, "duration");
	}
	get iterationDuration() {
		return getMax(this.animations, "iterationDuration");
	}
	runAll(methodName) {
		this.animations.forEach((controls) => controls[methodName]());
	}
	play() {
		this.runAll("play");
	}
	pause() {
		this.runAll("pause");
	}
	cancel() {
		this.runAll("cancel");
	}
	complete() {
		this.runAll("complete");
	}
};
function getMax(animations, propName) {
	let max = 0;
	for (let i = 0; i < animations.length; i++) {
		const value = animations[i][propName];
		if (value !== null && value > max) max = value;
	}
	return max;
}
//#endregion
//#region ../../node_modules/.pnpm/motion-dom@13.0.0/node_modules/motion-dom/dist/es/animation/GroupAnimationWithThen.mjs
var GroupAnimationWithThen = class extends GroupAnimation {
	then(onResolve, _onReject) {
		return this.finished.finally(onResolve).then(() => {});
	}
};
//#endregion
//#region ../../node_modules/.pnpm/motion-dom@13.0.0/node_modules/motion-dom/dist/es/render/object/ObjectVisualElement.mjs
function isObjectKey(key, object) {
	return key in object;
}
var ObjectVisualElement = class extends VisualElement {
	constructor() {
		super(...arguments);
		this.type = "object";
	}
	readValueFromInstance(instance, key) {
		if (isObjectKey(key, instance)) {
			const value = instance[key];
			if (typeof value === "string" || typeof value === "number") return value;
		}
	}
	getBaseTargetFromProps() {}
	removeValueFromRenderState(key, renderState) {
		delete renderState.output[key];
	}
	measureInstanceViewportBox() {
		return createBox();
	}
	build(renderState, latestValues) {
		Object.assign(renderState.output, latestValues);
	}
	renderInstance(instance, { output }) {
		Object.assign(instance, output);
	}
	sortInstanceNodePosition() {
		return 0;
	}
};
//#endregion
//#region ../../node_modules/.pnpm/framer-motion@13.0.0_react-_62c80f7d3a85e2ca12ba12fce94901be/node_modules/framer-motion/dist/es/utils/use-motion-value-event.mjs
var import_react = /* @__PURE__ */ __toESM(require_react(), 1);
function useMotionValueEvent(value, event, callback) {
	/**
	* useInsertionEffect will create subscriptions before any other
	* effects will run. Effects run upwards through the tree so it
	* can be that binding a useLayoutEffect higher up the tree can
	* miss changes from lower down the tree.
	*/
	(0, import_react.useInsertionEffect)(() => value.on(event, callback), [
		value,
		event,
		callback
	]);
}
//#endregion
//#region ../../node_modules/.pnpm/framer-motion@13.0.0_react-_62c80f7d3a85e2ca12ba12fce94901be/node_modules/framer-motion/dist/es/value/use-motion-value.mjs
/**
* Creates a `MotionValue` to track the state and velocity of a value.
*
* Usually, these are created automatically. For advanced use-cases, like use with `useTransform`, you can create `MotionValue`s externally and pass them into the animated component via the `style` prop.
*
* ```jsx
* export const MyComponent = () => {
*   const scale = useMotionValue(1)
*
*   return <motion.div style={{ scale }} />
* }
* ```
*
* @param initial - The initial state.
*
* @public
*/
function useMotionValue(initial) {
	const value = useConstant(() => motionValue(initial));
	/**
	* If this motion value is being used in static mode, like on
	* the Framer canvas, force components to rerender when the motion
	* value is updated.
	*/
	const { isStatic } = (0, import_react.useContext)(MotionConfigContext);
	if (isStatic) {
		const [, setLatest] = (0, import_react.useState)(initial);
		(0, import_react.useEffect)(() => value.on("change", setLatest), []);
	}
	return value;
}
//#endregion
//#region ../../node_modules/.pnpm/framer-motion@13.0.0_react-_62c80f7d3a85e2ca12ba12fce94901be/node_modules/framer-motion/dist/es/animation/utils/is-dom-keyframes.mjs
function isDOMKeyframes(keyframes) {
	return typeof keyframes === "object" && !Array.isArray(keyframes);
}
//#endregion
//#region ../../node_modules/.pnpm/framer-motion@13.0.0_react-_62c80f7d3a85e2ca12ba12fce94901be/node_modules/framer-motion/dist/es/animation/animate/resolve-subjects.mjs
function resolveSubjects(subject, keyframes, scope, selectorCache) {
	if (subject == null) return [];
	if (typeof subject === "string" && isDOMKeyframes(keyframes)) return resolveElements(subject, scope, selectorCache);
	else if (subject instanceof NodeList) return Array.from(subject);
	else if (Array.isArray(subject)) return subject.filter((s) => s != null);
	else return [subject];
}
//#endregion
//#region ../../node_modules/.pnpm/framer-motion@13.0.0_react-_62c80f7d3a85e2ca12ba12fce94901be/node_modules/framer-motion/dist/es/animation/sequence/utils/calc-repeat-duration.mjs
function calculateRepeatDuration(duration, repeat, repeatDelay) {
	return duration * (repeat + 1) + repeatDelay * repeat;
}
//#endregion
//#region ../../node_modules/.pnpm/framer-motion@13.0.0_react-_62c80f7d3a85e2ca12ba12fce94901be/node_modules/framer-motion/dist/es/animation/sequence/utils/calc-time.mjs
/**
* Given a absolute or relative time definition and current/prev time state of the sequence,
* calculate an absolute time for the next keyframes.
*/
function calcNextTime(current, next, prev, labels) {
	if (typeof next === "number") return next;
	else if (next.startsWith("-") || next.startsWith("+")) return Math.max(0, current + parseFloat(next));
	else if (next === "<") return prev;
	else if (next.startsWith("<")) return Math.max(0, prev + parseFloat(next.slice(1)));
	else return labels.get(next) ?? current;
}
//#endregion
//#region ../../node_modules/.pnpm/framer-motion@13.0.0_react-_62c80f7d3a85e2ca12ba12fce94901be/node_modules/framer-motion/dist/es/animation/sequence/utils/edit.mjs
function eraseKeyframes(sequence, startTime, endTime) {
	for (let i = 0; i < sequence.length; i++) {
		const keyframe = sequence[i];
		if (keyframe.at > startTime && keyframe.at < endTime) {
			removeItem(sequence, keyframe);
			i--;
		}
	}
}
function addKeyframes(sequence, keyframes, easing, offset, startTime, endTime) {
	/**
	* Erase every existing value between currentTime and targetTime,
	* this will essentially splice this timeline into any currently
	* defined ones.
	*/
	eraseKeyframes(sequence, startTime, endTime);
	for (let i = 0; i < keyframes.length; i++) sequence.push({
		value: keyframes[i],
		at: mixNumber(startTime, endTime, offset[i]),
		easing: /* @__PURE__ */ getEasingForSegment(easing, i)
	});
}
//#endregion
//#region ../../node_modules/.pnpm/framer-motion@13.0.0_react-_62c80f7d3a85e2ca12ba12fce94901be/node_modules/framer-motion/dist/es/animation/sequence/utils/normalize-times.mjs
/**
* Take an array of times that represent repeated keyframes. For instance
* if we have original times of [0, 0.5, 1] then our repeated times will
* be [0, 0.5, 1, 1, 1.5, 2]. Loop over the times and scale them back
* down to a 0-1 scale.
*
* `repeatDelayUnits` is the repeatDelay expressed in units of a single
* iteration's duration, so the total span equals `(repeat + 1) + repeat * repeatDelayUnits`.
*/
function normalizeTimes(times, repeat, repeatDelayUnits = 0) {
	const totalUnits = repeat + 1 + repeat * repeatDelayUnits;
	for (let i = 0; i < times.length; i++) times[i] = times[i] / totalUnits;
}
//#endregion
//#region ../../node_modules/.pnpm/framer-motion@13.0.0_react-_62c80f7d3a85e2ca12ba12fce94901be/node_modules/framer-motion/dist/es/animation/sequence/utils/sort.mjs
function compareByTime(a, b) {
	if (a.at === b.at) {
		if (a.value === null) return 1;
		if (b.value === null) return -1;
		return 0;
	} else return a.at - b.at;
}
//#endregion
//#region ../../node_modules/.pnpm/framer-motion@13.0.0_react-_62c80f7d3a85e2ca12ba12fce94901be/node_modules/framer-motion/dist/es/animation/sequence/create.mjs
var defaultSegmentEasing = "easeInOut";
var MAX_REPEAT = 20;
function createAnimationsFromSequence(sequence, { defaultTransition = {}, ...sequenceTransition } = {}, scope, generators) {
	const defaultDuration = defaultTransition.duration || .3;
	const animationDefinitions = /* @__PURE__ */ new Map();
	const sequences = /* @__PURE__ */ new Map();
	const elementCache = {};
	const timeLabels = /* @__PURE__ */ new Map();
	let prevTime = 0;
	let currentTime = 0;
	let totalDuration = 0;
	/**
	* Build the timeline by mapping over the sequence array and converting
	* the definitions into keyframes and offsets with absolute time values.
	* These will later get converted into relative offsets in a second pass.
	*/
	for (let i = 0; i < sequence.length; i++) {
		const segment = sequence[i];
		/**
		* If this is a timeline label, mark it and skip the rest of this iteration.
		*/
		if (typeof segment === "string") {
			timeLabels.set(segment, currentTime);
			continue;
		} else if (!Array.isArray(segment)) {
			timeLabels.set(segment.name, calcNextTime(currentTime, segment.at, prevTime, timeLabels));
			continue;
		}
		let [subject, keyframes, transition = {}] = segment;
		/**
		* If a relative or absolute time value has been specified we need to resolve
		* it in relation to the currentTime.
		*/
		if (transition.at !== void 0) currentTime = calcNextTime(currentTime, transition.at, prevTime, timeLabels);
		/**
		* Keep track of the maximum duration in this definition. This will be
		* applied to currentTime once the definition has been parsed.
		*/
		let maxDuration = 0;
		const resolveValueSequence = (valueKeyframes, valueTransition, valueSequence, elementIndex = 0, numSubjects = 0) => {
			const valueKeyframesAsList = keyframesAsList(valueKeyframes);
			const { delay = 0, times = defaultOffset(valueKeyframesAsList), type = defaultTransition.type || "keyframes", repeat, repeatType, repeatDelay = 0, ...remainingTransition } = valueTransition;
			let { ease = defaultTransition.ease || "easeOut", duration } = valueTransition;
			/**
			* Resolve stagger() if defined.
			*/
			const calculatedDelay = typeof delay === "function" ? delay(elementIndex, numSubjects) : delay;
			/**
			* If this animation should and can use a spring, generate a spring easing function.
			*/
			const numKeyframes = valueKeyframesAsList.length;
			const createGenerator = isGenerator(type) ? type : generators?.[type || "keyframes"];
			if (numKeyframes <= 2 && createGenerator) {
				/**
				* As we're creating an easing function from a spring,
				* ideally we want to generate it using the real distance
				* between the two keyframes. However this isn't always
				* possible - in these situations we use 0-100.
				*/
				let absoluteDelta = 100;
				if (numKeyframes === 2 && isNumberKeyframesArray(valueKeyframesAsList)) {
					const delta = valueKeyframesAsList[1] - valueKeyframesAsList[0];
					absoluteDelta = Math.abs(delta);
				}
				const springTransition = {
					...defaultTransition,
					...remainingTransition
				};
				if (duration !== void 0) springTransition.duration = secondsToMilliseconds(duration);
				const springEasing = createGeneratorEasing(springTransition, absoluteDelta, createGenerator);
				ease = springEasing.ease;
				duration = springEasing.duration;
			}
			duration ?? (duration = defaultDuration);
			const startTime = currentTime + calculatedDelay;
			/**
			* If there's only one time offset of 0, fill in a second with length 1
			*/
			if (times.length === 1 && times[0] === 0) times[1] = 1;
			/**
			* Fill out if offset if fewer offsets than keyframes
			*/
			const remainder = times.length - valueKeyframesAsList.length;
			remainder > 0 && fillOffset(times, remainder);
			/**
			* If only one value has been set, ie [1], push a null to the start of
			* the keyframe array. This will let us mark a keyframe at this point
			* that will later be hydrated with the previous value.
			*/
			valueKeyframesAsList.length === 1 && valueKeyframesAsList.unshift(null);
			/**
			* Segments can't express `repeat: Infinity` or very large
			* counts — they'd leave dead time after the segment or
			* explode the keyframe array. Ignore with a warning.
			*/
			if (repeat) warning(repeat < MAX_REPEAT, `Sequence segments can't repeat ${repeat} times — ignoring repeat option. Use a value below ${MAX_REPEAT} or apply repeat at the sequence level instead.`);
			if (repeat && repeat < MAX_REPEAT) {
				/**
				* Express repeatDelay in units of a single iteration's duration
				* so it can be added to the per-iteration time offsets below
				* before they're normalized to 0-1.
				*/
				const repeatDelayUnits = duration > 0 ? repeatDelay / duration : 0;
				duration = calculateRepeatDuration(duration, repeat, repeatDelay);
				const originalKeyframes = [...valueKeyframesAsList];
				const originalTimes = [...times];
				ease = Array.isArray(ease) ? [...ease] : [ease];
				const originalEase = [...ease];
				/**
				* For reverse/mirror, alternate iterations play the segment
				* backwards. mirror matches JSAnimation's mirroredGenerator:
				* reversed keyframes, easings unchanged. reverse matches
				* JSAnimation's iterationProgress = 1 - p: reversed
				* keyframes, easing array reversed AND each function easing
				* mapped through reverseEasing (string easings unchanged —
				* they're resolved later by the keyframes engine).
				*/
				const isFlipping = repeatType === "reverse" || repeatType === "mirror";
				let flippedKeyframes = originalKeyframes;
				let flippedEases = originalEase;
				if (isFlipping) {
					flippedKeyframes = [...originalKeyframes].reverse();
					if (repeatType === "reverse") flippedEases = [...originalEase].reverse().map((e) => typeof e === "function" ? reverseEasing(e) : e);
				}
				for (let repeatIndex = 0; repeatIndex < repeat; repeatIndex++) {
					const isFlipped = isFlipping && repeatIndex % 2 === 0;
					const iterKeyframes = isFlipped ? flippedKeyframes : originalKeyframes;
					const iterEase = isFlipped ? flippedEases : originalEase;
					const iterStartOffset = (repeatIndex + 1) * (1 + repeatDelayUnits);
					/**
					* If repeatDelay is set, hold the previous iteration's
					* final value through the delay by inserting a keyframe
					* at the moment the next iteration begins.
					*/
					if (repeatDelayUnits > 0) {
						valueKeyframesAsList.push(valueKeyframesAsList[valueKeyframesAsList.length - 1]);
						times.push(iterStartOffset);
						ease.push("linear");
					}
					valueKeyframesAsList.push(...iterKeyframes);
					for (let keyframeIndex = 0; keyframeIndex < iterKeyframes.length; keyframeIndex++) {
						times.push(originalTimes[keyframeIndex] + iterStartOffset);
						ease.push(keyframeIndex === 0 ? "linear" : /* @__PURE__ */ getEasingForSegment(iterEase, keyframeIndex - 1));
					}
				}
				normalizeTimes(times, repeat, repeatDelayUnits);
			}
			const targetTime = startTime + duration;
			/**
			* Add keyframes, mapping offsets to absolute time.
			*/
			addKeyframes(valueSequence, valueKeyframesAsList, ease, times, startTime, targetTime);
			maxDuration = Math.max(calculatedDelay + duration, maxDuration);
			totalDuration = Math.max(targetTime, totalDuration);
		};
		if (isMotionValue(subject)) {
			const subjectSequence = getSubjectSequence(subject, sequences);
			resolveValueSequence(keyframes, transition, getValueSequence("default", subjectSequence));
		} else {
			const subjects = resolveSubjects(subject, keyframes, scope, elementCache);
			const numSubjects = subjects.length;
			/**
			* For every element in this segment, process the defined values.
			*/
			for (let subjectIndex = 0; subjectIndex < numSubjects; subjectIndex++) {
				/**
				* Cast necessary, but we know these are of this type
				*/
				keyframes = keyframes;
				transition = transition;
				const thisSubject = subjects[subjectIndex];
				const subjectSequence = getSubjectSequence(thisSubject, sequences);
				for (const key in keyframes) resolveValueSequence(keyframes[key], getValueTransition(transition, key), getValueSequence(key, subjectSequence), subjectIndex, numSubjects);
			}
		}
		prevTime = currentTime;
		currentTime += maxDuration;
	}
	/**
	* For every element and value combination create a new animation.
	*/
	sequences.forEach((valueSequences, element) => {
		for (const key in valueSequences) {
			const valueSequence = valueSequences[key];
			/**
			* Arrange all the keyframes in ascending time order.
			*/
			valueSequence.sort(compareByTime);
			const keyframes = [];
			const valueOffset = [];
			const valueEasing = [];
			/**
			* For each keyframe, translate absolute times into
			* relative offsets based on the total duration of the timeline.
			*/
			for (let i = 0; i < valueSequence.length; i++) {
				const { at, value, easing } = valueSequence[i];
				keyframes.push(value);
				valueOffset.push(progress(0, totalDuration, at));
				valueEasing.push(easing || "easeOut");
			}
			/**
			* If the first keyframe doesn't land on offset: 0
			* provide one by duplicating the initial keyframe. This ensures
			* it snaps to the first keyframe when the animation starts.
			*/
			if (valueOffset[0] !== 0) {
				valueOffset.unshift(0);
				keyframes.unshift(keyframes[0]);
				valueEasing.unshift(defaultSegmentEasing);
			}
			/**
			* If the last keyframe doesn't land on offset: 1
			* provide one with a null wildcard value. This will ensure it
			* stays static until the end of the animation.
			*/
			if (valueOffset[valueOffset.length - 1] !== 1) {
				valueOffset.push(1);
				keyframes.push(null);
			}
			if (!animationDefinitions.has(element)) animationDefinitions.set(element, {
				keyframes: {},
				transition: {}
			});
			const definition = animationDefinitions.get(element);
			definition.keyframes[key] = keyframes;
			/**
			* Exclude `type` from defaultTransition since springs have been
			* converted to duration-based easing functions in resolveValueSequence.
			* Including `type: "spring"` would cause JSAnimation to error when
			* the merged keyframes array has more than 2 keyframes.
			*/
			const { type: _type, ...remainingDefaultTransition } = defaultTransition;
			definition.transition[key] = {
				...remainingDefaultTransition,
				duration: totalDuration,
				ease: valueEasing,
				times: valueOffset,
				...sequenceTransition
			};
		}
	});
	return animationDefinitions;
}
function getSubjectSequence(subject, sequences) {
	!sequences.has(subject) && sequences.set(subject, {});
	return sequences.get(subject);
}
function getValueSequence(name, sequences) {
	if (!sequences[name]) sequences[name] = [];
	return sequences[name];
}
function keyframesAsList(keyframes) {
	return Array.isArray(keyframes) ? keyframes : [keyframes];
}
function getValueTransition(transition, key) {
	return transition && transition[key] ? {
		...transition,
		...transition[key]
	} : { ...transition };
}
var isNumber = (keyframe) => typeof keyframe === "number";
var isNumberKeyframesArray = (keyframes) => keyframes.every(isNumber);
//#endregion
//#region ../../node_modules/.pnpm/framer-motion@13.0.0_react-_62c80f7d3a85e2ca12ba12fce94901be/node_modules/framer-motion/dist/es/animation/utils/create-visual-element.mjs
function createDOMVisualElement(element) {
	const options = {
		presenceContext: null,
		props: {},
		visualState: {
			renderState: {
				transform: {},
				transformOrigin: {},
				style: {},
				vars: {},
				attrs: {}
			},
			latestValues: {}
		}
	};
	const node = isSVGElement(element) && !isSVGSVGElement(element) ? new SVGVisualElement(options) : new HTMLVisualElement(options);
	node.mount(element);
	visualElementStore.set(element, node);
}
function createObjectVisualElement(subject) {
	const node = new ObjectVisualElement({
		presenceContext: null,
		props: {},
		visualState: {
			renderState: { output: {} },
			latestValues: {}
		}
	});
	node.mount(subject);
	visualElementStore.set(subject, node);
}
//#endregion
//#region ../../node_modules/.pnpm/framer-motion@13.0.0_react-_62c80f7d3a85e2ca12ba12fce94901be/node_modules/framer-motion/dist/es/animation/animate/subject.mjs
function isSingleValue(subject, keyframes) {
	return isMotionValue(subject) || typeof subject === "number" || typeof subject === "string" && !isDOMKeyframes(keyframes);
}
/**
* Implementation
*/
function animateSubject(subject, keyframes, options, scope) {
	const animations = [];
	if (isSingleValue(subject, keyframes)) animations.push(animateSingleValue(subject, isDOMKeyframes(keyframes) ? keyframes.default || keyframes : keyframes, options ? options.default || options : options));
	else {
		if (subject == null) return animations;
		const subjects = resolveSubjects(subject, keyframes, scope);
		const numSubjects = subjects.length;
		invariant(Boolean(numSubjects), "No valid elements provided.", "no-valid-elements");
		for (let i = 0; i < numSubjects; i++) {
			const thisSubject = subjects[i];
			const createVisualElement = thisSubject instanceof Element ? createDOMVisualElement : createObjectVisualElement;
			if (!visualElementStore.has(thisSubject)) createVisualElement(thisSubject);
			const visualElement = visualElementStore.get(thisSubject);
			const transition = { ...options };
			/**
			* Resolve stagger function if provided.
			*/
			if ("delay" in transition && typeof transition.delay === "function") transition.delay = transition.delay(i, numSubjects);
			animations.push(...animateTarget(visualElement, {
				...keyframes,
				transition
			}, {}));
		}
	}
	return animations;
}
//#endregion
//#region ../../node_modules/.pnpm/framer-motion@13.0.0_react-_62c80f7d3a85e2ca12ba12fce94901be/node_modules/framer-motion/dist/es/animation/animate/sequence.mjs
function animateSequence(sequence, options, scope) {
	const animations = [];
	createAnimationsFromSequence(sequence.map((segment) => {
		if (Array.isArray(segment) && typeof segment[0] === "function") {
			const callback = segment[0];
			const mv = motionValue(0);
			mv.on("change", callback);
			if (segment.length === 1) return [mv, [0, 1]];
			else if (segment.length === 2) return [
				mv,
				[0, 1],
				segment[1]
			];
			else return [
				mv,
				segment[1],
				segment[2]
			];
		}
		return segment;
	}), options, scope, { spring }).forEach(({ keyframes, transition }, subject) => {
		animations.push(...animateSubject(subject, keyframes, transition));
	});
	return animations;
}
//#endregion
//#region ../../node_modules/.pnpm/framer-motion@13.0.0_react-_62c80f7d3a85e2ca12ba12fce94901be/node_modules/framer-motion/dist/es/animation/animate/index.mjs
function isSequence(value) {
	return Array.isArray(value) && value.some(Array.isArray);
}
/**
* Creates an animation function that is optionally scoped
* to a specific element.
*/
function createScopedAnimate(options = {}) {
	const { scope, reduceMotion, skipAnimations } = options;
	/**
	* Implementation
	*/
	function scopedAnimate(subjectOrSequence, optionsOrKeyframes, options) {
		let animations = [];
		let animationOnComplete;
		const inherited = {};
		if (reduceMotion !== void 0) inherited.reduceMotion = reduceMotion;
		if (skipAnimations !== void 0) inherited.skipAnimations = skipAnimations;
		if (isSequence(subjectOrSequence)) {
			const { onComplete, ...sequenceOptions } = optionsOrKeyframes || {};
			if (typeof onComplete === "function") animationOnComplete = onComplete;
			animations = animateSequence(subjectOrSequence, {
				...inherited,
				...sequenceOptions
			}, scope);
		} else {
			const { onComplete, ...rest } = options || {};
			if (typeof onComplete === "function") animationOnComplete = onComplete;
			animations = animateSubject(subjectOrSequence, optionsOrKeyframes, {
				...inherited,
				...rest
			}, scope);
		}
		const animation = new GroupAnimationWithThen(animations);
		if (animationOnComplete) animation.finished.then(animationOnComplete);
		if (scope) {
			scope.animations.push(animation);
			animation.finished.then(() => {
				removeItem(scope.animations, animation);
			});
		}
		return animation;
	}
	return scopedAnimate;
}
var animate = createScopedAnimate();
//#endregion
//#region src/renderer/src/lib/terminal/containerConsoleAdapter.ts
/** Said in the terminal when the connection to the core changed and a new shell took over. */
var NEW_SHELL_NOTICE = "\r\n\x1B[2m(The connection to the server changed, so this is a new shell.)\x1B[0m\r\n";
var DEFAULT_SIZE = {
	cols: 80,
	rows: 24
};
/**
* A console in a container (E06 T6), behind the same shape as `window.agentmat.terminal` so
* `TerminalPane` can render it like any other session. The pane knows the session by its own id
* while the main process names the console by a subscription id that comes back from the open
* call, so this keeps the mapping, and holds on to output that arrives before that answer.
*/
function containerConsoleAdapter(serverId, containerId) {
	const deploy = window.agentmat.deployDocker;
	let paneId = null;
	let consoleId = null;
	const early = [];
	const dataListeners = /* @__PURE__ */ new Set();
	const exitListeners = /* @__PURE__ */ new Set();
	let off = null;
	const print = (data) => {
		if (!paneId) return;
		for (const listener of [...dataListeners]) listener({
			sessionId: paneId,
			data
		});
	};
	const route = (event) => {
		if (event.restarted) print(NEW_SHELL_NOTICE);
		if (event.data) print(event.data);
		if (!event.ended || !paneId) return;
		if (event.ended.error) print(`\r\n\x1b[31m${event.ended.error}\x1b[0m\r\n`);
		const exitCode = event.ended.exitCode ?? (event.ended.error ? 1 : 0);
		for (const listener of [...exitListeners]) listener({
			sessionId: paneId,
			exitCode
		});
		off?.();
		off = null;
	};
	const listen = () => {
		off ??= deploy.onConsole((event) => {
			if (consoleId === null) early.push(event);
			else if (event.subscriptionId === consoleId) route(event);
		});
	};
	return {
		create: async (options = {}) => {
			paneId = options.sessionId ?? `console-${containerId}`;
			listen();
			try {
				consoleId = await deploy.openConsole({
					serverId,
					containerId,
					columns: options.cols ?? DEFAULT_SIZE.cols,
					rows: options.rows ?? DEFAULT_SIZE.rows
				});
			} catch (error) {
				off?.();
				off = null;
				throw new Error(coreErrorMessage(error));
			}
			queueMicrotask(() => {
				for (const event of early.splice(0)) if (event.subscriptionId === consoleId) route(event);
			});
			return {
				sessionId: paneId,
				isNew: true,
				snapshot: null
			};
		},
		write: async (_sessionId, data) => {
			if (consoleId) await deploy.consoleInput(consoleId, data);
		},
		resize: async (_sessionId, cols, rows) => {
			if (consoleId) await deploy.consoleResize(consoleId, cols, rows);
		},
		kill: async (_sessionId) => {
			off?.();
			off = null;
			if (consoleId) await deploy.closeConsole(consoleId);
		},
		onData: (callback) => {
			dataListeners.add(callback);
			return () => {
				dataListeners.delete(callback);
			};
		},
		onExit: (callback) => {
			exitListeners.add(callback);
			return () => {
				exitListeners.delete(callback);
			};
		}
	};
}
//#endregion
//#region src/renderer/src/stores/hostKeyPromptStore.ts
var useHostKeyPromptStore = create(() => ({ request: null }));
function promptHostKeyTrust(status) {
	return new Promise((resolve) => {
		useHostKeyPromptStore.getState().request?.resolve(false);
		useHostKeyPromptStore.setState({ request: {
			...status,
			resolve
		} });
	});
}
function answerHostKeyPrompt(trust) {
	const { request } = useHostKeyPromptStore.getState();
	if (!request) return;
	useHostKeyPromptStore.setState({ request: null });
	request.resolve(trust);
}
//#endregion
//#region src/renderer/src/lib/ssh/hostKeyTrust.ts
/**
* Runs an SSH connect and, when the server's host key changed, lets the user decide. Only an
* explicit "trust" stores the new key, and main re-reads the key before storing it, so what gets
* trusted is the key the user was shown.
*
* Shared by every place the app connects to a saved server, so the question always looks the same.
*/
async function withHostKeyTrust(serverId, attempt) {
	try {
		return await attempt();
	} catch (error) {
		if (sshErrorCode(error) !== "host-key-changed") throw error;
		const status = await window.agentmat.ssh.hostKeyStatus(serverId);
		if (status.stored === status.presented) return attempt();
		if (!await promptHostKeyTrust(status)) throw new Error(`Not connected to ${status.nickname}: its new host key was not trusted.`);
		await window.agentmat.ssh.trustHostKey(serverId, status.presented);
		return attempt();
	}
}
//#endregion
//#region src/renderer/src/lib/terminal/sshAdapter.ts
/**
* Anything thrown in the main process's `ssh:create` handler (a real connect failure, most of
* the time) reaches here wrapped in Electron's "Error invoking remote method 'ssh:create': ..."
* boilerplate, which is not what belongs in the terminal pane's error line.
*/
function unwrapIpcError(error) {
	if (!(error instanceof Error)) return new Error(String(error));
	const message = error.message.replace(/^Error invoking remote method '[^']*':\s*/, "").replace(/^(Error|TypeError):\s*/, "").replace(/^\[ssh:[a-z-]+\]\s*/, "").trim();
	return new Error(message || error.message);
}
/**
* Wraps `window.agentmat.ssh.*` behind the same shape as `window.agentmat.terminal`, so
* `TerminalPane` can pick a client by session kind without branching through the rest of its
* effect (pending-output buffering, resize, dispose). SSH sessions never reattach in v1: there
* is no snapshot and `create` always starts a fresh connection.
*/
function sshTerminalAdapter(sshServerId) {
	return {
		create: async (options = {}) => {
			try {
				return {
					sessionId: (await withHostKeyTrust(sshServerId, () => window.agentmat.ssh.create({
						sessionId: options.sessionId,
						savedServerId: sshServerId,
						cols: options.cols,
						rows: options.rows,
						initialInput: options.initialInput
					}))).sessionId,
					isNew: true,
					snapshot: null
				};
			} catch (error) {
				throw unwrapIpcError(error);
			}
		},
		write: (sessionId, data) => window.agentmat.ssh.write(sessionId, data),
		resize: (sessionId, cols, rows) => window.agentmat.ssh.resize(sessionId, cols, rows),
		kill: (sessionId) => window.agentmat.ssh.kill(sessionId),
		onData: (callback) => window.agentmat.ssh.onData(callback),
		onExit: (callback) => window.agentmat.ssh.onExit((payload) => callback({
			sessionId: payload.sessionId,
			exitCode: payload.error ? 1 : 0
		}))
	};
}
//#endregion
//#region src/renderer/src/components/terminal/TerminalPane.tsx
var import_jsx_runtime = require_jsx_runtime();
function TerminalPane({ meta, active, onExit }) {
	const paneRef = (0, import_react.useRef)(null);
	const containerRef = (0, import_react.useRef)(null);
	const termRef = (0, import_react.useRef)(null);
	const onExitRef = (0, import_react.useRef)(onExit);
	onExitRef.current = onExit;
	(0, import_react.useEffect)(() => {
		const container = containerRef.current;
		if (!container) return;
		let ptySessionId = null;
		let disposed = false;
		const remote = meta.kind === "ssh" || meta.kind === "container";
		const client = meta.kind === "container" && meta.container ? containerConsoleAdapter(meta.container.serverId, meta.container.containerId) : meta.kind === "ssh" && meta.sshServerId ? sshTerminalAdapter(meta.sshServerId) : window.agentmat.terminal;
		const initialTheme = resolveDrawerTerminalTheme(useThemeStore.getState().theme);
		paneRef.current?.style.setProperty("--terminal-bg", initialTheme.background);
		const { term, fit: fitAddon, chipMode, imagePreview } = createXterm({
			sessionId: () => ptySessionId,
			write: (id, data) => void client.write(id, data),
			theme: initialTheme,
			chipPasteMode: !remote,
			shell: () => meta.shell,
			localPty: !remote
		});
		termRef.current = term;
		const unsubscribeTheme = useThemeStore.subscribe((state) => {
			const theme = resolveDrawerTerminalTheme(state.theme);
			term.options.theme = theme;
			paneRef.current?.style.setProperty("--terminal-bg", theme.background);
		});
		const hasSize = () => container.clientWidth > 0 && container.clientHeight > 0;
		const resizeSync = createResizeSync({
			term,
			fit: fitAddon,
			canFit: () => hasSize() && term.element !== void 0,
			resizePty: (cols, rows) => {
				if (ptySessionId) client.resize(ptySessionId, cols, rows);
			}
		});
		const resizeObserver = new ResizeObserver(() => resizeSync.schedule());
		resizeObserver.observe(container);
		const stopFontWatch = onFontsLoaded(() => resizeSync.schedule());
		const detachFocusOnClick = attachFocusOnClick(paneRef.current ?? container, term);
		let detachRtl = () => void 0;
		const detachContextMenu = attachTerminalContextMenu(container, term, () => ptySessionId, () => meta.shell, chipMode);
		const detachFilePaste = attachTerminalPaste(container, {
			chipMode,
			paste: (text) => term.paste(text),
			shell: () => meta.shell
		});
		const sessionId = meta.id;
		let pending = [];
		let exited = false;
		const unsubscribeData = client.onData((payload) => {
			if (payload.sessionId !== sessionId) return;
			if (pending) pending.push(payload.data);
			else term.write(payload.data);
		});
		const unsubscribeExit = client.onExit((payload) => {
			if (payload.sessionId !== sessionId) return;
			if (pending) exited = true;
			else onExitRef.current();
		});
		whenTerminalFontReady().then(() => {
			if (disposed) throw new Error("disposed");
			term.open(container);
			detachRtl = attachRtlRendering(term);
			if (hasSize()) fitAddon.fit();
		}).then(() => client.create({
			sessionId,
			attachOnly: meta.restored,
			cwd: meta.cwd,
			shell: meta.shell,
			initialInput: meta.initialInput,
			projectId: meta.projectId,
			...hasSize() ? {
				cols: term.cols,
				rows: term.rows
			} : {}
		})).then((result) => {
			if (disposed) return;
			if (!result) {
				onExitRef.current();
				return;
			}
			const release = (fromSnapshot) => {
				if (disposed) return;
				ptySessionId = result.sessionId;
				const buffered = pending ?? [];
				pending = null;
				for (const chunk of buffered) term.write(chunk);
				if (exited) {
					onExitRef.current();
					return;
				}
				if (fromSnapshot && !remote && window.agentmat.platform === "win32") resizeSync.repaint();
				else resizeSync.flush();
			};
			const { snapshot } = result;
			if (!snapshot) {
				release(false);
				return;
			}
			if (snapshot.cols !== term.cols || snapshot.rows !== term.rows) term.resize(snapshot.cols, snapshot.rows);
			term.write(snapshot.data, () => release(true));
		}).catch((error) => {
			if (disposed) return;
			const message = remote && error instanceof Error && error.message ? error.message : describeTerminalStartError(error);
			term.write(`\r\n\x1b[31m${message}\x1b[0m\r\n`);
		});
		return () => {
			disposed = true;
			resizeObserver.disconnect();
			resizeSync.dispose();
			stopFontWatch();
			detachContextMenu();
			detachFilePaste();
			detachFocusOnClick();
			detachRtl();
			chipMode?.dispose();
			imagePreview.dispose();
			unsubscribeTheme();
			unsubscribeData();
			unsubscribeExit();
			if (meta.kind === "container" && ptySessionId) client.kill(ptySessionId);
			term.dispose();
			termRef.current = null;
		};
	}, []);
	(0, import_react.useEffect)(() => {
		const pane = paneRef.current;
		if (!active || !pane) return;
		claimTerminalFocus({
			element: pane,
			canFocus: () => termRef.current?.element !== void 0 && pane.clientWidth > 0,
			focus: () => termRef.current?.focus()
		});
		return () => releaseTerminalFocus(pane);
	}, [active]);
	return /* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
		ref: paneRef,
		className: active ? "terminal-pane absolute inset-0" : "hidden",
		children: /* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
			ref: containerRef,
			className: "h-full w-full overflow-hidden"
		})
	});
}
//#endregion
//#region src/renderer/src/stores/promptJobsStore.ts
var EMPTY_RUN_JOB = {
	status: "idle",
	analysis: null,
	error: null,
	override: null,
	requestId: null
};
function projectPromptJobKey(projectId) {
	return `project:${projectId}`;
}
var usePromptJobsStore = create()((set) => ({
	tasks: {},
	runs: {},
	visible: {},
	setTask: (key, task) => set((state) => ({ tasks: {
		...state.tasks,
		[key]: task ?? void 0
	} })),
	setVisible: (key, visible) => set((state) => ({ visible: {
		...state.visible,
		[key]: visible
	} })),
	patchRun: (key, patch) => set((state) => ({ runs: {
		...state.runs,
		[key]: {
			...EMPTY_RUN_JOB,
			...state.runs[key],
			...patch
		}
	} }))
}));
function getRun(key) {
	return usePromptJobsStore.getState().runs[key] ?? EMPTY_RUN_JOB;
}
/** Marks `kind` as running for `key` and returns the task, or null when something already runs. */
function beginPromptTask(key, kind, requestId) {
	const { tasks, setTask } = usePromptJobsStore.getState();
	if (tasks[key]) return null;
	const task = {
		kind,
		id: crypto.randomUUID(),
		requestId
	};
	setTask(key, task);
	return task;
}
/** True while `task` is still the one registered for `key` (not cleared or replaced). */
function isCurrentPromptTask(key, task) {
	return usePromptJobsStore.getState().tasks[key]?.id === task.id;
}
function finishPromptTask(key, task) {
	if (isCurrentPromptTask(key, task)) usePromptJobsStore.getState().setTask(key, null);
}
/** Drops whatever runs for `key` so its result is discarded, aborting the request if it can. */
function cancelPromptTask(key) {
	const task = usePromptJobsStore.getState().tasks[key];
	if (!task) return;
	usePromptJobsStore.getState().setTask(key, null);
	if (!task.requestId) return;
	if (task.kind === "translate") window.agentmat.translate.cancel(task.requestId);
	else window.agentmat.ai.cancel(task.requestId);
}
/** Sizes `prompt` with the default AI CLI, replacing any sizing already running for `key`. */
function startRunAssessment(key, input) {
	const prompt = input.prompt.trim();
	if (!prompt) return;
	const { patchRun } = usePromptJobsStore.getState();
	const previous = getRun(key).requestId;
	if (previous) window.agentmat.ai.cancelAssessRun(previous);
	const requestId = crypto.randomUUID();
	const target = input.targetAI;
	patchRun(key, {
		status: "analyzing",
		error: null,
		requestId
	});
	const isCurrent = () => getRun(key).requestId === requestId;
	window.agentmat.ai.assessRun({
		prompt,
		targetAI: target,
		promptType: input.promptType,
		requestId
	}).then((result) => {
		if (!isCurrent()) return;
		if (result.ok && result.assessment) {
			patchRun(key, {
				analysis: {
					recommendation: recommendationFromAssessment(target, result.assessment),
					prompt,
					cliName: result.cliName
				},
				override: null,
				status: "ready",
				requestId: null
			});
			return;
		}
		if (result.cancelled) {
			patchRun(key, {
				status: "idle",
				requestId: null
			});
			return;
		}
		patchRun(key, {
			error: result.error || "The AI CLI could not size this prompt.",
			status: "error",
			requestId: null
		});
	}).catch((err) => {
		if (!isCurrent()) return;
		patchRun(key, {
			error: err instanceof Error ? err.message : "The AI CLI could not size this prompt.",
			status: "error",
			requestId: null
		});
	});
}
function cancelRunAssessment(key) {
	const { requestId, status } = getRun(key);
	if (!requestId) return;
	window.agentmat.ai.cancelAssessRun(requestId);
	usePromptJobsStore.getState().patchRun(key, {
		requestId: null,
		status: status === "analyzing" ? "idle" : status
	});
}
//#endregion
//#region src/renderer/src/components/promptBuilder/RunRecommendation.tsx
/**
* Sizes the generated prompt with the default AI CLI and keeps the resulting model/effort
* suggestion. Nothing runs on its own: callers trigger analyze() once Generate or Translate
* has produced text, or the user asks for it from the panel.
*
* The run and its result live in the prompt jobs store under `jobKey`, so closing the form or
* leaving the page doesn't stop a sizing that's already running.
*/
function useRunRecommendation(input) {
	const { jobKey, generated, promptType, targetAI } = input;
	const defaultCliId = useCliStore((s) => s.defaultCliId);
	const { status, analysis, error, override } = usePromptJobsStore((s) => s.runs[jobKey] ?? EMPTY_RUN_JOB);
	const patchRun = usePromptJobsStore((s) => s.patchRun);
	const setOverride = (next) => patchRun(jobKey, { override: next });
	const cancel = (0, import_react.useCallback)(() => cancelRunAssessment(jobKey), [jobKey]);
	const analyze = (0, import_react.useCallback)((options = {}) => startRunAssessment(jobKey, {
		prompt: options.prompt ?? generated,
		targetAI,
		promptType: options.isTranslation ? void 0 : promptType
	}), [
		jobKey,
		generated,
		promptType,
		targetAI
	]);
	const recommendation = analysis?.recommendation ?? null;
	const overrideModel = override ? recommendation?.profile.models.find((m) => m.id === override.modelId) : void 0;
	const choice = recommendation ? overrideModel ? {
		model: overrideModel,
		effort: override?.effort && overrideModel.efforts?.includes(override.effort) ? override.effort : defaultEffortFor(overrideModel)
	} : recommendation.recommended : null;
	const isCustom = !!recommendation && !!choice && (choice.model.id !== recommendation.recommended.model.id || choice.effort !== recommendation.recommended.effort);
	const isStale = !!analysis && (analysis.prompt !== generated.trim() || analysis.recommendation.targetAI !== targetAI);
	const defaultCliName = defaultCliId ? getCliDefinition(defaultCliId)?.name ?? null : null;
	return {
		status,
		targetAI,
		recommendation,
		choice,
		isCustom,
		isStale,
		error,
		cliName: analysis?.cliName ?? defaultCliName,
		canAnalyze: generated.trim().length > 0,
		analyze,
		cancel,
		selectModel: (modelId) => {
			const model = recommendation?.profile.models.find((m) => m.id === modelId);
			if (!model || !recommendation) return;
			const effort = modelId === recommendation.recommended.model.id ? recommendation.recommended.effort : defaultEffortFor(model);
			setOverride({
				modelId,
				effort
			});
		},
		selectEffort: (effort) => {
			if (choice) setOverride({
				modelId: choice.model.id,
				effort
			});
		},
		reset: () => setOverride(null),
		args: recommendation && choice && !isStale ? runChoiceArgs(recommendation.profile, choice) : []
	};
}
var COMPLEXITY_COPY = {
	light: {
		label: "Light task",
		className: "text-success"
	},
	moderate: {
		label: "Moderate task",
		className: "text-warning"
	},
	complex: {
		label: "Complex task",
		className: "text-destructive"
	}
};
var COST_COPY = [
	"Lowest cost",
	"Low cost",
	"Moderate cost",
	"High cost",
	"Highest cost"
];
function costTone(level) {
	if (level <= 2) return "bg-success";
	if (level === 3) return "bg-warning";
	return "bg-destructive";
}
function CostMeter({ level, className }) {
	return /* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {
		className: cn("inline-flex items-end gap-[2px]", className),
		"aria-hidden": true,
		children: [
			1,
			2,
			3,
			4,
			5
		].map((i) => /* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {
			className: cn("w-[3px] rounded-sm transition-colors", i <= level ? costTone(level) : "bg-foreground/15"),
			style: { height: `${4 + i * 2}px` }
		}, i))
	});
}
function formatPrice(value) {
	return `$${Number.isInteger(value) ? value : value.toFixed(2)}`;
}
var sectionLabelClass = "text-[11px] font-medium uppercase tracking-wide text-muted-foreground";
var quietButtonClass = "inline-flex items-center gap-1 rounded px-1 text-[11px] text-muted-foreground transition-colors hover:text-foreground focus:outline-none focus-visible:ring-2 focus-visible:ring-ring";
function readCollapsed(storageKey) {
	if (!storageKey) return false;
	try {
		return localStorage.getItem(storageKey) === "1";
	} catch {
		return false;
	}
}
function RunRecommendationPanel({ state, className, collapsibleKey }) {
	const { status, recommendation, targetAI, cliName, canAnalyze, isStale, choice } = state;
	const [collapsed, setCollapsed] = (0, import_react.useState)(() => readCollapsed(collapsibleKey));
	function toggleCollapsed() {
		setCollapsed((current) => {
			const next = !current;
			try {
				if (collapsibleKey) localStorage.setItem(collapsibleKey, next ? "1" : "0");
			} catch {}
			return next;
		});
	}
	const profile = recommendation?.profile ?? runProfileForTargetAI(targetAI);
	const cliLabel = cliName ?? "your default AI CLI";
	const analyzing = status === "analyzing";
	const complexity = recommendation ? COMPLEXITY_COPY[recommendation.assessment.complexity] : null;
	let subtitle;
	if (analyzing) subtitle = `Sizing the generated prompt with ${cliLabel}…`;
	else if (recommendation && collapsed && choice) subtitle = [
		choice.model.label,
		choice.effort && `${EFFORT_LABELS[choice.effort]} effort`,
		isStale && "prompt changed since"
	].filter(Boolean).join(" · ");
	else if (recommendation) subtitle = `Sized by ${cliLabel} for ${recommendation.targetAI}`;
	else if (status === "error" && collapsed) subtitle = "Sizing failed. Expand to retry.";
	else subtitle = `Model and effort for ${targetAI}, sized by ${cliLabel}`;
	return /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
		className: cn("space-y-3", className),
		children: [/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
			className: "flex items-center justify-between gap-3",
			children: [
				/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
					className: "flex min-w-0 items-center gap-2",
					children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {
						className: "flex h-7 w-7 shrink-0 items-center justify-center rounded-md border border-border bg-background/60",
						children: profile.cliId ? /* @__PURE__ */ (0, import_jsx_runtime.jsx)(CliLogo, {
							cliId: profile.cliId,
							className: "h-3.5 w-3.5"
						}) : /* @__PURE__ */ (0, import_jsx_runtime.jsx)(Bolt, { className: "h-3.5 w-3.5 text-primary" })
					}), /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
						className: "min-w-0",
						children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
							className: "text-sm font-medium leading-tight",
							children: "Recommended run"
						}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
							className: "truncate text-[11px] text-muted-foreground",
							children: subtitle
						})]
					})]
				}),
				analyzing ? /* @__PURE__ */ (0, import_jsx_runtime.jsxs)(Button, {
					variant: "ghost",
					size: "sm",
					className: "shrink-0 gap-1.5 px-2",
					onClick: state.cancel,
					children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)(StopCircle, { className: "h-3 w-3" }), " Stop"]
				}) : recommendation && complexity ? /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
					className: "flex shrink-0 items-start gap-2",
					children: [/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
						className: "flex flex-col items-end gap-1",
						children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {
							className: cn("text-[11px] font-medium", complexity.className),
							children: complexity.label
						}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {
							className: "h-1 w-20 overflow-hidden rounded-full bg-foreground/10",
							role: "meter",
							"aria-label": "Task complexity",
							"aria-valuemin": 0,
							"aria-valuemax": 100,
							"aria-valuenow": recommendation.assessment.score,
							children: /* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {
								className: "block h-full rounded-full bg-gradient-to-r from-success via-warning to-destructive transition-[width] duration-300",
								style: { width: `${Math.max(6, recommendation.assessment.score)}%` }
							})
						})]
					}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)(SimpleTooltip, {
						label: canAnalyze ? "Size the prompt again" : "Nothing to size",
						children: /* @__PURE__ */ (0, import_jsx_runtime.jsxs)(Button, {
							type: "button",
							variant: "ghost",
							size: "icon-xs",
							disabled: !canAnalyze,
							onClick: () => state.analyze(),
							className: "disabled:opacity-40",
							children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)(RefreshCw, { className: "h-3 w-3" }), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {
								className: "sr-only",
								children: "Size the prompt again"
							})]
						})
					})]
				}) : null,
				collapsibleKey && /* @__PURE__ */ (0, import_jsx_runtime.jsx)(SimpleTooltip, {
					label: collapsed ? "Show details" : "Hide details",
					children: /* @__PURE__ */ (0, import_jsx_runtime.jsxs)(Button, {
						type: "button",
						variant: "ghost",
						size: "icon-xs",
						"aria-expanded": !collapsed,
						onClick: toggleCollapsed,
						className: "shrink-0",
						children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)(ChevronDown, { className: cn("h-3 w-3 transition-transform", !collapsed && "rotate-180") }), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {
							className: "sr-only",
							children: collapsed ? "Show details" : "Hide details"
						})]
					})
				})
			]
		}), collapsed ? null : analyzing ? /* @__PURE__ */ (0, import_jsx_runtime.jsx)(RunSkeleton, { columns: profile.models.length }) : status === "error" && !recommendation ? /* @__PURE__ */ (0, import_jsx_runtime.jsx)(RunError$1, { state }) : recommendation ? /* @__PURE__ */ (0, import_jsx_runtime.jsxs)(import_jsx_runtime.Fragment, { children: [
			status === "error" && /* @__PURE__ */ (0, import_jsx_runtime.jsx)(RunError$1, {
				state,
				compact: true
			}),
			isStale && status !== "error" && /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
				className: "flex items-center justify-between gap-2 rounded-lg border border-warning/30 bg-warning/10 px-2 py-1.5 text-[11px] text-warning",
				children: [/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("span", {
					className: "flex min-w-0 items-center gap-1.5",
					children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)(TriangleAlert, { className: "h-3 w-3 shrink-0" }), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {
						className: "truncate",
						children: recommendation.targetAI !== targetAI ? `Target changed to ${targetAI} since this was sized.` : "The generated prompt changed since this was sized."
					})]
				}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("button", {
					type: "button",
					disabled: !canAnalyze,
					onClick: () => state.analyze(),
					className: "shrink-0 rounded px-1 font-medium underline-offset-2 hover:underline disabled:opacity-50",
					children: "Size again"
				})]
			}),
			/* @__PURE__ */ (0, import_jsx_runtime.jsx)(RunResult, {
				state,
				recommendation
			})
		] }) : /* @__PURE__ */ (0, import_jsx_runtime.jsx)(RunEmpty, { state })]
	});
}
function RunEmpty({ state }) {
	const cliLabel = state.cliName ?? "your default AI CLI";
	return /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
		className: "flex flex-col items-center gap-2 rounded-lg border border-dashed border-border px-3 py-4 text-center",
		children: [
			/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Sparkles, { className: "h-4 w-4 text-primary" }),
			/* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
				className: "max-w-xs text-[11px] leading-relaxed text-muted-foreground",
				children: state.canAnalyze ? `Ask ${cliLabel} how big this prompt is and which model and effort will do it without overspending.` : `Generate or translate a prompt first. ${cliLabel[0]?.toUpperCase()}${cliLabel.slice(1)} then sizes it and suggests a model and effort.`
			}),
			/* @__PURE__ */ (0, import_jsx_runtime.jsxs)(Button, {
				size: "sm",
				variant: "soft",
				className: "gap-1.5 px-2.5",
				disabled: !state.canAnalyze,
				onClick: () => state.analyze(),
				children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Bolt, { className: "h-3 w-3" }), " Size this prompt"]
			})
		]
	});
}
function RunError$1({ state, compact = false }) {
	return /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
		className: cn("flex gap-2 rounded-lg border border-destructive/30 bg-destructive/10 text-[11px] text-destructive", compact ? "items-center justify-between px-2 py-1.5" : "flex-col items-start px-3 py-2.5"),
		children: [/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("span", {
			className: cn("flex min-w-0 gap-1.5", compact ? "items-center" : "items-start"),
			children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)(TriangleAlert, { className: cn("h-3 w-3 shrink-0", !compact && "mt-px") }), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {
				className: cn(compact && "truncate"),
				children: state.error
			})]
		}), /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("button", {
			type: "button",
			disabled: !state.canAnalyze,
			onClick: () => state.analyze(),
			className: "inline-flex shrink-0 items-center gap-1 rounded font-medium underline-offset-2 hover:underline disabled:opacity-50",
			children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)(RefreshCw, { className: "h-2.5 w-2.5" }), " Try again"]
		})]
	});
}
function RunSkeleton({ columns }) {
	return /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
		className: "space-y-3",
		children: [
			/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
				className: "space-y-1.5",
				children: [
					/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Skeleton, { className: "h-3 w-12" }),
					/* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
						className: "grid gap-1.5",
						style: { gridTemplateColumns: `repeat(${columns}, minmax(0, 1fr))` },
						children: Array.from({ length: columns }, (_, i) => /* @__PURE__ */ (0, import_jsx_runtime.jsx)(Skeleton, { className: "h-[3.9rem] rounded-lg" }, i))
					}),
					/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Skeleton, { className: "h-3 w-40" })
				]
			}),
			/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
				className: "space-y-1.5",
				children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Skeleton, { className: "h-3 w-12" }), /* @__PURE__ */ (0, import_jsx_runtime.jsx)(Skeleton, { className: "h-7 rounded-lg" })]
			}),
			/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Skeleton, { className: "h-[3.6rem] rounded-lg" })
		]
	});
}
function RunResult({ state, recommendation }) {
	const { choice, isCustom, isStale, selectModel, selectEffort, reset, args } = state;
	const { profile, assessment, recommended } = recommendation;
	const [copied, setCopied] = (0, import_react.useState)(false);
	const copiedTimer = (0, import_react.useRef)(null);
	(0, import_react.useEffect)(() => {
		return () => {
			if (copiedTimer.current) clearTimeout(copiedTimer.current);
		};
	}, []);
	if (!choice) return null;
	const costLevel = relativeCostLevel(profile, choice);
	const price = choice.model.pricingId ? getModelPrice(choice.model.pricingId) : null;
	const commandArgs = args.length > 0 ? args : runChoiceArgs(profile, choice);
	const command = [profile.executable, ...commandArgs].filter(Boolean).join(" ");
	async function copyCommand() {
		await navigator.clipboard.writeText(command);
		setCopied(true);
		if (copiedTimer.current) clearTimeout(copiedTimer.current);
		copiedTimer.current = setTimeout(() => setCopied(false), 1600);
	}
	return /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
		className: cn("space-y-3 transition-opacity", isStale && "opacity-60"),
		children: [
			assessment.summary && /* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
				className: "text-xs leading-relaxed text-foreground/90",
				children: assessment.summary
			}),
			/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
				className: "space-y-1.5",
				children: [
					/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
						className: "flex items-center justify-between",
						children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {
							className: sectionLabelClass,
							children: "Model"
						}), isCustom && /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("button", {
							type: "button",
							onClick: reset,
							className: quietButtonClass,
							children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Undo, { className: "h-2.5 w-2.5" }), " Use recommended"]
						})]
					}),
					/* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
						role: "radiogroup",
						"aria-label": "Model",
						className: "grid gap-1.5",
						style: { gridTemplateColumns: `repeat(${profile.models.length}, minmax(0, 1fr))` },
						children: profile.models.map((model) => {
							const selected = model.id === choice.model.id;
							const isRecommended = model.id === recommended.model.id;
							const level = relativeCostLevel(profile, {
								model,
								effort: isRecommended ? recommended.effort : defaultEffortFor(model)
							});
							return /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("button", {
								type: "button",
								role: "radio",
								"aria-checked": selected,
								onClick: () => selectModel(model.id),
								className: cn("relative flex min-w-0 flex-col items-start gap-1 rounded-lg border px-2 py-1.5 text-left transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-ring", selected ? "border-primary/60 bg-primary/10 shadow-[0_0_14px_-6px_hsl(var(--primary)/0.6)]" : "border-border bg-background/40 hover:border-foreground/20 hover:bg-accent/50"),
								children: [
									/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("span", {
										className: "flex w-full items-center justify-between gap-1",
										children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {
											className: "text-[10px] font-medium uppercase tracking-wide text-muted-foreground",
											children: model.tier
										}), isRecommended && /* @__PURE__ */ (0, import_jsx_runtime.jsx)(SimpleTooltip, {
											label: "Recommended for this prompt",
											children: /* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {
												className: "flex h-3.5 w-3.5 items-center justify-center rounded-full bg-primary text-primary-foreground",
												children: /* @__PURE__ */ (0, import_jsx_runtime.jsx)(Check, { className: "h-2 w-2" })
											})
										})]
									}),
									/* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {
										className: "w-full truncate text-xs font-semibold",
										children: model.label
									}),
									/* @__PURE__ */ (0, import_jsx_runtime.jsx)(CostMeter, { level })
								]
							}, model.id);
						})
					}),
					/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("p", {
						className: "text-[11px] text-muted-foreground",
						children: [choice.model.bestFor, "."]
					})
				]
			}),
			/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
				className: "space-y-1.5",
				children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {
					className: sectionLabelClass,
					children: "Effort"
				}), choice.model.efforts?.length ? /* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
					role: "radiogroup",
					"aria-label": "Effort",
					className: "flex rounded-lg border border-border bg-background/40 p-0.5",
					children: choice.model.efforts.map((level) => {
						const selected = level === choice.effort;
						const isRecommended = choice.model.id === recommended.model.id && level === recommended.effort;
						return /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("button", {
							type: "button",
							role: "radio",
							"aria-checked": selected,
							onClick: () => selectEffort(level),
							className: cn("relative flex-1 whitespace-nowrap rounded-md px-1.5 py-1 text-[11px] font-medium transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-ring", selected ? "bg-primary text-primary-foreground shadow-sm" : "text-muted-foreground hover:bg-accent hover:text-foreground"),
							children: [EFFORT_LABELS[level], isRecommended && !selected && /* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", { className: "absolute right-1 top-1 h-1 w-1 rounded-full bg-primary" })]
						}, level);
					})
				}) : /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("p", {
					className: "flex items-start gap-1.5 rounded-lg border border-dashed border-border px-2 py-1.5 text-[11px] text-muted-foreground",
					children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)(CircleInfo, { className: "mt-px h-3 w-3 shrink-0" }), profile.effortHint]
				})]
			}),
			assessment.signals.length > 0 && /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
				className: "flex flex-wrap items-center gap-1",
				children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {
					className: "mr-0.5 text-[11px] text-muted-foreground",
					children: "Why"
				}), assessment.signals.map((signal) => /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("span", {
					className: cn("inline-flex items-center gap-1 rounded-full border px-1.5 py-px text-[10px]", signal.direction === "up" ? "border-warning/30 bg-warning/10 text-warning" : "border-success/30 bg-success/10 text-success"),
					children: [signal.direction === "up" ? /* @__PURE__ */ (0, import_jsx_runtime.jsx)(ArrowUp, { className: "h-2 w-2" }) : /* @__PURE__ */ (0, import_jsx_runtime.jsx)(ArrowDown, { className: "h-2 w-2" }), signal.label]
				}, signal.label))]
			}),
			/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
				className: "space-y-1.5 rounded-lg border border-border bg-muted/30 p-2",
				children: [
					/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
						className: "flex items-center justify-between gap-2 text-[11px]",
						children: [/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("span", {
							className: "flex items-center gap-1.5",
							children: [
								/* @__PURE__ */ (0, import_jsx_runtime.jsx)(CostMeter, { level: costLevel }),
								/* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {
									className: "font-medium",
									children: COST_COPY[costLevel - 1]
								}),
								/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("span", {
									className: "text-muted-foreground",
									children: ["for ", recommendation.targetAI]
								})
							]
						}), price && /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("span", {
							className: "tabular-nums text-muted-foreground",
							children: [
								formatPrice(price.input),
								" in · ",
								formatPrice(price.output),
								" out / 1M"
							]
						})]
					}),
					commandArgs.length > 0 && /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
						className: "flex items-center gap-1.5",
						children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("code", {
							className: "min-w-0 flex-1 truncate rounded-md bg-background/70 px-2 py-1 font-mono text-[11px]",
							children: command
						}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)(SimpleTooltip, {
							label: copied ? "Copied" : "Copy command",
							children: /* @__PURE__ */ (0, import_jsx_runtime.jsxs)(Button, {
								type: "button",
								variant: "ghost",
								size: "icon-xs",
								onClick: () => void copyCommand(),
								className: "shrink-0",
								children: [copied ? /* @__PURE__ */ (0, import_jsx_runtime.jsx)(Check, { className: "h-3 w-3 text-primary" }) : /* @__PURE__ */ (0, import_jsx_runtime.jsx)(Copy, { className: "h-3 w-3" }), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {
									className: "sr-only",
									children: "Copy command"
								})]
							})
						})]
					}),
					profile.note && /* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
						className: "text-[11px] text-muted-foreground",
						children: profile.note
					})
				]
			})
		]
	});
}
/** One-line summary for tight layouts; the full panel opens in a popover. */
function RunRecommendationChip({ state, className }) {
	const { status, recommendation, choice, isCustom, isStale } = state;
	let body;
	let tooltip;
	if (status === "analyzing") {
		body = /* @__PURE__ */ (0, import_jsx_runtime.jsxs)(import_jsx_runtime.Fragment, { children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Spinner, { className: "h-3 w-3 shrink-0 animate-spin text-primary" }), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {
			className: "truncate text-muted-foreground",
			children: "Sizing…"
		})] });
		tooltip = `Sizing the prompt with ${state.cliName ?? "your default AI CLI"}`;
	} else if (recommendation && choice) {
		body = /* @__PURE__ */ (0, import_jsx_runtime.jsxs)(import_jsx_runtime.Fragment, { children: [
			isStale ? /* @__PURE__ */ (0, import_jsx_runtime.jsx)(TriangleAlert, { className: "h-3 w-3 shrink-0 text-warning" }) : /* @__PURE__ */ (0, import_jsx_runtime.jsx)(Bolt, { className: cn("h-3 w-3 shrink-0", isCustom ? "text-muted-foreground" : "text-primary") }),
			/* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {
				className: "truncate font-medium",
				children: choice.model.label
			}),
			choice.effort && /* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {
				className: "truncate text-muted-foreground",
				children: EFFORT_LABELS[choice.effort]
			}),
			/* @__PURE__ */ (0, import_jsx_runtime.jsx)(CostMeter, {
				level: relativeCostLevel(recommendation.profile, choice),
				className: "shrink-0"
			})
		] });
		tooltip = isStale ? "The prompt changed since it was sized" : "Which model and effort to run this with";
	} else if (status === "error") {
		body = /* @__PURE__ */ (0, import_jsx_runtime.jsxs)(import_jsx_runtime.Fragment, { children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)(TriangleAlert, { className: "h-3 w-3 shrink-0 text-destructive" }), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {
			className: "truncate text-destructive",
			children: "Sizing failed"
		})] });
		tooltip = state.error ?? "Sizing failed";
	} else {
		body = /* @__PURE__ */ (0, import_jsx_runtime.jsxs)(import_jsx_runtime.Fragment, { children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Bolt, { className: "h-3 w-3 shrink-0 text-muted-foreground" }), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {
			className: "truncate text-muted-foreground",
			children: "Size run"
		})] });
		tooltip = state.canAnalyze ? "Ask your default AI CLI which model and effort this needs" : "Generate or translate a prompt, then it gets sized";
	}
	return /* @__PURE__ */ (0, import_jsx_runtime.jsxs)(Root2, { children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)(SimpleTooltip, {
		label: tooltip,
		children: /* @__PURE__ */ (0, import_jsx_runtime.jsx)(Trigger, {
			asChild: true,
			children: /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("button", {
				type: "button",
				className: cn("field-surface flex h-7 min-w-0 items-center gap-1.5 rounded-full pl-2.5 pr-2 text-xs focus:outline-none", className),
				children: [body, /* @__PURE__ */ (0, import_jsx_runtime.jsx)(ChevronDown, { className: "h-2.5 w-2.5 shrink-0 opacity-50" })]
			})
		})
	}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)(Portal, { children: /* @__PURE__ */ (0, import_jsx_runtime.jsx)(Content2, {
		align: "end",
		sideOffset: 6,
		collisionPadding: 12,
		className: cn(OVERLAY_SURFACE, OVERLAY_MOTION, "z-50 w-[min(27rem,calc(100vw-2rem))] p-3 origin-[var(--radix-popover-content-transform-origin)]"),
		children: /* @__PURE__ */ (0, import_jsx_runtime.jsx)(RunRecommendationPanel, { state })
	}) })] });
}
//#endregion
//#region src/renderer/src/components/workspace/FixWithAiDialog.tsx
/**
* Hands a ready prompt to an agent CLI. The prompt is shown for a last look (and can be edited),
* and a quick sizing picks the model and effort. Running it opens a tab with the command typed
* and waiting for Enter. Used for failed pipeline runs and failing tests, and for running a
* project's Blueprint prompt.
*/
function FixWithAiDialog({ project, open, onOpenChange, title, description, jobKey, source, promptType = "Bug Fix", promptLabel = "Fix prompt" }) {
	const navigate = useNavigate();
	const [edited, setPrompt] = (0, import_react.useState)(null);
	const prompt = edited ?? source.prompt ?? "";
	const analyzedFor = (0, import_react.useRef)(null);
	const cliId = projectCliId(project);
	const cli = cliId ? getCliDefinition(cliId) : void 0;
	const recommendation = useRunRecommendation({
		jobKey,
		generated: prompt,
		promptType,
		targetAI: cliId && targetAIForCliId(cliId) || DEFAULT_TARGET_AI
	});
	const { analyze } = recommendation;
	(0, import_react.useEffect)(() => {
		if (!open || !prompt || analyzedFor.current === jobKey) return;
		analyzedFor.current = jobKey;
		analyze({ prompt });
	}, [
		open,
		prompt,
		analyze,
		jobKey
	]);
	const profile = recommendation.recommendation?.profile ?? null;
	const choice = recommendation.choice;
	const runArgs = profile && choice ? runChoiceArgs(profile, choice) : [];
	const suggestion = profile?.cliId && choice && runArgs.length > 0 ? {
		cliId: profile.cliId,
		args: runArgs,
		label: [choice.model.label, choice.effort ? EFFORT_LABELS[choice.effort] : null].filter(Boolean).join(" · ")
	} : null;
	function openFix(launch) {
		if (!prompt.trim()) return;
		const ws = useWorkspaceStore.getState().workspaces[project.id];
		const group = ws ? findGroup(ws.root, ws.focusedGroupId) : null;
		if (!launchPromptTab(project, {
			...launch,
			prompt
		}, group?.id)) return;
		onOpenChange(false);
		navigate(`/workspace/${project.id}`);
		const name = getCliDefinition(launch.cliId)?.name ?? "the agent";
		toast.success(`Starting ${name}`, { description: "The prompt goes in as soon as it is ready. Press Enter in the tab to run it." });
	}
	const sizing = recommendation.status === "analyzing";
	const loading = source.prompt === null && !source.error;
	return /* @__PURE__ */ (0, import_jsx_runtime.jsx)(Dialog, {
		open,
		onOpenChange,
		children: /* @__PURE__ */ (0, import_jsx_runtime.jsxs)(DialogContent, {
			className: "flex max-h-[85vh] w-[min(58rem,calc(100vw-2rem))] max-w-none flex-col gap-0 p-0",
			children: [
				/* @__PURE__ */ (0, import_jsx_runtime.jsxs)(DialogHeader, {
					className: "px-5 py-4 shadow-[inset_0_-1px_0_hsl(var(--foreground)/0.08)]",
					children: [/* @__PURE__ */ (0, import_jsx_runtime.jsxs)(DialogTitle, {
						className: "flex items-center gap-2 text-base",
						children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Wand2, { className: "h-4 w-4 text-primary" }), title]
					}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)(DialogDescription, {
						className: "text-xs",
						children: description
					})]
				}),
				/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
					className: "flex min-h-0 flex-1 flex-col gap-4 px-5 py-4 lg:flex-row",
					children: [/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
						className: "flex min-h-0 flex-1 flex-col gap-2",
						children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
							className: SECTION_HEADING,
							children: "Prompt"
						}), loading ? /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
							className: cn(SECTION_WELL, "space-y-2"),
							children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
								className: "text-xs text-muted-foreground",
								children: source.loadingLabel ?? "Getting the failure ready…"
							}), Array.from({ length: 6 }, (_, i) => /* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {
								className: "shimmer block h-3 rounded",
								style: { width: `${92 - i * 9}%` }
							}, i))]
						}) : source.error && edited === null ? /* @__PURE__ */ (0, import_jsx_runtime.jsx)(Problem, {
							message: source.error,
							onRetry: source.retry
						}) : /* @__PURE__ */ (0, import_jsx_runtime.jsx)(Textarea, {
							value: prompt,
							onChange: (event) => setPrompt(event.target.value),
							spellCheck: false,
							"aria-label": promptLabel,
							className: "min-h-[18rem] flex-1 resize-none p-3 font-mono text-[12px] leading-relaxed"
						})]
					}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
						className: cn(SECTION_WELL, "min-h-0 shrink-0 overflow-y-auto lg:w-[21rem]"),
						children: /* @__PURE__ */ (0, import_jsx_runtime.jsx)(RunRecommendationPanel, { state: recommendation })
					})]
				}),
				/* @__PURE__ */ (0, import_jsx_runtime.jsxs)(DialogFooter, {
					className: cn(FOOTER_HAIRLINE, "flex-row items-center gap-2 px-5 py-3 sm:justify-between"),
					children: [/* @__PURE__ */ (0, import_jsx_runtime.jsxs)(Button, {
						variant: "ghost",
						size: "sm",
						className: "gap-1.5",
						disabled: !prompt,
						onClick: () => {
							navigator.clipboard.writeText(prompt);
							toast.success("Prompt copied");
						},
						children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Copy, { className: "h-3.5 w-3.5" }), "Copy prompt"]
					}), /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
						className: "flex items-center gap-2",
						children: [suggestion && cliId && suggestion.cliId !== cliId ? /* @__PURE__ */ (0, import_jsx_runtime.jsxs)(Button, {
							variant: "soft",
							size: "sm",
							disabled: !prompt,
							onClick: () => openFix({ cliId }),
							children: ["Open in ", cli?.name ?? "default CLI"]
						}) : null, /* @__PURE__ */ (0, import_jsx_runtime.jsxs)(Button, {
							size: "sm",
							className: "gap-1.5",
							disabled: !prompt || !suggestion && !cliId,
							onClick: () => openFix(suggestion ? {
								cliId: suggestion.cliId,
								runArgs: suggestion.args,
								runLabel: suggestion.label
							} : { cliId: cliId ?? "" }),
							children: [sizing ? /* @__PURE__ */ (0, import_jsx_runtime.jsx)(Spinner, { className: "h-3.5 w-3.5 animate-spin" }) : /* @__PURE__ */ (0, import_jsx_runtime.jsx)(TerminalSquare, { className: "h-3.5 w-3.5" }), suggestion ? `Run on ${suggestion.label}` : sizing ? `Open in ${cli?.name ?? "agent"} (sizing…)` : `Open in ${cli?.name ?? "agent"}`]
						})]
					})]
				})
			]
		})
	});
}
//#endregion
//#region src/renderer/src/components/wordpress/WordPressMark.tsx
/** WordPress's own mark, for WordPress sites in Deploy and WordPress projects. */
function WordPressMark({ className }) {
	return /* @__PURE__ */ (0, import_jsx_runtime.jsx)("svg", {
		viewBox: "0 0 24 24",
		"aria-hidden": "true",
		fill: `#${siWordpress.hex}`,
		className: cn("shrink-0", className),
		children: /* @__PURE__ */ (0, import_jsx_runtime.jsx)("path", { d: siWordpress.path })
	});
}
//#endregion
//#region src/renderer/src/components/ui/overflow-scroll.tsx
/**
* A region that only grows a scrollbar when its children don't fit. Edge fades
* appear while there is more content above or below, so overflow is obvious
* without a permanently visible bar.
*/
function OverflowScroll({ children, className, rootClassName, fill = false, surface = "popover" }) {
	const ref = (0, import_react.useRef)(null);
	const [overflow, setOverflow] = (0, import_react.useState)({
		up: false,
		down: false
	});
	const update = (0, import_react.useCallback)(() => {
		const el = ref.current;
		if (!el) return;
		const { scrollTop, clientHeight, scrollHeight } = el;
		setOverflow({
			up: scrollTop > 2,
			down: scrollTop + clientHeight < scrollHeight - 2
		});
	}, []);
	(0, import_react.useEffect)(() => {
		const el = ref.current;
		if (!el) return;
		update();
		const resize = new ResizeObserver(update);
		resize.observe(el);
		const mutate = new MutationObserver(update);
		mutate.observe(el, {
			childList: true,
			subtree: true,
			characterData: true
		});
		el.addEventListener("scroll", update, { passive: true });
		return () => {
			resize.disconnect();
			mutate.disconnect();
			el.removeEventListener("scroll", update);
		};
	}, [update]);
	const fadeFrom = surface === "card" ? "from-card" : surface === "background" ? "from-background" : surface === "chrome" ? "from-background glass:hidden" : "from-popover";
	return /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
		className: cn("relative min-h-0", fill && "h-full", rootClassName),
		children: [
			/* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
				ref,
				className: cn("min-h-0 overflow-y-auto overscroll-contain", fill && "h-full", className),
				children
			}),
			overflow.up && /* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", { className: cn("pointer-events-none absolute inset-x-0 top-0 z-[1] h-7 bg-gradient-to-b to-transparent", fadeFrom) }),
			overflow.down && /* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", { className: cn("pointer-events-none absolute inset-x-0 bottom-0 z-[1] h-7 bg-gradient-to-t to-transparent", fadeFrom) })
		]
	});
}
//#endregion
//#region src/shared/wordpressErrors.ts
var CODES = /* @__PURE__ */ new Set([
	"badRequest",
	"unauthorized",
	"badSignature",
	"staleTimestamp",
	"replayed",
	"unknownConnection",
	"revoked",
	"readOnly",
	"fileModsDisabled",
	"notDirect",
	"disabled",
	"pathRejected",
	"itemUnknown",
	"itemProtected",
	"deployUnknown",
	"conflict",
	"syntaxError",
	"busy",
	"invalidState",
	"tooLarge",
	"rateLimited",
	"pairingInvalid",
	"pairingExpired",
	"protocolMismatch",
	"internal",
	"vaultLocked",
	"foreignResponse",
	"badResponseSignature",
	"siteKeyMismatch",
	"redirected",
	"plainHttpRefused",
	"tlsUntrusted",
	"httpAuthRequired",
	"unreachable",
	"timeout",
	"cancelled",
	"keyInvalid",
	"keyExpired",
	"connectorOutdated",
	"bodyTooLarge",
	"localChanged",
	"planExpired",
	"operationBusy",
	"folderNotEmpty",
	"siteUnknown",
	"projectNotLinked"
]);
var CODE = /\[wp:([A-Za-z]+)\]\s*/;
function wordPressErrorCode(error) {
	const code = (error instanceof Error ? error.message : String(error)).match(CODE)?.[1];
	return code && CODES.has(code) ? code : null;
}
/** The human part of the message, without Electron's wrapper or a code tag. */
function wordPressErrorMessage(error) {
	return sshErrorMessage(error).replace(CODE, "");
}
//#endregion
//#region src/renderer/src/components/deploy/deployKit.tsx
/**
* The pieces every Deploy screen is drawn from, so servers, sites and their sections read like the
* API Client and Settings: glass cards with an icon tile header, tinted notices and hairline rows.
* Tinted edges are rings, because the global `* { border-color }` rule repaints borders.
*/
/**
* A tinted edge for a glass card, drawn as an inset ring. `.glass` folds Tailwind's ring
* variables into its own box-shadow, so a ring on a glass card shows like it does anywhere else.
*/
var GLASS_EDGE = {
	destructive: "ring-1 ring-inset ring-destructive/30",
	warning: "ring-1 ring-inset ring-warning/35",
	/** No edge at rest, a primary one on hover, and the focus ring as a thicker one. */
	interactive: "ring-1 ring-inset ring-transparent hover:ring-primary/30 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
};
/** A list framed as a soft well, each row split from the next by a hairline. */
var LIST_WELL = "settings-rows overflow-hidden rounded-xl bg-foreground/[0.03] ring-1 ring-inset ring-foreground/[0.07]";
/** One row inside a `LIST_WELL`. */
var LIST_ROW = "px-3 py-2.5";
/** Facts as label and value rows split by hairlines, like the rows of a Settings card. */
function FactRows({ className, children }) {
	return /* @__PURE__ */ (0, import_jsx_runtime.jsx)("dl", {
		className: cn("settings-rows", className),
		children
	});
}
/** One fact. The `dd` follows its `dt` directly, which the end-to-end tests read by. */
function FactRow({ label, labelWidth = "9rem", children }) {
	return /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
		className: cn("grid gap-3 py-2", labelWidth === "8rem" ? "grid-cols-[8rem_minmax(0,1fr)]" : "grid-cols-[9rem_minmax(0,1fr)]"),
		children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("dt", {
			className: "text-xs text-muted-foreground",
			children: label
		}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("dd", {
			className: "min-w-0 break-words text-sm text-foreground",
			children
		})]
	});
}
/**
* Switches between the sections of a server or a site. It is a pill track whose tinted selection
* slides between entries, the way the main menu's does. The section is part of the page's
* address, and the one shown is `aria-current="page"`, so it is not marked by colour alone. In a
* narrow window the track scrolls sideways rather than cutting the last sections off.
*/
function SectionStrip({ id, label, items, value, onChange }) {
	const transition = useReducedMotion() ? { duration: 0 } : {
		type: "spring",
		stiffness: 420,
		damping: 32
	};
	return /* @__PURE__ */ (0, import_jsx_runtime.jsx)("nav", {
		"aria-label": label,
		className: "search-pill flex max-w-full shrink-0 gap-0.5 self-start overflow-x-auto rounded-full p-0.5 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden",
		children: /* @__PURE__ */ (0, import_jsx_runtime.jsx)(LayoutGroup, {
			id,
			children: items.map((item) => {
				const Icon = item.icon;
				const current = item.value === value;
				return /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("button", {
					type: "button",
					"aria-current": current ? "page" : void 0,
					onClick: () => onChange(item.value),
					className: cn("relative isolate flex h-7 shrink-0 cursor-pointer items-center gap-1.5 whitespace-nowrap rounded-full px-3 text-xs font-medium outline-none transition-colors focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-ring", current ? "text-primary" : "text-muted-foreground hover:bg-foreground/[0.06] hover:text-foreground"),
					children: [
						current && /* @__PURE__ */ (0, import_jsx_runtime.jsx)(motion.span, {
							"aria-hidden": true,
							layoutId: `${id}-active`,
							transition,
							className: "absolute inset-0 -z-10 rounded-full bg-primary/12 ring-1 ring-inset ring-primary/20"
						}),
						Icon && /* @__PURE__ */ (0, import_jsx_runtime.jsx)(Icon, { className: "h-3.5 w-3.5 shrink-0" }),
						item.label
					]
				}, item.value);
			})
		})
	});
}
//#endregion
//#region src/shared/deploySecurityTypes.ts
/** Most powerful first, as the core nests them: each includes what the ones after it may do. */
var DEPLOY_ROLES = [
	"owner",
	"admin",
	"operator",
	"viewer"
];
//#endregion
//#region src/renderer/src/components/deploy/security/format.ts
/** Words for the Security area: roles, and times relative to now. */
var ROLE_LABEL = {
	owner: "Owner",
	admin: "Admin",
	operator: "Operator",
	viewer: "Viewer"
};
/** What each role may do; each includes the ones below it. */
var ROLE_SUMMARY = {
	owner: "Everything, including users and the security of the server.",
	admin: "Runs the server: commands, websites, firewall, certificates and the audit trail.",
	operator: "Deploys and runs apps, updates packages and restarts services.",
	viewer: "Sees everything and changes nothing."
};
function isRole(value) {
	return DEPLOY_ROLES.includes(value);
}
function roleLabel(role) {
	return isRole(role) ? ROLE_LABEL[role] : "No role";
}
/** "an Admin", "a Viewer". */
function withArticle(role) {
	return `${role === "viewer" ? "a" : "an"} ${ROLE_LABEL[role]}`;
}
/** Whether these roles include `role`, the way the core nests them. */
function hasRole(roles, role) {
	const needed = DEPLOY_ROLES.indexOf(role);
	return (roles ?? []).some((held) => isRole(held) && DEPLOY_ROLES.indexOf(held) <= needed);
}
function ago(unixMs, now = Date.now()) {
	return now - unixMs < 6e4 ? "just now" : `${shortAge(unixMs, now)} ago`;
}
/** "in 15m", "in 3d". */
function fromNow(unixMs, now = Date.now()) {
	return `in ${shortAge(now, unixMs)}`;
}
function clockTime(unixMs) {
	return new Date(unixMs).toLocaleTimeString([], {
		hour: "2-digit",
		minute: "2-digit"
	});
}
function dateTime(unixMs) {
	return new Date(unixMs).toLocaleString([], {
		year: "numeric",
		month: "short",
		day: "numeric",
		hour: "2-digit",
		minute: "2-digit",
		second: "2-digit"
	});
}
//#endregion
//#region src/renderer/src/components/deploy/wordpress/messages.ts
var PROBLEMS = {
	badRequest: "The site didn't understand the request. Update the AgentMate Connector plugin on the site, then try again.",
	unauthorized: "The site didn't accept this computer's signature. Disconnect the site and connect it again with a new key.",
	badSignature: "The site couldn't verify this computer's signature. Disconnect the site and connect it again with a new key.",
	staleTimestamp: "This computer's clock and the site's clock are too far apart. Check the time on both, then try again.",
	replayed: "The site saw the same request twice and refused the second one. Try again.",
	unknownConnection: "The site no longer knows this computer. It may have been removed in wp-admin. Disconnect it here and connect again with a new key.",
	revoked: "This computer's access was revoked on the site. Make a new key in Tools > AgentMate Connector and connect again.",
	readOnly: "Read-only key. You can pull files from this site but not deploy to it.",
	fileModsDisabled: "File changes are switched off on this site (DISALLOW_FILE_MODS in wp-config.php), so nothing can be deployed. Pulling still works.",
	notDirect: "WordPress can't write files directly on this host (its filesystem method isn't \"direct\"), so nothing can be deployed. Pulling still works.",
	disabled: "The connector is switched off on this site (AGENTMATE_CONNECTOR_DISABLED in wp-config.php).",
	pathRejected: "The site refused a file path. Only theme, plugin and mu-plugin files are ever written, and agent or AgentMate files never are.",
	itemUnknown: "The site doesn't have that theme or plugin anymore.",
	itemProtected: "That's the connector itself, which is never pulled or deployed.",
	deployUnknown: "The site doesn't know that deploy anymore. Its snapshot may have been cleared.",
	conflict: "Files on the site changed since you last pulled. Pull first, or review the changes again.",
	syntaxError: "A PHP file has a syntax error, so the site refused the deploy. Nothing was changed.",
	busy: "Another deploy is still running on this site. Wait for it to finish, then try again.",
	invalidState: "That deploy can't do this in the state it's in now.",
	tooLarge: "A file is larger than the site accepts.",
	rateLimited: "Too many failed attempts came from this network, so the site locked it out for 15 minutes. Try again later.",
	pairingInvalid: "The site didn't accept this key. It may have been used already or deleted. Make a new key in Tools > AgentMate Connector.",
	pairingExpired: "This key has expired. Keys work once, for 15 minutes. Make a new one in Tools > AgentMate Connector.",
	protocolMismatch: "The connector on the site and this app speak different versions. Update whichever one is older.",
	internal: "Something went wrong on the site. Its PHP error log may say more.",
	vaultLocked: "Your saved servers are locked with a passkey, and this site's key with them. Unlock them, then try again.",
	foreignResponse: "Something other than the connector answered: a firewall, a CDN challenge or a host error page. Allow requests to /wp-json/agentmate/v1 and admin-ajax.php through the firewall (on Cloudflare, a rule that skips the challenge for them), then try again.",
	badResponseSignature: "A reply claimed to come from the connector, but its signature didn't check out, so it was ignored. Something between you and the site may be changing replies.",
	siteKeyMismatch: "The site's identity doesn't match the key. If the connector was reinstalled, make a new key. If not, something may be pretending to be your site, so don't connect.",
	redirected: "The site answered with a redirect, and AgentMate never follows redirects on signed calls. Make the key again from the site's final address (https, with or without www).",
	plainHttpRefused: "This site uses plain HTTP, which AgentMate refuses unless you allow it for this site. Without HTTPS, anyone on the network can read the files. Allow it under Access.",
	tlsUntrusted: "This computer doesn't trust the site's HTTPS certificate (self-signed, expired, or made out to another name). Fix the certificate on the host or trust it in your system.",
	httpAuthRequired: "The site asks for an HTTP sign-in, as staging sites often do. Add its user name and password in Access.",
	unreachable: "Couldn't reach the site. Check its address and your connection.",
	timeout: "The site took too long to answer. Try again in a moment.",
	cancelled: "Cancelled.",
	keyInvalid: "This isn't a connection key AgentMate can read. Copy the whole key again from Tools > AgentMate Connector; it starts with amwp1.",
	keyExpired: "This key has expired. Keys work once, for 15 minutes. Make a new one in Tools > AgentMate Connector.",
	connectorOutdated: "The connector on this site is older than this app needs. Download the latest plugin and upload it in wp-admin.",
	bodyTooLarge: "The site's web server refused even small requests. Raise client_max_body_size (nginx) or post_max_size (PHP) on the host.",
	localChanged: "Files changed on this computer after the review was made. Review the changes again.",
	planExpired: "The review expired after 15 minutes. Review the changes again.",
	operationBusy: "Another pull or deploy for this site is still running.",
	folderNotEmpty: "The project's theme or plugin folders already hold files.",
	siteUnknown: "AgentMate doesn't know this site anymore. It may have been disconnected.",
	projectNotLinked: "This project isn't linked to a WordPress site."
};
/** Where a problem is fixed in the Connect dialog instead of on the site's Access page. */
var CONNECT_PROBLEMS = {
	vaultLocked: "Your saved servers are locked with a passkey. Unlock them on the Deploy page, then connect again with the same key; it hasn't been used yet.",
	httpAuthRequired: "The site asks for an HTTP sign-in, as staging sites often do. Turn on \"HTTP sign-in\" below and add its user name and password.",
	plainHttpRefused: "This site uses plain HTTP, which AgentMate refuses unless you allow it below. Without HTTPS, anyone on the network can read the files."
};
/**
* Codes whose message from the main process is more specific than the fixed wording here: it says
* whether Cloudflare answered, whether the connector is missing (404), or where a redirect went.
*/
var SPECIFIC_FROM_MAIN = /* @__PURE__ */ new Set(["foreignResponse", "redirected"]);
/** The human version of a failure from a WordPress call; unknown failures keep their own words. */
function wpProblem(error, context = "site") {
	const code = wordPressErrorCode(error);
	if (code && SPECIFIC_FROM_MAIN.has(code)) {
		const own = wordPressErrorMessage(error).trim();
		if (own.length >= 40) return own;
	}
	if (code) return (context === "connect" ? CONNECT_PROBLEMS[code] : void 0) ?? PROBLEMS[code];
	return wordPressErrorMessage(error) || "Something went wrong.";
}
/** Times the app records are milliseconds; `lastSeenAt` is one of them. */
function lastSeenText(site, now = Date.now()) {
	return site.lastSeenAt === null ? "Not reached yet" : `Seen ${ago(site.lastSeenAt, now)}`;
}
/**
* Compares dotted version numbers ("1.0.10" is newer than "1.0.9"). Anything after a `-` or `+`
* is ignored, and a part that is not a number counts as 0.
*/
function compareVersions(a, b) {
	const parts = (value) => value.split(/[-+]/)[0].split(".").map((part) => Number.parseInt(part, 10) || 0);
	const left = parts(a);
	const right = parts(b);
	for (let index = 0; index < Math.max(left.length, right.length); index += 1) {
		const diff = (left[index] ?? 0) - (right[index] ?? 0);
		if (diff !== 0) return diff < 0 ? -1 : 1;
	}
	return 0;
}
/** The host part of a site address, for the rail; the address itself when it does not parse. */
function siteHost(url) {
	try {
		const parsed = new URL(url);
		return `${parsed.host}${parsed.pathname === "/" ? "" : parsed.pathname.replace(/\/$/, "")}`;
	} catch {
		return url;
	}
}
var SCOPE_LABEL = {
	read: "Read-only key",
	write: "Read and write key"
};
var SCOPE_SUMMARY = {
	read: "Read-only key. You can pull files from this site but not deploy to it.",
	write: "Read and write key. You can pull files from this site and deploy to it."
};
var TRANSPORT_LABEL = {
	https: "HTTPS",
	"local-http": "Plain HTTP to this computer",
	"plain-http": "Plain HTTP over the network"
};
var DEPLOY_STATE_LABEL = {
	open: "Started",
	applying: "Writing files",
	applied: "Written, being checked",
	done: "Deployed",
	rolledBack: "Rolled back",
	aborted: "Cancelled",
	expired: "Expired"
};
/** What a state means for the files on the site, for the deploy's row. */
var DEPLOY_STATE_DETAIL = {
	open: "Files are on their way. Nothing on the site has changed yet.",
	applying: "The site is writing the new files now.",
	applied: "The new files are in place and the site is checking that it still works.",
	done: "The new files are live.",
	rolledBack: "The files are back to how they were before this deploy.",
	aborted: "Stopped before any file on the site changed.",
	expired: "Left unfinished for 30 minutes, so the site dropped it. No file changed."
};
var ROLLBACK_REASON$1 = {
	requested: "Someone asked for it to be rolled back.",
	healthCheck: "The site stopped working properly after the deploy, so it put the old files back on its own.",
	fatalError: "A changed file caused a PHP fatal error, so the site put the old files back.",
	notConfirmed: "AgentMate didn't confirm the deploy in time (the connection may have dropped), so the site put the old files back on its own.",
	interrupted: "The deploy was interrupted partway, so the site put the old files back."
};
var AUDIT_EVENT_LABEL = {
	keyCreated: "Connection key made",
	paired: "Computer connected",
	pairFailed: "Connection attempt failed",
	authFailed: "Request refused",
	rateLimited: "Locked out after too many failures",
	revoked: "Connection revoked",
	pulled: "Files pulled",
	deployStarted: "Deploy started",
	deployDone: "Deploy finished",
	deployRolledBack: "Deploy rolled back",
	deployAborted: "Deploy cancelled",
	settingsChanged: "Settings changed"
};
/** Events that point at something going wrong, shown in a warning colour. */
var AUDIT_EVENT_WARNS = /* @__PURE__ */ new Set([
	"pairFailed",
	"authFailed",
	"rateLimited",
	"deployRolledBack"
]);
var PHASE_LABEL$1 = {
	connecting: "Reaching the site",
	manifest: "Listing files",
	hashing: "Comparing files",
	download: "Downloading",
	write: "Writing files",
	upload: "Uploading",
	validate: "Checking PHP syntax",
	apply: "Writing files on the site",
	verify: "Checking the site still works",
	finalize: "Finishing",
	rollback: "Putting the old files back",
	done: "Done",
	failed: "Stopped"
};
/** One line for a running operation: its step, and how far along when that is known. */
function progressText(event) {
	const label = PHASE_LABEL$1[event.phase] ?? "Working";
	return event.total > 0 ? `${label} (${event.done} of ${event.total})` : label;
}
var DATE_TIME = {
	year: "numeric",
	month: "short",
	day: "numeric",
	hour: "2-digit",
	minute: "2-digit"
};
/** A moment the app recorded, in milliseconds. */
function dateTimeText(unixMs) {
	return new Date(unixMs).toLocaleString([], DATE_TIME);
}
/** A moment the site reported: the plugin sends Unix seconds. */
function siteTimeText(seconds) {
	return dateTimeText(seconds * 1e3);
}
/** A time of day the site reported in Unix seconds, such as a pending deploy's deadline. */
function siteClockText(seconds) {
	return (/* @__PURE__ */ new Date(seconds * 1e3)).toLocaleTimeString([], {
		hour: "2-digit",
		minute: "2-digit"
	});
}
/** Whether deploys can write files, and if not, which switch on the site stops them. */
function fileChangesStatus(info, site) {
	if (info.fileModsDisabled) return {
		allowed: false,
		text: "Off. DISALLOW_FILE_MODS is set in wp-config.php, so nothing can be deployed. Pulling still works."
	};
	if (info.readOnlyByConstant) return {
		allowed: false,
		text: "Off. AGENTMATE_CONNECTOR_READ_ONLY is set in wp-config.php, so the connector only reads. Pulling still works."
	};
	if (info.filesystemMethod !== "direct") return {
		allowed: false,
		text: `Off. WordPress would write files through "${info.filesystemMethod}" here, and the connector only writes files directly. Pulling still works.`
	};
	if (site.scope === "read") return {
		allowed: false,
		text: "The site allows them, but this key is read-only. You can pull files from this site but not deploy to it."
	};
	return {
		allowed: true,
		text: "Allowed. Deploys write theme and plugin files directly."
	};
}
//#endregion
//#region src/renderer/src/components/deploy/wordpress/hooks.ts
/**
* Reads and writes for WordPress sites in Deploy. Everything sits under `['deploy', 'wordpress']`,
* so unlocking the Servers vault refreshes it with the rest of Deploy.
*
* Calls that carry a secret (an HTTP sign-in password) go straight to the bridge instead of
* through `useMutation`, which would keep the call's input in the mutation cache.
*/
/** Asking a site again on every section switch is slow on shared hosting; half a minute is fresh. */
var SITE_STALE_MS = 3e4;
/** Held still so the audit query key does too. */
var AUDIT_FILTER = { limit: 50 };
function useWordPressSites() {
	return useQuery({
		queryKey: queryKeys.deployWordPressSites,
		queryFn: async () => await window.agentmat.deployWordPress.listSites() ?? []
	});
}
function useSiteInfo(siteId) {
	return useQuery({
		queryKey: queryKeys.deployWordPressSiteInfo(siteId),
		queryFn: async () => {
			const info = await window.agentmat.deployWordPress.siteInfo(siteId);
			if (!info) throw new Error("The site sent nothing back.");
			return info;
		},
		staleTime: SITE_STALE_MS
	});
}
function useSiteItems(siteId) {
	return useQuery({
		queryKey: queryKeys.deployWordPressItems(siteId),
		queryFn: async () => await window.agentmat.deployWordPress.listItems(siteId) ?? [],
		staleTime: SITE_STALE_MS
	});
}
function useSiteHistory(siteId) {
	return useQuery({
		queryKey: queryKeys.deployWordPressHistory(siteId),
		queryFn: async () => await window.agentmat.deployWordPress.history(siteId) ?? [],
		staleTime: SITE_STALE_MS
	});
}
/** The site's audit log, newest first, a page at a time (older pages by `before`). */
function useSiteAudit(siteId) {
	return useInfiniteQuery({
		queryKey: queryKeys.deployWordPressAudit(siteId, AUDIT_FILTER),
		queryFn: async ({ pageParam }) => await window.agentmat.deployWordPress.audit({
			siteId,
			limit: 50,
			...pageParam === void 0 ? {} : { before: pageParam }
		}) ?? [],
		initialPageParam: void 0,
		getNextPageParam: (last) => last.length < 50 ? void 0 : last.at(-1)?.id
	});
}
/** Every project, from the same query the rest of the app reads. */
function useProjects() {
	return useQuery({
		queryKey: queryKeys.projects,
		queryFn: async () => await window.agentmat.projects.list() ?? []
	});
}
/** The projects linked to this site. */
function siteProjects(projects, siteId) {
	return (projects ?? []).filter((project) => project.wordpress?.siteId === siteId);
}
/** Puts a changed site into the cached list right away, then has the list read again. */
function useSiteListUpdate() {
	const queryClient = useQueryClient();
	return (0, import_react.useCallback)((site) => {
		if (site) queryClient.setQueryData(queryKeys.deployWordPressSites, (sites) => sites?.some((one) => one.id === site.id) ? sites.map((one) => one.id === site.id ? site : one) : [...sites ?? [], site]);
		queryClient.invalidateQueries({ queryKey: queryKeys.deployWordPressSites });
	}, [queryClient]);
}
/** Changes a site's name, plain-HTTP choice or HTTP sign-in. Never through the mutation cache. */
function useSiteSettings(siteId) {
	const queryClient = useQueryClient();
	const update = useSiteListUpdate();
	return (0, import_react.useCallback)(async (patch) => {
		const site = await window.agentmat.deployWordPress.updateSettings({
			siteId,
			...patch
		});
		update(site);
		queryClient.invalidateQueries({ queryKey: queryKeys.deployWordPressSite(siteId) });
		return site;
	}, [
		siteId,
		queryClient,
		update
	]);
}
/** The latest progress event for one operation, while it runs. */
function useOperationProgress(operationId) {
	const [event, setEvent] = (0, import_react.useState)(null);
	(0, import_react.useEffect)(() => {
		setEvent(null);
		if (!operationId) return void 0;
		return window.agentmat.deployWordPress.onProgress((next) => {
			if (next.operationId === operationId) setEvent(next);
		});
	}, [operationId]);
	return event;
}
/** Asks where to save the bundled AgentMate Connector zip and says where it went. */
function useSaveConnectorZip() {
	const [saving, setSaving] = (0, import_react.useState)(false);
	return {
		save: (0, import_react.useCallback)(async () => {
			setSaving(true);
			try {
				const result = await window.agentmat.deployWordPress.saveConnectorZip();
				if (result?.saved) toast.success(`Saved the plugin to ${result.path}.`);
			} catch (error) {
				toast.error(wpProblem(error));
			} finally {
				setSaving(false);
			}
		}, []),
		saving
	};
}
/** A fresh id for a long call, so its progress events can be told apart. */
function newOperationId() {
	return crypto.randomUUID();
}
//#endregion
//#region src/renderer/src/components/deploy/wordpress/ConnectorDownloadCard.tsx
/** The three steps from nothing to a connection key, in the words wp-admin uses. */
function ConnectorSteps({ className }) {
	return /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("ol", {
		"aria-label": "How to install the connector",
		className: cn("list-decimal space-y-1.5 pl-5 text-sm text-muted-foreground", className),
		children: [
			/* @__PURE__ */ (0, import_jsx_runtime.jsx)("li", { children: "Download the plugin zip." }),
			/* @__PURE__ */ (0, import_jsx_runtime.jsx)("li", { children: "In the site's admin, open Plugins > Add New > Upload Plugin, pick the zip, then install and activate it." }),
			/* @__PURE__ */ (0, import_jsx_runtime.jsx)("li", { children: "Open Tools > AgentMate Connector and make a connection key. Pick read-only if you only want to pull files." })
		]
	});
}
/**
* Hands over the AgentMate Connector plugin that ships with the app. The plugin can't update
* itself, so this is also how a site gets a newer version.
*/
function ConnectorDownloadCard({ title = "Get the AgentMate Connector", description = "A small WordPress plugin that lets AgentMate pull and deploy theme and plugin files. It needs WordPress 6.0 and PHP 7.4 or newer.", className }) {
	const { save, saving } = useSaveConnectorZip();
	return /* @__PURE__ */ (0, import_jsx_runtime.jsx)(SectionCard, {
		className,
		icon: /* @__PURE__ */ (0, import_jsx_runtime.jsx)(WordPressMark, {}),
		tone: "neutral",
		title,
		description,
		actions: /* @__PURE__ */ (0, import_jsx_runtime.jsxs)(Button, {
			size: "sm",
			variant: "soft",
			disabled: saving,
			onClick: () => void save(),
			children: [saving ? /* @__PURE__ */ (0, import_jsx_runtime.jsx)(Spinner, { className: "motion-safe:animate-spin" }) : /* @__PURE__ */ (0, import_jsx_runtime.jsx)(Download, {}), "Download the plugin"]
		}),
		children: /* @__PURE__ */ (0, import_jsx_runtime.jsx)(ConnectorSteps, {})
	});
}
//#endregion
//#region src/renderer/src/components/deploy/wordpress/PlainHttpNotice.tsx
/**
* What plain HTTP costs, said before the user allows it: requests are still signed, so nobody can
* change or replay them, but nothing is encrypted, so anyone on the way can read the files.
*/
function PlainHttpNotice({ className, children }) {
	return /* @__PURE__ */ (0, import_jsx_runtime.jsx)(Notice, {
		role: "note",
		"aria-label": "Plain HTTP",
		tone: "warning",
		icon: TriangleAlert,
		className: cn("shrink-0", className),
		children: /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
			className: "space-y-3",
			children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", { children: "This site uses plain HTTP, not HTTPS. Every request is still signed, so nobody can change or replay it, but nothing is encrypted: anyone on the network between you and the site can read the theme and plugin files that go back and forth. Use HTTPS if the host offers it." }), children]
		})
	});
}
//#endregion
//#region src/renderer/src/components/wordpress/ConnectSiteDialog.tsx
var KEY_HINTS = {
	format: "This doesn't look like a connection key. Copy the whole key from Tools > AgentMate Connector in the site's admin; it starts with amwp1.",
	version: "This key is for a different version of the connector. Update the plugin on the site (or update AgentMate), then make a new key.",
	fields: "This key is incomplete or damaged. Copy it again from the site's admin.",
	url: "The addresses in this key aren't ones AgentMate can use. Check the site's address in Settings > General, then make a new key.",
	expired: "This key has expired. Keys work once, for 15 minutes. Make a new one in Tools > AgentMate Connector."
};
function minutesLeft(expiresAtSeconds, now) {
	const minutes = Math.floor((expiresAtSeconds * 1e3 - now) / 6e4);
	if (minutes < 1) return "Works for less than a minute more, so connect now.";
	return `Works for ${minutes} more ${minutes === 1 ? "minute" : "minutes"}.`;
}
/** A message that somehow carries the key (or its secret) is replaced, never shown. */
function withoutSecrets(message, secrets) {
	return secrets.some((secret) => secret.length >= 16 && message.includes(secret)) ? "The site refused the connection." : message;
}
function ConnectSiteDialog({ open, onOpenChange, onConnected }) {
	const id = (0, import_react.useId)();
	const [key, setKey] = (0, import_react.useState)("");
	const [label, setLabel] = (0, import_react.useState)("");
	const [allowPlainHttp, setAllowPlainHttp] = (0, import_react.useState)(false);
	const [useHttpAuth, setUseHttpAuth] = (0, import_react.useState)(false);
	const [username, setUsername] = (0, import_react.useState)("");
	const [password, setPassword] = (0, import_react.useState)("");
	const [busy, setBusy] = (0, import_react.useState)(false);
	const [problem, setProblem] = (0, import_react.useState)(null);
	const [now, setNow] = (0, import_react.useState)(() => Date.now());
	const { save, saving } = useSaveConnectorZip();
	const reset = (0, import_react.useCallback)(() => {
		setKey("");
		setLabel("");
		setAllowPlainHttp(false);
		setUseHttpAuth(false);
		setUsername("");
		setPassword("");
		setProblem(null);
	}, []);
	(0, import_react.useEffect)(() => {
		if (!open) {
			reset();
			return;
		}
		setNow(Date.now());
		const timer = window.setInterval(() => setNow(Date.now()), 15e3);
		return () => window.clearInterval(timer);
	}, [open, reset]);
	const compact = key.replace(/\s+/g, "");
	const parsed = compact ? parseWpConnectionKey(compact, Math.floor(now / 1e3)) : null;
	const parsedKey = parsed?.ok ? parsed.key : null;
	const transport = parsedKey ? wpKeyTransportSecurity(parsedKey) : null;
	const needsPlainOptIn = transport === "plain-http";
	const canConnect = parsedKey !== null && !busy && (!needsPlainOptIn || allowPlainHttp) && (!useHttpAuth || username.trim() !== "" && password !== "");
	function close(next) {
		if (!next) reset();
		onOpenChange(next);
	}
	async function connect(event) {
		event.preventDefault();
		if (!canConnect || !parsedKey) return;
		setBusy(true);
		setProblem(null);
		try {
			const site = await window.agentmat.deployWordPress.connect({
				connectionKey: compact,
				...label.trim() ? { label: label.trim() } : {},
				...needsPlainOptIn && allowPlainHttp ? { allowPlainHttp: true } : {},
				...useHttpAuth ? { httpAuth: {
					username: username.trim(),
					password
				} } : {}
			});
			reset();
			toast.success(`Connected ${site?.label ?? "the site"}.`);
			if (site) onConnected?.(site);
			onOpenChange(false);
		} catch (error) {
			if (wordPressErrorCode(error) === "httpAuthRequired") setUseHttpAuth(true);
			setProblem(withoutSecrets(wpProblem(error, "connect"), [compact, parsedKey.pairingSecret]));
		} finally {
			setBusy(false);
		}
	}
	return /* @__PURE__ */ (0, import_jsx_runtime.jsx)(Dialog, {
		open,
		onOpenChange: close,
		children: /* @__PURE__ */ (0, import_jsx_runtime.jsxs)(DialogContent, {
			className: "max-w-xl",
			children: [
				/* @__PURE__ */ (0, import_jsx_runtime.jsxs)(DialogHeader, { children: [/* @__PURE__ */ (0, import_jsx_runtime.jsxs)(DialogTitle, {
					className: "flex items-center gap-2",
					children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)(WordPressMark, { className: "h-5 w-5" }), " Connect a WordPress site"]
				}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)(DialogDescription, { children: "Paste the connection key from Tools > AgentMate Connector in the site's admin. A key works once, for 15 minutes." })] }),
				/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("form", {
					id: `${id}-form`,
					className: "-mx-1 space-y-4 overflow-y-auto px-1",
					onSubmit: (event) => void connect(event),
					children: [
						/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
							className: "rounded-lg border border-border/70 bg-secondary/30 px-3 py-2.5 text-sm",
							children: [/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("p", {
								className: "text-muted-foreground",
								children: [
									"Don't have the connector on the site yet?",
									" ",
									/* @__PURE__ */ (0, import_jsx_runtime.jsxs)(Button, {
										type: "button",
										variant: "link",
										className: "h-auto p-0",
										disabled: saving,
										onClick: () => void save(),
										children: [saving ? /* @__PURE__ */ (0, import_jsx_runtime.jsx)(Spinner, { className: "h-3.5 w-3.5 motion-safe:animate-spin" }) : /* @__PURE__ */ (0, import_jsx_runtime.jsx)(Download, { className: "h-3.5 w-3.5" }), "Download the plugin"]
									})
								]
							}), /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("details", {
								className: "mt-1.5",
								children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("summary", {
									className: "cursor-pointer text-xs text-muted-foreground hover:text-foreground",
									children: "How to install it and make a key"
								}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)(ConnectorSteps, { className: "mt-2 text-xs" })]
							})]
						}),
						/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
							className: "space-y-1.5",
							children: [
								/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Label, {
									htmlFor: `${id}-key`,
									children: "Connection key"
								}),
								/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Textarea, {
									id: `${id}-key`,
									value: key,
									onChange: (event) => {
										setKey(event.target.value);
										setProblem(null);
									},
									placeholder: "amwp1...",
									rows: 4,
									spellCheck: false,
									autoComplete: "off",
									autoCorrect: "off",
									autoCapitalize: "off",
									className: "break-all font-mono text-xs"
								}),
								parsed && !parsed.ok && /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("p", {
									role: "alert",
									className: "flex items-start gap-1.5 text-xs text-destructive",
									children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)(TriangleAlert, { className: "mt-0.5 h-3 w-3 shrink-0" }), KEY_HINTS[parsed.error]]
								})
							]
						}),
						parsedKey && /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("dl", {
							"aria-label": "What this key connects",
							className: "grid grid-cols-[6rem_minmax(0,1fr)] gap-x-3 gap-y-1.5 rounded-lg border border-border/70 px-3 py-2.5 text-sm",
							children: [
								/* @__PURE__ */ (0, import_jsx_runtime.jsx)("dt", {
									className: "text-xs text-muted-foreground",
									children: "Site"
								}),
								/* @__PURE__ */ (0, import_jsx_runtime.jsx)("dd", {
									className: "break-all font-mono text-xs text-foreground",
									children: parsedKey.siteUrl
								}),
								/* @__PURE__ */ (0, import_jsx_runtime.jsx)("dt", {
									className: "text-xs text-muted-foreground",
									children: "Access"
								}),
								/* @__PURE__ */ (0, import_jsx_runtime.jsx)("dd", {
									className: "text-foreground",
									children: SCOPE_SUMMARY[parsedKey.scope]
								}),
								/* @__PURE__ */ (0, import_jsx_runtime.jsx)("dt", {
									className: "text-xs text-muted-foreground",
									children: "Key"
								}),
								/* @__PURE__ */ (0, import_jsx_runtime.jsx)("dd", {
									className: "text-foreground",
									children: minutesLeft(parsedKey.expiresAt, now)
								})
							]
						}),
						needsPlainOptIn && /* @__PURE__ */ (0, import_jsx_runtime.jsx)(PlainHttpNotice, { children: /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
							className: "flex items-center gap-3 pl-6",
							children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Switch, {
								id: `${id}-plain`,
								checked: allowPlainHttp,
								onCheckedChange: setAllowPlainHttp
							}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)(Label, {
								htmlFor: `${id}-plain`,
								className: "cursor-pointer",
								children: "Allow plain HTTP for this site"
							})]
						}) }),
						transport === "local-http" && /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("p", {
							className: "flex items-start gap-1.5 text-xs text-muted-foreground",
							children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)(CircleInfo, { className: "mt-0.5 h-3 w-3 shrink-0" }), "Plain HTTP to this computer is fine for local development; nothing leaves the machine."]
						}),
						/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
							className: "space-y-1.5",
							children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Label, {
								htmlFor: `${id}-label`,
								children: "Name in AgentMate (optional)"
							}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)(Input, {
								id: `${id}-label`,
								value: label,
								maxLength: 100,
								onChange: (event) => setLabel(event.target.value),
								placeholder: parsedKey ? parsedKey.label ?? siteHost(parsedKey.siteUrl) : "My site",
								autoComplete: "off"
							})]
						}),
						/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
							className: "space-y-3",
							children: [/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
								className: "flex items-center gap-3",
								children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Switch, {
									id: `${id}-auth`,
									checked: useHttpAuth,
									onCheckedChange: setUseHttpAuth
								}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)(Label, {
									htmlFor: `${id}-auth`,
									className: "cursor-pointer",
									children: "The site asks for an HTTP sign-in"
								})]
							}), useHttpAuth && /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
								className: "grid gap-3 sm:grid-cols-2",
								children: [
									/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
										className: "space-y-1.5",
										children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Label, {
											htmlFor: `${id}-user`,
											children: "User name"
										}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)(Input, {
											id: `${id}-user`,
											value: username,
											onChange: (event) => setUsername(event.target.value),
											autoComplete: "off",
											spellCheck: false
										})]
									}),
									/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
										className: "space-y-1.5",
										children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Label, {
											htmlFor: `${id}-password`,
											children: "Password"
										}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)(SecretInput, {
											id: `${id}-password`,
											value: password,
											onChange: setPassword
										})]
									}),
									/* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
										className: "text-xs text-muted-foreground sm:col-span-2",
										children: "For staging sites behind a browser sign-in box. It's sealed on this computer and never shown again."
									})
								]
							})]
						}),
						problem && /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
							role: "alert",
							className: "flex items-start gap-2 rounded-lg border border-destructive/40 bg-destructive/10 px-3 py-2.5 text-sm text-foreground",
							children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)(TriangleAlert, { className: "mt-0.5 h-4 w-4 shrink-0 text-destructive" }), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", { children: problem })]
						})
					]
				}),
				/* @__PURE__ */ (0, import_jsx_runtime.jsxs)(DialogFooter, { children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Button, {
					type: "button",
					variant: "ghost",
					onClick: () => close(false),
					children: "Cancel"
				}), /* @__PURE__ */ (0, import_jsx_runtime.jsxs)(Button, {
					type: "submit",
					form: `${id}-form`,
					disabled: !canConnect,
					children: [busy && /* @__PURE__ */ (0, import_jsx_runtime.jsx)(Spinner, { className: "h-3.5 w-3.5 motion-safe:animate-spin" }), "Connect"]
				})] })
			]
		})
	});
}
//#endregion
//#region src/renderer/src/components/projects/wordpress/wordpressCopy.ts
/**
* The words the WordPress project screens use (E21): what each phase, reason, warning and
* outcome means, said plainly. Kept in one place so the dialogs and their tests agree.
*/
var ITEM_KIND_LABEL = {
	theme: "Theme",
	plugin: "Plugin",
	"mu-plugin": "Must-use plugin"
};
var ITEM_KIND_GROUP_LABEL = {
	theme: "Themes",
	plugin: "Plugins",
	"mu-plugin": "Must-use plugins"
};
var ITEM_KIND_ORDER = [
	"theme",
	"plugin",
	"mu-plugin"
];
/** A folder name for a project: lowercase, dashes for anything else, never empty. */
function slugifyProjectName(name) {
	return name.normalize("NFKD").replace(/[̀-ͯ]/g, "").toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "").slice(0, 64).replace(/-+$/, "") || "wordpress-site";
}
/** Joins a folder and a name with the separator the folder already uses. */
function joinFolder(root, name) {
	const separator = root.includes("\\") ? "\\" : "/";
	return `${root.replace(/[\\/]+$/, "")}${separator}${name}`;
}
var PHASE_LABEL = {
	connecting: "Reaching the site",
	manifest: "Listing the site's files",
	hashing: "Checking the files on this computer",
	download: "Downloading files",
	write: "Writing files into the project folder",
	upload: "Uploading the changes",
	validate: "Checking the PHP files for syntax errors",
	apply: "Putting the new files in place",
	verify: "Checking the site still loads",
	finalize: "Finishing up",
	rollback: "Putting the old files back",
	done: "Done",
	failed: "Stopped"
};
/** The order phases happen in, so a timeline can place one it did not plan for. */
var PHASE_ORDER = [
	"connecting",
	"manifest",
	"hashing",
	"download",
	"write",
	"upload",
	"validate",
	"apply",
	"verify",
	"finalize",
	"rollback"
];
var PLANNED_PHASES = {
	deploy: [
		"connecting",
		"hashing",
		"upload",
		"validate",
		"apply",
		"verify",
		"finalize"
	],
	pull: [
		"connecting",
		"manifest",
		"download",
		"write"
	],
	createProject: [
		"connecting",
		"manifest",
		"download",
		"write"
	],
	items: [
		"connecting",
		"manifest",
		"download",
		"write"
	],
	rollback: ["connecting", "rollback"]
};
var LEFT_OUT_REASON = {
	agentFiles: "Agent settings or AgentMate's own files",
	hardDenied: "Never sent: version control, secrets, PHP settings or system clutter",
	ignored: "Left out by an ignore rule (.distignore, .agentmateignore or the defaults)",
	symlink: "A link to somewhere else, which is never followed",
	tooLarge: "Larger than 64 MB",
	caseCollision: "Another file has the same name apart from upper and lower case",
	notUtf8: "The file name isn't valid text",
	pathRejected: "A name a WordPress site can't safely hold"
};
/** Agent and AgentMate folders on the hard deny list; the rest of it is version control. */
var VCS_DIRS = /* @__PURE__ */ new Set([
	".github",
	".git",
	".svn",
	".hg",
	".worktrees"
]);
var AGENT_DIRS = new Set(WP_HARD_DENY_DIRS.filter((dir) => !VCS_DIRS.has(dir)));
var AGENT_FILES = new Set(WP_HARD_DENY_FILES.filter((name) => name.endsWith(".md") || name === ".mcp.json" || name === "opencode.json" || name === ".cursorrules" || name === ".windsurfrules" || name === ".roomodes" || name === ".agentmateignore"));
var AGENT_PREFIXES = WP_HARD_DENY_PREFIXES.filter((prefix) => prefix === ".aider");
/** Whether a path is (or sits inside) an agent's settings, skills or AgentMate's own files. */
function isAgentPath(path) {
	return path.split("/").some((segment) => {
		const name = segment.toLowerCase();
		return AGENT_DIRS.has(name) || AGENT_FILES.has(name) || AGENT_PREFIXES.some((prefix) => name.startsWith(prefix));
	});
}
var WARNING_COPY = {
	touchesActiveThemeCore: {
		title: "Changes the active theme's core files",
		detail: "Files like style.css or functions.php of the theme the site uses right now are part of this deploy. A mistake there shows on every page."
	},
	deletesActivePluginMainFile: {
		title: "Deletes an active plugin's main file",
		detail: "WordPress switches a plugin off when its main file goes missing."
	},
	createsItem: {
		title: "Adds a new theme or plugin folder to the site",
		detail: "It won't be switched on. Activate it in wp-admin when you're ready."
	},
	noRescueGuard: {
		title: "The site's safety guard isn't installed",
		detail: "If a change breaks the site badly, it may not be able to put the old files back on its own. Reinstall the AgentMate Connector to bring the guard back."
	},
	healthCheckUnavailable: {
		title: "The site can't check itself after the change",
		detail: "The host blocks the requests a site makes to itself, so a broken page may go unnoticed. Open the site yourself once this is done."
	},
	plainHttp: {
		title: "This site is reached over plain HTTP",
		detail: "Every call is signed, so nobody can change the files on the way, but anyone on the network can read them."
	},
	readOnlyScope: {
		title: "This site's key is read-only",
		detail: "AgentMate can pull from this site but not deploy to it. Make a read-write key in wp-admin and connect the site again to deploy."
	},
	lineEndingsOnly: {
		title: "Some files differ only in line endings",
		detail: "They're sent exactly as they are on this computer."
	}
};
/** Warnings the site refuses unless the deploy is forced. */
var FORCEABLE_WARNINGS = /* @__PURE__ */ new Set(["touchesActiveThemeCore", "deletesActivePluginMainFile"]);
var ROLLBACK_REASON = {
	healthCheck: "The site showed an error after the change, so the old files were put back.",
	fatalError: "A changed file caused a PHP fatal error on the site, so the old files were put back.",
	notConfirmed: "The site didn't hear back from AgentMate in time to keep the change, so it put the old files back on its own.",
	interrupted: "The deploy was cut off before it finished, so the old files were put back.",
	requested: "The deploy was stopped, so the old files were put back."
};
function count(n, one, many) {
	return `${n} ${n === 1 ? one : many}`;
}
function deployOutcome(result) {
	switch (result.state) {
		case "done": return {
			tone: "success",
			title: "Deployed",
			detail: `${count(result.uploaded, "file", "files")} uploaded, ${count(result.deleted, "file", "files")} deleted. The site is running the new files.`
		};
		case "rolledBack": return {
			tone: "warning",
			title: "Rolled back",
			detail: result.reason ? ROLLBACK_REASON[result.reason] : "The old files were put back, so the site is as it was before."
		};
		case "aborted": return {
			tone: "warning",
			title: "Stopped",
			detail: "The deploy stopped before anything changed on the site."
		};
		case "expired": return {
			tone: "warning",
			title: "Expired",
			detail: "The deploy sat waiting too long and expired. Nothing changed on the site."
		};
		default: return {
			tone: "error",
			title: "The deploy didn't finish",
			detail: "AgentMate lost track of it partway. Open the site's Deploys in Deploy to see where it stands."
		};
	}
}
/** What to do next for the errors that have an obvious next step. */
function errorHint(code) {
	switch (code) {
		case "planExpired":
		case "localChanged":
		case "conflict": return "Check the changes again to get a fresh review.";
		case "vaultLocked": return "Unlock the Servers vault in Deploy, then try again.";
		case "operationBusy":
		case "busy": return "Another pull or deploy for this site is still running. Try again when it ends.";
		case "readOnly": return "This key is read-only. Make a read-write key in wp-admin and connect the site again.";
		case "folderNotEmpty": return "Pick an empty folder, or a new one.";
		case "siteUnknown": return "Connect the site again in Deploy.";
		case "syntaxError": return "Fix the lines below and check the changes again. Nothing on the site was changed.";
		default: return null;
	}
}
/**
* Whether a plan has run out. Plans are made in the main process and carry milliseconds; a value
* small enough to be seconds is read as seconds, so a unit slip can never bounce every deploy.
*/
function planExpired(expiresAt, now = Date.now()) {
	return (expiresAt < 0xe8d4a51000 ? expiresAt * 1e3 : expiresAt) <= now;
}
/** Errors that a fresh plan fixes. */
function needsNewPlan(code) {
	return code === "planExpired" || code === "localChanged" || code === "conflict";
}
/**
* The file and line lines of a syntax error message: a summary first, then
* `<path>:<line>: <message>` per error. Anything else in the message stays plain text.
*/
function parseSyntaxErrors(message) {
	const issues = [];
	const rest = [];
	for (const raw of message.split("\n")) {
		const line = raw.trim();
		if (!line) continue;
		const match = line.match(/^(.+?):(\d+):\s*(.+)$/);
		if (match) issues.push({
			path: match[1],
			line: Number(match[2]),
			message: match[3]
		});
		else rest.push(line);
	}
	return {
		summary: rest.join(" "),
		issues
	};
}
//#endregion
//#region src/renderer/src/components/projects/wordpress/FlowParts.tsx
/** Pieces the pull, deploy and new project dialogs share (E21). */
/** A small uppercase heading over one part of a review. */
function ReviewHeading({ children }) {
	return /* @__PURE__ */ (0, import_jsx_runtime.jsx)("h3", {
		className: "select-none px-1 text-[10px] font-semibold uppercase tracking-[0.08em] text-muted-foreground/70",
		children
	});
}
function WarningList({ warnings, acknowledged, onAcknowledgedChange }) {
	if (warnings.length === 0) return null;
	const forceable = warnings.some((warning) => FORCEABLE_WARNINGS.has(warning));
	return /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("section", {
		"aria-label": "Warnings",
		className: "space-y-2",
		children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("ul", {
			className: "space-y-1.5",
			children: warnings.map((warning) => {
				const copy = WARNING_COPY[warning];
				const strong = FORCEABLE_WARNINGS.has(warning) || warning === "readOnlyScope";
				return /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("li", {
					className: cn("flex items-start gap-2 rounded-lg px-3 py-2 ring-1 ring-inset", strong ? "bg-warning/[0.07] ring-warning/25" : "bg-foreground/[0.03] ring-foreground/[0.07]"),
					children: [strong ? /* @__PURE__ */ (0, import_jsx_runtime.jsx)(TriangleAlert, { className: "mt-0.5 h-3.5 w-3.5 shrink-0 text-warning" }) : /* @__PURE__ */ (0, import_jsx_runtime.jsx)(CircleInfo, { className: "mt-0.5 h-3.5 w-3.5 shrink-0 text-muted-foreground" }), /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
						className: "min-w-0",
						children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
							className: "text-sm font-medium",
							children: copy.title
						}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
							className: "text-xs text-muted-foreground",
							children: copy.detail
						})]
					})]
				}, warning);
			})
		}), forceable && onAcknowledgedChange ? /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("label", {
			className: "flex cursor-pointer items-start gap-2 px-1 text-sm",
			children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Checkbox, {
				className: "mt-0.5",
				checked: acknowledged === true,
				onCheckedChange: (checked) => onAcknowledgedChange(checked === true)
			}), /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("span", { children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {
				className: "font-medium",
				children: "Deploy these anyway"
			}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {
				className: "block text-xs text-muted-foreground",
				children: "The site refuses changes like these unless you say so."
			})] })]
		}) : null]
	});
}
/** Why a run or a plan failed, with the next step when there is an obvious one. */
function RunError({ message, code }) {
	const hint = errorHint(code);
	const parsed = code === "syntaxError" || code === "conflict" ? parseSyntaxErrors(message) : null;
	const issues = parsed?.issues ?? [];
	return /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
		role: "alert",
		className: "space-y-2 rounded-lg bg-destructive/[0.07] px-3 py-2.5 ring-1 ring-inset ring-destructive/25",
		children: [/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
			className: "flex items-start gap-2",
			children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)(CircleX, { className: "mt-0.5 h-4 w-4 shrink-0 text-destructive" }), /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
				className: "min-w-0 space-y-1",
				children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
					className: "whitespace-pre-line break-words text-sm",
					children: issues.length > 0 ? parsed?.summary : message
				}), hint ? /* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
					className: "text-xs text-muted-foreground",
					children: hint
				}) : null]
			})]
		}), issues.length > 0 ? /* @__PURE__ */ (0, import_jsx_runtime.jsx)("ul", {
			"aria-label": code === "syntaxError" ? "Syntax errors" : "Files",
			className: "space-y-1",
			children: issues.map((issue) => /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("li", {
				className: "rounded-md bg-background/50 px-2.5 py-1.5 text-xs",
				children: [
					/* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {
						className: "font-mono",
						children: issue.path
					}),
					/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("span", {
						className: "text-muted-foreground",
						children: [", line ", issue.line]
					}),
					/* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {
						className: "block break-words text-foreground/90",
						children: issue.message
					})
				]
			}, `${issue.path}:${issue.line}:${issue.message}`))
		}) : null]
	});
}
function OutcomeBanner({ outcome }) {
	const Icon = outcome.tone === "success" ? CircleCheck : outcome.tone === "warning" ? TriangleAlert : CircleX;
	return /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
		role: "status",
		className: cn("flex items-start gap-2.5 rounded-lg px-3 py-2.5 ring-1 ring-inset", outcome.tone === "success" && "bg-success/[0.07] ring-success/25", outcome.tone === "warning" && "bg-warning/[0.07] ring-warning/25", outcome.tone === "error" && "bg-destructive/[0.07] ring-destructive/25"),
		children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Icon, { className: cn("mt-0.5 h-4 w-4 shrink-0", outcome.tone === "success" && "text-success", outcome.tone === "warning" && "text-warning", outcome.tone === "error" && "text-destructive") }), /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
			className: "min-w-0",
			children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
				className: "text-sm font-medium",
				children: outcome.title
			}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
				className: "text-sm text-muted-foreground",
				children: outcome.detail
			})]
		})]
	});
}
var CHECK_NAME = {
	home: "Home page, checked by the site",
	ajaxPing: "WordPress admin calls",
	external: "Home page, checked from this computer"
};
function HealthChecks({ checks }) {
	return /* @__PURE__ */ (0, import_jsx_runtime.jsx)("ul", {
		"aria-label": "Health checks",
		className: "space-y-1",
		children: checks.map((check) => /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("li", {
			className: "flex items-center gap-2 text-xs",
			children: [
				check.ok === true ? /* @__PURE__ */ (0, import_jsx_runtime.jsx)(CircleCheck, { className: "h-3.5 w-3.5 shrink-0 text-success" }) : check.ok === false ? /* @__PURE__ */ (0, import_jsx_runtime.jsx)(CircleX, { className: "h-3.5 w-3.5 shrink-0 text-destructive" }) : /* @__PURE__ */ (0, import_jsx_runtime.jsx)(CircleInfo, { className: "h-3.5 w-3.5 shrink-0 text-muted-foreground" }),
				/* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {
					className: "shrink-0",
					children: CHECK_NAME[check.name]
				}),
				/* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {
					className: "min-w-0 truncate text-muted-foreground",
					children: check.ok === null ? "couldn't run" : check.status !== null ? `HTTP ${check.status}` : check.detail
				})
			]
		}, check.name))
	});
}
//#endregion
//#region src/renderer/src/components/projects/wordpress/OperationTimeline.tsx
/**
* The steps of a run in order: the ones its kind always goes through, plus any it reported that
* were not planned (a rollback, say). Steps before the current one that never reported were
* skipped; the ones after it have not happened yet.
*/
function timelineSteps(run) {
	const shown = /* @__PURE__ */ new Set([...PLANNED_PHASES[run.kind], ...run.phases]);
	const ordered = PHASE_ORDER.filter((phase) => shown.has(phase));
	const current = run.phases.length > 0 ? run.phases[run.phases.length - 1] : null;
	const currentIndex = current ? ordered.indexOf(current) : -1;
	const seen = new Set(run.phases);
	return ordered.map((phase, index) => {
		if (phase === current) return {
			phase,
			state: run.status === "running" ? "running" : run.status === "failed" ? "failed" : "done"
		};
		if (index < currentIndex) return {
			phase,
			state: seen.has(phase) ? "done" : "skipped"
		};
		if (run.status === "running") return {
			phase,
			state: "pending"
		};
		return {
			phase,
			state: "skipped"
		};
	});
}
function StepIcon({ state }) {
	if (state === "done") return /* @__PURE__ */ (0, import_jsx_runtime.jsx)(CircleCheck, { className: "h-3.5 w-3.5 text-success" });
	if (state === "failed") return /* @__PURE__ */ (0, import_jsx_runtime.jsx)(CircleX, { className: "h-3.5 w-3.5 text-destructive" });
	if (state === "running") return /* @__PURE__ */ (0, import_jsx_runtime.jsx)(Spinner, { className: "h-3.5 w-3.5 animate-spin text-primary" });
	return /* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {
		"aria-hidden": true,
		className: cn("block h-3 w-3 rounded-full border-[1.5px]", state === "skipped" ? "border-foreground/15" : "border-foreground/30")
	});
}
var STATE_LABEL = {
	done: "done",
	running: "in progress",
	failed: "stopped here",
	pending: "waiting",
	skipped: "skipped"
};
function OperationTimeline({ run }) {
	const steps = timelineSteps(run);
	return /* @__PURE__ */ (0, import_jsx_runtime.jsx)("ol", {
		"aria-label": "Progress",
		className: "space-y-1.5",
		children: steps.map(({ phase, state }) => {
			const progress = run.progress[phase];
			const showCount = progress && progress.total > 1 && state !== "skipped";
			return /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("li", {
				"aria-label": `${PHASE_LABEL[phase]}: ${STATE_LABEL[state]}`,
				className: cn("flex items-center gap-2.5 text-sm", state === "pending" || state === "skipped" ? "text-muted-foreground" : "text-foreground", state === "skipped" && "opacity-60"),
				children: [
					/* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {
						className: "flex h-4 w-4 shrink-0 items-center justify-center",
						children: /* @__PURE__ */ (0, import_jsx_runtime.jsx)(StepIcon, { state })
					}),
					/* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {
						className: "min-w-0 flex-1 truncate",
						children: PHASE_LABEL[phase]
					}),
					showCount ? /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("span", {
						className: "shrink-0 text-xs tabular-nums text-muted-foreground",
						children: [
							progress.done,
							" of ",
							progress.total,
							progress.bytes ? `, ${formatBytes(progress.bytes)}` : ""
						]
					}) : null
				]
			}, phase);
		})
	});
}
//#endregion
//#region src/renderer/src/stores/wordpressOperationStore.ts
/** The newest run that matches, finished or not, until it is cleared. */
function findWordPressRun(runs, match) {
	let found = null;
	for (const run of Object.values(runs)) {
		if (run.kind !== match.kind) continue;
		if (match.projectId !== void 0 && run.projectId !== match.projectId) continue;
		if (match.siteId !== void 0 && run.siteId !== match.siteId) continue;
		if (!found || run.startedAt >= found.startedAt) found = run;
	}
	return found;
}
function freshRun(context, owned) {
	return {
		...context,
		phases: [],
		progress: {},
		latest: null,
		status: "running",
		cancelling: false,
		error: null,
		errorCode: null,
		result: null,
		owned,
		startedAt: Date.now(),
		finishedAt: null
	};
}
var useWordPressOperationStore = create((set, get) => {
	const update = (operationId, change) => set((state) => {
		const run = state.runs[operationId];
		return run ? { runs: {
			...state.runs,
			[operationId]: {
				...run,
				...change(run)
			}
		} } : state;
	});
	async function start(context, call, toResult) {
		if (get().runs[context.operationId]?.status === "running") return null;
		listenForWordPressProgress();
		set((state) => ({ runs: {
			...state.runs,
			[context.operationId]: freshRun(context, true)
		} }));
		try {
			const value = await call();
			update(context.operationId, () => ({
				status: "done",
				result: toResult(value),
				cancelling: false,
				finishedAt: Date.now()
			}));
			return value;
		} catch (error) {
			update(context.operationId, () => ({
				status: "failed",
				error: wordPressErrorMessage(error),
				errorCode: wordPressErrorCode(error),
				cancelling: false,
				finishedAt: Date.now()
			}));
			return null;
		}
	}
	return {
		runs: {},
		createProject: (input) => start({
			operationId: input.operationId,
			kind: "createProject",
			siteId: input.siteId,
			projectId: null
		}, () => window.agentmat.deployWordPress.createProject(input), (value) => ({
			kind: "project",
			value
		})),
		setProjectItems: (input, siteId) => start({
			operationId: input.operationId,
			kind: "items",
			siteId,
			projectId: input.projectId
		}, () => window.agentmat.deployWordPress.setProjectItems(input), (value) => ({
			kind: "project",
			value
		})),
		deploy: (input, context) => start({
			operationId: input.operationId,
			kind: "deploy",
			...context
		}, () => window.agentmat.deployWordPress.deploy(input), (value) => ({
			kind: "deploy",
			value
		})),
		pull: (input, context) => start({
			operationId: input.operationId,
			kind: "pull",
			...context
		}, () => window.agentmat.deployWordPress.pull(input), (value) => ({
			kind: "pull",
			value
		})),
		cancel: async (operationId) => {
			const run = get().runs[operationId];
			if (!run || run.status !== "running") return;
			update(operationId, () => ({ cancelling: true }));
			try {
				await window.agentmat.deployWordPress.cancel(operationId);
			} catch {
				update(operationId, () => ({ cancelling: false }));
			}
		},
		clear: (operationId) => set((state) => {
			if (!state.runs[operationId]) return state;
			const { [operationId]: _cleared, ...rest } = state.runs;
			return { runs: rest };
		})
	};
});
function applyProgress(event) {
	useWordPressOperationStore.setState((state) => {
		const run = state.runs[event.operationId] ?? freshRun({
			operationId: event.operationId,
			kind: event.kind,
			siteId: event.siteId,
			projectId: event.projectId
		}, false);
		const next = {
			...run,
			latest: event
		};
		if (event.phase !== "done" && event.phase !== "failed") {
			if (!run.phases.includes(event.phase)) next.phases = [...run.phases, event.phase];
			next.progress = {
				...run.progress,
				[event.phase]: {
					done: event.done,
					total: event.total,
					bytes: event.bytes
				}
			};
		} else if (!run.owned && run.status === "running") {
			next.status = event.phase === "done" ? "done" : "failed";
			next.finishedAt = Date.now();
			if (event.phase === "failed") {
				next.error = wordPressErrorMessage(event.error ?? event.message ?? "The run failed.");
				next.errorCode = wordPressErrorCode(event.error ?? "");
			}
		}
		return { runs: {
			...state.runs,
			[event.operationId]: next
		} };
	});
}
/** The bridge the listener is attached to. Tests put a new bridge on the window each time. */
var listeningTo = null;
/**
* Attaches the one progress listener this window needs, the first time anything asks. Runs
* started from here call it themselves; a screen that only shows runs can call it on mount.
*/
function listenForWordPressProgress() {
	const bridge = window.agentmat;
	if (listeningTo === bridge) return;
	listeningTo = bridge;
	bridge.deployWordPress.onProgress(applyProgress);
}
//#endregion
//#region src/renderer/src/components/wordpress/ChangeList.tsx
/** One path of one item: `theme:twentytwentyfive/style.css`. Also the key pull resolutions use. */
function changeKey(change) {
	return `${wpItemKey(change.item)}/${change.path}`;
}
/** The kind of change that matters in this direction: ours for a deploy, the site's for a pull. */
function changeKind(change, direction) {
	const side = direction === "deploy" ? change.local : change.remote;
	if (side) return side;
	if (change.action === "deleteRemote" || change.action === "deleteLocal") return "deleted";
	return "modified";
}
var KIND_STYLE = {
	added: "bg-success/12 text-success",
	modified: "bg-primary/12 text-primary",
	deleted: "bg-destructive/12 text-destructive"
};
var KIND_LABEL = {
	added: "Added",
	modified: "Modified",
	deleted: "Deleted"
};
function ChangeKindChip({ kind }) {
	return /* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {
		className: cn("inline-flex h-5 w-[4.5rem] shrink-0 items-center justify-center rounded-full text-[10px] font-semibold uppercase tracking-wide", KIND_STYLE[kind]),
		children: KIND_LABEL[kind]
	});
}
/** Groups changes by item, keeping the order the plan gave them. */
function groupByItem(entries) {
	const groups = /* @__PURE__ */ new Map();
	for (const entry of entries) {
		const key = wpItemKey(entry.item);
		const group = groups.get(key);
		if (group) group.entries.push(entry);
		else groups.set(key, {
			item: entry.item,
			entries: [entry]
		});
	}
	return [...groups.values()];
}
function ItemHeading({ item, count }) {
	return /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
		className: "flex items-center gap-2 px-1 text-xs",
		children: [
			/* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {
				className: "font-medium text-muted-foreground",
				children: ITEM_KIND_LABEL[item.kind]
			}),
			/* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {
				className: "truncate font-mono text-foreground",
				children: item.slug
			}),
			count !== void 0 ? /* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {
				className: "rounded-full bg-foreground/[0.06] px-1.5 text-[10px] leading-4 tabular-nums text-muted-foreground",
				children: count
			}) : null
		]
	});
}
function ChangeList({ changes, direction, selectedKey, onSelect }) {
	const shown = changes.filter((change) => change.action !== "conflict" && change.action !== "none");
	if (shown.length === 0) return /* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
		className: "px-1 text-sm text-muted-foreground",
		children: direction === "deploy" ? "No files to send. The site already has what this folder has." : "Nothing new on the site since the last sync."
	});
	return /* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
		className: "space-y-3",
		children: groupByItem(shown).map((group) => /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("section", {
			className: "space-y-1",
			children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)(ItemHeading, {
				item: group.item,
				count: group.entries.length
			}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("ul", {
				className: "overflow-hidden rounded-lg bg-foreground/[0.03] ring-1 ring-inset ring-foreground/[0.07]",
				children: group.entries.map((change) => {
					const key = changeKey(change);
					const kind = changeKind(change, direction);
					const selected = selectedKey === key;
					return /* @__PURE__ */ (0, import_jsx_runtime.jsx)("li", { children: /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("button", {
						type: "button",
						"aria-pressed": selected,
						onClick: () => onSelect?.(change),
						className: cn("flex w-full cursor-pointer items-center gap-2.5 px-2.5 py-1.5 text-left text-sm transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-ring", selected ? "bg-primary/10" : "hover:bg-foreground/[0.05]"),
						children: [
							/* @__PURE__ */ (0, import_jsx_runtime.jsx)(ChangeKindChip, { kind }),
							/* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {
								className: "min-w-0 flex-1 truncate font-mono text-xs",
								children: change.path
							}),
							change.size > 0 ? /* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {
								className: "shrink-0 text-xs tabular-nums text-muted-foreground",
								children: formatBytes(change.size)
							}) : null
						]
					}) }, key);
				})
			})]
		}, wpItemKey(group.item)))
	});
}
var BINARY_EXTENSIONS = /* @__PURE__ */ new Set([
	"png",
	"jpg",
	"jpeg",
	"gif",
	"webp",
	"avif",
	"ico",
	"bmp",
	"woff",
	"woff2",
	"ttf",
	"otf",
	"eot",
	"zip",
	"gz",
	"pdf",
	"mp3",
	"mp4",
	"webm",
	"ogg",
	"wav",
	"mo"
]);
function looksBinary(path) {
	const name = path.split("/").pop() ?? "";
	const dot = name.lastIndexOf(".");
	return dot > 0 && BINARY_EXTENSIONS.has(name.slice(dot + 1).toLowerCase());
}
/** A single-file plugin or mu-plugin has one path, its own name. */
function isSingleFilePath(item, path) {
	return item.kind !== "theme" && path === item.slug && /\.php$/i.test(item.slug);
}
/** Where a change's file lives on this computer. */
function localFilePath(folderPath, item, path) {
	const relative = wpMirrorPath(item, isSingleFilePath(item, path), path);
	const separator = folderPath.includes("\\") ? "\\" : "/";
	return joinFolder(folderPath, relative.split("/").join(separator));
}
/** This computer's copy of a file against the site's, the side being changed on the right. */
function ChangeDiff({ projectId, folderPath, change, direction, onClose }) {
	const binary = looksBinary(change.path);
	const localGone = change.local === "deleted" || direction === "pull" && change.remote === "added";
	const localPath = localFilePath(folderPath, change.item, change.path);
	const remoteQuery = useQuery({
		queryKey: queryKeys.projectWordPressRemoteFile(projectId, wpItemKey(change.item), change.path),
		queryFn: () => window.agentmat.deployWordPress.remoteFile({
			projectId,
			item: change.item,
			path: change.path
		}),
		enabled: !binary,
		meta: { silentLoading: true }
	});
	const localQuery = useQuery({
		queryKey: queryKeys.workspaceFile(localPath),
		queryFn: () => window.agentmat.fs.readFile(localPath),
		enabled: !binary && !localGone,
		meta: { silentLoading: true }
	});
	const remote = remoteQuery.data;
	let body;
	if (binary || remote?.binary) body = /* @__PURE__ */ (0, import_jsx_runtime.jsx)(DiffNote, { children: "This file isn't text, so there's nothing to compare line by line." });
	else if (remote?.tooLarge) body = /* @__PURE__ */ (0, import_jsx_runtime.jsx)(DiffNote, { children: "The site's copy is too large to show here." });
	else if (remoteQuery.isError) body = /* @__PURE__ */ (0, import_jsx_runtime.jsxs)(DiffNote, {
		tone: "error",
		children: ["Couldn't read the site's copy. ", wordPressErrorMessage(remoteQuery.error)]
	});
	else if (remoteQuery.isPending || !localGone && localQuery.isPending) body = /* @__PURE__ */ (0, import_jsx_runtime.jsx)(Skeleton, { className: "h-72 w-full rounded-lg" });
	else {
		const local = localGone || localQuery.isError ? "" : localQuery.data ?? "";
		const site = remote?.text ?? "";
		body = /* @__PURE__ */ (0, import_jsx_runtime.jsx)(MonacoDiffEditor, {
			path: change.path,
			original: direction === "deploy" ? site : local,
			modified: direction === "deploy" ? local : site,
			sideBySide: true,
			ignoreWhitespace: false,
			className: "h-72 overflow-hidden rounded-lg"
		});
	}
	return /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("section", {
		"aria-label": `Changes in ${change.path}`,
		className: "space-y-2",
		children: [/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
			className: "flex items-center gap-2",
			children: [
				/* @__PURE__ */ (0, import_jsx_runtime.jsx)(FileCode, { className: "h-3.5 w-3.5 shrink-0 text-muted-foreground" }),
				/* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {
					className: "min-w-0 flex-1 truncate font-mono text-xs",
					children: change.path
				}),
				/* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {
					className: "hidden shrink-0 text-[11px] text-muted-foreground sm:inline",
					children: direction === "deploy" ? "Left: on the site. Right: on this computer." : "Left: on this computer. Right: on the site."
				}),
				onClose ? /* @__PURE__ */ (0, import_jsx_runtime.jsx)(Button, {
					variant: "ghost",
					size: "icon-sm",
					className: "shrink-0",
					"aria-label": "Close the comparison",
					onClick: onClose,
					children: /* @__PURE__ */ (0, import_jsx_runtime.jsx)(X, { className: "h-3.5 w-3.5" })
				}) : null
			]
		}), body]
	});
}
function DiffNote({ children, tone = "muted" }) {
	return /* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
		className: cn("rounded-lg bg-foreground/[0.03] px-3 py-6 text-center text-sm ring-1 ring-inset ring-foreground/[0.07]", tone === "error" ? "text-destructive" : "text-muted-foreground"),
		children
	});
}
//#endregion
//#region src/renderer/src/components/wordpress/ConflictResolver.tsx
var WORD = {
	added: "added",
	modified: "changed",
	deleted: "deleted"
};
/** What happened on each side, in a sentence. */
function conflictStory(change) {
	const local = change.local;
	const remote = change.remote;
	if (local === "added" && remote === "added") return "Added here and on the site, with different contents.";
	if (local && remote && local === remote) return `${capitalize(WORD[local])} here and on the site.`;
	return `${local ? `${capitalize(WORD[local])} here` : "Unchanged here"}, ${remote ? `${WORD[remote]} on the site` : "unchanged on the site"}.`;
}
function capitalize(text) {
	return text.charAt(0).toUpperCase() + text.slice(1);
}
/** Every conflict set to keep this computer's copy, so an untouched review sends a full map. */
function defaultResolutions(conflicts) {
	return Object.fromEntries(conflicts.map((change) => [changeKey(change), "keepLocal"]));
}
function ConflictResolver(props) {
	const { conflicts } = props;
	if (conflicts.length === 0) return null;
	const groups = groupByItem(conflicts);
	return /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("section", {
		"aria-label": "Conflicts",
		className: "space-y-3 rounded-xl bg-warning/[0.06] p-3 ring-1 ring-inset ring-warning/25",
		children: [
			/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
				className: "flex items-start gap-2",
				children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)(TriangleAlert, { className: "mt-0.5 h-4 w-4 shrink-0 text-warning" }), /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
					className: "space-y-0.5",
					children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
						className: "text-sm font-medium",
						children: conflicts.length === 1 ? "1 file changed both here and on the site" : `${conflicts.length} files changed both here and on the site`
					}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
						className: "text-xs text-muted-foreground",
						children: props.mode === "deploy" ? "Someone edited these on the site since the last sync. The deploy stops here unless you choose to overwrite the site's version." : "Pick which copy to keep for each one. Your copy stays as it is unless you take the site's."
					})]
				})]
			}),
			props.mode === "pull" ? /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
				className: "flex flex-wrap gap-1.5",
				children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Button, {
					variant: "soft",
					size: "sm",
					onClick: () => props.onResolutionsChange(defaultResolutions(conflicts)),
					children: "Keep all of mine"
				}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)(Button, {
					variant: "soft",
					size: "sm",
					onClick: () => props.onResolutionsChange(Object.fromEntries(conflicts.map((change) => [changeKey(change), "takeRemote"]))),
					children: "Take all from the site"
				})]
			}) : null,
			groups.map((group) => /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
				className: "space-y-1",
				children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)(ItemHeading, { item: group.item }), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("ul", {
					className: "space-y-1",
					children: group.entries.map((change) => {
						const key = changeKey(change);
						return /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("li", {
							className: "flex flex-wrap items-center gap-x-3 gap-y-1 rounded-lg bg-background/40 px-2.5 py-1.5",
							children: [/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
								className: "min-w-0 flex-1",
								children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
									className: "truncate font-mono text-xs",
									children: change.path
								}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
									className: "text-[11px] text-muted-foreground",
									children: conflictStory(change)
								})]
							}), props.mode === "pull" ? /* @__PURE__ */ (0, import_jsx_runtime.jsx)(ResolutionToggle, {
								path: change.path,
								value: props.resolutions[key] ?? "keepLocal",
								onChange: (value) => props.onResolutionsChange({
									...props.resolutions,
									[key]: value
								})
							}) : null]
						}, key);
					})
				})]
			}, wpItemKey(group.item))),
			props.mode === "deploy" ? /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("label", {
				className: "flex cursor-pointer items-start gap-2 text-sm",
				children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Checkbox, {
					className: "mt-0.5",
					checked: props.overwrite,
					disabled: props.disabled,
					onCheckedChange: (checked) => props.onOverwriteChange(checked === true)
				}), /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("span", { children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {
					className: "font-medium",
					children: "Overwrite the site's version"
				}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {
					className: "block text-xs text-muted-foreground",
					children: "This computer's copy replaces what's on the site now, and the site's edits are lost unless you roll the deploy back."
				})] })]
			}) : null
		]
	});
}
function ResolutionToggle({ path, value, onChange }) {
	return /* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
		role: "group",
		"aria-label": `Which copy of ${path} to keep`,
		className: "flex shrink-0 items-center gap-0.5 rounded-full bg-foreground/[0.06] p-0.5",
		children: [{
			value: "keepLocal",
			label: "Keep mine"
		}, {
			value: "takeRemote",
			label: "Take the site's"
		}].map((option) => {
			const active = value === option.value;
			return /* @__PURE__ */ (0, import_jsx_runtime.jsx)("button", {
				type: "button",
				"aria-pressed": active,
				onClick: () => onChange(option.value),
				className: cn("h-6 cursor-pointer rounded-full px-2.5 text-xs font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring", active ? "bg-primary/15 text-primary" : "text-muted-foreground hover:text-foreground"),
				children: option.label
			}, option.value);
		})
	});
}
//#endregion
//#region src/renderer/src/components/wordpress/LeftOutList.tsx
/**
* What a pull or deploy leaves out, and why (E21). Agent settings and AgentMate's own files get
* their own heading that is always open: the promise that they never leave this computer is
* something the user should be able to check on every deploy, not dig for.
*/
/** How many paths of one reason show before the rest wait behind a button. */
var OTHER_LIMIT = 50;
var REASON_ORDER = [
	"hardDenied",
	"pathRejected",
	"symlink",
	"tooLarge",
	"caseCollision",
	"notUtf8",
	"ignored"
];
/**
* Agent files under the agent heading, whatever reason the walker gave: an agent folder caught by
* the general deny list is still an agent folder.
*/
function isAgentLeftOut(entry) {
	if (entry.reason === "agentFiles") return true;
	return (entry.reason === "hardDenied" || entry.reason === "pathRejected") && isAgentPath(entry.path);
}
var AGENT_HEADING = "Stays on this computer: agent settings and AgentMate files";
function LeftOutList({ entries, direction }) {
	const agent = entries.filter(isAgentLeftOut);
	const others = entries.filter((entry) => !isAgentLeftOut(entry));
	const byReason = REASON_ORDER.map((reason) => ({
		reason,
		entries: others.filter((entry) => entry.reason === reason)
	})).filter((group) => group.entries.length > 0);
	return /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("section", {
		"aria-label": "Left out",
		className: "space-y-3",
		children: [
			/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
				className: "flex items-start gap-2 rounded-lg bg-success/[0.07] px-3 py-2 text-sm ring-1 ring-inset ring-success/20",
				children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Lock, { className: "mt-0.5 h-3.5 w-3.5 shrink-0 text-success" }), /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("p", {
					className: "text-foreground/90",
					children: [
						"Agent settings, skills and AgentMate's own files in this project never leave this computer. Only the theme and plugin files listed for this",
						" ",
						direction === "deploy" ? "deploy" : "pull",
						" travel."
					]
				})]
			}),
			agent.length > 0 ? /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
				className: "space-y-1",
				children: [/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("h4", {
					className: "px-1 text-xs font-medium text-foreground",
					children: [
						AGENT_HEADING,
						" ",
						/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("span", {
							className: "font-normal tabular-nums text-muted-foreground",
							children: [
								"(",
								agent.length,
								")"
							]
						})
					]
				}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("ul", {
					"aria-label": AGENT_HEADING,
					className: "space-y-0.5 px-1",
					children: agent.map((entry) => /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("li", {
						className: "flex min-w-0 items-baseline gap-2 text-xs",
						children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {
							className: "shrink-0 text-muted-foreground",
							children: entry.item.slug
						}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {
							className: "min-w-0 truncate font-mono",
							children: entry.path
						})]
					}, `${wpItemKey(entry.item)}/${entry.path}`))
				})]
			}) : null,
			byReason.map((group) => /* @__PURE__ */ (0, import_jsx_runtime.jsx)(ReasonGroup, {
				reason: group.reason,
				entries: group.entries
			}, group.reason)),
			entries.length === 0 ? /* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
				className: "px-1 text-xs text-muted-foreground",
				children: "Nothing else is left out."
			}) : null
		]
	});
}
function ReasonGroup({ reason, entries }) {
	const [showAll, setShowAll] = (0, import_react.useState)(false);
	const shown = showAll ? entries : entries.slice(0, OTHER_LIMIT);
	const label = LEFT_OUT_REASON[reason];
	return /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
		className: "space-y-1",
		children: [
			/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("h4", {
				className: "px-1 text-xs font-medium text-foreground",
				children: [
					label,
					" ",
					/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("span", {
						className: "font-normal tabular-nums text-muted-foreground",
						children: [
							"(",
							entries.length,
							")"
						]
					})
				]
			}),
			/* @__PURE__ */ (0, import_jsx_runtime.jsx)("ul", {
				"aria-label": label,
				className: "space-y-0.5 px-1",
				children: shown.map((entry) => /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("li", {
					className: "flex min-w-0 items-baseline gap-2 text-xs",
					children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {
						className: "shrink-0 text-muted-foreground",
						children: entry.item.slug
					}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {
						className: "min-w-0 truncate font-mono",
						children: entry.path
					})]
				}, `${wpItemKey(entry.item)}/${entry.path}`))
			}),
			entries.length > shown.length ? /* @__PURE__ */ (0, import_jsx_runtime.jsxs)(Button, {
				variant: "ghost",
				size: "sm",
				onClick: () => setShowAll(true),
				children: [
					"Show ",
					entries.length - shown.length,
					" more"
				]
			}) : null
		]
	});
}
//#endregion
//#region src/renderer/src/components/wordpress/DeployFlowDialog.tsx
var SILENT$1 = { silentLoading: true };
function DeployFlowDialog({ open, onOpenChange, projectId, siteId, items }) {
	const queryClient = useQueryClient();
	const startDeploy = useWordPressOperationStore((state) => state.deploy);
	const cancelRun = useWordPressOperationStore((state) => state.cancel);
	const clearRun = useWordPressOperationStore((state) => state.clear);
	const [step, setStep] = (0, import_react.useState)("plan");
	const [plan, setPlan] = (0, import_react.useState)(null);
	const [planError, setPlanError] = (0, import_react.useState)(null);
	const [overwrite, setOverwrite] = (0, import_react.useState)(false);
	const [acknowledged, setAcknowledged] = (0, import_react.useState)(false);
	const [selected, setSelected] = (0, import_react.useState)(null);
	const [operationId, setOperationId] = (0, import_react.useState)(null);
	const planRequest = (0, import_react.useRef)(0);
	const run = useWordPressOperationStore((state) => operationId ? state.runs[operationId] ?? null : null);
	const project = useQuery({
		queryKey: queryKeys.projects,
		queryFn: () => window.agentmat.projects.list(),
		enabled: open
	}).data?.find((candidate) => candidate.id === projectId);
	const site = useQuery({
		queryKey: queryKeys.deployWordPressSites,
		queryFn: () => window.agentmat.deployWordPress.listSites(),
		enabled: open,
		meta: SILENT$1
	}).data?.find((candidate) => candidate.id === siteId);
	const siteName = site?.label || site?.siteName || "the site";
	async function makePlan() {
		planRequest.current += 1;
		const request = planRequest.current;
		setStep("plan");
		setPlan(null);
		setPlanError(null);
		setSelected(null);
		setOverwrite(false);
		setAcknowledged(false);
		setOperationId(null);
		try {
			const next = await window.agentmat.deployWordPress.planDeploy({
				projectId,
				...items ? { items } : {}
			});
			if (request !== planRequest.current) return;
			setPlan(next);
			setStep("review");
		} catch (error) {
			if (request !== planRequest.current) return;
			setPlanError(error);
		}
	}
	(0, import_react.useEffect)(() => {
		if (!open) {
			planRequest.current += 1;
			return;
		}
		const existing = findWordPressRun(useWordPressOperationStore.getState().runs, {
			kind: "deploy",
			projectId
		});
		if (existing) {
			setOperationId(existing.operationId);
			setStep("run");
			return;
		}
		makePlan();
	}, [open, projectId]);
	const runStatus = run?.status;
	(0, import_react.useEffect)(() => {
		if (runStatus !== "done" && runStatus !== "failed") return;
		queryClient.invalidateQueries({ queryKey: queryKeys.projectWordPressChanges(projectId) });
		queryClient.invalidateQueries({ queryKey: queryKeys.deployWordPressHistory(siteId) });
	}, [
		runStatus,
		projectId,
		siteId,
		queryClient
	]);
	function handleOpenChange(next) {
		if (!next && run && run.status !== "running") clearRun(run.operationId);
		onOpenChange(next);
	}
	const conflicts = plan?.conflicts ?? [];
	const pending = plan?.changes.filter((change) => change.action !== "none") ?? [];
	const uploads = pending.filter((change) => change.action === "upload");
	const deletes = pending.filter((change) => change.action === "deleteRemote");
	const forceable = plan?.warnings.some((warning) => FORCEABLE_WARNINGS.has(warning)) ?? false;
	const readOnly = plan?.warnings.includes("readOnlyScope") === true || site?.scope === "read";
	const needsForce = conflicts.length > 0 || forceable;
	const blockedReason = !plan ? null : readOnly ? "This site's key is read-only, so it can't take a deploy." : pending.length === 0 ? "Nothing to deploy." : conflicts.length > 0 && !overwrite ? "Choose to overwrite the site's version first." : forceable && !acknowledged ? "Confirm the warnings above first." : null;
	function deploy() {
		if (!plan) return;
		if (planExpired(plan.expiresAt)) {
			makePlan();
			return;
		}
		const id = crypto.randomUUID();
		setOperationId(id);
		setStep("run");
		startDeploy({
			planId: plan.planId,
			operationId: id,
			force: needsForce
		}, {
			siteId,
			projectId
		});
	}
	const result = run?.result?.kind === "deploy" ? run.result.value : null;
	return /* @__PURE__ */ (0, import_jsx_runtime.jsx)(Dialog, {
		open,
		onOpenChange: handleOpenChange,
		children: /* @__PURE__ */ (0, import_jsx_runtime.jsxs)(DialogContent, {
			className: "max-w-4xl overflow-hidden",
			children: [
				/* @__PURE__ */ (0, import_jsx_runtime.jsxs)(DialogHeader, { children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)(DialogTitle, { children: step === "confirm" ? `Deploy to ${siteName}?` : `Deploy to ${siteName}` }), /* @__PURE__ */ (0, import_jsx_runtime.jsx)(DialogDescription, { children: step === "run" ? "Changes go to the site one step at a time. You can close this window; the deploy keeps going." : step === "confirm" ? "Before anything changes, the site keeps a copy of every file this touches. If the site shows an error afterwards, the old files go back on their own." : "What would change on the site, what stays here, and anything worth knowing first. Click a file to compare it with the site's copy." })] }),
				/* @__PURE__ */ (0, import_jsx_runtime.jsxs)(OverflowScroll, {
					fill: true,
					children: [
						step === "plan" ? planError ? /* @__PURE__ */ (0, import_jsx_runtime.jsx)(RunError, {
							message: wordPressErrorMessage(planError),
							code: wordPressErrorCode(planError)
						}) : /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
							role: "status",
							"aria-label": "Working out the changes",
							className: "space-y-2",
							children: [
								/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Skeleton, { className: "h-5 w-64" }),
								/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Skeleton, { className: "h-24 w-full rounded-lg" }),
								/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Skeleton, { className: "h-16 w-full rounded-lg" })
							]
						}) : null,
						step === "review" && plan ? /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
							className: "space-y-5",
							children: [
								/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("p", {
									className: "px-1 text-sm",
									children: [
										uploads.length === 1 ? "1 file to upload" : `${uploads.length} files to upload`,
										plan.uploadBytes > 0 ? ` (${formatBytes(plan.uploadBytes)})` : "",
										",",
										" ",
										deletes.length === 1 ? "1 to delete" : `${deletes.length} to delete`,
										conflicts.length > 0 ? `, ${conflicts.length} in conflict` : "",
										"."
									]
								}),
								/* @__PURE__ */ (0, import_jsx_runtime.jsx)(WarningList, {
									warnings: plan.warnings,
									acknowledged,
									onAcknowledgedChange: setAcknowledged
								}),
								/* @__PURE__ */ (0, import_jsx_runtime.jsx)(ConflictResolver, {
									mode: "deploy",
									conflicts,
									overwrite,
									onOverwriteChange: setOverwrite,
									disabled: readOnly
								}),
								/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
									className: "space-y-2",
									children: [
										/* @__PURE__ */ (0, import_jsx_runtime.jsx)(ReviewHeading, { children: "Changes" }),
										/* @__PURE__ */ (0, import_jsx_runtime.jsx)(ChangeList, {
											changes: plan.changes,
											direction: "deploy",
											selectedKey: selected ? changeKey(selected) : null,
											onSelect: (change) => setSelected((current) => current && changeKey(current) === changeKey(change) ? null : change)
										}),
										selected && project ? /* @__PURE__ */ (0, import_jsx_runtime.jsx)(ChangeDiff, {
											projectId,
											folderPath: project.folderPath,
											change: selected,
											direction: "deploy",
											onClose: () => setSelected(null)
										}) : null
									]
								}),
								/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
									className: "space-y-2",
									children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)(ReviewHeading, { children: "Left out" }), /* @__PURE__ */ (0, import_jsx_runtime.jsx)(LeftOutList, {
										entries: plan.leftOut,
										direction: "deploy"
									})]
								})
							]
						}) : null,
						step === "confirm" && plan ? /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("ul", {
							className: "space-y-1.5 px-1 text-sm",
							children: [
								/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("li", { children: [uploads.length === 1 ? "1 file uploaded" : `${uploads.length} files uploaded`, plan.uploadBytes > 0 ? ` (${formatBytes(plan.uploadBytes)})` : ""] }),
								/* @__PURE__ */ (0, import_jsx_runtime.jsx)("li", { children: deletes.length === 1 ? "1 file deleted" : `${deletes.length} files deleted` }),
								conflicts.length > 0 ? /* @__PURE__ */ (0, import_jsx_runtime.jsx)("li", {
									className: "text-warning",
									children: conflicts.length === 1 ? "1 file overwrites the site's own edits" : `${conflicts.length} files overwrite the site's own edits`
								}) : null,
								/* @__PURE__ */ (0, import_jsx_runtime.jsx)("li", {
									className: "text-muted-foreground",
									children: "Agent settings and AgentMate's own files stay on this computer."
								})
							]
						}) : null,
						step === "run" ? run ? /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
							className: "space-y-4",
							children: [
								run.status === "done" && result ? /* @__PURE__ */ (0, import_jsx_runtime.jsx)(OutcomeBanner, { outcome: deployOutcome(result) }) : null,
								run.status === "failed" ? /* @__PURE__ */ (0, import_jsx_runtime.jsx)(RunError, {
									message: run.error ?? "The deploy failed.",
									code: run.errorCode
								}) : null,
								/* @__PURE__ */ (0, import_jsx_runtime.jsx)(OperationTimeline, { run }),
								result && result.health.length > 0 ? /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
									className: "space-y-1.5",
									children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)(ReviewHeading, { children: "Health checks" }), /* @__PURE__ */ (0, import_jsx_runtime.jsx)(HealthChecks, { checks: result.health })]
								}) : null
							]
						}) : /* @__PURE__ */ (0, import_jsx_runtime.jsx)(Skeleton, { className: "h-40 w-full rounded-lg" }) : null
					]
				}),
				/* @__PURE__ */ (0, import_jsx_runtime.jsxs)(DialogFooter, { children: [
					step === "plan" ? /* @__PURE__ */ (0, import_jsx_runtime.jsxs)(import_jsx_runtime.Fragment, { children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Button, {
						variant: "ghost",
						onClick: () => handleOpenChange(false),
						children: "Cancel"
					}), planError ? /* @__PURE__ */ (0, import_jsx_runtime.jsxs)(Button, {
						onClick: () => void makePlan(),
						children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)(RefreshCw, { className: "h-4 w-4" }), " Try again"]
					}) : null] }) : null,
					step === "review" ? /* @__PURE__ */ (0, import_jsx_runtime.jsxs)(import_jsx_runtime.Fragment, { children: [
						/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Button, {
							variant: "ghost",
							onClick: () => handleOpenChange(false),
							children: "Cancel"
						}),
						/* @__PURE__ */ (0, import_jsx_runtime.jsxs)(Button, {
							variant: "soft",
							onClick: () => void makePlan(),
							children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)(RefreshCw, { className: "h-4 w-4" }), " Check again"]
						}),
						/* @__PURE__ */ (0, import_jsx_runtime.jsx)(SimpleTooltip, {
							label: blockedReason,
							wrapTrigger: true,
							children: /* @__PURE__ */ (0, import_jsx_runtime.jsxs)(Button, {
								disabled: blockedReason !== null,
								onClick: () => setStep("confirm"),
								children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)(CloudUpload, { className: "h-4 w-4" }), " Continue"]
							})
						})
					] }) : null,
					step === "confirm" ? /* @__PURE__ */ (0, import_jsx_runtime.jsxs)(import_jsx_runtime.Fragment, { children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Button, {
						variant: "ghost",
						onClick: () => setStep("review"),
						children: "Back"
					}), /* @__PURE__ */ (0, import_jsx_runtime.jsxs)(Button, {
						onClick: deploy,
						children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)(CloudUpload, { className: "h-4 w-4" }), " Deploy now"]
					})] }) : null,
					step === "run" && run ? run.status === "running" ? /* @__PURE__ */ (0, import_jsx_runtime.jsxs)(import_jsx_runtime.Fragment, { children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Button, {
						variant: "ghost",
						onClick: () => handleOpenChange(false),
						children: "Hide"
					}), /* @__PURE__ */ (0, import_jsx_runtime.jsxs)(Button, {
						variant: "soft",
						disabled: run.cancelling,
						onClick: () => void cancelRun(run.operationId),
						children: [run.cancelling ? /* @__PURE__ */ (0, import_jsx_runtime.jsx)(Spinner, { className: "h-4 w-4 animate-spin" }) : null, run.cancelling ? "Cancelling" : "Cancel deploy"]
					})] }) : /* @__PURE__ */ (0, import_jsx_runtime.jsxs)(import_jsx_runtime.Fragment, { children: [run.status === "failed" && (needsNewPlan(run.errorCode) || run.errorCode === "syntaxError") ? /* @__PURE__ */ (0, import_jsx_runtime.jsxs)(Button, {
						variant: "soft",
						onClick: () => {
							clearRun(run.operationId);
							makePlan();
						},
						children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)(RefreshCw, { className: "h-4 w-4" }), " Check again"]
					}) : null, /* @__PURE__ */ (0, import_jsx_runtime.jsx)(Button, {
						onClick: () => handleOpenChange(false),
						children: "Done"
					})] }) : null
				] })
			]
		})
	});
}
//#endregion
//#region src/renderer/src/components/wordpress/PullFlowDialog.tsx
var SILENT = { silentLoading: true };
function pullOutcome(result) {
	return {
		tone: "success",
		title: "Pulled",
		detail: `${result.downloaded === 1 ? "1 file" : `${result.downloaded} files`} downloaded, ${result.deletedLocal === 1 ? "1 file" : `${result.deletedLocal} files`} removed here because the site removed them.`
	};
}
function PullFlowDialog({ open, onOpenChange, projectId, siteId, items }) {
	const queryClient = useQueryClient();
	const startPull = useWordPressOperationStore((state) => state.pull);
	const cancelRun = useWordPressOperationStore((state) => state.cancel);
	const clearRun = useWordPressOperationStore((state) => state.clear);
	const [step, setStep] = (0, import_react.useState)("plan");
	const [plan, setPlan] = (0, import_react.useState)(null);
	const [planError, setPlanError] = (0, import_react.useState)(null);
	const [resolutions, setResolutions] = (0, import_react.useState)({});
	const [selected, setSelected] = (0, import_react.useState)(null);
	const [operationId, setOperationId] = (0, import_react.useState)(null);
	const planRequest = (0, import_react.useRef)(0);
	const run = useWordPressOperationStore((state) => operationId ? state.runs[operationId] ?? null : null);
	const project = useQuery({
		queryKey: queryKeys.projects,
		queryFn: () => window.agentmat.projects.list(),
		enabled: open
	}).data?.find((candidate) => candidate.id === projectId);
	const site = useQuery({
		queryKey: queryKeys.deployWordPressSites,
		queryFn: () => window.agentmat.deployWordPress.listSites(),
		enabled: open,
		meta: SILENT
	}).data?.find((candidate) => candidate.id === siteId);
	const siteName = site?.label || site?.siteName || "the site";
	async function makePlan() {
		planRequest.current += 1;
		const request = planRequest.current;
		setStep("plan");
		setPlan(null);
		setPlanError(null);
		setSelected(null);
		setResolutions({});
		setOperationId(null);
		try {
			const next = await window.agentmat.deployWordPress.planPull({
				projectId,
				...items ? { items } : {}
			});
			if (request !== planRequest.current) return;
			setPlan(next);
			setResolutions(defaultResolutions(next.conflicts));
			setStep("review");
		} catch (error) {
			if (request !== planRequest.current) return;
			setPlanError(error);
		}
	}
	(0, import_react.useEffect)(() => {
		if (!open) {
			planRequest.current += 1;
			return;
		}
		const existing = findWordPressRun(useWordPressOperationStore.getState().runs, {
			kind: "pull",
			projectId
		});
		if (existing) {
			setOperationId(existing.operationId);
			setStep("run");
			return;
		}
		makePlan();
	}, [open, projectId]);
	const runStatus = run?.status;
	(0, import_react.useEffect)(() => {
		if (runStatus !== "done" && runStatus !== "failed") return;
		queryClient.invalidateQueries({ queryKey: queryKeys.projectWordPressChanges(projectId) });
	}, [
		runStatus,
		projectId,
		queryClient
	]);
	function handleOpenChange(next) {
		if (!next && run && run.status !== "running") clearRun(run.operationId);
		onOpenChange(next);
	}
	const conflicts = plan?.conflicts ?? [];
	const pending = plan?.changes.filter((change) => change.action !== "none") ?? [];
	const downloads = pending.filter((change) => change.action === "download");
	const deletes = pending.filter((change) => change.action === "deleteLocal");
	function pull() {
		if (!plan) return;
		if (planExpired(plan.expiresAt)) {
			makePlan();
			return;
		}
		const id = crypto.randomUUID();
		setOperationId(id);
		setStep("run");
		const answers = {
			...defaultResolutions(conflicts),
			...resolutions
		};
		startPull({
			planId: plan.planId,
			operationId: id,
			force: false,
			...conflicts.length > 0 ? { resolutions: answers } : {}
		}, {
			siteId,
			projectId
		});
	}
	const result = run?.result?.kind === "pull" ? run.result.value : null;
	return /* @__PURE__ */ (0, import_jsx_runtime.jsx)(Dialog, {
		open,
		onOpenChange: handleOpenChange,
		children: /* @__PURE__ */ (0, import_jsx_runtime.jsxs)(DialogContent, {
			className: "max-w-4xl overflow-hidden",
			children: [
				/* @__PURE__ */ (0, import_jsx_runtime.jsxs)(DialogHeader, { children: [/* @__PURE__ */ (0, import_jsx_runtime.jsxs)(DialogTitle, { children: ["Pull from ", siteName] }), /* @__PURE__ */ (0, import_jsx_runtime.jsx)(DialogDescription, { children: step === "run" ? "You can close this window; the pull keeps going." : "What changed on the site since the last sync. Click a file to compare it with this computer's copy." })] }),
				/* @__PURE__ */ (0, import_jsx_runtime.jsxs)(OverflowScroll, {
					fill: true,
					children: [
						step === "plan" ? planError ? /* @__PURE__ */ (0, import_jsx_runtime.jsx)(RunError, {
							message: wordPressErrorMessage(planError),
							code: wordPressErrorCode(planError)
						}) : /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
							role: "status",
							"aria-label": "Working out the changes",
							className: "space-y-2",
							children: [
								/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Skeleton, { className: "h-5 w-64" }),
								/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Skeleton, { className: "h-24 w-full rounded-lg" }),
								/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Skeleton, { className: "h-16 w-full rounded-lg" })
							]
						}) : null,
						step === "review" && plan ? /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
							className: "space-y-5",
							children: [
								/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("p", {
									className: "px-1 text-sm",
									children: [
										downloads.length === 1 ? "1 file to download" : `${downloads.length} files to download`,
										plan.downloadBytes > 0 ? ` (${formatBytes(plan.downloadBytes)})` : "",
										",",
										" ",
										deletes.length === 1 ? "1 to remove here" : `${deletes.length} to remove here`,
										conflicts.length > 0 ? `, ${conflicts.length} in conflict` : "",
										"."
									]
								}),
								/* @__PURE__ */ (0, import_jsx_runtime.jsx)(WarningList, { warnings: plan.warnings.filter((w) => w !== "readOnlyScope") }),
								/* @__PURE__ */ (0, import_jsx_runtime.jsx)(ConflictResolver, {
									mode: "pull",
									conflicts,
									resolutions,
									onResolutionsChange: setResolutions
								}),
								/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
									className: "space-y-2",
									children: [
										/* @__PURE__ */ (0, import_jsx_runtime.jsx)(ReviewHeading, { children: "Incoming changes" }),
										/* @__PURE__ */ (0, import_jsx_runtime.jsx)(ChangeList, {
											changes: plan.changes,
											direction: "pull",
											selectedKey: selected ? changeKey(selected) : null,
											onSelect: (change) => setSelected((current) => current && changeKey(current) === changeKey(change) ? null : change)
										}),
										selected && project ? /* @__PURE__ */ (0, import_jsx_runtime.jsx)(ChangeDiff, {
											projectId,
											folderPath: project.folderPath,
											change: selected,
											direction: "pull",
											onClose: () => setSelected(null)
										}) : null
									]
								}),
								plan.leftOut.length > 0 ? /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
									className: "space-y-2",
									children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)(ReviewHeading, { children: "Left out" }), /* @__PURE__ */ (0, import_jsx_runtime.jsx)(LeftOutList, {
										entries: plan.leftOut,
										direction: "pull"
									})]
								}) : null
							]
						}) : null,
						step === "run" ? run ? /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
							className: "space-y-4",
							children: [
								run.status === "done" && result ? /* @__PURE__ */ (0, import_jsx_runtime.jsx)(OutcomeBanner, { outcome: pullOutcome(result) }) : null,
								run.status === "failed" ? /* @__PURE__ */ (0, import_jsx_runtime.jsx)(RunError, {
									message: run.error ?? "The pull failed.",
									code: run.errorCode
								}) : null,
								/* @__PURE__ */ (0, import_jsx_runtime.jsx)(OperationTimeline, { run }),
								result && result.conflictCopies.length > 0 ? /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
									className: "space-y-1.5",
									children: [
										/* @__PURE__ */ (0, import_jsx_runtime.jsx)(ReviewHeading, { children: "Copies kept for the conflicts" }),
										/* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
											className: "px-1 text-xs text-muted-foreground",
											children: "These are in the project folder, so the other version of each file is still there to compare or bring back:"
										}),
										/* @__PURE__ */ (0, import_jsx_runtime.jsx)("ul", {
											"aria-label": "Conflict copies",
											className: "space-y-0.5 px-1",
											children: result.conflictCopies.map((path) => /* @__PURE__ */ (0, import_jsx_runtime.jsx)("li", {
												className: "truncate font-mono text-xs",
												children: path
											}, path))
										})
									]
								}) : null
							]
						}) : /* @__PURE__ */ (0, import_jsx_runtime.jsx)(Skeleton, { className: "h-40 w-full rounded-lg" }) : null
					]
				}),
				/* @__PURE__ */ (0, import_jsx_runtime.jsxs)(DialogFooter, { children: [
					step === "plan" ? /* @__PURE__ */ (0, import_jsx_runtime.jsxs)(import_jsx_runtime.Fragment, { children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Button, {
						variant: "ghost",
						onClick: () => handleOpenChange(false),
						children: "Cancel"
					}), planError ? /* @__PURE__ */ (0, import_jsx_runtime.jsxs)(Button, {
						onClick: () => void makePlan(),
						children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)(RefreshCw, { className: "h-4 w-4" }), " Try again"]
					}) : null] }) : null,
					step === "review" ? /* @__PURE__ */ (0, import_jsx_runtime.jsxs)(import_jsx_runtime.Fragment, { children: [
						/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Button, {
							variant: "ghost",
							onClick: () => handleOpenChange(false),
							children: "Cancel"
						}),
						/* @__PURE__ */ (0, import_jsx_runtime.jsxs)(Button, {
							variant: "soft",
							onClick: () => void makePlan(),
							children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)(RefreshCw, { className: "h-4 w-4" }), " Check again"]
						}),
						/* @__PURE__ */ (0, import_jsx_runtime.jsx)(SimpleTooltip, {
							label: pending.length === 0 ? "Nothing new on the site." : null,
							wrapTrigger: true,
							children: /* @__PURE__ */ (0, import_jsx_runtime.jsxs)(Button, {
								disabled: pending.length === 0,
								onClick: pull,
								children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)(CloudDownload, { className: "h-4 w-4" }), " Pull"]
							})
						})
					] }) : null,
					step === "run" && run ? run.status === "running" ? /* @__PURE__ */ (0, import_jsx_runtime.jsxs)(import_jsx_runtime.Fragment, { children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Button, {
						variant: "ghost",
						onClick: () => handleOpenChange(false),
						children: "Hide"
					}), /* @__PURE__ */ (0, import_jsx_runtime.jsxs)(Button, {
						variant: "soft",
						disabled: run.cancelling,
						onClick: () => void cancelRun(run.operationId),
						children: [run.cancelling ? /* @__PURE__ */ (0, import_jsx_runtime.jsx)(Spinner, { className: "h-4 w-4 animate-spin" }) : null, run.cancelling ? "Cancelling" : "Cancel pull"]
					})] }) : /* @__PURE__ */ (0, import_jsx_runtime.jsxs)(import_jsx_runtime.Fragment, { children: [run.status === "failed" && needsNewPlan(run.errorCode) ? /* @__PURE__ */ (0, import_jsx_runtime.jsxs)(Button, {
						variant: "soft",
						onClick: () => {
							clearRun(run.operationId);
							makePlan();
						},
						children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)(RefreshCw, { className: "h-4 w-4" }), " Check again"]
					}) : null, /* @__PURE__ */ (0, import_jsx_runtime.jsx)(Button, {
						onClick: () => handleOpenChange(false),
						children: "Done"
					})] }) : null
				] })
			]
		})
	});
}
//#endregion
//#region src/renderer/src/hooks/useVirtualRows.ts
function visibleWindow({ count, rowHeight, height, scrollTop, overscan }) {
	if (height <= 0) return {
		start: 0,
		end: count
	};
	const first = Math.floor(scrollTop / rowHeight);
	const last = Math.ceil((scrollTop + height) / rowHeight);
	return {
		start: Math.max(0, first - overscan),
		end: Math.min(count, last + overscan)
	};
}
function useVirtualRows(count, rowHeight, overscan = 8) {
	const boxRef = (0, import_react.useRef)(null);
	const [viewport, setViewport] = (0, import_react.useState)({
		height: 0,
		scrollTop: 0
	});
	const measure = (0, import_react.useCallback)(() => {
		const box = boxRef.current;
		if (!box) return;
		setViewport((current) => current.height === box.clientHeight && current.scrollTop === box.scrollTop ? current : {
			height: box.clientHeight,
			scrollTop: box.scrollTop
		});
	}, []);
	const observerRef = (0, import_react.useRef)(null);
	const containerRef = (0, import_react.useCallback)((box) => {
		observerRef.current?.disconnect();
		boxRef.current = box;
		if (!box) return;
		if (typeof ResizeObserver !== "undefined") {
			observerRef.current = new ResizeObserver(measure);
			observerRef.current.observe(box);
		}
		measure();
	}, [measure]);
	(0, import_react.useLayoutEffect)(measure, [count, measure]);
	const { start, end } = (0, import_react.useMemo)(() => visibleWindow({
		count,
		rowHeight,
		overscan,
		...viewport
	}), [
		count,
		rowHeight,
		overscan,
		viewport
	]);
	const scrollToIndex = (0, import_react.useCallback)((index) => {
		const box = boxRef.current;
		if (!box || index < 0) return;
		const top = index * rowHeight;
		const bottom = top + rowHeight;
		if (top < box.scrollTop) box.scrollTop = top;
		else if (bottom > box.scrollTop + box.clientHeight) box.scrollTop = bottom - box.clientHeight;
		measure();
	}, [rowHeight, measure]);
	return {
		containerRef,
		onScroll: measure,
		start,
		end,
		padTop: start * rowHeight,
		padBottom: Math.max(0, (count - end) * rowHeight),
		scrollToIndex
	};
}
//#endregion
//#region src/renderer/src/components/dashboard/SparklineChart.tsx
var import_react_dom = /* @__PURE__ */ __toESM(require_react_dom());
var VIEW_WIDTH = 300;
var PAD_Y = 6;
function SparklineChart({ timestamps, series, height = 88, domainMin = 0, domainMax, xDomainMax, formatValue, formatTime, className }) {
	const svgRef = import_react.useRef(null);
	const tooltipRef = import_react.useRef(null);
	const [hoverIndex, setHoverIndex] = import_react.useState(null);
	const [tooltipPos, setTooltipPos] = import_react.useState(null);
	const n = timestamps.length;
	const allValues = series.flatMap((s) => s.values);
	const maxVal = domainMax ?? Math.max(domainMin + 1, ...allValues.length ? allValues : [1]);
	const xAt = (i) => {
		if (xDomainMax != null) return Math.min(1, timestamps[i] / xDomainMax) * VIEW_WIDTH;
		return n <= 1 ? VIEW_WIDTH : i / (n - 1) * VIEW_WIDTH;
	};
	const yAt = (v) => {
		const t = (v - domainMin) / (maxVal - domainMin || 1);
		return height - PAD_Y - t * (height - 12);
	};
	const linePath = (values) => values.map((v, i) => `${i === 0 ? "M" : "L"} ${xAt(i).toFixed(2)} ${yAt(v).toFixed(2)}`).join(" ");
	const areaPath = (values) => {
		if (values.length === 0) return "";
		const baseline = height - PAD_Y;
		return `${linePath(values)} L ${xAt(values.length - 1).toFixed(2)} ${baseline} L ${xAt(0).toFixed(2)} ${baseline} Z`;
	};
	function handlePointerMove(event) {
		const svg = svgRef.current;
		if (!svg || n === 0) return;
		const rect = svg.getBoundingClientRect();
		const ratio = (event.clientX - rect.left) / rect.width;
		const idx = Math.round(ratio * (n - 1));
		setHoverIndex(Math.min(n - 1, Math.max(0, idx)));
	}
	const hovered = hoverIndex !== null && n > 0;
	import_react.useLayoutEffect(() => {
		if (!hovered || !svgRef.current) {
			setTooltipPos(null);
			return;
		}
		const svgRect = svgRef.current.getBoundingClientRect();
		const anchorX = svgRect.left + xAt(hoverIndex) / VIEW_WIDTH * svgRect.width;
		const anchorY = svgRect.top;
		const margin = 8;
		const tw = tooltipRef.current?.offsetWidth ?? 0;
		const th = tooltipRef.current?.offsetHeight ?? 0;
		let left = anchorX + margin;
		if (left + tw > window.innerWidth - margin) left = anchorX - tw - margin;
		left = Math.max(margin, Math.min(left, window.innerWidth - tw - margin));
		let top = anchorY;
		if (top + th > window.innerHeight - margin) top = window.innerHeight - th - margin;
		top = Math.max(margin, top);
		setTooltipPos({
			left,
			top
		});
	}, [
		hovered,
		hoverIndex,
		series
	]);
	return /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
		className: cn("relative w-full overflow-hidden", className),
		style: { minHeight: height },
		children: [
			/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("svg", {
				ref: svgRef,
				viewBox: `0 0 ${VIEW_WIDTH} ${height}`,
				className: "absolute inset-0 h-full w-full",
				preserveAspectRatio: "none",
				role: "img",
				"aria-label": "Time series chart",
				onPointerMove: handlePointerMove,
				onPointerLeave: () => setHoverIndex(null),
				children: [
					series.map((s) => /* @__PURE__ */ (0, import_jsx_runtime.jsx)("path", {
						d: areaPath(s.values),
						fill: s.color,
						fillOpacity: .1,
						stroke: "none"
					}, `area-${s.key}`)),
					series.map((s) => /* @__PURE__ */ (0, import_jsx_runtime.jsx)("path", {
						d: linePath(s.values),
						fill: "none",
						stroke: s.color,
						strokeWidth: 2,
						strokeLinejoin: "round",
						strokeLinecap: "round",
						vectorEffect: "non-scaling-stroke"
					}, `line-${s.key}`)),
					hovered && /* @__PURE__ */ (0, import_jsx_runtime.jsx)("line", {
						x1: xAt(hoverIndex),
						x2: xAt(hoverIndex),
						y1: PAD_Y,
						y2: height - PAD_Y,
						stroke: "hsl(var(--muted-foreground) / 0.4)",
						strokeWidth: 1,
						vectorEffect: "non-scaling-stroke"
					})
				]
			}),
			hovered && series.map((s) => {
				const leftPct = xAt(hoverIndex) / VIEW_WIDTH * 100;
				const topPct = yAt(s.values[hoverIndex] ?? domainMin) / height * 100;
				return /* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
					className: "pointer-events-none absolute h-2 w-2 rounded-full border-2",
					style: {
						left: `${leftPct}%`,
						top: `${topPct}%`,
						transform: "translate(-50%, -50%)",
						backgroundColor: s.color,
						borderColor: "hsl(var(--card))"
					}
				}, `dot-${s.key}`);
			}),
			hovered && (0, import_react_dom.createPortal)(/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
				ref: tooltipRef,
				className: "pointer-events-none fixed z-50 min-w-max max-w-[240px] rounded-md border border-border bg-popover px-2 py-1.5 text-xs shadow-md",
				style: {
					left: tooltipPos?.left ?? 0,
					top: tooltipPos?.top ?? 0,
					visibility: tooltipPos ? "visible" : "hidden"
				},
				children: [formatTime && /* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
					className: "mb-1 text-[10px] text-muted-foreground",
					children: formatTime(timestamps[hoverIndex])
				}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
					className: cn(series.length > 4 ? "grid grid-cols-2 gap-x-2 gap-y-0.5" : "space-y-0.5"),
					children: series.map((s) => /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
						className: "flex items-center gap-1.5",
						children: [
							/* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {
								className: "inline-block h-0.5 w-3 shrink-0 rounded-full",
								style: { backgroundColor: s.color }
							}),
							/* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {
								className: "truncate text-muted-foreground",
								children: s.label
							}),
							/* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {
								className: "ml-auto font-medium text-popover-foreground",
								children: formatValue(s.values[hoverIndex] ?? domainMin)
							})
						]
					}, s.key))
				})]
			}), document.body)
		]
	});
}
//#endregion
//#region src/renderer/src/components/usage/CountUp.tsx
/**
* React Bits Count Up, kept to a number that already lives on the card: the
* headline tokens/cost figure ticks into place instead of popping on.
*/
function CountUp({ value, format, className }) {
	const reduce = useReducedMotion();
	const motionVal = useMotionValue(0);
	const formatRef = (0, import_react.useRef)(format);
	formatRef.current = format;
	const [text, setText] = (0, import_react.useState)(() => format(reduce ? value : 0));
	useMotionValueEvent(motionVal, "change", (latest) => {
		setText(formatRef.current(latest));
	});
	(0, import_react.useEffect)(() => {
		if (reduce) {
			motionVal.set(value);
			setText(formatRef.current(value));
			return;
		}
		const controls = animate(motionVal, value, {
			duration: .55,
			ease: "easeOut"
		});
		return () => controls.stop();
	}, [
		motionVal,
		reduce,
		value
	]);
	return /* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {
		className,
		children: text
	});
}
//#endregion
export { fromNow as $, useWordPressSites as A, useHostKeyPromptStore as At, dateTimeText as B, useSaveConnectorZip as C, isCurrentPromptTask as Ct, useSiteItems as D, TerminalPane as Dt, useSiteInfo as E, usePromptJobsStore as Et, ROLLBACK_REASON$1 as F, siteHost as G, lastSeenText as H, SCOPE_LABEL as I, ROLE_LABEL as J, siteTimeText as K, SCOPE_SUMMARY as L, AUDIT_EVENT_WARNS as M, DEPLOY_STATE_DETAIL as N, useSiteListUpdate as O, withHostKeyTrust as Ot, DEPLOY_STATE_LABEL as P, dateTime as Q, TRANSPORT_LABEL as R, useProjects as S, finishPromptTask as St, useSiteHistory as T, startRunAssessment as Tt, progressText as U, fileChangesStatus as V, siteClockText as W, ago as X, ROLE_SUMMARY as Y, clockTime as Z, PlainHttpNotice as _, RunRecommendationPanel as _t, DeployFlowDialog as a, FactRow as at, siteProjects as b, cancelPromptTask as bt, OperationTimeline as c, LIST_ROW as ct, ITEM_KIND_GROUP_LABEL as d, wordPressErrorCode as dt, hasRole as et, ITEM_KIND_LABEL as f, wordPressErrorMessage as ft, ConnectSiteDialog as g, RunRecommendationChip as gt, slugifyProjectName as h, FixWithAiDialog as ht, PullFlowDialog as i, DEPLOY_ROLES as it, AUDIT_EVENT_LABEL as j, useInfiniteQuery as jt, useSiteSettings as k, answerHostKeyPrompt as kt, OutcomeBanner as l, LIST_WELL as lt, joinFolder as m, WordPressMark as mt, SparklineChart as n, roleLabel as nt, findWordPressRun as o, FactRows as ot, ITEM_KIND_ORDER as p, OverflowScroll as pt, wpProblem as q, useVirtualRows as r, withArticle as rt, useWordPressOperationStore as s, GLASS_EDGE as st, CountUp as t, isRole as tt, RunError as u, SectionStrip as ut, ConnectorDownloadCard as v, useRunRecommendation as vt, useSiteAudit as w, projectPromptJobKey as wt, useOperationProgress as x, cancelRunAssessment as xt, newOperationId as y, beginPromptTask as yt, compareVersions as z };
