# smflib for JavaScript

SMF (Standard MIDI File) manipulation library for JavaScript.

## usage

### smfdump.js - SMF event dumper

    $ node smfdump.js target_smf_file.mid
    <+0 Meta:TRACK_NAME>
    <+0 Meta:TIME_SIGN>
    <+0 Meta:TIME_SIGN>
    <+0 Event:NOTE_ON ch:0, notenum:36, velocity:100>
    <+0 Event:NOTE_ON ch:0, notenum:49, velocity:100>
    <+96 Event:NOTE_OFF ch:0, notenum:36, velocity:64>
    <+0 Event:NOTE_OFF ch:0, notenum:49, velocity:64>
    

### conv2track10.js - convert channel of MIDI event to 10 (drum track)

    $ node conv2track10.js target_smf.mid output_smf.mid 
    done!

