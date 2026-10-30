/* Shared keyboard and focus lifecycle. Persistence stays with each form. */
(() => {
  const stack = [];
  const inerted = new Map();
  let lastPointer = null;
  const visible = el => !!el?.isConnected && !!el.getClientRects().length && !el.closest('.hidden,[inert]');
  const focusable = root => [...root.querySelectorAll('button,input,select,textarea,a[href],[tabindex]')]
    .filter(el => visible(el) && !el.disabled && el.tabIndex >= 0);
  const top = () => stack.at(-1);
  function resetInert(){
    for(const [el,value] of inerted) el.inert = value;
    inerted.clear();
  }
  function sync(){
    resetInert();
    for(let i=stack.length-1;i>=0;i--) if(stack[i].overlay.classList.contains('hidden')) stack.splice(i,1);
    const overlay = top()?.overlay;
    if(!overlay) return;
    // Inert siblings along the ancestor path, never an ancestor of the dialog.
    for(let node=overlay;node && node!==document.body;node=node.parentElement){
      for(const sibling of node.parentElement.children){
        if(sibling===node || ['SCRIPT','STYLE','LINK'].includes(sibling.tagName)) continue;
        inerted.set(sibling,sibling.inert); sibling.inert = true;
      }
    }
  }
  function focusInside(entry){
    const preferred = entry.initialFocus && entry.overlay.querySelector(entry.initialFocus);
    const target = visible(preferred) ? preferred : focusable(entry.overlay)[0] || entry.overlay;
    target.focus({preventScroll:true});
  }
  function restore(entry){
    sync();
    const current = top();
    let target = entry.trigger;
    if(!visible(target) && entry.triggerId) target = document.getElementById(entry.triggerId);
    if(!visible(target) && entry.triggerKey) target = [...document.querySelectorAll('[data-dialog-trigger]')].find(el=>el.dataset.dialogTrigger===entry.triggerKey);
    if(current){
      if(visible(target) && current.overlay.contains(target)) target.focus({preventScroll:true});
      else focusInside(current);
    }else if(visible(target)) target.focus({preventScroll:true});
    else document.querySelector('.nav-tab.active')?.focus({preventScroll:true});
  }
  function open(id, options = {}){
    const overlay = document.getElementById(id);
    sync();
    const existing = stack.find(entry => entry.overlay===overlay);
    if(existing){focusInside(existing);return;}
    const pointer = lastPointer && performance.now()-lastPointer.time<1000 && visible(lastPointer.element) ? lastPointer.element : null;
    let trigger = pointer || document.activeElement;
    if(trigger===document.body || overlay.contains(trigger)) trigger = document.activeElement;
    lastPointer = null;
    if(trigger && !trigger.matches('button,input,select,textarea,a[href],[tabindex]')) trigger.tabIndex = -1;
    const entry = {overlay,trigger,triggerId:trigger?.id,triggerKey:trigger?.closest('[data-dialog-trigger]')?.dataset.dialogTrigger,...options};
    overlay.tabIndex = -1;
    overlay.classList.remove('hidden');
    stack.push(entry); sync();
    // A new form must not inherit errors from its previous opening.
    clearErrors(overlay);
    focusInside(entry);
  }
  function close(id){
    const overlay = document.getElementById(id);
    const entry = stack.find(item => item.overlay===overlay);
    const wasTop = top()===entry;
    overlay.classList.add('hidden');
    if(entry && wasTop){
      restore(entry);
      // Save/delete handlers may rebuild the trigger immediately after closing.
      queueMicrotask(()=>{if(!visible(document.activeElement) || document.activeElement===document.body) restore(entry);});
    }else sync();
  }
  function clearErrors(root){
    root.querySelectorAll('[data-field-error]').forEach(el=>{el.hidden=true;el.textContent='';});
    root.querySelectorAll('[data-invalid-field]').forEach(el=>{el.removeAttribute('aria-invalid');el.removeAttribute('data-invalid-field');});
  }
  let fieldSequence = 0;
  function error(id,message){
    const field = typeof id==='string' ? document.getElementById(id) : id;
    if(!field.id) field.id='dialog-field-'+(++fieldSequence);
    id=field.id;
    const root = field.closest('.modal-overlay');
    if(root) clearErrors(root);
    let note = document.getElementById(id+'-error');
    if(!note){
      note = document.createElement('p');note.id=id+'-error';note.className='field-error';note.dataset.fieldError='';note.setAttribute('role','alert');
      field.parentElement.appendChild(note);
    }
    note.hidden=false;note.textContent=message;
    field.setAttribute('aria-describedby',[...new Set((field.getAttribute('aria-describedby')||'').split(/\s+/).filter(Boolean).concat(note.id))].join(' '));
    field.setAttribute('aria-invalid','true');field.dataset.invalidField='';
    // Identity and purchase fields can be behind compact summaries in edit mode.
    const editor = field.closest('.game-identity-editor,.context-editor');
    if(editor?.classList.contains('hidden')){
      editor.classList.remove('hidden');
      editor.parentElement.querySelector('.game-identity-summary,.context-summary')?.classList.add('hidden');
    }
    field.focus();
  }
  document.addEventListener('pointerdown',event=>{
    const element = event.target.closest('button,a,input,select,textarea,[tabindex],.card,.board-row,label');
    if(element) lastPointer={element,time:performance.now()};
  },true);
  document.addEventListener('keydown',event=>{
    sync(); const entry = top(); if(!entry) return;
    if(event.key==='Escape'){
      // The inline platform creator handles its own first Escape.
      if(event.target.id==='new-platform-name' && !document.getElementById('add-platform-row').classList.contains('hidden')) return;
      event.preventDefault();event.stopImmediatePropagation();entry.onDismiss?.();
    }else if(event.key==='Tab'){
      const items=focusable(entry.overlay),first=items[0],last=items.at(-1);
      if(!first){event.preventDefault();entry.overlay.focus();}
      else if(!entry.overlay.contains(document.activeElement) || document.activeElement===entry.overlay || (event.shiftKey && document.activeElement===first) || (!event.shiftKey && document.activeElement===last)){
        event.preventDefault();(event.shiftKey?last:first).focus();
      }
    }
  },true);
  document.addEventListener('focusin',event=>{
    const entry=top();if(entry && !entry.overlay.classList.contains('hidden') && !entry.overlay.contains(event.target)) focusInside(entry);
  });
  document.addEventListener('input',event=>{
    if(!event.target.hasAttribute('data-invalid-field')) return;
    const note=document.getElementById(event.target.id+'-error');if(note){note.hidden=true;note.textContent='';}
    event.target.removeAttribute('aria-invalid');event.target.removeAttribute('data-invalid-field');
  });
  const observer = new MutationObserver(()=>{
    if(stack.some(entry=>entry.overlay.classList.contains('hidden'))) sync();
  });
  document.querySelectorAll('.modal-overlay').forEach(el=>observer.observe(el,{attributes:true,attributeFilter:['class']}));
  window.JTDDialogs={open,close,error,clearErrors};
})();
