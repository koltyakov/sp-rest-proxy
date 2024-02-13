import { writeFileSync } from 'fs';
import { join } from 'path';
import { exec } from 'child_process';

// tslint:disable-next-line:no-console
const log = console.log;

const execPromise = (command: string): Promise<string> => {
  return new Promise((resolve, reject) => {
    exec(command, (err, stdout) => {
      if (err) return reject(err);
      resolve(stdout);
    });
  });
};

async function publish () {

  const repoName = 'koltyakov/sp-rest-proxy';

  // eslint-disable-next-line @typescript-eslint/no-var-requires
  const metadata = require(join(__dirname, '..', '..', 'package.json'));
  const version = metadata.version;
  let result: string;

  let updatePackage = false;
  // eslint-disable-next-line @typescript-eslint/no-var-requires
  const dockerPackageJson = require(join(__dirname, '..', 'package.json'));
  if (dockerPackageJson.version !== version) {
    dockerPackageJson.version = version;
    log(`Package version is updated to ${version}`);
    updatePackage = true;
  }
  if (dockerPackageJson.dependencies['sp-rest-proxy'] !== `^${version}`) {
    dockerPackageJson.dependencies['sp-rest-proxy'] = `^${version}`;
    log(`sp-rest-proxy dependency is updated to ^${version}`);
    updatePackage = true;
  }
  if (updatePackage) {
    writeFileSync(join(__dirname, '..', 'package.json'), JSON.stringify(dockerPackageJson, null, 2));
  }

  log(`=== Building image for version ${version} ===`);

  result = await execPromise(`cd docker && docker build --platform linux/amd64 -t ${repoName}:${version} .`);
  log(result);

  result = await execPromise(`cd docker && docker build --platform linux/amd64 -t ${repoName}:latest .`);
  log(result);

  log('=== Pushing images to docker hub ===');

  result = await execPromise(`docker push ${repoName}:${version}`);
  log(result);

  result = await execPromise(`docker push ${repoName}:latest`);
  log(result);

  log('=== Deleting local images ===');

  result = await execPromise(`docker images | grep ${repoName}`);

  let images = result
    .trim()
    .split('\n')
    // tslint:disable-next-line:no-regex-spaces
    .map((r) => r.replace(/  +/g, ' ').split(' '))
    .map((r) => r[2]);

  images = images.filter((elem, pos) => images.indexOf(elem) === pos);

  for (const imageId of images) {
    await execPromise(`docker rmi ${imageId} --force`);
  }

  log(images);

}

publish()
  .then(() => {
    log('=== Done ===');
  })
  .catch((err) => {
    log('=== Error log ===');
    log(err);
    log('=== Failed ===');
  });
