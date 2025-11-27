const { ipcRenderer } = require('electron');
const Choppy = require('./toolbit-lib/index').Choppy;
const Dmm = require('./toolbit-lib/index').Dmm;

class Dmmctrl {

  // Private field
  #holdChecked = false;
  #hold = false;
  #dmm;

  // Public field
  mode;
  measurements = {
    voltage: {
      name: undefined,
      mode: undefined,
      records: [],
      color: undefined,
    },
    current: {
      name: undefined,
      mode: undefined,
      records: [],
      color: undefined,
    },
    wattage: {
      name: undefined,
      mode: undefined,
      records: [],
      color: undefined,
    }
  };
  
  constructor(id, fsm, serial, devname) {
    this.id = id;
    this.fsm = fsm;
    this.serial = serial;
    this.devname = devname;

    if(devname==='Choppy') {
      this.#dmm = new Choppy();
    } else {
      this.#dmm = new Dmm();
    }
    ipcRenderer.send('log-to-terminal', 'Call dmm.open(serial)');
    if(this.#dmm.open(serial)) {
      ipcRenderer.send('log-to-terminal', '[ERR] Fail to open device');
    };
    ipcRenderer.send('log-to-terminal', 'Call initialize()');
    this.initialize();
    ipcRenderer.send('log-to-terminal', 'Call setColor()');
    this.setColor();
  }

  clearRecords() {
    this.measurements.voltage.records = [];
    this.measurements.current.records = [];
    this.measurements.wattage.records = [];
  }

  initialize() {
    const items = ['V', 'A', 'W'];

    const divElem = document.getElementById(this.id);
    divElem.innerHTML = 
      '<div id="' + this.id + '-meter-container" class="meter-container">' +
      '  <div id="' + this.id + '-ch-color" class="ch-color"></div>' +
      '  <select id="' + this.id + '-meter-mode" class="meter-mode">' +
      '    <option selected="selected">V</option>' +
      '    <option>A</option>' +
      '    <option>V+A</option>' +
      '    <option>V+A+W</option>' +
      '  </select>' +
      items.map(item => 
        '<div id="' + this.id + '-meter' + item + '-val" class="meter-val">_.___</div>' +
        '<div id="' + this.id + '-meter' + item + '-unit" class="meter-unit">m' + item + '</div>' +
        '<div id="' + this.id + '-ctrl' + item + '" class="col">' +
        '  <select id="' + this.id + '-meter' + item + '-range" class="meter-range">' +
        '    <option selected="selected">Auto</option>' +
        '    <option> ' + item + '</option>' +
        '    <option>m' + item + '</option>' +
        '    <option>u' + item + '</option>' +
        '  </select>' +
        '</div>'
      ).join("") +
      '</div>';

    for (const item of items) {      
      document.getElementById(this.id + '-meter' + item + '-val').addEventListener('mousedown', (event) => {
        this.#hold = true;
      });

      document.getElementById(this.id + '-meter' + item + '-val').addEventListener('mouseup', (event) => {
        this.#hold = false;
      });
    }

    document.getElementById(this.id + '-meter-mode').addEventListener('change', (event) => {
      this.mode = event.target.value;
      
      if (this.mode === items[0]) {
        this.measurements.voltage.mode = items[0];
        this.measurements.current.mode = undefined;
        this.measurements.wattage.mode = undefined;
        document.getElementById(this.id + '-meter' + items[0] + '-val').style.display = '';
        document.getElementById(this.id + '-meter' + items[0] + '-unit').style.display = '';
        document.getElementById(this.id + '-ctrl' + items[0]).style.display = '';
        document.getElementById(this.id + '-meter' + items[1] + '-val').style.display = 'none';
        document.getElementById(this.id + '-meter' + items[1] + '-unit').style.display = 'none';
        document.getElementById(this.id + '-ctrl' + items[1]).style.display = 'none';
        document.getElementById(this.id + '-meter' + items[2] + '-val').style.display = 'none';
        document.getElementById(this.id + '-meter' + items[2] + '-unit').style.display = 'none';
        document.getElementById(this.id + '-ctrl' + items[2]).style.display = 'none';
      } else if (this.mode === items[1]) {
        this.measurements.voltage.mode = undefined;
        this.measurements.current.mode = items[1];
        this.measurements.wattage.mode = undefined;
        document.getElementById(this.id + '-meter' + items[0] + '-val').style.display = 'none';
        document.getElementById(this.id + '-meter' + items[0] + '-unit').style.display = 'none';
        document.getElementById(this.id + '-ctrl' + items[0]).style.display = 'none';
        document.getElementById(this.id + '-meter' + items[1] + '-val').style.display = '';
        document.getElementById(this.id + '-meter' + items[1] + '-unit').style.display = '';
        document.getElementById(this.id + '-ctrl' + items[1]).style.display = '';
        document.getElementById(this.id + '-meter' + items[2] + '-val').style.display = 'none';
        document.getElementById(this.id + '-meter' + items[2] + '-unit').style.display = 'none';
        document.getElementById(this.id + '-ctrl' + items[2]).style.display = 'none';
        ipcRenderer.send('set-win-min-width', 600);
      } else if (this.mode === items[0] + '+' + items[1]) {
        this.measurements.voltage.mode = items[0];
        this.measurements.current.mode = items[1];
        this.measurements.wattage.mode = undefined;
        document.getElementById(this.id + '-meter' + items[0] + '-val').style.display = '';
        document.getElementById(this.id + '-meter' + items[0] + '-unit').style.display = '';
        document.getElementById(this.id + '-ctrl' + items[0]).style.display = '';
        document.getElementById(this.id + '-meter' + items[1] + '-val').style.display = '';
        document.getElementById(this.id + '-meter' + items[1] + '-unit').style.display = '';
        document.getElementById(this.id + '-ctrl' + items[1]).style.display = '';
        document.getElementById(this.id + '-meter' + items[2] + '-val').style.display = 'none';
        document.getElementById(this.id + '-meter' + items[2] + '-unit').style.display = 'none';
        document.getElementById(this.id + '-ctrl' + items[2]).style.display = 'none';
        ipcRenderer.send('set-win-min-width', 600);
      } else if (this.mode === items[0] + '+' + items[1] + '+' + items[2]) {
        this.measurements.voltage.mode = items[0];
        this.measurements.current.mode = items[1];
        this.measurements.wattage.mode = items[2];
        document.getElementById(this.id + '-meter' + items[0] + '-val').style.display = '';
        document.getElementById(this.id + '-meter' + items[0] + '-unit').style.display = '';
        document.getElementById(this.id + '-ctrl' + items[0]).style.display = '';
        document.getElementById(this.id + '-meter' + items[1] + '-val').style.display = '';
        document.getElementById(this.id + '-meter' + items[1] + '-unit').style.display = '';
        document.getElementById(this.id + '-ctrl' + items[1]).style.display = '';
        document.getElementById(this.id + '-meter' + items[2] + '-val').style.display = '';
        document.getElementById(this.id + '-meter' + items[2] + '-unit').style.display = '';
        document.getElementById(this.id + '-ctrl' + items[2]).style.display = '';
        ipcRenderer.send('set-win-min-width', 850);
      }


      if(this.fsm.state=='run' || this.fsm.state=='run-zoom')  {
        this.fsm.onStopLogging();
        this.fsm.onStartLogging();
      }
      ipcRenderer.send('set-store-data', this.id + '-meter-mode', this.mode);
    });

    let target = document.getElementById(this.id + '-meter-mode');
    let val = ipcRenderer.sendSync('get-store-data', this.id + '-meter-mode');
    if(val) {
      target.value = val;
    }
    target.dispatchEvent(new Event('change'));
  }

  setColor() {
    if(this.devname==='Choppy') {
      ipcRenderer.send('log-to-terminal', 'Call #dmm.getColor()');
      this.color = this.#dmm.getColor();
      ipcRenderer.send('log-to-terminal', '#dmm.getColor() is done');
      this.measurements.voltage.color = this.color;
      this.measurements.current.color = this.color;
      this.measurements.wattage.color = this.color;
    } else {
      this.measurements.voltage.color = 5;  // Default green
      this.measurements.current.color = 5;
      this.measurements.wattage.color = 5;
    }
    document.getElementById(this.id + '-ch-color').classList.remove('color-brown');
    document.getElementById(this.id + '-ch-color').classList.remove('color-red');
    document.getElementById(this.id + '-ch-color').classList.remove('color-blue');
    document.getElementById(this.id + '-ch-color').classList.remove('color-green');
    if(this.measurements.voltage.color==1) { document.getElementById(this.id + '-ch-color').classList.add('color-brown'); }
    else if(this.measurements.voltage.color==2) { document.getElementById(this.id + '-ch-color').classList.add('color-red'); }
    else if(this.measurements.voltage.color==6) { document.getElementById(this.id + '-ch-color').classList.add('color-blue'); }
    else { document.getElementById(this.id + '-ch-color').classList.add('color-green'); }
  }

  setHold(val) {
    this.#holdChecked = val;
  }

  acquisition(tdiff, isItRecording) {
    var volt;
    var curr;
    var watt;

    if(this.mode==='V') {
      volt = this.#dmm.getVoltage();
    } else if(this.mode==='A') {
      curr = this.#dmm.getCurrent();
    } else if(this.mode==='V+A') {
      volt = this.#dmm.getVoltage();
      curr = this.#dmm.getCurrent();
    } else if(this.mode==='V+A+W') {
      volt = this.#dmm.getVoltage();
      curr = this.#dmm.getCurrent();
      watt = volt * curr;
    };

    if(!this.#holdChecked && !this.#hold) {
      if(volt!==undefined) {
        this.showVal(volt, 'V');
      }
      if(curr!==undefined) {
        this.showVal(curr, 'A');
      }
      if(watt!==undefined) {
        this.showVal(watt, 'W');
      }
    }

    if(isItRecording) {
      if(!isNaN(volt) && volt!==undefined) {
        this.measurements.voltage.records.push({x: tdiff, y: volt});
      }
      if(!isNaN(curr) && curr!==undefined) {
        this.measurements.current.records.push({x: tdiff, y: curr});
      }
      if(!isNaN(watt) && watt!==undefined) {
        this.measurements.wattage.records.push({x: tdiff, y: watt});
      }
    }
  }

  getUnit(val, target) {
    const range = document.getElementById(this.id + '-meter' + target + '-range').value
    var unit = ' ';

    if(range=='u' + target) {
      unit = 'u';
    } else if(range=='m' + target) {
      unit = 'm';
    } else if(range=='Auto') {
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

  showVal(val, target) {
    const eleVal = document.getElementById(this.id + '-meter' + target + '-val');
    const eleUnit = document.getElementById(this.id + '-meter' + target + '-unit');
    const unit = this.getUnit(val, target);
    eleUnit.innerHTML = unit + target;
    eleVal.innerHTML = this.getDispVal(val, unit);
  }

  close() {
    this.#dmm.close();
    ipcRenderer.send('log-to-terminal', 'Close the connected devices');
  };

}

module.exports = Dmmctrl;
