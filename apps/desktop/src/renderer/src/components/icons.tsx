import type { IconDefinition } from '@fortawesome/fontawesome-svg-core';
import {
  faAnglesLeft,
  faAnglesRight,
  faArrowDown,
  faArrowLeft,
  faArrowRight,
  faArrowsRotate,
  faArrowUp,
  faArrowUpRightFromSquare,
  faBan,
  faBell,
  faBold,
  faBolt,
  faBookmark,
  faBox,
  faBug,
  faCalendarDays,
  faChartColumn,
  faCheck,
  faCircleCheck,
  faCircleHalfStroke,
  faCircleInfo,
  faCirclePlay,
  faCircleQuestion,
  faCircleXmark,
  faClock,
  faClockRotateLeft,
  faCloudArrowDown,
  faCloudArrowUp,
  faCode,
  faCodeBranch,
  faCodeCommit,
  faCodePullRequest,
  faComments,
  faCopy,
  faCubes,
  faDisplay,
  faDownload,
  faEllipsisVertical,
  faEye,
  faEyeSlash,
  faFile,
  faFileLines,
  faFloppyDisk,
  faFolder,
  faFolderOpen,
  faFolderPlus,
  faFolderTree,
  faGaugeHigh,
  faGear,
  faGlobe,
  faGripVertical,
  faHardDrive,
  faHeading,
  faItalic,
  faKeyboard,
  faLanguage,
  faLink,
  faLinkSlash,
  faListOl,
  faListUl,
  faMagnifyingGlass,
  faMedal,
  faMemory,
  faMicrochip,
  faMicrophone,
  faMicrophoneSlash,
  faMinus,
  faMoon,
  faNetworkWired,
  faPaperPlane,
  faPause,
  faPaw,
  faPen,
  faPlay,
  faPlug,
  faPlus,
  faPowerOff,
  faQrcode,
  faQuoteLeft,
  faRobot,
  faRoute,
  faSatelliteDish,
  faShieldHalved,
  faSort,
  faSpellCheck,
  faSpinner,
  faSquareCheck,
  faStop,
  faStrikethrough,
  faSun,
  faTable,
  faTableColumns,
  faTag,
  faTerminal,
  faThumbtack,
  faTowerBroadcast,
  faTrashCan,
  faTriangleExclamation,
  faUpload,
  faWandMagic,
  faWandMagicSparkles,
  faWifi,
  faWindowMaximize,
  faWindowMinimize,
  faWindowRestore,
  faWrench,
  faXmark,
} from '@fortawesome/free-solid-svg-icons';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import * as React from 'react';

export interface IconProps {
  className?: string;
  onClick?: React.MouseEventHandler<SVGSVGElement>;
}

function makeIcon(icon: IconDefinition): React.ForwardRefExoticComponent<IconProps> {
  const Icon = React.forwardRef<SVGSVGElement, IconProps>(({ className, ...props }, ref) => (
    <FontAwesomeIcon icon={icon} className={className} ref={ref} {...props} />
  ));
  Icon.displayName = `Icon(${icon.iconName})`;
  return Icon;
}

// Names mirror the lucide-react icons they replace so call sites didn't need
// to change, only their import path.
export const ArrowDown = makeIcon(faArrowDown);
export const ArrowLeft = makeIcon(faArrowLeft);
export const ArrowRight = makeIcon(faArrowRight);
export const ArrowUp = makeIcon(faArrowUp);
export const Blocks = makeIcon(faCubes);
export const Bookmark = makeIcon(faBookmark);
export const Check = makeIcon(faCheck);
export const ChevronsUpDown = makeIcon(faSort);
export const Copy = makeIcon(faCopy);
export const Download = makeIcon(faDownload);
export const EllipsisVertical = makeIcon(faEllipsisVertical);
export const Eye = makeIcon(faEye);
export const EyeOff = makeIcon(faEyeSlash);
export const ExternalLink = makeIcon(faArrowUpRightFromSquare);
export const File = makeIcon(faFile);
export const FileCog = makeIcon(faGear);
export const Folder = makeIcon(faFolder);
export const FolderKanban = makeIcon(faTableColumns);
export const FolderOpen = makeIcon(faFolderOpen);
export const FolderPlus = makeIcon(faFolderPlus);
export const FolderTree = makeIcon(faFolderTree);
export const Globe = makeIcon(faGlobe);
export const LayoutDashboard = makeIcon(faGaugeHigh);
export const Monitor = makeIcon(faDisplay);
export const Moon = makeIcon(faMoon);
export const Pencil = makeIcon(faPen);
export const Plus = makeIcon(faPlus);
export const RefreshCw = makeIcon(faArrowsRotate);
export const Save = makeIcon(faFloppyDisk);
export const Search = makeIcon(faMagnifyingGlass);
export const SettingsIcon = makeIcon(faGear);
export const Sparkles = makeIcon(faWandMagicSparkles);
export const Sun = makeIcon(faSun);
export const SunMoon = makeIcon(faCircleHalfStroke);
export const Tag = makeIcon(faTag);
export const TerminalSquare = makeIcon(faTerminal);
export const Trash2 = makeIcon(faTrashCan);
export const Wand2 = makeIcon(faWandMagic);
export const X = makeIcon(faXmark);

// New icons for this pass of work.
export const AnglesLeft = makeIcon(faAnglesLeft);
export const AnglesRight = makeIcon(faAnglesRight);
export const Languages = makeIcon(faLanguage);
export const History = makeIcon(faClockRotateLeft);
export const WindowMinimize = makeIcon(faWindowMinimize);
export const WindowMaximize = makeIcon(faWindowMaximize);
export const WindowRestore = makeIcon(faWindowRestore);

// System monitor icons.
export const Cpu = makeIcon(faMicrochip);
export const MemoryStick = makeIcon(faMemory);
export const NetworkIcon = makeIcon(faNetworkWired);
export const SatelliteDish = makeIcon(faSatelliteDish);
export const Route = makeIcon(faRoute);
export const HardDrive = makeIcon(faHardDrive);
export const Gpu = makeIcon(faDisplay);
export const GripVertical = makeIcon(faGripVertical);

// CLI manager icons.
export const CloudDownload = makeIcon(faCloudArrowDown);

// Prompt scheduling icons.
export const CalendarDays = makeIcon(faCalendarDays);
export const Clock = makeIcon(faClock);
export const Play = makeIcon(faPlay);
export const Pause = makeIcon(faPause);
export const Run = makeIcon(faCirclePlay);

// Notification hook icons.
export const Bell = makeIcon(faBell);
export const Send = makeIcon(faPaperPlane);
export const CircleCheck = makeIcon(faCircleCheck);
export const CircleInfo = makeIcon(faCircleInfo);
export const CircleQuestion = makeIcon(faCircleQuestion);
export const CircleX = makeIcon(faCircleXmark);
export const Paw = makeIcon(faPaw);
export const Robot = makeIcon(faRobot);
export const TriangleAlert = makeIcon(faTriangleExclamation);

// MCP marketplace icons.
export const Plug = makeIcon(faPlug);

// Ask AI icons.
export const MessageSquare = makeIcon(faComments);

// Remote control icons.
export const Broadcast = makeIcon(faTowerBroadcast);
export const QrCode = makeIcon(faQrcode);
export const Link = makeIcon(faLink);
export const LinkOff = makeIcon(faLinkSlash);
export const Power = makeIcon(faPowerOff);
export const Wifi = makeIcon(faWifi);
export const Keyboard = makeIcon(faKeyboard);
export const Upload = makeIcon(faUpload);

// Package manager tab icons.
export const Package = makeIcon(faBox);

// Git tab icons.
export const GitBranch = makeIcon(faCodeBranch);
export const GitCommit = makeIcon(faCodeCommit);
export const GitPullRequest = makeIcon(faCodePullRequest);
export const CloudUpload = makeIcon(faCloudArrowUp);
export const Medal = makeIcon(faMedal);

/** GitHub's mark, inlined so we don't need the brands icon package. */
export const Github = React.forwardRef<SVGSVGElement, IconProps>(({ className, ...props }, ref) => (
  <svg
    ref={ref}
    viewBox="0 0 16 16"
    fill="currentColor"
    aria-hidden
    className={className}
    {...props}
  >
    <path d="M8 0C3.58 0 0 3.58 0 8c0 3.54 2.29 6.53 5.47 7.59.4.07.55-.17.55-.38 0-.19-.01-.82-.01-1.49-2.01.37-2.53-.49-2.69-.94-.09-.23-.48-.94-.82-1.13-.28-.15-.68-.52-.01-.53.63-.01 1.08.58 1.23.82.72 1.21 1.87.87 2.33.66.07-.52.28-.87.51-1.07-1.78-.2-3.64-.89-3.64-3.95 0-.87.31-1.59.82-2.15-.08-.2-.36-1.02.08-2.12 0 0 .67-.21 2.2.82.64-.18 1.32-.27 2-.27s1.36.09 2 .27c1.53-1.04 2.2-.82 2.2-.82.44 1.1.16 1.92.08 2.12.51.56.82 1.27.82 2.15 0 3.07-1.87 3.75-3.65 3.95.29.25.54.73.54 1.48 0 1.07-.01 1.93-.01 2.2 0 .21.15.46.55.38A8.013 8.013 0 0 0 16 8c0-4.42-3.58-8-8-8Z" />
  </svg>
));
Github.displayName = 'Github';
export const Shield = makeIcon(faShieldHalved);
export const Bug = makeIcon(faBug);

// Agent tools icons.
export const Wrench = makeIcon(faWrench);
export const StopCircle = makeIcon(faStop);

// Token usage icons.
export const ChartColumn = makeIcon(faChartColumn);
export const Bolt = makeIcon(faBolt);

// Markdown editor icons.
export const Bold = makeIcon(faBold);
export const Italic = makeIcon(faItalic);
export const Strikethrough = makeIcon(faStrikethrough);
export const Heading = makeIcon(faHeading);
export const ListUnordered = makeIcon(faListUl);
export const ListOrdered = makeIcon(faListOl);
export const ListTodo = makeIcon(faSquareCheck);
export const Quote = makeIcon(faQuoteLeft);
export const Code = makeIcon(faCode);
export const Table = makeIcon(faTable);
export const HorizontalRule = makeIcon(faMinus);
export const FileText = makeIcon(faFileLines);
export const SplitView = makeIcon(faTableColumns);
export const Pin = makeIcon(faThumbtack);

// Writing check icons.
export const SpellCheck = makeIcon(faSpellCheck);
export const Ban = makeIcon(faBan);

// Voice input icons.
export const Microphone = makeIcon(faMicrophone);
export const MicrophoneSlash = makeIcon(faMicrophoneSlash);
export const Spinner = makeIcon(faSpinner);
