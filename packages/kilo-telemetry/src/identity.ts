// albert_change - no machine id, no profile lookup: Albert Code never identifies the user.
export namespace Identity {
  export function setDataPath(_path: string) {}

  export async function getMachineId(): Promise<string | undefined> {
    return undefined
  }

  export function getDistinctId(): string {
    return "unknown"
  }

  export function getUserId(): string | null {
    return null
  }

  export function getOrganizationId(): string | null {
    return null
  }

  export function setOrganizationId(_orgId: string | null) {}

  export async function updateFromKiloAuth(_token: string | null, _accountId?: string): Promise<void> {}

  export function reset() {}
}
