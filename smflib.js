
function _debugLog(data) {
  //console.log(data);
}

class Event {
  constructor() {
  }

  toString() {
    if (this.eventType == "SYSEX") {
      return `<+${this.deltaTime} SysEx:${this.event} ${this.data.length} byte(s)> `;
    }

    if (this.eventType == "MIDI") {
      let event = "";
      if (this.type == "NOTE_OFF" || this.type == "NOTE_ON") {
        event = `notenum:${this.notenum}, velocity:${this.velocity}`;
      }
        
      return `<+${this.deltaTime} Event:${this.type} ch:${this.channel}, ${event}>`;
    }

    if (this.eventType == "META") {
      return `<+${this.deltaTime} Meta:${this.type}>`;
    }
  }

  updateRawData() {
    if (this.eventType != "MIDI") {
      return;
    }

    if (this.type == "SYSTEM") {
      return;
    }

    const b = this.rawData.readUInt8(0);
    if (b < 0x80) {
      return;
    }
    let newType = (b & 0xF0) + this.channel;
    this.rawData.writeUInt8(newType, 0);
  }

  _readVariableData(buf, offset) {
    // read variable-length data
    let data = 0;
    let b = buf.readUInt8(offset);
    offset++;

    while (b >= 0x80) {
      data += (b - 0x80);
      data = data << 7;
      b = buf.readUInt8(offset);
      offset++;
    }

    data += b;
    return [offset, data];
  }

  parse(buf, offset) {
    // read delta-time
    let deltaTime = 0;
    let startOffset = offset;
    [offset, deltaTime] = this._readVariableData(buf, offset);
    this.deltaTime = deltaTime;
    this.rawDeltaTime = Buffer.from(buf.slice(startOffset, offset));

    // read event
    let b = buf.readUInt8(offset);
    offset++;
    if (b == 0xf0) {
      // SysEx F0 event
      offset = this._readSysExEvent(b, buf, offset);
    } else if (b == 0xf7) {
      // SysEx F7 event
      offset = this._readSysExEvent(b, buf, offset);
    } else if (b == 0xff) {
      // meta event
      offset = this._readMetaEvent(b, buf, offset);
    } else {
      // MIDI event
      offset = this._readMidiEvent(b, buf, offset);
    }

    return offset;
  }

  _readSysExEvent(b, buf, offset) {
    // read SysEx event
    this.eventType = "SYSEX";

    // read length
    let length = 0;
    [offset, length] = this._readVariableData(buf, offset);
    //_debugLog(`SysEx: (${length} bytes)`);

    this.event = b;
    this.data = Buffer.from(buf.slice(offset, offset + length));
    offset += length;

    return offset;
  }

  _readMidiEvent(b, buf, offset) {
    // read MIDI event
    this.eventType = "MIDI";
    const startOffset = offset - 1;
    
    // parse MIDI event
    // check running status
    if (b < 0x80) {
      this.rawType = this.prev.rawType;
    } else {      
      this.rawType = b;
    }
    let type = this.rawType >> 4;

    if (type == 0x08) {
      this.type = "NOTE_OFF";
      this.notenum = buf.readUInt8(offset);
      offset++;
      this.velocity = buf.readUInt8(offset);
      offset++;
    } else if (type == 0x09) {
      this.type = "NOTE_ON";
      this.notenum = buf.readUInt8(offset);
      offset++;
      this.velocity = buf.readUInt8(offset);
      offset++;
    } else if (type == 0x0A) {
      this.type = "KEY_PRESSURE";
      this.notenum = buf.readUInt8(offset);
      offset++;
      this.pressure = buf.readUInt8(offset);
      offset++;
    } else if (type == 0x0B) {
      this.type = "CONTROL_CHANGE";
      this.ccnum = buf.readUInt8(offset);
      offset++;
      this.data = buf.readUInt8(offset);
      offset++;
    } else if (type == 0x0C) {
      this.type = "PROGRAM_CHANGE";
      this.pcnum = buf.readUInt8(offset);
      offset++;
    } else if (type == 0x0D) {
      this.type = "CHANNEL_PRESSURE";
      this.pressure = buf.readUInt8(offset);
      offset++;
    } else if (type == 0x0E) {
      this.type = "PITCH_WHEEL";
      const b2 = buf.readUInt8(offset);
      offset++;
      const b3 = buf.readUInt8(offset);
      offset++;
      this.value = ((b3 & 0x7F) << 7) + (b2 & 0x7F);
    }

    if (type == 0x0F) {
      this.type = "SYSTEM";
      const b2 = buf.readUInt8(offset);
      offset++;
      const b3 = buf.readUInt8(offset);
      offset++;
      this.lsb = b2;
      this.msb = b3;
    } else {
      this.channel = b & 0x0F;
    }
    
    //_debugLog(`+${this.deltaTime} ch:${this.channel} <Event:${b}> ${this.type}`);
    this.rawData = Buffer.from(buf.slice(startOffset, offset));

    return offset;
  }

  _readMetaEvent(b, buf, offset) {
    // read Meta Event
    this.eventType = "META";
    const startOffset = offset - 1;

    // read type
    const type = buf.readUInt8(offset);
    offset++;
    this.type = type;

    // read length
    let length = 0;
    [offset, length] = this._readVariableData(buf, offset);
    this.rawData = Buffer.from(buf.slice(startOffset, offset + length));
    
    // read data
    if (1 <= type && type <= 0x0F) {
      // read text data
      const data = buf.toString('ascii', offset, offset + length);
      offset += length;

      if (type == 0x01) {
        this.type = "TEXT_EVENT";
        this.string = data;
      } else if (type == 0x02) {
        this.type = "COPYRIGHT";
        this.string = data;
      } else if (type == 0x03) {
        this.type = "TRACK_NAME";
        this.string = data;
      } else if (type == 0x04) {
        this.type = "INST_NAME";
        this.string = data;
      } else if (type == 0x05) {
        this.type = "LYRIC";
        this.string = data;
      } else if (type == 0x06) {
        this.type = "MARKER";
        this.string = data;
      } else if (type == 0x07) {
        this.type = "CUE_POINT";
        this.string = data;
      } else {
        this.type = "TEXT_RESERVED";
        this.string = data;
      }

      //_debugLog(`+${this.deltaTime} <MetaEvent> ${this.type} ${this.string}`);
    } else {
      // read binary data

      if (type == 0x20) {
        this.type = "CHANNEL_PREFIX";
        this.data = buf.readUInt8(offset);
        offset++;
      } else if (type == 0x21) {
        this.type = "PORT_PREFIX";
        this.data = buf.readUInt8(offset);
        offset++;
      } else if (type == 0x2F) {
        this.type = "EOT";
      } else if (type == 0x51) {
        this.type = "SET_TEMPO";
        this.data = buf.readUInt32BE(offset) >> 8;
        offset += 3;
      } else if (type == 0x54) {
        this.type = "SMPTE_OFFSET";
        const hh = buf.readUInt8(offset);
        offset++;
        const mm = buf.readUInt8(offset);
        offset++;
        const ss = buf.readUInt8(offset);
        offset++;
        const frame = buf.readUInt8(offset);
        offset++;
        const subframe = buf.readUInt8(offset);
        offset++;
        this.data = `${hh}:${mm}:${ss}.${frame}.${subframe}`;
      } else if (type == 0x58) {
        this.type = "TIME_SIGN";
        const top = buf.readUInt8(offset);
        offset++;
        const btm = 2 ** buf.readUInt8(offset);
        offset++;
        const met = buf.readUInt8(offset);
        offset++;
        const note32 = buf.readUInt8(offset);
        offset++;
        this.data = `${top}/${btm} (${met} - ${note32})`;
      } else if (type == 0x59) {
        this.type = "KEY_SIGN";
        const key = buf.readInt8(offset);
        offset++;
        const min = buf.readInt8(offset);
        offset++;
        this.data = `${key} - ${min}`;
      } else if (type == 0x7F) {
        this.type = "META_EVENT";
        this.data = Buffer.from(buf.slice(offset, offset + length));
        offset += length;
      } else {
        this.type = "OTHER";
        this.data = Buffer.from(buf.slice(offset, offset + length));
        offset += length;
      }

      //_debugLog(`+${this.deltaTime} <MetaEvent> ${this.type}: ${this.data}`);
    }

    return offset;
  }
}

class Track {
  constructor() {
    this.number = -1;
    this.events = [];
  }

  parse(buf, offset) {
    _debugLog(`read track ${this.number}...`);
    offset = this._readHeader(buf, offset);
    const startOffset = offset;

    while (offset - startOffset < this.dataLength) {
      const event = new Event();
      if (this.events.length > 0) {
        event.prev = this.events[this.events.length - 1];
        this.events[this.events.length - 1].next = event;
      }
      offset = event.parse(buf, offset);
      this.events.push(event);
    }
    return offset;
  }

  _readHeader(buf, offset) {
    // read chunk type (string: 4bytes)
    const startOffset = offset;
    const chunkType = buf.toString('ascii', offset, offset + 4);
    offset += 4;
    _debugLog(`chunkType: ${chunkType}`);
    this.chunckType = chunkType;

    // read data length (unsigned int: 4bytes)
    const dataLength = buf.readUInt32BE(offset);
    offset += 4;
    _debugLog(`dataLength: ${dataLength}`);
    this.dataLength = dataLength;

    this.rawHeader = Buffer.from(buf.slice(startOffset, offset));
    return offset;
  }
  
}

class Smf {
  constructor() {
  }

  parse(buf) {
    let offset = 0;
    const parsed = {};
    offset = this._readHeader(buf);
    this.tracks = [];
    for (let num = 0; num < this.numberOfTracks; num++) {
      const track = new Track();
      track.number = num;
      offset = track.parse(buf, offset);
      this.tracks.push(track);
    }
  }

  _readHeader(buf) {
    // read chunk type (string: 4bytes)
    let offset = 0;
    const chunkType = buf.toString('ascii', offset, 4);
    offset += 4;
    _debugLog(`chunkType: ${chunkType}`);
    this.chunckType = chunkType;

    // read data length (unsigned int: 4bytes)
    const dataLength = buf.readUInt32BE(offset);
    offset += 4;
    _debugLog(`dataLength: ${dataLength}`);
    this.dataLength = dataLength;

    // read format (unsigned int: 2bytes)
    const format = buf.readUInt16BE(offset);
    offset += 2;
    _debugLog(`format: ${format}`);
    this.format = format;
    
    // trucks (unsigned int: 2bytes)
    const tracks = buf.readUInt16BE(offset);
    offset += 2;
    _debugLog(`number of tracks: ${tracks}`);
    this.numberOfTracks = tracks;
    
    // resolution (unsigned int: 2bytes)
    let resolution = buf.readUInt16BE(offset);
    let resolutionType = 0;
    offset += 2;
    if (resolution >= 0x8000) {
      resolution -= 0x8000;
      resolutionType = 1;
    }
    _debugLog(`resolution: ${resolution}, type: ${resolutionType}`);
    this.resolution = resolution;
    this.resolutionType = resolutionType;
    
    this.rawHeader = Buffer.from(buf.slice(0, offset));
    return offset;
  }
  
}

exports.parse = function parse(buf) {
  const smf = new Smf();
  smf.parse(buf);
  return smf;
};
