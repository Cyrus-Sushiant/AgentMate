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
  faBell,
  faBold,
  faBolt,
  faBookmark,
  faBox,
  faCalendarDays,
  faChartColumn,
  faCheck,
  faCircleCheck,
  faCircleHalfStroke,
  faCircleQuestion,
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
  faMemory,
  faMicrochip,
  faMicrophone,
  faMicrophoneSlash,
  faMinus,
  faMoon,
  faNetworkWired,
  faPaperPlane,
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
  faSort,
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

// Notification hook icons.
export const Bell = makeIcon(faBell);
export const Send = makeIcon(faPaperPlane);
export const CircleCheck = makeIcon(faCircleCheck);
export const CircleQuestion = makeIcon(faCircleQuestion);
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

// Voice input icons.
export const Microphone = makeIcon(faMicrophone);
export const MicrophoneSlash = makeIcon(faMicrophoneSlash);
export const Spinner = makeIcon(faSpinner);
