import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import type { Project } from '@agentmat/core';
import { browsableRepoUrl, stripRemoteCredentials } from '@agentmat/core';
import { ipcMain } from 'electron';
import type {
  ApplyVersionInput,
  ApplyVersionResult,
  ConnectRemoteInput,
  CreateGithubRepoInput,
  CreateGithubRepoResult,
  CreatePullRequestInput,
  CreatePullRequestResult,
  CreateTagInput,
  DeleteBranchInput,
  GitBranchHistory,
  GithubAccount,
  GithubActivity,
  GithubNotifications,
  GithubRepoLookup,
  GitInitInput,
  GitOpResult,
  GitStatus,
  GitTagInfo,
  RenameBranchInput,
  SuggestGitTextResult,
  SuggestTagResult,
} from '../../shared/apiTypes';
import { IPC } from '../../shared/ipcChannels';
import { cancelHeadlessPrompt, runHeadlessCliPrompt } from '../cli/headlessPrompt';
import {
  GITHUB_NAME_PATTERN,
  type GithubApiRepo,
  markGithubNotificationRead,
  markGithubNotificationsRead,
  readGithubAccount,
  readGithubActivity,
  readGithubNotifications,
  toRepoInfo,
} from '../git/githubAccount';
import { ghApi, ghErrorMessage, isGhCliAvailable, parseGithubRemote } from '../git/githubCli';
import {
  checkoutBranch,
  createBranch,
  currentBranch,
  deleteBranch,
  detectDefaultBranch,
  git,
  gitOrNull,
  isGitRepo,
  listRepoFiles,
  PUSH_TIMEOUT_MS,
  primaryRemote,
  pushBranchAndTag,
  pushCurrentBranch,
  readBranchHistory,
  readChangeSummary,
  readCommitSubjects,
  readStatus,
  readTagInfo,
  readWorkingTreeFingerprint,
  renameBranch,
  runGitOp,
  safeBranchName,
  setDefaultBranch,
  TAG_NAME_PATTERN,
} from '../git/plumbing';
import {
  buildReleaseSummary,
  buildVersionBumpPrompt,
  bumpVersion,
  deriveNextVersion,
  extractTagNotes,
  fallbackTagMessage,
  formatTagForRepo,
  parseBumpKind,
  parseSemver,
  parseSuggestedTag,
  rejectSuggestedVersion,
} from '../git/versioning';
import { schedulePipelineCheck } from '../pipelines/watcher';
import { store } from '../store';

const execFileAsync = promisify(execFile);
const GH_TIMEOUT_MS = 30000;
/**
 * The version bump sends the agent hunting through the repo for manifests before it edits
 * anything, and some CLIs hand that search to a sub-agent. Three minutes, which is plenty
 * for a one-question prompt, routinely cuts that off halfway.
 */
const VERSION_BUMP_TIMEOUT_MS = 900000;

/**
 * Origin can point at a folder, a UNC share or a file:// URL. Those clone fine but
 * are nothing to hand a browser, so the project's repository link stays empty.
 */
const LOCAL_REMOTE_PATTERN = /^([a-z]:[\\/]|\\\\|\/|\.{1,2}[\\/]|file:)/i;

async function getProject(projectId: string): Promise<Project> {
  const projects = await store.getProjects();
  const project = projects.find((p) => p.id === projectId);
  if (!project) throw new Error(`Project ${projectId} not found`);
  return project;
}

async function getProjectPath(projectId: string): Promise<string> {
  return (await getProject(projectId)).folderPath;
}

/**
 * The shared body of the "ask the CLI to write something about my changes"
 * handlers: they differ only in the prompt they build around the change summary.
 */
async function suggestGitText(
  projectId: string,
  buildPrompt: (summary: string) => string,
  requestId?: string,
): Promise<SuggestGitTextResult> {
  const project = await getProject(projectId);
  const summary = await readChangeSummary(project.folderPath);
  const result = await runHeadlessCliPrompt(buildPrompt(summary), project.folderPath, {
    requestId,
    preferredCliId: project.cliId,
  });
  return {
    ok: result.ok,
    text: result.text,
    cliName: result.cliName,
    error: result.error,
    cancelled: result.cancelled,
  };
}

function registerRepoHandlers(): void {
  ipcMain.handle(IPC.git.status, async (_event, projectId: string): Promise<GitStatus> => {
    return readStatus(await getProjectPath(projectId));
  });

  ipcMain.handle(IPC.git.listFiles, async (_event, projectId: string): Promise<string[]> => {
    return listRepoFiles(await getProjectPath(projectId));
  });

  ipcMain.handle(IPC.git.changeSummary, async (_event, projectId: string): Promise<string> => {
    return readChangeSummary(await getProjectPath(projectId));
  });

  ipcMain.handle(IPC.git.fetch, async (_event, projectId: string): Promise<GitOpResult> => {
    const cwd = await getProjectPath(projectId);
    return runGitOp(() => git(cwd, ['fetch', '--all', '--prune']));
  });

  ipcMain.handle(IPC.git.pull, async (_event, projectId: string): Promise<GitOpResult> => {
    const cwd = await getProjectPath(projectId);
    return runGitOp(() => git(cwd, ['pull']));
  });

  ipcMain.handle(IPC.git.push, async (_event, projectId: string): Promise<GitOpResult> => {
    const cwd = await getProjectPath(projectId);
    const result = await runGitOp(async () => {
      // The branch name is all this needs; a full readStatus would spend another
      // ten subprocesses listing branches and diffing the tree for nothing.
      const branch = await currentBranch(cwd);
      if (!branch) throw new Error('No current branch to push.');
      return pushCurrentBranch(cwd, branch);
    });
    if (result.ok) schedulePipelineCheck(projectId);
    return result;
  });

  ipcMain.handle(IPC.git.sync, async (_event, projectId: string): Promise<GitOpResult> => {
    const cwd = await getProjectPath(projectId);
    const result = await runGitOp(async () => {
      const fetchOut = await git(cwd, ['fetch', '--all', '--prune']);
      const pullOut = await git(cwd, ['pull']);
      const branch = await currentBranch(cwd);
      const pushOut = branch ? await pushCurrentBranch(cwd, branch) : '';
      return [fetchOut, pullOut, pushOut].filter(Boolean).join('\n');
    });
    if (result.ok) schedulePipelineCheck(projectId);
    return result;
  });

  ipcMain.handle(
    IPC.git.commit,
    async (_event, projectId: string, message: string): Promise<GitOpResult> => {
      const cwd = await getProjectPath(projectId);
      if (!message.trim()) return { ok: false, message: 'Commit message cannot be empty.' };
      return runGitOp(async () => {
        await git(cwd, ['add', '-A']);
        return git(cwd, ['commit', '-m', message]);
      });
    },
  );

  ipcMain.handle(IPC.git.init, async (_event, input: GitInitInput): Promise<GitOpResult> => {
    const cwd = await getProjectPath(input.projectId);
    let branch: string;
    try {
      branch = safeBranchName(input.branch);
    } catch (error) {
      return { ok: false, message: (error as Error).message };
    }
    if (await isGitRepo(cwd)) {
      return { ok: false, message: 'This folder is already a git repository.' };
    }

    return runGitOp(async () => {
      try {
        await git(cwd, ['init', '-b', branch]);
      } catch {
        // git older than 2.28 has no --initial-branch, so point HEAD at the branch by hand.
        await git(cwd, ['init']);
        await git(cwd, ['symbolic-ref', 'HEAD', `refs/heads/${branch}`]);
      }

      if (!input.initialCommit) return `Initialized an empty repository on ${branch}.`;

      await git(cwd, ['add', '-A']);
      const staged = ((await gitOrNull(cwd, ['diff', '--cached', '--name-only'])) ?? '').trim();
      if (!staged) {
        return `Initialized an empty repository on ${branch}. There was nothing to commit yet.`;
      }
      await git(cwd, ['commit', '-m', input.commitMessage?.trim() || 'Initial commit']);
      return `Initialized the repository on ${branch} and committed the current files.`;
    });
  });

  ipcMain.handle(
    IPC.git.connectRemote,
    async (_event, input: ConnectRemoteInput): Promise<GitOpResult> => {
      const cwd = await getProjectPath(input.projectId);
      const url = input.url.trim();
      if (!url) return { ok: false, message: 'Remote URL cannot be empty.' };
      if (!/^(https?:\/\/|ssh:\/\/|git@)/i.test(url)) {
        return { ok: false, message: 'The remote must be an https or ssh git URL.' };
      }
      if (!(await isGitRepo(cwd))) {
        return { ok: false, message: 'This folder is not a git repository yet.' };
      }

      // A remote can carry a token in its userinfo; git needs it, the message
      // shown back to the user (and whatever logs it) does not.
      const shownUrl = stripRemoteCredentials(url);

      return runGitOp(async () => {
        const remotes = ((await gitOrNull(cwd, ['remote'])) ?? '')
          .split('\n')
          .map((remote) => remote.trim())
          .filter(Boolean);
        if (remotes.includes('origin')) {
          await git(cwd, ['remote', 'set-url', 'origin', url]);
        } else {
          await git(cwd, ['remote', 'add', 'origin', url]);
        }
        if (!input.push) return `Connected origin to ${shownUrl}.`;

        const hasCommit = (await gitOrNull(cwd, ['rev-parse', '--verify', 'HEAD'])) !== null;
        if (!hasCommit) {
          return `Connected origin to ${shownUrl}. There is nothing to push until you make a commit.`;
        }

        const branch = await currentBranch(cwd);
        if (!branch) throw new Error('No current branch to push, HEAD is detached.');
        await git(cwd, ['push', '-u', 'origin', branch], PUSH_TIMEOUT_MS);
        return `Connected origin and pushed ${branch}.`;
      });
    },
  );

  /**
   * Origin's URL for a folder on disk, addressed by path rather than project id:
   * the new-project form needs this before the project exists. Null when the
   * folder isn't a repository or has no origin, which is not an error worth showing.
   */
  ipcMain.handle(
    IPC.git.detectRemote,
    async (_event, folderPath: string): Promise<string | null> => {
      const cwd = folderPath?.trim();
      if (!cwd || !(await isGitRepo(cwd))) return null;
      const remote = ((await gitOrNull(cwd, ['remote', 'get-url', 'origin'])) ?? '').trim();
      if (!remote || LOCAL_REMOTE_PATTERN.test(remote)) return null;
      // browsableRepoUrl drops any embedded credentials, which matters because
      // this value is prefilled into the project form, stored, shown, and later
      // handed to shell.openExternal.
      return browsableRepoUrl(remote);
    },
  );
}

function registerBranchHandlers(): void {
  ipcMain.handle(
    IPC.git.createBranch,
    async (_event, projectId: string, branchName: string): Promise<GitOpResult> => {
      const cwd = await getProjectPath(projectId);
      return runGitOp(() => createBranch(cwd, branchName));
    },
  );

  ipcMain.handle(
    IPC.git.checkoutBranch,
    async (_event, projectId: string, branchName: string): Promise<GitOpResult> => {
      const cwd = await getProjectPath(projectId);
      return runGitOp(() => checkoutBranch(cwd, branchName));
    },
  );

  ipcMain.handle(
    IPC.git.setDefaultBranch,
    async (_event, projectId: string, branchName: string): Promise<GitOpResult> => {
      const cwd = await getProjectPath(projectId);
      return runGitOp(() => setDefaultBranch(cwd, branchName));
    },
  );

  ipcMain.handle(
    IPC.git.renameBranch,
    async (_event, input: RenameBranchInput): Promise<GitOpResult> => {
      const cwd = await getProjectPath(input.projectId);
      return runGitOp(() => renameBranch(cwd, input.from, input.to, Boolean(input.updateRemote)));
    },
  );

  ipcMain.handle(
    IPC.git.deleteBranch,
    async (_event, input: DeleteBranchInput): Promise<GitOpResult> => {
      const cwd = await getProjectPath(input.projectId);
      return runGitOp(() =>
        deleteBranch(cwd, input.branchName, {
          deleteRemote: Boolean(input.deleteRemote),
          force: Boolean(input.force),
        }),
      );
    },
  );

  ipcMain.handle(
    IPC.git.branchHistory,
    async (_event, projectId: string, branchName: string): Promise<GitBranchHistory> => {
      return readBranchHistory(await getProjectPath(projectId), branchName);
    },
  );

  ipcMain.handle(
    IPC.git.suggestBranchName,
    async (_event, projectId: string, requestId?: string): Promise<SuggestGitTextResult> => {
      return suggestGitText(
        projectId,
        (summary) =>
          'Generate a single short git branch name (kebab-case, e.g. "feat/add-login" or ' +
          '"fix/null-check", max 60 characters, no spaces, no quotes, no markdown) describing these ' +
          'uncommitted changes. Do not read or edit any files; judge only from the information below. ' +
          `Reply with ONLY the branch name and nothing else.\n\n${summary}`,
        requestId,
      );
    },
  );

  ipcMain.handle(IPC.git.cancelSuggestBranchName, (_event, requestId: string): boolean => {
    return cancelHeadlessPrompt(requestId);
  });

  ipcMain.handle(
    IPC.git.suggestCommitMessage,
    async (_event, projectId: string, requestId?: string): Promise<SuggestGitTextResult> => {
      return suggestGitText(
        projectId,
        (summary) =>
          'Write a concise, conventional-commit style git commit message (a short summary line, ' +
          'optionally followed by a brief body) describing these changes. Do not read or edit any ' +
          'files; judge only from the information below. Reply with ONLY the commit message, no code ' +
          `fences, no extra commentary.\n\n${summary}`,
        requestId,
      );
    },
  );

  ipcMain.handle(IPC.git.cancelSuggestCommitMessage, (_event, requestId: string): boolean => {
    return cancelHeadlessPrompt(requestId);
  });
}

function registerTagHandlers(): void {
  ipcMain.handle(IPC.git.tags, async (_event, projectId: string): Promise<GitTagInfo> => {
    return readTagInfo(await getProjectPath(projectId));
  });

  ipcMain.handle(IPC.git.createTag, async (_event, input: CreateTagInput): Promise<GitOpResult> => {
    const cwd = await getProjectPath(input.projectId);
    const tag = input.tag.trim();
    if (!tag) return { ok: false, message: 'Tag name cannot be empty.' };
    if (!TAG_NAME_PATTERN.test(tag) || tag.includes('..')) {
      return {
        ok: false,
        message:
          'Invalid tag name. Use letters, digits, dots, dashes, underscores or slashes (e.g. v1.0.1).',
      };
    }

    const localSha = (
      await gitOrNull(cwd, ['rev-parse', '-q', '--verify', `refs/tags/${tag}^{commit}`])
    )?.trim();

    if (localSha) {
      // The tag is already there locally, most often because the version-bump CLI ran a tool
      // like `npm version` that tags on its own despite being told not to. As long as it still
      // points at HEAD, treat this as "already made, just needs pushing" instead of a conflict.
      const headSha = (await git(cwd, ['rev-parse', 'HEAD'])).trim();
      if (localSha !== headSha) {
        return {
          ok: false,
          message: `Tag ${tag} already exists locally but points at a different commit than HEAD. Delete it (or pick a different name) before retrying.`,
        };
      }
      if (!input.push) return { ok: false, message: `Tag ${tag} already exists locally.` };

      const existingResult = await runGitOp(async () => {
        const remote = (await primaryRemote(cwd)) ?? 'origin';
        // Annotated tags list under their own object sha; the "^{}" peeled ref is what
        // resolves that back to the commit, which is what `localSha` was compared against above.
        const remoteRefs = (
          (await gitOrNull(cwd, [
            'ls-remote',
            remote,
            `refs/tags/${tag}`,
            `refs/tags/${tag}^{}`,
          ])) ?? ''
        )
          .split('\n')
          .map((line) => line.trim())
          .filter(Boolean);
        const peeled = remoteRefs.find((line) => line.endsWith('^{}'));
        const remoteSha = (peeled ?? remoteRefs[0])?.split(/\s+/)[0];
        if (remoteSha && remoteSha !== localSha) {
          throw new Error(
            `Tag ${tag} already exists on ${remote} and points at a different commit.`,
          );
        }
        await pushBranchAndTag(cwd, tag);
        return remoteSha
          ? `Tag ${tag} already exists locally and on ${remote}.`
          : `Tag ${tag} already existed locally, pushed the branch and tag to ${remote}.`;
      });
      if (existingResult.ok) schedulePipelineCheck(input.projectId);
      return existingResult;
    }

    const createdResult = await runGitOp(async () => {
      await git(cwd, ['tag', '-a', tag, '-m', input.message?.trim() || tag]);
      if (!input.push) return `Created tag ${tag} locally.`;
      try {
        await pushBranchAndTag(cwd, tag);
      } catch (error) {
        // Leave the repo as we found it so the user can retry the same tag after fixing the remote.
        await gitOrNull(cwd, ['tag', '-d', tag]);
        throw error;
      }
      return `Created tag ${tag} and pushed the branch and tag to origin.`;
    });
    if (createdResult.ok && input.push) schedulePipelineCheck(input.projectId);
    return createdResult;
  });

  ipcMain.handle(
    IPC.git.suggestTag,
    async (_event, projectId: string, requestId?: string): Promise<SuggestTagResult> => {
      const project = await getProject(projectId);
      const cwd = project.folderPath;
      const { latestTag, commitsSinceLatestTag } = await readTagInfo(cwd);
      if (latestTag && commitsSinceLatestTag === 0) {
        return {
          ok: false,
          error: `No new commits since ${latestTag}, so there is nothing to tag yet.`,
        };
      }

      const subjects = await readCommitSubjects(cwd, latestTag);
      const diffStat = latestTag
        ? ((await gitOrNull(cwd, ['diff', '--shortstat', `${latestTag}..HEAD`])) ?? '').trim()
        : '';
      const summary = buildReleaseSummary(latestTag, subjects, diffStat);
      const prompt =
        'You are picking the next git tag for a release, following semantic versioning: bump the major ' +
        'version for breaking changes, the minor version for new features, the patch version for fixes ' +
        'and chores only. Do not read or edit any files; judge only from the information below.\n\n' +
        (latestTag
          ? `The repository's latest tag is ${latestTag}. Your answer MUST be a bump of exactly that ` +
            'version and must be greater than it. Never invent an unrelated version number.\n\n'
          : '') +
        'Answer in exactly this format, with no markdown and nothing else:\n' +
        'TAG: <the new tag>\n' +
        'WHY: <one short sentence explaining the bump>\n' +
        'NOTES:\n' +
        '<release notes for the tag annotation: a one-line summary, then a few "- " bullets ' +
        'grouping the notable changes. Keep it under 15 lines.>\n\n' +
        summary;

      const result = await runHeadlessCliPrompt(prompt, cwd, {
        requestId,
        preferredCliId: project.cliId,
      });
      if (!result.ok) {
        return {
          ok: false,
          cliName: result.cliName,
          error: result.error,
          cancelled: result.cancelled,
        };
      }

      const parsed = parseSuggestedTag(result.text, latestTag);
      const notes = extractTagNotes(result.text);
      const latestParts = latestTag ? parseSemver(latestTag) : null;

      // Models often skip a concrete semver ("TAG: patch", prose only, etc.). When we
      // already know the latest tag, turn that into a real bump instead of failing the run.
      let tag = parsed?.tag;
      let reason = parsed?.reason ?? notes.reason;
      if (!tag && latestParts) {
        const bumpKind = parseBumpKind(result.text);
        const derived = bumpKind
          ? bumpVersion(latestParts, bumpKind)
          : deriveNextVersion(latestParts, subjects);
        tag = formatTagForRepo(derived, latestTag);
        reason = bumpKind
          ? `${result.cliName} suggested a ${bumpKind} bump; used ${tag}.`
          : `${result.cliName} did not return a version number; used ${tag} from the commit history instead.`;
      }

      if (!tag) {
        return {
          ok: false,
          cliName: result.cliName,
          error: `${result.cliName} did not return a version number.`,
        };
      }

      // Models regularly answer with a stock version ("1.2.3") that has nothing to do with
      // the repo. Anything that isn't a plausible bump of the latest tag is dropped in
      // favour of one derived from the commits themselves.
      if (latestParts && latestTag) {
        const problem = rejectSuggestedVersion(parseSemver(tag), latestParts, latestTag);
        if (problem) {
          const rejected = tag;
          tag = formatTagForRepo(deriveNextVersion(latestParts, subjects), latestTag);
          reason = `${result.cliName} suggested ${rejected}, which ${problem}; used ${tag} from the commit history instead.`;
        }
      }

      return {
        ok: true,
        tag,
        reason,
        // A CLI that ignored the NOTES section still gets a usable annotation, straight from the log.
        message: parsed?.message || notes.message || fallbackTagMessage(tag, subjects),
        cliName: result.cliName,
      };
    },
  );

  ipcMain.handle(IPC.git.cancelSuggestTag, (_event, requestId: string): boolean => {
    return cancelHeadlessPrompt(requestId);
  });

  ipcMain.handle(
    IPC.git.applyVersion,
    async (_event, input: ApplyVersionInput): Promise<ApplyVersionResult> => {
      const project = await getProject(input.projectId);
      const cwd = project.folderPath;
      const tag = input.tag.trim();
      if (!tag) {
        return { ok: false, output: '', changedFiles: [], error: 'No version to apply.' };
      }

      // Snapshot first: the CLI's own summary of what it edited can't be trusted, and
      // diffing the working tree before and after is the only account of it that can.
      const before = await readWorkingTreeFingerprint(cwd);
      const headBefore = (await gitOrNull(cwd, ['rev-parse', 'HEAD']))?.trim() ?? null;

      const result = await runHeadlessCliPrompt(buildVersionBumpPrompt(tag), cwd, {
        requestId: input.requestId,
        preferredCliId: project.cliId,
        allowWrites: true,
        timeoutMs: VERSION_BUMP_TIMEOUT_MS,
      });

      const after = await readWorkingTreeFingerprint(cwd);
      const changedFiles = [...after.entries()]
        .filter(([path, edits]) => before.get(path) !== edits)
        .map(([path]) => path)
        .sort();

      // Despite the prompt telling it not to, a CLI occasionally reaches for a tool like
      // `npm version` that commits (and tags) by itself; that leaves no working-tree diff to
      // report, so this is the only way to tell the UI the bump actually landed in a commit.
      const headAfter = (await gitOrNull(cwd, ['rev-parse', 'HEAD']))?.trim() ?? null;
      const committedByCli = headBefore !== null && headAfter !== null && headBefore !== headAfter;

      // Agent CLIs are unreliable narrators of their own exit: OpenCode ends a run whose
      // last act was a tool call with an empty stdout, and a run we stop for running long
      // exits non-zero. Neither says the bump failed, and the working tree above already
      // knows whether it landed. A cancel still reads as a cancel, since the user asked.
      const landed = (changedFiles.length > 0 || committedByCli) && !result.cancelled;

      return {
        ok: result.ok || landed,
        // Falls back to the progress log for CLIs that keep stdout for the final message
        // and print everything they did to stderr.
        output: result.text || result.log || '',
        changedFiles,
        committedByCli,
        cliName: result.cliName,
        // A run that wrote files but ended badly is a partial success, not a failure: say
        // what went wrong without burying the edits the user now has to deal with.
        warning: landed && !result.ok ? result.error : undefined,
        error: result.ok || landed ? undefined : result.error,
        cancelled: result.cancelled,
      };
    },
  );

  ipcMain.handle(IPC.git.cancelApplyVersion, (_event, requestId: string): boolean => {
    return cancelHeadlessPrompt(requestId);
  });
}

function registerGithubHandlers(): void {
  ipcMain.handle(
    IPC.git.createPullRequest,
    async (_event, input: CreatePullRequestInput): Promise<CreatePullRequestResult> => {
      const cwd = await getProjectPath(input.projectId);
      const branch = await currentBranch(cwd);
      if (!branch) return { ok: false, error: 'No current branch found.' };

      try {
        await pushCurrentBranch(cwd, branch);
      } catch (error) {
        const err = error as { stderr?: string; message?: string };
        return {
          ok: false,
          error: `Failed to push branch before creating the PR: ${(err.stderr || err.message || '').trim()}`,
        };
      }

      if (await isGhCliAvailable()) {
        try {
          const args = ['pr', 'create', '--title', input.title, '--body', input.body];
          if (input.base) args.push('--base', input.base);
          const { stdout } = await execFileAsync('gh', args, {
            cwd,
            timeout: GH_TIMEOUT_MS,
            windowsHide: true,
          });
          const url = stdout.trim().split('\n').pop() ?? '';
          return { ok: true, url };
        } catch (error) {
          return { ok: false, error: `gh pr create failed: ${ghErrorMessage(error)}` };
        }
      }

      // No GitHub CLI, fall back to opening a pre-filled compare page in the browser.
      // The remote is resolved the same way as everywhere else in this file, so a repo
      // whose only remote is called something other than origin still works.
      const remote = (await primaryRemote(cwd)) ?? 'origin';
      const remoteUrl = ((await gitOrNull(cwd, ['remote', 'get-url', remote])) ?? '').trim();
      const parsed = parseGithubRemote(remoteUrl);
      if (!parsed) {
        return {
          ok: false,
          error: `GitHub CLI (gh) is not installed and the ${remote} remote is not a GitHub URL.`,
        };
      }
      const base = input.base || (await detectDefaultBranch(cwd)) || 'main';
      const params = new URLSearchParams({ expand: '1', title: input.title, body: input.body });
      const url = `https://github.com/${parsed.owner}/${parsed.repo}/compare/${base}...${branch}?${params.toString()}`;
      return { ok: true, url, usedFallback: true };
    },
  );

  ipcMain.handle(IPC.git.githubAccount, async (): Promise<GithubAccount> => readGithubAccount());

  ipcMain.handle(IPC.git.githubActivity, async (): Promise<GithubActivity> => readGithubActivity());

  ipcMain.handle(
    IPC.git.githubNotifications,
    async (): Promise<GithubNotifications> => readGithubNotifications(),
  );

  ipcMain.handle(
    IPC.git.githubMarkNotificationRead,
    async (_event, threadId: string): Promise<GitOpResult> => markGithubNotificationRead(threadId),
  );

  ipcMain.handle(
    IPC.git.githubMarkNotificationsRead,
    async (): Promise<GitOpResult> => markGithubNotificationsRead(),
  );

  ipcMain.handle(
    IPC.git.lookupGithubRepo,
    async (_event, owner: string, name: string): Promise<GithubRepoLookup> => {
      const cleanOwner = owner.trim();
      const cleanName = name.trim().replace(/\.git$/i, '');
      if (!GITHUB_NAME_PATTERN.test(cleanOwner) || !GITHUB_NAME_PATTERN.test(cleanName)) {
        return {
          ok: false,
          exists: false,
          error:
            'Owner and repository names can only hold letters, digits, dots, dashes and underscores.',
        };
      }
      if (!(await isGhCliAvailable())) {
        return { ok: false, exists: false, error: 'GitHub CLI (gh) is not installed.' };
      }

      try {
        const repo = await ghApi<GithubApiRepo>(`repos/${cleanOwner}/${cleanName}`);
        return { ok: true, exists: true, repo: toRepoInfo(repo) };
      } catch (error) {
        const message = ghErrorMessage(error);
        // A 404 is the answer we asked for ("there is no such repo"), not a failure.
        if (/\b404\b|not found/i.test(message)) return { ok: true, exists: false };
        return { ok: false, exists: false, error: message };
      }
    },
  );

  ipcMain.handle(
    IPC.git.createGithubRepo,
    async (_event, input: CreateGithubRepoInput): Promise<CreateGithubRepoResult> => {
      const owner = input.owner.trim();
      const name = input.name.trim().replace(/\.git$/i, '');
      if (!GITHUB_NAME_PATTERN.test(owner) || !GITHUB_NAME_PATTERN.test(name)) {
        return {
          ok: false,
          error:
            'Owner and repository names can only hold letters, digits, dots, dashes and underscores.',
        };
      }

      const account = await readGithubAccount();
      if (!account.authenticated) {
        return {
          ok: false,
          error: account.cliAvailable
            ? `Not signed in to the GitHub CLI. Run "gh auth login" first.${account.error ? ` (${account.error})` : ''}`
            : 'GitHub CLI (gh) is not installed.',
        };
      }

      // Repos live under either the account itself or one of its organizations, and
      // GitHub has a separate endpoint for each.
      const isPersonal = owner.toLowerCase() === (account.login ?? '').toLowerCase();
      const endpoint = isPersonal ? 'user/repos' : `orgs/${owner}/repos`;
      const args = ['-X', 'POST', '-f', `name=${name}`, '-F', `private=${input.isPrivate}`];
      const description = input.description?.trim();
      if (description) args.push('-f', `description=${description}`);

      try {
        const repo = await ghApi<GithubApiRepo>(endpoint, args);
        return { ok: true, repo: toRepoInfo(repo) };
      } catch (error) {
        return { ok: false, error: ghErrorMessage(error) };
      }
    },
  );
}

export function registerGitHandlers(): void {
  registerRepoHandlers();
  registerBranchHandlers();
  registerTagHandlers();
  registerGithubHandlers();
}
