class DmmDevManager {

  constructor() {
    const Dmm=require('./toolbit-lib/index').Choppy;
    this.dmm = new Dmm();
  }

  sortSerialListByColor(serials) {
    var list = [];

    if(serials.size()==0) {
      // nothing to do
      return list;
    }
    for(var i=0; i<serials.size(); i++) {
      if(this.dmm.open(serials.get(i))) {
        // Fail to open
        return list;
      }
      var color = this.dmm.getColor();
      var order = 0;
      if(color==5) { order = 0; }                 // 5: green
      else if(color==6) { order = 1; }            // 6: blue
      else if(color==2) { order = 2; }            // 2: red
      else if(color==1) { order = 3; }            // 1: brown    
      list.push([order, serials.get(i)]);
      this.dmm.close();
    }
    // sort list by color
    return list.sort((a, b) => a[0] - b[0]).map(item => item[1]);
  }

}

module.exports = DmmDevManager;
