class Stat {

  constructor(id) {
    this.id = id;

    this.plotdat;
    this.mode = '';
    this.range;
    this.unit = '';

    this.statMax;
    this.statMin;
    this.statAve;
    this.statUnit;

    this.max = 0.0;
    this.min = 0.0;
    this.ave = 0.0;

    this.init();
  }

  init() {
    var divElem = document.getElementById(this.id);
    divElem.innerHTML =
    '<div id="stat">'+
    '  <div id="' + this.id + '-ch-color" class="ch-color"></div>'+
    '  <div class="stat-box">'+
    '    <p id="' + this.id + '-max-label" class="stat-label"> Max</p>'+
    '    <p id="' + this.id + '-max-val" class="stat-val"></p>'+
    '  </div>'+
    '  <div class="stat-box">'+
    '    <p id="' + this.id + '-min-label" class="stat-label"> Min</p>'+
    '    <p id="' + this.id + '-min-val" class="stat-val"></p>'+
    '  </div>'+
    '  <div class="stat-box">'+
    '    <p id="' + this.id + '-ave-label" class="stat-label"> Ave</p>'+
    '    <p id="' + this.id + '-ave-val" class="stat-val"></p>'+
    '  </div>'+
    '  <p id="' + this.id + '-unit" class="stat-unit"></p>'+
    '  <select id="' + this.id + '-range" name="range" class="mode">'+
    '    <option selected="selected">Auto</option>'+
    '    <option> V</option>'+
    '    <option>mV</option>'+
    '    <option>uV</option>'+
    '  </select>'+
    '</div>';

    this.range = document.getElementById(this.id + '-range').value;
    document.getElementById(this.id + '-range').addEventListener('change', (event) => {
      this.range = event.target.value;

      if(this.statMax.innerHTML != '') {
        this.updateValAndUnit();
      }
    });

    this.statMax = document.getElementById(this.id + '-max-val');
    this.statMin = document.getElementById(this.id + '-min-val');
    this.statAve = document.getElementById(this.id + '-ave-val');
    this.statUnit = document.getElementById(this.id + '-unit');
    this.clearStat();
  }

  setData(plotdat, mode) {
    this.plotdat = plotdat;
    this.mode = mode;
    document.getElementById(this.id + '-range').innerHTML =
    '      <option selected="selected">Auto</option>'+
    '      <option> ' + this.mode + '</option>'+
    '      <option>m' + this.mode + '</option>'+
    '      <option>u' + this.mode + '</option>';
    this.range = 'Auto';
    this.clearStat();
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

  clearStat() {
    this.statMax.innerHTML = '';
    this.statMin.innerHTML = '';
    this.statAve.innerHTML = '';
    this.statUnit.innerHTML = this.mode;
  }

  showStat(x1, x2) {

    let i = 0;
    let len = this.plotdat.length;
    if(len==0) {
      return;
    }

    while(i<len && this.plotdat[i]['x']<x1) {
      i++;
    }

    this.max=this.plotdat[i]['y'];
    this.min=this.plotdat[i]['y'];
    this.ave=this.plotdat[i]['y'];
    var num = 1;
    i++;

    while(i<len && this.plotdat[i]['x']<x2) {
      this.ave += this.plotdat[i]['y'];
      num++;
      if(this.max<this.plotdat[i]['y']) {
        this.max=this.plotdat[i]['y'];
      } else if (this.min>this.plotdat[i]['y']) {
        this.min=this.plotdat[i]['y'];
      }
      i++;
    }
    this.ave = this.ave / num;

    this.updateValAndUnit();
  }

  updateValAndUnit() {
    if(Math.abs(this.max)>Math.abs(this.min)){
      this.unit = this.getUnit(this.max);
    } else {
      this.unit = this.getUnit(this.min);
    }
    this.statMax.innerHTML = this.getDispVal(this.max, this.unit);
    this.statMin.innerHTML = this.getDispVal(this.min, this.unit);
    this.statAve.innerHTML = this.getDispVal(this.ave, this.unit);
    this.statUnit.innerHTML = this.unit + this.mode;
  }

}

module.exports = Stat;
