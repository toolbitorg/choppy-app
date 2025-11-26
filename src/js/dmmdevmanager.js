const TbiDeviceManager=require('./toolbit-lib/index').TbiDeviceManager;
const Choppy=require('./toolbit-lib/index').Choppy;


class DmmDevManager {

  constructor() {
    this.devlist = [];
  }

  getDeviceList() {
    const tbiDeviceManager = new TbiDeviceManager();
    this.devlist = this.#convertTbiSerialListToArray('DMM1', tbiDeviceManager.getSerialList('DMM1'));
    this.devlist = this.devlist.concat(
      this.#sortChoppyListByColor(this.#convertTbiSerialListToArray('Choppy', tbiDeviceManager.getSerialList('Choppy')))
    );
    return this.devlist;
  }

  #convertTbiSerialListToArray(devname, serials) {
    let devlist = [];
    for(var i=0; i<serials.size(); i++) {
      devlist.push([serials.get(i), devname]) 
    }
    return devlist;
  }

  #sortChoppyListByColor(devlist) {
    const dmm = new Choppy;
    let res = [];
    
    if(devlist.length==0) {
      // nothing to do
      return res;
    }
    for(var i=0; i<devlist.length; i++) {
      if(dmm.open(devlist[i][0])) {
        // Fail to open
        return res;
      }
      //console.log('ProductName / Serial / FwVer / Color');
      console.log('Name:'+dmm.getProductName()+' Serial:'+dmm.getProductSerial()+' FW:'+dmm.getFirmVersion()+' Color:'+dmm.getColor());
      
      var color = dmm.getColor();
      var order = 0;
      if(color==5) { order = 0; }                 // 5: green
      else if(color==6) { order = 1; }            // 6: blue
      else if(color==2) { order = 2; }            // 2: red
      else if(color==1) { order = 3; }            // 1: brown    
      res.push([order, devlist[i]]);
      dmm.close();
    }
    // sort list by color
    return res.sort((a, b) => a[0] - b[0]).map(item => item[1]);
  }

}

module.exports = DmmDevManager;
