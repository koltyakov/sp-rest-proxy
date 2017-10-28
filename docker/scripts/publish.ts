import { writeFileSync } from 'fs';
import { join } from 'path';
import { exec } from 'child_process';

const execPromise = (command) => {
  return new Promise((resolve, reject) => {
    exec(command, (err, stdout, stderr) => {
      if (err) {
        return reject(err);
      }
      if (stderr) {
        return reject(stderr);
      }
      resolve(stdout);
    });
  });
};

async function publish() {

  const repoName = 'koltyakov/sp-rest-proxy';

  const metadata = require(join(__dirname, '..', '..', 'package.json'));
  const version = metadata.version;
  let result;

  let updatePackage = false;
  let dockerPackageJson = require(join(__dirname, '..', 'package.json'));
  if (dockerPackageJson.version !== version) {
    dockerPackageJson.version = version;
    console.log(`Package version is updated to ${version}`);
    updatePackage = true;
  }
  if (dockerPackageJson.dependencies['sp-rest-proxy'] !== `^${version}`) {
    dockerPackageJson.dependencies['sp-rest-proxy'] = `^${version}`;
    console.log(`sp-rest-proxy dependency is updated to ^${version}`);
    updatePackage = true;
  }
  if (updatePackage) {
    writeFileSync(join(__dirname, '..', 'package.json'), JSON.stringify(dockerPackageJson, null, 2));
  }

  console.log(`=== Building image for version ${version} ===`);

  result = await execPromise(`cd docker && docker build -t ${repoName}:${version} .`);
  console.log(result);

  result = await execPromise(`cd docker && docker build -t ${repoName}:latest .`);
  console.log(result);

  console.log(`=== Pushing images to docker hub ===`);

  result = await execPromise(`docker push ${repoName}:${version}`);
  console.log(result);

  result = await execPromise(`docker push ${repoName}:latest`);
  console.log(result);

  console.log(`=== Deleting local images ===`);

  result = await execPromise(`docker images | grep ${repoName}`);

  let images = result
    .trim()
    .split('\n')
    .map(r => r.replace(/  +/g, ' ').split(' '))
    .map(r => r[2]);

  images = images.filter((elem, pos) => {
    return images.indexOf(elem) === pos;
  });

  for (let imageId of images) {
    await execPromise(`docker rmi ${imageId} --force`);
  }

  console.log(images);

}

publish()
  .then(_ => {
    console.log('=== Done ===');
  })
  .catch(err => {
    console.log('=== Failed ===');
    console.log(err);
  });
