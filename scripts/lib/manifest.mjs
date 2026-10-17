// plugin.json checks: valid JSON, name match, SemVer version, catalog version match.
import { problem } from './report.mjs';
import { readJson, isObject } from './json.mjs';
import { CATALOG_FILE } from './catalog.mjs';
import { isSemver } from './semver.mjs';

/** Returns a Map name -> manifest object for plugins whose plugin.json parsed. */
export function checkManifests(root, catalog, problems) {
  const manifests = new Map();
  for (const e of catalog.entries) {
    if (!e.manifestOk) continue;
    const read = readJson(root, e.manifestPath, problems);
    if (!read.ok) continue;
    const m = read.value;
    if (!isObject(m)) {
      problems.push(problem(e.manifestPath, 'plugin-name-mismatch', 'plugin.json must be a JSON object', 'wrap the manifest in { }'));
      continue;
    }
    manifests.set(e.name, m);
    if (m.name !== e.name) {
      problems.push(
        problem(e.manifestPath, 'plugin-name-mismatch', `catalog entry name "${e.name}" differs from plugin.json name ${JSON.stringify(m.name)}`, 'make both names identical'),
      );
    }
    if (m.version === undefined) {
      problems.push(problem(e.manifestPath, 'plugin-version', 'version is missing', 'add "version": "1.0.0" (MAJOR.MINOR.PATCH)'));
    } else if (!isSemver(m.version)) {
      problems.push(
        problem(e.manifestPath, 'plugin-version', `version ${JSON.stringify(m.version)} is not valid SemVer MAJOR.MINOR.PATCH`, 'use e.g. 1.0.0 or 1.0.0-rc.1 (no "v" prefix)'),
      );
    } else if (e.hasVersion && e.version !== m.version) {
      problems.push(
        problem(CATALOG_FILE, 'catalog-version-mismatch', `plugin "${e.name}": catalog version ${JSON.stringify(e.version)} differs from plugin.json version "${m.version}"`, 'remove the version from the catalog entry or make both equal'),
      );
    }
  }
  return manifests;
}
