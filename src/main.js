const {
  S3Client,
  GetObjectCommand,
  PutObjectCommand,
} = require("@aws-sdk/client-s3");
const fs = require("fs");
const os = require("os");
const path = require("path");
const { transcodeFile } = require("./transcoder");

const client = new S3Client({ region: "us-east-1" });

const temp_folder = "video-transcode";

async function main(srcBucket, file, destBucket, destKey) {
  try {
    const outputFolder = await createTempFolder();
    const downloadedFilePath = await downloadFile(
      srcBucket,
      file,
      outputFolder
    );
    const outputFolderForTranscode = path.join(outputFolder, "output");
    await transcodeFile(downloadedFilePath, outputFolderForTranscode);
    await uploadTranscodedVideo(outputFolderForTranscode, destBucket, destKey);
  } catch (err) {
    console.error(err);
  }
}

async function downloadFile(bucket, key, outputFolder) {
  console.log(`Downloading file ${bucket}/${key}...`);
  const command = new GetObjectCommand({
    Bucket: bucket,
    Key: key,
  });
  const absoluteFilePath = path.join(outputFolder, key);
  const writeStream = fs.createWriteStream(absoluteFilePath, {
    encoding: "utf8",
  });
  const response = await client.send(command);
  return new Promise((resolve, reject) => {
    response.Body.pipe(writeStream)
      .on("error", (err) => reject(err))
      .on("close", () => resolve(absoluteFilePath));
  });
}

async function uploadTranscodedVideo(outputFolder, bucket, destKey) {
  console.log(`Uploading folder ${outputFolder}...`);
  const filesToUpload = fs.readdirSync(outputFolder);
  if (filesToUpload.length === 0) {
    console.error("No files to upload");
    process.exit(1);
  }
  const promises = [];
  filesToUpload.forEach((file) => {
    promises.push(
      uploadSingleFile(outputFolder, file, bucket, `${destKey}/${file}`)
    );
  });
  return Promise.all(promises);
}

async function createTempFolder() {
  const tempFolder = await fs.mkdtempSync(path.join(os.tmpdir(), temp_folder));
  console.log(`Output folder path: ${tempFolder}`);
  return tempFolder;
}

async function uploadSingleFile(srcFolder, fileName, bucket, key) {
  console.log(`Uploading file ${fileName} to bucket ${bucket}...`);
  const fileStream = fs.createReadStream(path.join(srcFolder, fileName));
  const command = new PutObjectCommand({
    Bucket: bucket,
    Key: key,
    Body: fileStream,
  });
  await client.send(command);
  fileStream.close();
}
