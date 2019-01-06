const fs = require('fs');
const smflib = require('./smflib');

function main() {
  if (process.argv.length < 3) {
    return usage();
  }
  const targetFilePath = process.argv[2];
  const data = fs.readFileSync(targetFilePath);
  const smf = smflib.parse(data);
  smf.tracks[0].events.forEach(ev => {
    console.log(ev.toString());
  });
}

function usage() {
  console.log(`${process.argv[1]} - SMF file dumper`);
  console.log(`usage: ${process.argv[0]} ${process.argv[1]} <SMF file>`);
}

main();
