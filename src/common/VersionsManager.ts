import semver from 'semver'

export default class VersionsManager {
  private readonly componentVersion: string

  /**
   * @param componentVersion - a semver of a component that uses the VersionsManager
   */
  constructor (componentVersion: string) {
    if (semver.valid(componentVersion) == null) {
      throw new Error('Component version is not valid')
    }
    this.componentVersion = componentVersion
  }

  /**
   * @param version - the version of a dependency to compare against
   * @return true if {@param version} is same or newer then {@link componentVersion}
   */
  isMinorSameOrNewer (version: string): boolean {
    const range = '^' + this.componentVersion
    return semver.satisfies(version, range)
  }
}
