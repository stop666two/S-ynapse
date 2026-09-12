function lines(p){var c=p.querySelector('code');return c?(c.textContent||'').split('\n').length:0}
function boot(){
var F=window.__FEATURES__||{};
var CB0=(F&&F.codeBlock)||{};var win=CB0.windowBar!==false;var vis=CB0.copyButtonVisibility||'hover';var th=CB0.maxHeightVh?parseInt(CB0.maxHeightVh)||0:0;
var IC={dl:'<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="7,10 12,15 17,10"/><line x1="12" y1="15" x2="12" y2="3"/></svg>',exp:'<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><polyline points="6,9 12,15 18,9"/></svg>',col:'<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><polyline points="18,15 12,9 6,15"/></svg>'};
document.querySelectorAll('.post-content pre').forEach(function(p){
if(p.getAttribute('data-language')==='mermaid'||p.querySelector('div.mermaid')||p.querySelector('code.language-mermaid'))return;
var code0=p.querySelector('code');
var CB=(F&&F.codeCopy)||{};var COPYT=CB.buttonText||__T('toolbar.copyCode','复制代码'),COPIED=CB.copiedText||__T('toolbar.copied','已复制'),COPYTIMEOUT=isNaN(+CB.buttonTimeout)?1500:+CB.buttonTimeout;
if(code0&&code0.classList.contains('language-mermaid'))return;
var lang=p.getAttribute('data-language');
if(!lang&&code0){var m=code0.className.match(/language-([\w-]+)/);lang=m?m[1]:''}
if(win&&!p.classList.contains('code-window')){
var bar=document.createElement('div');bar.className='code-windowbar';
bar.innerHTML='<span class="cw-dots"><span class="cw-dot cw-red"></span><span class="cw-dot cw-yellow"></span><span class="cw-dot cw-green"></span></span>';
if(lang&&CB0.showLanguageTag!==false){var l=document.createElement('span');l.className='cw-lang';l.textContent=lang;bar.appendChild(l)}
p.parentNode.insertBefore(bar,p);p.classList.add('code-window')}
var row=document.createElement('div');row.className='code-actions';
if(vis!=='never'){
var cb=document.createElement('button');cb.className='code-action-btn copy';cb.innerHTML='<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><rect x="9" y="9" width="12" height="12" rx="2"/><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"/></svg>';cb.title=COPYT;
cb.onclick=function(){var c=p.querySelector('code')||p;navigator.clipboard.writeText(c.textContent).then(function(){cb.innerHTML='<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><polyline points="20,6 9,17 4,12"/></svg>';cb.title=COPIED;setTimeout(function(){cb.innerHTML='<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><rect x="9" y="9" width="12" height="12" rx="2"/><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"/></svg>';cb.title=COPYT},COPYTIMEOUT)})};
row.appendChild(cb)}
if(CB0.downloadButton!==false){
var db=document.createElement('button');db.className='code-action-btn download';db.innerHTML=IC.dl;db.title=__T('toolbar.downloadCode','下载代码文件');
db.onclick=function(){var c=p.querySelector('code')||p,ext=lang||'txt',now=new Date(),pad=function(n){return String(n).padStart(2,'0')};
var ts=now.getFullYear()+pad(now.getMonth()+1)+pad(now.getDate())+'-'+pad(now.getHours())+pad(now.getMinutes());
var fn=((window.__SITE_TITLE__||'site')+'-'+(window.__ART_TITLE__||'code')+'-'+ts+'.'+ext).replace(/[\\/:*?"<>|]+/g,'-');
var blob=new Blob([c.textContent],{type:'text/plain;charset=utf-8'}),a=document.createElement('a');
a.href=URL.createObjectURL(blob);a.download=fn;document.body.appendChild(a);a.click();
setTimeout(function(){URL.revokeObjectURL(a.href);a.remove()},100)};
row.appendChild(db)}
if(win&&p.classList.contains('code-window')){var wb=p.previousElementSibling;if(wb&&wb.classList.contains('code-windowbar'))wb.appendChild(row)}else{p.appendChild(row)}
if(th>0&&lines(p)>th){
p.classList.add('collapsible');
var cl=document.createElement('button');cl.className='code-expand-btn';cl.innerHTML=IC.exp+__T('toolbar.expandAll','展开全文');
cl.onclick=function(){p.classList.toggle('expanded');cl.innerHTML=p.classList.contains('expanded')?IC.col+__T('toolbar.collapseAll','收起'):IC.exp+__T('toolbar.expandAll','展开全文')};
p.appendChild(cl)}});
}
export function init() {
if(document.readyState==='loading'){document.addEventListener('DOMContentLoaded',boot)}else{boot()}
}
