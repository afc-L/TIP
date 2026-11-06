const {chromium}=require('playwright');
(async()=>{const b=await chromium.launch();const p=await b.newPage({viewport:{width:1200,height:1400}});
p.on('console',m=>console.log('console:',m.text()));p.on('pageerror',e=>console.log('ERR',e.message));
await p.goto('file://'+process.argv[2]);await p.waitForTimeout(500);
await p.locator('canvas').first().screenshot({path:process.argv[3]});await b.close();})();
