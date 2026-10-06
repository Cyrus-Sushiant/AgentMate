import { getHelpArticle, HELP_ARTICLES, helpArticlesByCategory } from '@shared/help/articles';
import type { HelpArticle } from '@shared/help/parse';
import { useQuery } from '@tanstack/react-query';
import { useEffect, useMemo, useRef, useState } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { HelpChat, providerReady } from '@/components/help/HelpChat';
import { HelpMarkdown } from '@/components/help/HelpMarkdown';
import { HelpSearchBox, type HelpSearchBoxHandle } from '@/components/help/HelpSearchBox';
import type { IconProps } from '@/components/icons';
import {
  ArrowLeft,
  ArrowRight,
  Bug,
  ChevronRight,
  Rocket,
  SettingsIcon,
  Sparkles,
  Workspace,
} from '@/components/icons';
import { NAV_ITEMS, type NavItem } from '@/components/layout/mainNav';
import { Button } from '@/components/ui/button';
import { queryKeys } from '@/lib/queryKeys';
import { cn } from '@/lib/utils';
import { useAskAiStore } from '@/stores/askAiStore';
import { useHelpStore } from '@/stores/helpStore';
import { usePageHeader } from '@/stores/pageHeaderStore';

type Icon = React.ForwardRefExoticComponent<IconProps>;

/** Icons for the categories that are not a single menu page of their own. */
const CATEGORY_ICON: Record<string, Icon> = {
  'Getting started': Sparkles,
  Workspace,
  Deploy: Rocket,
  Settings: SettingsIcon,
  Troubleshooting: Bug,
};

/** The menu entry an article is about, matched on its route's path. */
function navItemFor(article: HelpArticle): NavItem | undefined {
  if (!article.route) return undefined;
  const path = article.route.split(/[?#]/)[0];
  return NAV_ITEMS.find((item) => item.to === path);
}

/** Each article's icon: the menu icon of the page it covers, or its category's. */
function iconFor(article: HelpArticle): Icon {
  return navItemFor(article)?.icon ?? CATEGORY_ICON[article.category] ?? Sparkles;
}

/** Every article in reading order: categories as the Help home lists them, then by order. */
const READING_ORDER = helpArticlesByCategory().flatMap((g) => g.articles);

const QUICK_SEARCHES = [
  'Add an API key',
  'Split a pane',
  'Install the server core',
  'Unlock the vault',
  'Restore a backup',
];

function useGuideAvailable(): boolean {
  const provider = useAskAiStore((s) => s.provider);
  const ollamaModel = useAskAiStore((s) => s.ollamaModel);
  const { data } = useQuery({
    queryKey: queryKeys.settings,
    queryFn: () => window.agentmat.settings.get(),
  });
  return (['openai', 'gemini', 'ollama'] as const).some((p) =>
    providerReady(p, data, p === provider ? ollamaModel : ''),
  );
}

export default function HelpPage(): React.JSX.Element {
  const { pathname, hash } = useLocation();
  const slug = /^\/help\/([^/]+)/.exec(pathname)?.[1];
  const article = slug ? getHelpArticle(slug) : undefined;
  const chatOpen = useHelpStore((s) => s.chatOpen);
  const setChatOpen = useHelpStore((s) => s.setChatOpen);
  const rootRef = useRef<HTMLDivElement>(null);
  const searchRef = useRef<HelpSearchBoxHandle>(null);

  usePageHeader('Help', 'Guides for every part of AgentMate, with search and a guide you can ask.');

  // Land on the heading a link points at, or at the top of a newly opened article.
  // biome-ignore lint/correctness/useExhaustiveDependencies: runs when the article or anchor changes
  useEffect(() => {
    // A frame later, because the shell resets the scroll to the top on every route change and its
    // effect runs after this one; scrolling now would be undone straight away.
    const frame = requestAnimationFrame(() => {
      const id = decodeURIComponent(hash.slice(1));
      const target = id ? document.getElementById(id) : null;
      if (target) target.scrollIntoView?.({ behavior: 'smooth', block: 'start' });
      else rootRef.current?.scrollIntoView?.({ block: 'start' });
    });
    return () => cancelAnimationFrame(frame);
  }, [slug, hash]);

  const chat = chatOpen ? (
    <div className="help-chat-dock sticky top-4 h-[calc(100vh-9.5rem)] min-h-[420px] w-full">
      <HelpChat onClose={() => setChatOpen(false)} />
    </div>
  ) : null;

  return (
    <div ref={rootRef} className="help-page relative flex-1 px-6 pb-16 pt-5">
      {slug && !article ? (
        <NotFound />
      ) : article ? (
        <ArticleView
          article={article}
          searchRef={searchRef}
          chat={chat}
          chatOpen={chatOpen}
          onOpenChat={() => setChatOpen(true)}
        />
      ) : (
        <HelpHome
          searchRef={searchRef}
          chat={chat}
          chatOpen={chatOpen}
          onOpenChat={() => setChatOpen(true)}
        />
      )}
    </div>
  );
}

function AskGuideButton({
  onClick,
  active,
}: {
  onClick: () => void;
  active: boolean;
}): React.JSX.Element {
  return (
    <Button
      variant={active ? 'secondary' : 'outline'}
      size="sm"
      onClick={onClick}
      className="help-ask-button gap-1.5"
    >
      <Sparkles className="h-3.5 w-3.5 text-primary" /> Ask the guide
    </Button>
  );
}

interface ViewProps {
  searchRef: React.RefObject<HelpSearchBoxHandle | null>;
  chat: React.ReactNode;
  chatOpen: boolean;
  onOpenChat: () => void;
}

function HelpHome({ searchRef, chat, chatOpen, onOpenChat }: ViewProps): React.JSX.Element {
  const groups = helpArticlesByCategory();
  const guide = useGuideAvailable();
  const words = useMemo(
    () => HELP_ARTICLES.reduce((n, a) => n + a.body.split(/\s+/).length, 0),
    [],
  );

  return (
    <div
      className={cn(
        'mx-auto grid max-w-[1400px] gap-6',
        chatOpen && 'xl:grid-cols-[minmax(0,1fr)_380px]',
      )}
    >
      <div className="min-w-0">
        <section className="help-hero relative rounded-3xl px-8 pb-9 pt-10 md:px-12">
          <div className="relative max-w-2xl">
            <p className="help-eyebrow">AgentMate Help</p>
            <h1 className="mt-3 text-[2.15rem] font-semibold leading-[1.1] tracking-[-0.02em] text-foreground md:text-[2.6rem]">
              Find your way around AgentMate
            </h1>
            <p className="mt-3 max-w-xl text-[0.95rem] leading-7 text-muted-foreground">
              {HELP_ARTICLES.length} guides cover every page, button and setting. Search them,
              browse by the same groups as the menu, or ask the guide in your own words.
            </p>
            <HelpSearchBox ref={searchRef} variant="hero" className="mt-7" />
            <div className="mt-3.5 flex flex-wrap items-center gap-1.5">
              <span className="mr-1 text-xs text-muted-foreground">Try</span>
              {QUICK_SEARCHES.map((q) => (
                <button
                  key={q}
                  type="button"
                  onClick={() => searchRef.current?.setQuery(q)}
                  className="rounded-full border border-foreground/[0.08] bg-background/50 px-2.5 py-1 text-xs text-foreground/75 transition-colors hover:border-primary/40 hover:text-foreground"
                >
                  {q}
                </button>
              ))}
            </div>
          </div>
          {!chatOpen && (
            <button
              type="button"
              onClick={onOpenChat}
              className="help-guide-card group mt-8 flex w-full max-w-2xl items-center gap-4 rounded-2xl p-4 text-left transition-[border-color,transform] hover:-translate-y-px md:absolute md:bottom-9 md:right-10 md:mt-0 md:w-72 md:flex-col md:items-start md:gap-3"
            >
              <span className="help-guide-mark flex h-9 w-9 shrink-0 items-center justify-center rounded-xl">
                <Sparkles className="h-4 w-4" />
              </span>
              <span className="min-w-0">
                <span className="block text-sm font-semibold text-foreground">Ask the guide</span>
                <span className="mt-0.5 block text-xs leading-5 text-muted-foreground">
                  {guide
                    ? 'Ask a question in plain words. Answers come from these articles, with links to the sections used.'
                    : 'Connect an AI provider in Settings and ask questions in plain words.'}
                </span>
              </span>
              <ArrowRight className="ml-auto h-3.5 w-3.5 shrink-0 text-muted-foreground transition-transform group-hover:translate-x-0.5 md:hidden" />
            </button>
          )}
        </section>

        <div className="mt-10 flex items-baseline justify-between gap-4 px-1">
          <h2 className="text-sm font-semibold text-foreground">Browse by area</h2>
          <p className="text-xs text-muted-foreground">
            {groups.length} areas, about {Math.round(words / 1000)}k words
          </p>
        </div>
        <div className="help-map mt-4 columns-1 gap-4 md:columns-2 2xl:columns-3">
          {groups.map((group) => {
            const GroupIcon = CATEGORY_ICON[group.category] ?? iconFor(group.articles[0]!);
            const headingId = `help-cat-${group.category.toLowerCase().replace(/\W+/g, '-')}`;
            return (
              <section
                key={group.category}
                aria-labelledby={headingId}
                className="glass mb-4 break-inside-avoid rounded-2xl p-2"
              >
                <div className="flex items-center gap-2 px-3 pb-1.5 pt-2.5">
                  <GroupIcon className="h-3 w-3 text-muted-foreground/70" />
                  <h3 id={headingId} className="help-eyebrow">
                    {group.category}
                  </h3>
                  <span className="ml-auto text-[10px] tabular-nums text-muted-foreground/50">
                    {group.articles.length}
                  </span>
                </div>
                <ul>
                  {group.articles.map((article) => {
                    const ArticleIcon = iconFor(article);
                    return (
                      <li key={article.slug}>
                        <Link
                          to={`/help/${article.slug}`}
                          className="group flex items-start gap-3 rounded-xl px-3 py-2.5 transition-colors hover:bg-foreground/[0.045] focus-visible:bg-foreground/[0.045] focus-visible:outline-none"
                        >
                          <span className="mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-lg border border-foreground/[0.07] bg-background/60 text-muted-foreground transition-colors group-hover:border-primary/30 group-hover:text-primary">
                            <ArticleIcon className="h-3.5 w-3.5" />
                          </span>
                          <span className="min-w-0 flex-1">
                            <span className="block text-sm font-medium text-foreground">
                              {article.title}
                            </span>
                            <span className="mt-0.5 line-clamp-2 block text-xs leading-5 text-muted-foreground">
                              {article.summary}
                            </span>
                          </span>
                          <ChevronRight className="mt-2 h-3 w-3 shrink-0 text-muted-foreground/0 transition-colors group-hover:text-muted-foreground" />
                        </Link>
                      </li>
                    );
                  })}
                </ul>
              </section>
            );
          })}
        </div>
      </div>
      {chat}
    </div>
  );
}

function ArticleView({
  article,
  searchRef,
  chat,
  chatOpen,
  onOpenChat,
}: ViewProps & { article: HelpArticle }): React.JSX.Element {
  const navigate = useNavigate();
  const nav = navItemFor(article);
  const outline = article.sections.filter((s) => s.level > 0);
  const activeId = useScrollSpy(
    outline.map((s) => s.id),
    article.slug,
  );
  const index = READING_ORDER.findIndex((a) => a.slug === article.slug);
  const prev = index > 0 ? READING_ORDER[index - 1] : undefined;
  const next = index >= 0 ? READING_ORDER[index + 1] : undefined;
  const ArticleIcon = iconFor(article);
  const openLabel = nav?.label ?? article.title;
  const canOpen = article.route && !article.route.startsWith('/help');

  return (
    <div
      className={cn(
        'mx-auto grid max-w-[1400px] gap-8',
        chatOpen
          ? 'lg:grid-cols-[minmax(0,1fr)_360px] 2xl:grid-cols-[220px_minmax(0,1fr)_380px]'
          : 'lg:grid-cols-[220px_minmax(0,1fr)] xl:grid-cols-[220px_minmax(0,1fr)_210px]',
      )}
    >
      <aside className={cn('hidden', chatOpen ? '2xl:block' : 'lg:block')}>
        <div className="sticky top-4 flex max-h-[calc(100vh-9.5rem)] flex-col gap-4">
          <HelpSearchBox ref={searchRef} />
          <nav
            aria-label="Help topics"
            className="rail-scroll -mx-1 min-h-0 overflow-y-auto px-1 pb-4"
          >
            <Link
              to="/help"
              className="mb-3 flex items-center gap-1.5 px-2 text-xs text-muted-foreground transition-colors hover:text-foreground"
            >
              <ArrowLeft className="h-3 w-3" /> All help topics
            </Link>
            {helpArticlesByCategory().map((group) => (
              <div key={group.category} className="mb-3">
                <p className="help-eyebrow px-2 pb-1">{group.category}</p>
                {group.articles.map((a) => (
                  <Link
                    key={a.slug}
                    to={`/help/${a.slug}`}
                    aria-current={a.slug === article.slug ? 'page' : undefined}
                    className={cn(
                      'block truncate rounded-md px-2 py-1 text-[13px] transition-colors',
                      a.slug === article.slug
                        ? 'bg-primary/[0.1] font-medium text-primary'
                        : 'text-foreground/70 hover:bg-foreground/[0.04] hover:text-foreground',
                    )}
                  >
                    {a.title}
                  </Link>
                ))}
              </div>
            ))}
          </nav>
        </div>
      </aside>

      <article className="min-w-0">
        <div className="mx-auto max-w-[72ch]">
          <div
            className={cn(
              'mb-3 flex items-center gap-1.5 text-xs text-muted-foreground',
              chatOpen ? '2xl:hidden' : 'lg:hidden',
            )}
          >
            <Link to="/help" className="transition-colors hover:text-foreground">
              Help
            </Link>
            <ChevronRight className="h-2.5 w-2.5" />
            <span>{article.category}</span>
          </div>
          <header className="help-article-header border-b border-foreground/[0.07] pb-7">
            <p className="help-eyebrow flex items-center gap-2">
              <ArticleIcon className="h-3 w-3" />
              {article.category}
            </p>
            <h1 className="mt-3 text-[2rem] font-semibold leading-[1.15] tracking-[-0.02em] text-foreground">
              {article.title}
            </h1>
            <p className="mt-2.5 text-[1.02rem] leading-7 text-muted-foreground">
              {article.summary}
            </p>
            <div className="mt-5 flex flex-wrap items-center gap-2">
              {canOpen && (
                <Button size="sm" onClick={() => navigate(article.route!)} className="gap-1.5">
                  Open {openLabel} <ArrowRight className="h-3 w-3" />
                </Button>
              )}
              {!chatOpen && <AskGuideButton onClick={onOpenChat} active={false} />}
            </div>
          </header>

          <div className="pt-6">
            <HelpMarkdown slug={article.slug} markdown={article.body} sections={article.sections} />
          </div>

          <nav
            aria-label="More help"
            className="mt-14 grid gap-3 border-t border-foreground/[0.07] pt-6 sm:grid-cols-2"
          >
            {prev ? (
              <Link to={`/help/${prev.slug}`} className="help-pager group rounded-xl p-4">
                <span className="flex items-center gap-1 text-[11px] text-muted-foreground">
                  <ArrowLeft className="h-2.5 w-2.5 transition-transform group-hover:-translate-x-0.5" />{' '}
                  Previous
                </span>
                <span className="mt-1 block text-sm font-medium text-foreground">{prev.title}</span>
              </Link>
            ) : (
              <span />
            )}
            {next && (
              <Link
                to={`/help/${next.slug}`}
                className="help-pager group rounded-xl p-4 text-right"
              >
                <span className="flex items-center justify-end gap-1 text-[11px] text-muted-foreground">
                  Next{' '}
                  <ArrowRight className="h-2.5 w-2.5 transition-transform group-hover:translate-x-0.5" />
                </span>
                <span className="mt-1 block text-sm font-medium text-foreground">{next.title}</span>
              </Link>
            )}
          </nav>
        </div>
      </article>

      {chatOpen ? (
        chat
      ) : (
        <aside className="hidden xl:block">
          <nav
            aria-label="On this page"
            className="sticky top-4 max-h-[calc(100vh-9.5rem)] overflow-y-auto"
          >
            <p className="help-eyebrow pb-2.5">On this page</p>
            <ul className="help-outline border-l border-foreground/[0.08]">
              {outline.map((section) => (
                <li key={section.id}>
                  <a
                    href={`#${section.id}`}
                    onClick={(e) => {
                      e.preventDefault();
                      navigate({ hash: section.id }, { replace: true });
                    }}
                    aria-current={activeId === section.id ? 'location' : undefined}
                    className={cn(
                      '-ml-px block border-l py-1 text-[12.5px] leading-5 transition-colors',
                      section.level === 3 ? 'pl-6' : 'pl-3',
                      activeId === section.id
                        ? 'border-primary font-medium text-foreground'
                        : 'border-transparent text-muted-foreground hover:text-foreground',
                    )}
                  >
                    {section.heading}
                  </a>
                </li>
              ))}
            </ul>
          </nav>
        </aside>
      )}
    </div>
  );
}

/** The heading nearest the top of the view, for highlighting the outline as you read. */
function useScrollSpy(ids: string[], key: string): string | undefined {
  const [active, setActive] = useState<string | undefined>(ids[0]);
  // biome-ignore lint/correctness/useExhaustiveDependencies: re-observe when the article changes
  useEffect(() => {
    setActive(ids[0]);
    if (typeof IntersectionObserver === 'undefined') return;
    const visible = new Map<string, number>();
    const observer = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          if (entry.isIntersecting) visible.set(entry.target.id, entry.boundingClientRect.top);
          else visible.delete(entry.target.id);
        }
        const first = ids.find((id) => visible.has(id));
        if (first) setActive(first);
      },
      { rootMargin: '0px 0px -65% 0px' },
    );
    for (const id of ids) {
      const element = document.getElementById(id);
      if (element) observer.observe(element);
    }
    return () => observer.disconnect();
  }, [key]);
  return active;
}

function NotFound(): React.JSX.Element {
  return (
    <div className="mx-auto flex max-w-md flex-col items-center gap-3 py-24 text-center">
      <p className="help-eyebrow">Help</p>
      <h1 className="text-xl font-semibold">We couldn't find that article</h1>
      <p className="text-sm text-muted-foreground">
        It may have moved. Search for it, or start from the full list.
      </p>
      <Link
        to="/help"
        className="mt-2 text-sm font-medium text-primary underline-offset-4 hover:underline"
      >
        All help topics
      </Link>
    </div>
  );
}
