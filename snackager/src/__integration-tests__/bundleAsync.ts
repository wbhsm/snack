import fs from 'fs';
import mapValues from 'lodash/mapValues';
import os from 'os';
import path from 'path';
import util from 'util';

import { getCoreExternals } from '../bundler/externals';
import fetchAndExtract from '../utils/fetchAndExtract';
import fetchMetadata from '../utils/fetchMetadata';
import findVersion from '../utils/findVersion';
import getBundleInfo, { BundleInfo } from '../utils/getBundleInfo';
import installPackage from '../utils/installPackage';
import packageBundle from '../utils/packageBundle';
import parseRequest from '../utils/parseRequest';
import resolveDependencies from '../utils/resolveDependencies';

// TODO: replace rimraf with fs.rm once node 14.40 lands
const rimraf = util.promisify(require('rimraf'));

const DEFAULT_PLATFORMS = ['ios', 'android', 'web'];

type BundledPackage = {
  name: string;
  version: string;
  // TODO: fix possible null dependency and replace with `Package['peerDependencies']`
  peerDependencies: { [dependency: string]: string | null };
  files: { [platform: string]: { [file: string]: BundleInfo } };
};

export default async function bundleAsync(
  packageSpec: string,
  bundlePlatforms: string[] = DEFAULT_PLATFORMS,
  includeCode?: boolean
): Promise<BundledPackage> {
  const { qualified, id, tag, scope, deep, platforms } = parseRequest(
    `/${packageSpec}?platforms=${bundlePlatforms.join(',')}`
  );
  const workdir = path.join(
    fs.realpathSync(os.tmpdir()),
    'snackager',
    '__integration-tests__',
    qualified
  );
  try {
    await rimraf(workdir);
  } catch (e) {}
  const packagedir = path.join(workdir, 'package');

  const meta = await fetchMetadata(qualified, { scope, id });
  const { version, isLatest } = findVersion(qualified, meta, tag);
  const { pkg, dependencies } = resolveDependencies(meta, version, isLatest, deep);

  await fetchAndExtract(pkg, version, workdir);
  await installPackage(packagedir);

  const files = await packageBundle({
    pkg,
    cwd: packagedir,
    platforms,
    base: 'nonsense',
    deep,
    externalDependencies: dependencies,
  });

  return {
    name: qualified,
    version,
    files: mapValues(files, (file, platform) =>
      mapValues(file, (buffer, filename) => {
        const metadata = getBundleInfo(filename, buffer, includeCode);
        (metadata.externals ?? []).forEach((external) => {
          if (!getCoreExternals().includes(external) && !dependencies[external]) {
            console.warn(
              `Bundle "${qualified}@${version}/${platform}-${filename}" contains external "${external}" which is not listed as a peer dependency in package.json`
            );
          }
        });
        return metadata;
      })
    ),
    peerDependencies: dependencies,
  };
}
