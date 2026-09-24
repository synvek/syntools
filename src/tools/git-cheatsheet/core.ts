export type GitCategory =
  'setup' | 'commit' | 'branch' | 'remote' | 'undo' | 'log' | 'stash' | 'tag';

export interface GitCommand {
  category: GitCategory;
  command: string;
  description: string;
}

export const GIT_CATEGORIES: GitCategory[] = [
  'setup',
  'commit',
  'branch',
  'remote',
  'undo',
  'log',
  'stash',
  'tag',
];

export const GIT_COMMANDS: GitCommand[] = [
  { category: 'setup', command: 'git init', description: 'Initialize a new repository' },
  { category: 'setup', command: 'git clone <url>', description: 'Clone a remote repository' },
  {
    category: 'setup',
    command: 'git config --global user.name "<name>"',
    description: 'Set global user name',
  },
  {
    category: 'setup',
    command: 'git config --global user.email "<email>"',
    description: 'Set global email',
  },

  { category: 'commit', command: 'git status', description: 'Show working tree status' },
  { category: 'commit', command: 'git add <file>', description: 'Stage a file' },
  { category: 'commit', command: 'git add -A', description: 'Stage all changes' },
  { category: 'commit', command: 'git commit -m "<msg>"', description: 'Commit staged changes' },
  { category: 'commit', command: 'git commit --amend', description: 'Amend the last commit' },
  { category: 'commit', command: 'git diff', description: 'Show unstaged changes' },
  { category: 'commit', command: 'git diff --staged', description: 'Show staged changes' },

  { category: 'branch', command: 'git branch', description: 'List local branches' },
  { category: 'branch', command: 'git branch <name>', description: 'Create a branch' },
  { category: 'branch', command: 'git checkout <branch>', description: 'Switch branch' },
  {
    category: 'branch',
    command: 'git switch -c <name>',
    description: 'Create and switch to a branch',
  },
  { category: 'branch', command: 'git merge <branch>', description: 'Merge a branch into current' },
  {
    category: 'branch',
    command: 'git rebase <branch>',
    description: 'Rebase current branch onto another',
  },
  { category: 'branch', command: 'git branch -d <name>', description: 'Delete a merged branch' },

  { category: 'remote', command: 'git remote -v', description: 'List remotes' },
  { category: 'remote', command: 'git remote add origin <url>', description: 'Add a remote' },
  { category: 'remote', command: 'git fetch', description: 'Download objects and refs (no merge)' },
  { category: 'remote', command: 'git pull', description: 'Fetch and merge' },
  { category: 'remote', command: 'git pull --rebase', description: 'Fetch and rebase' },
  { category: 'remote', command: 'git push', description: 'Push commits to remote' },
  {
    category: 'remote',
    command: 'git push -u origin <branch>',
    description: 'Push and set upstream',
  },

  { category: 'undo', command: 'git restore <file>', description: 'Discard changes in a file' },
  { category: 'undo', command: 'git restore --staged <file>', description: 'Unstage a file' },
  {
    category: 'undo',
    command: 'git reset --soft HEAD~1',
    description: 'Undo last commit, keep changes staged',
  },
  {
    category: 'undo',
    command: 'git reset --hard HEAD~1',
    description: 'Undo last commit and discard changes',
  },
  {
    category: 'undo',
    command: 'git revert <commit>',
    description: 'Create a commit that reverts another',
  },
  {
    category: 'undo',
    command: 'git clean -fd',
    description: 'Remove untracked files and directories',
  },

  {
    category: 'log',
    command: 'git log --oneline --graph --all',
    description: 'Compact graphical history',
  },
  { category: 'log', command: 'git log -p <file>', description: 'History with patches for a file' },
  { category: 'log', command: 'git blame <file>', description: 'Show who changed each line' },
  { category: 'log', command: 'git show <commit>', description: 'Show a commit' },
  { category: 'log', command: 'git shortlog -sn', description: 'Commit count per author' },

  { category: 'stash', command: 'git stash', description: 'Stash local changes' },
  { category: 'stash', command: 'git stash list', description: 'List stashes' },
  { category: 'stash', command: 'git stash pop', description: 'Apply and drop the latest stash' },
  {
    category: 'stash',
    command: 'git stash apply',
    description: 'Apply the latest stash (keep it)',
  },
  { category: 'stash', command: 'git stash drop', description: 'Delete the latest stash' },

  { category: 'tag', command: 'git tag', description: 'List tags' },
  { category: 'tag', command: 'git tag <name>', description: 'Create a lightweight tag' },
  {
    category: 'tag',
    command: 'git tag -a <name> -m "<msg>"',
    description: 'Create an annotated tag',
  },
  { category: 'tag', command: 'git push origin <tag>', description: 'Push a tag' },
  { category: 'tag', command: 'git push origin --tags', description: 'Push all tags' },
];

/** 按命令或描述过滤（忽略大小写）。 */
export function filterGitCommands(query: string): GitCommand[] {
  const q = query.trim().toLowerCase();
  if (!q) return GIT_COMMANDS;
  return GIT_COMMANDS.filter(
    (c) => c.command.toLowerCase().includes(q) || c.description.toLowerCase().includes(q),
  );
}
