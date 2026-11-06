// Node harness: load game data scripts in a fake browser context
const fs=require('fs'),vm=require('vm'),path=require('path');
const ctx={console,Math,Date,JSON,setTimeout,clearTimeout,setInterval,clearInterval};
ctx.window=ctx; ctx.document={createElement:()=>({getContext:()=>({})})};
ctx.addEventListener=()=>{};
vm.createContext(ctx);
module.exports=function(files){for(const f of files){vm.runInContext(fs.readFileSync(path.join(__dirname,'..',f),'utf8'),ctx,{filename:f});}return ctx.MB;};
