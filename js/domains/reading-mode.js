export function init() {var rm=false;try{rm=localStorage.getItem('readingMode')==='true'}catch(e){/* 忽略：存储不可用时按未开启处理 */}if(rm)document.documentElement.setAttribute('data-reading','true')}
