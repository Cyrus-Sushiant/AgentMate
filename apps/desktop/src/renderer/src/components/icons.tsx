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
  faBoxArchive,
  faBoxOpen,
  faBug,
  faCalendarDays,
  faChartColumn,
  faChartSimple,
  faCheck,
  faChevronDown,
  faChevronRight,
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
  faCodeCompare,
  faCodePullRequest,
  faComments,
  faCompress,
  faCopy,
  faCubes,
  faDisplay,
  faDownload,
  faEllipsisVertical,
  faExpand,
  faEye,
  faEyeSlash,
  faFile,
  faFileCode,
  faFileLines,
  faFilter,
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
  faInfinity,
  faItalic,
  faKey,
  faKeyboard,
  faLanguage,
  faLaptopCode,
  faLink,
  faLinkSlash,
  faListOl,
  faListUl,
  faLock,
  faLockOpen,
  faMagnifyingGlass,
  faMedal,
  faMemory,
  faMicrochip,
  faMicrophone,
  faMicrophoneSlash,
  faMinus,
  faMoon,
  faMugHot,
  faNetworkWired,
  faPaperclip,
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
  faRotateLeft,
  faRoute,
  faSatelliteDish,
  faServer,
  faShieldHalved,
  faSort,
  faSpellCheck,
  faSpinner,
  faSquareCheck,
  faStar,
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
export const ChevronDown = makeIcon(faChevronDown);
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
export const MugHot = makeIcon(faMugHot);
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
export const VsInfinity = makeIcon(faInfinity);
export const Wand2 = makeIcon(faWandMagic);
export const X = makeIcon(faXmark);

// New icons for this pass of work.
export const AnglesLeft = makeIcon(faAnglesLeft);
export const AnglesRight = makeIcon(faAnglesRight);
export const Languages = makeIcon(faLanguage);
export const History = makeIcon(faClockRotateLeft);
export const Undo = makeIcon(faRotateLeft);
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
export const Paperclip = makeIcon(faPaperclip);
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

// SSH servers icons.
export const Server = makeIcon(faServer);
export const Lock = makeIcon(faLock);
export const LockOpen = makeIcon(faLockOpen);
export const Key = makeIcon(faKey);

// Package manager tab icons.
export const Package = makeIcon(faBox);

// Project archive icons.
export const Archive = makeIcon(faBoxArchive);
export const ArchiveRestore = makeIcon(faBoxOpen);

/** Docker's whale mark, inlined so we don't need the brands icon package. */
export const Docker = React.forwardRef<SVGSVGElement, IconProps>(({ className, ...props }, ref) => (
  <svg
    ref={ref}
    viewBox="0 0 24 24"
    fill="currentColor"
    aria-hidden
    className={className}
    {...props}
  >
    <path d="M13.983 11.078h2.119a.186.186 0 00.186-.185V9.006a.186.186 0 00-.186-.186h-2.119a.185.185 0 00-.185.185v1.888c0 .102.083.185.185.185m-2.954-5.43h2.118a.186.186 0 00.186-.186V3.574a.186.186 0 00-.186-.185h-2.118a.185.185 0 00-.185.185v1.888c0 .102.082.185.185.185m0 2.716h2.118a.187.187 0 00.186-.186V6.29a.186.186 0 00-.186-.185h-2.118a.185.185 0 00-.185.185v1.887c0 .102.082.185.185.186m-2.93 0h2.12a.186.186 0 00.184-.186V6.29a.185.185 0 00-.185-.185H8.1a.185.185 0 00-.185.185v1.887c0 .102.083.185.185.186m-2.964 0h2.119a.186.186 0 00.185-.186V6.29a.185.185 0 00-.185-.185H5.136a.186.186 0 00-.186.185v1.887c0 .102.084.185.186.186m5.893 2.715h2.118a.186.186 0 00.186-.185V9.006a.186.186 0 00-.186-.186h-2.118a.185.185 0 00-.185.185v1.888c0 .102.082.185.185.185m-2.93 0h2.12a.185.185 0 00.184-.185V9.006a.185.185 0 00-.184-.186h-2.12a.185.185 0 00-.184.185v1.888c0 .102.083.185.185.185m-2.964 0h2.119a.185.185 0 00.185-.185V9.006a.185.185 0 00-.184-.186h-2.12a.186.186 0 00-.186.186v1.887c0 .102.084.185.186.185m-2.92 0h2.12a.185.185 0 00.184-.185V9.006a.185.185 0 00-.184-.186h-2.12a.185.185 0 00-.184.185v1.888c0 .102.082.185.185.185M23.763 9.89c-.065-.051-.672-.51-1.954-.51-.338.001-.676.03-1.01.087-.248-1.7-1.653-2.53-1.716-2.566l-.344-.199-.226.327c-.284.438-.49.922-.612 1.43-.23.97-.09 1.882.403 2.661-.595.332-1.55.413-1.744.42H.751a.751.751 0 00-.75.748 11.376 11.376 0 00.692 4.062c.545 1.428 1.355 2.48 2.41 3.124 1.18.723 3.1 1.137 5.275 1.137.983.003 1.963-.086 2.93-.266a12.248 12.248 0 003.823-1.389c.98-.567 1.86-1.288 2.61-2.136 1.252-1.418 1.998-2.997 2.553-4.4h.221c1.372 0 2.215-.549 2.68-1.009.309-.293.55-.65.707-1.046l.098-.288Z" />
  </svg>
));
Docker.displayName = 'Docker';

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

// Security scan icons.
export const FileCode = makeIcon(faFileCode);
export const Filter = makeIcon(faFilter);

// Skill favorites and usage icons.
export const Star = makeIcon(faStar);
export const ChartSimple = makeIcon(faChartSimple);

// Workspace icons.
export const Workspace = makeIcon(faLaptopCode);
export const ChevronRight = makeIcon(faChevronRight);
export const CodeCompare = makeIcon(faCodeCompare);
export const Minus = makeIcon(faMinus);
export const Expand = makeIcon(faExpand);
export const Compress = makeIcon(faCompress);
