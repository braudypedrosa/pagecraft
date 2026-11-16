/* Show/hide control for every password field on server-rendered pages.

   Pages keep plain <input type="password"> markup; this boot script wraps each one and adds a
   real <button type="button"> after it, so forms still submit normally without JavaScript.
   The button announces its state with aria-pressed and a label that names the action. */

export const PASSWORD_TOGGLE_CSS = `
.pc-password{position:relative;display:block;width:100%}
.pc-password>input{width:100%;padding-right:48px!important}
.pc-password>.pc-password-toggle.pc-password-toggle{position:absolute;top:50%;right:6px;transform:translateY(-50%);display:inline-flex;align-items:center;justify-content:center;width:36px;height:36px;min-height:0;margin:0;padding:0;border:0;border-radius:8px;background:transparent;color:inherit;opacity:.68;cursor:pointer;box-shadow:none;font-size:0;line-height:0;text-transform:none;letter-spacing:0;flex:none}
.pc-password>.pc-password-toggle.pc-password-toggle:hover{opacity:1;background:rgba(127,127,127,.14)}
.pc-password>.pc-password-toggle.pc-password-toggle:focus-visible{opacity:1;outline:2px solid currentColor;outline-offset:1px}
.pc-password-toggle svg{width:20px;height:20px;pointer-events:none}
.pc-password-toggle [data-icon="hide"]{display:none}
.pc-password-toggle[aria-pressed="true"] [data-icon="show"]{display:none}
.pc-password-toggle[aria-pressed="true"] [data-icon="hide"]{display:block}
`;

const EYE = '<svg data-icon="show" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M2 12s3.6-7 10-7 10 7 10 7-3.6 7-10 7S2 12 2 12Z"/><circle cx="12" cy="12" r="3"/></svg>';
const EYE_OFF = '<svg data-icon="hide" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M10.6 5.1A10.8 10.8 0 0 1 12 5c6.4 0 10 7 10 7a17.6 17.6 0 0 1-3.2 4.2M6.6 6.6C3.6 8.6 2 12 2 12s3.6 7 10 7a10 10 0 0 0 5.4-1.6"/><path d="M9.9 9.9a3 3 0 0 0 4.2 4.2"/><path d="m3 3 18 18"/></svg>';

export const PASSWORD_TOGGLE_SCRIPT = `(()=>{const boot=()=>{document.querySelectorAll('input[type="password"]:not([data-password-toggle])').forEach((input,index)=>{input.setAttribute('data-password-toggle','');if(!input.id)input.id='pc-password-'+index;const wrap=document.createElement('span');wrap.className='pc-password';input.parentNode.insertBefore(wrap,input);wrap.appendChild(input);const button=document.createElement('button');button.type='button';button.className='pc-password-toggle';button.setAttribute('aria-controls',input.id);button.setAttribute('aria-pressed','false');button.setAttribute('aria-label','Show password');button.innerHTML=${JSON.stringify(EYE + EYE_OFF)};button.addEventListener('click',()=>{const show=input.type==='password';input.type=show?'text':'password';button.setAttribute('aria-pressed',String(show));button.setAttribute('aria-label',show?'Hide password':'Show password');});wrap.appendChild(button);const form=input.form;if(form&&!form.hasAttribute('data-password-reset')){form.setAttribute('data-password-reset','');form.addEventListener('submit',()=>form.querySelectorAll('input[data-password-toggle]').forEach(field=>{field.type='password';}));}});};if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',boot);else boot();})();`;

