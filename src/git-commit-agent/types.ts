export type CommitResult = {
  success: boolean;
  message: string;
  commitHash?: string;
  error?: string;
};

export type GitCommitOptions = {
  all?: boolean;
  push?: boolean;
  dryRun?: boolean;
};

export type RepositoryAnalysis = {
  status: string;
  diff: string;
  branch: string;
  changedFiles: string[];
};