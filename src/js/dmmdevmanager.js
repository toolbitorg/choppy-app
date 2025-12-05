const TbiDeviceManager=require('./toolbit-lib/index').TbiDeviceManager;
const Choppy=require('./toolbit-lib/index').Choppy;


class DmmDevManager {

  constructor() {
    this.devlist = [];
  }

  getDeviceList() {
    const tbiDeviceManager = new TbiDeviceManager();
    this.devlist = this.#convertDmmListToArray('DMM1', tbiDeviceManager.getSerialList('DMM1'));
    this.devlist = this.devlist.concat(
      this.#sortChoppyListByColor(this.#convertChoppyListToArray('Choppy', tbiDeviceManager.getSerialList('Choppy')))
    );
    return this.devlist;
  }

  #convertDmmListToArray(devname, serials) {
    let seriallist = [];
    for(var i=0; i<serials.size(); i++) {
      seriallist.push(serials.get(i)) 
    }
    seriallist.sort((a, b) => parseInt(a[0], 16) - parseInt(b[0], 16));

    let devlist = [];
    const colorlist = [5, 6, 2, 1];  // 5: green, 6: blue, 2: red, 1: brown
    for(var i=0; i<serials.size(); i++) {
      devlist.push([seriallist[i], devname, colorlist[i]]) 
    }
    return devlist;
  }

  #convertChoppyListToArray(devname, serials) {
    const dmm = new Choppy;
    let devlist = [];
    
    if(serials.size()==0) {
      // nothing to do
      return devlist;
    }

    for(var i=0; i<serials.size(); i++) {
      if(dmm.open(serials.get(i))) {
        // Fail to open
        return devlist;
      }
      //console.log('ProductName / Serial / FwVer / Color');
      console.log('Name:'+dmm.getProductName()+' Serial:'+dmm.getProductSerial()+' FW:'+dmm.getFirmVersion()+' Color:'+dmm.getColor());

      devlist.push([serials.get(i), devname, dmm.getColor()])
      dmm.close();
    }
    return devlist;
  }

  #sortChoppyListByColor(devlist) {
    const colorlist = [5, 6, 2, 1];  // 5: green, 6: blue, 2: red, 1: brown
    const usedColorlist = devlist.map(item => item[2]);
    const unusedColorlist = colorlist.filter(item => !usedColorlist.includes(item));

    let res = [];
    if(devlist.length==0) {
      // nothing to do
      return res;
    }
    let green_cnt = 0;
    for(var i=0; i<devlist.length; i++) {
      var color = devlist[i][2];
      var order = 0;
      if(color==5 || color==0) {                         // 5: green      
        green_cnt++;
        if(green_cnt>=2) {
          color=unusedColorlist.shift();
        }
      }
      if(color==6) { order = 1; }            // 6: blue
      else if(color==2) { order = 2; }       // 2: red
      else if(color==1) { order = 3; }       // 1: brown    
      res.push([order, [devlist[i][0], devlist[i][1], color]]);
    }
    // sort list by color
    return res.sort((a, b) => a[0] - b[0]).map(item => item[1]);
  }

}

module.exports = DmmDevManager;
