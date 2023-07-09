/**
 * Based on https://blog.infireal.com/2018/04/mpeg-dash-with-only-ffmpeg/
 */
const path = require("path");
const ffmpeg = require("fluent-ffmpeg");
const os = require("os");
var fs = require("fs");

if (os.platform() == "win32") {
  const binarypath = path.resolve("./ffmpeg/bin/");
  const FfmpegPath = path.join(binarypath, "ffmpeg.exe");
  try {
    const FfmpegPathInfo = fs.statSync(FfmpegPath);
  } catch (err) {
    throw err;
  }
  ffmpeg.setFfmpegPath(FfmpegPath);
  ffmpeg.setFfprobePath(path.join(binarypath, "ffprobe.exe"));
}

async function transcodeFile(inputVideoPath, targetdir) {
  createTargetDir(targetdir);
  return runFFMpeg(targetdir, inputVideoPath);
}

function createTargetDir(targetdir) {
  try {
    fs.statSync(targetdir);
  } catch (err) {
    if (err.code === "ENOENT") {
      fs.mkdirSync(targetdir);
    } else {
      throw err;
    }
  }
}

function runFFMpeg(targetdir, inputVideoPath) {
  const name = path.basename(inputVideoPath, path.extname(inputVideoPath));
  const sourcefn = path.resolve(inputVideoPath);
  const targetfn = path.join(targetdir, `${name}.mpd`);
  const proc = ffmpeg({
    source: sourcefn,
    cwd: targetdir,
  });
  setArguments(proc, targetfn);
  proc.on("start", function (commandLine) {
    console.log("progress", "Running FFmpeg with command: " + commandLine);
  });
  return new Promise((resolve, reject) => {
    proc
      .on("progress", function (info) {
        console.log("progress", info);
      })
      .on("end", function () {
        console.log("complete");
        resolve();
      })
      .on("error", function (err) {
        console.log("error", err);
        reject();
      });
    proc.run();
  });
}

function setArguments(proc, targetfn) {
  const sizes = [
    [240, 350],
    [480, 700],
    [720, 2500],
    [1080, 3500],
  ];
  proc
    .output(targetfn)
    .format("dash")
    .videoCodec("libx264")
    .audioCodec("aac")
    .audioChannels(2)
    .audioFrequency(44100)
    .outputOptions([
      "-preset veryfast",
      "-keyint_min 60",
      "-g 60",
      "-sc_threshold 0",
      "-profile:v main",
      "-use_template 1",
      "-use_timeline 1",
      "-b_strategy 0",
      "-bf 1",
      "-map 0:a",
      "-b:a 96k",
    ]);

  for (const size of sizes) {
    let index = sizes.indexOf(size);
    proc.outputOptions([
      `-filter_complex [0]format=pix_fmts=yuv420p[temp${index}];[temp${index}]scale=-2:${size[0]}[A${index}]`,
      `-map [A${index}]:v`,
      `-b:v:${index} ${size[1]}k`,
    ]);
  }
}

module.exports = {
  transcodeFile,
};
