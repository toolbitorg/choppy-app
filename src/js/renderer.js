'use strict';

//console.debug = function(){/* NOP */};
//console.info = function(){/* NOP */};
//console.log = function(){/* NOP */};
//console.warn = function(){/* NOP */};
//console.error = function(){/* NOP */}


const HEIGHT_FOR_MIN = 80;
const HEIGHT_FOR_METER = 63;
const HEIGHT_FOR_STAT = 34;
const HEIGHT_FOR_GRAPH = 450;
const maxDmmNum = 4;

const Chartist=require('./js/chartist/dist/chartist')
require('./js/chartist-plugin-zoom/dist/chartist-plugin-zoom')

var StateMachine = require('javascript-state-machine')

const { ipcRenderer } = require('electron')

var plotInfo = {};
/*
ipc.send('get-app-version');
ipc.on('got-app-version', function(event, version) {
  plotInfo.swVersion = version;
  plotInfo.logFormat = '0.1';
  console.log(plotInfo);
})
 */

var fsm = new StateMachine({
  init: 'nograph',
  transitions: [
    { name: 'enableGraph',    from: 'nograph',  to: 'stop'    },
    { name: 'disableGraph',   from: '*',        to: 'nograph' },
    { name: 'startLogging',   from: ['stop', 'stop-zoom'], to: 'run'     },
    { name: 'stopLogging',    from: 'run',      to: 'stop'    },
    { name: 'stopLogging',    from: 'run-zoom', to: 'stop-zoom' },
    { name: 'zoom',           from: ['run', 'run-zoom'],   to: 'run-zoom'   },
    { name: 'zoom',           from: ['stop', 'stop-zoom'], to: 'stop-zoom'  },
    { name: 'resetZoom',      from: 'run-zoom',  to: 'run'    },
    { name: 'resetZoom',      from: 'stop-zoom', to: 'stop'   },
    { name: 'load',           from: '*',         to: 'stop'   },
  ],
  methods: {
    onTransition: function(lifecycle) {
      console.log('DURING:' + lifecycle.transition + ' (from ' + lifecycle.from + ' to ' + lifecycle.to + ')');
    },

    onEnableGraph: function() {
      clearGraph();
      document.getElementById('chart-container').className = 'clearfix';
      document.getElementById('graph-menu').className = 'clearfix';
      window.resizeBy(0, HEIGHT_FOR_GRAPH);   
    },

    onDisableGraph: function() {
      document.getElementById('chart-container').className = 'hide';
      document.getElementById('graph-menu').className = 'hide';
      document.getElementById('stat-container0').className = 'hide';
      document.getElementById('stat-time').className = 'hide';
      document.getElementById('stat-container1').className = 'hide';
      document.getElementById('stat-container2').className = 'hide';
      document.getElementById('stat-container3').className = 'hide';
      window.resizeBy(0, -HEIGHT_FOR_GRAPH-HEIGHT_FOR_STAT);
//      window.resizeBy(0, -HEIGHT_FOR_GRAPH -HEIGHT_FOR_STAT*connectedDmmNum);
    },

    onStopLogging: function() {
      document.getElementById('run').checked = false;
    },

    onStartLogging: function() {
      clearGraph();
      ipcRenderer.send('set-title', '');
      document.getElementById('run').checked = true;
      document.getElementById('save').disabled = false;
      document.getElementById('reset-zoom').disabled = true;
    },

    onZoom: function() {
      document.getElementById('reset-zoom').disabled = false;
    },

    onResetZoom: function() {
      //resetZoomFunc && resetZoomFunc();
      if(resetZoomFunc) {
        chart.options.showPoint = false;
        resetZoomFunc();
        resetZoomFunc = null;
      }
      for(var i=0; i<waveformsNum; i++) {
        stat[i].clearStat();
      }
      document.getElementById('reset-zoom').disabled = true;
    
      // Clear stat-time
      var divElem = document.getElementById('stat-time-val');
      divElem.innerHTML = 'H:M:S.msec';
    },

    onLoad: function() {
      document.getElementById('graph').checked = true;
      document.getElementById('save').disabled = true;
      document.getElementById('reset-zoom').disabled = true;
    }

  }
});

const TbiDeviceManager=require('./js/toolbit-lib/index').TbiDeviceManager;
var tbiDeviceManager = new TbiDeviceManager();
var connectedDmmNum = 0;
var waveformsNum = 0;

const Dmmctrl=require('./js/dmmctrl');
const Stat=require('./js/stat');
//const Timerange=require('./js/timerange');

var dmmctrl = Array(4);
var stat = Array(4);
//var timerange;
var plotOptions = [{}, {}, {}, {}];

var timeInterval;
var plotData = [[],[],[],[]];
var plotStart = new Date();
var chart;

var setTimeInterval = function(t) {
  if(t=='Fast') {
    timeInterval = 19;
  } else if(t=='Mid') {
    timeInterval = 99;
  } else if(t=='Slow') {
    timeInterval = 999;
  };
  console.log('timeInterval:' + t);
};

var dmmContainers = ['dmm-container0', 'dmm-container1', 'dmm-container2', 'dmm-container3'];
var statContainers = ['stat-container0', 'stat-container1', 'stat-container2', 'stat-container3'];
var chartContainer = document.getElementById('chart-container');

function exportData(records) {
  let data = JSON.stringify(records);
  let bom  = new Uint8Array([0xEF, 0xBB, 0xBF]);
  let blob = new Blob([bom, data], {type: 'text'});
  let url = (window.URL || window.webkitURL).createObjectURL(blob);
  let link = document.createElement('a');
  var tzoffset = (new Date()).getTimezoneOffset() * 60000; //offset in milliseconds
  var localISOTime = (new Date(plotStart - tzoffset)).toISOString().split('.')[0];
  link.download = 'log-' + localISOTime + '.json';
  link.href = url;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
};

function exportDataCSV(records) {
  let data = records.map((record)=>record.join(',')).join('\r\n');
  let bom  = new Uint8Array([0xEF, 0xBB, 0xBF]);
  let blob = new Blob([bom, data], {type: 'text/csv'});
  let url = (window.URL || window.webkitURL).createObjectURL(blob);
  let link = document.createElement('a');
  link.download = 'log-' + plotStart.toISOString().split('.')[0] + '.csv';
  link.href = url;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
};

function disableElements(elems) {
  for(var i=0; i<elems.length; i++) {
    elems[i].disabled = true;
  }
}

function enableElements(elems) {
  for(var i=0; i<elems.length; i++) {
    elems[i].disabled = false;
  }
}

function openDevice() {
  tbiDeviceManager.updateDeviceList();
  var serials = tbiDeviceManager.getSerialList('Choppy');
  console.log('The number of detected Choppy: ' + serials.size());

  if(serials.size()==0) {
    // Fail to open and then try it later
    window.setTimeout(openDevice, 3000);
    return;
  }
  if(serials.size()<maxDmmNum) {
    connectedDmmNum = serials.size();
  } else {
    connectedDmmNum = maxDmmNum;
  }
  for(var i=0; i<connectedDmmNum; i++) {

    dmmctrl[i] = new Dmmctrl(dmmContainers[i],fsm);
    if(dmmctrl[i].dmm.open(serials.get(i))) {
      // Fail to open and then try it later
      window.setTimeout(openDevice, 3000);
      return;
    }

    document.getElementById('graph').disable = false;
    window.resizeBy(0, HEIGHT_FOR_METER);
  }

  setTimeInterval(document.getElementById('interval').value);

  document.getElementById('interval').addEventListener('change', (event) => {
    setTimeInterval(event.target.value);
    /*
    if(fsm.state!=='nograph') {
      clearGraph();
    }
     */
  });
  document.getElementById('hold').addEventListener('change', function() {
    for(var i=0; i<connectedDmmNum; i++) {
      dmmctrl[i].setHold(this.checked);
    }
    console.log('holdChecked:' + this.checked);
  });

  document.getElementById('run').addEventListener('change', function() {
    if(this.checked) {
      fsm.startLogging();
    } else {
      fsm.stopLogging();
    }
  });

  document.getElementById('save').addEventListener('click', function() {
    exportData([plotInfo, plotOptions, plotData]);
  });

  enableElements(document.getElementById('main').getElementsByTagName('input'));
  enableElements(document.getElementById('main').getElementsByTagName('select'));
  enableElements(document.getElementById('main').getElementsByTagName('button'));
  document.getElementById('save').disabled = true;
  document.getElementById('reset-zoom').disabled = true;

  window.setTimeout(update, timeInterval);
}

function initialize() {
  disableElements(document.getElementById('main').getElementsByTagName('input'));
  document.getElementById('graph').disabled = true;
  disableElements(document.getElementById('main').getElementsByTagName('select'));
  disableElements(document.getElementById('main').getElementsByTagName('button'));
  document.getElementById('load').disabled = false;

  document.getElementById('graph').addEventListener('change', function() {
    if(this.checked) {
      fsm.enableGraph();
      if(connectedDmmNum>0) {
        fsm.startLogging();
      }
    } else {
      fsm.disableGraph()
    }
  });

  var fin = document.createElement('input');
  fin.type = 'file';
  fin.accept = '.json';
  fin.addEventListener('change', function(e) {
    document.getElementById('load').disabled = true;
    var file = e.target.files[0];

    if(file.type.match('application/json')) {
      var reader = new FileReader();
      reader.addEventListener('load', function() {
        var data = JSON.parse(this.result);
        if(fsm.state=='nograph') {
          fsm.enableGraph();
        } else if(fsm.state=='run' || fsm.state=='run-zoom') {
          fsm.stopLogging();
        }
        plotInfo = data[0];
        plotOptions = data[1];
        plotData = data[2];
        plotStart = new Date(0);
        fsm.load();
        initializeGraph();
        document.getElementById('load').disabled = false;

      })
      reader.readAsText(file);
      ipcRenderer.send('set-title', file.name);      
      e.target.value = '';   // reset value to load the same file again
    }
  });

  document.getElementById('load').addEventListener('click', function() {
    fin.click();
  });

  document.getElementById('reset-zoom').addEventListener('click', (event) => {
    fsm.resetZoom();
  });
  document.getElementById('reset-zoom').disabled = true;

  openDevice();
 
  for(var i=0; i<4; i++) {
    stat[i] = new Stat(statContainers[i]);
  }
}

function msToTime(duration) {
  var ms = Math.floor((duration % 1000) / 10),
    sec = Math.floor((duration / 1000) % 60),
    min = Math.floor((duration / (1000 * 60)) % 60),
//  hr = Math.floor((duration / (1000 * 60 * 60)) % 24);
    hr = Math.floor(duration / (1000 * 60 * 60));

  var minutes = (min < 10) ? "0" + min : min;
  var seconds = (sec < 10) ? "0" + sec : sec;
  var milliseconds = (ms < 10) ? "0" + ms : ms;
  
  if(hr) {
    return hr + ":" + minutes + ":" + seconds + "." + milliseconds;
  } else if (min) {
    return min + ":" + seconds + "." + milliseconds;
  } else if (sec) {
    return sec + "." + milliseconds;
  }
  return "." + milliseconds;
}

function getTimeStr(value) {
  var str = msToTime(value);
  if(str.length<6) {
    return str + ' sec';
  }
  return msToTime(value);
}

var resetZoomFunc;
function onZoom(chart, reset) {
  resetZoomFunc = reset;
  //console.log(chart.options.axisX.highLow);

  if(!(chart.options.axisX.highLow && chart.options.axisX.highLow.low)) {
    chart.update(chart.data, chart.options);
    return;
  }
  var maxVal = 0;
  for(var i=0; i<waveformsNum; i++) {
    stat[i].showStat(chart.options.axisX.highLow.low, chart.options.axisX.highLow.high);
    if(maxVal < stat[i].max) {
      maxVal=stat[i].max;
    }
  }
  chart.options.axisY.highLow = { low: 0, high: maxVal };

  if(chart.options.axisX.highLow.high-chart.options.axisX.highLow.low<1500) {
    chart.options.showPoint = true;
  }
  chart.update(chart.data, chart.options);
  var divElem = document.getElementById('stat-time-val');
  divElem.innerHTML = getTimeStr(chart.options.axisX.highLow.high-chart.options.axisX.highLow.low);
}

function ongoingMouseDown() {
  fsm.zoom();
}

function initializeGraph() {
  chart = new Chartist.Line(chartContainer,
    {  // data
      series: [
        {
          name: 'series-1',   // Red
          data: plotData[2]
        },
        {
          name: 'series-2',   // Pink
          data: []
        },
        {
          name: 'series-3',   // Yellow
          data: []
        },
        {
          name: 'series-4',   // Brown
          data: plotData[3]
        },
        {
          name: 'series-5',   // Dark blue
          data: []
        },
        {
          name: 'series-6',   // Green
          data: plotData[0]
        },
        {
          name: 'series-7',   // Blue
          data: plotData[1]
        },
        {
          name: 'to-show-zero-point',
          data: [{x: 0, y: 0}]
        }
      ]
    },
    {
      chartPadding: {
        right: 80
      },  
      lineSmooth: false,
      showPoint: false,
      axisX: {
        //type: Chartist.AutoScaleAxis,
        type: Chartist.FixedScaleAxis,
        divisor: parseInt(window.outerWidth/100),
        scaleMinSpace: 50,
        labelInterpolationFnc: function(value) {
          return msToTime(value);
        }
      },
      axisY: {
        offset: 70,
        low: 0,
        type: Chartist.AutoScaleAxis,
        labelInterpolationFnc: function(value) {
          if(value<0.0000001) {
            return value.toFixed(1);
          } else if(value<0.001) {
              return (value*1000000).toFixed(1)+'u';
          } else if(value<1) {
              return (value*1000).toFixed(1)+'m';
          } else {
            return value.toFixed(1);
          }
        }
      },
      plugins: [
        Chartist.plugins.zoom({
    //        resetOnRightMouseBtn: true,
          onZoom : onZoom,
          ongoingMouseDown : ongoingMouseDown,
        })
      ]
    }
  );

  // Prepare statics area
  waveformsNum = 0;
  for(var i=0; i<4; i++) {
    if(plotData[i].length>1) {
      stat[i].setData(plotData[i], plotOptions[i].mode);
      waveformsNum++;
    }
  }
  if(waveformsNum==0) {
    for(var i=0; i<connectedDmmNum; i++) {
      plotOptions[i].mode = dmmctrl[i].mode;
      stat[i].setData(plotData[i], plotOptions[i].mode);
      waveformsNum++;
    }
  }

  // Clear stat-time
  var divElem = document.getElementById('stat-time-val');
  divElem.innerHTML = 'H:M:S.msec';

  for(var i=0; i<4; i++) {
    var divElem = document.getElementById('stat-container'+ i);
    if(i<waveformsNum && divElem.className=="hide") {
      if(i==waveformsNum-1) {
        divElem.className = 'float';
      } else {
        divElem.className = 'clearfix';
      }
      window.resizeBy(0, HEIGHT_FOR_STAT);
    } else if(i>=waveformsNum && divElem.className=="clearfix") {
      divElem.className = 'hide';
    }
  }

  if(waveformsNum) {
    var divElem = document.getElementById('stat-time');
    divElem.className = 'clearfix';
  } else {
    var divElem = document.getElementById('stat-time');
    divElem.className = 'hide';
  }
}

function clearGraph() {
  if(fsm.state=='stop-zoom' || fsm.state=='run-zoom') {
    fsm.resetZoom();
  }
  plotData = [[],[],[],[]];
  for(var i=0; i<connectedDmmNum; i++) {
    dmmctrl[i].clearPlotdat();
    plotData[i] = dmmctrl[i].plotdat;
  }
  initializeGraph();
  chart.update();
}

var cycle = 0;
function update() {
  window.setTimeout(update, timeInterval);

  var t = new Date();
  if(plotData[0].length==0) {
    plotStart = t;
  }
  var tdiff = t.getTime() - plotStart.getTime();

  if(fsm.state=='run' || fsm.state=='run-zoom') {
    for(var i=0; i<connectedDmmNum; i++) {
      dmmctrl[i].acquisition(tdiff, true);
    }
  } else {
    for(var i=0; i<connectedDmmNum; i++) {
      dmmctrl[i].acquisition(tdiff, false);
    }
  }
  //console.log('value[' + t.toJSON() + ']:' + val);

  if(fsm.state=='run') {

    if(timeInterval<20) {
      cycle = cycle + 1;
      if(cycle>=5) {
        chart.update();
        cycle = 0;
      }  
    } else {
      chart.update();
    }
  }
};

document.addEventListener("DOMContentLoaded", function() {
  initialize();
});

window.addEventListener('resize', function(event) {
  if(fsm.state!=='nograph') {
    chart.options.axisX.divisor = parseInt(window.outerWidth/100);
    chart.update(chart.data, chart.options);
  }
}, true);

