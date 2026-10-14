import { readdirSync } from 'node:fs';
import { join } from 'node:path';
import { execFileSync } from 'node:child_process';

function files(directory) { return readdirSync(directory,{withFileTypes:true}).flatMap(entry=>entry.isDirectory()?files(join(directory,entry.name)):[join(directory,entry.name)]); }
for (const file of ['src','public','scripts','test'].flatMap(files).filter(file=>file.endsWith('.js'))) {
  execFileSync(process.execPath,['--check',file],{stdio:'inherit'});
}
console.log('All JavaScript files passed syntax checks.');
