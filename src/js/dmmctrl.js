const { ipcRenderer } = require('electron');
const Choppy=require('./toolbit-lib/index').Choppy;
const Dmm=require('./toolbit-lib/index').Dmm;

class Dmmctrl {

  constructor(id, fsm, serial, devname) {
    this.id = id;
    this.fsm = fsm;
    this.serial = serial;
    this.devname = devname;

    if(devname==='Choppy') {
      this.dmm_ = new Choppy();
    } else {
      this.dmm_ = new Dmm();
    }
    this.dmm_.open(serial);

    this.color_ = 0;
    this.plotdat_ = [];
    this.mode_;
    this.range;
    this.holdChecked = false;
    this.hold = false;
    this.unit = '';

    this.init();
  }

  get color() {
    return this.color_;
  }

  get plotdat() {
    return this.plotdat_;
  }

  get mode() {
    return this.mode_;
  }

  init() {
    var divElem = document.getElementById(this.id);
    divElem.innerHTML =
    '<div id="top">'+
    '  <div class="left">'+
    '    <div id="' + this.id + '-ch-color" class="ch-color"></div>'+
    '  </div>'+
    '  <div class="middle">'+
    '    <p id="' + this.id + '-disp-val" class="disp-val">0.123</p>'+
    '  </div>'+
    '  <div class="right">'+
    '    <p id="' + this.id + '-disp-unit" class="disp-unit">mA</p>'+
    '    <select id="' + this.id + '-mode" name="mode" class="mode">'+
    '      <option selected="selected">V</option>'+
    '      <option>A</option>'+
    '    </select>'+
    '    <br>'+
    '    <select id="' + this.id + '-range" name="range" class="mode">'+
    '    </select>'+
    '  </div>'+
    '</div>';
    
    this.mode_ = document.getElementById(this.id + '-mode').value;
    this.range = document.getElementById(this.id + '-range').value;

    document.getElementById(this.id + '-mode').addEventListener('change', (event) => {
      this.mode_ = event.target.value;
      document.getElementById(this.id + '-range').innerHTML = 
      '      <option selected="selected">Auto</option>'+
      '      <option> ' + this.mode_ + '</option>'+
      '      <option>m' + this.mode_ + '</option>'+
      '      <option>u' + this.mode_ + '</option>';
      this.range = 'Auto';
      if(this.fsm.state=='run' || this.fsm.state=='run-zoom')  {
        this.fsm.onStopLogging();
        this.fsm.onStartLogging();
      }
      ipcRenderer.send('set-store-data', 'mode', this.mode_);
    });

    document.getElementById(this.id + '-range').addEventListener('change', (event) => {
      this.range = event.target.value;
    });

    document.getElementById(this.id + '-disp-val').addEventListener('mousedown', (event) => {
      this.hold = true;
    });
    document.getElementById(this.id + '-disp-val').addEventListener('mouseup', (event) => {
      this.hold = false;
    });
    document.getElementById(this.id + '-disp-val').addEventListener('mouseout', (event) => {
      this.hold = false;
    });

    let target = document.getElementById(this.id + '-mode');
    let val = ipcRenderer.sendSync('get-store-data', 'mode');
    if(val) {
      target.value = val;
    }
    target.dispatchEvent(new Event('change'));
  }

  setColor() {
    if(this.devname==='Choppy') {
      this.color_ = this.dmm_.getColor();
    } else {
      this.color_ = 5;
    }
    if(this.color_==1) { document.getElementById(this.id + '-ch-color').classList.add("color-brown"); }
    else if(this.color_==2) { document.getElementById(this.id + '-ch-color').classList.add("color-red"); }
    else if(this.color_==6) { document.getElementById(this.id + '-ch-color').classList.add("color-blue"); }
    else { document.getElementById(this.id + '-ch-color').classList.add("color-green"); }
  }

  setHold(val) {
    this.holdChecked = val;
  }

  clearPlotdat() {
    delete this.plotdat_;
    this.plotdat_ = [];
  }

  acquisition(tdiff, isItRecording) {
    var val;

    if(this.mode_=='V') {
      val = this.dmm_.getVoltage();
    } else if(this.mode_=='A') {
      val = this.dmm_.getCurrent();
    };

    if(isItRecording) {
      this.plotdat_.push({x: tdiff, y: val});
    }

    if(!this.holdChecked && !this.hold) {
      this.showVal(val);
    }
  }

  getUnit(val) {
    var unit = '';

    if(this.range[0]=='u') {
      unit = 'u';
    } else if(this.range[0]=='m') {
      unit = 'm';
    } else if(this.range=='Auto') {
      if(Math.abs(val)<0.001) {
        unit = 'u';
      }
      else if(Math.abs(val)<1.0) {
        unit = 'm';
      }
    }

    return unit;
  }

  getDispVal(val, unit) {
    if(unit=='u') {
      val = val*1000000.0;
    } else if(unit=='m') {
      val = val*1000.0;
    }

    var splitVal = String(Math.abs(val)).split('.');
    if(!splitVal[1]) {
      return val.toFixed(3);
    } else {
      var len = splitVal[0].length;
      if(len>4) {
        return Math.round(val);
      } else {
        return val.toFixed(4-len);
      }
    }
  }

  showVal(val) {
    var dispVal = document.getElementById(this.id + '-disp-val');
    var dispUnit = document.getElementById(this.id + '-disp-unit');

    this.unit = this.getUnit(val);
    dispUnit.innerHTML = this.unit + this.mode_;
    dispVal.innerHTML = this.getDispVal(val, this.unit);
  }

}

module.exports = Dmmctrl;
