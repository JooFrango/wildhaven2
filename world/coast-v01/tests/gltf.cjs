const validator=require(process.env.GLTF_VALIDATOR_PATH||'gltf-validator');
const fs=require('node:fs');
const path=require('node:path');
const {createHash}=require('node:crypto');
const root=path.resolve(__dirname,'..');
(async()=>{
    const results=[];
    const continent=process.argv.includes('--continente');
    const read=name=>JSON.parse(fs.readFileSync(path.join(root,name),'utf8'));
    const models=continent
        ? read('viewer/continente/composition.json').tiles.map(t=>({file:t.model,sha256:t.sha256})).concat(
            ['litoral','plataforma'].map(name=>({file:`viewer/continente/${name}.glb`})))
        : read('manifest.json').models;
    for(const model of models){
        const data=fs.readFileSync(path.join(root,model.file));
        const sha256=createHash('sha256').update(data).digest('hex');
        if(model.sha256&&model.sha256!==sha256)throw Error('SHA-256 '+model.file);
        const report=await validator.validateBytes(new Uint8Array(data),{uri:model.file,maxIssues:64});
        const {numErrors,numWarnings,numInfos,messages}=report.issues;
        results.push({file:model.file,sha256,numErrors,numWarnings,numInfos,
            codes:[...new Set(messages.map(item=>item.code))]});
        if(numErrors||numWarnings)console.log(model.file,messages.filter(m=>m.severity<=1));
    }
    const output=continent?'continental-gltf.json':'gltf.json';
    fs.writeFileSync(path.join(__dirname,output),JSON.stringify({validator:validator.version(),results},null,2)+'\n');
    if(results.some(r=>r.numErrors))process.exitCode=1;
})().catch(e=>{console.error(e);process.exitCode=1;});
