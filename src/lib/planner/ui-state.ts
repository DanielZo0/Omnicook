export function responseIsCurrent(
  start: { owner: string; request: number },
  current: { owner: string; request: number },
): boolean {
  return start.owner === current.owner && start.request === current.request;
}


export function shouldRefreshCookbook(previous: readonly unknown[], current: readonly unknown[], pending: boolean): boolean {
  return previous !== current && !pending;
}
