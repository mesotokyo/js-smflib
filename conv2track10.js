const fs = require('fs');
const smflib = require('./smflib');

function usage() {
  console.log(`${process.argv[1]} - SMF file channel swapper`);
  console.log(`usage: ${process.argv[0]} ${process.argv[1]} <input SMF file> <output SMF file>`);
}

function main() {
  if (process.argv.length < 4) {
    return usage();
  }
  const targetFilePath = process.argv[2];
  const outputFilePath = process.argv[3];

  const data = fs.readFileSync(targetFilePath);
  const smf = smflib.parse(data);
  smf.tracks[0].events.forEach(ev => {
    ev.channel = 9;
  });

  const fd = fs.openSync(outputFilePath, "w");
  let offset = 0;
  fs.writeSync(fd, smf.rawHeader);
  smf.tracks.forEach(track => {
    fs.writeSync(fd, track.rawHeader);
    track.events.forEach(event => {
      event.updateRawData();
      fs.writeSync(fd, event.rawDeltaTime);
      fs.writeSync(fd, event.rawData);
    });
  });
  
  fs.closeSync(fd);
  console.log("done!");
  
}

main();
