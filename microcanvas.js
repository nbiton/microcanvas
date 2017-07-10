'use strict';

(function() {
  function MicroCanvas(ctx) {
    ctx = ctx || document.querySelector('canvas.microcanvas').getContext('2d');
    ctx.width = ctx.canvas.width;
    ctx.height = ctx.canvas.height;

    // Disables interpolation on drawImage calls
    ctx.mozImageSmoothingEnabled = false;

    // Keystroke emulation
    ctx.$buttons = {};
    window.addEventListener('keydown', e => {
      if (e.key==='ArrowLeft') ctx.$buttons.left = true;
      if (e.key==='ArrowRight') ctx.$buttons.right = true;
      if (e.key==='ArrowUp') ctx.$buttons.up = true;
      if (e.key==='ArrowDown') ctx.$buttons.down = true;
      if (e.key===' ') ctx.$buttons.A = true;
      if (e.key==='Enter') ctx.$buttons.B = true;
    });

    window.addEventListener('keyup', e => {
      if (e.key==='ArrowLeft') ctx.$buttons.left = false;
      if (e.key==='ArrowRight') ctx.$buttons.right = false;
      if (e.key==='ArrowUp') ctx.$buttons.up = false;
      if (e.key==='ArrowDown') ctx.$buttons.down = false;
      if (e.key===' ' ) ctx.$buttons.A = false;
      if (e.key==='Enter') ctx.$buttons.B = false;
    });

    // default fillStyle
    ctx.fillStyle = "white";

    let mc = Object.assign(ctx, MicroCanvas.prototype);
    return mc;
  }

  let MCP = MicroCanvas.prototype;

  MCP.loadGraphics = function(src) {
    return loadBytestream(src);
  };
  MCP.loadSprite = function(src) {
    return loadBytestream(src);
  }
  MCP.loadTune = function(src) {
    let contents = arrayInitializerContent(src);

    return new ArduboyScore(contents);
  }
  MCP.everyXFrame = function(frames) {
     return this.frameCount % frames == 0;
  }
  MCP.clear = function() {
    this.clearRect(0, 0, this.width, this.height);
  };
  MCP.eraseImage = function(...args) {
    // Learn more of composites:
    // https://developer.mozilla.org/en-US/docs/Web/API/CanvasRenderingContext2D/globalCompositeOperation
    let prevComp = this.globalCompositeOperation;

    this.globalCompositeOperation = 'destination-out';
      this.drawImage(...args);
    this.globalCompositeOperation = prevComp;
  };
  MCP.drawText = function (text, x, y, size) {
    size = size || 1;
    let c = 0,
      xd = 0,
      w = game.gfont[0].width, h = game.gfont[0].height;

    while (c < text.length) {
      switch (text.charAt(c)) {
        case '\r': break;
        case '\n': y += (h+1)*size; xd = 0; break;
        default:
          game.drawImage(game.gfont[text.charCodeAt(c)], x + xd*size, y, w*size, h*size);
          xd += w+1;
      }
      ++c;
    };
  };
  MCP.detectCollision = function (s1, x1,y1, s2, x2,y2, precise=true) {
    let result = false;

    this.save();

    this.strokeStyle = "rgba(0,200,0,.3)";
    this.strokeRect(x1 +.5,y1 +.5, s1.width -1,s1.height -1);
    this.strokeRect(x2 +.5,y2 +.5, s2.width -1,s2.height -1);

    // Basic collision rectangle
    let cx = x1>x2 ? x1 : x2;
    let cw = x1>x2 ? x2+s2.width-x1 : x1+s1.width-x2;

    let cy = y1>y2 ? y1 : y2;
    let ch = y1>y2 ? y2+s2.height-y1 : y1+s1.height-y2;

    if (cw>0 && ch>0) {
      this.fillStyle = "rgba(200,0,0,.5)";
      this.fillRect(cx,cy, cw,ch);
      result = true;
    }

    // No bounding rect collision or no precise check requested
    if (!precise || !result) {
      this.restore();
      return result;
    }

    // Optimization: Cache context on graphics objects
    s1.context = s1.context || s1.getContext('2d');
    s2.context = s2.context || s2.getContext('2d');

    let id1 = s1.context.getImageData(x1>x2 ? 0 : x2-x1, y1>y2 ? 0 : y2-y1, cw,ch);
    let id2 = s2.context.getImageData(x1<x2 ? 0 : x1-x2, y1<y2 ? 0 : y1-y2, cw,ch);

    //console.log(id1bpp,id1);
    //console.log(id2bpp,id2);

    this.fillStyle = "yellow";

    let collisions = 0;
    for (let i=0; i<id1.data.length; i+=4) {
      if (
        id1.data[i] > 0 && id2.data[i] > 0 // monochrome test
      ) {
        ++collisions;
        this.fillRect(cx + (i/4)%cw,cy + (i/4/cw)|0, 1,1);
      }
    }

    this.restore();
    return (collisions>0);
  };
  MCP.buttonPressed = function(button) {
    if (button in this.$buttons) return this.$buttons[button];
    if (button === "space") return !!this.$buttons.A;
    if (button === "enter") return !!this.$buttons.B;
    return false;
  };
  MCP.custom = function (platforms) {
    if ('canvas' in platforms) {
      ( new Function(platforms.canvas) ).call(this);
    }
  };
  MCP.random = function(min, max) {
    return Math.floor(min + Math.random()*(max-min+1));
  };
  MCP.setup = function(cb, fps = 60) {
    this.frameCount = 0;
    this.frameRate = fps;

    // Set up drawing font
    setFont.call(this);

    cb(this);

    setTimeout( _ => { this.loopCallback(); }, 0);
  };
  MCP.loop = function(cb) {
    this.loopCallback = (function() {
      cb();

      this.frameCount++;

      // Slow down framerate (for debugging etc)
      if (this.playbackRate && this.playbackRate !== 1) {
        window.setTimeout(this.loopCallback, this.frameRate/this.playbackRate);
      } else {
        window.requestAnimationFrame(this.loopCallback);
      }
    }).bind(this);
  };



  function loadBitmap(bmp) {
    let bitmap = bmp.replace(/[\t\r\n]/g,' ').trim().split(/\s+/);

    let canvas = document.createElement('canvas');
    let ctx = canvas.getContext('2d');

    canvas.width = ctx.width = bitmap[0].length;
    canvas.height = ctx.height = bitmap.length;

    ctx.fillStyle = 'white';

    bitmap.forEach(function(row, y) {
      row.split('').forEach(function(px, x) {
        if (px === '#') ctx.fillRect(x, y, 1, 1);
      });
    });

    return canvas;
  }

  function loadBytestream(bs) {
    let ret;

    let pix = new PixelData(codeToPif(bs));

    if (pix.frames) {
      ret = [...Array(pix.frames).keys()].map(i => loadBitmap(pix.frame(i).pif) );

      ret.width = ret[0].width;
      ret.height = ret[0].height;
      // ^ same as Array(pix.frames).fill(null).map((_,i) => ... );
    } else {
      ret = loadBitmap(pix.pif);
    }
    ret.pixeldata = pix;
    return ret;
  }

  function arrayInitializerContent(statement) {
    try {
      return ( statement
        .replace(/\r|\n|\t/g, ' ') // remove line breaks and tabs
        .match(/=\s*[{\[](.*)[}\]]/)[1] // match core data
        .replace(/\s+/g, ' ').trim() // clean up whitespace
      ) || statement;
    } catch(e) {};

    return statement;
  }

  function codeToPif(contents, label, statement) {
    var pdata = {};
    statement = statement || contents;

    contents = arrayInitializerContent(statement);

    // Pixelsprite id (label)
    pdata.id = label;

    // Serialized binary Pixelsprite data in PROGMEM format
    pdata.data = cleanComments(contents)
      .trim().replace(/,\s*$/,'') // get rid of useless whitespace and trailing commas
      .split(',') // get values
        .map(function(n) { return parseInt(n); }); // parse values

    // Try to guess image width/height
    pdata.w = parseInt( (statement.match(/w\:\s*(\d+)[^\n]+/) || [])[1] );
    pdata.h = Math.floor(pdata.data.length / pdata.w) * 8;
    pdata.frames = 0;
    pdata.ambiguous = true;

    // Pixelsprite dimensions can be declared in comments besides the
    // binary pixeldata in the format WWWxHHH where WWW and HHH are both
    // integer pixel values for width/height
    // eg.: PROGMEM ... sprite[] = { /*128x64*/ 0xa3, 0x... }
    // Optionally, a single pixelsprite can contain...
    var m = statement.match(/(?:\/\/|\/\*)\s*(\d+)x(\d+)(?:x(\d+))?/);
    if (m && m[1] && m[2]) {
      pdata.w = parseInt(m[1],10);
      pdata.h = parseInt(m[2],10);
      pdata.frames = m[3] ? parseInt(m[3],10) : 0;
      pdata.ambiguous = false;
    }

    return pdata;
  }

  var RX_CLEANCOMMENTS = /(\/\/[^\n]*\n|\/\*(.*?\*\/))/g;

  function cleanComments(str) {
    return str.replace(
      RX_CLEANCOMMENTS,
      function(i) { return ' '.repeat(i.length); }
    );
  }

  function setFont(graphicsFont) {
    this.gfont = graphicsFont || loadBytestream(`
const static unsigned char  font[] PROGMEM =
{ /*5x7x256*/
    0x00, 0x00, 0x00, 0x00, 0x00,
    0x3E, 0x5B, 0x4F, 0x5B, 0x3E,
    0x3E, 0x6B, 0x4F, 0x6B, 0x3E,
    0x1C, 0x3E, 0x7C, 0x3E, 0x1C,
    0x18, 0x3C, 0x7E, 0x3C, 0x18,
    0x1C, 0x57, 0x7D, 0x57, 0x1C,
    0x1C, 0x5E, 0x7F, 0x5E, 0x1C,
    0x00, 0x18, 0x3C, 0x18, 0x00,
    0xFF, 0xE7, 0xC3, 0xE7, 0xFF,
    0x00, 0x18, 0x24, 0x18, 0x00,
    0xFF, 0xE7, 0xDB, 0xE7, 0xFF,
    0x30, 0x48, 0x3A, 0x06, 0x0E,
    0x26, 0x29, 0x79, 0x29, 0x26,
    0x40, 0x7F, 0x05, 0x05, 0x07,
    0x40, 0x7F, 0x05, 0x25, 0x3F,
    0x5A, 0x3C, 0xE7, 0x3C, 0x5A,
    0x7F, 0x3E, 0x1C, 0x1C, 0x08,
    0x08, 0x1C, 0x1C, 0x3E, 0x7F,
    0x14, 0x22, 0x7F, 0x22, 0x14,
    0x5F, 0x5F, 0x00, 0x5F, 0x5F,
    0x06, 0x09, 0x7F, 0x01, 0x7F,
    0x00, 0x66, 0x89, 0x95, 0x6A,
    0x60, 0x60, 0x60, 0x60, 0x60,
    0x94, 0xA2, 0xFF, 0xA2, 0x94,
    0x08, 0x04, 0x7E, 0x04, 0x08,
    0x10, 0x20, 0x7E, 0x20, 0x10,
    0x08, 0x08, 0x2A, 0x1C, 0x08,
    0x08, 0x1C, 0x2A, 0x08, 0x08,
    0x1E, 0x10, 0x10, 0x10, 0x10,
    0x0C, 0x1E, 0x0C, 0x1E, 0x0C,
    0x30, 0x38, 0x3E, 0x38, 0x30,
    0x06, 0x0E, 0x3E, 0x0E, 0x06,
    0x00, 0x00, 0x00, 0x00, 0x00,
    0x00, 0x00, 0x5F, 0x00, 0x00,
    0x00, 0x07, 0x00, 0x07, 0x00,
    0x14, 0x7F, 0x14, 0x7F, 0x14,
    0x24, 0x2A, 0x7F, 0x2A, 0x12,
    0x23, 0x13, 0x08, 0x64, 0x62,
    0x36, 0x49, 0x56, 0x20, 0x50,
    0x00, 0x08, 0x07, 0x03, 0x00,
    0x00, 0x1C, 0x22, 0x41, 0x00,
    0x00, 0x41, 0x22, 0x1C, 0x00,
    0x2A, 0x1C, 0x7F, 0x1C, 0x2A,
    0x08, 0x08, 0x3E, 0x08, 0x08,
    0x00, 0x80, 0x70, 0x30, 0x00,
    0x08, 0x08, 0x08, 0x08, 0x08,
    0x00, 0x00, 0x60, 0x60, 0x00,
    0x20, 0x10, 0x08, 0x04, 0x02,
    0x3E, 0x51, 0x49, 0x45, 0x3E,
    0x00, 0x42, 0x7F, 0x40, 0x00,
    0x72, 0x49, 0x49, 0x49, 0x46,
    0x21, 0x41, 0x49, 0x4D, 0x33,
    0x18, 0x14, 0x12, 0x7F, 0x10,
    0x27, 0x45, 0x45, 0x45, 0x39,
    0x3C, 0x4A, 0x49, 0x49, 0x31,
    0x41, 0x21, 0x11, 0x09, 0x07,
    0x36, 0x49, 0x49, 0x49, 0x36,
    0x46, 0x49, 0x49, 0x29, 0x1E,
    0x00, 0x00, 0x14, 0x00, 0x00,
    0x00, 0x40, 0x34, 0x00, 0x00,
    0x00, 0x08, 0x14, 0x22, 0x41,
    0x14, 0x14, 0x14, 0x14, 0x14,
    0x00, 0x41, 0x22, 0x14, 0x08,
    0x02, 0x01, 0x59, 0x09, 0x06,
    0x3E, 0x41, 0x5D, 0x59, 0x4E,
    0x7C, 0x12, 0x11, 0x12, 0x7C,
    0x7F, 0x49, 0x49, 0x49, 0x36,
    0x3E, 0x41, 0x41, 0x41, 0x22,
    0x7F, 0x41, 0x41, 0x41, 0x3E,
    0x7F, 0x49, 0x49, 0x49, 0x41,
    0x7F, 0x09, 0x09, 0x09, 0x01,
    0x3E, 0x41, 0x41, 0x51, 0x73,
    0x7F, 0x08, 0x08, 0x08, 0x7F,
    0x00, 0x41, 0x7F, 0x41, 0x00,
    0x20, 0x40, 0x41, 0x3F, 0x01,
    0x7F, 0x08, 0x14, 0x22, 0x41,
    0x7F, 0x40, 0x40, 0x40, 0x40,
    0x7F, 0x02, 0x1C, 0x02, 0x7F,
    0x7F, 0x04, 0x08, 0x10, 0x7F,
    0x3E, 0x41, 0x41, 0x41, 0x3E,
    0x7F, 0x09, 0x09, 0x09, 0x06,
    0x3E, 0x41, 0x51, 0x21, 0x5E,
    0x7F, 0x09, 0x19, 0x29, 0x46,
    0x26, 0x49, 0x49, 0x49, 0x32,
    0x03, 0x01, 0x7F, 0x01, 0x03,
    0x3F, 0x40, 0x40, 0x40, 0x3F,
    0x1F, 0x20, 0x40, 0x20, 0x1F,
    0x3F, 0x40, 0x38, 0x40, 0x3F,
    0x63, 0x14, 0x08, 0x14, 0x63,
    0x03, 0x04, 0x78, 0x04, 0x03,
    0x61, 0x59, 0x49, 0x4D, 0x43,
    0x00, 0x7F, 0x41, 0x41, 0x41,
    0x02, 0x04, 0x08, 0x10, 0x20,
    0x00, 0x41, 0x41, 0x41, 0x7F,
    0x04, 0x02, 0x01, 0x02, 0x04,
    0x40, 0x40, 0x40, 0x40, 0x40,
    0x00, 0x03, 0x07, 0x08, 0x00,
    0x20, 0x54, 0x54, 0x78, 0x40,
    0x7F, 0x28, 0x44, 0x44, 0x38,
    0x38, 0x44, 0x44, 0x44, 0x28,
    0x38, 0x44, 0x44, 0x28, 0x7F,
    0x38, 0x54, 0x54, 0x54, 0x18,
    0x00, 0x08, 0x7E, 0x09, 0x02,
    0x18, 0xA4, 0xA4, 0x9C, 0x78,
    0x7F, 0x08, 0x04, 0x04, 0x78,
    0x00, 0x44, 0x7D, 0x40, 0x00,
    0x20, 0x40, 0x40, 0x3D, 0x00,
    0x7F, 0x10, 0x28, 0x44, 0x00,
    0x00, 0x41, 0x7F, 0x40, 0x00,
    0x7C, 0x04, 0x78, 0x04, 0x78,
    0x7C, 0x08, 0x04, 0x04, 0x78,
    0x38, 0x44, 0x44, 0x44, 0x38,
    0xFC, 0x18, 0x24, 0x24, 0x18,
    0x18, 0x24, 0x24, 0x18, 0xFC,
    0x7C, 0x08, 0x04, 0x04, 0x08,
    0x48, 0x54, 0x54, 0x54, 0x24,
    0x04, 0x04, 0x3F, 0x44, 0x24,
    0x3C, 0x40, 0x40, 0x20, 0x7C,
    0x1C, 0x20, 0x40, 0x20, 0x1C,
    0x3C, 0x40, 0x30, 0x40, 0x3C,
    0x44, 0x28, 0x10, 0x28, 0x44,
    0x4C, 0x90, 0x90, 0x90, 0x7C,
    0x44, 0x64, 0x54, 0x4C, 0x44,
    0x00, 0x08, 0x36, 0x41, 0x00,
    0x00, 0x00, 0x77, 0x00, 0x00,
    0x00, 0x41, 0x36, 0x08, 0x00,
    0x02, 0x01, 0x02, 0x04, 0x02,
    0x3C, 0x26, 0x23, 0x26, 0x3C,
    0x1E, 0xA1, 0xA1, 0x61, 0x12,
    0x3A, 0x40, 0x40, 0x20, 0x7A,
    0x38, 0x54, 0x54, 0x55, 0x59,
    0x21, 0x55, 0x55, 0x79, 0x41,
    0x21, 0x54, 0x54, 0x78, 0x41,
    0x21, 0x55, 0x54, 0x78, 0x40,
    0x20, 0x54, 0x55, 0x79, 0x40,
    0x0C, 0x1E, 0x52, 0x72, 0x12,
    0x39, 0x55, 0x55, 0x55, 0x59,
    0x39, 0x54, 0x54, 0x54, 0x59,
    0x39, 0x55, 0x54, 0x54, 0x58,
    0x00, 0x00, 0x45, 0x7C, 0x41,
    0x00, 0x02, 0x45, 0x7D, 0x42,
    0x00, 0x01, 0x45, 0x7C, 0x40,
    0xF0, 0x29, 0x24, 0x29, 0xF0,
    0xF0, 0x28, 0x25, 0x28, 0xF0,
    0x7C, 0x54, 0x55, 0x45, 0x00,
    0x20, 0x54, 0x54, 0x7C, 0x54,
    0x7C, 0x0A, 0x09, 0x7F, 0x49,
    0x32, 0x49, 0x49, 0x49, 0x32,
    0x32, 0x48, 0x48, 0x48, 0x32,
    0x32, 0x4A, 0x48, 0x48, 0x30,
    0x3A, 0x41, 0x41, 0x21, 0x7A,
    0x3A, 0x42, 0x40, 0x20, 0x78,
    0x00, 0x9D, 0xA0, 0xA0, 0x7D,
    0x39, 0x44, 0x44, 0x44, 0x39,
    0x3D, 0x40, 0x40, 0x40, 0x3D,
    0x3C, 0x24, 0xFF, 0x24, 0x24,
    0x48, 0x7E, 0x49, 0x43, 0x66,
    0x2B, 0x2F, 0xFC, 0x2F, 0x2B,
    0xFF, 0x09, 0x29, 0xF6, 0x20,
    0xC0, 0x88, 0x7E, 0x09, 0x03,
    0x20, 0x54, 0x54, 0x79, 0x41,
    0x00, 0x00, 0x44, 0x7D, 0x41,
    0x30, 0x48, 0x48, 0x4A, 0x32,
    0x38, 0x40, 0x40, 0x22, 0x7A,
    0x00, 0x7A, 0x0A, 0x0A, 0x72,
    0x7D, 0x0D, 0x19, 0x31, 0x7D,
    0x26, 0x29, 0x29, 0x2F, 0x28,
    0x26, 0x29, 0x29, 0x29, 0x26,
    0x30, 0x48, 0x4D, 0x40, 0x20,
    0x38, 0x08, 0x08, 0x08, 0x08,
    0x08, 0x08, 0x08, 0x08, 0x38,
    0x2F, 0x10, 0xC8, 0xAC, 0xBA,
    0x2F, 0x10, 0x28, 0x34, 0xFA,
    0x00, 0x00, 0x7B, 0x00, 0x00,
    0x08, 0x14, 0x2A, 0x14, 0x22,
    0x22, 0x14, 0x2A, 0x14, 0x08,
    0x95, 0x00, 0x22, 0x00, 0x95,
    0xAA, 0x00, 0x55, 0x00, 0xAA,
    0xAA, 0x55, 0xAA, 0x55, 0xAA,
    0x00, 0x00, 0x00, 0xFF, 0x00,
    0x10, 0x10, 0x10, 0xFF, 0x00,
    0x14, 0x14, 0x14, 0xFF, 0x00,
    0x10, 0x10, 0xFF, 0x00, 0xFF,
    0x10, 0x10, 0xF0, 0x10, 0xF0,
    0x14, 0x14, 0x14, 0xFC, 0x00,
    0x14, 0x14, 0xF7, 0x00, 0xFF,
    0x00, 0x00, 0xFF, 0x00, 0xFF,
    0x14, 0x14, 0xF4, 0x04, 0xFC,
    0x14, 0x14, 0x17, 0x10, 0x1F,
    0x10, 0x10, 0x1F, 0x10, 0x1F,
    0x14, 0x14, 0x14, 0x1F, 0x00,
    0x10, 0x10, 0x10, 0xF0, 0x00,
    0x00, 0x00, 0x00, 0x1F, 0x10,
    0x10, 0x10, 0x10, 0x1F, 0x10,
    0x10, 0x10, 0x10, 0xF0, 0x10,
    0x00, 0x00, 0x00, 0xFF, 0x10,
    0x10, 0x10, 0x10, 0x10, 0x10,
    0x10, 0x10, 0x10, 0xFF, 0x10,
    0x00, 0x00, 0x00, 0xFF, 0x14,
    0x00, 0x00, 0xFF, 0x00, 0xFF,
    0x00, 0x00, 0x1F, 0x10, 0x17,
    0x00, 0x00, 0xFC, 0x04, 0xF4,
    0x14, 0x14, 0x17, 0x10, 0x17,
    0x14, 0x14, 0xF4, 0x04, 0xF4,
    0x00, 0x00, 0xFF, 0x00, 0xF7,
    0x14, 0x14, 0x14, 0x14, 0x14,
    0x14, 0x14, 0xF7, 0x00, 0xF7,
    0x14, 0x14, 0x14, 0x17, 0x14,
    0x10, 0x10, 0x1F, 0x10, 0x1F,
    0x14, 0x14, 0x14, 0xF4, 0x14,
    0x10, 0x10, 0xF0, 0x10, 0xF0,
    0x00, 0x00, 0x1F, 0x10, 0x1F,
    0x00, 0x00, 0x00, 0x1F, 0x14,
    0x00, 0x00, 0x00, 0xFC, 0x14,
    0x00, 0x00, 0xF0, 0x10, 0xF0,
    0x10, 0x10, 0xFF, 0x10, 0xFF,
    0x14, 0x14, 0x14, 0xFF, 0x14,
    0x10, 0x10, 0x10, 0x1F, 0x00,
    0x00, 0x00, 0x00, 0xF0, 0x10,
    0xFF, 0xFF, 0xFF, 0xFF, 0xFF,
    0xF0, 0xF0, 0xF0, 0xF0, 0xF0,
    0xFF, 0xFF, 0xFF, 0x00, 0x00,
    0x00, 0x00, 0x00, 0xFF, 0xFF,
    0x0F, 0x0F, 0x0F, 0x0F, 0x0F,
    0x38, 0x44, 0x44, 0x38, 0x44,
    0x7C, 0x2A, 0x2A, 0x3E, 0x14,
    0x7E, 0x02, 0x02, 0x06, 0x06,
    0x02, 0x7E, 0x02, 0x7E, 0x02,
    0x63, 0x55, 0x49, 0x41, 0x63,
    0x38, 0x44, 0x44, 0x3C, 0x04,
    0x40, 0x7E, 0x20, 0x1E, 0x20,
    0x06, 0x02, 0x7E, 0x02, 0x02,
    0x99, 0xA5, 0xE7, 0xA5, 0x99,
    0x1C, 0x2A, 0x49, 0x2A, 0x1C,
    0x4C, 0x72, 0x01, 0x72, 0x4C,
    0x30, 0x4A, 0x4D, 0x4D, 0x30,
    0x30, 0x48, 0x78, 0x48, 0x30,
    0xBC, 0x62, 0x5A, 0x46, 0x3D,
    0x3E, 0x49, 0x49, 0x49, 0x00,
    0x7E, 0x01, 0x01, 0x01, 0x7E,
    0x2A, 0x2A, 0x2A, 0x2A, 0x2A,
    0x44, 0x44, 0x5F, 0x44, 0x44,
    0x40, 0x51, 0x4A, 0x44, 0x40,
    0x40, 0x44, 0x4A, 0x51, 0x40,
    0x00, 0x00, 0xFF, 0x01, 0x03,
    0xE0, 0x80, 0xFF, 0x00, 0x00,
    0x08, 0x08, 0x6B, 0x6B, 0x08,
    0x36, 0x12, 0x36, 0x24, 0x36,
    0x06, 0x0F, 0x09, 0x0F, 0x06,
    0x00, 0x00, 0x18, 0x18, 0x00,
    0x00, 0x00, 0x10, 0x10, 0x00,
    0x30, 0x40, 0xFF, 0x01, 0x01,
    0x00, 0x1F, 0x01, 0x01, 0x1E,
    0x00, 0x19, 0x1D, 0x17, 0x12,
    0x00, 0x3C, 0x3C, 0x3C, 0x3C,
    0x00, 0x00, 0x00, 0x00, 0x00,
};
`);
  }

  window.MicroCanvas = MicroCanvas;
})();
