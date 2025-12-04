'use strict';

//console.debug = function(){/* NOP */};
//console.info = function(){/* NOP */};
//console.log = function(){/* NOP */};
//console.warn = function(){/* NOP */};
//console.error = function(){/* NOP */}


const HEIGHT_MIN = 80;   // 34px + window bar
const HEIGHT_METER = 61;
const HEIGHT_STAT = 31;
const HEIGHT_GRAPH = 465;
const WIDTH_AUTO_FIT = 400;
const MAX_DMM_NUM = 4;
const MAX_STAT_NUM = 12;

const { ipcRenderer } = require('electron')

const Chartist = require('./js/chartist/dist/chartist')
require('./js/chartist-plugin-zoom/dist/chartist-plugin-zoom')

const StateMachine = require('javascript-state-machine')

const DmmDevManager = require('./js/dmmdevmanager');
const Dmmctrl = require('./js/dmmctrl');
const Stat = require('./js/stat');

var plotInfo = {};
ipcRenderer.send('get-app-version');
ipcRenderer.on('got-app-version', function(event, version) {
  plotInfo.swVersion = version;
  plotInfo.logFormat = '0.2';
  console.log(plotInfo);
})

var connectedDmmNum = 0;
var waveformsNum = 0;

var dmmctrl = Array(4);
var stat = Array(12);

var timeInterval;
var measurementData = [[],[],[],[],[],[],[],[],[],[],[],[]];
var plotDataForChart = [[],[],[],[]];
var plotStart = 0;


var dmmContainers = ['dmm-container0', 'dmm-container1', 'dmm-container2', 'dmm-container3'];
var statContainers = ['stat-container0', 'stat-container1', 'stat-container2', 'stat-container3',
                      'stat-container4', 'stat-container5', 'stat-container6', 'stat-container7',
                      'stat-container8', 'stat-container9', 'stat-container10', 'stat-container11'                  
                    ];
var chartContainer = document.getElementById('chart-container');
var chartData;
var chartOptions;
var chart;

/* 
  Function declaration 
*/
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

var setTimeInterval = function(t) {
  if(t==='Fast') {
    timeInterval = 19;
  } else if(t==='Mid') {
    timeInterval = 99;
  } else if(t==='Slow') {
    timeInterval = 999;
  };
  console.log('timeInterval:' + t);
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

/* 
  State Machine to control user interface
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
      document.getElementById('chart-container').style.display = '';
      document.getElementById('graph-menu').style.display = '';
    },

    onDisableGraph: function() {
      document.getElementById('chart-container').style.display = 'none';
      document.getElementById('graph-menu').style.display = 'none';
      document.getElementById('stat-container0').style.display = 'none';
      document.getElementById('stat-container1').style.display = 'none';
      document.getElementById('stat-container2').style.display = 'none';
      document.getElementById('stat-container3').style.display = 'none';
      document.getElementById('stat-container4').style.display = 'none';
      document.getElementById('stat-container5').style.display = 'none';
      document.getElementById('stat-container6').style.display = 'none';
      document.getElementById('stat-container7').style.display = 'none';
      document.getElementById('stat-container8').style.display = 'none';
      document.getElementById('stat-container9').style.display = 'none';
      document.getElementById('stat-container10').style.display = 'none';
      document.getElementById('stat-container11').style.display = 'none';
      document.getElementById("top-of-chart").style.display = 'none';
      resizeWindows();
    },

    onStopLogging: function() {
      document.getElementById('run').checked = false;
    },

    onStartLogging: function() {
      plotStart = 0;
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

/* 
  Initialization after DOM Content Loaded
*/
window.addEventListener("load", () => {
  try {
    ipcRenderer.send('log-to-terminal', 'initialize() started...');
    initialize();
    ipcRenderer.send('log-to-terminal', 'initialize() finished.');
  } catch (e) {
    console.error("initialize failed:", e);
  }
});

/*
document.addEventListener("DOMContentLoaded", function() {
  ipcRenderer.send('log-to-terminal', 'initialize() started...');
  initialize();
  ipcRenderer.send('log-to-terminal', 'initialize() finished.');
});
*/

function initialize() {
  disableElements(document.getElementById('main').getElementsByTagName('input'));
  document.getElementById('graph').disabled = true;
  disableElements(document.getElementById('main').getElementsByTagName('select'));
  disableElements(document.getElementById('main').getElementsByTagName('button'));
  document.getElementById('load').disabled = false;

  document.getElementById('chart-container').style.display = 'none';
  document.getElementById('graph-menu').style.display = 'none';
  document.getElementById('stat-container0').style.display = 'none';
  document.getElementById('stat-container1').style.display = 'none';
  document.getElementById('stat-container2').style.display = 'none';
  document.getElementById('stat-container3').style.display = 'none';
  document.getElementById('stat-container4').style.display = 'none';
  document.getElementById('stat-container5').style.display = 'none';
  document.getElementById('stat-container6').style.display = 'none';
  document.getElementById('stat-container7').style.display = 'none';
  document.getElementById('stat-container8').style.display = 'none';
  document.getElementById('stat-container9').style.display = 'none';
  document.getElementById('stat-container10').style.display = 'none';
  document.getElementById('stat-container11').style.display = 'none';
  document.getElementById("top-of-chart").style.display = 'none';
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
        if(plotInfo.logFormat == undefined) {  // before logFormat == 0.2
          measurementData = [[], [], [], [], [], [], [], [], [], [], [], []];
          for(var i=0; i<data[1].length; i++) {
            measurementData[i] = data[1][i];
            measurementData[i].records = data[2][i];
            if(i==0) { measurementData[i].color = 5; }
            else if(i==1) { measurementData[i].color = 6; }
            else if(i==2) { measurementData[i].color = 2; }
            else { measurementData[i].color = 1; }
          }
        } else if(plotInfo.logFormat == '0.2') {
          measurementData = data[1];
        } else {
          console.log('This log format is not supported.');
        }
        plotStart = new Date(0);
        fsm.load();

        clearGraph();
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

  // When changing choice of 'V', 'A' or 'W'
  const radios = document.querySelectorAll('input[name="choice"]');
  radios.forEach(radio => {
    radio.addEventListener('change', () => {
      setGraphData();

      const val = document.querySelector('input[name="choice"]:checked').value;
      ipcRenderer.send('set-store-data', 'choice', val);
      if(fsm.state==='run-zoom' || fsm.state==='run-zoom' || fsm.state==='stop-zoom') {
        var maxVal = 0;
        for(var i=0; i<waveformsNum; i++) {
          if(stat[i].mode===val) {
            if(maxVal < stat[i].max) {
              maxVal=stat[i].max;
            }
          }
        }
        chart.options.axisY.highLow = { low: 0, high: maxVal };
      } 

      chart.update(chartData, chart.options);
    })
  });

  ipcRenderer.send('log-to-terminal', 'Call openDevice() later..');
//  openDevice();
  window.setTimeout(openDevice, 1000);
 
  for(var i=0; i<MAX_STAT_NUM; i++) {
    stat[i] = new Stat(statContainers[i]);
  }
}

function openDevice() {
  const dmmDevManager = new DmmDevManager();
  var devlist = dmmDevManager.getDeviceList();
  console.log('The number of detected devices: ' + devlist.length);
  ipcRenderer.send('log-to-terminal', 'The number of detected devices: ' + devlist.length);
  

  if(devlist.length==0) {
    // Fail to open and then try it later
    window.setTimeout(openDevice, 3000);
    return;
  }
  if(devlist.length<MAX_DMM_NUM) {
    connectedDmmNum = devlist.length;
  } else {
    connectedDmmNum = MAX_DMM_NUM;
  }

  console.log(devlist);
  ipcRenderer.send('log-to-terminal', devlist);

  for(var i=0; i<connectedDmmNum; i++) {
    dmmctrl[i] = new Dmmctrl(dmmContainers[i], fsm, devlist[i][0], devlist[i][1], devlist[i][2]);
    ipcRenderer.send('log-to-terminal', 'new Dmmctrl instance');
    document.getElementById('graph').disable = false;
  }
  resizeWindows();

  const val = ipcRenderer.sendSync('get-store-data', 'interval');
  if(val) {
    document.getElementById('interval').value = val;
  }
  setTimeInterval(document.getElementById('interval').value);

  document.getElementById('interval').addEventListener('change', (event) => {
    setTimeInterval(event.target.value);
    ipcRenderer.send('set-store-data', 'interval', event.target.value);
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
    exportData([plotInfo, measurementData]);
  });

  enableElements(document.getElementById('main').getElementsByTagName('input'));
  enableElements(document.getElementById('main').getElementsByTagName('select'));
  enableElements(document.getElementById('main').getElementsByTagName('button'));
  document.getElementById('save').disabled = true;
  document.getElementById('reset-zoom').disabled = true;

  window.setTimeout(update, timeInterval);
}

function clearGraph() {
  if(fsm.state=='stop-zoom' || fsm.state=='run-zoom') {
    fsm.resetZoom();
  }

  // Setup measurementData and waveformsNum
  waveformsNum = 0;
  if(document.getElementById('load').disabled==true) {
    // When handling data loaded from a file
    for(var i=0; i<MAX_STAT_NUM; i++) {
      if(measurementData[i].length != 0) {
        waveformsNum++;
      }
    }
  } else {
    measurementData = [[], [], [], [], [], [], [], [], [], [], [], []];
    for(var i=0; i<connectedDmmNum; i++) {
      dmmctrl[i].clearRecords();
      if(dmmctrl[i].mode === 'V' || dmmctrl[i].mode === 'V+A' || dmmctrl[i].mode === 'V+A+W') {
        measurementData[waveformsNum] = dmmctrl[i].measurements.voltage;
        waveformsNum++;
      }
      if(dmmctrl[i].mode === 'A' || dmmctrl[i].mode === 'V+A' || dmmctrl[i].mode === 'V+A+W') {
        measurementData[waveformsNum] = dmmctrl[i].measurements.current;
        waveformsNum++;
      }
      if(dmmctrl[i].mode === 'V+A+W') {
        measurementData[waveformsNum] = dmmctrl[i].measurements.wattage;
        waveformsNum++;
      }
    }
  }

  // Setup radio buttons of V/A/W
  const val = ipcRenderer.sendSync('get-store-data', 'choice');
  if(val) {
    document.querySelector('input[name="choice"][value="' + val + '"]').checked = true;
  }
  document.querySelector('input[name="choice"][value="V"]').disabled = true;
  document.querySelector('input[name="choice"][value="A"]').disabled = true;
  document.querySelector('input[name="choice"][value="W"]').disabled = true;

  for(var i=0; i<waveformsNum; i++) {
    if(measurementData[i].mode === 'V') {
      document.querySelector('input[name="choice"][value="V"]').disabled = false;
    }
    if(measurementData[i].mode === 'A') {
      document.querySelector('input[name="choice"][value="A"]').disabled = false;
    }
    if(measurementData[i].mode === 'W') {
      document.querySelector('input[name="choice"][value="W"]').disabled = false;
    }
  }

  if(document.querySelector('input[name="choice"][value="W"]').disabled == true) {
    document.querySelector('input[name="choice"][value="V"]').checked = true;
  }
  if(document.querySelector('input[name="choice"][value="V"]').disabled == true) {
    document.querySelector('input[name="choice"][value="A"]').checked = true;
  }
  if(document.querySelector('input[name="choice"][value="A"]').disabled == true) {
    document.querySelector('input[name="choice"][value="V"]').checked = true;
  }

  setGraphData();
  chart = new Chartist.Line(chartContainer, chartData, chartOptions);

  initializeStat();
}

function setGraphData() {
  plotDataForChart = [[], [], [], []];

  for(var i=0; i<waveformsNum; i++) {

    const selected = document.querySelector('input[name="choice"]:checked');
    const color = measurementData[i].color;
    if(measurementData[i].mode===selected.value) {
      if(color==1) {  // color-brown
        plotDataForChart[3] = measurementData[i].records;
      } else if(color==2) {  // color-red
        plotDataForChart[2] = measurementData[i].records;
      } else if(color==6) {  // color-blue
        plotDataForChart[1] = measurementData[i].records;
      } else {  // color-green
        plotDataForChart[0] = measurementData[i].records;
      }
    }
  }

  chartData = {  // data
    series: [
      {
        name: 'series-1',   // Green
        data: plotDataForChart[0]
      },
      {
        name: 'series-2',   // Blue
        data: plotDataForChart[1]
      },
      {
        name: 'series-3',   // Red
        data: plotDataForChart[2]
      },
      {
        name: 'series-4',   // Brown
        data: plotDataForChart[3]
      },
      {
        name: 'to-show-zero-point',
        data: [{x: 0, y: 0}]
      }
    ]
  }

  chartOptions = {
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
    //    resetOnRightMouseBtn: true,
        onZoom : onZoom,
        ongoingMouseDown : ongoingMouseDown,
      })
    ]
  }
}

function initializeStat() {

  for(var i=0; i<waveformsNum; i++) {
    if(measurementData[i].mode !== undefined) {
      stat[i].setData(measurementData[i]);
    }
  }
  // Clear stat-time
  var divElem = document.getElementById('stat-time-val');
  divElem.innerHTML = 'H:M:S.msec';

  for(var i=0; i<MAX_STAT_NUM; i++) {
    var divElem = document.getElementById('stat-container' + i);
    if(i<waveformsNum) {
      divElem.style.display = '';
    } else {
      divElem.style.display = 'none';
    }
  }
  resizeWindows();
  if(waveformsNum) {
    document.getElementById("top-of-chart").style.display = '';
  } else {
    document.getElementById("top-of-chart").style.display = 'none';
  }
}

var resetZoomFunc;
function onZoom(chart, reset) {
  resetZoomFunc = reset;
  console.log('HighLow' + chart.options.axisX.highLow);

  if(!(chart.options.axisX.highLow)) {
    chart.update(chart.data, chart.options);
    return;
  }
  var maxVal = 0;
  for(var i=0; i<waveformsNum; i++) {
    stat[i].showStat(chart.options.axisX.highLow.low, chart.options.axisX.highLow.high);

    if(stat[i].mode===document.querySelector('input[name="choice"]:checked').value) {
      if(maxVal < stat[i].max) {
        maxVal=stat[i].max;
      }
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

var cycle = 0;
function update() {
  window.setTimeout(update, timeInterval);

  if(fsm.state=='run' || fsm.state=='run-zoom') {
    var t = new Date();
    if(plotStart == 0) {
      plotStart = t;
    }
    var tdiff = t.getTime() - plotStart.getTime();
    for(var i=0; i<connectedDmmNum; i++) {
      dmmctrl[i].acquisition(tdiff, true);
    }
  } else {
    for(var i=0; i<connectedDmmNum; i++) {
      dmmctrl[i].acquisition(0, false);
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

function resizeWindows() {
  if(fsm.state!=='nograph') {
    const num = Math.ceil(waveformsNum / Math.floor(window.outerWidth / WIDTH_AUTO_FIT));
    window.resizeTo(window.outerWidth, HEIGHT_MIN + HEIGHT_METER*connectedDmmNum + HEIGHT_STAT*num + HEIGHT_GRAPH);
  } else {
    window.resizeTo(window.outerWidth, HEIGHT_MIN + HEIGHT_METER*connectedDmmNum);
  }
}

window.addEventListener('resize', function(event) {
  if(fsm.state!=='nograph') {
    resizeWindows();
    chart.options.axisX.divisor = parseInt(window.outerWidth/100);
    chart.update(chart.data, chart.options);
  }
}, true);

window.addEventListener('beforeunload', () => {
  for(var i=0; i<connectedDmmNum; i++) {
    dmmctrl[i].close();
  }
});

window.addEventListener('error', (event) => {
  console.error('Renderer error caught:', event.error);
});

window.addEventListener('unhandledrejection', (event) => {
  console.error('Unhandled promise rejection:', event.reason);
});

