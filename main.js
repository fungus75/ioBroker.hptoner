/**
 *
 * hptoner adapter
 *
 *
 *  file io-package.json comments:
 *
 *  {
 *      "common": {
 *          "name":         "hptoner",                  // name has to be set and has to be equal to adapters folder name and main file name excluding extension
 *          "version":      "0.0.0",                    // use "Semantic Versioning"! see http://semver.org/
 *          "title":        "Node.js hptoner Adapter",  // Adapter title shown in User Interfaces
 *          "authors":  [                               // Array of authord
 *              "name <mail@hptoner.com>"
 *          ]
 *          "desc":         "hptoner adapter",          // Adapter description shown in User Interfaces. Can be a language object {de:"...",ru:"..."} or a string
 *          "platform":     "Javascript/Node.js",       // possible values "javascript", "javascript/Node.js" - more coming
 *          "mode":         "daemon",                   // possible values "daemon", "schedule", "subscribe"
 *          "materialize":  true,                       // support of admin3
 *          "schedule":     "0 0 * * *"                 // cron-style schedule. Only needed if mode=schedule
 *          "loglevel":     "info"                      // Adapters Log Level
 *      },
 *      "native": {                                     // the native object is available via adapter.config in your adapters code - use it for configuration
 *          "test1": true,
 *          "test2": 42,
 *          "mySelect": "auto"
 *      }
 *  }
 *
 */

/* jshint -W097 */// jshint strict:false
/*jslint node: true */
'use strict';

// you have to require the utils module and call adapter function
//const utils =    require(__dirname + '/lib/utils'); // Get common adapter utils
const utils = require('@iobroker/adapter-core');

// you have to call the adapter function and pass a options object
// name has to be set and has to be equal to adapters folder name and main file name excluding extension
// adapter will be restarted automatically every time as the configuration changed, e.g system.adapter.hptoner.0
//const adapter = new utils.Adapter('hptoner');
let adapter;
function startAdapter(options) {
	options = options || {};
	Object.assign(options, {
		 name: 'hptoner',
		 ready: main,
		 unload: callback => {
				 try {
			  adapter.log.debug('cleaned everything up...');
			  callback();
		  } catch (e) {
			  callback();
		  }
		 }
		 
	});
  
	adapter = new utils.Adapter(options);
	return adapter;
  }


// Fetches Data from next IP and updates Status
function fetchNextIp() {
    adapter.config.currentIndex++;
    if (adapter.config.currentIndex>=adapter.config.devices.length) {
	adapter.config.currentIndex=-1;
	setTimeout(fetchNextIp,15*60*1000);
	return;
    }

    var snmp = require ("net-snmp");
    var ip = adapter.config.devices[adapter.config.currentIndex].ip;
    adapter.log.info('Asking: ' + ip);

    var session = snmp.createSession (ip, "public");

    var oids = ["1.3.6.1.2.1.1.1.0",	// device-Name
		"1.3.6.1.2.1.43.11.1.1.6.1.1",	// first toner name
		"1.3.6.1.2.1.43.11.1.1.9.1.1",  // first toner level
		"1.3.6.1.2.1.43.11.1.1.6.1.2",	// second toner name
		"1.3.6.1.2.1.43.11.1.1.9.1.2",  // second toner level
		"1.3.6.1.2.1.43.11.1.1.6.1.3",	// third toner name
		"1.3.6.1.2.1.43.11.1.1.9.1.3",  // third toner level
		"1.3.6.1.2.1.43.11.1.1.6.1.4",	// forth toner name
		"1.3.6.1.2.1.43.11.1.1.9.1.4"   // forth toner level
               ];

     var name=adapter.config.devices[adapter.config.currentIndex].displayName;
     var firstRun=adapter.config.devices[adapter.config.currentIndex].firstRun;
     adapter.config.devices[adapter.config.currentIndex].firstRun=false;

     var destination=[
		'devices.'+name+'.name',
		'devices.'+name+'.toner1.name',
		'devices.'+name+'.toner1.level',
		'devices.'+name+'.toner2.name',
		'devices.'+name+'.toner2.level',
		'devices.'+name+'.toner3.name',
		'devices.'+name+'.toner3.level',
		'devices.'+name+'.toner4.name',
		'devices.'+name+'.toner4.level'
		];

     var types=['string',
		'string',
		'integer',
		'string',
		'integer',
		'string',
		'integer',
		'string',
		'integer'];
     var names=['Printer Model',
		'Toner 1 Model',
		'Toner 1 Level',
		'Toner 2 Model',
		'Toner 2 Level',
		'Toner 3 Model',
		'Toner 3 Level',
		'Toner 4 Model',
		'Toner 4 Level'];



	   session.get (oids,function (error, varbinds) {
    		if (error) {
        		adapter.log.error (error);
    		} else {
        		for (var i = 0; i < varbinds.length; i++)
            		if (snmp.isVarbindError (varbinds[i]))
                		adapter.log.error (snmp.varbindError (varbinds[i]))
            		else {
                		adapter.log.info(varbinds[i].oid + " = " + varbinds[i].value);

				if (firstRun) {
					adapter.setObject(destination[i], {
			        		type: 'state',
						common: {
						    name: names[i],
						    type: types[i],
						    role: 'value'
						},
						native: {}
		    			});
					adapter.config.devices[adapter.config.currentIndex].lastValue.push(-1);
				}

				let value=varbinds[i].value;
				if (types[i]=='string') value=''+value;
				if (adapter.config.devices[adapter.config.currentIndex].lastValue[i]!=value) {
					adapter.setState(destination[i],value,true);
					adapter.config.devices[adapter.config.currentIndex].lastValue[i]=value;
				}

			}
    		}

    		// If done, close the session
    		session.close ();
		
	   });

	setTimeout(fetchNextIp,10000);
}



function main() {
    adapter.config.currentIndex=-1; //because fetchnextIp will increment
    let firstRun=true;
    if (adapter.config.wereRunBefore) firstRun=false;
    adapter.config.wereRunBefore=true;

    if (firstRun) adapter.log.info("firstRun");

    /**
     *
     *      For every state in the system there has to be also an object of type state
     *
     *      Here a simple hptoner for a boolean variable named "testVariable"
     *
     *      Because every adapter instance uses its own unique namespace variable names can't collide with other adapters variables
     *
     */


    if (adapter.config.devices && adapter.config.devices.length) {
	for (let k=0;k<adapter.config.devices.length;k++) {
	        adapter.config.devices[k].displayName=adapter.config.devices[k].ip.replace(/[.\s]+/g, '_');
		if (firstRun) {
			adapter.config.devices[k].firstRun=true;
			adapter.config.devices[k].lastValue=new Array();
		}

         }
	setTimeout(fetchNextIp,1000);
    }


    // in this hptoner all states changes inside the adapters namespace are subscribed
    if (firstRun) adapter.subscribeStates('*');

}

// If started as allInOne/compact mode => return function to create instance
if (module && module.parent) {
    module.exports = startAdapter;
} else {
    // or start the instance directly
    startAdapter();
}
