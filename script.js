
(() => {
  const q=(s,ctx=document)=>ctx.querySelector(s), qa=(s,ctx=document)=>[...ctx.querySelectorAll(s)];
  const modal=q('#doc-modal'), img=q('#doc-image'), title=q('#doc-title');
  const openDoc=(src,t)=>{ if(!modal) return; img.src=src; img.alt=t||'Document preview'; title.textContent=t||'Document'; modal.classList.add('open'); document.body.style.overflow='hidden'; };
  const closeDoc=()=>{ if(!modal) return; modal.classList.remove('open'); document.body.style.overflow=''; setTimeout(()=>{img.src='';},150); };
  qa('[data-doc]').forEach(el=>el.addEventListener('click',e=>{e.preventDefault();openDoc(el.dataset.doc,el.dataset.title)}));
  q('#doc-close')?.addEventListener('click',closeDoc);
  modal?.addEventListener('click',e=>{ if(e.target===modal) closeDoc(); });
  document.addEventListener('keydown',e=>{ if(e.key==='Escape') closeDoc(); });
  const obs=new IntersectionObserver((entries)=>entries.forEach(e=>{if(e.isIntersecting){e.target.classList.add('visible');obs.unobserve(e.target)}}),{threshold:.08});
  qa('.reveal').forEach(el=>obs.observe(el));
  qa('a[href^="#"]').forEach(a=>a.addEventListener('click',()=>{const id=a.getAttribute('href'); if(id.length>1) setTimeout(()=>q(id)?.focus?.({preventScroll:true}),450)}));
})();
