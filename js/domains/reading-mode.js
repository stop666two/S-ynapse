export function init() {var rm=false;try{rm=localStorage.getItem('readingMode')==='true'}catch(e){}if(rm)document.documentElement.setAttribute('data-reading','true')}
